import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    notificationType:{
        type: String,
        enum: ['ORDERS', 'PAYMENTS', 'CHATS', 'OFFERS', 'SETTINGS'],
        default: []
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: Object,
        default:{}
    }
}, {timestamps: true})

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification