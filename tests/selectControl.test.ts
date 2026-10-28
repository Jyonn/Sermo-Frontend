import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const source=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');

test('selection uses a portal dialog with a focus trap and current option',()=>{
  const text=source('components/SettingRow.tsx');
  assert.match(text,/createPortal/);assert.match(text,/role="dialog" aria-modal="true"/);
  assert.match(text,/useModalFocus\(root, open, close\)/);assert.match(text,/useBodyScrollLock\(open\)/);
  assert.match(text,/aria-haspopup="dialog"/);assert.match(text,/chevron_right/);
  assert.doesNotMatch(text,/<details|<summary/);
  assert.match(text,/aria-selected=\{option.value === value\}/);
  assert.match(text,/catch \{ setError\(true\); \}/);
  assert.match(text,/await onChange\(next\); setOpen\(false\)/);
  assert.match(text,/onClick=\{event => \{ event.stopPropagation\(\); close\(\); \}\}/);
});

test('long lists can be searched, empty options and compact controls are safe',()=>{
  const text=source('components/SettingRow.tsx');
  assert.match(text,/options.length > 8/);assert.match(text,/!options.length/);
  assert.match(text,/selected\?\.label/);assert.match(text,/compact = false/);
  assert.match(text,/running.current/);
});

test('production pages and components no longer use native selects',()=>{
  for(const directory of ['pages','components'])for(const name of readdirSync(new URL('../src/'+directory+'/',import.meta.url))){
    if(name.endsWith('.tsx'))assert.doesNotMatch(source(directory+'/'+name),/<select[\s>]/,name);
  }
});
