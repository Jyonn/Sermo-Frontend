import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('shared Markdown editing opts phones in without replacing the textarea',()=>{
  const input=source('components/ResearchMarkdownInput.tsx');
  assert.match(input,/mobileImmersive = true/);
  assert.match(input,/onFocus=\{immersive.focus\}/);
  assert.match(input,/onPointerDown=\{immersive.start\}/);
  assert.match(input,/translate\('common.done'\)/);
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
  assert.match(css,/v3-md-mobile:not\(\.v3-md-immersive\)>\.v3-md-toolbar\{display:none/);
  assert.match(css,/height:var\(--md-viewport-height,100dvh\)/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion/);
});
