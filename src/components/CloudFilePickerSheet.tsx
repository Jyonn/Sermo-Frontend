import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { CloudResourceDTO, CloudResourceListDTO } from "../types";
import { BottomSheet } from "./BottomSheet";
import { ContentLoader, QuietState } from "./BoundaryState";
import { CloudFileList } from "./CloudFileList";

interface CloudFilePickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: CloudResourceDTO) => Promise<void>;
}

export function CloudFilePickerSheet({ open, onClose, onSelect }: CloudFilePickerSheetProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [data, setData] = useState<CloudResourceListDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSerialRef = useRef(0);

  const load = async (append = false) => {
    const requestSerial = ++requestSerialRef.current;
    const offset = append ? (data?.next_offset || 0) : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const response = await api.getCloudResources("file", { offset, limit: 40, keyword: deferredQuery || undefined });
      if (requestSerial !== requestSerialRef.current) return;
      setData((current) => {
        if (!append || !current) return response;
        const knownIds = new Set(current.items.map((item) => item.resource_id));
        return { ...response, items: [...current.items, ...response.items.filter((item) => !knownIds.has(item.resource_id))] };
      });
    } catch (error) {
      if (requestSerial === requestSerialRef.current) {
        showToast(error instanceof ApiError ? error.message : t("cloudResources.loadFailed"), "error");
      }
    } finally {
      if (requestSerial === requestSerialRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    setData(null);
    void load();
  }, [open, deferredQuery]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!open || !node || !data?.has_more || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void load(true);
    }, { root: node.closest(".sheet-body"), rootMargin: "180px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, data?.has_more, data?.next_offset, loading, loadingMore]);

  const select = async (asset: CloudResourceDTO) => {
    if (busyId !== null) return;
    setBusyId(asset.resource_id);
    try {
      await onSelect(asset);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const emptyTitle = deferredQuery ? t("cloudResources.noMatchingFiles") : t("cloudResources.emptyFiles");

  return (
    <BottomSheet bodyClassName="cloud-file-picker-body" className="cloud-file-picker-sheet" onClose={onClose} open={open} title={t("cloudResources.chooseFile")}>
      <CloudFileList items={data?.items || []} onQueryChange={setQuery} onSelect={(asset) => void select(asset)} query={query} />
      {loading && !data ? <ContentLoader label={t("common.loading")} /> : null}
      {!loading && data?.items.length === 0 ? <QuietState title={emptyTitle} /> : null}
      <div aria-hidden="true" className={`cloud-resource-load-more${loadingMore ? " is-loading" : ""}`} ref={sentinelRef}>
        {loadingMore ? <span className="material-symbols-outlined">progress_activity</span> : null}
      </div>
      {busyId !== null ? <div className="cloud-file-picker-sending"><span className="material-symbols-outlined">progress_activity</span></div> : null}
    </BottomSheet>
  );
}
