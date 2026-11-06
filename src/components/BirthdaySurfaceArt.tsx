/** A decorative layer: never participates in layout or receives input. */
export function BirthdaySurfaceArt({kind}:{kind:'dialog'|'sheet'|'drawer'}){
  return <div className={`birthday-surface-art is-${kind}`} aria-hidden="true">
    <span className="birthday-surface-painting"/>
    <svg className="birthday-surface-thread" viewBox="0 0 400 120" preserveAspectRatio="none" fill="none"><path d="M-12 86C70 120 48 22 118 55S220 118 270 75S340 55 412 28"/><path d="M-12 90C70 124 48 26 118 59S220 122 270 79S340 59 412 32"/></svg>
    <svg className="birthday-surface-knot" viewBox="0 0 64 48" fill="none"><path d="M30 21C11-3-8 8 12 23C17 27 26 23 31 22M33 21C51-3 72 8 51 23C46 27 38 23 33 22M31 24C29 34 19 31 19 43L27 39L30 45L33 25M34 24C36 34 46 30 47 42L39 38L36 45"/><path d="M29 18Q32 16 36 19L35 25Q32 27 29 24Z"/></svg>
    <svg className="birthday-surface-candles" viewBox="0 0 48 64" fill="none"><path d="M9 27h7v31H9zM23 18h7v40h-7zM37 31h6v27h-6z" fill="#eee3c3" stroke="#ac9570"/><path d="m9 35 7-5m-7 15 7-5m-7 15 7-5m7-22 7-5m-7 15 7-5m-7 15 7-5m-7 15 7-5m7-4 6-4m-6 14 6-4" stroke="#bc8c84" strokeWidth="2"/><path d="M12 24c-6-3-2-10 1-14 0 5 5 10-1 14ZM26 15c-6-3-2-10 1-14 0 5 5 10-1 14ZM40 28c-5-3-2-9 1-13 0 5 4 10-1 13Z" fill="#d3ae65"/><path d="M6 60h40" stroke="#9b9f7c" strokeLinecap="round"/></svg>
  </div>;
}
