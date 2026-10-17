import { useState } from "react";
import { useI18n } from "../lib/language";
import { oauthIconUrl } from "../lib/oauthConsent";
import type { OAuthClientMetadata } from "../lib/oauthClients";

function BrandIcon({ src, name }: { src: string | null; name: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return <span className="oauth-brand-icon">
    {src && !failed ? <img alt={name} src={src} referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span role="img" aria-label={t("apps.iconUnavailable", { app: name })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg></span>}
  </span>;
}

export function OAuthConsentBrand({ client }: { client: OAuthClientMetadata | null }) {
  return <div className="oauth-brand-pair" aria-label={client ? `Frienden · ${client.name}` : "Frienden"}>
    <BrandIcon src="/icons/frienden-512.png?v=2" name="Frienden" />
    {client ? <><svg className="oauth-brand-connector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-5-5 5 5-5 5" /></svg><BrandIcon key={`${client.id}:${client.icon_url}`} src={oauthIconUrl(client.icon_url)} name={client.name} /></> : null}
  </div>;
}
