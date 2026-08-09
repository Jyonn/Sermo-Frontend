import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";

const officialLoginExchanges = new Map<string, ReturnType<typeof api.exchangeOfficialLoginTicket>>();

function readTicketFromHash() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return (params.get("ticket") || "").trim();
}

function exchangeOfficialLoginTicketOnce(ticket: string) {
  const existing = officialLoginExchanges.get(ticket);
  if (existing) return existing;
  const exchange = api.exchangeOfficialLoginTicket(ticket);
  officialLoginExchanges.set(ticket, exchange);
  return exchange;
}

export default function OfficialLoginPage() {
  const navigate = useNavigate();
  const { loginFromJoin } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "error">("loading");
  const ticket = useMemo(() => readTicketFromHash(), []);

  useEffect(() => {
    if (!ticket) {
      setState("error");
      setError(t("account.officialLinkExpired"));
      return;
    }

    let cancelled = false;
    setState("loading");
    setError(null);

    exchangeOfficialLoginTicketOnce(ticket)
      .then((payload) => {
        if (cancelled) return;
        loginFromJoin(payload);
        navigate("/app", { replace: true });
      })
      .catch((apiError) => {
        if (cancelled) return;
        setState("error");
        setError(apiError instanceof ApiError ? apiError.message : t("account.officialLoginFailed"));
      });

    return () => {
      cancelled = true;
    };
  }, [loginFromJoin, navigate, ticket]);

  return (
    <AppChrome hideMobileNav hidePageTitle title={t("account.officialLogin")}>
      <section className="auth-shell">
        <div className="auth-card is-space-state">
          {state === "loading" ? <FeedbackState title={t("account.officialLoggingIn")} description="" tone="loading" /> : null}
          {state === "error" ? <FeedbackState title={t("account.officialLoginFailed")} description={t("account.officialExpired")} tone="error" /> : null}
        </div>
      </section>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
