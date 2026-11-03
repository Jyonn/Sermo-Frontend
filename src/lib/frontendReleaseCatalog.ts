import {SITE_ORIGINS} from './siteOrigins.ts';
import type {ReleaseNotes,UpdateSourceResult} from './pwaUpdate';

export function isFrontendRelease(value:unknown):value is ReleaseNotes{
  if(!value||typeof value!=='object')return false;
  const note=value as Partial<ReleaseNotes>;
  return typeof note.id==='string'&&/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(note.id)&&typeof note.publishedAt==='string'&&Boolean(note.locales&&typeof note.locales==='object');
}

export function parseFrontendReleaseCatalog(value:unknown):UpdateSourceResult[]{
  const data=value as {kind?:unknown;sources?:unknown};
  if(!data||data.kind!=='frontend'||!Array.isArray(data.sources))throw Error('Invalid frontend release catalog');
  const records=data.sources;
  return SITE_ORIGINS.map(site=>{
    const rows=records.filter((row:unknown)=>row&&typeof row==='object'&&(row as {origin?:unknown}).origin===site.origin);
    if(rows.length!==1)throw Error('Missing or duplicate frontend origin');
    const row=rows[0];
    if(row.key!==site.key||!['ok','error'].includes(row.status))throw Error('Invalid frontend site');
    if(row.status==='ok'&&(!isFrontendRelease(row.release)||row.releaseId!==row.release.id))throw Error('Invalid frontend release');
    return {...site,status:row.status,release:row.status==='ok'?row.release:null,releaseId:row.status==='ok'?row.releaseId:null};
  });
}
