import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParentCategory',
        required: true
    },
    commissionPercentage: {
        type: Number,
        min: 1,
        max: 99
    }
}, {timestamps: true});

const SubCategory = mongoose.model('SubCategory', subCategorySchema);

export default SubCategory;
