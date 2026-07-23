import { useEffect, useMemo, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { InputDialog } from "../components/InputDialog";
import { buildAdminEntryHref, buildJoinHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";
import { listRecentSpaces, type RecentSpaceEntry } from "../lib/recentSpaces";

export default function LandingPage() {
  const [slugInput, setSlugInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [recentSpaces, setRecentSpaces] = useState<RecentSpaceEntry[]>([]);
  const normalizedSlug = useMemo(() => normalizeSlug(slugInput), [slugInput]);

  useEffect(() => {
    setRecentSpaces(listRecentSpaces());
  }, []);

  const joinSpace = () => {
    if (!normalizedSlug) {
      setSubmitError("请输入空间标识。");
      return;
    }

    setJoinDialogOpen(false);
    window.location.assign(buildJoinHrefForCurrentHost(normalizedSlug));
  };

  return (
    <AppChrome
      hidePageTitle
      publicHeader
      title="Sermo 言浪"
      topbarAction={
        <>
          <a className="ghost-chip" href={buildAdminEntryHref("create")}>
            创建空间
          </a>
          <button className="ghost-chip" onClick={() => setJoinDialogOpen(true)} type="button">
            加入空间
          </button>
        </>
      }
    >
      <div className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">Sermo 言浪</p>
            <h1>一方空间，尽兴开聊。</h1>
            <p className="landing-description">成员通过专属子域名进入，关系、聊天和通知自然围绕同一个空间发生。</p>
            <div className="landing-actions">
              <a className="button" href={buildAdminEntryHref("create")}>
                创建我的空间
              </a>
              <button className="ghost-button landing-secondary" onClick={() => setJoinDialogOpen(true)} type="button">
                加入空间
              </button>
            </div>
          </div>
        </section>

        {recentSpaces.length ? (
          <section className="landing-entry-panel">
            <div className="landing-entry-copy">
              <p className="landing-eyebrow">My Entrances</p>
              <h2>我的入口</h2>
              <p>你最近进入过的空间会显示在这里，下次可以直接跳转。</p>
            </div>
            <div className="landing-entry-list">
              {recentSpaces.map((space) => (
                <a className="landing-entry-item" href={`https://${space.domain}`} key={space.slug}>
                  <div className="landing-entry-main">
                    <strong>{space.name}</strong>
                    <span>{space.domain}</span>
                  </div>
                  <span className="landing-entry-action">进入</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <InputDialog
        confirmLabel="进入空间"
        onChange={setSlugInput}
        onClose={() => setJoinDialogOpen(false)}
        onConfirm={joinSpace}
        open={joinDialogOpen}
        placeholder="输入空间标识"
        title="加入空间"
        value={slugInput}
      />
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
