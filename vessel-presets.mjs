import {newProfile,normalizeProfile} from './vessel-profile.mjs';
// Silhouette studies, not replicas of any single museum object.
export const vesselPresets=[
 {id:'jar',form:'jar',name:'小罐',note:'自由起点 · 肩腹圆润',height:1.72,radii:[.62,.72,.82,.92,.98,1.01,1.02,1.02,1.01,.99,.96,.91,.85,.78,.73,.70,.69,.69,.71,.725]},
 {id:'bowl',form:'bowl',name:'茶碗',note:'自由起点 · 敞口浅腹',height:1.05,radii:[.38,.42,.47,.53,.6,.67,.74,.81,.88,.94,1.0,1.05,1.1,1.15,1.2,1.24,1.28,1.31,1.34,1.36]},
 {id:'meiping',form:'vase',name:'梅瓶',note:'古代器形 · 小口丰肩',height:2.85,radii:[.4,.43,.47,.5,.54,.59,.64,.69,.74,.8,.86,.91,.95,.94,.87,.72,.46,.27,.27,.3],source:'https://www.dpm.org.cn/lemmas/239389.html'},
 {id:'yuhuchun',form:'vase',name:'玉壶春',note:'古代器形 · 细颈垂腹',height:2.8,radii:[.43,.5,.62,.73,.81,.86,.87,.85,.8,.71,.6,.48,.36,.28,.25,.25,.26,.28,.33,.41],source:'https://www.dpm.org.cn/lemmas/241111.html'},
 {id:'gourd',form:'vase',name:'葫芦瓶',note:'古代器形 · 双腹束腰',height:2.9,radii:[.41,.55,.7,.8,.83,.8,.7,.55,.35,.28,.32,.45,.54,.56,.52,.43,.29,.25,.25,.27],source:'https://www.nga.gov/artworks/1730-vase-shape-double-gourd'},
 {id:'douli',form:'bowl',name:'斗笠碗',note:'古代器形 · 斜壁敞口',height:1.05,radii:[.31,.34,.4,.46,.52,.58,.64,.7,.76,.82,.88,.94,1,1.06,1.12,1.18,1.24,1.3,1.36,1.42]}
];
export function starterProfile(id){const preset=vesselPresets.find(p=>p.id===id)||vesselPresets[0];return normalizeProfile({...newProfile(preset.form,'round'),height:preset.height,radii:preset.radii});}
export function presetSilhouette(p){
 const scale=76/Math.max(p.height,Math.max(...p.radii)*2),cy=90,cx=50,points=p.radii.map((r,i)=>[cx+r*scale,cy-i/19*p.height*scale]);
 const path='M'+points.map(p=>p.join(',')).join(' L')+' L'+[cx-p.radii.at(-1)*scale,cy-p.height*scale].join(',')+' L'+[...points].reverse().map(([x,y])=>[100-x,y].join(',')).join(' L')+' Z',mouth=p.radii.at(-1)*scale,y=cy-p.height*scale;
 return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="clay-${p.id}"><stop stop-color="#75604b"/><stop offset=".38" stop-color="#c3ae95"/><stop offset=".7" stop-color="#ab9276"/><stop offset="1" stop-color="#705b45"/></linearGradient></defs><ellipse cx="50" cy="93" rx="30" ry="3" fill="#51432c" opacity=".08"/><path d="${path}" fill="url(#clay-${p.id})" stroke="#806951" stroke-width=".6" stroke-linejoin="round"/><ellipse cx="50" cy="${y}" rx="${mouth}" ry="${Math.max(1.8,mouth*.17)}" fill="#735e47" stroke="#c8b69e" stroke-width="2"/></svg>`;
}
export function mountVesselPresets(){const container=document.querySelector('.model-select');container.innerHTML=vesselPresets.map(p=>`<button class="model-btn" data-form="${p.form}" data-preset="${p.id}" data-name="${p.name}" aria-pressed="${p.id==='jar'}"><span class="model-thumb">${presetSilhouette(p)}</span><strong>${p.name}</strong><small>${p.note}</small></button>`).join('');}
