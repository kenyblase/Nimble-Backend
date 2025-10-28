import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // reviewer
    },
    reviewedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true, // id of product or user being reviewed
      refPath: "reviewedModel",
    },
    reviewedModel: {
      type: String,
      required: true,
      enum: ["Product", "User"], // what type is being reviewed
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    images: [
      {
        type: String, // store image URLs (e.g. Cloudinary URLs)
      },
    ],
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);

export default Review