import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/isAdmin.js";
import upload from '../utils/multer.js'
import { approveWithdrawal, blockUser, deleteAdmin, deleteProduct, editAdmin, getAdmins, getDashboardAnalytics, getLatestOrders, getLatestTransactions, getListingAnalytics, getOrderAnalytics, getWithdrawals, getTransactionAnalytics, getUser, getUsers, getSelectedWithdrawal, rejectWithdrawal, adminLogIn, createCategory, getAllCategories, getCategoriesWithProductCount, getTotalCommissionAnalytics, getCategoryCommissionAnalytics, getCategoryById, toggleCategoryActiveStatus, updateCategory, deleteCategory, createAdmin, getUserAnalytics, upsertSetting, getSettings, getSettingByKey, editUser, toggleUserStatus, getListedProducts, getProductById, toggleProductStatus, getListedProductsByUser, getListedProductsByCategory } from "../controllers/adminControllers.js";
import { checkAdminPermission } from "../middleware/checkAdminPermissions.js";

const router = Router()

router.post('/login', adminLogIn)

router.use(verifyToken, isAdmin)

router.post('/create', createAdmin)

router.get('/analytics', getDashboardAnalytics)

router.get('/transactions', getLatestTransactions)

router.get('/listings/analytics', getListingAnalytics)

router.get('/listings/products', getListedProducts)

router.get('/listings/products/user/:id', getListedProductsByUser)

router.get('/listings/products/category/:id', getListedProductsByCategory)

router.get('/listings/products/:id', getProductById)

router.put('/listings/products/:id/status', toggleProductStatus)

router.get('/orders', getOrderAnalytics)

router.get('/orders/latest', getLatestOrders)

router.get('/transaction/analytics', getTransactionAnalytics)

router.get('/users/analytics', getUserAnalytics)

router.get('/users', getUsers)

router.get('/users/:id', getUser)

router.put('/users/:id/edit', editUser)

router.put('/users/:id/status', toggleUserStatus);

router.get('/admins', getAdmins)

router.put('/:id/edit', editAdmin)

router.delete('/:id/delete', deleteAdmin)

router.get('/get-withdrawals', getWithdrawals)

router.get('/approve-withdrawal/:withdrawalId', approveWithdrawal)

router.get('/reject-withdrawal/:withdrawalId', rejectWithdrawal)

router.get('/get-selected-withdrawal/:id', getSelectedWithdrawal)

router.post('/block', blockUser)

router.post('/categories/create', upload.single("image"), createCategory)

router.put('/categories/:id/update', upload.single("image"), updateCategory)

router.delete('/categories/:id/delete', deleteCategory)

router.get('/categories', getAllCategories)

router.get('/categories/:id', getCategoryById)

router.put('/categories/:id/toggle', toggleCategoryActiveStatus)

router.get('/categories-count', getCategoriesWithProductCount)

router.get('/commissions/total', getTotalCommissionAnalytics)

router.get('/commissions/category', getCategoryCommissionAnalytics)

router.delete('/delete-product/:productId', deleteProduct)

router.post("/settings", checkAdminPermission("manage_settings"), upsertSetting);

router.get("/settings", checkAdminPermission("view_settings"), getSettings);

router.get("/settings/:key", getSettingByKey);

export default router