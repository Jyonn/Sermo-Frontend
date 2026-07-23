import type { ReactNode } from "react";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";

interface TabPageHeaderProps {
  title: string;
  syncing?: boolean;
  status?: ReactNode;
}

export function TabPageHeader({ title, syncing = false, status }: TabPageHeaderProps) {
  return (
    <div className="tab-sticky-header">
      <div className="page-toolbar">
        <div className="page-toolbar-title-status">
          <h2 className="panel-title">{title}</h2>
          <HeaderSyncIndicator syncing={syncing} />
          {status}
        </div>
      </div>
    </div>
  );
}
