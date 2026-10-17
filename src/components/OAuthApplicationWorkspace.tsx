import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { OAuthApplication, OAuthRevision } from "../lib/oauthClients";
import "./OAuthApplicationWorkspace.css";

const empty = { client_id: "", name: "", description: "", redirects: "", scopes: ["profile"], loopbacks: "" };

export function OAuthApplicationWorkspace({ platform = false }: { platform?: boolean }) {
  const { t } = useI18n();
  const [apps, setApps] = useState<OAuthApplication[]>([]);
  const [target, setTarget] = useState<{ app: OAuthApplication; revision?: OAuthRevision } | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loopbackApproval, setLoopbackApproval] = useState<Record<number, boolean>>({});
  const load = async (preserveError = false) => { if (!preserveError) setError(""); const result = await api.getOAuthApplications(platform); setApps(result.applications); setLoaded(true); };
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [platform]);
  const save = async (id: number | null, data: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api.saveOAuthApplication(platform, id, data);
      setTarget(null); setForm(empty); setLoopbackApproval({});
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : t("apps.authorizeFailed")); await load(true).catch(() => undefined); }
    finally { setBusy(false); }
  };
  const edit = (app: OAuthApplication, rev: OAuthRevision, draft: boolean) => {
    setTarget({ app, revision: draft ? rev : undefined });
    setForm({ client_id: app.client_id, name: rev.name, description: rev.description, redirects: rev.redirect_uris.join("\n"), scopes: rev.scopes, loopbacks: rev.loopback_uris.join("\n") });
  };
  const lines = (value: string) => value.split("\n").map((v) => v.trim()).filter(Boolean);
  return <section className="oauth-workspace">
    <h2>{t("oauth.manage")}</h2><p>{t(platform ? "oauth.adminHint" : "oauth.developerHint")}</p>
    {error ? <p role="alert">{error}</p> : null}
    <button disabled={busy} onClick={() => void load().catch((e: Error) => setError(e.message))} type="button">{t("oauth.refresh")}</button>
    {!loaded && !error ? <p>{t("common.loading")}</p> : loaded && !apps.length ? <p>{t("oauth.empty")}</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void save(target?.app.id ?? null, {
      action: target ? target.revision ? "edit" : "revise" : "create", version: target?.app.version, revision_id: target?.revision?.id,
      client_id: form.client_id, name: form.name, description: form.description, redirect_uris: lines(form.redirects), scopes: form.scopes, loopback_uris: lines(form.loopbacks),
    }); }}>
      <h3>{t(target ? "oauth.edit" : "oauth.create")}</h3>
      <label>{t("oauth.clientId")}<input required disabled={Boolean(target) || busy} maxLength={80} pattern="[a-z0-9][a-z0-9_-]*" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} /></label>
      <label>{t("oauth.name")}<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>{t("oauth.description")}<textarea maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label>{t("oauth.redirects")}<textarea required value={form.redirects} onChange={(e) => setForm({ ...form, redirects: e.target.value })} /></label>
      <fieldset><legend>{t("oauth.scopes")}</legend>{["profile", "phone", "vip", "email"].map((scope) => <label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={(e) => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, scope] : form.scopes.filter((s) => s !== scope) })} />{t(`apps.scope.${scope}` as "apps.scope.profile")}</label>)}</fieldset>
      <label>{t("oauth.loopbacks")}<textarea value={form.loopbacks} onChange={(e) => setForm({ ...form, loopbacks: e.target.value })} /></label>
      <p>{t("oauth.consentHint")}</p>
      <div className="oauth-workspace-actions"><button disabled={busy} type="submit">{t(platform && !target ? "oauth.createApproved" : "common.save")}</button>{target ? <button disabled={busy} type="button" onClick={() => { setTarget(null); setForm(empty); }}>{t("common.cancel")}</button> : null}</div>
    </form>
    {apps.map((app) => <article key={app.id}>
      <h3>{app.client_id} · {t(app.enabled ? "oauth.enabled" : "oauth.disabled")}</h3><small>v{app.version}</small>
      {platform ? <button disabled={busy} type="button" onClick={() => void save(app.id, { action: app.enabled ? "disable" : "restore", version: app.version })}>{t(app.enabled ? "oauth.disable" : "oauth.restore")}</button> : null}
      {app.revisions.map((rev) => <section key={rev.id}>
        <h4>{rev.name} · {t(`oauth.${rev.status}` as "oauth.draft")}{app.approved_revision_id === rev.id ? ` · ${t("oauth.active")}` : ""}</h4>
        <p>{rev.description}</p><ul>{rev.redirect_uris.map((uri) => <li key={uri}><code>{uri}</code></li>)}</ul>
        <p>{rev.scopes.map((s) => t(`apps.scope.${s}` as "apps.scope.profile")).join(" · ")}</p>
        {rev.loopback_uris.length ? <p>{t("oauth.loopbacks")}: {rev.loopback_uris.join(" · ")}</p> : null}
        {rev.review_note ? <p>{rev.review_note}</p> : null}
        <div className="oauth-workspace-actions">
          {rev.status === "draft" ? <><button disabled={busy} onClick={() => edit(app, rev, true)} type="button">{t("oauth.edit")}</button><button disabled={busy} onClick={() => void save(app.id, { action: "submit", version: app.version, revision_id: rev.id })} type="button">{t("oauth.submit")}</button></> : null}
          {(rev.id === app.approved_revision_id || rev.status === "rejected") && !app.revisions.some((r) => r.status === "draft" || r.status === "pending") ? <button disabled={busy} onClick={() => edit(app, rev, false)} type="button">{t("oauth.revise")}</button> : null}
        </div>
        {platform && rev.status === "pending" ? <div>
          <label>{t("oauth.reviewNote")}<textarea maxLength={1000} value={notes[rev.id] || ""} onChange={(e) => setNotes({ ...notes, [rev.id]: e.target.value })} /></label>
          {rev.loopback_uris.length ? <label><input type="checkbox" checked={loopbackApproval[rev.id] || false} onChange={(e) => setLoopbackApproval({ ...loopbackApproval, [rev.id]: e.target.checked })} />{t("oauth.approveLoopback")}</label> : null}
          <div className="oauth-workspace-actions">{["approve", "reject"].map((action) => <button disabled={busy || action === "approve" && Boolean(rev.loopback_uris.length) && !loopbackApproval[rev.id] || action === "reject" && !notes[rev.id]?.trim()} key={action} type="button" onClick={() => void save(app.id, { action, version: app.version, revision_id: rev.id, review_note: notes[rev.id] || "", approved_loopback_uris: loopbackApproval[rev.id] ? rev.loopback_uris : [] })}>{t(action === "approve" ? "oauth.approve" : "oauth.reject")}</button>)}</div>
        </div> : null}
      </section>)}
      <details><summary>{t("oauth.audit")}</summary><ul>{app.audit.map((entry, i) => <li key={i}>{entry.action} · {entry.actor} · v{entry.version} · {new Date(entry.created_at).toLocaleString()}</li>)}</ul></details>
    </article>)}
  </section>;
}
