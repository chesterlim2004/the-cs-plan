import { Schema, model, type Types } from "mongoose";
import { programmeValues, type Cohort, type Programme } from "@the-cs-plan/shared";

export interface StudentProfileDocument {
  userId: Types.ObjectId;
  programme: Programme;
  cohort: Cohort;
  startingSemester: string;
  currentSemester: string;
  graduationSemester: string;
  primaryPlanId?: Types.ObjectId;
  planOrder: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<StudentProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    programme: {
      type: String,
      enum: programmeValues,
      required: true
    },
    cohort: { type: String, required: true },
    startingSemester: { type: String, required: true, default: "Y1S1" },
    currentSemester: { type: String, required: true, default: "Y1S1" },
    graduationSemester: { type: String, required: true },
    primaryPlanId: { type: Schema.Types.ObjectId, ref: "Plan" },
    planOrder: { type: [{ type: Schema.Types.ObjectId, ref: "Plan" }], default: [] }
  },
  { timestamps: true }
);

export const StudentProfileModel = model<StudentProfileDocument>(
  "StudentProfile",
  studentProfileSchema
);
