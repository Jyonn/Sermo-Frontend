import type { ReactNode } from "react";

export function BgmIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    music_note: <><path d="M9 18V5l11-2v13M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    play_arrow: <path d="m8 4 12 8-12 8Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    arrow_forward: <path d="M4 12h16m-7-7 7 7-7 7" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    add: <path d="M12 4v16M4 12h16" />,
    check_circle: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
    radio_button_unchecked: <circle cx="12" cy="12" r="9" />,
    edit_square: <><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M16 3l5 5-10 10-5 1 1-5Z" /></>,
    chat_bubble: <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />,
    favorite: <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 7 17 12 21c5-4 13-11 8-16Z" />,
    auto_awesome: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /></>,
  };
  return <svg aria-hidden="true" className="bgm-icon" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">{paths[name] ?? paths.music_note}</svg>;
}
