export const isAdmin = async(req, res, next)=>{
    if(!req.isAdmin){
        return res.status(403).json({message: 'Unauthorized - You cannot access this route'})
    }

    next()
}