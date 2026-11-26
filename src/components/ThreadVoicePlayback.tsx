import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createThreadVoicePlayback } from "../lib/threadVoicePlayback";

type Player = ReturnType<typeof createThreadVoicePlayback>;
export const ThreadVoicePlaybackContext = createContext<Player | null>(null);

export function useThreadVoicePlayback(scope?: string, draftAudio?: RefObject<HTMLAudioElement>) {
  const player = useMemo(() => createThreadVoicePlayback({
    beforePlay: () => draftAudio?.current?.pause(),
  }), [scope, draftAudio]);
  useLayoutEffect(() => () => player.stop(), [player]);
  return player;
}

export function ThreadVoicePlaybackBoundary({ children }: { children: ReactNode }) {
  const inherited = useContext(ThreadVoicePlaybackContext);
  const player = useThreadVoicePlayback();
  return <ThreadVoicePlaybackContext.Provider value={inherited ?? player}>{children}</ThreadVoicePlaybackContext.Provider>;
}

export function useVoiceMessagePlayback(key: string) {
  const player = useContext(ThreadVoicePlaybackContext);
  const subscribe = useCallback((listener: () => void) => player?.subscribe(key, listener) ?? (() => undefined), [key, player]);
  const read = useCallback(() => player?.getSnapshot(key), [key, player]);
  return { player, playback: useSyncExternalStore(subscribe, read, read) };
}
