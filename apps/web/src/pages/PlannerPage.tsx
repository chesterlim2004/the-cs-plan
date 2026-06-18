import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, GripVertical, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import type { Module, Plan, SemesterKey } from "@the-cs-plan/shared";
import { semesterLabels } from "@the-cs-plan/shared";
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

async function fetchAndCacheEvaluation(planId: string) {
  const evaluation = await api.evaluatePlan(planId);
  writeCachedEvaluation(planId, evaluation);
  return evaluation;
}

export function PlannerPage() {
  const queryClient = useQueryClient();
  const [expandedSemester, setExpandedSemester] = useState<SemesterKey | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPlaceholder, setSelectedPlaceholder] = useState("");
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isWarningPanelOpen, setIsWarningPanelOpen] = useState(false);
  const warningPanelRef = useRef<HTMLDivElement | null>(null);
  const [dismissedWarningKeys, setDismissedWarningKeys] = useState<Set<string>>(() => new Set());
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: api.listPlans });
  const plan = plansQuery.data?.[0];
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
    if (!isWarningPanelOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!warningPanelRef.current?.contains(event.target as Node)) {
        setIsWarningPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [isWarningPanelOpen]);

  const updateMutation = useMutation({
    mutationFn: api.updatePlan,
    onSuccess: async (updatedPlan) => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      if (updatedPlan.id) {
        await evaluateAndCachePlan(updatedPlan.id);
      }
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

  if (plansQuery.isLoading) {
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

  function updatePlan(mutator: (draft: Plan) => void) {
    const draft = structuredClone(plan!);
    mutator(draft);
    updateMutation.mutate(draft);
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
        status: semesterKey.startsWith("Y1") ? "completed" : "planned"
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
      semester?.items.push({ id: crypto.randomUUID(), type: "placeholder", ...placeholder });
    });
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


  function renderAdvisoryWarningButton() {
    return (
      <div ref={warningPanelRef} className="relative mt-2">
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
                      onClick={() => {
                        setDismissedWarningKeys((current) => new Set(current).add(key));
                      }}
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

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Module Planner</h1>
            <p className="text-md text-muted">
              {totalUnits} / {requirementsQuery.data?.totalUnits ?? "-"} Units
            </p>
          </div>
          <div>{renderAdvisoryWarningButton()}</div>
        </div>

        <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
          {plan.semesters.map((semester) => {
            const semesterUnits = semester.items.reduce((sum, item) => sum + item.units, 0);
            const isExpanded = expandedSemester === semester.key;
            const semesterHeading = semester.key === "IBLOC" ? semesterLabels[semester.key] : semester.key;

            return (
              <Card key={semester.key} className="w-[320px] shrink-0 p-4 sm:w-[360px]">
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
            <Button
              disabled={evaluationQuery.isFetching}
              onClick={() => plan.id && evaluateAndCachePlan(plan.id)}
            >
              <RefreshCw size={15} className={evaluationQuery.isFetching ? "animate-spin" : undefined} />
              {evaluationQuery.isFetching ? "Refreshing" : "Refresh"}
            </Button>
          </div>
          <div className="space-y-4">
            {!evaluationQuery.data ? (
              <p className="text-sm text-muted">Press Refresh to evaluate this plan.</p>
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
  );
}
