const {prepareBlank,putOnShelf,completeFiring}=require('./workflow-helpers.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../qa-artifacts/ui-after');fs.mkdirSync(out,{recursive:true});
const selectors=['#openCollection','.scene-picker','.camera-bar','#exportPhoto','#save','.panel-tabs'];
function sameGeometry(a,b,label){
  for(let i=0;i<a.length;i++)for(const key of ['x','y','width','height','radius']){
    const delta=typeof a[i][key]==='number'?Math.abs(a[i][key]-b[i][key]):a[i][key]===b[i][key]?0:1;
    assert(delta<.6,`${label}: ${a[i].selector} changed ${key}: ${a[i][key]} → ${b[i][key]}`);
  }
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const geometry=async list=>page.evaluate(list=>list.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,radius:getComputedStyle(e).borderRadius}}),list);
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
  await page.goto('http://127.0.0.1:4173/');await page.locator('.intro-cover').waitFor();
  assert.equal(await page.locator('.studio-header').count(),0,'Embedded module must have no masthead');
  assert.equal(await page.locator('body').innerText().then(text=>text.includes('懂了鸭')),false,'Embedded module must have no branding');
  assert(await page.locator('#openCollection').isHidden());let header;await page.screenshot({path:path.join(out,'intro.png')});
  await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
  header=await geometry(['#openCollection']);
  assert(await page.locator('#beginSculpt').isVisible());
  await page.screenshot({path:path.join(out,'select.png')});
  await prepareBlank(page);if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
  assert(await page.locator('#toResult').isVisible());
  sameGeometry(header,await geometry(['#openCollection']),'Intro → painting');
  const primaryBefore=await geometry(['#toResult']);
  await page.locator('.paint-controls-body').evaluate(e=>e.scrollTop=e.scrollHeight);
  sameGeometry(primaryBefore,await geometry(['#toResult']),'Scroll painting controls');
  assert(await page.locator('#toResult').isVisible());
  await page.click('#openCollection');await page.locator('.collection-header button').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'openCollection');
  await page.locator('.paint-controls-body').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:path.join(out,'paint.png')});
  await page.goto('http://127.0.0.1:4173/?preview=1');await page.locator('#screen3.active').waitFor();await page.click('[data-panel="photo"]');await page.click('[data-scene="museum"]');await page.locator('.museum-mode').waitFor();await page.waitForTimeout(2800);
  for(const [width,height] of [[1600,900],[1024,720],[768,844],[390,844],[320,740]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(250);
   let initial;
   for(const scene of ['museum','living','art']){
    await page.click(`[data-scene="${scene}"]`);await page.waitForTimeout(250);
    const current=await geometry(selectors);
    if(initial)sameGeometry(initial,current,`${width}px ${scene}`);else initial=current;
    await noOverflow();
    const picker=current[1],camera=current[2];
    assert(picker.x+picker.width<=camera.x||camera.x+camera.width<=picker.x||picker.y>=camera.y+camera.height||camera.y>=picker.y+picker.height,'Scene and camera controls overlap');
    if(width===1600){await page.waitForTimeout(1500);await page.screenshot({path:path.join(out,scene+'.png')});}
   }
   assert(await page.locator('[data-format="square"]').isVisible(),'export settings are always visible');
   // Scene and camera controls remain in place in the observation room as well.
   const dockBefore=await geometry(['#openCollection','.scene-picker','.camera-bar']);
   await page.click('[data-panel="learn"]');
   assert(await page.locator('#compareSplit').isVisible());assert(await page.locator('.scene-picker').isHidden());
   await noOverflow();
   await page.click('[data-panel="photo"]');
   if(width===390){await page.click('[data-scene="living"]');await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});}
  }
  await page.click('#restart');
  for(const width of [320,390,768,1024]){
   await page.setViewportSize({width,height:width===1024?720:844});await page.waitForTimeout(200);
   await noOverflow();
   await page.screenshot({path:path.join(out,`select-${width}.png`),fullPage:true});
   await prepareBlank(page);await page.waitForTimeout(350);
   if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
   await noOverflow();
   
   const tools=await geometry(['#techniquePrimer','.zoom-control']);
   assert(tools[0].x+tools[0].width<=tools[1].x||tools[1].x+tools[1].width<=tools[0].x||tools[0].y+tools[0].height<=tools[1].y||tools[1].y+tools[1].height<=tools[0].y,'Glazing tools overlap zoom');
   if(width===1024){const r=(await geometry(['#toResult']))[0];assert(r.y+r.height<=720,'Burn action is below the short desktop viewport');}
   await page.screenshot({path:path.join(out,`paint-${width}.png`),fullPage:true});
   await page.click('#backToSelect');
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sameSceneControls:true,settingsKeepActionsStable:true,workflowActionsAligned:true,collectionFocusRestored:true,widths:[1600,1024,768,390,320],errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
