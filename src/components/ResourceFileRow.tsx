import type { ReactNode } from "react";

export function ResourceFileRow({
  title,
  detail,
  href,
  download,
  onSelect,
  action,
}: {
  title: string;
  detail?: string;
  href?: string;
  download?: string;
  onSelect?: () => void;
  action?: ReactNode;
}) {
  const content = <>
    <span className="cloud-resource-file-icon material-symbols-outlined" aria-hidden="true">draft</span>
    <span className="cloud-resource-file-copy"><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</span>
  </>;
  return <div className={`cloud-resource-file${onSelect || href ? " is-selectable" : ""}`}>
    {href ? <a className="cloud-resource-file-main" download={download} href={href}>{content}</a> : <button className="cloud-resource-file-main" disabled={!onSelect} onClick={onSelect} type="button">{content}</button>}
    {action}
  </div>;
}
