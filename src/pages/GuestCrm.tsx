import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import { copyToClipboard, formatShortDate } from "../lib/utils"
import { useLocale } from "../lib/i18n"

export default function GuestCrmPage() {
  const { auth } = useAuth()
  const { t } = useLocale()
  const [guests, setGuests] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadGuests = async () => {
    if (!auth) return
    setLoading(true)
    setError(null)
    try {
      const data = await userApi.listGuests(auth, {
        q: search || undefined,
        online: onlineOnly ? 1 : undefined,
        limit: 200,
        offset: 0,
      })
      setGuests(data as any[])
    } catch (err: any) {
      setError(err?.message || t("Unable to load guest list.", "无法加载访客列表。"))
    } finally {
      setLoading(false)
    }
  }

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  const handleInvite = async () => {
    const link = auth?.subdomain ? `https://${auth.subdomain}.sermo.com` : ""
    if (!link) {
      showNotice(t("Set a subdomain before inviting guests.", "请先设置子域名再邀请访客。"))
      return
    }
    await copyToClipboard(link)
    showNotice(t("Invite link copied to clipboard.", "邀请链接已复制到剪贴板。"))
  }

  const handleExport = () => {
    if (filteredGuests.length === 0) {
      showNotice(t("No guests to export.", "没有可导出的访客。"))
      return
    }
    const header = ["name", "user_id", "is_alive", "last_heartbeat"]
    const rows = filteredGuests.map((guest) => [
      guest.name,
      guest.user_id,
      guest.is_alive,
      guest.last_heartbeat,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "")}"`).join(",")).join("\\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `sermo-guests-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showNotice(t("Guest list exported.", "访客列表已导出。"))
  }

  useEffect(() => {
    loadGuests()
  }, [auth, onlineOnly])

  const filteredGuests = useMemo(() => {
    if (!search) return guests
    return guests.filter((guest) => guest.name?.toLowerCase().includes(search.toLowerCase()))
  }, [guests, search])

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">{t("Host CRM", "Host 客户管理")}</h2>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            to="/host/dashboard"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <p className="text-sm font-medium">{t("Dashboard", "仪表盘")}</p>
          </Link>
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary cursor-pointer"
            to="/host/guests"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              group
            </span>
            <p className="text-sm font-medium">{t("Guest Directory", "访客目录")}</p>
          </Link>
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            to="/host/chats"
          >
            <span className="material-symbols-outlined">chat</span>
            <p className="text-sm font-medium">{t("Messages", "消息")}</p>
          </Link>
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            to="/host/profile"
          >
            <span className="material-symbols-outlined">settings</span>
            <p className="text-sm font-medium">{t("Settings", "设置")}</p>
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 p-2">
            <div className="bg-primary/10 text-primary rounded-full size-10 flex items-center justify-center font-bold">H</div>
            <div className="flex flex-col">
              <p className="text-sm font-semibold">{t("Host Admin", "Host 管理员")}</p>
              <p className="text-xs text-slate-500">{t("Super Admin", "超级管理员")}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">{t("Organization / CRM", "组织 / CRM")}</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold gap-2"
              onClick={handleInvite}
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>{t("Invite Guest", "邀请访客")}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {notice && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
              {notice}
            </div>
          )}
          <div className="flex flex-wrap justify-between items-end gap-3 mb-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">{t("Guest Directory", "访客目录")}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base">
                {t(
                  `Manage and monitor ${filteredGuests.length} guests across your subdomains.`,
                  `管理并监控你各子域名下的 ${filteredGuests.length} 位访客。`
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white text-sm font-bold gap-2 border border-slate-200 dark:border-slate-700"
                onClick={handleExport}
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>{t("Export CSV", "导出 CSV")}</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161f29] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <label className="flex flex-col w-full">
                  <div className="flex w-full items-stretch rounded-lg h-11">
                    <div className="text-slate-400 flex border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 items-center justify-center pl-4 rounded-l-lg border-r-0">
                      <span className="material-symbols-outlined">search</span>
                    </div>
                    <input
                      className="form-input flex w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary h-full placeholder:text-slate-400 px-4 rounded-r-lg border-l-0 text-sm font-normal"
                      placeholder={t("Search guests by name...", "按名称搜索访客...")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </label>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  className={`flex flex-1 md:flex-none items-center justify-center rounded-lg h-11 px-4 gap-2 text-sm font-bold whitespace-nowrap ${
                    onlineOnly ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white"
                  }`}
                  onClick={() => setOnlineOnly((prev) => !prev)}
                >
                  <span className="material-symbols-outlined text-[20px] fill-1">toggle_on</span>
                  <span>{t("Online Only", "仅在线")}</span>
                </button>
                <button
                  className="p-2.5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  onClick={loadGuests}
                >
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>
            </div>

            {error && <div className="px-4 py-2 text-red-400 text-sm">{error}</div>}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold tracking-wider">
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">{t("Guest", "访客")}</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">{t("Subdomain", "子域名")}</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">{t("Last Seen", "最后活跃")}</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">{t("Status", "状态")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading && (
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate-500" colSpan={4}>
                        {t("Loading guests...", "正在加载访客...")}
                      </td>
                    </tr>
                  )}
                  {!loading && filteredGuests.length === 0 && (
                    <tr>
                      <td className="px-6 py-4 text-sm text-slate-500" colSpan={4}>
                        {t("No guests found.", "未找到访客。")}
                      </td>
                    </tr>
                  )}
                  {filteredGuests.map((guest) => (
                    <tr key={guest.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {guest.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{guest.name}</p>
                            <p className="text-xs text-slate-500">{t("ID", "编号")} {guest.user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{auth?.subdomain || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatShortDate(guest.last_heartbeat)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 text-xs font-semibold ${
                            guest.is_alive ? "text-green-500" : "text-slate-400"
                          }`}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: guest.is_alive ? "#22c55e" : "#94a3b8" }} />
                          {guest.is_alive ? t("Online", "在线") : t("Offline", "离线")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
