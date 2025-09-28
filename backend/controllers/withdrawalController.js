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

// export const initiateWithdrawal = async (req, res) => {
//     const userId = req.userId;

//     try {
//         const user = await User.findById(userId);
//         if (!user) return res.status(400).json({ message: "User not found" });

//         const defaultWithdrawalOption = user.withdrawalOptions.find(option => option.isDefault);

//         if (!defaultWithdrawalOption) {
//             return res.status(400).json({ message: "No default withdrawal bank set. Please set a default withdrawal option." });
//         }

//         const { bankCode, accountNumber } = defaultWithdrawalOption;
//         const amount = req.body.amount;
//         const currency = req.body.currency || "NGN";

//         const reference = `WD_${Date.now()}_${Math.random().toString(36).substring(7)}`

//         if (!amount) {
//             return res.status(400).json({ message: "Invalid Request: Amount is required." });
//         }

//         if (user.balance < amount) {
//             return res.status(400).json({ message: "Insufficient Balance" });
//         }

//         let recipientCode;
//         try {
//             const existingRecipient = await axios.get(
//                 `https://api.paystack.co/transferrecipient?account_number=${accountNumber}&bank_code=${bankCode}`,
//                 {
//                     headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
//                 }
//             );
//             if (existingRecipient.data.data.length > 0) {
//                 recipientCode = existingRecipient.data.data[0].recipient_code;
//             }
//         } catch (err) {
//             console.log("Recipient check failed, proceeding to create one...");
//         }

//         if (!recipientCode) {
//             const recipientResponse = await axios.post(
//                 "https://api.paystack.co/transferrecipient",
//                 {
//                     type: "nuban",
//                     name: "User Withdrawal",
//                     account_number: accountNumber,
//                     bank_code: bankCode,
//                     currency,
//                 },
//                 {
//                     headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
//                 }
//             );
//             recipientCode = recipientResponse.data.data.recipient_code;
//         }

//         const transferResponse = await axios.post(
//             "https://api.paystack.co/transfer",
//             {
//                 source: "balance",
//                 amount: amount * 100,
//                 recipient: recipientCode,
//                 reason: "User Withdrawal",
//                 reference
//             },
//             {
//                 headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
//             }
//         );

//         const transferId = transferResponse.data.data.id;

//         const withdrawal = new Withdrawal({
//             userId,
//             amount,
//             bankCode,
//             accountNumber,
//             recipientCode,
//             transferId,
//             status: "pending",
//             reference
//         });
//         await withdrawal.save();

//         user.balance -= amount;
//         await user.save();

//         await Notification.create({
//             userId: user._id,
//             title: "Withdrawal Initiated Successfully",
//             message: `You have successfully placed a withdrawal}`,
//             notificationType: 'WITHDRAWALS',
//             metadata: {withdrawalId: withdrawal._id}
//           })

//         res.status(200).json({ status: "success", message: "Withdrawal Initiated" });
//     } catch (error) {
//         console.error(error.response ? error.response.data : error.message);
//         return res.status(500).json({ message: "Withdrawal Failed", error: error.message });
//     }
// };

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
            status: "pending",
            reference
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
