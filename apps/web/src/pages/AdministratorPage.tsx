import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  FilePlus2,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  X
} from "lucide-react";
import { Navigate } from "react-router-dom";
import {
  AdminCloneCurriculumSchema,
  CohortSchema,
  programmeLabels,
  programmeValues,
  RequirementRuleSchema,
  type AdminCloneCurriculum,
  type AdminCurriculumDraft,
  type AdminModuleTagChange,
  type Programme,
  type RequirementRule,
  type RequirementSet
} from "@the-cs-plan/shared";
import { Button, GhostButton, Input, Select, Textarea } from "../components/ui";
import {
  api,
  type AdminClonePreview,
  type AdminCurriculumCatalogItem,
  type AdminValidationResult
} from "../lib/api";
import { cn } from "../lib/utils";

type AdminTab = "requirements" | "tags" | "clone";

const adminTabs: Array<{ id: AdminTab; label: string; icon: typeof Database }> = [
  { id: "requirements", label: "Requirement sets", icon: Database },
  { id: "tags", label: "Module tags", icon: Tags },
  { id: "clone", label: "Clone cohort", icon: Copy }
];

const newRule: RequirementRule = {
  id: "new-requirement",
  label: "New requirement",
  type: "units-from-tags",
  requiredUnits: 4,
  acceptedTags: ["new-tag"]
};

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
  const [showCreate, setShowCreate] = useState(false);
  const [newProgramme, setNewProgramme] = useState<Programme>("computer-science");
  const [newCohort, setNewCohort] = useState("AY2026/27");
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState<AdminCurriculumDraft | null>(null);
  const [validation, setValidation] = useState<AdminValidationResult | null>(null);
  const [validatedFingerprint, setValidatedFingerprint] = useState("");

  const curricula = catalogQuery.data?.curricula ?? [];
  const selected = parseCurriculumKey(selectedKey);
  const curriculumQuery = useQuery({
    queryKey: ["admin", "curriculum", selected?.programme, selected?.cohort],
    queryFn: () => api.adminGetCurriculum(selected!.programme, selected!.cohort),
    enabled: Boolean(selected && !isNewCurriculum && meQuery.data?.user.role === "admin")
  });

  useEffect(() => {
    if (!selectedKey && curricula[0]) {
      setSelectedKey(curriculumKey(curricula[0].programme, curricula[0].cohort));
    }
  }, [curricula, selectedKey]);

  useEffect(() => {
    if (!curriculumQuery.data || isNewCurriculum) {
      return;
    }
    setDraft(toDraft(curriculumQuery.data));
    setValidation(null);
    setValidatedFingerprint("");
  }, [curriculumQuery.data, isNewCurriculum]);

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
    setSelectedKey(key);
    setIsNewCurriculum(false);
    setDraft(null);
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

    setSelectedKey(key);
    setIsNewCurriculum(true);
    setDraft({
      programme: newProgramme,
      cohort: parsedCohort.data,
      baseVersion: 0,
      totalUnits: 160,
      sourceNote: "",
      rules: [newRule],
      tagChanges: []
    });
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
    const matchesOriginal = arraysEqual(change.tags, originalTags);
    const otherChanges = draft.tagChanges.filter((item) => item.moduleCode !== change.moduleCode);
    updateDraft({
      tagChanges: matchesOriginal ? otherChanges : [...otherChanges, change]
    });
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
          <p className="mt-1 text-sm text-muted">Curriculum publishing and module classification</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Selected curriculum"
            value={selectedKey}
            onChange={(event) => selectCurriculum(event.target.value)}
            className="min-w-64"
          >
            {curricula.map((item) => (
              <option key={curriculumKey(item.programme, item.cohort)} value={curriculumKey(item.programme, item.cohort)}>
                {programmeLabels[item.programme]} · {item.cohort} · v{item.latestVersion}
              </option>
            ))}
            {isNewCurriculum && draft ? (
              <option value={curriculumKey(draft.programme, draft.cohort)}>
                {programmeLabels[draft.programme]} · {draft.cohort} · New
              </option>
            ) : null}
          </Select>
          <GhostButton onClick={() => setShowCreate((current) => !current)}>
            <FilePlus2 size={16} /> New curriculum
          </GhostButton>
        </div>
      </div>

      {showCreate ? (
        <div className="grid gap-3 border-b border-line bg-panel/40 p-4 md:grid-cols-[minmax(240px,1fr)_180px_auto_auto] md:items-end">
          <Field label="Programme">
            <Select value={newProgramme} onChange={(event) => setNewProgramme(event.target.value as Programme)} className="w-full">
              {programmeValues.map((programme) => (
                <option key={programme} value={programme}>{programmeLabels[programme]}</option>
              ))}
            </Select>
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

      <div className="mt-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-md border border-line bg-panel p-1">
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
          diff={diff!}
          validation={validation}
          validationCurrent={validatedFingerprint === fingerprint}
          validatePending={validateMutation.isPending}
          publishPending={publishMutation.isPending}
          validateError={validateMutation.error}
          publishError={publishMutation.error}
          canPublish={canPublish}
          onChange={updateDraft}
          onValidate={() => validateMutation.mutate(draft)}
          onPublish={() => {
            if (window.confirm(`Publish ${programmeLabels[draft.programme]} ${draft.cohort} as version ${draft.baseVersion + 1}?`)) {
              publishMutation.mutate(draft);
            }
          }}
        />
      ) : null}

      {draft && activeTab === "tags" ? (
        <ModuleTagEditor draft={draft} onStage={stageTagChange} onClear={() => updateDraft({ tagChanges: [] })} />
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
  );
}

function RequirementSetEditor({
  draft,
  diff,
  validation,
  validationCurrent,
  validatePending,
  publishPending,
  validateError,
  publishError,
  canPublish,
  onChange,
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
  onChange: (update: Partial<AdminCurriculumDraft>) => void;
  onValidate: () => void;
  onPublish: () => void;
}) {
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

  return (
    <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0">
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
            <p className="mt-1 text-xs text-muted">{draft.rules.length} rules in draft version {draft.baseVersion + 1}</p>
          </div>
          <GhostButton onClick={() => onChange({ rules: [...draft.rules, { ...newRule, id: uniqueRuleId(draft.rules) }] })}>
            <Plus size={16} /> Add rule
          </GhostButton>
        </div>

        <div className="border-t border-line">
          {draft.rules.map((rule, index) => (
            <RuleEditor
              key={`${rule.id}:${index}`}
              rule={rule}
              index={index}
              count={draft.rules.length}
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
                  onChange({ rules: draft.rules.filter((_, currentIndex) => currentIndex !== index) });
                }
              }}
            />
          ))}
        </div>
      </section>

      <aside className="self-start border border-line bg-panel p-4 xl:sticky xl:top-21">
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
        </div>

        {validateError ? <ErrorBanner error={validateError} compact /> : null}
        {publishError ? <ErrorBanner error={publishError} compact /> : null}
        {validation ? (
          <ValidationSummary result={validation} current={validationCurrent} />
        ) : (
          <p className="mt-4 text-xs leading-5 text-muted">Validation is required after every draft change.</p>
        )}
      </aside>
    </div>
  );
}

function RuleEditor({
  rule,
  index,
  count,
  onChange,
  onMove,
  onDuplicate,
  onDelete
}: {
  rule: RequirementRule;
  index: number;
  count: number;
  onChange: (rule: RequirementRule) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(rule, null, 2));
  const [error, setError] = useState("");

  function updateJson(value: string) {
    setText(value);
    try {
      const parsedJson = JSON.parse(value) as unknown;
      const parsedRule = RequirementRuleSchema.safeParse(parsedJson);
      if (!parsedRule.success) {
        setError(parsedRule.error.issues[0]?.message ?? "Invalid requirement rule");
        return;
      }
      setError("");
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
          <IconButton label="Move up" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={15} /></IconButton>
          <IconButton label="Move down" onClick={() => onMove(1)} disabled={index === count - 1}><ArrowDown size={15} /></IconButton>
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
  onStage,
  onClear
}: {
  draft: AdminCurriculumDraft;
  onStage: (change: AdminModuleTagChange, originalTags: string[]) => void;
  onClear: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const tagQuery = useQuery({
    queryKey: ["admin", "module-tags", draft.programme, draft.cohort, query],
    queryFn: () => api.adminSearchModuleTags(draft.programme, draft.cohort, query)
  });
  const stagedByCode = useMemo(
    () => new Map(draft.tagChanges.map((change) => [change.moduleCode, change.tags])),
    [draft.tagChanges]
  );

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-y border-line py-5">
        <form
          className="flex w-full max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(searchInput.trim());
          }}
        >
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search module code or title"
            className="min-w-0 flex-1"
          />
          <Button><Search size={16} /> Search</Button>
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
          <div className="flex items-center justify-between py-4 text-xs text-muted">
            <span>{query ? `${tagQuery.data.rows.length} search results` : `${tagQuery.data.total} mapped modules`}</span>
            <span>Comma-separated tag keys</span>
          </div>
          <div className="overflow-x-auto border-t border-line">
            <div className="min-w-[760px]">
              {tagQuery.data.rows.map((row) => (
                <ModuleTagRow
                  key={row.moduleCode}
                  row={row}
                  stagedTags={stagedByCode.get(row.moduleCode)}
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
  stagedTags,
  onStage
}: {
  row: { moduleCode: string; title: string; acadYear?: string; tags: string[] };
  stagedTags?: string[];
  onStage: (change: AdminModuleTagChange, originalTags: string[]) => void;
}) {
  const effectiveTags = stagedTags ?? row.tags;
  const [value, setValue] = useState(effectiveTags.join(", "));
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(effectiveTags.join(", "));
  }, [effectiveTags.join("|")]);

  function stage() {
    const tags = Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
    const invalidTag = tags.find((tag) => !/^[a-z0-9][a-z0-9-]*$/.test(tag));
    if (invalidTag) {
      setError(`Invalid tag: ${invalidTag}`);
      return;
    }
    setError("");
    onStage({ moduleCode: row.moduleCode, tags }, row.tags);
  }

  return (
    <div className="grid grid-cols-[110px_minmax(180px,1fr)_minmax(260px,1.4fr)_100px] items-center gap-3 border-b border-line py-3">
      <div>
        <p className="font-mono text-sm font-medium">{row.moduleCode}</p>
        <p className="mt-1 text-xs text-muted">{row.acadYear ?? "No catalogue year"}</p>
      </div>
      <p className="truncate text-sm text-zinc-300" title={row.title}>{row.title}</p>
      <div>
        <Input value={value} onChange={(event) => setValue(event.target.value)} className="w-full" />
        {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
      </div>
      <GhostButton onClick={stage}>{stagedTags ? "Update" : "Stage"}</GhostButton>
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
          <Select
            value={sourceKey || selectedKey}
            onChange={(event) => { setSourceKey(event.target.value); resetPreview(); }}
            className="w-full"
          >
            {curricula.map((item) => (
              <option key={curriculumKey(item.programme, item.cohort)} value={curriculumKey(item.programme, item.cohort)}>
                {programmeLabels[item.programme]} · {item.cohort} · v{item.latestVersion}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Target programme">
            <Select
              value={targetProgramme}
              onChange={(event) => { setTargetProgramme(event.target.value as Programme); resetPreview(); }}
              className="w-full"
            >
              {programmeValues.map((programme) => (
                <option key={programme} value={programme}>{programmeLabels[programme]}</option>
              ))}
            </Select>
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
              <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200">
                {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
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
  if (!programme || !cohort || !programmeValues.includes(programme as Programme)) {
    return null;
  }
  return { programme: programme as Programme, cohort };
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
  const details = [
    ...(draft.totalUnits !== current.totalUnits ? [`Total units: ${current.totalUnits} to ${draft.totalUnits}`] : []),
    ...(draft.sourceNote !== current.sourceNote ? ["Source note updated"] : []),
    ...(added > 0 ? [`${added} rule${added === 1 ? "" : "s"} added`] : []),
    ...(changed > 0 ? [`${changed} rule${changed === 1 ? "" : "s"} changed`] : []),
    ...(removed > 0 ? [`${removed} rule${removed === 1 ? "" : "s"} removed`] : []),
    ...(draft.tagChanges.length > 0 ? [`${draft.tagChanges.length} module tag change${draft.tagChanges.length === 1 ? "" : "s"}`] : [])
  ];

  return { ruleChanges: added + changed + removed, details };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
