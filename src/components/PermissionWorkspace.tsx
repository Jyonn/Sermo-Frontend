import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import type { CapabilityCatalogDTO, CapabilityNodeDTO, CapabilityPolicyDTO, CapabilitySimulationRowDTO, PolicyExpression } from "../types";
import "../styles/permission-workspace.css";

type Scope = "platform" | "space";
type Draft = Pick<CapabilityPolicyDTO, "requirement" | "denial" | "limits">;
type Atom = Extract<PolicyExpression, { field: string }>;

const EMPTY_DRAFT: Draft = { requirement: {}, denial: {}, limits: {} };
const FIELD_META: Record<string, { label: string; kind: "number" | "boolean"; min?: number; max?: number }> = {
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
  space_phone_verified: { label: "permission.field.spacePhoneVerified", kind: "boolean" },
  space_identity_verified: { label: "permission.field.spaceIdentityVerified", kind: "boolean" },
  unverified_group_policy: { label: "permission.field.unverifiedGroupPolicy", kind: "number", min: 0, max: 2 },
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

function RuleEditor({ value, onChange, t }: { value: PolicyExpression; onChange: (value: PolicyExpression) => void; t: TFunction }) {
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
        <button className={`permission-not ${row.negated ? "is-active" : ""}`} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, negated: !item.negated } : item))} title="NOT" type="button">NOT</button>
        <label><span>{t("permission.attribute")}</span><select value={row.atom.field} onChange={(event) => {
          const field = event.target.value;
          const nextMeta = FIELD_META[field];
          const atom: Atom = { field, op: nextMeta.kind === "boolean" ? "eq" : "gte", value: nextMeta.kind === "boolean" ? true : nextMeta.min ?? 0 };
          updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom } : item));
        }}>{Object.entries(FIELD_META).map(([field, item]) => <option key={field} value={field}>{t(item.label as "permission.field.growthLevel")}</option>)}</select></label>
        {meta.kind === "number" ? <><label><span>{t("permission.relation")}</span><select value={row.atom.op} onChange={(event) => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, op: event.target.value } } : item))}><option value="gte">≥</option><option value="gt">&gt;</option><option value="eq">=</option><option value="lte">≤</option><option value="lt">&lt;</option></select></label><label className="permission-rule-value"><span>{t("permission.value")}</span><input max={meta.max} min={meta.min} type="number" value={Number(row.atom.value)} onChange={(event) => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, value: Number(event.target.value) } } : item))} /></label></> : <div className="permission-boolean"><button className={row.atom.value === true ? "is-active" : ""} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, op: "eq", value: true } } : item))} type="button">{t("common.yes")}</button><button className={row.atom.value === false ? "is-active" : ""} onClick={() => updateRows(model.rows.map((item, itemIndex) => itemIndex === index ? { ...item, atom: { ...item.atom, op: "eq", value: false } } : item))} type="button">{t("common.no")}</button></div>}
        <button className="permission-remove-rule" onClick={() => updateRows(model.rows.filter((_, itemIndex) => itemIndex !== index))} type="button"><span className="material-symbols-outlined">close</span></button>
      </div>;
    })}</div> : <div className="permission-empty-rules"><span className="material-symbols-outlined">all_inclusive</span><span><strong>{t("permission.noExtraCondition")}</strong><small>{t("permission.inheritedStillApplies")}</small></span></div>}
  </div>;
}

function flatten(nodes: CapabilityNodeDTO[], depth = 0): Array<CapabilityNodeDTO & { depth: number }> {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

function policyFor(node: CapabilityNodeDTO, scope: Scope) {
  return scope === "platform" ? node.platform_policy : node.space_policy;
}

export function PermissionWorkspace({ scope }: { scope: Scope }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "zh-CN";
  const [catalog, setCatalog] = useState<CapabilityCatalogDTO | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [simulation, setSimulation] = useState<CapabilitySimulationRowDTO[]>([]);
  const [vipPreview, setVipPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = scope === "platform" ? await api.getPlatformPermissions() : await api.getSpacePermissions();
    setCatalog(result);
    const first = flatten(result.catalog).find((item) => scope === "platform" || item.space_configurable);
    setSelectedKey((current) => current || first?.key || "");
  };
  useEffect(() => { void load().catch((cause) => showToast(cause instanceof Error ? cause.message : t("permission.loadFailed"), "error")); }, [scope]);
  const entries = useMemo(() => flatten(catalog?.catalog ?? []), [catalog]);
  const selected = entries.find((entry) => entry.key === selectedKey) ?? null;
  useEffect(() => {
    if (!selected) return;
    const policy = policyFor(selected, scope);
    setDraft(policy ? { requirement: policy.requirement, denial: policy.denial, limits: policy.limits } : EMPTY_DRAFT);
    setSimulation([]);
  }, [scope, selectedKey, catalog]);
  const visibleEntries = entries.filter((entry) => (scope === "platform" || entry.space_configurable) && (!query.trim() || `${entry.title} ${entry.title_en} ${entry.key}`.toLowerCase().includes(query.trim().toLowerCase())));

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (scope === "platform") await api.savePlatformPermission(selected.key, draft);
      else await api.saveSpacePermission(selected.key, draft);
      await load();
      showToast(t("permission.saved"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("permission.saveFailed"), "error");
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (scope === "platform") await api.resetPlatformPermission(selected.key);
      else await api.resetSpacePermission(selected.key);
      await load();
      showToast(t("permission.resetDone"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("permission.resetFailed"), "error");
    } finally { setBusy(false); }
  };
  const preview = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = scope === "platform" ? await api.simulatePlatformPermission(selected.key, draft) : await api.simulateSpacePermission(selected.key, draft);
      setSimulation(result.rows);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("permission.previewFailed"), "error");
    } finally { setBusy(false); }
  };

  return <section className="permission-workspace">
    <aside className="permission-tree-panel">
      <label className="permission-search"><span className="material-symbols-outlined">search</span><input onChange={(event) => setQuery(event.target.value)} placeholder={t("permission.search")} value={query} /></label>
      <div className="permission-tree">{visibleEntries.map((entry) => {
        const hasOverride = Boolean(policyFor(entry, scope));
        return <button className={`${selectedKey === entry.key ? "is-selected" : ""} ${hasOverride ? "has-override" : ""}`} key={entry.key} onClick={() => setSelectedKey(entry.key)} style={{ "--permission-depth": entry.depth } as CSSProperties} type="button"><span className="material-symbols-outlined">{entry.icon}</span><span><strong>{language === "en" ? entry.title_en : entry.title}</strong><small>{entry.key}</small></span>{hasOverride ? <i /> : null}</button>;
      })}</div>
    </aside>
    <main className="permission-editor-panel">{selected ? <>
      <header className="permission-editor-header"><span className="permission-editor-icon material-symbols-outlined">{selected.icon}</span><span><small>{selected.key}</small><h2>{language === "en" ? selected.title_en : selected.title}</h2></span><div><button disabled={busy || !policyFor(selected, scope)} onClick={() => void reset()} type="button">{t("permission.inherit")}</button><button className="is-primary" disabled={busy} onClick={() => void save()} type="button">{busy ? <i /> : null}{t("common.save")}</button></div></header>
      <section className="permission-inheritance"><span className="material-symbols-outlined">account_tree</span><span><strong>{t(scope === "platform" ? "permission.platformBaseline" : "permission.spaceRestriction")}</strong><small>{t(scope === "platform" ? "permission.platformBaselineHint" : "permission.spaceRestrictionHint")}</small></span></section>
      <section className="permission-editor-section"><div><h3>{t("permission.allowWhen")}</h3><p>{t("permission.allowWhenHint")}</p></div><RuleEditor onChange={(requirement) => setDraft((current) => ({ ...current, requirement }))} t={t} value={draft.requirement} /></section>
      <section className="permission-editor-section is-denial"><div><h3>{t("permission.denyWhen")}</h3><p>{t("permission.denyWhenHint")}</p></div><RuleEditor onChange={(denial) => setDraft((current) => ({ ...current, denial }))} t={t} value={draft.denial} /></section>
      <section className="permission-editor-section"><div><h3>{t("permission.usageLimits")}</h3><p>{t("permission.usageLimitsHint")}</p></div><div className="permission-limit-editor">
        <div className="permission-limit-presets">{["daily", "weekly"].map((key) => <button disabled={key in draft.limits} key={key} onClick={() => setDraft((current) => ({ ...current, limits: { ...current.limits, [key]: 1 } }))} type="button"><span className="material-symbols-outlined">add</span>{t(key === "daily" ? "permission.dailyLimit" : "permission.weeklyLimit")}</button>)}</div>
        {Object.entries(draft.limits).length ? <div className="permission-limit-list">{Object.entries(draft.limits).map(([key, value]) => <label key={key}><span>{key === "daily" || key === "weekly" ? t(key === "daily" ? "permission.dailyLimit" : "permission.weeklyLimit") : key}</span><input min="0" onChange={(event) => setDraft((current) => ({ ...current, limits: { ...current.limits, [key]: Number(event.target.value) } }))} type="number" value={value} /><button onClick={() => setDraft((current) => ({ ...current, limits: Object.fromEntries(Object.entries(current.limits).filter(([itemKey]) => itemKey !== key)) }))} type="button"><span className="material-symbols-outlined">close</span></button></label>)}</div> : <div className="permission-empty-rules"><span className="material-symbols-outlined">speed</span><span><strong>{t("permission.productDefaultLimits")}</strong><small>{t("permission.productDefaultLimitsHint")}</small></span></div>}
      </div></section>
      <section className="permission-matrix-section"><header><span><h3>{t("permission.audiencePreview")}</h3><p>{t("permission.audiencePreviewHint")}</p></span><div><button className={vipPreview ? "is-active" : ""} onClick={() => setVipPreview((value) => !value)} type="button">VIP</button><button disabled={busy} onClick={() => void preview()} type="button"><span className="material-symbols-outlined">play_arrow</span>{t("permission.runPreview")}</button></div></header>{simulation.length ? <div className="permission-matrix"><div className="permission-matrix-head"><span>LV</span>{(["none", "email", "phone", "dual"] as const).map((value) => <span key={value}>{t(`permission.verification.${value}`)}</span>)}</div>{Array.from({ length: 18 }, (_, index) => index + 1).map((level) => <div className="permission-matrix-row" key={level}><strong>{level}</strong>{(["none", "email", "phone", "dual"] as const).map((verification) => { const row = simulation.find((item) => item.growth_level === level && item.verification === verification && item.permanent_vip === vipPreview); return <span className={row?.allowed ? "is-allowed" : "is-denied"} key={verification}><span className="material-symbols-outlined">{row?.allowed ? "check" : "close"}</span></span>; })}</div>)}</div> : <button className="permission-matrix-placeholder" onClick={() => void preview()} type="button"><span className="material-symbols-outlined">grid_view</span><span><strong>{t("permission.previewBeforePublish")}</strong><small>{t("permission.previewNoChanges")}</small></span></button>}</section>
    </> : <div className="permission-workspace-loading"><i /><span>{t("permission.loading")}</span></div>}</main>
  </section>;
}
