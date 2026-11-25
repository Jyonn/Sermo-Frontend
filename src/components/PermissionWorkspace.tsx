import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import { isChineseLanguage, type TranslationKey } from "../lib/i18n";
import { FeedbackState } from "./FeedbackState";
import { SelectControl, SettingSwitch } from "./SettingRow";
import { GroupParticipationSelect, PermissionEffectiveMatrix } from "./PermissionEffectiveMatrix";
import type { CapabilityCatalogDTO, CapabilityDraftDTO, CapabilityNodeDTO, CapabilityPreviewOptions, CapabilityRestrictionDTO, CapabilitySimulationRowDTO, CapabilitySpaceContext, PolicyExpression } from "../types";
import "../styles/permission-workspace.css";

type Scope = "platform" | "space";
type Draft = CapabilityDraftDTO;
type Atom = Extract<PolicyExpression, { field: string }>;
type CapabilityEntry = CapabilityNodeDTO & { depth: number };

const EMPTY_DRAFT: Draft = { enabled: true, requirement: {}, denial: {}, limits: {} };
const FIELD_META: Record<string, { label: TranslationKey; kind: "number" | "boolean"; min?: number; max?: number }> = {
  growth_level: { label: "permission.field.growthLevel", kind: "number", min: 1, max: 18 },
  has_password: { label: "permission.field.hasPassword", kind: "boolean" },
  verified: { label: "permission.field.verified", kind: "boolean" },
  email_verified: { label: "permission.field.emailVerified", kind: "boolean" },
  phone_verified: { label: "permission.field.phoneVerified", kind: "boolean" },
  dual_verified: { label: "permission.field.dualVerified", kind: "boolean" },
  permanent_vip: { label: "permission.field.permanentVip", kind: "boolean" },
  official: { label: "permission.field.official", kind: "boolean" },
  chat_enabled: { label: "permission.field.chatEnabled", kind: "boolean" },
  square_enabled: { label: "permission.field.squareEnabled", kind: "boolean" },
  square_explore_enabled: { label: "permission.field.squareExploreEnabled", kind: "boolean" },
  square_free_post_enabled: { label: "permission.field.squareFreePostEnabled", kind: "boolean" },
  space_phone_verified: { label: "permission.field.spacePhoneVerified", kind: "boolean" },
  space_identity_verified: { label: "permission.field.spaceIdentityVerified", kind: "boolean" },
  unverified_group_policy: { label: "permission.field.unverifiedGroupPolicy", kind: "number", min: 0, max: 2 },
  qr_invite: { label: "permission.field.qrInvite", kind: "boolean" },
  wechat_miniprogram: { label: "permission.field.wechatMiniprogram", kind: "boolean" },
};

function isAtom(value: PolicyExpression): value is Atom {
  return Boolean(value && "field" in value);
}

function defaultAtom(): Atom {
  return { field: "growth_level", op: "gte", value: 1 };
}

function expressionRows(expression: PolicyExpression): { mode: "all" | "any"; rows: Array<{ atom: Atom; negated: boolean }> } {
  if (!expression || Object.keys(expression).length === 0) return { mode: "all", rows: [] };
  let mode: "all" | "any" = "all";
  let values: PolicyExpression[] = [expression];
  if ("any" in expression) {
    mode = "any";
    values = expression.any;
  } else if ("all" in expression) {
    values = expression.all;
  }
  return {
    mode,
    rows: values.map((value) => {
      if ("not" in value && isAtom(value.not)) return { atom: value.not, negated: true };
      return { atom: isAtom(value) ? value : defaultAtom(), negated: false };
    }),
  };
}

function rowsExpression(mode: "all" | "any", rows: Array<{ atom: Atom; negated: boolean }>): PolicyExpression {
  if (!rows.length) return {};
  const values = rows.map((row) => row.negated ? { not: row.atom } satisfies PolicyExpression : row.atom);
  return values.length === 1 ? values[0] : { [mode]: values } as PolicyExpression;
}

function hasExpression(expression: PolicyExpression | undefined) {
  return Boolean(expression && Object.keys(expression).length);
}

function formatExpression(expression: PolicyExpression, t: TFunction): string {
  if (!hasExpression(expression)) return t("permission.noCondition");
  if ("all" in expression) return expression.all.map((item) => "any" in item ? `(${formatExpression(item, t)})` : formatExpression(item, t)).join(` ${t("permission.logic.and")} `);
  if ("any" in expression) return expression.any.map((item) => "all" in item ? `(${formatExpression(item, t)})` : formatExpression(item, t)).join(` ${t("permission.logic.or")} `);
  if ("not" in expression) return `${t("permission.logic.not")} (${formatExpression(expression.not, t)})`;
  if (!isAtom(expression)) return t("permission.noCondition");
  const meta = FIELD_META[expression.field];
  const label = meta ? t(meta.label as "permission.field.growthLevel") : expression.field;
  const operator = ({ eq: "=", neq: "≠", gte: "≥", gt: ">", lte: "≤", lt: "<", in: "∈", not_in: "∉", exists: "∃" } as Record<string, string>)[expression.op] ?? expression.op;
  const value = typeof expression.value === "boolean"
    ? t(expression.value ? "common.yes" : "common.no")
    : Array.isArray(expression.value) ? expression.value.join(", ") : String(expression.value);
  return `${label} ${operator} ${value}`;
}

function capabilityChain(entries: CapabilityEntry[], selected: CapabilityEntry) {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const result: CapabilityEntry[] = [];
  let current: CapabilityEntry | undefined = selected;
  while (current) {
    result.unshift(current);
    current = current.parent ? byKey.get(current.parent) : undefined;
  }
  return result;
}

function supportsSimpleEditor(expression: PolicyExpression) {
  if (!hasExpression(expression)) return true;
  const values = "all" in expression ? expression.all : "any" in expression ? expression.any : [expression];
  return values.every((item) => {
    const atom = "not" in item ? item.not : item;
    if (!isAtom(atom) || !FIELD_META[atom.field]) return false;
    return FIELD_META[atom.field].kind === "boolean" ? atom.op === "eq" && typeof atom.value === "boolean"
      : ["gte", "gt", "eq", "lte", "lt"].includes(atom.op) && typeof atom.value === "number";
  });
}

function isPolicyExpression(input: unknown, depth = 0): input is PolicyExpression {
  if (!input || typeof input !== "object" || Array.isArray(input) || depth > 8) return false;
  const item = input as Record<string, unknown>;
  const keys = Object.keys(item);
  if (!keys.length) return true;
  if (keys.length === 1) {
    if ("not" in item) return isPolicyExpression(item.not, depth + 1);
    const children = item.all ?? item.any;
    return Array.isArray(children) && children.length > 0 && children.every((child) => isPolicyExpression(child, depth + 1));
  }
  if (keys.length !== 3 || typeof item.field !== "string" || !FIELD_META[item.field] || typeof item.op !== "string" || !("value" in item)) return false;
  return ["eq", "neq", "gte", "gt", "lte", "lt", "in", "not_in", "exists"].includes(item.op);
}

function AdvancedExpression({ value, onChange, t }: { value: PolicyExpression; onChange: (value: PolicyExpression) => void; t: TFunction }) {
  const [source, setSource] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState(false);
  return <details className="permission-advanced-expression">
    <summary>{formatExpression(value, t)}</summary>
    <textarea aria-label={t("permission.expressionSource")} value={source} onChange={(event) => { setSource(event.target.value); setError(false); }} />
    <button className="ghost-button" type="button" onClick={() => {
      try {
        const next = JSON.parse(source);
        if (!isPolicyExpression(next)) throw new Error();
        onChange(next);
      } catch { setError(true); }
    }}>{t("permission.applyExpression")}</button>
    {error && <p role="alert">{t("permission.invalidExpression")}</p>}
  </details>;
}

function RuleEditor({ value, onChange, t }: { value: PolicyExpression; onChange: (value: PolicyExpression) => void; t: TFunction }) {
  if (!supportsSimpleEditor(value)) return <AdvancedExpression key={JSON.stringify(value)} value={value} onChange={onChange} t={t} />;
  const model = expressionRows(value);
  const updateRows = (rows: typeof model.rows, mode = model.mode) => onChange(rowsExpression(mode, rows));
  return <div className="permission-rule-editor">
    <header>
      <div className="permission-segmented">
        <button className={model.mode === "all" ? "is-active" : ""} onClick={() => updateRows(model.rows, "all")} type="button">{t("permission.meetAll")}</button>
        <button className={model.mode === "any" ? "is-active" : ""} onClick={() => updateRows(model.rows, "any")} type="button">{t("permission.meetAny")}</button>
      </div>
      <button className="permission-add-rule" onClick={() => updateRows([...model.rows, { atom: defaultAtom(), negated: false }])} type="button"><span className="material-symbols-outlined">add</span>{t("permission.condition")}</button>
    </header>
    {model.rows.length ? <div className="permission-rule-list">{model.rows.map((row, index) => {
      const meta = FIELD_META[row.atom.field] ?? FIELD_META.growth_level;
      return <div className="permission-rule-row" key={`${row.atom.field}-${index}`}>
        <button aria-pressed={row.negated} className={`permission-not ${row.negated ? "is-active" : ""}`} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, negated: !item.negated } : item))} title="NOT" type="button">NOT</button>
        <label><span>{t("permission.attribute")}</span><SelectControl compact label={t('permission.attribute')} value={row.atom.field} options={Object.entries(FIELD_META).map(([value,item])=>({value,label:t(item.label as 'permission.field.growthLevel')}))} onChange={(field) => {
          const nextMeta = FIELD_META[field];
          const atom: Atom = { field, op: nextMeta.kind === "boolean" ? "eq" : "gte", value: nextMeta.kind === "boolean" ? true : nextMeta.min ?? 0 };
          updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom } : item));
        }}/></label>
        {meta.kind === "number" ? <><label><span>{t("permission.relation")}</span><SelectControl compact label={t('permission.relation')} value={row.atom.op} options={[{value:'gte',label:'≥'},{value:'gt',label:'>'},{value:'eq',label:'='},{value:'lte',label:'≤'},{value:'lt',label:'<'}]} onChange={op=>updateRows(model.rows.map((item,itemIndex)=>itemIndex===index?{...item,atom:{...item.atom,op}}:item))}/></label><label className="permission-rule-value"><span>{t("permission.value")}</span><input max={meta.max} min={meta.min} type="number" value={Number(row.atom.value)} onChange={(event) => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, value: Number(event.target.value) } } : item))} /></label></> : <div className="permission-boolean"><button className={row.atom.value === true ? "is-active" : ""} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, op: "eq", value: true } } : item))} type="button">{t("common.yes")}</button><button className={row.atom.value === false ? "is-active" : ""} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, op: "eq", value: false } } : item))} type="button">{t("common.no")}</button></div>}
        <button aria-label={t("permission.removeCondition")} className="permission-remove-rule" onClick={() => updateRows(model.rows.filter((_, itemIndex) => itemIndex !== index))} type="button"><span className="material-symbols-outlined">close</span></button>
      </div>;
    })}</div> : <div className="permission-empty-rules"><span className="material-symbols-outlined">all_inclusive</span><span>{t("permission.noExtraCondition")}</span></div>}
  </div>;
}

function flatten(nodes: CapabilityNodeDTO[], depth = 0): Array<CapabilityNodeDTO & { depth: number }> {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

function InheritedPolicySummary({ entries, language, scope, selected, t }: { entries: CapabilityEntry[]; language: string; scope: Scope; selected: CapabilityEntry; t: TFunction }) {
  const chain = capabilityChain(entries, selected);
  const rows: Array<{ key: string; source: "platform" | "space" | "default"; title: string; label: string }> = [];
  chain.forEach((entry) => {
    const title = isChineseLanguage(language) ? entry.title : entry.title_en;
    if (hasExpression(entry.requirement)) rows.push({
      key: `${entry.key}:default`, source: "default", title,
      label: `${t("permission.allowIf")} · ${formatExpression(entry.requirement, t)}`,
    });
    const inherited = [
      { source: "platform" as const, policy: scope === "space" || entry.key !== selected.key ? entry.platform_policy : null },
      { source: "space" as const, policy: scope === "space" && entry.key !== selected.key ? entry.space_policy : null },
    ];
    for (const { source, policy } of inherited) {
      if (!policy) continue;
      const key = `${entry.key}:${source}`;
      if (policy.enabled === false) rows.push({ key: key + ":closed", source, title, label: t("permission.closed") });
      if (hasExpression(policy.requirement) && JSON.stringify(policy.requirement) !== JSON.stringify(entry.requirement)) rows.push({
        key: key + ":allow", source, title, label: `${t("permission.allowIf")} · ${formatExpression(policy.requirement, t)}`,
      });
      if (hasExpression(policy.denial)) rows.push({
        key: key + ":deny", source, title, label: `${t("permission.denyIf")} · ${formatExpression(policy.denial, t)}`,
      });
    }
  });
  if (!rows.length) return <p className="permission-no-inherited">{t("permission.noInheritedRules")}</p>;
  return <details className="permission-inherited-summary">
    <summary><span>{t("permission.inheritedCount", { count: rows.length })}</span><span aria-hidden="true" className="material-symbols-outlined">expand_more</span></summary>
    <p className="permission-inherited-hint">{t("permission.inheritedRulesHint")}</p>
    <div>{rows.map((row) => <article key={row.key}><span>{t(`permission.source.${row.source}`)}</span><p><strong>{row.title}</strong><small>{row.label}</small></p></article>)}</div>
  </details>;
}

function policyFor(node: CapabilityNodeDTO, scope: Scope) {
  return scope === "platform" ? node.platform_policy : node.space_policy;
}

const spaceModulesKey = "space-modules";
const flashKey = "chat.message.flash_image";
type GroupMode = CapabilitySpaceContext["unverified_group_policy"];

function policyDraft(node: CapabilityNodeDTO, scope: Scope): Draft {
  const saved = policyFor(node, scope);
  return saved ? { enabled: saved.enabled !== false, requirement: saved.requirement, denial: saved.denial, limits: saved.limits } : EMPTY_DRAFT;
}

export function PermissionWorkspace({ scope, initialCapability, spaceModules }: {
  scope: Scope;
  initialCapability?: string;
  spaceModules?: ReactNode;
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const [catalog, setCatalog] = useState<CapabilityCatalogDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState(initialCapability ?? (spaceModules ? spaceModulesKey : ""));
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [simulation, setSimulation] = useState<CapabilitySimulationRowDTO[]>([]);
  const [previewOptions, setPreviewOptions] = useState<CapabilityPreviewOptions>({ space_verification: "phone" });
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
  const [pendingGroup, setPendingGroup] = useState<GroupMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosingCapability, setChoosingCapability] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set(["menu", "contacts", "square", "chat.message.send"]));
  const capabilityPicker = useRef<HTMLButtonElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const capabilityDirectoryId = useId();

  const chooseCapability = (key: string) => {
    if (key !== selectedKey) setSimulation([]);
    setSelectedKey(key);
    setChoosingCapability(false);
    if (capabilityPicker.current?.getClientRects().length) capabilityPicker.current.focus();
  };
  useLayoutEffect(() => { editorPanel.current?.scrollTo({ top: 0 }); }, [selectedKey]);
  useEffect(() => {
    if (initialCapability) setSelectedKey(initialCapability);
  }, [initialCapability]);

  const load = async (signal?: AbortSignal) => {
    const result = scope === "platform" ? await api.getPlatformPermissions(signal) : await api.getSpacePermissions(signal);
    if (signal?.aborted) return;
    setCatalog(result);
    const first = flatten(result.catalog).find((item) => scope === "platform" || item.space_configurable);
    setSelectedKey((current) => current || first?.key || "");
  };
  const retryLoad = (signal?: AbortSignal) => {
    setLoadError(null);
    void load(signal).catch((cause) => {
      if (!signal?.aborted) setLoadError(cause instanceof Error ? cause.message : t("permission.loadFailed"));
    });
  };
  useEffect(() => {
    const controller = new AbortController();
    retryLoad(controller.signal);
    return () => controller.abort();
  }, [scope]);

  const entries = useMemo(() => flatten(catalog?.catalog ?? []), [catalog]);
  const selected = entries.find((entry) => entry.key === selectedKey) ?? null;
  const showingModules = selectedKey === spaceModulesKey && !!spaceModules;
  const savedDraft = useMemo(() => selected ? policyDraft(selected, scope) : EMPTY_DRAFT, [selected, scope]);
  const draft = drafts[selectedKey] ?? savedDraft;
  const savedGroup = catalog?.space_context?.unverified_group_policy;
  const groupMode = pendingGroup ?? savedGroup ?? 2;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const changeDraft = (change: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [selectedKey]: { ...(current[selectedKey] ?? savedDraft), ...change } }));
  };
  const clearDraft = (key: string) => {
    setDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const updatePreviewOptions = (next: CapabilityPreviewOptions) => {
    setPreviewOptions(next);
  };

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const options = scope === "space" ? { ...previewOptions, unverified_group_policy: groupMode } : previewOptions;
    setSimulation([]);
    setPreviewPending(true);
    setPreviewError(false);
    const timer = window.setTimeout(async () => {
      try {
        const result = scope === "platform"
          ? await api.simulatePlatformPermission(selected.key, draft, options, controller.signal)
          : await api.simulateSpacePermission(selected.key, draft, options, controller.signal);
        if (!controller.signal.aborted) setSimulation(result.rows);
      } catch {
        if (!controller.signal.aborted) setPreviewError(true);
      } finally {
        if (!controller.signal.aborted) setPreviewPending(false);
      }
    }, 160);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [scope, selected, draft, previewOptions, groupMode, previewRetry]);

  const availableEntries = useMemo(
    () => entries.filter((entry) => scope === "platform" || entry.space_configurable),
    [entries, scope],
  );
  const availableKeys = useMemo(() => new Set(availableEntries.map((entry) => entry.key)), [availableEntries]);
  const queryValue = query.trim().toLowerCase();
  const visibleEntries = useMemo(() => {
    const includedKeys = new Set<string>();
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    if (queryValue) {
      availableEntries.forEach((entry) => {
        if (!`${entry.title} ${entry.title_en} ${entry.key}`.toLowerCase().includes(queryValue)) return;
        let current: CapabilityEntry | undefined = entry;
        while (current) {
          if (availableKeys.has(current.key)) includedKeys.add(current.key);
          current = current.parent ? byKey.get(current.parent) : undefined;
        }
      });
    }
    return availableEntries.filter((entry) => {
      if (queryValue) return includedKeys.has(entry.key);
      let parentKey = entry.parent;
      while (parentKey) {
        if (collapsedKeys.has(parentKey)) return false;
        parentKey = byKey.get(parentKey)?.parent ?? null;
      }
      return true;
    });
  }, [availableEntries, availableKeys, collapsedKeys, entries, queryValue]);
  const branchKeys = useMemo(() => new Set(availableEntries.flatMap((entry) => entry.parent ? [entry.parent] : [])), [availableEntries]);
  const toggleBranch = (entry: CapabilityEntry) => {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (next.has(entry.key)) next.delete(entry.key);
      else next.add(entry.key);
      return next;
    });
  };

  const writePolicy = async (reset: boolean) => {
    if (!selected || busy) return;
    const key = selected.key;
    setBusy(true);
    try {
      if (reset) {
        if (scope === "platform") await api.resetPlatformPermission(key);
        else await api.resetSpacePermission(key);
      } else {
        if (scope === "platform") await api.savePlatformPermission(key, draft);
        else await api.saveSpacePermission(key, draft);
      }
      await load();
      clearDraft(key);
      showToast(t(reset ? scope === "platform" ? "permission.removeDone" : "permission.resetDone" : "permission.saved"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t(reset ? "permission.resetFailed" : "permission.saveFailed"), "error");
    } finally { setBusy(false); }
  };
  const saveGroup = async () => {
    if (scope !== "space" || pendingGroup === null || busy) return;
    setBusy(true);
    try {
      const { unverified_group_policy } = await api.saveUnverifiedGroupPolicy(pendingGroup);
      setCatalog((current) => current?.space_context ? { ...current, space_context: { ...current.space_context, unverified_group_policy } } : current);
      setPendingGroup(null);
      showToast(t("permission.saved"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("permission.saveFailed"), "error");
    } finally { setBusy(false); }
  };
  const reasonText = (reason: CapabilityRestrictionDTO) => {
    const node = entries.find((entry) => entry.key === reason.key);
    const label = node ? isChineseLanguage(language) ? node.title : node.title_en : reason.key;
    const source = t(`permission.source.${reason.source}`);
    if (reason.source === "module") {
      const moduleLabels: Record<string, TranslationKey> = {
        chat_enabled: "nav.chats",
        square_enabled: "nav.square",
        square_free_post_enabled: "admin.squareFreePost",
        square_explore_enabled: "square.feedAll",
      };
      const module = moduleLabels[reason.reason ?? ""];
      return `${source} · ${module ? t(module) : label} · ${t("permission.closed")}`;
    }
    const builtInGroupRule = reason.source === "default" && (reason.key === "chat.group.join" || reason.key === "chat.group.send");
    const detail = builtInGroupRule ? t(reason.key === "chat.group.join" ? "permission.groupJoinDenied" : "permission.groupSendDenied")
      : reason.expression ? formatExpression(reason.expression, t) : t(reason.reason === "disabled" ? "permission.closed" : "permission.denyIf");
    return `${source} · ${label} · ${detail}`;
  };
  const groups = ["chat.group", "chat.group.join", "chat.group.send"];
  const showGroupPreset = scope === "space" && savedGroup !== undefined && groups.includes(selectedKey);
  const offersQuotaLimits = ["square", "square.statement", "square.statement.publish"].includes(selectedKey);
  const closedBy = simulation[0]?.denied_by?.filter((reason) => reason.source === "module" ||
    (reason.reason === "disabled" && (reason.source !== scope || reason.key !== selectedKey))) ?? [];
  const subTitle = showingModules ? t("permission.spaceModules") : selected ? isChineseLanguage(language) ? selected.title : selected.title_en : t("permission.chooseCapability");
  const path = selected ? capabilityChain(entries, selected).slice(0, -1).map((entry) => isChineseLanguage(language) ? entry.title : entry.title_en).join(" / ") : "";

  return <section className="permission-workspace">
    <aside className={`permission-tree-panel ${choosingCapability ? "is-choosing" : ""}`}>
      <button ref={capabilityPicker} className="permission-capability-picker" aria-controls={capabilityDirectoryId} aria-expanded={choosingCapability}
        onClick={() => setChoosingCapability((value) => !value)} type="button"><span aria-hidden="true" className="material-symbols-outlined">account_tree</span><span>{subTitle}</span><span aria-hidden="true" className="material-symbols-outlined">expand_more</span></button>
      <div className="permission-tree-content" id={capabilityDirectoryId} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setChoosingCapability(false); capabilityPicker.current?.focus(); }
      }}>
        <label className="permission-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><input aria-label={t("permission.search")} onChange={(event) => setQuery(event.target.value)} placeholder={t("permission.search")} value={query} /></label>
        {!queryValue && <div className="permission-shortcuts">
          {spaceModules && <button type="button" aria-current={showingModules ? "page" : undefined} onClick={() => chooseCapability(spaceModulesKey)}><span aria-hidden="true" className="material-symbols-outlined">tune</span>{t("permission.spaceModules")}</button>}
          {scope === "space" && availableKeys.has("chat.group.join") && <button type="button" onClick={() => chooseCapability("chat.group.join")}><span aria-hidden="true" className="material-symbols-outlined">group_add</span>{t("permission.groupParticipation")}</button>}
        </div>}
        <div className="permission-tree">{visibleEntries.map((entry) => {
          const policy = policyFor(entry, scope);
          const hasChildren = branchKeys.has(entry.key);
          const collapsed = !queryValue && collapsedKeys.has(entry.key);
          const title = isChineseLanguage(language) ? entry.title : entry.title_en;
          return <div className={`permission-tree-row ${selectedKey === entry.key ? "is-selected" : ""}`} key={entry.key} style={{ "--permission-depth": entry.depth } as CSSProperties}>
            {hasChildren ? <button aria-expanded={!collapsed} aria-label={t(collapsed ? "permission.expandBranch" : "permission.collapseBranch", { name: title })} className={`permission-tree-toggle ${collapsed ? "" : "is-expanded"}`} onClick={() => toggleBranch(entry)} type="button"><span aria-hidden="true" className="material-symbols-outlined">chevron_right</span></button> : <span className="permission-tree-spacer" />}
            <button aria-current={selectedKey === entry.key ? "page" : undefined} className="permission-tree-select" onClick={() => chooseCapability(entry.key)} type="button"><span aria-hidden="true" className="material-symbols-outlined">{entry.icon}</span><span><strong>{title}</strong></span>{policy?.enabled === false ? <span className="permission-tree-off material-symbols-outlined" title={t("permission.closed")}>block</span> : policy || drafts[entry.key] ? <i /> : null}</button>
          </div>;
        })}{queryValue && !visibleEntries.length && <div className="permission-tree-empty"><small>{t("permission.noSearchResults")}</small></div>}</div>
      </div>
    </aside>
    <section className="permission-editor-panel" ref={editorPanel}>{showingModules ? <>
      <header className="permission-editor-header permission-modules-header"><span className="permission-editor-icon material-symbols-outlined" aria-hidden="true">tune</span><span><h2>{subTitle}</h2></span></header>
      <div className="permission-modules-body">{spaceModules}</div>
    </> : selected ? <>
      <header className="permission-editor-header">
        <span className="permission-editor-icon"><span aria-hidden="true" className="material-symbols-outlined">{selected.icon}</span></span>
        <span>{path && <small>{path}</small>}<h2>{subTitle}</h2></span>
        <div>
          {dirty && <button type="button" disabled={busy} onClick={() => clearDraft(selected.key)}>{t("permission.discardDraft")}</button>}
          <button className="is-primary" disabled={busy || !dirty || previewError || previewPending} onClick={() => void writePolicy(false)} type="button">{busy ? t("common.saving") : t("common.save")}</button>
        </div>
      </header>
      <div className="permission-editor-content">
        <div className="permission-availability">
          <div><strong>{t("permission.availability")}</strong><p>{t(scope === "platform" ? "permission.platformAvailabilityHint" : "permission.spaceAvailabilityHint")}</p>
            {!!closedBy.length && <ul className="permission-closure-notice">{closedBy.map((reason) =>
              <li key={`${reason.source}:${reason.key}:${reason.reason}`}>{reasonText(reason)}</li>)}</ul>}
          </div>
          <span>{t(draft.enabled !== false ? "permission.availableByPolicy" : "permission.closed")}</span>
          <SettingSwitch label={t("permission.availability")} checked={draft.enabled !== false} disabled={busy} onChange={(enabled) => changeDraft({ enabled })} />
        </div>
        {selectedKey === flashKey && <p className="permission-scope-note">{t("permission.flashPolicyHint")}</p>}
        {showGroupPreset && <section className="permission-group-preset">
          <div><h3>{t("permission.groupParticipation")}</h3><p>{t(groupMode === 0 ? "permission.groupRestrictedHint" : `admin.unverifiedPolicy${groupMode}Hint`)}</p></div>
          <div className="permission-group-controls">
            <GroupParticipationSelect value={groupMode} onChange={setPendingGroup} disabled={busy} />
            <button className="ghost-button" disabled={busy || pendingGroup === null || groupMode === savedGroup} onClick={() => void saveGroup()} type="button">{t("permission.saveParticipation")}</button>
          </div>
          <div className="permission-group-links">
            <button type="button" aria-current={selectedKey === "chat.group.join" ? "page" : undefined} onClick={() => chooseCapability("chat.group.join")}>{t("admin.receiveGroupInvite")}</button>
            <button type="button" aria-current={selectedKey === "chat.group.send" ? "page" : undefined} onClick={() => chooseCapability("chat.group.send")}>{t("admin.sendGroupMessage")}</button>
          </div>
        </section>}
        <PermissionEffectiveMatrix key={selected.key} rows={simulation} options={previewOptions} onOptions={updatePreviewOptions}
          platform={scope === "platform"} pending={previewPending} error={previewError} onRetry={() => setPreviewRetry((value) => value + 1)}
          flash={selected.key === flashKey} reasonText={reasonText} />
        <details className="permission-member-conditions">
          <summary>{t("permission.memberConditions")}</summary>
          <p className="permission-scope-note">{t(scope === "platform" ? "permission.platformBaselineHint" : "permission.spaceRestrictionHint")}</p>
          <InheritedPolicySummary key={selected.key} entries={entries} language={language} scope={scope} selected={selected} t={t} />
          <fieldset disabled={busy} className="permission-condition-fields">
            <section className="permission-editor-section"><div><h3>{t("permission.allowWhen")}</h3><p>{t("permission.allowWhenHint")}</p></div><RuleEditor onChange={(requirement) => changeDraft({ requirement })} t={t} value={draft.requirement} /></section>
            <section className="permission-editor-section is-denial"><div><h3>{t("permission.denyWhen")}</h3><p>{t("permission.denyWhenHint")}</p></div><RuleEditor onChange={(denial) => changeDraft({ denial })} t={t} value={draft.denial} /></section>
            {offersQuotaLimits && <section className="permission-editor-section"><div><h3>{t("permission.postingLimits")}</h3><p>{t("permission.usageLimitsHint")}</p></div>
              <div className="permission-limit-list">{(["daily", "weekly"] as const).map((period) => <label key={period}>
                <span>{t(period === "daily" ? "permission.dailyLimit" : "permission.weeklyLimit")}</span>
                <input type="number" min={0} step={1} placeholder="—" value={draft.limits[period] ?? ""} onChange={(event) => {
                  const value = event.target.value;
                  const limits = { ...draft.limits };
                  if (value === "") delete limits[period];
                  else if (Number.isInteger(Number(value)) && Number(value) >= 0) limits[period] = Number(value);
                  changeDraft({ limits });
                }} />
              </label>)}</div>
            </section>}
          </fieldset>
          {policyFor(selected, scope) && <button className="ghost-button permission-reset-policy" disabled={busy} onClick={() => void writePolicy(true)} type="button">
            {t(scope === "platform" ? "permission.removePolicy" : "permission.inherit")}
          </button>}
        </details>
      </div>
    </> : loadError ? <FeedbackState tone="error" title={t("permission.loadFailed")} description={loadError} action={<button className="ghost-button" onClick={() => retryLoad()} type="button">{t("common.retry")}</button>} /> : catalog ? <FeedbackState tone="empty" icon="account_tree" title={t("permission.noSearchResults")} /> : <div className="permission-workspace-loading"><i /><span>{t("permission.loading")}</span></div>}</section>
  </section>;
}
