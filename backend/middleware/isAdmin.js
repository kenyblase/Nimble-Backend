import User from "../models/userModel.js";

export const isAdmin = async(req, res, next)=>{
    const user = await User.findById(req.userId)

    if(user.role !== 'ADMIN'){
        return res.status(403).json({message: 'Unauthorized - You cannot access this route'})
    }

    next()
}