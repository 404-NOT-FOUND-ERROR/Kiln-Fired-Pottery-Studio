// Relocate the original controls without replacing their handlers or undo history.
export function setupLightStudio(state){
  const $=s=>document.querySelector(s),stage=$('.selection-stage'),tools=$('.sculpt-tools');
  const info=document.createElement('section');info.className='sculpt-info';
  info.innerHTML='<h2 id="sculptIdentity">小罐 · 自由塑形</h2>';
  const measurements=tools.querySelector('.sculpt-measurements');
  const height=measurements.querySelector('#shapeHeight'),mouth=measurements.querySelector('#shapeMouth'),width=measurements.querySelector('#shapeWidth');
  measurements.replaceChildren();for(const [label,value] of [['高度',height],['口径',mouth],['最大直径',width]]){const line=document.createElement('span');line.append(label+' ',value);measurements.append(line);}
  info.append(measurements,$('#clayStatus'),$('#sculptHint'));
  const strength=document.createElement('label');strength.className='sculpt-strength';
  strength.innerHTML='<span>局部力度</span><input id="sculptStrength" type="range" min="10" max="100" value="50" aria-label="局部力度"><output id="sculptStrengthValue">50%</output>';info.append(strength);$('.selection-controls-body').append(info);
  const dock=document.createElement('div');dock.className='sculpt-tools sculpt-dock';dock.setAttribute('aria-label','塑形工具');
  const paths={push:'M5 12h14M8 9l-3 3 3 3m8-6 3 3-3 3',pinch:'M8 13V7a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 5-3 7-7 7-3 0-4-2-6-4l-3-4c-1-2 1-3 2-2l2 2',dent:'M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',smooth:'M3 7c3-4 6 4 9 0s6 4 9 0M3 12c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0',height:'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4'};
  for(const [tool,label] of Object.entries({push:'推拉',pinch:'手捏',dent:'压痕',smooth:'抚平',height:'拉高'})){
    const button=tools.querySelector(`[data-sculpt="${tool}"]`);button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[tool]}"/></svg><span>${label}</span>`;dock.append(button);
  }
  const utilities=tools.querySelector('.sculpt-utilities');
  for(const [id,label,path] of [['undoShape','撤销','M5 8h7a7 7 0 0 1 7 7M9 4 5 8l4 4'],['resetShape','复位','M19 18a9 9 0 1 0-6 3M19 18v-5m0 5h-5']]){const b=utilities.querySelector('#'+id);b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span>`;}
  const extras=document.createElement('details');extras.className='sculpt-extras';extras.innerHTML='<summary aria-label="更多塑形操作">···</summary><div></div>';extras.querySelector('div').append($('#shapeSpin'),$('#changeStartingForm'),$('#workshopReset'));$('.selection-controls').append(extras);dock.append(utilities);tools.remove();stage.append(dock);
  const radius=document.createElement('label');radius.className='sculpt-radius';radius.innerHTML='<span>笔刷大小</span><small>大</small><input id="sculptRadius" type="range" min="60" max="180" value="100" aria-label="塑形笔刷大小"><small>小</small>';stage.append(radius);
  const camera=$('.workshop-camera'),zoom=$('.zoom-control');if(zoom){const title=document.createElement('span');title.className='zoom-title';title.textContent='缩放';zoom.prepend(title);camera.prepend($('#workshopRotate'));$('#workshopRotate').innerHTML='<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35"><ellipse cx="14" cy="14" rx="12" ry="5"/><ellipse cx="14" cy="14" rx="5" ry="12" transform="rotate(-25 14 14)"/></svg><span>旋转</span>';}
  state.sculptRadius=1;state.sculptStrength=1;
  $('.sculpt-extras').addEventListener('click',e=>{if(e.target.closest('button'))$('.sculpt-extras').open=false;});
  $('#sculptRadius').oninput=e=>state.sculptRadius=Number(e.target.value)/100;
  $('#sculptStrength').oninput=e=>{state.sculptStrength=Number(e.target.value)/50;$('#sculptStrengthValue').value=e.target.value+'%';};
}
