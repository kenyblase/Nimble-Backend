import express from "express";
import { createRequest, getAllRequests } from "../controllers/requestController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import upload from '../utils/multer.js';

const router = express.Router();

router.post("/create", verifyToken, upload.array("images", 5), createRequest);
router.get("/", getAllRequests);

export default router;
