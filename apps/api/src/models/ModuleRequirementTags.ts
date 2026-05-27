import { Schema, model } from "mongoose";
import type { Cohort, Programme } from "@the-cs-plan/shared";

export interface ModuleRequirementTagsDocument {
  programme: Programme;
  cohort: Cohort;
  moduleCode: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const moduleRequirementTagsSchema = new Schema<ModuleRequirementTagsDocument>(
  {
    programme: {
      type: String,
      enum: ["computer-science", "business-analytics"],
      required: true
    },
    cohort: { type: String, enum: ["AY2025/26"], required: true },
    moduleCode: { type: String, required: true, uppercase: true, index: true },
    tags: { type: [String], required: true, default: [] }
  },
  { timestamps: true }
);

moduleRequirementTagsSchema.index(
  { programme: 1, cohort: 1, moduleCode: 1 },
  { unique: true }
);

export const ModuleRequirementTagsModel = model<ModuleRequirementTagsDocument>(
  "ModuleRequirementTags",
  moduleRequirementTagsSchema
);
