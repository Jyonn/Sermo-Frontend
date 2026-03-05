import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { chatApi, userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import type { Chat, Message } from "../lib/types"
import { formatRelative } from "../lib/utils"
import { useLocale } from "../lib/i18n"

export default function HostDashboardPage() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useLocale()
  const [chats, setChats] = useState<Chat[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [chatData, guestData] = await Promise.all([
          chatApi.listChats(auth),
          userApi.listGuests(auth, { limit: 200, offset: 0 }),
        ])
        setChats(chatData)
        setGuests(guestData as any[])
      } catch (err: any) {
        setError(err?.message || "Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [auth])

  const handleLogout = async () => {
    if (!auth) return
    try {
      await userApi.logout(auth.refresh)
    } catch {
      // ignore logout errors
    } finally {
      logout()
      navigate("/host/login")
    }
  }


  const stats = useMemo(() => {
    const totalGuests = guests.length
    const onlineGuests = guests.filter((guest) => guest.is_alive).length
    const activeChats = chats.length
    const unread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0)
    return { totalGuests, onlineGuests, activeChats, unread }
  }, [guests, chats])

  const recentMessages = useMemo(() => {
    const messages: { chat: Chat; message: Message }[] = []
    chats.forEach((chat) => {
      if (chat.last_message) {
        messages.push({ chat, message: chat.last_message })
      }
    })
    return messages.sort((a, b) => b.message.created_at - a.message.created_at).slice(0, 5)
  }, [chats])

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">{t("Host access required", "需要 Host 权限")}</h2>
          <Link className="text-primary hover:underline" to="/host/login">
            {t("Go to Host Login", "前往 Host 登录")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111418] flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 px-2">
            <div className="bg-primary/20 text-primary rounded-full size-10 flex items-center justify-center font-bold">
              H
            </div>
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-slate-900 dark:text-white text-sm font-bold truncate">Host Admin</h1>
              <p className="text-slate-500 dark:text-[#9dabb9] text-xs font-normal">Super Admin</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <Link className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary" to="/host/dashboard">
              <span className="material-symbols-outlined text-[22px]">dashboard</span>
              <p className="text-sm font-medium">{t("Dashboard", "仪表盘")}</p>
            </Link>
            <Link
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
              to="/host/guests"
            >
              <span className="material-symbols-outlined text-[22px]">group</span>
              <p className="text-sm font-medium">{t("Guests", "访客")}</p>
            </Link>
            <Link
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
              to="/host/chats"
            >
              <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
              <p className="text-sm font-medium">{t("Chat Logs", "聊天记录")}</p>
            </Link>
            <Link
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
              to="/host/subdomain"
            >
              <span className="material-symbols-outlined text-[22px]">dns</span>
              <p className="text-sm font-medium">{t("Domains", "域名")}</p>
            </Link>
            <Link
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#283039] transition-colors"
              to="/host/profile"
            >
              <span className="material-symbols-outlined text-[22px]">settings</span>
              <p className="text-sm font-medium">{t("Settings", "设置")}</p>
            </Link>
          </nav>
        </div>
        <div className="flex flex-col gap-4">
          <button
            className="flex items-center justify-center gap-2 w-full rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold transition-opacity hover:opacity-90"
            onClick={() => navigate("/host/chats")}
          >
            <span className="material-symbols-outlined text-sm">campaign</span>
            <span className="truncate">{t("Broadcast Message", "群发消息")}</span>
          </button>
          <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
              <p className="text-sm font-medium">{t("Logout", "退出登录")}</p>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-[#283039] bg-white dark:bg-background-dark px-8 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-3 text-primary">
              <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-white">
                <span className="material-symbols-outlined">hub</span>
              </div>
              <h2 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">{t("Host Admin Dashboard", "Host 管理控制台")}</h2>
            </div>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  className="w-full h-10 pl-10 pr-4 rounded-lg border-none bg-slate-100 dark:bg-[#283039] text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary"
                  placeholder={t("Search guests or messages...", "搜索访客或消息...")}
                  type="text"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">{t("System Online", "系统在线")}</span>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 overflow-y-auto">
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-slate-900 dark:text-white font-medium">{t("Dashboard Overview", "概览")}</span>
          </nav>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#111418] rounded-xl p-6 border border-slate-200 dark:border-[#3b4754] shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <span className="material-symbols-outlined">group</span>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("Total Guests", "访客总数")}</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1 tracking-tight">
                {loading ? "--" : stats.totalGuests}
              </p>
              <p className="text-xs text-slate-500 mt-2">{t(`${stats.onlineGuests} online now`, `${stats.onlineGuests} 在线`)}</p>
            </div>
            <div className="bg-white dark:bg-[#111418] rounded-xl p-6 border border-slate-200 dark:border-[#3b4754] shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                  <span className="material-symbols-outlined">question_answer</span>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("Active Chats", "活跃聊天")}</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1 tracking-tight">
                {loading ? "--" : stats.activeChats}
              </p>
            </div>
            <div className="bg-white dark:bg-[#111418] rounded-xl p-6 border border-slate-200 dark:border-[#3b4754] shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                  <span className="material-symbols-outlined">mark_email_unread</span>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("Unread Messages", "未读消息")}</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1 tracking-tight">
                {loading ? "--" : stats.unread}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t("Recent Messages", "最近消息")}</h2>
                <Link className="text-primary text-sm font-semibold hover:underline" to="/host/chats">
                  {t("View All", "查看全部")}
                </Link>
              </div>
              <div className="bg-white dark:bg-[#111418] rounded-xl border border-slate-200 dark:border-[#3b4754] overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentMessages.length === 0 && (
                    <div className="p-6 text-sm text-slate-500">{t("No messages yet.", "暂无消息。")}</div>
                  )}
                  {recentMessages.map((item) => (
                    <div key={item.message.message_id} className="p-4 hover:bg-slate-50 dark:hover:bg-[#1c242e] transition-colors group">
                      <div className="flex gap-4">
                        <div className="bg-primary/10 text-primary rounded-full size-12 flex items-center justify-center font-bold">
                          {item.message.user.name?.[0]?.toUpperCase() || "G"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {item.message.user.name}
                            </h4>
                            <span className="text-xs text-slate-500">{formatRelative(item.message.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1 mb-3">
                            {item.message.content}
                          </p>
                          <div className="flex gap-2">
                            <Link
                              to="/host/chats"
                              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                            >
                              {t("Reply", "回复")}
                            </Link>
                            <button className="px-3 py-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              {t("Ignore", "忽略")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t("Quick Actions", "快捷操作")}</h3>
              <div className="bg-white dark:bg-[#111418] border border-slate-200 dark:border-[#3b4754] rounded-xl p-6 space-y-4">
                <Link className="flex items-center justify-between text-sm font-semibold text-primary" to="/host/guests">
                  {t("Manage Guests", "管理访客")}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link className="flex items-center justify-between text-sm font-semibold text-primary" to="/host/groups">
                  {t("Group Settings", "群组设置")}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link className="flex items-center justify-between text-sm font-semibold text-primary" to="/host/subdomain">
                  {t("Update Subdomain", "更新子域名")}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link className="flex items-center justify-between text-sm font-semibold text-primary" to="/host/notifications">
                  {t("Notification Preferences", "通知偏好")}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
