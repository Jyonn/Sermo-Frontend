import test from 'node:test';
import assert from 'node:assert/strict';
import {readMobileVoiceInputMode, setMobileVoiceInputMode} from '../src/lib/mobileVoiceInputMode.ts';

test('voice input defaults to hold and persists tap with an immediate change notification', () => {
  const events = new EventTarget();
  const values = new Map<string,string>();
  let writable = true, readable = true, notifications = 0;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {configurable:true, value:{
    localStorage:{getItem(key:string){if(!readable)throw Error('blocked');return values.get(key)??null;},setItem(key:string,value:string){if(!writable)throw Error('quota');values.set(key,value);}},
    dispatchEvent:events.dispatchEvent.bind(events),
  }});
  events.addEventListener('frienden:mobile-voice-input-mode-changed', () => notifications++);
  try {
    assert.equal(readMobileVoiceInputMode(),'hold');
    values.set('frienden:mobile-voice-input-mode','invalid');
    assert.equal(readMobileVoiceInputMode(),'hold');
    setMobileVoiceInputMode('tap');
    assert.equal(readMobileVoiceInputMode(),'tap');
    assert.equal(values.get('frienden:mobile-voice-input-mode'),'tap');
    assert.equal(notifications,1);
    writable=false;
    setMobileVoiceInputMode('hold');
    assert.equal(readMobileVoiceInputMode(),'hold','failed writes still update the current session');
    readable=false;
    setMobileVoiceInputMode('tap');
    assert.equal(readMobileVoiceInputMode(),'tap','restricted storage does not prevent tap recording');
    readable=true;writable=true;setMobileVoiceInputMode('hold');
    assert.equal(readMobileVoiceInputMode(),'hold');
  } finally {
    if(previous)Object.defineProperty(globalThis,'window',previous);
    else Reflect.deleteProperty(globalThis,'window');
  }
});
