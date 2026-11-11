import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation,useParams } from "react-router-dom";
import {ActivityOverlayProvider} from './lib/activityOverlay';
import {FeatureUnavailablePage} from './components/FeatureUnavailablePage';
import {useI18n} from './lib/language';
import {availableAppHome} from './lib/availableAppHome';
import { AppBottomNav } from "./components/AppBottomNav";
import { AppToast } from "./components/AppToast";
import {FrontendUpdatePoller} from './components/FrontendUpdatePoller';
import { ChronelleBindingGate, ChronelleReturnFailure } from './components/ChronelleBindingGate';
import { isChronelleReturn } from './lib/chronelleReturn';
import { DocumentTitle } from "./components/DocumentTitle";
import { FeedbackState } from "./components/FeedbackState";
import { GlobalMessageSync } from "./components/GlobalMessageSync";
import {GlobalVoiceCalls} from './components/GlobalVoiceCalls';
import {voiceCallsEnabled} from './lib/voiceCalls';
import { GlobalMediaLocationMap } from "./components/GlobalMediaLocationMap";
import { GlobalChatLayoutDiagnostics } from "./components/GlobalChatLayoutDiagnostics";
import { PwaRecommendation } from "./components/PwaRecommendation";
import { SiteMigrationNotice } from "./components/SiteMigrationNotice";
import { RouteResourceBoundary } from "./components/RouteResourceBoundary";
import { RouteResourceState } from "./components/RouteResourceState";
import { RequireAdminAuth } from "./lib/adminAuth";
import { RequireAuth, useAuth } from "./lib/auth";
import FriendInvitePage from "./pages/FriendInvitePage";
import JoinSpacePage from "./pages/JoinSpacePage";
import LandingPage from "./pages/LandingPage";
import OfficialLoginPage from "./pages/OfficialLoginPage";
import AccountSwitchPage from "./pages/AccountSwitchPage";
const HistoryManagerPage = lazy(() => import("./pages/HistoryManagerPage"));
import PwaAccountEntryPage from "./pages/PwaAccountEntryPage";
import { getDetectedSpaceSlug } from "./lib/spaceEntry";
import { refreshSpaceFeatures, useSpaceFeatures } from "./lib/spaceFeatures";
import { applySiteTheme } from './lib/siteTheme';
import {useBirthday} from './lib/birthday';
import {BirthdayExperience} from './components/BirthdayExperience';
import {birthdayAssets} from './lib/birthdayAssets';
import { legacySubmissionDestination } from "./lib/submissionRouting";
import { routeResources } from "./lib/routeResources";
import { readOAuthRequest, isOAuthLoginPending } from "./lib/oauthPending";

const AdminSpacePage = lazy(() => import("./pages/AdminSpacePage"));
const NumberDuelRoomPage = lazy(() => import("./pages/NumberDuelRoomPage"));
const GrowthLevelCelebration = lazy(() => import("./components/GrowthLevelCelebration").then((module) => ({ default: module.GrowthLevelCelebration })));
const ChatsPage = lazy(routeResources.chats);
const VoiceCallLabPage = lazy(()=>import('./pages/VoiceCallLabPage'));
const FriendProfilePage = lazy(() => import("./pages/FriendProfilePage"));
const MenuPage = lazy(routeResources.menu);
const DeveloperPage = lazy(routeResources.developer);
const ResearchPage = lazy(routeResources.research);
const NotificationsPage = lazy(routeResources.notifications);
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPage"));
const SpaceAdminDashboardPage = lazy(() => import("./pages/SpaceAdminDashboardPage"));
const SquarePage = lazy(routeResources.square);
const SquareComposerLabPage = lazy(() => import("./pages/SquareComposerLabPage"));
const ForwardBundlePreviewLabPage = lazy(() => import("./pages/ForwardBundlePreviewLabPage"));
const MentionMobileLabPage = lazy(() => import("./pages/MentionMobileLabPage"));
const InteractionPatternsPage = lazy(() => import("./pages/InteractionPatternsPage"));
const ExplorerActivityLabPage = lazy(() => import("./pages/ExplorerActivityLabPage"));
const OAuthAuthorizePage = lazy(() => import("./pages/OAuthAuthorizePage"));

function RootEntryRedirect() {
  const detectedSlug = getDetectedSpaceSlug();
  return detectedSlug ? <JoinSpacePage /> : <LandingPage />;
}

function AppHomeRedirect() {
  const features = useSpaceFeatures();
  const [oauthRequest] = useState(readOAuthRequest);
  if (!features.ready) return <RouteResourceState status="loading" />;
  if (oauthRequest) return <Navigate replace to={isOAuthLoginPending() ? "/pwa?oauth_login=1" : oauthRequest} />;
  return <Navigate replace to={availableAppHome(features)} />;
}

function RequireChatFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  const {t}=useI18n();
  if (!features.ready) return <RouteResourceState status="loading" />;
  if (!features.chatEnabled) return <FeatureUnavailablePage title={t('nav.chats')}/>;
  return children;
}

function RequireSubmissionFeature({ children }: { children: ReactNode }) {
  const features = useSpaceFeatures();
  const {t}=useI18n();
  if (!features.ready) return <RouteResourceState status="loading" />;
  if (!features.submissionEnabled) return <FeatureUnavailablePage title={t('nav.submissions')}/>;
  return children;
}

function SquareEntry() {
  // Every Square route uses this entry so opening an overlay preserves the feed instance.
  const location = useLocation();
  const {activityKey}=useParams();
  const features=useSpaceFeatures();
  const {t}=useI18n();
  const destination = legacySubmissionDestination(location.pathname, location.search);
  if(activityKey)return <Navigate replace to={`/app/menu?panel=activities&activity=${encodeURIComponent(activityKey)}`}/>;
  if(destination)return <Navigate replace to={destination}/>;
  if(!features.ready)return <RouteResourceState status="loading"/>;
  return features.squareEnabled?<SquarePage/>:<FeatureUnavailablePage title={t('nav.square')}/>;
}

function RequireResearchFeature({children}:{children:ReactNode}) {
  const features=useSpaceFeatures();const {t}=useI18n();
  if(!features.ready)return <RouteResourceState status="loading"/>;
  return features.researchEnabled?children:<FeatureUnavailablePage title={t('research.title')}/>;
}

export default function App() {
  const location = useLocation();
  const { ready, session } = useAuth();
  const features = useSpaceFeatures();
  const birthday=useBirthday();
  const birthdayActive=Boolean(birthday.status?.active&&location.pathname.startsWith('/app/'));
  const spaceId = session?.user.space_id;
  useEffect(() => {
    for(const [key,value] of Object.entries(birthdayAssets))document.documentElement.style.setProperty(`--birthday-${key}`,`url("${value}")`);
    applySiteTheme(spaceId ? birthdayActive?'birthday-botanical':features.siteTheme : 'default');
    return () => {applySiteTheme('default');for(const key of Object.keys(birthdayAssets))document.documentElement.style.removeProperty(`--birthday-${key}`);};
  }, [spaceId, features.siteTheme,birthdayActive]);
  useEffect(() => {
    if (!spaceId) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshSpaceFeatures(spaceId).catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 180_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [spaceId]);
  const showFriendInviteOverlay = Boolean(session && location.pathname === "/friend-invite");
  const [rootChronelleReturn] = useState(() => window.location.pathname === '/app/research' && isChronelleReturn(new URL(window.location.href)));
  const isPlatformAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const isDesignLab = location.pathname.startsWith("/design/");
  const routeLocation = showFriendInviteOverlay
    ? {
        ...location,
        pathname: features.ready ? availableAppHome(features) : "/app/chats",
        search: "",
        hash: "",
        key: `${location.key}-invite-background`,
      }
    : location;

  if (rootChronelleReturn && !session) return ready ? <><ChronelleReturnFailure/><AppToast/></> : <RouteResourceState status="loading"/>;

  return (
    <ActivityOverlayProvider>
      {ready&&session&&<ChronelleBindingGate key={session.user.user_id} userId={session.user.user_id}/>}
      {ready&&session&&birthdayActive&&<BirthdayExperience/>}
      <RouteResourceBoundary>
        <Suspense fallback={<RouteResourceState status="loading" />}>
          <Routes location={routeLocation}>
        <Route path="/" element={<RootEntryRedirect />} />
        <Route path="/entry" element={<RootEntryRedirect />} />
        <Route path="/friend-invite" element={<FriendInvitePage />} />
        <Route path="/official-login" element={<OfficialLoginPage />} />
        <Route path="/account-switch" element={<AccountSwitchPage />} />
        <Route path="/pwa" element={<PwaAccountEntryPage />} />
        <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
        <Route path="/admin" element={<PlatformAdminPage />} />
        <Route path="/design/interactions" element={<InteractionPatternsPage />} />
        {import.meta.env.DEV ? <Route path="/design/voice-calls" element={<VoiceCallLabPage/>}/>:null}
        <Route path="/design/explorer" element={<ExplorerActivityLabPage />} />
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
        <Route path="/app/chats/:chatId/history" element={<RequireAuth><RequireChatFeature><HistoryManagerPage /></RequireChatFeature></RequireAuth>} />
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
          path="/app/research"
          element={<RequireAuth><RequireResearchFeature><ResearchPage /></RequireResearchFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/new"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/submissions/:chatId"
          element={<RequireAuth><RequireSubmissionFeature><ChatsPage purpose="submission" /></RequireSubmissionFeature></RequireAuth>}
        />
        <Route
          path="/app/square"
          element={
            <RequireAuth>
              <SquareEntry />
            </RequireAuth>
          }
        />
        <Route
          path="/app/square/submissions/:chatId"
          element={
            <RequireAuth>
              <RequireSubmissionFeature><SquareEntry /></RequireSubmissionFeature>
            </RequireAuth>
          }
        />
        <Route
          path="/app/square/statements/:statementId"
          element={
            <RequireAuth>
              <SquareEntry />
            </RequireAuth>
          }
        />
        <Route
          path="/app/number-duel/:roomCode"
          element={<RequireAuth><NumberDuelRoomPage /></RequireAuth>}
        />
        <Route
          path="/app/square/activities/:activityKey"
          element={
            <RequireAuth>
              <SquareEntry />
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
          path="/app/developer"
          element={<RequireAuth><DeveloperPage /></RequireAuth>}
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
      {ready && session && !isPlatformAdmin && !isDesignLab && voiceCallsEnabled ? <GlobalVoiceCalls/>:null}
      {ready && session && !isPlatformAdmin && !isDesignLab ? <GlobalMediaLocationMap /> : null}
      {ready && session && !isPlatformAdmin && !isDesignLab ? <GlobalChatLayoutDiagnostics /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <GrowthLevelCelebration /> : null}
      {ready && !isPlatformAdmin && !isDesignLab && !location.pathname.startsWith("/app/number-duel/") && !/^\/app\/chats\/\d+\/history$/.test(location.pathname) ? <AppBottomNav /> : null}
      {ready && !isPlatformAdmin && !isDesignLab ? <PwaRecommendation /> : null}
      {ready && !isPlatformAdmin && !isDesignLab && location.pathname !== "/oauth/authorize" ? <SiteMigrationNotice /> : null}
      <AppToast />
      {!isPlatformAdmin && !isDesignLab ? <FrontendUpdatePoller/> : null}
    </ActivityOverlayProvider>
  );
}
