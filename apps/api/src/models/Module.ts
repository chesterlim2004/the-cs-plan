import { Schema, model } from "mongoose";

export interface ModuleDocument {
  acadYear: string;
  moduleCode: string;
  title: string;
  units: number;
  department?: string;
  faculty?: string;
  description?: string;
  prerequisite?: string;
  prereqTree?: unknown;
  updatedAt: Date;
}

const moduleSchema = new Schema<ModuleDocument>(
  {
    acadYear: { type: String, required: true },
    moduleCode: { type: String, required: true, uppercase: true, index: true },
    title: { type: String, required: true, index: true },
    units: { type: Number, required: true },
    department: { type: String },
    faculty: { type: String },
    description: { type: String },
    prerequisite: { type: String },
    prereqTree: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

moduleSchema.index({ acadYear: 1, moduleCode: 1 }, { unique: true });

export const ModuleModel = model<ModuleDocument>("Module", moduleSchema);
