import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('project details and task metadata provide date editing using the shared picker',()=>{
  const page=read('pages/ResearchPage.tsx');
  assert.match(page,/action:dates.taskId\?'task_dates':'settings'/);
  assert.match(page,/<DateRangeField value={dates}/);
  assert.match(page,/end:dates.to\|\|null/);
  assert.match(read('components/ResearchProjectDetails.tsx'),/onClick={owner\?onDates:undefined}/);
});
test('toolbar text actions have padded hover targets without gradient backgrounds',()=>{
  const css=read('styles/app/10-chat-city.css');
  assert.match(css,/sheet-toolbar-button:not\(.submission-invite-send-button\):hover:not\(:disabled\)/);
  assert.match(css,/sheet-toolbar-button:disabled\s*{\s*background: transparent/);
});
