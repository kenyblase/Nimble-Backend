import mongoose from 'mongoose';

const negotiationSchema = new mongoose.Schema({
    buyer: {
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
    // history: [{
    //     priceProposed: {
    //         type: Number,
    //         required: true
    //     },
    //     message: {
    //         type: String,
    //         required: true
    //     },
    //     status: {
    //         type: String,
    //         enum: ['proposed', 'accepted', 'rejected', 'countered'],
    //         default: 'proposed'
    //     },
    //     respondedBy: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'User',
    //     },
    //     createdAt: { type: Date, default: Date.now },
    // }],
    currentPrice: {
        type: Number,
        required: true
    },
    negotiationStatus: {
        type: String,
        enum: ['ongoing', 'completed', 'canceled'],
        default: 'ongoing'
    },
}, {timestamps: true});

const Negotiation = mongoose.model('Negotiation', negotiationSchema);

export default Negotiation;
