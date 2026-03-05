import { useEffect, useState } from "react"
import { storage, type NotificationPrefs } from "../lib/storage"
import { useLocale } from "../lib/i18n"

export default function HostNotificationsPage() {
  const { t } = useLocale()
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    return (
      storage.getNotificationPrefs() || {
        email: true,
        push: false,
        bark: false,
        frequency: "instant",
      }
    )
  })

  useEffect(() => {
    storage.setNotificationPrefs(prefs)
  }, [prefs])

  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen text-slate-900 dark:text-slate-100">
      <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-10 py-3 bg-white dark:bg-background-dark sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="text-primary">
              <svg fill="none" height="32" viewBox="0 0 48 48" width="32" xmlns="http://www.w3.org/2000/svg">
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
              {t("Host Portal", "Host 门户")}
            </h2>
          </div>
          <div className="flex flex-1 justify-end gap-8">
            <div className="flex items-center gap-9">
              <a className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors" href="/host/dashboard">
                {t("Dashboard", "仪表盘")}
              </a>
              <a className="text-primary text-sm font-bold leading-normal" href="/host/notifications">
                {t("Settings", "设置")}
              </a>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 md:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <div className="flex flex-wrap gap-2 px-4 mb-4">
              <span className="text-slate-900 dark:text-white text-sm font-medium">{t("Notification Preferences", "通知偏好")}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-3 p-4 mb-6">
              <div className="flex min-w-72 flex-col gap-2">
                <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                  {t("Notification Preferences", "通知偏好")}
                </h1>
                <p className="text-slate-600 dark:text-[#9dabb9] text-base font-normal leading-normal">
                  {t("Manage how and when you receive alerts from your guest chat system.", "管理你从访客聊天系统收到通知的方式与频率。")}
                </p>
              </div>
            </div>

            <div className="mb-6 px-4 text-sm text-amber-500">
              {t(
                "The backend does not yet expose notification preference endpoints. Changes are saved locally only.",
                "后端暂未提供通知偏好接口，当前更改仅保存在本地。"
              )}
            </div>

            <div className="mb-10">
              <h2 className="text-slate-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-4">
                {t("Notification Channels", "通知渠道")}
              </h2>
              <div className="space-y-3 px-4">
                <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 dark:border-[#3b4754] bg-white dark:bg-background-dark p-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <span className="material-symbols-outlined">mail</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-slate-900 dark:text-white text-base font-bold leading-tight">{t("Email Notifications", "邮件通知")}</p>
                      <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-normal">
                        {t("Receive alerts via your registered email address.", "通过注册邮箱接收提醒。")}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`relative flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-all ${
                      prefs.email ? "bg-primary justify-end" : "bg-slate-200 dark:bg-[#283039]"
                    }`}
                    onClick={() => setPrefs((prev) => ({ ...prev, email: !prev.email }))}
                  >
                    <div className="h-full w-[27px] rounded-full bg-white shadow-md"></div>
                  </button>
                </div>

                <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 dark:border-[#3b4754] bg-white dark:bg-background-dark p-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <span className="material-symbols-outlined">notifications_active</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-slate-900 dark:text-white text-base font-bold leading-tight">{t("Web Push Notifications", "浏览器推送通知")}</p>
                      <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-normal">
                        {t("Browser notifications when you have the portal open.", "在打开控制台时显示浏览器通知。")}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`relative flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-all ${
                      prefs.push ? "bg-primary justify-end" : "bg-slate-200 dark:bg-[#283039]"
                    }`}
                    onClick={() => setPrefs((prev) => ({ ...prev, push: !prev.push }))}
                  >
                    <div className="h-full w-[27px] rounded-full bg-white shadow-md"></div>
                  </button>
                </div>

                <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 dark:border-[#3b4754] bg-white dark:bg-background-dark p-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <span className="material-symbols-outlined">smartphone</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-slate-900 dark:text-white text-base font-bold leading-tight">{t("Bark (Custom Push)", "Bark（自定义推送）")}</p>
                      <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-normal">
                        {t("Push directly to your iOS device via Bark server.", "通过 Bark 服务器直接推送到你的 iOS 设备。")}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`relative flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-all ${
                      prefs.bark ? "bg-primary justify-end" : "bg-slate-200 dark:bg-[#283039]"
                    }`}
                    onClick={() => setPrefs((prev) => ({ ...prev, bark: !prev.bark }))}
                  >
                    <div className="h-full w-[27px] rounded-full bg-white shadow-md"></div>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 mb-10">
              <div>
                <h2 className="text-slate-900 dark:text-white text-[20px] font-bold leading-tight pb-4">{t("Frequency", "通知频率")}</h2>
                <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-[#3b4754] rounded-xl overflow-hidden">
                  {[
                    { id: "instant", label: t("Instant", "即时"), hint: t("Sent immediately as events happen", "事件发生即发送") },
                    { id: "daily", label: t("Daily Digest", "每日汇总"), hint: t("One summary at the end of the day", "每天结束时汇总一次") },
                    { id: "weekly", label: t("Weekly Digest", "每周汇总"), hint: t("Weekly summary on Mondays", "每周一发送汇总") },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white font-bold">{option.label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                      </div>
                      <input
                        className="w-5 h-5 text-primary border-slate-300 focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                        type="radio"
                        name="frequency"
                        checked={prefs.frequency === option.id}
                        onChange={() => setPrefs((prev) => ({ ...prev, frequency: option.id as NotificationPrefs["frequency"] }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-slate-900 dark:text-white text-[20px] font-bold leading-tight pb-4">{t("Scope", "范围")}</h2>
                <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-[#3b4754] rounded-xl overflow-hidden p-4 space-y-3 text-sm text-slate-500">
                  <p>{t("Fine-grained notification routing will be available in a future backend release.", "更细粒度的通知路由将在后端更新后提供。")}</p>
                  <p className="text-primary font-semibold">{t("Current scope: All guests", "当前范围：全部访客")}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
