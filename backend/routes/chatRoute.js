import express from "express";
import {
  getChats,
  getChatById,
  createChat,
  reportChat
} from "../controllers/chatController.js";
import {
  sendMessage,
  getMessages,
  adminSendMessage
} from "../controllers/messageController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

// 🔹 Chats
router.get("/chats", getChats);
router.get("/chats/:id", getChatById);
router.post("/chats", createChat);
router.post("/chats/:id/report", reportChat);

// 🔹 Messages
router.get("/messages/:chatId", getMessages);
router.post("/messages", sendMessage);

// 🔹 Admin Moderation
router.post("/admin/chats/:id/message", adminSendMessage);

export default router;
