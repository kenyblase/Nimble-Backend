import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
    },
    bankCode: {
        type: Number,
        required: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    recipientCode: {
        type: String,
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    },
    processedAt: Date,
    transferId:{
        type: String
    },
    reference:{
        type: String
    }
}, {timestamps: true})

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema)

export default Withdrawal