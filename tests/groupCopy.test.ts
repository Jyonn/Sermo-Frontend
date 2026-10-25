import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copySuggestionHint,orderCopySuggestions,type CopySuggestion} from '../src/lib/groupCopy.ts';
const now=Date.now();
const row=(id:number,copied=false):CopySuggestion=>({message_id:id,content:`Text ${id}`,author:'Writer',created_at:now/1000,copied});
test('copied candidates move behind untouched candidates without disturbing rank',()=>{
  assert.deepEqual(orderCopySuggestions([row(1,true),row(2),row(3)],now).map(item=>item.message_id),[2,3,1]);
  assert.deepEqual(orderCopySuggestions([row(1,true),row(2,true),row(3)],now).map(item=>item.message_id),[3,1,2]);
});
test('expired messages disappear at 24 hours',()=>{
  assert.equal(orderCopySuggestions([{...row(1),created_at:(now-86400000)/1000}],now).length,0);
});
test('only unseen uncopied candidates trigger a once-per-day hint',()=>{
  assert.equal(copySuggestionHint([row(1)],null,'today'),true);
  assert.equal(copySuggestionHint([row(1,true)],null,'today'),false);
  assert.equal(copySuggestionHint([row(2)],{day:'today',ids:[1]},'today'),false);
  assert.equal(copySuggestionHint([row(1)],{day:'yesterday',ids:[1]},'today'),false);
  assert.equal(copySuggestionHint([row(2)],{day:'yesterday',ids:[1]},'today'),true);
});
test('reports happen only after clipboard success, never for link-only or own-message copies',()=>{
  const source=readFileSync(new URL('../src/pages/ChatsPage.tsx',import.meta.url),'utf8');
  assert.match(source,/!linkOnly && selectedChat\?\.type === "group" && messageMenu.message.from !== "self"/);
  assert.match(source,/if \(!copied\) throw[\s\S]{0,260}reportGroupCopies/);
  assert.match(source,/<GroupCopyShelf key=/);
  const panel=readFileSync(new URL('../src/components/GroupCopyShelf.tsx',import.meta.url),'utf8');
  assert.match(panel,/if\(!await copyText\(item.content\)\)throw[\s\S]{0,80}reportGroupCopies/);
  assert.match(panel,/CHAT_SYNC_EVENT/);
});
