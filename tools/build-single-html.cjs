const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const virtual='https://pottery-embedded.invalid/';
const types={'.webp':'image/webp','.png':'image/png','.hdr':'application/octet-stream','.bin':'application/octet-stream','.json':'application/json'};
const aliases={three:'vendor/three.module.js','three/addons/controls/OrbitControls.js':'vendor/OrbitControls.js','three/addons/environments/RoomEnvironment.js':'vendor/RoomEnvironment.js'};
const modules={},assets={};
function file(name){const p=path.resolve(root,name);if(path.relative(root,p).startsWith('..'))throw new Error('File outside project: '+name);return p;}
function dataURI(name){const asset=assets[name];if(!asset)throw new Error('Missing embedded asset: '+name);return `data:${asset.type};base64,${asset.data}`;}
function collect(name){
 if(modules[name])return;
 let source=fs.readFileSync(file(name),'utf8');
 source=source.replace(/new Worker\(new URL\(['"]\.\/glaze-worker\.js['"],\s*import\.meta\.url\),\s*\{type:'module'\}\)/g,'new Worker(globalThis.__potteryEmbedded.workerURL)');
 source=source.replace(/\bimport\.meta\.url\b/g,JSON.stringify(virtual+name));
 const refs=[];modules[name]={source,refs};
 const imports=/\b(?:import|export)\s+(?:(?:[^;'"]*?)\s+from\s*)?(['"])([^'"\r\n]+)\1/g;
 for(const match of source.matchAll(imports)){
  const spec=match[2],dep=aliases[spec]||(spec.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(name),spec)):null);
  if(!dep)throw new Error('Unbundled import: '+name+' -> '+spec);
  const start=match.index+match[0].lastIndexOf(spec);refs.push({start,end:start+spec.length,path:dep});collect(dep);
 }
}
function addAssets(directory){for(const entry of fs.readdirSync(file(directory),{withFileTypes:true})){const name=directory+'/'+entry.name;if(entry.isDirectory())addAssets(name);else{const type=types[path.extname(name)];if(type)assets[name]={type,data:fs.readFileSync(file(name)).toString('base64')};}}}
// These are the shipped scene meshes, photographic plates and reflection maps.
for(const dir of ['assets/museum','assets/living','assets/art'])addAssets(dir);
for(const name of ['assets/studio-cover-20261007.webp','assets/studio-coherent-plate-20261013.webp','assets/example-museum.webp','assets/example-art.webp','assets/workshop/workshop-background.webp'])assets[name]={type:types[path.extname(name)],data:fs.readFileSync(file(name)).toString('base64')};
collect('studio.js');collect('glaze-worker.js');
let html=fs.readFileSync(file('index.html'),'utf8');
html=html.replace(/<link\s+rel="stylesheet"\s+href="\.\/([^"\s]+)"\s*\/?\s*>/g,(_,name)=>{
 const css=fs.readFileSync(file(name),'utf8').replace(/url\(\s*(['"]?)(\.\/assets\/[^)'"\s]+)\1\s*\)/g,(_,q,src)=>`url("${dataURI(src.slice(2))}")`);
 return '<style>\n'+css+'\n</style>';
});
html=html.replace(/\bsrc="\.\/(assets\/[^"\s]+)"/g,(_,name)=>`src="${dataURI(name)}"`);
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*<script type="module" src="\.\/studio\.js"><\/script>/,'__PORTABLE_BOOT__');
// A classic Blob worker avoids module-worker file:// origin restrictions.
// It runs the same firing implementation and transfers the same typed arrays.
const firingSource=fs.readFileSync(file('glaze-firing.mjs'),'utf8').replace(/^export\s+/gm,'');
const workerSource=fs.readFileSync(file('glaze-worker.js'),'utf8').replace(/^import[^;]+;\s*/gm,'');
const worker=firingSource+'\n'+workerSource;
const licenses={project:fs.readFileSync(file('LICENSE'),'utf8'),three:fs.readFileSync(file('vendor/THREE-LICENSE.txt'),'utf8')};
const payload=JSON.stringify({version:1,modules,assets,worker,licenses}).replace(/</g,'\\u003c');
const boot=`
const bundle=JSON.parse(document.getElementById('pottery-bundle').textContent);
const virtual=${JSON.stringify(virtual)}, urls=new Map(), moduleURLs=new Map(), building=new Set();
function assetKey(value){const s=String(value);if(s.startsWith('data:')||s.startsWith('blob:'))return null;
 if(s.startsWith(virtual))return new URL(s).pathname.slice(1);if(/^\\.?\\/?assets\\//.test(s))return s.replace(/^\\.\\//,'').replace(/^\\//,'');return null;}
function bytes(key){const item=bundle.assets[key];if(!item)throw new Error('Embedded file missing: '+key);
 const binary=atob(item.data), result=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i);return result;}
function assetURL(value){const key=assetKey(value);if(!key)return value;if(!urls.has(key))urls.set(key,URL.createObjectURL(new Blob([bytes(key)],{type:bundle.assets[key].type})));return urls.get(key);}
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,options)=>{const key=assetKey(input?.url||input);return key?Promise.resolve(new Response(bytes(key),{status:200,headers:{'Content-Type':bundle.assets[key].type}})):nativeFetch(input,options);};
function moduleURL(name){if(moduleURLs.has(name))return moduleURLs.get(name);if(building.has(name))throw new Error('Circular module: '+name);building.add(name);
 const record=bundle.modules[name];let source=record.source;for(const ref of [...record.refs].reverse())source=source.slice(0,ref.start)+moduleURL(ref.path)+source.slice(ref.end);
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));moduleURLs.set(name,url);building.delete(name);return url;}
globalThis.__potteryEmbedded={assetURL,workerURL:URL.createObjectURL(new Blob([bundle.worker],{type:'text/javascript'}))};
try{const THREE=await import(moduleURL('vendor/three.module.js'));THREE.DefaultLoadingManager.setURLModifier(assetURL);
 const app=await import(moduleURL('studio.js'));globalThis.potteryStudio={inspectStudio:app.inspectStudio};
}catch(error){console.error(error);const button=document.getElementById('startExperience');if(button)button.textContent='工坊加载失败，请用 Edge 或 Chrome 重新打开';}
`;
html=html.replace('__PORTABLE_BOOT__',()=>`<script id="pottery-bundle" type="application/json">${payload}</script>\n<script type="module">${boot}</script>`);
// A function replacement preserves literal dollar signs in embedded source.
const embedded=html.match(/<script id="pottery-bundle" type="application\/json">([\s\S]*?)<\/script>/)[1];
if(embedded!==payload)throw new Error('Embedded payload changed while assembling HTML');
if(/(?:src|href)="\.\//.test(html)||/url\(\s*['"]?\.\//.test(html))throw new Error('External local resource remains in HTML');
const output=file('dist/pottery-studio.html');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html,'utf8');
const summary={output,bytes:Buffer.byteLength(html),assets:Object.keys(assets).length,modules:Object.keys(modules).length,sha256:crypto.createHash('sha256').update(html).digest('hex')};
fs.mkdirSync(file('qa-artifacts'),{recursive:true});fs.writeFileSync(file('qa-artifacts/single-html-build.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
