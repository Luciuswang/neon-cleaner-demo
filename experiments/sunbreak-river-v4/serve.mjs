import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url)),shared=resolve(root,'../sunbreak-storm-v3');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.hdr':'application/octet-stream','.wav':'audio/wav'};
async function hashes(){const out={};for(const name of [...await readdir(root),'qa/hooks.js','qa/browser.mjs'])if(/\.(js|html|json|mjs)$/.test(name))out[name]=createHash('sha256').update(await readFile(resolve(root,name))).digest('hex');return out}
http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1:5190').pathname);
  if(path==='/'||path==='/river'){res.writeHead(302,{Location:'/river/'});res.end();return}
  const local=path.startsWith('/river/'),base=local?root:shared,name=(local?path.slice(7):path.slice(1))||'index.html',file=resolve(base,name);
  if(req.method!=='GET'||!file.startsWith(base.endsWith(sep)?base:base+sep)||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return}
  if(!local&&!/^(assets\/|vendor\/|credits\.html$|assets-manifest\.json$)/.test(name)){res.writeHead(404);res.end();return}
  let data=await readFile(file);
  if(local&&name==='index.html'&&!new URL(req.url,'http://localhost').searchParams.has('public')){
   const hooks=await readFile(resolve(root,'qa/hooks.js'),'utf8'),sourceHashes=await hashes();data=Buffer.from(data.toString().replace('</script>\n</body>',()=>`\nconst loadedBuildHashes=${JSON.stringify(sourceHashes)};\n${hooks}\n</script>\n</body>`));
  }
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e.message))}
}).listen(5190,'127.0.0.1',()=>console.log('River map http://127.0.0.1:5190/river/'));
