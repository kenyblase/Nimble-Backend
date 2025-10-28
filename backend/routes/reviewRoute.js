import { Router } from "express";
import {
  addReview,
  getProductReviews,
  getUserReviews,
  deleteReview,
} from "../controllers/reviewController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

router.post("/", verifyToken, addReview);
router.get("/product/:productId", getProductReviews);
router.get("/user/:userId", getUserReviews);
router.delete("/:id", verifyToken, deleteReview);

export default router;