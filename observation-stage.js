import * as THREE from 'three';
import {assetURL} from './asset-url.js';
import {createStoneSupport,createContactShadow} from './studio-surfaces.js';
import {applyFiredGlaze} from './glaze-surface.mjs';

const SUPPORT=.16;
const presets={soft:{angle:-60,power:5.6,width:3.4,fill:1.15,ambient:.58,table:.5,environment:'#9b9184',exposure:1.02},side:{angle:-80,power:5.1,width:1.8,fill:.8,ambient:.45,table:.45,environment:'#6c655b',exposure:1.02},rim:{angle:145,power:7.3,width:2.6,fill:1.25,ambient:.5,table:.55,environment:'#766d60',exposure:1.05}};

// A photographic sweep and one small support. It shares the vessel's renderer.
export class ObservationStage {
  constructor(world,onReady){
    this.world=world;this.active=false;this.mode='soft';this.direction=-25;
    this.group=new THREE.Group();this.group.name='Glaze observation light and support';this.group.visible=false;world.scene.add(this.group);
    this.muted=world.scene.children.filter(o=>o.isLight||o.material?.isShadowMaterial);
    this.environment=world.scene.environment;this.probes=new Map();
    this.key=new THREE.RectAreaLight('#fff8ef',4.3,4.8,5);this.fill=new THREE.RectAreaLight('#f3f3ef',1.05,5,5);this.fill.position.set(4.8,2.5,3.5);this.fill.lookAt(0,1.3,0);
    this.bounce=new THREE.HemisphereLight('#fffbf5','#d8caba',.55);
    this.tableBounce=new THREE.RectAreaLight('#f6ead8',.6,5,3);this.tableBounce.position.set(0,-.65,3);this.tableBounce.lookAt(0,.8,0);
    this.sun=new THREE.DirectionalLight('#fff8ee',.65);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.008;this.sun.shadow.radius=12;this.sun.shadow.blurSamples=8;Object.assign(this.sun.shadow.camera,{left:-4,right:4,top:5,bottom:-3,near:.1,far:25});
    this.group.add(this.key,this.fill,this.bounce,this.tableBounce,this.sun,this.sun.target);
    this.support=createStoneSupport(SUPPORT);this.group.add(this.support);
    this.contact=createContactShadow(1,SUPPORT+.001,.76,true);this.supportContact=createContactShadow(1.56,.026,.65);this.group.add(this.contact,this.supportContact);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(45,45),new THREE.ShadowMaterial({color:'#756555',opacity:.24}));floor.rotation.x=-Math.PI/2;floor.position.y=.025;floor.receiveShadow=true;this.group.add(floor);
    new THREE.TextureLoader().load(assetURL('./assets/studio-coherent-plate-20261013.webp'),texture=>{texture.colorSpace=THREE.SRGBColorSpace;this.plate=texture;if(this.active){this.updateBackdrop();onReady?.();}},undefined,()=>{});
    this.target=new THREE.WebGLRenderTarget(240,150);this.target.texture.colorSpace=THREE.SRGBColorSpace;
    this.pixels=new Uint8Array(240*150*4);
    const previous=world.onFrame;world.onFrame=now=>{previous?.(now);if(!this.active)return;const signature=world.mesh.uuid+':'+world.mesh.rotation.toArray().join(':')+':'+world.mesh.position.toArray().join(':');if(signature!==this.shadowSignature){this.shadowSignature=signature;world.renderer.shadowMap.needsUpdate=true;}};
  }
  enter(){
    const {world}=this;
    if(!this.active){this.muted.forEach(o=>{o.userData.observationWasVisible=o.visible;o.visible=false;});this.standardPose={position:world.mesh.position.clone(),scale:world.mesh.scale.clone()};this.shadowType=world.renderer.shadowMap.type;this.shadowAutoUpdate=world.renderer.shadowMap.autoUpdate;world.renderer.shadowMap.type=THREE.VSMShadowMap;world.renderer.shadowMap.autoUpdate=false;}
    this.active=true;this.group.visible=true;world.scene.fog=null;world.controls.enabled=true;
    const size=new THREE.Box3().setFromObject(world.mesh).getSize(new THREE.Vector3());
    this.support.scale.set(Math.max(1,size.x/2.15),1,Math.max(1,size.z/2.15));
    world.mesh.geometry.computeBoundingBox();world.mesh.position.set(0,SUPPORT-world.mesh.geometry.boundingBox.min.y*world.mesh.scale.y,0);
    const profile=world.mesh.userData.profile,foot=profile?.radii?.[0]*world.mesh.scale.x||size.x*.28;this.contact.scale.setScalar(Math.max(.3,foot*1.10));this.supportContact.scale.set(this.support.scale.x,this.support.scale.z,1);
    this.setLight(this.mode,this.direction);this.updateBackdrop();
  }
  leave(){
    if(!this.active)return;this.active=false;this.group.visible=false;
    const {world}=this;this.muted.forEach(o=>{o.visible=o.userData.observationWasVisible??true;});world.scene.environment=this.environment;world.renderer.shadowMap.type=this.shadowType;world.renderer.shadowMap.autoUpdate=this.shadowAutoUpdate;
    if(this.standardPose){world.mesh.position.copy(this.standardPose.position);world.mesh.scale.copy(this.standardPose.scale);}
  }
  setLight(mode,direction=this.direction){
    this.mode=mode;this.direction=direction;if(!this.active)return;
    const p=presets[mode]||presets.soft,angle=THREE.MathUtils.degToRad(p.angle+direction+25);
    this.key.position.set(Math.sin(angle)*5,4.8,Math.cos(angle)*5);this.key.lookAt(0,1.2,0);this.key.intensity=p.power;this.key.width=p.width;
    this.fill.intensity=p.fill;this.bounce.intensity=p.ambient;this.tableBounce.intensity=p.table;this.sun.position.copy(this.key.position);this.sun.target.position.set(0,1,0);this.sun.intensity=mode==='rim'?.22:mode==='side'?.45:.38;
    this.world.renderer.toneMappingExposure=p.exposure;this.world.renderer.shadowMap.needsUpdate=true;
    // Cache one softbox reflection probe per lighting setup, rather than rendering a room.
    if(!this.probes.has(mode)){
      const scene=new THREE.Scene();scene.background=new THREE.Color(p.environment);
      const positions=[[p.width,5,Math.sin(THREE.MathUtils.degToRad(p.angle))*5,4.8,Math.cos(THREE.MathUtils.degToRad(p.angle))*5,'#fff9f2'],[4,5,5,2,2,mode==='side'?'#9c9487':'#ded5c7'],[3,3,-1,6,-3,'#ded5c7'],[10,10,0,-1,0,'#e8dcc9']];
      for(let i=0;i<positions.length;i++){const [w,h,x,y,z,color]=positions[i],plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(i===0?4.8:i===3?.5:1.1),side:THREE.DoubleSide}));plane.position.set(x,y,z);plane.lookAt(0,1.2,0);scene.add(plane);}
      const pmrem=new THREE.PMREMGenerator(this.world.renderer),probe=pmrem.fromScene(scene,.03,.1,30);this.probes.set(mode,probe);pmrem.dispose();scene.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
    }
    this.world.scene.environment=this.probes.get(mode).texture;
  }
  prepareMaterial(material,before=false){
    if(!this.active||before)return;
    const finish=material.userData.finish||'gloss';
    if(material.userData.handmade)applyFiredGlaze(material,finish);
    else{
      material.clearcoat=.96;material.clearcoatRoughness=.045;material.envMapIntensity=.95;
      material.roughness=material.roughnessMap?.65:.21;material.normalScale?.set(.26,.26);
    }
    material.needsUpdate=true;
  }
  updateBackdrop(width,height){
    if(!this.active)return;const {world}=this,size=world.renderer.getSize(new THREE.Vector2());width||=size.x;height||=size.y;
    if(!this.plate){world.scene.background=null;return;}
    const aspect=width/height,imageAspect=this.plate.image.width/this.plate.image.height;
    let w=1,h=1;if(aspect<imageAspect)w=aspect/imageAspect;else h=imageAspect/aspect;
    this.plate.repeat.set(w,h);this.plate.offset.set((1-w)*.38,(1-h)*.5);this.plate.updateMatrix();world.scene.background=this.plate;
  }
  // Same surface patch, camera and light for both samples. Only the material changes.
  detail(canvas,material,patch={x:.48,y:.52}){
    if(!this.active)return;
    const {world}=this,{renderer,camera,mesh}=world,size=renderer.getSize(new THREE.Vector2());
    camera.updateMatrixWorld();mesh.updateMatrixWorld();
    const box=new THREE.Box3().setFromObject(mesh),min=new THREE.Vector2(1,1),max=new THREE.Vector2(-1,-1);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);min.min(new THREE.Vector2(p.x,p.y));max.max(new THREE.Vector2(p.x,p.y));}
    const cx=(min.x+(max.x-min.x)*patch.x+1)*size.x/2,cy=(1-(min.y+(max.y-min.y)*(1-patch.y)))*size.y/2;
    const crop=Math.max(30,Math.min(size.x*.28,(max.x-min.x)*size.x*.15)),ch=crop*150/240,view=camera.view;
    const clone=camera.clone();
    // Preserve the desktop composition offset in the magnified render.
    const sx=view?.enabled?view.width/size.x:1,sy=view?.enabled?view.height/size.y:1;
    clone.setViewOffset(view?.enabled?view.fullWidth:size.x,view?.enabled?view.fullHeight:size.y,(view?.enabled?view.offsetX:0)+(cx-crop/2)*sx,(view?.enabled?view.offsetY:0)+(cy-ch/2)*sy,crop*sx,ch*sy);
    const previousTarget=renderer.getRenderTarget(),scissor=renderer.getScissor(new THREE.Vector4()),viewport=renderer.getViewport(new THREE.Vector4()),test=renderer.getScissorTest(),original=mesh.material;
    try{mesh.material=material;renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.render(world.scene,clone);renderer.readRenderTargetPixels(this.target,0,0,240,150,this.pixels);
      const out=new Uint8ClampedArray(this.pixels.length);for(let y=0;y<150;y++)out.set(this.pixels.subarray(y*240*4,(y+1)*240*4),(149-y)*240*4);
      const source=document.createElement('canvas');source.width=240;source.height=150;source.getContext('2d').putImageData(new ImageData(out,240,150),0,0);const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
    }finally{mesh.material=original;renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);}
  }
}
