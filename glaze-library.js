import {fireLayers,firingFamilies} from './glaze-firing.mjs';
import {drawMaterialPreview} from './material-preview.js';
export const palette={
  shadow:{rgba:[142,173,177],name:'影青'},bean:{rgba:[142,163,136],name:'豆青'},moon:{rgba:[226,224,209],name:'月白'},forest:{rgba:[29,74,62],name:'墨绿'},
  copper:{rgba:[178,66,44],name:'铜红'},oxblood:{rgba:[93,20,27],name:'酒红'},blush:{rgba:[185,135,121],name:'藕粉'},honey:{rgba:[157,121,45],name:'赭黄'},
  amber:{rgba:[112,77,32],name:'茶褐'},olive:{rgba:[105,108,49],name:'橄榄'},ink:{rgba:[20,23,21],name:'墨黑'},brownblack:{rgba:[53,44,29],name:'褐黑'},
  blackgreen:{rgba:[36,47,38],name:'黛绿'},plum:{rgba:[59,33,69],name:'绛紫'},violet:{rgba:[45,37,77],name:'深紫'},brick:{rgba:[153,65,43],name:'赭红'},
  sky:{rgba:[103,167,161],name:'天青'},cobalt:{rgba:[48,80,133],name:'霁蓝'},change:{rgba:[139,118,155],name:'窑变'},custom:{rgba:[211,138,119],name:'自定义'}
};
const $=s=>document.querySelector(s);
export function setupDecorationUI(){
  const custom=$('.custom-swatch'),grid=$('.palette');grid.replaceChildren();
  for(const [code,value] of Object.entries(palette)){
    if(code==='custom'){grid.append(custom);continue;}
    const b=document.createElement('button');b.className='swatch';b.dataset.glaze=code;b.dataset.name=value.name;b.setAttribute('aria-pressed',String(code==='sky'));b.style.setProperty('--swatch-color',`rgb(${value.rgba})`);b.innerHTML='<i aria-hidden="true"></i>'+value.name;grid.append(b);
  }
  const mode=document.createElement('div');mode.className='decoration-switch';mode.setAttribute('role','group');mode.setAttribute('aria-label','装饰材料');mode.innerHTML='<button data-decoration="glaze" aria-pressed="true">窑变釉 · 流动聚色</button><button data-decoration="underglaze" aria-pressed="false">纹样彩绘 · 保留笔迹</button>';
  $('.workshop-tabs').before(mode);
  $('.paint-stage-head .workshop-kicker').textContent='02 / 彩绘与施釉';$('.paint-stage-head h1').textContent='为它留下颜色';$('.paint-stage-head .subline').textContent='轻刷透色，叠刷积厚；把变化交给窑火。';
  const section=grid.closest('.control-section');section.querySelector('strong').textContent='颜色与材料小样';section.querySelector('.section-title small').textContent='色系参考烧后效果；实际结果仍取决于材料与烧成。';
  const sample=document.createElement('div');sample.className='glaze-sample';sample.innerHTML='<div><div class="sample-tile"></div><small>施用状态</small></div><span aria-hidden="true">→</span><div><div class="sample-tile"><canvas id="firedMaterialSample" width="64" height="64"></canvas></div><small>烧成小样</small></div><p id="materialNote">轻涂有透色，叠涂积厚，烧后有流动与聚色。</p>';section.append(sample);
  const clear=document.createElement('div');clear.className='clear-glaze-row';clear.innerHTML='<button id="applyClearGlaze" type="button" aria-pressed="false">罩一层透明釉</button><small id="clearGlazeStatus">保留彩绘颜色与笔触</small>';section.append(clear);
  const utilities=document.createElement('div');utilities.className='paint-utilities';utilities.innerHTML='<button id="undoPaint" type="button" disabled>撤销上一笔</button><span class="paint-layer-label">正在绘制彩绘层</span>';section.append(utilities);
  document.querySelector('.workflow-secondary').insertBefore(utilities.querySelector('#undoPaint'),document.querySelector('#clearPaint'));
  document.querySelector('[data-workshop-tab="glaze"]').textContent='颜色与材质';
  const finish=document.createElement('div');finish.className='glaze-finishes';finish.innerHTML='<span>窑变效果 · 先选一种，再刷颜色</span><div role="group" aria-label="釉面局部小样">'+Object.entries(firingFamilies).map(([key,v])=>`<button data-glaze-finish="${key}" aria-label="${v.name} · 釉面局部小样" aria-pressed="${key==='gloss'}"><canvas width="80" height="48" aria-hidden="true"></canvas><span>${v.name}</span></button>`).join('')+'</div><small id="finishMaterialNote"></small>';section.prepend(finish);
  const base=document.createElement('div');base.className='glaze-base-row';base.innerHTML='<button id="applyBaseGlaze" type="button">铺一层当前颜色的底釉</button><small>再换一色叠刷，厚薄交叠处更丰富。</small>';finish.after(base);
  const patterns=document.createElement('div');patterns.className='pattern-tools';patterns.setAttribute('role','group');patterns.setAttribute('aria-label','纹样工具');patterns.innerHTML='<span>纹样</span><button data-pattern="none" aria-pressed="true">自由笔触</button><button data-pattern="leaf" aria-pressed="false">叶纹</button><button data-pattern="flower" aria-pressed="false">小花</button>';
  $('.brush-row').after(patterns);
  $('.basic-brush-controls label:last-of-type span').textContent='每遍釉量 · 轻薄 / 厚涂';
  $('#glazeLoadRange').setAttribute('aria-label','每遍釉量');
  $('.tool-switch [data-tool="paint"]').textContent='✦ 画笔';
}
let sampleKey='',firedSampleKey='';
export function updateGlazeSamples(state){
  const controls=$('.glaze-finishes');if(!controls)return;
  const under=state.decoration==='underglaze',col=palette[state.glaze]?.rgba||palette.sky.rgba,key=[...col,state.fire,state.cooling].join(','),firedKey=[key,state.decoration,state.glazeFinish].join(',');
  controls.hidden=false;$('.glaze-base-row').hidden=false;$('.clear-glaze-row').hidden=!under;
  if(key===sampleKey&&firedKey===firedSampleKey)return;
  $('#finishMaterialNote').textContent=firingFamilies[state.glazeFinish]?.copy||firingFamilies.gloss.copy;
  function sample(canvas,finish,pattern=false){
    const preview=!!canvas.closest('[data-glaze-finish]'),w=preview&&finish==='satin'?512:256,h=w,base=new Uint8ClampedArray(w*h*4),ink=new Uint8ClampedArray(w*h*4),wet=new Uint8ClampedArray(w*h*4);
    // Periodic thickness avoids a thin/thick seam through the front of the jar.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;base.set([228,220,205,255],i);const alpha=pattern?230:Math.round(222+22*Math.sin(x/w*Math.PI*2)*Math.sin(y/h*Math.PI)**2);(pattern?ink:wet).set([...col,alpha],i);}
    const baked=fireLayers({width:w,height:h,base,underglaze:ink,glaze:wet,clearGlaze:pattern,finish,fire:state.fire,cooling:state.cooling,seed:172913});
    if(preview)drawMaterialPreview(canvas,baked,w,h,finish,'swatch');
    else{canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(new ImageData(baked.color,w,h),0,0);}
  }
  if(key!==sampleKey){controls.querySelectorAll('[data-glaze-finish]').forEach(button=>sample(button.querySelector('canvas'),button.dataset.glazeFinish));sampleKey=key;}
  if(firedKey!==firedSampleKey){sample($('#firedMaterialSample'),state.glazeFinish,under);firedSampleKey=firedKey;}
}
