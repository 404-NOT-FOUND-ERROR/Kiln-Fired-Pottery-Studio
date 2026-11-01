const {prepareBlank,completeFiring}=require('./workflow-helpers.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../qa-artifacts/making-flow');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const snapshot=()=>page.evaluate(async()=>(await import('/studio.js')).inspectStudio());
  const screenshot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
  const dismiss=async()=>{await page.locator('#onboardingDismiss').waitFor({state:'visible',timeout:1200}).catch(()=>{});if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');};
  const prepare=async()=>{await prepareBlank(page);assert.equal((await snapshot()).state.clayStage,'bisque');assert((await snapshot()).state.shape.trimmed);};
  const draw=async(canvas,x1,y1,x2,y2,steps=30)=>{await page.locator(canvas).scrollIntoViewIfNeeded();const r=await page.locator(canvas).boundingBox();await page.mouse.move(r.x+r.width*x1,r.y+r.height*y1);await page.mouse.down();await page.mouse.move(r.x+r.width*x2,r.y+r.height*y2,{steps});await page.mouse.up();};
  await page.goto('http://127.0.0.1:4173/');await page.locator('.intro-cover').waitFor();await screenshot('01-intro');
  assert.equal(await page.locator('.studio-header').count(),0);assert(!(await page.locator('body').innerText()).includes('懂了鸭'));
  await page.click('#startExperience');await dismiss();await page.click('[data-profile-preset="round"]');await page.click('#beginSculpt');await screenshot('02-wet-clay');
  const original=(await snapshot()).state.shape;
  await draw('#selectView canvas',.58,.48,.63,.48);
  assert.notDeepEqual((await snapshot()).state.shape.radii,original.radii,'pointer drag must reshape the actual profile');await page.click('#undoShape');assert.deepEqual((await snapshot()).state.shape,original);
  await page.click('[data-sculpt="height"]');await draw('#selectView canvas',.52,.5,.52,.45);
  const shaped=(await snapshot()).state.shape;assert(shaped.height>original.height+.1,'upward pulling must make the clay taller');
  await page.click('[data-sculpt="smooth"]');await draw('#selectView canvas',.6,.49,.61,.51);await page.click('#workshopRotate');await draw('#selectView canvas',.5,.5,.6,.5);await page.click('.sculpt-extras summary');await page.click('#workshopReset');
  await prepare();const bisque=(await snapshot()).state.shape;assert.deepEqual((await snapshot()).geometry.profile,bisque);
  await screenshot('03-bisque-and-palette');assert(await page.locator('#toResult').isDisabled());
  await page.click('[data-glaze="forest"]');await draw('#paintView canvas',.46,.42,.54,.59,80);assert((await snapshot()).state.painted>0);await screenshot('04-first-stroke');
  await page.click('#undoPaint');assert.equal((await snapshot()).state.painted,0);assert(await page.locator('#toResult').isDisabled());
  await page.click('[data-decoration="glaze"]');await page.click('#techniquePrimer [data-technique="dip"]');await page.locator('#dipDepth').fill('72');await page.click('#applyDip');
  const dipped=(await snapshot()).state.painted;assert(dipped>8);await page.click('#undoPaint').catch(async()=>{await page.click('#undoPaint');});assert.equal((await snapshot()).state.painted,0);
  await page.click('#techniquePrimer [data-technique="dip"]');await page.click('#applyDip');
  await page.click('[data-glaze="amber"]');await page.click('#techniquePrimer [data-technique="pour"]');await draw('#paintView canvas',.53,.38,.53,.38,1);
  await page.click('#techniquePrimer [data-technique="wheel"]');await page.locator('#wheelSpeed').fill('45');await draw('#paintView canvas',.50,.5,.50,.5,12);await page.click('#wheelToggle');assert((await snapshot()).state.turntablePaused);
  await page.click('#techniquePrimer [data-technique="brush"]');await page.click('[data-decoration="underglaze"]');await page.click('[data-glaze="moon"]');
  await page.click('[data-pattern="leaf"]');await draw('#paintView canvas',.48,.5,.48,.5,1);await page.click('[data-pattern="flower"]');await draw('#paintView canvas',.55,.56,.55,.56,1);await page.click('[data-pattern="none"]');
  await page.click('[data-decoration="glaze"]');await page.click('[data-glaze-finish="gloss"]');await screenshot('05-complete-decoration');
  await page.click('#backToSelect');assert.equal((await snapshot()).state.shapeLocked,true);assert(await page.locator('#resetShape').isDisabled());await page.click('#toPaint');assert((await snapshot()).state.painted>0);
  await page.click('[data-fire="还原焰"]');await page.click('[data-cooling="快冷"]');
  await page.click('#toResult');await page.locator('#screen3.active').waitFor({timeout:30000});await completeFiring(page);await page.locator('.museum-mode').waitFor();await page.waitForTimeout(3000);
  assert.deepEqual((await snapshot()).state.shape,bisque);assert.deepEqual((await snapshot()).geometry.profile,bisque);await page.fill('#pieceName','手作小罐 · 第一件');await screenshot('06-museum');
  for(const scene of ['living','art']){await page.click(`button[data-scene="${scene}"]`);await page.click('[data-camera="detail"]');await page.waitForTimeout(900);await screenshot('07-'+scene+'-detail');await page.click('[data-camera="full"]');}
  let download=page.waitForEvent('download');await page.click('#exportPhoto');await(await download).saveAs(path.join(out,'piece-card.png'));
  await page.click('[data-panel="learn"]');for(const observed of ['before','alternate','after'])await page.click(`[data-observe="${observed}"]`);
  download=page.waitForEvent('download');await page.click('#exportComparison');await(await download).saveAs(path.join(out,'comparison.png'));await page.click('[data-panel="photo"]');
  await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));await page.click('#openCollection');await page.locator('.collection-item').first().waitFor();await page.waitForTimeout(900);await screenshot('08-shelf');
  const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('dongleya-pottery',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('pieces').objectStore('pieces').getAll();q.onsuccess=()=>{db.close();resolve(q.result[0]);};};}));
  assert.equal(saved.slot,undefined,'new works need no rack position');assert.deepEqual(saved.settings.shape,bisque);assert(saved.layers.fired&&saved.layers.coat&&saved.layers.roughness);
  const foot=await page.evaluate(async record=>{
    const {shapedGeometry}=await import('/vessel-geometry.js'),geo=shapedGeometry(record.settings.shape),p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
    const image=new Image();image.src=record.layers.wet;await image.decode();const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,1024,1024).data;let maxAlpha=0,points=0;
    for(let i=0;i<p.count;i++)if(p.getY(i)<=.025){const x=Math.max(0,Math.min(1023,Math.floor(uv.getX(i)*1024))),y=Math.max(0,Math.min(1023,Math.floor((1-uv.getY(i))*1024)));maxAlpha=Math.max(maxAlpha,pixels[(y*1024+x)*4+3]);points++;}
    geo.dispose();return {maxAlpha,points};
  },saved);assert.equal(foot.maxAlpha,0);assert(foot.points>50);
  await page.locator('.collection-header button').click();await page.reload();await page.click('#introCollection');await page.locator('.collection-item[data-example="false"]').first().click();await page.waitForFunction(()=>document.querySelector('#pieceName').value==='手作小罐 · 第一件');assert.deepEqual((await snapshot()).state.shape,bisque);await screenshot('09-restored');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await screenshot('10-mobile-result');
  await page.click('#openCollection');await page.locator('.collection-item').first().waitFor();await screenshot('11-mobile-shelf');await page.locator('.collection-header button').click();
  await page.click('#restart');await page.locator('#selectView canvas').waitFor();assert.equal((await snapshot()).state.shapeLocked,false);await screenshot('12-mobile-making');await prepare();await page.click('[data-glaze="brick"]');await draw('#paintView canvas',.46,.4,.54,.54);assert((await snapshot()).state.painted>0,'restored work must not leave the paint engine bound to an old canvas');await screenshot('13-mobile-paint');
  const stats=(await snapshot()).paint;assert(stats.uploads<stats.stamps+20);assert.deepEqual(errors,[]);console.log(JSON.stringify({completeFlow:true,profileRetained:true,undo:true,techniques:['brush','wheel','dip','pour'],downloads:true,shelfSlot:saved.slot,foot,mobile:true,stats,errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
