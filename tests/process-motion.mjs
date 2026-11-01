import assert from 'node:assert/strict';
import {kilnBreaks,kilnCurveX,kilnHeatAt,kilnPhaseAt} from '../kiln-timing.mjs';
const increments=Array.from({length:100},(_,i)=>kilnCurveX((i+1)/100)-kilnCurveX(i/100));
assert(Math.max(...increments)-Math.min(...increments)<1e-9,'time marker advances at the same horizontal speed in every phase');
assert.equal(kilnCurveX(-1),kilnCurveX(0));assert.equal(kilnCurveX(2),kilnCurveX(1));
let rising=-1,cooling=2,held=0;
for(let i=0;i<=1000;i++){const t=i/1000,h=kilnHeatAt(t);assert(h>=0&&h<=1);if(kilnPhaseAt(t)===0){assert(h>=rising);rising=h;}if(kilnPhaseAt(t)===1){assert.equal(h,1);held++;}if(kilnPhaseAt(t)===2){assert(h<=cooling);cooling=h;}}
assert(held>500,'the hold is the longest visible interval');
for(const b of kilnBreaks)assert(Math.abs(kilnHeatAt(b-1e-6)-kilnHeatAt(b+1e-6))<1e-5,'temperature has no jump at phase boundaries');
assert.equal(kilnHeatAt(0),0);assert.equal(kilnHeatAt(1),0);
console.log('Uniform time axis, long hold, continuous temperature and cold endpoints passed.');
