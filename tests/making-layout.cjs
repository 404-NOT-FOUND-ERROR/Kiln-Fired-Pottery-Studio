const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {prepareBlank,completeFiring}=require('./workflow-helpers.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');await page.locator('.intro-cover').waitFor();await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
  const dir=path.resolve(__dirname,'../qa-artifacts/making-layout');fs.mkdirSync(dir,{recursive:true});
  const check=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);};
  for(const [w,h] of [[1600,900],[1024,720],[768,844],[390,844],[320,740]]){
   await page.setViewportSize({width:w,height:h});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await check();await page.screenshot({path:path.join(dir,'making-'+w+'.png')});
   if(w>900){const r=await page.locator('#beginSculpt').boundingBox();assert(r.y+r.height<=h-60,'main shaping action must stay visible');}
  }
  await page.setViewportSize({width:1600,height:900});await prepareBlank(page);if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
  for(const [w,h] of [[1600,900],[1024,720],[768,844],[390,844],[320,740]]){
   await page.setViewportSize({width:w,height:h});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250);await check();await page.screenshot({path:path.join(dir,'painting-'+w+'.png')});
   if(w>900){const r=await page.locator('#toResult').boundingBox();assert(r.y+r.height<=h-60,'main firing action must stay visible');}
   else {
    await page.click('[data-glaze="forest"]');const view=await page.locator('#paintView canvas').boundingBox();assert(view.y>=-1&&view.y+view.height<=h-80,'painting canvas must remain visible after palette selection');
    await page.screenshot({path:path.join(dir,'palette-active-'+w+'.png')});
   }
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({widths:[1600,1024,768,390,320],stickyMobileCanvas:true,desktopActionsVisible:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
