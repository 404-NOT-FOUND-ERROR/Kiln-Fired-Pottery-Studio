import * as THREE from 'three';
import {createStoneSupport,createWorkshopReflection,createContactShadow} from './studio-surfaces.js';
const SUPPORT=.19;
export function fitWorkshopVessel(world){
  if(!world.mesh||world.preparingCamera)return;const {camera,controls,renderer}=world,size=renderer.getSize(new THREE.Vector2());if(!size.x||!size.y)return;
  world.mesh.geometry.computeBoundingBox();const box=world.mesh.geometry.boundingBox,height=box.max.y-box.min.y,radius=Math.max(Math.abs(box.min.x),Math.abs(box.max.x));world.mesh.position.set(0,SUPPORT-box.min.y,0);
  const targetY=SUPPORT+height*.43,fov=THREE.MathUtils.degToRad(31),distance=Math.max(5.4,(Math.max(height,2.1)+1.1)/(2*Math.tan(fov/2)),(Math.max(radius*2,2.8)+.45)/(2*Math.tan(fov/2)*camera.aspect)),d=distance/(world.workshopZoom||1);
  controls.target.set(0,targetY,0);camera.position.set(0,targetY+d*.30,d);camera.lookAt(controls.target);camera.updateProjectionMatrix();camera.updateMatrixWorld();controls.update();
  const origin=new THREE.Vector3(0,SUPPORT,0).project(camera),bounds=world.element.getBoundingClientRect();
  const background=document.querySelector('.workshop-backdrop');if(background){background.style.setProperty('--workshop-bg-scale',String(world.workshopZoom||1));background.style.setProperty('--workshop-bg-x',((bounds.left+(origin.x+1)*bounds.width/2)/innerWidth*100)+'%');background.style.setProperty('--workshop-bg-y',((bounds.top+(1-origin.y)*bounds.height/2)/innerHeight*100)+'%');}
  const foot=world.mesh.userData.profile?.radii?.[0]||radius*.6;
  world.wheelContact.scale.setScalar(Math.max(.3,foot*1.10));const range=document.querySelector('#zoomRange');if(range)range.value=String(Math.round(((world.workshopZoom||1)-1)/.65*100));
}
export function configureWorkshopWorld(world,getTool){
  world.workshop=true;world.workshopZoom=1;world.controls.enabled=false;world.controls.enableRotate=false;world.controls.enableZoom=false;
  world.renderer.shadowMap.type=THREE.VSMShadowMap;
  world.renderer.shadowMap.autoUpdate=false;world.renderer.shadowMap.needsUpdate=true;
  let area=0;
  world.scene.traverse(node=>{if(!node.isLight)return;if(node.isHemisphereLight){node.intensity=.48;node.color.set('#fffbf5');node.groundColor.set('#d8caba');}if(node.isRectAreaLight){const index=area++;node.color.set('#fff8ee');node.intensity=[4.8,.9,.8][index]||.4;node.width=[2.8,5,3][index]||3;node.height=[4.8,5,3][index]||3;node.position.set(...([[-3.8,4.6,1.7],[4,2,4],[-1.2,4.5,-3]][index]||[0,4,0]));node.lookAt(0,1,0);}if(node.isDirectionalLight){node.intensity=1.35;node.position.set(-3.8,4.6,1.7);node.shadow.normalBias=.006;node.shadow.radius=22;node.shadow.blurSamples=12;Object.assign(node.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.1,far:20});}});
  // The pale photographic tabletop returns light to the underside of the pot.
  const tableBounce=new THREE.RectAreaLight('#f6ead8',.5,5,3);tableBounce.position.set(0,-.65,3);tableBounce.lookAt(0,.8,0);world.scene.add(tableBounce);
  const wheel=createStoneSupport(SUPPORT);world.scene.add(wheel);world.wheel=wheel;
  world.reflectionProbe=createWorkshopReflection(world.renderer);world.scene.environment=world.reflectionProbe.texture;
  world.wheelContact=createContactShadow(1,SUPPORT+.001,.76,true);world.scene.add(world.wheelContact);
  world.supportContact=createContactShadow(1.56,.026,.65);world.scene.add(world.supportContact);
  const previousFrame=world.onFrame;world.onFrame=now=>{previousFrame?.(now);world.wheelContact.visible=!world.preparingCamera;};
  world.scene.children.filter(node=>node.material?.isShadowMaterial).forEach(node=>{world.scene.remove(node);node.geometry.dispose();node.material.dispose();});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({color:'#756555',opacity:.24}));floor.rotation.x=-Math.PI/2;floor.position.y=.025;floor.receiveShadow=true;world.scene.add(floor);
  world.setWorkshopZoom=value=>{world.workshopZoom=THREE.MathUtils.clamp(value,1,1.65);fitWorkshopVessel(world);};
  const canvas=world.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','三维陶坯，查看模式左右拖动旋转，滚轮或加减键缩放，Home 复位');
  canvas.addEventListener('keydown',e=>{if(world.preparingCamera||!world.mesh||!['ArrowLeft','ArrowRight','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')world.mesh.rotation.y-=.15;if(e.key==='ArrowRight')world.mesh.rotation.y+=.15;if(e.key==='+'||e.key==='=')world.setWorkshopZoom(world.workshopZoom+.08);if(e.key==='-')world.setWorkshopZoom(world.workshopZoom-.08);if(e.key==='Home'){world.mesh.rotation.y=0;world.setWorkshopZoom(1);}});
  let pointer=null;const touches=new Map();let pinch=null;
  canvas.addEventListener('pointerdown',e=>{if(world.preparingCamera)return;if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size===2){const [a,b]=[...touches.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:world.workshopZoom,center:(a.x+b.x)/2,rotation:world.mesh.rotation.y};world.gestureActive=true;world.cancelTouchEdit?.();pointer=null;return;}if(world.gestureActive)return;}if(e.button===1||(e.button===0&&getTool()==='orbit')){pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(world.preparingCamera)return;if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const [a,b]=[...touches.values()];world.setWorkshopZoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));world.mesh.rotation.y=pinch.rotation+((a.x+b.x)/2-pinch.center)*.009;world.wheel.rotation.y=world.mesh.rotation.y;return;}if(world.gestureActive)return;if(pointer?.id===e.pointerId&&world.mesh){world.mesh.rotation.y+=(e.clientX-pointer.x)*.009;world.wheel.rotation.y=world.mesh.rotation.y;pointer.x=e.clientX;}});
  const release=e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=null;if(!touches.size)world.gestureActive=false;if(pointer?.id===e.pointerId)pointer=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  if(canvas.parentElement.id!=='paintView')canvas.addEventListener('wheel',e=>{e.preventDefault();if(world.preparingCamera)return;world.setWorkshopZoom(world.workshopZoom*Math.exp(-e.deltaY*.0008));},{passive:false});
}
