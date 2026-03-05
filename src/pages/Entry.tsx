import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { userApi } from "../lib/api"
import { storage } from "../lib/storage"
import { useAuth } from "../lib/auth-context"
import { initials } from "../lib/utils"
import { useLocale } from "../lib/i18n"

export default function EntryPage() {
  const navigate = useNavigate()
  const { setSubdomain, setHost } = useAuth()
  const { t } = useLocale()
  const [subdomain, setSubdomainInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const recentHosts = useMemo(() => storage.getRecentHosts(), [])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  const handleConnect = async (value?: string) => {
    const target = (value ?? subdomain).trim().toLowerCase()
    if (!target) {
      setError(t("Please enter a subdomain to continue.", "请输入子域名后继续。"))
      return
    }
    setError(null)
    setLoading(true)
    try {
      const host = (await userApi.getHostBySubdomain(target)) as { name?: string; subdomain?: string }
      setSubdomain(target)
      setHost({ name: host?.name, subdomain: host?.subdomain ?? target })
      storage.addRecentHost({ name: host?.name || target, subdomain: target })
      navigate("/guest/join")
    } catch (err: any) {
      setError(err?.message || t("Host not found. Please check the spelling.", "未找到该 Host，请检查拼写。"))
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    storage.clearRecentHosts()
    window.location.reload()
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen transition-colors duration-300">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5e7eb] dark:border-[#283039] px-10 py-3 bg-white dark:bg-background-dark">
        <div className="flex items-center gap-4 text-slate-900 dark:text-white">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] font-display">
            Sermo
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
            onClick={() => showNotice(t("Support inbox is coming soon.", "支持收件箱即将上线。"))}
          >
            <span className="truncate">{t("Support", "支持")}</span>
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-20 max-w-[1200px] mx-auto">
        {notice && (
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
            {notice}
          </div>
        )}
        <div className="w-full max-w-[500px] space-y-12">
          <div className="text-center space-y-2">
            <h1 className="text-slate-900 dark:text-white tracking-tight text-[40px] font-bold leading-tight font-display">
              {t("Connect to a Host", "连接到 Host")}
            </h1>
            <p className="text-slate-500 dark:text-[#9dabb9] text-lg">
              {t("Enter a subdomain to join a conversation", "输入子域名以加入会话")}
            </p>
          </div>

          <div className="space-y-2 group">
            <div className="flex flex-col">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2">
                {t("Host Subdomain", "Host 子域名")}
              </p>
              <div className="relative flex w-full items-stretch rounded-xl shadow-sm">
                <input
                  autoFocus
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-300 dark:border-[#3b4754] bg-white dark:bg-[#1c2127] h-16 placeholder:text-slate-400 dark:placeholder:text-[#4f5b69] p-4 pr-[140px] text-lg font-medium leading-normal transition-all"
                  placeholder={t("yourname", "你的名称")}
                  type="text"
                  value={subdomain}
                  onChange={(event) => setSubdomainInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleConnect()
                    }
                  }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-slate-400 dark:text-[#9dabb9] font-medium text-lg">.sermo.com</span>
                  <button
                    className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 flex items-center justify-center ml-2"
                    onClick={() => handleConnect()}
                    disabled={loading}
                  >
                    <span className="material-symbols-outlined">
                      {loading ? "hourglass_top" : "arrow_forward"}
                    </span>
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-2 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] font-display">
                {t("Recent Hosts", "最近的 Hosts")}
              </h3>
              {recentHosts.length > 0 && (
                <button className="text-primary text-sm font-semibold hover:underline" onClick={handleClear}>
                  {t("Clear", "清空")}
                </button>
              )}
            </div>
            {recentHosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-[#283039] rounded-xl text-center space-y-2">
                <span className="material-symbols-outlined text-slate-300 dark:text-[#3b4754] text-4xl">
                  history
                </span>
                <p className="text-slate-400 dark:text-[#9dabb9] text-sm">
                  {t("No recent hosts found.", "暂无最近的 Hosts。")}
                  <br />
                  {t("Enter a subdomain to get started.", "请输入子域名开始。")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {recentHosts.slice(0, 4).map((host) => (
                  <button
                    key={host.subdomain}
                    className="flex flex-col items-center gap-3 group cursor-pointer"
                    onClick={() => handleConnect(host.subdomain)}
                  >
                    <div className="relative p-1 rounded-full border-2 border-transparent group-hover:border-primary transition-all">
                      <div className="w-16 h-16 rounded-full shadow-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-white">
                        {initials(host.name)}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-900 dark:text-white text-sm font-bold leading-tight group-hover:text-primary transition-colors">
                        {host.name}
                      </p>
                      <p className="text-slate-500 dark:text-[#9dabb9] text-xs font-normal">
                        {host.subdomain}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-center">
              <button
                className="text-slate-500 dark:text-[#9dabb9] text-sm font-medium hover:text-primary transition-colors"
                onClick={() => navigate("/host/login")}
              >
                {t("I'm a Host, sign in", "我是 Host，去登录")}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 w-full py-6 flex justify-center gap-8 text-slate-400 dark:text-[#9dabb9] text-sm font-medium">
        <button className="hover:text-primary transition-colors" onClick={() => showNotice(t("About page coming soon.", "关于页面即将上线。"))}>
          {t("About Sermo", "关于 Sermo")}
        </button>
        <button className="hover:text-primary transition-colors" onClick={() => showNotice(t("Terms will be published soon.", "服务条款即将发布。"))}>
          {t("Terms of Service", "服务条款")}
        </button>
        <button className="hover:text-primary transition-colors" onClick={() => showNotice(t("Privacy policy is being prepared.", "隐私政策正在准备中。"))}>
          {t("Privacy Policy", "隐私政策")}
        </button>
      </footer>
    </div>
  )
}
