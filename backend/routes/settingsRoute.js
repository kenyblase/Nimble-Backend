import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { addWithdrawalOptions, changePassword, deleteWithdrawalOption, setDefaultWithdrawalOption, updateBusinessProfile, updateEmailNotificationSettings, updateInAppNotificationSettings, updateProfile } from '../controllers/settingsController.js'

const router = Router()

router.post('/profile', verifyToken, updateProfile)

router.post('/business-profile', verifyToken, updateBusinessProfile)

router.post('/add-withdrawal-option', verifyToken, addWithdrawalOptions)

router.post('/set-withdrawal-option', verifyToken, setDefaultWithdrawalOption)

router.delete('/delete-withdrawal-option', verifyToken, deleteWithdrawalOption)

router.post('/email-notifications', verifyToken, updateEmailNotificationSettings)

router.post('/app-notifications', verifyToken, updateInAppNotificationSettings)

router.post('/change-password', verifyToken, changePassword)

export default router