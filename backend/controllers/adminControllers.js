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
        Product.countDocuments({ status: "active" }),
        User.countDocuments({status: 'active'}),
        Product.countDocuments({ status: "pending" }),
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
          status: "active",
          createdAt: { $gte: lastWeek, $lt: today },
        }),

        User.countDocuments({
          status: 'active',
          createdAt: { $gte: yesterday, $lt: today },
        }),
  
        Product.countDocuments({
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

    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments();

    const transactions = await Transaction.find()
      .populate('user', 'firstName lastName')
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

export const getListingAnalytics = async(req, res)=>{
    try {
       const [activeListings, soldListings, pendingListings] = await Promise.all(
        [
            await Product.countDocuments({status: 'active'}),
            await Product.countDocuments({status: 'sold'}),
            await Product.countDocuments({status: 'pending'})
        ])

        res.status(200).json({message: 'Listings Fetched Successfully', data: {
            activeListings,
            soldListings,
            pendingListings
        }})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const getOrderAnalytics = async(req, res)=>{
    try {
       const [totalOrders, completedOrders, pendingOrders] = await Promise.all(
        [
            await Order.countDocuments(),
            await Order.countDocuments({transactionStatus: 'completed'}),
            await Order.countDocuments({transactionStatus: 'pending'})
        ])

        res.status(200).json({message: 'Orders Fetched Successfully', data: {
            totalOrders,
            completedOrders,
            pendingOrders
        }})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const getLatestOrders = async(req, res)=>{
    try {
        const orders = await Order.find({transactionStatus: 'completed'}).populate('vendor', 'firstName lastName').populate('user', 'firstName lastName').populate('product', 'name category');

        const formattedOrders = orders.map(order => ({
            type: 'Sales',
            id: order._id,
            item: order.product.name,
            date: new Date(order.createdAt).toLocaleDateString('en-GB'),
            seller:`${order.vendor.firstName} ${order.vendor.lastName}`,
            buyer:`${order.user.firstName} ${order.user.lastName}`,
            amount: order.totalAmount,
            category: order.product.category,
            status: order.transactionStatus,
            price: order.totalAmount
        })).sort((a,b)=>b.date - a.date)

        res.status(200).json({message: 'Orders Fetched Successfully', data: formattedOrders})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

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

export const getTransactionAnalytics = async(req, res)=>{
    try {
        let totalPayInAmount = 0
        let totalPayOutAmount = 0

        const completedTransactions = await Transaction.find({status: 'successful'})
        const completedWithdrawals = await Withdrawal.find({status: 'SUCCESS'})

        totalPayInAmount += completedTransactions.reduce((sum, payment) => sum + payment.amount, 0);

        totalPayOutAmount += completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

        res.status(200).json({message: 'Transaction Analytics fetched successfully', data: {totalPayInAmount, totalPayOutAmount}})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

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
        const {email} = req.body
    
        const user = await User.findOne({email})
    
        if(!user) return res.status(400).json({message: 'User Not Found'})
    
        return res.status(200).json({user: {
            ...user._doc,
            password:undefined
        }})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "internal Server Error"})
    }
}

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
        const admin = await User.findById(adminId);
        if (!admin || admin.role !== "ADMIN") {
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

        withdrawal.status = "PROCESSED";
        withdrawal.transferId = transferId;
        await withdrawal.save();

        await Notification.create({
            userId: withdrawal.userId,
            title: "Withdrawal Approved",
            message: `Your withdrawal of ${amount} has been approved and processed.`,
            notificationType: "WITHDRAWALS",
            metadata: { withdrawalId: withdrawal._id }
        });

        res.status(200).json({ status: "success", message: "Withdrawal approved and processed" });
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
        const admin = await User.findById(adminId);
        if (!admin || admin.role !== "ADMIN") {
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

        withdrawal.status = "FAILED";
        await withdrawal.save();

        await Notification.create({
            userId: user._id,
            title: "Withdrawal Rejected",
            message: `Your withdrawal request of ${withdrawal.amount} has been rejected by the admin.`,
            notificationType: "WITHDRAWALS",
            metadata: { withdrawalId: withdrawal._id }
        });

        res.status(200).json({ status: "success", message: "Withdrawal rejected and refunded" });
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
        endDate = new Date(now);
        break;

      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        break;

      default: // today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    // --- Aggregation to compute total commission across all categories ---
    const pipeline = [
      {
        $match: {
          status: "completed",
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
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          commission: {
            $divide: [
              { $multiply: ["$amount", "$category.commissionPercentage"] },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: "$commission" },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const totalCommission = result[0]?.totalCommission || 0;

    res.status(200).json({
      totalCommission: Number(totalCommission.toFixed(2)),
      filter,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to calculate total commission analytics",
      error: error.message,
    });
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
        endDate = new Date(now);
        break;

      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        break;

      default:
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
          status: "completed",
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
          "product.category": { $eq: new mongoose.Types.ObjectId(categoryId) },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          commission: {
            $divide: [
              { $multiply: ["$amount", "$category.commissionPercentage"] },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          categoryCommission: { $sum: "$commission" },
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
        $set: { value, updatedBy: req.admin._id, updatedAt: Date.now() },
        $setOnInsert: { key },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, data: updatedSetting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.find();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSettingByKey = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    if (!setting) return res.status(404).json({ success: false, message: "Setting not found" });
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};