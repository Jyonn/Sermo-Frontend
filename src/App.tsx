import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AppBottomNav } from "./components/AppBottomNav";
import { RequireAuth } from "./lib/auth";
import AdminSpacePage from "./pages/AdminSpacePage";
import ChatsPage from "./pages/ChatsPage";
import FriendsPage from "./pages/FriendsPage";
import JoinSpacePage from "./pages/JoinSpacePage";
import MenuPage from "./pages/MenuPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import SpaceUsersPage from "./pages/SpaceUsersPage";
import SquarePage from "./pages/SquarePage";
import { buildAdminPath, buildJoinPath, getDetectedSpaceSlug } from "./lib/spaceEntry";

function RootEntryRedirect() {
  const detectedSlug = getDetectedSpaceSlug();
  return <Navigate replace to={detectedSlug ? buildJoinPath(detectedSlug) : "/space"} />;
}

function LegacyJoinRedirect() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  return <Navigate replace to={slug ? buildJoinPath(slug) : "/space"} />;
}

function LegacyAdminRedirect({ mode }: { mode: "create" | "login" }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  return <Navigate replace to={`${buildAdminPath(slug, mode)}${location.hash}`} />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RootEntryRedirect />} />
        <Route path="/entry" element={<RootEntryRedirect />} />
        <Route path="/space" element={<AdminSpacePage />} />
        <Route path="/space/create" element={<LegacyAdminRedirect mode="create" />} />
        <Route path="/space/login" element={<LegacyAdminRedirect mode="login" />} />
        <Route path="/space/join" element={<LegacyJoinRedirect />} />
        <Route path="/space/:slug" element={<JoinSpacePage />} />

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
          path="/app/square"
          element={
            <RequireAuth>
              <SquarePage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/menu"
          element={
            <RequireAuth>
              <MenuPage />
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
        <Route path="*" element={<RootEntryRedirect />} />
      </Routes>
      <AppBottomNav />
    </>
  );
}
