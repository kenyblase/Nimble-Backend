import Report from "../models/reportModel.js";
import fs from 'fs'
import cloudinary from "../utils/cloudinary.js";
import User from "../models/userModel.js";

export const createReport = async (req, res) => {
  try {
    const { type, reportedUserId, reason, description } = req.body;

    const reportedUser = await User.findById(reportedUserId)

    if (!reportedUser) {
      return res.status(400).json({ message: "User to report not found" });
    }

    const reporter = req.userId;

    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
    
      for (const file of req.files) {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "marketplace/reports",
          resource_type: "image",
        });
  
        uploadedImages.push(uploadRes.secure_url);
  
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
      }
    }

    const newReport = await Report.create({
      reportedUser: reportedUserId,
      reporter,
      type,
      reason,
      description,
      attachments: uploadedImages,
    });

    res.status(201).json({
      message: `User ${type}ed successfully`,
      report: newReport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to report user" });
  }
};
