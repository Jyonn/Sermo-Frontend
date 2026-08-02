import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import barkAppIconUrl from "../assets/bark-app-icon.jpg";
import appleMailIconUrl from "../assets/apple-mail-icon.jpg";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { GestureSetupPanel } from "../components/GestureLock";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { ChatBackgroundUploadError, uploadChatBackground } from "../lib/chatBackgroundUpload";
import { useAuth } from "../lib/auth";
import { useAdminAuth } from "../lib/adminAuth";
import { normalizeContactTarget } from "../lib/contactTarget";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import { getWebReminderPreferences, mapWebReminderPreferences, setWebReminderPreferences, type WebReminderPreferences } from "../lib/webReminderPreferences";
import { getGestureLockAfterMinutes, getGestureLockScope } from "../lib/gestureLock";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { ForwardArrowIcon } from "../components/ForwardArrowIcon";
import { TabPageHeader } from "../components/TabPageHeader";
import { TravelMapDrawer } from "../components/TravelMapDrawer";
import { PwaInstallSheet } from "../components/PwaInstallSheet";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { isStandalonePwa } from "../lib/pwaInstall";
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from "../lib/webPush";
import type { AppViewState, ChatBackgroundTheme, ChatBubbleStyle, GestureLockPreferenceDTO, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences, PersonalizationDTO, SpaceDTO, SwitchAccountDTO, UserMeDTO } from "../types";
import { getActiveLocale, i18n, useI18n, type LanguagePreference, type TranslationKey } from "../lib/language";
import { useTheme, type ThemePreference } from "../lib/theme";

const channelRows: Array<[NotificationChannel, number, TranslationKey]> = [
  ["email", 1, "channel.email"],
  ["sms", 2, "channel.sms"],
  ["bark", 3, "channel.instant"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true, barkIconMode: 1 },
  sms: { enabled: false, threshold: 15, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true, barkIconMode: 1 },
  bark: { enabled: false, threshold: 5, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true, barkIconMode: 1 },
};

const barkAppStoreUrl = "https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%8E%A8%E9%80%81/id1403753865";
const growthLevelScores = [0, 20, 45, 80, 130, 200, 300, 440, 620, 850, 1150, 1530, 2000, 2580, 3300, 4180, 5250, 6550];
const growthLevelUnlockKeys: Record<number, TranslationKey[]> = {
  1: ["growth.unlockBasic"],
  2: ["growth.unlockImages"],
  3: ["growth.unlockAudioLocation", "growth.unlockLevelTag"],
  4: ["growth.unlockCustomAvatar", "growth.unlockCreateGroup"],
  5: ["growth.unlockVideo", "growth.unlockGroupName", "growth.unlockAnnualNickname"],
  6: ["growth.unlockWelcome", "growth.unlockPlazaGreeting", "growth.unlockMonthlyNickname", "growth.unlockShowcase"],
  7: ["growth.unlockOnlineReminder", "growth.unlockWeeklyNickname"],
  8: ["growth.unlockAudioDownload", "growth.unlockChatBackground"],
  9: ["growth.unlockAvatarFrame"],
  10: ["growth.unlockPlazaHalo", "growth.unlockNotificationText"],
  11: ["growth.unlockBubbleTheme"],
  12: ["growth.unlockProfileTheme"],
  14: ["growth.unlockMotionTrail"],
  15: ["growth.unlockEntrance"],
  16: ["growth.unlockReport"],
  17: ["growth.unlockRareFrame"],
  18: ["growth.unlockFinalBadge"],
};
const personalizationOptions = {
  chat_bubble_style: [
    ["default", "menu.styleDefault"],
    ["comic", "menu.styleComic"],
    ["zen", "menu.styleZen"],
    ["hero", "menu.styleHero"],
    ["dragon", "menu.styleDragon"],
    ["bauhaus", "menu.styleBauhaus"],
    ["mosaic", "menu.styleMosaic"],
    ["pebble", "menu.stylePebble"], ["leaf", "menu.styleLeaf"], ["cloud", "menu.styleCloud"], ["ice", "menu.styleIce"], ["lava", "menu.styleLava"],
    ["typewriter", "menu.styleTypewriter"], ["newspaper", "menu.styleNewspaper"], ["receipt", "menu.styleReceipt"], ["postcard", "menu.stylePostcard"], ["blueprint", "menu.styleBlueprint"],
    ["terminal", "menu.styleTerminal"], ["hologram", "menu.styleHologram"], ["mech", "menu.styleMech"], ["synthwave", "menu.styleSynthwave"], ["orbital", "menu.styleOrbital"],
    ["sticker", "menu.styleSticker"], ["candy", "menu.styleCandy"], ["toybrick", "menu.styleToybrick"], ["doodle", "menu.styleDoodle"], ["plush", "menu.stylePlush"],
    ["vip", "menu.styleVip"],
  ],
  avatar_frame_style: [
    ["none", "menu.frameNone"],
    ["orbit", "menu.frameOrbit"],
    ["aurora", "menu.frameAurora"],
    ["polaroid", "menu.framePolaroid"],
    ["soundwave", "menu.frameSoundwave"],
    ["portal", "menu.framePortal"],
    ["butterfly", "menu.frameButterfly"], ["moon", "menu.frameMoon"],
    ["camera", "menu.frameCamera"],
    ["comet", "menu.frameComet"], ["snowfall", "menu.frameSnowfall"],
    ["papercut", "menu.framePapercut"], ["mechanical", "menu.frameMechanical"],
  ],
  square_outfit_style: [["sunset", "menu.outfitSunset"], ["varsity", "menu.outfitVarsity"], ["noir", "menu.outfitNoir"], ["cloud", "menu.outfitCloud"]],
  square_prop_style: [["none", "menu.propNone"], ["star", "menu.propStar"], ["coffee", "menu.propCoffee"], ["flag", "menu.propFlag"]],
  square_motion_style: [["walk", "menu.motionWalk"], ["bounce", "menu.motionBounce"], ["float", "menu.motionFloat"], ["dash", "menu.motionDash"]],
  square_limb_style: [["line", "menu.limbLine"], ["chunky", "menu.limbChunky"], ["robot", "menu.limbRobot"], ["ribbon", "menu.limbRibbon"]],
} as const;

const chatBackgroundSections: Array<{ label: TranslationKey; items: Array<[Exclude<ChatBackgroundTheme, "custom">, TranslationKey]> }> = [
  {
    label: "menu.collectionEssential",
    items: [["default", "menu.themeDefault"], ["paper", "menu.themePaper"], ["mint", "menu.themeMint"], ["dusk", "menu.themeDusk"]],
  },
  {
    label: "menu.collectionCulture",
    items: [["comic", "menu.themeComic"], ["zen", "menu.themeZen"], ["hero", "menu.themeHero"], ["dragon", "menu.themeDragon"], ["bauhaus", "menu.themeBauhaus"], ["mosaic", "menu.themeMosaic"]],
  },
  { label: "menu.collectionNature", items: [["tidepool", "menu.themeTidepool"], ["forest", "menu.themeForest"], ["desert", "menu.themeDesert"], ["snowfield", "menu.themeSnowfield"], ["sakura", "menu.themeSakura"]] },
  { label: "menu.collectionAtmosphere", items: [["sunrise", "menu.themeSunrise"], ["midnight", "menu.themeMidnight"], ["rain", "menu.themeRain"], ["galaxy", "menu.themeGalaxy"], ["aurora-sky", "menu.themeAuroraSky"]] },
  { label: "menu.collectionMaterial", items: [["linen", "menu.themeLinen"], ["terrazzo", "menu.themeTerrazzo"], ["blueprint", "menu.themeBlueprint"], ["newsprint", "menu.themeNewsprint"], ["hologram", "menu.themeHologram"]] },
  { label: "menu.collectionFantasy", items: [["arcade", "menu.themeArcade"], ["jazz", "menu.themeJazz"], ["spaceport", "menu.themeSpaceport"], ["candy", "menu.themeCandy"], ["noir-film", "menu.themeNoirFilm"]] },
];

const chatBubbleSections: Array<{ label: TranslationKey; items: Array<typeof personalizationOptions.chat_bubble_style[number]> }> = [
  { label: "menu.collectionClassic", items: personalizationOptions.chat_bubble_style.filter(([value]) => value === "default" || value === "comic") },
  { label: "menu.collectionCulture", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["zen", "hero", "dragon", "bauhaus", "mosaic"].includes(value)) },
  { label: "menu.collectionOrganic", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["pebble", "leaf", "cloud", "ice", "lava"].includes(value)) },
  { label: "menu.collectionEditorial", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["typewriter", "newspaper", "receipt", "postcard", "blueprint"].includes(value)) },
  { label: "menu.collectionFuture", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["terminal", "hologram", "mech", "synthwave", "orbital"].includes(value)) },
  { label: "menu.collectionPlayful", items: personalizationOptions.chat_bubble_style.filter(([value]) => ["sticker", "candy", "toybrick", "doodle", "plush"].includes(value)) },
  { label: "menu.collectionIdentity", items: personalizationOptions.chat_bubble_style.filter(([value]) => value === "vip") },
];

const avatarFrameSections: Array<{ label: TranslationKey; items: Array<typeof personalizationOptions.avatar_frame_style[number]> }> = [
  { label: "menu.collectionClassic", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["none", "orbit", "polaroid"].includes(value)) },
  { label: "menu.collectionMotion", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["aurora", "soundwave", "portal", "comet"].includes(value)) },
  { label: "menu.collectionNature", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["butterfly", "moon", "snowfall"].includes(value)) },
  { label: "menu.collectionCraft", items: personalizationOptions.avatar_frame_style.filter(([value]) => ["camera", "papercut", "mechanical"].includes(value)) },
];

function visibleBubbleStyle(style?: string) {
  return personalizationOptions.chat_bubble_style.some(([value]) => value === style) ? style as ChatBubbleStyle : "default";
}

type BubblePreviewKind = "text" | "image" | "audio" | "video" | "file" | "location" | "travel" | "link";

function BubblePreviewContent({ avatarName, from, kind, t }: { avatarName: string; from: "self" | "other"; kind: BubblePreviewKind; t: ReturnType<typeof useI18n>["t"] }) {
  const groupClassName = `${from} group-start group-end`;
  if (kind === "text") {
    return (
      <div className={`message-bubble has-reply ${groupClassName}`}>
        <button className="message-reply-preview" type="button">
          <strong>{from === "self" ? avatarName : t("common.me")}</strong>
          <span>{from === "self" ? t("menu.bubblePreviewOther") : t("menu.bubblePreviewSelf")}</span>
        </button>
        {from === "self" ? t("menu.bubblePreviewSelf") : t("menu.bubblePreviewOther")}
      </div>
    );
  }
  if (kind === "image" || kind === "video") {
    return (
      <div className={`message-bubble is-media ${groupClassName}`}>
        <div className={`message-media-frame personalization-live-media type-${kind} ${groupClassName}`}>
          <i />
          {kind === "video" ? (
            <>
              <span className="message-video-shade" />
              <span className="message-video-play"><span className="material-symbols-outlined">play_arrow</span></span>
              <span className="personalization-live-video-time">0:28</span>
            </>
          ) : null}
        </div>
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className={`message-bubble is-media ${groupClassName}`}>
        <div className={`message-audio-card ${groupClassName}`}>
          <span className="message-audio-play"><span className="material-symbols-outlined">play_arrow</span></span>
          <span className="message-audio-body">
            <span className="message-audio-head"><span className="message-audio-meta">0:12</span></span>
            <span className="message-audio-wave">
              {[8, 15, 21, 12, 18, 10, 16, 7].map((height, index) => <i className="message-audio-wave-bar" key={index} style={{ height }} />)}
            </span>
            <span className="message-audio-progress">0:00 / 0:12</span>
          </span>
        </div>
      </div>
    );
  }
  if (kind === "file") {
    return (
      <div className={`message-bubble is-media ${groupClassName}`}>
        <div className={`message-file-card ${groupClassName}`}>
          <span className="message-file-icon"><span className="material-symbols-outlined">description</span></span>
          <span className="message-file-copy"><strong>{t("menu.bubblePreviewFile")}</strong><small>2.4 MB</small></span>
          <span className="message-file-open">↗</span>
        </div>
      </div>
    );
  }
  if (kind === "location") {
    return (
      <div className={`message-bubble is-media is-location ${groupClassName}`}>
        <div className={`message-location-card ${groupClassName}`}>
          <span className="message-location-mark"><span className="material-symbols-outlined">location_on</span></span>
          <span className="message-location-copy"><strong>{t("menu.bubblePreviewLocation")}</strong><small>{t("location.viewOnMap")}</small></span>
          <span className="message-location-open">↗</span>
        </div>
      </div>
    );
  }
  if (kind === "travel") {
    return (
      <div className={`message-bubble is-travel-map ${groupClassName}`}>
        <div className={`message-travel-map-card ${groupClassName}`}>
          <span className="message-travel-map-art"><span className="material-symbols-outlined">map</span></span>
          <span className="message-travel-map-copy"><strong>{t("travelMap.messageJoin")}</strong><span>{t("travelMap.tapToAuthorize")}</span></span>
          <span className="message-travel-map-arrow">→</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`message-bubble is-link-preview ${groupClassName}`}>
      <span className={`message-text-stack has-link-preview ${groupClassName}`}>
        <span className="message-link-preview-card has-image">
          <span className="message-link-preview-text">
            <small className="message-link-preview-site">SERMO</small>
            <strong className="message-link-preview-title">{t("menu.bubblePreviewLink")}</strong>
            <span className="message-link-preview-desc">{t("menu.bubblePreviewLinkHint")}</span>
          </span>
          <span className="message-link-preview-image personalization-live-link-image" />
        </span>
      </span>
    </div>
  );
}

function ChatBubblePreview({
  avatarName,
  avatarUri,
  style,
}: {
  avatarName: string;
  avatarUri?: string;
  style: string;
}) {
  const { t } = useI18n();
  const kinds: BubblePreviewKind[] = ["text", "image", "audio", "video", "file", "location", "travel", "link"];
  return (
    <section className="personalization-chat-preview chat-background-default">
      <header className="personalization-chat-preview-header">
        <div className="chat-conversation-topbar">
          <span className="material-symbols-outlined personalization-chat-preview-back">arrow_back</span>
          <UserAvatar className="avatar" name={avatarName} uri={avatarUri} />
          <div className="chat-topbar-meta">
            <strong className="chat-topbar-name">{avatarName}</strong>
            <span className="chat-topbar-status">{t("presence.online")}</span>
          </div>
        </div>
        <span className="material-symbols-outlined">more_vert</span>
      </header>
      <div className="personalization-chat-preview-scroll message-scroll">
        <div className="day-divider">{t("menu.bubblePreviewToday")}</div>
        {kinds.flatMap((kind) => (["other", "self"] as const).map((from) => (
          <div className={`message-group ${from} bubble-style-${style}`} key={`${kind}:${from}`}>
            {from === "other" ? <UserAvatar className="avatar message-avatar" name={avatarName} uri={avatarUri} /> : null}
            <div className="message-bubbles">
              <div className={`message-bubble-wrap ${from} is-sent`}>
                <div className={`message-bubble-shell ${from}`}>
                  <BubblePreviewContent avatarName={avatarName} from={from} kind={kind} t={t} />
                </div>
              </div>
            </div>
          </div>
        )))}
        <div className={`message-group self bubble-style-${style}`}>
          <div className="message-bubbles">
            <div className="message-bubble-wrap self is-pending">
              <div className="message-bubble-shell self">
                <div className="message-bubble self group-start group-end is-pending">{t("menu.bubblePreviewSending")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="personalization-chat-preview-composer composer">
        <span className="material-symbols-outlined">mic</span>
        <span className="personalization-chat-preview-input">{t("chat.inputPlaceholder")}</span>
        <span className="material-symbols-outlined">add</span>
      </div>
    </section>
  );
}

type NotificationMessageKind = "direct" | "group" | "online";
type PreferenceEditor =
  | { type: "threshold"; channel: NotificationChannel }
  | { type: "message"; channel: NotificationChannel; kind: NotificationMessageKind; field: "title" | "content" };

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
      threshold: row.offline_threshold_minutes,
      hideMessageContent: row.hide_message_content,
      hiddenDirectMessageTitle: row.hidden_direct_message_title ?? "",
      hiddenDirectMessageText: row.hidden_direct_message_text ?? "",
      hiddenGroupMessageTitle: row.hidden_group_message_title ?? "",
      hiddenGroupMessageText: row.hidden_group_message_text ?? "",
      friendOnlineMessageTitle: row.friend_online_message_title ?? "",
      friendOnlineMessageText: row.friend_online_message_text ?? "",
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
  return me.bark ?? "";
}

function channelVerified(me: UserMeDTO | null, channel: NotificationChannel) {
  if (!me) return false;
  if (channel === "email") return Boolean(me.email_verified_at);
  if (channel === "sms") return Boolean(me.phone_verified_at);
  return Boolean(me.bark_verified_at);
}

function detectAppleEnvironment() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const userAgentDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || "";
  const value = `${userAgent} ${platform} ${userAgentDataPlatform}`.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(value);
  const isMac = /macintosh|mac os x|macintel|mac/.test(value);
  return isIOS || isMac;
}

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

export default function MenuPage() {
  const { t, preference: languagePreference, setPreference: setLanguagePreference, saving: languageSaving } = useI18n();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, patchSessionUser } = useAuth();
  const { setSession: setAdminSession } = useAdminAuth();
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
  const [webReminderDrawerOpen, setWebReminderDrawerOpen] = useState(false);
  const [webReminderPrefs, setWebReminderPrefs] = useState<WebReminderPreferences>(() => getWebReminderPreferences());
  const [webPushState, setWebPushState] = useState<WebPushState>("checking");
  const [webPushSaving, setWebPushSaving] = useState(false);
  const [pwaInstallSheetOpen, setPwaInstallSheetOpen] = useState(false);
  const [travelMapOpen, setTravelMapOpen] = useState(false);
  const [growthDrawerOpen, setGrowthDrawerOpen] = useState(false);
  const [growthLevelsOpen, setGrowthLevelsOpen] = useState(false);
  const [vipClaiming, setVipClaiming] = useState(false);
  const [activeGrowthGuideLevel, setActiveGrowthGuideLevel] = useState(1);
  const [chatBackgroundDrawerOpen, setChatBackgroundDrawerOpen] = useState(false);
  const [chatBubbleDrawerOpen, setChatBubbleDrawerOpen] = useState(false);
  const [avatarFrameDrawerOpen, setAvatarFrameDrawerOpen] = useState(false);
  const [squareCharacterDrawerOpen, setSquareCharacterDrawerOpen] = useState(false);
  const [squareCharacterTab, setSquareCharacterTab] = useState<"outfit" | "prop" | "motion">("outfit");
  const [personalizationDrawerOpen, setPersonalizationDrawerOpen] = useState(false);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);
  const [chatBackgroundSaving, setChatBackgroundSaving] = useState(false);
  const [chatBackgroundDraft, setChatBackgroundDraft] = useState<ChatBackgroundTheme>("default");
  const [personalizationDraft, setPersonalizationDraft] = useState<PersonalizationDTO>({
    chat_bubble_style: "default",
    avatar_frame_style: "none",
    square_outfit_style: "sunset",
    square_prop_style: "none",
    square_motion_style: "walk",
    square_limb_style: "line",
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
  const [prefCustomDrawerOpen, setPrefCustomDrawerOpen] = useState(false);
  const [prefEditor, setPrefEditor] = useState<PreferenceEditor | null>(null);
  const [prefEditorValue, setPrefEditorValue] = useState("");
  const [prefEditorSaving, setPrefEditorSaving] = useState(false);
  const [authSheetChannel, setAuthSheetChannel] = useState<NotificationChannel | null>(null);
  const [basicEditField, setBasicEditField] = useState<"name" | "welcome" | "plaza" | null>(null);
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
  const pwaGrowthClaimedRef = useRef(false);
  const growthLevelTrackRef = useRef<HTMLDivElement | null>(null);
  const accountSwitcherRouteHandledRef = useRef(false);
  const cacheScope = buildTabCacheScope(session?.user.space_id, currentUserId);
  const hasPassword = Boolean(me?.has_password ?? session?.user.has_password);
  const hasGrowthCapability = (key: string, fallbackLevel: number) =>
    me?.growth?.capabilities?.[key]?.available ?? (me?.growth?.level ?? 1) >= fallbackLevel;
  const canUploadCustomAvatar = hasGrowthCapability("custom_avatar", 4);
  const canRenameNickname = hasGrowthCapability("rename_nickname", 5);
  const canEditWelcome = hasGrowthCapability("welcome_message", 6);
  const canEditPlazaGreeting = hasGrowthCapability("plaza_greeting", 6);
  const canCustomizeChatBackground = hasGrowthCapability("chat_background", 8);
  const canCustomizeNotificationMessage =
    Boolean(me?.is_permanent_vip ?? session?.user.is_permanent_vip)
    || hasGrowthCapability("custom_notification_message", 10);
  const gestureScope = useMemo(() => getGestureLockScope(session), [session]);
  const emailVerified = Boolean(me ? me.email_verified_at : session?.user.email_verified_at);
  const phoneVerified = Boolean(me ? me.phone_verified_at : session?.user.phone_verified_at);
  const isAppleEnvironment = useMemo(() => detectAppleEnvironment(), []);
  const visibleChannelRows = useMemo(
    () => channelRows.filter(([channel]) => channel !== "bark" || isAppleEnvironment),
    [isAppleEnvironment]
  );
  const barkBound = channelVerified(me, "bark");
  const standalonePwa = isStandalonePwa();
  const webReminderSummary = [
    webReminderPrefs.soundEnabled ? t("webReminder.soundOn") : t("webReminder.soundOff"),
    webReminderPrefs.titleEnabled ? t("webReminder.titleOn") : t("webReminder.titleOff"),
  ].join(" · ");
  const vipCampaign = me?.permanent_vip_campaign;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
      if (event.matches) setChatBackgroundDrawerOpen(false);
    };
    setIsDesktopViewport(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const claimPermanentVip = async () => {
    if (!vipCampaign?.eligible || vipClaiming) return;
    setVipClaiming(true);
    try {
      const campaign = await api.claimPermanentVip();
      setMe((current) => current ? {
        ...current,
        is_permanent_vip: true,
        permanent_vip_campaign: campaign,
      } : current);
      patchSessionUser({ is_permanent_vip: true });
      showToast(t("vip.claimed", { slot: campaign.slot }), "success");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("vip.claimFailed"), "error");
    } finally {
      setVipClaiming(false);
    }
  };

  useEffect(() => {
    if (!standalonePwa || !me || pwaGrowthClaimedRef.current) return;
    pwaGrowthClaimedRef.current = true;
    void api.claimGrowthEvent("install_webapp").then(({ growth }) => {
      setMe((current) => current ? { ...current, growth } : current);
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
    if (!chatBackgroundDrawerOpen || !me) return;
    setChatBackgroundDraft(me.chat_background_theme ?? "default");
  }, [chatBackgroundDrawerOpen, me?.chat_background_theme]);

  useEffect(() => {
    if (!(chatBubbleDrawerOpen || avatarFrameDrawerOpen || squareCharacterDrawerOpen) || !me) return;
    setPersonalizationDraft({
      chat_bubble_style: me.chat_bubble_style ?? "default",
      avatar_frame_style: me.avatar_frame_style ?? "none",
      square_outfit_style: me.square_outfit_style ?? "sunset",
      square_prop_style: me.square_prop_style ?? "none",
      square_motion_style: me.square_motion_style ?? "walk",
      square_limb_style: me.square_limb_style ?? "line",
    });
  }, [
    avatarFrameDrawerOpen,
    chatBubbleDrawerOpen,
    me?.avatar_frame_style,
    me?.chat_bubble_style,
    me?.square_limb_style,
    me?.square_motion_style,
    me?.square_outfit_style,
    me?.square_prop_style,
    squareCharacterDrawerOpen,
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
    return me?.bark ?? "";
  };

  const contactUnboundAt = (channel: NotificationChannel) => {
    if (channel === "email") return me?.email_unbound_at ?? null;
    if (channel === "sms") return me?.phone_unbound_at ?? null;
    return me?.bark_unbound_at ?? null;
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
      bark: updated.bark,
      email_verified_at: updated.email_verified_at,
      phone_verified_at: updated.phone_verified_at,
      bark_verified_at: updated.bark_verified_at,
      email_unbound_at: updated.email_unbound_at,
      phone_unbound_at: updated.phone_unbound_at,
      bark_unbound_at: updated.bark_unbound_at,
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
        const prefRows = meInfo.has_password ? await api.getNotificationPrefs(controller.signal) : [];
        const nextWebReminderPrefs = webReminderInfo ? mapWebReminderPreferences(webReminderInfo) : getWebReminderPreferences();
        setSpace(spaceInfo);
        setMe(meInfo);
        setPrefs(mapPrefs(prefRows));
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
          bark: meInfo.bark,
          email_verified_at: meInfo.email_verified_at,
          phone_verified_at: meInfo.phone_verified_at,
          bark_verified_at: meInfo.bark_verified_at,
          email_unbound_at: meInfo.email_unbound_at,
          phone_unbound_at: meInfo.phone_unbound_at,
          bark_unbound_at: meInfo.bark_unbound_at,
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
      setSecurityDrawerOpen(true);
    }
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
    openAuthSheet("bark");
  };

  const closePrefDrawers = () => {
    setPrefDrawerChannel(null);
    setPrefSaving(false);
    setPrefCustomDrawerOpen(false);
    setPrefEditor(null);
  };

  const openPrefDrawer = (channel: NotificationChannel) => {
    setPrefDrawerChannel(channel);
    setPrefCustomDrawerOpen(false);
  };

  const preferenceFromResponse = (updated: NotificationPreferenceDTO): NotificationPreferences[NotificationChannel] => ({
    enabled: updated.enabled,
    threshold: updated.offline_threshold_minutes,
    hideMessageContent: updated.hide_message_content,
    hiddenDirectMessageTitle: updated.hidden_direct_message_title ?? "",
    hiddenDirectMessageText: updated.hidden_direct_message_text ?? "",
    hiddenGroupMessageTitle: updated.hidden_group_message_title ?? "",
    hiddenGroupMessageText: updated.hidden_group_message_text ?? "",
    friendOnlineMessageTitle: updated.friend_online_message_title ?? "",
    friendOnlineMessageText: updated.friend_online_message_text ?? "",
    openChatOnTap: updated.open_chat_on_tap ?? true,
    barkIconMode: updated.bark_icon_mode ?? 1,
  });

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

  const messagePreferenceValue = (
    pref: NotificationPreferences[NotificationChannel],
    kind: NotificationMessageKind,
    field: "title" | "content"
  ) => {
    if (kind === "direct") return field === "title" ? pref.hiddenDirectMessageTitle : pref.hiddenDirectMessageText;
    if (kind === "group") return field === "title" ? pref.hiddenGroupMessageTitle : pref.hiddenGroupMessageText;
    return field === "title" ? pref.friendOnlineMessageTitle : pref.friendOnlineMessageText;
  };

  const openThresholdEditor = (channel: NotificationChannel) => {
    setPrefEditor({ type: "threshold", channel });
    setPrefEditorValue(String(prefs[channel].threshold));
  };

  const openMessageEditor = (channel: NotificationChannel, kind: NotificationMessageKind, field: "title" | "content") => {
    if (!canCustomizeNotificationMessage) {
      showToast(t("notification.levelOrVipRequired", { level: 10 }), "error");
      return;
    }
    setPrefEditor({ type: "message", channel, kind, field });
    setPrefEditorValue(messagePreferenceValue(prefs[channel], kind, field));
  };

  const savePreferenceEditor = async () => {
    if (!prefEditor || prefEditorSaving) return;
    setPrefEditorSaving(true);
    let patch: Omit<Parameters<typeof api.updateNotificationPref>[0], "channel">;
    if (prefEditor.type === "threshold") {
      patch = { offline_threshold_minutes: Math.min(60, Math.max(1, Number(prefEditorValue))) };
    } else {
      const value = prefEditorValue.trim();
      const key = `${prefEditor.kind}:${prefEditor.field}`;
      patch = {
        ...(key === "direct:title" ? { hidden_direct_message_title: value } : {}),
        ...(key === "direct:content" ? { hidden_direct_message_text: value } : {}),
        ...(key === "group:title" ? { hidden_group_message_title: value } : {}),
        ...(key === "group:content" ? { hidden_group_message_text: value } : {}),
        ...(key === "online:title" ? { friend_online_message_title: value } : {}),
        ...(key === "online:content" ? { friend_online_message_text: value } : {}),
      };
    }
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
        bark: nextMe.bark,
        email_verified_at: nextMe.email_verified_at,
        phone_verified_at: nextMe.phone_verified_at,
        bark_verified_at: nextMe.bark_verified_at,
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
    if (!me?.growth?.capabilities?.custom_avatar?.available) {
      showToast(t("avatar.levelRequired", { level: 4 }), "error");
      return;
    }
    avatarFileInputRef.current?.click();
  };

  const saveChatBackgroundTheme = async () => {
    if (chatBackgroundDraft === "custom") return;
    if (!canCustomizeChatBackground) {
      showToast(t("background.levelRequired", { level: 8 }), "error");
      return;
    }
    try {
      setChatBackgroundSaving(true);
      const payload = await api.setChatBackground(chatBackgroundDraft);
      setMe(payload);
      showToast(t("background.updated"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("background.updateFailed"), "error");
    } finally {
      setChatBackgroundSaving(false);
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

  const savePersonalization = async () => {
    if (!me || personalizationSaving) return;
    if (personalizationDraft.chat_bubble_style === "vip" && !me.is_permanent_vip) {
      showToast(t("menu.vipBubbleOnly"), "error");
      return;
    }
    setPersonalizationSaving(true);
    try {
      const nextMe = await api.setPersonalization(personalizationDraft);
      setMe(nextMe);
      patchSessionUser(nextMe);
      showToast(t("personalization.updated"));
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

  const openBasicEditDialog = (field: "name" | "welcome" | "plaza") => {
    if (!hasPassword) {
      showPasswordReminder(field === "name" ? t("profile.nicknamePasswordRequired") : field === "welcome" ? t("profile.welcomePasswordRequired") : t("profile.greetingPasswordRequired"));
      return;
    }
    const capability = field === "name" ? "rename_nickname" : field === "welcome" ? "welcome_message" : "plaza_greeting";
    const requiredLevel = me?.growth?.capabilities?.[capability]?.required_level ?? (field === "name" ? 5 : 6);
    if (!me?.growth?.capabilities?.[capability]?.available) {
      showToast(t("growth.levelRequired", { level: requiredLevel }), "error");
      return;
    }
    if (field === "name" && me?.nickname_change?.available_at && me.nickname_change.available_at * 1000 > Date.now()) {
      showToast(t("profile.nextChange", { date: new Date(me.nickname_change.available_at * 1000).toLocaleDateString(getActiveLocale()) }), "error");
      return;
    }
    setBasicEditField(field);
    setBasicEditValue(field === "name" ? session?.user.name ?? "" : field === "welcome" ? me?.welcome_message ?? session?.user?.welcome_message ?? "" : me?.plaza_greeting ?? "");
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

    try {
      setBasicEditSaving(true);
      const editingField = basicEditField;
      if (basicEditField === "name") {
        const payload = await api.updateUserName(basicEditValue.trim());
        setMe((current) => (current ? { ...current, name: payload.name, name_pinyin: payload.name_pinyin ?? current.name_pinyin } : current));
        patchSessionUser({
          name: payload.name,
        });
      } else if (basicEditField === "welcome") {
        const payload = await api.updateWelcomeMessage(basicEditValue.trim());
        const nextMessage = payload.welcome_message ?? "";
        setMe((current) => (current ? { ...current, welcome_message: nextMessage } : current));
        patchSessionUser({
          welcome_message: nextMessage,
        });
      } else {
        const payload = await api.updatePlazaGreeting(basicEditValue.trim());
        setMe((current) => current ? { ...current, plaza_greeting: payload.plaza_greeting } : current);
      }
      setBasicEditField(null);
      showToast(editingField === "name" ? t("profile.nicknameUpdated") : editingField === "welcome" ? t("profile.welcomeUpdated") : t("profile.greetingUpdated"));
    } catch (apiError) {
      showToast(
        apiError instanceof ApiError ? apiError.message : basicEditField === "name" ? t("profile.nicknameUpdateFailed") : t("profile.welcomeUpdateFailed"),
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
  const growthLevels = me?.growth?.levels ?? growthLevelScores.map((score, index) => ({
    level: index + 1,
    name: space?.level_names?.[index] ?? `Lv.${index + 1}`,
    score,
    unlocks: (growthLevelUnlockKeys[index + 1] ?? []).map((key) => t(key)),
    unlocked: (me?.growth?.level ?? 1) >= index + 1,
  }));

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
  };

  const openShowcaseBadge = (kind: "password" | NotificationChannel) => {
    if (kind === "password") {
      setSecurityDrawerOpen(true);
      return;
    }
    if (channelVerified(me, kind)) {
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

  const activePref = prefDrawerChannel ? prefs[prefDrawerChannel] : null;
  const editorMessageDefaults = (kind: NotificationMessageKind) => {
    if (kind === "direct") return { title: t("notification.directTitle"), content: t("notification.directContent") };
    if (kind === "group") return { title: t("notification.groupTitle"), content: t("notification.groupContent") };
    return { title: t("notification.onlineTitle"), content: t("notification.onlineContent") };
  };
  const editorPreview = (() => {
    if (!prefEditor || prefEditor.type !== "message") return null;
    const pref = prefs[prefEditor.channel];
    const defaults = editorMessageDefaults(prefEditor.kind);
    const titleValue = prefEditor.field === "title" ? prefEditorValue : messagePreferenceValue(pref, prefEditor.kind, "title");
    const contentValue = prefEditor.field === "content" ? prefEditorValue : messagePreferenceValue(pref, prefEditor.kind, "content");
    return {
      title: titleValue.trim() || defaults.title,
      content: contentValue.trim() || defaults.content,
    };
  })();

  const openFriendInviteDrawer = () => {
    if (!canUseFriendInvite) {
      setError(t("invite.verificationRequired"));
      return;
    }
    setInviteDrawerOpen(true);
  };

  return (
    <AppChrome title={t("menu.title")} hideTopbar shellClassName="desktop-tab-shell">
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
            <UserAvatar className="avatar-large" frame={me?.avatar_frame_style} name={session?.user.name ?? t("brand.user")} uri={me?.avatar_uri ?? session?.user.avatar_uri} vip={Boolean(me?.is_permanent_vip)} />
          </button>
          <div className="row-main menu-profile-copy">
            <div className="menu-profile-heading">
              <strong>{session?.user.name ?? t("brand.user")}</strong>
              {space?.slug ? <span>@{space.slug}</span> : null}
            </div>
            <button className="menu-growth-entry" onClick={() => setGrowthDrawerOpen(true)} type="button">
              <span className="menu-growth-level">Lv.{me?.growth?.level ?? 1}</span>
              <span className="menu-growth-identity">
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
        {vipCampaign?.active && !vipCampaign.claimed_by_user ? (
          <section className={`menu-vip-campaign${vipCampaign.eligible ? " is-eligible" : ""}`}>
            <div className="menu-vip-campaign-orbit" aria-hidden="true"><i /><i /></div>
            <div className="menu-vip-campaign-heading">
              <span>FOUNDING 100</span>
              <small>{t("vip.remaining", { count: vipCampaign.remaining })}</small>
            </div>
            <div className="menu-vip-campaign-copy">
              <strong>{t("vip.title")}</strong>
              <p>{t("vip.rewards")}</p>
            </div>
            <div className="menu-vip-requirements">
              {[
                {
                  key: "email",
                  label: t("contact.verifyEmail"),
                  complete: vipCampaign.requirements.email,
                  detail: vipCampaign.requirements.email ? t("common.completed") : t("contact.verifyNow"),
                  action: () => openAuthSheet("email"),
                },
                {
                  key: "phone",
                  label: t("contact.bindPhone"),
                  complete: vipCampaign.requirements.phone,
                  detail: vipCampaign.requirements.phone ? t("common.completed") : t("contact.bindNow"),
                  action: () => openAuthSheet("sms"),
                },
                {
                  key: "level",
                  label: t("vip.reachLevel", { level: 6 }),
                  complete: vipCampaign.requirements.level,
                  detail: vipCampaign.requirements.level ? t("common.completed") : t("growth.currentLevel", { level: me?.growth?.level ?? 1 }),
                  action: () => setGrowthDrawerOpen(true),
                },
              ].map((requirement) => (
                <button
                  className={requirement.complete ? "is-complete" : ""}
                  disabled={requirement.complete}
                  key={requirement.key}
                  onClick={requirement.action}
                  type="button"
                >
                  <i aria-hidden="true">{requirement.complete ? "✓" : ""}</i>
                  <strong>{requirement.label}</strong>
                  <span>{requirement.detail}</span>
                  {!requirement.complete ? <ForwardArrowIcon /> : null}
                </button>
              ))}
            </div>
            <button disabled={!vipCampaign.eligible || vipClaiming} onClick={() => void claimPermanentVip()} type="button">
              {vipClaiming ? t("vip.reserving") : vipCampaign.eligible ? t("vip.claim") : t("vip.completeRequirements")}
            </button>
          </section>
        ) : null}
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
          void api.claimGrowthEvent("install_webapp").then(({ growth }) => {
            setMe((current) => current ? { ...current, growth } : current);
          });
        }}
        open={pwaInstallSheetOpen}
        spaceName={space?.name ?? t("space.current")}
      />
      <TravelMapDrawer open={travelMapOpen} onClose={() => setTravelMapOpen(false)} />

      <SideDrawer open={growthDrawerOpen} onClose={() => setGrowthDrawerOpen(false)} title={t("growth.mine")}>
        <div className={`growth-drawer is-level-${me?.growth?.level ?? 1}`}>
          <button className="growth-hero" onClick={() => setGrowthLevelsOpen(true)} type="button">
            <div className="growth-hero-heading">
              <div className="growth-level-seal">
                <span>LEVEL</span>
                <strong>{String(me?.growth?.level ?? 1).padStart(2, "0")}</strong>
              </div>
              <div className="growth-hero-title">
                <small>{t("growth.currentTitle")}</small>
                <strong>{me?.growth?.name ?? t("growth.firstLevel")}</strong>
              </div>
              <span className="growth-hero-guide">
                {t("growth.guide")}
                <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                  <path d="M4 10h11M11.5 6.5 15 10l-3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </span>
            </div>
            <div className="growth-progress-copy">
              <div>
                <strong>{me?.growth?.level_cap_reason || (me?.growth?.next_score ? t("growth.toNextLevel", { level: (me.growth.level ?? 1) + 1 }) : t("growth.maxLevel"))}</strong>
                <span>{me?.growth?.level_cap_reason ? t("growth.scoreAndCap", { score: me.growth.score, level: me.growth.level_cap }) : me?.growth?.next_score ? `${me.growth.score} / ${me.growth.next_score}` : t("growth.score", { score: me?.growth?.score ?? 0 })}</span>
              </div>
              <div className="growth-progress-track"><i style={{ transform: `scaleX(${me?.growth?.progress ?? 0})` }} /></div>
            </div>
          </button>
          <section className="growth-daily-card">
            <div className="growth-daily-copy">
              <strong>{t("growth.todayChat")}</strong>
              <span>{t("growth.daily")}</span>
            </div>
            <div className="growth-daily-meter">
              <i style={{ transform: `scaleX(${Math.min(1, (me?.growth?.daily_chat?.earned ?? 0) / Math.max(1, me?.growth?.daily_chat?.limit ?? 20))})` }} />
            </div>
            <b>{me?.growth?.daily_chat?.earned ?? 0}<small>/{me?.growth?.daily_chat?.limit ?? 20}</small></b>
          </section>
          <section className="growth-drawer-section">
            <h3>{t("growth.explore")}</h3>
            <div className="growth-milestone-grid">
              {(me?.growth?.milestones ?? []).filter((item) => item.category !== "security").map((item) => (
                <button className={`growth-milestone ${item.earned ? "is-earned" : ""}`} disabled={!item.key.includes("install_webapp")} key={item.key} onClick={() => openGrowthMilestone(item.key)} type="button">
                  <span>{item.earned ? "✓" : "+"}</span>
                  <strong>{item.title}</strong>
                  <small>+{item.points}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="growth-drawer-section">
            <h3>{t("growth.recommended")}</h3>
            <div className="growth-milestone-grid">
              {(me?.growth?.milestones ?? []).filter((item) => item.category === "security" && (item.key !== "security:bark" || isAppleEnvironment)).map((item) => (
                <button className={`growth-milestone ${item.earned ? "is-earned" : ""}`} key={item.key} onClick={() => openGrowthMilestone(item.key)} type="button">
                  <span>{item.earned ? "✓" : "+"}</span>
                  <strong>{item.title}</strong>
                  <small>+{item.points}</small>
                </button>
              ))}
            </div>
          </section>
          {me?.growth?.recent_events?.length ? (
            <section className="growth-drawer-section">
              <h3>{t("growth.recent")}</h3>
              <div className="growth-event-list">
                {me.growth.recent_events?.map((event) => <div key={`${event.key}-${event.created_at}`}><span>{event.title}</span><strong>+{event.points}</strong></div>)}
              </div>
            </section>
          ) : null}
          {me?.growth?.privileges.length ? (
            <section className="growth-drawer-section">
              <h3>{t("growth.unlocked")}</h3>
              <div className="growth-privileges">{me.growth.privileges.map((item) => <span key={item}>{item}</span>)}</div>
            </section>
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer open={growthLevelsOpen} onClose={() => setGrowthLevelsOpen(false)} title={t("growth.levelGuide")}>
        <div className="growth-level-guide">
          <div className="growth-level-guide-summary">
            <span>{String(activeGrowthGuideLevel).padStart(2, "0")} / 18</span>
            <strong>{growthLevels[activeGrowthGuideLevel - 1]?.name ?? `Lv.${activeGrowthGuideLevel}`}</strong>
            <small>{activeGrowthGuideLevel === (me?.growth?.level ?? 1) ? t("growth.currentLevelLabel") : activeGrowthGuideLevel < (me?.growth?.level ?? 1) ? t("growth.reached") : t("growth.keepGrowing")}</small>
          </div>
          <div
            className="growth-level-list"
            ref={growthLevelTrackRef}
            onScroll={(event) => {
              const track = event.currentTarget;
              const center = track.scrollLeft + track.clientWidth / 2;
              const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-growth-level]"));
              const closest = cards.reduce<{ level: number; distance: number } | null>((best, card) => {
                const level = Number(card.dataset.growthLevel);
                const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
                return !best || distance < best.distance ? { level, distance } : best;
              }, null);
              if (closest && closest.level !== activeGrowthGuideLevel) setActiveGrowthGuideLevel(closest.level);
            }}
          >
            {growthLevels.map((item) => {
              const current = item.level === (me?.growth?.level ?? 1);
              const next = item.level === (me?.growth?.level ?? 1) + 1;
              return (
                <article
                  className={`growth-level-card${item.unlocked ? " is-unlocked" : ""}${current ? " is-current" : ""}${next ? " is-next" : ""}${activeGrowthGuideLevel === item.level ? " is-focused" : ""}${item.level > (me?.growth?.level_cap ?? 18) ? " is-capped" : ""}`}
                  data-growth-level={item.level}
                  key={item.level}
                >
                  <div className="growth-level-card-stage">
                    <span>LEVEL</span>
                    <strong>{String(item.level).padStart(2, "0")}</strong>
                  </div>
                  <div className="growth-level-card-copy">
                    <strong>{item.name}</strong>
                  </div>
                  <div className="growth-level-card-state">
                    {current ? "NOW" : item.unlocked ? "OPEN" : item.level > (me?.growth?.level_cap ?? 18) ? "LOCK" : "NEXT"}
                  </div>
                </article>
              );
            })}
          </div>
          <section className="growth-level-detail">
            <div className="growth-level-detail-score">
              <span>{t("growth.unlockCondition")}</span>
              <strong>{(growthLevels[activeGrowthGuideLevel - 1]?.score ?? 0).toLocaleString()}<small>{t("growth.points")}</small></strong>
            </div>
            <div className="growth-level-detail-unlocks">
              {(growthLevels[activeGrowthGuideLevel - 1]?.unlocks ?? []).length ? (
                growthLevels[activeGrowthGuideLevel - 1].unlocks.map((unlock) => (
                  <span key={unlock}><i />{unlock}</span>
                ))
              ) : (
                <span><i />{t("growth.stage")}</span>
              )}
            </div>
          </section>
          <div className="growth-level-rail" aria-label={t("growth.selectLevel")}>
            {growthLevels.map((item) => (
              <button
                aria-label={t("growth.viewLevel", { level: item.level })}
                className={activeGrowthGuideLevel === item.level ? "is-active" : ""}
                key={`rail-${item.level}`}
                onClick={() => {
                  growthLevelTrackRef.current
                    ?.querySelector<HTMLElement>(`[data-growth-level="${item.level}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                type="button"
              />
            ))}
          </div>
          {me?.growth?.level_cap_reason ? <p className="growth-level-cap-note">{me.growth.level_cap_reason}</p> : null}
        </div>
      </SideDrawer>

      <SideDrawer open={basicDrawerOpen} onClose={() => setBasicDrawerOpen(false)} title={t("menu.basicInfo")}>
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setAvatarDialogOpen(true)} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.avatar")}</strong>
              </div>
              <div className="menu-detail-value">
                <UserAvatar className="mini-avatar" name={session?.user.name ?? t("brand.user")} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className={`simple-row menu-link-row${canRenameNickname ? "" : " is-locked"}`} disabled={!canRenameNickname} onClick={() => openBasicEditDialog("name")} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.nickname")}</strong>
                {canRenameNickname && me?.nickname_change?.available_at && me.nickname_change.available_at * 1000 > Date.now() ? (
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
                {canRenameNickname ? session?.user.name ?? t("brand.user") : t("growth.unlockAtLevel", { level: 5 })}
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className={`simple-row menu-link-row${canEditWelcome ? "" : " is-locked"}`} disabled={!canEditWelcome} onClick={() => openBasicEditDialog("welcome")} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("profile.welcome")}</strong>
              </div>
              <div className="menu-detail-value menu-detail-text menu-summary-clamp">{canEditWelcome ? welcomeSummary : t("growth.unlockAtLevel", { level: 6 })}</div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className={`simple-row menu-link-row${canEditPlazaGreeting ? "" : " is-locked"}`} disabled={!canEditPlazaGreeting} onClick={() => openBasicEditDialog("plaza")} type="button">
              <div className="row-main menu-key-cell"><strong>{t("profile.plazaGreeting")}</strong></div>
              <div className="menu-detail-value menu-detail-text menu-summary-clamp">{canEditPlazaGreeting ? me?.plaza_greeting || t("profile.defaultPlazaGreeting") : t("growth.unlockAtLevel", { level: 6 })}</div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer open={personalizationDrawerOpen} onClose={() => setPersonalizationDrawerOpen(false)} title={t("menu.personalization")}>
        <div className="personalization-drawer">
          <section className="personalization-section personalization-language-section">
            <header><strong>{t("menu.appearance")}</strong><span>{t("menu.appearanceHint")}</span></header>
            <div className="personalization-language-options" role="radiogroup" aria-label={t("menu.appearance")}>
              {([
                ["system", "common.system"],
                ["light", "menu.themeLight"],
                ["dark", "menu.themeDark"],
              ] as Array<[ThemePreference, TranslationKey]>).map(([value, labelKey]) => (
                <button
                  aria-checked={themePreference === value}
                  className={`personalization-language-option${themePreference === value ? " is-selected" : ""}`}
                  key={value}
                  onClick={() => setThemePreference(value)}
                  role="radio"
                  type="button"
                >
                  <span>{t(labelKey)}</span>
                  <span className="language-choice-indicator" aria-hidden="true">
                    <svg viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="7.5" />
                      {themePreference === value ? <path d="m6.5 10.2 2.15 2.2 4.85-5" /> : null}
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="personalization-section personalization-language-section">
            <header><strong>{t("menu.language")}</strong><span>{t("menu.languageHint")}</span></header>
            <div className="personalization-language-options" role="radiogroup" aria-label={t("menu.language")}>
              {([
                ["system", "common.system"],
                ["zh-CN", "common.chinese"],
                ["en", "common.english"],
              ] as const).map(([value, labelKey]) => (
                <button
                  aria-checked={languagePreference === value}
                  className={`personalization-language-option${languagePreference === value ? " is-selected" : ""}`}
                  disabled={languageSaving}
                  key={value}
                  onClick={() => void saveLanguagePreference(value)}
                  role="radio"
                  type="button"
                >
                  <span>{t(labelKey)}</span>
                  <span className="language-choice-indicator" aria-hidden="true">
                    <svg viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="7.5" />
                      {languagePreference === value ? <path d="m6.5 10.2 2.15 2.2 4.85-5" /> : null}
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <button
            className="personalization-background-entry"
            onClick={() => setChatBackgroundDrawerOpen(true)}
            type="button"
          >
            <span className={`personalization-background-swatch theme-${me?.chat_background_theme ?? "default"}`} />
            <span>
              <strong>{t("menu.chatBackground")}</strong>
              <small>
                {isDesktopViewport
                  ? t("menu.chatBackgroundDesktopDefault")
                  : canCustomizeChatBackground
                    ? t("menu.chatBackgroundHint")
                    : t("menu.levelUnlock", { level: 8 })}
              </small>
            </span>
            {!isDesktopViewport ? <span className="material-symbols-outlined">chevron_right</span> : null}
          </button>
          <button className="personalization-background-entry personalization-feature-entry" onClick={() => setChatBubbleDrawerOpen(true)} type="button">
            <span className={`personalization-entry-preview bubble-preview preview-${visibleBubbleStyle(me?.chat_bubble_style)}`}><i /></span>
            <span><strong>{t("menu.chatBubble")}</strong><small>{t("menu.chatBubbleHint")}</small></span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <button className="personalization-background-entry personalization-feature-entry" onClick={() => setAvatarFrameDrawerOpen(true)} type="button">
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
          <button className="personalization-background-entry personalization-feature-entry" onClick={() => setSquareCharacterDrawerOpen(true)} type="button">
            <span className={`personalization-entry-preview square-character-preview outfit-${me?.square_outfit_style ?? "sunset"}`}><i /></span>
            <span><strong>{t("menu.squareCharacter")}</strong><small>{t("menu.squareCharacterHint")}</small></span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={chatBackgroundSaving}
        actionDisabled={chatBackgroundDraft === (me?.chat_background_theme ?? "default")}
        actionLabel={t("common.save")}
        onAction={() => void saveChatBackgroundTheme()}
        open={chatBackgroundDrawerOpen}
        onClose={() => setChatBackgroundDrawerOpen(false)}
        title={t("menu.chatBackground")}
      >
        <div className="chat-background-settings">
          <div className="chat-background-preview personalization-sticky-preview" data-theme={chatBackgroundDraft}>
            {chatBackgroundDraft === "custom" && me?.chat_background_uri ? (
              <img alt="" src={me.chat_background_uri} />
            ) : null}
            <span className="chat-background-preview-bubble other">{t("menu.backgroundPreviewOther")}</span>
            <span className="chat-background-preview-bubble self">{t("menu.backgroundPreviewSelf")}</span>
          </div>
          {chatBackgroundSections.map((section) => (
            <section className="personalization-library-section chat-background-section" key={section.label}>
              <header><h3>{t(section.label)}</h3><span>{section.items.length}</span></header>
              <div className="chat-background-grid">
                {section.items.map(([theme, label]) => (
                  <button
                    aria-pressed={chatBackgroundDraft === theme}
                    className={`chat-background-choice theme-${theme}${chatBackgroundDraft === theme ? " is-selected" : ""}`}
                    disabled={chatBackgroundSaving}
                    key={theme}
                    onClick={() => setChatBackgroundDraft(theme)}
                    type="button"
                  >
                    <span />
                    <strong>{t(label)}</strong>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section className="chat-background-section">
            <h3>{t("common.custom")}</h3>
            <div className="chat-background-grid">
              <button
                className={`chat-background-choice theme-custom${chatBackgroundDraft === "custom" ? " is-selected" : ""}`}
                disabled={chatBackgroundSaving || !canCustomizeChatBackground}
                onClick={() => chatBackgroundFileInputRef.current?.click()}
                type="button"
              >
                <span>
                  {me?.chat_background_uri ? <img alt="" src={me.chat_background_uri} /> : <span className="material-symbols-outlined">add_photo_alternate</span>}
                </span>
                <strong>{chatBackgroundSaving ? t("common.processing") : t("common.custom")}</strong>
              </button>
            </div>
          </section>
          <input
            ref={chatBackgroundFileInputRef}
            accept="image/*"
            hidden
            onChange={(event) => void handleChatBackgroundChange(event)}
            type="file"
          />
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={personalizationSaving}
        actionDisabled={personalizationDraft.chat_bubble_style === (me?.chat_bubble_style ?? "default")}
        actionLabel={t("common.save")}
        onAction={() => void savePersonalization()}
        open={chatBubbleDrawerOpen}
        onClose={() => setChatBubbleDrawerOpen(false)}
        title={t("menu.chatBubble")}
      >
        <div className="personalization-editor">
          <div className="personalization-sticky-preview">
            <ChatBubblePreview
              avatarName={space?.official_user?.name ?? t("brand.user")}
              avatarUri={space?.official_user?.avatar_uri}
              style={visibleBubbleStyle(personalizationDraft.chat_bubble_style)}
            />
          </div>
          <div className="personalization-library">
            {chatBubbleSections.map((section) => (
              <section className="personalization-library-section" key={section.label}>
                <header><h3>{t(section.label)}</h3><span>{section.items.length}</span></header>
                <div className="personalization-option-grid field-chat_bubble_style">
                  {section.items.map(([value, label]) => (
                    <button
                      aria-pressed={personalizationDraft.chat_bubble_style === value}
                      className={`personalization-option preview-${value}${personalizationDraft.chat_bubble_style === value ? " is-selected" : ""}`}
                      disabled={personalizationSaving}
                      key={value}
                      onClick={() => setPersonalizationDraft((current) => ({ ...current, chat_bubble_style: value }))}
                      type="button"
                    >
                      <i aria-hidden="true"><span /></i>
                      <strong>{t(label)}</strong>
                      {value === "vip" ? <small>VIP</small> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={personalizationSaving}
        actionDisabled={personalizationDraft.avatar_frame_style === (me?.avatar_frame_style ?? "none")}
        actionLabel={t("common.save")}
        onAction={() => void savePersonalization()}
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
              vip={Boolean(me?.is_permanent_vip)}
            />
            <strong>{session?.user.name ?? t("brand.user")}</strong>
            <span>{t("menu.avatarFramePreviewHint")}</span>
          </div>
          <div className="personalization-library">
            {avatarFrameSections.map((section) => (
              <section className="personalization-library-section" key={section.label}>
                <header><h3>{t(section.label)}</h3><span>{section.items.length}</span></header>
                <div className="personalization-option-grid field-avatar_frame_style">
                  {section.items.map(([value, label]) => (
                    <button
                      aria-pressed={personalizationDraft.avatar_frame_style === value}
                      className={`personalization-option preview-${value}${personalizationDraft.avatar_frame_style === value ? " is-selected" : ""}`}
                      disabled={personalizationSaving}
                      key={value}
                      onClick={() => setPersonalizationDraft((current) => ({ ...current, avatar_frame_style: value }))}
                      type="button"
                    >
                      <i aria-hidden="true">
                        <UserAvatar
                          className="mini-avatar personalization-option-avatar"
                          frame={value}
                          name={session?.user.name ?? t("brand.user")}
                          uri={me?.avatar_uri ?? session?.user.avatar_uri}
                        />
                      </i>
                      <strong>{t(label)}</strong>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        actionBusy={personalizationSaving}
        actionDisabled={
          personalizationDraft.square_outfit_style === (me?.square_outfit_style ?? "sunset")
          && personalizationDraft.square_prop_style === (me?.square_prop_style ?? "none")
          && personalizationDraft.square_motion_style === (me?.square_motion_style ?? "walk")
          && personalizationDraft.square_limb_style === (me?.square_limb_style ?? "line")
        }
        actionLabel={t("common.save")}
        onAction={() => void savePersonalization()}
        open={squareCharacterDrawerOpen}
        onClose={() => setSquareCharacterDrawerOpen(false)}
        title={t("menu.squareCharacter")}
      >
        <div className="personalization-editor square-character-editor">
          <div className="personalization-square-stage personalization-sticky-preview">
            <div
              className={`square-character personalization-square-character outfit-${personalizationDraft.square_outfit_style} prop-${personalizationDraft.square_prop_style} motion-${personalizationDraft.square_motion_style} limbs-${personalizationDraft.square_limb_style}`}
            >
              <span className="square-character-figure" aria-hidden="true">
                <UserAvatar
                  className="square-character-head status-online"
                  frame={me?.avatar_frame_style}
                  name={session?.user.name ?? t("brand.user")}
                  uri={me?.avatar_uri ?? session?.user.avatar_uri}
                  vip={Boolean(me?.is_permanent_vip)}
                />
                <span className="square-character-body">
                  <i className="square-character-prop" />
                  <i className="square-character-arm is-left" />
                  <i className="square-character-arm is-right" />
                  <i className="square-character-torso" />
                  <i className="square-character-leg is-left" />
                  <i className="square-character-leg is-right" />
                </span>
              </span>
              <span className="square-character-name">{session?.user.name ?? t("brand.user")}</span>
            </div>
          </div>
          <div className="personalization-tabs" role="tablist" aria-label={t("menu.squareCharacter")}>
            {([
              ["outfit", "menu.squareTabOutfit"],
              ["prop", "menu.squareTabProp"],
              ["motion", "menu.squareTabMotion"],
            ] as const).map(([value, label]) => (
              <button
                aria-selected={squareCharacterTab === value}
                className={squareCharacterTab === value ? "is-active" : ""}
                key={value}
                onClick={() => setSquareCharacterTab(value)}
                role="tab"
                type="button"
              >
                {t(label)}
              </button>
            ))}
          </div>
          {squareCharacterTab === "outfit" ? (
            <div className="personalization-tab-panel">
              <div className="personalization-option-grid field-square_outfit_style">
                {personalizationOptions.square_outfit_style.map(([value, label]) => (
                  <button className={`personalization-option preview-${value}${personalizationDraft.square_outfit_style === value ? " is-selected" : ""}`} disabled={personalizationSaving} key={value} onClick={() => setPersonalizationDraft((current) => ({ ...current, square_outfit_style: value }))} type="button">
                    <i aria-hidden="true"><span /></i><strong>{t(label)}</strong>
                  </button>
                ))}
              </div>
              <div className="personalization-subsection">
                <span>{t("menu.squareLimbs")}</span>
                <div className="personalization-option-grid field-square_limb_style">
                  {personalizationOptions.square_limb_style.map(([value, label]) => (
                    <button className={`personalization-option preview-${value}${personalizationDraft.square_limb_style === value ? " is-selected" : ""}`} disabled={personalizationSaving} key={value} onClick={() => setPersonalizationDraft((current) => ({ ...current, square_limb_style: value }))} type="button">
                      <i aria-hidden="true"><span /></i><strong>{t(label)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {squareCharacterTab === "prop" ? (
            <div className="personalization-option-grid field-square_prop_style">
              {personalizationOptions.square_prop_style.map(([value, label]) => (
                <button className={`personalization-option preview-${value}${personalizationDraft.square_prop_style === value ? " is-selected" : ""}`} disabled={personalizationSaving} key={value} onClick={() => setPersonalizationDraft((current) => ({ ...current, square_prop_style: value }))} type="button">
                  <i aria-hidden="true"><span /></i><strong>{t(label)}</strong>
                </button>
              ))}
            </div>
          ) : null}
          {squareCharacterTab === "motion" ? (
            <div className="personalization-option-grid field-square_motion_style">
              {personalizationOptions.square_motion_style.map(([value, label]) => (
                <button className={`personalization-option preview-${value}${personalizationDraft.square_motion_style === value ? " is-selected" : ""}`} disabled={personalizationSaving} key={value} onClick={() => setPersonalizationDraft((current) => ({ ...current, square_motion_style: value }))} type="button">
                  <i aria-hidden="true"><span /></i><strong>{t(label)}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer
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
          <div className="simple-list">
            <button
              className="simple-row menu-link-row"
              onClick={() => setPasswordSheetOpen(true)}
              type="button"
            >
              <div className="row-main">
                <strong>{hasPassword ? t("password.change") : t("password.setup")}</strong>
                {!hasPassword ? <div className="row-subtle">{t("password.securityHint")}</div> : null}
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button
              className="simple-row menu-link-row"
              onClick={() => setGestureSheetOpen(true)}
              type="button"
            >
              <div className="row-main">
                <strong>{t("gesture.title")}</strong>
                <div className="row-subtle">
                  {gestureEnabled
                    ? t("gesture.lockAfter", { count: gestureLockAfterMinutes })
                    : emailVerified
                      ? t("common.notEnabled")
                      : t("gesture.verifyEmailToEnable")}
                </div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <div className="simple-row menu-link-row menu-toggle-row">
                <div className="row-main">
                  <strong>{t("account.private")}</strong>
                  <div className="row-subtle">
                    {phoneVerified
                      ? me?.is_private_account
                        ? t("account.privateHint")
                        : t("account.discoverableHint")
                      : t("account.bindPhoneFirst")}
                  </div>
                </div>
                <button
                  aria-label={t("account.togglePrivate")}
                  className={`switch ${me?.is_private_account ? "active" : ""}`}
                  disabled={privateAccountSaving || !phoneVerified}
                  onClick={() => void togglePrivateAccount()}
                  type="button"
                />
              </div>
            <button
              className="simple-row menu-link-row danger-row account-delete-row"
              onClick={() => {
                setAccountDeleteInput("");
                setAccountDeleteStep("intro");
              }}
              type="button"
            >
              <div className="row-main">
                <strong>{t("account.delete")}</strong>
                <div className="row-subtle">{t("account.deleteHint")}</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
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
            <FeedbackState title={t("account.finding")} description="" tone="loading" />
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
            <FeedbackState title={t("account.noSwitchable")} description={t("account.privateHidden")} />
          )}
        </div>
      </BottomSheet>

      <SideDrawer open={channelsDrawerOpen} onClose={() => setChannelsDrawerOpen(false)} title={t("menu.notifications")}>
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={openWebReminderDrawer} type="button">
              <div className="row-main menu-key-cell">
                <strong>{t("channel.web")}</strong>
              </div>
              <div className="menu-detail-value menu-detail-text">
                <span className="menu-channel-value">{webReminderSummary}</span>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {visibleChannelRows.map(([channel, _value, label]) => {
              const verified = channelVerified(me, channel);
              return (
                <button
                  key={channel}
                  className="simple-row menu-link-row"
                  onClick={() => verified ? openPrefDrawer(channel) : openAuthSheet(channel)}
                  type="button"
                >
                  <div className="row-main menu-key-cell">
                    <strong>{t(label)}</strong>
                  </div>
                  <div className="menu-detail-value menu-detail-text">
                    {verified ? (
                      <span className="menu-channel-value">{t("contact.boundState")}</span>
                    ) : !hasPassword ? (
                      <span className="menu-inline-action">{t("password.setupFirst")}</span>
                    ) : channel === "bark" || channel === "sms" ? (
                      <span className="menu-inline-action">{t("contact.bindNow")}</span>
                    ) : (
                      <span className="menu-inline-action">{t("contact.verifyNow")}</span>
                    )}
                  </div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              );
            })}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
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
        </div>
      </SideDrawer>

      <SideDrawer
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
        open={Boolean(prefDrawerChannel)}
        onClose={closePrefDrawers}
        title={prefDrawerChannel ? t("notification.channelSettings", { channel: channelLabel(prefDrawerChannel) }) : t("notification.settings")}
      >
        {prefDrawerChannel && activePref ? (
          <div className="menu-pref-settings-stack">
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
                  <span>{t("common.minutes", { count: activePref.threshold })}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </button>
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
                  {activePref.hideMessageContent ? (
                    <button
                      className={`menu-pref-row menu-pref-row-button ${!canCustomizeNotificationMessage ? "is-disabled" : ""}`}
                      disabled={!activePref.enabled}
                      onClick={() => {
                        if (!canCustomizeNotificationMessage) {
                          showToast(t("notification.levelOrVipRequired", { level: 10 }), "error");
                          return;
                        }
                        setPrefCustomDrawerOpen(true);
                      }}
                      type="button"
                    >
                      <div className="row-main">
                        <strong>{t("notification.customMessages")}</strong>
                      </div>
                      <div className="menu-pref-row-value">
                        {!canCustomizeNotificationMessage ? <span>{t("growth.unlockAtLevelOrVip", { level: 10 })}</span> : null}
                        <span className="material-symbols-outlined">
                          {canCustomizeNotificationMessage ? "chevron_right" : "lock"}
                        </span>
                      </div>
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="menu-pref-list">
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
                    {prefDrawerChannel === "bark"
                      ? t("contact.rebindAnytime")
                      : prefDrawerChannel === "email"
                        ? t("contact.emailUnbindLimit")
                        : t("contact.phoneUnbindLimit")}
                  </div>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        ) : null}
      </SideDrawer>
      <SideDrawer
        open={Boolean(prefDrawerChannel && prefCustomDrawerOpen && activePref?.hideMessageContent)}
        onClose={() => setPrefCustomDrawerOpen(false)}
        title={t("notification.customMessages")}
      >
        {prefDrawerChannel && activePref ? (
          <div className="menu-pref-custom-drawer">
            {prefDrawerChannel === "bark" ? (
              <div className="menu-pref-list">
                <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                  <div className="row-main"><strong>{t("notification.openChatOnTap")}</strong></div>
                  <button
                    aria-label={t("notification.toggleOpenChat")}
                    className={`switch ${activePref.openChatOnTap ? "active" : ""}`}
                    disabled={prefSaving || !activePref.enabled}
                    onClick={() => void savePreferencePatch("bark", { open_chat_on_tap: activePref.openChatOnTap ? 0 : 1 })}
                    type="button"
                  />
                </div>
                <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                  <div className="row-main"><strong>{t("notification.useSpaceLogo")}</strong></div>
                  <button
                    aria-label={t("notification.toggleSpaceLogo")}
                    className={`switch ${activePref.barkIconMode === 1 ? "active" : ""}`}
                    disabled={prefSaving || !activePref.enabled}
                    onClick={() => void savePreferencePatch("bark", { bark_icon_mode: activePref.barkIconMode === 1 ? 0 : 1 })}
                    type="button"
                  />
                </div>
                <div className={`menu-pref-row ${!activePref.enabled ? "is-disabled" : ""}`}>
                  <div className="row-main"><strong>{t("notification.useUserAvatar")}</strong></div>
                  <button
                    aria-label={t("notification.toggleUserAvatar")}
                    className={`switch ${activePref.barkIconMode === 2 ? "active" : ""}`}
                    disabled={prefSaving || !activePref.enabled}
                    onClick={() => void savePreferencePatch("bark", { bark_icon_mode: activePref.barkIconMode === 2 ? 0 : 2 })}
                    type="button"
                  />
                </div>
              </div>
            ) : null}
            {(["direct", "group", "online"] as NotificationMessageKind[]).map((kind) => {
              const label = kind === "direct" ? t("notification.directPrompt") : kind === "group" ? t("notification.groupPrompt") : t("notification.onlinePrompt");
              const content = messagePreferenceValue(activePref, kind, "content");
              const title = messagePreferenceValue(activePref, kind, "title");
              return (
                <section className="notification-template-block" key={kind}>
                  <div className="section-label">{label}</div>
                  <div className="simple-list">
                    {prefDrawerChannel === "bark" ? (
                      <button className="simple-row menu-link-row" onClick={() => openMessageEditor(prefDrawerChannel, kind, "title")} type="button">
                        <div className="row-main"><strong>{t("notification.customTitle")}</strong><div className="row-subtle">{title || t("notification.defaultTitle")}</div></div>
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    ) : null}
                    <button className="simple-row menu-link-row" onClick={() => openMessageEditor(prefDrawerChannel, kind, "content")} type="button">
                      <div className="row-main"><strong>{t("notification.customContent")}</strong><div className="row-subtle">{content || t("notification.defaultContent")}</div></div>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </SideDrawer>

      <SideDrawer
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
                    <input className="input" value={authCode} onChange={(event) => setAuthCode(event.target.value)} />
                    <button
                      className="button contact-flow-primary"
                      disabled={authActionState === "binding" || !authCode.trim()}
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
              <input
                autoComplete="one-time-code"
                className="input"
                inputMode="numeric"
                placeholder={t("admin.codePlaceholder")}
                value={authCode}
                onChange={(event) => setAuthCode(event.target.value)}
              />
              <div className="contact-flow-actions">
                <button
                  className="button contact-flow-primary"
                  disabled={authActionState === "binding" || !authCode.trim()}
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
            <input className="input" inputMode="numeric" value={unbindCode} onChange={(event) => setUnbindCode(event.target.value)} />
            <button
              className="danger-button contact-flow-primary"
              disabled={unbindState !== "idle" || !unbindCode.trim()}
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
      <BottomSheet
        bodyClassName="menu-security-sheet-body"
        className="contact-bottom-sheet"
        open={gestureSheetOpen}
        title={t("gesture.title")}
        description={t("gesture.design")}
        onClose={() => setGestureSheetOpen(false)}
      >
        <GestureSetupPanel
          scope={gestureScope}
          canEnable={emailVerified}
          preference={gesturePreference}
          onChanged={setGesturePreference}
        />
      </BottomSheet>
      <AvatarPresetDialog
        currentAvatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
        displayName={session?.user.name ?? t("brand.user")}
        onClose={() => setAvatarDialogOpen(false)}
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
        confirmLabel={basicEditField === "name" ? t("profile.saveNickname") : basicEditField === "welcome" ? t("profile.saveWelcome") : t("profile.saveGreeting")}
        onChange={setBasicEditValue}
        onClose={() => setBasicEditField(null)}
        onConfirm={() => void confirmBasicEdit()}
        open={Boolean(basicEditField)}
        placeholder={basicEditField === "name" ? t("profile.nicknamePlaceholder") : basicEditField === "welcome" ? t("profile.welcomePlaceholder") : t("profile.greetingPlaceholder")}
        title={basicEditField === "name" ? t("profile.editNickname") : basicEditField === "welcome" ? t("profile.editWelcome") : t("profile.plazaGreeting")}
        value={basicEditValue}
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
                <h2>{prefEditor.type === "threshold" ? t("notification.offlineThreshold") : prefEditor.field === "title" ? t("notification.customTitle") : t("notification.customContent")}</h2>
                <p>{prefEditor.type === "threshold" ? t("notification.thresholdHint") : t("notification.emptyUsesDefault")}</p>
              </div>
              <button className="icon-button" disabled={prefEditorSaving} onClick={() => setPrefEditor(null)} type="button" aria-label={t("common.close")}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {prefEditor.type === "threshold" ? (
              <div className="notification-threshold-editor">
                <strong>{t("common.minutes", { count: Number(prefEditorValue) })}</strong>
                <input
                  aria-label={t("notification.offlineThreshold")}
                  max={60}
                  min={1}
                  onChange={(event) => setPrefEditorValue(event.target.value)}
                  type="range"
                  value={prefEditorValue}
                />
                <div><span>{t("common.minutes", { count: 1 })}</span><span>{t("common.minutes", { count: 60 })}</span></div>
              </div>
            ) : (
              <>
                {prefEditor.field === "title" ? (
                  <input
                    autoFocus
                    className="input"
                    maxLength={80}
                    onChange={(event) => setPrefEditorValue(event.target.value)}
                    placeholder={editorMessageDefaults(prefEditor.kind).title}
                    value={prefEditorValue}
                  />
                ) : (
                  <textarea
                    autoFocus
                    className="textarea notification-editor-textarea"
                    maxLength={255}
                    onChange={(event) => setPrefEditorValue(event.target.value)}
                    placeholder={editorMessageDefaults(prefEditor.kind).content}
                    rows={3}
                    value={prefEditorValue}
                  />
                )}
                {editorPreview ? (
                  <div className={`notification-push-preview is-${prefEditor.channel}`}>
                    <img
                      alt=""
                      className={prefEditor.channel === "email" ? "notification-mail-preview-icon" : undefined}
                      src={prefEditor.channel === "bark"
                        ? prefs.bark.barkIconMode === 1
                          ? space?.official_user?.avatar_uri || barkAppIconUrl
                          : prefs.bark.barkIconMode === 2
                            ? me?.avatar_uri ?? session?.user.avatar_uri ?? barkAppIconUrl
                            : barkAppIconUrl
                        : appleMailIconUrl}
                    />
                    <div>
                      <strong>{prefEditor.channel === "bark" ? t("bark.previewTitle", { title: editorPreview.title }) : t("email.preview")}</strong>
                      <p>{editorPreview.content}</p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
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
