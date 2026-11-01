const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa-artifacts/platform-layout');fs.mkdirSync(out,{recursive:true});
const check=fs.readFileSync('C:/Users/502BadGateway/.codex/skills/dongleya-content-asset-skill/scripts/preview-layout-runtime.js','utf8').trim();
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:810},reducedMotion:'reduce'}),errors=[],network=[],results=[];
 const emulation=await page.context().newCDPSession(page);
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});
 await page.goto(pathToFileURL(path.join(root,'platform/index.html')).href);
 await page.waitForFunction(()=>window.potteryStudio&&!document.querySelector('#startExperience').disabled);
 async function inspect(stage){
  for(const [width,height] of [[1440,810],[1024,768],[768,1024],[390,753],[352,447]]){
   await emulation.send('Emulation.setTouchEmulationEnabled',{enabled:width<=1024});
   await page.setViewportSize({width,height});await page.waitForTimeout(250);
   const layout=await page.evaluate('('+check+')('+JSON.stringify({touch:width<=1024,minText:12,minBodyText:14,minTouchTarget:44})+')');
   results.push({stage,width,height,layout});
   await page.screenshot({path:path.join(out,`${stage}-${width}.png`)});
  }
  await emulation.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await page.setViewportSize({width:1440,height:810});await page.waitForTimeout(100);
 }
 await inspect('intro');await page.click('#startExperience');await inspect('choose');await page.click('#beginSculpt');await inspect('sculpt');
 await page.click('#toPaint');await page.locator('#screen2.active').waitFor();await inspect('paint');
 await page.click('#applyBaseGlaze');await page.click('#toResult');await page.locator('#screen3.active').waitFor({timeout:60000});await page.locator('#firingOverlay').waitFor({state:'hidden'});
 await page.click('[data-panel="photo"]');await page.click('[data-scene="neutral"]');await inspect('photo');
 for(const scene of ['museum','living','art']){await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(s=>document.querySelector('#resultView').dataset.scene===s,scene,{timeout:45000});await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,`${scene}.png`)});}
 await page.click('[data-panel="result"]');await inspect('observe');await page.click('[data-panel="learn"]');await inspect('compare');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({errors,network,results},null,2));
 console.log(JSON.stringify({errors,network,issues:results.map(r=>({stage:r.stage,size:[r.width,r.height],small:r.layout.smallText?.samples,body:r.layout.smallBody?.samples,inputs:r.layout.smallInputs?.samples,targets:r.layout.smallTargets?.samples,offscreen:r.layout.offscreen?.samples,overlaps:r.layout.overlaps?.samples,occluded:r.layout.occluded?.samples})).filter(r=>r.small?.length||r.body?.length||r.inputs?.length||r.targets?.length||r.offscreen?.length||r.overlaps?.length||r.occluded?.length)},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
