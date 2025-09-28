import express from "express";
import { verifyToken } from '../middleware/verifyToken.js'
import { getUserChats, markChatAsAppealed, sendMessage, softDeleteChat, startChat } from '../controllers/messageController.js'

const router = express.Router();

router.post("/start-chat", verifyToken, startChat)

router.get("/get-chats", verifyToken, getUserChats)

router.post("/delete-chat", verifyToken, softDeleteChat)

router.post("/send", verifyToken, sendMessage)

router.post("/appeal", verifyToken, markChatAsAppealed)

export default router;