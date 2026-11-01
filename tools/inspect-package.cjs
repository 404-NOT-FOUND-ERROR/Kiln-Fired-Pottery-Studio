const fs=require('node:fs'),zlib=require('node:zlib');
const html=fs.readFileSync('dist/pottery-studio.html','utf8');
const bundle=JSON.parse(html.match(/<script id="pottery-bundle" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const sizes=Object.entries(bundle.assets).map(([file,item])=>{const bytes=Buffer.from(item.data,'base64');return {file,bytes:bytes.length,gzip:zlib.gzipSync(bytes,{level:9}).length};}).sort((a,b)=>b.bytes-a.bytes);
console.log(JSON.stringify({assets:sizes,rawTotal:sizes.reduce((s,x)=>s+x.bytes,0),gzipTotal:sizes.reduce((s,x)=>s+x.gzip,0),modules:Buffer.byteLength(JSON.stringify(bundle.modules)),payload:Buffer.byteLength(JSON.stringify(bundle)),gzipPayload:zlib.gzipSync(Buffer.from(JSON.stringify(bundle)),{level:9}).length},null,2));
