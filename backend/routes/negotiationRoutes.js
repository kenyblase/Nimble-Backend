import express from 'express';
import { createNegotiation, cancelNegotiation, getNegotiationsByUser, acceptNegotiation } from '../controllers/negotiationController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/create', verifyToken, createNegotiation);

// router.put('/respond/:negotiationId', verifyToken, respondToNegotiation);

router.put('/:negotiationId/accept', verifyToken, acceptNegotiation);

router.put('/:negotiationId/cancel', verifyToken, cancelNegotiation);

router.get('/get-offers', verifyToken, getNegotiationsByUser);

export default router;
