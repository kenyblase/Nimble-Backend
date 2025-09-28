import Notification from '../models/notificationModel.js'

export const getNotifications = async(req, res)=>{
    try {
        const notifications = await Notification.find({userId: req.userId, isArchived: false}).sort({createdAt: -1})

        res.status(200).json(notifications)
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const markAsRead = async(req, res)=>{
    try {
        const { id } = req.params

        await Notification.findByIdAndUpdate(id, {isRead: true}, {new: true})

        res.status(200).json({message: 'Notification marked as read'})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const deleteNotification = async(req, res)=>{
    try {
        const { id } = req.params
    
        await Notification.findByIdAndDelete(id)
        
        res.status(200).json({message: 'Notification Deleted'})
    } catch (error) {
     res.status(500).json({message: 'Internal Server Error'})   
    }
}

export const archiveNotification = async(req, res)=>{
    try {
        const { id } = req.params

        await Notification.findByIdAndUpdate(id, {isArchived: true}, {new: true})
        
        res.status(200).json({message: 'Notification archived'})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const clearAllNotifications = async(req, res)=>{
    try {
        await Notification.deleteMany({userId: req.userId})

        res.json({message: 'All Notifications cleared'})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}