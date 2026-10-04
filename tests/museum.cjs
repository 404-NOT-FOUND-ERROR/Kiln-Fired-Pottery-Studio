const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const out=path.resolve(__dirname,'../qa-artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
 const page=await browser.newPage({viewport:{width:1600,height:900},acceptDownloads:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:4173/?preview=1');await page.locator('.museum-mode #resultView canvas').waitFor();await page.waitForTimeout(3500);
 const backgroundBefore=await page.screenshot({clip:{x:40,y:150,width:150,height:150}});
 const ceramicBefore=await page.screenshot({clip:{x:470,y:350,width:280,height:270}});
 await page.mouse.move(620,450);await page.mouse.down();await page.mouse.move(800,450,{steps:12});await page.mouse.up();await page.waitForTimeout(1800);
 const backgroundAfter=await page.screenshot({clip:{x:40,y:150,width:150,height:150}});
 const ceramicAfter=await page.screenshot({clip:{x:470,y:350,width:280,height:270}});
 assert(backgroundBefore.equals(backgroundAfter),'Gallery must stay fixed during ceramic rotation');
 assert(!ceramicBefore.equals(ceramicAfter),'Ceramic must visibly rotate');
 for(const view of ['above','detail','full']){await page.click(`[data-camera="${view}"]`);await page.waitForTimeout(200);await page.screenshot({path:path.join(out,`museum-${view}.png`)});}
 await page.click('.museum-settings');await page.click('[data-format="square"]');
 let download=page.waitForEvent('download');await page.click('#exportPhoto');await(await download).saveAs(path.join(out,'museum-square.png'));
 await page.click('[data-format="portrait"]');download=page.waitForEvent('download');await page.click('#exportPhoto');await(await download).saveAs(path.join(out,'museum-portrait.png'));
 for(const [name,height] of [['museum-square.png',1200],['museum-portrait.png',1500]]){const png=fs.readFileSync(path.join(out,name));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),height);}
 await page.click('[data-camera="above"]');await page.fill('#pieceName','展厅旋转恢复检查');await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));
 const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('dongleya-pottery',1);req.onsuccess=()=>{const db=req.result,r=db.transaction('pieces').objectStore('pieces').getAll();r.onsuccess=()=>{db.close();resolve(r.result)}};req.onerror=reject}));
 assert(saved[0].settings.specimen);assert(saved[0].rotation>0.5);assert.equal(saved[0].camera,'above');
 await page.reload();await page.locator('.museum-mode').waitFor();await page.click('#openCollection');await page.locator('.collection-item').click();
 assert.equal(await page.inputValue('#pieceName'),'展厅旋转恢复检查');assert.equal(await page.getAttribute('[data-camera="above"]','aria-pressed'),'true');
 await page.click('[data-camera="full"]');
 for(const width of [390,768,1024]){await page.setViewportSize({width,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`museum-mobile-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1600,height:900});await page.click('#restart');await page.click('[data-form="jar"]');await page.click('#toPaint');await page.click('#onboardingDismiss');await page.click('[data-glaze="cobalt"]');await page.click('#techniquePrimer [data-technique="dip"]');await page.locator('#dipDepth').fill('70');await page.click('#applyDip');await page.click('#toResult');await page.click('#skipFiring');await page.locator('.museum-mode').waitFor();await page.waitForTimeout(2800);await page.screenshot({path:path.join(out,'museum-painted-jar.png')});
 const fallback=await browser.newPage();const fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));await fallback.route('**/assets/museum/manifest.json',route=>route.fulfill({status:503,body:'Unavailable'}));await fallback.goto('http://127.0.0.1:4173/?preview=1');await fallback.locator('#resultView canvas').waitFor();assert.equal(await fallback.locator('.museum-mode').count(),0);assert.deepEqual(fallbackErrors,[]);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({galleryFixed:true,ceramicRotates:true,restoredCamera:saved[0].camera,restoredRotation:saved[0].rotation,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
