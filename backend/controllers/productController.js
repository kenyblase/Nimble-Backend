import cloudinary from '../utils/cloudinary.js'
import Product from '../models/productModel.js';
import ParentCategory from '../models/parentCategoryModel.js';
import Category from '../models/categoryModel.js';
import subCategory from '../models/subCategoryModel.js';
import User from '../models/userModel.js';

export const createProduct = async (req, res) => {
    const { name, description, price, gender, colours, bulkPrices, videoLink, location, condition, deliveryTimelines, shippingAddress, shippingOption, isShippedFromAbroad, category, sizes, images, isNegotiable } = req.body;
    const vendor = req.userId;

    try {
        const uploadedImages = [];
        for (let i = 0; i < images.length; i++) {
            const result = await cloudinary.uploader.upload(images[i], {
                folder: 'marketplace/products',
            });
            uploadedImages.push(result.secure_url);
        }

        const newProduct = new Product({
            name,
            description,
            price,
            gender,
            colours,
            bulkPrices,
            videoLink,
            location,
            condition,
            deliveryTimelines,
            shippingAddress,
            shippingOption,
            isShippedFromAbroad,
            category,
            sizes,
            vendor,
            images: uploadedImages,
            isNegotiable
        });

        await newProduct.save();
        
        return res.status(201).json({ message: 'Product created successfully', product: newProduct });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;

        const skip = (page - 1) * limit;

        // let filters = {};

        // if (category) {
        //     filters.category = category;
        // }

        // if (minPrice || maxPrice) {
        //     filters.price = {};
        //     if (minPrice) filters.price.$gte = minPrice;
        //     if (maxPrice) filters.price.$lte = maxPrice;
        // }

        // if (search) {
        //     filters.$or = [
        //         { name: { $regex: search, $options: 'i' } },  // Search in product name
        //         { description: { $regex: search, $options: 'i' } },  // Search in description
        //         { category: { $regex: search, $options: 'i' } }  // Search in category
        //     ];
        // }

        const products = await Product.find({status: 'active'})
            .populate('vendor', 'businessName')
            .skip(skip)
            .limit(limit)
            .exec();

        const totalCount = await Product.countDocuments({status: 'active'});

        res.status(200).json({
            products,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: parseInt(page),
            perPage: parseInt(limit),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getProductsByVendor = async (req, res) => {
    const { vendorId } = req.params;

    try {
        const products = await Product.find({ vendor: vendorId });
        return res.status(200).json({ products });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getProductById = async (req, res) => {
    const { productId } = req.params;

    try {
        const product = await Product.findById(productId).populate('category', 'name');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json({ product });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const vendorId = req.userId
    const { name, description, price, gender, colours, bulkPrices, videoLink, location, condition, deliveryTimelines, shippingAddress, shippingOption, isShippedFromAbroad, category, sizes, images, isNegotiable } = req.body;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if(product.vendor.toString() !== vendorId){
            return res.status(400).json({message: 'You can only update products created by you'})
        }

        const uploadedImages = [];
        if (images && images.length > 0) {
            for (let i = 0; i < product.images.length; i++) {
                const publicId = product.images[i].split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            }

            for (let i = 0; i < images.length; i++) {
                const result = await cloudinary.uploader.upload(images[i], {
                    folder: 'marketplace/products',
                });
                uploadedImages.push(result.secure_url);
            }
        }

        product.name = name || product.name;
        product.description = description || product.description;
        product.price = price || product.price;
        product.category = category || product.category;
        product.sizes = sizes || product.sizes;
        product.isNegotiable = isNegotiable || product.isNegotiable;
        product.images = uploadedImages.length > 0 ? uploadedImages : product.images;
        product.gender = gender || product.gender,
        product.colours = colours || product.colours,
        product.bulkPrices = bulkPrices || product.bulkPrices, 
        product.videoLink = videoLink || product.videoLink, 
        product.location = location || product.location, 
        product.condition = condition || product.condition, 
        product.deliveryTimelines = deliveryTimelines || product.deliveryTimelines, 
        product.shippingAddress = shippingAddress || product.shippingAddress, 
        product.shippingOption = shippingOption || product.shippingOption, 
        product.isShippedFromAbroad = isShippedFromAbroad || product.isShippedFromAbroad,

        await product.save();

        return res.status(200).json({ message: 'Product updated successfully', product });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteProduct = async (req, res) => {
    const { productId } = req.params;
    const vendorId = req.userId

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if(product.vendor.toString() !== vendorId) return res.status(400).json({message: 'You can only delete products created by you'})

        for (let i = 0; i < product.images.length; i++) {
            const publicId = product.images[i].split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId);
        }

        await Product.findByIdAndDelete(productId)

        return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const addReview = async(req, res)=>{
    try {
        const {rating, comment} = req.body
        const {id} = req.params
        const userId = req.userId

        const product = await Product.findById(id)

        if(!product) return res.status(400).json({message: 'Product Not Found'})

        const alreadyReviewed = product.reviews.find(r => r.user.toString() === userId.toString())

        if(alreadyReviewed) return res.status(400).json({message: 'You have already reviewed this product'})
            
        const review = {
            user: userId,
            rating, 
            comment,
        }

        product.reviews.push(review)

        const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0)

        product.averageRating = totalRating / product.reviews.length

        await product.save()
        res.status(201).json({message: 'Review added successfully'})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getProductReviews = async(req, res)=>{
    try {
        const {id} = req.params
        const product = await Product.findById(id).populate('reviews.user', 'firstName lastName')

        if(!product){
            return res.status(400).json({message: 'Product not found'})
        }

        res.status(200).json({reviews: product.reviews})
    } catch (error) {
        res.status(500).json({message: "Internal Server Error"})
    }
}

export const getParentCategories = async(req, res)=>{
    try {
        const categories = await Category.find({isActive: true, parentCategory: null})

        res.status(200).json(categories)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getSubCategories = async(req, res)=>{
  try {
        const { id } = req.params;
        const categories = await Category.find({isActive: true, parentCategory: id})

        res.status(200).json(categories)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getCategory = async(req, res)=>{
    try {
        const {id} = req.params
        const category = await Category.findOne({id, isActive: true})

        if(!category)return res.status(400).json({message: 'Category not found'})

        res.status(200).json(category)
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const getSubCategoriesAndParentCategoryProducts = async (req, res) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const subCategories = await Category.find({ parentCategory: id, isActive: true });
  
      const [products, totalProducts] = await Promise.all([
        Product.find({ category: id, status: 'active' })
          .skip(skip)
          .limit(limit),
        Product.countDocuments({ category: id, status: 'active' })
      ]);
  
      const totalPages = Math.ceil(totalProducts / limit);
  
      res.status(200).json({
        subCategories,
        products,
        pagination: {
          totalProducts,
          totalPages,
          currentPage: page,
          pageSize: limit
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
};
  
export const getCategoryProducts = async (req, res) => {
const { id } = req.params;
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const skip = (page - 1) * limit;

try {
    const [products, totalProducts] = await Promise.all([
    Product.find({ category: id, status: 'active' })
        .skip(skip)
        .limit(limit),
    Product.countDocuments({ category: id, status: 'active' })
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({
    products,
    pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        pageSize: limit
    }
    });
} catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
}
};

export const viewProduct = async (req, res) => {
  try {
    const { productId } = req.params

    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    )

    if (!product) return res.status(404).json({ success: false, message: "Product not found" })

    // Optionally store recent view for the user
    if (req.userId) {
      await User.findByIdAndUpdate(req.userId, {
        $push: {
          recentlyViewed: {
            $each: [productId],
            $position: 0,
            $slice: 10  // keep only the 10 most recent
          }
        }
      })
    }

    res.status(200).json({ success: true, product })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getMostPurchasedProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ purchases: -1 }).limit(10)
    res.status(200).json({ success: true, products })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getMostViewedProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ views: -1 }).limit(10)
    res.status(200).json({ success: true, products })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('recentlyViewed')
    res.status(200).json({ success: true, products: user.recentlyViewed })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getTrendingProductsByParentCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const categories = await Category.find({parentCategory: categoryId})

    // Find products in those subcategories and sort by views (descending)
    const [products, totalProducts] = await Promise.all([
      Product.find({ category: categoryId, status: 'active' })
        .sort({ views: -1 }) // 👈 Trending logic (most viewed first)
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ category: categoryId, status: 'active' }),
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({
      success: true,
      message: "Trending products fetched successfully",
      categories,
      products,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching trending products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
