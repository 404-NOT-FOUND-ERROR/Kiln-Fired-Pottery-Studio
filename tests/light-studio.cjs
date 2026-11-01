const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shape=()=>page.evaluate(async()=>(await import('/studio.js')).inspectStudio().state.shape);
  const drag=async()=>{const r=await page.locator('#selectView canvas').boundingBox();await page.mouse.move(r.x+r.width*.55,r.y+r.height*.46);await page.mouse.down();await page.mouse.move(r.x+r.width*.60,r.y+r.height*.44,{steps:16});await page.mouse.up();await page.waitForTimeout(150);};
  await page.goto('http://127.0.0.1:4173/');await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');await page.click('#beginSculpt');await page.click('[data-sculpt="pinch"]');const original=await shape();
  const change=p=>p.deformation.radial.reduce((sum,x)=>sum+Math.abs(x),0);
  await page.locator('#sculptStrength').fill('25');await drag();const gentle=await shape();assert(gentle.deformation);await page.click('#undoShape');assert.deepEqual(await shape(),original);
  await page.locator('#sculptStrength').fill('75');await drag();const firm=await shape();assert(change(firm)>change(gentle)*1.8,'greater force deforms clay more');await page.click('#undoShape');
  await page.locator('#sculptStrength').fill('25');await page.locator('#sculptRadius').fill('60');await drag();const narrow=await shape();await page.click('#undoShape');
  await page.locator('#sculptRadius').fill('180');await drag();const wide=await shape();const affected=p=>p.deformation.radial.filter(x=>Math.abs(x)>.001).length;assert(affected(wide)>affected(narrow)*1.5,'a larger tool affects a wider area');await page.click('#undoShape');assert.deepEqual(await shape(),original);
  for(const [width,height] of [[1600,900],[1024,720],[768,844],[390,844],[320,740]]){await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow at '+width);for(const tool of ['push','pinch','dent','smooth','height']){const r=await page.locator(`[data-sculpt="${tool}"]`).boundingBox();assert(r.x>=0&&r.x+r.width<=width&&r.y+r.height<=height,'floating sculpt tools remain reachable');}}
  await page.setViewportSize({width:1600,height:900});await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);await page.screenshot({path:'qa-artifacts/light-studio/sculpt-final.png'});assert.deepEqual(errors,[]);
  const report={forceRatio:change(firm)/change(gentle),narrowArea:affected(narrow),wideArea:affected(wide),undoPreserved:true,widths:[1600,1024,768,390,320],errors};fs.writeFileSync('qa-artifacts/light-studio/interaction-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
