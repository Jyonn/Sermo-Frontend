import { useEffect, useState } from "react";
import samplePhoto from "../assets/square/plaza-waterfront.jpg";

type MediaMode = "none" | "images" | "audio" | "video";
type LocationEntry = "sheet" | "separate" | "inline";
type PublishPlacement = "header" | "bottom";
type TextScale = "compact" | "balanced" | "expressive";

const mediaCopy: Record<Exclude<MediaMode, "none">, { label: string; icon: string; note: string }> = {
  images: { label: "照片", icon: "imagesmode", note: "最多 9 张" },
  audio: { label: "语音", icon: "mic", note: "录制一段声音" },
  video: { label: "视频", icon: "videocam", note: "每条发言 1 个" },
};

const locationOptions: Array<{ key: LocationEntry; label: string; note: string }> = [
  { key: "sheet", label: "收进内容 Sheet", note: "最克制，所有附加能力只有一个入口" },
  { key: "separate", label: "独立位置胶囊", note: "位置更容易发现，但不会长期展示三种媒体" },
  { key: "inline", label: "正文后智能提示", note: "输入后轻量出现，最贴近内容语境" },
];

const textOptions: Array<{ key: TextScale; label: string; size: string }> = [
  { key: "compact", label: "紧凑", size: "18" },
  { key: "balanced", label: "舒展", size: "22" },
  { key: "expressive", label: "表达", size: "26" },
];

function ContentSheet({ active, includeLocation, located, onClose, onLocation, onSelect }: {
  active: MediaMode;
  includeLocation: boolean;
  located: boolean;
  onClose: () => void;
  onLocation: () => void;
  onSelect: (mode: Exclude<MediaMode, "none">) => void;
}) {
  return (
    <div className="composer-lab-sheet-backdrop" onClick={onClose}>
      <section className="composer-lab-format-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="composer-lab-sheet-handle" />
        <div className="composer-lab-sheet-title"><div><small>添加到发言</small><strong>让这一刻更完整</strong></div><button onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button></div>
        <div className="composer-lab-format-list">
          {(Object.keys(mediaCopy) as Array<Exclude<MediaMode, "none">>).map((mode) => (
            <button className={active === mode ? "is-active" : ""} key={mode} onClick={() => { onSelect(mode); onClose(); }} type="button">
              <span className="material-symbols-outlined">{mediaCopy[mode].icon}</span><span><strong>{mediaCopy[mode].label}</strong><small>{mediaCopy[mode].note}</small></span><i>{active === mode ? "已添加" : "添加"}</i>
            </button>
          ))}
          {includeLocation ? <button className={located ? "is-active" : ""} onClick={onLocation} type="button"><span className="material-symbols-outlined">location_on</span><span><strong>位置</strong><small>{located ? "福建省厦门市思明区" : "标记此刻所在的位置"}</small></span><i>{located ? "移除" : "添加"}</i></button> : null}
        </div>
      </section>
    </div>
  );
}

function VisibilitySheet({ value, onClose, onSelect }: { value: "public" | "friends"; onClose: () => void; onSelect: (value: "public" | "friends") => void }) {
  return <div className="composer-lab-sheet-backdrop" onClick={onClose}><section className="composer-lab-visibility-sheet" onClick={(event) => event.stopPropagation()}><span className="composer-lab-sheet-handle" /><h3>谁可以看</h3>{(["public", "friends"] as const).map((item) => <button key={item} onClick={() => { onSelect(item); onClose(); }} type="button"><span className="material-symbols-outlined">{item === "public" ? "public" : "group"}</span><span><strong>{item === "public" ? "所有人" : "仅好友"}</strong><small>{item === "public" ? "会出现在探索与好友圈" : "只向空间好友展示"}</small></span><span className="material-symbols-outlined">{value === item ? "check_circle" : "radio_button_unchecked"}</span></button>)}</section></div>;
}

function Attachment({ mode, imageCount, recording, seconds, onAddImage, onRemove, onToggleRecording }: { mode: MediaMode; imageCount: number; recording: boolean; seconds: number; onAddImage: () => void; onRemove: () => void; onToggleRecording: () => void }) {
  if (mode === "none") return null;
  if (mode === "images") return <section className="composer-lab-attachment is-images"><div className="composer-lab-photo-grid">{Array.from({ length: imageCount }, (_, index) => <figure key={index}><img alt="照片预览" src={samplePhoto} style={{ objectPosition: `${48 + index * 5}% center` }} /><button onClick={onRemove} type="button"><span className="material-symbols-outlined">close</span></button></figure>)}{imageCount < 9 ? <button className="composer-lab-add-photo" onClick={onAddImage} type="button"><span className="material-symbols-outlined">add</span><small>{imageCount}/9</small></button> : null}</div></section>;
  if (mode === "audio") return <section className="composer-lab-attachment is-audio"><button className={recording ? "is-recording" : ""} onClick={onToggleRecording} type="button"><span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span></button><div><strong>{recording ? "正在录制" : seconds ? "语音已就绪" : "轻触开始录音"}</strong><span className="composer-lab-wave">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 7) % 18)}px` }} />)}</span></div><time>0:{String(seconds).padStart(2, "0")}</time></section>;
  return <section className="composer-lab-attachment is-video"><img alt="视频封面" src={samplePhoto} /><span className="material-symbols-outlined">play_arrow</span><div><strong>视频已就绪</strong><small>00:28 · 竖屏</small></div></section>;
}

function ComposerPrototype({ locationEntry, publishPlacement, textScale }: { locationEntry: LocationEntry; publishPlacement: PublishPlacement; textScale: TextScale }) {
  const [mode, setMode] = useState<MediaMode>("none");
  const [text, setText] = useState("");
  const [imageCount, setImageCount] = useState(1);
  const [contentOpen, setContentOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [located, setLocated] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [published, setPublished] = useState(false);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds((value) => Math.min(60, value + 1)), 1000); return () => window.clearInterval(timer); }, [recording]);
  const canPublish = text.trim().length > 0 || mode !== "none";
  const publish = () => { if (canPublish) setPublished(true); };
  const switchMode = (next: Exclude<MediaMode, "none">) => { setMode(next); setRecording(false); setSeconds(0); if (next === "images") setImageCount((count) => Math.max(1, count)); };
  const mediaLabel = mode === "none" ? "添加照片、语音或视频" : `已加入${mediaCopy[mode].label} · 点击更换`;

  return (
    <div className={`composer-lab-phone variant-canvas text-${textScale} publish-${publishPlacement}`}>
      <header className="composer-lab-drawer-header"><button aria-label="返回" type="button"><span className="material-symbols-outlined">arrow_back</span></button><strong>发表发言</strong>{publishPlacement === "header" ? <button className="composer-lab-publish" disabled={!canPublish} onClick={publish} type="button">发言</button> : <span />}</header>
      <div className="composer-lab-editor">
        <div className="composer-lab-author"><img alt="Fly" src="/assets/avatars/v2/01.png" /><span><strong>Fly</strong><small>在元梦之星发言</small></span></div>
        <div className="composer-lab-writing-zone"><textarea autoFocus maxLength={140} onChange={(event) => setText(event.target.value)} placeholder="分享此刻想说的" value={text} /><span className="composer-lab-count">{text.length}<i>/140</i></span></div>
        <Attachment imageCount={imageCount} mode={mode} onAddImage={() => setImageCount((count) => Math.min(9, count + 1))} onRemove={() => setImageCount((count) => Math.max(1, count - 1))} onToggleRecording={() => setRecording((value) => !value)} recording={recording} seconds={seconds} />
        {located ? <button className="composer-lab-location-tag is-active" onClick={() => setLocated(false)} type="button"><span className="material-symbols-outlined">location_on</span><span>福建省厦门市思明区</span><span className="material-symbols-outlined">close</span></button> : null}
        {locationEntry === "inline" && text.trim() && !located ? <button className="composer-lab-location-suggestion" onClick={() => setLocated(true)} type="button"><span className="material-symbols-outlined">near_me</span><span>要标记此刻的位置吗？</span><b>添加</b></button> : null}
        <div className="composer-lab-content-actions"><button className="composer-lab-add-content" onClick={() => setContentOpen(true)} type="button"><span className="material-symbols-outlined">add_circle</span><span>{mediaLabel}</span></button>{locationEntry === "separate" && !located ? <button className="composer-lab-location-chip" onClick={() => setLocated(true)} type="button"><span className="material-symbols-outlined">location_on</span><span>位置</span></button> : null}</div>
        <button className="composer-lab-visibility" onClick={() => setVisibilityOpen(true)} type="button"><span className="material-symbols-outlined">{visibility === "public" ? "public" : "group"}</span><span><small>谁可以看</small><strong>{visibility === "public" ? "所有人" : "仅好友"}</strong></span><span className="material-symbols-outlined">chevron_right</span></button>
      </div>
      {publishPlacement === "bottom" ? <footer className="composer-lab-publish-footer"><button disabled={!canPublish} onClick={publish} type="button">发布这条发言<span className="material-symbols-outlined">arrow_upward</span></button></footer> : null}
      {contentOpen ? <ContentSheet active={mode} includeLocation={locationEntry === "sheet"} located={located} onClose={() => setContentOpen(false)} onLocation={() => setLocated((value) => !value)} onSelect={switchMode} /> : null}
      {visibilityOpen ? <VisibilitySheet onClose={() => setVisibilityOpen(false)} onSelect={setVisibility} value={visibility} /> : null}
      {published ? <div className="composer-lab-toast" onAnimationEnd={() => setPublished(false)}><span className="material-symbols-outlined">check_circle</span>发言已准备好</div> : null}
    </div>
  );
}

export default function SquareComposerLabPage() {
  const [locationEntry, setLocationEntry] = useState<LocationEntry>("sheet");
  const [publishPlacement, setPublishPlacement] = useState<PublishPlacement>("header");
  const [textScale, setTextScale] = useState<TextScale>("balanced");
  return <main className="composer-lab-page composer-lab-refinement"><header className="composer-lab-hero"><span>SQUARE / QUIET CANVAS</span><h1>安静画布，按需表达</h1><p>保留一个内容入口，并分别比较位置、发布动作与正文字号。下面的选择会即时作用于同一个 Drawer。</p></header><section className="composer-lab-stage"><aside className="composer-lab-controls"><section><small>01 / 位置入口</small><h2>位置应该在哪里出现？</h2><div className="composer-lab-option-list">{locationOptions.map((item) => <button className={locationEntry === item.key ? "is-active" : ""} key={item.key} onClick={() => setLocationEntry(item.key)} type="button"><span className="material-symbols-outlined">{item.key === "sheet" ? "layers" : item.key === "separate" ? "location_on" : "auto_awesome"}</span><span><strong>{item.label}</strong><small>{item.note}</small></span></button>)}</div></section><section><small>02 / 发布动作</small><h2>发布按钮放在哪里？</h2><div className="composer-lab-segmented"><button className={publishPlacement === "header" ? "is-active" : ""} onClick={() => setPublishPlacement("header")} type="button">右上角</button><button className={publishPlacement === "bottom" ? "is-active" : ""} onClick={() => setPublishPlacement("bottom")} type="button">底部主按钮</button></div></section><section><small>03 / 正文字号</small><h2>文字需要多大的表达感？</h2><div className="composer-lab-type-scale">{textOptions.map((item) => <button className={textScale === item.key ? "is-active" : ""} key={item.key} onClick={() => setTextScale(item.key)} type="button"><b>{item.size}</b><span>{item.label}</span></button>)}</div></section></aside><ComposerPrototype locationEntry={locationEntry} publishPlacement={publishPlacement} textScale={textScale} /></section></main>;
}
