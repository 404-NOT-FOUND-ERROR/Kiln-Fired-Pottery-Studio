// Portrait uses the existing controls and handlers. Anchors put every node back
// in its original desktop position when the device turns sideways.
export function setupPortraitStudio(state) {
  const $=s=>document.querySelector(s),media=matchMedia('(max-width:900px) and (orientation:portrait)');
  const ui=document.createElement('div');ui.id='portraitUI';ui.hidden=true;
  ui.innerHTML=`<header class="portrait-header"><div><button id="portraitBack" aria-label="返回工坊">‹</button><span id="portraitStep"></span></div><button id="portraitCollection" aria-label="打开我的作品">我的作品 ↗</button></header>
    <div class="portrait-view-tools"><span id="portraitGesture">双指转动 · 捏合缩放</span><div id="portraitCamera"></div></div>
    <section class="portrait-sheet" aria-label="制作工具"><header class="portrait-sheet-title"><h1 id="portraitTitle"></h1><button id="portraitExpand" aria-expanded="false" aria-controls="portraitContent" aria-label="展开工具面板">展开 ⌃</button></header>
    <nav class="portrait-tabs" aria-label="装饰工具"><button data-mobile-tab="brush" aria-pressed="true" aria-controls="portraitBrush">画笔</button><button data-mobile-tab="glaze" aria-pressed="false" aria-controls="portraitGlaze">施釉</button><button data-mobile-tab="kiln" aria-pressed="false" aria-controls="portraitKiln">效果与烧成</button></nav><div id="portraitResultTabs"></div>
    <div id="portraitContent"><div id="portraitChoose" class="portrait-page"></div><div id="portraitSculpt" class="portrait-page"><div class="portrait-sculpt-sliders"></div></div><div id="portraitBrush" class="portrait-page"><div class="portrait-brush-row"></div></div><div id="portraitGlaze" class="portrait-page"></div><div id="portraitKiln" class="portrait-page"></div><div id="portraitPrepare" class="portrait-page"></div><div id="portraitResult" class="portrait-page"></div></div><div id="mobileGuideSlot"></div>
    <div id="portraitColors"></div><footer id="portraitActions"></footer></section>`;
  document.body.append(ui);
  let mounted=false,phase='',tab='brush',expanded=false,portals=[];
  function move(selector,target){const node=$(selector);if(!node)return;const anchor=document.createComment('portrait: '+selector);node.before(anchor);portals.push({node,anchor});$(target).append(node);}
  function setExpanded(value){expanded=value;ui.dataset.expanded=String(value);document.body.dataset.portraitExpanded=String(value);$('#portraitExpand').setAttribute('aria-expanded',String(value));$('#portraitExpand').setAttribute('aria-label',value?'收起工具面板':'展开工具面板');$('#portraitExpand').textContent=value?'收起 ⌄':'展开 ⌃';}
  function setTab(value){tab=value;ui.dataset.tab=value;ui.querySelectorAll('[data-mobile-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileTab===value)));setExpanded(value!=='brush');$('#portraitContent').scrollTop=0;$('#contextGuide').hidden=true;}
  ui.querySelectorAll('[data-mobile-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.mobileTab));
  $('#portraitExpand').onclick=()=>setExpanded(!expanded);
  $('#portraitCollection').onclick=()=>$('#openCollection').click();
  $('#portraitBack').onclick=()=>$('#backToIntro').click();
  function mount(){
    if(mounted)return;mounted=true;document.body.classList.add('mobile-portrait');
    move('.starting-choice','#portraitChoose');
    move('.sculpt-dock','#portraitSculpt');move('.sculpt-radius','.portrait-sculpt-sliders');move('.sculpt-strength','.portrait-sculpt-sliders');
    move('.sculpt-measurements','#portraitSculpt');move('.sculpt-extras','#portraitSculpt');
    move('.workbench-tools','#portraitBrush');
    for(const s of ['.tool-switch','.pattern-tools','.workbench-history'])move(s,'.portrait-brush-row');
    move('.dock-methods','#portraitGlaze');move('.paint-method-controls','#portraitGlaze');move('.glaze-base-row','#portraitGlaze');
    move('#workbenchOptions','#portraitKiln');move('.workbench-colors','#portraitColors');
    move('#preparationPanel','#portraitPrepare');
    move('.exhibit-panel','#portraitResult');move('.panel-tabs','#portraitResultTabs');
    move('#glazeDetailCard','#portraitResult');
    move('.workshop-camera','#portraitCamera');move('.camera-bar','#portraitCamera');
    for(const s of ['#beginSculpt','#toPaint','#toResult','.result-actions'])move(s,'#portraitActions');
    $('#mobileGuideSlot').append($('#contextGuide'));
    sync();
  }
  function unmount(){
    if(!mounted)return;mounted=false;
    // Reverse nesting order, so child controls regain the exact original order.
    for(const {node,anchor} of portals.reverse()){anchor.replaceWith(node);}portals=[];
    const guide=$('#contextGuide');(state.step===2?$('.paint-left-rail'):document.body).prepend(guide);
    document.body.classList.remove('mobile-portrait');delete document.body.dataset.portraitPhase;delete document.body.dataset.portraitExpanded;ui.hidden=true;
    window.dispatchEvent(new Event('resize'));
  }
  function sync(){
    if(!mounted)return;
    const next=state.preparing?'prepare':state.step===1?state.makingPhase:state.step===2?'paint':'result';
    ui.hidden=!$('#introScreen').classList.contains('is-hidden');
    if(next!==phase){phase=next;setExpanded(false);$('#portraitContent').scrollTop=0;}
    ui.dataset.phase=phase;document.body.dataset.portraitPhase=phase;ui.dataset.tab=tab;
    const panel=document.body.dataset.panel||'photo';
    const labels={choose:['01 / 起点','从一个轮廓开始'],sculpt:['02 / 塑形','先捏出一件器物'],prepare:['02 / 制坯','把泥，交给时间'],paint:['03 / 装饰','留下一层颜色'],result:['05 / 成品',{photo:'留住这一件的光泽',result:'看见釉的光泽',learn:'同一件，看见变化'}[panel]]};
    const [step,title]=labels[phase]||labels.sculpt;$('#portraitStep').textContent=step;$('#portraitTitle').textContent=title;
    $('#portraitGesture').textContent=phase==='choose'?'拖动旋转 · 双指缩放':phase==='result'?'拖动查看 · 双指缩放':'双指转动 · 捏合缩放';
    // placeCamera() also runs on desktop resizes; keep its shared control here.
    if($('.workshop-camera').parentElement!==$('#portraitCamera'))$('#portraitCamera').prepend($('.workshop-camera'));
  }
  const update=()=>{media.matches?mount():unmount();sync();};media.addEventListener('change',update);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-studio-step','data-making-phase','data-panel']});
  new MutationObserver(sync).observe($('#introScreen'),{attributes:true,attributeFilter:['class']});
  new MutationObserver(sync).observe($('.selection-controls'),{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',()=>{if(mounted)requestAnimationFrame(sync);});
  const viewport=()=>{if(!mounted)return;const v=window.visualViewport;document.body.style.setProperty('--portrait-vh',(v?.height||innerHeight)+'px');document.body.style.setProperty('--portrait-top',(v?.offsetTop||0)+'px');};
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);media.addEventListener('change',viewport);window.addEventListener('resize',()=>requestAnimationFrame(viewport));
  // A newly selected option explains itself inside the tool sheet, never over the vessel.
  document.addEventListener('click',e=>{if(!mounted)return;if(e.target.closest('button[data-panel]'))$('#portraitContent').scrollTop=0;});
  update();viewport();
}
