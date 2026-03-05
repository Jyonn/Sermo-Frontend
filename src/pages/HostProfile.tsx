import { useEffect, useState } from "react"
import { useAuth } from "../lib/auth-context"
import { storage } from "../lib/storage"
import { useLocale } from "../lib/i18n"

export default function HostProfilePage() {
  const { auth } = useAuth()
  const { t } = useLocale()
  const saved = storage.getHostProfile()
  const [name, setName] = useState(saved?.name || auth?.user?.name || "")
  const [description, setDescription] = useState(saved?.description || "")
  const [email, setEmail] = useState(saved?.email || "")
  const [phone, setPhone] = useState(saved?.phone || "")
  const [bark, setBark] = useState(saved?.bark || "")
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    storage.setHostProfile({ name, description, email, phone, bark })
  }, [name, description, email, phone, bark])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-10 py-3 bg-white dark:bg-background-dark">
        <div className="flex items-center gap-4">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M39.5563 34.1455V13.8546C39.5563 15.708 36.8773 17.3437 32.7927 18.3189C30.2914 18.916 27.263 19.2655 24 19.2655C20.737 19.2655 17.7086 18.916 15.2073 18.3189C11.1227 17.3437 8.44365 15.708 8.44365 13.8546V34.1455C8.44365 35.9988 11.1227 37.6346 15.2073 38.6098C17.7086 39.2069 20.737 39.5564 24 39.5564C27.263 39.5564 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">{t("Host Settings", "Host 设置")}</h2>
        </div>
        <div className="flex items-center gap-4">
          <a className="text-slate-600 dark:text-white text-sm font-medium hover:text-primary" href="/host/dashboard">
            {t("Dashboard", "仪表盘")}
          </a>
          <a className="text-primary text-sm font-bold" href="/host/profile">
            {t("Profile", "资料")}
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-black">{t("Profile & Integrations", "资料与集成")}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {t("Update your host identity, contact channels, and integrations.", "更新 Host 身份、联系渠道和集成设置。")}
          </p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
            {notice}
          </div>
        )}
        <div className="mb-6 text-sm text-amber-500">
          {t(
            "The backend does not yet expose profile update endpoints. Changes are saved locally only.",
            "后端暂未提供资料更新接口，当前更改仅保存在本地。"
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{t("Host Identity", "Host 身份")}</h2>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Display Name", "显示名称")}</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Description", "简介")}</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </section>

          <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{t("Contact Channels", "联系渠道")}</h2>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Email", "邮箱")}</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("host@example.com", "host@example.com")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Phone", "电话")}</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t("+1 555 123 4567", "+1 555 123 4567")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("Bark Token", "Bark 令牌")}</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
                value={bark}
                onChange={(event) => setBark(event.target.value)}
                placeholder={t("Bark key", "Bark Key")}
              />
            </div>
          </section>
        </div>

        <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 mt-6">
          <h2 className="text-lg font-bold">{t("Integrations", "集成")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <p className="font-semibold">{t("Calendar Sync", "日历同步")}</p>
              <p className="text-sm text-slate-500">{t("Connect your calendar to auto-manage guest check-ins.", "连接日历以自动管理访客签到。")}</p>
              <button
                className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
                onClick={() => showNotice(t("Calendar integration is coming soon.", "日历集成即将上线。"))}
              >
                {t("Connect", "连接")}
              </button>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <p className="font-semibold">{t("Webhook Alerts", "Webhook 通知")}</p>
              <p className="text-sm text-slate-500">{t("Send guest events to your automation workflows.", "将访客事件发送到自动化流程。")}</p>
              <button
                className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
                onClick={() => showNotice(t("Webhook configuration is not available yet.", "Webhook 配置暂不可用。"))}
              >
                {t("Configure", "配置")}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
