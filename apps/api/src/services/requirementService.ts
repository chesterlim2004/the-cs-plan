import {
  baisRequirementSet,
  businessAnalyticsRequirementSet,
  bzaEconsDdpRequirementSet,
  csRequirementSet
} from "@the-cs-plan/data";
import {
  RequirementSetSchema,
  type Cohort,
  type Programme,
  type RequirementSet
} from "@the-cs-plan/shared";
import { RequirementSetModel } from "../models/RequirementSet.js";
import { HttpError } from "../lib/HttpError.js";

const fallbackRequirementSets = [
  csRequirementSet,
  businessAnalyticsRequirementSet,
  baisRequirementSet,
  bzaEconsDdpRequirementSet
];

export interface RequirementSetCatalogItem {
  programme: Programme;
  cohort: Cohort;
}

export async function listRequirementSets(): Promise<RequirementSetCatalogItem[]> {
  const requirementSets = await RequirementSetModel.aggregate<{
    _id: { programme: Programme; cohort: Cohort };
  }>([
    { $group: { _id: { programme: "$programme", cohort: "$cohort" } } },
    { $sort: { "_id.programme": 1, "_id.cohort": -1 } }
  ]);

  return requirementSets.map(({ _id }) => ({
    programme: _id.programme,
    cohort: _id.cohort
  }));
}

export async function getRequirementSet(
  programme: Programme,
  cohort: Cohort
): Promise<RequirementSet> {
  const requirementSet = await RequirementSetModel.findOne({ programme, cohort })
    .sort({ version: -1 })
    .lean();

  if (!requirementSet) {
    const fallback = fallbackRequirementSets.find(
      (candidate) => candidate.programme === programme && candidate.cohort === cohort
    );
    if (!fallback) {
      throw new HttpError(404, "Curriculum not found");
    }
    return fallback;
  }

  return RequirementSetSchema.parse(requirementSet);
}
