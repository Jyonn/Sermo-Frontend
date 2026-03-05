import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import { useLocale } from "../lib/i18n"

const StatusBadge = ({ message, tone }: { message: string; tone: "green" | "amber" | "red" | "gray" }) => {
  const toneStyles = {
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-500",
    gray: "text-gray-400",
  }
  return (
    <div className={`flex items-center gap-2 px-1 pt-2 ${toneStyles[tone]}`}>
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

export default function GuestJoinPage() {
  const navigate = useNavigate()
  const { subdomain, host, setAuthState } = useAuth()
  const { t } = useLocale()
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<{ available: boolean; reason?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const hostName = host?.name || "Your host"
  const hostDomain = useMemo(() => {
    if (!subdomain) return ""
    return `${subdomain}.sermo.com`
  }, [subdomain])

  if (!subdomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">Missing host subdomain</h2>
          <p className="text-slate-500">Go back to the entry screen and connect to a host first.</p>
          <button
            className="px-6 py-3 bg-primary text-white rounded-lg font-bold"
            onClick={() => navigate("/")}
          >
            Back to Entry
          </button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!subdomain) return
    if (!nickname.trim()) {
      setStatus(null)
      return
    }
    const handler = window.setTimeout(async () => {
      setChecking(true)
      try {
        const result = await userApi.nicknameCheck(subdomain, nickname.trim())
        setStatus(result)
      } catch (err: any) {
        setStatus(null)
        setError(err?.message || "Unable to verify nickname.")
      } finally {
        setChecking(false)
      }
    }, 350)
    return () => window.clearTimeout(handler)
  }, [nickname, subdomain])

  const handleJoin = async () => {
    if (!subdomain) {
      setError(t("Missing subdomain. Please go back and enter a host.", "缺少子域名，请返回并选择 Host。"))
      return
    }
    if (!nickname.trim()) {
      setError(t("Please enter a nickname.", "请输入昵称。"))
      return
    }
    setError(null)
    setLoading(true)
    try {
      const tokens = await userApi.guestLogin(subdomain, nickname.trim(), password)
      if (!tokens?.auth) {
        setError(t("Login response is missing auth info. Please try again.", "登录响应缺少授权信息，请稍后重试。"))
        return
      }
      setAuthState({
        auth: tokens.auth,
        refresh: tokens.refresh,
        role: "guest",
        user: { name: nickname.trim(), user_id: (tokens.data as any)?.user_id },
        subdomain,
      })
      navigate("/chat")
    } catch (err: any) {
      setError(err?.message || t("Unable to join the chat. Please try again.", "无法加入聊天，请重试。"))
    } finally {
      setLoading(false)
    }
  }

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5e7eb] dark:border-[#283039] px-6 py-3 bg-white dark:bg-background-dark">
        <div className="flex items-center gap-4 text-black dark:text-white">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
              <path
                clipRule="evenodd"
                d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">ChatSystem</h2>
        </div>
        <div className="flex gap-2">
          <button
            className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold"
            onClick={() => showNotice(t("Help center is coming soon.", "帮助中心即将上线。"))}
          >
            {t("Help", "帮助")}
          </button>
          <button
            className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-gray-200 dark:bg-[#283039] text-black dark:text-white text-sm font-bold"
            onClick={() => showNotice(t("Report sent to host admins.", "举报已发送给管理员。"))}
          >
            {t("Report Host", "举报 Host")}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 @container">
        {notice && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
            {notice}
          </div>
        )}
        <div className="w-full max-w-[520px] flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-32 w-32 border-4 border-white dark:border-surface-dark shadow-xl bg-gradient-to-br from-primary/40 to-slate-700"
              ></div>
              <div className="absolute bottom-1 right-1 h-6 w-6 bg-green-500 border-4 border-white dark:border-surface-dark rounded-full"></div>
            </div>
            <div className="flex flex-col items-center">
              <h1 className="text-black dark:text-white text-3xl font-bold tracking-tight">
                {t(`Welcome to ${hostName}'s Space`, `欢迎来到${hostName}的空间`)}
              </h1>
              <p className="text-gray-500 dark:text-[#9dabb9] text-base mt-1">
                {t("You are joining via", "你正通过")}{" "}
                <span className="font-semibold text-primary">{hostDomain || t("your host", "你的 Host")}</span>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold text-black dark:text-white">{t("Join as Guest", "以访客身份加入")}</h3>
                <p className="text-gray-500 dark:text-[#9dabb9]">
                  {t("Choose a nickname to start interacting with the community.", "选择一个昵称开始互动。")}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="flex flex-col w-full">
                  <span className="text-black dark:text-white text-sm font-semibold mb-2">{t("Nickname", "昵称")}</span>
                  <div className="flex w-full items-stretch relative">
                    <input
                      className="flex w-full min-w-0 flex-1 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-background-dark h-14 px-4 text-lg transition-all"
                      placeholder={t("e.g. DesignerPro", "例如：设计达人")}
                      type="text"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {checking ? (
                        <span className="material-symbols-outlined text-slate-400">refresh</span>
                      ) : status?.available ? (
                        <span className="material-symbols-outlined text-green-500 font-bold">check_circle</span>
                      ) : status ? (
                        <span className="material-symbols-outlined text-amber-500">lock</span>
                      ) : null}
                    </div>
                  </div>
                </label>
                {status?.available && <StatusBadge message={t("✓ Nickname is available.", "✓ 昵称可用。")} tone="green" />}
                {status?.reason === "password_required" && (
                  <StatusBadge message={t("This nickname is reserved. Enter the password to continue.", "该昵称已被保留，请输入密码继续。")} tone="amber" />
                )}
                {status?.reason === "taken" && <StatusBadge message={t("Nickname is already in use.", "该昵称已被使用。")} tone="red" />}
                {status?.reason === "deleted" && <StatusBadge message={t("This guest was removed from this space.", "该访客已被移除。")} tone="gray" />}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-black dark:text-white">{t("Password (optional)", "密码（可选）")}</label>
                <input
                  type="password"
                  className="flex w-full min-w-0 flex-1 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-border-dark bg-gray-50 dark:bg-background-dark h-14 px-4 text-lg transition-all"
                  placeholder={t("Only required for reserved nicknames", "仅保留昵称需要")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button
                className="w-full flex cursor-pointer items-center justify-center rounded-lg h-14 px-6 bg-primary hover:bg-primary/90 text-white text-lg font-bold shadow-lg shadow-primary/20 transition-all"
                onClick={handleJoin}
                disabled={loading}
              >
                {loading ? t("Joining...", "正在加入...") : t("Join Chat", "加入聊天")}
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-black/20 px-8 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-400 dark:text-gray-500">{t("By joining, you agree to the Terms.", "加入即表示你同意相关条款。")}</span>
              <div className="flex gap-4">
                <button className="text-xs font-medium text-primary hover:underline" onClick={() => showNotice(t("Privacy policy coming soon.", "隐私政策即将上线。"))}>
                  {t("Privacy Policy", "隐私政策")}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 text-center">
            <p className="text-gray-400 text-sm">
              {t("Don't have an account?", "还没有账号？")}{" "}
              <button className="text-primary font-semibold hover:underline" onClick={() => showNotice(t("Host registration is not open yet.", "Host 注册尚未开放。"))}>
                {t("Sign up for your own space", "创建你的空间")}
              </button>
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center text-gray-400 text-xs">
        {t("© 2024 ChatSystem Infrastructure. All rights reserved.", "© 2024 ChatSystem Infrastructure. 保留所有权利。")}
      </footer>
    </div>
  )
}
