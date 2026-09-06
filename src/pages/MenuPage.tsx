import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import barkAppIconUrl from "../assets/bark-app-icon.jpg";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ContentLoader, QuietState } from "../components/BoundaryState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CloudResourceDrawer } from "../components/CloudResourceDrawer";
import { GestureSetupPanel } from "../components/GestureLock";
import { GrowthLevelBadge } from "../components/GrowthLevelBadge";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer, drawerPathFromSearch } from "../components/SideDrawer";
import { SettingGroup, SettingRow, SettingSelect, SettingSwitch } from "../components/SettingRow";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfileCard } from "../components/UserProfileCard";
import { WelcomeMessageEditor } from "../components/WelcomeMessageEditor";
import { RarityIcon } from "../components/RarityIcon";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { ChatBackgroundUploadError, uploadChatBackground } from "../lib/chatBackgroundUpload";
import { useAuth } from "../lib/auth";
import { useAdminAuth } from "../lib/adminAuth";
import { normalizeContactTarget } from "../lib/contactTarget";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import { growthStageForLevel } from "../lib/growth-stage";
import { FeatureDiscoveryMarker, useFeatureDiscovery } from "../lib/featureDiscovery";
import { getWebReminderPreferences, mapWebReminderPreferences, setWebReminderPreferences, type WebReminderPreferences } from "../lib/webReminderPreferences";
import { getGestureLockAfterMinutes, getGestureLockScope } from "../lib/gestureLock";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { ForwardArrowIcon } from "../components/ForwardArrowIcon";
import { TabPageHeader } from "../components/TabPageHeader";
import { TravelMapDrawer } from "../components/TravelMapDrawer";
import { PwaInstallSheet } from "../components/PwaInstallSheet";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { isStandalonePwa } from "../lib/pwaInstall";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from "../lib/webPush";
import type { AppViewState, ChatBackgroundTheme, ChatBubbleStyle, GestureLockPreferenceDTO, GrowthRewardDTO, InstantNotificationEndpointDTO, InstantNotificationProvider, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences, NotificationTopicPreferenceDTO, PersonalizationDTO, SpaceDTO, SwitchAccountDTO, UserMeDTO } from "../types";
import ChatsPage, { type ChatPreviewDemoKind } from "./ChatsPage";
import { getActiveLocale, i18n, useI18n, type LanguagePreference, type TranslationKey } from "../lib/language";
import { useTheme, type ThemePreference } from "../lib/theme";

const MAX_NICKNAME_LENGTH = 8;
const EMAIL_THRESHOLD_OPTIONS = [10, 20, 30, 60, 120, 180, 360, 720, 1440];

const channelRows: Array<[NotificationChannel, number, TranslationKey]> = [
  ["email", 1, "channel.email"],
  ["sms", 2, "channel.sms"],
  ["bark", 3, "channel.instant"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, thresholdOptions: EMAIL_THRESHOLD_OPTIONS, hideMessageContent: false, openChatOnTap: true, barkIconMode: 1 },
  sms: { enabled: false, threshold: 15, thresholdOptions: [], hideMessageContent: false, openChatOnTap: true, barkIconMode: 1 },
  bark: { enabled: false, threshold: 5, thresholdOptions: [], hideMessageContent: false, openChatOnTap: true, barkIconMode: 1 },
};

function normalizeThreshold(value: number, options: number[]) {
  return options.find((option) => option >= value) ?? options[options.length - 1] ?? value;
}

function formatThreshold(minutes: number) {
  return minutes < 60
    ? i18n.t("common.minutes", { count: minutes })
    : i18n.t("common.hours", { count: minutes / 60 });
}

const barkAppStoreUrl = "https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%8E%A8%E9%80%81/id1403753865";
const menuGrowthMilestones = new Set([
  "explore:avatar",
  "explore:install_webapp",
  "explore:first_personalization",
  "explore:welcome",
  "explore:online_reminder",
  "explore:custom_background",
]);

function growthMilestoneArea(key: string): "chat" | "square" | "menu" {
  if (key.startsWith("explore:square")) return "square";
  if (menuGrowthMilestones.has(key)) return "menu";
  return "chat";
}

const personalizationOptions = {
  chat_bubble_style: [
    ["default", "menu.styleDefault"],
    ["comic", "menu.styleComic"],
    ["zen", "menu.styleZen"],
    ["hero", "menu.styleHero"],
    ["dragon", "menu.styleDragon"],
    ["bauhaus", "menu.styleBauhaus"],
    ["mosaic", "menu.styleMosaic"],
    ["typewriter", "menu.styleTypewriter"], ["newspaper", "menu.styleNewspaper"], ["receipt", "menu.styleReceipt"],
    ["niko", "menu.styleNiko"], ["fufu", "menu.styleFufu"],
    ["baxian-lv", "menu.styleBaxianLv"], ["baxian-zhongli", "menu.styleBaxianZhongli"], ["baxian-he", "menu.styleBaxianHe"],
    ["city-jdz", "menu.styleCityJingdezhen"], ["city-shanghai", "menu.styleCityShanghai"], ["city-nyc", "menu.styleCityNewYork"], ["city-beijing", "menu.styleCityBeijing"],
    ["vip", "menu.styleVip"],
  ],
  avatar_frame_style: [
    ["none", "menu.frameNone"],
    ["orbit", "menu.frameOrbit"],
    ["aurora", "menu.frameAurora"],
    ["polaroid", "menu.framePolaroid"],
    ["papercut", "menu.framePapercut"], ["mechanical", "menu.frameMechanical"], ["niko-run", "menu.frameNikoRun"], ["fufu-wave", "menu.frameFufuWave"],
    ["spider-web", "menu.frameSpiderWeb"],
  ],
} as const;

const chatBackgroundSections: Array<{ label: TranslationKey; items: Array<[Exclude<ChatBackgroundTheme, "custom">, TranslationKey]> }> = [
  {
    label: "menu.collectionEssential",
    items: [["default", "menu.themeDefault"], ["paper", "menu.themePaper"], ["mint", "menu.themeMint"]],
  },
  {
    label: "menu.collectionCulture",
    items: [["comic", "menu.themeComic"], ["bauhaus", "menu.themeBauhaus"], ["dragon", "menu.themeDragon"]],
  },
  { label: "menu.collectionMaterial", items: [["zen", "menu.themeZen"], ["mosaic", "menu.themeMosaic"], ["newsprint", "menu.themeNewsprint"]] },
  { label: "menu.collectionAtmosphere", items: [["aurora-sky", "menu.themeAuroraSky"], ["hologram", "menu.themeHologram"], ["spaceport", "menu.themeSpaceport"]] },
  { label: "menu.collectionFantasy", items: [["noir-film", "menu.themeNoirFilm"]] },
];

const chatBubbleSections: Array<{ label: TranslationKey; items: Array<typeof personalizationOptions.chat_bubble_style[number]> }> = [
  { label: "menu.collectionClassic", items: personalizationOptions.chat_bubble_style.filter(([value]) => value === "default" || value === "comic") },
  { label: "menu.collectionCulture", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["zen", "hero", "dragon", "bauhaus", "mosaic"].includes(value)) },
  { label: "menu.collectionEditorial", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["typewriter", "newspaper", "receipt", "postcard", "blueprint"].includes(value)) },
  { label: "menu.collectionPlayful", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["niko", "fufu"].includes(value)) },
  { label: "menu.collectionBaxian", items: personalizationOptions.chat_bubble_style.filter(([value]) => value.startsWith("baxian-")) },
  { label: "menu.collectionIdentity", items: personalizationOptions.chat_bubble_style.filter(([value]) => value === "vip") },
];

const avatarFrameSections: Array<{ label: TranslationKey; items: Array<typeof personalizationOptions.avatar_frame_style[number]> }> = [
  { label: "menu.collectionClassic", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["none", "polaroid"].includes(value)) },
  { label: "menu.collectionCraft", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["orbit", "papercut", "mechanical"].includes(value)) },
  { label: "menu.collectionMotion", items: personalizationOptions.avatar_frame_style.filter(([value]) => value === "aurora") },
  { label: "menu.collectionIdentity", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["niko-run", "fufu-wave", "spider-web"].includes(value)) },
];

const vipOrLevelBubbleStyles = new Set<ChatBubbleStyle>(["niko", "fufu"]);
const activityBubbleStyles = new Set<ChatBubbleStyle>(["baxian-lv", "baxian-zhongli", "baxian-he"]);
const activityAvatarFrameStyles = new Set<PersonalizationDTO["avatar_frame_style"]>(["spider-web"]);
const cityBubbleStyles = new Set<ChatBubbleStyle>(["city-jdz", "city-shanghai", "city-nyc", "city-beijing"]);
const bubbleRarityOverrides: Partial<Record<ChatBubbleStyle, GrowthRewardDTO["rarity"]>> = {
  zen: "common",
  mosaic: "common",
  newspaper: "common",
  hero: "uncommon",
  bauhaus: "uncommon",
  dragon: "rare",
  "city-jdz": "rare",
  "city-shanghai": "rare",
  "city-nyc": "rare",
  "city-beijing": "rare",
  "baxian-lv": "epic",
  "baxian-zhongli": "epic",
  "baxian-he": "epic",
};
function visibleBubbleStyle(style?: string) {
  return personalizationOptions.chat_bubble_style.some(([value]) => value === style) ? style as ChatBubbleStyle : "default";
}
function visibleAvatarFrame(style?: string) {
  return personalizationOptions.avatar_frame_style.some(([value]) => value === style) ? style as PersonalizationDTO["avatar_frame_style"] : "none";
}

type NotificationSettingsMode = "channel" | "type";
type PersonalizationOwnershipFilter = "all" | "owned" | "unowned";
type ChatPersonalizationPanel = "background" | "bubble" | null;
type ChatPersonalizationRarity = GrowthRewardDTO["rarity"] | "custom";
type PersonalizationCatalogItem = readonly [string, TranslationKey];
type PersonalizationCatalogSection = { key: string; label: string; items: PersonalizationCatalogItem[] };

const personalizationRarityOrder: GrowthRewardDTO["rarity"][] = ["common", "uncommon", "rare", "epic", "legendary"];

const chatPreviewDemoKinds: Array<{ icon: string; kind: ChatPreviewDemoKind; label: TranslationKey }> = [
  { kind: "all", icon: "dashboard", label: "menu.previewKindAll" },
  { kind: "text", icon: "notes", label: "menu.previewKindText" },
  { kind: "image", icon: "image", label: "menu.previewKindImage" },
  { kind: "video", icon: "videocam", label: "menu.previewKindVideo" },
  { kind: "gallery", icon: "photo_library", label: "menu.previewKindGallery" },
  { kind: "audio", icon: "mic", label: "menu.previewKindAudio" },
  { kind: "file", icon: "description", label: "menu.previewKindFile" },
  { kind: "location", icon: "location_on", label: "menu.previewKindLocation" },
  { kind: "map_access", icon: "map", label: "menu.previewKindTravelMap" },
  { kind: "statement", icon: "speaker_notes", label: "menu.previewKindStatement" },
  { kind: "forward_bundle", icon: "forum", label: "menu.previewKindForward" },
  { kind: "submission_invite", icon: "outbox", label: "menu.previewKindSubmissionInvite" },
  { kind: "activity", icon: "campaign", label: "menu.previewKindActivity" },
  { kind: "link", icon: "link", label: "menu.previewKindLink" },
];

function PersonalizationOwnershipSelect({
  onOwnershipChange,
  ownership,
}: {
  onOwnershipChange: (filter: PersonalizationOwnershipFilter) => void;
  ownership: PersonalizationOwnershipFilter;
}) {
  const { t } = useI18n();
  const filterRef = useRef<HTMLDetailsElement | null>(null);
  const filters: PersonalizationOwnershipFilter[] = ["all", "owned", "unowned"];
  const filterLabel = (filter: PersonalizationOwnershipFilter) => t(`menu.personalizationFilter.${filter}` as TranslationKey);
  return (
    <details className="personalization-filter-menu" ref={filterRef}>
      <summary><span>{filterLabel(ownership)}</span><span aria-hidden="true" className="material-symbols-outlined">expand_more</span></summary>
      <div role="listbox">
        {filters.map((filter) => (
          <button
            aria-selected={ownership === filter}
            key={filter}
            onClick={() => {
              onOwnershipChange(filter);
              filterRef.current?.removeAttribute("open");
            }}
            role="option"
            type="button"
          >
            <span>{filterLabel(filter)}</span>
            {ownership === filter ? <span aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>
    </details>
  );
}

function PersonalizationCatalogControls({
  onOwnershipChange,
  ownership,
}: {
  onOwnershipChange: (filter: PersonalizationOwnershipFilter) => void;
  ownership: PersonalizationOwnershipFilter;
}) {
  const { t } = useI18n();
  return (
    <div className="personalization-catalog-controls">
      <strong className="personalization-quality-label">{t("menu.personalizationGroupRarity")}</strong>
      <PersonalizationOwnershipSelect onOwnershipChange={onOwnershipChange} ownership={ownership} />
    </div>
  );
}

type PreferenceEditor = { type: "threshold"; channel: NotificationChannel };

interface MenuCacheSnapshot {
  space: SpaceDTO;
  me: UserMeDTO;
  prefs: NotificationPreferences;
  gesturePreference: GestureLockPreferenceDTO | null;
  webReminderPrefs: WebReminderPreferences;
}

function mapPrefs(rows: NotificationPreferenceDTO[]): NotificationPreferences {
  const next = { ...emptyPrefs };
  rows.forEach((row) => {
    const channel = row.channel === 1 ? "email" : row.channel === 2 ? "sms" : "bark";
    next[channel] = {
      enabled: row.enabled,
      threshold: row.offline_threshold_minutes ?? emptyPrefs[channel].threshold,
      thresholdOptions: row.offline_threshold_options ?? emptyPrefs[channel].thresholdOptions,
      hideMessageContent: row.hide_message_content,
      openChatOnTap: row.open_chat_on_tap ?? true,
      barkIconMode: row.bark_icon_mode ?? 1,
    };
  });
  return next;
}

function channelLabel(channel: NotificationChannel) {
  const key = channelRows.find(([rowChannel]) => rowChannel === channel)?.[2];
  return key ? i18n.t(key) : channel.toUpperCase();
}

function contactLabel(channel: NotificationChannel) {
  if (channel === "email") return i18n.t("contact.email");
  if (channel === "sms") return i18n.t("contact.phone");
  return i18n.t("contact.instant");
}

function channelCode(channel: NotificationChannel) {
  return channel === "email" ? 1 : channel === "sms" ? 2 : 3;
}

function channelTarget(me: UserMeDTO | null, channel: NotificationChannel) {
  if (!me) return "";
  if (channel === "email") return me.email ?? "";
  if (channel === "sms") return me.phone ?? "";
  return "";
}

function channelVerified(me: UserMeDTO | null, channel: NotificationChannel) {
  if (!me) return false;
  if (channel === "email") return Boolean(me.email_verified_at);
  if (channel === "sms") return Boolean(me.phone_verified_at);
  return false;
}

function detectDeviceFamily(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const userAgentDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || "";
  const value = `${userAgent} ${platform} ${userAgentDataPlatform}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(value) || (/macintel|macintosh/.test(value) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/.test(value)) return "android";
  return "desktop";
}

type InstantInstallLink = {
  href: string;
  labelKey: TranslationKey;
  platforms: Array<"ios" | "android" | "desktop">;
};

type InstantProviderMeta = {
  icon: string;
  name: string;
  platforms: Array<"ios" | "android" | "desktop">;
  installLinks: InstantInstallLink[];
};

const instantProviderMeta: Record<InstantNotificationProvider, InstantProviderMeta> = {
  bark: {
    icon: "notifications_active",
    name: "Bark",
    platforms: ["ios", "desktop"],
    installLinks: [{ href: barkAppStoreUrl, labelKey: "notification.installAppStore", platforms: ["ios", "desktop"] }],
  },
  ntfy: {
    icon: "campaign",
    name: "ntfy",
    platforms: ["ios", "android", "desktop"],
    installLinks: [
      { href: "https://apps.apple.com/us/app/ntfy/id1625396347", labelKey: "notification.installAppStore", platforms: ["ios", "desktop"] },
      { href: "https://play.google.com/store/apps/details?id=io.heckel.ntfy", labelKey: "notification.installGooglePlay", platforms: ["android", "desktop"] },
      { href: "https://f-droid.org/packages/io.heckel.ntfy/", labelKey: "notification.installFDroid", platforms: ["android", "desktop"] },
    ],
  },
  gotify: {
    icon: "bolt",
    name: "Gotify",
    platforms: ["android", "desktop"],
    installLinks: [
      { href: "https://f-droid.org/packages/com.github.gotify/", labelKey: "notification.installFDroid", platforms: ["android", "desktop"] },
      { href: "https://github.com/gotify/android/releases", labelKey: "notification.installGithub", platforms: ["android", "desktop"] },
    ],
  },
  pushdeer: {
    icon: "notifications_active",
    name: "PushDeer",
    platforms: ["ios", "android", "desktop"],
    installLinks: [
      { href: "https://apps.apple.com/cn/search?term=PushDeer", labelKey: "notification.installAppStore", platforms: ["ios", "desktop"] },
      { href: "https://github.com/easychen/pushdeer/releases", labelKey: "notification.installGithub", platforms: ["android", "desktop"] },
      { href: "https://github.com/easychen/pushdeer", labelKey: "notification.openSetupDocs", platforms: ["ios", "android", "desktop"] },
    ],
  },
};

function QrCodeIcon() {
  return (
    <svg aria-hidden="true" className="menu-qr-icon" fill="none" viewBox="0 0 24 24">
      <path d="M4.5 4.5h5v5h-5zM14.5 4.5h5v5h-5zM4.5 14.5h5v5h-5z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15h1.5v1.5H18V18h1.5M15 18h1.5v1.5M18 13.5V15h1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function BarkGuideIcon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bark-guide-icon${compact ? " is-compact" : ""}`} aria-hidden="true">
      <img alt="" src={barkAppIconUrl} />
    </div>
  );
}

function growthRewardIcon(reward: GrowthRewardDTO) {
  const value = `${reward.capability_key ?? ""} ${reward.id}`;
  if (/image|photo/.test(value)) return "image";
  if (/audio|voice/.test(value)) return "mic";
  if (/video/.test(value)) return "videocam";
  if (/location|map/.test(value)) return "location_on";
  if (/group/.test(value)) return "group_add";
  if (/download/.test(value)) return "download";
  if (/nickname|edit|rename/.test(value)) return "edit";
  if (/notification|online/.test(value)) return "notifications_active";
  return "lock_open";
}

function GrowthRewardVisual({ reward, me, name, uri }: {
  reward: GrowthRewardDTO;
  me: UserMeDTO | null;
  name: string;
  uri?: string;
}) {
  const asset = reward.asset_key ?? "default";
  if (reward.category === "background") {
    return <span className={`growth-reward-visual is-background chat-background-choice theme-${asset}`}><span /></span>;
  }
  if (reward.category === "bubble") {
    return <span className="growth-reward-visual is-bubble field-chat_bubble_style"><span className={`personalization-option preview-${asset}`}><i aria-hidden="true"><span /></i></span></span>;
  }
  if (reward.category === "frame") {
    return (
      <span className="growth-reward-visual is-frame">
        <UserAvatar className="growth-reward-avatar" frame={asset as PersonalizationDTO["avatar_frame_style"]} name={name} uri={uri} />
      </span>
    );
  }
  return (
    <span className="growth-reward-visual is-capability">
      <span className="material-symbols-outlined">{growthRewardIcon(reward)}</span>
    </span>
  );
}

export default function MenuPage() {
  const { t, preference: languagePreference, setPreference: setLanguagePreference, saving: languageSaving } = useI18n();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, patchSessionUser } = useAuth();
  const spaceFeatures = useSpaceFeatures();
  const { setSession: setAdminSession } = useAdminAuth();
  const { discover: discoverFeature, feature: discoveryFeature } = useFeatureDiscovery();
  const currentUserId = session?.user.user_id;
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [me, setMe] = useState<UserMeDTO | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(emptyPrefs);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [basicDrawerOpen, setBasicDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [switchAccounts, setSwitchAccounts] = useState<SwitchAccountDTO[]>([]);
  const [accountSwitcherLoading, setAccountSwitcherLoading] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState<number | null>(null);
  const [privateAccountSaving, setPrivateAccountSaving] = useState(false);
  const [adminDashboardOpening, setAdminDashboardOpening] = useState(false);
  const [unbindChannel, setUnbindChannel] = useState<NotificationChannel | null>(null);
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [unbindVerifyOpen, setUnbindVerifyOpen] = useState(false);
  const [unbindCode, setUnbindCode] = useState("");
  const [unbindState, setUnbindState] = useState<"idle" | "sending" | "removing">("idle");
  const [unbindCooldown, setUnbindCooldown] = useState(0);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [gestureSheetOpen, setGestureSheetOpen] = useState(false);
  const [gesturePreference, setGesturePreference] = useState<GestureLockPreferenceDTO | null>(null);
  const [channelsDrawerOpen, setChannelsDrawerOpen] = useState(false);
  const [notificationSettingsMode, setNotificationSettingsMode] = useState<NotificationSettingsMode>("channel");
  const [notificationTopics, setNotificationTopics] = useState<NotificationTopicPreferenceDTO[]>([]);
  const [notificationTopicsSaving, setNotificationTopicsSaving] = useState(false);
  const [instantEndpoints, setInstantEndpoints] = useState<InstantNotificationEndpointDTO[]>([]);
  const [instantProviderDrawer, setInstantProviderDrawer] = useState<InstantNotificationProvider | null>(null);
  const [instantTarget, setInstantTarget] = useState("");
  const [instantSecret, setInstantSecret] = useState("");
  const [instantVerificationId, setInstantVerificationId] = useState<number | null>(null);
  const [instantCode, setInstantCode] = useState("");
  const [instantSaving, setInstantSaving] = useState(false);
  const [webReminderDrawerOpen, setWebReminderDrawerOpen] = useState(false);
  const [webReminderPrefs, setWebReminderPrefs] = useState<WebReminderPreferences>(() => getWebReminderPreferences());
  const [webPushState, setWebPushState] = useState<WebPushState>("checking");
  const [webPushSaving, setWebPushSaving] = useState(false);
  const [pwaInstallSheetOpen, setPwaInstallSheetOpen] = useState(false);
  const [travelMapOpen, setTravelMapOpen] = useState(false);
  const [cloudResourcesOpen, setCloudResourcesOpen] = useState(false);
  const [growthDrawerOpen, setGrowthDrawerOpen] = useState(false);
  const [growthLevelsOpen, setGrowthLevelsOpen] = useState(false);
  const [activeGrowthGuideLevel, setActiveGrowthGuideLevel] = useState(1);
  const [chatPageDrawerOpen, setChatPageDrawerOpen] = useState(false);
  const [chatPersonalizationPanel, setChatPersonalizationPanel] = useState<ChatPersonalizationPanel>(null);
  const [chatPreviewDemoOpen, setChatPreviewDemoOpen] = useState(false);
  const [chatPreviewDemoKind, setChatPreviewDemoKind] = useState<ChatPreviewDemoKind>("text");
  const [chatBackgroundRarity, setChatBackgroundRarity] = useState<ChatPersonalizationRarity>("common");
  const [chatBubbleRarity, setChatBubbleRarity] = useState<ChatPersonalizationRarity>("common");
  const [avatarFrameDrawerOpen, setAvatarFrameDrawerOpen] = useState(false);
  const [profileCardDrawerOpen, setProfileCardDrawerOpen] = useState(false);
  const [personalizationDrawerOpen, setPersonalizationDrawerOpen] = useState(false);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);
  const [chatBackgroundSaving, setChatBackgroundSaving] = useState(false);
  const [chatBackgroundDraft, setChatBackgroundDraft] = useState<ChatBackgroundTheme>("default");
  const [personalizationOwnershipFilter, setPersonalizationOwnershipFilter] = useState<PersonalizationOwnershipFilter>("all");
  const [personalizationDraft, setPersonalizationDraft] = useState<PersonalizationDTO>({
    chat_bubble_style: "default",
    avatar_frame_style: "none",
    show_self_avatar: false,
    profile_card_theme: "default",
  });
  const [barkGuideOpen, setBarkGuideOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);
  const [passwordReminderDescription, setPasswordReminderDescription] = useState(() => t("menu.passwordReminder"));
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [accountDeleteStep, setAccountDeleteStep] = useState<"intro" | "verify" | "final" | null>(null);
  const [accountDeleteInput, setAccountDeleteInput] = useState("");
  const [accountDeleteSaving, setAccountDeleteSaving] = useState(false);
  const [prefDrawerChannel, setPrefDrawerChannel] = useState<NotificationChannel | null>(null);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefEditor, setPrefEditor] = useState<PreferenceEditor | null>(null);
  const [prefEditorValue, setPrefEditorValue] = useState("");
  const [prefEditorSaving, setPrefEditorSaving] = useState(false);
  const [authSheetChannel, setAuthSheetChannel] = useState<NotificationChannel | null>(null);
  const [basicEditField, setBasicEditField] = useState<"name" | null>(null);
  const [welcomeEditorOpen, setWelcomeEditorOpen] = useState(false);
  const [basicEditValue, setBasicEditValue] = useState("");
  const [authTarget, setAuthTarget] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authActionState, setAuthActionState] = useState<"idle" | "sending" | "binding">("idle");
  const [authCooldown, setAuthCooldown] = useState(0);
  const [authExpiresIn, setAuthExpiresIn] = useState(0);
  const [basicEditSaving, setBasicEditSaving] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [friendInviteLink, setFriendInviteLink] = useState("");
  const [friendInviteQrUri, setFriendInviteQrUri] = useState("");
  const [friendInviteLoading, setFriendInviteLoading] = useState(false);
  const [friendInviteExpire, setFriendInviteExpire] = useState<number | null>(null);
  const [friendInviteMode, setFriendInviteMode] = useState<"limited" | "permanent">("limited");
  const authVerifyRef = useRef<HTMLDivElement | null>(null);
  const authSheetBodyRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBackgroundFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBackgroundTrackRef = useRef<HTMLDivElement | null>(null);
  const chatBubbleTrackRef = useRef<HTMLDivElement | null>(null);
  const pwaGrowthClaimedRef = useRef(false);
  const growthLevelTrackRef = useRef<HTMLDivElement | null>(null);
  const accountSwitcherRouteHandledRef = useRef(false);
  const cacheScope = buildTabCacheScope(session?.user.space_id, currentUserId);
  const hasPassword = Boolean(me?.has_password ?? session?.user.has_password);
  const hasGrowthCapability = (key: string, fallbackLevel: number) =>
    me?.growth?.capabilities?.[key]?.available ?? (me?.growth?.level ?? 1) >= fallbackLevel;
  const canUploadCustomAvatar = hasGrowthCapability("menu.profile.avatar.custom", 4);
  const canRenameNickname = hasGrowthCapability("menu.profile.nickname", 5);
  const canEditWelcome = hasGrowthCapability("menu.profile.welcome", 6);
  const discoverThen = (rewardId: string, action: () => void) => {
    if (discoveryFeature(rewardId)?.is_new) void discoverFeature(rewardId);
    action();
  };
  const growthLevel = me?.growth?.level ?? 1;
  const permanentVip = Boolean(me?.is_permanent_vip ?? session?.user.is_permanent_vip);
  const ownsInventoryResource = (
    resourceType: "background" | "bubble" | "frame" | "vip" | "profile",
    resourceKey: string,
  ) => me?.resource_inventory?.some(
    (item) => item.resource_type === resourceType && item.resource_key === resourceKey,
  ) ?? false;
  const rewardFor = (category: "background" | "bubble" | "frame", assetKey: string) =>
    me?.growth?.levels?.flatMap((item) => item.rewards ?? []).find((reward) => reward.category === category && reward.asset_key === assetKey);
  const rewardLevel = (category: "background" | "bubble" | "frame", assetKey: string) =>
    rewardFor(category, assetKey)?.level ?? 1;
  const rewardRarity = (category: "background" | "bubble" | "frame", assetKey: string): GrowthRewardDTO["rarity"] => {
    if (category === "bubble") {
      const override = bubbleRarityOverrides[assetKey as ChatBubbleStyle];
      if (override) return override;
    }
    if (category === "frame" && activityAvatarFrameStyles.has(assetKey as PersonalizationDTO["avatar_frame_style"])) {
      return "epic";
    }
    return assetKey === "vip"
      ? (category === "frame" ? "rare" : "epic")
      : rewardFor(category, assetKey)?.rarity ?? "common";
  };
  const currentLevelStage = growthStageForLevel(growthLevel);
  const canCustomizeChatBackground = hasGrowthCapability("menu.personalization.background.use.custom", 8);
  const canUseBackgroundStyle = (theme: ChatBackgroundTheme) => ownsInventoryResource(
    "background",
    theme,
  );
  const canUseBubbleStyle = (style: ChatBubbleStyle) =>
    cityBubbleStyles.has(style)
      ? Boolean(me?.city_bubble_styles?.includes(style))
      : ownsInventoryResource(
        "bubble",
        style,
      );
  const canUseAvatarFrame = (frame: PersonalizationDTO["avatar_frame_style"]) =>
    ownsInventoryResource(
      "frame",
      frame,
    );
  const buildPersonalizationSections = (
    items: readonly PersonalizationCatalogItem[],
    category: "background" | "bubble" | "frame",
    isOwned: (assetKey: string) => boolean,
  ): PersonalizationCatalogSection[] => {
    const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"] as const;
    const filtered = items.filter(([assetKey]) => {
      const owned = isOwned(assetKey);
      return personalizationOwnershipFilter === "all" || (personalizationOwnershipFilter === "owned" ? owned : !owned);
    });
    const groups = new Map<string, PersonalizationCatalogItem[]>();
    filtered.forEach((item) => {
      const [assetKey] = item;
      const key = rewardRarity(category, assetKey);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    const keys = [...groups.keys()].sort((left, right) => rarityOrder.indexOf(left as typeof rarityOrder[number]) - rarityOrder.indexOf(right as typeof rarityOrder[number]));
    return keys.map((key) => ({
      key,
      label: t(`growth.rarity.${key}` as TranslationKey),
      items: groups.get(key) ?? [],
    }));
  };
  const backgroundCatalog = chatBackgroundSections.flatMap((section) => section.items);
  const bubbleCatalog = personalizationOptions.chat_bubble_style;
  const backgroundRarityTabs = personalizationRarityOrder.filter((rarity) =>
    backgroundCatalog.some(([assetKey]) => rewardRarity("background", assetKey) === rarity),
  );
  const bubbleRarityTabs = personalizationRarityOrder.filter((rarity) =>
    bubbleCatalog.some(([assetKey]) => rewardRarity("bubble", assetKey) === rarity),
  );
  const visibleBackgroundCatalog = chatBackgroundRarity === "custom"
    ? []
    : backgroundCatalog.filter(([assetKey]) => rewardRarity("background", assetKey) === chatBackgroundRarity);
  const visibleBubbleCatalog = bubbleCatalog.filter(([assetKey]) => rewardRarity("bubble", assetKey) === chatBubbleRarity);
  const backgroundStageKey = chatBackgroundRarity === "custom"
    ? "custom"
    : visibleBackgroundCatalog.some(([assetKey]) => assetKey === chatBackgroundDraft)
      ? chatBackgroundDraft
      : visibleBackgroundCatalog[0]?.[0];
  const bubbleStageKey = visibleBubbleCatalog.some(([assetKey]) => assetKey === personalizationDraft.chat_bubble_style)
    ? personalizationDraft.chat_bubble_style
    : visibleBubbleCatalog[0]?.[0];
  const bubbleUnlockLabel = (style: ChatBubbleStyle) => {
    if (style === "vip") return t("menu.permanentVipOnly");
    if (activityBubbleStyles.has(style)) return t("menu.activityUnlock");
    if (cityBubbleStyles.has(style)) return t("menu.cityBubbleUnlock");
    if (vipOrLevelBubbleStyles.has(style)) return t("menu.levelOrVipUnlock", { level: rewardLevel("bubble", style) });
    return t("menu.levelUnlock", { level: rewardLevel("bubble", style) });
  };
  const gestureScope = useMemo(() => getGestureLockScope(session), [session]);
  const emailVerified = Boolean(me ? me.email_verified_at : session?.user.email_verified_at);
  const phoneVerified = Boolean(me ? me.phone_verified_at : session?.user.phone_verified_at);
  const deviceFamily = useMemo(() => detectDeviceFamily(), []);
  const visibleInstantProviders = useMemo(
    () => (Object.keys(instantProviderMeta) as InstantNotificationProvider[]).filter(
      (provider) => instantProviderMeta[provider].platforms.includes(deviceFamily),
    ),
    [deviceFamily],
  );
  const visibleChannelRows = channelRows;
  const barkBound = instantEndpoints.some((endpoint) => endpoint.provider === "bark");
  const standalonePwa = isStandalonePwa();
  const webReminderSummary = [
    webReminderPrefs.soundEnabled ? t("webReminder.soundOn") : t("webReminder.soundOff"),
    webReminderPrefs.titleEnabled ? t("webReminder.titleOn") : t("webReminder.titleOff"),
  ].join(" · ");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };
    setIsDesktopViewport(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!standalonePwa || !me || pwaGrowthClaimedRef.current) return;
    pwaGrowthClaimedRef.current = true;
    void api.claimGrowthEvent("install_webapp").then(({ growth, resource_inventory }) => {
      setMe((current) => current ? { ...current, growth, resource_inventory } : current);
    }).catch(() => {
      pwaGrowthClaimedRef.current = false;
    });
  }, [me?.user_id, standalonePwa]);

  const showPasswordReminder = (description = t("menu.passwordReminder")) => {
    setPasswordReminderDescription(description);
    setPasswordReminderOpen(true);
  };

  const openAccountSwitcher = async () => {
    setAccountSwitcherOpen(true);
    setAccountSwitcherLoading(true);
    try {
      setSwitchAccounts(await api.getSwitchAccounts());
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("account.listLoadFailed"), "error");
    } finally {
      setAccountSwitcherLoading(false);
    }
  };

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("switch-account") === "1";
    if (!requested) {
      accountSwitcherRouteHandledRef.current = false;
      return;
    }
    if (accountSwitcherRouteHandledRef.current) return;
    accountSwitcherRouteHandledRef.current = true;
    navigate(location.pathname, { replace: true });
    void openAccountSwitcher();
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("personalization") === "chat-bubble") {
      navigate(`${location.pathname}?panel=personalization/chat-page&section=bubbles`, { replace: true });
      return;
    }
    if (params.get("section") === "bubbles" && drawerPathFromSearch(location.search).includes("chat-page")) {
      setChatPersonalizationPanel("bubble");
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!chatPageDrawerOpen || !me) return;
    const currentBackground = me.chat_background_theme ?? "default";
    const currentBubble = visibleBubbleStyle(me.chat_bubble_style);
    setChatBackgroundDraft(currentBackground);
    setChatBackgroundRarity(currentBackground === "custom" ? "custom" : rewardRarity("background", currentBackground));
    setChatBubbleRarity(rewardRarity("bubble", currentBubble));
    setPersonalizationDraft({
      chat_bubble_style: currentBubble,
      avatar_frame_style: visibleAvatarFrame(me.avatar_frame_style),
      show_self_avatar: Boolean(me.show_self_avatar),
      profile_card_theme: me.profile_card_theme ?? "default",
    });
  }, [chatPageDrawerOpen, me?.chat_background_theme, me?.chat_bubble_style, me?.avatar_frame_style, me?.show_self_avatar]);

  useEffect(() => {
    if (!(avatarFrameDrawerOpen || profileCardDrawerOpen) || !me) return;
    setPersonalizationDraft({
      chat_bubble_style: me.chat_bubble_style ?? "default",
      avatar_frame_style: visibleAvatarFrame(me.avatar_frame_style),
      show_self_avatar: Boolean(me.show_self_avatar),
      profile_card_theme: me.profile_card_theme ?? "default",
    });
  }, [
    avatarFrameDrawerOpen,
    profileCardDrawerOpen,
    me?.avatar_frame_style,
    me?.chat_bubble_style,
    me?.show_self_avatar,
  ]);

  useEffect(() => {
    if (!chatPersonalizationPanel) return;
    const track = chatPersonalizationPanel === "background" ? chatBackgroundTrackRef.current : chatBubbleTrackRef.current;
    const frame = window.requestAnimationFrame(() => {
      track?.querySelector<HTMLElement>(".is-stage-focus")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    backgroundStageKey,
    bubbleStageKey,
    chatBackgroundRarity,
    chatBubbleRarity,
    chatPersonalizationPanel,
  ]);

  const switchAccount = async (account: SwitchAccountDTO) => {
    setSwitchingUserId(account.user.user_id);
    try {
      const payload = await api.createAccountSwitchTicket(account.user.user_id);
      window.location.assign(
        buildSpaceHrefForCurrentHost(
          payload.space.slug,
          "/account-switch",
          "",
          `ticket=${encodeURIComponent(payload.token)}`
        )
      );
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("account.switchFailed"), "error");
      setSwitchingUserId(null);
    }
  };

  const openAdminDashboard = async () => {
    if (adminDashboardOpening) return;
    setAdminDashboardOpening(true);
    try {
      const payload = await api.createAdminSessionFromOfficialAccount();
      setAdminSession({
        accessToken: payload.auth.auth,
        space: payload.space,
      });
      navigate("/space/dashboard");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("admin.openDashboardFailed"), "error");
      setAdminDashboardOpening(false);
    }
  };

  const togglePrivateAccount = async () => {
    if (!me || privateAccountSaving) return;
    if (!phoneVerified) {
      showToast(t("account.bindPhoneFirst"), "error");
      return;
    }
    setPrivateAccountSaving(true);
    try {
      const updated = await api.updatePrivateAccount(!me.is_private_account);
      setMe(updated);
      patchSessionUser({ is_private_account: updated.is_private_account });
      showToast(updated.is_private_account ? t("account.privateEnabled") : t("account.discoverableEnabled"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("common.settingFailed"), "error");
    } finally {
      setPrivateAccountSaving(false);
    }
  };

  const contactValue = (channel: NotificationChannel) => {
    if (channel === "email") return me?.email ?? "";
    if (channel === "sms") return me?.phone ?? "";
    return "";
  };

  const contactUnboundAt = (channel: NotificationChannel) => {
    if (channel === "email") return me?.email_unbound_at ?? null;
    if (channel === "sms") return me?.phone_unbound_at ?? null;
    return null;
  };

  const contactUnbindAvailableAt = (channel: NotificationChannel) => {
    const last = contactUnboundAt(channel);
    if (!last || channel === "bark") return null;
    return last * 1000 + (channel === "email" ? 30 : 365) * 24 * 60 * 60 * 1000;
  };

  const formatContactDate = (timestamp: number | null) => {
    if (!timestamp) return t("contact.neverUnbound");
    return new Intl.DateTimeFormat(getActiveLocale(), { year: "numeric", month: "short", day: "numeric" }).format(timestamp * 1000);
  };

  const openUnbindConfirm = (channel: NotificationChannel) => {
    setUnbindChannel(channel);
    setUnbindCode("");
    setUnbindConfirmOpen(true);
  };

  const applyUnboundUser = (updated: UserMeDTO, channel: NotificationChannel) => {
    setMe(updated);
    patchSessionUser({
      verified: updated.verified,
      email: updated.email,
      phone: updated.phone,
      email_verified_at: updated.email_verified_at,
      phone_verified_at: updated.phone_verified_at,
      email_unbound_at: updated.email_unbound_at,
      phone_unbound_at: updated.phone_unbound_at,
      is_private_account: updated.is_private_account,
    });
    setPrefs((current) => ({ ...current, [channel]: { ...current[channel], enabled: false } }));
    setPrefDrawerChannel(null);
    setUnbindConfirmOpen(false);
    setUnbindVerifyOpen(false);
    setUnbindChannel(null);
    showToast(t("contact.unbound", { channel: contactLabel(channel) }));
  };

  const confirmUnbind = async () => {
    if (!unbindChannel) return;
    if (unbindChannel !== "bark") {
      setUnbindConfirmOpen(false);
      setUnbindVerifyOpen(true);
      return;
    }
    setUnbindState("removing");
    try {
      applyUnboundUser(await api.unbindContact({ channel: channelCode(unbindChannel) }), unbindChannel);
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("contact.unbindFailed"), "error");
    } finally {
      setUnbindState("idle");
    }
  };

  const sendUnbindCode = async () => {
    if (!unbindChannel || unbindChannel === "bark") return;
    setUnbindState("sending");
    try {
      await api.sendContactCode({ channel: channelCode(unbindChannel), target: contactValue(unbindChannel) });
      setUnbindCooldown(60);
      showToast(unbindChannel === "email" ? t("auth.codeSentEmail") : unbindChannel === "sms" ? t("auth.codeSentPhone") : t("auth.codeSent"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("auth.codeSendFailed"), "error");
    } finally {
      setUnbindState("idle");
    }
  };

  const submitUnbind = async () => {
    if (!unbindChannel || !unbindCode.trim()) return;
    setUnbindState("removing");
    try {
      applyUnboundUser(
        await api.unbindContact({ channel: channelCode(unbindChannel), code: unbindCode.trim() }),
        unbindChannel
      );
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("contact.unbindFailed"), "error");
    } finally {
      setUnbindState("idle");
    }
  };

  const gestureEnabled = Boolean(gesturePreference?.enabled && gesturePreference.pattern_hash && gesturePreference.salt);
  const gestureLockAfterMinutes = getGestureLockAfterMinutes(gesturePreference);

  const updateWebReminderPrefs = async (patch: Partial<WebReminderPreferences>) => {
    const previous = webReminderPrefs;
    const next = {
      ...webReminderPrefs,
      ...patch,
    };
    setWebReminderPrefs(next);
    setWebReminderPreferences(next);
    try {
      const updated = await api.updateWebReminderPrefs({
        sound_enabled: next.soundEnabled ? 1 : 0,
        title_enabled: next.titleEnabled ? 1 : 0,
      });
      const saved = mapWebReminderPreferences(updated);
      setWebReminderPrefs(saved);
      setWebReminderPreferences(saved);
    } catch (apiError) {
      setWebReminderPrefs(previous);
      setWebReminderPreferences(previous);
      setError(apiError instanceof ApiError ? apiError.message : t("webReminder.saveFailed"));
    }
  };

  const openWebReminderDrawer = () => {
    setWebReminderDrawerOpen(true);
  };

  useEffect(() => {
    if (!webReminderDrawerOpen) return;
    let active = true;
    setWebPushState("checking");
    void getWebPushState()
      .then((state) => {
        if (active) setWebPushState(state);
      })
      .catch(() => {
        if (active) setWebPushState("off");
      });
    return () => {
      active = false;
    };
  }, [webReminderDrawerOpen]);

  const toggleWebPush = async () => {
    if (webPushSaving || webPushState === "checking") return;
    setWebPushSaving(true);
    try {
      if (webPushState === "on") {
        await disableWebPush();
      } else {
        await enableWebPush();
      }
      setWebPushState(await getWebPushState());
    } catch (pushError) {
      setWebPushState(await getWebPushState().catch((): WebPushState => "off"));
      setError(pushError instanceof Error ? pushError.message : t("webPush.settingFailed"));
    } finally {
      setWebPushSaving(false);
    }
  };

  const webPushDescription: string | null = {
    checking: t("common.checking"),
    unsupported: t("webPush.browserUnsupported"),
    "needs-install": t("webPush.addToHomeFirst"),
    denied: t("webPush.allowInSettings"),
    off: null,
    on: null,
  }[webPushState];

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    const cached = readTabCache<MenuCacheSnapshot>(cacheScope, "menu");
    if (cached) {
      setSpace(cached.data.space);
      setMe(cached.data.me);
      setPrefs(cached.data.prefs);
      setGesturePreference(cached.data.gesturePreference);
      setWebReminderPrefs(cached.data.webReminderPrefs);
      setWebReminderPreferences(cached.data.webReminderPrefs);
      setViewState("ready");
    } else {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    Promise.all([
      api.getSpaceMe(controller.signal),
      api.getUserMe(controller.signal),
      api.getWebReminderPrefs(controller.signal).catch(() => null),
      api.getGestureLockPrefs(controller.signal).catch(() => null),
    ])
      .then(async ([spaceInfo, meInfo, webReminderInfo, gestureInfo]) => {
        const [prefRows, endpointRows] = meInfo.has_password
          ? await Promise.all([
              api.getNotificationPrefs(controller.signal),
              api.getInstantNotificationEndpoints(controller.signal),
            ])
          : [[], []];
        const nextWebReminderPrefs = webReminderInfo ? mapWebReminderPreferences(webReminderInfo) : getWebReminderPreferences();
        setSpace(spaceInfo);
        setMe(meInfo);
        setPrefs(mapPrefs(prefRows));
        setInstantEndpoints(endpointRows);
        setGesturePreference(gestureInfo);
        setWebReminderPrefs(nextWebReminderPrefs);
        setWebReminderPreferences(nextWebReminderPrefs);
        writeTabCache(cacheScope, "menu", {
          space: spaceInfo,
          me: meInfo,
          prefs: mapPrefs(prefRows),
          gesturePreference: gestureInfo,
          webReminderPrefs: nextWebReminderPrefs,
        });
        patchSessionUser({
          has_password: meInfo.has_password,
          verified: meInfo.verified,
          avatar_type: meInfo.avatar_type,
          avatar_uri: meInfo.avatar_uri,
          welcome_message: meInfo.welcome_message,
          email: meInfo.email,
          phone: meInfo.phone,
          email_verified_at: meInfo.email_verified_at,
          phone_verified_at: meInfo.phone_verified_at,
          email_unbound_at: meInfo.email_unbound_at,
          phone_unbound_at: meInfo.phone_unbound_at,
          is_private_account: meInfo.is_private_account,
          language: meInfo.language,
          last_heartbeat: meInfo.last_heartbeat,
        });
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached) {
          const message = apiError instanceof ApiError ? apiError.message : t("menu.loadFailed");
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope, currentUserId]);

  useEffect(() => {
    if (viewState !== "ready" || !space || !me) return;
    writeTabCache(cacheScope, "menu", { space, me, prefs, gesturePreference, webReminderPrefs });
  }, [cacheScope, gesturePreference, me, prefs, space, viewState, webReminderPrefs]);

  useEffect(() => {
    const drawer = new URLSearchParams(location.search).get("drawer");
    if (drawer === "security") {
      navigate(`${location.pathname}?panel=account-security`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const path = drawerPathFromSearch(location.search);
    const channelSegment = path.find((item) => item.startsWith("notification-channel-"));
    const providerSegment = path.find((item) => item.startsWith("instant-provider-"));
    const channel = channelSegment?.replace("notification-channel-", "") as NotificationChannel | undefined;
    const provider = providerSegment?.replace("instant-provider-", "") as InstantNotificationProvider | undefined;
    if (channel && channelRows.some(([value]) => value === channel)) setPrefDrawerChannel(channel);
    if (provider && Object.prototype.hasOwnProperty.call(instantProviderMeta, provider)) setInstantProviderDrawer(provider);
  }, [location.search]);

  useEffect(() => {
    const sheet = new URLSearchParams(location.search).get("sheet");
    if (sheet !== "email-verification" || authSheetChannel === "email") return;
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    setAuthSheetChannel("email");
    setAuthTarget(channelTarget(me, "email"));
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
  }, [authSheetChannel, hasPassword, location.search, me]);

  useEffect(() => {
    if (!authSheetChannel) return;
    if (authCooldown <= 0 && authExpiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setAuthCooldown((current) => Math.max(0, current - 1));
      setAuthExpiresIn((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authCooldown, authExpiresIn, authSheetChannel]);

  useEffect(() => {
    if (unbindCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setUnbindCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [unbindCooldown]);

  useEffect(() => {
    if (!authSheetChannel || !authPending) return;
    requestAnimationFrame(() => {
      const body = authSheetBodyRef.current;
      if (body) {
        body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      } else {
        authVerifyRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  }, [authPending, authSheetChannel]);

  useEffect(() => {
    if (!inviteDrawerOpen || !space?.slug) return;
    let cancelled = false;
    setFriendInviteLoading(true);
    setFriendInviteLink("");
    setFriendInviteQrUri("");
    setFriendInviteExpire(null);

    api
      .createFriendInviteToken(friendInviteMode === "permanent")
      .then(async (payload) => {
        if (cancelled) return;
        const link = buildSpaceHrefForCurrentHost(space.slug, "/friend-invite", "", `token=${encodeURIComponent(payload.token)}`);
        const qrUri = await QRCode.toDataURL(link, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 520,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });
        if (cancelled) return;
        setFriendInviteLink(link);
        setFriendInviteQrUri(qrUri);
        setFriendInviteExpire(payload.expire);
      })
      .catch((apiError) => {
        if (cancelled) return;
        setError(apiError instanceof ApiError ? apiError.message : t("invite.generateFailed"));
        setInviteDrawerOpen(false);
      })
      .finally(() => {
        if (cancelled) return;
        setFriendInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [friendInviteMode, inviteDrawerOpen, space?.slug]);

  const openAuthSheet = (channel: NotificationChannel) => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    if (channel === "bark") {
      setBarkGuideOpen(true);
      setAuthSheetChannel("bark");
      setAuthTarget(channelTarget(me, "bark"));
      setAuthCode("");
      setAuthPending(false);
      setAuthCooldown(0);
      setAuthExpiresIn(0);
      return;
    }
    setAuthSheetChannel(channel);
    setAuthTarget(channelTarget(me, channel));
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
  };

  const closeAuthSheet = () => {
    setBarkGuideOpen(false);
    setAuthSheetChannel(null);
    setAuthTarget("");
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
    setAuthActionState("idle");
    if (new URLSearchParams(location.search).get("sheet") === "email-verification") {
      const routeState = location.state as { emailVerificationReturnTo?: string } | null;
      navigate(routeState?.emailVerificationReturnTo || "/app/menu", { replace: true });
    }
  };

  const closeBarkGuide = () => {
    if (authActionState !== "idle") return;
    setBarkGuideOpen(false);
    closeAuthSheet();
  };

  const openBarkGuide = () => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    const current = instantEndpoints.find((item) => item.provider === "bark");
    setInstantProviderDrawer("bark");
    setInstantTarget(current?.target ?? "");
    setInstantSecret("");
    setInstantVerificationId(null);
    setInstantCode("");
  };

  const closePrefDrawers = () => {
    setPrefDrawerChannel(null);
    setPrefSaving(false);
    setPrefEditor(null);
  };

  const openPrefDrawer = (channel: NotificationChannel) => {
    setPrefDrawerChannel(channel);
  };

  const openInstantProvider = (provider: InstantNotificationProvider) => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    const current = instantEndpoints.find((item) => item.provider === provider);
    setInstantProviderDrawer(provider);
    setInstantTarget(current?.target ?? "");
    setInstantSecret("");
    setInstantVerificationId(null);
    setInstantCode("");
  };

  const sendInstantCode = async () => {
    if (!instantProviderDrawer || !instantTarget.trim()) return;
    setInstantSaving(true);
    try {
      const result = await api.sendInstantNotificationCode({
        provider: instantProviderDrawer,
        target: instantTarget.trim(),
        secret: instantSecret.trim() || undefined,
      });
      setInstantVerificationId(result.verification_id);
      setInstantCode("");
      showToast(t("notification.instantCodeSent"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("notification.instantBindFailed"), "error");
    } finally {
      setInstantSaving(false);
    }
  };

  const bindInstantEndpoint = async () => {
    if (!instantVerificationId || instantCode.length !== 6) return;
    setInstantSaving(true);
    try {
      const endpoint = await api.bindInstantNotificationEndpoint({
        verification_id: instantVerificationId,
        code: instantCode,
      });
      setInstantEndpoints((current) => [...current.filter((item) => item.provider !== endpoint.provider), endpoint]);
      setPrefs((current) => ({ ...current, bark: { ...current.bark, enabled: true } }));
      setInstantProviderDrawer(null);
      showToast(t("notification.instantBound", { provider: instantProviderMeta[endpoint.provider].name }));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("notification.instantBindFailed"), "error");
    } finally {
      setInstantSaving(false);
    }
  };

  const toggleInstantEndpoint = async (endpoint: InstantNotificationEndpointDTO) => {
    setInstantSaving(true);
    try {
      const updated = await api.updateInstantNotificationEndpoint(endpoint.endpoint_id, !endpoint.enabled);
      setInstantEndpoints((current) => current.map((item) => item.endpoint_id === updated.endpoint_id ? updated : item));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("notification.updateFailed"), "error");
    } finally {
      setInstantSaving(false);
    }
  };

  const removeInstantEndpoint = async (endpoint: InstantNotificationEndpointDTO) => {
    setInstantSaving(true);
    try {
      await api.deleteInstantNotificationEndpoint(endpoint.endpoint_id);
      setInstantEndpoints((current) => current.filter((item) => item.endpoint_id !== endpoint.endpoint_id));
      setInstantProviderDrawer(null);
      showToast(t("notification.instantRemoved"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("contact.unbindFailed"), "error");
    } finally {
      setInstantSaving(false);
    }
  };

  const preferenceFromResponse = (updated: NotificationPreferenceDTO): NotificationPreferences[NotificationChannel] => {
    const channel = updated.channel === 1 ? "email" : updated.channel === 2 ? "sms" : "bark";
    return {
      enabled: updated.enabled,
      threshold: updated.offline_threshold_minutes ?? emptyPrefs[channel].threshold,
      thresholdOptions: updated.offline_threshold_options ?? emptyPrefs[channel].thresholdOptions,
      hideMessageContent: updated.hide_message_content,
      openChatOnTap: updated.open_chat_on_tap ?? true,
      barkIconMode: updated.bark_icon_mode ?? 1,
    };
  };

  const savePreferencePatch = async (
    channel: NotificationChannel,
    patch: Omit<Parameters<typeof api.updateNotificationPref>[0], "channel">
  ) => {
    setPrefSaving(true);
    setError(null);
    try {
      const updated = await api.updateNotificationPref({ ...patch, channel: channelCode(channel) });
      setPrefs((current) => ({ ...current, [channel]: preferenceFromResponse(updated) }));
      return true;
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("notification.updateFailed"));
      return false;
    } finally {
      setPrefSaving(false);
    }
  };

  const openThresholdEditor = (channel: NotificationChannel) => {
    const options = prefs[channel].thresholdOptions;
    setPrefEditor({ type: "threshold", channel });
    setPrefEditorValue(String(normalizeThreshold(prefs[channel].threshold, options)));
  };

  const savePreferenceEditor = async () => {
    if (!prefEditor || prefEditorSaving) return;
    const options = prefs[prefEditor.channel].thresholdOptions;
    const threshold = Number(prefEditorValue);
    if (!options.includes(threshold)) return;
    setPrefEditorSaving(true);
    const patch = { offline_threshold_minutes: threshold };
    const saved = await savePreferencePatch(prefEditor.channel, patch);
    if (saved) setPrefEditor(null);
    setPrefEditorSaving(false);
  };

  const sendAuthCode = async () => {
    if (!authSheetChannel) return;
    try {
      setAuthActionState("sending");
      const normalizedTarget = normalizeContactTarget(authSheetChannel, authTarget);
      setAuthTarget(normalizedTarget);
      const payload = await api.sendContactCode({ channel: channelCode(authSheetChannel), target: normalizedTarget });
      setAuthPending(true);
      setAuthCooldown(60);
      setAuthExpiresIn(payload.expires_in);
      showToast(t("auth.codeSent"));
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setSecurityDrawerOpen(true);
      }
      showToast(apiError instanceof ApiError ? apiError.message : t("auth.codeSendFailed"), "error");
    } finally {
      setAuthActionState("idle");
    }
  };

  const bindAuthChannel = async () => {
    if (!authSheetChannel) return;
    try {
      setAuthActionState("binding");
      const normalizedTarget = normalizeContactTarget(authSheetChannel, authTarget);
      const nextMe = await api.bindContact({
        channel: channelCode(authSheetChannel),
        target: normalizedTarget,
        code: authCode.trim(),
      });
      setMe(nextMe);
      patchSessionUser({
        has_password: nextMe.has_password,
        verified: nextMe.verified,
        avatar_type: nextMe.avatar_type,
        avatar_uri: nextMe.avatar_uri,
        welcome_message: nextMe.welcome_message,
        email: nextMe.email,
        phone: nextMe.phone,
        email_verified_at: nextMe.email_verified_at,
        phone_verified_at: nextMe.phone_verified_at,
        language: nextMe.language,
        last_heartbeat: nextMe.last_heartbeat,
      });
      const prefRows = await api.getNotificationPrefs();
      setPrefs(mapPrefs(prefRows));
      closeAuthSheet();
      showToast(authSheetChannel === "email" ? t("contact.emailVerified") : authSheetChannel === "sms" ? t("contact.phoneBound") : t("contact.bound"));
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setSecurityDrawerOpen(true);
      }
      showToast(
        apiError instanceof ApiError
          ? apiError.message
          : authSheetChannel === "email"
            ? t("contact.emailVerifyFailed")
            : authSheetChannel === "sms"
              ? t("contact.phoneBindFailed")
              : t("contact.bindFailed"),
        "error"
      );
    } finally {
      setAuthActionState("idle");
    }
  };

  const savePassword = async () => {
    if (!passwordNext.trim()) return;

    try {
      setPasswordSaving(true);
      const payload = await api.updatePassword({
        old_password: hasPassword ? passwordCurrent : undefined,
        new_password: passwordNext.trim(),
      });
      const prefRows = payload.has_password ? await api.getNotificationPrefs() : [];
      setMe((current) => (current ? { ...current, has_password: payload.has_password } : current));
      setPrefs(mapPrefs(prefRows));
      patchSessionUser({ has_password: payload.has_password });
      setPasswordCurrent("");
      setPasswordNext("");
      setPasswordSheetOpen(false);
      setSecurityDrawerOpen(false);
      showToast(hasPassword ? t("password.updated") : t("password.set"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : hasPassword ? t("password.updateFailed") : t("password.setFailed"), "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const leave = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const savePresetAvatar = async (presetId: number) => {
    try {
      setAvatarSaving(true);
      const payload = await api.setPresetAvatar(presetId);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      showToast(t("avatar.updated"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("avatar.updateFailed"), "error");
    } finally {
      setAvatarSaving(false);
    }
  };

  const requestCustomAvatarUpload = () => {
    if (!hasPassword) {
      showPasswordReminder(t("avatar.passwordRequired"));
      return;
    }
    if (!me?.growth?.capabilities?.["menu.profile.avatar.custom"]?.available) {
      showToast(t("avatar.levelRequired", { level: 4 }), "error");
      return;
    }
    avatarFileInputRef.current?.click();
  };

  const saveChatPagePersonalization = async () => {
    if (!me || personalizationSaving || chatBackgroundSaving) return;
    const backgroundChanged = chatBackgroundDraft !== (me.chat_background_theme ?? "default");
    const bubbleChanged = personalizationDraft.chat_bubble_style !== (me.chat_bubble_style ?? "default");
    if (!backgroundChanged && !bubbleChanged) return;
    if (backgroundChanged && chatBackgroundDraft !== "custom" && !canUseBackgroundStyle(chatBackgroundDraft)) {
      showToast(t("background.levelRequired", { level: rewardLevel("background", chatBackgroundDraft) }), "error");
      return;
    }
    if (bubbleChanged && personalizationDraft.chat_bubble_style === "vip" && !me.is_permanent_vip) {
      showToast(t("menu.vipBubbleOnly"), "error");
      return;
    }
    if (bubbleChanged && !canUseBubbleStyle(personalizationDraft.chat_bubble_style)) {
      if (cityBubbleStyles.has(personalizationDraft.chat_bubble_style)) {
        showToast(t("menu.cityBubbleUnlock"), "error");
        return;
      }
      const level = rewardLevel("bubble", personalizationDraft.chat_bubble_style);
      showToast(
        vipOrLevelBubbleStyles.has(personalizationDraft.chat_bubble_style)
          ? t("menu.levelOrVipUnlock", { level })
          : activityBubbleStyles.has(personalizationDraft.chat_bubble_style)
            ? t("menu.activityUnlock")
            : t("menu.levelUnlock", { level }),
        "error",
      );
      return;
    }
    let nextMe = me;
    setChatBackgroundSaving(true);
    setPersonalizationSaving(true);
    try {
      if (backgroundChanged && chatBackgroundDraft !== "custom") {
        nextMe = await api.setChatBackground(chatBackgroundDraft);
      }
      if (bubbleChanged) {
        nextMe = await api.setPersonalization(personalizationDraft);
      }
      setMe(nextMe);
      patchSessionUser(nextMe);
      showToast(t("personalization.updated"));
      setChatPageDrawerOpen(false);
      setChatPersonalizationPanel(null);
    } catch (apiError) {
      setMe(nextMe);
      patchSessionUser(nextMe);
      showToast(apiError instanceof ApiError ? apiError.message : t("personalization.updateFailed"), "error");
    } finally {
      setChatBackgroundSaving(false);
      setPersonalizationSaving(false);
    }
  };

  const handleChatBackgroundChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setChatBackgroundSaving(true);
      const payload = await uploadChatBackground(file);
      setMe(payload);
      patchSessionUser(payload);
      setChatBackgroundDraft("custom");
      showToast(t("background.updated"));
    } catch (uploadError) {
      showToast(
        uploadError instanceof ChatBackgroundUploadError || uploadError instanceof ApiError
          ? uploadError.message
          : t("upload.backgroundFailed"),
        "error"
      );
    } finally {
      setChatBackgroundSaving(false);
    }
  };

  const savePersonalization = async (drawer: "frame" | "profile-card") => {
    if (!me || personalizationSaving) return;
    const bubbleChanged = personalizationDraft.chat_bubble_style !== (me.chat_bubble_style ?? "default");
    const avatarFrameChanged = personalizationDraft.avatar_frame_style !== visibleAvatarFrame(me.avatar_frame_style);
    const profileCardChanged = personalizationDraft.profile_card_theme !== (me.profile_card_theme ?? "default");
    if (bubbleChanged && personalizationDraft.chat_bubble_style === "vip" && !me.is_permanent_vip) {
      showToast(t("menu.vipBubbleOnly"), "error");
      return;
    }
    if (bubbleChanged && !canUseBubbleStyle(personalizationDraft.chat_bubble_style)) {
      if (cityBubbleStyles.has(personalizationDraft.chat_bubble_style)) {
        showToast(t("menu.cityBubbleUnlock"), "error");
        return;
      }
      const level = rewardLevel("bubble", personalizationDraft.chat_bubble_style);
      showToast(
        vipOrLevelBubbleStyles.has(personalizationDraft.chat_bubble_style)
          ? t("menu.levelOrVipUnlock", { level })
          : t("menu.levelUnlock", { level }),
        "error"
      );
      return;
    }
    if (avatarFrameChanged && !canUseAvatarFrame(personalizationDraft.avatar_frame_style)) {
      const level = rewardLevel("frame", personalizationDraft.avatar_frame_style);
      showToast(t("menu.levelUnlock", { level }), "error");
      return;
    }
    if (profileCardChanged && personalizationDraft.profile_card_theme === "level-12" && growthLevel < 12) {
      showToast(t("menu.levelUnlock", { level: 12 }), "error");
      return;
    }
    if (profileCardChanged && personalizationDraft.profile_card_theme === "vip" && !permanentVip) {
      showToast(t("menu.permanentVipOnly"), "error");
      return;
    }
    setPersonalizationSaving(true);
    try {
      const nextMe = await api.setPersonalization(personalizationDraft);
      setMe(nextMe);
      patchSessionUser(nextMe);
      showToast(t("personalization.updated"));
      if (drawer === "frame") setAvatarFrameDrawerOpen(false);
      if (drawer === "profile-card") setProfileCardDrawerOpen(false);
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("personalization.updateFailed"), "error");
    } finally {
      setPersonalizationSaving(false);
    }
  };

  const saveLanguagePreference = async (nextPreference: LanguagePreference) => {
    try {
      await setLanguagePreference(nextPreference);
      showToast(t("menu.languageUpdated"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("menu.languageUpdateFailed"), "error");
    }
  };

  const saveSelfAvatarPreference = async () => {
    if (!me || personalizationSaving) return;
    const previous = Boolean(me.show_self_avatar);
    const next = !previous;
    setMe((current) => current ? { ...current, show_self_avatar: next } : current);
    setPersonalizationSaving(true);
    try {
      const nextMe = await api.setPersonalization({
        chat_bubble_style: me.chat_bubble_style ?? "default",
        avatar_frame_style: visibleAvatarFrame(me.avatar_frame_style),
        show_self_avatar: next,
        profile_card_theme: me.profile_card_theme ?? "default",
      });
      setMe(nextMe);
      patchSessionUser(nextMe);
      showToast(t("personalization.updated"));
    } catch (apiError) {
      setMe((current) => current ? { ...current, show_self_avatar: previous } : current);
      showToast(apiError instanceof ApiError ? apiError.message : t("personalization.updateFailed"), "error");
    } finally {
      setPersonalizationSaving(false);
    }
  };

  const handleCustomAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setAvatarSaving(true);
      const payload = await uploadCustomAvatar(file);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      showToast(t("avatar.uploaded"));
    } catch (uploadError) {
      showToast(
        uploadError instanceof AvatarUploadError || uploadError instanceof ApiError
          ? uploadError.message
          : t("upload.avatarFailed"),
        "error"
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const openBasicEditDialog = (field: "name" | "welcome") => {
    if (!hasPassword) {
      showPasswordReminder(field === "name" ? t("profile.nicknamePasswordRequired") : t("profile.welcomePasswordRequired"));
      return;
    }
    const capability = field === "name" ? "menu.profile.nickname" : "menu.profile.welcome";
    const requiredLevel = me?.growth?.capabilities?.[capability]?.required_level ?? (field === "name" ? 5 : 6);
    if (!me?.growth?.capabilities?.[capability]?.available) {
      showToast(t("growth.levelRequired", { level: requiredLevel }), "error");
      return;
    }
    if (field === "name" && me?.nickname_change?.available_at && me.nickname_change.available_at * 1000 > Date.now()) {
      showToast(t("profile.nextChange", { date: new Date(me.nickname_change.available_at * 1000).toLocaleDateString(getActiveLocale()) }), "error");
      return;
    }
    if (field === "welcome") {
      setWelcomeEditorOpen(true);
      return;
    }
    setBasicEditField("name");
    setBasicEditValue(session?.user.name ?? "");
  };

  const confirmAccountDeleteInput = () => {
    const value = accountDeleteInput.trim();
    if (!value) {
      setError(hasPassword ? t("account.enterCurrentPassword") : t("account.enterNicknameToDelete"));
      return;
    }
    setAccountDeleteStep("final");
  };

  const deleteAccount = async () => {
    const value = accountDeleteInput.trim();
    try {
      setAccountDeleteSaving(true);
      await api.deleteAccount(hasPassword ? { password: value } : { name_confirmation: value });
      setAccountDeleteStep(null);
      setSecurityDrawerOpen(false);
      await logout();
      navigate("/", { replace: true });
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("account.deleteFailed"));
    } finally {
      setAccountDeleteSaving(false);
    }
  };

  const confirmBasicEdit = async () => {
    if (!basicEditField) return;

    if (basicEditField === "name" && Array.from(basicEditValue.trim()).length > MAX_NICKNAME_LENGTH) {
      showToast(t("profile.nicknameTooLong", { count: MAX_NICKNAME_LENGTH }), "error");
      return;
    }

    try {
      setBasicEditSaving(true);
      const payload = await api.updateUserName(basicEditValue.trim());
      setMe((current) => (current ? { ...current, name: payload.name, name_pinyin: payload.name_pinyin ?? current.name_pinyin } : current));
      patchSessionUser({
        name: payload.name,
      });
      setBasicEditField(null);
      showToast(t("profile.nicknameUpdated"));
    } catch (apiError) {
      showToast(
        apiError instanceof ApiError ? apiError.message : t("profile.nicknameUpdateFailed"),
        "error"
      );
    } finally {
      setBasicEditSaving(false);
    }
  };

  const welcomeSummary = useMemo(() => {
    const value = (me?.welcome_message ?? session?.user?.welcome_message ?? "").trim();
    return value || t("profile.noWelcome");
  }, [me?.welcome_message, session?.user?.welcome_message]);
  const growthLevels = me?.growth?.levels ?? [];

  useEffect(() => {
    if (!growthLevelsOpen) return;
    const currentLevel = me?.growth?.level ?? 1;
    setActiveGrowthGuideLevel(currentLevel);
    window.requestAnimationFrame(() => {
      growthLevelTrackRef.current
        ?.querySelector<HTMLElement>(`[data-growth-level="${currentLevel}"]`)
        ?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    });
  }, [growthLevelsOpen, me?.growth?.level]);

  const openChannelsEntry = () => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    setChannelsDrawerOpen(true);
    void api.getNotificationTopics().then(setNotificationTopics).catch(() => undefined);
  };

  const topicPreference = (channel: number, topic: number, audience: number) => notificationTopics.find(
    (item) => item.channel === channel && item.topic === topic && item.audience === audience,
  );
  const topicSupported = (channel: number, topic: number, audience: number) => topicPreference(
    channel, topic, audience,
  )?.supported ?? !(topic === 6 && (channel === 1 || channel === 2));
  const topicEnabled = (channel: number, topic: number, audience: number) => {
    if (!topicSupported(channel, topic, audience)) return false;
    return topicPreference(channel, topic, audience)?.enabled ?? channel !== 2;
  };

  const toggleNotificationTopic = async (channel: 0 | 1 | 2 | 3, topic: 1 | 2 | 3 | 4 | 5 | 6, audience: 0 | 1 | 2) => {
    if (notificationTopicsSaving || channel === 2 || !topicSupported(channel, topic, audience)) return;
    const enabled = !topicEnabled(channel, topic, audience);
    const patch: NotificationTopicPreferenceDTO = { channel, topic, audience, enabled };
    setNotificationTopicsSaving(true);
    setNotificationTopics((current) => [...current.filter((item) => !(item.channel === channel && item.topic === topic && item.audience === audience)), patch]);
    try {
      const saved = await api.updateNotificationTopic(patch);
      setNotificationTopics((current) => [...current.filter((item) => !(item.channel === saved.channel && item.topic === saved.topic && item.audience === saved.audience)), saved]);
    } catch (cause) {
      setNotificationTopics((current) => [...current.filter((item) => !(item.channel === channel && item.topic === topic && item.audience === audience)), { ...patch, enabled: !enabled }]);
      setError(cause instanceof Error ? cause.message : t("notification.updateFailed"));
    } finally {
      setNotificationTopicsSaving(false);
    }
  };

  const setNotificationTopicGroup = async (channel: 0 | 1 | 2 | 3, pairs: Array<[1 | 2 | 3 | 4 | 5 | 6, 0 | 1 | 2]>) => {
    if (notificationTopicsSaving || channel === 2) return;
    const supportedPairs = pairs.filter(([topic, audience]) => topicSupported(channel, topic, audience));
    if (supportedPairs.length === 0) return;
    const enabled = !supportedPairs.every(([topic, audience]) => topicEnabled(channel, topic, audience));
    const patches = supportedPairs.map(([topic, audience]): NotificationTopicPreferenceDTO => ({ channel, topic, audience, enabled }));
    setNotificationTopicsSaving(true);
    setNotificationTopics((current) => [
      ...current.filter((item) => !patches.some((patch) => patch.channel === item.channel && patch.topic === item.topic && patch.audience === item.audience)),
      ...patches,
    ]);
    try {
      await Promise.all(patches.map((patch) => api.updateNotificationTopic(patch)));
    } catch (cause) {
      void api.getNotificationTopics().then(setNotificationTopics);
      setError(cause instanceof Error ? cause.message : t("notification.updateFailed"));
    } finally {
      setNotificationTopicsSaving(false);
    }
  };

  const openShowcaseBadge = (kind: "password" | NotificationChannel) => {
    if (kind === "password") {
      setSecurityDrawerOpen(true);
      return;
    }
    if (kind === "bark" ? instantEndpoints.some((endpoint) => endpoint.enabled) : channelVerified(me, kind)) {
      openPrefDrawer(kind);
      return;
    }
    if (kind === "bark") {
      openBarkGuide();
      return;
    }
    openAuthSheet(kind);
  };

  const openGrowthMilestone = (key: string) => {
    if (key === "security:password") return openShowcaseBadge("password");
    if (key === "security:email") return openShowcaseBadge("email");
    if (key === "security:phone") return openShowcaseBadge("sms");
    if (key === "security:bark") return openShowcaseBadge("bark");
    if (key === "explore:install_webapp") setPwaInstallSheetOpen(true);
  };

  const copyFriendInviteLink = async () => {
    if (!friendInviteLink) return;
    try {
      const copied = await copyText(friendInviteLink);
      if (!copied) throw new Error("copy_failed");
      showToast(t("common.linkCopied"));
    } catch {
      showToast(t("common.copyFailed"), "error");
    }
  };

  const friendInviteExpireText = useMemo(() => {
    if (!friendInviteExpire) return "";
    return new Date(friendInviteExpire * 1000).toLocaleString(getActiveLocale(), {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [friendInviteExpire]);

  const friendInviteValidityText = friendInviteMode === "permanent"
    ? t("invite.permanent")
    : friendInviteExpireText
      ? t("invite.validUntil", { date: friendInviteExpireText })
      : t("invite.sevenDays");

  const canUseFriendInvite = Boolean(me?.verified ?? session?.user?.verified);
  const growthExplorationGroups = ([
    ["chat", "growth.exploreChat"],
    ["square", "growth.exploreSquare"],
    ["menu", "growth.exploreMenu"],
  ] as const).map(([area, label]) => ({
    area,
    label: t(label),
    items: (me?.growth?.milestones ?? []).filter(
      (item) => item.category !== "security" && growthMilestoneArea(item.key) === area
    ),
  }));
  const pendingExplorationCount = growthExplorationGroups.reduce(
    (total, group) => total + group.items.filter((item) => !item.earned).length,
    0
  );

  const activePref = prefDrawerChannel ? prefs[prefDrawerChannel] : null;

  const openFriendInviteDrawer = () => {
    if (!canUseFriendInvite) {
      setError(t("invite.verificationRequired"));
      return;
    }
    setInviteDrawerOpen(true);
  };

  const renderChannelTopicControls = (channel: 0 | 1 | 2 | 3) => {
    const groups: Array<{ label: string; pairs: Array<[1 | 2 | 3 | 4 | 5 | 6, 0 | 1 | 2]> }> = [
      { label: t("notification.chatType"), pairs: [[1, 0]] },
      { label: t("notification.squareType"), pairs: [[2, 1], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2], [5, 1], [5, 2]] },
      { label: t("notification.onlineType"), pairs: [[6, 0]] },
    ];
    return <div className="menu-pref-list notification-channel-topics">
      {groups.map((group) => {
        const supportedPairs = group.pairs.filter(([topic, audience]) => topicSupported(channel, topic, audience));
        return <div className="menu-pref-row" key={group.label}><div className="row-main"><strong>{group.label}</strong></div><button aria-label={group.label} className={`switch ${supportedPairs.length > 0 && supportedPairs.every(([topic, audience]) => topicEnabled(channel, topic, audience)) ? "active" : ""}`} disabled={notificationTopicsSaving || channel === 2 || supportedPairs.length === 0} onClick={() => void setNotificationTopicGroup(channel, group.pairs)} type="button" /></div>;
      })}
    </div>;
  };

  return (
    <AppChrome title={t("menu.title")} hideTopbar shellClassName="desktop-tab-shell menu-tab-shell">
      <section className="page-stack">
        <TabPageHeader
          title={t("menu.title")}
          syncing={syncing}
          status={!isDesktopViewport ? (
            <button
              aria-label={t("menu.switchAccount")}
              className="menu-header-account-switch"
              onClick={() => void openAccountSwitcher()}
              title={t("menu.switchAccount")}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <path d="M6.5 7.5h11m0 0-3-3m3 3-3 3M17.5 16.5h-11m0 0 3 3m-3-3 3-3" />
              </svg>
              <span>{space?.name ?? t("menu.currentSpace")}</span>
            </button>
          ) : null}
        />
        <div className="menu-profile-card">
          <button className="profile-avatar-button menu-profile-avatar" onClick={() => setAvatarDialogOpen(true)} type="button">
            <UserAvatar className="avatar-large" frame={me?.avatar_frame_style} name={session?.user.name ?? t("brand.user")} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
          </button>
          <div className="row-main menu-profile-copy">
            <div className="menu-profile-heading">
              <strong>{session?.user.name ?? t("brand.user")}</strong>
              {space?.slug ? <span>@{space.slug}</span> : null}
            </div>
            <button className={`menu-growth-entry stage-${currentLevelStage}`} onClick={() => setGrowthDrawerOpen(true)} type="button">
              <GrowthLevelBadge className="menu-growth-level" label={`Lv.${me?.growth?.level ?? 1}`} level={me?.growth?.level ?? 1} />
              <span className="menu-growth-identity">
                <small>{t(`growth.levelStage.${currentLevelStage}` as TranslationKey)}</small>
                <strong>{me?.growth?.name ?? space?.level_names?.[0] ?? t("growth.firstLevel")}</strong>
              </span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <button
            aria-disabled={!canUseFriendInvite}
            aria-label={canUseFriendInvite ? t("invite.shareQr") : t("invite.verifyToUseQr")}
            className={`icon-button inline-avatar-icon-button menu-share-qr-button${!canUseFriendInvite ? " is-disabled" : ""}`}
            onClick={openFriendInviteDrawer}
            type="button"
          >
            <QrCodeIcon />
          </button>
        </div>
        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setBasicDrawerOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("menu.basicInfo")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => setSecurityDrawerOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("menu.accountSecurity")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {Boolean(me?.official ?? session?.user.official) ? (
              <button
                className="simple-row menu-link-row"
                disabled={adminDashboardOpening}
                onClick={() => void openAdminDashboard()}
                type="button"
              >
                <div className="row-main">
                  <strong>{t("menu.dashboard")}</strong>
                </div>
                <span className={`material-symbols-outlined${adminDashboardOpening ? " is-spinning" : ""}`}>
                  {adminDashboardOpening ? "progress_activity" : "chevron_right"}
                </span>
              </button>
            ) : null}
          </div>
        </section>

        <section className="list-section">
          <div className="simple-list">
            {!standalonePwa ? (
              <button className="simple-row menu-link-row" onClick={() => setPwaInstallSheetOpen(true)} type="button">
                <div className="row-main">
                  <strong>{t("pwa.installDesktop")}</strong>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ) : null}
            <button className="simple-row menu-link-row" onClick={openChannelsEntry} type="button">
              <div className="row-main">
                <strong>{t("menu.notifications")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </section>

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setPersonalizationDrawerOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("menu.personalization")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => setTravelMapOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("travelMap.myTitle")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => setCloudResourcesOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("cloudResources.title")}</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </section>

        {isDesktopViewport ? (
          <section className="list-section">
            <div className="simple-list">
              <button className="simple-row menu-link-row" onClick={() => void openAccountSwitcher()} type="button">
                <div className="row-main">
                  <strong>{t("menu.switchAccount")}</strong>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </section>
        ) : null}

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row danger-row menu-danger-row" onClick={() => setLeaveConfirmOpen(true)} type="button">
              <div className="row-main">
                <strong>{t("auth.logout")}</strong>
              </div>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </section>

      </section>

      <PwaInstallSheet
        onClose={() => setPwaInstallSheetOpen(false)}
        onInstalled={() => {
          void api.claimGrowthEvent("install_webapp").then(({ growth, resource_inventory }) => {
            setMe((current) => current ? { ...current, growth, resource_inventory } : current);
          });
        }}
        open={pwaInstallSheetOpen}
        spaceName={space?.name ?? t("space.current")}
      />
      <CloudResourceDrawer onRouteOpen={() => setCloudResourcesOpen(true)} onClose={() => setCloudResourcesOpen(false)} open={cloudResourcesOpen} />
      <TravelMapDrawer historyKey="travel-map" onRouteOpen={() => setTravelMapOpen(true)} open={travelMapOpen} onClose={() => setTravelMapOpen(false)} />

      <SideDrawer historyKey="growth" onRouteOpen={() => setGrowthDrawerOpen(true)} open={growthDrawerOpen} onClose={() => setGrowthDrawerOpen(false)} title={t("growth.mine")}>
        <div className={`growth-drawer is-level-${me?.growth?.level ?? 1} growth-stage-${growthStageForLevel(me?.growth?.level ?? 1)}`}>
          <button className="growth-hero" onClick={() => setGrowthLevelsOpen(true)} type="button">
            <span className="growth-hero-stage" aria-hidden="true">{String(me?.growth?.level ?? 1).padStart(2, "0")}</span>
            <div className="growth-hero-heading">
              <div className="growth-level-seal">
                <span>LEVEL</span>
                <strong>{String(me?.growth?.level ?? 1).padStart(2, "0")}</strong>
              </div>
              <div className="growth-hero-title">
                <small>{t("growth.currentTitle")} · {t(`growth.levelStage.${growthStageForLevel(me?.growth?.level ?? 1)}` as TranslationKey)}</small>
                <strong>{me?.growth?.name ?? t("growth.firstLevel")}</strong>
              </div>
              <span className="growth-hero-guide">
                {t("growth.openAtlas")}
                <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                  <path d="M4 10h11M11.5 6.5 15 10l-3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </span>
            </div>
            <div className="growth-progress-copy">
              <div>
                <strong>{me?.growth?.level_cap_reason || (me?.growth?.next_score ? t("growth.toNextLevel", { level: (me.growth.level ?? 1) + 1 }) : t("growth.maxLevel"))}</strong>
                <span>{me?.growth?.level_cap_reason ? t("growth.scoreLevelAndCap", { score: me.growth.score, scoreLevel: me.growth.score_level ?? me.growth.level, level: me.growth.level_cap }) : me?.growth?.next_score ? `${me.growth.score} / ${me.growth.next_score}` : t("growth.score", { score: me?.growth?.score ?? 0 })}</span>
              </div>
              <div className="growth-progress-track"><i style={{ transform: `scaleX(${me?.growth?.progress ?? 0})` }} /></div>
            </div>
          </button>
          <section className="growth-daily-card">
            <div className="growth-daily-copy">
              <strong>{t("growth.todayInteraction")}</strong>
              <span>{t("growth.daily")}</span>
            </div>
            <div className="growth-daily-meter">
              <i style={{ transform: `scaleX(${Math.min(1, (me?.growth?.daily?.earned ?? 0) / Math.max(1, me?.growth?.daily?.limit ?? 40))})` }} />
            </div>
            <b>{me?.growth?.daily?.earned ?? 0}<small>/{me?.growth?.daily?.limit ?? 40}</small></b>
          </section>
          <details className="growth-disclosure" open>
            <summary><span><strong>{t("growth.nextSteps")}</strong><small>{t("growth.nextStepsHint")}</small></span><b>{pendingExplorationCount}</b><span className="material-symbols-outlined">expand_more</span></summary>
            <div className="growth-milestone-sections">
              {growthExplorationGroups.map((group, index) => (
                <section className={`growth-milestone-section is-${group.area}`} key={group.area}>
                  <header>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{group.label}</strong>
                    <small>{group.items.filter((item) => !item.earned).length}</small>
                  </header>
                  <div className="growth-milestone-grid">
                    {group.items.map((item) => (
                      <button className={`growth-milestone ${item.earned ? "is-earned" : ""}`} disabled={!item.key.includes("install_webapp")} key={item.key} onClick={() => openGrowthMilestone(item.key)} type="button">
                        <span>{item.earned ? "✓" : "+"}</span><strong>{item.title}</strong><small>+{item.points}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </details>
          <details className="growth-disclosure">
            <summary><span><strong>{t("growth.securitySteps")}</strong><small>{t("growth.securityStepsHint")}</small></span><b>{(me?.growth?.milestones ?? []).filter((item) => item.category === "security" && !item.earned).length}</b><span className="material-symbols-outlined">expand_more</span></summary>
            <div className="growth-milestone-grid">
              {(me?.growth?.milestones ?? []).filter((item) => item.category === "security" && (item.key !== "security:bark" || deviceFamily !== "android")).map((item) => (
                <button className={`growth-milestone ${item.earned ? "is-earned" : ""}`} key={item.key} onClick={() => openGrowthMilestone(item.key)} type="button">
                  <span>{item.earned ? "✓" : "+"}</span><strong>{item.title}</strong><small>+{item.points}</small>
                </button>
              ))}
            </div>
          </details>
          {me?.growth?.recent_events?.length ? (
            <details className="growth-disclosure is-history">
              <summary><span><strong>{t("growth.journey")}</strong><small>{t("growth.journeyHint")}</small></span><span className="material-symbols-outlined">expand_more</span></summary>
              {me?.growth?.recent_events?.length ? <div className="growth-event-list">{me.growth.recent_events.map((event) => <div key={`${event.key}-${event.created_at}`}><span>{event.title}</span><strong>+{event.points}</strong></div>)}</div> : null}
            </details>
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer className="growth-level-atlas-drawer" historyKey="growth-levels" onRouteOpen={() => setGrowthLevelsOpen(true)} open={growthLevelsOpen} onClose={() => setGrowthLevelsOpen(false)} title={t("growth.levelGuide")}>
        <div className={`growth-scroll-atlas growth-stage-${growthStageForLevel(activeGrowthGuideLevel)}`}>
          <aside className="growth-scroll-chapter">
            <span className="growth-scroll-eyebrow">CURRENT CHAPTER</span>
            <div className="growth-scroll-level-number"><small>LV</small>{String(activeGrowthGuideLevel).padStart(2, "0")}</div>
            <span>{String(activeGrowthGuideLevel).padStart(2, "0")} / 18</span>
            <strong>{growthLevels[activeGrowthGuideLevel - 1]?.name ?? `Lv.${activeGrowthGuideLevel}`}</strong>
            <em>{t(`growth.levelStage.${growthStageForLevel(activeGrowthGuideLevel)}` as TranslationKey)}</em>
            <small>{activeGrowthGuideLevel === (me?.growth?.level ?? 1) ? t("growth.currentLevelLabel") : activeGrowthGuideLevel < (me?.growth?.level ?? 1) ? t("growth.reached") : t("growth.keepGrowing")}</small>
            <div className="growth-scroll-score">
              <span>{t("growth.unlockCondition")}</span>
              <strong>{(growthLevels[activeGrowthGuideLevel - 1]?.score ?? 0).toLocaleString(getActiveLocale())}<small>{t("growth.points")}</small></strong>
            </div>
          </aside>
          <div
            className="growth-scroll-map"
            ref={growthLevelTrackRef}
          >
            {growthLevels.map((item) => {
              const current = item.level === (me?.growth?.level ?? 1);
              const next = item.level === (me?.growth?.level ?? 1) + 1;
              return (
                <article
                  className={`growth-scroll-node growth-stage-${growthStageForLevel(item.level)}${item.unlocked ? " is-unlocked" : ""}${current ? " is-current" : ""}${next ? " is-next" : ""}${activeGrowthGuideLevel === item.level ? " is-focused" : ""}${item.level > (me?.growth?.level_cap ?? 18) ? " is-capped" : ""}`}
                  data-growth-level={item.level}
                  key={item.level}
                >
                  <button
                    className="growth-scroll-node-heading"
                    onClick={(event) => {
                      setActiveGrowthGuideLevel(item.level);
                      event.currentTarget.closest<HTMLElement>("[data-growth-level]")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      window.navigator.vibrate?.(8);
                    }}
                    type="button"
                  >
                    <span className="growth-scroll-node-number">{String(item.level).padStart(2, "0")}</span>
                    <span className="growth-scroll-node-copy">
                      <b>{item.name}</b>
                      <small>{item.score.toLocaleString(getActiveLocale())} {t("growth.points")}</small>
                    </span>
                    <span className="growth-scroll-node-state">{current ? "NOW" : item.unlocked ? "OPEN" : item.level > (me?.growth?.level_cap ?? 18) ? "LOCK" : "NEXT"}</span>
                  </button>
                  <div className="growth-scroll-rewards">
                    {(item.rewards ?? []).map((reward) => (
                      <article className={`growth-scroll-reward is-${reward.rarity}`} key={reward.id}>
                        <GrowthRewardVisual me={me} name={session?.user.name ?? t("brand.user")} reward={reward} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
                        <span><b>{reward.title}</b>{reward.implementation_status === "planned" ? <small>{t("growth.planned")}</small> : null}</span>
                      </article>
                    ))}
                    {!(item.rewards ?? []).length ? <span className="growth-scroll-rest">{t("growth.stage")}</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
          {me?.growth?.level_cap_reason ? <p className="growth-level-cap-note">{me.growth.level_cap_reason}</p> : null}
        </div>
      </SideDrawer>

      <SideDrawer historyKey="basic-info" onRouteOpen={() => setBasicDrawerOpen(true)} open={basicDrawerOpen} onClose={() => setBasicDrawerOpen(false)} title={t("menu.basicInfo")}>
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => discoverThen("capability.avatar", () => setAvatarDialogOpen(true))} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.avatar")}</strong>
              </div>
              <div className="menu-detail-value">
                <UserAvatar className="mini-avatar" name={session?.user.name ?? t("brand.user")} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
              </div>
              <span className="menu-feature-trailing"><FeatureDiscoveryMarker rewardId="capability.avatar" /><span className="material-symbols-outlined">chevron_right</span></span>
            </button>
            {canRenameNickname ? <button className="simple-row menu-link-row" onClick={() => discoverThen(growthLevel >= 12 ? "capability.nickname_7" : growthLevel >= 8 ? "capability.nickname_30" : "capability.nickname_365", () => openBasicEditDialog("name"))} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.nickname")}</strong>
                {me?.nickname_change?.available_at && me.nickname_change.available_at * 1000 > Date.now() ? (
                  <div className="row-subtle">
                    {t("profile.nextChange", { date: new Date(me.nickname_change.available_at * 1000).toLocaleDateString(getActiveLocale(), {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) })}
                  </div>
                ) : null}
              </div>
              <div className="menu-detail-value menu-detail-text">
                {session?.user.name ?? t("brand.user")}
              </div>
              <span className="menu-feature-trailing"><FeatureDiscoveryMarker rewardId={growthLevel >= 12 ? "capability.nickname_7" : growthLevel >= 8 ? "capability.nickname_30" : "capability.nickname_365"} /><span className="material-symbols-outlined">chevron_right</span></span>
            </button> : null}
            {canEditWelcome ? <button className="simple-row menu-link-row" onClick={() => discoverThen("capability.welcome", () => openBasicEditDialog("welcome"))} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.welcome")}</strong>
              </div>
              <div className="menu-detail-value menu-detail-text menu-summary-clamp">{welcomeSummary}</div>
              <span className="menu-feature-trailing"><FeatureDiscoveryMarker rewardId="capability.welcome" /><span className="material-symbols-outlined">chevron_right</span></span>
            </button> : null}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer historyKey="personalization" onRouteOpen={() => setPersonalizationDrawerOpen(true)} open={personalizationDrawerOpen} onClose={() => setPersonalizationDrawerOpen(false)} title={t("menu.personalization")}>
        <div className="personalization-drawer">
          <SettingGroup>
            <SettingSelect<ThemePreference>
              label={t("menu.appearance")}
              onChange={setThemePreference}
              options={[
                { value: "system", label: t("common.system") },
                { value: "light", label: t("menu.themeLight") },
                { value: "dark", label: t("menu.themeDark") },
              ]}
              value={themePreference}
            />
            <SettingSelect<LanguagePreference>
              disabled={languageSaving}
              label={t("menu.language")}
              onChange={saveLanguagePreference}
              options={[
                { value: "system", label: t("common.system") },
                { value: "zh-CN", label: t("common.chinese") },
                { value: "zh-TW", label: t("common.traditionalChinese") },
                { value: "en", label: t("common.english") },
                { value: "ja", label: t("common.japanese") },
                { value: "ko", label: t("common.korean") },
                { value: "es", label: t("common.spanish") },
              ]}
              value={languagePreference}
            />
            <SettingRow
              description={t("menu.showSelfAvatarHint")}
              title={t("menu.showSelfAvatar")}
              trailing={<SettingSwitch
                checked={Boolean(me?.show_self_avatar)}
                disabled={personalizationSaving}
                label={t("menu.showSelfAvatar")}
                onChange={() => void saveSelfAvatarPreference()}
              />}
            />
          </SettingGroup>
          <button
            className="personalization-background-entry personalization-feature-entry personalization-chat-page-entry"
            onClick={() => discoverThen("capability.custom_background", () => {
              setChatPersonalizationPanel(null);
              setChatPageDrawerOpen(true);
            })}
            type="button"
          >
            <span className={`personalization-background-swatch personalization-chat-page-preview theme-${me?.chat_background_theme ?? "default"}`}>
              <span className={`personalization-option preview-${visibleBubbleStyle(me?.chat_bubble_style)}`}><i aria-hidden="true"><span /></i></span>
            </span>
            <span><strong>{t("menu.chatPage")}</strong><small>{t("menu.chatPageHint")}</small></span>
            <span className="menu-feature-trailing"><FeatureDiscoveryMarker rewardId="capability.custom_background" /><span className="material-symbols-outlined">chevron_right</span></span>
          </button>
          <button className={`personalization-background-entry personalization-feature-entry rarity-${rewardRarity("frame", me?.avatar_frame_style ?? "none")}`} onClick={() => setAvatarFrameDrawerOpen(true)} type="button">
            <span className="personalization-entry-preview avatar-frame-preview">
              <UserAvatar
                className="personalization-entry-avatar"
                frame={me?.avatar_frame_style}
                name={session?.user.name ?? t("brand.user")}
                uri={me?.avatar_uri ?? session?.user.avatar_uri}
              />
            </span>
            <span><strong>{t("menu.avatarFrame")}</strong><small>{t("menu.avatarFrameHint")}</small></span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <button className="personalization-background-entry personalization-feature-entry profile-card-entry" onClick={() => setProfileCardDrawerOpen(true)} type="button">
            <span className={`profile-card-entry-swatch theme-${me?.profile_card_theme ?? "default"}`}><i /><b /></span>
            <span><strong>{t("menu.profileCard")}</strong><small>{t("menu.profileCardHint")}</small></span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={personalizationSaving}
        actionDisabled={personalizationDraft.profile_card_theme === (me?.profile_card_theme ?? "default")}
        actionLabel={t("common.save")}
        onAction={() => void savePersonalization("profile-card")}
        historyKey="profile-card"
        onRouteOpen={() => setProfileCardDrawerOpen(true)}
        open={profileCardDrawerOpen}
        onClose={() => setProfileCardDrawerOpen(false)}
        title={t("menu.profileCard")}
      >
        <div className="profile-card-personalization">
          <div className="profile-card-preview-viewport">
            <div className={`user-profile-panel profile-card-preview-scale profile-theme-${personalizationDraft.profile_card_theme}`}>
              <UserProfileCard
                avatarFrame={me?.avatar_frame_style}
                avatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
                growthLevel={growthLevel}
                isOnline
                isPermanentVip={permanentVip}
                name={session?.user.name ?? t("brand.user")}
                official={me?.official}
                permanentVipLabel={me?.permanent_vip_slot
                  ? t("profile.permanentVipRank", { slot: String(me.permanent_vip_slot).padStart(3, "0") })
                  : t("profile.permanentVip")}
                presence={t("profile.onlineNow")}
              />
            </div>
          </div>
          <div className="profile-card-theme-list">
            {(["default", "level-12", "vip", "spider-city"] as const).map((theme) => {
              const locked = theme === "level-12" ? growthLevel < 12 : theme === "vip" ? !permanentVip : theme === "spider-city" ? !ownsInventoryResource("profile", "spider-city") : false;
              return <button aria-pressed={personalizationDraft.profile_card_theme === theme} className={`profile-card-theme-option theme-${theme}${personalizationDraft.profile_card_theme === theme ? " is-selected" : ""}${locked ? " is-locked" : ""}`} key={theme} onClick={() => setPersonalizationDraft((current) => ({ ...current, profile_card_theme: theme }))} type="button">
                <span><i /><b /></span>
                <strong>{t(`menu.profileCardTheme.${theme}` as TranslationKey)}</strong>
                <small>{locked ? t(theme === "vip" ? "menu.permanentVipOnly" : theme === "spider-city" ? "menu.activityUnlock" : "menu.levelUnlock", theme === "level-12" ? { level: 12 } : undefined) : t(theme === "level-12" ? "growth.rarity.rare" : theme === "vip" || theme === "spider-city" ? "growth.rarity.epic" : "growth.rarity.common")}</small>
              </button>;
            })}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={chatBackgroundSaving || personalizationSaving}
        actionDisabled={
          chatBackgroundDraft === (me?.chat_background_theme ?? "default")
          && personalizationDraft.chat_bubble_style === (me?.chat_bubble_style ?? "default")
        }
        actionLabel={t("common.save")}
        className="chat-personalization-drawer"
        headerAction={(
          <button
            aria-expanded={chatPreviewDemoOpen}
            className={`chat-personalization-demo-toggle${chatPreviewDemoOpen ? " is-active" : ""}`}
            onClick={() => setChatPreviewDemoOpen((current) => !current)}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">tune</span>
            <span>{t("menu.previewScene")}</span>
          </button>
        )}
        historyKey="chat-page"
        onRouteOpen={() => setChatPageDrawerOpen(true)}
        onAction={() => void saveChatPagePersonalization()}
        open={chatPageDrawerOpen}
        onClose={() => {
          setChatPageDrawerOpen(false);
          setChatPersonalizationPanel(null);
          setChatPreviewDemoOpen(false);
        }}
        title={space?.official_user?.name ?? t("brand.user")}
        titleLeading={<UserAvatar className="chat-personalization-header-avatar" name={space?.official_user?.name ?? t("brand.user")} uri={space?.official_user?.avatar_uri} />}
      >
        <div className={`chat-personalization-workspace${chatPersonalizationPanel ? " is-editing" : " is-overview"}${chatPreviewDemoOpen ? " is-demo-open" : ""}`}>
          <div className={`chat-personalization-demo-shell${chatPreviewDemoOpen ? " is-visible" : ""}`}>
            <section aria-label={t("menu.previewScene")} className="chat-personalization-demo-panel">
              <div className="chat-personalization-demo-kinds" role="listbox">
                {chatPreviewDemoKinds.map((item) => (
                  <button
                    aria-selected={chatPreviewDemoKind === item.kind}
                    className={chatPreviewDemoKind === item.kind ? "is-active" : ""}
                    key={item.kind}
                    onClick={() => setChatPreviewDemoKind(item.kind)}
                    role="option"
                    type="button"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                    <span>{t(item.label)}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="chat-personalization-preview-viewport">
            <div className="chat-personalization-preview-scale">
              <ChatsPage key={`chat-preview-${chatPreviewDemoKind}`} preview={{
                avatarName: space?.official_user?.name ?? t("brand.user"),
                avatarUri: space?.official_user?.avatar_uri,
                backgroundTheme: chatBackgroundDraft,
                backgroundUri: chatBackgroundDraft === "custom" ? me?.chat_background_uri : undefined,
                bubbleStyle: visibleBubbleStyle(personalizationDraft.chat_bubble_style),
                demo: { kind: chatPreviewDemoKind },
                selfOnly: true,
              }} />
            </div>
          </div>
          <div className="chat-personalization-dock">
            <div className="chat-personalization-controls">
              <div aria-label={t("menu.chatPageEditMode")} className="chat-personalization-tabs" role="tablist">
                {(["background", "bubble"] as const).map((panel) => (
                  <button
                    aria-selected={chatPersonalizationPanel === panel}
                    className={chatPersonalizationPanel === panel ? "is-active" : ""}
                    key={panel}
                    onClick={() => setChatPersonalizationPanel((current) => current === panel ? null : panel)}
                    role="tab"
                    type="button"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">{panel === "background" ? "wallpaper" : "chat_bubble"}</span>
                    <span>{t(panel === "background" ? "menu.chatBackground" : "menu.chatBubble")}</span>
                  </button>
                ))}
              </div>
            </div>
          <div className={`chat-personalization-library-shell${chatPersonalizationPanel ? " is-visible" : ""}`}>
            <div className="chat-personalization-library">
              {chatPersonalizationPanel === "background" ? (
                <>
                  <div className="chat-personalization-rarity-tabs" role="tablist" aria-label={t("menu.chatBackground")}>
                    {[...backgroundRarityTabs, "custom" as const].map((rarity) => (
                      <button aria-selected={chatBackgroundRarity === rarity} className={`rarity-${rarity}${chatBackgroundRarity === rarity ? " is-active" : ""}`} key={rarity} onClick={() => setChatBackgroundRarity(rarity)} role="tab" type="button">
                        <span>{rarity === "custom" ? t("common.custom") : t(`growth.rarity.${rarity}` as TranslationKey)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="chat-personalization-card-track" ref={chatBackgroundTrackRef}>
                    {chatBackgroundRarity === "custom" ? (
                      <button
                        aria-pressed={chatBackgroundDraft === "custom"}
                        className={`chat-personalization-card chat-background-choice theme-custom is-stage-focus${chatBackgroundDraft === "custom" ? " is-selected" : ""}${!canCustomizeChatBackground ? " is-preview-only" : ""}`}
                        disabled={chatBackgroundSaving || !canCustomizeChatBackground}
                        onClick={() => chatBackgroundFileInputRef.current?.click()}
                        type="button"
                      >
                        <span>{me?.chat_background_uri ? <img alt="" src={me.chat_background_uri} /> : <span className="material-symbols-outlined">add_photo_alternate</span>}</span>
                        <div className="chat-personalization-card-copy"><strong>{chatBackgroundSaving ? t("common.processing") : t("common.custom")}</strong>{!canCustomizeChatBackground ? <small>{t("menu.levelUnlock", { level: 8 })}</small> : null}</div>
                      </button>
                    ) : visibleBackgroundCatalog.map(([theme, label]) => {
                      const owned = canUseBackgroundStyle(theme as ChatBackgroundTheme);
                      return (
                        <button
                          aria-pressed={chatBackgroundDraft === theme}
                          className={`chat-personalization-card chat-background-choice theme-${theme} rarity-${rewardRarity("background", theme)}${backgroundStageKey === theme ? " is-stage-focus" : ""}${chatBackgroundDraft === theme ? " is-selected" : ""}${!owned ? " is-preview-only" : ""}`}
                          disabled={chatBackgroundSaving}
                          key={theme}
                          onClick={() => setChatBackgroundDraft(theme as ChatBackgroundTheme)}
                          type="button"
                        >
                          <span />
                          <div className="chat-personalization-card-copy"><strong>{t(label)}</strong>{!owned ? <small>{t("menu.levelUnlock", { level: rewardLevel("background", theme) })}</small> : null}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : chatPersonalizationPanel === "bubble" ? (
                <>
                  <div className="chat-personalization-rarity-tabs" role="tablist" aria-label={t("menu.chatBubble")}>
                    {bubbleRarityTabs.map((rarity) => (
                      <button aria-selected={chatBubbleRarity === rarity} className={`rarity-${rarity}${chatBubbleRarity === rarity ? " is-active" : ""}`} key={rarity} onClick={() => setChatBubbleRarity(rarity)} role="tab" type="button">
                        <span>{t(`growth.rarity.${rarity}` as TranslationKey)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="chat-personalization-card-track field-chat_bubble_style" ref={chatBubbleTrackRef}>
                    {visibleBubbleCatalog.map(([value, label]) => {
                      const style = value as ChatBubbleStyle;
                      const owned = canUseBubbleStyle(style);
                      return (
                        <button
                          aria-pressed={personalizationDraft.chat_bubble_style === value}
                          className={`chat-personalization-card personalization-option preview-${value} rarity-${rewardRarity("bubble", value)}${bubbleStageKey === value ? " is-stage-focus" : ""}${personalizationDraft.chat_bubble_style === value ? " is-selected" : ""}${!owned ? " is-preview-only" : ""}`}
                          disabled={personalizationSaving}
                          key={value}
                          onClick={() => setPersonalizationDraft((current) => ({ ...current, chat_bubble_style: style }))}
                          type="button"
                        >
                          <i aria-hidden="true"><span /></i>
                          <div className="chat-personalization-card-copy"><strong>{t(label)}</strong>{!owned ? <small>{bubbleUnlockLabel(style)}</small> : null}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          </div>
          <input ref={chatBackgroundFileInputRef} accept="image/*" hidden onChange={(event) => void handleChatBackgroundChange(event)} type="file" />
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={personalizationSaving}
        actionDisabled={personalizationDraft.avatar_frame_style === visibleAvatarFrame(me?.avatar_frame_style)}
        actionLabel={t("common.save")}
        onAction={() => void savePersonalization("frame")}
        historyKey="avatar-frames"
        onRouteOpen={() => setAvatarFrameDrawerOpen(true)}
        open={avatarFrameDrawerOpen}
        onClose={() => setAvatarFrameDrawerOpen(false)}
        title={t("menu.avatarFrame")}
      >
        <div className="personalization-editor">
          <div className="personalization-avatar-stage personalization-sticky-preview">
            <div className="personalization-avatar-orbit" aria-hidden="true" />
            <UserAvatar
              className="personalization-avatar-stage-image"
              frame={personalizationDraft.avatar_frame_style}
              name={session?.user.name ?? t("brand.user")}
              uri={me?.avatar_uri ?? session?.user.avatar_uri}
            />
            <strong>{session?.user.name ?? t("brand.user")}</strong>
            <span>{t("menu.avatarFramePreviewHint")}</span>
          </div>
          <div className="personalization-library">
            <PersonalizationCatalogControls
              onOwnershipChange={setPersonalizationOwnershipFilter}
              ownership={personalizationOwnershipFilter}
            />
            {buildPersonalizationSections(personalizationOptions.avatar_frame_style, "frame", (frame) => canUseAvatarFrame(frame as PersonalizationDTO["avatar_frame_style"])).map((section) => (
              <section className={`personalization-library-section rarity-${section.key}`} key={section.label}>
                <header><h3>{section.label}</h3><span>{section.items.length}</span></header>
                <div className="personalization-option-grid field-avatar_frame_style">
                  {section.items.map(([value, label]) => (
                    <button
                      aria-pressed={personalizationDraft.avatar_frame_style === value}
                      className={`personalization-option preview-${value} rarity-${rewardRarity("frame", value)}${personalizationDraft.avatar_frame_style === value ? " is-selected" : ""}${!canUseAvatarFrame(value as PersonalizationDTO["avatar_frame_style"]) ? " is-locked" : ""}`}
                      disabled={personalizationSaving}
                      key={value}
                      onClick={() => setPersonalizationDraft((current) => ({ ...current, avatar_frame_style: value as PersonalizationDTO["avatar_frame_style"] }))}
                      type="button"
                    >
                      <i aria-hidden="true">
                        <UserAvatar
                          className="mini-avatar personalization-option-avatar"
                          frame={value as PersonalizationDTO["avatar_frame_style"]}
                          name={session?.user.name ?? t("brand.user")}
                          uri={me?.avatar_uri ?? session?.user.avatar_uri}
                        />
                      </i>
                      <div className="personalization-item-name"><RarityIcon rarity={rewardRarity("frame", value)} /><strong>{t(label)}</strong></div>
                      {!canUseAvatarFrame(value as PersonalizationDTO["avatar_frame_style"]) ? (
                        <small>{activityAvatarFrameStyles.has(value as PersonalizationDTO["avatar_frame_style"])
                          ? t("menu.activityUnlock")
                          : t("menu.levelUnlock", { level: rewardLevel("frame", value) })}</small>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        historyKey="account-security"
        onRouteOpen={() => setSecurityDrawerOpen(true)}
        open={securityDrawerOpen}
        onClose={() => {
          setSecurityDrawerOpen(false);
          if (new URLSearchParams(location.search).get("drawer") === "security") {
            navigate("/app/menu", { replace: true });
          }
        }}
        title={t("menu.accountSecurity")}
      >
        <div className="detail-list">
          <SettingGroup>
            <SettingRow description={!hasPassword ? t("password.securityHint") : undefined} onClick={() => setPasswordSheetOpen(true)} title={hasPassword ? t("password.change") : t("password.setup")} />
            <SettingRow
              description={
                  gestureEnabled
                    ? t("gesture.lockAfter", { count: gestureLockAfterMinutes })
                    : emailVerified
                      ? t("common.notEnabled")
                      : t("gesture.verifyEmailToEnable")
              }
              onClick={() => setGestureSheetOpen(true)}
              title={t("gesture.title")}
            />
            <SettingRow
              description={phoneVerified
                      ? me?.is_private_account
                        ? t("account.privateHint")
                        : t("account.discoverableHint")
                      : t("account.bindPhoneFirst")}
              title={t("account.private")}
              trailing={<SettingSwitch checked={Boolean(me?.is_private_account)} disabled={privateAccountSaving || !phoneVerified} label={t("account.togglePrivate")} onChange={() => void togglePrivateAccount()} />}
            />
            <SettingRow
              description={t("account.deleteHint")}
              onClick={() => {
                setAccountDeleteInput("");
                setAccountDeleteStep("intro");
              }}
              title={t("account.delete")}
              tone="danger"
            />
          </SettingGroup>
        </div>
      </SideDrawer>

      <BottomSheet
        open={accountSwitcherOpen}
        title={t("menu.switchAccount")}
        onClose={() => {
          if (switchingUserId !== null) return;
          setAccountSwitcherOpen(false);
        }}
      >
        <div className="simple-list account-switch-list">
          {accountSwitcherLoading ? (
            <ContentLoader label={t("account.finding")} rows={3} />
          ) : switchAccounts.length ? (
            switchAccounts.map((account) => (
              <button
                key={`${account.space.space_id}-${account.user.user_id}`}
                className="simple-row person-row"
                disabled={switchingUserId !== null}
                onClick={() => void switchAccount(account)}
                type="button"
              >
                <UserAvatar className="mini-avatar" name={account.user.name} uri={account.user.avatar_uri} />
                <div className="row-main">
                  <strong>{account.user.name}</strong>
                  <div className="row-subtle">
                    {account.space.name}{account.user.official ? t("account.adminSuffix") : ""}
                  </div>
                </div>
                {switchingUserId === account.user.user_id ? (
                  <HeaderSyncIndicator syncing />
                ) : (
                  <span className="material-symbols-outlined">chevron_right</span>
                )}
              </button>
            ))
          ) : (
            <QuietState icon="switch_account" title={t("account.noSwitchable")} description={t("account.privateHidden")} />
          )}
        </div>
      </BottomSheet>

      <SideDrawer historyKey="notifications" onRouteOpen={() => setChannelsDrawerOpen(true)} open={channelsDrawerOpen} onClose={() => setChannelsDrawerOpen(false)} title={t("menu.notifications")}>
        <div className="notification-routing-drawer">
          <div className="mode-switch notification-routing-mode" role="tablist">
            <button className={`mode-pill ${notificationSettingsMode === "channel" ? "active" : ""}`} onClick={() => setNotificationSettingsMode("channel")} role="tab" type="button">{t("notification.byChannel")}</button>
            <button className={`mode-pill ${notificationSettingsMode === "type" ? "active" : ""}`} onClick={() => setNotificationSettingsMode("type")} role="tab" type="button">{t("notification.byType")}</button>
          </div>
          {notificationSettingsMode === "channel" ? (
            <div className="notification-routing-grid">
              <button className="notification-channel-card is-web" onClick={openWebReminderDrawer} type="button"><span className="material-symbols-outlined">language</span><div><strong>{t("channel.web")}</strong><small>{webReminderSummary}</small></div><span className="material-symbols-outlined">chevron_right</span></button>
              {visibleChannelRows.map(([channel, _value, label]) => {
                const verified = channel === "bark" ? instantEndpoints.length > 0 : channelVerified(me, channel);
                return <button className={`notification-channel-card is-${channel}`} key={channel} onClick={() => channel === "bark" || verified ? openPrefDrawer(channel) : openAuthSheet(channel)} type="button">
                  <span className="material-symbols-outlined">{channel === "email" ? "mail" : channel === "sms" ? "sms" : "notifications_active"}</span>
                  <div><strong>{t(label)}</strong><small>{channel === "sms" ? t("common.unsupported") : channel === "bark" ? t("notification.instantEndpointCount", { count: instantEndpoints.filter((item) => item.enabled).length }) : verified ? t("contact.boundState") : t("contact.bindNow")}</small></div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>;
              })}
            </div>
          ) : (
            <div className="notification-type-stack">
              {([
                { title: t("notification.chatType"), hint: t("notification.chatTypeHint"), topics: [[1, 0]] },
                { title: t("notification.squareType"), hint: t("notification.squareTypeHint"), topics: [[2, 1], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2], [5, 1], [5, 2]] },
                { title: t("notification.onlineType"), hint: t("notification.onlineTypeHint"), topics: [[6, 0]] },
              ] as Array<{ title: string; hint: string; topics: Array<[number, number]> }>).map((section) => (
                <section className="notification-type-card" key={section.title}>
                  <header><strong>{section.title}</strong><small>{section.hint}</small></header>
                  {section.topics.map(([topic, audience]) => {
                    const labels: Record<number, string> = { 1: t("notification.chatType"), 2: t("notification.statementLikes"), 3: t("notification.statementComments"), 4: t("notification.commentLikes"), 5: t("notification.commentReplies"), 6: t("notification.onlineType") };
                    return <div className="notification-topic-row" key={`${topic}:${audience}`}><div><strong>{labels[topic]}</strong>{audience ? <small>{audience === 1 ? t("notification.fromFriends") : t("notification.fromOthers")}</small> : null}</div><div className="notification-topic-channels">
                      {([0, 1, 2, 3] as Array<0 | 1 | 2 | 3>).map((channel) => <button aria-label={`${labels[topic]}-${channel}`} className={`notification-mini-toggle${topicEnabled(channel, topic, audience) ? " is-active" : ""}`} disabled={notificationTopicsSaving || channel === 2 || !topicSupported(channel, topic, audience)} key={channel} onClick={() => void toggleNotificationTopic(channel, topic as 1 | 2 | 3 | 4 | 5 | 6, audience as 0 | 1 | 2)} type="button"><span className="material-symbols-outlined">{channel === 0 ? "language" : channel === 1 ? "mail" : channel === 2 ? "sms" : "notifications_active"}</span></button>)}
                    </div></div>;
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </SideDrawer>

      <SideDrawer
        historyKey="web-notifications"
        onRouteOpen={() => setWebReminderDrawerOpen(true)}
        open={webReminderDrawerOpen}
        onClose={() => setWebReminderDrawerOpen(false)}
        title={t("webReminder.title")}
      >
        <div className="detail-list">
          <div className="menu-pref-list">
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>{t("webReminder.systemNotifications")}</strong>
                {webPushDescription ? <div className="row-subtle">{webPushDescription}</div> : null}
              </div>
              <button
                aria-label={t("webReminder.toggleSystem")}
                className={`switch ${webPushState === "on" ? "active" : ""}`}
                disabled={webPushSaving || webPushState === "checking" || webPushState === "unsupported" || webPushState === "denied"}
                onClick={() => void toggleWebPush()}
                type="button"
              />
            </div>
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>{t("webReminder.messageSound")}</strong>
              </div>
              <button
                aria-label={t("webReminder.toggleSound")}
                className={`switch ${webReminderPrefs.soundEnabled ? "active" : ""}`}
                onClick={() => void updateWebReminderPrefs({ soundEnabled: !webReminderPrefs.soundEnabled })}
                type="button"
              />
            </div>
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>{t("webReminder.titleAlert")}</strong>
              </div>
              <button
                aria-label={t("webReminder.toggleTitle")}
                className={`switch ${webReminderPrefs.titleEnabled ? "active" : ""}`}
                onClick={() => void updateWebReminderPrefs({ titleEnabled: !webReminderPrefs.titleEnabled })}
                type="button"
              />
            </div>
          </div>
          {renderChannelTopicControls(0)}
        </div>
      </SideDrawer>

      <SideDrawer
        historyKey="friend-qr"
        onRouteOpen={() => setInviteDrawerOpen(true)}
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        title={t("invite.friendQr")}
        titleAccessory={<HeaderSyncIndicator syncing={friendInviteLoading} />}
      >
        <div className="detail-list menu-share-drawer">
          {!friendInviteLoading && friendInviteQrUri ? (
            <div className="menu-share-card">
              <div className="menu-share-qr-shell">
                <div className="menu-share-qr-frame">
                  <img alt={t("invite.qrAlt")} className="menu-share-qr-image" src={friendInviteQrUri} />
                  <div className="menu-share-qr-avatar">
                    <UserAvatar className="avatar-large" name={session?.user.name ?? t("brand.user")} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
                  </div>
                </div>
              </div>

              <div className="menu-share-meta">
                <strong>{t("invite.fromUser", { name: session?.user.name ?? t("brand.user") })}</strong>
                <div className="row-subtle">{t("invite.spaceOnly", { validity: friendInviteValidityText })}</div>
              </div>

              <div className="menu-share-link-box">
                <div className="menu-share-link-text">{friendInviteLink}</div>
              </div>

              <div className="menu-share-actions">
                <button className="button" onClick={() => void copyFriendInviteLink()} type="button">
                  {t("common.copyLink")}
                </button>
              </div>

              <div className="mode-switch menu-share-mode-switch">
                <button
                  className={`mode-pill ${friendInviteMode === "limited" ? "active" : ""}`}
                  onClick={() => setFriendInviteMode("limited")}
                  type="button"
                >
                  {t("invite.sevenDaysCompact")}
                </button>
                <button
                  className={`mode-pill ${friendInviteMode === "permanent" ? "active" : ""}`}
                  onClick={() => setFriendInviteMode("permanent")}
                  type="button"
                >
                  {t("invite.permanentCompact")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer
        historyKey={`notification-channel-${prefDrawerChannel ?? "settings"}`}
        open={Boolean(prefDrawerChannel)}
        onClose={closePrefDrawers}
        title={prefDrawerChannel ? t("notification.channelSettings", { channel: channelLabel(prefDrawerChannel) }) : t("notification.settings")}
      >
        {prefDrawerChannel && activePref ? (
          <div className="menu-pref-settings-stack">
            {prefDrawerChannel === "bark" ? (
              <section className="instant-endpoint-section">
                <header>
                  <strong>{t("notification.instantReceivers")}</strong>
                  <small>{t("notification.instantReceiversHint")}</small>
                </header>
                <div className="instant-endpoint-list">
                  {visibleInstantProviders.map((provider) => {
                    const meta = instantProviderMeta[provider];
                    const endpoint = instantEndpoints.find((item) => item.provider === provider);
                    return (
                      <div className={`instant-endpoint-row${endpoint?.enabled ? " is-active" : ""}`} key={provider}>
                        <button className="instant-endpoint-main" onClick={() => openInstantProvider(provider)} type="button">
                          <span className="material-symbols-outlined">{meta.icon}</span>
                          <span><strong>{meta.name}</strong><small>{endpoint?.masked_target ?? t("contact.bindNow")}</small></span>
                        </button>
                        {endpoint ? (
                          <button aria-label={t("notification.toggleReceiver", { provider: meta.name })} className={`switch ${endpoint.enabled ? "active" : ""}`} disabled={instantSaving} onClick={() => void toggleInstantEndpoint(endpoint)} type="button" />
                        ) : <span className="material-symbols-outlined">chevron_right</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <div className="menu-pref-list">
              <div className="menu-pref-row">
                <div className="row-main">
                  <strong>{t("notification.enable")}</strong>
                  {prefDrawerChannel === "sms" ? <div className="row-subtle">{t("common.unsupported")}</div> : null}
                </div>
                <button
                  aria-label={`toggle-${prefDrawerChannel}`}
                  className={`switch ${prefDrawerChannel !== "sms" && activePref.enabled ? "active" : ""}`}
                  disabled={prefSaving || prefDrawerChannel === "sms"}
                  onClick={() => void savePreferencePatch(prefDrawerChannel, { enabled: activePref.enabled ? 0 : 1 })}
                  type="button"
                />
              </div>
              {prefDrawerChannel === "email" ? (
                <button
                  className="menu-pref-row menu-pref-row-button"
                  disabled={!activePref.enabled}
                  onClick={() => openThresholdEditor(prefDrawerChannel)}
                  type="button"
                >
                  <div className="row-main">
                    <strong>{t("notification.offlineThreshold")}</strong>
                  </div>
                  <div className="menu-pref-row-value">
                    <span>{formatThreshold(activePref.threshold)}</span>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </div>
                </button>
              ) : null}
              {prefDrawerChannel === "email" || prefDrawerChannel === "bark" ? (
                <>
                  <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                    <div className="row-main">
                      <strong>{t("notification.hideContent")}</strong>
                    </div>
                    <button
                      aria-label={`toggle-hide-content-${prefDrawerChannel}`}
                      className={`switch ${activePref.hideMessageContent ? "active" : ""}`}
                      disabled={prefSaving || !activePref.enabled}
                      onClick={() => void savePreferencePatch(prefDrawerChannel, { hide_message_content: activePref.hideMessageContent ? 0 : 1 })}
                      type="button"
                    />
                  </div>
                </>
              ) : null}
              {prefDrawerChannel === "bark" ? (
                <>
                  <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                    <div className="row-main"><strong>{t("notification.openChatOnTap")}</strong></div>
                    <button aria-label={t("notification.toggleOpenChat")} className={`switch ${activePref.openChatOnTap ? "active" : ""}`} disabled={prefSaving || !activePref.enabled} onClick={() => void savePreferencePatch("bark", { open_chat_on_tap: activePref.openChatOnTap ? 0 : 1 })} type="button" />
                  </div>
                  <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                    <div className="row-main"><strong>{t("notification.useSpaceLogo")}</strong></div>
                    <button aria-label={t("notification.toggleSpaceLogo")} className={`switch ${activePref.barkIconMode === 1 ? "active" : ""}`} disabled={prefSaving || !activePref.enabled} onClick={() => void savePreferencePatch("bark", { bark_icon_mode: activePref.barkIconMode === 1 ? 0 : 1 })} type="button" />
                  </div>
                  <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                    <div className="row-main"><strong>{t("notification.useUserAvatar")}</strong></div>
                    <button aria-label={t("notification.toggleUserAvatar")} className={`switch ${activePref.barkIconMode === 2 ? "active" : ""}`} disabled={prefSaving || !activePref.enabled} onClick={() => void savePreferencePatch("bark", { bark_icon_mode: activePref.barkIconMode === 2 ? 0 : 2 })} type="button" />
                  </div>
                </>
              ) : null}
            </div>
            {renderChannelTopicControls(channelCode(prefDrawerChannel) as 1 | 2 | 3)}
            {prefDrawerChannel !== "bark" ? <div className="menu-pref-list">
              <div className="menu-pref-row">
                <div className="row-main">
                  <strong>{t("contact.lastUnbound")}</strong>
                  {contactUnbindAvailableAt(prefDrawerChannel) &&
                  contactUnbindAvailableAt(prefDrawerChannel)! > Date.now() ? (
                    <div className="row-subtle">
                      {t("contact.canUnbindAfter", { date: formatContactDate(contactUnbindAvailableAt(prefDrawerChannel)! / 1000) })}
                    </div>
                  ) : null}
                </div>
                <div className="menu-pref-row-value">{formatContactDate(contactUnboundAt(prefDrawerChannel))}</div>
              </div>
              <button
                className="menu-pref-row menu-pref-row-button menu-contact-unbind"
                disabled={
                  prefSaving ||
                  Boolean(
                    contactUnbindAvailableAt(prefDrawerChannel) &&
                    contactUnbindAvailableAt(prefDrawerChannel)! > Date.now()
                  )
                }
                onClick={() => openUnbindConfirm(prefDrawerChannel)}
                type="button"
              >
                <div className="row-main">
                  <strong>{t("contact.unbind")}</strong>
                  <div className="row-subtle">
                    {prefDrawerChannel === "email"
                        ? t("contact.emailUnbindLimit")
                        : t("contact.phoneUnbindLimit")}
                  </div>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div> : null}
          </div>
        ) : null}
      </SideDrawer>
      <SideDrawer
        historyKey={`instant-provider-${instantProviderDrawer ?? "settings"}`}
        open={Boolean(instantProviderDrawer)}
        onClose={() => !instantSaving && setInstantProviderDrawer(null)}
        title={instantProviderDrawer ? instantProviderMeta[instantProviderDrawer].name : t("channel.instant")}
      >
        {instantProviderDrawer ? (() => {
          const endpoint = instantEndpoints.find((item) => item.provider === instantProviderDrawer);
          const providerName = instantProviderMeta[instantProviderDrawer].name;
          const providerInstallLinks = instantProviderMeta[instantProviderDrawer].installLinks.filter(
            (item) => item.platforms.includes(deviceFamily),
          );
          return (
            <div className="instant-provider-drawer">
              <div className="instant-provider-intro">
                <span className="material-symbols-outlined">{instantProviderMeta[instantProviderDrawer].icon}</span>
                <div><strong>{t("notification.connectProvider", { provider: providerName })}</strong><small>{t(`notification.providerHint.${instantProviderDrawer}` as TranslationKey)}</small></div>
              </div>
              <section className="instant-provider-guide" aria-label={t("notification.setupGuide")}>
                <header>
                  <strong>{t("notification.setupGuide")}</strong>
                  <small>{t("notification.setupGuideHint", { provider: providerName })}</small>
                </header>
                <ol>
                  {[1, 2, 3].map((step) => (
                    <li key={step}>
                      <span>{step}</span>
                      <div>
                        <strong>{t(`notification.guide.${instantProviderDrawer}.${step}.title` as TranslationKey)}</strong>
                        <p>{t(`notification.guide.${instantProviderDrawer}.${step}.body` as TranslationKey)}</p>
                        {step === 1 && providerInstallLinks.length ? (
                          <div className="instant-provider-install-links">
                            {providerInstallLinks.map((link) => (
                              <a href={link.href} key={link.href} rel="noreferrer" target="_blank">
                                <span>{t(link.labelKey)}</span>
                                <span className="material-symbols-outlined">open_in_new</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
                {instantProviderDrawer === "pushdeer" ? <p className="instant-provider-caution">{t("notification.pushdeerMaintenanceNote")}</p> : null}
              </section>
              <div className="menu-pref-list instant-provider-form">
                <label className="menu-pref-field">
                  <span>{t(`notification.providerTarget.${instantProviderDrawer}` as TranslationKey)}</span>
                  <input className="input" disabled={instantSaving || Boolean(instantVerificationId)} inputMode={instantProviderDrawer === "pushdeer" ? "text" : "url"} onChange={(event) => setInstantTarget(event.target.value)} placeholder={instantProviderDrawer === "bark" ? "https://api.day.app/..." : instantProviderDrawer === "ntfy" ? "https://ntfy.sh/topic" : instantProviderDrawer === "pushdeer" ? "PDU..." : "https://push.example.com"} value={instantTarget} />
                </label>
                {instantProviderDrawer !== "bark" ? (
                  <label className="menu-pref-field">
                    <span>{instantProviderDrawer === "gotify" ? t("notification.appToken") : instantProviderDrawer === "pushdeer" ? t("notification.pushdeerServerOptional") : t("notification.accessTokenOptional")}</span>
                    <input className="input" disabled={instantSaving || Boolean(instantVerificationId)} inputMode={instantProviderDrawer === "pushdeer" ? "url" : "text"} onChange={(event) => setInstantSecret(event.target.value)} placeholder={instantProviderDrawer === "pushdeer" ? "https://push.example.com" : undefined} type={instantProviderDrawer === "pushdeer" ? "url" : "password"} value={instantSecret} />
                  </label>
                ) : null}
                {instantVerificationId ? (
                  <div className="instant-verification-step">
                    <span>{t("notification.enterReceiverCode")}</span>
                    <VerificationCodeInput ariaLabel={t("notification.enterReceiverCode")} disabled={instantSaving} onChange={setInstantCode} value={instantCode} />
                    <button className="button" disabled={instantSaving || instantCode.length !== 6} onClick={() => void bindInstantEndpoint()} type="button">{t("common.done")}</button>
                  </div>
                ) : (
                  <button className="button" disabled={instantSaving || !instantTarget.trim() || (instantProviderDrawer === "gotify" && !instantSecret.trim())} onClick={() => void sendInstantCode()} type="button">{endpoint ? t("notification.reconnect") : t("notification.sendTestCode")}</button>
                )}
              </div>
              {endpoint ? <button className="instant-provider-remove" disabled={instantSaving} onClick={() => void removeInstantEndpoint(endpoint)} type="button">{t("contact.unbind")}</button> : null}
            </div>
          );
        })() : null}
      </SideDrawer>
      <SideDrawer
        historyKey="bark-guide"
        onRouteOpen={() => setBarkGuideOpen(true)}
        open={barkGuideOpen}
        onClose={closeBarkGuide}
        title={t("bark.bind")}
      >
        <div className="bark-guide">
          <div className="bark-guide-app">
            <BarkGuideIcon />
            <div>
              <strong>Bark</strong>
              <span>{t("bark.receiveInstant")}</span>
            </div>
            <span className="bark-guide-duration">{t("bark.aboutOneMinute")}</span>
          </div>

          <ol className="bark-guide-steps">
            <li className="bark-guide-step">
              <span className="bark-guide-index">1</span>
              <div className="bark-guide-step-content">
                <strong>{t("bark.download")}</strong>
                <p>{t("bark.allowNotifications")}</p>
                <a className="bark-store-link" href={barkAppStoreUrl} rel="noreferrer" target="_blank">
                  {t("bark.openAppStore")}
                  <span className="material-symbols-outlined">chevron_right</span>
                </a>
              </div>
            </li>
            <li className="bark-guide-step">
              <span className="bark-guide-index">2</span>
              <div className="bark-guide-step-content">
                <strong>{t("bark.copyLink")}</strong>
                <p>{t("bark.copyLinkHint")}</p>
                <code className="bark-guide-link-example">https://api.day.app/••••••</code>
              </div>
            </li>
            <li className="bark-guide-step is-action">
              <span className="bark-guide-index">3</span>
              <div className="bark-guide-step-content bark-guide-bind">
                <strong>{authPending ? t("auth.enterCode") : t("bark.pasteLink")}</strong>
                <p>{authPending ? t("bark.codeSent") : t("bark.pasteHint")}</p>
                <div className="simple-form contact-sheet-form">
                  <label className="field-label" htmlFor="bark-endpoint">{t("bark.pushLink")}</label>
                  <input
                    id="bark-endpoint"
                    className="input"
                    inputMode="url"
                    placeholder="https://api.day.app/..."
                    value={authTarget}
                    onChange={(event) => {
                      setAuthTarget(event.target.value);
                      setAuthCode("");
                      setAuthPending(false);
                      setAuthExpiresIn(0);
                    }}
                  />
                  <button
                    className="button contact-flow-primary"
                    disabled={authActionState === "sending" || !authTarget.trim() || authCooldown > 0}
                    onClick={() => void sendAuthCode()}
                    type="button"
                  >
                    {authActionState === "sending" ? t("common.sending") : authCooldown > 0 ? t("auth.retryIn", { seconds: authCooldown }) : t("auth.sendCode")}
                  </button>
                  <div className={`contact-verify-block ${authPending ? "is-visible" : ""}`}>
                    <div className="field-label-row">
                      <label className="field-label">{t("recovery.code")}</label>
                      {authPending && authExpiresIn > 0 ? <span className="field-countdown">{t("auth.validFor", { seconds: authExpiresIn })}</span> : null}
                    </div>
                    <VerificationCodeInput ariaLabel={t("recovery.code")} value={authCode} onChange={setAuthCode} />
                    <button
                      className="button contact-flow-primary"
                      disabled={authActionState === "binding" || authCode.length !== 6}
                      onClick={() => void bindAuthChannel()}
                      type="button"
                    >
                      {authActionState === "binding" ? t("common.processing") : t("bark.confirmBind")}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </SideDrawer>

      <BottomSheet
        bodyClassName="contact-sheet-body"
        className="contact-bottom-sheet"
        open={Boolean(authSheetChannel && authSheetChannel !== "bark")}
        title={authSheetChannel === "email" ? t("contact.verifyEmail") : authSheetChannel === "sms" ? t("contact.bindPhone") : authSheetChannel === "bark" ? t("contact.bindInstant") : t("contact.bindContact")}
        onClose={closeAuthSheet}
      >
        {authSheetChannel ? (
          <div ref={authSheetBodyRef} className="simple-form contact-sheet-form">
            <div className="field-label-row">
              <label className="field-label">{authSheetChannel === "email" ? t("contact.emailAddress") : authSheetChannel === "sms" ? t("contact.phoneNumber") : t("contact.targetAddress")}</label>
              {authPending && authExpiresIn > 0 ? <span className="field-countdown">{t("auth.codeValidFor", { seconds: authExpiresIn })}</span> : null}
            </div>
            <input
              className="input"
              autoComplete={authSheetChannel === "email" ? "email" : authSheetChannel === "sms" ? "tel" : "off"}
              inputMode={authSheetChannel === "email" ? "email" : authSheetChannel === "sms" ? "tel" : "url"}
              maxLength={authSheetChannel === "sms" ? 24 : undefined}
              placeholder={authSheetChannel === "email" ? "you@sermo.space" : authSheetChannel === "sms" ? "+86 138 0000 0000" : t("contact.instantAddressPlaceholder")}
              value={authTarget}
              onChange={(event) => {
                setAuthTarget(event.target.value);
                setAuthCode("");
                setAuthPending(false);
                setAuthExpiresIn(0);
              }}
            />
            <div className="contact-flow-actions">
              <button
                className="button contact-flow-primary"
                disabled={authActionState === "sending" || !authTarget.trim() || authCooldown > 0}
                onClick={() => void sendAuthCode()}
                type="button"
              >
                {authActionState === "sending" ? t("common.sending") : authCooldown > 0 ? t("auth.retryIn", { seconds: authCooldown }) : t("auth.sendCode")}
              </button>
            </div>
            <div ref={authVerifyRef} className={`contact-verify-block ${authPending ? "is-visible" : ""}`}>
              <label className="field-label">{t("recovery.code")}</label>
              <VerificationCodeInput ariaLabel={t("recovery.code")} value={authCode} onChange={setAuthCode} />
              <div className="contact-flow-actions">
                <button
                  className="button contact-flow-primary"
                  disabled={authActionState === "binding" || authCode.length !== 6}
                  onClick={() => void bindAuthChannel()}
                  type="button"
                >
                  {authActionState === "binding" ? t("common.processing") : authSheetChannel === "email" ? t("contact.confirmVerify") : t("contact.confirmBind")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <BottomSheet
        bodyClassName="contact-sheet-body"
        className="contact-bottom-sheet"
        open={unbindVerifyOpen}
        title={t("contact.verifyCurrent", { channel: unbindChannel ? contactLabel(unbindChannel) : t("contact.method") })}
        onClose={() => {
          if (unbindState !== "idle") return;
          setUnbindVerifyOpen(false);
          setUnbindChannel(null);
        }}
      >
        {unbindChannel && unbindChannel !== "bark" ? (
          <div className="simple-form contact-sheet-form">
            <div className="menu-unbind-current">
              <span>{t("contact.currentBinding")}</span>
              <strong>{contactValue(unbindChannel)}</strong>
            </div>
            <button
              className="secondary-button contact-flow-primary"
              disabled={unbindState !== "idle" || unbindCooldown > 0}
              onClick={() => void sendUnbindCode()}
              type="button"
            >
              {unbindState === "sending" ? t("common.sending") : unbindCooldown > 0 ? t("auth.retryIn", { seconds: unbindCooldown }) : t("auth.sendCode")}
            </button>
            <label className="field-label">{t("recovery.code")}</label>
            <VerificationCodeInput ariaLabel={t("recovery.code")} value={unbindCode} onChange={setUnbindCode} />
            <button
              className="danger-button contact-flow-primary"
              disabled={unbindState !== "idle" || unbindCode.length !== 6}
              onClick={() => void submitUnbind()}
              type="button"
            >
              {unbindState === "removing" ? t("contact.unbinding") : t("contact.confirmUnbind")}
            </button>
          </div>
        ) : null}
      </BottomSheet>
      <BottomSheet
        bodyClassName="menu-security-sheet-body"
        className="contact-bottom-sheet"
        open={passwordSheetOpen}
        title={hasPassword ? t("password.change") : t("password.setup")}
        onClose={() => {
          if (passwordSaving) return;
          setPasswordSheetOpen(false);
        }}
      >
        <div className="simple-form menu-security-form">
          {hasPassword ? (
            <div className="menu-security-field">
              <label className="field-label">{t("password.current")}</label>
              <input className="input" type="password" value={passwordCurrent} onChange={(event) => setPasswordCurrent(event.target.value)} />
            </div>
          ) : null}
          <div className="menu-security-field">
            <label className="field-label">{hasPassword ? t("recovery.newPassword") : t("password.setup")}</label>
            <input className="input" type="password" value={passwordNext} onChange={(event) => setPasswordNext(event.target.value)} />
          </div>
          <button
            className="button"
            disabled={passwordSaving || !passwordNext.trim() || (hasPassword && !passwordCurrent.trim())}
            onClick={() => void savePassword()}
            type="button"
          >
            {passwordSaving ? t("common.processing") : hasPassword ? t("password.confirmChange") : t("password.confirmSetup")}
          </button>
        </div>
      </BottomSheet>
      {gestureSheetOpen ? (
        <GestureSetupPanel
          scope={gestureScope}
          canEnable={emailVerified}
          preference={gesturePreference}
          onClose={() => setGestureSheetOpen(false)}
          onChanged={setGesturePreference}
        />
      ) : null}
      <AvatarPresetDialog
        currentAvatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
        displayName={session?.user.name ?? t("brand.user")}
        onClose={() => setAvatarDialogOpen(false)}
        onRouteOpen={() => setAvatarDialogOpen(true)}
        customUploadEnabled={canUploadCustomAvatar && hasPassword}
        customUploadHint={!canUploadCustomAvatar ? t("avatar.unlockAtLevel", { level: 4 }) : t("avatar.setPasswordToUpload")}
        onRequestCustomUpload={requestCustomAvatarUpload}
        onSave={savePresetAvatar}
        open={avatarDialogOpen}
        saving={avatarSaving}
      />
      <input
        ref={avatarFileInputRef}
        accept="image/*"
        hidden
        onChange={(event) => void handleCustomAvatarChange(event)}
        type="file"
      />
      <InputDialog
        busy={basicEditSaving}
        confirmLabel={t("profile.saveNickname")}
        maxLength={MAX_NICKNAME_LENGTH}
        description={t("profile.nicknameLengthHint", { count: MAX_NICKNAME_LENGTH })}
        onChange={setBasicEditValue}
        onClose={() => setBasicEditField(null)}
        onConfirm={() => void confirmBasicEdit()}
        open={Boolean(basicEditField)}
        placeholder={t("profile.nicknamePlaceholder")}
        title={t("profile.editNickname")}
        value={basicEditValue}
      />
      <WelcomeMessageEditor
        avatarCacheKey={me?.avatar_cache_key}
        avatarFrameStyle={me?.avatar_frame_style ?? session?.user.avatar_frame_style}
        avatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
        backgroundTheme={me?.chat_background_theme ?? session?.user.chat_background_theme}
        backgroundUri={me?.chat_background_uri ?? session?.user.chat_background_uri}
        bubbleStyle={me?.chat_bubble_style ?? session?.user.chat_bubble_style}
        isPermanentVip={me?.is_permanent_vip ?? session?.user.is_permanent_vip}
        name={session?.user.name ?? t("brand.user")}
        onClose={() => setWelcomeEditorOpen(false)}
        onSaved={(payload) => {
          setMe((current) => current ? { ...current, welcome_message: payload.welcome_message } : current);
          patchSessionUser({ welcome_message: payload.welcome_message });
        }}
        open={welcomeEditorOpen}
        userId={session?.user.user_id ?? -1}
      />
      <ConfirmDialog
        danger
        open={accountDeleteStep === "intro"}
        title={t("account.deleteConfirmTitle")}
        description={t("account.deleteConfirmHint")}
        confirmLabel={t("account.continueDelete")}
        onClose={() => setAccountDeleteStep(null)}
        onConfirm={() => {
          setAccountDeleteInput("");
          setAccountDeleteStep("verify");
        }}
      />
      <InputDialog
        busy={accountDeleteSaving}
        confirmLabel={t("common.next")}
        onChange={setAccountDeleteInput}
        onClose={() => setAccountDeleteStep(null)}
        onConfirm={confirmAccountDeleteInput}
        open={accountDeleteStep === "verify"}
        placeholder={hasPassword ? t("password.currentPlaceholder") : t("account.nicknameConfirmPlaceholder", { name: session?.user.name ?? "" })}
        title={hasPassword ? t("password.verifyCurrent") : t("account.nicknameConfirm")}
        type={hasPassword ? "password" : "text"}
        value={accountDeleteInput}
      />
      <ConfirmDialog
        danger
        busy={accountDeleteSaving}
        open={accountDeleteStep === "final"}
        title={t("account.finalConfirm")}
        description={t("account.finalDeleteHint")}
        confirmLabel={t("account.confirmDelete")}
        onClose={() => {
          if (!accountDeleteSaving) setAccountDeleteStep(null);
        }}
        onConfirm={() => void deleteAccount()}
      />
      {prefEditor ? (
        <div
          className="dialog-backdrop notification-editor-backdrop"
          onClick={() => {
            if (!prefEditorSaving) setPrefEditor(null);
          }}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="notification-editor-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="notification-editor-heading">
              <div>
                <h2>{t("notification.offlineThreshold")}</h2>
                <p>{t("notification.thresholdHint")}</p>
              </div>
              <button className="icon-button" disabled={prefEditorSaving} onClick={() => setPrefEditor(null)} type="button" aria-label={t("common.close")}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="notification-threshold-editor">
              <strong>{formatThreshold(Number(prefEditorValue))}</strong>
              <div className="notification-threshold-options" role="group" aria-label={t("notification.offlineThreshold")}>
                {prefs[prefEditor.channel].thresholdOptions.map((threshold) => (
                  <button
                    aria-pressed={Number(prefEditorValue) === threshold}
                    className={Number(prefEditorValue) === threshold ? "is-selected" : ""}
                    disabled={prefEditorSaving}
                    key={threshold}
                    onClick={() => setPrefEditorValue(String(threshold))}
                    type="button"
                  >
                    {formatThreshold(threshold)}
                  </button>
                ))}
              </div>
            </div>
            <div className="notification-editor-actions">
              <button className="ghost-button" disabled={prefEditorSaving} onClick={() => setPrefEditor(null)} type="button">{t("common.cancel")}</button>
              <button className="button" disabled={prefEditorSaving} onClick={() => void savePreferenceEditor()} type="button">
                {prefEditorSaving ? t("common.savingPlain") : t("common.save")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <ConfirmDialog
        busy={unbindState === "removing"}
        danger
        open={unbindConfirmOpen}
        title={t("contact.unbindConfirmTitle", { channel: unbindChannel ? contactLabel(unbindChannel) : t("contact.method") })}
        description={
          unbindChannel === "sms"
            ? t("contact.phoneUnbindConfirm")
            : unbindChannel === "email"
              ? t("contact.emailUnbindConfirm")
              : t("contact.barkUnbindConfirm")
        }
        confirmLabel={unbindChannel === "bark" ? t("contact.confirmUnbind") : t("contact.continueVerify")}
        onClose={() => {
          if (unbindState === "removing") return;
          setUnbindConfirmOpen(false);
          setUnbindChannel(null);
        }}
        onConfirm={() => void confirmUnbind()}
      />
      <ConfirmDialog
        open={passwordReminderOpen}
        title={t("password.setupFirstTitle")}
        description={passwordReminderDescription}
        confirmLabel={t("password.setupNow")}
        onClose={() => setPasswordReminderOpen(false)}
        onConfirm={() => {
          setPasswordReminderOpen(false);
          setSecurityDrawerOpen(true);
        }}
      />
      <ConfirmDialog
        danger
        open={leaveConfirmOpen}
        title={t("space.leaveConfirmTitle")}
        description={t("space.leaveConfirmHint")}
        confirmLabel={t("space.confirmLeave")}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          void leave();
        }}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
