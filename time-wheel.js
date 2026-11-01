const clamp=t=>Math.max(0,Math.min(1,t));
export function mountTimeWheel(container,label){
  const ticks=Array.from({length:24},(_,i)=>`<line x1="64" y1="${i%6===0?8:11}" x2="64" y2="${i%6===0?15:14}" transform="rotate(${i*15} 64 64)"/>`).join('');
  container.classList.add('time-wheel');container.setAttribute('role','progressbar');container.setAttribute('aria-label',label+'，时间已压缩');container.setAttribute('aria-valuemin','0');container.setAttribute('aria-valuemax','100');
  container.innerHTML=`<svg viewBox="0 0 128 128" aria-hidden="true"><g class="time-wheel-ticks">${ticks}</g><circle class="time-wheel-track" cx="64" cy="64" r="44"/><circle class="time-wheel-progress" cx="64" cy="64" r="44" pathLength="100" stroke-dasharray="100" transform="rotate(-90 64 64)"/><g class="time-wheel-hand"><line x1="64" y1="69" x2="64" y2="25"/><circle cx="64" cy="25" r="2.5"/></g><circle class="time-wheel-center" cx="64" cy="64" r="3"/></svg>`;
  const progress=container.querySelector('.time-wheel-progress'),hand=container.querySelector('.time-wheel-hand');let last=-1;
  return t=>{t=clamp(t);progress.setAttribute('stroke-dashoffset',String(100*(1-t)));hand.setAttribute('transform',`rotate(${t*360} 64 64)`);const percent=Math.round(t*100);if(percent!==last){container.setAttribute('aria-valuenow',String(percent));last=percent;}};
}
export function showProcessTip(node,text){
  if(node.textContent===text)return;node.textContent=text;node.getAnimations().forEach(a=>a.cancel());
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches)node.animate([{opacity:0},{opacity:1}],{duration:300});
}
