import { useEffect, useMemo, useRef, useState } from "react";
import type { SwitchAccountDTO } from "../types";
import { groupSwitchAccounts } from "../lib/accountGroups";
import { useI18n } from "../lib/language";
import { BottomSheet } from "./BottomSheet";
import { PlainAvatar, SpaceAvatar } from "./UserAvatar";
import { ContentLoader, QuietState } from "./BoundaryState";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";
import { OverlayIconButton } from "./OverlayIconButton";

export function AccountSwitchSheet({ accounts, loading, switchingUserId, onClose, onSelect }: {
  accounts: SwitchAccountDTO[];
  loading: boolean;
  switchingUserId: number | null;
  onClose: () => void;
  onSelect: (account: SwitchAccountDTO) => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupSwitchAccounts(accounts), [accounts]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const previousSpaceId = useRef<number | null>(null);
  const focusRow = useRef<HTMLButtonElement>(null);
  const selected = groups.find(({ space }) => space.space_id === spaceId);
  const busy = switchingUserId !== null;

  useEffect(() => {
    if (previousSpaceId.current !== null) focusRow.current?.focus();
  }, [spaceId]);

  return (
    <BottomSheet
      className="account-switch-sheet"
      onClose={() => { if (!busy) onClose(); }}
      open
      title={selected ? t("account.chooseInSpace", { space: selected.space.name }) : t("menu.switchAccount")}
      titleLeading={selected ? <OverlayIconButton aria-label={t("pwa.chooseSpace")} disabled={busy} icon="arrow_back" onClick={() => setSpaceId(null)} /> : undefined}
    >
      {loading ? <ContentLoader label={t("account.finding")} rows={3} /> : !groups.length ? (
        <QuietState icon="switch_account" title={t("account.noSwitchable")} description={t("account.privateHidden")} />
      ) : (
        <>
          <div aria-busy={busy} className="account-switch-list" key={selected ? "accounts" : "spaces"}>
            {selected ? selected.accounts.map((account, index) => (
              <button className="simple-row person-row" disabled={busy} key={account.user.user_id} onClick={() => onSelect(account)} ref={index === 0 ? focusRow : undefined} type="button">
                <div aria-hidden="true"><PlainAvatar className="mini-avatar" name={account.user.name} uri={account.user.avatar_uri} /></div>
                <span className="row-main">
                  <strong>{account.user.name}</strong>
                  {account.user.official ? <span className="row-subtle">{t("account.adminAccount")}</span> : null}
                </span>
                {switchingUserId === account.user.user_id ? <HeaderSyncIndicator syncing /> : <span aria-hidden="true" className="material-symbols-outlined">arrow_forward</span>}
              </button>
            )) : groups.map(({ space, accounts: members }) => (
              <button className="simple-row person-row" disabled={busy} key={space.space_id} onClick={() => {
                if (members.length === 1) onSelect(members[0]);
                else {
                  previousSpaceId.current = space.space_id;
                  setSpaceId(space.space_id);
                }
              }} ref={space.space_id === previousSpaceId.current ? focusRow : undefined} type="button">
                <div aria-hidden="true"><SpaceAvatar className="mini-avatar" name={space.name} uri={space.official_user?.avatar_uri} /></div>
                <span className="row-main"><strong>{space.name}</strong><span className="row-subtle">@{space.slug}</span></span>
                {members.some(({ user }) => user.user_id === switchingUserId) ? <HeaderSyncIndicator syncing /> : <span aria-hidden="true" className="material-symbols-outlined">{members.length === 1 ? "arrow_forward" : "chevron_right"}</span>}
              </button>
            ))}
          </div>
          {busy ? <div className="row-subtle" role="status">{t("account.switching")}</div> : null}
        </>
      )}
    </BottomSheet>
  );
}
