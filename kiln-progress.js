import {kilnPhaseAt,kilnCurveX,kilnHeatAt,kilnCurvePath} from './kiln-timing.mjs';
import {mountTimeWheel,showProcessTip} from './time-wheel.js';
const tips=[
 ['釉层干燥后，再进入窑炉。','坯体和装饰层会一同受热。'],
 ['高温下，釉层逐渐熔融。','釉的厚薄会影响流动与聚色。'],
 ['冷却也会改变釉面的细部。','窑炉充分冷却后，才可以取出器物。'],
 ['这一次窑火，留下的是你的作品。']
];
export function setupKilnProgress(overlay){
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','釉烧与冷却过程');overlay.tabIndex=-1;
 overlay.querySelector('.firing-core').removeAttribute('role');overlay.querySelector('.firing-core').removeAttribute('aria-live');overlay.querySelector('.firing-phase').setAttribute('role','status');overlay.querySelector('.firing-phase').setAttribute('aria-live','polite');
 const visual=document.createElement('div');visual.className='kiln-visual';visual.innerHTML='<div class="kiln-time"></div><div class="kiln-temperature"><span>示意温度</span><b id="kilnTemperature">25<small>℃</small></b></div><svg class="kiln-chart" viewBox="0 0 400 100" role="img" aria-label="时间匀速前进，高温烧成占据较长的平台"><path class="kiln-axis" d="M5 76H395"/><path class="kiln-curve" d="'+kilnCurvePath+'"/><circle id="kilnMarker" r="4" cx="5" cy="74"/><text x="5" y="95">开始</text><text x="395" y="95" text-anchor="end">时间 →</text></svg><ol class="kiln-steps"><li>升温</li><li>高温烧成</li><li>冷却</li><li>出窑</li></ol><div class="process-tip"><small>小贴士</small><p id="kilnTip" aria-live="polite"></p></div>';
 overlay.querySelector('.firing-phase').after(visual);const updateClock=mountTimeWheel(visual.querySelector('.kiln-time'),'釉烧进度'),marker=visual.querySelector('#kilnMarker');let seed=0,lastTemperature=-1;
 overlay.addEventListener('keydown',e=>{if(!overlay.hidden&&e.key==='Tab'){e.preventDefault();overlay.focus();}});
 return (t,temperature)=>{
  if(t===0)seed=Math.floor(Math.random()*7);const x=kilnCurveX(t),heat=kilnHeatAt(t),phase=kilnPhaseAt(t);
  updateClock(t);overlay.style.setProperty('--kiln-heat',heat.toFixed(3));const value=Math.round(25+(temperature-25)*heat);if(value!==lastTemperature){overlay.querySelector('#kilnTemperature').innerHTML=value+'<small>℃</small>';lastTemperature=value;}
  marker.setAttribute('cx',x);marker.setAttribute('cy',74-66*heat);overlay.querySelectorAll('.kiln-steps li').forEach((li,i)=>li.setAttribute('aria-current',String(i===phase)));
  showProcessTip(visual.querySelector('#kilnTip'),tips[phase][(seed+Math.floor(t*8600/2500))%tips[phase].length]);
 };
}
