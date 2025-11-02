import Chat from "../models/chatModel.js";
import Message from "../models/messageModel.js";
import Setting from "../models/generalSettingsModel.js";
import Admin from "../models/adminModel.js";

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

    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

    const adminRolesSetting = await Setting.findOne({ key: "admin_roles" });

    if (!adminRolesSetting)
      return res.status(404).json({ success: false, message: "Admin roles setting not found" });

    const rolesWithPermission = adminRolesSetting.value
      .filter((r) => r.permissions.includes("mediate_chat"))
      .map((r) => r.role);

    const mediatingAdmins = await Admin.find({ role: { $in: rolesWithPermission } }, "_id");

    if (!mediatingAdmins.length)
      return res.status(200).json({
        success: true,
        message: "Chat reported, but no mediating admins found.",
        data: chat,
      });

    chat.adminInvolved = [...new Set([...chat.adminInvolved.map(String), ...mediatingAdmins.map(a => a._id.toString())])];

    await chat.save();

    res.json({
      success: true,
      message: "Chat reported and mediating admins assigned.",
      data: chat,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
