import mongoose from 'mongoose';
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js';
import User from '../models/userModel.js'
import Transaction from '../models/TransactionModel.js'
import Notification from '../models/notificationModel.js'
import axios from 'axios'
import { createChatBetweenBuyerAndSeller} from '../utils/chatHelper.js'
import { sendOrderCanceledEmail, sendOrderConfirmationEmail, sendOrderDeliveredEmail, sendOrderShippedEmail, sendVendorOrderReceivedEmail } from '../mailTrap/emails.js';

export const createOrderWithBalance = async (req, res) => {
  const userId = req.userId;
  const { vendorId, productId, quantity, price, deliveryAddress } = req.body;

  if (!deliveryAddress) return res.status(400).json({ message: "Default Delivery Address Required" });
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(productId)
      .populate("category", "commissionPercentage")
      .session(session);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const totalAmount = price * quantity;

    const user = await User.findById(userId).session(session);
    if (!user || user.balance < totalAmount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }


    const vendor = await User.findById(vendorId).session(session);
    if (!vendor) {
      return res.status(400).json({ message: "Vendor not found" });
    }

    const commissionAmount = product.category?.commissionPercentage
      ? Number(
          (
            totalAmount *
            (product.category.commissionPercentage / 100)
          ).toFixed(2)
        )
      : 0;

    user.balance -= totalAmount;

    await user.save({ session });


    const newOrder = await Order.create(
      [
        {
          user: userId,
          vendor: vendorId,
          product: productId,
          price,
          quantity,
          totalAmount,
          commissionAmount,
          paymentStatus: "paid",
          paymentMethod: "balance",
          deliveryAddress,
          paidAt: Date.now()
        },
      ],
      { session }
    );

    // Create transaction
    await Transaction.create(
      [
        {
          user: vendorId,
          buyer: userId,
          type: "sales",
          amount: totalAmount,
          reference: newOrder[0]._id,
          status: "successful",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await createChatBetweenBuyerAndSeller(userId, vendorId, productId, newOrder[0]._id);

    // Notifications & Emails (outside transaction)
    if (user.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId,
        title: "Order Created Successfully",
        message: `You have successfully placed an order.`,
        notificationType: "ORDERS",
        metadata: { orderId: newOrder[0]._id },
      });
    }

    if (vendor.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId: vendorId,
        title: "Order Received",
        message: `You've received an order from ${user.firstName} ${user.lastName}.`,
        notificationType: "ORDERS",
        metadata: { orderId: newOrder[0]._id },
      });
    }

    if (user.EmailNotificationSettings.includes("ORDERS")) {
      sendOrderConfirmationEmail(
        user.email,
        user.firstName,
        user.lastName,
        newOrder[0]._id,
        newOrder[0].totalAmount
      );
    }

    if (vendor.EmailNotificationSettings.includes("ORDERS")) {
      sendVendorOrderReceivedEmail(
        vendor.email,
        vendor.firstName,
        vendor.lastName,
        product.name,
        quantity,
        price,
        user.firstName,
        user.lastName
      );
    }

    return res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("createOrderWithBalance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const initializePaystackPayment = async (req, res) => {
  const userId = req.userId;
  const { vendorId, productId, quantity, price, deliveryFee, deliveryAddress } = req.body;

  if (!deliveryAddress)
    return res.status(400).json({ message: "Delivery address required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const product = await Product.findById(productId).populate("category", "commissionPercentage");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const totalAmount = price * quantity;
    const commissionAmount = product.category?.commissionPercentage
      ? Number(((totalAmount * product.category.commissionPercentage) / 100).toFixed(2))
      : 0;

      console.log(totalAmount)

    // Initialize Paystack payment
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalAmount * 100,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          isOrder: true,
          userId,
          vendorId,
          productId,
          quantity,
          price,
          deliveryFee,
          deliveryAddress,
          totalAmount,
          commissionAmount,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({
      message: "Payment initialized successfully",
      paymentUrl: paystackResponse.data.data.authorization_url,
      reference: paystackResponse.data.data.reference,
    });
  } catch (error) {
    console.error("initializePaystackPayment error:", error.response?.data || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyPaystackPayment = async (req, res) => {
  const { reference } = req.query;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify payment
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (data.status !== "success") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Extract order info from metadata
    const {
      userId,
      vendorId,
      productId,
      quantity,
      price,
      deliveryFee,
      deliveryAddress,
      totalAmount,
      commissionAmount,
    } = data.metadata;

    const vendor = await User.findById(vendorId).session(session);
    const user = await User.findById(userId).session(session);
    const product = await Product.findById(productId).session(session);

    if (!vendor || !user || !product)
      return res.status(400).json({ message: "Invalid metadata" });

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({ reference }).session(session);
    if (existingTransaction) {
      return res.status(200).json({ message: "Payment already processed" });
    }

    // ✅ Create order after payment success
    const newOrder = await Order.create(
      [
        {
          user: userId,
          vendor: vendorId,
          product: productId,
          price,
          quantity,
          totalAmount,
          commissionAmount,
          paymentStatus: "paid",
          paymentMethod: "payment-gateway",
          deliveryFee,
          deliveryAddress,
          paidAt: Date.now()
        },
      ],
      { session }
    );

    // Record transaction
    await Transaction.create(
      [
        {
          user: vendorId,
          buyer: userId,
          type: "sales",
          amount: totalAmount,
          reference,
          status: "successful",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await createChatBetweenBuyerAndSeller(userId, vendorId, productId,  newOrder[0]._id);

    if (user.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId: newOrder[0].user,
        title: "Order Created Successfully",
        message: `You have successfully placed an order.`,
        notificationType: "ORDERS",
        metadata: { orderId: newOrder[0]._id },
      });
    }

    if (vendor.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId: newOrder[0].vendor,
        title: "Order Received",
        message: `You've received an order from ${user.firstName} ${user.lastName}.`,
        notificationType: "ORDERS",
        metadata: { orderId: newOrder[0]._id },
      });
    }

    if (user.EmailNotificationSettings.includes("ORDERS")) {
      sendOrderConfirmationEmail(
        user.email,
        user.firstName,
        user.lastName,
        newOrder[0]._id,
        newOrder[0].totalAmount
      );
    }

    if (vendor.EmailNotificationSettings.includes("ORDERS")) {
      sendVendorOrderReceivedEmail(
        vendor.email,
        vendor.firstName,
        vendor.lastName,
        product.name,
        newOrder[0].quantity,
        newOrder[0].price,
        user.firstName,
        user.lastName
      );
    }

    return res.status(200).json({
      message: "Payment successful, order created.",
      order: newOrder[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("verifyPaystackPayment error:", error.response?.data || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrdersByUser = async (req, res) => {
    const userId = req.userId;
    const {paymentStatus} = req.query

    try {

        if(paymentStatus){
            const orders = await Order.find({ user: userId, paymentStatus: paymentStatus })
                .populate('products.product', 'name price')
                .populate('vendor', 'firstName lastName'); 
    
            return res.status(200).json({ orders });
        }else{
            const orders = await Order.find({ user: userId})
                .populate('products.product', 'name price')
                .populate('vendor', 'firstName lastName'); 
    
            return res.status(200).json({ orders });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOrdersByVendor = async (req, res) => {
    const { vendorId } = req.userId;
    const {paymentStatus} = req.query

    try {
        if(paymentStatus){
            const orders = await Order.find({ vendor: vendorId, paymentStatus })
                .populate('products.product', 'name price')
                .populate('user', 'firstName lastName');

            return res.status(200).json({ orders });
        }else{
            const orders = await Order.find({ vendor: vendorId })
                .populate('products.product', 'name price')
                .populate('user', 'firstName lastName');

            return res.status(200).json({ orders });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOrderById = async (req, res) => {
    const { id } = req.params;

    try {
        const order = await Order.findById(id).populate('user', 'firstName lastName deliveryAddress').populate('vendor', 'firstName lastName').populate('product', 'images name shippingAddress')

        if(!order) return res.status(400).json({message: 'Order not found'})

        res.status(200).json(order)

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { orderStatus, expectedDeliveryDate } = req.body;
    const vendorId = req.userId

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(400).json({ message: 'Order not found' });
        }

        if(order.vendor.toString() !== vendorId){
            return res.status(400).json({message: "You are not authorized to update this product"})
        }

        order.orderStatus = orderStatus || order.orderStatus
        order.expectedDeliveryDate = expectedDeliveryDate || order.expectedDeliveryDate

        await order.save();

        const vendor = await User.findById(order.vendor)

        if(!vendor) return res.status(400).json({message: 'User not found'})

        if(vendor.AppNotificationSettings.includes('ORDERS')){
            await Notification.create({
                userId: order.vendor,
                title: 'Order Updated Successfully',
                message: `You've successfully updated the order status of order ${order._id} to ${order.orderStatus}`,
                notificationType: 'ORDERS',
                metadata: {orderId: order._id}
            })
        }

        const user = await User.findById(order.user)

        if(!user) return res.status(400).json({message: 'User not found'})
        
        if(order.orderStatus === 'shipped'){
            order.shippedDate = new Date()
            if(user.EmailNotificationSettings.includes('ORDERS')){
                sendOrderShippedEmail(user.email, user.firstName, user.lastName, order._id, expectedDeliveryDate || '')
            }
        }

        if(order.orderStatus === 'delivered'){
            if(user.EmailNotificationSettings.includes('ORDERS')){
                sendOrderDeliveredEmail(user.email, user.firstName, user.lastName, order._id, new Date())
            }
        }

        if(order.orderStatus === 'canceled'){
            if(user.EmailNotificationSettings.includes('ORDERS')){
                sendOrderCanceledEmail(user.email, user.firstName, user.lastName, order._id)
            }
        }

        return res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateTransactionStatus = async (req, res) => {
    const { orderId } = req.params;
    const { transactionStatus } = req.body;
    const buyerId = req.userId

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if(order.buyer.toString() !== buyerId){
            return res.status(400).json({message: "You are not authorized to update this product"})
        }

        order.transactionStatus = transactionStatus || order.transactionStatus

        await order.save();

        const vendor = await User.findById(order.vendor)

        if(!vendor) return res.status(400).json({message: "User not found"})

        if(transactionStatus === 'completed'){
            vendor.balance += order.totalAmount

            await vendor.save()

            await Product.findByIdAndUpdate(order.product, {
            $inc: { purchases: order.quantity }
            })

            await Transaction.create({
                user: order.user,
                type: "sales",
                amount: order.totalAmount,
                reference,
                buyer: order.buyer,
                status: "successful"
            });
        }

        if(vendor.AppNotificationSettings.includes('ORDERS')){
            await Notification.create({
                userId: order.vendor,
                title: 'Order Updated Successfully',
                message: `You've successfully updated the transaction status of order ${order._id} to ${order.transactionStatus}`,
                notificationType: 'ORDERS',
                metadata: {orderId: order._id}
            })
        }

        return res.status(200).json({ message: 'Transaction status updated successfully', order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};