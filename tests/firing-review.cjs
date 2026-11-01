// Visual QA uses the layers saved by the real pointer-driven making test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa-artifacts/reactive');
assert(fs.existsSync(path.join(out,'record.json')),'Run test:reactive first');
fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>同一件小罐 · 烧成效果对比</title>
<style>*{box-sizing:border-box}body{margin:0;padding:52px 40px 30px;background:#e6dfd2;color:#3d352c;font-family:Georgia,'Songti SC','SimSun',serif}header{margin-bottom:22px}header small{font:11px Arial,sans-serif;letter-spacing:.15em;color:#94785d}h1{font-weight:400;font-size:38px;margin:15px 0 12px}header p,footer{font-size:14px;color:#7d7060;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;border-top:1px solid #a48b6c77;padding-top:14px}figure img{display:block;width:100%}figcaption{text-align:center;font-size:22px;margin-top:15px}figure p{text-align:center;font-size:12px;line-height:1.8;color:#796954}footer{margin-top:30px;font-size:12px}#status{font:13px Arial,sans-serif;padding:80px;text-align:center}</style>
<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/"}}</script>
<header><small>MATERIAL STUDY / 2026.10.07</small><h1>同一件小罐，让窑火留下不同的表情。</h1><p>同一器形、同一组釉层、同一光照与视角。只切换效果釉。</p></header><div id="status">正在以真实保存的釉层生成对比…</div><div class="grid"></div><footer>从网页实际手捏与叠刷记录生成；配方为艺术化效果预设。每件新作品的细部随机，保存后保持一致。</footer>
<script type="module">
import * as THREE from 'three';import {RoomEnvironment} from '/vendor/RoomEnvironment.js';import {shapedGeometry} from '/vessel-geometry.js';import {fireLayers,firingFamilies} from '/glaze-firing.mjs';import {applyGlazeSurface} from '/museum-assets.js';
const record=await(await fetch('./record.json')).json(),size=1024;
async function pixels(url){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(img,0,0);return c.getContext('2d').getImageData(0,0,size,size).data;}
const [base,underglaze,glaze]=await Promise.all(['base','glaze','wet'].map(n=>pixels(record.layers[n]))),foot=new Uint8ClampedArray(base.length);for(let i=0;i<foot.length;i+=4)foot.set([255,255,255,255],i);for(let y=993;y<1024;y++)for(let x=0;x<1024;x++)foot[(y*1024+x)*4+3]=0;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(500,620);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e6dfd2');const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.06).texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff3dc','#777363',1.15));const key=new THREE.DirectionalLight('#fff1d4',2);key.position.set(-4,6,5);scene.add(key);const fill=new THREE.DirectionalLight('#cbd7e0',.65);fill.position.set(4,3,2);scene.add(fill);
const geo=shapedGeometry(record.settings.shape),bounds=geo.boundingBox,h=bounds.max.y-bounds.min.y,center=(bounds.min.y+bounds.max.y)/2;
const camera=new THREE.PerspectiveCamera(31,500/620,.01,100);camera.position.set(0,center+h*.17,h*2.33);camera.lookAt(0,center,0);
function texture(data,color=false){const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').putImageData(new ImageData(data,size,size),0,0);const t=new THREE.CanvasTexture(c);if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
for(const [key,name,copy] of [['before','烧前釉层','柔边叠刷 · 厚薄保留'],...Object.entries(firingFamilies).map(([k,v])=>[k,v.name,v.copy])]){
 const before=key==='before',data=before?null:fireLayers({width:size,height:size,base,underglaze,glaze,foot,clearGlaze:record.settings.clearGlaze,finish:key,fire:record.settings.fire,cooling:record.settings.cooling,seed:record.settings.kilnSeed});
 const surface=before?await pixels(record.layers.base):data.color;
 if(before){for(let i=0;i<surface.length;i+=4){const a=underglaze[i+3]/255,b=glaze[i+3]/255;for(let c=0;c<3;c++)surface[i+c]=(surface[i+c]*(1-a)+underglaze[i+c]*a)*(1-b)+glaze[i+c]*b;}}
 const material=new THREE.MeshPhysicalMaterial({map:texture(surface,true),roughness:before?.88:1,clearcoat:before?0:.92,clearcoatRoughness:.075,side:THREE.DoubleSide,vertexColors:true});material.userData.handmade=true;material.userData.finish=key;material.userData.reliefScale=({gloss:.022,satin:.014,speckle:.019,crackle:.012})[key]||.003;
 if(!before){material.clearcoatMap=texture(data.coat);material.roughnessMap=texture(data.roughness);material.bumpMap=texture(data.relief);}
 applyGlazeSurface(material,null,{before,cooling:record.settings.cooling});const mesh=new THREE.Mesh(geo,material);scene.add(mesh);renderer.render(scene,camera);
 const figure=document.createElement('figure');figure.innerHTML='<img alt="'+name+'"><figcaption>'+name+'</figcaption><p>'+copy+'</p>';figure.querySelector('img').src=renderer.domElement.toDataURL();document.querySelector('.grid').append(figure);scene.remove(mesh);for(const key of ['map','clearcoatMap','roughnessMap','bumpMap'])material[key]?.dispose();material.dispose();
 await new Promise(resolve=>requestAnimationFrame(resolve));
}
renderer.dispose();geo.dispose();document.querySelector('#status').remove();document.body.dataset.ready='true';
</script></html>`);
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await browser.newPage({viewport:{width:1900,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/qa-artifacts/reactive/review.html');await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:60000});assert.deepEqual(errors,[]);await page.screenshot({path:path.join(root,'docs/screenshots/reactive-families.png'),fullPage:true});console.log(JSON.stringify({sameLayers:true,sameProfile:true,sameLight:true,errors}));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
