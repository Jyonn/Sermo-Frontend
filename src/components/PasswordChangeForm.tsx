import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { meetsPasswordPolicy } from "../lib/passwordPolicy";
import type { PasswordChangeOptionsDTO, PasswordChangeResultDTO } from "../types";
import { SettingSelect } from "./SettingRow";
import { VerificationCodeInput } from "./VerificationCodeInput";

type Method = "password" | "email" | "sms";

export function PasswordChangeForm({ onChanged, onBusy }: {
  onChanged: (result: PasswordChangeResultDTO) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const alive = useRef(true);
  const [options, setOptions] = useState<PasswordChangeOptionsDTO | null>(null);
  const [method, setMethod] = useState<Method>("password");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<number>();
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setError("");
    api.getPasswordChangeOptions(controller.signal).then(setOptions).catch((e: unknown) => {
      if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : t("password.optionsFailed"));
    });
    return () => { alive.current = false; controller.abort(); };
  }, [reload, t]);
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const channel = options?.channels.find((item) => item.type === method);
  const start = () => { setBusy(true); onBusy(true); setError(""); };
  const finish = () => { if (alive.current) { setBusy(false); onBusy(false); } };
  const send = async () => {
    if (!channel || busy || remaining) return;
    start();
    setCode(""); setChallenge(undefined);
    try {
      const result = await api.sendPasswordChangeCode(channel.channel);
      if (alive.current) { setChallenge(result.challenge_id); setNow(Date.now()); setDeadline(Date.now() + 60000); }
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : t("recovery.codeSendFailed"));
    } finally { finish(); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!options || busy) return;
    if (password !== confirm) { setError(t("password.mismatch")); return; }
    if (!meetsPasswordPolicy(password, options.policy)) {
      setError(t(options.policy.official ? "password.officialPolicy" : "password.memberPolicy")); return;
    }
    start();
    try {
      const result = await api.updatePassword({ new_password: password, method,
        old_password: method === "password" ? oldPassword : undefined,
        challenge_id: method !== "password" ? challenge : undefined,
        code: method !== "password" ? code : undefined });
      if (alive.current) onChanged(result);
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError && /OFFICIAL_PASSWORD_WEAK/.test(e.identifier)
        ? t("password.officialPolicy") : e instanceof ApiError ? e.message : t("password.updateFailed"));
    } finally { finish(); }
  };
  if (!options) return <div className="simple-form" aria-live="polite">{error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => setReload((n) => n + 1)} type="button">{t("common.retry")}</button></> : <p>{t("common.loading")}</p>}</div>;
  const methods = [{ value: "password" as Method, label: t(options.has_password ? "password.current" : "password.directSetup") },
    ...options.channels.map((item) => ({ value: item.type, label: t(`password.method.${item.type}`) }))];
  return <form className="simple-form menu-security-form" onSubmit={(event) => void submit(event)}>
    <SettingSelect label={t("password.verifyWith")} value={method} options={methods} disabled={busy} onChange={(next) => {
      setMethod(next); setCode(""); setChallenge(undefined); setOldPassword(""); setError("");
    }} />
    {method === "password" ? options.has_password ? <div className="menu-security-field">
      <label className="field-label" htmlFor={`${id}-old`}>{t("password.current")}</label>
      <input autoComplete="current-password" className="input" disabled={busy} id={`${id}-old`} required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
    </div> : null : <div className="menu-security-field">
      <p className="muted">{t("password.sendTo", { target: channel?.masked })}</p>
      <VerificationCodeInput ariaLabel={t("recovery.code")} disabled={busy || !challenge} value={code} onChange={setCode} />
      <button className="button secondary" disabled={busy || remaining > 0} onClick={() => void send()} type="button">{remaining ? t("password.resendIn", { seconds: remaining }) : t("password.sendCode")}</button>
    </div>}
    <div className="menu-security-field">
      <label className="field-label" htmlFor={`${id}-new`}>{t("recovery.newPassword")}</label>
      <input aria-describedby={`${id}-policy`} autoComplete="new-password" className="input" disabled={busy} id={`${id}-new`} maxLength={options.policy.max_length} minLength={options.policy.min_length} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <small className="muted" id={`${id}-policy`}>{t(options.policy.official ? "password.officialPolicy" : "password.memberPolicy")}</small>
    </div>
    <div className="menu-security-field">
      <label className="field-label" htmlFor={`${id}-confirm`}>{t("password.confirmNew")}</label>
      <input autoComplete="new-password" className="input" disabled={busy} id={`${id}-confirm`} required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
    </div>
    <small className="muted">{t("password.sessionNotice")}</small>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <button className="button" disabled={busy || !password || !confirm || (method !== "password" && (!challenge || code.length !== 6))} type="submit">{t(busy ? "common.processing" : options.has_password ? "password.confirmChange" : "password.confirmSetup")}</button>
  </form>;
}
