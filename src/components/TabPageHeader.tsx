import { useRef, type ReactNode } from "react";
import {useTabHeaderSurface} from '../lib/useTabHeaderSurface';
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";

interface TabPageHeaderProps {
  title: ReactNode;
  syncing?: boolean;
  status?: ReactNode;
  actions?: ReactNode;
  secondary?: ReactNode;
}

export function TabPageHeader({ title, syncing = false, status, actions, secondary }: TabPageHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);

  useTabHeaderSurface(headerRef);

  return (
    <>
    <div ref={headerRef} className={`tab-sticky-header tab-header-surface${secondary ? " has-secondary" : ""}`}>
      <div className="page-toolbar">
        <div className="page-toolbar-title-status">
          <h2 className="panel-title">{title}</h2>
          <HeaderSyncIndicator syncing={syncing} />
          {status}
        </div>
        {actions ? <div className="page-toolbar-actions">{actions}</div> : null}
      </div>
      {secondary ? <div className="tab-sticky-header-secondary">{secondary}</div> : null}
    </div>
    </>
  );
}
