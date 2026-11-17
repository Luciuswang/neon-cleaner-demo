// Local-only browser QA server. Public packaging excludes this and qa/.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url));
const shared=resolve(root,'../sunbreak-storm-v3');
const port=Number(process.env.SUNBREAK_V4_PORT||5189);
const names=['index.html','world.js','weapon.js','actors.js','audio.js','storm.js','storm-audio.js','timber-house.js','house-asset.js','house-logic.js','tactical-ai.js','boot-ui.js','combat-controls.js','reload-pose.js','assets-manifest.json','weapon-provenance.json','soldier-provenance.json','serve.mjs','qa/hooks.js','qa/browser.mjs','qa/unit.mjs'];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.hdr':'application/octet-stream','.wav':'audio/wav','.glb':'model/gltf-binary','.zip':'application/zip','.md':'text/plain'};
async function hashes(){return Object.fromEntries(await Promise.all(names.map(async name=>[name,createHash('sha256').update(await readFile(resolve(root,name))).digest('hex')])))}
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method!=='GET'){res.writeHead(405);res.end();return}
  const path=decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname);
  if(path.split('/').some(p=>p==='..'||p.startsWith('.'))){res.writeHead(403);res.end();return}
  const isV4=path.startsWith('/v4/'),relative=isV4?path.slice(4):path.slice(1);
  if(!isV4&&(relative===''||relative==='index.html')){
   res.writeHead(302,{Location:'/v4/'});res.end();return;
  }
  const base=isV4?root:shared,name=relative===''?'index.html':relative;
  const file=resolve(base,name);
  if(!file.startsWith(base.endsWith(sep)?base:base+sep)){res.writeHead(403);res.end();return}
  if(!isV4&&!/^(assets\/|vendor\/|credits\.html$|assets-manifest\.json$|weapon-provenance\.json$|soldier-provenance\.json$)/.test(name)){res.writeHead(404);res.end();return}
  let data=await readFile(file);
  if(isV4&&name==='index.html'){
   const hooks=await readFile(resolve(root,'qa/hooks.js'),'utf8'),buildHashes=await hashes();
   data=Buffer.from(data.toString().replace('</script>\n</body>',()=>'\nconst loadedBuildHashes='+JSON.stringify(buildHashes)+';\n'+hooks+'\n</script>\n</body>'));
  }
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Unavailable: '+error.message)}
});
server.listen(port,'127.0.0.1',()=>console.log(`SUNBREAK v4 http://127.0.0.1:${port}/v4/`));
