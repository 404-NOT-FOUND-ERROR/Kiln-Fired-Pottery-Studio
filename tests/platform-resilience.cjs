const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const out=path.resolve('qa-artifacts/platform-resilience');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,reducedMotion:'reduce'});
  const errors=[],requests=[],reached=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
  await page.goto(pathToFileURL(path.resolve('platform/index.html')).href);
  await page.waitForFunction(()=>window.potteryStudio&&!document.querySelector('#startExperience').disabled);
  async function reachable(selector){
   const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
   const box=await el.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,hit:e.contains(hit)};});
   assert(box.w>=43.9&&box.h>=43.9&&box.hit,selector+' touch target '+JSON.stringify(box));reached.push(selector);
  }
  await page.click('#startExperience');await page.click('#beginSculpt');await reachable('#sculptRadius');
  await page.click('#toPaint');await page.locator('#screen2.active').waitFor();
  await reachable('#brushSizeRange');await reachable('#glazeLoadRange');
  await page.click('#applyBaseGlaze');await page.click('#toResult');
  await page.locator('#screen3.active').waitFor({timeout:60000});await page.locator('#firingOverlay').waitFor({state:'hidden'});
  await page.click('[data-panel="photo"]');await page.click('[data-scene="neutral"]');
  await page.waitForFunction(()=>document.querySelector('#resultView').dataset.scene==='neutral');
  for(const selector of ['#pieceName','[data-format="square"]','#artworkPreview','#save','#exportPhoto'])await reachable(selector);
  await page.click('[data-panel="result"]');
  for(const selector of ['[data-glaze-light="side"]','.glaze-view-options button:first-child','.glaze-recipe summary','.artifact-notes summary'])await reachable(selector);
  await page.click('[data-panel="learn"]');
  for(const selector of ['[data-compare="cooling"]','.observation-switch button:first-child','.observation-switch button:last-child','#exportComparison'])await reachable(selector);
  await page.screenshot({path:path.join(out,'tablet-controls.png')});
  await page.click('[data-panel="photo"]');await page.click('[data-scene="neutral"]');
  const before=await page.evaluate(()=>window.potteryStudio.inspectStudio().state.shape);
  const supported=await page.locator('#resultView canvas').evaluate(c=>{
   const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');
   if(!ext)return false;window.testContextRestore=()=>ext.restoreContext();ext.loseContext();return true;
  });
  assert(supported,'context-loss simulation is available');
  await page.locator('#resultView .render-status').waitFor({state:'visible'});
  await page.waitForTimeout(300);await page.evaluate(()=>window.testContextRestore());
  await page.locator('#resultView .render-status').waitFor({state:'hidden'});
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>window.potteryStudio.inspectStudio().state.shape),before,'context restore keeps the artwork');
  const resolution=await page.locator('#resultView canvas').evaluate(c=>({width:c.width,height:c.height}));
  assert(resolution.width*resolution.height<=2_000_000,'render resolution has a device budget');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const report={reached,contextRestored:true,resolution,offline:true,errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
