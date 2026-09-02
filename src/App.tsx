import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppBottomNav } from "./components/AppBottomNav";
import { AppToast } from "./components/AppToast";
import { DocumentTitle } from "./components/DocumentTitle";
import { FeedbackState } from "./components/FeedbackState";
import { GlobalMessageSync } from "./components/GlobalMessageSync";
import { GlobalMediaLocationMap } from "./components/GlobalMediaLocationMap";
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
import PwaAccountEntryPage from "./pages/PwaAccountEntryPage";
import SpaceAdminDashboardPage from "./pages/SpaceAdminDashboardPage";
import SpaceUsersPage from "./pages/SpaceUsersPage";
import SquarePage from "./pages/SquarePage";
import { getDetectedSpaceSlug } from "./lib/spaceEntry";
import { useI18n } from "./lib/language";
import { useSpaceFeatures } from "./lib/spaceFeatures";
import PlatformAdminPage from "./pages/PlatformAdminPage";
import SubmissionCreatePage from "./pages/SubmissionCreatePage";

const SquareComposerLabPage = lazy(() => import("./pages/SquareComposerLabPage"));

function RootEntryRedirect() {
  const detectedSlug = getDetectedSpaceSlug();
  return detectedSlug ? <JoinSpacePage /> : <LandingPage />;
}

function AppHomeRedirect() {
  const features = useSpaceFeatures();
  const { t } = useI18n();
  if (!features.ready) return <FeedbackState title={t("common.loading")} tone="loading" />;
  return <Navigate replace to={features.chatEnabled ? "/app/chats" : "/app/square"} />;
}

function RequireChatFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  const { t } = useI18n();
  if (!features.ready) return <FeedbackState title={t("common.loading")} tone="loading" />;
  if (!features.chatEnabled) return <Navigate replace to="/app/square" />;
  return children;
}

function RequireSubmissionFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  const { t } = useI18n();
  if (!features.ready) return <FeedbackState title={t("common.loading")} tone="loading" />;
  if (!features.submissionEnabled) return <Navigate replace to="/app/chats" />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { ready, session } = useAuth();
  const features = useSpaceFeatures();
  const showFriendInviteOverlay = Boolean(session && location.pathname === "/friend-invite");
  const isPlatformAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const isDesignLab = location.pathname.startsWith("/design/");
  const routeLocation = showFriendInviteOverlay
    ? {
        ...location,
        pathname: features.ready && !features.chatEnabled ? "/app/square" : "/app/chats",
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
        <Route path="/pwa" element={<PwaAccountEntryPage />} />
        <Route path="/admin" element={<PlatformAdminPage />} />
        <Route
          path="/design/square-composer"
          element={<Suspense fallback={<FeedbackState title="Loading design study" tone="loading" />}><SquareComposerLabPage /></Suspense>}
        />
        <Route path="/space" element={<AdminSpacePage />} />
        <Route
          path="/space/dashboard"
          element={
            <RequireAdminAuth>
              <SpaceAdminDashboardPage />
            </RequireAdminAuth>
          }
        />
        <Route path="/app" element={<AppHomeRedirect />} />
        <Route
          path="/app/chats"
          element={
            <RequireAuth>
              <RequireChatFeature><ChatsPage /></RequireChatFeature>
            </RequireAuth>
          }
        />
        <Route
          path="/app/chats/:chatId"
          element={
            <RequireAuth>
              <RequireChatFeature><ChatsPage /></RequireChatFeature>
            </RequireAuth>
          }
        />
        <Route
          path="/app/submissions"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/new"
          element={<RequireAuth><RequireSubmissionFeature><SubmissionCreatePage /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/:chatId"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" /></RequireSubmissionFeature></RequireAuth>}
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
          path="/app/square/statements/:statementId"
          element={
            <RequireAuth>
              <SquarePage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/square/activities/:activityKey"
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
        <Route path="*" element={<RootEntryRedirect />} />
      </Routes>
      {showFriendInviteOverlay ? (
        <Routes>
          <Route path="/friend-invite" element={<FriendInvitePage overlay />} />
        </Routes>
      ) : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <DocumentTitle /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <GlobalMessageSync /> : null}
      {ready && session && !isPlatformAdmin && !isDesignLab ? <GlobalMediaLocationMap /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <GrowthLevelCelebration /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <AppBottomNav /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <PwaRecommendation /> : null}
      {!isPlatformAdmin && !isDesignLab ? <PwaUpdatePrompt /> : null}
      <AppToast />
    </>
  );
}
