import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {deploymentPlan} from './mirror-deploy-plan.mjs';

const sites=new Set(['https://sermo.jyonn.space','https://frienden.jyonn.space','https://sermo.6-79.cn','https://frienden.6-79.cn']);
export function releaseDeploymentEnv(root,base=process.env){
  const env={...base};const file=path.join(root,'.env.deploy.local');
  if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    if(!line.trim()||line.trimStart().startsWith('#'))continue;
    const match=line.match(/^([A-Z_]+)=(.*)$/);if(!match)throw Error('Invalid deployment configuration');
    if(env[match[1]]===undefined)env[match[1]]=match[2].trim();
  }
  return env;
}

export async function verifyReleaseSite(origin,version,expectedNotes){
  if(!sites.has(origin)||!/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(version))throw Error('Invalid frontend publication');
  const releaseResponse=await fetch(`${origin}/release.json?registry=${version}-${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  const deployedNotes=await releaseResponse.json();
  if(!releaseResponse.ok||deployedNotes.id!==version)throw Error('Frontend release not yet available');
  if(expectedNotes&&!isDeepStrictEqual(deployedNotes,expectedNotes))throw Error('Deployed frontend notes differ from publication notes');
  const entry=await fetch(`${origin}/index.html?registry=${version}-${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  const html=await entry.text();
  if(!entry.ok||!html.includes(`name="frienden-release" content="${version}"`))throw Error('Frontend entry version mismatch');
  const script=html.match(/<script[^>]+src="([^"]+)"/);
  if(!script)throw Error('Frontend entry script missing');
  const url=new URL(script[1],origin);if(url.origin!==origin)throw Error('Unexpected frontend script origin');
  const resource=await fetch(url,{signal:AbortSignal.timeout(10000)});
  if(!resource.ok||resource.headers.get('content-type')?.includes('text/html'))throw Error('Frontend entry script unavailable');
  await resource.body?.cancel();
}

export async function publishFrontendRelease(origin,release,env){
  if(!sites.has(origin))throw Error('Unknown frontend origin');
  const plan=deploymentPlan(env);
  const deadline=Date.now()+180000;
  console.log(`Verify ${origin} before registering frontend ${release.id}`);
  for(;;){try{await verifyReleaseSite(origin,release.id,release);break}catch(error){if(Date.now()>deadline)throw error;await new Promise(resolve=>setTimeout(resolve,4000))}}
  const command=`cd /home/ubuntu/Sermo && /home/ubuntu/envs/sermo/bin/python manage.py publish_frontend_release --origin '${origin}'`;
  let successful=false;
  for(let attempt=0;attempt<3;attempt++){
    const result=spawnSync('ssh',['-i',plan.key,'-p',env.MIRROR_PORT||'22','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15',`${env.MIRROR_USER||'ubuntu'}@${env.MIRROR_HOST}`,command],{input:JSON.stringify(release),encoding:'utf8',stdio:['pipe','inherit','inherit'],timeout:45000});
    if(result.status===0){successful=true;break}
  }
  if(!successful)throw Error(`Frontend deployed but release registration failed: ${origin}`);
  let verified=false;
  for(let attempt=0;attempt<3;attempt++)try{
    const response=await fetch('https://api.sermo.jyonn.space/frontend/releases',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    const registry=await response.json();
    if(response.ok&&registry.body?.kind==='frontend'&&registry.body.sources.find(site=>site.origin===origin)?.releaseId===release.id){verified=true;break}
  }catch{/* Retry transient API network errors after the idempotent write. */}
  if(!verified)throw Error('Frontend release API verification failed');
  console.log(`Frontend release API verified: ${origin} ${release.id}`);
}
