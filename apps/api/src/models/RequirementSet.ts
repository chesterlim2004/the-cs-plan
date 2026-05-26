import { Schema, model } from "mongoose";

export interface RequirementSetDocument {
  programme: "computer-science";
  cohort: "AY2025/26";
  version: number;
  sourceNote: string;
  rules: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const requirementSetSchema = new Schema<RequirementSetDocument>(
  {
    programme: { type: String, enum: ["computer-science"], required: true },
    cohort: { type: String, enum: ["AY2025/26"], required: true },
    version: { type: Number, required: true },
    sourceNote: { type: String, required: true },
    rules: { type: [Schema.Types.Mixed], required: true, default: [] }
  },
  { timestamps: true }
);

requirementSetSchema.index({ programme: 1, cohort: 1, version: 1 }, { unique: true });

export const RequirementSetModel = model<RequirementSetDocument>(
  "RequirementSet",
  requirementSetSchema
);
