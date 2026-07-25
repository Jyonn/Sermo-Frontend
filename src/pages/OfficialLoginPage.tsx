import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";

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
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "error">("loading");
  const ticket = useMemo(() => readTicketFromHash(), []);

  useEffect(() => {
    if (!ticket) {
      setState("error");
      setError("这个官方账号登录链接已经失效，请回到空间后台重新获取。");
      return;
    }

    let cancelled = false;
    setState("loading");
    setError(null);

    exchangeOfficialLoginTicketOnce(ticket)
      .then((payload) => {
        if (cancelled) return;
        loginFromJoin(payload);
        navigate("/app/chats", { replace: true });
      })
      .catch((apiError) => {
        if (cancelled) return;
        setState("error");
        setError(apiError instanceof ApiError ? apiError.message : "官方账号登录失败");
      });

    return () => {
      cancelled = true;
    };
  }, [loginFromJoin, navigate, ticket]);

  return (
    <AppChrome hideMobileNav hidePageTitle title="官方账号登录">
      <section className="auth-shell">
        <div className="auth-card is-space-state">
          {state === "loading" ? <FeedbackState title="正在登录官方账号" description="" tone="loading" /> : null}
          {state === "error" ? <FeedbackState title="官方账号登录失败" description="这个桥接链接可能已经过期。请回到空间后台重新发起登录。" tone="error" /> : null}
        </div>
      </section>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
