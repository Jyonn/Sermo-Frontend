import {activityOverlaySearch} from './activityOverlayRoute';

export const GAME_NAVIGATION_EVENT = 'frienden:game-navigation';

export function gameRoomReturnState({pathname, search, hash}: {pathname: string; search: string; hash: string}) {
  return {gameRoomReturn: pathname + activityOverlaySearch(search, null) + hash};
}

let activeGameGuard: ((event: PopStateEvent) => void) | undefined;

export function installGameHistoryGuard() {
  // Window dispatches popstate at the target. Register before BrowserRouter
  // so the game can pause a navigation before its room is unmounted.
  window.addEventListener('popstate', event => activeGameGuard?.(event));
}

export function guardGameHistory(guard: (event: PopStateEvent) => void) {
  activeGameGuard = guard;
  return () => {if (activeGameGuard === guard) activeGameGuard = undefined;};
}
