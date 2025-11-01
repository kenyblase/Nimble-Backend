import mongoose from 'mongoose';
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js';
import User from '../models/userModel.js'
import Transaction from '../models/TransactionModel.js'
import Notification from '../models/notificationModel.js'
import axios from 'axios'
import { sendOrderCanceledEmail, sendOrderConfirmationEmail, sendOrderDeliveredEmail, sendOrderShippedEmail, sendVendorOrderReceivedEmail } from '../mailTrap/emails.js';

export const createOrderWithBalance = async (req, res) => {
  const userId = req.userId;
  const { vendorId, productId, quantity, price } = req.body;

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

    // Update balances
    user.balance -= totalAmount;
    vendor.pendingBalance += totalAmount;

    await user.save({ session });
    await vendor.save({ session });

    // Create new order
    const commissionAmount = product.category?.commissionPercentage
      ? Number(
          (
            totalAmount *
            (product.category.commissionPercentage / 100)
          ).toFixed(2)
        )
      : 0;

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
        },
      ],
      { session }
    );

    // Create transaction
    await Transaction.create(
      [
        {
          user: userId,
          type: "payment",
          amount: totalAmount,
          reference: newOrder[0]._id,
          status: "successful",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

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

export const createOrderWithPaystack = async (req, res) => {
  const userId = req.userId;
  const { vendorId, productId, quantity, price } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    const vendor = await User.findById(vendorId);
    if (!vendor) return res.status(400).json({ message: "Vendor not found" });

    const product = await Product.findById(productId).populate(
      "category",
      "commissionPercentage"
    );
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const totalAmount = price * quantity;
    const commissionAmount = product.category?.commissionPercentage
      ? Number(
          (
            totalAmount *
            (product.category.commissionPercentage / 100)
          ).toFixed(2)
        )
      : 0;

    const newOrder = new Order({
      user: userId,
      vendor: vendorId,
      product: productId,
      price,
      quantity,
      totalAmount,
      commissionAmount,
      paymentStatus: "pending",
      paymentMethod: "payment-gateway",
    });

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalAmount * 100,
        reference: newOrder._id.toString(),
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    await newOrder.save();

    return res.status(201).json({
      message: "Order created successfully. Complete payment to confirm.",
      order: newOrder,
      payment_url: paystackResponse.data.data.authorization_url,
    });
  } catch (error) {
    console.error("createOrderWithPaystack error:", error.response?.data || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyPaystackPayment = async (req, res) => {
  const { reference } = req.query;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const order = await Order.findById(reference).session(session);
    if (!order)
      return res.status(400).json({ message: "Order not found" });

    if (order.paymentStatus === "paid") {
      return res.status(200).json({ message: "Payment already processed." });
    }

    if (response.data.data.status !== "success") {
      order.paymentStatus = "failed";
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Payment verification failed", order });
    }

    const vendor = await User.findById(order.vendor).session(session);
    const user = await User.findById(order.user).session(session);
    const product = await Product.findById(order.product).session(session);

    if (!vendor || !user || !product) {
      return res.status(400).json({ message: "Related data not found" });
    }

    const existingTransaction = await Transaction.findOne({ reference }).session(session);
    if (!existingTransaction) {
      await Transaction.create(
        [
          {
            user: order.user,
            type: "payment",
            amount: order.totalAmount,
            reference,
            status: "successful",
          },
        ],
        { session }
      );
    }

    vendor.pendingBalance += order.totalAmount;
    await vendor.save({ session });

    order.paymentStatus = "paid";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notifications & Emails
    if (user.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId: order.user,
        title: "Order Created Successfully",
        message: `You have successfully placed an order.`,
        notificationType: "ORDERS",
        metadata: { orderId: order._id },
      });
    }

    if (vendor.AppNotificationSettings.includes("ORDERS")) {
      await Notification.create({
        userId: order.vendor,
        title: "Order Received",
        message: `You've received an order from ${user.firstName} ${user.lastName}.`,
        notificationType: "ORDERS",
        metadata: { orderId: order._id },
      });
    }

    if (user.EmailNotificationSettings.includes("ORDERS")) {
      sendOrderConfirmationEmail(
        user.email,
        user.firstName,
        user.lastName,
        order._id,
        order.totalAmount
      );
    }

    if (vendor.EmailNotificationSettings.includes("ORDERS")) {
      sendVendorOrderReceivedEmail(
        vendor.email,
        vendor.firstName,
        vendor.lastName,
        product.name,
        order.quantity,
        order.price,
        user.firstName,
        user.lastName
      );
    }

    return res
      .status(200)
      .json({ message: "Payment successful, order confirmed." });
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
            vendor.pendingBalance -= order.totalAmount
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