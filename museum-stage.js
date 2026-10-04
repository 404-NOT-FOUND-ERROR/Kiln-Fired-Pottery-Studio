import * as THREE from 'three';
import { RectAreaLightUniformsLib } from './vendor/RectAreaLightUniformsLib.js';
import { LivingOptics } from './living-optics.js';

RectAreaLightUniformsLib.init();

// The photographic plate and 3D camera always use the same cropped frustum.
// Dragging rotates the object, never the plate's camera.
export class MuseumStage {
  constructor(world, assets) {
    this.world = world; this.assets = assets; this.active = false;
    this.living=assets.manifest.style==='living';
    this.optics=this.living?new LivingOptics(world):null;
    this.renderFrame=()=>this.render();
    this.supportHeight=assets.manifest.plinthTop??1.1;
    this.view = 'full'; this.zoom = 1; this.autoRotate = false; this.velocity = 0; this.pointer = null;
    this.group = new THREE.Group(); this.group.name = `Calibrated ${this.living?'window':'museum'} lights and shadow receiver`;
    this.group.visible = false; world.scene.add(this.group);
    this.environment = world.scene.environment;
    const pmrem = new THREE.PMREMGenerator(world.renderer);
    this.probe = pmrem.fromEquirectangular(assets.hdr); pmrem.dispose();
    this.muted = world.scene.children.filter(o => o.isLight || o.material?.isShadowMaterial);

    const occlusion = new THREE.Mesh(assets.plinth, new THREE.MeshBasicMaterial({ colorWrite: false }));
    occlusion.renderOrder = -20; this.group.add(occlusion);
    const receiver = new THREE.Mesh(assets.plinth, new THREE.ShadowMaterial({ color: '#090d08', opacity: .57, depthWrite: false }));
    receiver.receiveShadow = true; receiver.renderOrder = -19; this.group.add(receiver);
    if(this.living){
      // The plate already contains the garden's shadows on the furniture.
      // Its live receiver must use the second map, containing the ceramic only.
      receiver.material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('getShadowMask()',`getCeramicShadow()`);
        shader.fragmentShader=shader.fragmentShader.replace('void main() {',`
          float getCeramicShadow(){
            #if NUM_DIR_LIGHT_SHADOWS > 1
              DirectionalLightShadow s=directionalLightShadows[1];
              return receiveShadow?getShadow(directionalShadowMap[1],s.shadowMapSize,s.shadowBias,s.shadowRadius,vDirectionalShadowCoord[1]):1.0;
            #else
              return 1.0;
            #endif
          }
          void main() {`);
      };
      receiver.material.customProgramCacheKey=()=> 'living-ceramic-only-shadow';
      const sun=new THREE.DirectionalLight('#ffe4bd',2.5);sun.position.set(-9,8,3.4);sun.target.position.set(-1,1.7,0);
      sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.008;sun.shadow.bias=-.00003;sun.shadow.radius=2.5;
      Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});this.group.add(sun,sun.target);
      const ceramicShadow=new THREE.DirectionalLight('#ffffff',0);ceramicShadow.position.copy(sun.position);ceramicShadow.target.position.copy(sun.target.position);
      ceramicShadow.castShadow=true;ceramicShadow.shadow.mapSize.set(2048,2048);ceramicShadow.shadow.normalBias=.008;ceramicShadow.shadow.bias=-.00003;
      Object.assign(ceramicShadow.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});
      this.group.add(ceramicShadow,ceramicShadow.target);
      const window=new THREE.RectAreaLight('#fff0cf',2.2,3.3,4.3);window.position.set(-4.05,4.1,1.55);window.lookAt(-1,2.3,0);this.group.add(window);
      const bounce=new THREE.RectAreaLight('#fff0d5',.9,4,4);bounce.position.set(2,5,5);bounce.lookAt(-1,2.1,0);this.group.add(bounce);
      this.group.add(new THREE.HemisphereLight('#d4e4ed','#856044',.16));
      const leaves=new THREE.Mesh(assets.foliage,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide}));
      leaves.name='Garden leaves casting dappled sunlight';leaves.castShadow=true;leaves.frustumCulled=false;this.group.add(leaves);
      // r161 filters shadow casters using the viewing camera's layers. Use a
      // per-shadow-camera depth discard to keep foliage out of the second map.
      const skipFoliage={value:0};leaves.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
      leaves.customDepthMaterial.onBeforeCompile=shader=>{
        shader.uniforms.skipFoliage=skipFoliage;
        shader.fragmentShader='uniform float skipFoliage;\n'+shader.fragmentShader.replace('void main() {','void main() { if(skipFoliage>.5)discard;');
      };
      leaves.customDepthMaterial.customProgramCacheKey=()=> 'living-filter-foliage-shadow';
      leaves.onBeforeShadow=(_renderer,_object,_camera,shadowCamera)=>{skipFoliage.value=shadowCamera===ceramicShadow.shadow.camera?1:0;};
    }else{
    const key = new THREE.SpotLight('#ffe0aa', 165, 0, .345, .65, 2);
    key.position.set(-4.4, 6.3, 3.5); key.target.position.set(-1, 2.3, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = .015; key.shadow.bias = -.00003;
    key.shadow.camera.near = .4; key.shadow.camera.far = 20; this.group.add(key, key.target);
    const fill = new THREE.RectAreaLight('#c7dfff', 2.3, 1, 2);
    fill.position.set(1.65, 4.6, 2.8); fill.lookAt(-1, 2.3, 0); this.group.add(fill);
    const rim = new THREE.SpotLight('#ffd69b', 105, 0, .325, .65, 2);
    rim.position.set(-2.4, 5.4, -2.1); rim.target.position.set(-1, 2.2, 0); this.group.add(rim, rim.target);
    this.group.add(new THREE.HemisphereLight('#b9cec7', '#302c20', .13));
    }
    const contactCanvas = document.createElement('canvas'); contactCanvas.width = contactCanvas.height = 128;
    const ctx = contactCanvas.getContext('2d'), grad = ctx.createRadialGradient(64,64,8,64,64,64);
    grad.addColorStop(0,'rgba(0,0,0,.35)'); grad.addColorStop(.56,'rgba(0,0,0,.22)'); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.65), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(contactCanvas), transparent:true, depthWrite:false, toneMapped:false }));
    this.contact.rotation.x = -Math.PI/2; this.contact.position.set(-1,this.supportHeight+.004,0); this.contact.renderOrder = -18; this.group.add(this.contact);

    const canvas = world.renderer.domElement;
    canvas.addEventListener('pointerdown', e => {
      if (!this.active || e.button !== 0) return;
      this.pointer = { id:e.pointerId, x:e.clientX }; this.velocity = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.active || this.pointer?.id !== e.pointerId) return;
      const delta = (e.clientX-this.pointer.x)*.007; world.mesh.rotation.y += delta; this.velocity=delta; this.pointer.x=e.clientX;
    });
    const release=e=>{if(this.pointer?.id!==e.pointerId)return;this.pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab';};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{this.pointer=null;canvas.style.cursor=this.active?'grab':''});
    canvas.addEventListener('wheel',e=>{if(!this.active)return;e.preventDefault();this.zoom=THREE.MathUtils.clamp(this.zoom*Math.exp(-e.deltaY*.0007),1,1.65);this.applyCamera();},{passive:false});
    canvas.tabIndex=0;
    canvas.addEventListener('keydown',e=>{if(!this.active)return;if(['ArrowLeft','ArrowRight','+','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')world.mesh.rotation.y-=.15;if(e.key==='ArrowRight')world.mesh.rotation.y+=.15;if(e.key==='+')this.zoom=Math.min(1.65,this.zoom+.1);if(e.key==='-')this.zoom=Math.max(1,this.zoom-.1);if(e.key==='Home'){world.mesh.rotation.y=world.mesh.userData.form==='jar'?0:Math.PI;this.zoom=1;}this.applyCamera();}});
    const previous = world.onFrame;
    world.onFrame = now => { previous?.(now);this.tick(now); };
  }
  enter() {
    const {world}=this;
    if (!this.active) {
      this.standardPose={position:world.mesh.position.clone(),scale:world.mesh.scale.clone(),layers:world.mesh.layers.mask,receiveShadow:world.mesh.receiveShadow};
      this.muted.forEach(o=>{o.userData.museumWasVisible=o.visible;o.visible=false;});
    }
    this.active=true;this.group.visible=true;world.controls.enabled=false;world.controls.autoRotate=false;
    world.renderFrame=this.renderFrame;
    world.scene.environment=this.probe.texture;world.renderer.toneMappingExposure=this.living?1.0:.88;world.scene.fog=null;
    world.mesh.geometry.computeBoundingBox();const bounds=world.mesh.geometry.boundingBox;
    const dimensions=bounds.getSize(new THREE.Vector3()),form=world.mesh.userData.form;
    const scale=form==='jar'?1:form==='bowl'?Math.min(1.18,2.2/dimensions.x):2.65/dimensions.y;
    world.mesh.scale.setScalar(scale);world.mesh.position.set(-1,this.supportHeight-bounds.min.y*scale,0);
    world.mesh.material.envMapIntensity=this.living?.8:.63;world.mesh.receiveShadow=this.living;
    this.contact.scale.setScalar(form==='bowl'?.83:form==='vase'?.70:1);
    world.renderer.domElement.style.cursor='grab';world.renderer.domElement.setAttribute('aria-label',`${this.living?'窗边':'藏品'}陶器：左右拖动或方向键旋转，滚轮或加减键调整取景`);
    this.applyCamera();
  }
  leave() {
    if (!this.active)return;
    const {world}=this;this.active=false;this.group.visible=false;this.pointer=null;this.velocity=0;this.autoRotate=false;
    if(world.renderFrame===this.renderFrame)world.renderFrame=null;
    this.muted.forEach(o=>{o.visible=o.userData.museumWasVisible??true;});
    world.scene.environment=this.environment;world.camera.clearViewOffset();world.camera.fov=31;world.controls.enabled=true;
    if(this.standardPose){world.mesh.scale.copy(this.standardPose.scale);world.mesh.position.copy(this.standardPose.position);world.mesh.layers.mask=this.standardPose.layers;world.mesh.receiveShadow=this.standardPose.receiveShadow;}
    world.renderer.domElement.style.cursor='';
  }
  setView(view) { this.view=view;this.zoom=view==='detail'&&!this.living?1.4:1;this.velocity=0;this.applyCamera(); }
  cameraKey(){return this.assets.manifest.cameras[this.view]?this.view:'full';}
  crop(width,height) {
    const info=this.assets.manifest.cameras[this.cameraKey()];
    const w=info.width,h=info.height,aspect=width/height;
    let cw=w,ch=h;
    if(aspect<w/h)cw=h*aspect;else ch=w/aspect;
    const [anchorX,anchorY]=this.assets.manifest.anchors?.[this.view]||this.assets.manifest.anchor||[.4,.49];
    const left=THREE.MathUtils.clamp(w*anchorX-cw*.5,0,w-cw);
    const top=THREE.MathUtils.clamp(h*anchorY-ch*.5,0,h-ch);
    const relativeX=(w*anchorX-left)/cw,relativeY=(h*anchorY-top)/ch;
    cw/=this.zoom;ch/=this.zoom;
    return {info,x:w*anchorX-relativeX*cw,y:h*anchorY-relativeY*ch,w:cw,h:ch};
  }
  applyCamera(width,height) {
    if(!this.active)return;
    const {world}=this;
    if(!width||!height){const size=world.renderer.getSize(new THREE.Vector2());width=size.x;height=size.y;}
    const crop=this.crop(width,height),info=crop.info;
    world.camera.position.fromArray(info.position);world.camera.quaternion.fromArray(info.quaternion);world.camera.fov=info.fov;
    world.camera.setViewOffset(info.width,info.height,crop.x,crop.y,crop.w,crop.h);
    const texture=this.assets.plates[this.cameraKey()];
    texture.repeat.set(crop.w/info.width,crop.h/info.height);texture.offset.set(crop.x/info.width,1-(crop.y+crop.h)/info.height);texture.updateMatrix();
    world.scene.background=texture;
  }
  render() {
    const {world}=this;
    if(this.active&&this.living&&this.view==='detail'){
      const size=world.renderer.getSize(new THREE.Vector2());
      this.optics.render(this.assets.manifest.cameras.detail,this.crop(size.x,size.y));
    }else world.renderer.render(world.scene,world.camera);
  }
  tick(now) {
    const dt=Math.min(40,now-(this.lastTime||now));this.lastTime=now;
    if(!this.active)return;
    if(this.autoRotate&&!this.pointer)this.world.mesh.rotation.y+=dt*.00018;
    if(!this.pointer&&Math.abs(this.velocity)>.00003){this.world.mesh.rotation.y+=this.velocity;this.velocity*=.88;}
    this.applyCamera();
  }
  renderPhoto(width,height) {
    const {world}=this,{renderer}=world,size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    const out=document.createElement('canvas');out.width=width;out.height=height;
    try{renderer.setPixelRatio(1);renderer.setSize(width,height,false);this.applyCamera(width,height);this.render();out.getContext('2d').drawImage(renderer.domElement,0,0);}
    finally{renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);this.applyCamera(size.x,size.y);this.render();}
    return out;
  }
}
