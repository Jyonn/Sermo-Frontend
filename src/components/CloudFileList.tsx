import type { ReactNode } from "react";
import { formatCloudResourceBytes, groupCloudResourcesByPeriod } from "../lib/cloudResources";
import { useI18n } from "../lib/language";
import type { CloudResourceDTO } from "../types";

interface CloudFileListProps {
  items: CloudResourceDTO[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect?: (asset: CloudResourceDTO) => void;
  renderAction?: (asset: CloudResourceDTO) => ReactNode;
}

export function CloudFileList({ items, query, onQueryChange, onSelect, renderAction }: CloudFileListProps) {
  const { t, language } = useI18n();
  const groups = groupCloudResourcesByPeriod(items, language);

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
      <div className="cloud-resource-sections">
        {groups.map((group) => (
          <section className="cloud-resource-section" key={group.label}>
            <h3>{group.label}</h3>
            <div className="cloud-resource-file-list">
              {group.items.map((asset) => (
                <article className={`cloud-resource-file${onSelect ? " is-selectable" : ""}`} key={asset.resource_id}>
                  <button className="cloud-resource-file-main" disabled={!onSelect} onClick={() => onSelect?.(asset)} type="button">
                    <span className="cloud-resource-file-icon material-symbols-outlined" aria-hidden="true">draft</span>
                    <span className="cloud-resource-file-copy">
                      <strong>{asset.file_name || t("cloudResources.tab.file")}</strong>
                      <small>{formatCloudResourceBytes(asset.file_size)}</small>
                    </span>
                  </button>
                  {renderAction?.(asset)}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
