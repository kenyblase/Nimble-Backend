import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['listing', 'request'] },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sizes: [String],
    gender: {type: String},
    colours: [String],
    bulkPrices: [{
        numberOfPieces: {
            type: Number
        },
        price:{
            type: Number
        }
    }],
    location: {
        state: {
            type: String
        },
        city:{
            type: String
        }
    },
    condition: {
        type: String
    },
    deliveryTimelines: [{
        city:{
            type: String,
        },
        period: {
            type: String
        }
    }],
    shippingAddress: {
        name: {
            type: String
        },
        phoneNumber: {
            type: Number
        },
        city: {
            type: String
        },
        state: {
            type:String
        }
    },
    shippingOptions:[{
        type: String
    }],
    isShippedFromAbroad:{
        type: String
    },
    videoLink: {
        type: String
    },
    vendor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    },
    images: [String],
    isNegotiable: { type: Boolean, default: true },
    listedOn: Date,
    reviews:[{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        rating:{
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    averageRating:{
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'closed', 'rejected', 'expired'],
        default: "pending"   
    },
    views: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
}, {timestamps: true});

const Product = mongoose.model('Product', productSchema);

export default Product;
