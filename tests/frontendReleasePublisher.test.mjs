import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReleaseSite} from '../scripts/frontend-release-publisher.mjs';
test('release registration requires the deployed marker, matching notes, HTML version and an available same-origin script',async()=>{
  const original=globalThis.fetch,origin='https://frienden.jyonn.space',notes={id:'2026.11.03.2',publishedAt:'2026-11-03',locales:{}};let mode='good';
  globalThis.fetch=async url=>{
    const value=String(url);
    if(value.includes('/release.json'))return new Response(JSON.stringify(mode==='marker'?{...notes,id:'2026.11.03.1'}:mode==='notes'?{...notes,publishedAt:'2026-11-04'}:notes));
    if(value.includes('/index.html'))return new Response(`<meta name="frienden-release" content="${mode==='html'?'2026.11.03.1':notes.id}"><script type="module" src="${mode==='origin'?'https://evil.test/x.js':'/assets/new.js'}"></script>`);
    return mode==='script'?new Response('missing',{status:404}):new Response('export {}',{headers:{'content-type':'application/javascript'}});
  };
  try{await verifyReleaseSite(origin,notes.id,notes);for(mode of ['marker','notes','html','origin','script'])await assert.rejects(verifyReleaseSite(origin,notes.id,notes));await assert.rejects(verifyReleaseSite('https://evil.test',notes.id,notes))}finally{globalThis.fetch=original}
});
