import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, GripVertical, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import type { Module, Plan, PlanExport, SemesterKey } from "@the-cs-plan/shared";
import { createSemestersForRange, semesterLabels } from "@the-cs-plan/shared";
import { api } from "../lib/api";
import { Button, Card, GhostButton, Input, Select } from "../components/ui";
import { cn } from "../lib/utils";

type EvaluationResult = Awaited<ReturnType<typeof api.evaluatePlan>>;

const placeholders = [
  { requirementId: "id", label: "ID placeholder", units: 4 },
  { requirementId: "cd", label: "CD placeholder", units: 4 },
  { requirementId: "ue", label: "UE placeholder", units: 4 },
  { requirementId: "cs-foundation", label: "CS Foundation placeholder", units: 4 }
];

const dragDataType = "application/x-the-cs-plan-item";
const planDragDataType = "application/x-the-cs-plan-plan";
const planExportPayloadPrefix = "tcp1_";

type DraggedItem = {
  semesterKey: SemesterKey;
  itemIndex: number;
};

type DropTarget = {
  semesterKey: SemesterKey;
  itemIndex: number;
};

function getEvaluationCacheKey(planId: string) {
  return `the-cs-plan:evaluation:${planId}`;
}

function getDismissedWarningsCacheKey(planId: string) {
  return `the-cs-plan:dismissed-warnings:${planId}`;
}

function readCachedEvaluation(planId?: string): EvaluationResult | undefined {
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

function writeCachedEvaluation(planId: string, evaluation: EvaluationResult) {
  window.localStorage.setItem(getEvaluationCacheKey(planId), JSON.stringify(evaluation));
}

function readDismissedWarningKeys(planId?: string): Set<string> {
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

function writeDismissedWarningKeys(planId: string, keys: Set<string>) {
  window.localStorage.setItem(getDismissedWarningsCacheKey(planId), JSON.stringify(Array.from(keys)));
}

function clearDismissedWarningKeys(planId: string) {
  window.localStorage.removeItem(getDismissedWarningsCacheKey(planId));
}

async function fetchAndCacheEvaluation(planId: string) {
  const evaluation = await api.evaluatePlan(planId);
  writeCachedEvaluation(planId, evaluation);
  return evaluation;
}

function getOrderedPlans(plans: Plan[], planOrder: string[] | undefined) {
  const orderIndex = new Map((planOrder ?? []).map((planId, index) => [planId, index]));
  return [...plans].sort((first, second) => {
    const firstIndex = first.id ? orderIndex.get(first.id) : undefined;
    const secondIndex = second.id ? orderIndex.get(second.id) : undefined;

    if (firstIndex !== undefined && secondIndex !== undefined) {
      return firstIndex - secondIndex;
    }

    if (firstIndex !== undefined) {
      return -1;
    }

    if (secondIndex !== undefined) {
      return 1;
    }

    return 0;
  });
}

function getPlanOrderIds(plans: Plan[]) {
  return plans.flatMap((plan) => (plan.id ? [plan.id] : []));
}

function encodePlanExportPayload(planExport: PlanExport) {
  const bytes = new TextEncoder().encode(JSON.stringify(planExport));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `${planExportPayloadPrefix}${btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "")}`;
}

function decodePlanExportPayload(payload: string): PlanExport {
  if (!payload.startsWith(planExportPayloadPrefix)) {
    throw new Error("Import payload must start with tcp1_.");
  }

  const encoded = payload.slice(planExportPayloadPrefix.length);
  const padded = `${encoded}${"=".repeat((4 - (encoded.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PlanExport;
}

function parsePlanImportInput(input: string): PlanExport | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const payloadFromUrl = extractImportPayloadFromUrl(trimmedInput);
  if (payloadFromUrl) {
    return decodePlanExportPayload(payloadFromUrl);
  }

  if (trimmedInput.startsWith(planExportPayloadPrefix)) {
    return decodePlanExportPayload(trimmedInput);
  }

  if (trimmedInput.startsWith("{")) {
    return JSON.parse(trimmedInput) as PlanExport;
  }

  return null;
}

function extractImportPayloadFromUrl(input: string): string | null {
  try {
    const url = new URL(input);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    return new URLSearchParams(hash).get("importPlan");
  } catch {
    if (!input.startsWith("#")) {
      return null;
    }

    return new URLSearchParams(input.slice(1)).get("importPlan");
  }
}

export function PlannerPage() {
  const queryClient = useQueryClient();
  const [expandedSemester, setExpandedSemester] = useState<SemesterKey | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPlaceholder, setSelectedPlaceholder] = useState("");
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isWarningPanelOpen, setIsWarningPanelOpen] = useState(false);
  const [isPlanMenuOpen, setIsPlanMenuOpen] = useState(false);
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isExportPlanOpen, setIsExportPlanOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanImportContent, setNewPlanImportContent] = useState("");
  const [addPlanError, setAddPlanError] = useState("");
  const [exportShareLink, setExportShareLink] = useState("");
  const [exportRawPayload, setExportRawPayload] = useState("");
  const [exportPlanError, setExportPlanError] = useState("");
  const [copiedExportValue, setCopiedExportValue] = useState<"link" | "payload" | null>(null);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [planPendingDeletion, setPlanPendingDeletion] = useState<Plan | null>(null);
  const warningPanelRef = useRef<HTMLDivElement | null>(null);
  const planMenuRef = useRef<HTMLDivElement | null>(null);
  const addPlanRef = useRef<HTMLDivElement | null>(null);
  const exportPlanRef = useRef<HTMLDivElement | null>(null);
  const semesterScrollerRef = useRef<HTMLDivElement | null>(null);
  const scrolledPlanKeyRef = useRef<string | null>(null);
  const renamePlanTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const submittedPlanNamesRef = useRef<Map<string, string>>(new Map());
  const [dismissedWarningKeys, setDismissedWarningKeys] = useState<Set<string>>(() => new Set());
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: api.listPlans });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const plans = plansQuery.data ?? [];
  const orderedPlans = useMemo(
    () => getOrderedPlans(plans, profileQuery.data?.planOrder),
    [plans, profileQuery.data?.planOrder]
  );
  const plan = orderedPlans.find((candidate) => candidate.id === profileQuery.data?.primaryPlanId) ?? orderedPlans[0];
  const modulesQuery = useQuery({
    queryKey: ["modules", search],
    queryFn: () => api.searchModules(search),
    enabled: search.length > 0
  });
  const plannedModuleCodes = useMemo(() => {
    const codes =
      plan?.semesters.flatMap((semester) =>
        semester.items.flatMap((item) => (item.type === "module" ? [item.moduleCode] : []))
      ) ?? [];
    return Array.from(new Set(codes));
  }, [plan]);
  const plannedModuleQueries = useQueries({
    queries: plannedModuleCodes.map((moduleCode) => ({
      queryKey: ["module", moduleCode],
      queryFn: () => api.getModule(moduleCode).catch(() => null),
      staleTime: 5 * 60 * 1000
    }))
  });
  const moduleByCode = useMemo(() => {
    const entries = plannedModuleQueries
      .map((query) => query.data)
      .filter((module): module is Module => Boolean(module))
      .map((module) => [module.moduleCode, module] as const);
    return new Map(entries);
  }, [plannedModuleQueries]);
  const evaluationQuery = useQuery({
    queryKey: ["evaluation", plan?.id],
    queryFn: async () => {
      const planId = plan!.id!;
      return fetchAndCacheEvaluation(planId);
    },
    enabled: false,
    initialData: () => readCachedEvaluation(plan?.id),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  });
  const requirementsQuery = useQuery({
    queryKey: ["requirements", plan?.programme, plan?.cohort],
    queryFn: () => api.getRequirements(plan!.programme, plan!.cohort),
    enabled: Boolean(plan)
  });
  const moduleRequirementTagsQuery = useQuery({
    queryKey: ["module-requirement-tags", plan?.programme, plan?.cohort],
    queryFn: () => api.getModuleRequirementTags(plan!.programme, plan!.cohort),
    enabled: Boolean(plan)
  });
  const requirementTagsByModuleCode = useMemo(() => {
    const entries =
      moduleRequirementTagsQuery.data?.map((mapping) => [mapping.moduleCode, mapping.tags] as const) ?? [];
    return new Map(entries);
  }, [moduleRequirementTagsQuery.data]);


  useEffect(() => {
    if (!isWarningPanelOpen && !isPlanMenuOpen && !isAddPlanOpen && !isExportPlanOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!warningPanelRef.current?.contains(event.target as Node)) {
        setIsWarningPanelOpen(false);
      }
      if (!planMenuRef.current?.contains(event.target as Node)) {
        setIsPlanMenuOpen(false);
      }
      if (!addPlanRef.current?.contains(event.target as Node)) {
        setIsAddPlanOpen(false);
      }
      if (!exportPlanRef.current?.contains(event.target as Node)) {
        setIsExportPlanOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [isAddPlanOpen, isExportPlanOpen, isPlanMenuOpen, isWarningPanelOpen]);

  useEffect(() => {
    return () => {
      for (const timer of renamePlanTimersRef.current.values()) {
        clearTimeout(timer);
      }
      renamePlanTimersRef.current.clear();
    };
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ plan }: { plan: Plan; refreshWarnings: boolean }) => api.updatePlan(plan),
    onSuccess: async (updatedPlan, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      if (updatedPlan.id && variables.refreshWarnings) {
        clearDismissedWarningKeys(updatedPlan.id);
        setDismissedWarningKeys(new Set());
        await evaluateAndCachePlan(updatedPlan.id);
      }
    }
  });

  const primaryPlanMutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(["profile"], profile);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["evaluation"] });
    }
  });

  const renamePlanMutation = useMutation({
    mutationFn: api.updatePlan,
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData<Plan[]>(["plans"], (currentPlans) =>
        currentPlans?.map((candidate) => (candidate.id === updatedPlan.id ? updatedPlan : candidate))
      );
    }
  });

  const createPlanMutation = useMutation({
    mutationFn: async (name: string) => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error("Profile is required before creating a plan.");
      }

      const createdPlan = await api.createPlan({
        name,
        programme: profile.programme,
        cohort: profile.cohort,
        semesters: createSemestersForRange(profile.startingSemester, profile.graduationSemester)
      });

      const createdPlanId = createdPlan.id;
      if (!createdPlanId) {
        throw new Error("Created plan did not include an id.");
      }

      const planOrder = [
        ...getPlanOrderIds(orderedPlans).filter((planId) => planId !== createdPlanId),
        createdPlanId
      ];
      const profileUpdate = await api.saveProfile({
        ...profile,
        primaryPlanId: createdPlanId,
        planOrder
      });

      return { createdPlan, profile: profileUpdate };
    },
    onSuccess: async ({ createdPlan, profile }) => {
      queryClient.setQueryData<Plan[]>(["plans"], (currentPlans) => [...(currentPlans ?? []), createdPlan]);
      queryClient.setQueryData(["profile"], profile);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setNewPlanName("");
      setIsAddPlanOpen(false);
      setIsPlanMenuOpen(false);
    }
  });

  const importPlanMutation = useMutation({
    mutationFn: async ({ planExport, name }: { planExport: PlanExport; name?: string }) => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error("Profile is required before importing a plan.");
      }

      const importedPlan = await api.importPlan(planExport);
      const importedPlanId = importedPlan.id;
      if (!importedPlanId) {
        throw new Error("Imported plan did not include an id.");
      }

      const finalImportedPlan = name
        ? await api.updatePlan({ ...importedPlan, name })
        : importedPlan;

      const planOrder = [
        ...getPlanOrderIds(orderedPlans).filter((planId) => planId !== importedPlanId),
        importedPlanId
      ];
      const profileUpdate = await api.saveProfile({
        ...profile,
        primaryPlanId: importedPlanId,
        planOrder
      });

      return { importedPlan: finalImportedPlan, profile: profileUpdate };
    },
    onSuccess: async ({ importedPlan, profile }) => {
      queryClient.setQueryData<Plan[]>(["plans"], (currentPlans) => [...(currentPlans ?? []), importedPlan]);
      queryClient.setQueryData(["profile"], profile);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setNewPlanName("");
      setNewPlanImportContent("");
      setAddPlanError("");
      setIsAddPlanOpen(false);
      setIsPlanMenuOpen(false);
    },
    onError: (error) => {
      setAddPlanError(error instanceof Error ? error.message : "Could not import this plan.");
    }
  });

  const exportPlanMutation = useMutation({
    mutationFn: async (activePlan: Plan) => {
      if (!activePlan.id) {
        throw new Error("Plan id is required before exporting.");
      }

      const planExport = await api.exportPlan(activePlan.id);
      const payload = encodePlanExportPayload(planExport);
      return {
        payload,
        link: `${window.location.origin}/planner#importPlan=${payload}`
      };
    },
    onSuccess: ({ link, payload }) => {
      setExportShareLink(link);
      setExportRawPayload(payload);
      setExportPlanError("");
      setCopiedExportValue(null);
    },
    onError: (error) => {
      setExportPlanError(error instanceof Error ? error.message : "Could not export this plan.");
    }
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planToDelete: Plan) => {
      const planId = planToDelete.id;
      const profile = profileQuery.data;
      if (!planId || !profile) {
        throw new Error("Plan and profile are required before deleting a plan.");
      }

      const remainingPlans = orderedPlans.filter((candidate) => candidate.id !== planId);
      if (remainingPlans.length === 0) {
        throw new Error("At least one plan is required.");
      }

      await api.deletePlan(planId);

      const nextPrimaryPlanId =
        profile.primaryPlanId === planId ? remainingPlans[0]?.id : profile.primaryPlanId;
      const updatedProfile = await api.saveProfile({
        ...profile,
        primaryPlanId: nextPrimaryPlanId,
        planOrder: getPlanOrderIds(remainingPlans)
      });

      return { deletedPlanId: planId, profile: updatedProfile };
    },
    onSuccess: async ({ deletedPlanId, profile }) => {
      queryClient.setQueryData<Plan[]>(["plans"], (currentPlans) =>
        currentPlans?.filter((candidate) => candidate.id !== deletedPlanId)
      );
      queryClient.setQueryData(["profile"], profile);
      queryClient.removeQueries({ queryKey: ["evaluation", deletedPlanId], exact: true });
      window.localStorage.removeItem(getEvaluationCacheKey(deletedPlanId));
      window.localStorage.removeItem(getDismissedWarningsCacheKey(deletedPlanId));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setPlanPendingDeletion(null);
    }
  });

  const totalUnits = useMemo(
    () =>
      plan?.semesters.reduce(
        (sum, semester) => sum + semester.items.reduce((itemSum, item) => itemSum + item.units, 0),
        0
      ) ?? 0,
    [plan]
  );
  const currentSemester = profileQuery.data?.currentSemester ?? profileQuery.data?.startingSemester;

  useEffect(() => {
    setDismissedWarningKeys(readDismissedWarningKeys(plan?.id));
  }, [plan?.id]);

  useEffect(() => {
    if (!plan?.id || !currentSemester) {
      return;
    }

    const scrollKey = `${plan.id}:${currentSemester}`;
    if (scrolledPlanKeyRef.current === scrollKey) {
      return;
    }

    scrolledPlanKeyRef.current = scrollKey;
    window.requestAnimationFrame(() => {
      const scroller = semesterScrollerRef.current;
      const currentSemesterCard = scroller?.querySelector<HTMLElement>(
        `[data-semester-key="${currentSemester}"]`
      );
      if (!scroller || !currentSemesterCard) {
        return;
      }

      const targetLeft = currentSemesterCard.offsetLeft - scroller.clientWidth * 0.52;
      scroller.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth"
      });
    });
  }, [currentSemester, plan?.id]);

  const advisoryWarnings = useMemo(() => {
    const warnings = evaluationQuery.data?.warnings ?? [];
    if (!plan) {
      return warnings.map((warning, index) => ({ key: `${warning}:${index}`, warning }));
    }

    const moduleOccurrences = new Map<string, string[]>();
    for (const semester of plan.semesters) {
      semester.items.forEach((item, index) => {
        if (item.type !== "module") {
          return;
        }

        const occurrenceKey = item.id ?? `${semester.key}-${index}`;
        moduleOccurrences.set(item.moduleCode, [
          ...(moduleOccurrences.get(item.moduleCode) ?? []),
          occurrenceKey
        ]);
      });
    }

    const warningCountsByModule = new Map<string, number>();
    return warnings.map((warning, index) => {
      const moduleCode = warning.match(/^([A-Z]{2,3}\d{4}[A-Z]?):/)?.[1] ?? warning.match(/Unknown module ([A-Z]{2,3}\d{4}[A-Z]?)/)?.[1];
      if (!moduleCode) {
        return { key: `${warning}:${index}`, warning };
      }

      const occurrenceIndex = warningCountsByModule.get(moduleCode) ?? 0;
      warningCountsByModule.set(moduleCode, occurrenceIndex + 1);

      const occurrenceKey = moduleOccurrences.get(moduleCode)?.[occurrenceIndex] ?? `${moduleCode}-${occurrenceIndex}`;
      return { key: `${warning}:${occurrenceKey}`, warning };
    });
  }, [evaluationQuery.data?.warnings, plan]);

  const visibleAdvisoryWarnings = advisoryWarnings.filter(
    ({ key }) => !dismissedWarningKeys.has(key)
  );
  const visibleWarningKeys = useMemo(
    () => new Set(visibleAdvisoryWarnings.map(({ key }) => key)),
    [visibleAdvisoryWarnings]
  );

  if (plansQuery.isLoading || profileQuery.isLoading) {
    return <div className="p-6 text-sm text-muted">Loading planner...</div>;
  }

  if (!plan) {
    return <div className="p-6 text-sm text-muted">No plan found. Revisit onboarding to create one.</div>;
  }

  async function evaluateAndCachePlan(planId: string) {
    await queryClient.invalidateQueries({ queryKey: ["evaluation", planId], exact: true });
    const evaluation = await queryClient.fetchQuery({
      queryKey: ["evaluation", planId],
      queryFn: () => fetchAndCacheEvaluation(planId),
      staleTime: 0
    });
    return evaluation;
  }

  function updatePlan(mutator: (draft: Plan) => void, options: { refreshWarnings?: boolean } = {}) {
    const draft = structuredClone(plan!);
    mutator(draft);
    updateMutation.mutate({ plan: draft, refreshWarnings: options.refreshWarnings ?? true });
  }

  function openAddPanel(semesterKey: SemesterKey) {
    setExpandedSemester(semesterKey);
    setSearch("");
    setSelectedPlaceholder("");
  }

  function closeAddPanel() {
    setExpandedSemester(null);
    setSearch("");
    setSelectedPlaceholder("");
  }

  function addModule(module: Module, semesterKey: SemesterKey) {
    updatePlan((draft) => {
      const semester = draft.semesters.find((candidate) => candidate.key === semesterKey);
      semester?.items.push({
        id: crypto.randomUUID(),
        type: "module",
        moduleCode: module.moduleCode,
        units: module.units,
        status: semesterKey.startsWith("Y1") ? "completed" : "planned",
        isSu: false
      });
    });
    closeAddPanel();
  }

  function addPlaceholder(requirementId: string, semesterKey: SemesterKey) {
    const placeholder = placeholders.find((candidate) => candidate.requirementId === requirementId);
    if (!placeholder) {
      return;
    }
    updatePlan((draft) => {
      const semester = draft.semesters.find((candidate) => candidate.key === semesterKey);
      semester?.items.push({ id: crypto.randomUUID(), type: "placeholder", ...placeholder, isSu: false });
    }, { refreshWarnings: false });
    closeAddPanel();
  }

  function removeItem(semesterKey: SemesterKey, itemIndex: number) {
    updatePlan((draft) => {
      const semester = draft.semesters.find((candidate) => candidate.key === semesterKey);
      if (semester) {
        semester.items = semester.items.filter((_candidate, index) => index !== itemIndex);
      }
    });
  }

  function getDraggedItemFromEvent(event: DragEvent): DraggedItem | null {
    if (draggedItem) {
      return draggedItem;
    }

    const payload = event.dataTransfer.getData(dragDataType) || event.dataTransfer.getData("text/plain");
    const [semesterKey, rawItemIndex] = payload.split(":");
    const itemIndex = Number(rawItemIndex);
    const isKnownSemester = plan!.semesters.some((semester) => semester.key === semesterKey);

    if (!isKnownSemester || !Number.isInteger(itemIndex) || itemIndex < 0) {
      return null;
    }

    return { semesterKey: semesterKey as SemesterKey, itemIndex };
  }

  function moveItem(source: DraggedItem, targetSemesterKey: SemesterKey, targetItemIndex: number) {
    updatePlan((draft) => {
      const sourceSemester = draft.semesters.find((semester) => semester.key === source.semesterKey);
      const targetSemester = draft.semesters.find((semester) => semester.key === targetSemesterKey);
      if (!sourceSemester || !targetSemester) {
        return;
      }

      const [item] = sourceSemester.items.splice(source.itemIndex, 1);
      if (!item) {
        return;
      }

      const adjustedTargetIndex =
        source.semesterKey === targetSemesterKey && source.itemIndex < targetItemIndex
          ? targetItemIndex - 1
          : targetItemIndex;
      const clampedTargetIndex = Math.max(0, Math.min(adjustedTargetIndex, targetSemester.items.length));
      targetSemester.items.splice(clampedTargetIndex, 0, item);
    });
  }

  function getItemDropIndex(event: DragEvent<HTMLElement>, itemIndex: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? itemIndex : itemIndex + 1;
  }

  function handleDragStart(event: DragEvent<HTMLElement>, semesterKey: SemesterKey, itemIndex: number) {
    const source = { semesterKey, itemIndex };
    setDraggedItem(source);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(dragDataType, `${semesterKey}:${itemIndex}`);
    event.dataTransfer.setData("text/plain", `${semesterKey}:${itemIndex}`);
  }

  function handleInsertionDragOver(event: DragEvent<HTMLElement>, semesterKey: SemesterKey, itemIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTarget({ semesterKey, itemIndex });
  }

  function handleItemDragOver(event: DragEvent<HTMLElement>, semesterKey: SemesterKey, itemIndex: number) {
    handleInsertionDragOver(event, semesterKey, getItemDropIndex(event, itemIndex));
  }

  function handleDrop(event: DragEvent<HTMLElement>, semesterKey: SemesterKey, itemIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    const source = getDraggedItemFromEvent(event);
    if (!source) {
      endDrag();
      return;
    }

    moveItem(source, semesterKey, itemIndex);
    endDrag();
  }

  function handleItemDrop(event: DragEvent<HTMLElement>, semesterKey: SemesterKey, itemIndex: number) {
    handleDrop(event, semesterKey, getItemDropIndex(event, itemIndex));
  }

  function endDrag() {
    setDraggedItem(null);
    setDropTarget(null);
  }

  function isActiveDropTarget(semesterKey: SemesterKey, itemIndex: number) {
    return dropTarget?.semesterKey === semesterKey && dropTarget.itemIndex === itemIndex;
  }

  function getModuleOccurrenceKey(semesterKey: SemesterKey, itemIndex: number, itemId?: string) {
    return itemId ?? `${semesterKey}-${itemIndex}`;
  }

  function hasVisibleWarning(semesterKey: SemesterKey, itemIndex: number, itemId?: string) {
    const occurrenceKey = getModuleOccurrenceKey(semesterKey, itemIndex, itemId);
    return Array.from(visibleWarningKeys).some((warningKey) => warningKey.endsWith(`:${occurrenceKey}`));
  }

  function dismissWarning(key: string) {
    const planId = plan?.id;
    setDismissedWarningKeys((current) => {
      const next = new Set(current).add(key);
      if (planId) {
        writeDismissedWarningKeys(planId, next);
      }
      return next;
    });
  }

  function selectPrimaryPlan(planId: string) {
    if (!planId || !profileQuery.data || profileQuery.data.primaryPlanId === planId) {
      return;
    }

    setIsPlanMenuOpen(false);
    primaryPlanMutation.mutate({ ...profileQuery.data, primaryPlanId: planId });
  }

  function savePlanOrder(nextPlans: Plan[]) {
    const profile = profileQuery.data;
    if (!profile) {
      return;
    }

    primaryPlanMutation.mutate({
      ...profile,
      planOrder: getPlanOrderIds(nextPlans)
    });
  }

  function renamePlan(targetPlan: Plan, name: string) {
    const trimmedName = name.trim();
    if (
      !targetPlan.id ||
      !trimmedName ||
      trimmedName === targetPlan.name ||
      submittedPlanNamesRef.current.get(targetPlan.id) === trimmedName
    ) {
      return;
    }

    submittedPlanNamesRef.current.set(targetPlan.id, trimmedName);
    renamePlanMutation.mutate({ ...targetPlan, name: trimmedName });
  }

  function queuePlanRename(targetPlan: Plan, name: string) {
    const planId = targetPlan.id;
    if (!planId) {
      return;
    }

    const existingTimer = renamePlanTimersRef.current.get(planId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      renamePlanTimersRef.current.delete(planId);
      renamePlan(targetPlan, name);
    }, 700);
    renamePlanTimersRef.current.set(planId, timer);
  }

  function flushPlanRename(targetPlan: Plan, name: string) {
    const planId = targetPlan.id;
    if (!planId) {
      return;
    }

    const existingTimer = renamePlanTimersRef.current.get(planId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      renamePlanTimersRef.current.delete(planId);
    }
    renamePlan(targetPlan, name);
  }

  function createNamedPlan() {
    const trimmedName = newPlanName.trim();
    const trimmedImportContent = newPlanImportContent.trim();
    if (!trimmedName && !trimmedImportContent) {
      return;
    }

    setAddPlanError("");

    if (trimmedImportContent) {
      try {
        const parsedImport = parsePlanImportInput(trimmedImportContent);
        if (!parsedImport) {
          setAddPlanError("This import link or content is not valid.");
          return;
        }

        importPlanMutation.mutate({
          planExport: parsedImport,
          name: trimmedName || undefined
        });
        return;
      } catch {
        setAddPlanError("This import link or content is not valid.");
        return;
      }
    }

    createPlanMutation.mutate(trimmedName);
  }

  function openExportPlan(activePlan: Plan) {
    setIsExportPlanOpen((current) => !current);
    setIsAddPlanOpen(false);
    setExportPlanError("");
    setCopiedExportValue(null);

    if (!isExportPlanOpen || !exportShareLink) {
      exportPlanMutation.mutate(activePlan);
    }
  }

  async function copyExportValue(kind: "link" | "payload") {
    const value = kind === "link" ? exportShareLink : exportRawPayload;
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedExportValue(kind);
      setExportPlanError("");
    } catch {
      setExportPlanError("Could not copy automatically. Select the text and copy it manually.");
    }
  }

  function handlePlanDragStart(event: DragEvent<HTMLElement>, planId: string | undefined) {
    if (!planId) {
      return;
    }

    setDraggedPlanId(planId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(planDragDataType, planId);
    event.dataTransfer.setData("text/plain", planId);
  }

  function handlePlanDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }

  function handlePlanDrop(event: DragEvent<HTMLElement>, targetPlanId: string | undefined) {
    event.preventDefault();
    event.stopPropagation();

    const sourcePlanId =
      draggedPlanId ||
      event.dataTransfer.getData(planDragDataType) ||
      event.dataTransfer.getData("text/plain");
    setDraggedPlanId(null);

    if (!sourcePlanId || !targetPlanId || sourcePlanId === targetPlanId) {
      return;
    }

    const sourceIndex = orderedPlans.findIndex((candidate) => candidate.id === sourcePlanId);
    const targetIndex = orderedPlans.findIndex((candidate) => candidate.id === targetPlanId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextPlans = [...orderedPlans];
    const [movedPlan] = nextPlans.splice(sourceIndex, 1);
    if (!movedPlan) {
      return;
    }

    nextPlans.splice(targetIndex, 0, movedPlan);
    savePlanOrder(nextPlans);
  }

  function formatRequirementTags(moduleCode: string) {
    const tags = requirementTagsByModuleCode.get(moduleCode) ?? [];
    if (tags.length === 0) {
      return "No requirement tags";
    }

    return tags.map(formatRequirementTag).join(", ");
  }

  function formatRequirementTag(tag: string) {
    const normalizedTag = tag.trim().toLowerCase().replace(/[\/_\s]+/g, "-");
    if (normalizedTag === "idcd" || normalizedTag === "id-cd") {
      return "ID/CD";
    }

    if (normalizedTag === "id") {
      return "ID";
    }

    if (normalizedTag === "cd") {
      return "CD";
    }

    if (normalizedTag === "ue") {
      return "UE";
    }

    return normalizedTag
      .split("-")
      .map((word) => (word.toLowerCase() === "cs" ? "CS" : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(" ");
  }

  function renderPlanMenu(activePlan: Plan) {
    return (
      <div ref={planMenuRef} className="relative">
        <button
          className="flex h-11 max-w-[18rem] items-center gap-3 rounded-md border border-line bg-panel px-4 text-base font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-white/5"
          onClick={() => setIsPlanMenuOpen((current) => !current)}
          aria-label="Select plan"
          aria-expanded={isPlanMenuOpen}
        >
          <span className="truncate">{activePlan.name}</span>
          <ChevronDown size={17} className="shrink-0 text-muted" />
        </button>

        {isPlanMenuOpen ? (
          <Card className="absolute left-0 top-12 z-20 w-[28rem] max-w-[calc(100vw-2.5rem)] p-3 shadow-xl shadow-black/30">
            <div className="space-y-2">
              {orderedPlans.map((candidate) => {
                const isPrimary = candidate.id === activePlan.id;
                return (
                  <div
                    key={candidate.id ?? candidate.name}
                    draggable={Boolean(candidate.id)}
                    onDragStart={(event) => handlePlanDragStart(event, candidate.id)}
                    onDragOver={handlePlanDragOver}
                    onDrop={(event) => handlePlanDrop(event, candidate.id)}
                    onDragEnd={() => setDraggedPlanId(null)}
                    className={cn(
                      "grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md border p-2 transition",
                      isPrimary ? "border-zinc-500 bg-white/5" : "border-line bg-surface",
                      draggedPlanId === candidate.id && "opacity-50"
                    )}
                  >
                    <GripVertical className="cursor-grab text-muted" size={16} />
                    <Input
                      defaultValue={candidate.name}
                      className="h-9 min-w-0"
                      onChange={(event) => queuePlanRename(candidate, event.target.value)}
                      onBlur={(event) => flushPlanRename(candidate, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label={`Plan name for ${candidate.name}`}
                    />
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => candidate.id && selectPrimaryPlan(candidate.id)}
                      disabled={isPrimary || primaryPlanMutation.isPending}
                      aria-label={`Use ${candidate.name}`}
                    >
                      Select
                    </button>
                    <button
                      className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted transition hover:border-red-300/50 hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setPlanPendingDeletion(candidate)}
                      disabled={orderedPlans.length <= 1 || deletePlanMutation.isPending}
                      aria-label={`Delete ${candidate.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  function renderAddPlanButton() {
    return (
      <div ref={addPlanRef} className="relative">
        <button
          className="inline-flex h-11 items-center gap-3 rounded-md border border-line px-4 text-base font-medium text-muted transition hover:bg-white/5 hover:text-zinc-100"
          onClick={() => {
            setIsAddPlanOpen((current) => !current);
            setIsExportPlanOpen(false);
            setAddPlanError("");
          }}
          aria-label="Add plan"
          aria-expanded={isAddPlanOpen}
        >
          Add Plan
          <Plus size={18} />
        </button>

        {isAddPlanOpen ? (
          <Card className="absolute right-0 top-12 z-20 w-96 max-w-[calc(100vw-2.5rem)] p-4 shadow-xl shadow-black/30">
            <h2 className="mb-2 text-lg font-semibold">New or Imported Plan</h2>
            <p className="mb-3 text-sm leading-6 text-muted">
              Enter your plan name.
              Optionally paste an import link or raw tcp1 payload, which can be obtained from "Export Plan".
            </p>
            <div className="space-y-3">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted">Plan Name</span>
                <Input
                  value={newPlanName}
                  onChange={(event) => {
                    setNewPlanName(event.target.value);
                    setAddPlanError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      createNamedPlan();
                    }
                  }}
                  placeholder="Plan Name"
                  className="w-full"
                  autoFocus
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted">Import link or payload (optional)</span>
                <textarea
                  value={newPlanImportContent}
                  onChange={(event) => {
                    setNewPlanImportContent(event.target.value);
                    setAddPlanError("");
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      createNamedPlan();
                    }
                  }}
                  placeholder="Paste import link or tcp1 payload"
                  className="min-h-28 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-muted focus:border-zinc-500"
                />
              </label>
            </div>
            {addPlanError ? (
              <p className="mt-2 text-xs leading-5 text-red-300">{addPlanError}</p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <GhostButton
                onClick={() => {
                  setNewPlanName("");
                  setNewPlanImportContent("");
                  setAddPlanError("");
                  setIsAddPlanOpen(false);
                }}
              >
                Cancel
              </GhostButton>
              <Button
                onClick={createNamedPlan}
                disabled={
                  (!newPlanName.trim() && !newPlanImportContent.trim()) ||
                  createPlanMutation.isPending ||
                  importPlanMutation.isPending
                }
              >
                {importPlanMutation.isPending ? "Importing" : createPlanMutation.isPending ? "Adding" : "Add"}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  function renderExportPlanButton(activePlan: Plan) {
    return (
      <div ref={exportPlanRef} className="relative">
        <button
          className="inline-flex h-11 items-center gap-3 rounded-md border border-line px-4 text-base font-medium text-muted transition hover:bg-white/5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => openExportPlan(activePlan)}
          disabled={!activePlan.id || exportPlanMutation.isPending}
          aria-label="Export plan"
          aria-expanded={isExportPlanOpen}
        >
          Export Plan
          <Upload size={18} />
        </button>

        {isExportPlanOpen ? (
          <Card className="absolute right-0 top-12 z-20 w-[30rem] max-w-[calc(100vw-2.5rem)] p-4 shadow-xl shadow-black/30">
            <h2 className="text-lg font-semibold">Export Plan</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              This creates a copyable import link. It is not a live shared plan, and anyone with the link can decode and import the plan.
            </p>

            {exportPlanMutation.isPending ? (
              <p className="mt-4 text-sm text-muted">Generating export link...</p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-muted">Import link</span>
                  <div className="flex gap-2">
                    <Input readOnly value={exportShareLink} className="min-w-0 flex-1" />
                    <GhostButton
                      onClick={() => copyExportValue("link")}
                      disabled={!exportShareLink}
                    >
                      {copiedExportValue === "link" ? "Copied" : "Copy"}
                    </GhostButton>
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-muted">Raw import payload</span>
                  <div className="flex gap-2">
                    <Input readOnly value={exportRawPayload} className="min-w-0 flex-1" />
                    <GhostButton
                      onClick={() => copyExportValue("payload")}
                      disabled={!exportRawPayload}
                    >
                      {copiedExportValue === "payload" ? "Copied" : "Copy"}
                    </GhostButton>
                  </div>
                </label>
              </div>
            )}

            {exportPlanError ? (
              <p className="mt-3 text-xs leading-5 text-red-300">{exportPlanError}</p>
            ) : null}
          </Card>
        ) : null}
      </div>
    );
  }

  function renderAdvisoryWarningButton() {
    return (
      <div ref={warningPanelRef} className="relative">
        <button
          className={cn(
            "relative grid h-9 w-9 place-items-center rounded-md border transition",
            visibleAdvisoryWarnings.length > 0
              ? "border-amber-400/50 text-amber-300 hover:bg-amber-300/10"
              : "border-line text-muted hover:bg-white/5 hover:text-zinc-100"
          )}
          onClick={() => setIsWarningPanelOpen((current) => !current)}
          aria-label="Show advisory warnings"
          aria-expanded={isWarningPanelOpen}
        >
          <AlertTriangle size={17} />
          {visibleAdvisoryWarnings.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-semibold leading-4 text-zinc-950">
              {visibleAdvisoryWarnings.length}
            </span>
          ) : null}
        </button>
        {isWarningPanelOpen ? (
          <Card className="absolute right-0 top-11 z-20 w-96 border-amber-500/30 p-4 shadow-xl shadow-black/30">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
              <AlertTriangle size={16} /> Advisory Warnings
            </h2>
            {visibleAdvisoryWarnings.length ? (
              <div className="max-h-[28rem] overflow-y-auto text-xs leading-5 text-amber-100/80">
                {visibleAdvisoryWarnings.map(({ key, warning }, index) => (
                  <div
                    key={key}
                    className={cn(
                      "group relative min-w-0 rounded-md py-2 pl-2 pr-10 transition duration-150 hover:-translate-y-0.5 hover:bg-amber-300/5 hover:ring-1 hover:ring-amber-200/15",
                      index > 0 && "border-t border-amber-200/10"
                    )}
                  >
                    <p className="whitespace-normal break-words">{warning}</p>
                    <button
                      className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border border-amber-300/30 text-amber-100/70 opacity-0 transition hover:border-amber-200 hover:bg-amber-200/10 hover:text-amber-50 group-hover:opacity-100"
                      onClick={() => dismissWarning(key)}
                      aria-label="Dismiss warning"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted">No advisory warnings.</p>
            )}
          </Card>
        ) : null}
      </div>
    );
  }

  function renderEvaluationRefreshButton(activePlan: Plan) {
    return (
      <button
        className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted transition hover:bg-white/5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => activePlan.id && evaluateAndCachePlan(activePlan.id)}
        disabled={!activePlan.id || evaluationQuery.isFetching}
        aria-label="Refresh degree progress"
      >
        <RefreshCw size={17} className={evaluationQuery.isFetching ? "animate-spin" : undefined} />
      </button>
    );
  }

  function renderDeletePlanConfirmation() {
    if (!planPendingDeletion) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-5">
        <Card className="w-full max-w-md p-5 shadow-2xl shadow-black/40">
          <h2 className="text-lg font-semibold">Delete plan?</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This will permanently delete "{planPendingDeletion.name}" and all modules, placeholders, and grades in that plan.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton
              onClick={() => setPlanPendingDeletion(null)}
              disabled={deletePlanMutation.isPending}
            >
              Cancel
            </GhostButton>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-400 bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => deletePlanMutation.mutate(planPendingDeletion)}
              disabled={deletePlanMutation.isPending}
            >
              Delete
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">Module Planner</h1>
              </div>
              <p className="text-md text-muted">
                {totalUnits} / {requirementsQuery.data?.totalUnits ?? "-"} Units
              </p>
            </div>
            <div className="flex items-center gap-2">
              {renderPlanMenu(plan)}
              {renderAddPlanButton()}
              {renderExportPlanButton(plan)}
            </div>
          </div>

          <div ref={semesterScrollerRef} className="flex min-w-0 gap-4 overflow-x-auto pb-4">
          {plan.semesters.map((semester) => {
            const semesterUnits = semester.items.reduce((sum, item) => sum + item.units, 0);
            const isExpanded = expandedSemester === semester.key;
            const semesterHeading = semester.key === "IBLOC" ? semesterLabels[semester.key] : semester.key;

            return (
              <Card
                key={semester.key}
                data-semester-key={semester.key}
                className={cn(
                  "w-[320px] shrink-0 p-4 sm:w-[360px]",
                  semester.key === currentSemester && "border-[#ff007f] shadow-[0_0_0_1px_#ff007f]"
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{semesterHeading}</h2>
                    <p className="text-xs text-muted">{semester.label}</p>
                  </div>
                  <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                    {semesterUnits} units
                  </span>
                </div>

                <div
                  className="space-y-1"
                  onDragOver={(event) =>
                    handleInsertionDragOver(event, semester.key, semester.items.length)
                  }
                  onDrop={(event) => handleDrop(event, semester.key, semester.items.length)}
                >
                  {semester.items.map((item, index) => (
                    <div key={item.id ?? `${semester.key}-${index}`}>
                      <div
                        className={cn(
                          "h-2 rounded-full transition",
                          isActiveDropTarget(semester.key, index) ? "bg-emerald-400/80" : "bg-transparent"
                        )}
                        onDragOver={(event) => handleInsertionDragOver(event, semester.key, index)}
                        onDrop={(event) => handleDrop(event, semester.key, index)}
                      />
                      <div
                        draggable
                        onDragStart={(event) => handleDragStart(event, semester.key, index)}
                        onDragOver={(event) => handleItemDragOver(event, semester.key, index)}
                        onDrop={(event) => handleItemDrop(event, semester.key, index)}
                        onDragEnd={endDrag}
                        className={cn(
                          "rounded-md border bg-surface p-3 transition",
                          item.type === "module" && hasVisibleWarning(semester.key, index, item.id)
                            ? "border-amber-300/80 shadow-[0_0_0_1px_rgba(252,211,77,0.28)]"
                            : "border-line",
                          draggedItem?.semesterKey === semester.key && draggedItem.itemIndex === index
                            ? "cursor-grabbing opacity-50"
                            : "cursor-grab hover:border-zinc-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-2">
                            <GripVertical className="mt-0.5 shrink-0 text-muted" size={15} />
                            <div>
                              <p className="text-sm font-semibold">
                                {item.type === "module"
                                  ? `${item.moduleCode} ${moduleByCode.get(item.moduleCode)?.title ?? ""}`.trim()
                                  : item.label}
                              </p>
                              <p className="text-xs text-muted">
                                {item.units} units · {item.type === "module" ? formatRequirementTags(item.moduleCode) : formatRequirementTag(item.requirementId)}
                              </p>
                            </div>
                          </div>
                          <button
                            className="rounded-md p-1 text-muted transition hover:bg-white/5 hover:text-zinc-100"
                            onClick={() => removeItem(semester.key, index)}
                            aria-label="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div
                    className={cn(
                      "h-2 rounded-full transition",
                      isActiveDropTarget(semester.key, semester.items.length) ? "bg-emerald-400/80" : "bg-transparent"
                    )}
                    onDragOver={(event) => handleInsertionDragOver(event, semester.key, semester.items.length)}
                    onDrop={(event) => handleDrop(event, semester.key, semester.items.length)}
                  />

                  {isExpanded ? (
                    <div className="rounded-md border border-line bg-[#202020] p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <Search size={17} className="text-muted" />
                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search modules, e.g. CS1101S"
                          className="w-full"
                        />
                      </div>

                      {modulesQuery.data && modulesQuery.data.length > 0 && (
                        <div className="mb-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
                          {modulesQuery.data.map((module) => (
                            <button
                              key={module.moduleCode}
                              className="w-64 shrink-0 snap-start rounded-md border border-line bg-surface p-3 text-left transition hover:border-zinc-500"
                              onClick={() => addModule(module, semester.key)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{module.moduleCode}</p>
                                <span className="text-xs text-muted">{module.units} units</span>
                              </div>
                              <p className="mt-1 text-sm text-zinc-300">{module.title}</p>
                              {module.prerequisite && (
                                <p className="mt-2 flex items-center gap-1 text-xs text-amber-300">
                                  <AlertTriangle size={13} /> Advisory Prerequisite
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="my-3 flex items-center gap-3 text-xs text-muted">
                        <div className="h-px flex-1 bg-line" />
                        <span>or</span>
                        <div className="h-px flex-1 bg-line" />
                      </div>

                      <div className="relative">
                        <Select
                          value={selectedPlaceholder}
                          onChange={(event) => setSelectedPlaceholder(event.target.value)}
                          className="w-full appearance-none pr-10"
                        >
                          <option value="">Add placeholder</option>
                          {placeholders.map((placeholder) => (
                            <option key={placeholder.requirementId} value={placeholder.requirementId}>
                              {placeholder.label}
                            </option>
                          ))}
                        </Select>
                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <Button
                          disabled={!selectedPlaceholder}
                          onClick={() => addPlaceholder(selectedPlaceholder, semester.key)}
                        >
                          Add placeholder
                        </Button>
                        <GhostButton className="h-10 w-10 p-0" onClick={closeAddPanel} aria-label="Close add panel">
                          <X size={17} />
                        </GhostButton>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex w-full items-center justify-center rounded-md border border-dashed border-line p-4 text-sm font-medium text-muted transition hover:border-zinc-500 hover:bg-white/5 hover:text-zinc-100"
                      onClick={() => openAddPanel(semester.key)}
                    >
                      + Add module / placeholder
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Degree Progress</h2>
            <div className="flex items-center gap-2">
              {renderAdvisoryWarningButton()}
              {renderEvaluationRefreshButton(plan)}
            </div>
          </div>
          <div className="space-y-4">
            {!evaluationQuery.data ? (
              <p className="text-sm text-muted">Plan progress will evaluate after your next planner change.</p>
            ) : null}
            {evaluationQuery.data?.requirements.map((requirement) => (
              <div key={requirement.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{requirement.label}</p>
                  <p className="text-xs text-muted">
                    {requirement.completedUnits}/{requirement.requiredUnits}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      requirement.completedUnits >= requirement.requiredUnits && requirement.missing.length > 0
                        ? "bg-red-400"
                        : "bg-emerald-400"
                    )}
                    style={{ width: `${requirement.percentage}%` }}
                  />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {requirement.contributors.length > 0 ? (
                    <p>Contributors: {requirement.contributors.join(", ")}</p>
                  ) : null}
                  {requirement.missing.length > 0 ? (
                    <div className="text-red-300">
                      <p>Missing:</p>
                      <ul className="ml-4 list-disc space-y-0.5">
                        {requirement.missing.map((missingItem) => (
                          <li key={missingItem} className="whitespace-normal break-words">
                            {missingItem}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {requirement.contributors.length === 0 && requirement.missing.length === 0 ? (
                    <p>No progress yet</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
        </aside>
      </div>
      {renderDeletePlanConfirmation()}
    </>
  );
}
