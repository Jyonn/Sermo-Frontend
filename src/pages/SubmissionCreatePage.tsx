import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { OfficialBadge } from "../components/OfficialBadge";
import { OperatorBadge } from "../components/OperatorBadge";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { SubmissionRecipientDTO } from "../types";

function makeClientId(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`.slice(0, 64);
}

export default function SubmissionCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState<SubmissionRecipientDTO[]>([]);
  const [selected, setSelected] = useState<SubmissionRecipientDTO | null>(null);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<"recipient" | "title" | "conversation">("recipient");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const draftId = useMemo(() => makeClientId("submission"), []);

  useEffect(() => {
    const controller = new AbortController();
    api.getSubmissionRecipients(controller.signal)
      .then(setRecipients)
      .catch((error) => showToast(error instanceof ApiError ? error.message : t("submission.recipientsFailed"), "error"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [t]);

  const chooseRecipient = async (recipient: SubmissionRecipientDTO) => {
    if (recipient.relationship === "none" && recipient.role === "operator") {
      try {
        await api.createOperatorFriendRequest(recipient.user.user_id);
      } catch (error) {
        if (!(error instanceof ApiError) || !/already|exists|已/.test(error.message)) {
          showToast(error instanceof ApiError ? error.message : t("submission.friendFailed"), "error");
          return;
        }
      }
    }
    setSelected(recipient);
    setStage("title");
  };

  const sendFirstMessage = async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      const result = await api.startSubmission({
        peer_user_id: selected.user.user_id,
        title: title.trim(),
        client_draft_id: draftId,
        content: draft.trim(),
        client_message_id: makeClientId("message"),
      });
      navigate(`/app/submissions/${result.chat.chat_id}`, { replace: true });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("submission.startFailed"), "error");
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    if (stage === "conversation") setStage("title");
    else if (stage === "title") setStage("recipient");
    else navigate("/app/submissions");
  };

  return (
    <AppChrome hideMobileNav={stage === "conversation"} hidePageTitle title={t("submission.new")}>
      <main className={`submission-create-page is-${stage}`}>
        <header className="submission-create-header">
          <button aria-label={t("common.back")} onClick={goBack} type="button"><span className="material-symbols-outlined">arrow_back</span></button>
          <div><strong>{stage === "recipient" ? t("submission.chooseRecipient") : stage === "title" ? t("submission.titleStep") : title}</strong>{stage === "conversation" && selected ? <small>{t("submission.to", { name: selected.user.name })}</small> : null}</div>
          {loading ? <HeaderSyncIndicator syncing /> : <span />}
        </header>

        {stage === "recipient" ? <section className="submission-recipient-list">
          {recipients.map((recipient) => <button className="submission-recipient-row" key={recipient.user.user_id} onClick={() => void chooseRecipient(recipient)} type="button">
            <UserAvatar className="avatar" frame={recipient.user.avatar_frame_style} name={recipient.user.name} uri={recipient.user.avatar_uri} />
            <span><strong>{recipient.user.name}</strong><small>{recipient.role === "official" ? t("profile.official") : t("profile.operator")}</small></span>
            {recipient.role === "official" ? <OfficialBadge /> : <OperatorBadge />}
            <span className="material-symbols-outlined">chevron_right</span>
          </button>)}
          {!loading && !recipients.length ? <p className="submission-empty">{t("submission.noRecipients")}</p> : null}
        </section> : null}

        {stage === "title" ? <section className="submission-title-card">
          {selected ? <div className="submission-selected-recipient"><UserAvatar className="mini-avatar" name={selected.user.name} uri={selected.user.avatar_uri} /><span>{t("submission.to", { name: selected.user.name })}</span></div> : null}
          <label><span>{t("submission.titleLabel")}</span><input autoFocus maxLength={50} onChange={(event) => setTitle(event.target.value)} placeholder={t("submission.titlePlaceholder")} value={title} /></label>
          <button className="button submission-continue" disabled={!title.trim()} onClick={() => setStage("conversation")} type="button">{t("submission.begin")}<span className="material-symbols-outlined">arrow_forward</span></button>
        </section> : null}

        {stage === "conversation" ? <section className="submission-draft-conversation">
          <div className="submission-draft-empty"><span className="material-symbols-outlined">outbox</span><strong>{t("submission.ready")}</strong><p>{t("submission.createOnSend")}</p></div>
          <div className="submission-draft-composer"><textarea autoFocus onChange={(event) => setDraft(event.target.value)} placeholder={t("chat.inputPlaceholder")} rows={1} value={draft} /><button aria-label={t("common.send")} disabled={!draft.trim() || sending} onClick={() => void sendFirstMessage()} type="button"><span className="material-symbols-outlined">arrow_upward</span></button></div>
        </section> : null}
      </main>
    </AppChrome>
  );
}
