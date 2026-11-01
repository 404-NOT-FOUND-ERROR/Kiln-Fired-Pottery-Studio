const serif='"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif';
const ink='#3c3024',muted='#897965',rule='#bbaa93';
let paper;

function paperPattern(ctx){
  if(!paper){
    paper=Object.assign(document.createElement('canvas'),{width:192,height:192});
    const c=paper.getContext('2d'),pixels=c.createImageData(192,192);let seed=811037;
    for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const grain=(seed/4294967296-.5)*7;pixels.data.set([246+grain,241+grain,231+grain,255],i);}
    c.putImageData(pixels,0,0);
  }
  return ctx.createPattern(paper,'repeat');
}

function text(ctx,value,x,y,{size=24,max=1000,color=ink,tracking=0,align='left',minimum=18}={}){
  const letters=Array.from(String(value||'')),width=()=>ctx.measureText(letters.join('')).width+Math.max(0,letters.length-1)*tracking;
  ctx.font=`400 ${size}px ${serif}`;
  while(size>minimum&&width()>max){size--;ctx.font=`400 ${size}px ${serif}`;}
  if(width()>max){while(letters.length>1&&width()>max-ctx.measureText('…').width)letters.pop();letters.push('…');}
  ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  if(align==='right')x-=width();
  if(!tracking){ctx.fillText(letters.join(''),x,y);return;}
  for(const letter of letters){ctx.fillText(letter,x,y);x+=ctx.measureText(letter).width+tracking;}
}

function line(ctx,x1,y1,x2,y2,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=rule;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}

function silhouette(ctx,mesh,x,y,width,height){
  const positions=mesh?.geometry?.attributes.position;if(!positions)return;
  const angle=mesh.rotation.y,c=Math.cos(angle),s=Math.sin(angle),rows=128;
  let bottom=Infinity,top=-Infinity,left=Infinity,right=-Infinity;
  for(let i=0;i<positions.count;i++){const px=positions.getX(i)*c+positions.getZ(i)*s,py=positions.getY(i);bottom=Math.min(bottom,py);top=Math.max(top,py);left=Math.min(left,px);right=Math.max(right,px);}
  const h=top-bottom,w=right-left;if(h<=0||w<=0)return;
  const bands=Array.from({length:rows},()=>({left:Infinity,right:-Infinity}));
  for(let i=0;i<positions.count;i++){const py=positions.getY(i),px=positions.getX(i)*c+positions.getZ(i)*s,index=Math.min(rows-1,Math.floor((py-bottom)/h*(rows-1)));bands[index].left=Math.min(bands[index].left,px);bands[index].right=Math.max(bands[index].right,px);}
  // Fill gaps between mesh rings without assuming a symmetric preset profile.
  const valid=bands.map((v,i)=>Number.isFinite(v.left)?i:-1).filter(i=>i>=0);
  for(let k=1;k<valid.length;k++){const a=valid[k-1],b=valid[k];for(let i=a+1;i<b;i++){const t=(i-a)/(b-a);bands[i]={left:bands[a].left*(1-t)+bands[b].left*t,right:bands[a].right*(1-t)+bands[b].right*t};}}
  for(let pass=0;pass<3;pass++){const original=bands.map(b=>({...b}));for(let i=1;i<rows-1;i++)for(const edge of ['left','right'])bands[i][edge]=(original[i-1][edge]+original[i][edge]*2+original[i+1][edge])/4;}
  const scale=Math.min(width/w,height/h),dx=x+(width-w*scale)/2-left*scale,dy=y+(height-h*scale)/2;
  const points=[...bands.map((b,i)=>[dx+b.right*scale,dy+h*scale-i/(rows-1)*h*scale]),...bands.map((b,i)=>[dx+b.left*scale,dy+h*scale-i/(rows-1)*h*scale]).reverse()];
  ctx.save();ctx.strokeStyle='#99a08a';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...points[0]);
  for(let i=1;i<points.length;i++){const p=points[i],next=points[(i+1)%points.length];ctx.quadraticCurveTo(...p,(p[0]+next[0])/2,(p[1]+next[1])/2);}
  ctx.closePath();ctx.stroke();ctx.restore();
}

const finishes={gloss:'流彩',satin:'晶花',speckle:'铁斑',crackle:'开片'};
const firing={氧化焰:'氧化',还原焰:'还原',柴烧:'柴烧'};
const sceneLabels={museum:'藏品 / 01',living:'窗边 / 02',art:'色场 / 03',neutral:'观釉 / 04'};

export function artworkCard({title,settings,scene='neutral',format='portrait',mesh,renderPhoto,outputWidth=1200}){
  const width=1200,height=format==='portrait'?1500:1200,portrait=height>width;
  const scale=outputWidth/width;
  const canvas=Object.assign(document.createElement('canvas'),{width:outputWidth,height:Math.round(height*scale)}),ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);
  const margin=44,photoY=68,photoWidth=width-margin*2,captionHeight=portrait?438:358,photoBottom=height-captionHeight,photoHeight=photoBottom-photoY;
  ctx.fillStyle=paperPattern(ctx);ctx.fillRect(0,0,width,height);
  text(ctx,'陶艺作品',margin,39,{size:17,tracking:5});
  text(ctx,'土 · 火 · 时间',width-margin,39,{size:17,tracking:3,align:'right'});
  line(ctx,184,34,width-241,34,.65);
  ctx.drawImage(renderPhoto(Math.round(photoWidth*scale),Math.round(photoHeight*scale)),margin,photoY,photoWidth,photoHeight);
  ctx.strokeStyle='#b3a58e66';ctx.lineWidth=1;ctx.strokeRect(margin+.5,photoY+.5,photoWidth-1,photoHeight-1);

  const nameY=photoBottom+(portrait?119:89),subtitleY=photoBottom+(portrait?169:134),infoY=height-208;
  text(ctx,title,margin,nameY,{size:portrait?84:66,max:940,minimum:30,tracking:1});
  text(ctx,`${settings.object||'器物'}  /  ${(settings.glazeNames||[]).join(' · ')||'素色'}`,margin,subtitleY,{size:26,max:940,minimum:20});
  silhouette(ctx,mesh,width-margin-124,photoBottom+54,112,portrait?112:96);

  const finish=settings.decoration==='underglaze'?(settings.clearGlaze?'彩绘 · 透明釉':'釉下彩'):(finishes[settings.glazeFinish]||'流彩');
  const temperature=String(settings.temp||'').replace('℃','°C');
  const metadata=[['釉面',finish],['烧成',[temperature,firing[settings.fire]||settings.fire].filter(Boolean).join(' · ')],['冷却',settings.cooling||'缓冷']];
  const column=(width-margin*2)/3;
  metadata.forEach(([label,value],i)=>{const x=margin+i*column;line(ctx,x,infoY+2,x,infoY+65,i===0?.95:.65);text(ctx,label,x+28,infoY+19,{size:19,tracking:3,color:muted,max:column-56});text(ctx,value,x+28,infoY+60,{size:26,max:column-56,minimum:20});});
  line(ctx,margin,height-90,width-margin,height-90);
  text(ctx,'亲手成器，一次一件',margin,height-44,{size:17,tracking:2,color:muted});
  text(ctx,sceneLabels[scene]||sceneLabels.neutral,width-margin,height-44,{size:17,tracking:2,color:muted,align:'right'});
  return canvas;
}
