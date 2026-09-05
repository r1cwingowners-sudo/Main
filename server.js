const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
for (const line of (fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
  if (match && !process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = match[1].replace(/^['"]|['"]$/g, '');
}

const concepts = [
  ['The Garden Edit', 'romantic botanical wedding décor: abundant ivory and blush flowers, organic meadow arrangements, candlelight and fresh greenery'],
  ['After Dark', 'modern dramatic wedding décor: sculptural burgundy drapery, smoked glass, plum flowers, black candles, warm amber light'],
  ['Sunlit Celebration', 'joyful Indian celebration décor: marigold garlands, saffron and peach fabric, coral florals, brass lanterns, daylight']
];

function send(res, status, body, type='application/json') { res.writeHead(status, {'Content-Type': type}); res.end(type === 'application/json' ? JSON.stringify(body) : body); }
function serveFile(res, file) { const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}; fs.readFile(path.join(root,file), (e,data)=>e?send(res,404,'Not found','text/plain'):send(res,200,data,types[path.extname(file)]||'application/octet-stream')); }
function imageEditBody(bytes, type, prompt) {
  const boundary = `----sketch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const field = (name, value) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  const file = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="venue.png"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from('\r\n')]);
  return {boundary, body:Buffer.concat([field('model','gpt-image-1'), field('size','1536x1024'), field('prompt',prompt), file, Buffer.from(`--${boundary}--\r\n`)])};
}
function openAIImageEdit(request) {
  return new Promise((resolve,reject) => {
    const call=https.request({hostname:'api.openai.com',path:'/v1/images/edits',method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':`multipart/form-data; boundary=${request.boundary}`,'Content-Length':request.body.length}}, response => {
      const chunks=[]; response.on('data',chunk=>chunks.push(chunk)); response.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));response.statusCode>=200&&response.statusCode<300?resolve(data):reject(new Error(data.error?.message||'Image generation failed'));}catch(error){reject(error)}});
    }); call.on('error',reject); call.write(request.body); call.end();
  });
}

http.createServer(async (req,res) => {
  if (req.url === '/health') return send(res,200,{ok:true});
  if (req.method === 'POST' && req.url === '/api/concepts') {
    if (!process.env.OPENAI_API_KEY) return send(res,500,{error:'OPENAI_API_KEY is not configured.'});
    const chunks=[]; for await (const c of req) chunks.push(c); const raw=Buffer.concat(chunks);
    const boundary=(req.headers['content-type']||'').match(/boundary=(.+)$/)?.[1];
    const parts=raw.toString('binary').split(`--${boundary}`);
    const filePart=parts.find(p=>/name="venue"/.test(p));
    if (!filePart) return send(res,400,{error:'Please upload a venue photo.'});
    const headerEnd=filePart.indexOf('\r\n\r\n'); const headers=filePart.slice(0,headerEnd);
    const bytes=Buffer.from(filePart.slice(headerEnd+4).replace(/\r\n$/,''),'binary');
    const type=(headers.match(/Content-Type:\s*([^\r\n]+)/i)||[])[1]||'image/png';
    try {
      const images=[];
      for (const [name,direction] of concepts) {
        const request=imageEditBody(bytes,type,`Transform this exact venue into ${direction}. Preserve the real architecture, room dimensions, doors, windows, ceiling and boundaries. Wide editorial interior photograph. No people, text, watermark or logos.`);
        const data=await openAIImageEdit(request);
        images.push({name,image:`data:image/png;base64,${data.data[0].b64_json}`});
      }
      send(res,200,{concepts:images});
    } catch (error) { console.error('Concept generation failed:', error.message); send(res,500,{error:error.message}); }
    return;
  }
  serveFile(res, req.url === '/' ? 'index.html' : req.url.replace(/^\//,''));
}).listen(process.env.PORT || 3000, () => console.log('Sketch running on http://localhost:3000'));
