import { Schema, model } from "mongoose";

export interface UserDocument {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ["student", "admin"], default: "student" }
  },
  { timestamps: true }
);

export const UserModel = model<UserDocument>("User", userSchema);
