import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppBottomNav } from "./components/AppBottomNav";
import { AppToast } from "./components/AppToast";
import { DocumentTitle } from "./components/DocumentTitle";
import { FeedbackState } from "./components/FeedbackState";
import { GlobalMessageSync } from "./components/GlobalMessageSync";
import { GlobalMediaLocationMap } from "./components/GlobalMediaLocationMap";
import { GlobalChatLayoutDiagnostics } from "./components/GlobalChatLayoutDiagnostics";
import { PwaRecommendation } from "./components/PwaRecommendation";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { RouteResourceBoundary } from "./components/RouteResourceBoundary";
import { RouteResourceState } from "./components/RouteResourceState";
import { RequireAdminAuth } from "./lib/adminAuth";
import { RequireAuth, useAuth } from "./lib/auth";
import FriendInvitePage from "./pages/FriendInvitePage";
import JoinSpacePage from "./pages/JoinSpacePage";
import LandingPage from "./pages/LandingPage";
import OfficialLoginPage from "./pages/OfficialLoginPage";
import AccountSwitchPage from "./pages/AccountSwitchPage";
import PwaAccountEntryPage from "./pages/PwaAccountEntryPage";
import { getDetectedSpaceSlug } from "./lib/spaceEntry";
import { useSpaceFeatures } from "./lib/spaceFeatures";
import { routeResources } from "./lib/routeResources";

const AdminSpacePage = lazy(() => import("./pages/AdminSpacePage"));
const GrowthLevelCelebration = lazy(() => import("./components/GrowthLevelCelebration").then((module) => ({ default: module.GrowthLevelCelebration })));
const ChatsPage = lazy(routeResources.chats);
const FriendProfilePage = lazy(() => import("./pages/FriendProfilePage"));
const MenuPage = lazy(routeResources.menu);
const NotificationsPage = lazy(routeResources.notifications);
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPage"));
const SpaceAdminDashboardPage = lazy(() => import("./pages/SpaceAdminDashboardPage"));
const SquarePage = lazy(routeResources.square);
const SquareComposerLabPage = lazy(() => import("./pages/SquareComposerLabPage"));
const ForwardBundlePreviewLabPage = lazy(() => import("./pages/ForwardBundlePreviewLabPage"));
const MentionMobileLabPage = lazy(() => import("./pages/MentionMobileLabPage"));

function RootEntryRedirect() {
  const detectedSlug = getDetectedSpaceSlug();
  return detectedSlug ? <JoinSpacePage /> : <LandingPage />;
}

function AppHomeRedirect() {
  const features = useSpaceFeatures();
  if (!features.ready) return <RouteResourceState status="loading" />;
  return <Navigate replace to={features.chatEnabled ? "/app/chats" : "/app/square"} />;
}

function RequireChatFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  if (!features.ready) return <RouteResourceState status="loading" />;
  if (!features.chatEnabled) return <Navigate replace to="/app/square" />;
  return children;
}

function RequireSubmissionFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  if (!features.ready) return <RouteResourceState status="loading" />;
  if (!features.submissionEnabled) return <Navigate replace to="/app/square" />;
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
      <RouteResourceBoundary>
        <Suspense fallback={<RouteResourceState status="loading" />}>
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
        <Route
          path="/design/forward-bundle-preview"
          element={<Suspense fallback={<FeedbackState title="Loading design study" tone="loading" />}><ForwardBundlePreviewLabPage /></Suspense>}
        />
        <Route
          path="/design/mention-mobile-variants"
          element={<Suspense fallback={<RouteResourceState status="loading" />}><MentionMobileLabPage /></Suspense>}
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
          element={<RequireAuth><RequireSubmissionFeature><Navigate replace to="/app/square?workspace=submissions" /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/new"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" squareIntegrated /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/:chatId"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" squareIntegrated /></RequireSubmissionFeature></RequireAuth>}
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
          path="/app/square/submissions/:chatId"
          element={
            <RequireAuth>
              <RequireSubmissionFeature><SquarePage /></RequireSubmissionFeature>
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
          element={<Navigate replace to="/app/notifications" />}
        />
        <Route
          path="/app/friends/requests"
          element={<Navigate replace to="/app/notifications?panel=friend-requests" />}
        />
        <Route
          path="/app/space-users"
          element={<Navigate replace to="/app/notifications" />}
        />
        <Route
          path="/app/space-users/online"
          element={<Navigate replace to="/app/notifications" />}
        />
        <Route path="*" element={<RootEntryRedirect />} />
          </Routes>
        </Suspense>
      </RouteResourceBoundary>
      {showFriendInviteOverlay ? (
        <Routes>
          <Route path="/friend-invite" element={<FriendInvitePage overlay />} />
        </Routes>
      ) : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <DocumentTitle /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <GlobalMessageSync /> : null}
      {ready && session && !isPlatformAdmin && !isDesignLab ? <GlobalMediaLocationMap /> : null}
      {ready && session && !isPlatformAdmin && !isDesignLab ? <GlobalChatLayoutDiagnostics /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <GrowthLevelCelebration /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <AppBottomNav /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <PwaRecommendation /> : null}
      {!isPlatformAdmin && !isDesignLab ? <PwaUpdatePrompt /> : null}
      <AppToast />
    </>
  );
}
