import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
test('desktop progress collapses outside the editor without clearing the draft or reply',()=>{
 const source=read('components/ResearchComments.tsx');
 assert.match(source,/if\(!editing\|\|mobile\)return/);
 assert.match(source,/const collapse=\(\)=>\{if\(!busy\)setEditing\(false\);\}/);
 assert.match(source,/addEventListener\('pointerdown',pointer\)/);
 assert.match(source,/addEventListener\('focusout',blur\)/);
 assert.match(source,/v3-heading-menu,.v3-table-picker/);
 assert.match(source,/cancelAnimationFrame\(frame\)/);
 assert.match(source,/rows=\{3\}/);
 assert.match(source,/research-reply-context/);
 assert.doesNotMatch(source,/className="square-reply-target"/);
});
test('desktop preview retains focus in the editor, while mobile keeps its keyboard behavior',()=>{
 assert.match(read('components/ResearchMarkdownInput.tsx'),/if\(!immersive.mobile\)event.currentTarget.focus\(\{preventScroll:true\}\)/);
  assert.match(read('lib/useMobileMarkdownEditor.ts'),/if \(!mobile && active\) close\(\)/);
});
