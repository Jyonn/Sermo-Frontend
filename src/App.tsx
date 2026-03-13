import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./lib/auth";
import EntryPage from "./pages/EntryPage";
import ChatsPage from "./pages/ChatsPage";
import FriendsPage from "./pages/FriendsPage";
import SettingsPage from "./pages/SettingsPage";
import SpaceUsersPage from "./pages/SpaceUsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/entry" />} />
      <Route path="/entry" element={<EntryPage mode="join" />} />
      <Route path="/space/create" element={<EntryPage mode="create" />} />
      <Route path="/space/login" element={<EntryPage mode="login" />} />
      <Route path="/space/join" element={<EntryPage mode="join" />} />

      <Route path="/app" element={<Navigate replace to="/app/chats" />} />
      <Route
        path="/app/chats"
        element={
          <RequireAuth>
            <ChatsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/chats/:chatId"
        element={
          <RequireAuth>
            <ChatsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/friends"
        element={
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/friends/requests"
        element={
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/space-users"
        element={
          <RequireAuth>
            <SpaceUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/space-users/online"
        element={
          <RequireAuth>
            <SpaceUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings/account"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings/notifications"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings/contacts"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate replace to="/entry" />} />
    </Routes>
  );
}
