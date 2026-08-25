import { useEffect, useMemo, useState } from "react";
import samplePhoto from "../assets/square/plaza-waterfront.jpg";

type MediaMode = "text" | "images" | "audio" | "video";
type Variant = "canvas" | "format" | "inline" | "dock";

const variants: Array<{ key: Variant; name: string; note: string }> = [
  { key: "canvas", name: "安静画布", note: "写作优先，需要时再添加内容" },
  { key: "format", name: "内容类型", note: "用一行明确当前发言形态" },
  { key: "inline", name: "行内插入", note: "在正文末尾自然接入附件" },
  { key: "dock", name: "上拉内容坞", note: "单手操作，媒体能力从底部浮现" },
];

const modeCopy: Record<MediaMode, { label: string; icon: string }> = {
  text: { label: "纯文字", icon: "notes" },
  images: { label: "照片", icon: "imagesmode" },
  audio: { label: "语音", icon: "mic" },
  video: { label: "视频", icon: "videocam" },
};

function FormatSheet({ active, onClose, onSelect }: { active: MediaMode; onClose: () => void; onSelect: (mode: MediaMode) => void }) {
  return (
    <div className="composer-lab-sheet-backdrop" onClick={onClose}>
      <section className="composer-lab-format-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="composer-lab-sheet-handle" />
        <div className="composer-lab-sheet-title">
          <div><small>添加到发言</small><strong>选择一种内容</strong></div>
          <button onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="composer-lab-format-list">
          {(Object.keys(modeCopy) as MediaMode[]).map((mode) => (
            <button className={active === mode ? "is-active" : ""} key={mode} onClick={() => { onSelect(mode); onClose(); }} type="button">
              <span className="material-symbols-outlined">{modeCopy[mode].icon}</span>
              <span><strong>{modeCopy[mode].label}</strong><small>{mode === "images" ? "最多 9 张" : mode === "text" ? "只留下文字" : "每条发言 1 个"}</small></span>
              <i>{active === mode ? "当前" : "选择"}</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function VisibilitySheet({ value, onClose, onSelect }: { value: "public" | "friends"; onClose: () => void; onSelect: (value: "public" | "friends") => void }) {
  return (
    <div className="composer-lab-sheet-backdrop" onClick={onClose}>
      <section className="composer-lab-visibility-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="composer-lab-sheet-handle" />
        <h3>谁可以看</h3>
        {(["public", "friends"] as const).map((item) => (
          <button key={item} onClick={() => { onSelect(item); onClose(); }} type="button">
            <span className="material-symbols-outlined">{item === "public" ? "public" : "group"}</span>
            <span><strong>{item === "public" ? "所有人" : "仅好友"}</strong><small>{item === "public" ? "会出现在探索与好友圈" : "只向空间好友展示"}</small></span>
            <span className="material-symbols-outlined">{value === item ? "check_circle" : "radio_button_unchecked"}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

function Attachment({ mode, imageCount, recording, seconds, onAddImage, onRemove, onToggleRecording }: {
  mode: MediaMode;
  imageCount: number;
  recording: boolean;
  seconds: number;
  onAddImage: () => void;
  onRemove: () => void;
  onToggleRecording: () => void;
}) {
  if (mode === "text") return null;
  if (mode === "images") {
    return (
      <section className="composer-lab-attachment is-images">
        <div className="composer-lab-photo-grid">
          {Array.from({ length: imageCount }, (_, index) => (
            <figure key={index}><img alt="照片预览" src={samplePhoto} style={{ objectPosition: `${48 + index * 5}% center` }} /><button onClick={onRemove} type="button"><span className="material-symbols-outlined">close</span></button></figure>
          ))}
          {imageCount < 9 ? <button className="composer-lab-add-photo" onClick={onAddImage} type="button"><span className="material-symbols-outlined">add</span><small>{imageCount}/9</small></button> : null}
        </div>
      </section>
    );
  }
  if (mode === "audio") {
    return (
      <section className="composer-lab-attachment is-audio">
        <button className={recording ? "is-recording" : ""} onClick={onToggleRecording} type="button">
          <span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span>
        </button>
        <div><strong>{recording ? "正在录制" : seconds ? "语音已就绪" : "轻触开始录音"}</strong><span className="composer-lab-wave">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 7) % 18)}px` }} />)}</span></div>
        <time>0:{String(seconds).padStart(2, "0")}</time>
      </section>
    );
  }
  return (
    <section className="composer-lab-attachment is-video">
      <img alt="视频封面" src={samplePhoto} />
      <span className="material-symbols-outlined">play_arrow</span>
      <div><strong>视频已就绪</strong><small>00:28 · 竖屏</small></div>
    </section>
  );
}

function ComposerPrototype({ variant }: { variant: Variant }) {
  const [mode, setMode] = useState<MediaMode>("text");
  const [text, setText] = useState(variant === "inline" ? "今天的风很适合慢一点。" : "");
  const [imageCount, setImageCount] = useState(variant === "format" ? 0 : 1);
  const [formatOpen, setFormatOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.min(60, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const canPublish = text.trim().length > 0 || mode !== "text";
  const switchMode = (next: MediaMode) => {
    setMode(next);
    setRecording(false);
    setSeconds(0);
    if (next === "images") setImageCount((count) => Math.max(1, count));
  };
  const visibilityLabel = visibility === "public" ? "所有人" : "仅好友";

  return (
    <div className={`composer-lab-phone variant-${variant}`}>
      <header className="composer-lab-drawer-header">
        <button aria-label="返回" type="button"><span className="material-symbols-outlined">arrow_back</span></button>
        <strong>{variant === "format" ? modeCopy[mode].label + "发言" : "发表发言"}</strong>
        <button className="composer-lab-publish" disabled={!canPublish} onClick={() => setPublished(true)} type="button">发言</button>
      </header>

      <div className="composer-lab-editor">
        <div className="composer-lab-author"><img alt="Fly" src="/assets/avatars/v2/01.png" /><span><strong>Fly</strong><small>在元梦之星发言</small></span></div>

        {variant === "format" ? (
          <button className="composer-lab-current-format" onClick={() => setFormatOpen(true)} type="button">
            <span className="material-symbols-outlined">{modeCopy[mode].icon}</span>
            <span><small>内容类型</small><strong>{modeCopy[mode].label}</strong></span>
            <span className="material-symbols-outlined">expand_more</span>
          </button>
        ) : null}

        <div className="composer-lab-writing-zone">
          <textarea autoFocus={variant === "canvas"} maxLength={140} onChange={(event) => setText(event.target.value)} placeholder={variant === "dock" ? "留下一句此刻真正想说的话" : "分享此刻想说的"} value={text} />
          <span className="composer-lab-count">{text.length}<i>/140</i></span>
          {variant === "inline" && mode === "text" ? <button className="composer-lab-inline-add" onClick={() => setFormatOpen(true)} type="button"><span className="material-symbols-outlined">add</span><span>接着放点什么</span></button> : null}
        </div>

        <Attachment
          imageCount={imageCount}
          mode={mode}
          onAddImage={() => setImageCount((count) => Math.min(9, count + 1))}
          onRemove={() => setImageCount((count) => Math.max(1, count - 1))}
          onToggleRecording={() => setRecording((value) => !value)}
          recording={recording}
          seconds={seconds}
        />

        {variant === "canvas" ? (
          <button className="composer-lab-add-content" onClick={() => setFormatOpen(true)} type="button">
            <span className="material-symbols-outlined">add_circle</span><span>{mode === "text" ? "添加照片、语音或视频" : `已加入${modeCopy[mode].label} · 点击更换`}</span>
          </button>
        ) : null}

        {variant === "dock" ? (
          <button className={`composer-lab-dock-trigger ${mode !== "text" ? "has-media" : ""}`} onClick={() => setFormatOpen(true)} type="button">
            <span className="composer-lab-dock-handle" />
            <span className="material-symbols-outlined">{mode === "text" ? "keyboard_arrow_up" : modeCopy[mode].icon}</span>
            <span>{mode === "text" ? "上拉加入画面或声音" : `${modeCopy[mode].label}已加入`}</span>
          </button>
        ) : null}

        <button className="composer-lab-visibility" onClick={() => setVisibilityOpen(true)} type="button">
          <span className="material-symbols-outlined">{visibility === "public" ? "public" : "group"}</span>
          <span><small>谁可以看</small><strong>{visibilityLabel}</strong></span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {variant === "format" && mode === "text" ? <button className="composer-lab-format-callout" onClick={() => setFormatOpen(true)} type="button">选择这次发言的表达方式 <span className="material-symbols-outlined">arrow_forward</span></button> : null}
      {formatOpen ? <FormatSheet active={mode} onClose={() => setFormatOpen(false)} onSelect={switchMode} /> : null}
      {visibilityOpen ? <VisibilitySheet onClose={() => setVisibilityOpen(false)} onSelect={setVisibility} value={visibility} /> : null}
      {published ? <div className="composer-lab-toast" onAnimationEnd={() => setPublished(false)}><span className="material-symbols-outlined">check_circle</span>发言已准备好</div> : null}
    </div>
  );
}

export default function SquareComposerLabPage() {
  const [active, setActive] = useState<Variant>("canvas");
  const current = useMemo(() => variants.find((item) => item.key === active) ?? variants[0], [active]);

  return (
    <main className="composer-lab-page">
      <header className="composer-lab-hero">
        <span>SQUARE / COMPOSER STUDY</span>
        <h1>让内容能力在需要时出现</h1>
        <p>四套可交互的发言 Drawer。它们共享相同规则，但用不同方式隐藏媒体入口。</p>
      </header>
      <nav className="composer-lab-variants" aria-label="选择设计方案">
        {variants.map((variant, index) => (
          <button className={active === variant.key ? "is-active" : ""} key={variant.key} onClick={() => setActive(variant.key)} type="button">
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{variant.name}</strong><small>{variant.note}</small>
          </button>
        ))}
      </nav>
      <section className="composer-lab-stage">
        <div className="composer-lab-stage-copy"><small>正在审阅</small><h2>{current.name}</h2><p>{current.note}</p><i>点击画面中的入口、切换类型、录音或发布，体验完整流程。</i></div>
        <ComposerPrototype key={active} variant={active} />
      </section>
    </main>
  );
}
