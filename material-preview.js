import * as THREE from 'three';
import {starterProfile} from './vessel-presets.mjs';
import {shapedGeometry} from './vessel-geometry.js';
import {applyFiredGlaze} from './glaze-surface.mjs';

let preview;
function studio(){
 if(preview)return preview;
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(1);renderer.setSize(144,136);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,144/136,.1,20);camera.position.set(0,1.7,4.7);camera.lookAt(0,.86,0);
 scene.add(new THREE.HemisphereLight(0xfff7e9,0xa58c70,.75));
 for(const [position,power] of [[[-3,4,5],2.1],[[3,2,1],.4]]){const light=new THREE.DirectionalLight(0xfff9ee,power);light.position.set(...position);scene.add(light);}
 const probe=document.createElement('canvas');probe.width=256;probe.height=128;const c=probe.getContext('2d'),g=c.createLinearGradient(0,0,0,128);g.addColorStop(0,'#fff6e5');g.addColorStop(.55,'#ad9782');g.addColorStop(1,'#493728');c.fillStyle=g;c.fillRect(0,0,256,128);c.fillStyle='#fffaf1';c.fillRect(38,24,27,47);c.fillStyle='#d3c5b4';c.fillRect(170,34,35,38);
 const texture=new THREE.CanvasTexture(probe);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture);scene.environment=environment.texture;pmrem.dispose();texture.dispose();
 const mesh=new THREE.Mesh(shapedGeometry(starterProfile('jar'),48,36),new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.22,clearcoat:.7,clearcoatRoughness:.18,envMapIntensity:.65}));scene.add(mesh);
 preview={renderer,scene,camera,mesh};return preview;
}

// One reusable off-screen renderer. The samples use the same firing outputs as the work.
export function drawMaterialPreview(canvas,baked,width,height,finish,detail=false){
 const p=studio(),textures=[];
 const swatch=detail==='swatch';
 let focusY=detail?.93:.86;p.mesh.rotation.y=0;
 // Frame a real crystal from the baked surface, never grow one for the icon.
 if(swatch&&finish==='satin'){
  let peak=-1,px=0,py=0;for(let y=Math.floor(height*.40);y<height*.75;y++)for(let x=0;x<width;x++){const strength=baked.roughness[(y*width+x)*4];if(strength>peak){peak=strength;px=x;py=y;}}
  p.mesh.rotation.y=-px/width*Math.PI*2;focusY=.035+1.72*(.975-py/height)/.705;
 }
 const swatchDistance=finish==='crackle'?1.45:1.65;
 p.camera.position.set(swatch?.15:detail?.32:0,swatch?focusY+.16:detail?1.15:1.6,swatch?swatchDistance:detail?1.7:4.05);p.camera.lookAt(0,focusY,0);
 for(const [property,key] of [['map','color'],['roughnessMap','roughness'],['clearcoatMap','coat'],['bumpMap','relief']]){
  const t=new THREE.DataTexture(baked[key],width,height,THREE.RGBAFormat);t.flipY=true;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;if(key==='color')t.colorSpace=THREE.SRGBColorSpace;p.mesh.material[property]=t;textures.push(t);
 }
 applyFiredGlaze(p.mesh.material,finish);
 p.renderer.render(p.scene,p.camera);canvas.width=144;canvas.height=detail?106:136;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(detail)ctx.drawImage(p.renderer.domElement,0,15,144,106,0,0,144,106);else ctx.drawImage(p.renderer.domElement,0,0);
 for(const property of ['map','roughnessMap','clearcoatMap','bumpMap'])p.mesh.material[property]=null;textures.forEach(t=>t.dispose());
}
