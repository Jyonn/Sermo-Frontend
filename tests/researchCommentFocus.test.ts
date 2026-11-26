import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
test('the progress editor retains distinct drafts for each reply',()=>{
 const source=read('components/ResearchComments.tsx');
 assert.match(source,/historyKey="research-write-update"/);
 assert.match(source,/draftKey=.*editor.replyTo/);
 assert.match(source,/className="research-note-context"/);
 assert.match(source,/cancelAnimationFrame\(first\)/);
 assert.match(read('lib/researchDraft.ts'),/sessionStorage.getItem\(storageKey\)/);
 assert.match(read('lib/researchDraft.ts'),/sessionStorage.setItem\(storageKey, next\)/);
 assert.doesNotMatch(source,/className="square-reply-target"/);
});
test('desktop preview retains focus in the editor, while mobile keeps its keyboard behavior',()=>{
 assert.match(read('components/ResearchMarkdownInput.tsx'),/if\(!immersive.mobile\)event.currentTarget.focus\(\{preventScroll:true\}\)/);
  assert.match(read('lib/useMobileMarkdownEditor.ts'),/if \(!mobile && active\) close\(\)/);
});
