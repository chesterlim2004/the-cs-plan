import { programmeValues, type Cohort, type Programme } from "@the-cs-plan/shared";
import { Schema, model } from "mongoose";

export interface RequirementSetDocument {
  programme: Programme;
  cohort: Cohort;
  version: number;
  totalUnits: number;
  sourceNote: string;
  redirectLink?: string;
  rules: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const requirementSetSchema = new Schema<RequirementSetDocument>(
  {
    programme: {
      type: String,
      enum: programmeValues,
      required: true
    },
    cohort: { type: String, required: true },
    version: { type: Number, required: true },
    totalUnits: { type: Number, required: true },
    sourceNote: { type: String, required: true },
    redirectLink: { type: String },
    rules: { type: [Schema.Types.Mixed], required: true, default: [] }
  },
  { timestamps: true }
);

requirementSetSchema.index({ programme: 1, cohort: 1, version: 1 }, { unique: true });

export const RequirementSetModel = model<RequirementSetDocument>(
  "RequirementSet",
  requirementSetSchema
);
