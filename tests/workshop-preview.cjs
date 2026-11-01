const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../qa-artifacts/workshop');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text())}});
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#startExperience:not([disabled])').waitFor({timeout:45000});
  await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'intro.png')});
  await page.click('#startExperience');await page.click('#onboardingDismiss');
  await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'select.png')});
  await page.click('#toPaint');await page.click('#onboardingDismiss');
  await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'paint.png')});
  console.log(JSON.stringify({errors,controls:await page.locator('.paint-controls').boundingBox(),canvas:await page.locator('#paintView canvas').boundingBox(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
  await page.click('[data-workshop-tab="tools"]');await page.click('#techniquePrimer [data-technique="dip"]');
  await page.click('#applyDip');await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'coated.png')});
  await page.click('#toResult');await page.screenshot({path:path.join(out,'firing.png')});await page.locator('#screen3.active').waitFor({timeout:30000});
  await page.waitForTimeout(2800);await page.screenshot({path:path.join(out,'result.png')});
  await page.click('#restart');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'mobile-select.png'),fullPage:true});
  await page.click('#toPaint');await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'mobile-paint.png'),fullPage:true});
  console.log(JSON.stringify({errors,mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
