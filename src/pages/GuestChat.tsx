import { useEffect, useMemo, useRef, useState } from "react"
import clsx from "clsx"
import { chatApi, messageApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import type { Chat, Message } from "../lib/types"
import { MessageType } from "../lib/types"
import { formatRelative, initials } from "../lib/utils"
import { useLocale } from "../lib/i18n"

export default function GuestChatPage() {
  const { auth, host } = useAuth()
  const { t } = useLocale()
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list")
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const loadChats = async () => {
    if (!auth || !auth.auth) return
    setLoadingChats(true)
    setError(null)
    try {
      const list = await chatApi.listChats(auth)
      setChats(list)
      if (list.length > 0) {
        setSelectedChatId((prev) => {
          if (prev && list.some((chat) => chat.chat_id === prev)) {
            return prev
          }
          return list[0].chat_id
        })
      } else {
        setSelectedChatId(null)
      }
      return list
    } catch (err: any) {
      setError(err?.message || t("Unable to load chats.", "无法加载聊天。"))
      return []
    } finally {
      setLoadingChats(false)
    }
  }

  useEffect(() => {
    if (!auth || !auth.auth) return
    loadChats()
  }, [auth])

  useEffect(() => {
    if (!auth || !auth.auth) return
    setMessages([])
    setSelectedChatId(null)
  }, [auth.auth])

  useEffect(() => {
    if (!auth || !auth.auth) return
    if (loadingChats) return
    if (chats.length > 0) return
    const retryId = window.setTimeout(() => {
      loadChats()
    }, 1500)
    return () => window.clearTimeout(retryId)
  }, [auth, chats.length, loadingChats])

  const selectedChat = useMemo(() => chats.find((chat) => chat.chat_id === selectedChatId) || null, [chats, selectedChatId])

  useEffect(() => {
    if (!selectedChatId) {
      setMobilePane("list")
    }
  }, [selectedChatId])

  useEffect(() => {
    setShowNewMessage(false)
    setIsAtBottom(true)
  }, [selectedChatId])

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats
    const keyword = search.toLowerCase()
    return chats.filter((chat) => {
      const title = chat.group ? chat.name : chat.host?.name
      const preview = chat.last_message?.content || ""
      return title?.toLowerCase().includes(keyword) || preview.toLowerCase().includes(keyword)
    })
  }, [chats, search])

  const orderedChats = useMemo(() => {
    const list = filteredChats.slice()
    const key = (chat: Chat) =>
      chat.last_message?.created_at || chat.last_chat_at || chat.created_at || 0
    list.sort((a, b) => key(b) - key(a))
    return list
  }, [filteredChats])

  useEffect(() => {
    if (!auth || !auth.auth) return
    const id = window.setInterval(async () => {
      try {
        const list = await chatApi.listChats(auth)
        setChats(list)
      } catch {
        // ignore list polling errors
      }
    }, 10000)
    return () => window.clearInterval(id)
  }, [auth])

  useEffect(() => {
    if (!auth || !auth.auth || !selectedChatId) return
    const loadMessages = async () => {
      setLoadingMessages(true)
      try {
        const list = await messageApi.listMessages(auth, selectedChatId, { limit: 30 })
        setMessages(list.slice().reverse())
        await chatApi.markRead(auth, selectedChatId)
        setChats((prev) =>
          prev.map((chat) =>
            chat.chat_id === selectedChatId ? { ...chat, unread_count: 0 } : chat
          )
        )
      } catch (err: any) {
        setError(err?.message || t("Unable to load messages.", "无法加载消息。"))
      } finally {
        setLoadingMessages(false)
      }
    }
    loadMessages()
  }, [auth, selectedChatId])

  useEffect(() => {
    if (!auth || !selectedChatId) return
    const id = window.setInterval(async () => {
      if (messages.length === 0) return
      const lastId = messages[messages.length - 1]?.message_id
      try {
        const newer = await messageApi.listMessages(auth, selectedChatId, { after: lastId, limit: 30 })
        if (newer.length) {
          setMessages((prev) => [...prev, ...newer])
          const lastMessage = newer[newer.length - 1]
          setChats((prev) =>
            prev.map((chat) =>
              chat.chat_id === selectedChatId
                ? { ...chat, last_message: lastMessage, unread_count: 0, last_chat_at: lastMessage.created_at }
                : chat
            )
          )
          if (!isAtBottom) {
            setShowNewMessage(true)
          } else {
            chatApi.markRead(auth, selectedChatId).catch(() => null)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [auth, selectedChatId, messages])

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([])
    }
  }, [selectedChatId])

  useEffect(() => {
    if (!isAtBottom) return
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isAtBottom])

  useEffect(() => {
    const baseTitle = "Sermo"
    if (showNewMessage && document.hidden) {
      document.title = `${t("New message", "新消息")} · ${baseTitle}`
      return
    }
    document.title = baseTitle
  }, [showNewMessage, t])

  const handleSend = async () => {
    if (!auth || !auth.auth || !selectedChatId || !draft.trim()) return
    const content = draft.trim()
    setDraft("")
    const tempId = `temp-${Date.now()}`
    const optimistic = {
      message_id: -Date.now(),
      chat_id: selectedChatId,
      user: auth.user!,
      content,
      type: MessageType.TEXT,
      created_at: Date.now() / 1000,
      _pending: true,
      _tempId: tempId,
    } as Message & { _pending?: boolean; _error?: boolean; _tempId?: string }
    setSendingIds((prev) => new Set(prev).add(tempId))
    setMessages((prev) => [...prev, optimistic])
    setChats((prev) =>
      prev.map((chat) =>
        chat.chat_id === selectedChatId
          ? { ...chat, last_message: optimistic as any, unread_count: 0, last_chat_at: optimistic.created_at }
          : chat
      )
    )
    try {
      const sent = await messageApi.sendMessage(auth, selectedChatId, content, MessageType.TEXT)
      setMessages((prev) =>
        prev.map((msg: any) => (msg._tempId === tempId ? sent : msg))
      )
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
      setChats((prev) =>
        prev.map((chat) =>
          chat.chat_id === selectedChatId ? { ...chat, last_message: sent, unread_count: 0 } : chat
        )
      )
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg: any) =>
          msg._tempId === tempId ? { ...msg, _pending: false, _error: true } : msg
        )
      )
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
      setError(err?.message || t("Unable to send message.", "无法发送消息。"))
    }
  }

  const retrySend = async (temp: any) => {
    if (!auth || !auth.auth || !selectedChatId) return
    const tempId = temp._tempId as string
    setMessages((prev) => prev.map((msg: any) => (msg._tempId === tempId ? { ...msg, _pending: true, _error: false } : msg)))
    setSendingIds((prev) => new Set(prev).add(tempId))
    try {
      const sent = await messageApi.sendMessage(auth, selectedChatId, temp.content, MessageType.TEXT)
      setMessages((prev) => prev.map((msg: any) => (msg._tempId === tempId ? sent : msg)))
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg: any) =>
          msg._tempId === tempId ? { ...msg, _pending: false, _error: true } : msg
        )
      )
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
      setError(err?.message || t("Unable to send message.", "无法发送消息。"))
    }
  }

  const chatTitle = (chat: Chat) => {
    if (chat.group) return chat.name
    return chat.host?.name || t("Host", "Host")
  }

  const chatPreview = (chat: Chat) => {
    if (!chat.last_message) return t("No messages yet", "暂无消息")
    if (chat.last_message.type !== MessageType.TEXT) return t("Attachment", "附件")
    return chat.last_message.content
  }

  const isSameDay = (a: number, b: number) => {
    const da = new Date(a * 1000)
    const db = new Date(b * 1000)
    return da.toDateString() === db.toDateString()
  }

  const formatDay = (ts: number) => {
    const date = new Date(ts * 1000)
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  const isChatOnline = (chat: Chat | null) => {
    if (!chat) return false
    if (chat.group) {
      const guests = (chat as any).guests as Array<{ is_alive?: boolean }> | undefined
      return guests ? guests.some((guest) => Boolean(guest.is_alive)) : false
    }
    return Boolean(chat.host?.is_alive)
  }

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t("Please join a host first", "请先连接到 Host")}</h2>
          <p className="text-slate-400">{t("Go back and connect to a host subdomain.", "返回并连接到 Host 子域名。")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased overflow-hidden h-screen">
      <div className="flex h-full w-full flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-[#111418]">
          <div className="flex items-center gap-4">
            <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-white">
              <span className="material-symbols-outlined">forum</span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">{t("Guest Chat", "访客聊天")}</h1>
              <p className="text-xs text-slate-400">
                {t("Connected to", "已连接")} {host?.name || auth.subdomain || t("host", "Host")}
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside
            className={clsx(
              "w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-[#111418] shrink-0",
              mobilePane === "list" ? "flex" : "hidden",
              "md:flex"
            )}
          >
            <div className="p-4">
              <label className="flex flex-col w-full">
                <div className="flex w-full items-stretch rounded-lg h-10 bg-slate-100 dark:bg-[#283039]">
                  <div className="text-slate-400 flex items-center justify-center pl-3">
                    <span className="material-symbols-outlined text-lg">search</span>
                  </div>
                  <input
                    className="w-full border-none bg-transparent focus:ring-0 text-sm placeholder:text-slate-500 px-3"
                    placeholder={t("Search conversations...", "搜索会话...")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loadingChats && <div className="p-4 text-sm text-slate-500">{t("Loading chats...", "加载聊天中...")}</div>}
              {!loadingChats && filteredChats.length === 0 && (
                <div className="p-4 text-sm text-slate-500 space-y-2">
                  <div>{t("No chats yet.", "暂无聊天。")}</div>
                  <button
                    className="text-primary text-xs font-semibold hover:underline"
                    onClick={loadChats}
                  >
                    {t("Refresh chat list", "刷新聊天列表")}
                  </button>
                </div>
              )}
              {orderedChats.map((chat) => (
                <button
                  key={chat.chat_id}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-4 w-full text-left border-l-4 transition-colors",
                    chat.chat_id === selectedChatId
                      ? "bg-primary/5 border-primary"
                      : "hover:bg-slate-50 dark:hover:bg-[#283039]/30 border-transparent"
                  )}
                  onClick={() => {
                    setSelectedChatId(chat.chat_id)
                    setMobilePane("chat")
                  }}
                >
                  <div className="relative">
                    <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 font-semibold">
                      {initials(chatTitle(chat))}
                    </div>
                    <div
                      className={clsx(
                        "absolute bottom-0 right-0 size-3 rounded-full border-2 border-white dark:border-[#111418]",
                        isChatOnline(chat) ? "bg-[#0bda5b]" : "bg-slate-400"
                      )}
                    ></div>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-semibold truncate">{chatTitle(chat)}</p>
                      <span className="text-[10px] text-slate-500 font-medium uppercase">
                        {chat.last_message ? formatRelative(chat.last_message.created_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{chatPreview(chat)}</p>
                      {chat.unread_count ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold shrink-0 ml-2">
                          {chat.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main
            className={clsx(
              "flex-1 flex flex-col bg-slate-50 dark:bg-background-dark min-w-0 relative",
              mobilePane === "chat" ? "flex" : "hidden",
              "md:flex"
            )}
          >
            <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111418] shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
                  onClick={() => setMobilePane("list")}
                  aria-label={t("Back to list", "返回列表")}
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="relative">
                  <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 font-semibold">
                    {selectedChat ? initials(chatTitle(selectedChat)) : "?"}
                  </div>
                  <div
                    className={clsx(
                      "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white dark:border-[#111418]",
                      isChatOnline(selectedChat) ? "bg-[#0bda5b]" : "bg-slate-400"
                    )}
                  ></div>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold">{selectedChat ? chatTitle(selectedChat) : t("Select a chat", "选择聊天")}</h3>
                  <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    <span className={clsx("size-1.5 rounded-full", isChatOnline(selectedChat) ? "bg-emerald-500" : "bg-slate-400")}></span>
                    {selectedChat
                      ? isChatOnline(selectedChat)
                        ? t("Online", "在线")
                        : t("Offline", "离线")
                      : t("Select a chat", "选择聊天")}
                  </p>
                </div>
              </div>
            </header>

            <div
              className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin"
              ref={messageContainerRef}
              onScroll={() => {
                const el = messageContainerRef.current
                if (!el) return
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
                setIsAtBottom(atBottom)
                if (atBottom) {
                  setShowNewMessage(false)
                  if (auth && selectedChatId) {
                    chatApi.markRead(auth, selectedChatId).catch(() => null)
                    setChats((prev) =>
                      prev.map((chat) =>
                        chat.chat_id === selectedChatId ? { ...chat, unread_count: 0 } : chat
                      )
                    )
                  }
                }
              }}
            >
              {loadingMessages && <div className="text-sm text-slate-500">{t("Loading messages...", "加载消息中...")}</div>}
              {error && <div className="text-sm text-red-400">{error}</div>}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-sm text-slate-500">{t("No messages yet. Start the conversation.", "暂无消息，开始聊天吧。")}</div>
              )}
              {messages.map((message, index) => {
                const isMe = message.user.user_id === auth.user?.user_id
                const isPending = Boolean((message as any)._pending)
                const isError = Boolean((message as any)._error)
                const prev = index > 0 ? messages[index - 1] : null
                const next = index < messages.length - 1 ? messages[index + 1] : null
                const isFirstInSequence =
                  !prev || prev.user.user_id !== message.user.user_id || message.created_at - prev.created_at > 300
                const isLastInSequence =
                  !next || next.user.user_id !== message.user.user_id || next.created_at - message.created_at > 300
                const showName = Boolean(selectedChat?.group) && isFirstInSequence
                const showTime = isLastInSequence
                const showAvatar = Boolean(selectedChat?.group) && !isMe && isFirstInSequence
                const indentForGroup = Boolean(selectedChat?.group) && !isMe && !showAvatar
                const showDate = index === 0 || (prev && !isSameDay(prev.created_at, message.created_at))
                return (
                  <div
                    key={message.message_id}
                    className={clsx("flex flex-col", isMe ? "items-end" : "items-start", isFirstInSequence ? "gap-2" : "gap-1")}
                  >
                    {showDate && (
                      <div className="w-full flex items-center gap-3 text-[11px] text-slate-400 uppercase tracking-wide">
                        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></span>
                        <span>{formatDay(message.created_at)}</span>
                        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></span>
                      </div>
                    )}
                    <div className={clsx("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                      {showAvatar ? (
                        <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600">
                          {initials(message.user.name)}
                        </div>
                      ) : null}
                      <div
                        className={clsx(
                          "inline-block w-auto max-w-[80%] rounded-[18px] px-3.5 py-2 text-[14px] leading-relaxed break-words break-all whitespace-pre-wrap shadow-sm",
                          indentForGroup && "ml-10",
                          isMe
                            ? clsx(
                                "bg-primary text-white",
                                !isFirstInSequence && "rounded-tr-xl",
                                !isLastInSequence && "rounded-br-xl",
                                isFirstInSequence && "rounded-tr-sm",
                                isLastInSequence && "rounded-br-sm"
                              )
                            : clsx(
                                "bg-white dark:bg-[#111418] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800",
                                !isFirstInSequence && "rounded-tl-xl",
                                !isLastInSequence && "rounded-bl-xl",
                                isFirstInSequence && "rounded-tl-sm",
                                isLastInSequence && "rounded-bl-sm"
                              )
                        )}
                      >
                        {showName && (
                          <p className="text-xs font-semibold mb-1 text-slate-300">{isMe ? t("You", "你") : message.user.name}</p>
                        )}
                        <p className="leading-relaxed">{message.content}</p>
                        {isError && (
                          <button
                            className="mt-2 text-[10px] text-red-300 hover:underline"
                            onClick={() => retrySend(message)}
                          >
                            {t("Failed to send. Tap to retry.", "发送失败，点击重试。")}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={clsx("w-full flex items-center", isMe ? "justify-end" : "justify-start")}>
                      {isMe && (
                        <span className={clsx("material-symbols-outlined text-[12px]", isError ? "text-red-400" : "text-slate-400")}>
                          {isError ? "error" : isPending ? "hourglass_top" : "done"}
                        </span>
                      )}
                    </div>
                    {showTime && (
                      <div className="w-full flex justify-center">
                        <span className="text-[10px] text-slate-400">{formatRelative(message.created_at)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {showNewMessage && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <button
                  className="px-3 py-1.5 text-xs bg-primary text-white rounded-full shadow-lg"
                  onClick={() => {
                    endRef.current?.scrollIntoView({ behavior: "smooth" })
                    setShowNewMessage(false)
                    if (auth && selectedChatId) {
                      chatApi.markRead(auth, selectedChatId).catch(() => null)
                      setChats((prev) =>
                        prev.map((chat) =>
                          chat.chat_id === selectedChatId ? { ...chat, unread_count: 0 } : chat
                        )
                      )
                    }
                  }}
                >
                  {t("New messages", "新消息")}
                </button>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111418] px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    className="w-full h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1c2127] px-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                    placeholder={t("Type your message...", "输入消息...")}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                </div>
                <button
                  className="flex items-center gap-2 px-4 h-12 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors"
                  onClick={handleSend}
                  disabled={!draft.trim()}
                >
                  <span className="material-symbols-outlined">send</span>
                  {t("Send", "发送")}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
