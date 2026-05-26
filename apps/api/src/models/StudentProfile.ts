import { Schema, model, type Types } from "mongoose";

export interface StudentProfileDocument {
  userId: Types.ObjectId;
  programme: "computer-science";
  cohort: "AY2025/26";
  graduationSemester: string;
  primaryPlanId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<StudentProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    programme: { type: String, enum: ["computer-science"], required: true },
    cohort: { type: String, enum: ["AY2025/26"], required: true },
    graduationSemester: { type: String, required: true },
    primaryPlanId: { type: Schema.Types.ObjectId, ref: "Plan" }
  },
  { timestamps: true }
);

export const StudentProfileModel = model<StudentProfileDocument>(
  "StudentProfile",
  studentProfileSchema
);
