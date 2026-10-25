import { useState } from "react";
import { safeOAuthIconUri } from "../lib/oauthApplicationPresentation";

export function OAuthApplicationMark({ name, uri }: { name: string; uri?: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const safe = safeOAuthIconUri(uri);
  return <span className="oauth-app-monogram" aria-hidden="true">{safe && uri !== failedUri ? <img src={uri} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUri(uri ?? null)} /> : name.slice(0, 1)}</span>;
}
