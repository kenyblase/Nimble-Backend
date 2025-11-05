import express from "express";
import { createAppeal } from "../controllers/appealController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/", verifyToken, createAppeal);

export default router;