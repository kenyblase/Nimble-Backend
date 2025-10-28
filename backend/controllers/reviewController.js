import Review from "../models/reviewModel.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { updateAverageRating } from '../utils/calculateAverageRating.js'

export const addReview = async (req, res) => {
  try {
    const { reviewedId, reviewedModel, rating, comment, images } = req.body;
    const userId = req.userId;

    if (!reviewedId || !reviewedModel || !rating || !comment) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["Product", "User"].includes(reviewedModel)) {
      return res.status(400).json({ message: "Invalid reviewed model" });
    }

    const existing = await Review.findOne({
      user: userId,
      reviewedId,
      reviewedModel,
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "You have already reviewed this item" });

    const review = await Review.create({
      user: userId,
      reviewedId,
      reviewedModel,
      rating,
      comment,
      images,
    });

    await updateAverageRating(reviewedId, reviewedModel);

    res.status(201).json({
      message: "Review added successfully",
      data: review,
    });
  } catch (error) {
    console.error("Add Review Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({
      reviewedId: productId,
      reviewedModel: "Product",
    })
      .populate("user", "firstName lastName profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Product reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Get Product Reviews Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;

    const reviews = await Review.find({
      reviewedId: userId,
      reviewedModel: "User",
    })
      .populate("user", "firstName lastName profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "User reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Get User Reviews Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findById(id);
    if (!review)
      return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== userId && !req.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Review.findByIdAndDelete(id);

    await updateAverageRating(review.reviewedId, review.reviewedModel);
    
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete Review Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
