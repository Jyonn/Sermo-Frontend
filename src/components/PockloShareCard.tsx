import { useI18n } from "../lib/language";
import { API_BASE_URL } from "../lib/siteConfig";
import pockloIcon from "../assets/pocklo-mark.svg";
import "./PockloShareCard.css";

type PockloShare = { provider: "pocklo_share"; title: string; url: string; kind: "file" | "folder" | "link" };

export function pockloShareToken(value: string) {
  return /^https:\/\/pocklo\.jyonn\.space\/share\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(value)?.[1]?.toLowerCase();
}

export function isPockloShare(value: unknown): value is PockloShare {
  const item = value as Partial<PockloShare> | null;
  return item?.provider === "pocklo_share" && typeof item.title === "string" && typeof item.url === "string"
    && Boolean(pockloShareToken(item.url)) && (item.kind === "file" || item.kind === "folder" || item.kind === "link");
}

export function PockloShareCard({ share }: { share: PockloShare }) {
  const { t } = useI18n();
  const file = share.kind === "file";
  const label = t(file ? "pocklo.sharedFile" : share.kind === "folder" ? "pocklo.sharedFolder" : "pocklo.sharedLink");
  const href = file ? `${API_BASE_URL}/users/pocklo/shares/${pockloShareToken(share.url)}/download` : share.url;
  return (
    <div className="pocklo-share-card">
      <a className="pocklo-share-main" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        <img alt="" src={pockloIcon} />
        <span><small>{label}</small><strong>{share.title}</strong></span>
        {file && <span className="material-symbols-outlined" aria-label={t("pocklo.download")}>download</span>}
      </a>
      <a className="pocklo-share-open" href={share.url} target="_blank" rel="noreferrer"
        aria-label={t("pocklo.open")} title={t("pocklo.open")} onClick={(event) => event.stopPropagation()}>
        <span className="material-symbols-outlined" aria-hidden="true">north_east</span>
      </a>
    </div>
  );
}
