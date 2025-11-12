import mongoose from 'mongoose'

const chatSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  lastMessage: String,
  lastMessageSentAt: Date,
  unreadCount: { type: Number, default: 0 },

  isReported: { type: Boolean, default: false },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reportReason: { type: String },
  reportedAt: Date,
  adminInvolved: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }]
}, { timestamps: true });

const Chat = mongoose.model("Chat", chatSchema);

export default Chat