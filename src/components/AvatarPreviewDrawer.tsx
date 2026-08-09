import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { useI18n } from "../lib/language";
import type { UserDTO } from "../types";

interface AvatarPreviewDrawerProps {
  open: boolean;
  name: string;
  uri: string;
  frame?: UserDTO["avatar_frame_style"];
  vip?: boolean;
  level?: number;
  online?: boolean;
  onClose: () => void;
}

async function downloadAvatar(uri: string, name: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `sermo-${name}-${Date.now()}.${extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(uri, "_blank", "noopener,noreferrer");
  }
}

export function AvatarPreviewDrawer({
  open,
  name,
  uri,
  frame = "none",
  vip = false,
  level,
  online = false,
  onClose,
}: AvatarPreviewDrawerProps) {
  const { t } = useI18n();

  return (
    <SideDrawer historyKey="avatar" onClose={onClose} open={open} title={t("profile.avatar")}>
      <div className="avatar-preview-drawer">
        <section className="avatar-preview-stage">
          <span aria-hidden="true" className="avatar-preview-orbit" />
          <UserAvatar
            className="avatar-preview-portrait"
            frame={frame}
            name={name}
            uri={uri}
            vip={vip}
          />
        </section>

        <section className="avatar-preview-caption">
          <div className="avatar-preview-identity">
            <span className={`avatar-preview-presence${online ? " is-online" : ""}`}>
              <i aria-hidden="true" />
              {online ? t("profile.onlineNow") : t("profile.offline")}
            </span>
            <h2>{name}</h2>
            <div className="avatar-preview-badges">
              {vip ? <span className="user-profile-vip-badge">{t("profile.permanentVip")}</span> : null}
              {level ? <span className="user-profile-level-badge"><b>Lv.{level}</b></span> : null}
            </div>
          </div>
          <button
            aria-label={t("media.downloadImage")}
            className="avatar-preview-download"
            onClick={() => void downloadAvatar(uri, name)}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            <span>{t("media.downloadImage")}</span>
          </button>
        </section>
      </div>
    </SideDrawer>
  );
}
