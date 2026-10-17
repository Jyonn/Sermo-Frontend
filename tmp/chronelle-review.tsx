import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from '../src/lib/auth';
import {LanguageProvider} from '../src/lib/language';
import {activateLanguage} from '../src/lib/i18n';
import {ChronelleCalendar} from '../src/components/ChronelleCalendar';
import '../styles.css';

// Keep Vite's local module fetches working during hot updates. Never forward
// application API requests, credentials, calendar writes or invitations.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.origin === location.origin && /^\/(?:@vite\/|@id\/|@fs\/|@react-refresh|src\/|node_modules\/|tmp\/)/.test(url.pathname)) return originalFetch(input, init);
  if (url.origin !== 'https://chronelle.jyonn.space' || url.pathname !== '/api/events/') throw new Error('External request blocked in local preview');
  if ((init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() !== 'GET') throw new Error('Calendar writes blocked in local preview');
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const stamp = (offset: number, hour: number, minute = 0) => { const value = new Date(day); value.setDate(value.getDate() + offset); value.setHours(hour, minute); return value.toISOString(); };
  return new Response(JSON.stringify([
    {id: 'busy', start: stamp(0, 9), end: stamp(0, 10, 30), locked: true, title: 'Must not appear', location: 'Must not appear'},
    {id: 'overlap', start: stamp(0, 10), end: stamp(0, 11), locked: true},
    {id: 'overnight', start: stamp(0, 23), end: stamp(1, 1, 30), locked: true},
    {id: 'all-day', start: stamp(1, 0), end: stamp(2, 0), all_day: true, locked: true},
  ]), {status: 200});
};
localStorage.setItem('sermo:guest-language-preference', 'zh-CN');
await activateLanguage('zh-CN');
const root = createRoot(document.getElementById('root')!);
root.render(<AuthProvider><LanguageProvider><main style={{maxWidth: 430, margin: 'auto', padding: 16}}><ChronelleCalendar calendarId="00000000-0000-4000-8000-000000000001" /></main></LanguageProvider></AuthProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); window.fetch = originalFetch; });
