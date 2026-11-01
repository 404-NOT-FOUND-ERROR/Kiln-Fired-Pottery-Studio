const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepareBlank,completeFiring,waitForFiring}=require('./workflow-helpers.cjs');
const dir=path.resolve(__dirname,'../qa-artifacts/reactive');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const snapshot=(layers=false)=>page.evaluate(async layers=>(await import('/studio.js')).inspectStudio({layers}),layers);
  const dismiss=async()=>{await page.locator('#onboardingDismiss').waitFor({state:'visible',timeout:700}).catch(()=>{});if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');};
  const capture=async name=>{await page.waitForTimeout(200);await page.screenshot({path:path.join(dir,name+'.png')});};
  const draw=async(x1,y1,x2,y2,steps=24,selector='#paintView canvas')=>{const r=await page.locator(selector).boundingBox();await page.mouse.move(r.x+r.width*x1,r.y+r.height*y1);await page.mouse.down();await page.mouse.move(r.x+r.width*x2,r.y+r.height*y2,{steps});await page.mouse.up();await page.waitForTimeout(80);};
  await page.goto('http://127.0.0.1:4173/?v=reactive-handmade-20261007');await page.click('#startExperience');await dismiss();
  await page.click('[data-profile-preset="handmade"]');const hand=(await snapshot()).state.shape;await page.click('#beginSculpt');assert(hand.deformation,'handmade preset must create a local deformation field');
  await draw(.52,.47,.58,.44,16,'#selectView canvas');assert.notDeepEqual((await snapshot()).state.shape.deformation,hand.deformation,'local hand pinch changes the touched surface');
  await page.click('#undoShape');assert.deepEqual((await snapshot()).state.shape,hand);await page.click('[data-sculpt="dent"]');await draw(.50,.49,.54,.53,18,'#selectView canvas');
  const dented=(await snapshot()).state.shape;assert.notDeepEqual(dented.deformation,hand.deformation);await capture('01-hand-pinched-clay');
  await prepareBlank(page);await dismiss();const shaped=(await snapshot()).state.shape;assert(shaped.trimmed);assert(shaped.deformation);assert.equal((await snapshot()).state.decoration,'glaze');
  await page.click('[data-glaze="forest"]');await draw(.47,.42,.54,.60);const first=(await snapshot(true)).layers.glaze;
  assert(first.maxAlpha>15&&first.maxAlpha<210,'a single coat must be translucent');await capture('02-single-soft-coat');
  await draw(.47,.42,.54,.60);const second=(await snapshot(true)).layers.glaze;assert(second.alphaSum>first.alphaSum*1.3,'a repeated pass must build a visibly thicker coat');assert(second.maxAlpha>first.maxAlpha);
  await capture('03-double-soft-coat');await page.click('#clearPaint');await page.click('[data-glaze="sky"]');await page.click('#applyBaseGlaze');
  await page.click('[data-glaze="change"]');await page.locator('#brushSizeRange').fill('60');await page.locator('#glazeLoadRange').fill('80');
  for(let i=0;i<3;i++)await draw(.40,.38,.58,.64,32);
  await capture('04-glaze-recipe-before');
  await page.click('#toResult');await waitForFiring(page);await completeFiring(page);await page.locator('.museum-mode').waitFor({timeout:30000});await page.waitForTimeout(500);assert.deepEqual((await snapshot()).state.shape,shaped);await capture('05-gloss-museum');
  await page.click('[data-panel="learn"]');await page.click('[data-observe="before"]');await capture('06-unfired-comparison');await page.click('[data-observe="after"]');await capture('07-fired-comparison');await page.click('[data-observe="alternate"]');await capture('08-other-cooling');await page.click('[data-observe="after"]');await page.click('[data-panel="photo"]');
  await page.click('[data-scene="art"]');await page.click('[data-camera="detail"]');await capture('09-gloss-detail');await page.click('[data-camera="full"]');await capture('10-gloss-art');
  await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));await page.click('#openCollection');await page.locator('.collection-item').first().waitFor();await capture('11-handmade-shelf');
  const saved=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('dongleya-pottery',1);request.onsuccess=()=>{const db=request.result,q=db.transaction('pieces').objectStore('pieces').getAll();q.onsuccess=()=>{resolve(q.result[0]);db.close();};};}));
  assert(saved.layers.relief);assert.deepEqual(saved.settings.shape,shaped);fs.writeFileSync(path.join(dir,'record.json'),JSON.stringify(saved));
  const seam=await page.evaluate(async shape=>{const {shapedGeometry}=await import('/vessel-geometry.js'),geo=shapedGeometry(shape),n=geo.getAttribute('normal'),seg=geo.userData.shaped.segments,rows=n.count/(seg+1);let worst=0,min=1;for(let i=0;i<n.count;i++)min=Math.min(min,Math.hypot(n.getX(i),n.getY(i),n.getZ(i)));for(let i=0;i<rows;i++){const j=seg*rows+i;worst=Math.max(worst,Math.hypot(n.getX(i)-n.getX(j),n.getY(i)-n.getY(j),n.getZ(i)-n.getZ(j)));}geo.dispose();return {min,worst};},shaped);
  assert(seam.min>.9,'deformed mesh normals must remain unit length');assert(seam.worst<1e-5,'duplicate seam normals must agree');
  await page.locator('.collection-header button').click();await page.reload();await page.click('#introCollection');await page.locator('.collection-item[data-example="false"]').first().click();await page.waitForFunction(()=>document.querySelector('#app').classList.contains('result-mode'));assert.deepEqual((await snapshot()).state.shape,shaped);await capture('12-restored-handmade');
  for(const finish of ['satin','speckle','crackle']){
   await page.click('#restart');await page.click('[data-profile-preset="round"]');await prepareBlank(page);await dismiss();await page.click('[data-glaze="sky"]');await page.click('#applyBaseGlaze');await page.click('[data-glaze="change"]');await page.locator('#brushSizeRange').fill('60');await page.locator('#glazeLoadRange').fill('80');for(let i=0;i<3;i++)await draw(.40,.38,.58,.64,32);
   await page.click(`[data-glaze-finish="${finish}"]`);await page.click('#toResult');await waitForFiring(page);await completeFiring(page);await page.locator('.museum-mode').waitFor({timeout:30000});await page.click('[data-scene="art"]');await page.click('[data-camera="full"]');await capture('13-'+finish);await page.click('[data-camera="detail"]');await capture('14-'+finish+'-detail');
  }
  await page.click('#restart');await page.click('[data-profile-preset="round"]');await prepareBlank(page);await dismiss();await page.click('[data-decoration="underglaze"]');
  assert(await page.locator('.glaze-finishes').isHidden());assert(await page.locator('.glaze-base-row').isHidden());assert.equal((await snapshot()).state.clearGlaze,true);
  await page.click('[data-glaze="forest"]');for(let i=0;i<3;i++)await draw(.43,.40,.54,.61,24);await page.click('[data-glaze="change"]');await draw(.45,.56,.56,.46,24);await capture('15-pattern-before');
  const patternLayers=(await snapshot(true)).layers;assert(patternLayers.underglaze.alphaSum>0);assert.equal(patternLayers.glaze.alphaSum,0,'stable pattern and reactive glaze must go into different layers');
  await page.click('#toResult');await waitForFiring(page);await completeFiring(page);await page.locator('.museum-mode').waitFor({timeout:30000});await page.fill('#pieceName','纹样保留验证');await page.click('[data-scene="art"]');await capture('16-pattern-fired');
  await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));await page.click('#openCollection');await page.locator('.collection-item').first().waitFor();
  const stableColor=await page.evaluate(async()=>{
   const record=await new Promise(resolve=>{const r=indexedDB.open('dongleya-pottery',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('pieces').objectStore('pieces').getAll();q.onsuccess=()=>{resolve(q.result.find(p=>p.name==='纹样保留验证'));db.close();};};});
   async function data(src){const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,1024,1024).data;}
   const [base,ink,fired]=await Promise.all(['base','glaze','fired'].map(k=>data(record.layers[k])));let maxError=0;for(let i=0;i<base.length;i+=4){const a=ink[i+3]/255;for(let c=0;c<3;c++)maxError=Math.max(maxError,Math.abs(Math.round(base[i+c]*(1-a)+ink[i+c]*a)-fired[i+c]));}return {maxError};
  });assert(stableColor.maxError<=1,'fired pattern must retain its original pixels');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({firstCoat:first,secondCoat:second,handSculpt:true,savedRelief:true,profileRetained:true,normals:seam,firingFamilies:['gloss','satin','speckle','crackle'],stablePattern:stableColor,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
