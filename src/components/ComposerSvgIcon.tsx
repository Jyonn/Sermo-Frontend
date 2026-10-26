export function ComposerSvgIcon({ kind, className }: { kind: "return" | "plus" | "album" | "file" | "location" | "map" | "mic" | "stop" | "delete" | "emoji" | "keyboard" | "pin" | "pin-off"; className?: string }) {
  if (kind === "return") return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24"><path d="M19 5v7a3 3 0 0 1-3 3H5m5-5-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (kind === "plus") return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  if (kind === "emoji") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path d="M8.5 14c.85 1.35 2 2.05 3.5 2.05s2.65-.7 3.5-2.05" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "keyboard") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 9h.01M10.35 9h.01M13.7 9h.01M17 9h.01M7 12.35h.01M10.35 12.35h.01M13.7 12.35h.01M17 12.35h.01M8.2 15.7h7.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (kind === "pin" || kind === "pin-off") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M8 3.75h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        <path d="m9.35 4 .6 5.05-2.45 2.5v1.35h9v-1.35l-2.45-2.5.6-5.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" />
        <path d="M12 12.9v7.35" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
        {kind === "pin-off" ? <path d="M4.2 4.2 19.8 19.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" /> : null}
      </svg>
    );
  }

  if (kind === "album") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect x="3.5" y="5" width="17" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1.7" fill="currentColor" />
        <path d="M7 16.5 11.2 12.3a1.1 1.1 0 0 1 1.56 0l1.58 1.58a1.1 1.1 0 0 0 1.56 0L17 12.6l3.5 3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "file") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M7 3.75h6.7L18.5 8.6v11.65H7V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M13.5 4v5h4.75M9.5 13h6M9.5 16.5h4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "location") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M19 10.2c0 5.1-7 10-7 10s-7-4.9-7-10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <circle cx="12" cy="10.2" r="2.35" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "map") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="m3.5 5.75 5-2.25 7 2.25 5-2.25v14.75l-5 2.25-7-2.25-5 2.25V5.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M8.5 3.5v14.75m7-12.5V20.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M13.4 10.2c0 1.75-2.4 3.45-2.4 3.45s-2.4-1.7-2.4-3.45a2.4 2.4 0 1 1 4.8 0Z" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "stop") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="9" y="9" width="6" height="6" rx="1.4" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "delete") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path
          d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75h3a.75.75 0 0 1 0 1.5H18v11.25A2.25 2.25 0 0 1 15.75 21h-7.5A2.25 2.25 0 0 1 6 18.75V7.5H4.5a.75.75 0 0 1 0-1.5h3v-.75A1.5 1.5 0 0 1 9 3.75Zm6 2.25v-.75h-6V6h6Zm-7.5 1.5v11.25a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75V7.5h-9Zm3 2.25c.414 0 .75.336.75.75v5.25a.75.75 0 0 1-1.5 0V10.5c0-.414.336-.75.75-.75Zm3 0c.414 0 .75.336.75.75v5.25a.75.75 0 0 1-1.5 0V10.5c0-.414.336-.75.75-.75Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 15.5a3.1 3.1 0 0 0 3.1-3.1V8.9a3.1 3.1 0 1 0-6.2 0v3.5a3.1 3.1 0 0 0 3.1 3.1Z" fill="currentColor" />
      <path d="M6.8 11.8a5.2 5.2 0 1 0 10.4 0M12 17v3M9 20h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
