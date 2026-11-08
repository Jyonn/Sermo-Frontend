import { useState } from "react";
import "./PockloFileVisual.css";

// Artwork and extension groups come from Pocklo's file-types library.
const icons = import.meta.glob<string>("../assets/pocklo-file-types/*.svg", { eager: true, query: "?url", import: "default" });
const extensionsByType = {
  pdf: "pdf",
  image: "png jpg jpeg gif webp avif heic heif bmp tiff tif ico dng raw cr2 nef arw",
  video: "mp4 m4v mov mkv webm avi wmv flv mpeg mpg ts m2ts 3gp",
  audio: "mp3 wav flac aac m4a ogg opus aiff wma mid midi",
  markdown: "md markdown mdown mdx",
  text: "txt log nfo",
  link: "url webloc desktop",
  document: "doc docx docm odt rtf pages wps",
  sheet: "xls xlsx xlsm ods csv tsv numbers et",
  slides: "ppt pptx pptm odp key dps",
  archive: "zip rar 7z tar gz bz2 xz zst tgz tbz tbz2 txz",
  code: "js jsx ts tsx py rb php go rs java kt swift c h cpp hpp cs sh bash zsh ps1 bat sql lua r dart scala vue svelte ipynb",
  web: "html htm xhtml css scss sass less mhtml",
  data: "json jsonl xml yaml yml toml ini conf cfg env plist parquet arrow avro",
  executable: "exe msi apk aab app pkg deb rpm appimage jar dll so dylib ipa",
  font: "ttf otf ttc woff woff2 eot",
  ebook: "epub mobi azw azw3 fb2 cbz cbr",
  vector: "svg svgz ai eps emfs emf wmf",
  design: "psd psb sketch fig xd indd idml xcf afdesign",
  database: "db sqlite sqlite3 dbf mdb accdb",
  disk: "iso dmg img vhd vhdx vmdk qcow2",
  subtitle: "srt vtt ass ssa sub",
  cad: "dwg dxf step stp iges igs stl obj fbx glb gltf blend 3mf",
};
const typeByExtension = new Map(Object.entries(extensionsByType).flatMap(([type, extensions]) =>
  extensions.split(" ").map((extension) => [extension, type] as const)));

export function pockloCdnThumbnail(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.origin === "https://res.6-79.cn" && !url.username && !url.password && !url.hash) return url.href;
  } catch {
    return undefined;
  }
}

export function pockloFileType(name: string, folder?: boolean, preview?: unknown) {
  if (folder) return "folder";
  if (preview === "link") return "link";
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  return typeByExtension.get(extension) ?? (typeof preview === "string" ? preview : "file");
}

function Thumbnail({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") return null;
  return <img className="pocklo-file-thumbnail" src={src} data-ready={state === "ready"} alt=""
    loading="lazy" decoding="async" referrerPolicy="no-referrer"
    onLoad={() => setState("ready")} onError={() => setState("failed")} />;
}

export function PockloFileVisual({ name, folder, preview, thumbnail, className }: {
  name: string; folder?: boolean; preview?: unknown; thumbnail?: string; className: string;
}) {
  const type = pockloFileType(name, folder, preview);
  const icon = icons[`../assets/pocklo-file-types/${type}.svg`] ?? icons["../assets/pocklo-file-types/file.svg"];
  return <span className={`${className} pocklo-file-visual`} aria-hidden="true">
    <img className="pocklo-file-type-art" src={icon} alt="" />
    {!folder && preview !== "link" && thumbnail && <Thumbnail key={thumbnail} src={thumbnail} />}
  </span>;
}
