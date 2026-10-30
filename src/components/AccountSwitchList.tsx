import { useMemo, useState } from "react";
import type { SwitchAccountDTO } from "../types";
import { groupSwitchAccounts } from "../lib/accountGroups";
import { useI18n } from "../lib/language";
import { SpaceAvatar, UserAvatar } from "./UserAvatar";
import { ContentLoader, QuietState } from "./BoundaryState";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";

export function AccountSwitchList({ accounts, loading, switchingUserId, onSelect }: {
  accounts: SwitchAccountDTO[]; loading: boolean; switchingUserId: number | null; onSelect: (account: SwitchAccountDTO) => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupSwitchAccounts(accounts), [accounts]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const selected = groups.find(({ space }) => space.space_id === spaceId);
  const busy = switchingUserId !== null;
  if (loading) return <ContentLoader label={t("account.finding")} rows={3} />;
  if (!groups.length) return <QuietState icon="switch_account" title={t("account.noSwitchable")} description={t("account.privateHidden")} />;
  return <div className="simple-list account-switch-list" aria-busy={busy}>
    {selected ? <button className="simple-row" disabled={busy} onClick={() => setSpaceId(null)} type="button"><span className="material-symbols-outlined">arrow_back</span><strong>{t("pwa.chooseSpace")}</strong></button> : null}
    {selected ? selected.accounts.map((account) => <button className="simple-row person-row" disabled={busy} key={account.user.user_id} onClick={() => onSelect(account)} type="button">
      <UserAvatar className="mini-avatar" name={account.user.name} uri={account.user.avatar_uri} />
      <div className="row-main"><strong>{account.user.name}</strong><div className="row-subtle">{account.space.name}{account.user.official ? t("account.adminSuffix") : ""}</div></div>
      {switchingUserId === account.user.user_id ? <HeaderSyncIndicator syncing /> : <span className="material-symbols-outlined">chevron_right</span>}
    </button>) : groups.map(({ space, accounts: members }) => <button className="simple-row person-row" disabled={busy} key={space.space_id} onClick={() => members.length === 1 ? onSelect(members[0]) : setSpaceId(space.space_id)} type="button">
      <SpaceAvatar className="mini-avatar" name={space.name} uri={space.official_user?.avatar_uri} />
      <div className="row-main"><strong>{space.name}</strong><div className="row-subtle">@{space.slug}</div></div>
      {members.some(({ user }) => user.user_id === switchingUserId) ? <HeaderSyncIndicator syncing /> : <span className="material-symbols-outlined">{members.length === 1 ? "arrow_forward" : "chevron_right"}</span>}
    </button>)}
    {busy ? <div role="status" className="row-subtle">{t("account.switching")}</div> : null}
  </div>;
}
