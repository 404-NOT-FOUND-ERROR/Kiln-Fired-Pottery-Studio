import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
import {shapedGeometry,legacyVesselProfile} from './vessel-geometry.js';
import {applyFiredGlaze} from './glaze-surface.mjs';

const cache=new Map();
let jarPromise;
async function originalJar(){
 if(!jarPromise)jarPromise=(async()=>{
  const base=new URL('./assets/museum/',import.meta.url),response=await fetch(new URL('manifest.json',base));
  if(!response.ok)throw new Error('器形无法读取');const {jar}=await response.json();
  const dataResponse=await fetch(new URL(jar.file,base));if(!dataResponse.ok)throw new Error('器形无法读取');
  const data=await dataResponse.arrayBuffer();if(data.byteLength!==jar.bytes)throw new Error('器形数据不完整');
  const geo=new THREE.BufferGeometry(),buffer=new THREE.InterleavedBuffer(new Float32Array(data,0,jar.vertices*8),8);
  geo.setAttribute('position',new THREE.InterleavedBufferAttribute(buffer,3,0));geo.setAttribute('normal',new THREE.InterleavedBufferAttribute(buffer,3,3));geo.setAttribute('uv',new THREE.InterleavedBufferAttribute(buffer,2,6));geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data,jar.vertices*32,jar.indices),1));return geo;
 })().catch(error=>{jarPromise=null;throw error;});
 return (await jarPromise).clone();
}
function legacyGeometry(form){
 const points=new THREE.SplineCurve(legacyVesselProfile(form).map(p=>new THREE.Vector2(...p))).getPoints(128),geo=new THREE.LatheGeometry(points,192),uv=geo.getAttribute('uv'),lengths=[0];
 for(let j=1;j<points.length;j++)lengths[j]=lengths[j-1]+points[j].distanceTo(points[j-1]);
 for(let i=0;i<=192;i++)for(let j=0;j<points.length;j++)uv.setXY(i*points.length+j,i/192,lengths[j]/lengths.at(-1));return geo;
}
// A temporary, transparent object render. No room, floor, cabinet or photo plate.
export async function prepareCollectionThumbnails(records){
 const pending=records.filter(record=>{
  if(record.thumbnailStyle==='vessel-cutout-v1')return false;
  const thumbnail=cache.get(record.id+':'+record.updated);
  if(thumbnail){record.thumbnail=thumbnail;record.thumbnailStyle='vessel-cutout-v1';return false;}
  return true;
 });
 if(!pending.length)return records;
 RectAreaLightUniformsLib.init();
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(440,440,false);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100),pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(renderer),probe=pmrem.fromScene(room,.045);scene.environment=probe.texture;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight('#fff9ec','#a38c72',.55));
 for(const [x,y,z,width,height,power,color] of [[-3.6,4.8,4.8,4.8,6.2,1.82,'#fff7e8'],[3.8,2.4,3.2,3.4,5.2,1.17,'#f1f5f1'],[.8,4.8,-3.4,3.2,3.2,.82,'#ffe5ce']]){const light=new THREE.RectAreaLight(color,power,width,height);light.position.set(x,y,z);light.lookAt(0,1.3,0);scene.add(light);}
 const loader=new THREE.TextureLoader();
 try{for(const record of pending){
  const cacheKey=record.id+':'+record.updated;if(cache.has(cacheKey)){record.thumbnail=cache.get(cacheKey);record.thumbnailStyle='vessel-cutout-v1';continue;}
  const s=record.settings,textures=[];let geo,material,mesh;
  try{
   geo=s.shape&&!s.specimen?shapedGeometry(s.shape):s.form==='jar'?await originalJar():legacyGeometry(s.form);
   const maps={};await Promise.all([['fired','map',true],['coat','clearcoatMap'],['roughness','roughnessMap'],['relief','bumpMap']].map(async([key,name,color])=>{if(!record.layers[key])return;const texture=await loader.loadAsync(record.layers[key]);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;textures.push(texture);maps[name]=texture;}));
   material=new THREE.MeshPhysicalMaterial({...maps,color:'#ffffff',vertexColors:!!geo.getAttribute('color'),side:THREE.DoubleSide});applyFiredGlaze(material,s.glazeFinish);
   geo.computeBoundingBox();const box=geo.boundingBox,height=box.max.y-box.min.y,width=Math.max(box.max.x-box.min.x,box.max.z-box.min.z);mesh=new THREE.Mesh(geo,material);mesh.position.y=-box.min.y;mesh.rotation.y=Number.isFinite(record.rotation)?record.rotation:0;scene.add(mesh);
   const target=new THREE.Vector3(0,height*.48,0),distance=Math.max(height,width)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.18;camera.position.set(distance*.06,target.y+distance*.16,distance);camera.lookAt(target);renderer.render(scene,camera);
   record.thumbnail=renderer.domElement.toDataURL('image/png');record.thumbnailStyle='vessel-cutout-v1';cache.set(cacheKey,record.thumbnail);
  }finally{mesh?.removeFromParent();geo?.dispose();material?.dispose();for(const texture of textures)texture.dispose();}
 }}finally{probe.dispose();renderer.dispose();renderer.forceContextLoss();}
 return records;
}
