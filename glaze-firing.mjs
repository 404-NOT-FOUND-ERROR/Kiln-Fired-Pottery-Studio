// Authored effect-glaze model. Thickness, pooling and UV gravity drive the visual
// result; these recipes are illustrations, not predictions of ceramic chemistry.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y,seed)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const wrap=(n,d)=>((n%d)+d)%d;
export const FIRING_VERSION=5;
export function glazeSurfaceAspect(profile){
 if(!profile?.radii?.length||!profile.height)return 2.3;
 const radius=profile.radii.reduce((sum,r)=>sum+r,0)/profile.radii.length;
 return clamp(.705*2*Math.PI*radius/profile.height,.7,5);
}
// The UI reports 5 cm per studio unit. These are authored visual scales for
// this collection of recipes, not universal limits on real crystalline glazes.
export function glazeSurfaceHeightMM(profile){return profile?.height?profile.height*50:86;}
const exteriorUV=.705;
const featurePitchMM={crystal:9.5,crackle:4.8,secondary:2.0,ironFine:1.65,ironCoarse:3.8};
function noise(u,v,nx,ny,seed){
  const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy);
  return mix(mix(hash(wrap(ix,nx),iy,seed),hash(wrap(ix+1,nx),iy,seed),fx),mix(hash(wrap(ix,nx),iy+1,seed),hash(wrap(ix+1,nx),iy+1,seed),fx),fy);
}
function cell(u,v,nx,ny,seed){
  const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y);let first=100,second=100,id=0,dx=0,dy=0;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const cx=ix+ox,cy=iy+oy,px=cx+.15+.7*hash(wrap(cx,nx),cy,seed),py=cy+.15+.7*hash(wrap(cx,nx),cy,seed+113),xx=x-px,yy=y-py,d=xx*xx+yy*yy;
    if(d<first){second=first;first=d;id=hash(wrap(cx,nx),cy,seed+319);dx=xx;dy=yy;}else if(d<second)second=d;
  }
  return {distance:Math.sqrt(first),edge:(Math.sqrt(second)-Math.sqrt(first))*.5,id,angle:Math.atan2(dy,dx)};
}
const cache=new Map();
function fields(seed,surfaceAspect,surfaceHeightMM){
  const aspect=Math.round(clamp(surfaceAspect,.7,5)*20)/20,heightMM=Math.round(clamp(surfaceHeightMM,35,220)),key=seed+':'+aspect+':'+heightMM;
  if(cache.has(key))return cache.get(key);
  const n=640,maps=Array.from({length:13},()=>new Float32Array(n*n));
  const rows=Object.fromEntries(Object.entries(featurePitchMM).map(([name,pitch])=>[name,Math.max(3,Math.round(heightMM/(exteriorUV*pitch)))]));
  // Integrate a thin edge over a field texel. Point sampling would turn a
  // continuous fracture into dashed dots as its width falls below one texel.
  const lineCoverage=(edge,width,count)=>{const aa=Math.max(count,Math.round(count*aspect))/(2*n);return clamp((width+aa-edge)/(2*aa));};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/(n-1),i=y*n+x,broad=noise(u,v,9,13,seed+47),detail=noise(u,v,27,34,seed+83),fine=noise(u,v,117,151,seed+137),warp=(detail-.5)*.023;
    // Keep the warp in physical units too; large pots should not stretch it.
    const bend=86/heightMM;
    const c=cell(u+warp*bend,v+(broad-.5)*.009*bend,Math.round(rows.crackle*aspect),rows.crackle,seed),secondary=cell(u+warp*bend,v+(broad-.5)*.009*bend,Math.round(rows.secondary*aspect),rows.secondary,seed+3001),star=cell(u,v,Math.round(rows.crystal*aspect),rows.crystal,seed+701),spot=cell(u+warp*.18*bend,v,Math.round(rows.ironFine*aspect),rows.ironFine,seed+1309),iron=cell(u+warp*.14*bend,v,Math.round(rows.ironCoarse*aspect),rows.ironCoarse,seed+1709);
    maps[0][i]=broad;maps[1][i]=detail*.64+noise(u,v,59,73,seed+193)*.36;maps[2][i]=fine;
    maps[3][i]=noise(u+(broad-.5)*.07,v,21,4,seed+431);maps[4][i]=lineCoverage(c.edge,.018,rows.crackle);
    // Sparse radial crystal clusters sit within a continuous glassy ground.
    const size=(star.id*31)%1,radius=(.08+.22*size**1.6)*(1+.20*Math.sin(star.angle*3+star.id*14)+.10*Math.cos(star.angle*5)),fan=star.id>.88?1:.25+.75*smooth(-.75,.05,Math.cos(star.angle-star.id*17)),branches=.5+.5*Math.cos(star.angle*(10+Math.floor(star.id*13))+star.id*18+1.6*Math.sin(star.angle*3+star.id*9)+star.distance*16+(fine-.5)*1.4),crystalEdge=smooth(radius+.04,radius-.045,star.distance)*(star.id>.73?1:0);
    maps[5][i]=crystalEdge*fan*(.34+.46*branches+.20*fine);
    maps[11][i]=crystalEdge*fan*smooth(.10,.015,star.distance);
    const ironRadius=.085+iron.id*.055,ironActive=iron.id>.88?1:0;
    maps[6][i]=Math.max(smooth(.105+spot.id*.045,.008,spot.distance)*(spot.id>.81?.88:0),smooth(ironRadius,.008,iron.distance)*ironActive);
    maps[12][i]=smooth(ironRadius+.055,ironRadius*.3,iron.distance)*ironActive;maps[7][i]=c.id;
    maps[8][i]=noise(u+(broad-.5)*.035,v+warp,83,47,seed+2317)*.62+fine*.38;
    maps[9][i]=lineCoverage(secondary.edge,.009,rows.secondary);
    maps[10][i]=noise(u+(detail-.5)*.013,v+(broad-.5)*.035,31,7,seed+3917)*.72+noise(u+warp*.2,v,73,29,seed+4051)*.28;
  }
  if(cache.size>3)cache.delete(cache.keys().next().value);const value={n,maps};cache.set(key,value);return value;
}
function field(f,k,u,v){
  const x=wrap(u,1)*f.n,y=clamp(v)*(f.n-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=f.maps[k],nx=(ix+1)%f.n,ny=Math.min(f.n-1,iy+1);
  return mix(mix(a[iy*f.n+ix],a[iy*f.n+nx],fx),mix(a[ny*f.n+ix],a[ny*f.n+nx],fx),fy);
}
function pixel(a,w,h,x,y,out){
  const px=wrap(x,w),py=clamp(y,0,h-1),ix=Math.floor(px),iy=Math.floor(py),nx=(ix+1)%w,ny=Math.min(h-1,iy+1),fx=px-ix,fy=py-iy;
  const indices=[(iy*w+ix)*4,(iy*w+nx)*4,(ny*w+ix)*4,(ny*w+nx)*4],weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  let alpha=0;out.fill(0);for(let j=0;j<4;j++){const p=indices[j],amount=a[p+3]/255*weights[j];alpha+=amount;for(let c=0;c<3;c++)out[c]+=a[p+c]*amount;}
  if(alpha>0)for(let c=0;c<3;c++)out[c]/=alpha;out[3]=alpha;return out;
}
function companions(r,g,b){
  if(g>r*1.08&&g>b*.88)return {thin:[181,205,191],deep:[27,85,81],accent:[143,93,131]};
  if(b>r*1.12&&b>g*.98)return r>g*1.13?{thin:[194,172,194],deep:[68,38,92],accent:[188,136,62]}:{thin:[153,187,209],deep:[25,43,88],accent:[159,111,75]};
  if(r>g*1.19&&r>b*1.12)return {thin:[219,167,126],deep:[103,29,35],accent:[57,112,115]};
  if(r>g*1.08&&g>b*1.14)return {thin:[212,186,129],deep:[91,59,29],accent:[67,114,91]};
  return {thin:[214,221,211],deep:[78,94,87],accent:[154,103,77]};
}
export const firingFamilies={
  gloss:{name:'流彩',copy:'厚处聚色，色晕沿器壁流动交融。'},
  satin:{name:'晶花',copy:'晶花在冷却中生长，玻璃质釉底仍有光泽。'},
  speckle:{name:'铁斑',copy:'细小铁色斑点散落在釉中，表面保持润泽。'},
  crackle:{name:'开片',copy:'釉与胎的收缩差留下细纹，釉面仍然光滑。'}
};
export function fireLayers({width:w,height:h,base,underglaze,glaze,foot,clearGlaze=false,finish='gloss',fire='氧化焰',cooling='缓冷',seed=736513,surfaceAspect=2.3,surfaceHeightMM=86}){
  const heightMM=clamp(surfaceHeightMM,35,220),f=fields(seed,surfaceAspect,heightMM),size=w*h*4,color=new Uint8ClampedArray(size),coat=new Uint8ClampedArray(size),roughness=new Uint8ClampedArray(size),relief=new Uint8ClampedArray(size),s=new Float64Array(4),original=new Float64Array(4);
  const slow=cooling==='缓冷',energy=fire==='还原焰'?1.23:fire==='柴烧'?1.52:1,verticalPixelsPerMM=h*exteriorUV/heightMM,horizontalPixelsPerMM=w*exteriorUV/(heightMM*clamp(surfaceAspect,.7,5));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,u=x/w,v=y/h,allowed=foot?foot[i+3]/255:1;
    const a=glaze[i+3]/255,n0=field(f,0,u,v),n1=field(f,1,u,v),n2=field(f,2,u,v),ribbon=field(f,3,u,v),edge=field(f,4,u,v),crystal=field(f,5,u,v),spot=field(f,6,u,v),mineral=field(f,8,u,v);
    // On the exterior UV, gravity is +Y; on the interior it is -Y.
    const exterior=v>=.265,direction=exterior?1:-1,flow=finish==='gloss'?1:finish==='speckle'?.35:finish==='satin'?.1:.07;
    const fall=(.35+3.8*ribbon)*Math.pow(a,1.35)*flow*energy*verticalPixelsPerMM;
    const upstream=clamp(y-direction*fall,exterior?.265*h:0,exterior?h-1:.265*h-1);
    pixel(glaze,w,h,x+(n0-.5)*.55*flow*horizontalPixelsPerMM,upstream,s);
    pixel(glaze,w,h,x,y,original);
    let amount=clamp(Math.max(original[3]*.94,s[3])*(.97+.06*n1))*allowed;
    const opacity=(1-Math.exp(-amount*3))/(1-Math.exp(-3)),coverage=clearGlaze?allowed:(1-Math.exp(-amount*4))/(1-Math.exp(-4));
    const source=s[3]>.001?s:original,p=companions(source[0],source[1],source[2]),thickness=clamp(amount*1.2),pool=smooth(.3,.85,amount)*(.3+.7*ribbon),stream=field(f,10,u,v),bloom=smooth(.40,.70,finish==='gloss'?n0*.15+stream*.60+mineral*.25:n0*.30+n1*.44+mineral*.26);
    const luminance=.2126*source[0]+.7152*source[1]+.0722*source[2],lightGround=smooth(165,205,luminance),darkGround=1-smooth(70,105,luminance);
    let glazeRough=.17,textureHeight=.5;
    for(let c=0;c<3;c++){
      const underAlpha=underglaze[i+3]/255;
      const substrate=mix(base[i+c],underglaze[i+c],underAlpha);
      let pigment=mix(source[c],p.thin[c],.16*(1-thickness));
      if(finish==='satin'){
        const growth=smooth(.14,.70,amount),crystalColor=mix(mix(source[c],p.thin[c],.72),mix(source[c],p.accent[c],.48),lightGround);
        pigment=mix(pigment,p.deep[c],.15+mineral*.045);pigment=mix(pigment,crystalColor,crystal*growth*(slow?.82:.42));pigment=mix(pigment,p.deep[c],field(f,11,u,v)*growth*(slow?.09:.04));pigment*=.98+mineral*.04;
        glazeRough=.16+crystal*growth*(slow?.12:.06);textureHeight=.5+crystal*growth*.012+(mineral-.5)*.003;
      }else if(finish==='speckle'){
        pigment=mix(pigment,p.deep[c],.055+n1*.04);pigment=mix(pigment,[154,103,55][c],field(f,12,u,v)*.40);pigment=mix(pigment,mix([42,32,22][c],[192,128,66][c],darkGround),spot*(slow?.95:.82));pigment*=.98+mineral*.04;
        glazeRough=.15+n2*.025-spot*.012;textureHeight=.5+spot*.008;
      }else if(finish==='crackle'){
        const fracture=Math.max(edge,field(f,9,u,v)*(.14+.14*n0));
        const lineColor=mix(mix(p.deep[c],[81,86,72][c],.22),mix(p.thin[c],p.deep[c],.25),darkGround);
        pigment=mix(pigment,p.thin[c],.09);pigment=mix(pigment,p.deep[c],pool*.045);pigment*=.982+field(f,7,u,v)*.036;pigment=mix(pigment,lineColor,fracture*.42);
        glazeRough=.13+n2*.018+fracture*.016;textureHeight=.5-fracture*.012;
      }else{
        pigment=mix(pigment,p.deep[c],pool*(slow?.48:.37));pigment=mix(pigment,p.accent[c],bloom*pool*(slow?.36:.22));pigment=mix(pigment,p.thin[c],smooth(.46,.70,stream)*.28*(1-thickness*.25));pigment*=.95+.10*stream;
        glazeRough=.12+n2*.028;textureHeight=.5+pool*.016+(mineral-.5)*.004;
      }
      if(fire==='还原焰'){pigment=mix(pigment,p.deep[c],smooth(.48,.77,n0)*.10);pigment*=c===0?.96:c===1?1.01:1.025;}
      if(fire==='柴烧'){pigment=mix(pigment,[139,107,63][c],smooth(.57,.8,n0)*.25);pigment=mix(pigment,[207,198,166][c],smooth(.72,.89,n1)*.18);}
      color[i+c]=mix(substrate,pigment,opacity);coat[i+c]=coverage*255;
      roughness[i+c]=mix(.88,(amount>.01?glazeRough:.14)+(slow?.008:0),coverage)*255;
      relief[i+c]=mix(.5,textureHeight,amount)*255;
    }
    color[i+3]=coat[i+3]=roughness[i+3]=relief[i+3]=255;
  }
  return {color,coat,roughness,relief};
}
