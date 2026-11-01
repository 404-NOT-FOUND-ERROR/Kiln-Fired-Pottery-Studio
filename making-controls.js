import * as THREE from 'three';
import {newProfile,cloneProfile,sculptProfile,sculptLocal,handmadeProfile,deformationAt,trimProfile,radiusAt} from './vessel-profile.mjs';
import {shapedGeometry,updateShapedGeometry} from './vessel-geometry.js';
import {createPreparationSequence} from './preparation-sequence.js';
import {starterProfile} from './vessel-presets.mjs';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

export function createMakingControls({state,getWorld,toast,onReady,onProfile}) {
  const controls=$('.selection-controls');controls.classList.add('making-controls');
  $('.selection-controls .workshop-kicker').textContent='01 / 制坯';
  $('.selection-controls h1').textContent='先捏出一件器物';
  $('.selection-controls .subline').textContent='推一推，拉一拉，让轮廓慢慢成形。';
  $('.selection-controls .blank-status').id='clayStatus';
  $('.selection-controls .copy strong').textContent='起始器形';

  const tools=document.createElement('div');tools.className='sculpt-tools';
  tools.innerHTML='<div class="sculpt-mode" role="group" aria-label="塑形工具"><button data-sculpt="push" aria-pressed="true"><span aria-hidden="true">↔</span>推拉器壁</button><button data-sculpt="height" aria-pressed="false"><span aria-hidden="true">↕</span>拉高收窄</button><button data-sculpt="smooth" aria-pressed="false"><span aria-hidden="true">≈</span>抚平转折</button></div><p id="sculptHint" aria-live="polite">在器壁上左右拖动，鼓腹或收腰；上下拖动可微调高度。</p><div class="sculpt-presets" role="group" aria-label="小罐轮廓"><span>轮廓起点</span><button data-profile-preset="blank">直身坯</button><button data-profile-preset="round">圆腹罐</button></div><div class="sculpt-measurements"><span>高度 <b id="shapeHeight"></b></span><span>腹径 <b id="shapeWidth"></b></span><span>口径 <b id="shapeMouth"></b></span></div><div class="sculpt-utilities"><button id="undoShape" disabled>撤销塑形</button><button id="resetShape">重置器形</button><button id="shapeSpin" aria-pressed="false">转台缓转</button></div>';
  const local=document.createElement('div');local.className='sculpt-local-mode';local.setAttribute('role','group');local.setAttribute('aria-label','手捏工具');local.innerHTML='<button data-sculpt="pinch" aria-pressed="false">手捏 · 局部推拉</button><button data-sculpt="dent" aria-pressed="false">指腹压痕</button>';tools.querySelector('.sculpt-mode').after(local);
  const hand=document.createElement('button');hand.dataset.profilePreset='handmade';hand.textContent='手捏罐';tools.querySelector('.sculpt-presets').append(hand);
  $('.model-select').after(tools);
  $('.blank-explainer').innerHTML='<summary>从泥坯到素坯，发生了什么？</summary><p>先在湿泥状态下塑形；半干、呈皮革硬度时修整底足；充分干燥后素烧。素烧后的坯体有一定强度、仍有吸水性，适合继续彩绘和施釉。</p><p>本体验压缩了实际等待时间。素烧后器形锁定；如需重塑，请另起一件泥坯。</p>';
  $('#toPaint').textContent='完成塑形，准备素烧 →';
  $('#backToSelect').textContent='查看器形';
  const prep=document.createElement('div');prep.id='preparationPanel';prep.className='preparation-panel';prep.hidden=true;
  prep.innerHTML='<p class="workshop-kicker">制作中</p><div class="preparation-time"></div><h1 id="prepareTitle" aria-live="polite">风干中</h1><p id="prepareCopy">让湿泥稍稍定形</p><div class="process-tip"><small>小贴士</small><p id="prepareTip" aria-live="polite"></p></div><button id="cancelPreparation" aria-label="取消制作过场，返回塑形">← 返回塑形</button>';
  controls.append(prep);
  const body=document.createElement('div');body.className='selection-controls-body';body.append(controls.querySelector('.copy'),controls.querySelector('.model-select'),tools,controls.querySelector('.blank-explainer'));controls.insertBefore(body,controls.querySelector('.actions'));
  const choice=document.createElement('div');choice.className='starting-choice';choice.append(body.querySelector('.copy'),body.querySelector('.model-select'),tools.querySelector('.sculpt-presets'));body.prepend(choice);
  $$('[data-profile-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profilePreset==='blank')));
  const begin=document.createElement('button');begin.id='beginSculpt';begin.className='primary';begin.textContent='用这个起点，开始塑形 →';controls.querySelector('.actions').prepend(begin);
  const change=document.createElement('button');change.id='changeStartingForm';change.className='secondary';change.textContent='重新选择起点';controls.querySelector('.actions').append(change);
  const dialog=document.createElement('dialog');dialog.className='new-start-dialog';dialog.innerHTML='<h2>重新选择起点？</h2><p>这会清除当前尚未完成的塑形，另起一件泥坯。</p><div><button class="secondary" data-keep>保留当前作品</button><button class="primary" data-new>另起一件</button></div>';document.body.append(dialog);
  const cameraLabel=document.createElement('p');cameraLabel.className='preparation-camera-label';$('.selection-stage').append(cameraLabel);
  state.shapeTool='push';state.shapeSpin=false;state.clayStage='wet';state.shapeLocked=false;
  let history=[],pending=null,drag=null,ring=null,marker=null,worldBound=null,preparing=false,beforePreparation=null;
  function setPhase(phase){state.makingPhase=phase;document.body.dataset.makingPhase=phase;$('.selection-controls .workshop-kicker').textContent=phase==='choose'?'01 / 起点':'02 / 塑形';$('.selection-controls h1').textContent=phase==='choose'?'从一个轮廓开始':'先捏出一件器物';$('.selection-controls .subline').textContent=phase==='choose'?'选一个起点，下一步再用双手改变它。':'用手感受泥土的可塑性，慢慢调整形态。\n不必追求完美，让器物呈现自己的节奏。';document.querySelectorAll('[data-studio-step]').forEach(e=>{if(state.step===1&&e.dataset.studioStep===(phase==='choose'?'choose':'1'))e.setAttribute('aria-current','step');else if(state.step===1)e.removeAttribute('aria-current');});}
  setPhase('choose');begin.onclick=()=>{setPhase('sculpt');state.tool='sculpt';document.querySelector('#workshopRotate').setAttribute('aria-pressed','false');update();};
  change.onclick=()=>dialog.showModal();dialog.querySelector('[data-keep]').onclick=()=>{dialog.close();change.focus();};dialog.querySelector('[data-new]').onclick=()=>{dialog.close();state.shape=starterProfile(state.presetId);history=[];state.shapeLocked=false;state.shapeSpin=false;$('#shapeSpin').setAttribute('aria-pressed','false');$('#shapeSpin').textContent='转台缓转';setPhase('choose');$$('[data-profile-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profilePreset==='blank')));$('[data-sculpt="push"]').click();applyProfile(state.shape,false);setClay('wet');begin.focus();};
  function update(){
    const p=state.shape;if(!p)return;if($('#sculptIdentity'))$('#sculptIdentity').textContent=state.object+' · 自由塑形';
    $('#shapeHeight').textContent=(p.height*5).toFixed(1)+' cm';$('#shapeWidth').textContent=(Math.max(...p.radii)*10).toFixed(1)+' cm';$('#shapeMouth').textContent=((p.radii.at(-1)-p.wall)*10).toFixed(1)+' cm';
    $('#clayStatus').textContent=state.shapeLocked?'素烧坯 · 器形已固定':'湿泥 · 可塑形';
    $$('.sculpt-tools button').forEach(b=>b.disabled=state.shapeLocked);$('#undoShape').disabled=state.shapeLocked||!history.length;
    $('.sculpt-presets').hidden=state.form!=='jar';change.hidden=state.shapeLocked;
    $('#toPaint').textContent=state.shapeLocked?'返回彩绘与施釉 →':'完成塑形，准备素烧 →';
  }
  function updateGeometry(profile){const world=getWorld();if(!world?.mesh)return;if(!updateShapedGeometry(world.mesh.geometry,profile)){world.mesh.geometry.dispose();world.mesh.geometry=shapedGeometry(profile);}world.mesh.userData.profile=cloneProfile(profile);if(!drag)world.fit();onProfile?.(profile);update();}
  function applyProfile(profile,remember=true){if(remember){history.push(cloneProfile(state.shape));if(history.length>30)history.shift();}state.shape=cloneProfile(profile);updateGeometry(state.shape);}
  $$('[data-sculpt]').forEach(b=>b.onclick=()=>{state.shapeTool=b.dataset.sculpt;state.tool='sculpt';$$('[data-sculpt]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#workshopRotate').setAttribute('aria-pressed','false');$('#sculptHint').textContent={push:'整圈推拉，让器身鼓腹或收腰；上下拖动微调高度。',height:'向上拉高、向下压低，保持拉坯的整体轮廓。',smooth:'有手捏痕迹时，抚平当前局部；拉坯时抚平整圈转折。',pinch:'只改变手指碰到的这一侧。左右推拉，上下轻提，口沿也能捏得不对称。',dent:'点按留下一个指腹凹痕；拖过器壁留下连续手捏痕迹。'}[state.shapeTool];});
  $$('.sculpt-presets button').forEach(b=>b.onclick=()=>{if(state.makingPhase!=='choose')return;const p=newProfile(state.form,b.dataset.profilePreset);applyProfile(b.dataset.profilePreset==='handmade'?handmadeProfile(p,Math.floor(Math.random()*2147483647)):p);$$('[data-profile-preset]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(b.dataset.profilePreset==='handmade')$('[data-sculpt="pinch"]').click();toast('已选好轮廓起点');});
  $('#undoShape').onclick=()=>{if(history.length)applyProfile(history.pop(),false);};
  $('#resetShape').onclick=()=>applyProfile(starterProfile(state.presetId));
  $('#shapeSpin').onclick=()=>{state.shapeSpin=!state.shapeSpin;$('#shapeSpin').setAttribute('aria-pressed',String(state.shapeSpin));$('#shapeSpin').textContent=state.shapeSpin?'暂停转台':'转台缓转';};
  function setClay(stage,t=1){
    const world=getWorld();if(!world?.mesh)return;state.clayStage=stage;
    const colors={wet:'#a9876e',leather:'#b19b81',dry:'#dfd0b6',bisque:'#fff8ec'};
    const from={leather:'wet',dry:'leather',bisque:'dry'}[stage]||stage;
    world.mesh.material.color.copy(new THREE.Color(colors[from])).lerp(new THREE.Color(colors[stage]),t);
    const m=world.mesh.material,rough={wet:.45,leather:.9,dry:1,bisque:.97},spec={wet:.9,leather:.26,dry:.16,bisque:.22},relief={wet:.095,leather:.075,dry:.065,bisque:.055},normal={wet:.65,leather:.45,dry:.36,bisque:.32};
    m.clearcoat=stage==='wet'?.32:stage==='leather'?.12*(1-t):0;m.clearcoatRoughness=.20;m.envMapIntensity=stage==='wet'?.45:.35;
    m.normalScale.setScalar(THREE.MathUtils.lerp(normal[from],normal[stage],t));
    m.roughness=THREE.MathUtils.lerp(rough[from],rough[stage],t);m.specularIntensity=THREE.MathUtils.lerp(spec[from],spec[stage],t);m.bumpScale=THREE.MathUtils.lerp(relief[from],relief[stage],t);
  }
  const sequence=createPreparationSequence({panel:prep,state,getWorld,setClay,onTrim:()=>applyProfile(trimProfile(state.shape),false),onComplete:()=>{state.shapeLocked=true;closePreparation();setClay('bisque');onReady();}});
  async function startPreparation(){
    if(state.shapeLocked){onReady();return;}
    if(preparing||state.makingPhase!=='sculpt')return;
    beforePreparation=cloneProfile(state.shape);preparing=true;state.preparing=true;$('#toast').classList.remove('show');$('#openCollection').disabled=true;state.shapeSpin=false;drag=null;pending=null;ring&&(ring.visible=false);marker&&(marker.visible=false);$('#shapeSpin').setAttribute('aria-pressed','false');$('#shapeSpin').textContent='转台缓转';controls.classList.add('is-preparing');prep.hidden=false;await sequence.start();
  }
  function closePreparation(){sequence.cancel();preparing=false;state.preparing=false;$('#openCollection').disabled=false;controls.classList.remove('is-preparing');prep.hidden=true;update();}
  $('#cancelPreparation').onclick=()=>{closePreparation();if(beforePreparation)applyProfile(beforePreparation,false);setClay('wet');toast('已返回塑形');};
  function bindWorld(world){
    if(world===worldBound)return;worldBound=world;
    ring=new THREE.Mesh(new THREE.TorusGeometry(1,.004,6,96),new THREE.MeshBasicMaterial({color:'#725537',transparent:true,opacity:.56,depthTest:false}));ring.rotation.x=Math.PI/2;ring.visible=false;ring.renderOrder=12;world.scene.add(ring);
    marker=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshBasicMaterial({color:'#896538',transparent:true,opacity:.65,depthTest:false}));marker.visible=false;marker.renderOrder=12;world.scene.add(marker);
    const canvas=world.renderer.domElement,ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
    // A second finger changes the current gesture to navigation. Roll back only
    // this in-progress edit, keeping all earlier sculpting and undo entries.
    world.cancelTouchEdit=()=>{if(!drag)return;drag=null;pending=null;const before=history.pop();if(before){state.shape=before;updateGeometry(before);}ring.visible=false;marker.visible=false;};
    const hitAt=e=>{const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,world.camera);return ray.intersectObject(world.mesh)[0];};
    const showRing=(f,angle=0)=>{const isLocal=['pinch','dent'].includes(state.shapeTool)||state.shapeTool==='smooth'&&state.shape.deformation,local=deformationAt(state.shape,f,angle),y=.035+f*state.shape.height,r=radiusAt(state.shape,f)+.014;ring.position.set(0,world.mesh.position.y+y,0);ring.scale.set(r,r,r);ring.visible=!isLocal;marker.visible=!!isLocal;if(isLocal)marker.position.copy(world.mesh.localToWorld(new THREE.Vector3((r+local.radial)*Math.sin(angle),y+local.lift,(r+local.radial)*Math.cos(angle))));};
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||state.step!==1||state.makingPhase!=='sculpt'||state.tool==='orbit'||state.shapeLocked||state.preparing||world.gestureActive)return;
      const hit=hitAt(e);if(!hit)return;const local=world.mesh.worldToLocal(hit.point.clone());if(local.y<.03)return;
      history.push(cloneProfile(state.shape));if(history.length>30)history.shift();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,fraction:Math.min(1,(local.y-.035)/state.shape.height),angle:Math.atan2(local.x,local.z),side:Math.sign(local.x)||1};canvas.setPointerCapture(e.pointerId);showRing(drag.fraction,drag.angle);if(state.shapeTool==='dent')pending=sculptLocal(state.shape,{...drag,radial:-.045,tool:'dent',radius:state.sculptRadius,strength:state.sculptStrength});e.preventDefault();update();
    });
    canvas.addEventListener('pointermove',e=>{
      if(world.gestureActive){drag=null;pending=null;ring.visible=false;marker.visible=false;return;}
      if(drag?.id!==e.pointerId){if(state.step===1&&state.makingPhase==='sculpt'&&!state.shapeLocked&&state.tool!=='orbit'&&!state.preparing){const hit=hitAt(e);if(hit){const p=world.mesh.worldToLocal(hit.point.clone());showRing(Math.min(1,(p.y-.035)/state.shape.height),Math.atan2(p.x,p.z));}else{ring.visible=false;marker.visible=false;}}return;}
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
      const localTool=['pinch','dent'].includes(state.shapeTool)||state.shapeTool==='smooth'&&state.shape.deformation;
      if(state.shapeTool==='dent'){const hit=hitAt(e);if(hit){const p=world.mesh.worldToLocal(hit.point.clone());drag.fraction=Math.min(1,(p.y-.035)/state.shape.height);drag.angle=Math.atan2(p.x,p.z);}}
      const delta={fraction:drag.fraction,angle:drag.angle,radial:state.shapeTool==='dent'?-Math.hypot(dx,dy)*.0015:dx*.004*drag.side,vertical:-dy*.005,tool:state.shapeTool,radius:state.sculptRadius,strength:state.sculptStrength};pending=localTool?sculptLocal(pending||state.shape,delta):sculptProfile(pending||state.shape,delta);
    });
    const release=()=>{const changed=!!drag;if(pending){state.shape=pending;pending=null;updateGeometry(state.shape);}drag=null;ring.visible=false;marker.visible=false;if(changed)world.fit();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('pointerleave',()=>{if(!drag){ring.visible=false;marker.visible=false;}});
    let last=0;const previousFrame=world.onFrame;world.onFrame=now=>{previousFrame?.(now);if(pending){state.shape=pending;pending=null;updateGeometry(state.shape);showRing(drag?.fraction||.5,drag?.angle||0);}if(state.step===1&&state.makingPhase==='sculpt'&&state.shapeSpin&&!drag&&!state.preparing){world.mesh.rotation.y+=Math.min(.05,(now-last)/1000)*.22;world.wheel.rotation.y=world.mesh.rotation.y;}last=now;};
  }
  return {update,bindWorld,startPreparation,setClay,reset(){closePreparation();setPhase('choose');$$('[data-profile-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profilePreset==='blank')));history=[];state.shapeLocked=false;state.shape=starterProfile(state.presetId);state.shapeTool='push';state.tool='sculpt';state.shapeSpin=false;$('#shapeSpin').setAttribute('aria-pressed','false');$('#shapeSpin').textContent='转台缓转';$$('[data-sculpt]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sculpt==='push')));update();}};
}
