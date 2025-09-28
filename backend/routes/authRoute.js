import express from 'express'
import { logIn, logOut, signUp, verifyEmail, resetPassword, forgotPassword, checkAuth, resendVerificationEmail, resendResetPasswordEmail } from '../controllers/authControllers.js'
import { verifyToken } from '../middleware/verifyToken.js'


const router = express.Router()

router.get('/check-auth', verifyToken, checkAuth)

router.post('/signup', signUp)

router.post('/login', logIn)

router.post('/logout', logOut)

router.post('/verify-email', verifyEmail)

router.post('/resend-verify-email', resendVerificationEmail)

router.post('/forgot-password', forgotPassword)

router.post('/resend-reset-password', resendResetPasswordEmail)

router.post('/reset-password', resetPassword)

export default router