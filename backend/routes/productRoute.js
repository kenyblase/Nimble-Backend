import express from 'express';
import { createProduct, getAllProducts, getProductsByVendor, getProductById, updateProduct, deleteProduct, addReview, getProductReviews, getSubCategoriesAndParentCategoryProducts, getSubCategories, viewProduct, getMostPurchasedProducts, getMostViewedProducts, getRecentlyViewed, getTrendingProductsByParentCategory, getCategoryProducts, getCategory, getParentCategories } from '../controllers/productController.js';
import { verifyToken } from '../middleware/verifyToken.js'
import upload from '../utils/multer.js';

const router = express.Router();

router.post('/create', verifyToken, upload.array("images", 5), createProduct);

router.get('/', getAllProducts);

router.get('/vendor/:vendorId/products', getProductsByVendor);

router.put('/:productId/update', verifyToken, updateProduct);

router.delete('/:productId/delete', verifyToken, deleteProduct);

router.post('/:id/reviews', verifyToken, addReview)

router.get('/:id/reviews', verifyToken, getProductReviews)

router.get('/categories', getParentCategories)

router.get('/categories/:id', getCategory)

router.get('/category/sub/:id', verifyToken, getSubCategoriesAndParentCategoryProducts)

router.get('/category/products/:id', verifyToken, getCategoryProducts)

router.get('/subcategories/:id', verifyToken, getSubCategories)

router.put('/view', viewProduct)

router.get('/most-purchased', getMostPurchasedProducts)

router.get('/most-viewed', getMostViewedProducts)

router.get('/recently-viewed', verifyToken, getRecentlyViewed)

router.get("/trending/:categoryId", getTrendingProductsByParentCategory);

router.get('/:productId', getProductById);

export default router;