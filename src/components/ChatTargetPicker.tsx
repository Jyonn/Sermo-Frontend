import type { ReactNode } from "react";
import { useI18n } from "../lib/language";
import { BottomSheet } from "./BottomSheet";
import { ContentLoader, QuietState } from "./BoundaryState";
import { UserAvatar } from "./UserAvatar";

export interface ChatTargetPickerItem {
  id: number;
  title: string;
  preview: string;
  time?: string;
  pinned?: boolean;
  avatarUri?: string | null;
  avatarCacheKey?: string | null;
  avatarFrameStyle?: Parameters<typeof UserAvatar>[0]["frame"];
  groupMembers?: Array<{ name: string; uri?: string | null; cacheKey?: string | null }>;
}

interface ChatTargetPickerProps {
  open: boolean;
  title: string;
  description?: string;
  targets: ChatTargetPickerItem[];
  selectedIds?: number[];
  multiple?: boolean;
  maxSelections?: number;
  loading?: boolean;
  busy?: boolean;
  busyTargetId?: number | null;
  emptyTitle: string;
  submitLabel?: string;
  beforeList?: ReactNode;
  onClose: () => void;
  onSelectionChange?: (ids: number[]) => void;
  onLimitReached?: () => void;
  onSubmit: (ids: number[]) => void | Promise<void>;
}

export function ChatTargetPicker({
  open,
  title,
  description,
  targets,
  selectedIds = [],
  multiple = false,
  maxSelections = 10,
  loading = false,
  busy = false,
  busyTargetId = null,
  emptyTitle,
  submitLabel,
  beforeList,
  onClose,
  onSelectionChange,
  onLimitReached,
  onSubmit,
}: ChatTargetPickerProps) {
  const { t } = useI18n();

  const choose = (id: number) => {
    if (busy) return;
    if (!multiple) {
      void onSubmit([id]);
      return;
    }
    const selected = selectedIds.includes(id);
    if (!selected && selectedIds.length >= maxSelections) {
      onLimitReached?.();
      return;
    }
    onSelectionChange?.(selected ? selectedIds.filter((targetId) => targetId !== id) : [...selectedIds, id]);
  };

  return (
    <BottomSheet className="chat-target-picker-sheet" bodyClassName="chat-target-picker-body" description={description} onClose={onClose} open={open} title={title}>
      {beforeList}
      {multiple ? <div className="chat-target-picker-heading"><strong>{t("message.chooseForwardChats")}</strong><span>{selectedIds.length}/{maxSelections}</span></div> : null}
      {loading && !targets.length ? <ContentLoader label={t("square.loadingChats")} rows={4} /> : null}
      {!loading && !targets.length ? <QuietState icon="forum" title={emptyTitle} /> : null}
      {targets.length ? <div className="chat-target-picker-list">
        {targets.map((target) => {
          const selected = selectedIds.includes(target.id);
          const targetBusy = busy && busyTargetId === target.id;
          return <button
            aria-checked={multiple ? selected : undefined}
            className={selected ? "is-selected" : ""}
            disabled={busy || (multiple && !selected && selectedIds.length >= maxSelections)}
            key={target.id}
            onClick={() => choose(target.id)}
            role={multiple ? "checkbox" : undefined}
            type="button"
          >
            <UserAvatar className="chat-target-picker-avatar" groupMembers={target.groupMembers} name={target.title} uri={target.avatarUri} cacheKey={target.avatarCacheKey} frame={target.avatarFrameStyle} />
            <span className="chat-target-picker-copy"><strong>{target.title}</strong><small>{target.preview}</small></span>
            <span className="chat-target-picker-meta">
              {target.pinned ? <i className="material-symbols-outlined" aria-label={t("chat.pinned")}>keep</i> : null}
              {target.time ? <time>{target.time}</time> : null}
              <i className={`material-symbols-outlined${targetBusy ? " is-loading" : ""}`} aria-hidden="true">
                {targetBusy ? "progress_activity" : multiple ? selected ? "check_circle" : "radio_button_unchecked" : "chevron_right"}
              </i>
            </span>
          </button>;
        })}
      </div> : null}
      {multiple ? <div className="chat-target-picker-submit"><button className="button" disabled={!selectedIds.length || busy} onClick={() => void onSubmit(selectedIds)} type="button">{busy ? t("common.processing") : submitLabel}</button></div> : null}
    </BottomSheet>
  );
}
