import assert from 'node:assert/strict';
import {fireLayers} from '../glaze-firing.mjs';
import {applyFiredGlaze} from '../glaze-surface.mjs';
const w=192,h=192,base=new Uint8ClampedArray(w*h*4),ink=new Uint8ClampedArray(w*h*4),glaze=new Uint8ClampedArray(w*h*4),foot=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4;base.set([229,220,204,255],i);foot.set([0,0,0,y<h-12?255:0],i);
 const blend=x/w;glaze.set([100+70*blend,166-45*blend,158-20*blend,Math.round(140+110*blend)],i);
 if(x>30&&x<55&&y>50&&y<150)ink.set([35,68,145,230],i);
}
const args={width:w,height:h,base,underglaze:ink,glaze,foot,seed:291731},outputs={};
const diff=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)if(i%4!==3)sum+=Math.abs(a[i]-b[i]);return sum/(a.length*.75);};
for(const finish of ['gloss','satin','speckle','crackle']){
 outputs[finish]=fireLayers({...args,finish});
 for(let y=h-12;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;assert.equal(outputs[finish].coat[i],0);for(let c=0;c<3;c++)assert.equal(outputs[finish].color[i+c],base[i+c]);}
}
const differences={};for(const a of Object.keys(outputs))for(const b of Object.keys(outputs))if(a<b){const color=diff(outputs[a].color,outputs[b].color),surface=diff(outputs[a].roughness,outputs[b].roughness);differences[a+' / '+b]={color,surface};assert(color>4,'families have visible colour-pattern differences, without relying on roughness alone');}
const reduction=fireLayers({...args,fire:'还原焰'}),wood=fireLayers({...args,fire:'柴烧'});
assert(diff(reduction.color,outputs.gloss.color)>1);assert(diff(wood.color,outputs.gloss.color)>1);
const pattern=fireLayers({...args,glaze:new Uint8ClampedArray(w*h*4),clearGlaze:true});
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++)assert(Math.abs(pattern.color[i+c]-(base[i+c]*(1-ink[i+3]/255)+ink[i+c]*ink[i+3]/255))<=1,'stable pigment keeps its placement and colour');}
assert(diff(pattern.color,outputs.gloss.color)>15);
assert.deepEqual(fireLayers(args).color,outputs.gloss.color,'same recipe and seed must restore exactly');
const uniform=new Uint8ClampedArray(w*h*4);for(let i=0;i<uniform.length;i+=4)uniform.set([103,167,161,255],i);
const surfaces={};for(const finish of Object.keys(outputs)){
 const baked=fireLayers({...args,underglaze:new Uint8ClampedArray(w*h*4),glaze:uniform,foot:null,finish}),rough=[];let mean=[0,0,0],heightMin=255,heightMax=0;
 for(let i=0;i<baked.color.length;i+=4){rough.push(baked.roughness[i]);for(let c=0;c<3;c++)mean[c]+=baked.color[i+c]/(w*h);heightMin=Math.min(heightMin,baked.relief[i]);heightMax=Math.max(heightMax,baked.relief[i]);}
 rough.sort((a,b)=>a-b);assert(rough[Math.floor(rough.length*.8)]<60,'most of the glazed surface is a smooth glass ground, including crystal glaze');assert(heightMax-heightMin<10,'patterns do not carve deep relief');
 assert(mean[1]>mean[0]+30&&mean[2]>mean[0]+25,'a celadon ground stays celadon instead of gaining a purple or brown cast');
 const material={roughnessMap:{},specularColor:{set(){}},needsUpdate:false};applyFiredGlaze(material,finish);assert(material.clearcoat>=.7&&material.clearcoatRoughness<.15,'each finish retains a coherent glass reflection');assert(material.bumpScale<=.004,'microtexture cannot emboss the pattern');
 surfaces[finish]={roughness80:rough[Math.floor(rough.length*.8)],heightRange:heightMax-heightMin,meanColor:mean,bumpScale:material.bumpScale};
}
console.log(JSON.stringify({familiesDistinct:differences,surfaces,gasPresetDifference:diff(reduction.color,outputs.gloss.color),woodPresetDifference:diff(wood.color,outputs.gloss.color),patternStable:true,footBare:true},null,2));
