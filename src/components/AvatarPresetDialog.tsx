import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "../lib/bodyLock";
import { AVATAR_PRESET_PAGES, buildAvatarPresetPages, buildAvatarPresetUri, parseAvatarPresetId } from "../lib/avatar";
import { UserAvatar } from "./UserAvatar";

interface AvatarPresetDialogProps {
  open: boolean;
  currentAvatarUri?: string | null;
  displayName: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (presetId: number) => void | Promise<void>;
}

const avatarPages = buildAvatarPresetPages();

export function AvatarPresetDialog({
  open,
  currentAvatarUri,
  displayName,
  saving = false,
  onClose,
  onSave,
}: AvatarPresetDialogProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentPresetId = useMemo(() => parseAvatarPresetId(currentAvatarUri) ?? 1, [currentAvatarUri]);
  const [selectedPresetId, setSelectedPresetId] = useState(currentPresetId);
  const [activePage, setActivePage] = useState(Math.floor((currentPresetId - 1) / 16));

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const nextPresetId = parseAvatarPresetId(currentAvatarUri) ?? 1;
    setSelectedPresetId(nextPresetId);
    setActivePage(Math.floor((nextPresetId - 1) / 16));
  }, [currentAvatarUri, open]);

  useEffect(() => {
    if (!open) return;
    const element = scrollerRef.current;
    if (!element) return;
    const nextLeft = activePage * element.clientWidth;
    element.scrollLeft = nextLeft;
  }, [activePage, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section aria-modal="true" className="avatar-preset-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="avatar-preset-dialog-head">
          <div>
            <p className="eyebrow">Avatar</p>
            <h2>选择头像</h2>
            <p>左右滑动翻页，每页 16 个预设头像。</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="avatar-preset-current">
          <UserAvatar className="avatar-large avatar-preset-current-avatar" name={displayName} uri={buildAvatarPresetUri(selectedPresetId)} />
          <div className="row-main">
            <strong>{displayName}</strong>
            <div className="row-subtle">预设头像 {String(selectedPresetId).padStart(2, "0")}</div>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="avatar-preset-pages"
          onScroll={(event) => {
            const element = event.currentTarget;
            const width = element.clientWidth || 1;
            setActivePage(Math.min(AVATAR_PRESET_PAGES - 1, Math.max(0, Math.round(element.scrollLeft / width))));
          }}
        >
          {avatarPages.map((page, pageIndex) => (
            <div key={pageIndex} className="avatar-preset-page">
              <div className="avatar-preset-grid">
                {page.map((presetId) => {
                  const selected = presetId === selectedPresetId;
                  return (
                    <button
                      key={presetId}
                      className={`avatar-preset-tile ${selected ? "selected" : ""}`}
                      onClick={() => setSelectedPresetId(presetId)}
                      type="button"
                    >
                      <img alt={`Preset ${presetId}`} loading="lazy" src={buildAvatarPresetUri(presetId)} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="avatar-preset-dots" role="tablist" aria-label="头像分页">
          {Array.from({ length: AVATAR_PRESET_PAGES }, (_, pageIndex) => (
            <button
              key={pageIndex}
              aria-label={`第 ${pageIndex + 1} 页`}
              className={`avatar-preset-dot ${pageIndex === activePage ? "active" : ""}`}
              onClick={() => {
                const element = scrollerRef.current;
                if (!element) return;
                element.scrollTo({ left: pageIndex * element.clientWidth, behavior: "smooth" });
              }}
              role="tab"
              type="button"
            />
          ))}
        </div>

        <div className="avatar-preset-actions">
          <button className="ghost-button" onClick={onClose} type="button">
            取消
          </button>
          <button className="button" disabled={saving} onClick={() => void onSave(selectedPresetId)} type="button">
            {saving ? "保存中..." : "使用这个头像"}
          </button>
        </div>
      </section>
    </div>
  );
}
