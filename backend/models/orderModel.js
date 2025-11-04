import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    trackingNumber: {
        type: Number,
    },
    commissionAmount: {
        type: Number
    },
    totalAmount: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    shippedDate: {
        type: Date 
    },
    deliveryAddress:{
        name: {
            type: String
        },
        address: {
            type: String
        },
        phoneNumber: {
            type: String
        },
        city: {
            type: String
        },
        state: {
            type: String
        },
    },
    expectedDeliveryDate: {
        type: Date,
    },
    deliveredAt: {
        type: Date 
    },
    orderStatus: {
        type: String,
        enum: ['pending', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    transactionStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    }
}, {timestamps: true});

const Order = mongoose.model('Order', orderSchema);

export default Order;
