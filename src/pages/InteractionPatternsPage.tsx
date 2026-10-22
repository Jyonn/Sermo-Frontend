import { useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { useTheme } from "../lib/theme";
import { ActionSheet } from "../components/ActionSheet";
import { AlertDialog } from "../components/AlertDialog";
import { BottomSheet } from "../components/BottomSheet";
import { InlineAlert } from "../components/InlineAlert";
import { Snackbar } from "../components/Snackbar";
import { Tour } from "../components/Tour";
import { ImageLightbox } from "../components/ImageLightbox";
import { DEFAULT_SHEET_STOPS } from "../lib/interactionPatterns";
import photo from "../assets/square/plaza-waterfront.jpg";
import "./InteractionPatternsPage.css";

const patterns = ["sheet", "actions", "snackbar", "alert", "tour", "lightbox", "inline"] as const;
type Pattern = typeof patterns[number];
const names = { sheet: "Bottom Sheet", actions: "Action Sheet", snackbar: "Snackbar", alert: "Alert Dialog", tour: "Tour", lightbox: "Lightbox", inline: "Inline Alert" };

export default function InteractionPatternsPage() {
  const { t, language, setPreference: setLanguage } = useI18n();
  const { resolvedTheme, setPreference: setTheme } = useTheme();
  const [active, setActive] = useState<Pattern>("sheet");
  const [open, setOpen] = useState<Pattern | null>(null);
  const [removed, setRemoved] = useState(false);
  const [snack, setSnack] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [result, setResult] = useState("");
  const [code, setCode] = useState("AB");
  const [submitted, setSubmitted] = useState(false);
  const search = useRef<HTMLButtonElement | null>(null);
  const publish = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const valid = /^[A-Z0-9]{6}$/.test(code);
  const switchPattern = (key: Pattern) => { setActive(key); setResult(""); };
  return <main className="patterns-page">
    <header className="patterns-heading"><div><span>FRIENDEN / INTERACTION ATLAS</span><h1>{t("patterns.title")}</h1><p>{t("patterns.intro")}</p></div><div className="patterns-controls"><button className="ghost-button" aria-label={t("patterns.toggleTheme")} type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><span className="material-symbols-outlined" aria-hidden="true">{resolvedTheme === "dark" ? "light_mode" : "dark_mode"}</span></button><button className="ghost-button" type="button" onClick={() => void setLanguage(language === "zh-CN" ? "en" : "zh-CN")}>{language === "zh-CN" ? "EN" : "中文"}</button><a href="#pattern-mapping">{t("patterns.mapping")} ↘</a></div></header>
    <div className="patterns-workspace">
      <nav className="patterns-nav" aria-label={t("patterns.library")}>
        {patterns.map((key, index) => <button aria-pressed={active === key} key={key} onClick={() => switchPattern(key)} type="button"><small>0{index + 1}</small><span><strong>{t(`patterns.${key}.title`)}</strong><small>{names[key]}</small></span><i aria-hidden="true">↗</i></button>)}
      </nav>
      <section className="patterns-study" aria-label={names[active]}>
        <header><small>{names[active]}</small><h2>{t(`patterns.${active}.title`)}</h2><p>{t(`patterns.${active}.hint`)}</p></header>
        <div className="patterns-stage">
          {active === "sheet" ? <div className="patterns-calendar"><span className="patterns-date">22<span>OCT</span></span><div><small>{t("patterns.publicAgenda")}</small><h3>{t("patterns.agendaTitle")}</h3><p>{t("patterns.sheet.sample")}</p></div><button className="button" onClick={() => setOpen("sheet")} type="button">{t("patterns.preview")}</button></div> : null}
          {active === "actions" ? <div className="patterns-actions-demo"><div className="patterns-avatar">F</div><h3>Frienden</h3><p>{t("patterns.actions.sample")}</p><button className="button" type="button" onClick={() => setOpen("actions")}>{t("patterns.chooseAction")}</button></div> : null}
          {active === "snackbar" ? <div className="patterns-inbox"><small>{t("patterns.localOnly")}</small><h3>{t("patterns.inbox")}</h3>{(["patterns.messageA", "patterns.messageB", "patterns.messageC"] as const).filter((key) => !removed || key !== "patterns.messageB").map((key, index) => <article key={key}><i aria-hidden="true">0{index + 1}</i><span>{t(key)}</span></article>)}<button className="ghost-button" disabled={removed} type="button" onClick={() => { setRemoved(true); setSnack(true); }}>{t("patterns.removeDemo")}</button>{removed && !snack ? <button className="ghost-button" type="button" onClick={() => setRemoved(false)}>{t("patterns.reset")}</button> : null}</div> : null}
          {active === "alert" ? <div className="patterns-alert-demo"><span className="material-symbols-outlined" aria-hidden="true">shield</span><h3>{t(deleted ? "patterns.demoDeleted" : "patterns.alert.sample")}</h3><p>{t("patterns.localOnly")}</p><button className={deleted ? "ghost-button" : "danger-button"} type="button" onClick={() => deleted ? setDeleted(false) : setOpen("alert")}>{t(deleted ? "patterns.reset" : "patterns.deleteDemo")}</button></div> : null}
          {active === "tour" ? <div className="patterns-tour-demo"><header><strong>{t("square.title")}</strong><button ref={search} aria-label={t("patterns.search")} className="icon-button" type="button" onClick={() => setResult(t("patterns.demoAction"))}><span className="material-symbols-outlined" aria-hidden="true">search</span></button><button ref={publish} className="button" type="button" onClick={() => setResult(t("patterns.demoAction"))}>{t("patterns.publish")}</button></header><div ref={list} className="patterns-demo-post"><small>FRIENDEN</small><h3>{t("patterns.messageB")}</h3><p>{t("patterns.messageA")}</p></div><button className="ghost-button" type="button" onClick={() => setOpen("tour")}>{t("patterns.startTour")}</button></div> : null}
          {active === "lightbox" ? <button className="patterns-photo" type="button" aria-label={t("patterns.openPhoto")} onClick={() => setOpen("lightbox")}><img src={photo} alt={t("patterns.photoAlt")} /><span>{t("patterns.openPhoto")} ↗</span></button> : null}
          {active === "inline" ? <form className="patterns-inline-form" onSubmit={(event) => { event.preventDefault(); if (valid) setSubmitted(true); }}><label htmlFor="pattern-invite-code">{t("patterns.inviteCode")}</label><input id="pattern-invite-code" className="input" autoComplete="off" value={code} aria-invalid={!valid} aria-describedby="pattern-code-feedback" onChange={(event) => { setCode(event.target.value.toUpperCase()); setSubmitted(false); }} />{!valid ? <InlineAlert id="pattern-code-feedback">{t("patterns.invalidCode")}</InlineAlert> : <InlineAlert id="pattern-code-feedback" tone="success">{t(submitted ? "patterns.localValidated" : "patterns.validCode")}</InlineAlert>}<button className="button" type="submit" disabled={!valid}>{t("patterns.validate")}</button></form> : null}
        </div>
        {result ? <InlineAlert tone="info">{result}</InlineAlert> : null}
        <footer><strong>{t("patterns.useWhen")}</strong><p>{t(`patterns.${active}.use`)}</p></footer>
      </section>
    </div>
    <section id="pattern-mapping" className="patterns-mapping"><header><small>RIGHT PLACE, RIGHT PATTERN</small><h2>{t("patterns.mapping")}</h2><p>{t("patterns.mappingHint")}</p></header><div>{patterns.map((key, index) => <article key={key}><span>0{index + 1}</span><div><h3>{names[key]}</h3><p>{t(`patterns.${key}.use`)}</p></div><small>{t(["actions", "alert", "inline"].includes(key) ? "patterns.adopted" : ["sheet", "lightbox"].includes(key) ? "patterns.reused" : "patterns.ready")}</small></article>)}</div></section>
    <BottomSheet open={open === "sheet"} title={t("patterns.agendaTitle")} description={t("patterns.sheet.sample")} snapPoints={DEFAULT_SHEET_STOPS} initialSnap={1} onClose={() => setOpen(null)}>
      <div className="patterns-stops" aria-label={t("patterns.sheetStops")}>{t("patterns.sheetStops")}</div>{["10:00", "13:30", "17:00", "19:30"].map((time, index) => <div className="patterns-agenda-row" key={time}><time>{time}</time><div><strong>{t(index % 2 ? "patterns.focus" : "patterns.free")}</strong><small>{t("patterns.localOnly")}</small></div></div>)}
    </BottomSheet>
    <ActionSheet open={open === "actions"} title={t("patterns.chooseAction")} description={t("patterns.localOnly")} onClose={() => setOpen(null)} actions={[
      { key: "camera", label: t("patterns.camera"), icon: <span className="material-symbols-outlined">photo_camera</span>, onSelect: () => setResult(t("patterns.cameraChosen")) },
      { key: "album", label: t("patterns.album"), icon: <span className="material-symbols-outlined">photo_library</span>, onSelect: () => setResult(t("patterns.albumChosen")) },
      { key: "remove", label: t("patterns.removeDemo"), danger: true, icon: <span className="material-symbols-outlined">delete</span>, onSelect: () => setResult(t("patterns.demoAction")) },
    ]} />
    <Snackbar open={snack} message={t("patterns.removed")} actionLabel={t("patterns.undo")} onAction={() => setRemoved(false)} onClose={() => setSnack(false)} />
    <AlertDialog open={open === "alert"} title={t("patterns.deleteTitle")} description={t("patterns.deleteHint")} confirmLabel={t("patterns.confirmDelete")} onClose={() => setOpen(null)} onConfirm={() => { setDeleted(true); setOpen(null); }} />
    <Tour open={open === "tour"} onClose={() => setOpen(null)} steps={[
      { target: () => search.current, title: t("patterns.search"), description: t("patterns.tourSearch") },
      { target: () => publish.current, title: t("patterns.publish"), description: t("patterns.tourPublish") },
      { target: () => list.current, title: t("patterns.inbox"), description: t("patterns.tourList") },
    ]} />
    {open === "lightbox" ? <ImageLightbox index={0} uris={[photo]} altPrefix={t("patterns.photoAlt")} onIndexChange={() => undefined} onClose={() => setOpen(null)} /> : null}
  </main>;
}
