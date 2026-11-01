const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const icon=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
function tool(button,label,path){button.innerHTML=icon(path)+'<span>'+label+'</span>';button.title=label;return button;}

// Reparent the original controls so their state, handlers and undo history survive.
export function setupWorkbenchLayout(){
 const workspace=$('.paint-workspace'),right=$('.paint-controls');workspace.classList.add('floating-workbench','quiet-workbench');
 $('.paint-canvas-wrap>.paint-tool-dock')?.remove();
 const heading=$('.paint-stage-head');right.prepend(heading);heading.querySelector('.workshop-kicker').textContent='03 / 装饰';heading.querySelector('h1').textContent='留下一层颜色';heading.querySelector('.subline').textContent='';
 const materials=$('.decoration-switch');materials.querySelector('[data-decoration="glaze"]').textContent='效果釉';materials.querySelector('[data-decoration="underglaze"]').textContent='彩绘';materials.prepend(materials.querySelector('[data-decoration="underglaze"]'));right.append(materials);
 const left=document.createElement('aside');left.className='workbench-tools';left.setAttribute('aria-label','笔刷大小与釉量');
 const sliders=$('.basic-brush-controls');sliders.hidden=false;sliders.removeAttribute('data-workshop-panel');sliders.querySelector('p').remove();
 sliders.querySelectorAll('label').forEach((label,i)=>{label.querySelector('span').textContent=i?'釉量':'笔刷大小';const output=document.createElement('output');output.htmlFor=label.querySelector('input').id;label.append(output);const input=label.querySelector('input'),update=()=>output.textContent=input.value;input.addEventListener('input',update);update();});left.append(sliders);workspace.append(left);
 const dock=document.createElement('div');dock.className='paint-tool-dock quiet-paint-dock';dock.setAttribute('aria-label','绘制与施釉工具');
 const modes=$('.tool-switch');modes.querySelector('[data-tool="orbit"]').hidden=true;
 tool(modes.querySelector('[data-tool="paint"]'),'画笔','M4 20c5 0 5-3 5-5l-3-2c-3 1-1 5-2 7ZM7 13 17 3l4 4-11 10');
 tool(modes.querySelector('[data-tool="erase"]'),'擦除','m4 14 9-10 8 7-9 10H8l-4-4Z M9 10l8 7');dock.append(modes);
 const patterns=$('.pattern-tools');patterns.querySelector(':scope>span').remove();
 tool(patterns.querySelector('[data-pattern="none"]'),'自由','M4 18c4-15 7 4 10-8s7 8 6 9');
 tool(patterns.querySelector('[data-pattern="leaf"]'),'叶纹','M5 19C3 8 11 4 20 3c0 9-4 17-13 16M5 20 17 7');
 tool(patterns.querySelector('[data-pattern="flower"]'),'小花','M12 8c-7-12-12 2-4 3-14-1-4 14 2 5-3 14 12 8 7 1 12 6 15-9 4-8 6-10-9-12-9-1Z');dock.append(patterns);
 const primer=$('#techniquePrimer');primer.classList.add('dock-methods');primer.querySelector('.primer-heading').remove();primer.querySelectorAll('small').forEach(e=>e.remove());dock.append(primer);
 const base=$('.glaze-base-row');base.querySelector('small').remove();tool(base.querySelector('button'),'铺底','M4 8 12 4l8 4-8 4-8-4ZM4 12l8 4 8-4M4 16l8 4 8-4');dock.append(base);
 const history=document.createElement('div');history.className='workbench-history';history.append(tool($('#undoPaint'),'撤销','M5 8h7a7 7 0 0 1 7 7M9 4 5 8l4 4'),tool($('#clearPaint'),'清空','M5 6h14M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7M14 10v7'));dock.append(history);workspace.append(dock);
 const brushPresets=document.createElement('div');brushPresets.className='quiet-brush-presets';brushPresets.append($('.brush-row'));left.append(brushPresets);
 const adjustments=document.createElement('aside');adjustments.className='paint-method-controls';adjustments.setAttribute('aria-label','当前施釉方式设置');adjustments.append(...$$('.technique-adjustment'));workspace.append(adjustments);
 const rail=document.createElement('div');rail.className='paint-left-rail';
 const inputStack=document.createElement('div');inputStack.className='paint-input-stack';inputStack.append(adjustments,left);rail.append(inputStack);workspace.append(rail);
 $('.technique-info').hidden=true;
 const palette=document.createElement('div');palette.className='workbench-colors';palette.setAttribute('role','group');palette.setAttribute('aria-label','选择颜色');palette.append($('.palette'));workspace.append(palette);
 palette.querySelectorAll('.swatch').forEach(b=>b.title=b.dataset.name);
 const selected=document.createElement('span');selected.id='activeColorName';selected.className='active-color-name';selected.textContent='天青';palette.append(selected);
 const finishes=$('.glaze-finishes');right.append(finishes);finishes.querySelector(':scope>span').textContent='效果釉';
 const names={gloss:'流彩',satin:'晶花',speckle:'铁斑',crackle:'开片'};finishes.querySelectorAll('[data-glaze-finish]').forEach(button=>{button.querySelector('span').textContent=names[button.dataset.glazeFinish];button.title=names[button.dataset.glazeFinish]+' · 查看小样';});
 right.append($('.clear-glaze-row'),$('.firing-settings'));$('.firing-settings').open=true;
 $('.firing-settings').querySelector('summary').childNodes[0].textContent='烧成设置';
 $$('.process-grid button').forEach(b=>{b.querySelector('b').textContent={氧化焰:'氧化',还原焰:'还原',柴烧:'柴烧'}[b.dataset.fire];b.querySelector('small').textContent=b.dataset.temp;});
 $$('.cooling button').forEach(b=>b.textContent=b.dataset.cooling);
 const fire=document.createElement('div');fire.className='workbench-fire';fire.append($('#toResult'));right.append(fire);
 const back=$('#backToSelect');back.classList.add('workbench-back');right.append(back);
 right.querySelector('.workflow-actions')?.remove();
 const sample=$('.glaze-sample');sample.hidden=true;right.append(sample);
 const toggle=document.createElement('button');toggle.id='toggleKilnOptions';toggle.className='workbench-options-toggle';toggle.textContent='效果与烧成';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','workbenchOptions');right.id='workbenchOptions';right.setAttribute('aria-label','效果与烧成');workspace.append(toggle);
 toggle.onclick=()=>right.scrollIntoView({behavior:'smooth',block:'start'});
 $('.workshop-tabs').hidden=true;$('.paint-controls-body').hidden=true;$('.paint-controls-footer').hidden=true;$('#blankStageStatus').hidden=true;$('#finishMaterialNote').hidden=true;
 return {reset(){right.classList.remove('is-open');$('.firing-settings').open=true;sliders.querySelectorAll('input').forEach(input=>input.dispatchEvent(new Event('input')));}};
}
