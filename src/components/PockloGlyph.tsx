const paths = {
  file: "M6 3h8l4 4v14H6z M14 3v5h4 M9 13h6 M9 17h6",
  folder: "M3 6h7l2 2h9v12H3z",
  link: "M10 13a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-2 2 M14 11a3 3 0 0 0-4 0l-4 4a3 3 0 0 0 4 4l2-2",
  download: "M12 3v12 M8 11l4 4 4-4 M5 17v4h14v-4",
  open: "M7 17 17 7 M7 7h10v10",
  back: "M20 12H4 M10 6l-6 6 6 6",
  next: "m9 6 6 6-6 6",
  checked: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M8 12l3 3 5-6",
  unchecked: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
};

export function PockloGlyph({ name, className }: { name: keyof typeof paths; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
