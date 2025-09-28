import express from 'express'
import { initializePayment, verifyPayment } from '../controllers/paymentControllers.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post("/initiate", verifyToken, initializePayment);

router.get("/verify-payment", verifyToken, verifyPayment);

export default router;