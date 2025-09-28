import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'NGN'
    },
    paymentMethod: {
        type: String,
        required: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    },
    reference: {
        type: String,
        unique: true,
        required: true
    },
    transactionId: {
        type: String,
        unique: true,

    },
    paymentDetails: {
        type: Object
    },
},{timestamps: true}
)

const Payment = mongoose.model('Payment', paymentSchema)

export default Payment