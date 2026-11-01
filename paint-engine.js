import * as THREE from 'three';
import {radiusAt} from './vessel-profile.mjs';

// Deposit samples into two layers, but composite/upload only once per animation frame.
export function createPaintEngine({world,surface,state,palette,rows,refresh,guide,toast}) {
  const canvas=world.renderer.domElement,SIZE=surface.baseCanvas.width,ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  let down=false,pointerId=null,last=null,lastPointer=null,strokeAction='paint',dirty=false,lastFrame=0,lastWheel=0,lastPour=0,lastGuide=0,strokeCarry=0,lastDab=0;
  const queue=[],history=[];const stats={frames:0,uploads:0,stamps:0,maxFlushMs:0,liveFlushes:0,liveFlushMs:0,maxLiveFlushMs:0};
  const createCanvas=()=>Object.assign(document.createElement('canvas'),{width:SIZE,height:SIZE});
  const layer=()=>state.decoration==='underglaze'?surface.glazeCtx:surface.wetCtx;
  const hitAt=e=>{const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,world.camera);return ray.intersectObject(world.mesh,false)[0];};
  const remember=()=>{const copy={clearGlaze:state.clearGlaze,usedGlazes:[...state.usedGlazes]};for(const key of ['glaze','wet']){const c=createCanvas();c.getContext('2d').drawImage(surface[key+'Canvas'],0,0);copy[key]=c;}history.push(copy);if(history.length>8)history.shift();updateUndo();};
  const updateUndo=()=>{const button=document.querySelector('#undoPaint');if(button)button.disabled=!history.length;};
  function flush(coverage=false){if(!dirty&&!coverage)return;const started=performance.now();refresh(surface,{coverage});const elapsed=performance.now()-started;stats.uploads++;stats.maxFlushMs=Math.max(stats.maxFlushMs,elapsed);if(!coverage){stats.liveFlushes++;stats.liveFlushMs+=elapsed;stats.maxLiveFlushMs=Math.max(stats.maxLiveFlushMs,elapsed);}dirty=false;if(coverage||performance.now()-lastGuide>140){guide();lastGuide=performance.now();}}
  function mark(){dirty=true;state.specimen=false;state.painted=Math.max(.1,state.painted);if(strokeAction!=='erase'&&!state.usedGlazes.includes(state.glaze))state.usedGlazes.push(state.glaze);}
  const brushCache=new Map();
  function brushStamp(){
    const col=strokeAction==='erase'?[255,255,255]:palette[state.glaze].rgba,alpha=strokeAction==='erase'?.42:state.decoration==='underglaze'?.26:.18,key=[...col,alpha,state.glazeLoad].join(',');
    if(brushCache.has(key))return brushCache.get(key);
    const c=Object.assign(document.createElement('canvas'),{width:128,height:128}),ctx=c.getContext('2d'),a=alpha*(.2+(state.glazeLoad||55)/100*.8),g=ctx.createRadialGradient(64,64,0,64,64,62);
    g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(.28,`rgba(${col},${a*.94})`);g.addColorStop(.60,`rgba(${col},${a*.44})`);g.addColorStop(.84,`rgba(${col},${a*.10})`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    // Sparse bristle channels remain translucent, even when the centre builds up.
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=.7;
    for(let i=0;i<18;i++){const x=10+i*6.1;ctx.beginPath();ctx.moveTo(x,8);ctx.bezierCurveTo(x+2,35,x-1,85,x+1,120);ctx.stroke();}ctx.restore();
    if(brushCache.size>32)brushCache.clear();brushCache.set(key,c);return c;
  }
  function aspectAt(v){const uv=1-v,inner=uv>.75,fraction=Math.max(0,Math.min(1,inner?1-(uv-.75)/.225:(uv-.025)/.705));return state.shape?Math.max(.5,Math.min(3.4,(inner?.225:.705)*Math.PI*2*radiusAt(state.shape,fraction)/state.shape.height)):1;}
  function stamp(u,v,pressure=1){
    const cx=((u%1+1)%1)*SIZE,cy=v*SIZE,size=state.brushRadius||34,row=Math.max(0,Math.min(SIZE-1,Math.floor(cy)));
    if(surface.allowedRows&&!surface.allowedRows[row])return;
    const aspect=aspectAt(v);
    const target=layer();target.save();target.globalCompositeOperation=strokeAction==='erase'?'destination-out':'source-over';
    target.globalAlpha=pressure;
    for(const x of [cx-SIZE,cx,cx+SIZE]){
      target.drawImage(brushStamp(),x-size,cy-size*aspect,size*2,size*2*aspect);
    }
    target.restore();stats.stamps++;mark();
  }
  function sample(e){
    const hit=hitAt(e);if(!hit?.uv){last=null;return;}
    const p={u:hit.uv.x,v:1-hit.uv.y},pressure=e.pointerType==='pen'?Math.max(.15,e.pressure||.5):1;
    if(state.pattern&&state.pattern!=='none'&&strokeAction!=='erase'){patternAt(p);last=null;return;}
    if(last){let du=p.u-last.u;if(du>.5)du--;if(du<-.5)du++;const distance=Math.hypot(du,(p.v-last.v)/aspectAt(p.v))*SIZE,spacing=Math.max(2,state.brushRadius*.28);
      if(e.deposit&&distance<spacing*.1)stamp(p.u,p.v,pressure);
      else if(distance>0){for(let d=spacing-strokeCarry;d<=distance;d+=spacing){const t=d/distance;stamp(last.u+du*t,last.v+(p.v-last.v)*t,pressure);}strokeCarry=(strokeCarry+distance)%spacing;}
    }else{stamp(p.u,p.v,pressure);strokeCarry=0;}last=p;
  }
  function patternAt(p){
    const ctx=layer(),size=state.brushRadius*1.65,col=palette[state.glaze].rgba;
    ctx.save();ctx.fillStyle=`rgba(${col},.92)`;
    for(const shift of [-SIZE,0,SIZE]){ctx.save();ctx.translate(p.u*SIZE+shift,p.v*SIZE);
      if(state.pattern==='leaf'){ctx.rotate(-.4);ctx.beginPath();ctx.ellipse(0,0,size*.42,size,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,246,224,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-size*.8);ctx.lineTo(0,size*.8);ctx.stroke();}
      else {for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(Math.cos(a)*size*.47,Math.sin(a)*size*.47,size*.32,size*.22,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ecdcad';ctx.beginPath();ctx.arc(0,0,size*.16,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
    ctx.restore();mark();
  }
  function dip(){
    remember();strokeAction='paint';const col=palette[state.glaze].rgba,level=state.shape?state.shape.height*Number(document.querySelector('#dipDepth').value)/100:null,sampled=rows(),ctx=layer();
    const mask=createCanvas(),m=mask.getContext('2d');
    for(let i=1;i<sampled.length;i++)if(sampled[i].y<= (level??Math.max(...sampled.map(p=>p.y))*Number(document.querySelector('#dipDepth').value)/100)&&sampled[i].y>.07){const a=SIZE*(1-sampled[i-1].v),b=SIZE*(1-sampled[i].v),start=Math.floor(Math.min(a,b)),end=Math.ceil(Math.max(a,b));m.fillRect(0,start,SIZE,Math.max(1,end-start));}
    const coat=createCanvas(),c=coat.getContext('2d');c.fillStyle=`rgba(${col},${.35+state.glazeLoad/100*.62})`;c.fillRect(0,0,SIZE,SIZE);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);ctx.drawImage(coat,0,0);mark();flush(true);toast('釉层已附着 · 底足保持留白');
  }
  function baseCoat(){remember();strokeAction='paint';state.decoration='glaze';const ctx=surface.wetCtx,col=palette[state.glaze].rgba;ctx.fillStyle=`rgba(${col},${.62+state.glazeLoad/100*.2})`;ctx.fillRect(0,0,SIZE,SIZE);mark();flush(true);toast('底釉已铺好 · 换一色叠刷，积厚处会产生更多变化');}
  function pourAt(e){
    const hit=hitAt(e);if(!hit?.uv)return;const ctx=layer(),col=palette[state.glaze].rgba,cx=hit.uv.x*SIZE,cy=(1-hit.uv.y)*SIZE,brush=state.brushRadius*.45;
    let seed=Math.floor(cx*41+cy*13);const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    ctx.save();ctx.lineCap='round';for(const shift of [-SIZE,0,SIZE])for(let i=0;i<3;i++){
      const x=cx+(i-1)*brush*1.2+shift,length=(SIZE*.08+rand()*SIZE*.19)*(.6+state.glazeLoad/100),width=brush*(i===1?1:.5),g=ctx.createLinearGradient(x,cy,x,cy+length);
      g.addColorStop(0,`rgba(${col},.92)`);g.addColorStop(.85,`rgba(${col},.8)`);g.addColorStop(1,`rgba(${col},.62)`);ctx.strokeStyle=g;ctx.lineWidth=Math.max(4,width);ctx.beginPath();ctx.moveTo(x,cy);ctx.bezierCurveTo(x+width*.3,cy+length*.3,x-width*.2,cy+length*.65,x,cy+length);ctx.stroke();ctx.fillStyle=`rgba(${col},.8)`;ctx.beginPath();ctx.ellipse(x,cy+length,width*.7,width,0,0,Math.PI*2);ctx.fill();
    }ctx.restore();mark();
  }
  world.applyDip=dip;world.paintEngine={stats,baseCoat,flush:()=>flush(true),setSurface(value){surface=value;queue.length=0;down=false;dirty=false;last=null;history.length=0;updateUndo();},clear(){remember();for(const key of ['glaze','wet'])surface[key+'Ctx'].clearRect(0,0,SIZE,SIZE);state.clearGlaze=false;state.usedGlazes=[];dirty=true;flush(true);},undo(){const snapshot=history.pop();if(!snapshot)return;for(const key of ['glaze','wet']){const ctx=surface[key+'Ctx'];ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(snapshot[key],0,0);}state.clearGlaze=snapshot.clearGlaze;state.usedGlazes=[...snapshot.usedGlazes];dirty=true;flush(true);updateUndo();},coatClear(){remember();state.clearGlaze=!state.clearGlaze;dirty=true;flush(true);toast(state.clearGlaze?'已罩透明釉 · 烧后保留纹样与玻璃光泽':'已移除透明罩釉 · 彩绘烧后为哑光');},resetHistory(){history.length=0;updateUndo();}};
  world.cancelTouchEdit=()=>{if(!down)return;down=false;queue.length=0;last=null;lastPointer=null;pointerId=null;world.paintEngine.undo();};
  world.onFrame=now=>{
    stats.frames++;const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
    if(state.step===2&&state.technique==='wheel'&&state.tool==='paint'&&!state.turntablePaused){world.mesh.rotation.y+=state.turnSpeed*dt;world.wheel.rotation.y=world.mesh.rotation.y;if(down&&lastPointer&&now-lastWheel>28){queue.push(lastPointer);lastWheel=now;}}
    if(world.gestureActive){queue.length=0;down=false;last=null;}
    if(down&&lastPointer&&state.technique==='brush'&&state.pattern==='none'&&now-lastDab>95){queue.push({...lastPointer,deposit:true});lastDab=now;}
    if(queue.length){const samples=queue.splice(0);for(const e of samples){if(strokeAction==='pour'){if(now-lastPour>65){pourAt(e);lastPour=now;}}else sample(e);}}
    flush(false);
  };
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(e.button===1||state.tool==='orbit'||world.gestureActive)return;
    if(e.button!==0&&e.button!==2)return;
    strokeAction=e.button===2||state.tool==='erase'?'erase':state.technique==='pour'?'pour':'paint';
    if(state.technique==='dip'&&strokeAction==='paint')return;
    if(!hitAt(e))return;remember();down=true;pointerId=e.pointerId;last=null;strokeCarry=0;lastDab=performance.now();lastPointer={clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType,pressure:e.pressure};canvas.setPointerCapture(e.pointerId);queue.push(lastPointer);e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{if(!down||e.pointerId!==pointerId)return;lastPointer={clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType,pressure:e.pressure};if(state.pattern!=='none'&&state.pattern)return;if(queue.length<96)queue.push(lastPointer);});
  canvas.addEventListener('wheel',e=>{e.preventDefault();world.setWorkshopZoom(world.workshopZoom*Math.exp(-e.deltaY*.0008));},{passive:false});
  const release=e=>{if(e.pointerId!==pointerId)return;for(const p of queue.splice(0)){if(strokeAction==='pour')pourAt(p);else sample(p);}flush(strokeAction==='erase');guide();down=false;last=null;lastPointer=null;pointerId=null;};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  return world.paintEngine;
}
