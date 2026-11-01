const bundle=JSON.parse(document.getElementById('pottery-bundle').textContent);
const virtual=__VIRTUAL_ORIGIN__,urls=new Map(),moduleURLs=new Map(),building=new Set(),decoded=new Map();
globalThis.__potteryPlatform=true;
function assetKey(value){
 const s=String(value);
 if(s.startsWith('data:')||s.startsWith('blob:'))return null;
 if(s.startsWith(virtual))return new URL(s).pathname.slice(1);
 if(/^\.?\/?assets\//.test(s))return s.replace(/^\.\//,'').replace(/^\//,'');
 return null;
}
function rawBytes(item){const binary=atob(item.uri.slice(item.uri.indexOf(',')+1)),bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function assetBytes(key){
 if(decoded.has(key))return decoded.get(key);
 const promise=(async()=>{
  const item=bundle.assets[key];if(!item)throw Error('Embedded asset missing: '+key);
  const packed=rawBytes(item);if(!item.encoding)return packed;
  if(!globalThis.DecompressionStream)throw Error('当前浏览器不支持压缩资源，请更新浏览器。');
  const unpacked=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(item.encoding==='gzip')return unpacked;
  if(item.encoding!=='mesh16-planar-gzip')throw Error('Unknown mesh encoding');
  const count=item.vertices*8+item.indices;
  if(unpacked.length!==count*2)throw Error('Incomplete mesh');
  const output=new ArrayBuffer(item.vertices*32+item.indices*4),values=new Float32Array(output,0,item.vertices*8),indices=new Uint32Array(output,item.vertices*32,item.indices);
  const value=i=>unpacked[i]+unpacked[count+i]*256;
  for(let c=0;c<8;c++)for(let i=0;i<item.vertices;i++)values[i*8+c]=item.low[c]+value(c*item.vertices+i)/65535*item.span[c];
  let previous=0;for(let i=0;i<item.indices;i++){previous=(previous+value(item.vertices*8+i))&65535;indices[i]=previous;}
  return new Uint8Array(output);
 })();
 decoded.set(key,promise);try{return await promise;}catch(error){decoded.delete(key);throw error;}
}
function assetURL(value){
 const key=assetKey(value);if(!key)return value;
 const item=bundle.assets[key];if(!item)throw Error('Embedded asset missing: '+key);
 // Encoded meshes/HDR are decoded lazily through fetch; image URLs stay native.
 if(item.encoding)return virtual+key;
 if(!urls.has(key))urls.set(key,URL.createObjectURL(new Blob([rawBytes(item)],{type:item.type})));
 return urls.get(key);
}
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,options)=>{
 const key=assetKey(input?.url||input);
 return key?new Response(await assetBytes(key),{status:200,headers:{'Content-Type':bundle.assets[key].type}}):nativeFetch(input,options);
};
function moduleURL(name){
 if(moduleURLs.has(name))return moduleURLs.get(name);if(building.has(name))throw Error('Circular module: '+name);building.add(name);
 const record=bundle.modules[name];let source=record.source;
 for(const ref of [...record.refs].reverse())source=source.slice(0,ref.start)+moduleURL(ref.path)+source.slice(ref.end);
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));moduleURLs.set(name,url);building.delete(name);return url;
}
for(const [property,key] of Object.entries(bundle.imageVars))document.documentElement.style.setProperty(property,`url("${assetURL(key)}")`);
for(const image of document.querySelectorAll('[data-dly-image]'))image.src=assetURL(image.dataset.dlyImage);
globalThis.__potteryEmbedded={assetURL,workerURL:URL.createObjectURL(new Blob([bundle.worker],{type:'text/javascript'}))};
function failure(message){
 const button=document.getElementById('startExperience');if(button){button.textContent=message;button.disabled=true;}
 const preview=document.getElementById('previewPiece');if(preview)preview.hidden=true;
}
try{
 const probe=document.createElement('canvas'),gl=probe.getContext('webgl2');
 if(!gl)throw Error('当前设备不支持三维显示，请更换浏览器。');
 gl.getExtension('WEBGL_lose_context')?.loseContext();
 if(!globalThis.DecompressionStream)throw Error('请更新浏览器后打开工坊。');
 const THREE=await import(moduleURL('vendor/three.module.js'));THREE.DefaultLoadingManager.setURLModifier(assetURL);
 const app=await import(moduleURL('studio.js'));globalThis.potteryStudio={inspectStudio:app.inspectStudio};
}catch(error){console.error(error);failure(error.message||'工坊加载失败，请重新打开。');}
