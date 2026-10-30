import type { SwitchAccountDTO } from "../types";

export function groupSwitchAccounts(accounts: SwitchAccountDTO[]) {
  const spaces = new Map<number, { space: SwitchAccountDTO["space"]; accounts: SwitchAccountDTO[] }>();
  for (const account of accounts) {
    const group = spaces.get(account.space.space_id);
    if (group) group.accounts.push(account);
    else spaces.set(account.space.space_id, { space: account.space, accounts: [account] });
  }
  return Array.from(spaces.values());
}
