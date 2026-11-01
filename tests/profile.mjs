import assert from 'node:assert/strict';
import {newProfile,sculptProfile,sculptLocal,handmadeProfile,deformationAt,trimProfile,surfaceRows,normalizeProfile,radiusAt} from '../vessel-profile.mjs';
for(const form of ['jar','bowl','vase']){
 let p=newProfile(form);
 for(let i=0;i<500;i++)p=sculptProfile(p,{fraction:(i%31)/30,radial:Math.sin(i)*.11,vertical:Math.cos(i)*.13,tool:['push','height','smooth'][i%3]});
 p=trimProfile(p);const rows=surfaceRows(p);
 assert(p.height>=.85&&p.height<=3.5);assert(p.radii.every(r=>r>=.24&&r<=1.5));assert(p.wall>=.06);
 assert(rows.every(row=>Number.isFinite(row.r)&&row.r>=0&&Number.isFinite(row.y)&&row.v>=0&&row.v<=1));
 const outer=rows.slice(7,80),inner=rows.slice(88,-1).reverse();
 assert.equal(outer.length,73);assert.equal(inner.length,72);
 assert(outer.every((row,i)=>i===0||row.y>outer[i-1].y),'exterior must not fold over');
 assert(p.radii.at(-1)-p.wall>.1,'mouth must remain open');
 for(const row of rows.slice(88,-1))assert(radiusAt(p,(row.y-.035)/p.height)-row.r>=p.wall-.003,'inner wall must stay inside outer wall at the same height');
 assert(rows[0].y>rows[4].y+.04,'trimmed foot has a real recess inside its contact ring');
 const a=surfaceRows(newProfile(form)),b=surfaceRows(p);assert.deepEqual(a.map(row=>row.v),b.map(row=>row.v),'UV rows must stay stable under shaping');
 assert.equal(p.trimmed,true);
}
assert.deepEqual(normalizeProfile({radii:[]}),newProfile());
let hand=handmadeProfile(newProfile('jar','round'));
for(let i=0;i<500;i++)hand=sculptLocal(hand,{fraction:(i%27)/26,angle:i*.17,radial:Math.sin(i)*.05,vertical:Math.cos(i)*.08,tool:i%7===0?'smooth':'pinch'});
assert(hand.deformation.radial.some(x=>Math.abs(x)>.05));
for(let j=0;j<24;j++){let last=-1;for(let i=0;i<=72;i++){const t=i/72,d=deformationAt(hand,t,j/24*Math.PI*2),y=.035+t*hand.height+d.lift;assert(y>last,'local hand shaping must not fold the wall vertically');assert(radiusAt(hand,t)+d.radial-hand.wall>=.0999,'local shaping retains a hollow wall');last=y;}}
const localized=sculptLocal(newProfile('jar','round'),{fraction:.6,angle:0,radial:-.1});
assert(deformationAt(localized,.6,0).radial<-.08);assert(Math.abs(deformationAt(localized,.6,Math.PI).radial)<.001,'finger pressure only changes the touched side');
console.log('Profile constraints, open mouth, foot trimming and stable UVs passed');
