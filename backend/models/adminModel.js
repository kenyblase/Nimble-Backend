import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  firstName: { type: String, required: true,},
  lastName: { type: String, required: true,},
  email: { type: String, unique: true, required: true, lowercase: true },
  phone: { type: String, required: true, },
  role: { type: String, required: true, enum: ['Admin', 'Moderator', 'Editor'] },
  permissions: { type: [String], lowercase: true, enum: ['mediate', 'messages', 'listing-view', 'listing-approval', 'transactions', 'payout'], default: [] },
  password: { type: String, required: true, },
  avatar: String,
}, {timestamps: true});

const Admin = mongoose.model("Admin", adminSchema);

export default Admin