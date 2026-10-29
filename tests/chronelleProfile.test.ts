import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('profile calendar uses authenticated OAuth projection instead of the retired share ID',()=>{
  const profile=read('components/UserProfilePanel.tsx');
  assert.match(profile,/ownerId={userId} previewAudience={previewAudience}/);
  assert.match(profile,/<ChronelleCalendar key={`\$\{cacheScope\}:/);
  assert.ok(!profile.includes('calendarId={user.chronelle_calendar_id}'));
  assert.match(read('components/ChronelleCalendar.tsx'),/api.chronelleProfile\(ownerId/);
});
test('partial visibility never renders a complete availability bar or says no events',()=>{
  const source=read('components/ChronelleCalendar.tsx');
  assert.match(source,/displayState === "ready" && known/);
  assert.match(source,/known\?"chronelle.noEvents":"chronelle.limitedVisibility"/);
  assert.match(source,/if\(!ownerId\)cache.current.set/);
});
