import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParentCategory',
        default: null
    },
    commissionPercentage: {
        type: Number,
        min: 1
    },
    tags: {type: [String], default: []},
    isActive: {type: Boolean, default: true},
    attributes: [{
        name: String,
        values: [String],
    }]
}, {timestamps: true});

const Category = mongoose.model('Category', categorySchema);

export default Category;
