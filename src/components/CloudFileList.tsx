import type { ReactNode } from "react";
import { formatCloudResourceBytes } from "../lib/cloudResources";
import { useI18n } from "../lib/language";
import type { CloudResourceDTO } from "../types";
import { RelativeDateSections } from "./RelativeDateSections";
import { ResourceFileRow } from "./ResourceFileRow";

interface CloudFileListProps {
  items: CloudResourceDTO[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect?: (asset: CloudResourceDTO) => void;
  renderAction?: (asset: CloudResourceDTO) => ReactNode;
}

export function CloudFileList({ items, query, onQueryChange, onSelect, renderAction }: CloudFileListProps) {
  const { t } = useI18n();

  return (
    <div className="cloud-file-browser">
      <label className="cloud-resource-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          aria-label={t("cloudResources.searchFiles")}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("cloudResources.searchFiles")}
          type="search"
          value={query}
        />
        {query ? (
          <button aria-label={t("common.clear")} onClick={() => onQueryChange("")} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        ) : null}
      </label>
      <RelativeDateSections identity={(asset) => asset.resource_id} items={items} timestamp={(asset) => asset.created_at}>
        {(group) => (
            <div className="cloud-resource-file-list">
              {group.map((asset) => (
                <ResourceFileRow action={renderAction?.(asset)} detail={formatCloudResourceBytes(asset.file_size)} key={asset.resource_id} onSelect={onSelect ? () => onSelect(asset) : undefined} title={asset.file_name || t("cloudResources.tab.file")} />
              ))}
            </div>
        )}
      </RelativeDateSections>
    </div>
  );
}
