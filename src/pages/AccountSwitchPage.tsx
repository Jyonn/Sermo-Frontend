import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { JoinResponseDTO } from "../types";
import { useI18n } from "../lib/language";

const exchangeRequests = new Map<string, Promise<JoinResponseDTO>>();

function readTicketFromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (params.get("ticket") || "").trim();
}

function exchangeTicketOnce(ticket: string) {
  const existing = exchangeRequests.get(ticket);
  if (existing) return existing;
  const request = api.exchangeAccountSwitchTicket(ticket);
  exchangeRequests.set(ticket, request);
  return request;
}

export default function AccountSwitchPage() {
  const navigate = useNavigate();
  const { loginFromJoin } = useAuth();
  const { t } = useI18n();
  const ticket = useMemo(readTicketFromHash, []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticket) {
      setError(t("account.invalidSwitchLink"));
      return;
    }
    let cancelled = false;
    exchangeTicketOnce(ticket)
      .then((payload) => {
        if (cancelled) return;
        loginFromJoin(payload);
        navigate("/app", { replace: true });
      })
      .catch((apiError) => {
        if (cancelled) return;
        setError(apiError instanceof ApiError ? apiError.message : t("account.switchFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [loginFromJoin, navigate, ticket]);

  return (
    <AppChrome hideMobileNav hidePageTitle title={t("menu.switchAccount")}>
      <section className="auth-shell">
        <div className="auth-card is-space-state">
          <FeedbackState
            title={error ? t("account.switchFailed") : t("account.switching")}
            description={error || ""}
            tone={error ? "error" : "loading"}
          />
        </div>
      </section>
    </AppChrome>
  );
}
