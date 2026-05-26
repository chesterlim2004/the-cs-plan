import { csRequirementSet } from "@the-cs-plan/data";
import {
  RequirementSetSchema,
  type Cohort,
  type Programme,
  type RequirementSet
} from "@the-cs-plan/shared";
import { RequirementSetModel } from "../models/RequirementSet.js";

export async function getRequirementSet(
  programme: Programme,
  cohort: Cohort
): Promise<RequirementSet> {
  const requirementSet = await RequirementSetModel.findOne({ programme, cohort })
    .sort({ version: -1 })
    .lean();

  if (!requirementSet) {
    return csRequirementSet;
  }

  return RequirementSetSchema.parse(requirementSet);
}
