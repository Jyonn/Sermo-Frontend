import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { formatRelativeTime } from "../lib/presentation";
import type { ChatDTO, PlatformAdminMemberDTO } from "../types";
import { FeedbackState } from "./FeedbackState";
import { UserAvatar } from "./UserAvatar";

export function PlatformMemberPanel({ member, onChat }: { member: PlatformAdminMemberDTO; onChat: (chat: ChatDTO) => void }) {
  const { t } = useI18n();
  const [chats, setChats] = useState<ChatDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setChats(null);
    setError(null);
    void api.getPlatformMemberChats(member.user_id, controller.signal).then((items) => {
      if (!controller.signal.aborted) setChats(items);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("management.chatsFailed"));
    });
    return () => controller.abort();
  }, [member.user_id, retry, t]);
  const chatTitle = (chat: ChatDTO) => chat.title || chat.members.map((item) => item.name).join("、") || t("management.conversation");
  const visible = chats?.filter((chat) => `${chatTitle(chat)} ${chat.members.map((item) => item.name).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="platform-member-sheet">
    <header className="platform-member-identity">
      <UserAvatar className="platform-member-portrait" frame={member.avatar_frame_style} name={member.name} uri={member.avatar_uri} />
      <div><h2>{member.name}</h2><p>#{member.user_id}<span>LV{member.growth_level ?? 1}</span><span>{t(member.verified ? "admin.verified" : "management.unverified")}</span></p></div>
    </header>
    <dl className="platform-member-facts">{[
      { label: t("admin.friends"), value: member.friend_count },
      { label: t("management.conversations"), value: member.chat_count },
      { label: t("admin.statements"), value: member.statement_count },
      { label: t("management.notificationChannels"), value: member.notifications_enabled },
    ].map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    <section className="platform-member-bindings"><h3>{t("management.bindings")}</h3><dl>{([
      { key: "email", icon: "mail", label: t("channel.email") },
      { key: "phone", icon: "smartphone", label: t("channel.sms") },
      { key: "bark", icon: "bolt", label: t("channel.instant") },
    ] as const).map((item) => <div key={item.key}><dt><span aria-hidden="true" className="material-symbols-outlined">{item.icon}</span>{item.label}</dt><dd className={member.contacts[item.key] ? "is-bound" : ""}>{t(member.contacts[item.key] ? "management.bound" : "channel.unbound")}</dd></div>)}</dl></section>
    <section className="platform-member-conversations">
      <header><h3>{t("management.conversations")}</h3>{chats ? <small>{chats.length}</small> : null}</header>
      <p>{t("management.auditReasonRequired")}</p>
      {chats?.length ? <label className="platform-member-chat-search"><span aria-hidden="true" className="material-symbols-outlined">search</span><input aria-label={t("management.searchChats")} placeholder={t("management.searchChats")} value={query} onChange={(event) => setQuery(event.target.value)} /></label> : null}
      {error ? <FeedbackState tone="error" title={t("management.chatsFailed")} description={error} action={<button className="ghost-button" onClick={() => setRetry((value) => value + 1)} type="button">{t("common.retry")}</button>} /> : chats === null ? <FeedbackState tone="loading" title={t("common.loading")} /> : visible?.length ? <div className="platform-member-chat-list">{visible.map((chat) => <button key={chat.chat_id} onClick={() => onChat(chat)} type="button">
        <UserAvatar className="platform-member-chat-avatar" groupMembers={chat.group ? chat.members.map((item) => ({ name: item.name, uri: item.avatar_uri })) : undefined} name={chatTitle(chat)} />
        <span><strong>{chatTitle(chat)}</strong><small>{chat.last_message?.content || t("chat.noMessages")}</small></span>
        <time>{chat.last_chat_at ? formatRelativeTime(chat.last_chat_at) : ""}</time><span aria-hidden="true" className="material-symbols-outlined">chevron_right</span>
      </button>)}</div> : <FeedbackState tone="empty" icon={query.trim() ? "search_off" : "chat_bubble"} title={t("management.noChats")} />}
    </section>
  </div>;
}
