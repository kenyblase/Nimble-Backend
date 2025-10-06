import express from "express";
import { createRequest, getAllRequests } from "../controllers/requestController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/", verifyToken, createRequest);
router.get("/", getAllRequests);

export default router;
