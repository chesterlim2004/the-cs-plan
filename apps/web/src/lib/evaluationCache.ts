import { api } from "./api";

export type EvaluationResult = Awaited<ReturnType<typeof api.evaluatePlan>>;

export function getEvaluationCacheKey(planId: string) {
  return `the-cs-plan:evaluation:${planId}`;
}

export function readCachedEvaluation(planId?: string): EvaluationResult | undefined {
  if (!planId) {
    return undefined;
  }

  const cached = window.localStorage.getItem(getEvaluationCacheKey(planId));
  if (!cached) {
    return undefined;
  }

  try {
    return JSON.parse(cached) as EvaluationResult;
  } catch {
    window.localStorage.removeItem(getEvaluationCacheKey(planId));
    return undefined;
  }
}

export function writeCachedEvaluation(planId: string, evaluation: EvaluationResult) {
  window.localStorage.setItem(getEvaluationCacheKey(planId), JSON.stringify(evaluation));
}

export function clearCachedEvaluation(planId: string) {
  window.localStorage.removeItem(getEvaluationCacheKey(planId));
}
