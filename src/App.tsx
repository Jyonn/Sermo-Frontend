import { useEffect } from "react"
import { Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "./lib/auth-context"
import { userApi } from "./lib/api"
import EntryPage from "./pages/Entry"
import GuestJoinPage from "./pages/GuestJoin"
import HostLoginPage from "./pages/HostLogin"
import HostDashboardPage from "./pages/HostDashboard"
import HostChatPage from "./pages/HostChat"
import GuestChatPage from "./pages/GuestChat"
import GuestCrmPage from "./pages/GuestCrm"
import GroupChatSettingsPage from "./pages/GroupChatSettings"
import HostNotificationsPage from "./pages/HostNotifications"
import HostProfilePage from "./pages/HostProfile"
import SubdomainSettingsPage from "./pages/SubdomainSettings"
import NotFoundPage from "./pages/NotFound"

const Heartbeat = () => {
  const { auth } = useAuth()

  useEffect(() => {
    if (!auth) return
    const id = window.setInterval(() => {
      userApi.heartbeat(auth).catch(() => null)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [auth])

  return null
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<EntryPage />} />
    <Route path="/guest/join" element={<GuestJoinPage />} />
    <Route path="/host/login" element={<HostLoginPage />} />
    <Route path="/host/dashboard" element={<HostDashboardPage />} />
    <Route path="/host/chats" element={<HostChatPage />} />
    <Route path="/host/guests" element={<GuestCrmPage />} />
    <Route path="/host/groups" element={<GroupChatSettingsPage />} />
    <Route path="/host/notifications" element={<HostNotificationsPage />} />
    <Route path="/host/profile" element={<HostProfilePage />} />
    <Route path="/host/subdomain" element={<SubdomainSettingsPage />} />
    <Route path="/chat" element={<GuestChatPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  return (
    <AuthProvider>
      <Heartbeat />
      <AppRoutes />
    </AuthProvider>
  )
}
