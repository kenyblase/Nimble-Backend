import User from '../models/userModel.js'
import bcryptjs from 'bcryptjs'
import { generateVerificationCode } from '../utils/generateVerificationCode.js'
import {generateTokenAndSetCookie} from '../utils/generateTokenAndSetCookie.js'
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from '../mailTrap/emails.js'
import Admin from '../models/adminModel.js'

export const signUp = async (req, res) => {
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

        const VerificationToken = generateVerificationCode()

        const user = new User({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            VerificationToken, 
            VerificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
            role: 'USER' 
        })

        await user.save()

        const token = generateTokenAndSetCookie(res, user._id)

        sendVerificationEmail(user.email, VerificationToken)

        res.status(201).json({
            success: true,
            message:'Account Created Successfully',
            user: {
                ...user._doc,
                password:undefined
            },
            token
        })
    } catch (error) {
        res.status(500).json({success:false, message:'Internal Server Error'})
    }
}

export const verifyEmail = async(req, res)=> {
    const {code} = req.body

    try {
        const user = await User.findOne({
            VerificationToken: code,
            VerificationTokenExpiresAt: {$gt: Date.now()}
        })

        if(!user){
            return res.status(400).json({success: false, message: 'Invalid or Expired Code'})
        }

        user.isVerified = true
        user.VerificationToken = undefined
        user.VerificationTokenExpiresAt = undefined

        await user.save()

        await sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`)

        res.status(200).json({
            sucess:true,
            message: 'Email Verified Sucessfully',
            user: {
                ...user._doc,
                password: undefined
            }
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({success: false, message: 'Server Error'})
    }
}

export const resendVerificationEmail = async(req, res)=>{
    try {
        const {email} = req.body
    
        if(!email) return res.status(400).json({message: 'Fill in an email address'})
    
        const user = await User.findOne({email, isVerified: false})

        if(!user) return res.status(400).json({message: 'User Not found'})

        const lastSentTime = user.VerificationTokenExpiresAt - 24 * 60 * 60 * 1000; // Subtract 1 day
        const elapsedTime = Date.now() - lastSentTime;
        
        if (elapsedTime <= 30000) {
            return res.status(400).json({ message: 'Please wait 30 seconds before resending the code' });
        }

        const VerificationToken = generateVerificationCode()

        user.VerificationToken = VerificationToken
        user.VerificationTokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000

        await user.save()
        
        sendVerificationEmail(user.email, VerificationToken)

        res.status(200).json({message: 'Verification Code Sent Successfully'})
        
    } catch (error) {
        res.status(500).json({success:false, message:'Internal Server Error'})
    }
}

export const resendResetPasswordEmail = async(req, res)=>{
    try {
        const {email} = req.body
    
        if(!email) return res.status(400).json({message: 'Fill in an email address'})
    
        const user = await User.findOne({email})

        if(!user) return res.status(400).json({message: 'User Not found'})

        const lastSentTime = user.resetPasswordExpiresAt - 1 * 60 * 60 * 1000; // Subtract 1 hour
        const elapsedTime = Date.now() - lastSentTime;
        
        if (elapsedTime <= 30000) {
            return res.status(400).json({ message: 'Please wait 30 seconds before resending the code' });
        }

        const resetToken = generateVerificationCode()
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000

        user.resetPasswordToken = resetToken
        user.resetPasswordExpiresAt = resetTokenExpiresAt

        await user.save()

        await sendPasswordResetEmail(user.email, resetToken)

        res.status(200).json({success: true, message:'Password Reset Code Sent To Your Email'})
    } catch (error) {
        res.status(500).json({success:false, message:'Internal Server Error'})
    }
}

export const logIn = async (req, res) => {
    const {email, password} = req.body
    try {
        const user = await User.findOne({email})
        if(!user) {
            return res.status(400).json({sucess: false, message: 'Invalid Credentials'})
        }

        if(user.isBlocked === true){
            return res.status(400).json({message: 'Your Account has been restricted. Please contact Admin'})
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password)

        if(!isPasswordValid){
            return res.status(400).json({sucess: false, message:'Invalid Password'})
        }

        const token = generateTokenAndSetCookie(res, user._id)

        user.lastlogin = new Date()
        
        await user.save()

        res.status(200).json({
            success: true,
            message: 'Logged In Successfully',
            user: {
                ...user._doc, password:undefined
            },
            token
        })
    } catch (error) {
        console.log('Error Signing In',error)
        res.status(400).json({success:false, message:error.message})
    }
}

export const logOut = async (req, res) => {
    res.clearCookie('token')
    res.status(200).json({success: true, message: 'Logged Out Sucessfully'})
}

export const forgotPassword = async (req, res) => {
    const {email} = req.body
    try {
        const user = await User.findOne({email})
        if(!user){
            return res.status(400).json({
                success: false,
                message: 'Email not found'
            })
        }

        const resetToken = generateVerificationCode()
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000

        user.resetPasswordToken = resetToken
        user.resetPasswordExpiresAt = resetTokenExpiresAt

        await user.save()

        await sendPasswordResetEmail(user.email, resetToken)

        res.status(200).json({success: true, message:'Password Reset Code Sent To Your Email'})

    } catch (error) {
        console.log('Error in forgot-password:',error)
        res.status(400).json({success: false, message:error.message})
    }
}

export const resetPassword = async (req, res)=> {
    try {
        const {password, token} = req.body

        if(!token || !password){
            return res.status(400).json({success: false, message: 'Invalid Request'})
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiresAt: {$gt: Date.now()}
        })

        if(!user){
            return res.status(400).json({success: false, message: 'Invalid or Expired Reset Token'})
        }

        const hashedPassword = await bcryptjs.hash(password, 10)

        user.password = hashedPassword
        user.resetPasswordToken = undefined
        user.resetPasswordExpiresAt = undefined

        await user.save()

        sendResetSuccessEmail(user.email)

        res.status(200).json({success: true, message: 'Password Reset Sucessful'})
    } catch (error) {
        console.log('Error in reset-password',error)
        res.status(400).json({success:false, message: error.message})
    }
}

export const checkAuth = async (req, res)=>{
    try {
        const user = await User.findById(req.userId) ?? await Admin.findById(req.userId)

        if(!user) {
            return res.status(400).json({success: false, message: 'User Not Found'})
        }
        res.status(200).json({success: true, user: {
            ...user._doc,
            password: undefined
        }})
    } catch (error) {
        console.log("Error in checkAuth",error)
        res.status(500).json({success: false, message: error.message})
    }
}