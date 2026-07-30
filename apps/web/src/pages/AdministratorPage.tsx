import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Database,
  FilePlus2,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import {
  AdminCloneCurriculumSchema,
  AdminCurriculumDraftSchema,
  CohortSchema,
  programmeLabels,
  programmeValues,
  RequirementRuleSchema,
  RequirementRuleTypeSchema,
  type AdminCloneCurriculum,
  type AdminCurriculumDraft,
  type AdminModuleTagChange,
  type Programme,
  type RequirementRule,
  type RequirementSet
} from "@the-cs-plan/shared";
import { Button, Card, GhostButton, Input, Select, Textarea } from "../components/ui";
import {
  api,
  type AdminClonePreview,
  type AdminCurriculumCatalogItem,
  type AdminValidationResult
} from "../lib/api";
import { cn } from "../lib/utils";

type AdminTab = "requirements" | "tags" | "clone";

interface ModuleTagSearchState {
  searchInput: string;
  query: string;
  tagFilter: string;
  page: number;
}

const ModuleTagSearchStateSchema = z.object({
  searchInput: z.string(),
  query: z.string(),
  tagFilter: z.string(),
  page: z.number().int().positive()
});

interface PersistedAdminDashboardState {
  version: 1;
  activeTab: AdminTab;
  selectedKey: string;
  isNewCurriculum: boolean;
}

const LocalAdminCurriculumDraftSchema = AdminCurriculumDraftSchema.extend({
  totalUnits: z.number().int(),
  sourceNote: z.string(),
  rules: z.array(RequirementRuleSchema)
});

const adminTabs: Array<{ id: AdminTab; label: string; icon: typeof Database }> = [
  { id: "requirements", label: "Degree requirements", icon: Database },
  { id: "tags", label: "Module tags", icon: Tags },
  { id: "clone", label: "Clone for new cohort", icon: Copy }
];

const initialModuleTagSearchState: ModuleTagSearchState = {
  searchInput: "",
  query: "",
  tagFilter: "",
  page: 1
};

const newRule: RequirementRule = {
  id: "new-requirement",
  label: "New requirement",
  type: "units-from-tags",
  requiredUnits: 4,
  acceptedTags: ["new-tag"]
};

const requirementRuleTypeLabels: Record<RequirementRule["type"], string> = {
  "module-list": "Module list",
  "module-choice": "Module choice",
  "units-from-tags": "Units from tags",
  "capped-units-from-tags": "Capped units from tags",
  "placeholder-units": "Placeholder units",
  "combined-units": "Combined units",
  "structured-idcd": "Structured ID/CD",
  "structured-breadth-depth": "Structured breadth and depth",
  "structured-programme-electives": "Structured programme electives",
  "structured-industry-experience": "Structured industry experience",
  "structured-ddp-honours-pathway": "Structured DDP honours pathway",
  "residual-units": "Residual units"
};

function createRequirementRule(
  id: string,
  label: string,
  type: RequirementRule["type"]
): RequirementRule {
  const base = { id, label, type };

  switch (type) {
    case "module-list":
      return { ...base, type, requiredModules: [] };
    case "module-choice":
      return { ...base, type, requiredUnits: 1, moduleOptions: [] };
    case "units-from-tags":
      return { ...base, type, requiredUnits: 1, acceptedTags: [], acceptedPlaceholders: [] };
    case "capped-units-from-tags":
      return { ...base, type, requiredUnits: 1, acceptedTags: [], tagCaps: [] };
    case "placeholder-units":
      return { ...base, type, requiredUnits: 1, acceptedPlaceholders: [] };
    case "combined-units":
      return { ...base, type, requiredUnits: 1, acceptedTags: [], acceptedPlaceholders: [] };
    case "structured-idcd":
      return {
        ...base,
        type,
        requiredUnits: 1,
        idTags: [],
        cdTags: [],
        acceptedPlaceholders: [],
        requiredIdMinCourses: 0,
        allowedCdMaxCourses: 0
      };
    case "structured-breadth-depth":
      return {
        ...base,
        type,
        requiredUnits: 1,
        acceptedTags: [],
        focusAreas: [],
        requiredFocusAreaPrimaryCount: 1,
        requiredFocusAreaLevel4000PrimaryCount: 1,
        requiredLevel4000Units: 1,
        requiredIndustryMinUnits: 0,
        requiredIndustryMaxUnits: 1,
        allowedNonIndustryPrefixes: [],
        maxNonIndustryCpUnits: 0,
        industryTags: [],
        dissertationTags: []
      };
    case "structured-programme-electives":
      return {
        ...base,
        type,
        requiredUnits: 1,
        acceptedTags: [],
        requiredMinCourses: 1,
        requiredLevel4000MinCourses: 0,
        requiredPrefixMinCourses: 0,
        requiredPrefixes: []
      };
    case "structured-industry-experience":
      return {
        ...base,
        type,
        requiredUnits: 1,
        industryTags: [],
        internshipFoundationTags: [],
        secondInternshipTags: [],
        supplementaryTags: [],
        requiredFoundationUnits: 1,
        requiredCompanionUnits: 1,
        dissertationTags: [],
        tagUnitOverrides: [],
        advisory: ""
      };
    case "structured-ddp-honours-pathway":
      return {
        ...base,
        type,
        requiredUnits: 1,
        integratedThesisTags: [],
        economicsElectiveTags: [],
        economicsLevel4000Tags: [],
        industryTags: [],
        internshipFoundationTags: [],
        secondInternshipTags: [],
        supplementaryTags: [],
        integratedThesisUnits: 1,
        integratedEconomicsUnits: 1,
        integratedEconomicsLevel4000Units: 1,
        requiredFoundationUnits: 1,
        requiredCompanionUnits: 1,
        internshipEconomicsUnits: 1,
        internshipEconomicsLevel4000Units: 1,
        internshipPathwayRequiredUnits: 1,
        tagUnitOverrides: [],
        advisory: ""
      };
    case "residual-units":
      return { ...base, type, requiredUnits: 1, acceptedTags: [], acceptedPlaceholders: [] };
  }
}

export function AdministratorPage() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const catalogQuery = useQuery({
    queryKey: ["admin", "catalog"],
    queryFn: api.adminListCurricula,
    enabled: meQuery.data?.user.role === "admin"
  });
  const [activeTab, setActiveTab] = useState<AdminTab>("requirements");
  const [selectedKey, setSelectedKey] = useState("");
  const [isNewCurriculum, setIsNewCurriculum] = useState(false);
  const [isCurriculumMenuOpen, setIsCurriculumMenuOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProgramme, setNewProgramme] = useState<Programme>("computer-science");
  const [newCohort, setNewCohort] = useState("AY2026/27");
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState<AdminCurriculumDraft | null>(null);
  const [validation, setValidation] = useState<AdminValidationResult | null>(null);
  const [validatedFingerprint, setValidatedFingerprint] = useState("");
  const [hydratedUserId, setHydratedUserId] = useState("");
  const [moduleTagSearchState, setModuleTagSearchState] = useState<ModuleTagSearchState>(
    initialModuleTagSearchState
  );
  const [moduleTagSearchKey, setModuleTagSearchKey] = useState("");
  const curriculumMenuRef = useRef<HTMLDivElement | null>(null);

  const adminUserId = meQuery.data?.user.role === "admin" ? meQuery.data.user.id : "";
  const dashboardHydrated = Boolean(adminUserId && hydratedUserId === adminUserId);
  const curricula = catalogQuery.data?.curricula ?? [];
  const selectedCurriculum = curricula.find(
    (item) => curriculumKey(item.programme, item.cohort) === selectedKey
  );
  const selectedCurriculumLabel = selectedCurriculum
    ? `${programmeLabels[selectedCurriculum.programme]} · ${selectedCurriculum.cohort} · v${selectedCurriculum.latestVersion}`
    : isNewCurriculum && draft
      ? `${programmeLabels[draft.programme]} · ${draft.cohort} · New`
      : "Select curriculum";
  const selected = parseCurriculumKey(selectedKey);
  const curriculumQuery = useQuery({
    queryKey: ["admin", "curriculum", selected?.programme, selected?.cohort],
    queryFn: () => api.adminGetCurriculum(selected!.programme, selected!.cohort),
    enabled: Boolean(selected && !isNewCurriculum && dashboardHydrated)
  });

  useEffect(() => {
    if (!isCurriculumMenuOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!curriculumMenuRef.current?.contains(event.target as Node)) {
        setIsCurriculumMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [isCurriculumMenuOpen]);

  useEffect(() => {
    if (!adminUserId) {
      return;
    }

    const restored = loadAdminDashboardState(adminUserId);
    const restoredDraft = restored?.selectedKey
      ? loadAdminCurriculumDraft(adminUserId, restored.selectedKey)
      : null;
    setActiveTab(restored?.activeTab ?? "requirements");
    setSelectedKey(restored?.selectedKey ?? "");
    setIsNewCurriculum(Boolean(restored?.isNewCurriculum && restoredDraft));
    setDraft(restoredDraft);
    setModuleTagSearchState(
      restored?.selectedKey
        ? loadAdminModuleTagSearchState(adminUserId, restored.selectedKey)
        : initialModuleTagSearchState
    );
    setModuleTagSearchKey(restored?.selectedKey ?? "");
    setValidation(null);
    setValidatedFingerprint("");
    setHydratedUserId(adminUserId);
  }, [adminUserId]);

  useEffect(() => {
    if (!dashboardHydrated || selectedKey || !curricula[0]) {
      return;
    }
    const key = curriculumKey(curricula[0].programme, curricula[0].cohort);
    setSelectedKey(key);
    setDraft(loadAdminCurriculumDraft(adminUserId, key));
  }, [adminUserId, curricula, dashboardHydrated, selectedKey]);

  useEffect(() => {
    if (
      dashboardHydrated &&
      isNewCurriculum &&
      curricula.some((item) => curriculumKey(item.programme, item.cohort) === selectedKey)
    ) {
      setIsNewCurriculum(false);
    }
  }, [curricula, dashboardHydrated, isNewCurriculum, selectedKey]);

  useEffect(() => {
    if (!curriculumQuery.data || isNewCurriculum || !dashboardHydrated) {
      return;
    }
    const loadedKey = curriculumKey(curriculumQuery.data.programme, curriculumQuery.data.cohort);
    if (draft && curriculumKey(draft.programme, draft.cohort) === loadedKey) {
      if (draft.baseVersion === curriculumQuery.data.version) {
        return;
      }
      clearEditorStoragePrefix(
        adminEditorStoragePrefix(adminUserId, draft.programme, draft.cohort)
      );
      removeAdminCurriculumDraft(adminUserId, draft.programme, draft.cohort);
    }
    setDraft(toDraft(curriculumQuery.data));
    setValidation(null);
    setValidatedFingerprint("");
  }, [adminUserId, curriculumQuery.data, dashboardHydrated, draft, isNewCurriculum]);

  useEffect(() => {
    if (!dashboardHydrated) {
      return;
    }
    saveAdminDashboardState(adminUserId, { activeTab, selectedKey, isNewCurriculum });
  }, [activeTab, adminUserId, dashboardHydrated, isNewCurriculum, selectedKey]);

  useEffect(() => {
    if (!dashboardHydrated || moduleTagSearchKey === selectedKey) {
      return;
    }
    setModuleTagSearchState(
      selectedKey
        ? loadAdminModuleTagSearchState(adminUserId, selectedKey)
        : initialModuleTagSearchState
    );
    setModuleTagSearchKey(selectedKey);
  }, [adminUserId, dashboardHydrated, moduleTagSearchKey, selectedKey]);

  useEffect(() => {
    if (!dashboardHydrated || !selectedKey || moduleTagSearchKey !== selectedKey) {
      return;
    }
    saveAdminModuleTagSearchState(adminUserId, selectedKey, moduleTagSearchState);
  }, [adminUserId, dashboardHydrated, moduleTagSearchKey, moduleTagSearchState, selectedKey]);

  useEffect(() => {
    if (!dashboardHydrated || !draft) {
      return;
    }
    saveAdminCurriculumDraft(adminUserId, draft);
  }, [adminUserId, dashboardHydrated, draft]);

  const fingerprint = useMemo(() => JSON.stringify(draft), [draft]);
  const currentRequirementSet = curriculumQuery.data;
  const diff = useMemo(
    () => draft ? summarizeDraftChanges(draft, currentRequirementSet) : null,
    [draft, currentRequirementSet]
  );

  const validateMutation = useMutation({
    mutationFn: api.adminValidateCurriculum,
    onSuccess: (result, variables) => {
      setValidation(result);
      setValidatedFingerprint(JSON.stringify(variables));
    }
  });
  const publishMutation = useMutation({
    mutationFn: api.adminPublishCurriculum,
    onSuccess: async ({ requirementSet, validation: result }) => {
      const key = curriculumKey(requirementSet.programme, requirementSet.cohort);
      clearEditorStoragePrefix(adminEditorStoragePrefix(adminUserId, requirementSet.programme, requirementSet.cohort));
      setSelectedKey(key);
      setIsNewCurriculum(false);
      setDraft(toDraft(requirementSet));
      setValidation(result);
      setValidatedFingerprint(JSON.stringify(toDraft(requirementSet)));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["requirements"] }),
        queryClient.invalidateQueries({ queryKey: ["module-requirement-tags"] }),
        queryClient.invalidateQueries({ queryKey: ["evaluation"] })
      ]);
    }
  });

  if (meQuery.isLoading) {
    return <div className="p-5 text-sm text-muted">Checking administrator access...</div>;
  }
  if (meQuery.data?.user.role !== "admin") {
    return <Navigate to="/planner" replace />;
  }

  function selectCurriculum(key: string) {
    const localDraft = loadAdminCurriculumDraft(adminUserId, key);
    const curriculumExists = curricula.some(
      (item) => curriculumKey(item.programme, item.cohort) === key
    );
    setSelectedKey(key);
    setIsNewCurriculum(Boolean(localDraft?.baseVersion === 0 && !curriculumExists));
    setDraft(localDraft);
    setValidation(null);
    setValidatedFingerprint("");
  }

  function createCurriculumDraft() {
    const parsedCohort = CohortSchema.safeParse(newCohort.trim());
    if (!parsedCohort.success) {
      setCreateError(parsedCohort.error.issues[0]?.message ?? "Invalid cohort");
      return;
    }
    const key = curriculumKey(newProgramme, parsedCohort.data);
    if (curricula.some((item) => curriculumKey(item.programme, item.cohort) === key)) {
      setCreateError("This curriculum already exists. Select it from the curriculum menu.");
      return;
    }

    const createdDraft: AdminCurriculumDraft = {
      programme: newProgramme,
      cohort: parsedCohort.data,
      baseVersion: 0,
      totalUnits: 160,
      sourceNote: "",
      rules: [newRule],
      tagChanges: []
    };
    saveAdminCurriculumDraft(adminUserId, createdDraft);
    saveAdminDashboardState(adminUserId, {
      activeTab: "requirements",
      selectedKey: key,
      isNewCurriculum: true
    });
    setSelectedKey(key);
    setIsNewCurriculum(true);
    setDraft(createdDraft);
    setValidation(null);
    setValidatedFingerprint("");
    setCreateError("");
    setShowCreate(false);
    setActiveTab("requirements");
  }

  function updateDraft(update: Partial<AdminCurriculumDraft>) {
    setDraft((current) => current ? { ...current, ...update } : current);
    setValidation(null);
    setValidatedFingerprint("");
  }

  function stageTagChange(change: AdminModuleTagChange, originalTags: string[]) {
    if (!draft) {
      return;
    }
    const matchesOriginal = !change.deleteMapping && arraysEqual(change.tags, originalTags);
    const otherChanges = draft.tagChanges.filter((item) => item.moduleCode !== change.moduleCode);
    updateDraft({
      tagChanges: matchesOriginal ? otherChanges : [...otherChanges, change]
    });
  }

  function discardLocalDraft() {
    if (!draft || !window.confirm("Discard all local edits for this curriculum? Published data will not be changed.")) {
      return;
    }

    clearEditorStoragePrefix(adminEditorStoragePrefix(adminUserId, draft.programme, draft.cohort));
    removeAdminCurriculumDraft(adminUserId, draft.programme, draft.cohort);
    setValidation(null);
    setValidatedFingerprint("");

    if (currentRequirementSet) {
      setDraft(toDraft(currentRequirementSet));
      return;
    }

    const fallback = curricula[0];
    setIsNewCurriculum(false);
    if (fallback) {
      const key = curriculumKey(fallback.programme, fallback.cohort);
      setSelectedKey(key);
      setDraft(loadAdminCurriculumDraft(adminUserId, key));
    } else {
      setSelectedKey("");
      setDraft(null);
    }
  }

  const canPublish = Boolean(
    draft && validation?.valid && validatedFingerprint === fingerprint && !publishMutation.isPending
  );

  return (
    <div className="mx-auto max-w-[1500px] p-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} />
            <h1 className="text-2xl font-semibold">Administrator</h1>
          </div>
          <p className="mt-1 text-sm text-muted">Curriculum publishing and module classification for each curriculum</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div ref={curriculumMenuRef} className="relative w-fit max-w-full">
            <button
              type="button"
              className="flex h-11 w-fit max-w-full items-center gap-3 rounded-md border border-line bg-panel px-4 text-base font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-white/5"
              onClick={() => setIsCurriculumMenuOpen((current) => !current)}
              aria-label="Select curriculum"
              aria-expanded={isCurriculumMenuOpen}
            >
              <span className="truncate whitespace-nowrap">{selectedCurriculumLabel}</span>
              <ChevronDown size={17} className="shrink-0 text-muted" />
            </button>

            {isCurriculumMenuOpen ? (
              <Card className="absolute right-0 top-12 z-30 w-max min-w-full max-w-[calc(100vw-2.5rem)] p-2 shadow-xl shadow-black/30">
                <div className="space-y-1">
                  {curricula.map((item) => {
                    const key = curriculumKey(item.programme, item.cohort);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "block w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-zinc-100",
                          key === selectedKey && "bg-white/10 text-zinc-100"
                        )}
                        onClick={() => {
                          selectCurriculum(key);
                          setIsCurriculumMenuOpen(false);
                        }}
                      >
                        {programmeLabels[item.programme]} · {item.cohort} · v{item.latestVersion}
                      </button>
                    );
                  })}
                  {isNewCurriculum && draft ? (
                    <button
                      type="button"
                      className="block w-full whitespace-nowrap rounded-md bg-white/10 px-3 py-2 text-left text-sm text-zinc-100"
                      onClick={() => setIsCurriculumMenuOpen(false)}
                    >
                      {programmeLabels[draft.programme]} · {draft.cohort} · New
                    </button>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </div>
          <GhostButton
            className="h-11 gap-3 px-4 text-base"
            onClick={() => setShowCreate((current) => !current)}
          >
            <FilePlus2 size={18} /> New curriculum
          </GhostButton>
        </div>
      </div>

      {showCreate ? (
        <div className="grid gap-3 border-b border-line bg-panel/40 p-4 md:grid-cols-[minmax(240px,1fr)_180px_auto_auto] md:items-end">
          <Field label="Programme">
            <div className="relative">
              <Select
                value={newProgramme}
                onChange={(event) => setNewProgramme(event.target.value as Programme)}
                className="w-full appearance-none px-4 pr-11"
              >
                {programmeValues.map((programme) => (
                  <option key={programme} value={programme}>{programmeLabels[programme]}</option>
                ))}
              </Select>
              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </Field>
          <Field label="Cohort">
            <Input value={newCohort} onChange={(event) => setNewCohort(event.target.value)} placeholder="AY2026/27" className="w-full" />
          </Field>
          <Button onClick={createCurriculumDraft}><Plus size={16} /> Create draft</Button>
          <GhostButton aria-label="Close new curriculum form" title="Close" onClick={() => setShowCreate(false)}>
            <X size={16} />
          </GhostButton>
          {createError ? <p className="text-sm text-red-300 md:col-span-4">{createError}</p> : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-md border border-line bg-panel p-1">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded px-3 text-sm text-muted transition hover:text-zinc-100",
                  activeTab === tab.id && "bg-white/10 text-zinc-100"
                )}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>

          {catalogQuery.isError ? <ErrorBanner error={catalogQuery.error} /> : null}
          {curriculumQuery.isLoading && !isNewCurriculum ? <p className="mt-6 text-sm text-muted">Loading curriculum...</p> : null}

          {draft && activeTab === "requirements" ? (
            <RequirementSetEditor
              draft={draft}
              editorStoragePrefix={adminEditorStoragePrefix(adminUserId, draft.programme, draft.cohort)}
              onChange={updateDraft}
            />
          ) : null}

          {draft && activeTab === "tags" ? (
            <ModuleTagEditor
              draft={draft}
              editorStoragePrefix={adminEditorStoragePrefix(adminUserId, draft.programme, draft.cohort)}
              searchState={moduleTagSearchState}
              onSearchStateChange={(update) => {
                setModuleTagSearchState((current) => ({ ...current, ...update }));
              }}
              onStage={stageTagChange}
              onClear={() => {
                clearEditorStoragePrefix(`${adminEditorStoragePrefix(adminUserId, draft.programme, draft.cohort)}:tag:`);
                updateDraft({ tagChanges: [] });
              }}
            />
          ) : null}

          {activeTab === "clone" ? (
            <CloneCurriculumPanel
              curricula={curricula}
              selectedKey={selectedKey}
              onCloned={async (programme, cohort) => {
                await queryClient.invalidateQueries({ queryKey: ["admin"] });
                selectCurriculum(curriculumKey(programme, cohort));
                setActiveTab("requirements");
              }}
            />
          ) : null}
        </div>

        {draft ? (
          <ReleaseSidebar
            draft={draft}
            diff={diff!}
            validation={validation}
            validationCurrent={validatedFingerprint === fingerprint}
            validatePending={validateMutation.isPending}
            publishPending={publishMutation.isPending}
            validateError={validateMutation.error}
            publishError={publishMutation.error}
            canPublish={canPublish}
            onDiscard={discardLocalDraft}
            onValidate={() => validateMutation.mutate(draft)}
            onPublish={() => {
              if (window.confirm(`Publish ${programmeLabels[draft.programme]} ${draft.cohort} as version ${draft.baseVersion + 1}?`)) {
                publishMutation.mutate(draft);
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function RequirementSetEditor({
  draft,
  editorStoragePrefix,
  onChange
}: {
  draft: AdminCurriculumDraft;
  editorStoragePrefix: string;
  onChange: (update: Partial<AdminCurriculumDraft>) => void;
}) {
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newRuleId, setNewRuleId] = useState("");
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [newRuleType, setNewRuleType] = useState<RequirementRule["type"] | "">("");
  const [addRuleError, setAddRuleError] = useState("");
  const [isRuleTypeMenuOpen, setIsRuleTypeMenuOpen] = useState(false);
  const addRuleRef = useRef<HTMLDivElement | null>(null);
  const ruleTypeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAddRuleOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!ruleTypeMenuRef.current?.contains(event.target as Node)) {
        setIsRuleTypeMenuOpen(false);
      }
      if (!addRuleRef.current?.contains(event.target as Node)) {
        setIsAddRuleOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [isAddRuleOpen]);

  function updateRule(index: number, rule: RequirementRule) {
    onChange({ rules: draft.rules.map((current, currentIndex) => currentIndex === index ? rule : current) });
  }

  function moveRule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.rules.length) {
      return;
    }
    const rules = [...draft.rules];
    [rules[index], rules[target]] = [rules[target]!, rules[index]!];
    onChange({ rules });
  }

  function resetAddRuleForm() {
    setNewRuleId("");
    setNewRuleLabel("");
    setNewRuleType("");
    setAddRuleError("");
    setIsRuleTypeMenuOpen(false);
  }

  function closeAddRuleForm() {
    resetAddRuleForm();
    setIsAddRuleOpen(false);
  }

  function addRule() {
    const id = newRuleId.trim();
    const label = newRuleLabel.trim();
    if (!id) {
      setAddRuleError("Rule ID is required.");
      return;
    }
    if (/\s/.test(newRuleId)) {
      setAddRuleError("Rule ID cannot contain spaces.");
      return;
    }
    if (draft.rules.some((rule) => rule.id === id)) {
      setAddRuleError(`Rule ID "${id}" already exists in this draft.`);
      return;
    }
    if (!label) {
      setAddRuleError("Rule label is required.");
      return;
    }

    const parsedType = RequirementRuleTypeSchema.safeParse(newRuleType);
    if (!parsedType.success) {
      setAddRuleError("Select a valid rule type.");
      return;
    }

    onChange({ rules: [...draft.rules, createRequirementRule(id, label, parsedType.data)] });
    closeAddRuleForm();
  }

  return (
    <section className="mt-5 min-w-0">
        <div className="grid gap-4 border-y border-line py-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <Field label="Total graduation units">
            <Input
              type="number"
              min={1}
              value={draft.totalUnits}
              onChange={(event) => onChange({ totalUnits: Number(event.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label="Source note">
            <Input
              value={draft.sourceNote}
              onChange={(event) => onChange({ sourceNote: event.target.value })}
              className="w-full"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 py-5">
          <div>
            <h2 className="font-semibold">Requirement rules</h2>
            <p className="mt-1 text-xs text-muted">
              {draft.rules.length} rules in {programmeLabels[draft.programme]} {draft.cohort} curriculum. Ordered based on rule priority, use the arrows to edit.
            </p>
          </div>
          <div ref={addRuleRef} className="relative">
            <GhostButton
              onClick={() => {
                setIsAddRuleOpen((current) => !current);
                setAddRuleError("");
                setIsRuleTypeMenuOpen(false);
              }}
              aria-label="Add requirement rule"
              aria-expanded={isAddRuleOpen}
            >
              <Plus size={16} /> Add rule
            </GhostButton>

            {isAddRuleOpen ? (
              <Card className="absolute right-0 top-11 z-30 w-96 max-w-[calc(100vw-2.5rem)] p-4 shadow-xl shadow-black/30">
                <h3 className="text-lg font-semibold">Add requirement rule</h3>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addRule();
                  }}
                >
                  <Field label="ID">
                    <Input
                      value={newRuleId}
                      onChange={(event) => {
                        setNewRuleId(event.target.value);
                        setAddRuleError("");
                      }}
                      placeholder="id-with-no-spacing"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full"
                      autoFocus
                    />
                  </Field>
                  <Field label="Label">
                    <Input
                      value={newRuleLabel}
                      onChange={(event) => {
                        setNewRuleLabel(event.target.value);
                        setAddRuleError("");
                      }}
                      placeholder="Rule name"
                      className="w-full"
                    />
                  </Field>
                  <Field label="Rule type">
                    <div ref={ruleTypeMenuRef} className="relative">
                      <button
                        type="button"
                        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 text-sm text-zinc-100 outline-none transition hover:border-zinc-500"
                        onClick={() => setIsRuleTypeMenuOpen((current) => !current)}
                        aria-label="Select rule type"
                        aria-haspopup="listbox"
                        aria-expanded={isRuleTypeMenuOpen}
                      >
                        <span className={cn("truncate", !newRuleType && "text-muted")}>
                          {newRuleType ? requirementRuleTypeLabels[newRuleType] : "Select rule type"}
                        </span>
                        <ChevronUp size={17} className="shrink-0 text-muted" />
                      </button>

                      {isRuleTypeMenuOpen ? (
                        <div
                          role="listbox"
                          aria-label="Rule type"
                          className="absolute bottom-11 left-0 z-40 w-full rounded-md border border-line bg-panel p-1 shadow-xl shadow-black/30"
                        >
                          {RequirementRuleTypeSchema.options.map((type) => (
                            <button
                              key={type}
                              type="button"
                              role="option"
                              aria-selected={type === newRuleType}
                              className={cn(
                                "block w-full rounded px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-zinc-100",
                                type === newRuleType && "bg-white/10 text-zinc-100"
                              )}
                              onClick={() => {
                                setNewRuleType(type);
                                setAddRuleError("");
                                setIsRuleTypeMenuOpen(false);
                              }}
                            >
                              {requirementRuleTypeLabels[type]}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Field>

                  {addRuleError ? <p className="text-xs leading-5 text-red-300">{addRuleError}</p> : null}

                  <div className="flex justify-end gap-2 pt-1">
                    <GhostButton type="button" onClick={closeAddRuleForm}>Cancel</GhostButton>
                    <Button type="submit">Add</Button>
                  </div>
                </form>
              </Card>
            ) : null}
          </div>
        </div>

        <div className="border-t border-line">
          {draft.rules.map((rule, index) => (
            <RuleEditor
              key={`${draft.baseVersion}:${rule.id}:${index}`}
              rule={rule}
              index={index}
              count={draft.rules.length}
              storageKey={ruleEditorStorageKey(editorStoragePrefix, rule.id)}
              onChange={(nextRule) => updateRule(index, nextRule)}
              onMove={(direction) => moveRule(index, direction)}
              onDuplicate={() => {
                const duplicate = { ...rule, id: uniqueRuleId(draft.rules, `${rule.id}-copy`) };
                const rules = [...draft.rules];
                rules.splice(index + 1, 0, duplicate);
                onChange({ rules });
              }}
              onDelete={() => {
                if (draft.rules.length > 1 && window.confirm(`Delete requirement rule "${rule.label}"?`)) {
                  removeLocalStorageValue(ruleEditorStorageKey(editorStoragePrefix, rule.id));
                  onChange({ rules: draft.rules.filter((_, currentIndex) => currentIndex !== index) });
                }
              }}
            />
          ))}
        </div>
    </section>
  );
}

function ReleaseSidebar({
  draft,
  diff,
  validation,
  validationCurrent,
  validatePending,
  publishPending,
  validateError,
  publishError,
  canPublish,
  onDiscard,
  onValidate,
  onPublish
}: {
  draft: AdminCurriculumDraft;
  diff: ReturnType<typeof summarizeDraftChanges>;
  validation: AdminValidationResult | null;
  validationCurrent: boolean;
  validatePending: boolean;
  publishPending: boolean;
  validateError: Error | null;
  publishError: Error | null;
  canPublish: boolean;
  onDiscard: () => void;
  onValidate: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="self-start xl:sticky xl:top-21">
      <CurriculumModuleTagInventory draft={draft} />
      <aside className="border border-line bg-panel p-4">
        <h2 className="font-semibold">Release preview</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
          <Stat label="Next version" value={`v${draft.baseVersion + 1}`} />
          <Stat label="Rules" value={String(draft.rules.length)} />
          <Stat label="Rule changes" value={String(diff.ruleChanges)} />
          <Stat label="Tag changes" value={String(draft.tagChanges.length)} />
        </dl>

        {diff.details.length > 0 ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs font-medium uppercase text-muted">Diff</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {diff.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2">
          <GhostButton onClick={onValidate} disabled={validatePending}>
            <ClipboardCheck size={16} /> {validatePending ? "Validating..." : "Validate and preview"}
          </GhostButton>
          <Button onClick={onPublish} disabled={!canPublish}>
            <CheckCircle2 size={16} /> {publishPending ? "Publishing..." : `Publish v${draft.baseVersion + 1}`}
          </Button>
          <GhostButton onClick={onDiscard}>
            <Trash2 size={16} /> Discard local edits
          </GhostButton>
        </div>

        {validateError ? <ErrorBanner error={validateError} compact /> : null}
        {publishError ? <ErrorBanner error={publishError} compact /> : null}
        {validation ? (
          <ValidationSummary result={validation} current={validationCurrent} />
        ) : (
          <p className="mt-4 text-xs leading-5 text-muted">Validation is required after every edit.</p>
        )}
      </aside>
    </div>
  );
}

function CurriculumModuleTagInventory({ draft }: { draft: AdminCurriculumDraft }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedTag, setCopiedTag] = useState("");
  const [copyError, setCopyError] = useState("");
  const inventoryRef = useRef<HTMLDivElement | null>(null);
  const inventoryQuery = useQuery({
    queryKey: ["admin", "module-tag-inventory", draft.programme, draft.cohort],
    queryFn: () => api.adminListCurriculumModuleTags(draft.programme, draft.cohort)
  });
  const tags = useMemo(
    () => applyStagedModuleTagChanges(inventoryQuery.data?.tags ?? [], draft.tagChanges),
    [draft.tagChanges, inventoryQuery.data?.tags]
  );

  useEffect(() => {
    setCopiedTag("");
    setCopyError("");
  }, [draft.programme, draft.cohort]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!inventoryRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [isOpen]);

  async function copyTag(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      setCopyError("");
    } catch {
      setCopiedTag("");
      setCopyError("Could not copy the tag automatically.");
    }
  }

  return (
    <div ref={inventoryRef} className="relative mb-4">
      <div className="rounded-md border border-line bg-panel p-1">
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => !current);
            setCopyError("");
          }}
          className={cn(
            "inline-flex h-9 w-full items-center gap-2 whitespace-nowrap rounded px-3 text-sm text-muted transition hover:text-zinc-100",
            isOpen && "bg-white/10 text-zinc-100"
          )}
          aria-label="View module tags for this curriculum"
          aria-expanded={isOpen}
        >
          <Tags size={16} /> View module tags for this curriculum
        </button>
      </div>

      {isOpen ? (
        <Card className="absolute right-0 top-12 z-40 w-full max-w-[calc(100vw-2.5rem)] border-[#ff007f] p-3 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <h3 className="font-semibold">Module tags</h3>
            <span className="text-xs text-muted">{tags.length} tags</span>
          </div>

          {inventoryQuery.isLoading ? <p className="py-5 text-sm text-muted">Loading tags...</p> : null}
          {inventoryQuery.isError ? <ErrorBanner error={inventoryQuery.error} compact /> : null}
          {!inventoryQuery.isLoading && !inventoryQuery.isError ? (
            tags.length > 0 ? (
              <div className="max-h-[min(31.5rem,60vh)] overflow-y-auto">
                {tags.map(({ tag, moduleCount }) => (
                  <div key={tag} className="flex h-14 items-center gap-3 border-b border-line last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-zinc-200" title={tag}>{tag}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {moduleCount} module{moduleCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <IconButton
                      label={copiedTag === tag ? `Copied ${tag}` : `Copy ${tag}`}
                      onClick={() => copyTag(tag)}
                    >
                      {copiedTag === tag ? <Check size={15} /> : <Copy size={15} />}
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-5 text-sm text-muted">No module tags for this curriculum.</p>
            )
          ) : null}
          {copyError ? <p className="border-t border-line pt-2 text-xs text-red-300">{copyError}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}

function applyStagedModuleTagChanges(
  publishedTags: Array<{ tag: string; moduleCodes: string[] }>,
  tagChanges: AdminModuleTagChange[]
): Array<{ tag: string; moduleCount: number }> {
  const moduleCodesByTag = new Map(
    publishedTags.map(({ tag, moduleCodes }) => [tag, new Set(moduleCodes)] as const)
  );

  for (const change of tagChanges) {
    for (const moduleCodes of moduleCodesByTag.values()) {
      moduleCodes.delete(change.moduleCode);
    }
    for (const tag of change.tags) {
      const moduleCodes = moduleCodesByTag.get(tag) ?? new Set<string>();
      moduleCodes.add(change.moduleCode);
      moduleCodesByTag.set(tag, moduleCodes);
    }
  }

  return Array.from(moduleCodesByTag.entries())
    .filter(([, moduleCodes]) => moduleCodes.size > 0)
    .map(([tag, moduleCodes]) => ({ tag, moduleCount: moduleCodes.size }))
    .sort((left, right) => left.tag.localeCompare(right.tag));
}

function RuleEditor({
  rule,
  index,
  count,
  storageKey,
  onChange,
  onMove,
  onDuplicate,
  onDelete
}: {
  rule: RequirementRule;
  index: number;
  count: number;
  storageKey: string;
  onChange: (rule: RequirementRule) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canonicalText = JSON.stringify(rule, null, 2);
  const [text, setText] = useState(() => readLocalStorageValue(storageKey) ?? canonicalText);
  const [error, setError] = useState(() => getRuleEditorError(readLocalStorageValue(storageKey) ?? canonicalText));

  function updateJson(value: string) {
    setText(value);
    saveLocalStorageValue(storageKey, value);
    try {
      const parsedJson = JSON.parse(value) as unknown;
      const parsedRule = RequirementRuleSchema.safeParse(parsedJson);
      if (!parsedRule.success) {
        setError(parsedRule.error.issues[0]?.message ?? "Invalid requirement rule");
        return;
      }
      setError("");
      removeLocalStorageValue(storageKey);
      onChange(parsedRule.data);
    } catch {
      setError("Rule JSON is not valid yet.");
    }
  }

  return (
    <div className="border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setExpanded((current) => !current)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="grid h-6 min-w-6 place-items-center rounded bg-white/5 px-1 text-xs text-muted">{index + 1}</span>
            <span className="truncate text-sm font-medium">{rule.label}</span>
          </div>
          <p className="mt-1 pl-8 text-xs text-muted">{rule.id} · {rule.type} · {rule.requiredUnits ?? (rule.requiredModules?.length ?? 0) * 4} units</p>
        </button>
        <div className="flex items-center gap-1">
          <IconButton label="Increase priority" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={15} /></IconButton>
          <IconButton label="Decrease priority" onClick={() => onMove(1)} disabled={index === count - 1}><ArrowDown size={15} /></IconButton>
          <IconButton label="Duplicate rule" onClick={onDuplicate}><Copy size={15} /></IconButton>
          <IconButton label="Delete rule" onClick={onDelete} disabled={count === 1}><Trash2 size={15} /></IconButton>
          <GhostButton className="ml-1" onClick={() => setExpanded((current) => !current)}>{expanded ? "Close" : "Edit JSON"}</GhostButton>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 pl-0 md:pl-8">
          <Textarea
            aria-label={`${rule.label} rule JSON`}
            value={text}
            onChange={(event) => updateJson(event.target.value)}
            spellCheck={false}
            className="min-h-64 w-full resize-y font-mono text-xs leading-5"
          />
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : <p className="mt-2 text-xs text-emerald-300">Schema valid</p>}
        </div>
      ) : null}
    </div>
  );
}

function ModuleTagEditor({
  draft,
  editorStoragePrefix,
  searchState,
  onSearchStateChange,
  onStage,
  onClear
}: {
  draft: AdminCurriculumDraft;
  editorStoragePrefix: string;
  searchState: ModuleTagSearchState;
  onSearchStateChange: (update: Partial<ModuleTagSearchState>) => void;
  onStage: (change: AdminModuleTagChange, originalTags: string[]) => void;
  onClear: () => void;
}) {
  const { searchInput, query, tagFilter, page } = searchState;
  const [isTagFilterMenuOpen, setIsTagFilterMenuOpen] = useState(false);
  const tagFilterRef = useRef<HTMLDivElement | null>(null);
  const tagInventoryQuery = useQuery({
    queryKey: ["admin", "module-tag-inventory", draft.programme, draft.cohort],
    queryFn: () => api.adminListCurriculumModuleTags(draft.programme, draft.cohort)
  });
  const tagQuery = useQuery({
    queryKey: ["admin", "module-tags", draft.programme, draft.cohort, query, tagFilter, page],
    queryFn: () => api.adminSearchModuleTags(draft.programme, draft.cohort, query, page, tagFilter)
  });
  const stagedByCode = useMemo(
    () => new Map(draft.tagChanges.map((change) => [change.moduleCode, change])),
    [draft.tagChanges]
  );

  useEffect(() => {
    if (!isTagFilterMenuOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!tagFilterRef.current?.contains(event.target as Node)) {
        setIsTagFilterMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [isTagFilterMenuOpen]);

  useEffect(() => {
    if (
      tagFilter
      && tagInventoryQuery.data
      && !tagInventoryQuery.data.tags.some((entry) => entry.tag === tagFilter)
    ) {
      onSearchStateChange({ tagFilter: "", page: 1 });
    }
  }, [tagFilter, tagInventoryQuery.data]);

  useEffect(() => {
    if (tagQuery.data && page > Math.max(tagQuery.data.totalPages, 1)) {
      onSearchStateChange({ page: Math.max(tagQuery.data.totalPages, 1) });
    }
  }, [page, tagQuery.data]);

  const resultStart = tagQuery.data && tagQuery.data.rows.length > 0
    ? (tagQuery.data.page - 1) * tagQuery.data.pageSize + 1
    : 0;
  const resultEnd = tagQuery.data && tagQuery.data.rows.length > 0
    ? resultStart + tagQuery.data.rows.length - 1
    : 0;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-y border-line py-5">
        <form
          className="flex w-full max-w-3xl flex-wrap gap-2 sm:flex-nowrap"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchStateChange({ page: 1, query: searchInput.trim() });
          }}
        >
          <Input
            value={searchInput}
            onChange={(event) => onSearchStateChange({ searchInput: event.target.value })}
            placeholder="Search module code or title"
            className="min-w-[12rem] flex-1"
          />
          <div ref={tagFilterRef} className="relative w-full shrink-0 sm:w-56">
            <button
              type="button"
              className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 text-sm text-zinc-100 transition hover:border-zinc-500"
              onClick={() => setIsTagFilterMenuOpen((current) => !current)}
              aria-label="Filter by module tag"
              aria-expanded={isTagFilterMenuOpen}
            >
              <span className={cn("truncate", !tagFilter && "text-muted")}>
                {tagFilter || "All module tags"}
              </span>
              <ChevronDown size={17} className="shrink-0 text-muted" />
            </button>

            {isTagFilterMenuOpen ? (
              <Card className="absolute right-0 top-11 z-30 max-h-64 w-full overflow-y-auto p-1 shadow-xl shadow-black/30">
                <button
                  type="button"
                  className={cn(
                    "block w-full rounded px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-zinc-100",
                    !tagFilter && "bg-white/10 text-zinc-100"
                  )}
                  onClick={() => {
                    onSearchStateChange({ tagFilter: "", page: 1 });
                    setIsTagFilterMenuOpen(false);
                  }}
                >
                  All module tags
                </button>
                {tagInventoryQuery.data?.tags.map((entry) => (
                  <button
                    key={entry.tag}
                    type="button"
                    className={cn(
                      "block w-full truncate rounded px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-zinc-100",
                      tagFilter === entry.tag && "bg-white/10 text-zinc-100"
                    )}
                    onClick={() => {
                      onSearchStateChange({ tagFilter: entry.tag, page: 1 });
                      setIsTagFilterMenuOpen(false);
                    }}
                    title={entry.tag}
                  >
                    {entry.tag}
                  </button>
                ))}
                {tagInventoryQuery.isLoading ? (
                  <p className="px-3 py-2 text-sm text-muted">Loading tags...</p>
                ) : null}
              </Card>
            ) : null}
          </div>
          <Button><Search size={16} /> Search</Button>
          <GhostButton
            type="button"
            onClick={() => {
              onSearchStateChange(initialModuleTagSearchState);
              setIsTagFilterMenuOpen(false);
            }}
            disabled={!searchInput && !query && !tagFilter && page === 1}
          >
            <X size={16} /> Clear All
          </GhostButton>
        </form>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{draft.tagChanges.length} staged</span>
          <GhostButton onClick={onClear} disabled={draft.tagChanges.length === 0}><X size={16} /> Clear staged</GhostButton>
        </div>
      </div>

      {tagQuery.isLoading ? <p className="py-6 text-sm text-muted">Loading module tags...</p> : null}
      {tagQuery.isError ? <ErrorBanner error={tagQuery.error} /> : null}
      {tagQuery.data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span>
                {resultStart}-{resultEnd} / {tagQuery.data.total} {query || tagFilter ? "search results" : "mapped modules"}
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Previous page"
                  onClick={() => onSearchStateChange({ page: Math.max(page - 1, 1) })}
                  disabled={tagQuery.data.page <= 1 || tagQuery.isFetching}
                >
                  <ChevronLeft size={15} />
                </IconButton>
                <IconButton
                  label="Next page"
                  onClick={() => onSearchStateChange({ page: page + 1 })}
                  disabled={tagQuery.data.page >= tagQuery.data.totalPages || tagQuery.isFetching}
                >
                  <ChevronRight size={15} />
                </IconButton>
              </div>
            </div>
            <span>Comma-separated tag keys</span>
          </div>
          <div className="overflow-x-auto border-t border-line">
            <div className="min-w-[760px]">
              {tagQuery.data.rows.map((row) => (
                <ModuleTagRow
                  key={row.moduleCode}
                  row={row}
                  stagedChange={stagedByCode.get(row.moduleCode)}
                  storageKey={`${editorStoragePrefix}:tag:${row.moduleCode}`}
                  onStage={onStage}
                />
              ))}
            </div>
          </div>
          {tagQuery.data.rows.length === 0 ? (
            <p className="border-t border-line py-8 text-center text-sm text-muted">No modules found.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ModuleTagRow({
  row,
  stagedChange,
  storageKey,
  onStage
}: {
  row: {
    moduleCode: string;
    title: string;
    acadYear?: string;
    tags: string[];
    mapped: boolean;
  };
  stagedChange?: AdminModuleTagChange;
  storageKey: string;
  onStage: (change: AdminModuleTagChange, originalTags: string[]) => void;
}) {
  const isDeleted = stagedChange?.deleteMapping === true;
  const effectiveTags = stagedChange?.tags ?? row.tags;
  const [value, setValue] = useState(() => readLocalStorageValue(storageKey) ?? effectiveTags.join(", "));
  const [error, setError] = useState("");

  useEffect(() => {
    if (readLocalStorageValue(storageKey) === null) {
      setValue(effectiveTags.join(", "));
    }
  }, [effectiveTags.join("|"), storageKey]);

  function stage() {
    const tags = Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
    const invalidTag = tags.find((tag) => !/^[a-z0-9][a-z0-9-]*$/.test(tag));
    if (invalidTag) {
      setError(`Invalid tag: ${invalidTag}`);
      return;
    }
    setError("");
    removeLocalStorageValue(storageKey);
    onStage({ moduleCode: row.moduleCode, tags }, row.tags);
  }

  function deleteMapping() {
    setError("");
    setValue(row.tags.join(", "));
    removeLocalStorageValue(storageKey);
    onStage({ moduleCode: row.moduleCode, tags: [], deleteMapping: true }, row.tags);
  }

  function undoDelete() {
    setError("");
    setValue(row.tags.join(", "));
    removeLocalStorageValue(storageKey);
    onStage({ moduleCode: row.moduleCode, tags: row.tags }, row.tags);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[110px_minmax(180px,1fr)_minmax(260px,1.4fr)_144px] items-center gap-3 border-b border-line py-3 transition",
        isDeleted && "bg-white/[0.02] text-muted"
      )}
    >
      <div className={cn(isDeleted && "opacity-50")}>
        <p className="font-mono text-sm font-medium">{row.moduleCode}</p>
        <p className="mt-1 text-xs text-muted">{row.acadYear ?? "No catalogue year"}</p>
      </div>
      <p
        className={cn("truncate text-sm text-zinc-300", isDeleted && "opacity-50")}
        title={row.title}
      >
        {row.title}
      </p>
      <div className={cn(isDeleted && "opacity-50")}>
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            saveLocalStorageValue(storageKey, event.target.value);
          }}
          disabled={isDeleted}
          className="w-full"
        />
        {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
      </div>
      {isDeleted ? (
        <div className="px-2">
          <GhostButton className="w-full justify-center" onClick={undoDelete}>
            <Undo2 size={16} /> Undo
          </GhostButton>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <GhostButton className="flex-1 justify-center" onClick={stage}>
            {stagedChange ? "Update" : "Stage"}
          </GhostButton>
          {row.mapped ? (
            <IconButton label={`Delete ${row.moduleCode} mapping`} onClick={deleteMapping}>
              <Trash2 size={16} />
            </IconButton>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CloneCurriculumPanel({
  curricula,
  selectedKey,
  onCloned
}: {
  curricula: AdminCurriculumCatalogItem[];
  selectedKey: string;
  onCloned: (programme: Programme, cohort: string) => Promise<void>;
}) {
  const [sourceKey, setSourceKey] = useState(selectedKey);
  const [targetProgramme, setTargetProgramme] = useState<Programme>("computer-science");
  const [targetCohort, setTargetCohort] = useState("AY2026/27");
  const [preview, setPreview] = useState<AdminClonePreview | null>(null);
  const source = parseCurriculumKey(sourceKey || selectedKey);

  useEffect(() => {
    if (!sourceKey && selectedKey) {
      setSourceKey(selectedKey);
    }
  }, [selectedKey, sourceKey]);

  const previewMutation = useMutation({
    mutationFn: api.adminPreviewClone,
    onSuccess: setPreview
  });
  const cloneMutation = useMutation({
    mutationFn: api.adminCloneCurriculum,
    onSuccess: async ({ requirementSet }) => {
      await onCloned(requirementSet.programme, requirementSet.cohort);
    }
  });

  function buildInput(): AdminCloneCurriculum | null {
    if (!source) {
      return null;
    }
    const parsed = AdminCloneCurriculumSchema.safeParse({
      sourceProgramme: source.programme,
      sourceCohort: source.cohort,
      targetProgramme,
      targetCohort: targetCohort.trim()
    });
    return parsed.success ? parsed.data : null;
  }

  function resetPreview() {
    setPreview(null);
  }

  const input = buildInput();

  return (
    <section className="mt-5 max-w-5xl">
      <div className="grid gap-5 border-y border-line py-5 md:grid-cols-2">
        <Field label="Source curriculum">
          <div className="relative">
            <Select
              value={sourceKey || selectedKey}
              onChange={(event) => { setSourceKey(event.target.value); resetPreview(); }}
              className="w-full appearance-none px-4 pr-11"
            >
              {curricula.map((item) => (
                <option key={curriculumKey(item.programme, item.cohort)} value={curriculumKey(item.programme, item.cohort)}>
                  {programmeLabels[item.programme]} · {item.cohort} · v{item.latestVersion}
                </option>
              ))}
            </Select>
            <ChevronDown
              size={17}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Target programme">
            <div className="relative">
              <Select
                value={targetProgramme}
                onChange={(event) => { setTargetProgramme(event.target.value as Programme); resetPreview(); }}
                className="w-full appearance-none px-4 pr-11"
              >
                {programmeValues.map((programme) => (
                  <option key={programme} value={programme}>{programmeLabels[programme]}</option>
                ))}
              </Select>
              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </Field>
          <Field label="Target cohort">
            <Input value={targetCohort} onChange={(event) => { setTargetCohort(event.target.value); resetPreview(); }} className="w-full" />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <GhostButton disabled={!input || previewMutation.isPending} onClick={() => input && previewMutation.mutate(input)}>
          <ClipboardCheck size={16} /> {previewMutation.isPending ? "Checking..." : "Preview clone"}
        </GhostButton>
        <Button
          disabled={!input || !preview?.canClone || cloneMutation.isPending}
          onClick={() => {
            if (input && window.confirm(`Create ${programmeLabels[input.targetProgramme]} ${input.targetCohort} from the selected source?`)) {
              cloneMutation.mutate(input);
            }
          }}
        >
          <Copy size={16} /> {cloneMutation.isPending ? "Cloning..." : "Create cloned cohort"}
        </Button>
      </div>

      {previewMutation.error ? <ErrorBanner error={previewMutation.error} /> : null}
      {cloneMutation.error ? <ErrorBanner error={cloneMutation.error} /> : null}
      {preview ? (
        <div className="mt-5 grid gap-0 border border-line md:grid-cols-2">
          <div className="border-b border-line p-5 md:border-b-0 md:border-r">
            <p className="text-xs font-medium uppercase text-muted">Source</p>
            <h2 className="mt-2 font-semibold">{programmeLabels[preview.source.programme]}</h2>
            <p className="mt-1 text-sm text-muted">{preview.source.cohort} · version {preview.source.version}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <Stat label="Units" value={String(preview.source.totalUnits)} />
              <Stat label="Rules" value={String(preview.source.ruleCount)} />
              <Stat label="Tags" value={String(preview.source.tagCount)} />
            </dl>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium uppercase text-muted">Target</p>
            <h2 className="mt-2 font-semibold">{programmeLabels[preview.target.programme]}</h2>
            <p className="mt-1 text-sm text-muted">{preview.target.cohort} · starts at version 1</p>
            <div className={cn(
              "mt-5 flex items-start gap-2 border p-3 text-sm",
              preview.canClone ? "border-emerald-900/70 bg-emerald-950/30 text-emerald-200" : "border-red-900/70 bg-red-950/30 text-red-200"
            )}>
              {preview.canClone ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" />}
              <span>{preview.canClone ? "Target is clear. Rules, source note, total units, and module tags will be copied." : preview.conflicts.join(" ")}</span>
            </div>
            {preview.warnings.length > 0 ? (
              <div className="mt-3 flex items-start gap-2 border border-amber-800/70 bg-amber-950/30 p-3 text-amber-200">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <ul className="space-y-1 text-xs leading-5">
                  {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ValidationSummary({ result, current }: { result: AdminValidationResult; current: boolean }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className={cn("flex items-center gap-2 text-sm font-medium", result.valid && current ? "text-emerald-300" : "text-amber-300")}>
        {result.valid && current ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        {current ? (result.valid ? "Ready to publish" : "Validation failed") : "Draft changed after validation"}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <Stat label="Mapped modules" value={String(result.stats.mappedModuleCount)} />
        <Stat label="Sample plans" value={String(result.stats.samplePlansEvaluated)} />
      </dl>
      {result.errors.length > 0 ? (
        <ul className="mt-3 space-y-2 text-xs leading-5 text-red-300">
          {result.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-200">
          {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {result.samplePlans.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
          {result.samplePlans.map((sample) => (
            <div key={sample.sample} className="flex items-center justify-between gap-3 text-muted">
              <span>Sample {sample.sample}</span>
              <span>{sample.fulfilledRules}/{sample.totalRules} rules · {sample.completedUnits} units</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-white/5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
      {...props}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ error, compact = false }: { error: Error; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2 border border-red-900/70 bg-red-950/30 text-sm text-red-200", compact ? "mt-3 p-3 text-xs" : "mt-5 p-4")}>
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <span>{error.message}</span>
    </div>
  );
}

function toDraft(requirementSet: RequirementSet): AdminCurriculumDraft {
  return {
    programme: requirementSet.programme,
    cohort: requirementSet.cohort,
    baseVersion: requirementSet.version,
    totalUnits: requirementSet.totalUnits,
    sourceNote: requirementSet.sourceNote,
    rules: requirementSet.rules,
    tagChanges: []
  };
}

function curriculumKey(programme: Programme, cohort: string): string {
  return `${programme}::${cohort}`;
}

function parseCurriculumKey(key: string): { programme: Programme; cohort: string } | null {
  const [programme, cohort] = key.split("::");
  const parsedCohort = CohortSchema.safeParse(cohort);
  if (!programme || !programmeValues.includes(programme as Programme) || !parsedCohort.success) {
    return null;
  }
  return { programme: programme as Programme, cohort: parsedCohort.data };
}

function uniqueRuleId(rules: RequirementRule[], preferred = "new-requirement"): string {
  const existing = new Set(rules.map((rule) => rule.id));
  if (!existing.has(preferred)) {
    return preferred;
  }
  let suffix = 2;
  while (existing.has(`${preferred}-${suffix}`)) {
    suffix += 1;
  }
  return `${preferred}-${suffix}`;
}

function summarizeDraftChanges(draft: AdminCurriculumDraft, current?: RequirementSet) {
  if (!current) {
    return {
      ruleChanges: draft.rules.length,
      details: ["New curriculum", `${draft.rules.length} rules added`, `${draft.tagChanges.length} tag mappings staged`]
    };
  }

  const currentRules = new Map(current.rules.map((rule) => [rule.id, JSON.stringify(rule)]));
  const draftRules = new Map(draft.rules.map((rule) => [rule.id, JSON.stringify(rule)]));
  const added = draft.rules.filter((rule) => !currentRules.has(rule.id)).length;
  const removed = current.rules.filter((rule) => !draftRules.has(rule.id)).length;
  const changed = draft.rules.filter((rule) => {
    const existing = currentRules.get(rule.id);
    return existing !== undefined && existing !== JSON.stringify(rule);
  }).length;
  const tagDeletionCount = draft.tagChanges.filter((change) => change.deleteMapping).length;
  const tagChangeCount = draft.tagChanges.length - tagDeletionCount;
  const details = [
    ...(draft.totalUnits !== current.totalUnits ? [`Total units: ${current.totalUnits} to ${draft.totalUnits}`] : []),
    ...(draft.sourceNote !== current.sourceNote ? ["Source note updated"] : []),
    ...(added > 0 ? [`${added} rule${added === 1 ? "" : "s"} added`] : []),
    ...(changed > 0 ? [`${changed} rule${changed === 1 ? "" : "s"} changed`] : []),
    ...(removed > 0 ? [`${removed} rule${removed === 1 ? "" : "s"} removed`] : []),
    ...(tagChangeCount > 0
      ? [`${tagChangeCount} module tag change${tagChangeCount === 1 ? "" : "s"}`]
      : []),
    ...(tagDeletionCount > 0
      ? [`${tagDeletionCount} module tag deletion${tagDeletionCount === 1 ? "" : "s"}`]
      : [])
  ];

  return { ruleChanges: added + changed + removed, details };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function adminDashboardStorageKey(userId: string): string {
  return `the-cs-plan:administrator:v1:${userId}`;
}

function adminCurriculumDraftStorageKey(userId: string, programme: Programme, cohort: string): string {
  return `${adminDashboardStorageKey(userId)}:draft:${curriculumKey(programme, cohort)}`;
}

function adminModuleTagSearchStorageKey(userId: string, key: string): string {
  return `${adminDashboardStorageKey(userId)}:module-tag-search:${key}`;
}

function adminEditorStoragePrefix(userId: string, programme: Programme, cohort: string): string {
  return `${adminDashboardStorageKey(userId)}:editor:${curriculumKey(programme, cohort)}`;
}

function ruleEditorStorageKey(prefix: string, ruleId: string): string {
  return `${prefix}:rule:${encodeURIComponent(ruleId)}`;
}

function loadAdminDashboardState(userId: string): PersistedAdminDashboardState | null {
  const raw = readLocalStorageValue(adminDashboardStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAdminDashboardState>;
    const activeTabIsValid = adminTabs.some((tab) => tab.id === parsed.activeTab);
    const selectedKeyIsValid = parsed.selectedKey === "" || Boolean(parseCurriculumKey(parsed.selectedKey ?? ""));
    if (parsed.version !== 1 || !activeTabIsValid || !selectedKeyIsValid) {
      return null;
    }
    return {
      version: 1,
      activeTab: parsed.activeTab!,
      selectedKey: parsed.selectedKey!,
      isNewCurriculum: parsed.isNewCurriculum === true
    };
  } catch {
    return null;
  }
}

function saveAdminDashboardState(
  userId: string,
  state: Omit<PersistedAdminDashboardState, "version">
) {
  saveLocalStorageValue(
    adminDashboardStorageKey(userId),
    JSON.stringify({ version: 1, ...state } satisfies PersistedAdminDashboardState)
  );
}

function loadAdminModuleTagSearchState(userId: string, key: string): ModuleTagSearchState {
  const raw = readLocalStorageValue(adminModuleTagSearchStorageKey(userId, key));
  if (!raw) {
    return initialModuleTagSearchState;
  }

  try {
    const parsed = ModuleTagSearchStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : initialModuleTagSearchState;
  } catch {
    return initialModuleTagSearchState;
  }
}

function saveAdminModuleTagSearchState(
  userId: string,
  key: string,
  state: ModuleTagSearchState
) {
  saveLocalStorageValue(adminModuleTagSearchStorageKey(userId, key), JSON.stringify(state));
}

function loadAdminCurriculumDraft(userId: string, key: string): AdminCurriculumDraft | null {
  const selected = parseCurriculumKey(key);
  if (!selected) {
    return null;
  }
  const raw = readLocalStorageValue(
    adminCurriculumDraftStorageKey(userId, selected.programme, selected.cohort)
  );
  if (!raw) {
    return null;
  }

  try {
    const parsed = LocalAdminCurriculumDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success && curriculumKey(parsed.data.programme, parsed.data.cohort) === key
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

function saveAdminCurriculumDraft(userId: string, draft: AdminCurriculumDraft) {
  saveLocalStorageValue(
    adminCurriculumDraftStorageKey(userId, draft.programme, draft.cohort),
    JSON.stringify(draft)
  );
}

function removeAdminCurriculumDraft(userId: string, programme: Programme, cohort: string) {
  removeLocalStorageValue(adminCurriculumDraftStorageKey(userId, programme, cohort));
}

function getRuleEditorError(value: string): string {
  try {
    const parsed = RequirementRuleSchema.safeParse(JSON.parse(value));
    return parsed.success
      ? ""
      : parsed.error.issues[0]?.message ?? "Invalid requirement rule";
  } catch {
    return "Rule JSON is not valid yet.";
  }
}

function readLocalStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveLocalStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The dashboard remains usable when browser storage is unavailable.
  }
}

function removeLocalStorageValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // The dashboard remains usable when browser storage is unavailable.
  }
}

function clearEditorStoragePrefix(prefix: string) {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // The dashboard remains usable when browser storage is unavailable.
  }
}
