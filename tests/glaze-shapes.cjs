// Review the same saved brush layers on three physical profiles and four glazes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const portable=process.env.GLAZE_PORTABLE==='1',out=path.resolve('qa-artifacts/glaze-shapes'+(portable?'-portable':''));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const {starterProfile}=await import(pathToFileURL(path.resolve('vessel-presets.mjs')).href);
 const source=JSON.parse(fs.readFileSync(path.resolve('qa-artifacts/glaze-surface'+(portable?'-portable':'')+'/record.json'),'utf8')),fixtures=[];
 for(const presetId of ['jar','bowl','meiping'])for(const finish of ['gloss','satin','speckle','crackle']){
  const shape=starterProfile(presetId),r=structuredClone(source);shape.trimmed=true;r.id='scale-'+presetId+'-'+finish;r.name=r.id;r.createdAt=new Date().toISOString();
  Object.assign(r.settings,{shape,form:shape.form,presetId,object:{jar:'小罐',bowl:'茶碗',meiping:'梅瓶'}[presetId],glazeFinish:finish,kilnSeed:172913,firingVersion:4});fixtures.push(r);
 }
 const browser=await chromium.launch({headless:true,channel:'msedge'});try{
  const page=await browser.newPage({viewport:{width:1452,height:900},reducedMotion:'reduce'}),errors=[],requests=[],report=[];
  page.on('pageerror',e=>errors.push(e.message));if(portable)await page.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
  await page.goto(portable?pathToFileURL(path.resolve('dist/pottery-studio.html')).href+'?preview=1':'http://127.0.0.1:4173/?preview=1');await page.locator('#screen3.active').waitFor({timeout:30000});if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
  await page.evaluate(records=>new Promise((resolve,reject)=>{const request=indexedDB.open('dongleya-pottery',1);request.onupgradeneeded=()=>request.result.createObjectStore('pieces',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;try{const tx=db.transaction('pieces','readwrite');for(const record of records)tx.objectStore('pieces').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);}catch(error){db.close();reject(error);}};}),fixtures);
  for(const record of fixtures){
   await page.click('#openCollection');await page.locator('.collection-item').filter({hasText:record.name}).click();await page.click('[data-panel="result"]');await page.click('[data-glaze-light="soft"]');await page.click('[data-inspect-camera="full"]');await page.waitForTimeout(350);
   const state=await page.evaluate(async()=>window.potteryStudio?window.potteryStudio.inspectStudio().state:(await import('/studio.js')).inspectStudio().state);assert.equal(state.firingVersion,5);assert.equal(state.kilnSeed,172913);assert.deepEqual(state.shape,record.settings.shape);assert.equal(state.glazeFinish,record.settings.glazeFinish);
   await page.screenshot({path:path.join(out,record.name+'-full.png')});await page.click('[data-inspect-camera="detail"]');await page.waitForTimeout(200);await page.screenshot({path:path.join(out,record.name+'-detail.png')});
   report.push({preset:state.presetId,finish:state.glazeFinish,heightMM:state.shape.height*50,sameRawLayers:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({portable,recipes:report,errors,requests},null,2));console.log(JSON.stringify({portable,recipes:report,errors,requests}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
