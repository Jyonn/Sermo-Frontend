import { useEffect, useMemo, useState } from "react"
import { chatApi, userApi } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import type { Chat, GroupChat } from "../lib/types"
import { useLocale } from "../lib/i18n"

export default function GroupChatSettingsPage() {
  const { auth } = useAuth()
  const { t } = useLocale()
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groupName, setGroupName] = useState("")
  const [selectedGuests, setSelectedGuests] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    if (!auth) return
    setLoading(true)
    setError(null)
    try {
      const [chatData, guestData] = await Promise.all([
        chatApi.listChats(auth),
        userApi.listGuests(auth, { limit: 200, offset: 0 }),
      ])
      const groupChats = (chatData as Chat[]).filter((chat) => chat.group) as GroupChat[]
      setGroups(groupChats)
      setGuests(guestData as any[])
      if (groupChats.length > 0) {
        setSelectedGroupId((prev) => prev ?? groupChats[0].chat_id)
      }
    } catch (err: any) {
      setError(err?.message || t("Unable to load group chats.", "无法加载群组聊天。"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [auth])

  const selectedGroup = useMemo(
    () => groups.find((group) => group.chat_id === selectedGroupId) || null,
    [groups, selectedGroupId]
  )

  useEffect(() => {
    setGroupName(selectedGroup?.name || "")
  }, [selectedGroup])

  const handleRename = async () => {
    if (!auth || !selectedGroup) return
    setError(null)
    try {
      await chatApi.renameGroup(auth, selectedGroup.chat_id, groupName)
      await loadData()
    } catch (err: any) {
      setError(err?.message || t("Unable to rename group.", "无法重命名群组。"))
    }
  }

  const handleAddMembers = async () => {
    if (!auth || !selectedGroup || selectedGuests.length === 0) return
    setError(null)
    try {
      await chatApi.addGroupMembers(auth, selectedGroup.chat_id, selectedGuests)
      setSelectedGuests([])
      await loadData()
    } catch (err: any) {
      setError(err?.message || t("Unable to add members.", "无法添加成员。"))
    }
  }

  const handleRemoveMember = async (guestId: number) => {
    if (!auth || !selectedGroup) return
    setError(null)
    try {
      await chatApi.removeGroupMembers(auth, selectedGroup.chat_id, [guestId])
      await loadData()
    } catch (err: any) {
      setError(err?.message || t("Unable to remove member.", "无法移除成员。"))
    }
  }

  const handleCreateGroup = async () => {
    if (!auth || selectedGuests.length === 0) {
      setError(t("Select at least one guest to start a group.", "请至少选择一位访客来创建群组。"))
      return
    }
    setError(null)
    try {
      await chatApi.createGroup(auth, selectedGuests)
      setSelectedGuests([])
      await loadData()
    } catch (err: any) {
      setError(err?.message || t("Unable to create group.", "无法创建群组。"))
    }
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161e27] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">forum</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-tight hidden md:block">{t("Host Console", "Host 控制台")}</h2>
              </div>
              <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-slate-700">
                <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
                <input
                  className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-500"
                  placeholder={t("Search chats...", "搜索聊天...")}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <nav className="hidden lg:flex items-center gap-6">
                <a className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white text-sm font-medium transition-colors" href="/host/dashboard">
                  {t("Dashboard", "仪表盘")}
                </a>
                <a className="text-primary dark:text-white text-sm font-semibold border-b-2 border-primary py-5" href="/host/groups">
                  {t("Groups", "群组")}
                </a>
                <a className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white text-sm font-medium transition-colors" href="/host/guests">
                  {t("Guests", "访客")}
                </a>
              </nav>
              <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-6">
                <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"></div>
                <span className="material-symbols-outlined text-slate-400">expand_more</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <a className="hover:text-primary" href="/host/groups">
                {t("Groups", "群组")}
              </a>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-slate-900 dark:text-slate-300">{t("Settings", "设置")}</span>
            </nav>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{t("Group Settings", "群组设置")}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              {t("Manage your subdomain's active group chat, members, and permissions.", "管理子域名下的群组聊天、成员与权限。")}
            </p>
          </div>
          <button
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
            onClick={handleCreateGroup}
          >
            <span className="material-symbols-outlined">group_add</span>
            {t("Create Group", "创建群组")}
          </button>
        </div>

        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
        {loading && <div className="mb-4 text-slate-500 text-sm">{t("Loading groups...", "正在加载群组...")}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm lg:col-span-2">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("General Information", "基本信息")}</h2>
              <select
                className="bg-slate-100 dark:bg-slate-800 text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                value={selectedGroupId ?? ""}
                onChange={(event) => setSelectedGroupId(Number(event.target.value))}
              >
                <option value="" disabled>
                  {t("Select a group", "选择群组")}
                </option>
                {groups.map((group) => (
                  <option key={group.chat_id} value={group.chat_id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-2 max-w-md">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t("Group Name", "群组名称")}</label>
                <div className="flex gap-3">
                  <input
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder={t("Enter group name", "输入群组名称")}
                    type="text"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    disabled={!selectedGroup}
                  />
                  <button
                    className="bg-slate-900 dark:bg-slate-700 text-white px-5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                    onClick={handleRename}
                    disabled={!selectedGroup}
                  >
                    {t("Save", "保存")}
                  </button>
                </div>
                <p className="text-xs text-slate-500">{t("Visible to all subdomain guests in this group.", "对该群组内所有访客可见。")}</p>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-lg font-bold">{t("Add Members", "添加成员")}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {guests.map((guest) => (
                  <label key={guest.user_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                      checked={selectedGuests.includes(guest.user_id)}
                      onChange={(event) => {
                        setSelectedGuests((prev) =>
                          event.target.checked
                            ? [...prev, guest.user_id]
                            : prev.filter((id) => id !== guest.user_id)
                        )
                      }}
                    />
                    <span>{guest.name}</span>
                  </label>
                ))}
              </div>
              <button
                className="w-full bg-primary text-white py-2 rounded-lg font-semibold"
                onClick={handleAddMembers}
                disabled={!selectedGroup}
              >
                {t("Add Selected Members", "添加所选成员")}
              </button>
            </div>
          </section>
        </div>

        <section className="bg-white dark:bg-[#161e27] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm mt-6">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{t("Members", "成员")}</h2>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {t(`${selectedGroup?.guests?.length || 0} Total`, `${selectedGroup?.guests?.length || 0} 人`)}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-slate-400">
                  <th className="px-6 py-3">{t("Guest", "访客")}</th>
                  <th className="px-6 py-3">{t("Status", "状态")}</th>
                  <th className="px-6 py-3 text-right">{t("Actions", "操作")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {!selectedGroup && (
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-500" colSpan={3}>
                      {t("Select a group to see members.", "请选择群组查看成员。")}
                    </td>
                  </tr>
                )}
                {selectedGroup?.guests?.map((guest) => (
                  <tr key={guest.user_id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {guest.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{guest.name}</p>
                          <p className="text-xs text-slate-500">ID {guest.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{guest.is_alive ? t("Online", "在线") : t("Offline", "离线")}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="text-red-400 text-sm font-semibold hover:underline"
                        onClick={() => handleRemoveMember(guest.user_id)}
                      >
                        {t("Remove", "移除")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
