// controllers/webhookHandler.js
import mongoose from "mongoose";
import Payment from "../models/paymentModel.js";
import Transaction from "../models/TransactionModel.js";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Notification from "../models/notificationModel.js";
import Withdrawal from "../models/withdrawalModel.js";
import { sendPaymentProcessedEmail, sendWithdrawalProcessedEmail } from "../mailTrap/emails.js";
import { createChatBetweenBuyerAndSeller } from "../utils/chatHelper.js";

/**
 * Process an order payment when only metadata is available (webhook initialize metadata case).
 * This will create the order (if it doesn't exist) and process the payment.
 *
 * metadata expected: { userId, vendorId, productId, quantity, price, deliveryFee, deliveryAddress, totalAmount, commissionAmount }
 */
export const processOrderPaymentFromMetadata = async (metadata, reference, amount) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userId,
      vendorId,
      productId,
      quantity,
      price,
      deliveryFee,
      deliveryAddress,
      totalAmount,
      commissionAmount
    } = metadata || {};

    if (!userId || !vendorId || !productId) {
      console.log("❌ processOrderPaymentFromMetadata: missing metadata fields", metadata);
      await session.abortTransaction();
      return;
    }

    // If a transaction with the same reference exists, abort (idempotency)
    const existingTransaction = await Transaction.findOne({ reference }).session(session);
    if (existingTransaction) {
      console.log("⚠️ processOrderPaymentFromMetadata: transaction already exists", reference);
      await session.commitTransaction();
      return;
    }

    // Create the order (mark as paid)
    const newOrder = await Order.create([{
      user: userId,
      vendor: vendorId,
      product: productId,
      price,
      quantity,
      totalAmount,
      commissionAmount,
      deliveryFee,
      deliveryAddress,
      paymentStatus: "paid",
      paymentMethod: "payment-gateway",
      paidAt: new Date(),
      paymentReference: reference
    }], { session });

    const order = newOrder[0];

    // Create transaction record for vendor sales
    await Transaction.create([{
      user: vendorId,
      buyer: userId,
      type: "sales",
      amount,
      reference,
      status: "successful",
    }], { session });

    await session.commitTransaction();

    // Post-commit notifications / chat
    const user = await User.findById(userId);
    const vendor = await User.findById(vendorId);

    if (user?.AppNotificationSettings?.includes("ORDERS")) {
      await Notification.create({
        userId: user._id,
        title: "Order Created Successfully",
        message: `You have successfully placed an order.`,
        notificationType: "ORDERS",
        metadata: { orderId: order._id },
      });
    }

    if (vendor?.AppNotificationSettings?.includes("ORDERS")) {
      await Notification.create({
        userId: vendor._id,
        title: "New Order Received",
        message: `You've received an order from ${user?.firstName ?? "a customer"}.`,
        notificationType: "ORDERS",
        metadata: { orderId: order._id },
      });
    }

    // Create chat for the order
    try {
      await createChatBetweenBuyerAndSeller(userId, vendorId, productId, order._id);
    } catch (err) {
      console.error("⚠️ createChatBetweenBuyerAndSeller failed after metadata order creation:", err);
    }

    console.log("✅ processOrderPaymentFromMetadata: created order and processed payment", order._id);
  } catch (err) {
    console.error("❌ processOrderPaymentFromMetadata error:", err);
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
};

/**
 * Process wallet funding (webhook)
 * data: full paystack data object
 * reference: paystack reference string
 * amount: amount in base currency (not kobo)
 */
export const processWalletFunding = async (data, reference, amount) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const customerEmail = data?.customer?.email;
    if (!customerEmail) {
      console.log("❌ processWalletFunding: customer email missing in data");
      await session.abortTransaction();
      return;
    }

    const user = await User.findOne({ email: customerEmail }).session(session);
    if (!user) {
      console.log("❌ processWalletFunding: user not found for email", customerEmail);
      await session.abortTransaction();
      return;
    }

    const payment = await Payment.findOne({ reference }).session(session);
    if (!payment) {
      console.log("❌ processWalletFunding: payment record not found for", reference);
      await session.abortTransaction();
      return;
    }

    // If already success, nothing to do
    if (payment.status === "SUCCESS") {
      console.log("⚠️ processWalletFunding: payment already marked SUCCESS", reference);
      await session.commitTransaction();
      return;
    }

    // Deduplicate by transaction reference
    const existingTransaction = await Transaction.findOne({ reference }).session(session);
    if (existingTransaction) {
      console.log("⚠️ processWalletFunding: transaction already exists", reference);
      // but ensure payment is marked SUCCESS
      payment.status = "SUCCESS";
      payment.paymentMethod = data.channel?.toUpperCase() || "PAYSTACK";
      payment.transactionId = data.id;
      await payment.save({ session });
      await session.commitTransaction();
      return;
    }

    // Update payment record
    payment.status = "SUCCESS";
    payment.paymentMethod = data.channel?.toUpperCase() || "PAYSTACK";
    payment.transactionId = data.id;
    await payment.save({ session });

    // Credit user wallet
    user.balance += amount;
    await user.save({ session });

    // Create transaction
    await Transaction.create([{
      user: user._id,
      type: "deposit",
      amount,
      reference,
      status: "successful",
    }], { session });

    await session.commitTransaction();

    // Notifications & email (post-commit)
    if (user.AppNotificationSettings?.includes("PAYMENTS")) {
      await Notification.create({
        userId: user._id,
        title: "Wallet Funded Successfully",
        message: "You have successfully funded your wallet balance",
        notificationType: "PAYMENTS",
        metadata: { paymentId: payment._id },
      });
    }

    if (user.EmailNotificationSettings?.includes("PAYMENTS")) {
      sendPaymentProcessedEmail(
        user.email,
        user.firstName,
        user.lastName,
        payment.amount,
        payment.paymentMethod,
        payment.transactionId
      );
    }

    console.log("✅ processWalletFunding: wallet funded for", user._id, "ref:", reference);
  } catch (err) {
    console.error("❌ processWalletFunding error:", err);
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
};

/**
 * Handle successful transfer (withdrawal)
 * data: full paystack transfer data (or webhook payload data)
 */
export const handleWithdrawalSuccess = async (data) => {
  try {
    // data may be the entire webhook object or data.data depending on your router
    const payload = data?.data || data;
    const reference = payload?.reference;
    if (!reference) {
      console.log("❌ handleWithdrawalSuccess: missing reference");
      return;
    }

    const withdrawal = await Withdrawal.findOne({ reference });
    if (!withdrawal) {
      console.log("❌ handleWithdrawalSuccess: withdrawal not found", reference);
      return;
    }

    // Already successful?
    if (withdrawal.status === "SUCCESS") {
      console.log("⚠️ handleWithdrawalSuccess: already successful", reference);
      return;
    }

    // mark successful
    withdrawal.status = "SUCCESS";
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // update transaction
    await Transaction.findOneAndUpdate(
      { reference },
      { status: "successful" }
    );

    const user = await User.findById(withdrawal.userId);
    if (!user) {
      console.log("❌ handleWithdrawalSuccess: user not found for withdrawal", withdrawal.userId);
      return;
    }

    if (user.AppNotificationSettings?.includes("PAYMENTS")) {
      await Notification.create({
        userId: withdrawal.userId,
        title: "Withdrawal Processed Successfully",
        message: "Your withdrawal has been processed successfully",
        notificationType: "PAYMENTS",
        metadata: { withdrawalId: withdrawal._id },
      });
    }

    if (user.EmailNotificationSettings?.includes("PAYMENTS")) {
      sendWithdrawalProcessedEmail(
        user.email,
        user.firstName,
        user.lastName,
        withdrawal.amount,
        withdrawal.bankCode,
        withdrawal.accountNumber,
        withdrawal.transferId
      );
    }

    console.log("✅ handleWithdrawalSuccess: processed", reference);
  } catch (err) {
    console.error("❌ handleWithdrawalSuccess error:", err);
  }
};

/**
 * Handle failed transfer (withdrawal)
 */
export const handleWithdrawalFailure = async (data) => {
  try {
    const payload = data?.data || data;
    const reference = payload?.reference;
    if (!reference) {
      console.log("❌ handleWithdrawalFailure: missing reference");
      return;
    }

    const withdrawal = await Withdrawal.findOne({ reference });
    if (!withdrawal) {
      console.log("❌ handleWithdrawalFailure: withdrawal not found", reference);
      return;
    }

    if (withdrawal.status === "FAILED") {
      console.log("⚠️ handleWithdrawalFailure: already failed", reference);
      return;
    }

    // refund balance back to user
    const user = await User.findById(withdrawal.userId);
    if (!user) {
      console.log("❌ handleWithdrawalFailure: user not found", withdrawal.userId);
      return;
    }

    withdrawal.status = "FAILED";
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    user.balance += withdrawal.amount;
    await user.save();

    await Transaction.findOneAndUpdate(
      { reference },
      { status: "failed" }
    );

    if (user.AppNotificationSettings?.includes("PAYMENTS")) {
      await Notification.create({
        userId: withdrawal.userId,
        title: "Withdrawal Failed",
        message: "Your withdrawal process failed. Please try again later",
        notificationType: "PAYMENTS",
        metadata: { withdrawalId: withdrawal._id },
      });
    }

    console.log("✅ handleWithdrawalFailure: processed", reference);
  } catch (err) {
    console.error("❌ handleWithdrawalFailure error:", err);
  }
};