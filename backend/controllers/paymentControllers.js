import axios from 'axios'
import Payment from '../models/paymentModel.js'
import User from '../models/userModel.js'
import Transaction from '../models/TransactionModel.js'
import Notification from '../models/notificationModel.js'
import { sendPaymentProcessedEmail } from '../mailTrap/emails.js'

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

export const initializePayment = async (req, res) => {
  try {
    const { email, amount, currency = "NGN" } = req.body;
    const userId = req.userId;

    if (!email || !amount)
      return res.status(400).json({ message: "Invalid Request" });

    // Strong reference generator 
    const reference = `fund_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        currency,
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          isFunding: true,
          userId,
          amount,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    await Payment.create({
      user: userId,
      amount,
      status: "PENDING",
      reference,
      currency,
      transactionId: reference,
    });

    return res.status(200).json({
      message: response.data.message,
      data: {
        paymentData: response.data.data,
      },
    });

  } catch (error) {
    console.log(error.response?.data || error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference } = req.query;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      }
    );

    const paystackData = response.data.data;

    const payment = await Payment.findOne({ reference }).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Payment not found" });
    }

    if (payment.status === "SUCCESS") {
      await session.commitTransaction();
      return res.status(200).json({ message: "Payment already processed", data: payment });
    }

    if (paystackData.status !== "success") {
      payment.status = "FAILED";
      await payment.save({ session });
      await session.commitTransaction();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const user = await User.findById(payment.user).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(400).json({ message: "User not found" });
    }

    // Process wallet funding
    payment.status = "SUCCESS";
    payment.paymentMethod = paystackData.channel?.toUpperCase() || "PAYSTACK";
    payment.transactionId = paystackData.id;

    user.balance += payment.amount;

    await user.save({ session });
    await payment.save({ session });

    // Prevent duplicate transaction entry
    const existingTransaction = await Transaction.findOne({ reference }).session(session);
    if (!existingTransaction) {
      await Transaction.create(
        [
          {
            user: user._id,
            type: "deposit",
            amount: payment.amount,
            reference,
            status: "successful",
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();

    // Notifications (outside transaction)
    if (user.AppNotificationSettings.includes("PAYMENTS")) {
      await Notification.create({
        userId: user._id,
        title: "Wallet Funded Successfully",
        message: "You have successfully funded your wallet",
        notificationType: "PAYMENTS",
        metadata: { paymentId: payment._id },
      });
    }

    if (user.EmailNotificationSettings.includes("PAYMENTS")) {
      sendPaymentProcessedEmail(
        user.email,
        user.firstName,
        user.lastName,
        payment.amount,
        payment.paymentMethod,
        payment.transactionId
      );
    }

    return res.status(200).json({
      message: "Payment processed successfully",
      data: payment,
    });

  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};