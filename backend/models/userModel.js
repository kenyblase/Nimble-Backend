import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email:{
        type:String,
        required: true,
        unique:true
    },
    password:{
        type:String,
        required: true,
    },
    firstName:{
        type:String,
        required: true
    },
    lastName:{
        type:String,
        required: true
    },
    gender:{
        type:String,
        enum: ['MALE', 'FEMALE'],
    },
    profilePic:{
        type: String,
        default: ''
    },
    phoneNumber: {
        type: Number,
        default: ''
    },
    businessDetails:{
        businessName: {
            type: String,
        },
        businessInformation: {
            type: String,
        },
        address:{
            type: String,
        },
        city:{
            type: String,
        },
        state:{
            type: String,
        },
    },
    balance: {
        type: Number,
        default: 0
    },
    pendingBalance: {
        type: Number,
        default: 0
    },
    withdrawalOptions:[
        {
            accountNumber: {
                type: String,
            },
            bankName: {
                type: String
            },
            bankCode:{
                type: String
            },
            recipientName:{
                type: String
            },
            isDefault: {
                type: Boolean,
                default: false
            }
        }
    ],
    lastlogin:{
        type:Date,
        default:Date.now
    },
    isVerified:{
        type:Boolean,
        default:false
    },
    AppNotificationSettings:{
        type:[String],
        default: []
    },
    EmailNotificationSettings:{
        type:[String],
        default: []
    },
    status:{
        type: String,
        default: 'active'
    },
    deliveryAddress: [{
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
        isDefault:{
            type: Boolean,
            default: false
        }
    }],
    averageRating: {
    type: Number,
    default: 0,
    },
    numReviews: {
    type: Number,
    default: 0,
    },
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    resetPasswordToken:String,
    resetPasswordExpiresAt:Date,
    VerificationToken: String,
    VerificationTokenExpiresAt: Date,
}, {timestamps: true})


const User = mongoose.model('User', userSchema)

export default User