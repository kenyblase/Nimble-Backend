import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/isAdmin.js";
import upload from '../utils/multer.js'
import { adminSignup, approveWithdrawal, blockUser, deleteAdmin, deleteProduct, editAdmin, getAdmins, getDashboardAnalytics, getLatestOrders, getLatestTransactions, getListingAnalytics, getOrderAnalytics, getWithdrawals, getTransactionAnalytics, getUser, getUsers, getSelectedWithdrawal, rejectWithdrawal, adminLogIn, createCategory, getAllCategories, getCategoriesWithProductCount } from "../controllers/adminControllers.js";

const router = Router()

router.post('/signup', verifyToken, isAdmin, adminSignup)

router.post('/login', adminLogIn)

router.get('/get-analytics', verifyToken, isAdmin, getDashboardAnalytics)

router.get('/get-transactions', verifyToken, isAdmin, getLatestTransactions)

router.get('/get-listings', verifyToken, isAdmin, getListingAnalytics)

router.get('/get-orders', verifyToken, isAdmin, getOrderAnalytics)

router.get('/get-latest-orders', verifyToken, isAdmin, getLatestOrders)

router.get('/get-transaction-analytics', verifyToken, isAdmin, getTransactionAnalytics)

router.get('/get-users', verifyToken, isAdmin, getUsers)

router.get('/get-admins', verifyToken, isAdmin, getAdmins)

router.post('/edit-admin', verifyToken, isAdmin, editAdmin)

router.delete('/delete-admin/:id', verifyToken, isAdmin, deleteAdmin)

router.get('/get-withdrawals', verifyToken, isAdmin, getWithdrawals)

router.get('/approve-withdrawal/:withdrawalId', verifyToken, isAdmin, approveWithdrawal)

router.get('/reject-withdrawal/:withdrawalId', verifyToken, isAdmin, rejectWithdrawal)

router.get('/get-selected-withdrawal/:id', verifyToken, isAdmin, getSelectedWithdrawal)

router.post('/block', verifyToken, isAdmin, blockUser)

router.post('/get-user', verifyToken, isAdmin, getUser)

router.post('/create-category', verifyToken, isAdmin, upload.single("image"), createCategory)

router.get('/categories', verifyToken, isAdmin, getAllCategories)

router.get('/categories-count', verifyToken, isAdmin, getCategoriesWithProductCount)

router.delete('/delete-product/:productId', verifyToken, isAdmin, deleteProduct)

export default router
