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
router.get("/", getChats);
router.get("/:id", getChatById);
router.post("/", createChat);
router.post("/:id/report", reportChat);

// 🔹 Messages
router.get("/messages/:chatId", getMessages);
router.post("/messages", sendMessage);

// 🔹 Admin Moderation
router.post("/admin/:id/message", adminSendMessage);

export default router;
