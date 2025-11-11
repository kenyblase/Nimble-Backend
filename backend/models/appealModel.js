import mongoose from "mongoose";

const appealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    type: {
      type: String,
      required: true,
      enum: ['appeal', 'support-request'],
      default: 'appeal'
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["new", "open", "closed", "resolved"],
      default: "new",
    },
    attachments: [
      {
        url: String,
        public_id: String,
      },
    ],
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    resolutionNote: {
      type: String,
    },
  },
  { timestamps: true }
);

const Appeal = mongoose.model("Appeal", appealSchema);

export default Appeal
