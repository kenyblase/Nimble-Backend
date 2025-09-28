import Payment from "../models/paymentModel.js";
import Transaction from "../models/TransactionModel.js";
import User from "../models/userModel.js";
import Withdrawal from "../models/withdrawalModel.js";
import Notification from "../models/notificationModel.js";
import { sendWithdrawalProcessedEmail } from "../mailTrap/emails.js";

 export const processOrderPayment = async (order, reference, amount, res) => {
  try {
      if (order.paymentStatus === "paid") {
          return res.status(200).json({ message: "Payment already processed." });
      }

      const vendor = await User.findById(order.vendor);
      if (!vendor) {
          return res.status(400).json({ message: "Vendor not found" });
      }
      const user = await User.findById(order.user);
      if (!user) {
          return res.status(400).json({ message: "User not found" });
      }

      const existingTransaction = await Transaction.findOne({ reference });
      if (!existingTransaction) {
          await Transaction.create({
              user: order.user,
              type: "payment",
              amount,
              reference,
              status: "successful"
          });
      }

      vendor.pendingBalance += amount;
      await vendor.save();

      order.paymentStatus = "paid";
      await order.save();

      if(user.AppNotificationSettings.includes('ORDERS')){
        await Notification.create({
            userId: order.user,
            title: 'Order Created Successfully',
            message: `You have successfully placed an order for a product`,
            notificationType: 'ORDERS',
            metadata: {orderId: order._id}
        })
      }
        
      if(vendor.AppNotificationSettings.includes('ORDERS')){
        await Notification.create({
            userId: order.vendor,
            title: 'Order Received',
            message: `You've received an order from ${user.firstName} ${user.lastName}`,
            notificationType: 'ORDERS',
            metadata: {orderId: order._id}
        })
      }

      return res.status(200).json({ message: "Payment successful, order confirmed." });
  } catch (error) {
      console.error("Error processing order payment:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
};

export const processWalletFunding = async (data, reference, amount, res) => {
  try {
      const user = await User.findOne({ email: data.customer.email });

      if (!user) {
          return res.status(400).json({ message: "User not found" });
      }

      const payment = await Payment.findOne({reference})

      if(payment.status === 'SUCCESS'){
        return res.status(200).json({ message: "Payment already processed." });
      }

      const existingTransaction = await Transaction.findOne({ reference });
      if (existingTransaction) {
          return res.status(200).json({ message: "Wallet funding already processed." });
      }

      await Transaction.create({
          user: user._id,
          type: "deposit",
          amount,
          reference,
          status: "successful",
      });

      user.balance += amount;
      await user.save();

      if(user.AppNotificationSettings.includes('PAYMENTS')){
        await Notification.create({
          userId: user._id,
          title: "Wallet Funded Successfully",
          message: 'You have successfully funded your wallet balance',
          notificationType: "PAYMENTS",
          metadata: {paymentId: payment._id}
        })
      }

      if(user.EmailNotificationSettings.includes('PAYMENTS')){
        sendPaymentProcessedEmail(user.email, user.firstName, user.lastName, payment.amount, payment.paymentMethod, payment.transactionId)
      }

      return res.status(200).json({ message: "Wallet funded successfully."});
  } catch (error) {
      console.error("Error processing wallet funding:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
};

export const handleWithdrawalSuccess = async (data) => {
  const { reference } = data.data;

  const withdrawal = await Withdrawal.findOne({ reference });
  if (!withdrawal) throw new Error("Withdrawal request not found");

  if (withdrawal.status === "successful") return res.status(200).json({ message: "Withdrawal already processed." });

  withdrawal.status = "successful";
  await withdrawal.save();

  await Transaction.create({
    user: withdrawal.userId,
    type: "withdrawal",
    amount: withdrawal.amount,
    reference,
    status: "successful",
  });

  const user = await User.findById(withdrawal.userId)
  if(!user) return res.status(400).json({message: 'User not found'})

  if(user.AppNotificationSettings.includes('PAYMENTS')){
    await Notification.create({
      userId: withdrawal.userId,
      title: "Withdrawal Processed Successfully",
      message: 'Your withdrawal has been processed successfully',
      notificationType: 'PAYMENTS',
      metadata: {withdrawalId: withdrawal._id}
    })
  }

  if(user.EmailNotificationSettings.includes('PAYMENTS')){
    sendWithdrawalProcessedEmail(user.email, user.firstName, user.lastName, withdrawal.amount, withdrawal.bankCode, withdrawal.accountNumber, withdrawal.transferId)
  }
};

export const handleWithdrawalFailure = async (data) => {
  const { reference } = data.data;

  const withdrawal = await Withdrawal.findOne({ reference });
  if (!withdrawal) throw new Error("Withdrawal request not found");

  const user = await User.findById(withdrawal.userId)
  if (!user) throw new Error("User not found");

  if (withdrawal.status === "failed") return res.status(200).json({ message: "Withdrawal already processed." });

  withdrawal.status = "failed";
  await withdrawal.save();

  user.balance += withdrawal.amount
  await user.save();

  await Transaction.create({
    user: user._id,
    type: "withdrawal",
    amount: withdrawal.amount,
    reference,
    status: "failed",
  });

  if(user.AppNotificationSettings.includes('PAYMENTS')){
    await Notification.create({
      userId: withdrawal.userId,
      title: "Withdrawal Failed",
      message: 'Your withdrawal process failed. Please try again later',
      notificationType: 'PAYMENTS',
      metadata: {withdrawalId: withdrawal._id}
    })
  }
};