const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {prepareBlank,waitForFiring}=require('./workflow-helpers.cjs');
const portable=process.env.GLAZE_PORTABLE==='1',out=path.resolve('qa-artifacts/glaze-surface'+(portable?'-portable':''));fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({viewport:{width:1452,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));if(portable)await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const snap=()=>page.evaluate(async()=>window.potteryStudio?window.potteryStudio.inspectStudio():(await import('/studio.js')).inspectStudio());
 const settle=()=>page.waitForTimeout(650),shot=n=>page.screenshot({path:path.join(out,n+'.png')});
 const dismiss=async()=>{if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');};
 await page.goto(portable?pathToFileURL(path.resolve('dist/pottery-studio.html')).href:'http://127.0.0.1:4173/');await page.click('#startExperience');await dismiss();
 const recipes=[];
 for(const finish of ['gloss','satin','speckle','crackle']){
  if(recipes.length)await page.click('#restart');await prepareBlank(page);await dismiss();
  await page.click('[data-glaze="sky"]');await page.click('#applyBaseGlaze');await page.click('#applyBaseGlaze');
  await page.click('[data-glaze="shadow"]');await page.locator('#glazeLoadRange').fill('35');await page.locator('#brushSizeRange').fill('44');
  const r=await page.locator('#paintView canvas').boundingBox();
  for(const [x,y,endX,endY] of [[.41,.39,.45,.64],[.49,.38,.52,.60]]){await page.mouse.move(r.x+r.width*x,r.y+r.height*y);await page.mouse.down();await page.mouse.move(r.x+r.width*endX,r.y+r.height*endY,{steps:24});await page.mouse.up();}
  await page.click(`[data-glaze-finish="${finish}"]`);const shaped=(await snap()).state.shape;await page.click('#toResult');await waitForFiring(page);await dismiss();
  await page.click('[data-panel="result"]');await page.click('[data-glaze-light="soft"]');await settle();assert.deepEqual((await snap()).state.shape,shaped,'firing preserves the hand-made form');await shot(finish+'-soft');
  const sample=()=>page.locator('#glazeNoteSample').evaluate(c=>c.toDataURL()),soft=await sample();await page.click('[data-glaze-light="side"]');await settle();assert.notEqual(await sample(),soft,'glass reflection responds to changed light');await shot(finish+'-side');
  await page.locator('#glazeLightDirection').fill('50');await settle();const moved=await sample();await page.locator('#glazeLightDirection').fill('-50');await settle();assert.notEqual(await sample(),moved,'highlight moves across the same glaze');
  await page.click('[data-panel="learn"]');await page.locator('#compareSplit').fill('36');await settle();await shot(finish+'-comparison');
  await page.click('[data-compare="cooling"]');await settle();assert((await page.locator('#glazeAfterCaption').innerText()).includes('快冷'));
  await page.click('[data-panel="photo"]');await page.waitForFunction(()=>document.querySelector('#resultView').dataset.scene==='museum',{timeout:45000});await settle();await shot(finish+'-photo');
  await page.fill('#pieceName','釉面验证-'+finish);await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));
  const stored=await page.evaluate(name=>new Promise(resolve=>{const request=indexedDB.open('dongleya-pottery',1);request.onsuccess=()=>{const db=request.result,q=db.transaction('pieces').objectStore('pieces').getAll();q.onsuccess=()=>{resolve(q.result.find(p=>p.name===name));db.close();};};}),'釉面验证-'+finish);
  assert(stored.layers.roughness&&stored.layers.relief&&stored.layers.coat);assert(stored.thumbnail.startsWith('data:image/png'),'collection still exports a vessel cutout');if(finish==='gloss')fs.writeFileSync(path.join(out,'record.json'),JSON.stringify(stored));recipes.push({finish,seed:stored.settings.kilnSeed,glossFollowsLighting:true,storedMaps:true});
 }
 // Reproduce the reported white / ochre crackle recipe rather than only testing celadon.
 await page.click('#restart');await prepareBlank(page);await page.click('[data-glaze="moon"]');await page.click('#applyBaseGlaze');await page.click('#applyBaseGlaze');await page.click('[data-glaze="honey"]');await page.locator('#brushSizeRange').fill('60');await page.locator('#glazeLoadRange').fill('55');
 const r=await page.locator('#paintView canvas').boundingBox();for(const [x,y,endX,endY] of [[.41,.38,.52,.61],[.45,.56,.49,.42]]){await page.mouse.move(r.x+r.width*x,r.y+r.height*y);await page.mouse.down();await page.mouse.move(r.x+r.width*endX,r.y+r.height*endY,{steps:24});await page.mouse.up();}
 await page.click('[data-glaze-finish="crackle"]');await page.click('#toResult');await waitForFiring(page);await page.click('[data-panel="result"]');await page.click('[data-glaze-light="soft"]');await settle();await shot('white-ochre-crackle-glaze');await page.click('[data-panel="learn"]');await page.locator('#compareSplit').fill('20');await settle();await shot('white-ochre-crackle');
 // Reproduce the reported partial red / amber coat on a bare small jar.
 await page.click('#restart');await prepareBlank(page);await page.locator('#brushSizeRange').fill('55');await page.locator('#glazeLoadRange').fill('80');
 const vessel=await page.locator('#paintView canvas').boundingBox();
 for(const [color,strokes] of [['honey',[[.42,.40,.44,.51],[.40,.48,.48,.56]]],['copper',[[.47,.40,.51,.55],[.51,.42,.53,.53]]],['oxblood',[[.48,.43,.51,.48]]]]){await page.click(`[data-glaze="${color}"]`);for(let coat=0;coat<3;coat++)for(const [x,y,ex,ey] of strokes){await page.mouse.move(vessel.x+vessel.width*x,vessel.y+vessel.height*y);await page.mouse.down();await page.mouse.move(vessel.x+vessel.width*ex,vessel.y+vessel.height*ey,{steps:22});await page.mouse.up();}}
 await page.click('[data-glaze-finish="satin"]');await page.click('#toResult');await waitForFiring(page);await page.click('[data-panel="result"]');await page.click('[data-glaze-light="soft"]');await settle();await shot('red-amber-crystal-soft');
 await page.click('[data-inspect-camera="detail"]');await settle();await shot('red-amber-crystal-detail');
 await page.click('[data-panel="photo"]');for(const scene of ['museum','living','art']){await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(key=>document.querySelector('#resultView').dataset.scene===key,scene,{timeout:45000});await settle();await shot('red-amber-crystal-'+scene);}
 const legacy=await page.evaluate(()=>new Promise(resolve=>{
  const request=indexedDB.open('dongleya-pottery',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('pieces','readwrite'),store=tx.objectStore('pieces'),get=store.getAll();get.onsuccess=()=>{const record=get.result.find(p=>p.name==='釉面验证-gloss');record.settings.firingVersion=4;const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#bd3bed';ctx.fillRect(0,0,1024,1024);record.layers.fired=c.toDataURL();store.put(record);tx.oncomplete=()=>{resolve({id:record.id,raw:{base:record.layers.base,wet:record.layers.wet,glaze:record.layers.glaze},fired:record.layers.fired});db.close();};};};
 }));
 const readLegacy=()=>page.evaluate(id=>new Promise(resolve=>{const r=indexedDB.open('dongleya-pottery',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('pieces').objectStore('pieces').get(id);q.onsuccess=()=>{resolve(q.result);db.close();};};}),legacy.id);
 await page.click('#openCollection');await page.locator('.collection-item').filter({hasText:'釉面验证-gloss'}).click();await settle();assert.equal((await snap()).state.firingVersion,5,'legacy work uses the revised glaze model');
 assert.equal((await readLegacy()).layers.fired,legacy.fired,'opening a legacy work does not overwrite its stored record');
 await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));const updated=await readLegacy();assert.notEqual(updated.layers.fired,legacy.fired,'an explicit update saves the revised glaze');for(const key of Object.keys(legacy.raw))assert.equal(updated.layers[key],legacy.raw[key],'raw drawing remains intact: '+key);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);const report={portable,recipes,whiteOchreCrackle:true,partialRedAmberCrystalInAllPhotoScenes:true,legacyWorksPreserveRawStrokes:true,errors,requests};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
