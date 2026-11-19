// Local-only static preview; no package install and no project-wide file access.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.txt':'text/plain; charset=utf-8','.json':'application/json','.png':'image/png'};
createServer(async(req,res)=>{
 if(req.url==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return}
 try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let path=resolve(root,'.'+pathname);if(path!==root.replace(/[\\/]$/,'')&&!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes)}
 catch{res.writeHead(404);res.end('Not found')}
}).listen(5191,'127.0.0.1',()=>console.log('Material Lab: http://127.0.0.1:5191/'));
