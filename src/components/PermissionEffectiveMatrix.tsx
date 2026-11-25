import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CapabilityPreviewOptions, CapabilityRestrictionDTO, CapabilitySimulationRowDTO, CapabilitySpaceContext } from "../types";
import { ManagementFilter } from "./ManagementWorkspace";
import { groupPermissionRows, verifications } from "../lib/permissionMatrix";

export function GroupParticipationSelect({ value, onChange, disabled }: {
  value: CapabilitySpaceContext["unverified_group_policy"];
  onChange: (value: CapabilitySpaceContext["unverified_group_policy"]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return <select aria-label={t("permission.groupParticipation")} className="management-filter" value={value} disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value) as CapabilitySpaceContext["unverified_group_policy"])}>
    {([2, 1, 0] as const).map((mode) => <option key={mode} value={mode}>{t(`admin.unverifiedPolicy${mode}`)}</option>)}
  </select>;
}

export function PermissionEffectiveMatrix({ rows, options, onOptions, platform, pending, error, onRetry, flash, reasonText }: {
  rows: CapabilitySimulationRowDTO[];
  options: CapabilityPreviewOptions;
  onOptions: (options: CapabilityPreviewOptions) => void;
  platform: boolean;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  flash: boolean;
  reasonText: (reason: CapabilityRestrictionDTO) => string;
}) {
  const { t } = useTranslation();
  const [vip, setVip] = useState(false);
  const [active, setActive] = useState<{ from: number; state: (typeof verifications)[number] } | null>(null);
  const ranges = groupPermissionRows(rows, vip);
  const selectedRange = ranges.find((range) => range.from === active?.from);
  const selected = selectedRange?.cells.find((row) => row?.verification === active?.state);
  const reasons = [...(selected?.denied_by ?? []), ...(selected?.failed ?? [])];
  const summary = (row: CapabilitySimulationRowDTO | undefined) => row
    ? t(row.allowed ? "permission.allowed" : "permission.blocked")
    : t("permission.unavailableResult");
  const patch = (value: CapabilityPreviewOptions) => {
    setActive(null);
    onOptions({ ...options, ...value });
  };

  return <section className="permission-effective" aria-busy={pending}>
    <header>
      <div><h3>{t("permission.effectiveMatrix")}</h3><p>{t("permission.staticPreviewHint")}</p></div>
      <label className="permission-preview-check"><input checked={vip} onChange={(event) => {
        setVip(event.target.checked);
        setActive(null);
      }} type="checkbox" />{t("permission.field.permanentVip")}</label>
    </header>
    <details className="permission-preview-context">
      <summary>{t("permission.previewContext")}</summary>
      <div>
        {platform && <>
          <label>{t("permission.spaceState")}<ManagementFilter
            label={t("permission.spaceState")}
            value={options.space_verification ?? "phone"}
            onChange={(space_verification) => patch({ space_verification })}
            options={["email", "phone", "identity"].map((value) => ({
              value: value as NonNullable<CapabilityPreviewOptions["space_verification"]>,
              label: t(`permission.spaceVerification.${value as "email" | "phone" | "identity"}`),
            }))} /></label>
          <label>{t("permission.groupParticipation")}<GroupParticipationSelect value={options.unverified_group_policy ?? 2}
            onChange={(unverified_group_policy) => patch({ unverified_group_policy })} /></label>
          {(["chat_enabled", "square_enabled", "square_free_post_enabled", "square_explore_enabled"] as const).map((key) =>
            <label className="permission-preview-check" key={key}><input type="checkbox" checked={options[key] !== false} onChange={(event) => patch({ [key]: event.target.checked })} />{t(({
              chat_enabled: "permission.field.chatEnabled",
              square_enabled: "permission.field.squareEnabled",
              square_free_post_enabled: "permission.field.squareFreePostEnabled",
              square_explore_enabled: "permission.field.squareExploreEnabled",
            } as const)[key])}</label>)}
        </>}
        {(["has_password", "official", "qr_invite", "wechat_miniprogram"] as const).map((key) => (
          <label className="permission-preview-check" key={key}><input type="checkbox" checked={options[key] === true} onChange={(event) => patch({ [key]: event.target.checked })} />{t(({
            has_password: "permission.field.hasPassword", official: "permission.field.official",
            qr_invite: "permission.field.qrInvite", wechat_miniprogram: "permission.field.wechatMiniprogram",
          } as const)[key])}</label>))}
      </div>
    </details>
    {flash && <div className="permission-flash-preview">
      <ManagementFilter label={t("permission.flashScenario")} value={options.flash_forward ? "forward" : "upload"}
        options={[{ value: "upload", label: t("permission.flashUpload") }, { value: "forward", label: t("permission.flashForward") }]}
        onChange={(value) => patch({ flash_forward: value === "forward" })} />
    </div>}
    {pending ? <p className="permission-matrix-feedback" role="status">{t("common.loading")}</p>
      : error ? <div className="permission-matrix-feedback" role="alert">{t("permission.previewFailed")} <button className="ghost-button" type="button" onClick={onRetry}>{t("common.retry")}</button></div>
      : !!ranges.length && <>
        <table className="permission-effective-table">
          <thead><tr><th scope="col">LV</th>{verifications.map((state) => <th key={state} scope="col">{t(`permission.verification.${state}`)}</th>)}</tr></thead>
          <tbody>{ranges.map((range) => {
            const level = range.from === range.through ? String(range.from) : `${range.from}–${range.through}`;
            return <tr key={range.from}><th scope="row">{level}</th>{range.cells.map((row, index) => {
              const state = verifications[index];
              return <td key={state}><button type="button" disabled={!row}
                aria-label={`LV ${level} · ${t(`permission.verification.${state}`)} · ${summary(row)}`}
                aria-pressed={active?.from === range.from && active?.state === state}
                className={row ? row.allowed ? "is-allowed" : "is-denied" : ""}
                onClick={() => setActive({ from: range.from, state })}>
                <span aria-hidden="true" className="material-symbols-outlined">{row ? row.allowed ? "check" : "block" : "remove"}</span>
              </button></td>;
            })}</tr>;
          })}</tbody>
        </table>
        <div className="permission-decision-detail" role="status">
          {selected ? <>
            <strong>{summary(selected)}</strong>
            {reasons.length > 0 && <ul>{reasons.map((reason, index) => <li key={`${reason.key}:${reason.source}:${index}`}>{reasonText(reason)}</li>)}</ul>}
            {selected.allowed && selected.limits?.daily !== undefined && <p>{t("permission.effectivePostingLimits", selected.limits)}</p>}
          </> : <p>{t("permission.selectResult")}</p>}
        </div>
      </>}
  </section>;
}
