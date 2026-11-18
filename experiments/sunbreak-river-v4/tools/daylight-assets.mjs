// Reproducible official CC0 HDR acquisition. No credentials or generated art.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const id='kloofendal_43d_clear_puresky',file=`assets/afterrain-light/${id}_2k.hdr`;
const metadata=await fetch(`https://api.polyhaven.com/files/${id}`).then(r=>{if(!r.ok)throw Error(r.status);return r.json()});
const remote=metadata.hdri['2k'].hdr;
let bytes;try{bytes=await readFile(resolve(root,file))}catch{bytes=Buffer.from(await fetch(remote.url).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer()}))}
const hash=a=>createHash(a).update(bytes).digest('hex');
if(bytes.length!==remote.size||hash('md5')!==remote.md5)throw Error('Official HDR integrity mismatch');
await mkdir(resolve(root,'assets/afterrain-light'),{recursive:true});await writeFile(resolve(root,file),bytes);
await writeFile(resolve(root,'daylight-assets.json'),JSON.stringify({schema:'verified-cc0-daylight-v1',id,source:`https://polyhaven.com/a/${id}`,author:'Greg Zaal / Poly Haven',license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',files:[{file,url:remote.url,bytes:bytes.length,md5:hash('md5'),sha256:hash('sha256')}]},null,2)+'\n');
console.log({file,bytes:bytes.length,sha256:hash('sha256')});
