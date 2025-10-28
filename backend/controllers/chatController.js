import Chat from "../models/chatModel.js";
import Message from "../models/messageModel.js";

// ✅ Get all chats for logged-in user
export const getChats = async (req, res) => {
  try {
    const userId = req.userId;

    const chats = await Chat.find({
      $or: [{ buyer: userId }, { seller: userId }, { adminInvolved: userId }]
    })
      .populate("buyer seller product")
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: chats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get single chat + messages
export const getChatById = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await Chat.findById(id).populate("buyer seller product");
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const messages = await Message.find({ chatId: id }).sort({ createdAt: 1 });

    res.json({ success: true, data: { chat, messages } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Create or fetch chat between buyer and seller
export const createChat = async (req, res) => {
  try {
    const { buyer, seller, product } = req.body;

    let chat = await Chat.findOne({ buyer, seller, product });
    if (!chat) chat = await Chat.create({ buyer, seller, product });

    res.status(201).json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Report a chat
export const reportChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    const chat = await Chat.findByIdAndUpdate(
      id,
      {
        isReported: true,
        reportedBy: userId,
        reportReason: reason,
        reportedAt: new Date()
      },
      { new: true }
    );

    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
