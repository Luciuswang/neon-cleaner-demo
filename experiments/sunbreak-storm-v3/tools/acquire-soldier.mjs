import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),dir=new URL('assets/soldier/',root);
await mkdir(dir,{recursive:true});
const source='https://raw.githubusercontent.com/cktang88/3d-fps/130ac2a5c856401ec36e7d35afcfefe40c5801f4/public/assets/models/characters/soldier_tac.glb';
const authorAPI='https://api.sketchfab.com/v3/models/ef698ce36b1545a78ce592dd3db4c7ed';
const response=await fetch(authorAPI);if(!response.ok)throw Error('Author metadata unavailable');
const author=await response.json();
if(author.license?.slug!=='by'||!author.license?.url?.includes('/by/4.0'))throw Error('Unexpected soldier license');
await writeFile(new URL('author-metadata.json',dir),JSON.stringify(author,null,2)+'\n');
let data;try{data=await readFile(new URL('soldier_tac.glb',dir))}catch{}
if(!data){const r=await fetch(source);if(!r.ok)throw Error('Soldier download unavailable');data=Buffer.from(await r.arrayBuffer())}
const sha256=createHash('sha256').update(data).digest('hex');
if(data.length!==4532132||sha256!=='fe02bc307077d7a5a74069d085893988d93751495871c84082256e60bf9bfc9e')throw Error('Soldier pinned digest mismatch');
if(data.toString('ascii',0,4)!=='glTF')throw Error('Invalid glTF');
const header=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
if(header.animations?.length)throw Error('Unexpected embedded animation source');
await writeFile(new URL('soldier_tac.glb',dir),data);
await writeFile(new URL('soldier-provenance.json',root),JSON.stringify({
 schema:'sunbreak-licensed-character-v1',source,authorAPI,
 author:author.user?.displayName||author.user?.username,original:author.viewerUrl,
 license:'CC-BY-4.0',licenseUrl:author.license.url,
 files:[{path:'assets/soldier/soldier_tac.glb',bytes:data.length,sha256}],
 embeddedAttribution:header.asset?.copyright,
 changes:'Remove detached headset; uniform fit and grounding; original render-only leg motion. No upstream gameplay/animation code or clips.',
 animationClips:0,scope:'Display layer only; original six enemy anchors and hit proxies remain authoritative.'
},null,2)+'\n');
console.log(JSON.stringify({license:author.license,author:author.user?.displayName,nodes:header.nodes.map(n=>n.name).filter(Boolean),asset:header.asset},null,2));
