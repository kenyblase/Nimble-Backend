import axios from 'axios'
import Payment from '../models/paymentModel.js'
import User from '../models/userModel.js'
import Transaction from '../models/TransactionModel.js'
import Notification from '../models/notificationModel.js'
import { sendPaymentProcessedEmail } from '../mailTrap/emails.js'

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

export const initializePayment = async(req, res)=>{
    try {
        const {email, amount, currency="NGN"} = req.body
        const userId = req.userId

        if(!email || !amount)return res.status(400).json({message: 'Invalid Request'})

        const reference = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email,
            amount: amount * 100,
            currency,
            reference,
            callback_url: process.env.PAYSTACK_CALLBACK_URL
        },
    {
        headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json"
        }
    })

    const payment = new Payment({
        user: userId,
        amount,
        status: "PENDING",
        reference,
        currency,
        transactionId: reference
    })

    await payment.save()

    return res.status(200).json({message:response.data.message, data:{
        paymentData: response.data.data
    }})    
    } catch (error) {
        console.log(error.message)
        return res.status(500).json({message: error.message})
    }
}

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const payment = await Payment.findOne({ reference });
    if (!payment) return res.status(400).json({ message: "Payment not found" });

    if (payment.status === "SUCCESS") {
      return res.status(200).json({ message: "Payment already processed", data: payment });
    }

    if (response.data.data.status !== "success") {
      payment.status = "FAILED";
      await payment.save();
      return res.status(400).json({message: 'Payment Verification failed', data: payment})
    }

      payment.status = "SUCCESS";
      payment.paymentMethod = response.data.data.channel.toUpperCase();
      payment.transactionId = response.data.data.id;

      const user = await User.findById(payment.user);
      if (!user) {
        return res.status(400).json({message: "User Not found"})
      }
      
      user.balance += payment.amount;
      await user.save();
      await payment.save();

      const existingTransaction = await Transaction.findOne({ reference });
      if (!existingTransaction) {
        await Transaction.create({
          user: user._id,
          type: "deposit",
          amount: payment.amount,
          reference,
          status: "successful",
        });
      }

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
    return res.status(200).json({ message: response.data.message, data: payment });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: error.message });
  }
};