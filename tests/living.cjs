const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const out=path.resolve(__dirname,'../qa-artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
 const page=await browser.newPage({viewport:{width:1600,height:900},acceptDownloads:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:4173/?preview=1&scene=living');await page.locator('.living-mode #resultView canvas').waitFor();await page.waitForTimeout(3500);
 await page.screenshot({path:path.join(out,'living-web.png')});
 const galleryBefore=await page.screenshot({clip:{x:40,y:140,width:150,height:150}});
 const ceramicBefore=await page.screenshot({clip:{x:500,y:400,width:250,height:200}});
 await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(770,450,{steps:14});await page.mouse.up();await page.waitForTimeout(1800);
 assert(galleryBefore.equals(await page.screenshot({clip:{x:40,y:140,width:150,height:150}})),'Window and room must stay fixed while ceramic rotates');
 assert(!ceramicBefore.equals(await page.screenshot({clip:{x:500,y:400,width:250,height:200}})),'Painted ceramic must visibly rotate');
 for(const scene of ['museum','living','art','living']){await page.click(`[data-scene="${scene}"]`);await page.waitForTimeout(250);assert.equal(await page.getAttribute('#resultView','data-scene'),scene);if(scene==='living')assert.equal(await page.locator('.living-mode').count(),1);}
 for(const camera of ['above','detail','full']){await page.click(`[data-camera="${camera}"]`);await page.waitForTimeout(250);await page.screenshot({path:path.join(out,`living-${camera}.png`)});}
 await page.click('[data-camera="detail"]');
 await page.click('.museum-settings');
 for(const [format,height] of [['square',1200],['portrait',1500]]){
   await page.click(`[data-format="${format}"]`);const download=page.waitForEvent('download');await page.click('#exportPhoto');const file=path.join(out,`living-${format}.png`);await(await download).saveAs(file);const png=fs.readFileSync(file);assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),height);
 }
 await page.click('[data-camera="above"]');await page.fill('#pieceName','窗光收藏检查');await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));
 const records=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('dongleya-pottery',1);req.onsuccess=()=>{const db=req.result,r=db.transaction('pieces').objectStore('pieces').getAll();r.onsuccess=()=>{db.close();resolve(r.result)}}}));
 assert.equal(records[0].scene,'living');assert.equal(records[0].camera,'above');assert(records[0].rotation>.5);
 await page.reload();await page.locator('.living-mode').waitFor();await page.click('#openCollection');await page.locator('.collection-item').click();assert.equal(await page.inputValue('#pieceName'),'窗光收藏检查');assert.equal(await page.getAttribute('[data-camera="above"]','aria-pressed'),'true');
 await page.click('[data-panel="learn"]');assert.equal(await page.locator('.living-mode').count(),0);await page.click('[data-observe="before"]');await page.click('[data-observe="alternate"]');await page.click('[data-panel="photo"]');await page.locator('.living-mode').waitFor();await page.click('[data-camera="full"]');
 for(const width of [390,768,1024]){await page.setViewportSize({width,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`living-mobile-${width}.png`),fullPage:true});await page.click('[data-camera="detail"]');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`living-mobile-detail-${width}.png`),fullPage:true});await page.click('[data-camera="full"]');}
 await page.setViewportSize({width:1440,height:1000});await page.click('#restart');await page.click('[data-form="bowl"]');await page.click('#toPaint');await page.click('#onboardingDismiss');await page.click('#techniquePrimer [data-technique="dip"]');await page.click('#applyDip');await page.click('#toResult');await page.click('#skipFiring');await page.locator('.living-mode').waitFor();await page.waitForTimeout(3000);await page.screenshot({path:path.join(out,'living-painted-bowl.png')});
 await page.click('#restart');await page.click('[data-form="vase"]');await page.click('#toPaint');await page.click('#techniquePrimer [data-technique="dip"]');await page.click('[data-glaze="copper"]');await page.click('#applyDip');await page.click('#toResult');await page.click('#skipFiring');await page.locator('.living-mode').waitFor();await page.waitForTimeout(3000);await page.screenshot({path:path.join(out,'living-painted-vase.png')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({roomFixed:true,ceramicRotates:true,sceneSwitches:true,restoredScene:records[0].scene,restoredRotation:records[0].rotation,forms:['jar','bowl','vase'],exports:[[1200,1200],[1200,1500]],errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
