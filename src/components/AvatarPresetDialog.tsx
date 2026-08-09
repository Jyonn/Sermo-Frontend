import { useEffect, useMemo, useState } from "react";
import { buildAvatarPresetUri, parseAvatarPresetId } from "../lib/avatar";
import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { useI18n } from "../lib/language";

interface AvatarPresetDialogProps {
  open: boolean;
  currentAvatarUri?: string | null;
  displayName: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (presetId: number) => void | Promise<void>;
  onRequestCustomUpload?: () => void;
  customUploadEnabled?: boolean;
  customUploadHint?: string;
}

const presetIds = Array.from({ length: 15 }, (_, index) => index + 1);

function UploadAvatarIcon() {
  return (
    <svg aria-hidden="true" className="avatar-upload-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 6.5h2.1l1.05-1.6h3.7L14.9 6.5H17a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 18.5H7A2.5 2.5 0 0 1 4.5 16v-7A2.5 2.5 0 0 1 7 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M12 9.25v5.5M9.25 12h5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function AvatarPresetDialog({
  open,
  currentAvatarUri,
  displayName,
  saving = false,
  onClose,
  onSave,
  onRequestCustomUpload,
  customUploadEnabled = true,
  customUploadHint,
}: AvatarPresetDialogProps) {
  const { t } = useI18n();
  const effectiveCustomUploadHint = customUploadHint ?? t("avatar.uploadCustom");
  const currentPresetId = useMemo(() => parseAvatarPresetId(currentAvatarUri) ?? (currentAvatarUri ? null : 1), [currentAvatarUri]);
  const [selectedPresetId, setSelectedPresetId] = useState(currentPresetId);

  useEffect(() => {
    if (!open) return;
    setSelectedPresetId(parseAvatarPresetId(currentAvatarUri) ?? (currentAvatarUri ? null : 1));
  }, [currentAvatarUri, open]);

  return (
    <SideDrawer
      actionBusy={saving}
      actionDisabled={selectedPresetId === null}
      actionLabel={t("common.confirm")}
      historyKey="avatar"
      onAction={() => {
        if (selectedPresetId !== null) void onSave(selectedPresetId);
      }}
      onClose={onClose}
      open={open}
      title={t("avatar.choose")}
    >
      <div className="avatar-preset-drawer">
        <section className="avatar-preset-stage">
          <span aria-hidden="true" className="avatar-preset-stage-ring" />
          <UserAvatar
            className="avatar-preset-current-avatar"
            name={displayName}
            uri={selectedPresetId === null ? currentAvatarUri : buildAvatarPresetUri(selectedPresetId)}
          />
          <strong>{displayName}</strong>
        </section>

        <section className="avatar-preset-library">
          <h3>{t("avatar.presets")}</h3>
          <div className="avatar-preset-grid">
          {presetIds.map((presetId) => {
            const selected = presetId === selectedPresetId;
            return (
              <button
                key={presetId}
                className={`avatar-preset-tile ${selected ? "selected" : ""}`}
                onClick={() => setSelectedPresetId(presetId)}
                type="button"
              >
                <img alt={`Preset ${presetId}`} loading="lazy" src={buildAvatarPresetUri(presetId)} />
                {selected ? <span aria-hidden="true" className="avatar-preset-check">✓</span> : null}
              </button>
            );
          })}

          {onRequestCustomUpload ? (
            <button
              aria-label={customUploadEnabled ? t("avatar.uploadCustom") : effectiveCustomUploadHint}
              className={`avatar-preset-tile avatar-preset-upload-tile${customUploadEnabled ? "" : " is-locked"}`}
              disabled={saving || !customUploadEnabled}
              onClick={onRequestCustomUpload}
              title={effectiveCustomUploadHint}
              type="button"
            >
              {customUploadEnabled ? <UploadAvatarIcon /> : <span className="material-symbols-outlined">lock</span>}
            </button>
          ) : null}
          </div>
          {onRequestCustomUpload && !customUploadEnabled ? <p className="avatar-preset-upload-hint">{effectiveCustomUploadHint}</p> : null}
        </section>
      </div>
    </SideDrawer>
  );
}
