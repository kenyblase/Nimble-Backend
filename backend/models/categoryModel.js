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
        ref: 'Category',
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

categorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

const Category = mongoose.model('Category', categorySchema);

export default Category;
