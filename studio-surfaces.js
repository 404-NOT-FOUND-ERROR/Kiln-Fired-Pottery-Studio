import * as THREE from 'three';

// Baked once in memory; no room geometry or texture downloads are needed.
const stoneCanvases=new Map();
function stoneMaps(side=false){
  if(!stoneCanvases.has(side)){
    const n=768,canvases=Array.from({length:3},()=>Object.assign(document.createElement('canvas'),{width:n,height:n}));
    const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(n,n));let seed=57281;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const noise=Float32Array.from({length:128*128},random);
    const field=(x,y,s)=>{x=x/s;y=y/s;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),at=(a,b)=>noise[((b%128+128)%128)*128+(a%128+128)%128];return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;};
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const r=Math.hypot(x-n/2,y-n/2),theta=Math.atan2(y-n/2,x-n/2),grain=random()-.5;
      const clouds=field(x,y,91)*.6+field(x,y,26)*.4-.5,fine=field(x,y,3)-.5;
      const vein=Math.pow(Math.max(0,Math.sin(x*.018+y*.031+field(x,y,80)*8)),12);
      const wheel=Math.sin(r*.27+Math.sin(r*.029)*1.5+Math.sin(theta*3)*.06);
      const wear=side?Math.sin(y*.24+field(x,y,48)*2)*1.7:wheel*(2+field(x,y,32)*4)+Math.sin(r*.83)*1.4;
      const pore=Math.pow(Math.max(0,(.3-field(x,y,1.8))/.3),2)*40;
      const tone=clouds*44+fine*15+grain*7-vein*5+wear-pore;
      const i=(y*n+x)*4,base=side?[133,127,118]:[158,154,148];
      images[0].data.set([...base.map(v=>v+tone),255],i);
      const bump=132+clouds*8+fine*15+grain*6+wear*2.5-pore,rough=199+fine*18+clouds*12-wear;
      images[1].data.set([bump,bump,bump,255],i);images[2].data.set([rough,rough,rough,255],i);
    }
    contexts.forEach((c,i)=>c.putImageData(images[i],0,0));stoneCanvases.set(side,canvases);
  }
  return stoneCanvases.get(side).map((c,i)=>{const t=new THREE.CanvasTexture(c);t.anisotropy=8;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(!i)t.colorSpace=THREE.SRGBColorSpace;return t;});
}

export function createStoneSupport(height=.19){
  const group=new THREE.Group();group.name='Honed stone turning disc';
  const materials=[false,true].map(side=>{const [map,bumpMap,roughnessMap]=stoneMaps(side);return new THREE.MeshPhysicalMaterial({map,bumpMap,roughnessMap,bumpScale:side?.024:.04,roughness:.86,metalness:0,clearcoat:.08,clearcoatRoughness:.44,specularIntensity:.4});});
  // A recessed foot, an undercut rim and a narrow, gently rounded upper arris.
  const section=[[0,.028],[1.14,.028],[1.17,.03],[1.19,.04],[1.19,.055],[1.31,.055],[1.355,.066],[1.371,.08],[1.377,.10],[1.377,height-.032],[1.373,height-.018],[1.364,height-.008],[1.35,height-.002],[1.325,height],[1.26,height],[.9,height],[.5,height],[0,height]];
  const geometry=new THREE.LatheGeometry(section.map(p=>new THREE.Vector2(...p)),160).toNonIndexed(),position=geometry.attributes.position,uv=geometry.attributes.uv;
  geometry.clearGroups();
  for(let i=0;i<position.count;i+=3){
    const top=Math.min(position.getY(i),position.getY(i+1),position.getY(i+2))>height-.019;
    geometry.addGroup(i,3,top?0:1);
    for(let j=i;j<i+3;j++){
      if(top)uv.setXY(j,position.getX(j)/2.78+.5,position.getZ(j)/2.78+.5);
      else uv.setY(j,position.getY(j)*4);
    }
  }
  // Merge adjacent material groups to keep draw calls bounded.
  const runs=[];for(const g of geometry.groups){const previous=runs.at(-1);if(previous&&previous.materialIndex===g.materialIndex)previous.count+=g.count;else runs.push({...g});}geometry.groups=runs;
  // Lathe order alternates top and edge per segment. Split the index by material.
  const indices=[[],[]];for(const g of geometry.groups)for(let i=g.start;i<g.start+g.count;i++)indices[g.materialIndex].push(i);
  geometry.setIndex(indices.flat());geometry.clearGroups();geometry.addGroup(0,indices[0].length,0);geometry.addGroup(indices[0].length,indices[1].length,1);
  const mesh=new THREE.Mesh(geometry,materials);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  return group;
}

export function createWorkshopReflection(renderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#9b9184');
  // Match the bright sweep: a broad upper-left window, pale fill and floor bounce.
  const cards=[[2.8,4.8,-3.8,4.6,1.7,'#fff7ec',5.6],[5,5,4,2,4,'#f1eee8',.85],[3,2,-1,5,-3,'#fff6e8',1.2],[10,10,0,-1,0,'#e8dcc9',.40]];
  for(const [w,h,x,y,z,color,power] of cards){const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));card.position.set(x,y,z);card.lookAt(0,1,0);scene.add(card);}
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(scene,.045,.1,30);generator.dispose();scene.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});return target;
}

// A narrow contact penumbra, separate from the directional cast shadow.
// The opaque core stays hidden below the object; only its soft edge is visible.
export function createContactShadow(radius,y,opacity=.5,tight=false){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(61,45,31,1)');g.addColorStop(tight?.86:.76,'rgba(61,45,31,.95)');g.addColorStop(tight?.94:.90,'rgba(61,45,31,.48)');g.addColorStop(1,'rgba(61,45,31,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity,depthWrite:false,toneMapped:false});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),material);shadow.rotation.x=-Math.PI/2;shadow.position.y=y;return shadow;
}
