import type { Chat } from "../types";

export function applyChatPresence(chats: Chat[], snapshot: Chat[]): Chat[] {
  const byChat = new Map(snapshot.map((chat) => [chat.id, chat]));
  let changed = false;
  const next = chats.map((chat) => {
    const fresh = byChat.get(chat.id);
    if (!fresh) return chat;
    const onlineByMember = new Map(fresh.detail.members.map((member) => [member.userId, member.online]));
    let membersChanged = false;
    const members = chat.detail.members.map((member) => {
      const online = onlineByMember.get(member.userId);
      if (online === undefined || online === member.online) return member;
      membersChanged = true;
      return { ...member, online };
    });
    const subtitle = chat.type === "direct" ? fresh.subtitle : chat.subtitle;
    if (!membersChanged && chat.online === fresh.online && chat.subtitle === subtitle) return chat;
    changed = true;
    return {
      ...chat,
      online: fresh.online,
      subtitle,
      detail: membersChanged ? { ...chat.detail, members } : chat.detail,
    };
  });
  return changed ? next : chats;
}
