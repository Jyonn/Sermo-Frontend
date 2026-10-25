import { useId, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { oauthDomains, updateOAuthScopes, type OAuthScopeCatalogEntry } from "../lib/oauthScopes";

export type OAuthApplicationDraft = { client_id: string; name: string; description: string; icon_url: string; redirects: string; scopes: string[]; loopbacks: string };
export const oauthEditorSteps = ["oauth.step.identity", "oauth.step.connection", "oauth.step.permissions"] as const;

export function OAuthApplicationEditor({ draft, onChange, step, onStep, busy, existing, platformCreate, scopeCatalog, onCommit, onCancel }: {
  draft: OAuthApplicationDraft; onChange: (draft: OAuthApplicationDraft) => void; step: number; onStep: (step: number) => void;
  busy: boolean; existing: boolean; platformCreate: boolean; scopeCatalog: OAuthScopeCatalogEntry[]; onCommit: () => void; onCancel: () => void;
}) {
  const { t } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const [localDevelopmentOpen, setLocalDevelopmentOpen] = useState(Boolean(draft.loopbacks));
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[data-step-focus]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  return <form ref={form} className="oauth-edit-form" onSubmit={(event) => {
    event.preventDefault();
    if (busy) return;
    if (step < oauthEditorSteps.length - 1) onStep(step + 1);
    else onCommit();
  }}>
    <ol className="oauth-editor-steps" aria-label={t("oauth.setupSteps")}>{oauthEditorSteps.map((label, index) => <li key={label}><button aria-current={step === index ? "step" : undefined} type="button" disabled={busy || index > step} onClick={() => onStep(index)}><span>{index + 1}</span>{t(label)}</button></li>)}</ol>
    {step === 0 ? <div className="oauth-editor-fields">
      <label>{t("oauth.name")}<input data-step-focus required maxLength={120} value={draft.name} disabled={busy} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
      <label>{t("oauth.clientId")}<input aria-label={t("oauth.clientId")} aria-describedby={`${id}-client-hint`} required disabled={existing || busy} maxLength={80} pattern={"[a-z0-9][a-z0-9_\\-]*"} autoCapitalize="none" spellCheck={false} value={draft.client_id} onChange={(event) => onChange({ ...draft, client_id: event.target.value })} /><small id={`${id}-client-hint`}>{t("oauth.clientIdHint")}</small></label>
      <label>{t("oauth.description")}<textarea maxLength={1000} value={draft.description} disabled={busy} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label>
      <label>{t("oauth.iconUrl")}<input type="url" placeholder="https://" maxLength={512} value={draft.icon_url} disabled={busy} onChange={(event) => onChange({ ...draft, icon_url: event.target.value })} /></label>
    </div> : step === 1 ? <div className="oauth-editor-fields">
      <label>{t("oauth.redirects")}<textarea aria-label={t("oauth.redirects")} aria-describedby={`${id}-callback-hint`} data-step-focus required placeholder="https://example.com/oauth/callback" autoCapitalize="none" spellCheck={false} value={draft.redirects} disabled={busy} onChange={(event) => onChange({ ...draft, redirects: event.target.value })} /><small id={`${id}-callback-hint`}>{t("oauth.callbackHint")}</small></label>
      <details className="oauth-advanced" open={localDevelopmentOpen} onToggle={(event) => setLocalDevelopmentOpen(event.currentTarget.open)}><summary>{t("oauth.localDevelopment")}</summary><label>{t("oauth.loopbacks")}<textarea autoCapitalize="none" spellCheck={false} value={draft.loopbacks} disabled={busy} onChange={(event) => onChange({ ...draft, loopbacks: event.target.value })} /></label></details>
    </div> : <div className="oauth-editor-permissions">
      <p className="oauth-editor-caption" tabIndex={-1} data-step-focus>{t("oauth.permissionSelection", { count: draft.scopes.length })}</p>
      {oauthDomains.filter(domain => scopeCatalog.some(entry => entry.domain === domain)).map(domain => <fieldset key={domain}><legend>{t(`oauth.permissionGroup.${domain}`)}</legend>{scopeCatalog.filter(entry => entry.domain === domain).map(entry => <label className="oauth-checkbox" key={entry.scope}><input type="checkbox" checked={draft.scopes.includes(entry.scope)} disabled={busy || !entry.available && !draft.scopes.includes(entry.scope)} onChange={event => onChange({ ...draft, scopes: updateOAuthScopes(draft.scopes, entry.scope, event.target.checked, scopeCatalog) })} /><span>{entry.available ? t(`apps.scope.${entry.scope}` as "apps.scope.profile") : `${t(`oauth.action.${entry.action}`)} · ${t(`oauth.scopeStatus.${entry.status}`)}`}</span></label>)}</fieldset>)}
      <p className="oauth-editor-caption">{t(platformCreate ? "oauth.platformCreateHint" : "oauth.draftHint")}</p>
    </div>}
    <footer className="oauth-panel-actions oauth-editor-actions">
      <button className="oauth-button is-quiet" disabled={busy} type="button" onClick={onCancel}>{t("common.cancel")}</button>
      <div>{step > 0 ? <button className="oauth-button" disabled={busy} type="button" onClick={() => onStep(step - 1)}>{t("common.back")}</button> : null}<button className="oauth-button is-primary" disabled={busy || step === 2 && !draft.scopes.length} type="submit">{busy ? t("common.loading") : step < 2 || platformCreate ? t("common.continue") : t("oauth.saveDraft")}</button></div>
    </footer>
  </form>;
}
