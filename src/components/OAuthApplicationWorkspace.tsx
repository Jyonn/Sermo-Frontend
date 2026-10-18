import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { OAuthApplication, OAuthRevision } from "../lib/oauthClients";
import { currentOAuthRevision, filterOAuthApplications, oauthApplicationName, oauthApplicationStatus, pendingOAuthRevision, type OAuthApplicationFilter } from "../lib/oauthApplicationPresentation";
import { SideDrawer } from "./SideDrawer";
import { oauthDomains, legacyScopeCatalog, updateOAuthScopes, type OAuthScopeCatalogEntry } from "../lib/oauthScopes";
import { BottomSheet } from "./BottomSheet";
import "./OAuthApplicationWorkspace.css";

type Draft = { client_id: string; name: string; description: string; icon_url: string; redirects: string; scopes: string[]; loopbacks: string };
type Action = "approve" | "reject" | "submit" | "disable" | "restore" | "create";
type Panel = { kind: "detail" | "edit" | "action" | "discard"; appId?: number; revisionId?: number; version?: number; action?: Action };
type DetailTab = "configuration" | "history" | "audit";
const emptyDraft = (): Draft => ({ client_id: "", name: "", description: "", icon_url: "", redirects: "", scopes: ["profile"], loopbacks: "" });
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

export function OAuthApplicationWorkspace({ platform = false }: { platform?: boolean }) {
  const { t } = useI18n();
  const [apps, setApps] = useState<OAuthApplication[]>([]);
  const [scopeCatalog, setScopeCatalog] = useState<OAuthScopeCatalogEntry[]>(legacyScopeCatalog);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OAuthApplicationFilter>("all");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [tab, setTab] = useState<DetailTab>("configuration");
  const [viewedRevision, setViewedRevision] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const initialDraft = useRef("");
  const previousPanel = useRef<Panel | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [note, setNote] = useState("");
  const [loopbackConfirmed, setLoopbackConfirmed] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  const requestNumber = useRef(0);
  const pendingCount = apps.filter((app) => pendingOAuthRevision(app)).length;
  const visible = filterOAuthApplications(apps, filter, query);
  const app = apps.find((item) => item.id === panel?.appId);
  const revision = app?.revisions.find((item) => item.id === (panel?.revisionId ?? viewedRevision)) ?? (app ? pendingOAuthRevision(app) ?? currentOAuthRevision(app) ?? app.revisions[0] : undefined);
  const dirty = JSON.stringify(draft) !== initialDraft.current;
  const statusText = (status: string) => t(`oauth.${status}` as "oauth.draft");
  const scopeText = (scope: string) => t(`apps.scope.${scope}` as "apps.scope.profile");
  const actionText = (action: Action) => t(`oauth.${action}` as "oauth.approve");

  const load = async () => {
    const request = ++requestNumber.current;
    setLoading(true); setListError("");
    try { const result = await api.getOAuthApplications(platform); if (request === requestNumber.current) { setApps(result.applications); setScopeCatalog(result.scope_catalog ?? legacyScopeCatalog); } }
    catch (error) { if (request === requestNumber.current) setListError(error instanceof Error ? error.message : t("apps.authorizeFailed")); }
    finally { if (request === requestNumber.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { requestNumber.current++; }; }, [platform]);
  useEffect(() => { const media = window.matchMedia("(max-width: 760px)"); const sync = () => setMobile(media.matches); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);

  const open = (next: Panel) => {
    if (!panel) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanelError(""); setPanel(next);
  };
  const close = (force = false) => {
    if (busy) return;
    if (!force && panel?.kind === "discard") { setPanel(previousPanel.current); return; }
    if (!force && panel?.kind === "action" && panel.action === "create" && dirty) { previousPanel.current = { ...panel, kind: "edit" }; setPanel({ ...panel, kind: "discard" }); return; }
    if (!force && panel?.kind === "edit" && dirty) { previousPanel.current = panel; setPanel({ ...panel, kind: "discard" }); return; }
    setPanel(null); setPanelError(""); setDraft(emptyDraft());
    requestAnimationFrame(() => { (opener.current?.isConnected ? opener.current : addButton.current)?.focus(); });
  };
  useEffect(() => {
    if (!panel) return;
    const body = panelBody.current;
    const surface = body?.closest<HTMLElement>('[role="dialog"]') ?? body;
    if (!surface) return;
    const frame = requestAnimationFrame(() => { (body?.querySelector<HTMLElement>('[data-initial-focus]') ?? body)?.focus(); });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(surface.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); body?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement) || document.activeElement === body)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !surface.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    surface.addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); surface.removeEventListener("keydown", trap); };
  }, [Boolean(panel), panel?.kind, mobile]);

  const detail = (item: OAuthApplication) => { setTab("configuration"); setViewedRevision(null); open({ kind: "detail", appId: item.id, version: item.version }); };
  const edit = (item?: OAuthApplication, rev?: OAuthRevision, existing = false) => {
    const next = item && rev ? { client_id: item.client_id, name: rev.name, description: rev.description, icon_url: rev.icon_url ?? "", redirects: rev.redirect_uris.join("\n"), scopes: [...rev.scopes], loopbacks: rev.loopback_uris.join("\n") } : emptyDraft();
    setDraft(next); initialDraft.current = JSON.stringify(next);
    open({ kind: "edit", appId: item?.id, version: item?.version, revisionId: existing ? rev?.id : undefined });
  };
  const action = (name: Action, item = app, rev = revision) => { setNote(""); setLoopbackConfirmed(false); open({ kind: "action", appId: item?.id, version: item?.version, revisionId: rev?.id, action: name }); };
  const configuration = () => ({ client_id: draft.client_id, name: draft.name, description: draft.description, icon_url: draft.icon_url, redirect_uris: lines(draft.redirects), scopes: draft.scopes, loopback_uris: lines(draft.loopbacks) });
  const mutate = async (data: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setPanelError("");
    try {
      const result = await api.saveOAuthApplication(platform, panel?.appId ?? null, { version: panel?.version, revision_id: panel?.revisionId, ...data });
      setApps((current) => current.some((item) => item.id === result.id) ? current.map((item) => item.id === result.id ? result : item) : [result, ...current]);
      setPanel(null); setDraft(emptyDraft()); showToast(t("oauth.updated"));
      requestAnimationFrame(() => { (opener.current?.isConnected ? opener.current : addButton.current)?.focus(); });
    } catch (error) { setPanelError(error instanceof Error ? error.message : t("apps.authorizeFailed")); }
    finally { setBusy(false); }
  };
  const title = panel?.kind === "discard" ? t("oauth.discardTitle") : panel?.kind === "edit" ? t(panel.appId ? "oauth.edit" : "oauth.create") : panel?.kind === "action" ? t("oauth.confirmAction", { action: actionText(panel.action!), app: app ? oauthApplicationName(app) : draft.name }) : app ? oauthApplicationName(app) : t("oauth.manage");
  const surfaceTitle = panel?.kind === "action" ? t("common.confirm") : panel?.kind === "discard" ? t("oauth.unsaved") : title;
  const exceptionUris = panel?.action === "create" ? lines(draft.loopbacks) : panel?.action === "approve" ? revision?.loopback_uris ?? [] : [];
  const confirmDisabled = busy || Boolean(exceptionUris.length && !loopbackConfirmed) || panel?.action === "reject" && !note.trim();

  const revisionContent = (rev: OAuthRevision) => <>
    {rev.description ? <p className="oauth-description">{rev.description}</p> : null}
    <section className="oauth-section"><h4>{t("oauth.iconUrl")}</h4><ul className="oauth-urls"><li><code>{rev.icon_url || t("oauth.noIcon")}</code></li></ul></section>
    <section className="oauth-section"><h4>{t("oauth.scopes")}</h4><div className="oauth-permissions">{rev.scopes.map((scope) => <span key={scope}><span className="material-symbols-outlined" aria-hidden="true">{scope === "email" ? "alternate_email" : scope === "profile" ? "person" : scope === "phone" ? "phone" : "workspace_premium"}</span>{scopeText(scope)}</span>)}</div></section>
    <section className="oauth-section"><h4>{t("oauth.callbacks")}</h4><ul className="oauth-urls">{rev.redirect_uris.map((uri) => <li key={uri}><code>{uri}</code>{rev.loopback_uris.includes(uri) ? <small>{t("oauth.loopbackException")}</small> : null}</li>)}</ul></section>
  </>;

  const panelContent = panel ? <div className={`oauth-panel-body ${platform ? "is-platform" : ""}`} ref={panelBody} tabIndex={-1}>
    {!platform ? <div className="oauth-inline-heading"><button className="oauth-button is-quiet" onClick={() => close()} disabled={busy} type="button"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>{t("common.back")}</button><h3>{title}</h3></div> : null}
    {panelError ? <div className="oauth-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span><p>{panelError}</p></div> : null}
    {panel.kind === "detail" && app ? <>
      <div className="oauth-app-summary"><span className="oauth-app-monogram" aria-hidden="true">{oauthApplicationName(app).slice(0, 1)}</span><div><strong>{oauthApplicationName(app)}</strong><span>{app.client_id}</span></div><span className={`oauth-badge is-${oauthApplicationStatus(app)}`}>{statusText(oauthApplicationStatus(app))}</span></div>
      <div className="oauth-detail-tabs" role="tablist" aria-label={t("oauth.details")}>
        {(["configuration", "history", "audit"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} type="button">{t(`oauth.${value}` as "oauth.audit")}</button>)}
      </div>
      {tab === "configuration" && revision ? <>
        <div className="oauth-revision-heading"><h3>{revision.name}</h3><span className={`oauth-badge is-${revision.status}`}>{revision.id === app.approved_revision_id ? t("oauth.active") : statusText(revision.status)}</span></div>
        {revisionContent(revision)}
        {revision.review_note ? <section className="oauth-section"><h4>{t("oauth.reviewNoteShort")}</h4><p className="oauth-note">{revision.review_note}</p></section> : null}
        <footer className="oauth-panel-actions">
          {platform && revision.status === "pending" ? <><button className="oauth-button is-primary" type="button" onClick={() => action("approve")}>{t("oauth.approve")}</button><button className="oauth-button" type="button" onClick={() => action("reject")}>{t("oauth.reject")}</button></> : null}
          {revision.status === "draft" ? <><button className="oauth-button is-primary" type="button" onClick={() => edit(app, revision, true)}>{t("oauth.edit")}</button><button className="oauth-button" type="button" onClick={() => action("submit")}>{t("oauth.submit")}</button></> : null}
          {!app.revisions.some((item) => item.status === "draft" || item.status === "pending") ? <button className="oauth-button" type="button" onClick={() => edit(app, revision)}>{t("oauth.revise")}</button> : null}
          {platform ? <button className={`oauth-button is-quiet ${app.enabled ? "is-danger" : ""}`} type="button" onClick={() => action(app.enabled ? "disable" : "restore")}>{t(app.enabled ? "oauth.disable" : "oauth.restore")}</button> : null}
        </footer>
      </> : null}
      {tab === "history" ? <div className="oauth-history">{app.revisions.map((rev) => <button key={rev.id} type="button" onClick={() => { setViewedRevision(rev.id); setTab("configuration"); }}><span className={`oauth-history-dot is-${rev.status}`} /><div><strong>{rev.name}</strong><small>{rev.reviewed_at ? new Date(rev.reviewed_at).toLocaleString() : t("oauth.awaitingReview")}</small></div><span className={`oauth-badge is-${rev.status}`}>{rev.id === app.approved_revision_id ? t("oauth.active") : statusText(rev.status)}</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}</div> : null}
      {tab === "audit" ? <div className="oauth-audit">{app.audit.length ? app.audit.map((entry, index) => <article key={index}><span className="oauth-history-dot" /><div><strong>{t(`oauth.event.${entry.action}` as "oauth.event.create", { defaultValue: entry.action })}</strong><span>{entry.actor}</span><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div></article>) : <p className="oauth-muted">{t("oauth.noAudit")}</p>}</div> : null}
    </> : null}
    {panel.kind === "edit" ? <form className="oauth-edit-form" onSubmit={(event) => { event.preventDefault(); if (platform && !panel.appId) { setNote(""); setLoopbackConfirmed(false); open({ ...panel, kind: "action", action: "create" }); } else void mutate({ action: panel.appId ? panel.revisionId ? "edit" : "revise" : "create", ...configuration() }); }}>
      <label>{t("oauth.name")}<input data-initial-focus required maxLength={120} value={draft.name} disabled={busy} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>{t("oauth.clientId")}<input required disabled={Boolean(panel.appId) || busy} maxLength={80} pattern="[a-z0-9][a-z0-9_-]*" value={draft.client_id} onChange={(event) => setDraft({ ...draft, client_id: event.target.value })} /></label>
      <label>{t("oauth.description")}<textarea maxLength={1000} value={draft.description} disabled={busy} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>{t("oauth.iconUrl")}<input type="url" placeholder="https://" maxLength={512} value={draft.icon_url} disabled={busy} onChange={(event) => setDraft({ ...draft, icon_url: event.target.value })} /></label>
      <label>{t("oauth.redirects")}<textarea required value={draft.redirects} disabled={busy} onChange={(event) => setDraft({ ...draft, redirects: event.target.value })} /></label>
      {oauthDomains.filter(domain => scopeCatalog.some(entry => entry.domain === domain)).map(domain => <fieldset key={domain}><legend>{t(`oauth.permissionGroup.${domain}`)}</legend>{scopeCatalog.filter(entry => entry.domain === domain).map(entry => <label className="oauth-checkbox" key={entry.scope}><input type="checkbox" checked={draft.scopes.includes(entry.scope)} disabled={busy || !entry.available && !draft.scopes.includes(entry.scope)} onChange={event => setDraft({ ...draft, scopes: updateOAuthScopes(draft.scopes, entry.scope, event.target.checked, scopeCatalog) })} /><span>{entry.available ? scopeText(entry.scope) : `${t(`oauth.action.${entry.action}`)} · ${t(`oauth.scopeStatus.${entry.status}`)}`}</span></label>)}</fieldset>)}
      <label>{t("oauth.loopbacks")}<textarea value={draft.loopbacks} disabled={busy} onChange={(event) => setDraft({ ...draft, loopbacks: event.target.value })} /></label>
      <footer className="oauth-panel-actions"><button className="oauth-button is-primary" disabled={busy || !draft.scopes.length} type="submit">{busy ? t("common.loading") : t(platform && !panel.appId ? "common.continue" : "common.save")}</button><button className="oauth-button" disabled={busy} type="button" onClick={() => close()}>{t("common.cancel")}</button></footer>
    </form> : null}
    {panel.kind === "action" && panel.action ? <form className="oauth-confirm-form" onSubmit={(event) => { event.preventDefault(); if (!confirmDisabled) void mutate(panel.action === "create" ? { action: "create", ...configuration() } : { action: panel.action, review_note: note, approved_loopback_uris: loopbackConfirmed ? exceptionUris : [] }); }}>
      <div className={`oauth-confirm-icon ${panel.action === "reject" || panel.action === "disable" ? "is-danger" : ""}`}><span className="material-symbols-outlined" aria-hidden="true">{panel.action === "reject" || panel.action === "disable" ? "block" : "verified_user"}</span></div>
      <h3>{title}</h3><p className="oauth-confirm-copy">{t(`oauth.confirmHint.${panel.action}` as "oauth.confirmHint.approve")}</p>
      {(panel.action === "approve" || panel.action === "create" || panel.action === "submit") ? <div className="oauth-confirm-summary"><strong>{panel.action === "create" ? draft.name : revision?.name}</strong><span>{(panel.action === "create" ? draft.scopes : revision?.scopes ?? []).map(scopeText).join(" · ")}</span></div> : null}
      {panel.action === "approve" || panel.action === "reject" ? <label>{t(panel.action === "reject" ? "oauth.rejectionReason" : "oauth.optionalNote")}<textarea data-initial-focus required={panel.action === "reject"} maxLength={1000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label> : null}
      {exceptionUris.length ? <section className="oauth-exception"><h4>{t("oauth.loopbackException")}</h4><ul className="oauth-urls">{exceptionUris.map((uri) => <li key={uri}><code>{uri}</code></li>)}</ul><label className="oauth-checkbox"><input type="checkbox" checked={loopbackConfirmed} disabled={busy} onChange={(event) => setLoopbackConfirmed(event.target.checked)} /><span>{t("oauth.approveLoopback")}</span></label></section> : null}
      <footer className="oauth-panel-actions"><button className={`oauth-button is-primary ${panel.action === "reject" || panel.action === "disable" ? "is-danger" : ""}`} disabled={confirmDisabled} type="submit">{busy ? t("common.loading") : t("oauth.confirmActionShort", { action: actionText(panel.action) })}</button><button className="oauth-button" disabled={busy} type="button" onClick={() => { setPanelError(""); setPanel({ ...panel, kind: panel.action === "create" ? "edit" : "detail" }); }}>{t("common.cancel")}</button></footer>
    </form> : null}
    {panel.kind === "discard" ? <section className="oauth-discard"><span className="material-symbols-outlined" aria-hidden="true">edit_note</span><h3>{t("oauth.discardTitle")}</h3><p>{t("oauth.discardHint")}</p><div className="oauth-panel-actions"><button className="oauth-button" type="button" onClick={() => setPanel(previousPanel.current)}>{t("oauth.keepEditing")}</button><button className="oauth-button is-primary" type="button" onClick={() => close(true)}>{t("oauth.discard")}</button></div></section> : null}
  </div> : null;

  return <section className={`oauth-workspace oauth-surface ${platform ? "is-platform" : "is-member"}`}>
    {(!panel || platform) ? <>
      <header className="oauth-list-heading"><div><span className="oauth-eyebrow">{platform ? "APPLICATION DIRECTORY" : "DEVELOPER"}</span><h2>{t("oauth.directory")}<small>{apps.length}</small></h2></div><div className="oauth-toolbar-actions"><button className="oauth-button is-icon" aria-label={t("oauth.refresh")} title={t("oauth.refresh")} type="button" disabled={loading} onClick={() => void load()}><span className="material-symbols-outlined" aria-hidden="true">refresh</span></button><button className="oauth-button is-primary" ref={addButton} type="button" onClick={() => edit()}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t("oauth.add")}</button></div></header>
      <div className="oauth-list-controls"><div className="oauth-filter-tabs" role="tablist" aria-label={t("oauth.filter")}>
        {(["all", "pending", "enabled", "disabled"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{t(`oauth.filter.${value}` as "oauth.filter.all")}{value === "pending" && pendingCount ? <span>{pendingCount}</span> : null}</button>)}
      </div><label className="oauth-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><input aria-label={t("oauth.search")} placeholder={t("oauth.search")} value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {listError ? <div className="oauth-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span><p>{listError}</p><button className="oauth-button is-quiet" type="button" onClick={() => void load()}>{t("common.retry")}</button></div> : null}
      <div className="oauth-application-list" aria-busy={loading}>
        <div className="oauth-column-head" aria-hidden="true"><span>{t("oauth.application")}</span><span>{t("oauth.status")}</span><span>{t("oauth.configuration")}</span><span /></div>
        {loading && !apps.length ? <div className="oauth-list-empty" role="status"><span className="oauth-loader" />{t("common.loading")}</div> : visible.map((item) => { const current = currentOAuthRevision(item); const state = oauthApplicationStatus(item); return <button className="oauth-application-row" key={item.id} type="button" aria-label={t("oauth.openApp", { app: oauthApplicationName(item) })} onClick={() => detail(item)}><div className="oauth-row-identity"><span className="oauth-app-monogram" aria-hidden="true">{oauthApplicationName(item).slice(0, 1)}</span><div><strong>{oauthApplicationName(item)}</strong><small>{item.client_id}</small></div></div><span className={`oauth-badge is-${state}`}>{statusText(state)}</span><span className="oauth-row-meta">{current ? t("oauth.configurationCount", { scopes: current.scopes.length, callbacks: current.redirect_uris.length }) : t("oauth.notActive")}</span><span className="material-symbols-outlined oauth-row-arrow" aria-hidden="true">chevron_right</span></button>; })}
        {!loading && !listError && !visible.length ? <div className="oauth-list-empty"><span className="material-symbols-outlined" aria-hidden="true">{query || filter !== "all" ? "search_off" : "apps"}</span><strong>{t(query || filter !== "all" ? "oauth.noMatches" : "oauth.empty")}</strong>{query || filter !== "all" ? <button className="oauth-button is-quiet" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>{t("oauth.clearFilters")}</button> : null}</div> : null}
      </div>
    </> : null}
    {platform ? mobile ? <BottomSheet className="oauth-mobile-sheet oauth-surface is-platform" bodyClassName="oauth-sheet-body" open={Boolean(panel)} title={surfaceTitle} onClose={() => close()}>{panelContent}</BottomSheet> : <SideDrawer className="oauth-detail-drawer oauth-surface is-platform" historyMode="route" open={Boolean(panel)} title={surfaceTitle} onClose={() => close()}>{panelContent}</SideDrawer> : panelContent}
  </section>;
}
