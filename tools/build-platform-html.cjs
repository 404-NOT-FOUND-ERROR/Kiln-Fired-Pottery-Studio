const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const prepared=JSON.parse(read('qa-artifacts/platform-assets/assets.json'));
const virtual='https://pottery-embedded.invalid/';
const modules={},aliases={three:'vendor/three.module.js','three/addons/controls/OrbitControls.js':'vendor/OrbitControls.js','three/addons/environments/RoomEnvironment.js':'vendor/RoomEnvironment.js'};
function collect(name){
 if(modules[name])return;
 let source=read(name).replace(/new Worker\(new URL\(['"]\.\/glaze-worker\.js['"],\s*import\.meta\.url\),\s*\{type:'module'\}\)/g,'new Worker(globalThis.__potteryEmbedded.workerURL)').replace(/\bimport\.meta\.url\b/g,JSON.stringify(virtual+name));
 const refs=[];modules[name]={source,refs};
 for(const match of source.matchAll(/\b(?:import|export)\s+(?:(?:[^;'"]*?)\s+from\s*)?(['"])([^'"\r\n]+)\1/g)){
  const spec=match[2],dep=aliases[spec]||(spec.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(name),spec)):null);
  if(!dep)throw Error('Unbundled import: '+spec);
  const start=match.index+match[0].lastIndexOf(spec);refs.push({start,end:start+spec.length,path:dep});collect(dep);
 }
}
collect('studio.js');
const worker=read('glaze-firing.mjs').replace(/^export\s+/gm,'')+'\n'+read('glaze-worker.js').replace(/^import[^;]+;\s*/gm,'');
const imageVars={};
let html=read('index.html').replace('<body','<body class="dly-platform"');
html=html.replace('</head>','<meta name="eureka:viewport" content=\'{"mode":"responsive"}\'></head>');
html=html.replace(/<link\s+rel="stylesheet"\s+href="\.\/([^"\s]+)"\s*\/?\s*>/g,(_,name)=>'<style>'+read(name).replace(/url\(\s*(['"]?)(\.\/assets\/[^)'"\s]+)\1\s*\)/g,(_,q,src)=>{
 const key=src.slice(2);if(!prepared[key])throw Error('Missing image: '+key);
 const prop='--dly-image-'+Object.keys(imageVars).length;imageVars[prop]=key;return 'var('+prop+')';
})+'</style>');
html=html.replace(/\bsrc="\.\/(assets\/[^"\s]+)"/g,(_,name)=>`data-dly-image="${name}"`);
html=html.replace('</head>','<style>'+read('platform-layout.css')+'</style></head>');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*<script type="module" src="\.\/studio\.js"><\/script>/,'__PLATFORM_BOOT__');
const payload=JSON.stringify({version:2,modules,assets:prepared,worker,imageVars,licenses:{project:read('LICENSE'),three:read('vendor/THREE-LICENSE.txt')}}).replace(/</g,'\\u003c');
const boot=read('platform-boot.js').replace('__VIRTUAL_ORIGIN__',JSON.stringify(virtual))+'\n'+read('platform-type.js');
html=html.replace('__PLATFORM_BOOT__',()=>`<script id="pottery-bundle" type="application/json">${payload}</script><script type="module">${boot}</script>`);
if(/(?:src|href)="\.\//.test(html)||/url\(\s*['"]?\.\//.test(html))throw Error('Local resource remains');
const output=path.join(root,'platform/index.html');fs.mkdirSync(path.dirname(output),{recursive:true});
if(Buffer.byteLength(html)>10_000_000)throw Error('Platform package exceeds 10 MB: '+Buffer.byteLength(html));
fs.writeFileSync(output,html);
const report={output,bytes:Buffer.byteLength(html),assets:Object.keys(prepared).length,modules:Object.keys(modules).length,externalResources:[],sha256:crypto.createHash('sha256').update(html).digest('hex')};
fs.writeFileSync(path.join(root,'qa-artifacts/platform-build.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
