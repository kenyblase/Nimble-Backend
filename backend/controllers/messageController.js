import Message from "../models/messageModel.js";
import Chat from "../models/chatModel.js";
import User from "../models/userModel.js";
import Admin from "../models/adminModel.js";
import { io, getReceiverSocketId } from "../utils/socket.js";
import Setting from "../models/generalSettingsModel.js";

export const sendMessage = async (req, res) => {
  try {
    const { chatId, type, text, offer, invoice, payment } = req.body;
    const userId = req.userId;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (chat.buyer !== userId && chat.seller !== userId) {
      return res.status(403).json({ message: "You are not authorized to message this chat" });
    }

    const message = await Message.create({
      chatId,
      sender: {
        _id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic
      },
      type,
      text,
      offer,
      invoice,
      payment,
    });

    chat.lastMessage = text || type;
    await chat.save();

    const receiverId = user._id.toString() === chat.buyer.toString() ? chat.seller.toString() : chat.buyer.toString();
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }

    if (chat.isReported && chat.adminInvolved?.length > 0) {
      chat.adminInvolved.forEach((adminId) => {
        const adminSocketId = getReceiverSocketId(adminId.toString());
        if (adminSocketId) {
          io.to(adminSocketId).emit("newMessage", message);
        }
      });
    }

    return res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const adminSendMessage = async (req, res) => {
  try {
    const { id } = req.params; // chatId
    const { text } = req.body;
    const adminId = req.userId;

    const chat = await Chat.findById(id);
    if (!chat || !chat.isReported) {
      return res.status(400).json({ message: "Chat not reported or not found" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    const adminRolesSetting = await Setting.findOne({ key: "admin_roles" });
    if (!adminRolesSetting) {
      return res.status(404).json({ message: "Admin roles setting not found" });
    }
    
    const roleData = adminRolesSetting.value.find((r) => r.role === admin.role);
    if (!roleData || !roleData.permissions.includes("mediate_chat")) {
      return res.status(403).json({ message: "You do not have permission to mediate chats" });
    }

    const message = await Message.create({
      chatId: id,
      sender: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      type: "text",
      text,
      isFromAdmin: true
    });

    if (!chat.adminInvolved.includes(admin._id)) {
      chat.adminInvolved.push(admin._id);
      await chat.save();
    }

    const participants = [chat.buyer.toString(), chat.seller.toString()];
    participants.forEach((id) => {
      const socketId = getReceiverSocketId(id);
      if (socketId) io.to(socketId).emit("newAdminMessage", message);
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// export const updateOfferStatus = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const { status, amount } = req.body;

//     const message = await Message.findById(messageId);
//     if (!message || message.type !== "offer")
//       return res.status(400).json({ message: "Invalid offer message" });

//     message.offer.status = status;
//     if (status === "counter" && amount) message.offer.amount = amount;
//     await message.save();

//     // Notify both users about the update
//     const chat = await Chat.findById(message.chatId);
//     const participants = [chat.buyer.toString(), chat.seller.toString()];
//     participants.forEach((id) => {
//       const socketId = getReceiverSocketId(id);
//       if (socketId) io.to(socketId).emit("offerUpdated", message);
//     });

//     res.json({ success: true, data: message });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };