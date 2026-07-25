import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { JoinResponseDTO } from "../types";

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
  const ticket = useMemo(readTicketFromHash, []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticket) {
      setError("切换链接无效，请返回原账号重试。");
      return;
    }
    let cancelled = false;
    exchangeTicketOnce(ticket)
      .then((payload) => {
        if (cancelled) return;
        loginFromJoin(payload);
        navigate("/app/chats", { replace: true });
      })
      .catch((apiError) => {
        if (cancelled) return;
        setError(apiError instanceof ApiError ? apiError.message : "账号切换失败");
      });
    return () => {
      cancelled = true;
    };
  }, [loginFromJoin, navigate, ticket]);

  return (
    <AppChrome hideMobileNav hidePageTitle title="切换账号">
      <section className="auth-shell">
        <div className="auth-card is-space-state">
          <FeedbackState
            title={error ? "无法切换账号" : "正在切换账号"}
            description={error || ""}
            tone={error ? "error" : "loading"}
          />
        </div>
      </section>
    </AppChrome>
  );
}
