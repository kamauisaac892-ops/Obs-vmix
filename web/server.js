import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{const path=(req.url||'/').split('?')[0];const file=path==='/'?'index.html':path.replace(/^\\/+/, '');try{const body=await readFile(join(root,file));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}).listen(port,'0.0.0.0',()=>console.log('Our Production Studio listening on '+port));