import jwt from 'jsonwebtoken'
import User from '../models/userModel.js'

export const verifyToken = async(req, res, next)=>{
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
    if(!token) {
        return res.status(401).json({success: false, message:"Unauthorized - No Token Provided"})
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if(!decoded) return res.status(401).json({success:false, message:'Unauthorized - Invalid Token'})

        const user = await User.findById(decoded.userId)

        if(!user){
            return res.status(400).json({message: 'User not found'})
        }

        if(user.isBlocked === true){
            return res.status(400).json({message: 'Your account has been suspended - Please contact admin'})
        }

        req.userId = decoded.userId
         
        next()

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
        }
        return res.status(403).json({ success: false, message: "Invalid token." })
    }
}