import { Schema, model, type Types } from "mongoose";

export interface PlanDocument {
  userId: Types.ObjectId;
  name: string;
  programme: "computer-science";
  cohort: "AY2025/26";
  semesters: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    programme: { type: String, enum: ["computer-science"], required: true },
    cohort: { type: String, enum: ["AY2025/26"], required: true },
    semesters: { type: [Schema.Types.Mixed], required: true, default: [] }
  },
  { timestamps: true }
);

export const PlanModel = model<PlanDocument>("Plan", planSchema);
