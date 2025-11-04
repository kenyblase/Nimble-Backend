import express from 'express';
import { createOrderWithBalance, getOrderById, getOrdersByUser, getOrdersByVendor, initializePaystackPayment, updateOrderStatus, updateTransactionStatus, verifyPaystackPayment } from '../controllers/orderController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/create/balance', verifyToken, createOrderWithBalance);

router.post('/create/paystack', verifyToken, initializePaystackPayment);

router.get('/verify/paystack', verifyToken, verifyPaystackPayment);

router.get('/get-orders', verifyToken, getOrdersByUser);

router.get('/get-orders/vendor', verifyToken, getOrdersByVendor);

router.get('/get-order/:id', verifyToken, getOrderById);

router.put('/update-order/:orderId/status', verifyToken, updateOrderStatus);

router.put('/update-order/:orderId/transaction-status', verifyToken, updateTransactionStatus);

export default router;