import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: String,
    LastName: String,
    profilePic: String
  },
  type: { 
    type: String, 
    enum: ["text", "offer", "invoice", "payment", "system"], 
    default: "text" 
  },
  text: String,

  isFromAdmin: { type: Boolean, default: false },

  offer: {
    amount: Number,
    status: { type: String, enum: ["sent", "accepted", "declined", "counter"], default: "sent" },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },

  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },

  payment: {
    amount: Number,
    provider: String,
    reference: String
  },

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);

export default Message