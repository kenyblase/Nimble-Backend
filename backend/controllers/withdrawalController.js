import axios from "axios";
import User from '../models/userModel.js'
import Withdrawal from '../models/withdrawalModel.js'
import Notification from '../models/notificationModel.js'

export const getBanks = async (req, res) => {
    const { country = "nigeria", currency = "NGN" } = req.query;
  
    try {
      const response = await axios.get(
        `https://api.paystack.co/bank?currency=${currency}&country=${country}`,
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        }
      );
  
      return res.status(200).json({
        status: "success",
        banks: response.data.data,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.response?.data?.message || "Failed to fetch banks",
      });
    }
};

export const initiateWithdrawal = async (req, res) => {
    const userId = req.userId;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(400).json({ message: "User not found" });

        const defaultWithdrawalOption = user.withdrawalOptions.find(option => option.isDefault);
        if (!defaultWithdrawalOption) {
            return res.status(400).json({ message: "No default withdrawal bank set. Please set a default withdrawal option." });
        }

        const { bankCode, accountNumber } = defaultWithdrawalOption;
        const amount = req.body.amount;

        if (!amount) {
            return res.status(400).json({ message: "Invalid Request: Amount is required." });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: "Insufficient Balance" });
        }

        const reference = `WD_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        user.balance -= amount;
        await user.save();

        const withdrawal = new Withdrawal({
            userId,
            amount,
            bankCode,
            accountNumber,
            status: "PENDING",
            reference,
            note: req.body.note || ''
        });
        await withdrawal.save();

        // Notify user
        await Notification.create({
            userId: user._id,
            title: "Withdrawal Request Submitted",
            message: `Your withdrawal request is pending admin approval.`,
            notificationType: "WITHDRAWALS",
            metadata: { withdrawalId: withdrawal._id }
        });

        // // Notify admin
        // await Notification.create({
        //     userId: "admin", // Adjust this based on your admin system
        //     title: "New Withdrawal Request",
        //     message: `A new withdrawal request from ${user.email} is awaiting approval.`,
        //     notificationType: "ADMIN_WITHDRAWAL_APPROVAL",
        //     metadata: { withdrawalId: withdrawal._id }
        // });

        res.status(200).json({ status: "success", message: "Withdrawal request submitted for approval" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "Withdrawal request failed", error: error.message });
    }
};
