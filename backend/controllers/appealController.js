import Appeal from "../models/appealModel.js";

export const createAppeal = async (req, res) => {
  try {
    const { type, category, subject, description, attachments } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ message: "Subject and description are required" });
    }

    const userId = req.userId;

    const newAppeal = await Appeal.create({
      user: userId,
      type,
      category,
      subject,
      description,
      attachments: attachments || [],
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
