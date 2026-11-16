import http from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('.',import.meta.url)),port=5188;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream','.webp':'image/webp','.wav':'audio/wav','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.md':'text/plain'};
export const sourceNames=['index.html','world.js','weapon.js','actors.js','audio.js','storm.js','storm-audio.js','boot-ui.js','assets-manifest.json','weapon-provenance.json','soldier-provenance.json','vendor/manifest.json','assets/audio/manifest.json','qa-hooks.js','qa/runtime-checks.js','qa/storm-checks.js','serve.mjs'];
async function hashes(){const result={};for(const name of sourceNames)result[name]=createHash('sha256').update(await readFile(resolve(root,name))).digest('hex');return result}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1:'+port);
  if(req.method==='POST'&&['/qa/capture','/qa/report'].includes(u.pathname)){
   if(req.headers.origin!=='http://127.0.0.1:'+port){res.writeHead(403);res.end();return}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24e6)throw Error('Capture too large');chunks.push(chunk)}
   const body=JSON.parse(Buffer.concat(chunks).toString());if(!/^[a-z0-9-]{1,60}$/.test(body.name))throw Error('Invalid evidence name');
   await mkdir(resolve(root,'qa/captures'),{recursive:true});
   const saveBuildHashes=await hashes(),buildHashes=body.loadedBuildHashes;
   if(!buildHashes||Object.keys(saveBuildHashes).some(name=>buildHashes[name]!==saveBuildHashes[name])){res.writeHead(409);res.end('Page loaded an older build; reload before evidence capture');return}
   if(u.pathname==='/qa/capture')await writeFile(resolve(root,'qa/captures',body.name+'.png'),Buffer.from(body.png.replace(/^data:image\/png;base64,/,''),'base64'));
   await writeFile(resolve(root,'qa/captures',body.name+'.json'),JSON.stringify({...body.metadata,...body.report,buildHashes},null,2)+'\n');
   res.writeHead(200);res.end('saved');return;
  }
  if(req.method!=='GET'){res.writeHead(405);res.end();return}
  const path=decodeURIComponent(u.pathname);
  if(path.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return}
  if(path==='/original'||path==='/original/'){
   res.writeHead(200,{'Content-Type':types['.html']});res.end(await readFile(new URL('../sunbreak-fable52/index.html',import.meta.url)));return;
  }
  const v2=path==='/v2'||path.startsWith('/v2/');
  const selectedRoot=v2?fileURLToPath(new URL('../sunbreak-realistic-v2/',import.meta.url)):root;
  const route=v2?path.replace(/^\/v2\/?/,'/'):path;
  const file=resolve(selectedRoot,'.'+(['/', '/test','/storm-test','/startup-test','/startup-baseline'].includes(route)?'/index.html':route));
  if(!file.startsWith(selectedRoot.endsWith(sep)?selectedRoot:selectedRoot+sep)){res.writeHead(403);res.end();return}
  let data=await readFile(file);
  if(path==='/startup-baseline')data=Buffer.from((await readFile(new URL('../sunbreak-fable52/index.html',import.meta.url),'utf8')).replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js','./vendor/three/build/three.module.js'));
  if(!v2&&file.endsWith('index.html')){
   const buildHashes=await hashes();
   let hooks='const qaBuildHashes=Object.freeze('+JSON.stringify(buildHashes)+');\n'+await readFile(new URL('./qa-hooks.js',import.meta.url),'utf8');
   if(path==='/test')hooks+='\n'+await readFile(new URL('./qa/runtime-checks.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../sunbreak-fable52/smoke-inject.js',import.meta.url),'utf8');
   if(path==='/storm-test')hooks+='\n'+await readFile(new URL('./qa/storm-checks.js',import.meta.url),'utf8');
   let text=data.toString();
   if(path==='/startup-test'){
    text=text.replace("const {buildWorld}=await import('./world.js');","const startupRandom=Math.random;let startupDraws=0;const startupStacks=[];Math.random=()=>{startupDraws++;if(startupStacks.length<8)startupStacks.push(new Error().stack);return startupRandom()};\nconst {buildWorld}=await import('./world.js');")
     .replace("visual.setStyle(si);\ndocument.getElementById('bWeather')","Math.random=startupRandom;const addedVisualInitRngCalls=startupDraws;\nvisual.setStyle(si);\ndocument.getElementById('bWeather')");
   }
   if(['/startup-test','/startup-baseline'].includes(path)){
    text=text.replace('\ntick();','\nconst frameRandom=Math.random;let firstFrameRngCalls=0;const frameStacks=[];Math.random=()=>{firstFrameRngCalls++;if(frameStacks.length<32)frameStacks.push(new Error().stack);return frameRandom()};try{tick()}finally{Math.random=frameRandom};');
    if(path==='/startup-baseline')hooks='const qaBuildHashes=Object.freeze('+JSON.stringify(buildHashes)+');\n';
    hooks+='\nconst startupReport={date:new Date().toISOString(),method:"instrumented initialization and first draw in menu; explicit diagnostic only, no production global RNG substitution",mode:'+JSON.stringify(path)+',addedVisualInitRngCalls:typeof addedVisualInitRngCalls==="undefined"?null:addedVisualInitRngCalls,startupStacks:typeof startupStacks==="undefined"?[]:startupStacks,firstFrameRngCalls,frameStacks};fetch("/qa/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:'+JSON.stringify(path.slice(1))+',report:startupReport,loadedBuildHashes:qaBuildHashes})}).then(r=>document.body.dataset.startupReport=r.ok?"saved":"failed");';
   }
   data=Buffer.from(text.replace('</script>\n</body>',()=>'\n'+hooks+'\n</script>\n</body>'));
  }
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Resource unavailable: '+error.message)}
});
server.listen(port,'127.0.0.1',()=>console.log(`SUNBREAK STORM V3: http://127.0.0.1:${port}/`));
