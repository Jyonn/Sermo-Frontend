import { forgetStableResourceUri, resolveStableResourceUri } from "./stableResource.ts";

export interface ThreadVoiceTrack {
  key: string;
  uri: string;
}

interface PlaybackState {
  status: "idle" | "loading" | "playing" | "paused";
  time: number;
  duration: number;
}

interface PlaybackSession {
  track: ThreadVoiceTrack;
  audio: HTMLAudioElement;
  events: AbortController;
  source: string;
  attempt: number;
  resumeAt: number;
  state: PlaybackState;
}

const idle: PlaybackState = { status: "idle", time: 0, duration: 0 };

export function createThreadVoicePlayback({
  makeAudio = () => new Audio(),
  beforePlay,
}: { makeAudio?: () => HTMLAudioElement; beforePlay?: () => void } = {}) {
  let active: PlaybackSession | null = null;
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string) => listeners.get(key)?.forEach(listener => listener());

  const sync = (session: PlaybackSession, status = session.state.status) => {
    if (active !== session) return;
    const { currentTime, duration } = session.audio;
    const time = Number.isFinite(currentTime) ? currentTime : 0;
    const length = Number.isFinite(duration) ? duration : session.state.duration;
    if (status === session.state.status && time === session.state.time && length === session.state.duration) return;
    session.state = { status, time, duration: length };
    notify(session.track.key);
  };

  const stop = () => {
    if (!active) return;
    const session = active;
    active = null;
    session.events.abort();
    session.audio.pause();
    session.audio.removeAttribute("src");
    session.audio.load();
    notify(session.track.key);
  };

  const fail = (session: PlaybackSession) => {
    if (active !== session || session.state.status === "paused") return;
    if (session.source === session.track.uri) {
      stop();
      return;
    }
    // The cache can hold a stale signature. Try the URI carried by this message once.
    forgetStableResourceUri(session.track.uri);
    session.resumeAt = session.state.time;
    session.source = session.track.uri;
    session.audio.src = session.source;
    play(session);
  };

  function play(session: PlaybackSession) {
    const attempt = ++session.attempt;
    sync(session, "loading");
    void session.audio.play().catch(error => {
      if (active !== session || session.attempt !== attempt) return;
      if (error?.name === "NotSupportedError" || session.audio.error) fail(session);
      else sync(session, "paused");
    });
  }

  return {
    stop,
    getSnapshot: (key: string) => active?.track.key === key ? active.state : idle,
    subscribe(key: string, listener: () => void) {
      const subscribers = listeners.get(key) ?? new Set();
      subscribers.add(listener);
      listeners.set(key, subscribers);
      return () => {
        subscribers.delete(listener);
        if (!subscribers.size) listeners.delete(key);
      };
    },
    toggle(track: ThreadVoiceTrack) {
      if (active?.track.key === track.key) {
        const session = active;
        if (session.state.status === "paused") {
          beforePlay?.();
          play(session);
        } else {
          session.attempt += 1;
          session.audio.pause();
          sync(session, "paused");
        }
        return;
      }

      stop();
      beforePlay?.();
      const audio = makeAudio();
      const source = resolveStableResourceUri(track.uri) ?? track.uri;
      const session: PlaybackSession = {
        track, audio, source, events: new AbortController(), attempt: 0, resumeAt: 0, state: idle,
      };
      const options = { signal: session.events.signal };
      active = session;
      audio.addEventListener("loadedmetadata", () => {
        if (session.resumeAt > 0) {
          audio.currentTime = Math.min(session.resumeAt, audio.duration || session.resumeAt);
          session.resumeAt = 0;
        }
        sync(session);
      }, options);
      audio.addEventListener("timeupdate", () => sync(session), options);
      audio.addEventListener("durationchange", () => sync(session), options);
      audio.addEventListener("playing", () => { if (!audio.paused) sync(session, "playing"); }, options);
      audio.addEventListener("waiting", () => { if (!audio.paused) sync(session, "loading"); }, options);
      audio.addEventListener("pause", () => { if (audio.paused && !audio.ended) sync(session, "paused"); }, options);
      audio.addEventListener("error", () => fail(session), options);
      audio.addEventListener("ended", stop, options);
      audio.src = source;
      play(session);
    },
  };
}
