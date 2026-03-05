import { Link } from "react-router-dom"
import { useLocale } from "../lib/i18n"

export default function NotFoundPage() {
  const { t } = useLocale()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black">{t("Page not found", "页面未找到")}</h1>
        <p className="text-slate-500">{t("The page you are looking for does not exist.", "你访问的页面不存在。")}</p>
        <Link className="text-primary font-semibold hover:underline" to="/">
          {t("Back to home", "返回首页")}
        </Link>
      </div>
    </div>
  )
}
