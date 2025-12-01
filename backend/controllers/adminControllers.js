import axios from 'axios'
import fs from "fs";
import bcryptjs from 'bcryptjs'
import mongoose from 'mongoose';
import User from "../models/userModel.js"
import Admin from "../models/adminModel.js"
import Order from "../models/orderModel.js"
import Transaction from "../models/TransactionModel.js"
import Product from "../models/productModel.js"
import Withdrawal from "../models/withdrawalModel.js"
import {generateTokenAndSetCookie} from '../utils/generateTokenAndSetCookie.js'
import cloudinary from '../utils/cloudinary.js'
import Category from "../models/categoryModel.js"
import Setting from "../models/generalSettingsModel.js";
import Notification from '../models/notificationModel.js';
import Appeal from '../models/appealModel.js';
import { defaultSettings } from '../utils/defaultsettings.js';
import Report from '../models/reportModel.js';

export const createAdmin = async (req, res) => {
    const {firstName, lastName, email, phone, password, role} = req.body
    try {
        const admin = await Admin.findOne({ email });
        if (admin) return res.status(404).json({message: 'Admin already exists'})

        const salt = await bcryptjs.genSalt(10)
        
        const hashedPassword = await bcryptjs.hash(password, salt)

        await Admin.create({
          firstName,
          lastName, 
          email,
          password: hashedPassword,
          phone,
          role,
        })

        res.status(200).json({ message: 'Admin Created Successfully'})
    } catch (error) {
        console.log('Error Signing In',error)
        res.status(400).json({success:false, message:error.message})
    }
}

export const adminLogIn = async (req, res) => {
    const {email, password} = req.body
    try {
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({message: 'Admin Not Found'})

        const isMatchingPasswords = await bcryptjs.compare(password, admin.password)

        if(!isMatchingPasswords) return res.status(400).json({message: 'Invalid Credentials'})

        generateTokenAndSetCookie(res, admin._id, true)

        res.status(200).json({admin: {
        ...admin._doc,
        password: undefined
        }, message: 'Login Successful'})
    } catch (error) {
        console.log('Error Signing In',error)
        res.status(400).json({success:false, message:error.message})
    }
}

export const getDashboardAnalytics = async (req, res) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const [totalCompletedOrders, activeListings, activeUsers, totalPending] =
      await Promise.all([
        Order.find({ transactionStatus: "completed" }),
        Product.countDocuments({type: 'listing',  status: "active" }),
        User.countDocuments({status: 'active'}),
        Product.countDocuments({type: 'listing', status: "pending" }),
      ]);

    const totalSales = totalCompletedOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );

    const [yesterdayOrders, lastWeekActiveListings, yesterdayUsers, yesterdayPending] =
      await Promise.all([

        Order.find({
          transactionStatus: "completed",
          createdAt: { $gte: yesterday, $lt: today },
        }),

        Product.countDocuments({
          type: 'listing',
          status: "active",
          createdAt: { $gte: lastWeek, $lt: today },
        }),

        User.countDocuments({
          status: 'active',
          createdAt: { $gte: yesterday, $lt: today },
        }),
  
        Product.countDocuments({
          type: 'listing',
          status: "pending",
          createdAt: { $gte: yesterday, $lt: today },
        }),
      ]);

    const yesterdaySales = yesterdayOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );

    const calcChange = (current, prev) => {
      if (!prev || prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    const salesChange = calcChange(totalSales, yesterdaySales);
    const listingChange = calcChange(activeListings, lastWeekActiveListings);
    const userChange = calcChange(activeUsers, yesterdayUsers);
    const pendingChange = calcChange(totalPending, yesterdayPending);

    res.status(200).json({
      message: "Analytics fetched successfully",
      data: {
        totalSales: {
          value: totalSales,
          change: salesChange.toFixed(1),
          trend: salesChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        activeListings: {
          value: activeListings,
          change: listingChange.toFixed(1),
          trend: listingChange >= 0 ? "up" : "down",
          duration: "from past week",
        },
        activeUsers: {
          value: activeUsers,
          change: userChange.toFixed(1),
          trend: userChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        totalPending: {
          value: totalPending,
          change: pendingChange.toFixed(1),
          trend: pendingChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
      },
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getLatestTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const status = req.query.status;
    const search = req.query.search?.trim();

    const skip = (page - 1) * limit;

    const query = {};

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search by user firstName or lastName
    if (search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);
      query.user = { $in: userIds };
    }

    const total = await Transaction.countDocuments(query);

    const transactions = await Transaction.find(query)
      .populate('user', 'firstName lastName')
      .populate('buyer', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      message: 'Transactions Fetched Successfully',
      data: transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getListingAnalytics = async (req, res) => {
  try {
    const { type='listing'} = req.query;

    const today = new Date();

    // Define date ranges
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    // Current counts
    const [activeListings, closedListings, expiredListings] = await Promise.all([
      Product.countDocuments({ type, status: "active" }),
      Product.countDocuments({ type, status: "closed" }),
      Product.countDocuments({ type, status: "expired" }),
    ]);

    // Previous period counts
    const [yesterdayActive, yesterdayClosed, lastWeekExpired] = await Promise.all([
      // Yesterday - active listings
      Product.countDocuments({
        type,
        status: "active",
        listedOn: { $gte: yesterday, $lt: today },
      }),

      // Yesterday - closed listings
      Product.countDocuments({
        type,
        status: "closed",
        listedOn: { $gte: yesterday, $lt: today },
      }),

      // Last week - expired listings
      Product.countDocuments({
        type,
        status: "expired",
        listedOn: { $gte: lastWeek, $lt: today },
      }),
    ]);

    // Helper to calculate % change
    const calcChange = (current, prev) => {
      if (!prev || prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    // Calculate trends
    const activeChange = calcChange(activeListings, yesterdayActive);
    const closedChange = calcChange(closedListings, yesterdayClosed);
    const expiredChange = calcChange(expiredListings, lastWeekExpired);

    // Response (same structure as getUserAnalytics)
    res.status(200).json({
      message: "Listing analytics fetched successfully",
      data: {
        activeListings: {
          value: activeListings,
          change: activeChange.toFixed(1),
          trend: activeChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        closedListings: {
          value: closedListings,
          change: closedChange.toFixed(1),
          trend: closedChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        expiredListings: {
          value: expiredListings,
          change: expiredChange.toFixed(1),
          trend: expiredChange >= 0 ? "up" : "down",
          duration: "from past week",
        },
      },
    });
  } catch (error) {
    console.error("Listing Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getListedProducts = async (req, res) => {
  try {
    const { type='listing', status='active', page = 1, limit = 10 } = req.query;

    const query = {type};
    if (status) query.status = status; // filter by status only if provided

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("vendor", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + products.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching listed products:", error);
    return res.status(500).json({
      success: false,
      message: "Server error, unable to fetch products",
    });
  }
};

export const getListedProductsByUser = async (req, res) => {
  try {
    const { id } = req.params
    const { status='active', page = 1, limit = 10 } = req.query;

    const query = {vendor: id};
    if (status) query.status = status; // filter by status only if provided

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("vendor", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + products.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching listed products:", error);
    return res.status(500).json({
      success: false,
      message: "Server error, unable to fetch products",
    });
  }
};

export const getListedProductsByCategory = async (req, res) => {
  try {
    const { id } = req.params
    const { status='active', page = 1, limit = 10 } = req.query;

    const query = {category: id};
    if (status) query.status = status; // filter by status only if provided

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("vendor", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + products.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching listed products:", error);
    return res.status(500).json({
      success: false,
      message: "Server error, unable to fetch products",
    });
  }
};

export const getProductById = async(req, res)=>{
    try {
        const {id} = req.params
    
        const product = await Product.findById(id).populate("vendor", "firstName lastName")
    
        if(!product) return res.status(400).json({message: 'Product Not Found'})
    
        return res.status(200).json(product)
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;        
    const { status } = req.body;         

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const newStatus = product.status === status ? 'active' : status;

    if(status === 'active'){
      product.listedOn = Date.now()
    }

    product.status = newStatus;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product status changed to ${newStatus}`,
      data: product
    });
  } catch (error) {
    console.error('Error toggling product status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrderAnalytics = async (req, res) => {
  try {
    const today = new Date();

    // Define date ranges
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    // Current counts
    const [totalOrders, completedOrders, pendingOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ transactionStatus: "completed" }),
      Order.countDocuments({ transactionStatus: "pending" }),
    ]);

    // Previous period counts
    const [yesterdayOrders, yesterdayCompleted, lastWeekPending] = await Promise.all([
      // Yesterday - total orders
      Order.countDocuments({
        createdAt: { $gte: yesterday, $lt: today },
      }),

      // Yesterday - completed orders
      Order.countDocuments({
        transactionStatus: "completed",
        createdAt: { $gte: yesterday, $lt: today },
      }),

      // Last week - pending orders
      Order.countDocuments({
        transactionStatus: "pending",
        createdAt: { $gte: lastWeek, $lt: today },
      }),
    ]);

    // Helper to calculate % change
    const calcChange = (current, prev) => {
      if (!prev || prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    // Calculate percentage changes
    const totalChange = calcChange(totalOrders, yesterdayOrders);
    const completedChange = calcChange(completedOrders, yesterdayCompleted);
    const pendingChange = calcChange(pendingOrders, lastWeekPending);

    // Response
    res.status(200).json({
      message: "Order analytics fetched successfully",
      data: {
        totalOrders: {
          value: totalOrders,
          change: totalChange.toFixed(1),
          trend: totalChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        completedOrders: {
          value: completedOrders,
          change: completedChange.toFixed(1),
          trend: completedChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        pendingOrders: {
          value: pendingOrders,
          change: pendingChange.toFixed(1),
          trend: pendingChange >= 0 ? "up" : "down",
          duration: "from past week",
        },
      },
    });
  } catch (error) {
    console.error("Order Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", filter = "" } = req.query;

    const pipeline = [
      // Populate user
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Populate vendor
      {
        $lookup: {
          from: "users",
          localField: "vendor",
          foreignField: "_id",
          as: "vendor",
        },
      },
      { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },

      // Populate product
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

      // Populate product.category
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "product.category",
        },
      },
      { $unwind: { path: "$product.category", preserveNullAndEmptyArrays: true } },
    ];

    const match = {};

    if (search) {
      match.$or = [
        { "user.firstName": { $regex: search, $options: "i" } },
        { "user.lastName": { $regex: search, $options: "i" } },
        { "vendor.firstName": { $regex: search, $options: "i" } },
        { "vendor.lastName": { $regex: search, $options: "i" } },
        { "product.name": { $regex: search, $options: "i" } },
        { "product.category.name": { $regex: search, $options: "i" } },
      ];
    }

    if (filter) match.transactionStatus = filter;

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Clone the pipeline before pagination for total count
    const totalPipeline = [...pipeline, { $count: "total" }];
    const totalOrders = await Order.aggregate(totalPipeline);
    const total = totalOrders[0]?.total || 0;

    // Pagination and sorting
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (page - 1) * Number(limit) });
    pipeline.push({ $limit: Number(limit) });

    const orders = await Order.aggregate(pipeline);

    res.status(200).json({
      orders,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalOrders: total,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getOrderById = async(req, res)=>{
    try {
        const {id} = req.params
    
        const order = await Order.findById(id)
          .populate("vendor", "firstName lastName")
          .populate("user", "firstName lastName")
          .populate("product", "name images price shippingAddress")
    
        if(!order) return res.status(400).json({message: 'Order Not Found'})
    
        return res.status(200).json(order)
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const order = await Order.findById(id).session(session);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.transactionStatus === "completed" && order.orderStatus === "delivered")
      return res.status(400).json({ message: "Cannot cancel a completed order" });

    if (order.orderStatus === "cancelled" && order.transactionStatus === 'failed')
      return res.status(400).json({ message: "Order already cancelled" });

    const vendor = await User.findById(order.vendor).session(session);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const user = await User.findById(order.user).session(session);
    if (!user) return res.status(404).json({ message: "User not found" });

    const vendorEarnings = order.totalAmount - order.commissionAmount;

    user.availableBalance += vendorEarnings;

    await vendor.save({ session });
    await user.save({ session });

    // --- Update Order ---
    order.orderStatus = "cancelled";
    order.transactionStatus = "failed";
    order.paymentStatus = "refunded";
    await order.save({ session });

    // --- Record Transaction ---
    await Transaction.create(
      [
        {
          user: user._id,
          type: "sales",
          amount: order.totalAmount,
          reference: `CANCEL-${order._id}`,
          status: "successful",
          metadata: { orderId: order._id, vendorId: vendor._id },
        },
      ],
      { session }
    );

    // --- Notifications ---
    await Notification.create(
      [
        {
          userId: order.user,
          title: "Order Cancelled by Admin",
          message: `Your order with ID ${order._id} has been cancelled by an admin.`,
          notificationType: "ORDERS",
          metadata: { orderId: order._id },
        },
        {
          userId: order.vendor,
          title: "Order Cancelled",
          message: `Your order with ID ${order._id} was cancelled by admin. Pending balance adjusted.`,
          notificationType: "ORDERS",
          metadata: { orderId: order._id },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Order cancelled successfully and balances adjusted.",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("adminCancelOrder error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const markOrderCompleted = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const order = await Order.findById(id).session(session);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.transactionStatus === "completed" && order.orderStatus === "delivered")
      return res.status(400).json({ message: "Order already completed" });

    if (order.orderStatus === "cancelled" && order.transactionStatus === 'failed')
      return res.status(400).json({ message: "Cannot complete a cancelled order" });

    const vendor = await User.findById(order.vendor).session(session);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const vendorEarnings = order.totalAmount - order.commissionAmount;

    vendor.availableBalance += vendorEarnings;
    await vendor.save({ session });

    order.orderStatus = "delivered";
    order.transactionStatus = 'completed'
    await order.save({ session });

    await Transaction.create(
      [
        {
          user: vendor._id,
          type: "sales",
          amount: vendorEarnings,
          reference: `COMPLETE-${order._id}`,
          status: "successful",
          metadata: { orderId: order._id },
        },
      ],
      { session }
    );

    // --- Notify Users ---
    await Notification.create(
      [
        {
          userId: order.user,
          title: "Order Completed",
          message: `Your order with ID ${order._id} has been marked as completed by an admin.`,
          notificationType: "ORDERS",
          metadata: { orderId: order._id },
        },
        {
          userId: order.vendor,
          title: "Order Completed",
          message: `Your order with ID ${order._id} has been marked as completed by an admin. Funds released to your available balance.`,
          notificationType: "ORDERS",
          metadata: { orderId: order._id },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Order marked as completed successfully, balances updated.",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("markOrderCompleted error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserAnalytics = async (req, res) => {
  try {
    const today = new Date();

    // Define date ranges
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    // Current counts
    const [activeUsers, verifiedUsers, suspendedUsers, bannedUsers] = await Promise.all([
      User.countDocuments({ status: "active" }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ status: "suspended" }),
      User.countDocuments({ status: "banned" }),
    ]);

    // Previous period counts
    const [yesterdayActive, yesterdayVerified, lastWeekSuspended, lastWeekBanned] = await Promise.all([
      // Yesterday - active users
      User.countDocuments({
        status: "active",
        createdAt: { $gte: yesterday, $lt: today },
      }),

      // Yesterday - verified users
      User.countDocuments({
        isVerified: true,
        createdAt: { $gte: yesterday, $lt: today },
      }),

      // Last week - suspended users
      User.countDocuments({
        status: "suspended",
        createdAt: { $gte: lastWeek, $lt: today },
      }),

      // Last week - banned users
      User.countDocuments({
        status: "banned",
        createdAt: { $gte: lastWeek, $lt: today },
      }),
    ]);

    // Helper to calculate % change
    const calcChange = (current, prev) => {
      if (!prev || prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    // Calculate changes
    const activeChange = calcChange(activeUsers, yesterdayActive);
    const verifiedChange = calcChange(verifiedUsers, yesterdayVerified);
    const suspendedChange = calcChange(suspendedUsers, lastWeekSuspended);
    const bannedChange = calcChange(bannedUsers, lastWeekBanned);

    // Response
    res.status(200).json({
      message: "User analytics fetched successfully",
      data: {
        activeUsers: {
          value: activeUsers,
          change: activeChange.toFixed(1),
          trend: activeChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        verifiedUsers: {
          value: verifiedUsers,
          change: verifiedChange.toFixed(1),
          trend: verifiedChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        suspendedUsers: {
          value: suspendedUsers,
          change: suspendedChange.toFixed(1),
          trend: suspendedChange >= 0 ? "up" : "down",
          duration: "from past week",
        },
        bannedUsers: {
          value: bannedUsers,
          change: bannedChange.toFixed(1),
          trend: bannedChange >= 0 ? "up" : "down",
          duration: "from past week",
        },
      },
    });
  } catch (error) {
    console.error("User Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", filter = "" } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (filter) query.status = filter;

    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    const usersWithCount = await Promise.all(
      users.map(async (user) => {
        const productCount = await Product.countDocuments({ vendor: user._id });
        return { ...user.toObject(), listedItems: productCount };
      })
    );

    res.status(200).json({
      users: usersWithCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAdmins = async (req, res) => {
  try {
    const userId = req.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const filter = {
      _id: { $ne: userId },
      ...(search && {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const totalAdmins = await Admin.countDocuments(filter);

    const admins = await Admin.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalPages = Math.ceil(totalAdmins / limit);

    res.status(200).json({
      success: true,
      data: admins,
      pagination: {
        totalAdmins,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const editAdmin = async(req, res)=>{
    try {
        const { id } = req.params
        const {firstName, lastName, email, phone, role} = req.body

        const admin = await Admin.findById(id)

        if(!admin) return res.status(400).json({message: 'Admin Not Found'})

        admin.firstName = firstName || admin.firstName
        admin.lastName = lastName || admin.lastName
        admin.email = email || admin.email
        admin.phoneNumber = phone || admin.phone
        admin.role = role || admin.role

        await admin.save()

        res.status(200).json({message: 'Admin Info Updated Successfully'})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const deleteAdmin = async(req, res)=>{
    try {
        const {id} = req.params

        const admin = await Admin.findByIdAndDelete(id)

        if(!admin) return res.status(400).json({message: 'Admin Not Found'})

        res.status(200).json({message: 'Admin Deleted Successfully'})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const getTransactionAnalytics = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    const calcChange = (current, prev) => {
      if (!prev || prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    // --- PAY-IN ---
    // Includes: Deposits (successful) + Sales (orders not paid with balance)
    const [todayDeposits, yesterdayDeposits] = await Promise.all([
      Transaction.find({
        type: "deposit",
        status: "successful",
      }),
      Transaction.find({
        type: "deposit",
        status: "successful",
        createdAt: { $lte: endOfYesterday },
      }),
    ]);

    const [todaySales, yesterdaySales] = await Promise.all([
      Transaction.find({
        type: "sales",
        status: "successful",
      }),
      Transaction.find({
        type: "sales",
        status: "successful",
        createdAt: { $lte: endOfYesterday },
      }),
    ]);

    const todayPayIn =
      todayDeposits.reduce((a, c) => a + c.amount, 0) +
      todaySales.reduce((a, c) => a + c.amount, 0);

    const yesterdayPayIn =
      yesterdayDeposits.reduce((a, c) => a + c.amount, 0) +
      yesterdaySales.reduce((a, c) => a + c.amount, 0);

    // --- PAY-OUT ---
    const [todayWithdrawals, yesterdayWithdrawals] = await Promise.all([
      Transaction.find({
        type: "withdrawal",
        status: "successful",
      }),
      Transaction.find({
        type: "withdrawal",
        status: "successful",
        createdAt: { $lte: endOfYesterday },
      }),
    ]);

    const todayPayOut = todayWithdrawals.reduce((a, c) => a + c.amount, 0);
    const yesterdayPayOut = yesterdayWithdrawals.reduce((a, c) => a + c.amount, 0);

    // --- Calculate percentage change ---
    const payInChange = calcChange(todayPayIn, yesterdayPayIn);
    const payOutChange = calcChange(todayPayOut, yesterdayPayOut);

    // --- Response ---
    return res.status(200).json({
      success: true,
      message: "Transaction analytics fetched successfully",
      data: {
        payIn: {
          value: todayPayIn,
          change: payInChange.toFixed(1),
          trend: payInChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
        payOut: {
          value: todayPayOut,
          change: payOutChange.toFixed(1),
          trend: payOutChange >= 0 ? "up" : "down",
          duration: "from yesterday",
        },
      },
    });
  } catch (error) {
    console.error("Transaction Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const blockUser = async(req, res)=>{
    const { userToBlockId } = req.body

    try { 
        const user = await User.findById(userToBlockId)
    
        if(!user){
            return res.status(400).json({message: "User not found"})
        }
    
        user.isBlocked = !user.isBlocked
    
        await user.save()
    
        res.status(200).json({message: user.isBlocked ? 'User Account blocked successfully' : 'User Account Unblocked Sucessfully'})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: 'Internal Server Error'})
    }   
}

export const getUser = async(req, res)=>{
    try {
        const {id} = req.params
    
        const user = await User.findById(id)
    
        if(!user) return res.status(400).json({message: 'User Not Found'})

        const totalListings = await Product.countDocuments({vendor: id})
    
        return res.status(200).json({user: {
            ...user._doc,
            password:undefined
        }, totalListings})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const editUser = async(req, res)=>{
    try {
        const {id} = req.params

        const {firstName, lastName, phoneNumber, gender, businessName, businessInformation, address, city, state} = req.body
    
        const user = await User.findById(id)
    
        if(!user) return res.status(400).json({message: 'User Not Found'})

        user.firstName = firstName || user.firstName
        user.lastName = lastName || user.lastName
        user.phoneNumber = phoneNumber || user.phoneNumber
        user.gender = gender || user.gender
        user.businessDetails.businessName = businessName || user.businessDetails.businessName
        user.businessDetails.businessInformation = businessInformation || user.businessDetails.businessInformation
        user.businessDetails.address = address || user.businessDetails.address
        user.businessDetails.city = city || user.businessDetails.city
        user.businessDetails.state = state || user.businessDetails.state

        await user.save()
    
        res.status(200).json({message: 'User Info Updated Successfully'})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;        
    const { status } = req.body;         

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newStatus = user.status === status ? 'active' : status;

    user.status = newStatus;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User status changed to ${newStatus}`,
      data: {
            ...user._doc,
            password:undefined
        },
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteProduct = async(req, res)=>{
    const { productId } = req.params;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        for (let i = 0; i < product.images.length; i++) {
            const publicId = product.images[i].split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId);
        }

        await Product.findByIdAndDelete(productId)

        return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export const approveWithdrawal = async (req, res) => {
    const adminId = req.userId;
    const { withdrawalId } = req.params;

    try {
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(403).json({ message: "Unauthorized: Admin access required" });
        }

        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal || withdrawal.status !== "PENDING") {
            return res.status(400).json({ message: "Invalid or already processed withdrawal" });
        }

        const { bankCode, accountNumber, amount } = withdrawal;
        const currency = "NGN";

        let recipientCode;
        try {
            const existingRecipient = await axios.get(
                `https://api.paystack.co/transferrecipient?account_number=${accountNumber}&bank_code=${bankCode}`,
                { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
            );
            if (existingRecipient.data.data.length > 0) {
                recipientCode = existingRecipient.data.data[0].recipient_code;
            }
        } catch (err) {
            console.log("Recipient check failed, creating a new one...");
        }

        if (!recipientCode) {
            const recipientResponse = await axios.post(
                "https://api.paystack.co/transferrecipient",
                {
                    type: "nuban",
                    name: "User Withdrawal",
                    account_number: accountNumber,
                    bank_code: bankCode,
                    currency,
                },
                { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
            );
            recipientCode = recipientResponse.data.data.recipient_code;
        }

        const transferResponse = await axios.post(
            "https://api.paystack.co/transfer",
            {
                source: "balance",
                amount: amount * 100,
                recipient: recipientCode,
                reason: "User Withdrawal",
                reference: withdrawal.reference
            },
            { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
        );

        const transferId = transferResponse.data.data.id;

        withdrawal.status = "APPROVED";
        withdrawal.transferId = transferId;
        await withdrawal.save();

        await Transaction.create({
          user: withdrawal.userId,
          type: "withdrawal",
          amount: withdrawal.amount,
          reference: withdrawal.reference,
          status: "pending",
        });

        await Notification.create({
            userId: withdrawal.userId,
            title: "Withdrawal Approved",
            message: `Your withdrawal of ${amount} has been approved and processed.`,
            notificationType: "WITHDRAWALS",
            metadata: { withdrawalId: withdrawal._id }
        });

        res.status(200).json({ status: "success", message: "Withdrawal approved and processed", data: withdrawal });
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        return res.status(500).json({ message: "Approval failed", error: error.message });
    }
};

export const getWithdrawals = async(req, res)=>{
    try {
        const withdrawals = await Withdrawal.find().populate('userId', 'firstName lastName')

        const formattedWithdrawals = withdrawals.map(withdrawal=>({
            orderId: withdrawal._id,
            user: `${withdrawal.userId.firstName} ${withdrawal.userId.lastName}`,
            date: withdrawal.createdAt.toLocaleDateString('en-GB'),
            amount: withdrawal.amount,
            status: withdrawal.status,
            action: ':'
        }))
        res.status(200).json(formattedWithdrawals)
    } catch (error) {
        console.log(error)
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getSelectedWithdrawal = async(req, res)=>{
    const {id} = req.params
    try {
        const withdrawal = await Withdrawal.findById(id).populate('userId', 'firstName lastName')

        if(!withdrawal) return res.status(400).json({message: 'withdrawal not found'})

        res.status(200).json(withdrawal)
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const rejectWithdrawal = async (req, res) => {
    const adminId = req.userId;
    const { withdrawalId } = req.params;

    try {
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(403).json({ message: "Unauthorized: Admin access required" });
        }

        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal || withdrawal.status !== "PENDING") {
            return res.status(400).json({ message: "Invalid or already processed withdrawal" });
        }

        const user = await User.findById(withdrawal.userId);
        if (!user) return res.status(400).json({ message: "User not found" });

        user.balance += withdrawal.amount;
        await user.save();

        withdrawal.status = "REJECTED";
        await withdrawal.save();

        await Notification.create({
            userId: user._id,
            title: "Withdrawal Rejected",
            message: `Your withdrawal request of ${withdrawal.amount} has been rejected by the admin.`,
            notificationType: "PAYMENTS",
            metadata: { withdrawalId: withdrawal._id }
        });

        res.status(200).json({ status: "success", message: "Withdrawal rejected and refunded", data: withdrawal });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "Rejection failed", error: error.message });
    }
}

export const getCategoryById = async (req, res)=>{
    try {
        const {id} = req.params
        const category = await Category.findById(id).populate('parentCategory', 'name')

        if(!category) return res.status(404).json({message: 'Category not found'})

        const totalProducts = await Product.countDocuments({category: id})
        
        res.status(200).json({
          category, totalProducts
        })
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to fetch category", error: error.message });
    }
}

export const toggleCategoryActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category has been ${category.isActive ? "activated" : "deactivated"}.`,
      data: category,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle category active status",
      error: error.message,
    });
  }
};

export const createCategory = async (req, res)=>{
    try {
       const {name, commissionPercentage, parentCategory, tags, attributes} = req.body

        const exists = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
        });

        if (exists) {
            return res.status(400).json({ message: `Category "${name}" already exists` });
        }

       const parsedTags = tags ? JSON.parse(tags) : [];
       const parsedAttributes = attributes ? JSON.parse(attributes) : [];
       const commission = Number(commissionPercentage)

       if (!req.file) return res.status(400).json({message: 'Image is required'})
      const uploadRes = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories", // optional: keeps uploads organized in a folder
        resource_type: "image",
      });
       const image = uploadRes.secure_url;

        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });

        const category = await Category.create({
            name, 
            commissionPercentage: commission, 
            parentCategory, 
            image, 
            tags: parsedTags, 
            attributes: parsedAttributes
        })

       res.status(200).json(category)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to create category", error: error.message });
    }
}

export const updateCategory = async (req, res)=>{
    try {
      const {id} = req.params
       const {name, commissionPercentage, parentCategory, tags, attributes} = req.body

        const category = await Category.findById(id)

        if (!category) {
            return res.status(400).json({ message: `Category Not Found` });
        }

       const parsedTags = tags ? JSON.parse(tags) : [];
       const parsedAttributes = attributes ? JSON.parse(attributes) : [];
       const commission = Number(commissionPercentage)

       let image = null

       if (req.file){
         const uploadRes = await cloudinary.uploader.upload(req.file.path, {
           folder: "categories", // optional: keeps uploads organized in a folder
           resource_type: "image",
         });
          image = uploadRes.secure_url;
   
           fs.unlink(req.file.path, (err) => {
               if (err) console.error("Error deleting temp file:", err);
           });
       }

       const updatedCategory = await Category.findByIdAndUpdate(id, {
        parentCategory,
        name,
        commissionPercentage: commission,
        tags: parsedTags,
        attributes: parsedAttributes,
        image: image ? image : category.image
       }, {new: true})

       res.status(200).json(updatedCategory)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to update category", error: error.message });
    }
}

export const deleteCategory = async (req, res)=>{
    try {
      const {id} = req.params

      const productExists = await Product.findOne({category: id})

      if(productExists) return res.status(200).json({message: 'Unable to delete category with listed products'})

      await Category.updateMany({parentCategory: id}, {parentCategory: null})

      await Category.findByIdAndDelete(id)
       
      res.status(200).json({message: 'Category Deleted Successfully'})
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to update category", error: error.message });
    }
}

export const getAllCategories = async(req, res)=>{
    try {
        const categories = await Category.find()
        .collation({ locale: "en", strength: 2 })
        .sort({ name: 1 });

        res.status(200).json(categories)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getCategoriesWithProductCount = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    // Count total matching categories
    const totalCategories = await Category.countDocuments(query);

    // Fetch categories (sorted, paginated, and populated)
    const categories = await Category.find(query)
      .populate("parentCategory", "name") // <-- populate only the 'name'
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get product counts
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ category: category._id });
        return {
          ...category.toObject(),
          listedItems: productCount,
        };
      })
    );

    res.status(200).json({
      categories: categoriesWithCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCategories / limit),
      totalCategories,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTotalCommissionAnalytics = async (req, res) => {
  try {
    const { filter = "today" } = req.query;

    const now = new Date();
    let startDate, endDate;

    switch (filter) {
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thisWeek":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);

        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      default: // today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    // ---- AGGREGATE ----
    const pipeline = [
      {
        $match: {
          transactionStatus: "completed", 
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: "$commissionAmount" },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);

    const totalCommission =
      result.length > 0 ? Number(result[0].totalCommission.toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      totalCommission,
      filter,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("Commission analytics error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getCategoryCommissionAnalytics = async (req, res) => {
  try {
    const { categoryId, filter = "today" } = req.query;

    const now = new Date();
    let startDate, endDate;

    switch (filter) {
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thisWeek":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);

        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      default: // today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    // If no categoryId, return 0 commission with null name/id
    if (!categoryId) {
      return res.status(200).json({
        categoryCommission: 0,
        categoryId: null,
        categoryName: null,
        filter,
        startDate,
        endDate,
      });
    }

    // --- Get category name ---
    const category = await Category.findById(categoryId).select("name");
    if (!category) {
      return res.status(400).json({message: 'Category not found'});
    }

    // --- Aggregation to compute commission for a specific category ---
     const pipeline = [
      {
        $match: {
          transactionStatus: "completed", 
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $match: {
          "product.category": new mongoose.Types.ObjectId(categoryId),
        },
      },
      {
        $group: {
          _id: null,
          categoryCommission: { $sum: "$commissionAmount" },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const categoryCommission = result[0]?.categoryCommission || 0;

    res.status(200).json({
      categoryCommission: Number(categoryCommission.toFixed(2)),
      categoryId,
      categoryName: category.name,
      filter,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to calculate category commission analytics",
      error: error.message,
    });
  }
};

export const upsertSetting = async (req, res) => {
  try {
    const { key, value } = req.body;

    const updatedSetting = await Setting.findOneAndUpdate(
      { key },
      {
        $set: { value, updatedBy: req.userId, updatedAt: Date.now() },
        $setOnInsert: { key },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, data: updatedSetting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSettingByKey = async (req, res) => {
  try {
    const key = req.params.key;

    const defaultValue = defaultSettings[key] ?? null;

    const setting = await Setting.findOneAndUpdate(
      { key },
      { 
        $setOnInsert: { 
          key, 
          value: defaultValue 
        } 
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, data: setting });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSetting = async (req, res) => {
  try {
    const key = req.params.key;
    const { value } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { key },
      { value, updatedAt: Date.now(), updatedBy: req.userId },
      { new: true }
    );

    res.status(200).json({ success: true, data: setting });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAppeals = async (req, res) => {
  try {
    const {
      type,
      search = "",
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    const matchConditions = {};
    if (type) matchConditions.type = type;
    if (status !== 'all') matchConditions.status = status;

    const searchCondition = search
      ? {
          $or: [
            { subject: { $regex: search, $options: "i" } },
            { "user.firstName": { $regex: search, $options: "i" } },
            { "user.lastName": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "admins",
          localField: "resolvedBy",
          foreignField: "_id",
          as: "resolvedBy",
        },
      },
      { $unwind: { path: "$resolvedBy", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...matchConditions,
          ...searchCondition,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1,
          subject: 1,
          order:1,
          category: 1,
          description: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "user._id": 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.email": 1,
          "resolvedBy._id": 1,
          "resolvedBy.firstName": 1,
          "resolvedBy.lastName": 1,
          resolutionNote: 1,
        },
      },
    ];

    const appeals = await Appeal.aggregate(pipeline);

    // Count pipeline (simplified)
    const countPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...matchConditions,
          ...searchCondition,
        },
      },
      { $count: "total" },
    ];

    const totalResult = await Appeal.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      appeals,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch appeals" });
  }
};

export const getAppeal = async(req, res)=>{
    try {
        const {id} = req.params
    
        const appeal = await Appeal.findById(id)
          .populate('user', 'firstName lastName')
          .populate('seller', 'firstName lastName')
    
        if(!appeal) return res.status(400).json({message: 'Appeal Not Found'})

    
        return res.status(200).json(appeal)
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const toggleAppealStatus = async (req, res) => {
  try {
    const { id } = req.params;        
    const { status } = req.body;         

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const appeal = await Appeal.findById(id);
    if (!appeal) {
      return res.status(404).json({ success: false, message: 'Appeal not found' });
    }

    appeal.status = status;
    await appeal.save();

    return res.status(200).json({
      success: true,
      message: `Appeal status changed to ${status}`,
      data: appeal
    });
  } catch (error) {
    console.error('Error toggling appeal status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getReports = async (req, res) => {
  try {
    const {
      type,
      search = "",
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    const matchConditions = {};
    if (type) matchConditions.type = type;
    if (status !== 'all') matchConditions.status = status;

    const searchCondition = search
      ? {
          $or: [
            { subject: { $regex: search, $options: "i" } },
            { "reportedUser.firstName": { $regex: search, $options: "i" } },
            { "reportedUser.lastName": { $regex: search, $options: "i" } },
            { "reporter.firstName": { $regex: search, $options: "i" } },
            { "reporter.lastName": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "reportedUser",
          foreignField: "_id",
          as: "reportedUser",
        },
      },
      { $unwind: { path: "$reportedUser", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "reporter",
          foreignField: "_id",
          as: "reporter",
        },
      },
      { $unwind: { path: "$reporter", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "admins",
          localField: "resolvedBy",
          foreignField: "_id",
          as: "resolvedBy",
        },
      },
      { $unwind: { path: "$resolvedBy", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...matchConditions,
          ...searchCondition,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1,
          reason: 1,
          description: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "reportedUser._id": 1,
          "reportedUser.firstName": 1,
          "reportedUser.lastName": 1,
          "reporter._id": 1,
          "reporter.firstName": 1,
          "reporter.lastName": 1,
          "resolvedBy._id": 1,
          "resolvedBy.firstName": 1,
          "resolvedBy.lastName": 1,
          resolutionNote: 1,
        },
      },
    ];

    const reports = await Report.aggregate(pipeline);

    // Count pipeline (simplified)
    const countPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "reportedUser",
          foreignField: "_id",
          as: "reportedUser",
        },
      },
      { $unwind: { path: "$reportedUser", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          localField: "reporter",
          foreignField: "_id",
          as: "reporter",
        },
      },
      { $unwind: { path: "$reporter", preserveNullAndEmptyArrays: true } },

      {
        $match: {
          ...matchConditions,
          ...searchCondition,
        },
      },

      { $count: "total" },
    ];

    const totalResult = await Report.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      reports,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch appeals" });
  }
};

export const getReport = async(req, res)=>{
    try {
        const {id} = req.params
    
        const report = await Report.findById(id)
          .populate('reportedUser', 'firstName lastName')
          .populate('reporter', 'firstName lastName')
    
        if(!report) return res.status(400).json({message: 'Report Not Found'})

    
        return res.status(200).json(report)
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const toggleReportStatus = async (req, res) => {
  try {
    const { id } = req.params;        
    const { status } = req.body;         

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.status = status;
    await report.save();

    return res.status(200).json({
      success: true,
      message: `Report status changed to ${status}`,
      data: report
    });
  } catch (error) {
    console.error('Error toggling report status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPayoutAnalytics = async (req, res) => {
  try {
    const [totalPayout, pendingPayout] = await Promise.all([
      Withdrawal.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
      ]),

      Withdrawal.aggregate([
        { $match: { status: "PENDING" } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
      ])
    ]);

    return res.status(200).json({
      success: true,
      message: "Payout analytics fetched successfully",
      data: {
        totalPayout: {
          value: totalPayout[0]?.totalAmount || 0,
        },
        pendingPayout: {
          value: pendingPayout[0]?.totalAmount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Payout Analytics Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", filter = "" } = req.query;

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    const match = {};

    // 🔍 SEARCH
    if (search) {
      match.$or = [
        { "user.firstName": { $regex: search, $options: "i" } },
        { "user.lastName": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
      ];
    }

    if (filter) {
      match.status = filter;
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    const totalPipeline = [...pipeline, { $count: "total" }];
    const totalDocs = await Withdrawal.aggregate(totalPipeline);
    const total = totalDocs[0]?.total || 0;

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (page - 1) * Number(limit) });
    pipeline.push({ $limit: Number(limit) });

    const withdrawals = await Withdrawal.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      message: "Withdrawals fetched successfully",
      withdrawals,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalWithdrawals: total,
    });

  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getPayout = async(req, res)=>{
    try {
        const {id} = req.params
    
        const payout = await Withdrawal.findById(id).populate('userId', 'firstName lastName')
    
        if(!payout) return res.status(400).json({message: 'Payout Not Found'})
    
        return res.status(200).json(payout)
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

export const createPayout = async (req, res) => {
    const { email, amount, note } = req.body

    if(!email || !amount)  return res.status(400).json({ message: "Email and amount required" });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const defaultWithdrawalOption = user.withdrawalOptions.find(option => option.isDefault);
        if (!defaultWithdrawalOption) {
            return res.status(400).json({ message: "No default withdrawal bank set. Please set a default withdrawal option." });
        }

        const { bankCode, accountNumber } = defaultWithdrawalOption;

        if (!amount) {
            return res.status(400).json({ message: "Invalid Request: Amount is required." });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: "Insufficient User Balance" });
        }

        const reference = `WD_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        user.balance -= amount;
        await user.save();

        const withdrawal = new Withdrawal({
            userId: user._id,
            amount,
            bankCode,
            accountNumber,
            status: "PENDING",
            reference,
            note
        });
        await withdrawal.save();

        res.status(200).json({ status: "success", message: "Payout successfully created", data:withdrawal });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "Failed to create payout", error: error.message });
    }
};

export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    let {
      page = 1,
      limit = 10,
      isRead,
      isArchived,
      notificationType,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const query = { userId };

    if (isRead === "true" || isRead === "false") {
      query.isRead = isRead === "true";
    }

    if (isArchived === "true" || isArchived === "false") {
      query.isArchived = isArchived === "true";
    }

    if (notificationType) {
      query.notificationType = notificationType;
    }

    const skip = (page - 1) * limit;

    // Fetch paginated notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    // Count total
    const total = await Notification.countDocuments(query);

    // Count unread (for UI badges)
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
      isArchived: false,
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
