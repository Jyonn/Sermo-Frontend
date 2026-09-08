import barkIconUrl from "../assets/bark-app-icon.jpg";
import gotifyIconUrl from "../assets/contact-channels/gotify.svg";
import ntfyIconUrl from "../assets/contact-channels/ntfy.png";
import pushdeerIconUrl from "../assets/contact-channels/pushdeer.png";
import qqIconUrl from "../assets/contact-channels/qq.jpg";
import type { InstantNotificationProvider } from "../types";

export type ContactChannelIconKind = "email" | "sms" | "qq" | InstantNotificationProvider;

const providerIcons: Partial<Record<ContactChannelIconKind, string>> = {
  bark: barkIconUrl,
  gotify: gotifyIconUrl,
  ntfy: ntfyIconUrl,
  pushdeer: pushdeerIconUrl,
  qq: qqIconUrl,
};

export function ContactChannelIcon({ kind, size = "regular" }: { kind: ContactChannelIconKind; size?: "compact" | "regular" | "large" }) {
  const image = providerIcons[kind];
  return (
    <span className={`contact-channel-icon is-${kind} is-${size}`} aria-hidden="true">
      {image ? <img alt="" src={image} /> : <span className="material-symbols-outlined">{kind === "email" ? "mail" : "smartphone"}</span>}
    </span>
  );
}
