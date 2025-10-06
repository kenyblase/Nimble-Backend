import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    productImages: {
      type: [String], // array of image URLs
      default: [],
    },
    videoLink: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      city: { type: String, required: true },
      state: { type: String, required: true },
    },
    condition: {
      type: String,
      enum: ["new", "like new", "used"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
        type: String,
        default: 'pending'
    },
    isNegotiable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Request = mongoose.model("Request", requestSchema);

export default Request