import cron from 'node-cron'
import Notification from '../models/notificationModel.js'

cron.schedule('0 0 * * *', async()=>{
    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const result = await Notification.deleteMany({createdAt: { $lt: thirtyDaysAgo}})
        console.log(`Deleted ${result.deletedCount} old notifications`)
    } catch (error) {
        console.log('error clearing old notifications',error)
    }
})
