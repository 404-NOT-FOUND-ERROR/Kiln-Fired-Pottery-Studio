import assert from 'node:assert/strict';
import {fireLayers,glazeSurfaceAspect,glazeSurfaceHeightMM} from '../glaze-firing.mjs';
import {starterProfile} from '../vessel-presets.mjs';
const w=512,h=512,size=w*h*4,base=new Uint8ClampedArray(size),ink=new Uint8ClampedArray(size),wet=new Uint8ClampedArray(size);
for(let i=0;i<size;i+=4){base.set([229,220,204,255],i);wet.set([103,167,161,255],i);}
const args={width:w,height:h,base,underglaze:ink,glaze:wet,finish:'satin',seed:172913,surfaceAspect:2.3};
function crystalDiameters(baked,heightMM){
 const seen=new Uint8Array(w*h),diameters=[];
 for(let y=Math.ceil(h*.28);y<Math.floor(h*.96);y++)for(let x=0;x<w;x++){
  const n=y*w+x;if(seen[n]||baked.roughness[n*4]<50)continue;
  const queue=[n];seen[n]=1;let left=x,right=x,top=y,bottom=y,count=0;
  for(let j=0;j<queue.length;j++){
   const p=queue[j],px=p%w,py=Math.floor(p/w);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);count++;
   for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    if(!ox&&!oy)continue;const xx=px+ox,yy=py+oy;if(xx<0||xx>=w||yy<Math.ceil(h*.28)||yy>=Math.floor(h*.96))continue;
    const q=yy*w+xx;if(seen[q]||baked.roughness[q*4]<50)continue;seen[q]=1;queue.push(q);
   }
  }
  if(count>=5&&left>0&&right<w-1)diameters.push(Math.max((right-left+1)*heightMM*args.surfaceAspect/(w*.705),(bottom-top+1)*heightMM/(h*.705)));
 }
 return diameters.sort((a,b)=>a-b);
}
const report=[];
for(const heightMM of [86,172]){
 const baked=fireLayers({...args,surfaceHeightMM:heightMM}),diameters=crystalDiameters(baked,heightMM);
 report.push({heightMM,clusters:diameters.length,diameter90MM:diameters[Math.floor(diameters.length*.9)],maximumMM:Math.max(...diameters)});
}
// Touching crystals can form one connected region; its span is not the size
// of a single crystal. Check the usual upper size and bound merged clusters.
for(const s of report){assert(s.clusters>=10,'a range of smaller crystal clusters stays present');assert(s.diameter90MM<7,'most default crystals remain millimetre-sized');assert(s.maximumMM<13,'joined clusters do not cover a large fraction of the jar');}
assert(report[1].clusters>report[0].clusters*2,'a larger surface contains more crystals instead of enlarged copies');
assert(report[1].diameter90MM/report[0].diameter90MM<1.35,'doubling the vessel size does not double crystal size');
for(const name of ['jar','bowl','meiping']){const p=starterProfile(name);assert.equal(glazeSurfaceHeightMM(p),p.height*50);assert(glazeSurfaceAspect(p)>0);}
// A tiny canvas is a resolution change, never an instruction to grow patterns.
const low=fireLayers({...args,width:256,height:256,base:base.slice(0,256*256*4),underglaze:ink.slice(0,256*256*4),glaze:wet.slice(0,256*256*4),surfaceHeightMM:86});
let error=0,count=0;const high=fireLayers({...args,surfaceHeightMM:86});for(let y=80;y<230;y++)for(let x=0;x<256;x++){const a=(y*256+x)*4,b=(y*2*512+x*2)*4;for(let c=0;c<3;c++){error+=Math.abs(low.color[a+c]-high.color[b+c]);count++;}}
assert(error/count<1,'texture resolution preserves the same physical pattern');console.log(JSON.stringify({scales:report,resolutionDifference:error/count}));
