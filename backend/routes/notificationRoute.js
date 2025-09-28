import { Router } from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { archiveNotification, clearAllNotifications, deleteNotification, getNotifications, markAsRead } from '../controllers/notificationControllers.js'

const router = Router()

router.get('/', verifyToken, getNotifications)

router.patch('/:id/read', verifyToken, markAsRead)

router.delete('/:id/delete', verifyToken, deleteNotification)

router.patch('/:id/archive', verifyToken, archiveNotification)

router.delete('/clear', verifyToken, clearAllNotifications)

export default router