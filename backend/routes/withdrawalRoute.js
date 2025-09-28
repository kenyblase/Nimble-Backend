import express from 'express'
import { getBanks, initiateWithdrawal } from '../controllers/withdrawalController.js'
import { verifyToken } from '../middleware/verifyToken.js'

const router = express.Router()

router.get('/banks', verifyToken, getBanks)

router.post('/initiate', verifyToken, initiateWithdrawal)

export default router