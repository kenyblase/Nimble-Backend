import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
    users:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages:[{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        text: String,
        image: String,
        createdAt: {
            type: Date, 
            default: Date.now
        }
    }],
    hasAppealed: {
        type: Boolean,
        default: false
    },
    admin:[{
        type: mongoose.Schema.Types.ObjectId,
    }],
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
},{timestamps: true})

const Message = mongoose.model('Message', messageSchema)

export default Message