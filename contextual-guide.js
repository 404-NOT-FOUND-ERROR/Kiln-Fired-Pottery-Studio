import {palette} from './glaze-library.js';
import {fireLayers} from './glaze-firing.mjs';
import {drawMaterialPreview} from './material-preview.js';
const $=s=>document.querySelector(s);
const outlines='<path d="M29 7h22v8c0 10 15 13 17 34 2 20-7 29-28 29S9 69 12 49c2-21 17-24 17-34V7Z"/>';
const diagram=(paths,labels)=>'<div class="guide-diagram"><svg viewBox="0 0 180 86" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg><span>'+labels+'</span></div>';
const shapes={
 push:{title:'推拉',copy:'左右拖动，鼓腹或收腰。',visual:diagram('<g transform="translate(6,0)">'+outlines+'</g><path d="M96 45h22m-5-5 5 5-5 5"/><g transform="translate(97,0)">'+outlines+'</g><path class="guide-accent" d="M102 44h23m-5-5 5 5-5 5M156 44h16m-5-5 5 5-5 5"/>','整圈调整')},
 pinch:{title:'手捏',copy:'只改变手指碰到的这一侧。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><circle class="guide-accent" cx="62" cy="47" r="9"/><path class="guide-accent" d="M22 47h29m-5-5 5 5-5 5"/>','局部推拉')},
 dent:{title:'压痕',copy:'点按留凹痕，拖动可连续压。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><path class="guide-accent" d="M62 37c16-4 17 22 0 21M34 48h30m-5-5 5 5-5 5"/>','指腹压入')},
 smooth:{title:'抚平',copy:'轻扫转折，让表面更顺。',visual:diagram('<path d="M10 45c12-22 19 22 32 0s19 22 33 0M93 45h23m-5-5 5 5-5 5"/><path class="guide-accent" d="M127 45h42"/>','抚平转折')},
 height:{title:'拉高',copy:'向上拉高，向下压低。',visual:diagram('<g transform="translate(10,12) scale(.85,.8)">'+outlines+'</g><path d="M88 43h20m-5-5 5 5-5 5"/><g transform="translate(108,-5) scale(.85,1.1)">'+outlines+'</g><path class="guide-accent" d="M166 20V4m-4 4 4-4 4 4"/>','调整高度')}
};
const methods={
 brush:{title:'刷釉',copy:'轻刷透色，松开后再叠一遍。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><path class="guide-accent" d="m120 14-35 35m-5-3 10 8M78 49c-4 5-2 11-10 11"/>','轻刷 · 叠刷')},
 wheel:{title:'转台',copy:'按住一处，转出连续环带。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><path class="guide-accent" d="M57 45c15 4 44 4 56 0M41 62c-20 17 95 23 98 2m-8-4 8 4-6 6"/>','固定落笔 · 转动器物')},
 dip:{title:'浸釉',copy:'调整高度，让釉层均匀附着。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><path class="guide-accent" d="M34 47c15-5 27 5 42 0s31-5 62 0M84 12v22m-4-4 4 4 4-4"/>','釉层覆盖 · 底足留白')},
 pour:{title:'淋釉',copy:'点按落釉，沿器壁自然流下。',visual:diagram('<g transform="translate(45,0)">'+outlines+'</g><path class="guide-accent" d="M85 5c-13 17 13 17 0 29s9 18 0 33M94 32c-6 10 5 15 1 22"/>','向下流动')}
};
export function setupContextualGuide(state){
 const card=document.createElement('aside');card.id='contextGuide';card.className='context-guide';card.hidden=true;card.setAttribute('aria-labelledby','contextGuideTitle');
 card.innerHTML='<header><h2 id="contextGuideTitle"></h2><button id="closeContextGuide" type="button" aria-label="关闭讲解卡">×</button></header><p id="contextGuideCopy" aria-live="polite"></p><div id="contextGuideVisual"></div>';
 document.body.append(card);let key=null,trigger=null,lastPhase='',renderKey='';
 const place=()=>{const parent=document.body.classList.contains('mobile-portrait')?$('#mobileGuideSlot'):state.step===2?$('.paint-left-rail'):document.body;if(parent&&card.parentElement!==parent)parent.prepend(card);};
 const usable=()=>state.step===2||(state.step===1&&state.makingPhase==='sculpt'&&!state.shapeLocked);
 const dismiss=()=>{card.hidden=true;trigger?.focus({preventScroll:true});};$('#closeContextGuide').onclick=dismiss;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden&&!document.querySelector('dialog[open]'))dismiss();});
 function samples(type,value){
  const visual=$('#contextGuideVisual');visual.innerHTML='<div class="guide-samples"><figure><canvas width="84" height="62" aria-label="第一张材料对照小样"></canvas><figcaption></figcaption></figure><span aria-hidden="true">→</span><figure><canvas width="84" height="62" aria-label="第二张材料对照小样"></canvas><figcaption></figcaption></figure></div><small class="guide-caption">烧后小样</small>';
  const labels=type==='cooling'?['缓冷','快冷']:type==='material'?['未罩釉','透明釉']:['薄釉','厚釉'];
  visual.querySelectorAll('figure').forEach((figure,index)=>{
   const w=(type==='finish'?value:state.glazeFinish)==='satin'?512:256,h=w,base=new Uint8ClampedArray(w*h*4),ink=new Uint8ClampedArray(w*h*4),glaze=new Uint8ClampedArray(w*h*4),color=palette[state.glaze].rgba;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;base.set([230,219,201,255],i);const amount=type==='finish'?(index?235:95):200;((type==='material'&&value==='underglaze')?ink:glaze).set([...color,amount],i);}
   const result=fireLayers({width:w,height:h,base,underglaze:ink,glaze,clearGlaze:type==='material'&&index===1,finish:type==='finish'?value:state.glazeFinish,fire:state.fire,cooling:type==='cooling'?labels[index]:state.cooling,seed:172913});
   drawMaterialPreview(figure.querySelector('canvas'),result,w,h,type==='finish'?value:state.glazeFinish,true);figure.querySelector('figcaption').textContent=labels[index];
  });
 }
 function render(force=false){
  place();
  if(!key||!usable()){card.hidden=true;return;}
  const [type,value]=key,stamp=[...key,state.glaze,state.glazeFinish,state.fire,state.cooling,...palette[state.glaze].rgba].join('|');if(!force&&stamp===renderKey)return;renderKey=stamp;
  let item=type==='sculpt'?shapes[value]:type==='method'?methods[value]:null;
  if(type==='finish')item={title:{gloss:'流彩',satin:'晶花',speckle:'铁斑',crackle:'开片'}[value],copy:{gloss:'薄处透色，厚处聚色。',satin:'光亮的釉底，疏落的晶花。',speckle:'细小铁斑，散落在釉中。',crackle:'细纹留在釉中，表面仍光滑。'}[value]};
  if(type==='fire')item={title:{氧化焰:'氧化烧成',还原焰:'还原烧成',柴烧:'柴烧'}[value],copy:{氧化焰:'含氧烧成，观察清亮釉色。',还原焰:'低氧烧成，观察深色晕染。',柴烧:'火焰与落灰，留下自然色痕。'}[value],visual:diagram('<path class="guide-accent" d="M90 12c12 17 22 29 18 41-8 25-38 11-34-4 2-12 16-18 16-37Z"/><circle cx="46" cy="30" r="4"/><circle cx="126" cy="22" r="3"/><path d="M42 69h96"/>',value==='柴烧'?'火焰 · 落灰':'烧成气氛')};
  if(type==='cooling')item={title:value,copy:value==='缓冷'?'缓慢降温，观察晶花与色晕。':'较快降温，比较色层差异。'};
  if(type==='material')item={title:value==='underglaze'?'彩绘':'效果釉',copy:value==='underglaze'?'保留笔触，透明釉增加光泽。':'换色叠刷，把变化交给窑火。'};
  if(!item)return;$('#contextGuideTitle').textContent=item.title;$('#contextGuideCopy').textContent=item.copy;card.dataset.guide=type;card.dataset.option=value;
  if(['finish','cooling','material'].includes(type))samples(type,value);else $('#contextGuideVisual').innerHTML=item.visual;
 }
 function show(type,value,button){key=[type,value];trigger=button||null;render(true);if(!usable())return;card.hidden=false;card.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion:reduce)').matches)card.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-sculpt],.primer-card,[data-glaze-finish],[data-fire],[data-cooling],[data-decoration]');if(!b||b.disabled)return;
  const type=b.dataset.sculpt?'sculpt':b.classList.contains('primer-card')?'method':b.dataset.glazeFinish?'finish':b.dataset.fire?'fire':b.dataset.cooling?'cooling':'material';
  const value=b.dataset.sculpt||b.dataset.technique||b.dataset.glazeFinish||b.dataset.fire||b.dataset.cooling||b.dataset.decoration;queueMicrotask(()=>show(type,value,b));
 });
 const sync=()=>{place();const phase=state.step+'|'+state.makingPhase;if(phase!==lastPhase){lastPhase=phase;key=null;renderKey='';card.hidden=true;}if(!usable())card.hidden=true;};
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-studio-step','data-making-phase']});
 return {refresh(){if(!card.hidden)render();},dismiss,show};
}
