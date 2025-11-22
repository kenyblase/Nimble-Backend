import express from "express";
import { createReport } from "../controllers/reportController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import upload from "../utils/multer.js";

const router = express.Router();

router.post("/", verifyToken, upload.array("images", 5), createReport);

export default router;