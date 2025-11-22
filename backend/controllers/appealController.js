import Appeal from "../models/appealModel.js";
import fs from 'fs'
import cloudinary from "../utils/cloudinary.js";

export const createAppeal = async (req, res) => {
  try {
    const { type, seller, order, category, subject, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ message: "Subject and description are required" });
    }

    const userId = req.userId;

    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
    
      for (const file of req.files) {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "marketplace/appeals",
          resource_type: "image",
        });
  
        uploadedImages.push(uploadRes.secure_url);
  
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
      }
    }

    const newAppeal = await Appeal.create({
      user: userId,
      seller,
      order,
      type,
      category,
      subject,
      description,
      attachments: uploadedImages,
    });

    res.status(201).json({
      message: "Appeal submitted successfully",
      appeal: newAppeal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit appeal" });
  }
};
