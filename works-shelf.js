import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {shapedGeometry} from './vessel-geometry.js';
import {newProfile,normalizeProfile} from './vessel-profile.mjs';

const slots=Array.from({length:6},(_,i)=>({x:(i%3-1)*2.3,y:i<3?2.85:.65,z:0}));
const decode=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
function roundedBox(w,h,d,r=.025){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-r*2,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:r*.45,bevelThickness:r,curveSegments:8});g.translate(0,0,-d/2+r);g.computeVertexNormals();return g;
}
function woodTexture(){
  const c=Object.assign(document.createElement('canvas'),{width:1024,height:256}),ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);let seed=792131;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){seed=(seed*1664525+1013904223)>>>0;const grain=Math.sin(y*.48+Math.sin(x*.008)*1.8)*2.4+Math.sin(y*.085+Math.sin(x*.004))*.8+(seed/4294967296-.5)*2,i=(y*c.width+x)*4;pixels.data[i]=181+grain;pixels.data[i+1]=150+grain;pixels.data[i+2]=111+grain;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.22,.35);return texture;
}

export function mountWorksShelf({container,records,pending,onPlace,onPlaced,onOpen,assets}) {
  container.replaceChildren();container.classList.add('shelf-library');
  const stage=document.createElement('div');stage.className='shelf-stage';stage.setAttribute('aria-label','两层木质作品展示架');
  const labels=document.createElement('div');labels.className='shelf-labels';stage.append(labels);
  const toolbar=document.createElement('div');toolbar.className='shelf-toolbar';
  toolbar.innerHTML='<p class="shelf-instruction"></p><div class="shelf-pagination"><button aria-label="上一组架位">←</button><span></span><button aria-label="下一组架位">→</button></div><button class="primary shelf-place" hidden>放在这个架位 →</button>';
  container.append(stage,toolbar);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.prepend(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);scene.background=new THREE.Color('#e8e1d5');scene.fog=new THREE.Fog('#e8e1d5',17,30);
  const room=new RoomEnvironment(renderer),pmrem=new THREE.PMREMGenerator(renderer),probe=pmrem.fromScene(room,.05);room.dispose();pmrem.dispose();scene.environment=probe.texture;
  const wood=new THREE.MeshStandardMaterial({map:woodTexture(),color:'#dbbc93',roughness:.48}),rack=new THREE.Group();scene.add(rack);
  const board=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(roundedBox(w,h,d),wood);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;rack.add(m);};
  for(const y of [2.76,.56]){board(7.35,.18,1.65,0,y,0);board(7.12,.08,.06,0,y+.13,-.77);}
  for(const x of [-3.42,3.42])for(const z of [-.59,.59])board(.12,4.4,.12,x,2.18,z);
  board(6.94,.075,.075,0,4.37,-.59);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({color:'#7b5735',opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
  const sun=new THREE.DirectionalLight('#fff2d9',2.5);sun.position.set(-5,8,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.012;sun.shadow.radius=3;Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-4,near:.1,far:24});scene.add(sun);
  const fill=new THREE.RectAreaLight('#edf3fb',2.0,4,5);fill.position.set(5,4,4);fill.lookAt(0,2,0);scene.add(fill);scene.add(new THREE.HemisphereLight('#f9f4e8','#8e7250',.5));
  let page=0,selected=pending?.slot??0,disposed=false,generation=0,placing=false,pieces=new THREE.Group();
  scene.add(pieces);const assigned=new Map();
  const sorted=[...records].sort((a,b)=>Number(!!a.example)-Number(!!b.example)||a.updated-b.updated);for(const record of sorted){let slot=Number.isInteger(record.slot)&&record.slot>=0?record.slot:0;while(assigned.has(slot))slot++;assigned.set(slot,record);}
  if(pending){if(assigned.has(selected)&&assigned.get(selected).id!==pending.id){selected=0;while(assigned.has(selected))selected++;}page=Math.floor(selected/6);}
  const countPages=()=>Math.max(1,page+1,Math.ceil((Math.max(-1,...assigned.keys(),pending?selected:-1)+1)/6));
  const cleanPieces=()=>{pieces.traverse(n=>{n.geometry?.dispose();if(n.material){n.material.map?.dispose();n.material.clearcoatMap?.dispose();n.material.roughnessMap?.dispose();n.material.bumpMap?.dispose();n.material.dispose();}});pieces.clear();};
  async function addPiece(record,index,ghost=false){
    const token=generation,p=record.settings?.shape?normalizeProfile(record.settings.shape):null;
    const geometry=p?shapedGeometry(p,64,48):record.settings?.form==='jar'&&assets?assets.jar.clone():shapedGeometry(newProfile(record.settings?.form||'jar','round'),64,48);
    const c=Object.assign(document.createElement('canvas'),{width:512,height:512}),ctx=c.getContext('2d');
    try{if(record.layers.fired)ctx.drawImage(await decode(record.layers.fired),0,0,512,512);else for(const key of ['base','glaze','wet'])if(record.layers[key])ctx.drawImage(await decode(record.layers[key]),0,0,512,512);}catch{ctx.fillStyle='#ddd3bd';ctx.fillRect(0,0,512,512);}
    if(disposed||token!==generation){geometry.dispose();return;}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.MeshPhysicalMaterial({map:texture,roughness:record.settings?.glazeFinish==='satin'?.45:.22,clearcoat:.8,clearcoatRoughness:.09,vertexColors:!!p,transparent:ghost,opacity:ghost?.65:1});
    if(record.layers.coat){try{const mask=new THREE.Texture(await decode(record.layers.coat));mask.needsUpdate=true;mat.clearcoatMap=mask;}catch{}}
    if(record.layers.roughness){try{const map=new THREE.Texture(await decode(record.layers.roughness));map.needsUpdate=true;mat.roughnessMap=map;mat.roughness=record.settings?.cooling==='快冷'?.96:1;}catch{}}
    if(record.layers.relief){try{const map=new THREE.Texture(await decode(record.layers.relief));map.needsUpdate=true;mat.bumpMap=map;mat.bumpScale=({gloss:.022,satin:.014,speckle:.019,crackle:.012})[record.settings?.glazeFinish]||.022;}catch{}}
    if(disposed||token!==generation){geometry.dispose();texture.dispose();mat.clearcoatMap?.dispose();mat.roughnessMap?.dispose();mat.bumpMap?.dispose();mat.dispose();return;}
    const mesh=new THREE.Mesh(geometry,mat);geometry.computeBoundingBox();const bounds=geometry.boundingBox,dim=bounds.getSize(new THREE.Vector3()),scale=Math.min(1.65/dim.y,1.6/Math.max(dim.x,dim.z)),pos=slots[index];
    mesh.scale.setScalar(scale);mesh.position.set(pos.x,pos.y-bounds.min.y*scale,pos.z);mesh.rotation.y=record.rotation||0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={record,slot:page*6+index};pieces.add(mesh);render();return mesh;
  }
  function choose(slot){if(placing)return;selected=slot;build();}
  function build(){
    generation++;cleanPieces();labels.replaceChildren();const total=countPages();toolbar.querySelector('.shelf-pagination span').textContent=`${page+1} / ${total}`;
    const prev=toolbar.querySelector('[aria-label="上一组架位"]'),next=toolbar.querySelector('[aria-label="下一组架位"]');prev.disabled=page===0;next.disabled=page>=total-1&&!pending;
    toolbar.querySelector('.shelf-instruction').textContent=pending?'选一个空架位，安放刚刚出窑的作品。':'点击架上的器物，取出观察、换场景拍照。';
    const place=toolbar.querySelector('.shelf-place');place.hidden=!pending;place.disabled=assigned.has(selected)&&assigned.get(selected).id!==pending?.id;
    for(let i=0;i<6;i++){
      const slot=page*6+i,record=assigned.get(slot),button=document.createElement('button');button.className='shelf-slot'+(record?' collection-item':'');button.dataset.slot=slot;button.dataset.example=String(!!record?.example);
      const name=document.createElement('strong');name.textContent=record?.name||`架位 ${String(slot+1).padStart(2,'0')}`;const info=document.createElement('small');info.textContent=record?.example?'示例 · 可以取出观察':record?`${record.settings.object} · ${new Date(record.updated).toLocaleDateString('zh-CN')}`:pending?'可以放在这里':'等待一件心意';button.append(name,info);button.setAttribute('aria-pressed',String(pending&&selected===slot));button.title=record?.name||name.textContent;button.setAttribute('aria-label',record?`取出${record.name}，架位${slot+1}`:`选择架位${slot+1}`);
      button.disabled=!!pending&&!!record&&record.id!==pending.id;button.onclick=()=>pending?choose(slot):record&&onOpen(record);labels.append(button);
      if(record&&record.id!==pending?.id)addPiece(record,i);
      if(pending&&selected===slot)addPiece(pending,i,true);
    }
    render();
  }
  toolbar.querySelector('[aria-label="上一组架位"]').onclick=()=>{page=Math.max(0,page-1);build();};
  toolbar.querySelector('[aria-label="下一组架位"]').onclick=()=>{page++;build();};
  toolbar.querySelector('.shelf-place').onclick=async()=>{
    if(placing||!pending)return;placing=true;const button=toolbar.querySelector('.shelf-place');button.disabled=true;toolbar.querySelectorAll('button').forEach(b=>b.disabled=true);labels.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const record={...pending,slot:selected};await onPlace(record);if(disposed)return;let mesh=pieces.children.find(m=>m.userData.record.id===record.id);if(!mesh)mesh=await addPiece(record,selected%6,true);if(disposed)return;container.dataset.placing='true';toolbar.querySelector('.shelf-instruction').textContent='轻轻安放，留住这一次窑火。';
      if(mesh){const end=mesh.position.clone(),start=end.clone().add(new THREE.Vector3(.5,.65,1.7)),time=performance.now(),duration=matchMedia('(prefers-reduced-motion:reduce)').matches?1:1300;await new Promise(resolve=>{const tick=now=>{if(disposed){resolve();return;}const t=Math.min(1,(now-time)/duration),ease=t*t*(3-2*t);mesh.position.copy(start).lerp(end,ease);mesh.material.opacity=.65+.35*t;render();if(t<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});}
      if(disposed)return;container.dataset.placing='false';assigned.set(selected,record);pending=null;placing=false;build();onPlaced?.(record);
    }catch(error){console.error(error);placing=false;container.dataset.placing='false';build();toolbar.querySelector('.shelf-instruction').textContent='保存失败，请重试或下载作品卡留念。';}
  };
  function render(){if(disposed)return;renderer.render(scene,camera);for(let i=0;i<labels.children.length;i++){const pos=slots[i],v=new THREE.Vector3(pos.x,pos.y-.13,.87).project(camera),button=labels.children[i];button.style.left=(v.x+1)*50+'%';button.style.top=(1-v.y)*50+'%';}}
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;const d=Math.max(10.3,8.5/(2*Math.tan(THREE.MathUtils.degToRad(16))*camera.aspect));camera.position.set(1.3,2.5+d*.12,d);camera.lookAt(0,2.1,0);camera.updateProjectionMatrix();render();}
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();build();
  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();renderer.domElement.addEventListener('click',e=>{const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(pieces.children)[0];if(hit){if(pending)choose(hit.object.userData.slot);else onOpen(hit.object.userData.record);}});
  return {dispose(){disposed=true;generation++;observer.disconnect();cleanPieces();rack.traverse(n=>n.geometry?.dispose());wood.map.dispose();wood.dispose();floor.geometry.dispose();floor.material.dispose();sun.shadow.map?.dispose();probe.dispose();renderer.dispose();renderer.forceContextLoss();container.replaceChildren();}};
}
