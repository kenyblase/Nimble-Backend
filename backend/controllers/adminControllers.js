import User from "../models/userModel.js"
import Admin from "../models/adminModel.js"
import Order from "../models/orderModel.js"
import Transaction from "../models/TransactionModel.js"
import Product from "../models/productModel.js"
import Withdrawal from "../models/withdrawalModel.js"
import Subcategory from "../models/subCategoryModel.js"
import ParentCategory from "../models/parentCategoryModel.js"
import bcryptjs from 'bcryptjs'
import {generateTokenAndSetCookie} from '../utils/generateTokenAndSetCookie.js'
import cloudinary from '../utils/cloudinary.js'
import axios from 'axios'

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

export const getDashboardAnalytics = async(req, res)=>{
    try {
        const [totalCompletedOrders, activeListings, activeUsers, totalPending] = await Promise.all(
            [
                await Order.find({transactionStatus: "completed"}), 
                await Product.find({status: 'active'}), 
                await User.countDocuments(),
                await Product.countDocuments({status: 'pending'})
            ])
            
        let totalSales = 0

        totalCompletedOrders.forEach(order=>totalSales += order.totalAmount)

        let totalActiveListings = 0

        activeListings.forEach(listing=>totalActiveListings += listing.price)

        res.status(200).json({message: 'Analytics fetched successfully', data:{
            totalSales,
            activeListings: totalActiveListings,
            activeUsers,
            totalPending
        }})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const getLatestTransactions = async(req, res)=>{
    try {
        const transactions = await Transaction.find().populate('user', 'firstName lastName')

        const orders = await Order.find({transactionStatus: 'completed'}).populate('vendor', 'firstName lastName').populate('user', 'firstName lastName');

        const formattedTransactions = transactions.map(txn => ({
            type: txn.type,
            id: txn._id.toString(),
            seller:`${txn.user.firstName} ${txn.user.lastName}`,
            buyer: 'N/A',
            date: new Date(txn.createdAt),
            amount: `#${txn.amount.toLocaleString()}`,
            status: txn.status,
            action: ':',
            user:`${txn.user.firstName} ${txn.user.lastName}`
        }))

        const formattedOrders = orders.map(order => ({
            type: 'Sales',
            id: order._id.toString(),
            seller:`${order.vendor.firstName} ${order.vendor.lastName}`,
            buyer:`${order.user.firstName} ${order.user.lastName}`,
            date: new Date(order.createdAt),
            amount: `#${order.totalAmount.toLocaleString()}`,
            status: order.transactionStatus,
            action: ':',
            user: 'N/A'
        }))

        const sortedData = [...formattedTransactions, ...formattedOrders].sort((a,b)=>b.date - a.date)

        const finalData = sortedData.map(item => ({
            ...item,
            date: item.date.toLocaleDateString('en-GB')
        }));

        res.status(200).json({message: 'Transactions Fetched Successfully', data: finalData})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

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

export const getUsers = async(req, res)=>{
    try {
        const users = await User.find({role: {$ne: 'ADMIN'}})

        const formattedUsers = await Promise.all(users.map(async (user) => ({
            fullname: `${user.firstName} ${user.lastName}`,
            userId: user._id,
            email: user.email,
            phone: user.phoneNumber,
            verification: user.isVerified ? 'Verified' : 'Not Verified',
            listing: await Product.countDocuments({ vendor: user._id }),
            status: user.isVerified ? 'Completed' : 'Not Completed',
            action: ':'
        })))
        
        res.status(200).json(formattedUsers)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getAdmins = async(req, res)=>{
    try {
        const userId = req.userId
        const admins = await User.find({role: 'ADMIN', _id:{$ne: userId}})
        
        res.status(200).json(admins)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const editAdmin = async(req, res)=>{
    try {
        const {firstName, lastName, email, phoneNumber, role} = req.body

        const admin = await User.findOne({email, role: 'ADMIN'})

        if(!admin) return res.status(400).json({message: 'Admin Not Found'})

        admin.firstName = firstName || admin.firstName
        admin.lastName = lastName || admin.lastName
        admin.email = email || admin.email
        admin.phoneNumber = phoneNumber || admin.phoneNumber
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

        const admin = await User.findByIdAndDelete(id)

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

export const adminSignup = async(req, res)=>{
    const {email, password, firstName, lastName} = req.body
    try {
        if(!email || !password || !firstName || !lastName){
            throw new Error('All Fields Are Required')
        }

        const userAlreadyExists = await User.findOne({email})
        if(userAlreadyExists){
            return res.status(400).json({success:false, message:'user already exists'})
        }

        const hashedPassword = await bcryptjs.hash(password, 10)

        const user = new User({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: 'ADMIN',
            isVerified: true
        })

        await user.save()

        const token = generateTokenAndSetCookie(res, user._id)

        res.status(201).json({
            success: true,
            message:'User Created Successfully',
            user: {
                ...user._doc,
                password:undefined
            },
            token
        })
    } catch (error) {
        res.status(400).json({success:false, message:error.message})
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

export const getSubCategories = async (req, res)=>{
    try {
        const subCategories = await Subcategory.find().populate('parentCategory', 'name')

        const formattedSubCategories = await Promise.all(subCategories.map(async (cat) => ({
            id: cat._id,
            category: cat.name, 
            parentCategory: cat.parentCategory.name, 
            commission: `${cat.commissionPercentage}%`, 
            listedItems: await Product.countDocuments({category: cat._id}),
            action: ':'
        })))
        
        res.status(200).json(formattedSubCategories)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to fetch subCategories", error: error.message });
    }
}

export const getSubCategoryById = async (req, res)=>{
    try {
        const {id} = req.params
        const subCategory = await Subcategory.findById(id)

        const products = await Product.find({category: id}).populate('vendor', 'firstName lastName')
        
        res.status(200).json({
            subCategory, products
        })
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to fetch subCategory", error: error.message });
    }
}

export const createParentCategory = async (req, res)=>{
    try {
       const {name} = req.body

       const parentCategory = await ParentCategory.create({name})

       res.status(200).json(parentCategory)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to create parentCategory", error: error.message });
    }
}

export const createSubCategory = async (req, res)=>{
    try {
       const {name, commissionPercentage, parentCategory} = req.body

       const subCategory = await Subcategory.create({name, commissionPercentage, parentCategory})

       res.status(200).json(subCategory)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to create subCategory", error: error.message });
    }
}

export const getParentCategories = async (req, res)=>{
    try {
       const parentCategories = await ParentCategory.find()

       res.status(200).json(parentCategories)
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "failed to create subCategory", error: error.message });
    }
}