import express from 'express';
import { createProduct, getAllProducts, getProductsByVendor, getProductById, updateProduct, deleteProduct, addReview, getProductReviews, getParentCategories, getSubCategoriesAndParentCategoryProducts, getSubCategoryProducts, getParentCategory, getSubCategories, viewProduct, getMostPurchasedProducts, getMostViewedProducts, getRecentlyViewed, getTrendingProductsByParentCategory, getCategories } from '../controllers/productController.js';
import { verifyToken } from '../middleware/verifyToken.js'

const router = express.Router();

router.post('/create-product', verifyToken, createProduct);

router.get('/get-products', getAllProducts);

router.get('/vendor/:vendorId/products', getProductsByVendor);

router.get('/get-product/:productId', getProductById);

router.put('/update-product/:productId', verifyToken, updateProduct);

router.delete('/delete-product/:productId', verifyToken, deleteProduct);

router.post('/:id/reviews', verifyToken, addReview)

router.get('/:id/reviews', verifyToken, getProductReviews)

router.get('/categories', getCategories)

router.get('/categories/:id', verifyToken, getParentCategory)

router.get('/category/:parentCategoryId', verifyToken, getSubCategoriesAndParentCategoryProducts)

router.get('/subcategories/:subCategoryId', verifyToken, getSubCategoryProducts)

router.get('/subcategories', verifyToken, getSubCategories)

router.put('/view', viewProduct)

router.get('/most-purchased', getMostPurchasedProducts)

router.get('/most-viewed', getMostViewedProducts)

router.get('/recently-viewed', verifyToken, getRecentlyViewed)

router.get("/trending/:categoryId", getTrendingProductsByParentCategory);

export default router;