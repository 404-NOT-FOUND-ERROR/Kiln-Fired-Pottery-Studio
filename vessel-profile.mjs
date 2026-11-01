// One physical profile travels from wet clay to the shelf; dimensions are studio units.
export const PROFILE_VERSION=2;
const ANGLES=24;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function newProfile(form='jar',preset='blank') {
  const silhouettes={jar:[.57,.66,.76,.85,.9,.93,.95,.96,.96,.94,.91,.86,.79,.7,.59,.5,.47,.47,.49,.5],vase:[.42,.48,.54,.59,.64,.7,.75,.78,.8,.79,.75,.68,.58,.46,.34,.3,.29,.29,.3,.32],bowl:[.38,.44,.51,.59,.68,.77,.85,.93,1,1.07,1.13,1.18,1.22,1.26,1.29,1.32,1.34,1.36,1.38,1.4]};
  let radii=[...(silhouettes[form]||silhouettes.jar)],height={jar:2.15,vase:2.85,bowl:1.15}[form]||2.15;
  if(form==='jar'&&preset==='blank'){radii=radii.map((_,i)=>.64+.085*Math.sin(i/19*Math.PI));height=1.7;}
  const profile={version:PROFILE_VERSION,form,height,radii,wall:.085,trimmed:false};return preset==='handmade'?handmadeProfile(profile):profile;
}
export function normalizeProfile(value) {
  const fallback=newProfile(value?.form||'jar');
  if(!value||!Array.isArray(value.radii)||value.radii.length!==20)return fallback;
  const p={version:PROFILE_VERSION,form:['jar','vase','bowl'].includes(value.form)?value.form:'jar',height:Math.max(.85,Math.min(3.5,Number(value.height)||fallback.height)),radii:value.radii.map((r,i)=>Math.max(.24,Math.min(1.5,Number(r)||fallback.radii[i]))),wall:Math.max(.06,Math.min(.14,Number(value.wall)||.085)),trimmed:!!value.trimmed};
  if(value.deformation?.radial?.length===20*ANGLES&&value.deformation?.lift?.length===20*ANGLES){
    p.deformation={radial:Array.from(value.deformation.radial,x=>clamp(Number(x)||0,-.23,.23)),lift:Array.from(value.deformation.lift,x=>clamp(Number(x)||0,-.08,.08))};
    const limit=p.height/19*.38;for(let i=0;i<20;i++)for(let j=0;j<ANGLES;j++){const n=i*ANGLES+j;if(i<2){p.deformation.radial[n]=0;p.deformation.lift[n]=0;}else p.deformation.lift[n]=clamp(p.deformation.lift[n],p.deformation.lift[n-ANGLES]-limit,p.deformation.lift[n-ANGLES]+limit);}
  }return p;
}
export const cloneProfile=value=>structuredClone(normalizeProfile(value));
export function radiusAt(profile,fraction) {
  const t=Math.max(0,Math.min(1,fraction))*19,i=Math.floor(t),f=t-i,a=profile.radii[Math.max(0,i-1)],b=profile.radii[i],c=profile.radii[Math.min(19,i+1)],d=profile.radii[Math.min(19,i+2)];
  return Math.max(.24,Math.min(1.5,.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)));
}
export function sculptProfile(profile,{fraction,radial=0,vertical=0,tool='push',radius=1,strength=1}) {
  radial*=strength;vertical*=strength;
  const p=cloneProfile(profile),center=Math.max(.06,Math.min(1,fraction));
  if(tool==='height'){p.height=Math.max(.85,Math.min(3.5,p.height+vertical));const factor=Math.max(.96,Math.min(1.04,1-vertical*.1));p.radii=p.radii.map((r,i)=>i<2?r:Math.max(.24,Math.min(1.5,r*factor)));}
  else {const source=[...p.radii];p.radii=p.radii.map((r,i)=>{if(i===0)return r;const distance=(i/19-center)/(.145*radius),weight=Math.exp(-distance*distance*.5),change=tool==='smooth'?((source[Math.max(0,i-1)]+source[Math.min(19,i+1)])/2-r)*.55*strength:radial;return Math.max(.24,Math.min(1.5,r+change*weight));});if(tool==='push')p.height=Math.max(.85,Math.min(3.5,p.height+vertical*.22));}
  for(let pass=0;pass<2;pass++)for(let i=1;i<20;i++)p.radii[i]=Math.max(p.radii[i-1]-.19,Math.min(p.radii[i-1]+.19,p.radii[i]));
  return p;
}
export function deformationAt(p,fraction,angle){
  if(!p.deformation)return {radial:0,lift:0};
  const t=clamp(fraction,0,1)*19,a=((angle/(Math.PI*2)%1+1)%1)*ANGLES,i=Math.floor(t),j=Math.floor(a),ft=t-i,fa=a-j;
  const sample=field=>{const x=field[i*ANGLES+j],y=field[i*ANGLES+(j+1)%ANGLES],ni=Math.min(19,i+1),z=field[ni*ANGLES+j],w=field[ni*ANGLES+(j+1)%ANGLES];return (x*(1-fa)+y*fa)*(1-ft)+(z*(1-fa)+w*fa)*ft;};
  return {radial:clamp(sample(p.deformation.radial),.1+p.wall-radiusAt(p,fraction),.23),lift:sample(p.deformation.lift)};
}
export function sculptLocal(profile,{fraction,angle,radial=0,vertical=0,tool='pinch',radius=1,strength=1}){
  radial*=strength;vertical*=strength;
  const p=cloneProfile(profile);p.deformation??={radial:Array(20*ANGLES).fill(0),lift:Array(20*ANGLES).fill(0)};
  const source=p.deformation.radial.slice(),height=p.deformation.lift.slice(),center=clamp(fraction,.06,1);
  for(let i=2;i<20;i++)for(let j=0;j<ANGLES;j++){
    let da=j/ANGLES*Math.PI*2-angle;da=Math.atan2(Math.sin(da),Math.cos(da));const weight=Math.exp(-Math.pow((i/19-center)/(.12*radius),2)*.5-Math.pow(da/(.55*radius),2)*.5),n=i*ANGLES+j;
    if(tool==='smooth'){const neighbours=[(i-1)*ANGLES+j,Math.min(19,i+1)*ANGLES+j,i*ANGLES+(j+1)%ANGLES,i*ANGLES+(j+ANGLES-1)%ANGLES];p.deformation.radial[n]+=(neighbours.reduce((s,k)=>s+source[k],0)/4-source[n])*.45*strength*weight;p.deformation.lift[n]+=(neighbours.reduce((s,k)=>s+height[k],0)/4-height[n])*.45*strength*weight;}
    else {p.deformation.radial[n]+=radial*weight;p.deformation.lift[n]+=vertical*weight*.23;}
  }
  return normalizeProfile(p);
}
export function handmadeProfile(profile,seed=49173){
  const p=cloneProfile(profile);p.deformation={radial:[],lift:[]};const phase=(seed%971)/971*Math.PI*2;
  for(let i=0;i<20;i++)for(let j=0;j<ANGLES;j++){const t=i/19,a=j/ANGLES*Math.PI*2,fade=Math.pow(Math.sin(t*Math.PI/2),1.4);p.deformation.radial.push(i<2?0:fade*(.075*Math.sin(a+phase)*Math.sin(t*4)+.06*Math.cos(a*2-phase)+.026*Math.sin(a*5+t*9)));p.deformation.lift.push(i<2?0:Math.pow(t,5)*(.054*Math.sin(a*3+phase)+.023*Math.cos(a)));}
  return normalizeProfile(p);
}
export function trimProfile(profile){const p=cloneProfile(profile);p.trimmed=true;p.radii[0]=Math.max(.3,p.radii[1]-.045);p.radii[1]=Math.max(p.radii[0],p.radii[1]);return p;}
export function surfaceRows(profile,resolution=72) {
  const p=normalizeProfile(profile),recess=p.wall*.5+.015;
  // Keep these UV rows in every stage. Trimming carves a recess inside the foot ring.
  const foot=[[0,recess,0],[.65,recess,.003],[.71,recess-.006,.006],[.73,.012,.009],[.76,0,.012],[.87,0,.016],[.93,.015,.020]];
  const rows=foot.map(([r,y,v])=>({r:p.radii[0]*r,y:p.trimmed?y:.015*(1-r),v,inner:false}));
  for(let i=0;i<=resolution;i++){const t=i/resolution,groove=.00055*Math.sin(t*210)*(1-Math.exp(-t*20));rows.push({r:radiusAt(p,t)+groove,y:.035+t*p.height,v:.025+t*.705,inner:false});}
  const mouth=p.radii.at(-1),top=p.height+.035,rim=p.wall/2;
  for(let i=1;i<=8;i++){const a=i/8*Math.PI;rows.push({r:mouth-rim+Math.cos(a)*rim,y:top+Math.sin(a)*rim,v:.73+i/8*.02,inner:i>4});}
  for(let i=resolution-1;i>=0;i--){const t=i/resolution,y=.035+p.wall+t*(p.height-p.wall),outerFraction=(y-.035)/p.height;rows.push({r:Math.max(.1,radiusAt(p,outerFraction)-p.wall),y,v:.75+(1-t)*.225,inner:true});}
  rows.push({r:0,y:.035+p.wall,v:1,inner:true});return rows;
}
