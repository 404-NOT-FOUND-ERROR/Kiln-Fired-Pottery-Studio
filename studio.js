import {setupLightStudio} from './light-studio.js';
import {setupPortraitStudio} from './portrait-studio.js';
import {setupContextualGuide} from './contextual-guide.js';
import * as THREE from 'three';
import { createExhibition } from './exhibition.js';
import { setupStudioUI, setStudioStep, arrangePaintTools } from './studio-ui.js';
import { configureWorkshopWorld, fitWorkshopVessel } from './workshop-stage.js';
import { loadMuseumAssets, loadLivingAssets, loadArtAssets, loadWorkshopAssets } from './museum-assets.js';
let museumAssets=null;
let livingAssets=null;
let artAssets=null;
let workshopAssets=null;
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
import {cloneProfile,surfaceRows,normalizeProfile} from './vessel-profile.mjs';
import {shapedGeometry,legacyVesselProfile} from './vessel-geometry.js';
import {createMakingControls} from './making-controls.js';
import {createPaintEngine} from './paint-engine.js';
import {palette,setupDecorationUI,updateGlazeSamples} from './glaze-library.js';
import {fireLayers,FIRING_VERSION,glazeSurfaceAspect,glazeSurfaceHeightMM} from './glaze-firing.mjs';
import {applyFiredGlaze,glazeSurfaces} from './glaze-surface.mjs';
import {setupKilnProgress} from './kiln-progress.js';
import {kilnPhaseAt} from './kiln-timing.mjs';
import {setupWorkbenchLayout} from './workflow-layout.js';
import {mountVesselPresets,starterProfile,vesselPresets} from './vessel-presets.mjs';
import {createClaySurface} from './clay-surface.js';
mountVesselPresets();
RectAreaLightUniformsLib.init();
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={presetId:'jar',shape:starterProfile('jar'),shapeLocked:false,decoration:'glaze',pattern:'none',clearGlaze:false,glazeFinish:'gloss',kilnSeed:Math.floor(Math.random()*2147483647),firingVersion:FIRING_VERSION,step:1,form:'jar',object:'小罐',glaze:'sky',glazeName:'天青',fire:'氧化焰',temp:'1240℃',brushSize:'medium',brushRadius:34,glazeLoad:55,cooling:'缓冷',painted:0,tool:'paint',technique:'brush',turnSpeed:.42,turntablePaused:false,dipDepth:55,usedGlazes:[],selectGuideSeen:false,paintGuideSeen:false,resultGuideSeen:false};

const descriptions={vase:'梅瓶 · 肩部收束，适合观察釉色流动。',bowl:'茶碗 · 开口宽，釉色会在内壁形成流动边界。',jar:'小罐 · 肩腹饱满，适合观察釉层的覆盖与变化。'};
const screens=$$('.screen'),steps=$$('#steps li'),mobile=$$('.mobile-nav span'),toast=$('#toast'),intro=$('#introScreen'),app=$('#app'),onboarding=$('#onboarding'),firingOverlay=$('#firingOverlay'),firingPhase=$('#firingPhase');let toastTimer;
const showToast=m=>{toast.textContent=m;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)};
const activeWorlds=new Set();
let renderFrameId;
function renderActiveWorlds(now){if(document.hidden){renderFrameId=null;return;}renderFrameId=requestAnimationFrame(renderActiveWorlds);if(document.querySelector('.collection-dialog[open]'))return;for(const world of activeWorlds){if(world.contextLost||!world.element.getClientRects().length)continue;world.controls.update();world.onFrame?.(now);if(world.workshop&&world.mesh){const signature=[world.mesh.rotation.x,world.mesh.rotation.y,world.mesh.rotation.z,world.mesh.position.x,world.mesh.position.y,world.mesh.geometry.getAttribute('position').version,world.mesh.uuid].join(':');if(world.shadowSignature!==signature){world.renderer.shadowMap.needsUpdate=true;world.shadowSignature=signature;}}if(world.renderFrame)world.renderFrame();else world.renderer.render(world.scene,world.camera);}}
renderFrameId=requestAnimationFrame(renderActiveWorlds);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(renderFrameId);renderFrameId=null;}else if(renderFrameId==null)renderFrameId=requestAnimationFrame(renderActiveWorlds);});
setupStudioUI();
setupDecorationUI();
const updateKilnProgress=setupKilnProgress(firingOverlay);
function positionOnboardingTargets(){const active=$('.onboarding-set.active',onboarding);if(!active)return;active.querySelectorAll('[data-target]').forEach(item=>{const target=$(item.dataset.target);if(!target)return;const rect=target.getBoundingClientRect(),pad=item.classList.contains('onboarding-ring')?8:0;if(item.classList.contains('onboarding-ring')){item.style.left=`${rect.left-pad}px`;item.style.top=`${rect.top-pad}px`;item.style.width=`${rect.width+pad*2}px`;item.style.height=`${rect.height+pad*2}px`}else{const placement=item.dataset.placement;if(placement==='above'){item.style.left=`${Math.max(14,rect.left)}px`;item.style.top=`${Math.max(74,rect.top-112)}px`}else if(placement==='below'){item.style.left=`${Math.max(14,rect.left)}px`;item.style.top=`${Math.min(window.innerHeight-112,rect.bottom+14)}px`}else if(target.id==='paintView'||target.id==='resultView'){item.style.left=`${rect.left+22}px`;item.style.top=`${rect.top+22}px`}else{item.style.left=`${Math.max(14,rect.left+12)}px`;item.style.top=`${Math.max(74,rect.top+12)}px`}}})}
function hideOnboarding(){onboarding.hidden=true;onboarding.setAttribute('aria-hidden','true');$$('.onboarding-set',onboarding).forEach(set=>set.classList.remove('active'));if(firingOverlay.hidden)document.body.style.overflow=''}
function showOnboarding(mode){const key=`${mode}GuideSeen`;if(state[key])return;state[key]=true;$$('.onboarding-set',onboarding).forEach(set=>set.classList.toggle('active',set.dataset.onboarding===mode));onboarding.hidden=false;onboarding.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';requestAnimationFrame(positionOnboardingTargets)}
function updatePaintGuide(){
  const started=state.painted>0||state.clearGlaze,isOrbit=state.tool==='orbit',isErase=state.tool==='erase',under=state.decoration==='underglaze';
  const techniqueText={brush:under?'在器物上拖动画笔，留下清楚的线条和色块。':'软刷轻涂，松开后再叠一遍，厚处烧后更有变化。',wheel:'按住器物的固定位置，转台帮助画出连续环带。',dip:'调整浸入高度，点击“浸一次”。',pour:'点按或拖动落釉，釉浆沿着器壁流下。'}[state.technique];
  const toolCopy=isOrbit?'查看模式 · 左右拖动旋转，滚轮或双指缩放':isErase?'擦除当前材料层 · 右键也可临时擦除':techniqueText;
  $('#guideStep').textContent=isOrbit?'03':'02';$('#guideText').textContent=toolCopy;
  $('#selectedGlazeLabel').textContent=state.glazeName;$('#selectedBrushLabel').textContent={small:'细刷',medium:'中刷',large:'大刷'}[state.brushSize];$('#toolHint').textContent=toolCopy;
  $('#workshopRotate').setAttribute('aria-pressed',String(isOrbit));$('#paintViewTip').textContent=toolCopy;
  $('#customColorChip').style.background=customColor.value;
  const color=`rgb(${palette[state.glaze].rgba})`;$('.glaze-sample').style.setProperty('--sample-color',color);
  $('.custom-swatch').style.setProperty('--swatch-color',customColor.value);
  $('#paintHint').textContent=isOrbit?'查看模式 · 旋转、放大，检查另一侧':`${under?'纹样彩绘':'窑变釉'} · ${state.glazeName} · 底足留白`;
  $('#toResult').disabled=!started;$('#toResult').textContent=started?'完成上色，入窑 →':'先留下一层颜色';
  $('#activeColorName').textContent=state.glazeName;
  $$('[data-decoration]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.decoration===state.decoration)));
  $('#blankStageStatus').textContent=started?`${under?'已彩绘':'已施釉'} · ${state.clearGlaze?'已罩透明釉':'尚未釉烧'}`:'素烧坯 · 准备彩绘与施釉';
  $('#materialNote').textContent=under?'保留纹样边界，透明釉增加玻璃光泽；不会变成流彩。':'薄刷透色，叠刷积厚；烧后流动、聚色，产生新的层次。';
  updateGlazeSamples(state);
  $('.paint-layer-label').textContent=`正在${isErase?'擦除':'绘制'}${under?'彩绘层':'颜色釉层'}`;
  $('#applyClearGlaze').setAttribute('aria-pressed',String(state.clearGlaze));$('#applyClearGlaze').textContent=state.clearGlaze?'透明釉已覆盖 ✓':'罩一层透明釉';
  $('#clearGlazeStatus').textContent=state.clearGlaze?'烧后形成透明玻璃层':'保留彩绘颜色与笔触';
  contextGuide?.refresh();
}
function go(n){hideOnboarding();state.step=n;setStudioStep(n);$('#workshopRotate').setAttribute('aria-pressed',String(state.tool==='orbit'));app.classList.toggle('paint-mode',n===2);app.classList.toggle('result-mode',n===3);if(n!==3)app.classList.remove('museum-mode','living-mode','art-mode');screens.forEach((s,i)=>s.classList.toggle('active',i===n-1));steps.forEach((s,i)=>s.classList.toggle('active',i===n-1));mobile.forEach((s,i)=>s.classList.toggle('active',i===n-1));$('#count').textContent=String(n).padStart(2,'0');if(n===2)updatePaintGuide();scrollTo({top:0,behavior:'smooth'})}
function profile(form){return form==='jar'&&museumAssets?museumAssets.manifest.profile:legacyVesselProfile(form);}
function ensurePaintControls(){
  const tip=$('#paintViewTip'),guide=$('#guideText');
  const subline=$('.paint-stage-head .subline');if(subline)subline.textContent='轻刷透色，叠刷积厚；把变化交给窑火。';
  const paintView=$('#paintView');if(paintView&&!$('#techniquePrimer')){const primer=document.createElement('div');primer.id='techniquePrimer';primer.className='technique-primer';primer.setAttribute('aria-label','四种施釉方式');primer.innerHTML='<div class="primer-heading"><span>施釉方式</span><small>点击切换</small></div><div class="primer-grid"><button class="primer-card" data-technique="brush" aria-pressed="true" title="自由刷釉"><svg class="primer-diagram" viewBox="0 0 76 54" aria-hidden="true"><path class="vessel-line" d="M29 8h18v8c0 4 7 6 9 15 2 10-5 17-18 17S18 41 20 31c2-9 9-11 9-15V8Z"/><path class="brush-line" d="M12 13 37 30"/><path class="brush-tip" d="m34 29 8 5"/></svg><strong>刷釉</strong><small>局部纹样</small></button><button class="primer-card" data-technique="wheel" aria-pressed="false" title="转台刷釉"><svg class="primer-diagram" viewBox="0 0 76 54" aria-hidden="true"><path class="vessel-line" d="M29 8h18v8c0 4 7 6 9 15 2 10-5 17-18 17S18 41 20 31c2-9 9-11 9-15V8Z"/><path class="orbit-line" d="M10 40c-4-12 5-26 19-29"/><path class="orbit-line" d="m13 29-4 11 11-2"/><path class="orbit-line" d="M66 14c5 12-4 27-18 31"/><path class="orbit-line" d="m63 25 4-11-11 2"/></svg><strong>转台</strong><small>连续环带</small></button><button class="primer-card" data-technique="dip" aria-pressed="false" title="浸釉"><svg class="primer-diagram" viewBox="0 0 76 54" aria-hidden="true"><path class="vessel-line" d="M29 5h18v8c0 4 7 6 9 15 2 10-5 17-18 17S18 38 20 28c2-9 9-11 9-15V5Z"/><path class="liquid-line" d="M8 38c12-3 22 3 31 0s19-3 29 0"/><path class="drop-line" d="M38 7v21"/><path class="drop-line" d="m34 24 4 5 4-5"/></svg><strong>浸釉</strong><small>均匀底色</small></button><button class="primer-card" data-technique="pour" aria-pressed="false" title="淋釉"><svg class="primer-diagram" viewBox="0 0 76 54" aria-hidden="true"><path class="vessel-line" d="M29 17h18c0 4 7 6 9 14 2 10-5 14-18 14S18 41 20 31c2-8 9-10 9-14Z"/><path class="drop-line" d="M38 4c-6 7 4 9 0 15"/><path class="flow-line" d="M38 18c-2 6 4 7 0 13-4 6 4 7 0 12"/><path class="flow-line" d="M44 20c-2 5 3 7 1 12"/></svg><strong>淋釉</strong><small>自然流釉</small></button></div>';paintView.appendChild(primer)}
  if(tip)tip.textContent='左键刷釉 · 右键擦除 · 中键旋转 · 滚轮缩放';
  if(guide)guide.textContent='先选颜色和笔刷，再在器物表面轻刷；多次经过会逐渐变浓';
  if(paintView&&!$('#zoomRange')){const zoom=document.createElement('div');zoom.className='zoom-control';zoom.setAttribute('aria-label','器物取景');zoom.innerHTML='<button type="button" class="zoom-step" data-workshop-zoom="-1" aria-label="缩小器物">−</button><input id="zoomRange" type="range" min="0" max="100" value="50" step="1" aria-label="调整器物取景大小"><button type="button" class="zoom-step" data-workshop-zoom="1" aria-label="放大器物">＋</button>';paintView.appendChild(zoom)}
  const zoomRange=$('#zoomRange');if(zoomRange&&!zoomRange.dataset.bound){zoomRange.dataset.bound='true';zoomRange.addEventListener('input',()=>{const activeWorld=state.step===1?select3d:paint3d;if(activeWorld)activeWorld.setWorkshopZoom(1+Number(zoomRange.value)/100*.65)})}
  $$('[data-workshop-zoom]').forEach(button=>{if(button.dataset.bound)return;button.dataset.bound='true';button.addEventListener('click',()=>{const world=state.step===1?select3d:paint3d;if(world)world.setWorkshopZoom(world.workshopZoom+Number(button.dataset.workshopZoom)*.1)})});
  const toolSwitch=$('.tool-switch');
  if(toolSwitch&&!toolSwitch.querySelector('[data-tool="erase"]')){const orbit=toolSwitch.querySelector('[data-tool="orbit"]'),button=document.createElement('button');button.dataset.tool='erase';button.setAttribute('aria-pressed','false');button.textContent='⌫ 橡皮擦';toolSwitch.insertBefore(button,orbit)}
  const small=$('.brush[data-size="small"] small'),medium=$('.brush[data-size="medium"] small'),large=$('.brush[data-size="large"] small');
  if(small)small.textContent='描线与细节';if(medium)medium.textContent='均匀铺色';if(large)large.textContent='大面积覆盖';
  arrangePaintTools();
}
ensurePaintControls();
let contextGuide;
const workbench=setupWorkbenchLayout();
const SIZE=1024;
const newCanvas=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;return canvas};
const tuneTexture=texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.ClampToEdgeWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=8;return texture};
function sealTextureEdges(canvas){
  const ctx=canvas.getContext('2d'),a=ctx.getImageData(0,0,1,SIZE),b=ctx.getImageData(SIZE-1,0,1,SIZE);
  for(let i=0;i<a.data.length;i++)a.data[i]=b.data[i]=(a.data[i]+b.data[i])*.5;
  ctx.putImageData(a,0,0);ctx.putImageData(b,SIZE-1,0);
}
function softenTextureSeam(canvas,feather=64){const ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,SIZE,SIZE),data=image.data,source=new Uint8ClampedArray(data);for(let y=0;y<SIZE;y++){for(let x=0;x<feather;x++){const left=(y*SIZE+x)*4,right=(y*SIZE+SIZE-1-x)*4,weight=(1-x/feather)**2;for(let c=0;c<3;c++){const shared=(source[left+c]+source[right+c])*.5;data[left+c]=source[left+c]*(1-weight)+shared*weight;data[right+c]=source[right+c]*(1-weight)+shared*weight}}}ctx.putImageData(image,0,0)}
function currentSurfaceRows(form=state.form){
  if(state.shape&&!state.specimen)return surfaceRows(state.shape);
  if(form==='jar'&&museumAssets)return museumAssets.jarSurface.map(row=>({r:row.point.x,y:row.point.y,v:row.v}));
  const points=new THREE.SplineCurve(profile(form).map(p=>new THREE.Vector2(...p))).getPoints(128),lengths=[0];for(let i=1;i<points.length;i++)lengths[i]=lengths[i-1]+points[i].distanceTo(points[i-1]);return points.map((p,i)=>({r:p.x,y:p.y,v:lengths[i]/lengths.at(-1)}));
}
function createFootMask(surface,form){
  const rows=currentSurfaceRows(form),minimum=Math.min(...rows.map(p=>p.y)),mask=newCanvas(),ctx=mask.getContext('2d');surface.allowedRows=new Uint8Array(SIZE);
  for(let i=1;i<rows.length;i++){
    if(Math.min(rows[i-1].y,rows[i].y)<minimum+.065)continue;
    const a=SIZE*(1-rows[i-1].v),b=SIZE*(1-rows[i].v),start=Math.max(0,Math.floor(Math.min(a,b))),end=Math.min(SIZE,Math.ceil(Math.max(a,b)));
    ctx.fillRect(0,start,SIZE,Math.max(1,end-start));surface.allowedRows.fill(1,start,end);
  }
  surface.footMask=mask;surface.footMaskCtx=ctx;renderTextureLayer(surface,{coverage:true});
}
function renderTextureLayer(surface,{coverage=true}={}){
  if(surface.footMask)for(const layer of [surface.glazeCtx,surface.wetCtx]){layer.save();layer.globalCompositeOperation='destination-in';layer.drawImage(surface.footMask,0,0);layer.restore();}
  const ctx=surface.ctx,res=surface.canvas.width;ctx.clearRect(0,0,res,res);ctx.drawImage(surface.baseCanvas,0,0,res,res);ctx.drawImage(surface.glazeCanvas,0,0,res,res);ctx.drawImage(surface.wetCanvas,0,0,res,res);surface.texture.needsUpdate=true;
  if(surface===paintTex&&coverage){
    surface.coverageCanvas??=Object.assign(document.createElement('canvas'),{width:64,height:64});const c=surface.coverageCanvas.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,64,64);c.drawImage(surface.glazeCanvas,0,0,64,64);c.drawImage(surface.wetCanvas,0,0,64,64);
    const pixels=c.getImageData(0,0,64,64).data;let total=0;for(let i=3;i<pixels.length;i+=4)total+=pixels[i];state.painted=state.clearGlaze?100:total/(64*64*255)*100;
  }
}
function makeTexture(){
  const canvas=newCanvas(),baseCanvas=newCanvas(),glazeCanvas=newCanvas(),wetCanvas=newCanvas(),base=baseCanvas.getContext('2d');canvas.width=canvas.height=innerWidth<=900?512:768;const ctx=canvas.getContext('2d');
  base.fillStyle='#f2e8d8';base.fillRect(0,0,SIZE,SIZE);
  const clay=createClaySurface();base.globalCompositeOperation='multiply';base.drawImage(clay.color.image,0,0,SIZE,SIZE);base.globalCompositeOperation='source-over';clay.color.dispose();clay.bump.dispose();clay.roughness.dispose();clay.normal.dispose();
  const surface={canvas,ctx,baseCanvas,glazeCanvas,glazeCtx:glazeCanvas.getContext('2d'),wetCanvas,wetCtx:wetCanvas.getContext('2d')};surface.texture=tuneTexture(new THREE.CanvasTexture(canvas));renderTextureLayer(surface);return surface;
}
function makeShowcaseTexture(colors,style='flow'){
  const surface=makeTexture(),layer=surface.glazeCtx;
  layer.clearRect(0,0,SIZE,SIZE);
  const rgba=(color,alpha)=>'rgba('+color[0]+','+color[1]+','+color[2]+','+alpha+')';
  const blend=layer.createLinearGradient(0,0,SIZE,SIZE*.22);
  colors.forEach((color,index)=>blend.addColorStop(index/(colors.length-1),rgba(color,.62)));
  layer.fillStyle=blend;layer.fillRect(0,0,SIZE,SIZE);
  if(style==='flow'){
    layer.save();layer.globalAlpha=.72;layer.filter='blur(24px)';
    colors.forEach((color,index)=>{
      const baseX=SIZE*(.08+.84*((index+.5)/colors.length));
      layer.strokeStyle=rgba(color,.72);layer.lineWidth=130+(index%3)*42;layer.lineCap='round';layer.beginPath();layer.moveTo(baseX,-140);
      for(let step=1;step<=7;step++){const y=step*SIZE/7,x=baseX+Math.sin(step*1.24+index*.9)*125;layer.lineTo(x,y)}
      layer.stroke();
    });
    layer.restore();
  }else if(style==='ripple'){
    layer.save();layer.globalAlpha=.65;layer.filter='blur(7px)';
    colors.forEach((color,index)=>{
      for(let ring=0;ring<3;ring++){const y=SIZE*(.18+((index*3+ring)%12)/13),w=SIZE*(.2+.06*ring);layer.strokeStyle=rgba(color,.58);layer.lineWidth=34+ring*15;layer.beginPath();layer.ellipse(SIZE*(.2+.6*((index+1)/(colors.length+1))),y,w,SIZE*(.075+.018*ring),0,0,Math.PI*2);layer.stroke()}
    });
    layer.restore();
  }else{
    let seed=17391;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    layer.save();layer.globalAlpha=.72;layer.filter='blur(5px)';
    for(let i=0;i<180;i++){const color=colors[i%colors.length],px=rand()*SIZE,py=SIZE*(.08+rand()*.84),r=14+rand()*70,spot=layer.createRadialGradient(px-r*.2,py-r*.2,0,px,py,r);spot.addColorStop(0,rgba(color,.86));spot.addColorStop(.5,rgba(color,.48));spot.addColorStop(1,'rgba(255,255,255,0)');layer.fillStyle=spot;layer.beginPath();layer.ellipse(px,py,r,r*(.42+rand()*.9),rand()*Math.PI,0,Math.PI*2);layer.fill()}
    layer.restore();
  }
  const shine=surface.wetCtx.createLinearGradient(0,0,SIZE,0);shine.addColorStop(0,'rgba(255,255,255,0)');shine.addColorStop(.22,'rgba(255,255,255,.28)');shine.addColorStop(.36,'rgba(255,255,255,.04)');shine.addColorStop(.58,'rgba(255,255,255,.15)');shine.addColorStop(.74,'rgba(255,255,255,.04)');shine.addColorStop(1,'rgba(255,255,255,0)');surface.wetCtx.fillStyle=shine;surface.wetCtx.fillRect(0,0,SIZE,SIZE);
  softenTextureSeam(surface.glazeCanvas,72);renderTextureLayer(surface);return surface
}
function makeVessel(form,surface){
  const points=profile(form),curve=new THREE.SplineCurve(points.map(p=>new THREE.Vector2(p[0],p[1]))),segments=192,sampled=curve.getPoints(128),geo=new THREE.LatheGeometry(sampled,segments);geo.computeVertexNormals();
  const uv=geo.getAttribute('uv'),lengths=[0];for(let j=1;j<sampled.length;j++)lengths[j]=lengths[j-1]+sampled[j].distanceTo(sampled[j-1]);const total=lengths.at(-1)||1;
  for(let i=0;i<=segments;i++){for(let j=0;j<sampled.length;j++){const n=i*sampled.length+j;uv.setXY(n,i/segments,lengths[j]/total)}}uv.needsUpdate=true;
  const material=new THREE.MeshPhysicalMaterial({map:surface.texture,color:0xffffff,metalness:0,roughness:surface.fired?.21:.88,clearcoat:surface.fired?.92:0,clearcoatRoughness:.14,ior:1.5,reflectivity:surface.fired?.6:.12,specularIntensity:surface.fired?.92:.23,envMapIntensity:surface.fired?1.24:.38,side:THREE.DoubleSide});
  if(!surface.fired&&workshopAssets){
    material.normalMap=workshopAssets.normal;material.normalScale.set(.85,.85);
    material.roughnessMap=workshopAssets.roughness;material.roughness=1;
    material.envMapIntensity=.5;material.specularIntensity=.16;
    if(form==='jar'){material.aoMap=workshopAssets.ao;material.aoMapIntensity=1;}
  }else if(!surface.fired&&!state.shape){
    const bump=newCanvas(),context=bump.getContext('2d'),image=context.createImageData(SIZE,SIZE);let seed=7319;
    for(let y=0;y<SIZE;y+=3)for(let x=0;x<SIZE;x+=3){
      seed=(seed*1664525+1013904223)>>>0;
      const value=128+(seed/4294967296-.5)*94+Math.sin(y*.22+Math.sin(x*.009)*.18)*9;
      for(let dy=0;dy<3&&y+dy<SIZE;dy++)for(let dx=0;dx<3&&x+dx<SIZE;dx++){
        const offset=((y+dy)*SIZE+x+dx)*4;image.data[offset]=image.data[offset+1]=image.data[offset+2]=value;image.data[offset+3]=255;
      }
    }
    context.putImageData(image,0,0);material.bumpMap=new THREE.CanvasTexture(bump);material.bumpScale=.013;
  }else if(surface.fired){
    material.specularColor.set(0xfff8ee);material.sheen=.08;material.sheenRoughness=.4;material.sheenColor.set(0xffead8);
  }
  let vesselGeometry=geo;if(state.shape&&!state.specimen){geo.dispose();vesselGeometry=shapedGeometry(state.shape);material.vertexColors=true;material.normalMap=null;material.roughnessMap=null;material.aoMap=null;}else if(form==='jar'&&museumAssets){geo.dispose();vesselGeometry=(!surface.fired&&workshopAssets?workshopAssets.jar:museumAssets.jar).clone();}
  if(!surface.fired&&form==='jar'&&workshopAssets&&!state.shape)vesselGeometry.setAttribute('uv2',vesselGeometry.getAttribute('uv').clone());
  if(!surface.fired&&!(form==='jar'&&workshopAssets)&&!state.shape){
    // Local occlusion on the unglazed inner wall keeps a hollow vessel from
    // looking like a white solid lid under diffuse workshop lighting.
    const positions=vesselGeometry.getAttribute('position'),normals=vesselGeometry.getAttribute('normal'),colors=new Float32Array(positions.count*3);
    vesselGeometry.computeBoundingBox();const bounds=vesselGeometry.boundingBox,height=bounds.max.y-bounds.min.y;
    for(let i=0;i<positions.count;i++){
      const inward=positions.getX(i)*normals.getX(i)+positions.getZ(i)*normals.getZ(i)<-.03;
      const shade=inward?.48+.29*(positions.getY(i)-bounds.min.y)/height:1;
      colors.set([shade,shade,shade],i*3);
    }
    vesselGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));material.vertexColors=true;
  }
  if(state.shape&&!state.specimen){
    const clay=createClaySurface();material.userData.claySurface=clay;material.bumpMap=clay.bump;material.userData.clayBump=clay.bump;
    if(!surface.fired&&state.step===1){material.map=clay.color;material.roughnessMap=clay.roughness;}
    if(!surface.fired){material.roughnessMap=clay.roughness;material.normalMap=clay.normal;material.normalScale.setScalar(state.step===1?.65:.32);material.clearcoatNormalMap=clay.normal;material.clearcoatNormalScale.set(.7,.7);}else clay.normal.dispose();
    material.userData.reliefScale=(glazeSurfaces[state.glazeFinish]||glazeSurfaces.gloss).bumpScale;material.bumpScale=surface.fired?material.userData.reliefScale:.003;if(surface.fired&&surface.reliefMap)material.bumpMap=surface.reliefMap;
    material.userData.handmade=true;material.userData.finish=state.glazeFinish;material.userData.clearGlaze=state.clearGlaze;
    if(surface.fired&&surface.coatMap){material.clearcoatMap=surface.coatMap;material.roughnessMap=surface.roughnessMap;}
    if(surface.fired)applyFiredGlaze(material,state.glazeFinish);
    if(!surface.fired){material.color.set(state.step===1?'#a9876e':'#fff8ec');material.roughness=state.step===1?.45:.97;material.specularIntensity=state.step===1?.9:.22;material.bumpScale=state.step===1?.095:.055;material.envMapIntensity=.65;material.clearcoat=state.step===1?.32:0;material.clearcoatRoughness=.20;material.reflectivity=state.step===1?.45:.12;}
  }
  const mesh=new THREE.Mesh(vesselGeometry,material);mesh.userData.profile=state.shape&&!state.specimen?cloneProfile(state.shape):null;mesh.rotation.y=form==='jar'?0:Math.PI;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.form=form;return mesh
}
function addStudioLight(scene,color,intensity,width,height,position,target){const light=new THREE.RectAreaLight(color,intensity,width,height);light.position.set(...position);light.lookAt(...target);scene.add(light);return light}
function baseScene(el){
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(31,1,.1,100);camera.position.set(0,1.75,6.3);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:false,powerPreference:'high-performance'});const gl=renderer.getContext();gl.disable(gl.DITHER);renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if(el.id==='resultView'){const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(renderer);scene.environment=pmrem.fromScene(room,.045).texture;room.dispose();pmrem.dispose();}
  el.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=3.6;controls.maxDistance=9;controls.target.set(0,1.7,0);
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
  controls.enableZoom=true;controls.zoomSpeed=.72;
  scene.add(new THREE.HemisphereLight(0xfffdf2,el.id==='resultView'?0x758b81:0x89715a,el.id==='resultView'?1.35:.22));
  addStudioLight(scene,0xfff7e8,el.id==='resultView'?3.65:3.2,4.8,6.2,el.id==='resultView'?[-3.6,4.8,4.8]:[-3.6,4.8,4.8],[0,1.45,0]);
  addStudioLight(scene,el.id==='resultView'?0xdaf2eb:0xfff8eb,el.id==='resultView'?2.35:.8,3.4,5.2,[3.8,2.4,3.2],[0,1.4,0]);
  addStudioLight(scene,el.id==='resultView'?0xffd8c7:0xfff5df,el.id==='resultView'?1.65:.38,3.2,3.2,[.8,4.8,-3.4],[0,1.7,0]);
  const key=new THREE.DirectionalLight(0xfff9ea,el.id==='resultView'?.72:.48);key.position.set(...(el.id==='resultView'?[-2.5,5,4]:[-3.6,5.8,-1.2]));key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00015;key.shadow.normalBias=.025;scene.add(key);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x000000,transparent:true,opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=el.id==='resultView'?-.035:.045;floor.receiveShadow=true;scene.add(floor);
  const world={scene,camera,renderer,controls,mesh:null,texture:null,fit:null,resize:null,onFrame:null};
  if(el.id!=='resultView'){renderer.toneMappingExposure=.96;configureWorkshopWorld(world,()=>el.id==='paintView'||el.id==='selectView'?state.tool:'orbit');}
  if(globalThis.__potteryPlatform){
    const status=document.createElement('p');status.className='render-status';status.hidden=true;status.setAttribute('role','status');el.append(status);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();world.contextLost=true;status.hidden=false;status.textContent='画面恢复中，请稍候。';});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{world.contextLost=false;world.shadowSignature=null;status.hidden=true;world.resize();});
  }
  function resize(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();if(globalThis.__potteryPlatform)renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(2_000_000/(w*h))));renderer.setSize(w,h,false);if(world.fit)world.fit()}world.resize=resize;new ResizeObserver(resize).observe(el);resize();
  world.element=el;activeWorlds.add(world);return world
};
let select3d,paint3d,result3d,paintTex,firedTex;
function fitCameraToVessel(world,form){if(!world.mesh)return;if(world.workshop){fitWorkshopVessel(world);return;}const pts=profile(form),h=Math.max(...pts.map(p=>p[1])),radius=Math.max(...pts.map(p=>p[0])),fov=THREE.MathUtils.degToRad(world.camera.fov),aspect=Math.max(.35,world.camera.aspect||1),hFov=2*Math.atan(Math.tan(fov/2)*aspect),padding=1.28,vertical=(h*padding)/(2*Math.tan(fov/2)),horizontal=(radius*2*padding)/(2*Math.tan(hFov/2)),distance=Math.max(vertical,horizontal,1.65),targetY=world.mesh.position.y+h/2;world.controls.target.set(0,targetY,0);world.camera.position.set(0,targetY,distance);world.controls.minDistance=Math.max(radius*1.15,.45,distance*.36);world.controls.maxDistance=distance*2.6;world.controls.update();const range=$('#zoomRange');if(range&&world===paint3d)range.value=String(Math.round((world.controls.maxDistance-distance)/(world.controls.maxDistance-world.controls.minDistance)*100))}
function addVesselWorld(world,form,texture){
  const mesh=makeVessel(form,texture);mesh.geometry.computeBoundingBox();mesh.position.y=.05-mesh.geometry.boundingBox.min.y;
  world.scene.add(mesh);world.mesh=mesh;world.texture=texture;
  if(!texture.fired)createFootMask(texture,form);
  world.workshopZoom=1;world.fit=()=>fitCameraToVessel(world,form);world.fit();
}
function replaceVessel(world,form,texture=world.texture||paintTex){if(world.mesh){world.scene.remove(world.mesh);world.mesh.geometry.dispose();world.mesh.material.userData.clayBump?.dispose();world.mesh.material.userData.claySurface?.color.dispose();world.mesh.material.userData.claySurface?.roughness.dispose();world.mesh.material.userData.claySurface?.normal.dispose();if(!world.mesh.material.userData.handmade)world.mesh.material.bumpMap?.dispose();world.mesh.material.dispose()}addVesselWorld(world,form,texture)}
function initSelect(){select3d=baseScene($('#selectView'));addVesselWorld(select3d,state.form,makeTexture());making.bindWorld(select3d);making.update();making.setClay(state.shapeLocked?'bisque':'wet');}
function enablePaint(world){createPaintEngine({world,surface:paintTex,state,palette,rows:()=>currentSurfaceRows(),refresh:renderTextureLayer,guide:updatePaintGuide,toast:showToast});}
function initPaint(){paint3d=baseScene($('#paintView'));paintTex=makeTexture();addVesselWorld(paint3d,state.form,paintTex);paint3d.controls.enabled=false;enablePaint(paint3d)}
function firingInputs(){
  const image=canvas=>canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data;
  return {width:SIZE,height:SIZE,base:image(paintTex.baseCanvas),underglaze:image(paintTex.glazeCanvas),glaze:image(paintTex.wetCanvas),foot:paintTex.footMask?image(paintTex.footMask):null,clearGlaze:state.clearGlaze,finish:state.glazeFinish,fire:state.fire,cooling:state.cooling,seed:state.kilnSeed||736513,surfaceAspect:glazeSurfaceAspect(state.shape),surfaceHeightMM:glazeSurfaceHeightMM(state.shape)};
}
function textureFromFiring(result){
  const canvases={};for(const [name,data] of Object.entries(result)){const canvas=newCanvas();canvas.getContext('2d').putImageData(new ImageData(data,SIZE,SIZE),0,0);canvases[name]=canvas;}
  return {canvas:canvases.color,ctx:canvases.color.getContext('2d'),texture:tuneTexture(new THREE.CanvasTexture(canvases.color)),coatMap:new THREE.CanvasTexture(canvases.coat),roughnessMap:new THREE.CanvasTexture(canvases.roughness),reliefMap:new THREE.CanvasTexture(canvases.relief),fired:true};
}
function makeFiredTexture(){return textureFromFiring(fireLayers(firingInputs()));}
function prepareFiring(){
  const input=firingInputs();return new Promise(resolve=>{
    let worker,settled=false;
    const fallback=()=>{if(settled)return;settled=true;worker?.terminate();resolve({current:fireLayers(input),alternate:fireLayers({...input,cooling:input.cooling==='缓冷'?'快冷':'缓冷'})});};
    try{
      worker=new Worker(new URL('./glaze-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=e=>{if(e.data.error){fallback();return;}if(settled)return;settled=true;worker.terminate();resolve(e.data);};worker.onerror=e=>{e.preventDefault();fallback();};
      // Keep input buffers available for a fallback; the existing canvases never move.
      worker.postMessage(input);
    }catch{fallback();}
  });
}
function displayFiredTexture(){const result=makeFiredTexture();if(state.specimen&&museumAssets){const canvas=result.texture.image;canvas.getContext('2d').drawImage(museumAssets.specimen.image,0,0,canvas.width,canvas.height);result.texture.needsUpdate=true;}return result;}
function initResult(savedRecord=null,restoredImages=null,baked=null){
  // Raw strokes remain intact. Old handmade works can use the revised glaze renderer
  // without overwriting their stored record until the user updates the collection.
  if(savedRecord&&!state.specimen&&state.shape&&Number(state.firingVersion||0)<FIRING_VERSION&&restoredImages?.base&&restoredImages?.wet){restoredImages=null;state.firingVersion=FIRING_VERSION;}
  if(firedTex){firedTex.texture?.dispose();firedTex.coatMap?.dispose();firedTex.roughnessMap?.dispose();firedTex.reliefMap?.dispose();}
  if(baked)firedTex=textureFromFiring(baked.current);
  else if(restoredImages?.fired&&restoredImages.coat&&restoredImages.roughness&&restoredImages.relief){
    const blank=new Uint8ClampedArray(SIZE*SIZE*4);firedTex=textureFromFiring({color:blank,coat:blank,roughness:blank,relief:blank});
  }else firedTex=displayFiredTexture();
  if(restoredImages?.fired){firedTex.ctx.clearRect(0,0,SIZE,SIZE);firedTex.ctx.drawImage(restoredImages.fired,0,0,SIZE,SIZE);firedTex.texture.needsUpdate=true;}
  for(const [key,imageKey] of [['coatMap','coat'],['roughnessMap','roughness'],['reliefMap','relief']])if(restoredImages?.[imageKey]){
    firedTex[key].dispose();const canvas=newCanvas();canvas.getContext('2d').drawImage(restoredImages[imageKey],0,0,SIZE,SIZE);firedTex[key]=new THREE.CanvasTexture(canvas);
  }
  if(!result3d){result3d=baseScene($('#resultView'));addVesselWorld(result3d,state.form,firedTex)}else replaceVessel(result3d,state.form,firedTex);
  const settings={...state,usedGlazes:[...state.usedGlazes],glazeNames:(state.usedGlazes.length?state.usedGlazes:[state.glaze]).map(code=>palette[code].name),customColor:customColor.value};
  exhibition.present({world:result3d,before:paintTex,after:firedTex,settings,
    alternate:()=>{if(baked?.alternate)return textureFromFiring(baked.alternate);const original=state.cooling;try{state.cooling=original==='缓冷'?'快冷':'缓冷';return displayFiredTexture()}finally{state.cooling=original}},
    capture:()=>({base:paintTex.baseCanvas.toDataURL(),glaze:paintTex.glazeCanvas.toDataURL(),wet:paintTex.wetCanvas.toDataURL(),fired:firedTex.canvas.toDataURL(),coat:firedTex.coatMap?.image.toDataURL(),roughness:firedTex.roughnessMap?.image.toDataURL(),relief:firedTex.reliefMap?.image.toDataURL()})
  },savedRecord);showCulture('shape');
}
const making=createMakingControls({state,getWorld:()=>select3d,toast:showToast,onReady:()=>{
  state.tool='paint';go(2);if(!paint3d)initPaint();else{replaceVessel(paint3d,state.form);paint3d.paintEngine.resetHistory();paint3d.resize();}updatePaintGuide();
  const screen=$('#screen2');screen.classList.remove('process-arrival');void screen.offsetWidth;screen.classList.add('process-arrival');
}});
setupLightStudio(state);
contextGuide=setupContextualGuide(state);
$$('.model-btn').forEach(b=>b.addEventListener('click',()=>{
  if(state.makingPhase!=='choose'||state.presetId===b.dataset.preset)return;
  $$('.model-btn').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  state.presetId=b.dataset.preset;state.form=b.dataset.form;state.object=b.dataset.name;state.shape=starterProfile(state.presetId);state.shapeLocked=false;state.clearGlaze=false;state.specimen=false;state.painted=0;state.usedGlazes=[];
  if(paintTex)for(const key of ['wet','glaze'])paintTex[key+'Ctx'].clearRect(0,0,SIZE,SIZE);
  making.reset();const preset=vesselPresets.find(p=>p.id===state.presetId);$('#modelDesc').textContent=preset.name+' · '+preset.note;document.querySelector('#presetSource')?.remove();if(preset.source){const a=document.createElement('a');a.id='presetSource';a.href=preset.source;a.target='_blank';a.rel='noopener';a.textContent='看看器形出处 ↗';document.querySelector('.starting-choice .copy').append(a);}replaceVessel(select3d,state.form);making.update();making.setClay('wet');
}));
$('#toPaint').addEventListener('click',()=>{hideOnboarding();making.startPreparation();});
const techniqueCopy={brush:{name:'自由刷釉',desc:'轻刷透色，叠刷渐浓。',fact:'生釉颜色不等于烧后釉色，配方与烧成条件会共同影响结果。'},wheel:{name:'转台刷釉',desc:'转台缓转，刷出连续环带。',fact:'陶艺师会用转台辅助画口沿、腰线等整齐的环形纹样。'},dip:{name:'浸釉',desc:'调整浸入高度，点击浸釉。',fact:'现实中需避开足底接触窑板的部位，浸釉后通常还会擦净底足。'},pour:{name:'淋釉',desc:'点按落釉，沿器壁自然流下。',fact:'流釉的方向和厚薄与釉浆浓度、器物曲面和烧成温度有关。'}};
function selectTechnique(technique){if(technique==='dip'||technique==='pour'){state.decoration='glaze';state.pattern='none';$$('[data-decoration]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.decoration==='glaze')));}state.technique=technique;state.tool='paint';$$('.technique-btn,.primer-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.technique===technique)));$$('.tool-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool==='paint')));if(paint3d)paint3d.controls.enabled=false;$$('.technique-adjustment').forEach(panel=>panel.hidden=panel.dataset.adjustment!==technique);const copy=techniqueCopy[technique];$('#techniqueName').textContent=copy.name;$('#techniqueDesc').textContent=copy.desc;$('#techniqueFact').textContent=copy.fact;updatePaintGuide()}
$$('.technique-btn,.primer-card').forEach(b=>b.addEventListener('click',()=>selectTechnique(b.dataset.technique)));
$('#wheelSpeed').addEventListener('input',e=>{const value=Number(e.target.value);state.turnSpeed=.18+value*.008;$('#wheelSpeedLabel').textContent=value<25?'缓慢':value<65?'适中':'较快'});
$('#wheelToggle').addEventListener('click',()=>{state.turntablePaused=!state.turntablePaused;$('#wheelToggle').textContent=state.turntablePaused?'继续旋转':'暂停转台';updatePaintGuide()});
$('#dipDepth').addEventListener('input',e=>{$('#dipDepthLabel').textContent=e.target.value});
$('#applyDip').addEventListener('click',()=>{if(paint3d)paint3d.applyDip()});
$$('.tool-switch button').forEach(b=>b.addEventListener('click',()=>{$$('.tool-switch button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.tool=b.dataset.tool;if(paint3d)paint3d.controls.enabled=false;updatePaintGuide()}));
const setGlaze=b=>{$$('.swatch').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.glaze=b.dataset.glaze;state.glazeName=b.dataset.name;updatePaintGuide()};
$$('.swatch').forEach(b=>b.addEventListener('click',()=>setGlaze(b)));const customColor=$('#customColor');const hexToRgb=hex=>{const value=hex.replace('#','');return[parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)]};customColor.addEventListener('input',e=>{palette.custom.rgba=hexToRgb(e.target.value);document.documentElement.style.setProperty('--custom-color',e.target.value);setGlaze($('.custom-swatch'))});document.documentElement.style.setProperty('--custom-color',customColor.value);
$('#brushSizeRange').addEventListener('input',event=>{
  state.brushRadius=Number(event.target.value);state.brushSize=state.brushRadius<24?'small':state.brushRadius<46?'medium':'large';
  $$('.brush').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.size===state.brushSize)));updatePaintGuide();
});
$('#glazeLoadRange').addEventListener('input',event=>{state.glazeLoad=Number(event.target.value)});
$('#workshopRotate').addEventListener('click',()=>{
  if(state.step===1){state.tool=state.tool==='orbit'?'sculpt':'orbit';$('#workshopRotate').setAttribute('aria-pressed',String(state.tool==='orbit'));if(state.tool==='orbit')$('#sculptHint').textContent='查看模式 · 左右拖动旋转，切回塑形即可继续。';else $(`[data-sculpt="${state.shapeTool}"]`)?.click();return;}
  if(state.step===2){const next=state.tool==='orbit'?'paint':'orbit';$('.tool-switch button[data-tool="'+next+'"]').click();}
});
$('#workshopReset').addEventListener('click',()=>{const world=state.step===1?select3d:paint3d;if(world){world.mesh.rotation.y=0;world.setWorkshopZoom(1);}});
$$('[data-decoration]').forEach(b=>b.addEventListener('click',()=>{state.decoration=b.dataset.decoration;if(state.decoration==='underglaze')state.clearGlaze=true;state.pattern='none';$$('[data-decoration]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$$('[data-pattern]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pattern==='none')));updatePaintGuide();}));
$$('[data-pattern]').forEach(b=>b.addEventListener('click',()=>{state.pattern=b.dataset.pattern;$$('[data-pattern]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.tool='paint';updatePaintGuide();}));
$$('[data-glaze-finish]').forEach(b=>b.onclick=()=>{state.glazeFinish=b.dataset.glazeFinish;state.decoration='glaze';$$('[data-glaze-finish]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updatePaintGuide();});
$('#undoPaint').onclick=()=>paint3d?.paintEngine.undo();$('#applyClearGlaze').onclick=()=>paint3d?.paintEngine.coatClear();$('#applyBaseGlaze').onclick=()=>paint3d?.paintEngine.baseCoat();
$$('.brush').forEach(b=>b.addEventListener('click',()=>{$$('.brush').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.brushSize=b.dataset.size;state.brushRadius={small:14,medium:34,large:58}[state.brushSize];$('#brushSizeRange').value=String(state.brushRadius);$('#brushSizeRange').dispatchEvent(new Event('input'));updatePaintGuide()}));
$('#clearPaint').addEventListener('click',()=>{paint3d.paintEngine.clear();showToast('彩绘与釉层已清空，可以撤销');});
$$('.process-grid button').forEach(b=>b.addEventListener('click',()=>{$$('.process-grid button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.fire=b.dataset.fire;state.temp=b.dataset.temp;updateFiringSummary()}));
$$('.cooling button').forEach(b=>b.addEventListener('click',()=>{$$('.cooling button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));state.cooling=b.dataset.cooling;updateFiringSummary()}));
function updateFiringSummary(){updateGlazeSamples(state);$('#firingSettingsSummary').textContent=({氧化焰:'氧化气氛',还原焰:'还原气氛',柴烧:'柴烧预设'}[state.fire])+' · '+state.cooling;contextGuide?.refresh();}
const shapeCulture={vase:'梅瓶是宋代以来常见的储酒器形。小口、短颈、丰肩与收腹既形成挺秀轮廓，也使釉层容易在肩部转折处产生浓淡变化。',bowl:'茶碗与中国饮茶方式一起演变。开阔的口沿便于观汤、击拂，深弧内壁也让釉色在碗心与转折处呈现不同层次。',jar:'罐是生活陶瓷中历史悠久的储藏器。丰肩、鼓腹与稳定的底足兼顾容量和放置，也给窑变留下更完整的环形观察面。'};
function cultureCopy(type){const codes=state.usedGlazes.length?state.usedGlazes:[state.glaze],labels=codes.map(code=>palette[code].name);if(type==='shape')return shapeCulture[state.form];if(type==='glaze')return `${labels.join('、')}是本体验中的釉色标签。釉在高温下熔融形成表层，其厚薄、流动与组成都会影响成品外观。这里的颜色混合是视觉示意，不代表实际配方。`;return '氧化与还原描述烧成气氛，柴烧描述燃料与烧成方式，两者并不互斥。本体验将它们组合为不同预设；真实窑火还受到含氧量、升温、保温和冷却曲线共同影响。'}
function showCulture(type){$$('[data-culture]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.culture===type)));$('#cultureText').textContent=cultureCopy(type)}

function startFiring(){
  if((!state.painted&&!state.clearGlaze)||!firingOverlay.hidden)return;paint3d?.paintEngine.flush();if(state.decoration==='underglaze'&&!state.clearGlaze&&!state.usedGlazes.length)return;
  setStudioStep('firing');
  const button=$('#toResult');button.disabled=true;button.textContent='烧制中…';
  toast.classList.remove('show');clearTimeout(toastTimer);
  firingOverlay.hidden=false;firingOverlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  firingOverlay.focus();updateKilnProgress(0,parseInt(state.temp,10));
  const phases=['升温中','高温烧成中','冷却中','准备出窑'];
  const started=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?800:8600;let finished=false,previousPhase=-1;
  const prepared=prepareFiring();
  const finish=async()=>{if(finished)return;finished=true;firingPhase.textContent='准备出窑';try{const baked=await prepared;beginCompletion(baked);}catch(error){console.warn('Firing could not finish',error);setStudioStep(2);showToast('烧制未完成，颜色已保留，请重试。');}finally{firingOverlay.hidden=true;firingOverlay.setAttribute('aria-hidden','true');document.body.style.overflow='';button.disabled=false;button.textContent='进入烧制 →';}};
  const tick=now=>{if(finished)return;const t=Math.min(1,(now-started)/duration),phase=kilnPhaseAt(t);if(phase!==previousPhase){previousPhase=phase;firingPhase.textContent=phases[phase];}updateKilnProgress(t,parseInt(state.temp,10));if(t<1)requestAnimationFrame(tick);else finish()};requestAnimationFrame(tick);
}
$('#toResult').addEventListener('click',startFiring);
$$('[data-culture]').forEach(b=>b.addEventListener('click',()=>showCulture(b.dataset.culture)));
function resetForNewPiece(){
  state.presetId='jar';document.body.dataset.panel='photo';document.querySelector('#presetSource')?.remove();
  intro.classList.add('is-hidden');app.classList.remove('app-hidden');
  state.shape=null;state.shapeLocked=false;state.clearGlaze=false;state.decoration='glaze';state.pattern='none';state.glazeFinish='gloss';state.kilnSeed=Math.floor(Math.random()*2147483647);state.firingVersion=FIRING_VERSION;
  state.specimen=false;app.classList.remove('museum-mode','living-mode','art-mode');
  state.step=1;state.form='jar';state.object='小罐';state.glaze='sky';state.glazeName='天青';state.fire='氧化焰';state.temp='1240℃';state.brushSize='medium';state.brushRadius=34;state.glazeLoad=55;$('#brushSizeRange').value='34';$('#glazeLoadRange').value='55';state.cooling='缓冷';state.painted=0;state.tool='paint';state.turnSpeed=.42;state.turntablePaused=false;state.dipDepth=55;state.usedGlazes=[];$('#wheelSpeed').value='30';$('#wheelSpeedLabel').textContent='适中';$('#wheelToggle').textContent='暂停转台';$('#dipDepth').value='55';$('#dipDepthLabel').textContent='55';selectTechnique('brush');
  $$('.model-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset==='jar')));$('#modelDesc').textContent=descriptions.jar;
  $$('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.glaze==='sky')));$$('.brush').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.size==='medium')));$$('.tool-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool==='paint')));$$('.process-grid button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fire==='氧化焰')));$$('.cooling button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cooling==='缓冷')));
  if(paintTex){paintTex.glazeCtx.clearRect(0,0,SIZE,SIZE);paintTex.wetCtx.clearRect(0,0,SIZE,SIZE);renderTextureLayer(paintTex)}
  $$('[data-decoration]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.decoration==='glaze')));$$('[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pattern==='none')));$$('[data-glaze-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.glazeFinish==='gloss')));$('.firing-settings').open=true;updateFiringSummary();$('[data-workshop-tab="glaze"]').click();
  making.reset();workbench.reset();if(select3d){replaceVessel(select3d,'jar');making.setClay('wet');}if(paint3d){paint3d.controls.enabled=false;replaceVessel(paint3d,'jar')}
  $('#customColorChip').style.background=customColor.value;updatePaintGuide();go(1);if(!select3d)initSelect();else select3d.resize();
}
$('#onboardingDismiss').addEventListener('click',hideOnboarding);$('.onboarding-scrim',onboarding).addEventListener('click',hideOnboarding);onboarding.addEventListener('click',event=>{if(event.target===onboarding||event.target.classList.contains('onboarding-scrim'))hideOnboarding()});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!onboarding.hidden)hideOnboarding()});window.addEventListener('resize',()=>{if(!onboarding.hidden)positionOnboardingTargets()});
$('#startExperience').addEventListener('click',()=>{state.tool='sculpt';intro.classList.add('is-hidden');app.classList.remove('app-hidden');go(1);if(!select3d)initSelect();else select3d.resize();window.scrollTo({top:0,behavior:'instant'})});
$('#backToIntro').addEventListener('click',()=>{hideOnboarding();intro.classList.remove('is-hidden');app.classList.add('app-hidden');setStudioStep(0);window.scrollTo({top:0,behavior:'instant'});$('#startExperience').focus({preventScroll:true});});
$('#backToSelect').addEventListener('click',()=>{state.tool='orbit';go(1);making.update();select3d?.resize();making.setClay('bisque');$('#toPaint').focus({preventScroll:true});});
$('#restart').addEventListener('click',resetForNewPiece);$('#toResult').disabled=true;
$('#startExperience').disabled=true;
// Only the vessel is needed for making and the result. Photo assets load on request.
$('#startExperience').disabled=false;$('#startExperience').textContent='开始制陶 →';
const photoAssets=new Map();
function loadExhibitionAssets(key='museum'){
  if(!photoAssets.has(key))photoAssets.set(key,(async()=>{
    const asset=await ({museum:loadMuseumAssets,living:loadLivingAssets,art:loadArtAssets}[key])();
    if(key==='museum')museumAssets=asset;else if(key==='living')livingAssets=asset;else artAssets=asset;
    exhibition.setAssets({assets:museumAssets,livingAssets,artAssets});
  })().catch(error=>{photoAssets.delete(key);throw error;}));
  return photoAssets.get(key);
}

const exhibition=createExhibition({toast:showToast,assets:museumAssets,livingAssets,artAssets,ensureAssets:loadExhibitionAssets,initialScene:new URLSearchParams(location.search).get('scene')||'museum',onNew:resetForNewPiece,onLoad:async(record,images)=>{
  if(record.example||record.settings.specimen)await loadExhibitionAssets('museum');
  Object.assign(state,record.settings);state.shape=record.settings.shape?normalizeProfile(record.settings.shape):null;state.shapeLocked=!!state.shape;state.clearGlaze=!!record.settings.clearGlaze;
  state.specimen=Boolean(record.settings.specimen);
  customColor.value=record.settings.customColor||'#d38a77';palette.custom.rgba=hexToRgb(customColor.value);
  if(paintTex?.texture)paintTex.texture.dispose();paintTex=makeTexture();if(paint3d){paint3d.texture=paintTex;paint3d.paintEngine.setSurface(paintTex);}
  for(const [name,canvas] of [['base',paintTex.baseCanvas],['glaze',paintTex.glazeCanvas],['wet',paintTex.wetCanvas]]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,SIZE,SIZE);if(images[name])ctx.drawImage(images[name],0,0,SIZE,SIZE)}
  createFootMask(paintTex,state.form);renderTextureLayer(paintTex);intro.classList.add('is-hidden');app.classList.remove('app-hidden');go(3);initResult(record,images);
}});
setupPortraitStudio(state);
function beginCompletion(baked){
  hideOnboarding();app.classList.remove('app-hidden');go(3);initResult(null,null,baked);exhibition.openPanel('photo');
  // One gentle arrival on the existing result canvas, without a cabinet or extra renderer.
  const view=$('#resultView');view.classList.remove('result-arrival');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){void view.offsetWidth;view.classList.add('result-arrival');}
  requestAnimationFrame(()=>$('#resultHeading').focus({preventScroll:true}));
}
const previewButton=document.createElement('button');previewButton.className='collection-intro';previewButton.id='previewPiece';previewButton.textContent='先看一件成品示例 →';$('.intro-action').append(previewButton);
function previewPiece(){
  state.specimen=Boolean(museumAssets);state.shape=null;
  state.form='jar';state.object='小罐';state.glaze='sky';state.glazeName='天青';state.usedGlazes=['sky','cobalt','amber'];state.fire='氧化焰';state.temp='1240℃';state.cooling='缓冷';state.painted=86;
  if(paintTex?.texture)paintTex.texture.dispose();paintTex=makeShowcaseTexture([[45,121,126],[64,91,136],[177,134,87]],'flow');paintTex.wetCtx.clearRect(0,0,SIZE,SIZE);paintTex.wetCtx.drawImage(paintTex.glazeCanvas,0,0);paintTex.glazeCtx.clearRect(0,0,SIZE,SIZE);renderTextureLayer(paintTex);
  if(museumAssets){paintTex.wetCtx.clearRect(0,0,SIZE,SIZE);paintTex.wetCtx.drawImage(museumAssets.specimenPaint.image,0,0,SIZE,SIZE);renderTextureLayer(paintTex);state.usedGlazes=['sky','change'];}
  intro.classList.add('is-hidden');app.classList.remove('app-hidden');go(3);initResult({example:true,name:'青岚流光',scene:new URLSearchParams(location.search).get('scene')||'museum',camera:'full'});$('#pieceName').value='青岚流光';$('#pieceDescription').textContent='天青入釉，窑火成诗。\n在光影之间，收藏一次偶然的相遇。';exhibition.openPanel('photo');
}
async function preparePreview(){try{await loadExhibitionAssets('museum');}catch(error){console.warn('Using the local preview surface',error);}previewPiece();const panel=new URLSearchParams(location.search).get('panel');if(['result','learn'].includes(panel))exhibition.openPanel(panel);}
previewButton.addEventListener('click',async()=>{previewButton.disabled=true;try{await preparePreview();}finally{previewButton.disabled=false;}});if(new URLSearchParams(location.search).get('preview')==='1')await preparePreview();

export function inspectStudio({layers=false,motion=false}={}){
  const active=state.step===1?select3d:state.step===2?paint3d:result3d;
  const result={state:structuredClone(state),geometry:active?.mesh?{vertices:active.mesh.geometry.getAttribute('position').count,profile:active.mesh.userData.profile,position:active.mesh.position.toArray(),rotation:active.mesh.rotation.toArray(),camera:active.camera.position.toArray()}:null,paint:paint3d?.paintEngine?.stats,photo:state.step===3?exhibition.inspectPhoto():null};
  if(motion&&active?.mesh){const group=active.mesh.getObjectByName('Foot trimming trace'),line=group?.children[0],points=line?[0,60,120,180].map(i=>line.localToWorld(new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('position'),i)).project(active.camera).toArray()):[];result.motion={target:active.controls.target.toArray(),traceVisible:!!group?.visible,traceObjects:group?.children.length||0,tracePoints:points};}
  if(layers&&paintTex){result.layers={};for(const [name,canvas] of [['underglaze',paintTex.glazeCanvas],['glaze',paintTex.wetCanvas]]){const pixels=canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data;let total=0,max=0;for(let i=3;i<pixels.length;i+=4){total+=pixels[i];max=Math.max(max,pixels[i]);}result.layers[name]={maxAlpha:max,alphaSum:total};}}
  return result;
}
