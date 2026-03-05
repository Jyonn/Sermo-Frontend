import { useEffect, useState } from "react"
import { userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import { copyToClipboard } from "../lib/utils"
import { useLocale } from "../lib/i18n"

export default function SubdomainSettingsPage() {
  const { auth, subdomain, setSubdomain, setHost } = useAuth()
  const { t } = useLocale()
  const [draft, setDraft] = useState(subdomain || "")
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setDraft(subdomain || "")
  }, [subdomain])

  const handleCheck = async () => {
    if (!draft.trim()) return
    setChecking(true)
    setError(null)
    try {
      const result = await userApi.checkSubdomain(draft.trim().toLowerCase())
      setAvailability(result as any)
    } catch (err: any) {
      setError(err?.message || t("Unable to check availability.", "无法检查可用性。"))
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    if (!auth) {
      setError(t("Sign in as a host to update the subdomain.", "请以 Host 身份登录以更新子域名。"))
      return
    }
    if (!draft.trim()) {
      setError(t("Subdomain cannot be empty.", "子域名不能为空。"))
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const host = await userApi.setSubdomain(auth, draft.trim().toLowerCase())
      setSubdomain((host as any)?.subdomain || draft.trim().toLowerCase())
      setHost({ name: (host as any)?.name, subdomain: (host as any)?.subdomain })
      setMessage(t("Subdomain saved successfully! Your guests can now connect via the new link.", "子域名保存成功！访客可以使用新链接访问。"))
    } catch (err: any) {
      setError(err?.message || t("Unable to save subdomain.", "无法保存子域名。"))
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    const link = `https://${draft || "your-space"}.sermo.com`
    await copyToClipboard(link)
    setNotice(t("Invite link copied to clipboard.", "邀请链接已复制到剪贴板。"))
    window.setTimeout(() => setNotice(null), 2500)
  }

  const handleCancel = () => {
    setDraft(subdomain || "")
    setAvailability(null)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display">
      <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-10 py-3 bg-white dark:bg-background-dark">
          <div className="flex items-center gap-4">
            <div className="size-6 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M39.5563 34.1455V13.8546C39.5563 15.708 36.8773 17.3437 32.7927 18.3189C30.2914 18.916 27.263 19.2655 24 19.2655C20.737 19.2655 17.7086 18.916 15.2073 18.3189C11.1227 17.3437 8.44365 15.708 8.44365 13.8546V34.1455C8.44365 35.9988 11.1227 37.6346 15.2073 38.6098C17.7086 39.2069 20.737 39.5564 24 39.5564C27.263 39.5564 30.2914 39.2069 32.7927 38.6098C36.8773 37.6346 39.5563 35.9988 39.5563 34.1455Z"
                  fill="currentColor"
                ></path>
                <path
                  clipRule="evenodd"
                  d="M10.4485 13.8519C10.4749 13.9271 10.6203 14.246 11.379 14.7361C12.298 15.3298 13.7492 15.9145 15.6717 16.3735C18.0007 16.9296 20.8712 17.2655 24 17.2655C27.1288 17.2655 29.9993 16.9296 32.3283 16.3735C34.2508 15.9145 35.702 15.3298 36.621 14.7361C37.3796 14.246 37.5251 13.9271 37.5515 13.8519C37.5287 13.7876 37.4333 13.5973 37.0635 13.2931C36.5266 12.8516 35.6288 12.3647 34.343 11.9175C31.79 11.0295 28.1333 10.4437 24 10.4437C19.8667 10.4437 16.2099 11.0295 13.657 11.9175C12.3712 12.3647 11.4734 12.8516 10.9365 13.2931C10.5667 13.5973 10.4713 13.7876 10.4485 13.8519ZM37.5563 18.7877C36.3176 19.3925 34.8502 19.8839 33.2571 20.2642C30.5836 20.9025 27.3973 21.2655 24 21.2655C20.6027 21.2655 17.4164 20.9025 14.7429 20.2642C13.1498 19.8839 11.6824 19.3925 10.4436 18.7877V34.1275C10.4515 34.1545 10.5427 34.4867 11.379 35.027C12.298 35.6207 13.7492 36.2054 15.6717 36.6644C18.0007 37.2205 20.8712 37.5564 24 37.5564C27.1288 37.5564 29.9993 37.2205 32.3283 36.6644C34.2508 36.2054 35.702 35.6207 36.621 35.027C37.4573 34.4867 37.5485 34.1546 37.5563 34.1275V18.7877ZM41.5563 13.8546V34.1455C41.5563 36.1078 40.158 37.5042 38.7915 38.3869C37.3498 39.3182 35.4192 40.0389 33.2571 40.5551C30.5836 41.1934 27.3973 41.5564 24 41.5564C20.6027 41.5564 17.4164 41.1934 14.7429 40.5551C12.5808 40.0389 10.6502 39.3182 9.20848 38.3869C7.84205 37.5042 6.44365 36.1078 6.44365 34.1455L6.44365 13.8546C6.44365 12.2684 7.37223 11.0454 8.39581 10.2036C9.43325 9.3505 10.8137 8.67141 12.343 8.13948C15.4203 7.06909 19.5418 6.44366 24 6.44366C28.4582 6.44366 32.5797 7.06909 35.657 8.13948C37.1863 8.67141 38.5667 9.3505 39.6042 10.2036C40.6278 11.0454 41.5563 12.2684 41.5563 13.8546Z"
                  fill="currentColor"
                  fillRule="evenodd"
                ></path>
              </svg>
            </div>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
              {t("Sermo Host", "Sermo Host")}
            </h2>
          </div>
          <div className="flex flex-1 justify-end gap-8">
            <div className="flex items-center gap-9">
              <a className="text-slate-600 dark:text-white text-sm font-medium leading-normal hover:text-primary transition-colors" href="/host/dashboard">
                {t("Dashboard", "仪表盘")}
              </a>
              <a className="text-primary text-sm font-bold leading-normal border-b-2 border-primary" href="/host/subdomain">
                {t("Settings", "设置")}
              </a>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
              </button>
            </div>
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary bg-slate-300"></div>
          </div>
        </header>

        <div className="flex flex-1 justify-center py-10 px-4">
          <div className="flex w-full max-w-[1200px] gap-8">
            <aside className="flex w-64 flex-col gap-6 shrink-0">
              <div className="flex flex-col gap-1">
                <h1 className="text-slate-900 dark:text-white text-lg font-bold">{t("Workspace Settings", "工作区设置")}</h1>
                <p className="text-slate-500 dark:text-[#9dabb9] text-sm leading-normal">
                  {t("Configure your host portal environment", "配置你的 Host 控制台环境")}
                </p>
              </div>
              <nav className="flex flex-col gap-2">
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="/host/profile">
                  <span className="material-symbols-outlined text-[22px]">settings</span>
                  <span className="text-sm font-medium">{t("General", "通用")}</span>
                </a>
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary transition-colors" href="/host/subdomain">
                  <span className="material-symbols-outlined text-[22px]">link</span>
                  <span className="text-sm font-semibold">{t("Subdomain", "子域名")}</span>
                </a>
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="/host/notifications">
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  <span className="text-sm font-medium">{t("Notifications", "通知")}</span>
                </a>
              </nav>
            </aside>

            <main className="flex-1 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                  {t("Subdomain Configuration", "子域名配置")}
                </h2>
                <p className="text-slate-500 dark:text-[#9dabb9] text-base font-normal leading-normal max-w-2xl">
                  {t(
                    "Set a unique address for your guests to access your chat system. This brand identity will be visible in every guest interaction.",
                    "为访客设置一个唯一地址以访问你的聊天系统。该品牌标识将展示在每次访客互动中。"
                  )}
                </p>
              </div>

              {message && (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span className="text-sm font-medium">{message}</span>
                </div>
              )}
              {notice && (
                <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                  <span className="material-symbols-outlined">info</span>
                  <span className="text-sm font-medium">{notice}</span>
                </div>
              )}
              {error && <div className="text-red-400 text-sm">{error}</div>}

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col gap-8">
                  <div className="flex flex-col gap-4">
                    <h3 className="text-slate-900 dark:text-white text-xl font-bold">{t("Assign Your Address", "设置你的地址")}</h3>
                    <div className="flex flex-col gap-4 max-w-xl">
                      <label className="flex flex-col">
                        <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold mb-2">{t("Workspace Name", "工作区名称")}</p>
                        <div className="flex items-stretch rounded-lg shadow-sm">
                          <input
                            className="flex-1 min-w-0 rounded-l-lg text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary h-14 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 text-base font-medium"
                            placeholder={t("my-awesome-brand", "my-awesome-brand")}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                          />
                          <div className="flex items-center px-4 bg-slate-100 dark:bg-slate-800 border-y border-r border-slate-300 dark:border-slate-700 text-slate-500 font-medium rounded-r-lg">
                            .sermo.com
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center justify-between">
                        {availability?.available && (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            <span className="text-xs font-bold uppercase tracking-wider">{t("Available!", "可用！")}</span>
                          </div>
                        )}
                        {availability && !availability.available && (
                          <div className="flex items-center gap-2 text-amber-500">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            <span className="text-xs font-bold uppercase tracking-wider">{availability.reason || t("Unavailable", "不可用")}</span>
                          </div>
                        )}
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all uppercase tracking-wide"
                          onClick={handleCheck}
                          disabled={checking}
                        >
                          <span className={`material-symbols-outlined ${checking ? "animate-spin" : ""} text-[16px]`}>
                            refresh
                          </span>
                          {t("Re-check Availability", "重新检查可用性")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-slate-800"></div>

                  <div className="flex flex-col gap-4">
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">visibility</span>
                      {t("Guest Link Preview", "访客链接预览")}
                    </h3>
                    <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-widest">
                            {t("Share this link with your guests", "把这个链接分享给访客")}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 dark:text-slate-500 text-lg">https://</span>
                            <span className="text-primary text-xl font-bold">{draft || "your-space"}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-lg">.sermo.com</span>
                          </div>
                        </div>
                        <button
                          className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all"
                          onClick={handleCopy}
                        >
                          <span className="material-symbols-outlined">content_copy</span>
                          {t("Copy Invite Link", "复制邀请链接")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-500/80">
                    <span className="material-symbols-outlined shrink-0">warning</span>
                    <p className="text-sm leading-relaxed">
                      {t(
                        "Changing your subdomain will immediately invalidate all previously shared links. Existing guests will need the new URL to re-join your session.",
                        "更改子域名会立即使之前分享的链接失效。现有访客需要使用新链接重新加入。"
                      )}
                    </p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    className="px-6 py-3 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
                    onClick={handleCancel}
                  >
                    {t("Cancel", "取消")}
                  </button>
                  <button
                    className="px-8 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t("Saving...", "保存中...") : t("Save Subdomain", "保存子域名")}
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
