import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { AppBottomNav } from "./components/AppBottomNav";
import { AppToast } from "./components/AppToast";
import { DocumentTitle } from "./components/DocumentTitle";
import { FeedbackState } from "./components/FeedbackState";
import { GlobalMessageSync } from "./components/GlobalMessageSync";
import { GrowthLevelCelebration } from "./components/GrowthLevelCelebration";
import { PwaRecommendation } from "./components/PwaRecommendation";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { RequireAdminAuth } from "./lib/adminAuth";
import { RequireAuth, useAuth } from "./lib/auth";
import AdminSpacePage from "./pages/AdminSpacePage";
import ChatsPage from "./pages/ChatsPage";
import FriendInvitePage from "./pages/FriendInvitePage";
import FriendProfilePage from "./pages/FriendProfilePage";
import FriendsPage from "./pages/FriendsPage";
import JoinSpacePage from "./pages/JoinSpacePage";
import LandingPage from "./pages/LandingPage";
import MenuPage from "./pages/MenuPage";
import NotificationsPage from "./pages/NotificationsPage";
import OfficialLoginPage from "./pages/OfficialLoginPage";
import AccountSwitchPage from "./pages/AccountSwitchPage";
import SpaceAdminDashboardPage from "./pages/SpaceAdminDashboardPage";
import SpaceUsersPage from "./pages/SpaceUsersPage";
import SquarePage from "./pages/SquarePage";
import { buildAdminPath, buildJoinHrefForCurrentHost, getDetectedSpaceSlug } from "./lib/spaceEntry";
import { useI18n } from "./lib/language";

function RootEntryRedirect() {
  const detectedSlug = getDetectedSpaceSlug();
  return detectedSlug ? <JoinSpacePage /> : <LandingPage />;
}

function LegacyJoinRedirect() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  return slug ? <LegacyJoinHostRedirect slug={slug} /> : <Navigate replace to="/space" />;
}

function LegacyAdminRedirect({ mode }: { mode: "create" | "login" }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  return <Navigate replace to={`${buildAdminPath(slug, mode)}${location.hash}`} />;
}

function LegacyJoinHostRedirect({ slug }: { slug: string }) {
  const { t } = useI18n();
  useEffect(() => {
    window.location.replace(buildJoinHrefForCurrentHost(slug));
  }, [slug]);

  return <FeedbackState title={t("app.enteringSpace")} />;
}

function LegacySlugRedirect() {
  const { slug = "" } = useParams();
  return <LegacyJoinHostRedirect slug={slug} />;
}

function LegacySettingsRedirect() {
  const location = useLocation();
  const channel = new URLSearchParams(location.search).get("channel");
  return <Navigate replace to={channel === "email" ? "/app/menu?sheet=email-verification" : "/app/menu"} />;
}

export default function App() {
  const location = useLocation();
  const { ready, session } = useAuth();
  const showFriendInviteOverlay = Boolean(session && location.pathname === "/friend-invite");
  const routeLocation = showFriendInviteOverlay
    ? {
        ...location,
        pathname: "/app/chats",
        search: "",
        hash: "",
        key: `${location.key}-invite-background`,
      }
    : location;

  return (
    <>
      <Routes location={routeLocation}>
        <Route path="/" element={<RootEntryRedirect />} />
        <Route path="/entry" element={<RootEntryRedirect />} />
        <Route path="/friend-invite" element={<FriendInvitePage />} />
        <Route path="/official-login" element={<OfficialLoginPage />} />
        <Route path="/account-switch" element={<AccountSwitchPage />} />
        <Route path="/space" element={<AdminSpacePage />} />
        <Route
          path="/space/dashboard"
          element={
            <RequireAdminAuth>
              <SpaceAdminDashboardPage />
            </RequireAdminAuth>
          }
        />
        <Route path="/space/create" element={<LegacyAdminRedirect mode="create" />} />
        <Route path="/space/login" element={<LegacyAdminRedirect mode="login" />} />
        <Route path="/space/join" element={<LegacyJoinRedirect />} />
        <Route path="/space/:slug" element={<LegacySlugRedirect />} />

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
          path="/app/notifications/friends/:friendId"
          element={
            <RequireAuth>
              <FriendProfilePage />
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
              <LegacySettingsRedirect />
            </RequireAuth>
          }
        />
        <Route
          path="/app/settings/notifications"
          element={
            <RequireAuth>
              <LegacySettingsRedirect />
            </RequireAuth>
          }
        />
        <Route
          path="/app/settings/contacts"
          element={
            <RequireAuth>
              <LegacySettingsRedirect />
            </RequireAuth>
          }
        />
        <Route path="*" element={<RootEntryRedirect />} />
      </Routes>
      {showFriendInviteOverlay ? (
        <Routes>
          <Route path="/friend-invite" element={<FriendInvitePage overlay />} />
        </Routes>
      ) : null}
      {ready ? <DocumentTitle /> : null}
      {ready ? <GlobalMessageSync /> : null}
      {ready ? <GrowthLevelCelebration /> : null}
      {ready ? <AppBottomNav /> : null}
      {ready ? <PwaRecommendation /> : null}
      <PwaUpdatePrompt />
      <AppToast />
    </>
  );
}
