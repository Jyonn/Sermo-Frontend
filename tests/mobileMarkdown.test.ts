import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('shared Markdown editing opts phones in without replacing the textarea',()=>{
  const input=source('components/ResearchMarkdownInput.tsx');
  assert.match(input,/mobileImmersive = true/);
  assert.match(input,/onFocus=\{focus\}/);
  assert.match(input,/onPointerDown=\{start\}/);
  assert.match(input,/translate\('common.done'\)/);
  assert.match(input,/if\(immersive.mobile&&!immersive.active\)setPreview\(false\)/);
  assert.equal((input.match(/<textarea /g)||[]).length,1);
  assert.doesNotMatch(input,/createPortal/);
  for(const file of ['components/ResearchComments.tsx','components/ResearchCalendar.tsx','components/MarkdownEditorDialog.tsx','pages/ResearchPage.tsx'])assert.match(source(file),/<MarkdownInput/);
});

test('immersive editing follows the visual viewport and preserves nested focus layers',()=>{
  const hook=source('lib/useMobileMarkdownEditor.ts');
  assert.match(hook,/max-width: 719px/);
  assert.match(hook,/pointer: coarse.*max-height: 500px/);
  assert.match(hook,/autoFocus: false, restoreFocus: false/);
  assert.match(hook,/node.showPopover\(\)/);
  assert.match(hook,/parent.insertBefore/);
  for(const event of ['resize','scroll']){
    assert.ok(hook.includes(`viewport?.addEventListener('${event}', sync)`));
    assert.ok(hook.includes(`viewport?.removeEventListener('${event}', sync)`));
  }
  assert.match(hook,/viewport\?\.height/);
  assert.match(hook,/viewport\?\.offsetTop/);
  for(const file of ['components/MarkdownHeadingMenu.tsx','components/ResearchTablePicker.tsx']){
    const popup=source(file);
    assert.match(popup,/autoFocus:!keepInputFocus,restoreFocus:!keepInputFocus/);
    assert.match(popup,/window.visualViewport/);
  }
});

test('mobile tools stay hidden until editing and respect keyboard space and safe areas',()=>{
  const css=source('components/MobileMarkdownEditor.css');
  assert.match(css,/v3-md-mobile:not\(\.v3-md-immersive\)>\.v3-md-toolbar,.*\{display:none/);
  assert.match(css,/height:var\(--md-viewport-height,100dvh\)/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion/);
});

test('preview is pinned outside the scrolling toolbar and phone actions occupy their own row',()=>{
  const input=source('components/ResearchMarkdownInput.tsx');
  assert.match(input,/v3-md-mobile-actions/);
  assert.match(input,/onClick=\{cancel\}/);
  assert.match(input,/onClick=\{finish\}/);
  assert.ok(input.indexOf(':previewButton}')<input.indexOf('role="toolbar"'));
  assert.match(source('components/MobileMarkdownEditor.css'),/v3-md-input>\.v3-md-preview-toggle\{position:absolute;top:0;right:0/);
});

test('phone descriptions open directly and task progress starts as a compact comment trigger',()=>{
  const dialog=source('components/MarkdownEditorDialog.tsx');
  assert.match(dialog,/if\(mobile\)return createPortal\(<MarkdownInput/);
  assert.match(dialog,/mobileSession=\{\{onDone/);
  const comments=source('components/ResearchComments.tsx');
  assert.match(comments,/editing&&!mobile\?/);
  assert.match(comments,/research-progress-trigger/);
  assert.match(comments,/editing&&mobile&&<MarkdownEditorDialog/);
  assert.doesNotMatch(source('components/ResearchWorkspace.tsx'),/editDescription|HeaderIconButton/);
  assert.match(source('components/ResearchProjectDetails.tsx'),/onClick=\{owner\?onDescription/);
  assert.doesNotMatch(source('styles/app/40-square-platform.css'),/\.square-comment-thread header span\{/);
});
