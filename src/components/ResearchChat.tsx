import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { showToast } from "../lib/toast";
import { BottomSheet } from "./BottomSheet";
import { FeedbackState } from "./FeedbackState";
import type { SubmissionInviteDTO } from "../types";
import { getActiveLocale, i18n, useI18n, type TranslationKey } from "../lib/language";
import { SettingGroup, SettingRow } from "./SettingRow";
import "./ResearchInvitationCard.css";

export function researchInvitationDestination(invitation: SubmissionInviteDTO) {
  return invitation.project ? `/app/research?project=${invitation.project.id}&onboarding=1` : null;
}

export function researchInvitationPreview(invitation?: SubmissionInviteDTO | null) {
  return invitation?.project ? i18n.t("research.invitation") : null;
}

export function ResearchInvitationCard({ invitation, groupClassName }: { invitation: SubmissionInviteDTO; groupClassName: string }) {
  if (!invitation.project) return null;
  return (
    <button
      className={`message-submission-invite-card message-research-invite-card is-${invitation.status} ${groupClassName}`}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("sermo:submission-invite", { detail: invitation }));
      }}
    >
      <span className="message-submission-invite-heading">
        <span className="message-submission-invite-mark material-symbols-outlined" aria-hidden="true">science</span>
        <span><small>{i18n.t("research.invitation")}</small><strong>{invitation.project.title}</strong></span>
      </span>
      <span className="message-research-invite-by">{i18n.t("submission.invitedBy", { name: invitation.inviter.name })}</span>
      <span className="message-submission-invite-footer">
        <span>{i18n.t(`submission.inviteStatus.${invitation.status}`)}</span>
        <span>{i18n.t("submission.viewInvite")}</span>
        <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </span>
    </button>
  );
}

export function ResearchChatProjectLink({ chatId, navigate, onProjectDetails, settings = false }: {
  chatId: number;
  navigate: (path: string) => void;
  onProjectDetails?: () => void;
  settings?: boolean;
}) {
  const { t } = useI18n();
  const open = () => {
    if (onProjectDetails) onProjectDetails();
    else navigate(`/app/research?chat=${chatId}&details=1`);
  };
  if (!settings) return <button className="ghost-button" onClick={open} type="button">{t("research.members")}</button>;
  return (
    <section className="chat-detail-settings-section research-chat-project-section">
      <SettingGroup>
        <SettingRow title={t("research.members")} description={t("research.projectSettingsHint")} icon={<span className="material-symbols-outlined" aria-hidden="true">science</span>} onClick={open} />
      </SettingGroup>
    </section>
  );
}

// Research and submission invitations share the same lifecycle and Sheet.
export function ChatInvitationSheet({ currentUserId }: { currentUserId: number }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [submissionInviteBusyId, setSubmissionInviteBusyId] = useState<number | null>(null);
  const [submissionInviteSheetOpen, setSubmissionInviteSheetOpen] = useState(false);
  const [submissionInviteDetail, setSubmissionInviteDetail] = useState<SubmissionInviteDTO | null>(null);
  const [submissionInviteDetailLoading, setSubmissionInviteDetailLoading] = useState(false);

  useEffect(() => {
    const openSubmissionInvite = (event: Event) => {
      const invite = (event as CustomEvent<SubmissionInviteDTO>).detail;
      if (!invite?.invite_id) return;
      setSubmissionInviteDetail(invite);
      setSubmissionInviteSheetOpen(true);
      setSubmissionInviteDetailLoading(true);
      api.getSubmissionInvite(invite.invite_id)
        .then(setSubmissionInviteDetail)
        .catch((error) => showToast(error instanceof ApiError ? error.message : t("submission.inviteLoadFailed"), "error"))
        .finally(() => setSubmissionInviteDetailLoading(false));
    };
    window.addEventListener("sermo:submission-invite", openSubmissionInvite);
    return () => window.removeEventListener("sermo:submission-invite", openSubmissionInvite);
  }, [t]);

  const acceptSubmissionInvite = async () => {
    const invite = submissionInviteDetail;
    if (!invite?.can_accept || submissionInviteBusyId !== null) return;
    setSubmissionInviteBusyId(invite.invite_id);
    try {
      const result = await api.acceptSubmissionInvite(invite.invite_id);
      setSubmissionInviteDetail(result.invitation);
      setSubmissionInviteSheetOpen(false);
      const researchDestination = researchInvitationDestination(result.invitation);
      if (researchDestination) {
        navigate(researchDestination);
        return;
      }
      const canOpenImmediately = result.invitation.role === "author" || result.invitation.submission.status !== "draft";
      navigate(canOpenImmediately
        ? `/app/submissions/${result.invitation.chat_id}?view=${result.invitation.role}`
        : `/app/submissions?view=${result.invitation.role}`);
      showToast(t("submission.inviteApproved"), "success");
    } catch (error) {
      try {
        setSubmissionInviteDetail(await api.getSubmissionInvite(invite.invite_id));
      } catch {
        // Keep the card context visible while showing the original acceptance error.
      }
      showToast(error instanceof ApiError ? error.message : t("submission.inviteReviewFailed"), "error");
    } finally {
      setSubmissionInviteBusyId(null);
    }
  };

  return (
      <BottomSheet
        bodyClassName="submission-invite-sheet-body"
        className="submission-invite-sheet"
        onClose={() => {
          if (submissionInviteBusyId === null) setSubmissionInviteSheetOpen(false);
        }}
        open={submissionInviteSheetOpen}
        title={t(submissionInviteDetail?.project ? 'research.invitation' : "submission.inviteSheetTitle")}
      >
        {submissionInviteDetail ? (
          <div className={`submission-invite-sheet-content is-${submissionInviteDetail.status}`}>
            <div className="submission-invite-sheet-title">
              <span className="material-symbols-outlined" aria-hidden="true">outbox</span>
              <div>
                <small>{t("submission.invitedBy", { name: submissionInviteDetail.inviter.name })}</small>
                <strong>{submissionInviteDetail.submission.title || t("submission.unnamed")}</strong>
              </div>
              <span>{t(submissionInviteDetail.project ? 'research.team' : submissionInviteDetail.role === "reviewer" ? "submission.role.reviewer" : "submission.role.author")}</span>
            </div>
            <dl className="submission-invite-sheet-meta">
              {submissionInviteDetail.project ? <div><dt>{t('research.owner')}</dt><dd>{submissionInviteDetail.inviter.name}</dd></div> : <><div><dt>{t("submission.authorsShort")}</dt><dd>{submissionInviteDetail.submission.authors.map((user) => user.name).join(t("common.nameSeparator"))}</dd></div>
              <div><dt>{t("submission.reviewersShort")}</dt><dd>{submissionInviteDetail.submission.reviewers.map((user) => user.name).join(t("common.nameSeparator"))}</dd></div>
              <div><dt>{t("submission.invitedRole")}</dt><dd>{t(submissionInviteDetail.role === "reviewer" ? "submission.role.reviewer" : "submission.role.author")}</dd></div></>}
              <div><dt>{t("submission.validity")}</dt><dd>{t("submission.validUntil", { date: new Intl.DateTimeFormat(getActiveLocale(), { year: "numeric", month: "numeric", day: "numeric" }).format(submissionInviteDetail.expires_at * 1000) })}</dd></div>
            </dl>
            <div className={`submission-invite-sheet-status is-${submissionInviteDetail.status}`}>
              <span className="material-symbols-outlined" aria-hidden="true">{submissionInviteDetail.status === "accepted" ? "check_circle" : submissionInviteDetail.status === "expired" ? "schedule" : submissionInviteDetail.status === "conflict" ? "info" : "history"}</span>
              <span><strong>{t(`submission.inviteStatus.${submissionInviteDetail.status}` as TranslationKey)}</strong><small>{submissionInviteDetail.project&&['pending','accepted'].includes(submissionInviteDetail.status)?t(submissionInviteDetail.status==='accepted'?'research.joinedHint':'research.invitationHint'):t(submissionInviteDetail.status === "pending" && submissionInviteDetail.invitee.user_id !== currentUserId ? "submission.inviteStatusHint.sent" : `submission.inviteStatusHint.${submissionInviteDetail.status}` as TranslationKey)}</small></span>
            </div>
            {submissionInviteDetail.can_accept ? (
              <button className="button submission-invite-confirm" disabled={submissionInviteBusyId !== null} onClick={() => void acceptSubmissionInvite()} type="button">
                {submissionInviteBusyId !== null ? t("common.processing") : t(submissionInviteDetail.project?'research.acceptInvitation':"submission.confirmJoin")}
              </button>
            ) : null}
          </div>
        ) : submissionInviteDetailLoading ? <FeedbackState tone="loading" title={t("common.loading")} description={t("submission.inviteLoadingHint")} /> : <FeedbackState tone="error" icon="link_off" title={t("submission.inviteUnavailable")} description={t("submission.inviteUnavailableHint")} />}
      </BottomSheet>
  );
}
