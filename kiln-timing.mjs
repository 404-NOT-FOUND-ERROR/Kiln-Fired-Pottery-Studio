// Presentation timing; this is not a physical kiln schedule.
export const kilnBreaks=Object.freeze([.18,.76,.94]);
export function kilnPhaseAt(t){return t<kilnBreaks[0]?0:t<kilnBreaks[1]?1:t<kilnBreaks[2]?2:3;}
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
// Horizontal distance is elapsed time. A long hold must be a wide plateau,
// not a short segment on which the marker suddenly slows down.
export function kilnCurveX(t){return 5+390*clamp(t);}
export function kilnHeatAt(t){const [rise,hold,cool]=kilnBreaks;t=clamp(t);return t<rise?smooth(t/rise):t<hold?1:t<cool?1-smooth((t-hold)/(cool-hold)):0;}
const rise=kilnCurveX(kilnBreaks[0]),hold=kilnCurveX(kilnBreaks[1]),cool=kilnCurveX(kilnBreaks[2]);
export const kilnCurvePath=`M5 74C${5+(rise-5)/3} 74 ${5+(rise-5)*2/3} 8 ${rise} 8H${hold}C${hold+(cool-hold)/3} 8 ${hold+(cool-hold)*2/3} 74 ${cool} 74H395`;
