import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(req.method==='POST'&&['/qa/capture','/qa/report'].includes(u.pathname)){
   if(req.headers.origin!=='http://127.0.0.1:5187'){res.writeHead(403);res.end();return;}
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>20e6)throw Error('Capture too large');chunks.push(c)}
   const body=JSON.parse(Buffer.concat(chunks).toString());
   if(!/^[a-z0-9-]{1,60}$/.test(body.name))throw Error('Invalid capture name');
   await mkdir(resolve(root,'qa/captures'),{recursive:true});
   const hashes={};for(const name of ['index.html','world.js','weapon.js','qa-hooks.js','qa/runtime-checks.js'])hashes[name]=createHash('sha256').update(await readFile(resolve(root,name))).digest('hex');
   if(u.pathname==='/qa/capture'){
    await writeFile(resolve(root,'qa/captures',body.name+'.png'),Buffer.from(body.png.replace(/^data:image\/png;base64,/,''),'base64'));
    await writeFile(resolve(root,'qa/captures',body.name+'.json'),JSON.stringify({...body.metadata,buildHashes:hashes},null,2));
   }else{
    await writeFile(resolve(root,'qa/captures',body.name+'.json'),JSON.stringify({...body.report,buildHashes:hashes},null,2));
   }
   res.writeHead(200,{'Content-Type':'text/plain'});res.end('saved');return;
  }
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const path=decodeURIComponent(u.pathname);const dest=resolve(root,'.'+(path==='/'||path==='/test'?'/index.html':path));
  if(!dest.startsWith(root.endsWith(sep)?root:root+sep)||path.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return;}
  let data=await readFile(dest);
  if(dest.endsWith('index.html')){
   let html=data.toString();
   let hooks=await readFile(new URL('./qa-hooks.js',import.meta.url),'utf8');
   if(path==='/test')hooks+='\n'+await readFile(new URL('./qa/runtime-checks.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../sunbreak-fable52/smoke-inject.js',import.meta.url),'utf8');
   html=html.replace('</script>\n</body>',()=>'\n'+hooks+'\n</script>\n</body>');data=Buffer.from(html);
  }
  res.writeHead(200,{'Content-Type':types[extname(dest)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Resource unavailable: '+e.message);}
});
server.listen(5187,'127.0.0.1',()=>console.log('SUNBREAK REALISTIC: http://127.0.0.1:5187/'));
