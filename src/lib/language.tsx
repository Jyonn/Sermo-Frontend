import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

export type SupportedLanguage = "en" | "zh-CN";
export type LanguagePreference = "system" | SupportedLanguage;

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(["en", "zh-CN"]);

export function resolveJoinLanguage(input?: string | null): SupportedLanguage {
  const raw = (input ?? "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase().replace(/_/g, "-");
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh" || lower === "zh-cn" || lower.startsWith("zh-cn")) return "zh-CN";

  return SUPPORTED_LANGUAGES.has(raw as SupportedLanguage) ? (raw as SupportedLanguage) : "en";
}

export function getBrowserJoinLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return "en";
  return resolveJoinLanguage(navigator.language);
}

type TranslationValues = Record<string, string | number>;

const messages = {
  en: {
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.done": "Done",
    "common.retry": "Retry",
    "common.save": "Save",
    "common.loading": "Loading",
    "common.processing": "Processing...",
    "common.operationFailed": "Could not complete the action",
    "common.closePanel": "Close panel",
    "common.dragToClose": "Drag to close",
    "common.updateAvailable": "Update available",
    "common.updateHint": "Update now to get the latest features",
    "common.updateNow": "Update now",
    "common.updating": "Updating",
    "common.back": "Back",
    "common.system": "Follow system",
    "common.chinese": "简体中文",
    "common.english": "English",
    "nav.chats": "Chats",
    "nav.square": "Square",
    "nav.contacts": "Contacts",
    "nav.menu": "Menu",
    "nav.returnEntry": "Back to entry",
    "chat.title": "Chats",
    "chat.pinned": "Pinned",
    "chat.empty": "No conversations yet",
    "chat.emptyHint": "Find someone in the Square and start a conversation.",
    "chat.emptyHintNoSquare": "New conversations will appear here.",
    "chat.goSquare": "Go to Square",
    "chat.unavailable": "This conversation is unavailable",
    "chat.viewList": "View chats",
    "chat.goContacts": "Go to Contacts",
    "chat.connectionHealthy": "Connected",
    "chat.connectionWarning": "Connection unstable",
    "chat.connectionOffline": "Disconnected",
    "contacts.title": "Contacts",
    "contacts.requests": "Friend requests",
    "contacts.noRequests": "No new friend requests",
    "contacts.pending": "{count} pending",
    "contacts.groups": "Group chats",
    "contacts.groupCount": "{count} groups joined",
    "contacts.noGroups": "No group chats yet",
    "square.title": "Square",
    "square.people": "{count} online",
    "menu.title": "Menu",
    "menu.currentSpace": "Current space",
    "menu.switchAccount": "Switch account",
    "app.enteringSpace": "Entering space...",
    "app.sendProgress": "Sending {progress}%",
    "landing.createSpace": "Create space",
    "landing.joinSpace": "Join space",
    "landing.createMine": "Create my space",
    "landing.slogan": "Your space. Your people. Talk freely.",
    "landing.description": "Enter through a dedicated subdomain. Relationships, chats, and notifications stay naturally connected.",
    "landing.myEntrances": "My entrances",
    "landing.entrancesHint": "Spaces you recently visited appear here for quick access.",
    "landing.enter": "Enter",
    "landing.enterSpace": "Enter space",
    "landing.slugPlaceholder": "Space slug",
    "landing.slugRequired": "Enter a space slug.",
    "join.adminLogin": "Admin login",
    "join.checking": "Checking space",
    "join.missing": "This space has not been created",
    "join.missingHint": "Create it, or return to Yanlang.",
    "join.about": "About Sermo Yanlang",
    "join.createThis": "Create this space",
    "join.checkFailed": "Could not check this space",
    "join.checkNetwork": "Check your connection and try again.",
    "join.retry": "Try again",
    "join.welcome": "Welcome to {name}",
    "join.nicknamePrompt": "Choose a nickname to enter",
    "join.nickname": "Nickname",
    "join.nicknamePlaceholder": "The name shown in chats",
    "join.hasPassword": "Have an access password?",
    "join.password": "Access password",
    "join.forgotPassword": "Forgot password",
    "join.entering": "Entering...",
    "join.enter": "Enter space",
    "account.officialLogin": "Official account login",
    "account.officialLoggingIn": "Signing in to the official account",
    "account.officialLoginFailed": "Official account login failed",
    "account.officialExpired": "This link may have expired. Start again from the space dashboard.",
    "account.switching": "Switching account",
    "account.switchFailed": "Could not switch account",
    "menu.personalization": "Personalization",
    "menu.language": "Language",
    "menu.languageHint": "App language and notifications",
    "menu.languageUpdated": "Language updated",
    "menu.languageUpdateFailed": "Could not update language",
    "menu.chatBackground": "Chat background",
    "menu.chatBackgroundHint": "Set the mood for every conversation",
    "menu.levelUnlock": "Unlocks at LV{level}",
    "menu.chatBubble": "Chat bubbles",
    "menu.chatBubbleHint": "Give every message its own shape",
    "menu.avatarFrame": "Avatar frame",
    "menu.avatarFrameHint": "Leave your mark wherever you appear",
    "menu.squareOutfit": "Square · Outfit",
    "menu.squareOutfitHint": "Choose your character's color and silhouette",
    "menu.squareProp": "Square · Prop",
    "menu.squarePropHint": "Bring something when meeting new friends",
    "menu.squareMotion": "Square · Motion",
    "menu.squareMotionHint": "Walk, bounce, float, or dash",
    "menu.squareLimbs": "Square · Limbs",
    "menu.squareLimbsHint": "Change your character's body language",
    "menu.backgroundPreviewOther": "What shall we talk about?",
    "menu.backgroundPreviewSelf": "Let's talk freely.",
    "menu.themeDefault": "Default",
    "menu.themePaper": "Paper",
    "menu.themeMint": "Mint",
    "menu.themeDusk": "Dusk",
    "menu.themeCustom": "Custom",
    "menu.styleDefault": "Classic",
    "menu.styleTide": "Tide",
    "menu.styleComic": "Comic",
    "menu.styleNeon": "Neon",
    "menu.frameNone": "None",
    "menu.frameOrbit": "Orbit",
    "menu.frameBlaze": "Blaze",
    "menu.framePixel": "Pixel",
    "menu.outfitSunset": "Sunset",
    "menu.outfitVarsity": "Varsity",
    "menu.outfitNoir": "Noir",
    "menu.outfitCloud": "Cloud",
    "menu.propNone": "None",
    "menu.propStar": "Star",
    "menu.propCoffee": "Coffee",
    "menu.propFlag": "Flag",
    "menu.motionWalk": "Walk",
    "menu.motionBounce": "Bounce",
    "menu.motionFloat": "Float",
    "menu.motionDash": "Dash",
    "menu.limbLine": "Line",
    "menu.limbChunky": "Chunky",
    "menu.limbRobot": "Robot",
    "menu.limbRibbon": "Ribbon",
  },
  "zh-CN": {
    "common.cancel": "取消",
    "common.close": "关闭",
    "common.confirm": "确认",
    "common.done": "完成",
    "common.retry": "重试",
    "common.save": "保存",
    "common.loading": "加载中",
    "common.processing": "处理中...",
    "common.operationFailed": "操作没有完成",
    "common.closePanel": "关闭面板",
    "common.dragToClose": "拖动关闭",
    "common.updateAvailable": "发现新版本",
    "common.updateHint": "更新后即可使用最新功能",
    "common.updateNow": "立即更新",
    "common.updating": "更新中",
    "common.back": "返回",
    "common.system": "跟随系统",
    "common.chinese": "简体中文",
    "common.english": "English",
    "nav.chats": "聊天",
    "nav.square": "广场",
    "nav.contacts": "通讯",
    "nav.menu": "菜单",
    "nav.returnEntry": "返回入口",
    "chat.title": "聊天",
    "chat.pinned": "置顶",
    "chat.empty": "还没有会话",
    "chat.emptyHint": "先从广场里找到一个人，再开始第一段对话。",
    "chat.emptyHintNoSquare": "新的会话出现后会显示在这里。",
    "chat.goSquare": "去广场",
    "chat.unavailable": "无法打开这个会话",
    "chat.viewList": "查看聊天列表",
    "chat.goContacts": "去通讯",
    "chat.connectionHealthy": "连接正常",
    "chat.connectionWarning": "连接不稳定",
    "chat.connectionOffline": "连接中断",
    "contacts.title": "通讯",
    "contacts.requests": "好友申请",
    "contacts.noRequests": "现在没有新的好友申请",
    "contacts.pending": "{count} 条待处理",
    "contacts.groups": "群聊",
    "contacts.groupCount": "你已加入 {count} 个群聊",
    "contacts.noGroups": "还没有加入任何群聊",
    "square.title": "广场",
    "square.people": "{count} 人",
    "menu.title": "菜单",
    "menu.currentSpace": "当前空间",
    "menu.switchAccount": "切换账号",
    "app.enteringSpace": "正在进入空间...",
    "app.sendProgress": "发送进度 {progress}%",
    "landing.createSpace": "创建空间",
    "landing.joinSpace": "加入空间",
    "landing.createMine": "创建我的空间",
    "landing.slogan": "一方空间，尽兴开聊。",
    "landing.description": "成员通过专属子域名进入，关系、聊天和通知自然围绕同一个空间发生。",
    "landing.myEntrances": "我的入口",
    "landing.entrancesHint": "你最近进入过的空间会显示在这里，下次可以直接跳转。",
    "landing.enter": "进入",
    "landing.enterSpace": "进入空间",
    "landing.slugPlaceholder": "输入空间标识",
    "landing.slugRequired": "请输入空间标识。",
    "join.adminLogin": "管理员登录",
    "join.checking": "正在确认空间",
    "join.missing": "这个空间还没有创建",
    "join.missingHint": "创建它，或返回言浪主页。",
    "join.about": "了解 Sermo 言浪",
    "join.createThis": "创建这个空间",
    "join.checkFailed": "暂时无法确认这个空间",
    "join.checkNetwork": "检查网络后再试一次。",
    "join.retry": "重新检查",
    "join.welcome": "欢迎来到 {name}",
    "join.nicknamePrompt": "先用一个昵称，进入这个空间",
    "join.nickname": "昵称",
    "join.nicknamePlaceholder": "你在聊天里显示的名字",
    "join.hasPassword": "有访问密码？",
    "join.password": "访问密码",
    "join.forgotPassword": "忘记密码",
    "join.entering": "进入中...",
    "join.enter": "进入空间",
    "account.officialLogin": "官方账号登录",
    "account.officialLoggingIn": "正在登录官方账号",
    "account.officialLoginFailed": "官方账号登录失败",
    "account.officialExpired": "这个桥接链接可能已经过期。请回到空间后台重新发起登录。",
    "account.switching": "正在切换账号",
    "account.switchFailed": "无法切换账号",
    "menu.personalization": "个性化",
    "menu.language": "语言",
    "menu.languageHint": "界面与通知使用的语言",
    "menu.languageUpdated": "语言已更新",
    "menu.languageUpdateFailed": "语言更新失败",
    "menu.chatBackground": "聊天背景",
    "menu.chatBackgroundHint": "让整个对话进入你的世界",
    "menu.levelUnlock": "LV{level} 解锁",
    "menu.chatBubble": "聊天气泡",
    "menu.chatBubbleHint": "让每一句话拥有自己的轮廓",
    "menu.avatarFrame": "头像框",
    "menu.avatarFrameHint": "在任何出现头像的地方留下标记",
    "menu.squareOutfit": "广场 · 衣服",
    "menu.squareOutfitHint": "决定你的角色主色与剪影",
    "menu.squareProp": "广场 · 手持物",
    "menu.squarePropHint": "带点东西再去认识新朋友",
    "menu.squareMotion": "广场 · 动作",
    "menu.squareMotionHint": "漫步、弹跳、漂浮或冲浪",
    "menu.squareLimbs": "广场 · 四肢",
    "menu.squareLimbsHint": "改变人物的肢体语言",
    "menu.backgroundPreviewOther": "今天聊点什么？",
    "menu.backgroundPreviewSelf": "尽兴开聊。",
    "menu.themeDefault": "默认",
    "menu.themePaper": "纸感",
    "menu.themeMint": "薄荷",
    "menu.themeDusk": "暮色",
    "menu.themeCustom": "自定义",
    "menu.styleDefault": "经典",
    "menu.styleTide": "潮汐",
    "menu.styleComic": "漫画",
    "menu.styleNeon": "霓虹",
    "menu.frameNone": "无",
    "menu.frameOrbit": "星轨",
    "menu.frameBlaze": "烈焰",
    "menu.framePixel": "像素",
    "menu.outfitSunset": "落日",
    "menu.outfitVarsity": "学院",
    "menu.outfitNoir": "黑潮",
    "menu.outfitCloud": "云游",
    "menu.propNone": "无",
    "menu.propStar": "星星",
    "menu.propCoffee": "咖啡",
    "menu.propFlag": "旗帜",
    "menu.motionWalk": "漫步",
    "menu.motionBounce": "弹跳",
    "menu.motionFloat": "漂浮",
    "menu.motionDash": "冲浪",
    "menu.limbLine": "线条",
    "menu.limbChunky": "积木",
    "menu.limbRobot": "机械",
    "menu.limbRibbon": "飘带",
  },
} as const;

export type TranslationKey = keyof (typeof messages)["en"];

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

interface LanguageContextValue {
  language: SupportedLanguage;
  preference: LanguagePreference;
  locale: string;
  saving: boolean;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  setPreference: (preference: LanguagePreference) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
let activeLanguage: SupportedLanguage = getBrowserJoinLanguage();

export function getActiveLanguage() {
  return activeLanguage;
}

export function getActiveLocale() {
  return activeLanguage === "zh-CN" ? "zh-CN" : "en-US";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { session, patchSessionUser } = useAuth();
  const systemLanguage = getBrowserJoinLanguage();
  const [preference, setPreferenceState] = useState<LanguagePreference>("system");
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolveJoinLanguage(session?.user.language ?? systemLanguage)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) {
      setPreferenceState("system");
      setLanguage(systemLanguage);
      return;
    }

    let cancelled = false;
    void api.getUserMe().then((user) => {
      if (cancelled) return;
      const nextPreference = user.language_preference ?? "system";
      setPreferenceState(nextPreference);
      setLanguage(resolveJoinLanguage(user.language ?? systemLanguage));
      patchSessionUser({
        language: user.language,
        language_preference: nextPreference,
      });
    }).catch(() => {
      if (cancelled) return;
      setLanguage(resolveJoinLanguage(session.user.language ?? systemLanguage));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, session?.user.user_id]);

  useEffect(() => {
    activeLanguage = language;
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    preference,
    locale: language === "zh-CN" ? "zh-CN" : "en-US",
    saving,
    t(key, values) {
      return interpolate(messages[language][key], values);
    },
    async setPreference(nextPreference) {
      if (!session || saving || nextPreference === preference) return;
      const previousPreference = preference;
      const previousLanguage = language;
      const nextLanguage = nextPreference === "system" ? systemLanguage : nextPreference;
      setPreferenceState(nextPreference);
      setLanguage(nextLanguage);
      setSaving(true);
      try {
        const user = await api.setLanguagePreference(nextPreference, systemLanguage);
        const effectiveLanguage = resolveJoinLanguage(user.language ?? nextLanguage);
        setPreferenceState(user.language_preference ?? nextPreference);
        setLanguage(effectiveLanguage);
        patchSessionUser({
          language: effectiveLanguage,
          language_preference: user.language_preference ?? nextPreference,
        });
      } catch (error) {
        setPreferenceState(previousPreference);
        setLanguage(previousLanguage);
        throw error;
      } finally {
        setSaving(false);
      }
    },
  }), [language, patchSessionUser, preference, saving, session, systemLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useI18n must be used within LanguageProvider");
  return context;
}
