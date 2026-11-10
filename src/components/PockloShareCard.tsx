import { useI18n } from "../lib/language";
import { API_BASE_URL } from "../lib/siteConfig";
import { pockloShareToken } from "../lib/pockloShare";
import pockloIcon from "../assets/pocklo-mark.svg";
import { PockloGlyph } from "./PockloGlyph";
import { PockloFileVisual, pockloFileType } from "./PockloFileVisual";
import "./PockloShareCard.css";

type PockloShare = {
  provider: "pocklo_share"; title: string; url: string; kind: "file" | "folder" | "link";
  preview?: string; has_thumbnail?: boolean;
};

export function isPockloShare(value: unknown): value is PockloShare {
  const item = value as Partial<PockloShare> | null;
  return item?.provider === "pocklo_share" && typeof item.title === "string" && typeof item.url === "string"
    && Boolean(pockloShareToken(item.url)) && (item.kind === "file" || item.kind === "folder" || item.kind === "link");
}

export function PockloShareCard({ share }: { share: PockloShare }) {
  const { t } = useI18n();
  const file = share.kind === "file";
  const folder = share.kind === "folder";
  const label = t(file ? "pocklo.sharedFile" : folder ? "pocklo.sharedFolder" : "pocklo.sharedLink");
  const resourceUrl = `${API_BASE_URL}/users/pocklo/shares/${pockloShareToken(share.url)}`;
  const href = file ? `${resourceUrl}/download` : share.url;
  const type = pockloFileType(share.title, folder, share.preview);
  const hasThumbnail = share.has_thumbnail ?? (type === "image" || type === "video");
  return (
    <div className="pocklo-share-card" data-kind={share.kind}>
      <a className="pocklo-share-main" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}
        aria-label={t(file ? "pocklo.downloadNamed" : "pocklo.openNamed", { name: share.title })}>
        <PockloFileVisual className="pocklo-share-kind" name={share.title} folder={folder}
          preview={share.kind === "link" ? "link" : share.preview}
          thumbnail={file && hasThumbnail ? `${resourceUrl}/thumbnail` : undefined} />
        <span className="pocklo-share-copy"><small><img alt="" src={pockloIcon} /><span>{label}</span></small><strong>{share.title}</strong></span>
        {file && <PockloGlyph name="download" className="pocklo-share-download" />}
      </a>
      <a className="pocklo-share-open" href={share.url} target="_blank" rel="noreferrer"
        aria-label={t("pocklo.open")} title={t("pocklo.open")} onClick={(event) => event.stopPropagation()}>
        <PockloGlyph name="open" />
      </a>
    </div>
  );
}
