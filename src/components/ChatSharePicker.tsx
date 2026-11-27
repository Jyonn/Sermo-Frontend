import {useEffect, useRef, useState} from 'react';
import {useAuth} from '../lib/auth';
import {useI18n} from '../lib/language';
import {api} from '../lib/api';
import {showToast} from '../lib/toast';
import type {ChatDTO} from '../types';
import {ChatTargetPicker} from './ChatTargetPicker';

export function ChatSharePicker({open, title, onClose, sendToChat, groupsOnly = false}: {
  open: boolean;
  title: string;
  onClose: () => void;
  sendToChat: (chatId: number, clientId: string) => Promise<unknown>;
  groupsOnly?: boolean;
}) {
  const {t} = useI18n();
  const {session} = useAuth();
  const [chats, setChats] = useState<ChatDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const requestIds = useRef(new Map<number, string>());
  const sending = useRef(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setChats([]);
    setLoading(true);
    void api.getChats(controller.signal).then(rows => {
      if (!controller.signal.aborted) setChats(rows);
    }).catch(error => {
      if (!controller.signal.aborted) showToast(error instanceof Error ? error.message : t('square.shareLoadFailed'), 'error');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open]);

  const send = async ([id]: number[]) => {
    if (!id || sending.current) return;
    sending.current = true;
    setBusy(id);
    const clientId = requestIds.current.get(id) ?? crypto.randomUUID();
    requestIds.current.set(id, clientId);
    try {
      await sendToChat(id, clientId);
      requestIds.current.clear();
      onClose();
      showToast(t('square.sharedTo', {chat: chats.find(chat => chat.chat_id === id)?.title || t('nav.chats')}));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('square.shareFailed'), 'error');
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  return <ChatTargetPicker open={open} title={title} targets={chats.filter(chat => !groupsOnly || chat.group).map(chat => {
    const peer = chat.members.find(member => member.user_id !== session?.user.user_id) ?? chat.members[0];
    return {
      id: chat.chat_id, title: chat.title || peer?.name || t('nav.chats'), preview: chat.last_message?.content || '',
      avatarUri: chat.group ? undefined : peer?.avatar_uri,
      groupMembers: chat.group ? chat.members.map(member => ({name: member.name, uri: member.avatar_uri})) : undefined,
    };
  })} loading={loading} busy={busy !== null} busyTargetId={busy} emptyTitle={t(groupsOnly ? 'landlord.noGroups' : 'square.noChatsToShare')}
    onClose={() => {if (!sending.current) onClose();}} onSubmit={send} />;
}
