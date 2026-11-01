import * as THREE from 'three';
import { MuseumStage } from './museum-stage.js';
import { applyGlazeSurface } from './museum-assets.js';
import {mountCollectionList} from './collection-list.js';
import {prepareCollectionThumbnails} from './collection-thumbnail.js';
import {assetURL} from './asset-url.js';
import {ObservationStage} from './observation-stage.js';
import {artworkCard} from './artwork-card.js';
import {mountArtworkPreview} from './artwork-preview.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const scenes = {
  museum: { title: '01 / 藏品 · THE GALLERY', note: '让一束光，认真看见你的作品。', top: '#101f1a', bottom: '#354b38', ink: '#e2e7d5', label: '藏品' },
  living: { title: '02 / 窗边 · A QUIET AFTERNOON', note: '一方窗光，给日常添一件喜欢。', top: '#d3d8c3', bottom: '#f0e6cb', ink: '#37291b', label: '窗边' },
  art: { title: '03 / 色场 · BETWEEN EARTH & FIRE', note: '土与火之间，让平凡的泥有了诗意的颜色。', top: '#112431', bottom: '#b0784b', ink: '#e4d7b9', label: '色场' },
  neutral: { title: '05 / 观釉', note: '看见釉的光泽。', top: '#e3ded4', bottom: '#f0ebe1', ink: '#6f5d48', label: '观釉' }
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const imageFrom = src => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = assetURL(src); });
const processName = fire => ({ '氧化焰': '氧化气氛', '还原焰': '还原气氛', '柴烧': '柴烧预设' }[fire] || fire);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dongleya-pottery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pieces', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storage(action, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pieces', action === 'put' ? 'readwrite' : 'readonly');
    const request = tx.objectStore('pieces')[action](...(value === undefined ? [] : [value]));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('保存已取消')); };
  });
}

export function createExhibition({ toast, onLoad, onNew, assets = null, livingAssets = null, artAssets = null, initialScene = 'neutral', ensureAssets }) {
  let current, world, decor, sceneKey = 'neutral', panel = 'result', observed = 'after', cameraKey = 'full', format = 'portrait';
  let compareMode='fire',split=.5;const comparisonMaterials=new Map();
  let alternate, busy = false, activeRecord = null, libraryTrigger, museum, living, art, activeStage, shelf;
  let sceneRequest=0, saved=false;
  let observation,lightMode='soft',lightDirection=-25,detailOpen=true,selectedFinding='color',detailTimer;
  let dragMode='camera',objectPointer=null,photoCameraKey='full';const scenePoses=new Map();
  let cardVersion=0;
  mountArtworkPreview({
    host:$('#photoPanel'),render:width=>pieceCard(width),
    active:()=>Boolean(world&&panel==='photo'&&$('#screen3').classList.contains('active')),
    key:()=>{
      const scene=$('#resultView').dataset.scene;
      if(scene!==sceneKey)return null;
      const numbers=[...world.camera.position.toArray(),...world.camera.quaternion.toArray(),...world.controls.target.toArray(),...world.mesh.rotation.toArray().slice(0,3),world.camera.fov];
      return [cardVersion,title(),format,scene,lightMode,lightDirection,...numbers.map(n=>n.toFixed(5))].join('|');
    },
    onDownload:()=>$('#exportPhoto').click(),
    pause:()=>{
      const control=activeStage?.active?activeStage:world.controls,rotation=control.autoRotate;
      control.autoRotate=false;return ()=>{control.autoRotate=rotation;};
    }
  });
  const livingMetadata=$('#pieceSummary');
  const heading=document.createElement('header');heading.className='observation-heading';heading.append($('#resultStatus'),$('#resultHeading'));$('.exhibit-panel').prepend(heading);
  const comparison=document.createElement('div');comparison.className='comparison-overlay';comparison.hidden=true;comparison.innerHTML='<span class="compare-label left">烧前</span><span class="compare-label right">烧后</span><div class="compare-divider"><span aria-hidden="true">‹ ›</span></div><p class="compare-caption">拖动分界线，对照同一处。</p>';$('#resultView').append(comparison);
  const compareControls=document.createElement('div');compareControls.className='comparison-control';compareControls.innerHTML='<div class="compare-mode" role="group" aria-label="对照内容"><button data-compare="fire" aria-pressed="true">烧前 / 烧后</button><button data-compare="cooling" aria-pressed="false">冷却对照</button></div>';$('#comparisonModes').append(compareControls);
  const comparePosition=$('#comparisonPosition');comparePosition.innerHTML='<label for="compareSplit">拖动分界线，对照同一处。</label><input id="compareSplit" type="range" min="5" max="95" value="50" aria-label="烧前烧后对比分界位置">';
  const detailCard=document.createElement('aside');detailCard.id='glazeDetailCard';detailCard.className='glaze-detail-card';detailCard.setAttribute('aria-label','釉面细节');detailCard.innerHTML='<header><h3 id="glazeDetailTitle">釉面细节</h3><button id="closeGlazeDetail" aria-label="收起釉面细节">×</button></header><p id="glazeDetailCopy"></p><div class="glaze-detail-samples"><figure><canvas id="glazeDetailBefore" width="320" height="200"></canvas><figcaption id="glazeBeforeCaption">烧前</figcaption></figure><figure><canvas id="glazeDetailAfter" width="320" height="200"></canvas><figcaption id="glazeAfterCaption">烧后</figcaption></figure></div>';$('.exhibit-main').append(detailCard);
  const processNav=document.createElement('div');processNav.className='observation-progress';processNav.innerHTML='<span>起点</span><i>·</i><span>塑形</span><i>·</i><span>装饰</span><i>·</i><span>烧成</span><i>·</i><b>成品</b>';$('.exhibit-main').append(processNav);
  const zoom=document.createElement('label');zoom.className='observation-zoom';zoom.innerHTML='<span>缩放</span><input id="observationZoom" type="range" min="75" max="165" value="100" aria-label="观察缩放">';$('.camera-bar').append(zoom);
  const photoAction=document.createElement('button');photoAction.id='inspectGoPhoto';photoAction.className='exhibit-secondary';photoAction.innerHTML='去拍照 <span>→</span>';photoAction.onclick=()=>setPanel('photo');$('.result-actions').insertBefore(photoAction,$('#storageNote'));
  function updateCompare(){comparison.hidden=panel!=='learn'||compareMode==='single';
   comparison.querySelector('.compare-divider').style.left=split*100+'%';comparison.querySelector('.compare-label.left').textContent=compareMode==='cooling'?'本次 · '+current?.settings.cooling:'烧前';comparison.querySelector('.compare-label.right').textContent=compareMode==='cooling'?'对照 · '+(current?.settings.cooling==='缓冷'?'快冷':'缓冷'):'烧后';
   compareControls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compare===compareMode)));$('#compareSplit').value=Math.round(split*100);$('#compareSplit').disabled=compareMode==='single';
   if(current){
    $('#glazeBeforeCaption').textContent=compareMode==='cooling'?current.settings.cooling:compareMode==='single'?'当前釉面':'烧前 · 粉感';
    $('#glazeAfterCaption').textContent=compareMode==='cooling'?(current.settings.cooling==='缓冷'?'快冷':'缓冷'):compareMode==='single'?'同一处细节':'烧后 · 润泽';
   }
   comparePosition.hidden=compareMode==='single';scheduleDetails();
  }
  function comparisonMaterial(value){if(comparisonMaterials.has(value))return comparisonMaterials.get(value);const original=world.mesh.material,m=new THREE.MeshPhysicalMaterial({color:original.color,vertexColors:original.vertexColors,side:original.side,metalness:0,ior:1.47});
   for(const key of ['handmade','finish','clearGlaze','clayBump','reliefScale'])m.userData[key]=original.userData[key];world.mesh.material=m;try{applyObserved(value);}finally{world.mesh.material=original;}comparisonMaterials.set(value,m);return m;
  }
  function surfaceDescription(){return {gloss:'厚处聚色，薄处透光。',satin:'柔光里，细看晶花。',speckle:'深浅之间，铁斑浮现。',crackle:'细密开片，留在釉中。'}[current?.settings.glazeFinish]||'转动器物，细看釉色。';}
  function findingDescription(key){
    const finish=current?.settings.glazeFinish||'gloss';
    if(compareMode==='cooling')return {color:'同样的落笔，不同的色晕。',shine:'移动视角，对照光泽。',texture:({gloss:'对照釉色流动的边界。',satin:'对照晶花的疏密。',speckle:'对照铁斑的深浅。',crackle:'对照开片的细密。'})[finish]}[key];
    return {color:'颜色在窑火里聚出深浅。',shine:'从粉感，到釉面的润泽。',texture:({gloss:'细看流釉留下的边界。',satin:'细看釉中的晶花。',speckle:'细看散落的铁斑。',crackle:'细看交织的开片。'})[finish]}[key];
  }
  function scheduleDetails(){clearTimeout(detailTimer);if(world&&observation?.active&&panel!=='photo')detailTimer=setTimeout(refreshDetails,180);}
  function refreshDetails(){
    if(!observation?.active||panel==='photo'||!world.element.getClientRects().length)return;
    const finish=current.settings.glazeFinish||'gloss';
    $('#glazeSurfaceNote').textContent=surfaceDescription();
    $('#findingColorNote').textContent=compareMode==='cooling'?'同色，另一种色晕':'看见颜色的聚集';
    $('#findingShineNote').textContent='从粉感到润泽';
    $('#findingTextureNote').textContent=({gloss:'细看流釉的边界',satin:'细看晶花的疏密',speckle:'细看铁斑的深浅',crackle:'细看交织的开片'})[finish];
    detailCard.hidden=!detailOpen;detailCard.dataset.mode=panel;$('#openGlazeDetail').setAttribute('aria-expanded',String(detailOpen));
    const patches={color:{x:.48,y:.54},shine:{x:.34,y:.38},texture:{x:.62,y:.59}},after=comparisonMaterial(observed);
    if(panel==='result'){
      observation.detail($('#glazeNoteSample'),after,patches.color);
      $('#glazeDetailTitle').textContent='釉面细节';$('#glazeDetailCopy').textContent=surfaceDescription();
      if(detailOpen)observation.detail($('#glazeDetailAfter'),after,patches.color);
    }else{
      const left=compareMode==='single'?observed:compareMode==='cooling'?'after':'before',right=compareMode==='single'?observed:compareMode==='cooling'?'alternate':'after';
      for(const button of $$('[data-glaze-finding]')){
        const c=button.querySelector('canvas'),a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=240;a.height=b.height=150;
        observation.detail(a,comparisonMaterial(left),patches[button.dataset.glazeFinding]);observation.detail(b,comparisonMaterial(right),patches[button.dataset.glazeFinding]);
        const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(a,0,0,240,150,0,0,c.width/2,c.height);ctx.drawImage(b,0,0,240,150,c.width/2,0,c.width/2,c.height);ctx.fillStyle='#fff9';ctx.fillRect(c.width/2,0,1,c.height);
        button.setAttribute('aria-pressed',String(button.dataset.glazeFinding===selectedFinding));
      }
      $('#glazeDetailTitle').textContent={color:'颜色的变化',shine:'光泽的变化',texture:'纹理的变化'}[selectedFinding];$('#glazeDetailCopy').textContent=findingDescription(selectedFinding);

      if(detailOpen){observation.detail($('#glazeDetailBefore'),comparisonMaterial(left),patches[selectedFinding]);observation.detail($('#glazeDetailAfter'),comparisonMaterial(right),patches[selectedFinding]);}
    }
  }
  function renderComparison(){const r=world.renderer,size=r.getSize(new THREE.Vector2()),cut=Math.round(size.x*split),left=compareMode==='cooling'?'after':'before',right=compareMode==='cooling'?'alternate':'after';if(compareMode==='single'){r.render(world.scene,world.camera);return;}const original=world.mesh.material,first=comparisonMaterial(left),second=comparisonMaterial(right);
   r.setScissorTest(true);try{world.mesh.material=first;r.setScissor(0,0,cut,size.y);r.render(world.scene,world.camera);world.mesh.material=second;r.setScissor(cut,0,size.x-cut,size.y);r.render(world.scene,world.camera);}finally{r.setScissorTest(false);world.mesh.material=original;}
  }
  $('#compareSplit').oninput=e=>{split=Number(e.target.value)/100;updateCompare();};compareControls.querySelectorAll('button').forEach(b=>b.onclick=()=>{compareMode=b.dataset.compare;setObserved('after');updateCompare();});
  let dividerDrag=null;$('#resultView').addEventListener('pointerdown',e=>{if(panel!=='learn'||compareMode==='single'||e.button!==0)return;const rect=$('#resultView').getBoundingClientRect();if(Math.abs(e.clientX-rect.left-rect.width*split)>26)return;dividerDrag=e.pointerId;world.controls.enabled=false;e.target.setPointerCapture(e.pointerId);},true);
  // This is a custom surface gesture. Prevent the browser from treating its
  // release as a fling and consuming the next tap to stop that fling.
  $('#resultView').addEventListener('touchstart',e=>{if(dividerDrag!==null)e.preventDefault();},{passive:false});
  $('#resultView').addEventListener('pointermove',e=>{if(e.pointerId!==dividerDrag)return;const rect=$('#resultView').getBoundingClientRect();split=THREE.MathUtils.clamp((e.clientX-rect.left)/rect.width,.05,.95);updateCompare();},true);
  function releaseDivider(e){if(e.pointerId!==dividerDrag)return;dividerDrag=null;if(e.target.hasPointerCapture?.(e.pointerId))e.target.releasePointerCapture(e.pointerId);if(world)world.controls.enabled=true;}$('#resultView').addEventListener('pointerup',releaseDivider,true);$('#resultView').addEventListener('pointercancel',releaseDivider,true);
  const backgrounds = new Map();
  const dialog = document.createElement('dialog');
  dialog.className = 'collection-dialog';
  dialog.setAttribute('aria-labelledby', 'collectionTitle');
  dialog.innerHTML = '<div class="collection-header"><h2 id="collectionTitle">我的作品</h2><button aria-label="关闭作品列">×</button></div><p>你的每一件作品，都在这里。</p><div class="collection-grid"></div>';
  document.body.append(dialog);
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => {shelf?.dispose();shelf=null;(libraryTrigger?.getClientRects().length?libraryTrigger:$('#resultHeading'))?.focus({preventScroll:true});});

  function background(key) {
    if (backgrounds.has(key)) return backgrounds.get(key);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'), s = scenes[key];
    const g = ctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, s.top); g.addColorStop(1, s.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    const glow = ctx.createRadialGradient(215, 230, 15, 250, 300, 360);
    glow.addColorStop(0, key === 'museum' ? '#aab78225' : '#ffffed45'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    backgrounds.set(key, texture); return texture;
  }
  function clearDecor() {
    if (!decor) return;
    world.scene.remove(decor);
    decor.traverse(node => { node.geometry?.dispose(); if (node.material) { node.material.map?.dispose(); node.material.dispose(); } });
  }
  function ensureStages(){
    if(!world)return;
    if(assets&&!museum)museum=new MuseumStage(world,assets);
    if(livingAssets&&!living)living=new MuseumStage(world,livingAssets);
    if(artAssets&&!art)art=new MuseumStage(world,artAssets);
  }
  async function selectScene(key){
    const request=++sceneRequest, piece=current;
    sceneKey=key;
    $$('.scene-picker button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===key)));
    const status=$('#photoSceneStatus');status.textContent='';
    if(key==='neutral'){setScene('neutral');return;}
    status.textContent='正在准备'+scenes[key].label+'光影…';
    try{
      await ensureAssets(key);
      if(request!==sceneRequest||panel!=='photo'||piece!==current)return;
      ensureStages();setScene(key);status.textContent='';
    }catch(error){
      if(request!==sceneRequest||panel!=='photo'||piece!==current)return;
      console.warn('Photo background unavailable',error);sceneKey='neutral';setScene('neutral');
      $$('.scene-picker button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene==='neutral')));
      status.textContent='这个背景暂时无法加载，仍可使用纯色背景拍照。';
    }
  }
  function setScene(key, resetCamera = false) {
    if (!world) return;
    $('#app').dataset.exhibitionTheme=key;document.body.dataset.exhibitionTheme=key;
    const calibrated = key==='museum'?museum:key==='living'?living:key==='art'?art:null;
    if(activeStage!==calibrated){if(activeStage?.active)scenePoses.set($('#resultView').dataset.scene,{camera:cameraKey,...activeStage.pose()});activeStage?.leave();world.controls.autoRotate=false;$('#autoRotate').setAttribute('aria-pressed','false');}
    if(key!=='neutral')observation?.leave();
    activeStage=calibrated;
    // Restore the original painted layers and common ceramic surface when
    // leaving a photographic specimen treatment or entering the observation room.
    setObserved(observed);
    $('#app').classList.toggle('museum-mode', Boolean(calibrated)&&key==='museum');
    $('#app').classList.toggle('living-mode', Boolean(calibrated)&&key==='living');
    $('#app').classList.toggle('art-mode', Boolean(calibrated)&&key==='art');
    if (calibrated) {
      clearDecor();decor=null;
      $('#resultView').dataset.scene=key;$('#sceneCaption').textContent=scenes[key].title;
      $('#sceneNote').textContent=scenes[key].note;
      calibrated.enter();
      if(key==='art'&&current.settings.specimen&&observed==='after'&&artAssets?.glaze){
        const material=world.mesh.material,glaze=artAssets.glaze;
        material.map=glaze.specimen;material.normalMap=glaze.normal;material.normalScale.set(.33,.33);
        material.roughnessMap=glaze.roughness;material.roughness=.75;
        material.clearcoat=.76;material.clearcoatRoughness=.065;material.needsUpdate=true;
      }
      calibrated.setView(cameraKey);
      calibrated.interaction=dragMode;const pose=scenePoses.get(key);if(pose?.camera===cameraKey)calibrated.restorePose(pose);
      updateDragHint();
      return;
    }
    const s = scenes[key]; world.scene.background = background(key); clearDecor();decor=null;
    $('#resultView').dataset.scene = key; $('#sceneCaption').textContent = s.title; $('#sceneNote').textContent = s.note;
    if(key==='neutral'){
      observation.enter();observation.prepareMaterial(world.mesh.material,observed==='before');setCamera(cameraKey);updateDragHint();scheduleDetails();return;
    }
    const lights = world.exhibitLights;
    lights.forEach(({ light, intensity, color }) => { light.intensity = intensity * .5; light.color.copy(color); });
    world.scene.fog = null;
    if (key === 'museum') {
      lights.forEach(({ light }) => { light.intensity *= light.isHemisphereLight ? .3 : .85; });
      world.renderer.toneMappingExposure = .78;
    } else if (key === 'living') {
      lights.forEach(({ light }) => { if (light.isRectAreaLight) light.color.set('#fff5dd'); });
      world.renderer.toneMappingExposure = .84;
    } else { world.renderer.toneMappingExposure = key === 'neutral' ? .86 : .82; }
    world.mesh.position.y = 0;
    if (resetCamera || assets) setCamera(cameraKey);
    updateDragHint();
  }
  function setCamera(key) {
    if (!world) return;
    cameraKey = key;
    if(panel==='photo')photoCameraKey=key;
    if (activeStage?.active) {
      activeStage.setView(key);
      scenePoses.delete($('#resultView').dataset.scene);
      $$('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===key)));
      return;
    }
    const viewport=world.renderer.getSize(new THREE.Vector2());
    world.camera.clearViewOffset();world.camera.fov=31;world.camera.aspect=viewport.x/viewport.y;world.camera.updateProjectionMatrix();
    const size = new THREE.Box3().setFromObject(world.mesh).getSize(new THREE.Vector3());
    const aspect = Math.max(.35, world.camera.aspect);
    const fov = THREE.MathUtils.degToRad(world.camera.fov);
    const height = Math.max(size.y, 1.2), width = Math.max(size.x, 2.8);
    const distance = Math.max((height+.3) / (2 * Math.tan(fov / 2)*.72), width / (2 * Math.tan(fov / 2) * aspect*(viewport.x>900?.57:.88)))*1.12;
    const box=new THREE.Box3().setFromObject(world.mesh),target = new THREE.Vector3(0, box.min.y + size.y * .42, 0);
    if (key === 'detail') { target.y = box.min.y + size.y * .58; world.camera.position.set(distance * .12, target.y + .12, distance * .51); }
    else if (key === 'above') world.camera.position.set(distance * .16, target.y + distance * .65, distance * .72);
    else world.camera.position.set(distance * .05, target.y + distance * .25, distance);
    world.controls.target.copy(target); world.controls.minDistance = Math.max(.7, distance * .32); world.controls.maxDistance = distance * 2;
    world.controls.minPolarAngle = .12; world.controls.maxPolarAngle = Math.PI * .52; world.controls.update();
    // Leave the right side free for the same action panel used by the photo stages.
    if(viewport.x>900)world.camera.setViewOffset(viewport.x,viewport.y,viewport.x*.14,0,viewport.x,viewport.y);
    world.observationDistance=world.camera.position.distanceTo(world.controls.target);$('#observationZoom').value='100';observation?.updateBackdrop();

    $$('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.camera === key)));
    $$('[data-inspect-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.inspectCamera===key)));scheduleDetails();
  }
  function applyObserved(value) {
    if (!current) return;
    if (value === 'alternate' && !alternate) alternate = current.alternate();
    world.mesh.material.map = (value === 'before' ? current.before : value === 'alternate' ? alternate : current.after).texture;
    if(world.mesh.material.userData.handmade){
      const surface=value==='alternate'?alternate:current.after;
      world.mesh.material.roughnessMap=value==='before'?null:surface.roughnessMap;
      world.mesh.material.clearcoatMap=value==='before'?null:surface.coatMap;
      world.mesh.material.bumpMap=value==='before'?world.mesh.material.userData.clayBump:surface.reliefMap||world.mesh.material.userData.clayBump;
    }
    const cool = value === 'alternate' ? (current.settings.cooling === '缓冷' ? '快冷' : '缓冷') : current.settings.cooling;
    world.mesh.material.roughness = value === 'before' ? .88 : cool === '快冷' ? .17 : .25;
    world.mesh.material.clearcoat = value === 'before' ? 0 : .94;
    world.mesh.material.clearcoatRoughness = value === 'before' ? .35 : cool === '快冷' ? .08 : .14;
    world.mesh.material.envMapIntensity = value === 'before' ? .4 : .65;
    applyGlazeSurface(world.mesh.material, assets, { before:value==='before', specimen:current.settings.specimen, cooling:cool });
    observation?.prepareMaterial(world.mesh.material,value==='before');
    world.mesh.material.needsUpdate = true;
  }
  function setObserved(value){observed=value;applyObserved(value);
    const cool=current.settings.cooling==='缓冷'?'快冷':'缓冷';
    $('#viewBadge').textContent = value === 'before' ? '烧前釉层' : value === 'alternate' ? `对照 · ${cool}` : `烧后成品 · ${current.settings.cooling}`;
    $$('[data-observe]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.observe === value)));
  }
  function setPanel(value) {
    if(!world)return;
    if(panel==='photo')photoCameraKey=cameraKey;
    if(value==='photo')cameraKey=photoCameraKey;
    panel=value;sceneRequest++;document.body.dataset.panel=value;world.renderFrame=null;
    for(const key of ['result','photo','learn'])$('#'+key+'Panel').hidden=value!==key;
    $('#exportPhoto').hidden=value!=='photo';$('#exportComparison').hidden=value!=='learn';
    photoAction.hidden=value!=='result';
    $('#exportComparison').innerHTML='保存对照图 <span>↓</span>';
    detailCard.hidden=value==='photo'||!detailOpen;
    $('#resultStatus').textContent='05 / 成品';$('#resultHeading').textContent=value==='learn'?'同一件，看见变化':value==='result'?'看见釉的光泽':'留住这一件的光泽';
    $$('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===value)));
    setObserved('after');setScene('neutral');
    if(value==='learn'){
      world.controls.autoRotate=false;$('#autoRotate').setAttribute('aria-pressed','false');
      compareMode='fire';setCamera('full');world.camera.updateMatrixWorld();const center=new THREE.Box3().setFromObject(world.mesh).getCenter(new THREE.Vector3()).project(world.camera);split=THREE.MathUtils.clamp((center.x+1)/2,.05,.95);world.renderFrame=renderComparison;
      $('#sceneCaption').textContent='观察 / 同一视角 · 同一光照';
      $('#sceneNote').textContent='拖动分界线，比较同一处釉面。';
    }else{
      setCamera(cameraKey);if(value==='photo')selectScene(sceneKey);
    }
    updateCompare();world.resize();scheduleDetails();
  }
  function title() { return $('#pieceName').value.trim() || `${current.settings.glazeNames.join('·')} · ${current.settings.object}`; }

  function renderPhoto(width, height) {
    if (activeStage?.active) return activeStage.renderPhoto(width,height);
    const { renderer, camera, controls } = world;
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = camera.aspect;
    const position = camera.position.clone(), rotation = controls.autoRotate, view=camera.view?.enabled?{...camera.view}:null;
    const result = document.createElement('canvas'); result.width = width; result.height = height;
    try {
      controls.autoRotate = false;
      camera.clearViewOffset();
      // Maintain composition in narrow portrait exports without changing the user's view.
      const distance = position.distanceTo(controls.target);
      const scale = cameraKey === 'detail' ? 1 : Math.max(1, 3.25 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (width / height) * distance));
      camera.position.copy(controls.target).add(position.clone().sub(controls.target).multiplyScalar(scale));
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      observation?.updateBackdrop(width,height);
      renderer.render(world.scene, camera); result.getContext('2d').drawImage(renderer.domElement, 0, 0);
    } finally {
      camera.position.copy(position); camera.aspect = aspect; camera.updateProjectionMatrix();
      if(view)camera.setViewOffset(view.fullWidth,view.fullHeight,view.offsetX,view.offsetY,view.width,view.height);
      renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); controls.autoRotate = rotation;observation?.updateBackdrop();if(world.renderFrame)world.renderFrame();else renderer.render(world.scene, camera);
    }
    return result;
  }
  function drawText(ctx, value, x, y, maxWidth) {
    let str = value; while (str.length > 1 && ctx.measureText(str).width > maxWidth) str = str.slice(0, -1);
    ctx.fillText(str === value ? str : `${str.slice(0, -1)}…`, x, y);
  }
  function pieceCard(outputWidth=1200) {
    const displayScene=panel==='photo'?$('#resultView').dataset.scene:'neutral';
    return artworkCard({title:title(),settings:current.settings,scene:displayScene,format,mesh:world.mesh,renderPhoto,outputWidth});
  }
  function comparisonCard() {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1120; const ctx = canvas.getContext('2d');
    const savedObserved = observed, savedScene = $('#resultView').dataset.scene;
    const poses = { p: world.camera.position.clone(), t: world.controls.target.clone(), key: cameraKey };
    const other = current.settings.cooling === '缓冷' ? '快冷' : '缓冷';
    try {
      setScene('neutral'); setCamera('full');
      ctx.fillStyle = '#f5f3ec'; ctx.fillRect(0, 0, 1600, 1120);
      ctx.fillStyle = '#453b30'; ctx.font = '36px "Microsoft YaHei", sans-serif'; drawText(ctx, `${title()} / ${compareMode==='cooling'?'一次只改变冷却':'烧前与烧后'}`, 60, 78, 1480);
      setObserved(compareMode==='cooling'?'after':'before'); ctx.drawImage(renderPhoto(720, 750), 60, 130);
      setObserved(compareMode==='cooling'?'alternate':'after'); ctx.drawImage(renderPhoto(720, 750), 820, 130);
      ctx.font = '26px "Microsoft YaHei", sans-serif'; ctx.fillText(compareMode==='cooling'?`本次烧成 · ${current.settings.cooling}`:'烧前 · 哑光釉层', 60, 930); ctx.fillText(compareMode==='cooling'?`对照烧成 · ${other}`:`烧后 · ${current.settings.cooling}`, 820, 930);
      ctx.fillStyle = '#776b5a'; ctx.font = '21px "Microsoft YaHei", sans-serif'; ctx.fillText(compareMode==='cooling'?'同一器形、釉层和烧成预设，只改变冷却条件。':'同一器形、视角和中性光照，对照未烧釉层与烧后效果。',60,992);
      ctx.font = '18px "Microsoft YaHei", sans-serif'; ctx.fillText('本图为艺术化示意，不预测真实釉料结果；是否结晶取决于配方与温度曲线等条件。', 60, 1040);
      ctx.font = '15px sans-serif'; ctx.fillText('每一次动手，都离理解更近一点。', 60, 1080);
    } finally { setScene(savedScene); setObserved(savedObserved); world.camera.position.copy(poses.p); world.controls.target.copy(poses.t); cameraKey = poses.key; world.controls.update(); $$('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.camera === cameraKey))); }
    return canvas;
  }
  async function download(canvas, suffix) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('图片编码失败')), 'image/png'));
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${title().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}-${suffix}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function guarded(button, action, failure) {
    if (busy) return; busy = true; button.disabled = true;
    try { await action(); } catch (error) { console.error(error); toast(failure); } finally { busy = false; button.disabled = false; }
  }
  async function openCollection(event){
    libraryTrigger=event?.currentTarget||document.activeElement;
    const grid=dialog.querySelector('.collection-grid');shelf?.dispose();shelf=null;grid.replaceChildren();
    const message=document.createElement('p');message.className='collection-empty';message.textContent='正在打开作品列…';grid.append(message);if(!dialog.open)dialog.showModal();
    const examples=[['example-celadon','青岚流光','天青','museum','./assets/museum/specimen-albedo.webp'],['example-field','土火之间','紫斑','art','./assets/art/art-specimen.webp']].map(([id,name,glazeName,scene,fired])=>({id,name,example:true,updated:0,scene,rotation:0,camera:'full',thumbnail:scene==='art'?'./assets/example-art.webp':'./assets/example-museum.webp',settings:{form:'jar',object:'小罐',shape:null,specimen:true,glaze:'sky',glazeName,glazeNames:[glazeName],usedGlazes:['sky'],glazeFinish:'gloss',decoration:'glaze',clearGlaze:true,fire:'氧化焰',temp:'1240℃',cooling:'缓冷',firingVersion:2,kilnSeed:736513,painted:1},layers:{fired,glaze:'./assets/museum/specimen-paint.webp'}}));
    let records=[];
    try{records=(await storage('getAll')).sort((a,b)=>b.updated-a.updated);}
    catch(error){console.warn('Collection unavailable',error);dialog.querySelector(':scope > p').textContent='本地收藏暂时不可用。仍可打开示例，或下载当前作品卡。';}
    if(!dialog.open)return;
    const pieces=[...records,...examples];
    try{await prepareCollectionThumbnails(pieces);}catch(error){console.warn('Collection previews unavailable',error);message.textContent='缩略图暂时无法生成，仍可打开作品。';for(const piece of pieces)if(piece.thumbnailStyle!=='vessel-cutout-v1')piece.thumbnail=null;}
    if(!dialog.open)return;
    shelf=mountCollectionList({container:grid,records:pieces,currentId:activeRecord,onOpen:record=>openShelfPiece(record,'result')});
  }
  function openShelfPiece(record,mode){return guarded($('#openCollection'),async()=>{
          const images={};for(const [key,src] of Object.entries(record.layers))if(src)images[key]=await imageFrom(src);
          await onLoad(record,images);setPanel(mode);dialog.close();$('#resultHeading').focus({preventScroll:true});toast(record.example?'已打开示例，可观察或拍照':'已打开收藏，可继续观察或拍照');
        },'作品读取失败，请重新打开作品列');}
  $('#openCollection').onclick = openCollection;
  $('#introCollection').onclick = openCollection;
  $('#openCollection').disabled = false;
  $$('.scene-picker button').forEach(b=>b.onclick=()=>selectScene(b.dataset.scene));
  $$('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));
  $$('[data-open-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.openPanel));
  $$('[data-camera]').forEach(b => b.onclick = () => setCamera(b.dataset.camera));
  $$('[data-inspect-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.inspectCamera));
  $$('[data-glaze-light]').forEach(b=>b.onclick=()=>{lightMode=b.dataset.glazeLight;lightDirection=-25;$('#glazeLightDirection').value='-25';observation.setLight(lightMode,lightDirection);$$('[data-glaze-light]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));scheduleDetails();});
  $('#glazeLightDirection').oninput=e=>{lightDirection=Number(e.target.value);observation.setLight(lightMode,lightDirection);scheduleDetails();};
  $('#openGlazeDetail').onclick=()=>{detailOpen=!detailOpen;detailCard.hidden=!detailOpen;$('#openGlazeDetail').setAttribute('aria-expanded',String(detailOpen));scheduleDetails();};
  $('#closeGlazeDetail').onclick=()=>{detailOpen=false;detailCard.hidden=true;$('#openGlazeDetail').setAttribute('aria-expanded','false');};
  $$('[data-glaze-finding]').forEach(b=>b.onclick=()=>{selectedFinding=b.dataset.glazeFinding;detailOpen=true;scheduleDetails();});
  $('#observationZoom').oninput=e=>{
    if(activeStage?.active){activeStage.zoom=THREE.MathUtils.clamp(Number(e.target.value)/100,1,1.65);activeStage.applyCamera();return;}
    const offset=world.camera.position.clone().sub(world.controls.target).normalize().multiplyScalar(world.observationDistance/(Number(e.target.value)/100));world.camera.position.copy(world.controls.target).add(offset);world.controls.update();scheduleDetails();
  };
  $$('[data-observe]').forEach(b => b.onclick = () => {compareMode='single';setObserved(b.dataset.observe);updateCompare();});
  $$('[data-format]').forEach(b => b.onclick = () => { format = b.dataset.format; $$('[data-format]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  function updateDragHint(){const hint=$('#photoDragHint');hint.textContent=dragMode==='object'?'拖动器物 · 滚轮缩放':activeStage?.active?'拖动微调视角 · 滚轮缩放':'拖动环绕器物 · 滚轮缩放';
    const caption=$('#resultView .view-bottom span:last-child');if(caption)caption.textContent=panel==='photo'?(dragMode==='object'?'拖动转动器物 · 滚轮或双指缩放':'拖动移动视角 · 滚轮或双指缩放'):'拖动环绕观察 · 滚轮或双指缩放';
  }
  $$('[data-photo-drag]').forEach(b=>b.onclick=()=>{dragMode=b.dataset.photoDrag;if(activeStage)activeStage.interaction=dragMode;$$('[data-photo-drag]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updateDragHint();});
  $('#autoRotate').onclick = () => { if(activeStage?.active){activeStage.autoRotate=!activeStage.autoRotate;$('#autoRotate').setAttribute('aria-pressed',String(activeStage.autoRotate));return;}world.controls.autoRotate = !world.controls.autoRotate; world.controls.autoRotateSpeed = .45; $('#autoRotate').setAttribute('aria-pressed', String(world.controls.autoRotate)); };
  $('#resetResultView').onclick=()=>{world.mesh.rotation.y=0;world.controls.autoRotate=false;$('#autoRotate').setAttribute('aria-pressed','false');if(activeStage){activeStage.autoRotate=false;activeStage.reset();}scenePoses.clear();setCamera('full');};
  $('#pieceName').addEventListener('input',()=>{saved=false;updateSaveState();});
  function updateSaveState(){
    $('#save').innerHTML=saved?'已收藏 · 更新作品 <span>✓</span>':activeRecord?'更新收藏 <span>↗</span>':'收藏这件作品 <span>＋</span>';
    $('#storageNote').textContent=saved?'已收藏 · 我的作品中可查看':activeRecord?'名称已修改 · 点击更新收藏':'';
  }
  $('#exportPhoto').onclick = e => guarded(e.currentTarget, async () => { await download(pieceCard(), scenes[$('#resultView').dataset.scene].label); toast('作品卡已生成，正在下载'); }, '图片生成失败，请重试');
  $('#exportComparison').onclick = e => guarded(e.currentTarget, async () => { await download(comparisonCard(), compareMode==='cooling'?'冷却对照':'烧前烧后'); toast('实验对照卡已生成，正在下载'); }, '对照卡生成失败，请重试');
  $('#save').onclick=e=>guarded(e.currentTarget,async()=>{
    const record={id:activeRecord||crypto.randomUUID(),name:title(),updated:Date.now(),scene:sceneKey,settings:current.settings,rotation:world.mesh.rotation.y,camera:cameraKey,photoPose:activeStage?.active?{scene:$('#resultView').dataset.scene,camera:cameraKey,...activeStage.pose()}:scenePoses.get(sceneKey),layers:current.capture()};
    await prepareCollectionThumbnails([record]);
    try{await storage('put',record);}catch(error){$('#storageNote').textContent='收藏未成功 · 当前作品仍可观察和下载';throw error;}
    activeRecord=record.id;saved=true;updateSaveState();toast('作品已收藏，可从我的作品随时打开');
  },'收藏未成功，作品仍可观察和下载');

  return {
    openPanel:setPanel,
    inspectPhoto(){return {mode:dragMode,scene:$('#resultView').dataset.scene,pose:activeStage?.active?activeStage.pose():null,focus:activeStage?.active?activeStage.focus.toArray():world?.controls.target.toArray(),projectedFocus:world?world.controls.target.clone().project(world.camera).toArray():null,quaternion:world?.camera.quaternion.toArray(),lensFocus:activeStage?.optics.uniforms.focus.value,observation:observation?.active?{light:lightMode,direction:lightDirection,environment:world.scene.environment.uuid,key:observation.key.position.toArray(),comparison:compareMode,split,detail:detailOpen,finding:selectedFinding}:null};},
    setAssets(value){assets=value.assets;livingAssets=value.livingAssets;artAssets=value.artAssets;ensureStages();},
    present(data, record = null) {
      cardVersion++;
      for(const material of comparisonMaterials.values())material.dispose();comparisonMaterials.clear();
      activeStage?.leave();activeStage=null;
      observation?.leave();clearTimeout(detailTimer);detailOpen=true;selectedFinding='color';
      scenePoses.clear();if(record?.photoPose)scenePoses.set(record.photoPose.scene||record.scene,record.photoPose);
      alternate?.texture.dispose();alternate?.coatMap?.dispose();alternate?.roughnessMap?.dispose();alternate?.reliefMap?.dispose(); alternate = null; current = data; world = data.world; activeRecord = record?.example||record?.unsaved?null:record?.id || null;
      world.mesh.scale.setScalar(1);
      if (!world.exhibitLights) {
        world.exhibitLights = []; world.scene.traverse(light => { if (light.isLight) world.exhibitLights.push({ light, intensity: light.intensity, color: light.color.clone() }); });
        const studio = new THREE.Scene(); studio.background = new THREE.Color('#777777');
        for (const [width,height,x,y,z,color] of [[3,7,-4,3,3,'#ffffff'],[2,6,4,2,1,'#cdded8'],[5,3,0,6,-3,'#fff3d9']]) {
          const softbox = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide})); softbox.position.set(x,y,z);softbox.lookAt(0,1,0);studio.add(softbox);
        }
        const pmrem = new THREE.PMREMGenerator(world.renderer); world.scene.environment?.dispose();world.exhibitEnvironment=pmrem.fromScene(studio,.04);world.scene.environment=world.exhibitEnvironment.texture;
        studio.traverse(node=>{node.geometry?.dispose();node.material?.dispose()});pmrem.dispose();
      }
      observation=world.observationStage||=new ObservationStage(world,scheduleDetails);
      if(!world.observationChangeBound){world.observationChangeBound=true;world.controls.addEventListener('end',scheduleDetails);world.controls.addEventListener('change',()=>{
        scheduleDetails();if(observation?.active&&world.observationDistance)$('#observationZoom').value=String(Math.round(world.observationDistance/world.camera.position.distanceTo(world.controls.target)*100));
      });}
      ensureStages();
      const canvas=world.renderer.domElement;
      if(!canvas.dataset.photoDragBound){canvas.dataset.photoDragBound='true';
        canvas.addEventListener('pointerdown',e=>{if(panel!=='photo'||activeStage?.active||e.button!==0||dragMode!=='object'&&!e.shiftKey)return;objectPointer={id:e.pointerId,x:e.clientX};world.controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();},true);
        canvas.addEventListener('pointermove',e=>{if(objectPointer?.id!==e.pointerId)return;world.mesh.rotation.y+=(e.clientX-objectPointer.x)*.007;objectPointer.x=e.clientX;e.stopImmediatePropagation();},true);
        const release=e=>{if(objectPointer?.id!==e.pointerId)return;objectPointer=null;world.controls.enabled=!activeStage?.active;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);e.stopImmediatePropagation();};canvas.addEventListener('pointerup',release,true);canvas.addEventListener('pointercancel',release,true);
      }
      const box = new THREE.Box3().setFromObject(world.mesh), size = box.getSize(new THREE.Vector3());
      world.mesh.scale.setScalar(Math.min(2.7 / size.y, 2.15 / Math.max(size.x, size.z)));
      world.controls.autoRotate = false; $('#autoRotate').setAttribute('aria-pressed', 'false');
      world.renderer.domElement.setAttribute('aria-label', '三维陶器，拖动旋转；也可使用下方全貌、特写、俯视按钮');
      const s = current.settings; sceneKey = record?.scene || (scenes[initialScene]?initialScene:'neutral'); cameraKey = record?.camera || 'full';
      photoCameraKey=cameraKey;
      if(record&&Number.isFinite(record.rotation))world.mesh.rotation.y=record.rotation;
      if(museum)museum.autoRotate=false;
      if(living)living.autoRotate=false;
      if(art)art.autoRotate=false;
      $('#pieceName').value = record?.name || `${s.glazeNames[0]}有声`;
      $('#pieceDescription').textContent = `${s.object}，${s.glazeNames.join('、')}。从你留下的色彩关系里，生长出属于这一件的表情。`;
      $('#factShape').textContent = s.object; $('#factGlaze').textContent = s.glazeNames.join(' · '); $('#factFire').textContent = `${processName(s.fire)} · ${s.temp}`; $('#factCool').textContent = s.cooling;
      livingMetadata.textContent=`${s.object} · ${s.glazeNames.join('、')} · ${s.cooling}`;
      const other = s.cooling === '缓冷' ? '快冷' : '缓冷'; $('#alternateLabel').textContent = `只看${other}`;
      $('#coolingQuestion').textContent = `从${s.cooling}，换成${other}。`;
      const markFinding=$('#learnPanel .finding');
      markFinding.querySelector('h3').textContent='笔触与釉色';
      markFinding.querySelector('p').textContent=s.shape?'彩绘保留笔触，效果釉在窑火中流动、聚色。':'边界柔化，笔触仍在。';
      const coolingEffect={gloss:'对照聚色与光泽的细微变化。',satin:'缓冷有助晶花生长，快冷晶花较少。',speckle:'对照细小铁斑的深浅。',crackle:'开片来自釉与胎的收缩差。'};
      $('#coolingFinding').textContent=s.shape?(coolingEffect[s.glazeFinish]||coolingEffect.gloss):'缓冷表面更柔和，快冷表面更光滑。';
      saved=Boolean(record&&!record.example&&!record.unsaved);updateSaveState();
      $('#resultStatus').textContent=record?.example?'示例 / 可自由观察':saved?'收藏 / 再看一次':'05 / 出窑成器';
      $('#resultHeading').textContent=record?.example?'看看窑火留下的颜色。':saved?'每次看，都有新发现。':'这一件，由你而生。';
      $$('.scene-picker button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === sceneKey)));
      setPanel('result'); world.fit = () => activeStage?.active?activeStage.applyCamera():setCamera(cameraKey); world.resize();
    }
  };
}
