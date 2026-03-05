import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import { useLocale } from "../lib/i18n"

export default function HostLoginPage() {
  const navigate = useNavigate()
  const { setAuthState, setHost, setSubdomain } = useAuth()
  const { t } = useLocale()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !password) {
      setError(t("Please enter your host name and password.", "请输入 Host 名称和密码。"))
      return
    }
    setError(null)
    setLoading(true)
    try {
      const tokens = await userApi.hostLogin(name.trim(), password)
      if (!tokens?.auth) {
        setError(t("Login response is missing auth info. Please try again.", "登录响应缺少授权信息，请稍后重试。"))
        return
      }
      const userId = (tokens.data as any)?.user_id
      const subdomain = (tokens.data as any)?.subdomain
      setAuthState({
        auth: tokens.auth,
        refresh: tokens.refresh,
        role: "host",
        user: { name: name.trim(), user_id: userId, subdomain },
        subdomain,
      })
      if (subdomain) {
        setSubdomain(subdomain)
        setHost({ name: name.trim(), subdomain })
      }
      navigate("/host/dashboard")
    } catch (err: any) {
      setError(err?.message || t("Unable to sign in. Please try again.", "无法登录，请重试。"))
    } finally {
      setLoading(false)
    }
  }

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display text-white">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-6 md:px-10 py-4 absolute top-0 w-full z-10">
        <div className="flex items-center gap-3 text-white">
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
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Host Portal</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="text-sm text-gray-400 hover:text-white transition-colors"
            onClick={() => showNotice(t("Documentation is not available yet.", "文档暂未上线。"))}
          >
            {t("Documentation", "文档")}
          </button>
          <button
            className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em]"
            onClick={() => showNotice(t("Help center is coming soon.", "帮助中心即将上线。"))}
          >
            <span className="truncate">{t("Help Center", "帮助中心")}</span>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row h-screen">
        <div className="hidden md:flex flex-1 relative items-center justify-center overflow-hidden bg-background-dark">
          <div className="absolute inset-0 z-0 opacity-40">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,#137fec33_0%,transparent_50%)]"></div>
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,#137fec22_0%,transparent_50%)]"></div>
          </div>
          <div className="relative z-10 px-12 max-w-2xl">
            <div className="mb-10 w-full h-[300px] rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center bg-center bg-cover">
              <div className="text-primary text-sm font-semibold">Sermo Host Console</div>
            </div>
            <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-[-0.033em] mb-6">
              Empower Your Community. <span className="text-primary">Host with Confidence.</span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-lg">
              Manage your chat ecosystem from a central, secure dashboard. Custom subdomains, real-time analytics, and advanced moderation at your fingertips.
            </p>
            <div className="mt-10 flex gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs font-medium text-gray-300">
                <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
                Enterprise Grade Security
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs font-medium text-gray-300">
                <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                99.9% Uptime SLA
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-24 md:py-10 bg-background-light dark:bg-[#0d141b]">
          <div className="w-full max-w-[440px] flex flex-col gap-8">
            {notice && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                {notice}
              </div>
            )}
            <div className="md:hidden flex justify-center mb-4">
              <div className="flex items-center gap-2 text-white">
                <div className="size-8 text-primary">
                  <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M39.5563 34.1455V13.8546C39.5563 15.708 36.8773 17.3437 32.7927 18.3189C30.2914 18.916 27.263 19.2655 24 19.2655C20.737 19.2655 17.7086 18.916 15.2073 18.3189C11.1227 17.3437 8.44365 15.708 8.44365 13.8546V34.1455C8.44365 35.9988 11.1227 37.6346 15.2073 38.6098C17.7086 39.2069 20.737 39.5564 24 39.5564C27.263 39.5564 30.2914 39.2069 32.7927 38.6098C36.8773 37.6346 39.5563 35.9988 39.5563 34.1455Z"></path>
                  </svg>
                </div>
                <h2 className="text-white text-2xl font-bold">Host Portal</h2>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-white text-3xl font-bold leading-tight tracking-[-0.015em]">Welcome Back</h2>
              <p className="text-gray-400 text-sm">{t("Please enter your host credentials to access your dashboard.", "请输入 Host 凭据以访问控制台。")}</p>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col w-full">
                <p className="text-gray-200 text-sm font-medium leading-normal pb-2">{t("Host Name", "Host 名称")}</p>
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#3b4754] bg-[#1c2127] focus:border-primary h-12 placeholder:text-[#5c6d7e] p-[15px] text-base font-normal leading-normal transition-all"
                  placeholder={t("your-host-name", "你的 Host 名称")}
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex flex-col w-full">
                <div className="flex justify-between items-center pb-2">
                  <p className="text-gray-200 text-sm font-medium leading-normal">{t("Password", "密码")}</p>
                  <button
                    className="text-primary text-xs font-semibold hover:underline"
                    type="button"
                    onClick={() => showNotice(t("Password reset is not enabled yet.", "暂未开启密码重置。"))}
                  >
                    {t("Forgot?", "忘记密码？")}
                  </button>
                </div>
                <div className="flex w-full flex-1 items-stretch rounded-lg group">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#3b4754] bg-[#1c2127] focus:border-primary h-12 placeholder:text-[#5c6d7e] p-[15px] rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal transition-all"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="text-[#9dabb9] flex border border-[#3b4754] bg-[#1c2127] items-center justify-center px-4 rounded-r-lg border-l-0 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                className="mt-4 flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                type="submit"
                disabled={loading}
              >
                <span className="truncate">{loading ? t("Signing In...", "正在登录...") : t("Sign In to Dashboard", "登录控制台")}</span>
              </button>
            </form>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-xs uppercase tracking-widest font-bold">{t("Or continue with", "或继续使用")}</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>
            <div className="flex gap-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg border border-[#3b4754] bg-[#1c2127] hover:bg-[#283039] transition-colors text-white font-medium text-sm"
                onClick={() => showNotice(t("SSO is not configured yet.", "SSO 尚未配置。"))}
                type="button"
              >
                <span className="material-symbols-outlined text-xl">terminal</span>
                SSO
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg border border-[#3b4754] bg-[#1c2127] hover:bg-[#283039] transition-colors text-white font-medium text-sm"
                onClick={() => showNotice(t("MFA setup is coming soon.", "MFA 配置即将上线。"))}
                type="button"
              >
                <span className="material-symbols-outlined text-xl">shield_lock</span>
                MFA
              </button>
            </div>
            <div className="text-center mt-4">
              <p className="text-gray-400 text-sm">
                {t("Don't have a host account yet?", "还没有 Host 账号？")}
                <span className="text-primary font-bold ml-1">{t("Sign in to create one automatically.", "登录时将自动创建。")}</span>
              </p>
            </div>
            <div className="mt-8 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
                {t("Secure Access Portal for Hosts Only.", "仅限 Host 访问的安全入口。")}
                <br />
                {t("Guests should access via their assigned subdomain.", "访客请使用分配的子域名访问。")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
