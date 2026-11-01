const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
const {prepareBlank,waitForFiring}=require('./workflow-helpers.cjs');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1280,height:850},reducedMotion:'reduce',acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');await page.click('#startExperience');await page.click('[data-profile-preset="handmade"]');await page.click('#beginSculpt');await page.click('.sculpt-extras summary');await page.click('#changeStartingForm');await page.locator('[data-new]').click();assert(await page.locator('.model-select').isVisible());assert(await page.locator('.sculpt-tools').isHidden());
 const shape=await page.evaluate(async()=>(await import('/studio.js')).inspectStudio().state.shape);assert(!shape.deformation);await page.click('[data-preset="bowl"]');await prepareBlank(page);await page.click('#applyBaseGlaze');
 await page.evaluate(()=>{indexedDB.open=()=>{throw new Error('Expected storage denial');};});await page.click('#toResult');await waitForFiring(page);await page.click('#save');await page.waitForFunction(()=>document.querySelector('#storageNote').textContent.includes('未成功'));
 assert.equal(await page.locator('.collection-dialog[open]').count(),0);assert(!(await page.locator('#save').innerText()).includes('已收藏'));assert.equal(await page.evaluate(async()=>(await import('/studio.js')).inspectStudio().state.form),'bowl');
 const download=page.waitForEvent('download');await page.click('#exportPhoto');const file=await download;assert(file.suggestedFilename().endsWith('.png'));await page.click('#save');await page.waitForFunction(()=>document.querySelector('#storageNote').textContent.includes('未成功'));assert(await page.locator('#save').isEnabled());assert.deepEqual(errors,[]);
 console.log(JSON.stringify({explicitRestart:true,storageFailureRetainsFinishedPiece:true,downloadFallback:true,noFalseSavedState:true,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
