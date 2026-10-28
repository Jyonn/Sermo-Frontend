import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('research root does not paint its own background',()=>{
  assert.doesNotMatch(read('src/pages/ResearchPage.css'),/\.research-page\s*\{[^}]*background\s*:/);
});
test('empty feeds describe missing statements and share the mine icon',()=>{
  assert.match(read('src/pages/SquarePage.tsx'),/icon=\{hasFeedFilters \? "search_off" : "edit_note"\}/);
  const zh=JSON.parse(read('src/locales/zh-CN/translation.json'));
  assert.equal(zh['square.empty'],zh['square.mineEmpty']);
  for(const locale of ['zh-CN','zh-TW','en','es','ja','ko']){
    const copy=JSON.parse(read(`src/locales/${locale}/translation.json`));
    assert.ok(copy['square.empty']);assert.ok(copy['square.emptyHint']);
    assert.doesNotMatch(copy['square.empty']+' '+copy['square.emptyHint'],/在线|線上|online|en línea|온라인|オンライン|上线|上線/);
  }
});
