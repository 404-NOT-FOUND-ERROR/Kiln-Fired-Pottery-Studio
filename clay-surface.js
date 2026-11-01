import * as THREE from 'three';
let canvases;
function clayCanvases(){
  // Share generated canvas pixels, but let every material own disposable textures.
  const n=1024,make=()=>Object.assign(document.createElement('canvas'),{width:n,height:n});
  const maps=[make(),make(),make()],contexts=maps.map(c=>c.getContext('2d')),pixels=contexts.map(c=>c.createImageData(n,n));let seed=213713;
  const noise=new Float32Array(n*n);
  for(let i=0;i<noise.length;i++){seed=(seed*1664525+1013904223)>>>0;noise[i]=seed/4294967296-.5;}
  const sample=(x,y)=>noise[((y+n)%n)*n+(x+n)%n];
  const field=(x,y,scale)=>{const columns=Math.round(n/scale),u=x/n*columns,v=y/scale,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),at=(a,b)=>sample((a+columns)%columns,b);return (at(ix,iy)*(1-sx)+at(ix+1,iy)*sx)*(1-sy)+(at(ix,iy+1)*(1-sx)+at(ix+1,iy+1)*sx)*sy;};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const a=x/n*Math.PI*2,grain=sample(x,y),soft=(sample(x-1,y)+sample(x+1,y)+sample(x,y-1)+sample(x,y+1))*.25;
    const smear=Math.sin(a*5+Math.sin(y*.019)*2)*Math.sin(y*.037)+Math.cos(a*11-y*.065)*.3;
    const clay=field(x,y,22)*.5+field(x,y,65),moisture=field(x,y,90);
    const rings=Math.sin(y*.25+Math.sin(y*.032)*2.8+Math.sin(a*3+y*.008)*.85)*.35+Math.sin(y*.61+Math.sin(a*5+y*.03)*1.1)*.13;
    const pit=Math.pow(Math.max(0,-field(x,y,2)-.18),2)*210,fade=THREE.MathUtils.smoothstep(Math.min(y,n-1-y),3,18),i=(y*n+x)*4;
    const values=[231+(smear*2+clay*17+soft*7+grain*4+rings*3-pit*.45)*fade,128+(smear*5+clay*28+rings*32+soft*12+grain*5-pit)*fade,194+(moisture*120+smear*10+soft*10+rings*7)*fade];
    values.forEach((v,j)=>{const data=pixels[j].data;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;});
  }
  contexts.forEach((c,i)=>c.putImageData(pixels[i],0,0));
  // Broken, overlapping slip marks instead of identical rings around the pot.
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let k=0;k<950;k++){
    const x=random()*n,y=20+random()*(n-40),length=3+Math.pow(random(),2)*100,width=.6+random()*1.7,bend=(random()-.5)*3;
    contexts.forEach((ctx,j)=>{ctx.strokeStyle=j===0?'rgba(92,80,67,.06)':j===1?'rgba(42,42,42,.30)':'rgba(235,235,235,.13)';ctx.lineWidth=width;ctx.lineCap='round';
      for(const offset of [-n,0,n]){ctx.beginPath();ctx.moveTo(x+offset,y);ctx.quadraticCurveTo(x+offset+length*.5,y+bend,x+offset+length,y+bend*.4);ctx.stroke();}
    });
  }
  // Small slip flecks have soft raised shoulders and shallow dark centres.
  for(let k=0;k<1200;k++){
    const x=random()*n,y=20+random()*(n-40),r=.8+random()*3.2;
    for(const offset of [-n,0,n]){
      const c=contexts[1],g=c.createRadialGradient(x+offset,y,0,x+offset,y,r);
      g.addColorStop(0,'rgba(46,46,46,.52)');g.addColorStop(.48,'rgba(98,98,98,.25)');g.addColorStop(.7,'rgba(208,208,208,.4)');g.addColorStop(1,'rgba(128,128,128,0)');
      c.fillStyle=g;c.fillRect(x+offset-r,y-r,r*2,r*2);
    }
  }
  // Wet slip follows the same tiny relief, including in the clearcoat reflection.
  const normal=make(),ctx=normal.getContext('2d'),result=ctx.createImageData(n,n),height=contexts[1].getImageData(0,0,n,n).data;
  const at=(x,y)=>height[((Math.max(0,Math.min(n-1,y))*n+(x+n)%n)*4)]/255;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const dx=(at(x-1,y)-at(x+1,y))*3.8,dy=(at(x,y+1)-at(x,y-1))*3.8,length=Math.hypot(dx,dy,1),i=(y*n+x)*4;
    result.data.set([(dx/length*.5+.5)*255,(dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],i);
  }
  ctx.putImageData(result,0,0);maps.push(normal);return maps;
}
export function createClaySurface(){
  canvases??=clayCanvases();const maps=canvases.map(c=>{const t=new THREE.CanvasTexture(c);t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;});maps[0].colorSpace=THREE.SRGBColorSpace;
  return {color:maps[0],bump:maps[1],roughness:maps[2],normal:maps[3]};
}
