export function HeaderSyncIndicator({ syncing }: { syncing: boolean }) {
  if (!syncing) return null;
  return (
    <span aria-label="正在同步" className="header-sync-indicator" role="status">
      <span className="material-symbols-outlined">progress_activity</span>
    </span>
  );
}
