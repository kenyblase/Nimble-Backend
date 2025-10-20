import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Admin from "../models/adminModel.js";

export const verifyToken = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized - Invalid Token" });

    let user = null;
    let admin = null;

    if (decoded.isAdmin) {
      admin = await Admin.findById(decoded.userId);
      if (!admin)
        return res
          .status(404)
          .json({ success: false, message: "Admin not found" });

      req.isAdmin = decoded.isAdmin;
      req.role = admin.role;
      req.userId = admin._id;
    } else {
      user = await User.findById(decoded.userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      if (user.status === "suspended") {
        return res.status(403).json({
          success: false,
          message:
            "Your account has been suspended. Please contact support.",
        });
      }

      if (user.status === "banned") {
        return res.status(403).json({
          success: false,
          message:
            "Your account has been banned. Please contact support.",
        });
      }

      req.isAdmin = decoded.isAdmin;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Session expired. Please log in again." });
    }

    console.error("JWT Verification Error:", error);
    return res
      .status(403)
      .json({ success: false, message: "Invalid or malformed token." });
  }
};