import * as THREE from 'three';
import {updateShapedGeometry} from './vessel-geometry.js';
import {mountTimeWheel,showProcessTip} from './time-wheel.js';

const stages=[
 {key:'leather',duration:1000,title:'风干中',copy:'让湿泥稍稍定形',tips:['半干的泥坯能保持形状，也还可以修整。','口沿较薄，通常会比厚实的底部先干。']},
 {key:'trim',duration:4200,title:'修足中',copy:'沿着底部，修整一圈',tips:['修去底部多余泥料，留下器物的圈足。','足底接触窑板的地方保持无釉，可以避免粘连。']},
 {key:'dry-bisque',duration:3200,title:'干燥 · 素烧中',copy:'干透后烧成素坯，再充分冷却',tips:['均匀干燥可以减少各处收缩不同步造成的开裂。','干燥让水分离开；素烧让坯体获得强度。','冷却后的素坯仍有吸水性，可以承接釉浆。']}
];
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};

export function createPreparationSequence({panel,state,getWorld,setClay,onTrim,onComplete}){
 let token=0,saved=null,trimGroup=null;
 const $=s=>panel.querySelector(s),label=document.querySelector('.preparation-camera-label');
 const updateClock=mountTimeWheel($('.preparation-time'),'制坯进度');
 function disposeVisual(){if(!trimGroup)return;trimGroup.removeFromParent();trimGroup.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});trimGroup=null;}
 function restore(){const w=getWorld();if(!w||!saved)return;w.mesh.position.copy(saved.position);w.mesh.quaternion.copy(saved.quaternion);w.camera.position.copy(saved.camera);w.controls.target.copy(saved.target);w.controls.enabled=saved.controlsEnabled;w.renderer.toneMappingExposure=saved.exposure;w.controls.update();w.preparingCamera=false;w.fit();disposeVisual();document.body.style.removeProperty('--preparation-heat');saved=null;}
 function pose(elapsed,reduced){
  const w=getWorld(),p=state.shape;if(!w?.mesh||!saved)return;
  // One continuous approach and return around a stable vessel pivot.
  const enter=smooth((elapsed-450)/1900),leave=smooth((elapsed-4360)/1800),amount=reduced?0:enter*(1-leave),angle=Math.PI*amount,h=p.height+.035,r=Math.max(...p.radii);
  const turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle),pivot=saved.position.clone().add(new THREE.Vector3(0,h/2,0));
  w.mesh.quaternion.copy(turn).multiply(saved.quaternion);
  w.mesh.position.copy(pivot).sub(new THREE.Vector3(0,h/2,0).applyQuaternion(turn));w.mesh.position.y+=Math.sin(angle)*Math.max(.12,r-h/2+.16);
  // Keep the entire inverted silhouette inside the making canvas while looking
  // down onto the foot; a tight foot-only target cut the body at the canvas edge.
  const target=new THREE.Vector3(0,saved.position.y+h*.48,0),close=new THREE.Vector3(.12*r,target.y+Math.max(3,h*1.55),Math.max(5.8,h*2.5,r*4.8));
  const arc=Math.sin(clamp((elapsed-2350)/2010,0,1)*Math.PI)*.16*r*amount;
  w.camera.position.copy(saved.camera).lerp(close,amount);w.camera.position.x+=arc;
  w.controls.target.copy(saved.target).lerp(target,amount);w.controls.update();
  if(trimGroup)trimGroup.visible=!reduced&&amount>.997&&state.trimSweep>0;
 }
 function makeTrimVisual(){
  disposeVisual();const w=getWorld(),r=state.shape.radii[0]*.715;
  trimGroup=new THREE.Group();trimGroup.name='Foot trimming trace';w.mesh.add(trimGroup);
  // Share the vessel's local circle and turnover so trace and cut agree.
  const y=state.shape.wall*.5+.009,points=Array.from({length:241},(_,i)=>{const a=i/240*Math.PI*2;return new THREE.Vector3(r*Math.sin(a),y,r*Math.cos(a));});
  const mat=new THREE.LineBasicMaterial({color:'#bd9d73',transparent:true,opacity:.6,depthTest:false});
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);line.renderOrder=12;line.geometry.setDrawRange(0,0);trimGroup.add(line);trimGroup.visible=false;
 }
 function start(){
  const w=getWorld();if(!w?.mesh)return Promise.resolve();const run=++token,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,durations=reduced?[300,500,450]:stages.map(s=>s.duration),total=durations.reduce((a,b)=>a+b,0),offsets=[0,durations[0],durations[0]+durations[1]],started=performance.now(),tipSeed=Math.floor(Math.random()*7);
  saved={position:w.mesh.position.clone(),quaternion:w.mesh.quaternion.clone(),camera:w.camera.position.clone(),target:w.controls.target.clone(),controlsEnabled:w.controls.enabled,exposure:w.renderer.toneMappingExposure};w.preparingCamera=true;w.controls.enabled=false;state.trimSweep=0;makeTrimVisual();let previousStage=-1,trimmed=false;
  return new Promise(resolve=>{function tick(now){
   if(token!==run){resolve();return;}const elapsed=Math.min(total,now-started),index=elapsed<offsets[1]?0:elapsed<offsets[2]?1:2,stage=stages[index],t=clamp((elapsed-offsets[index])/durations[index],0,1);
   if(index!==previousStage){previousStage=index;panel.dataset.preparationStage=stage.key;state.preparationStage=stage.key;$('#prepareTitle').textContent=stage.title;$('#prepareCopy').textContent=stage.copy;}
   updateClock(elapsed/total);showProcessTip($('#prepareTip'),stage.tips[(tipSeed+Math.floor((elapsed-offsets[index])/2100))%stage.tips.length]);
   pose(reduced?elapsed/total*8400:elapsed,reduced);
   if(index===0){setClay('leather',smooth(t));label.textContent='风干中';}
   if(index===1){const cut=clamp((t-.32)/.48,0,1);state.trimSweep=cut;updateShapedGeometry(w.mesh.geometry,state.shape,cut);trimGroup.children[0].geometry.setDrawRange(0,Math.max(0,Math.floor(cut*240)+1));trimGroup.children[0].material.opacity=.6*(1-smooth((t-.8)/.2));label.textContent='修足中';if(cut===1&&!trimmed){trimmed=true;onTrim();}}
   if(index===2){if(!trimmed){trimmed=true;onTrim();}const dry=Math.min(1,t/.46);if(t<.46)setClay('dry',smooth(dry));else setClay('bisque',smooth((t-.46)/.39));const heat=t>.46?Math.sin((t-.46)/.54*Math.PI)*.1:0;document.body.style.setProperty('--preparation-heat',heat);w.renderer.toneMappingExposure=saved.exposure+heat*.2;label.textContent='干燥 · 素烧中';}
   if(elapsed<total)requestAnimationFrame(tick);else{restore();state.preparationStage='complete';onComplete();resolve();}
  }requestAnimationFrame(tick);});
 }
 return {start,cancel(){token++;restore();state.preparationStage=null;}};
}
