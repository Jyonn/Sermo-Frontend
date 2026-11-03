import fs from 'node:fs';
import path from 'node:path';
import {publishFrontendRelease,releaseDeploymentEnv} from './frontend-release-publisher.mjs';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--origin')throw Error('Usage: npm run release:publish -- --origin https://site');
const root=path.resolve(import.meta.dirname,'..');
await publishFrontendRelease(args[1],JSON.parse(fs.readFileSync(path.join(root,'release-notes.json'),'utf8')),releaseDeploymentEnv(root));
