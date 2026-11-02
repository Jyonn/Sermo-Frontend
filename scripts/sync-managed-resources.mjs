// Refresh the checked-in mirror cache from the canonical resource registry.
// Uses public asset endpoints, never storage credentials or bucket-wide listing.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const origin=new URL(process.env.RESOURCE_API_ORIGIN||'https://api.sermo.jyonn.space');
if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('HTTPS API origin required');
const slug='haibara-v2';
const response=await fetch(new URL(`/resources/collections/${slug}`,origin),{signal:AbortSignal.timeout(20000)});
const envelope=await response.json();
const collection=envelope.body;
if(!response.ok||collection?.slug!==slug||!Array.isArray(collection.assets)||!collection.assets.length)throw new Error('Resource collection unavailable');

const manifest={};
for(const asset of collection.assets){
 if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(asset.slug))throw new Error('Invalid asset key');
 const record={title:asset.title,title_en:asset.title_en,content_hash:asset.content_hash};
 for(const variant of ['display','thumbnail']){
  const hash=variant==='display'?asset.content_hash:asset.thumbnail_hash;
  if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid resource hash');
  const url=new URL(variant==='display'?asset.uri:asset.thumbnail_uri,origin);
  if(url.origin!==origin.origin)throw new Error('Unexpected resource API origin');
  const result=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!result.ok)throw new Error(`Download failed for ${asset.slug}`);
  const bytes=Buffer.from(await result.arrayBuffer());
  if(bytes.length>4*1024*1024||bytes.toString('ascii',8,12)!=='WEBP'||createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`Invalid resource content for ${asset.slug}`);
  if(variant==='thumbnail'&&bytes.length>25000)throw new Error('Thumbnail exceeds mobile budget');
  record[variant]=url.href;
  if(variant==='thumbnail')record.thumbnail_bytes=bytes.length;
 }
 manifest[asset.slug]=record;
}
await fs.writeFile(path.join(root,'src/assets/haibara-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified ${Object.keys(manifest).length} published assets; wrote URL metadata only.`);
