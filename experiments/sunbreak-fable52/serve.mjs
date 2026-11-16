import http from 'node:http';
import { readFile } from 'node:fs/promises';
const page = new URL('./index.html', import.meta.url);
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!['/', '/index.html', '/test'].includes(pathname)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    let html = await readFile(page, 'utf8');
    if(pathname==='/test')html=html.replace('</script>', '\n'+await readFile(new URL('./smoke-inject.js',import.meta.url),'utf8')+'\n</script>');
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(html);
  } catch {
    res.writeHead(503, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Demo generation is still in progress.');
  }
});
server.listen(5186, '127.0.0.1', () => console.log('SUNBREAK: http://127.0.0.1:5186'));
