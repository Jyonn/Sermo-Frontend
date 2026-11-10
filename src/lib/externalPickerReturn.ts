import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type PickerProvider = "pocklo" | "stillfolio";
const storageKey = (provider: PickerProvider) => `frienden:${provider}-return`;

export function rememberExternalPickerReturn(provider: PickerProvider, scope: string, path: string) {
  sessionStorage.setItem(storageKey(provider), scope + ":" + path);
}

export function useExternalPickerReturn(provider: PickerProvider, scope: string, onReturn: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState("");
  const open = useRef(onReturn);
  open.current = onReturn;
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const result = query.get(provider);
    if (!result) return;
    query.delete(provider);
    navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
    const key = storageKey(provider);
    if (scope && sessionStorage.getItem(key) === scope + ":" + window.location.pathname) {
      sessionStorage.removeItem(key);
      setOutcome(result === "connected" ? "" : result);
      open.current();
    }
  }, [provider, location.pathname, location.search, navigate, scope]);
  return outcome;
}
