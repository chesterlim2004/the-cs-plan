import { Schema, model, type Types } from "mongoose";
import { programmeValues, type Cohort, type Programme } from "@the-cs-plan/shared";

export interface PlanDocument {
  userId: Types.ObjectId;
  name: string;
  programme: Programme;
  cohort: Cohort;
  semesters: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    programme: {
      type: String,
      enum: programmeValues,
      required: true
    },
    cohort: { type: String, required: true },
    semesters: { type: [Schema.Types.Mixed], required: true, default: [] }
  },
  { timestamps: true }
);

export const PlanModel = model<PlanDocument>("Plan", planSchema);
