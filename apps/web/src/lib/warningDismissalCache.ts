export function getDismissedWarningsCacheKey(planId: string) {
  return `the-cs-plan:dismissed-warnings:${planId}`;
}

export function readDismissedWarningKeys(planId?: string): Set<string> {
  if (!planId) {
    return new Set();
  }

  const cached = window.localStorage.getItem(getDismissedWarningsCacheKey(planId));
  if (!cached) {
    return new Set();
  }

  try {
    const keys = JSON.parse(cached) as unknown;
    return Array.isArray(keys) && keys.every((key) => typeof key === "string")
      ? new Set(keys)
      : new Set();
  } catch {
    window.localStorage.removeItem(getDismissedWarningsCacheKey(planId));
    return new Set();
  }
}

export function writeDismissedWarningKeys(planId: string, keys: Set<string>) {
  window.localStorage.setItem(getDismissedWarningsCacheKey(planId), JSON.stringify(Array.from(keys)));
}

export function clearDismissedWarningKeys(planId: string) {
  window.localStorage.removeItem(getDismissedWarningsCacheKey(planId));
}
