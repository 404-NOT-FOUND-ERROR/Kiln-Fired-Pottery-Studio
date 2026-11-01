const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4173/');await page.locator('.intro-cover').waitFor();await page.waitForTimeout(800);
  const dir=path.resolve(__dirname,'../qa-artifacts/making');fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'01-intro.png')});
  await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');await page.screenshot({path:path.join(dir,'02-clay.png')});
  await page.click('[data-profile-preset="round"]');await page.screenshot({path:path.join(dir,'03-jar.png')});
  const rect=await page.locator('#selectView canvas').boundingBox();await page.mouse.move(rect.x+rect.width*.58,rect.y+rect.height*.45);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.62,rect.y+rect.height*.45,{steps:12});await page.mouse.up();
  await page.click('#toPaint');await page.locator('#trimFoot').waitFor({state:'visible'});await page.click('#trimFoot');await page.locator('#finishBisque').waitFor({state:'visible'});await page.screenshot({path:path.join(dir,'04-bisque.png')});await page.click('#finishBisque');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');await page.screenshot({path:path.join(dir,'05-decorate.png')});
  await page.click('[data-glaze="forest"]');const b=await page.locator('#paintView canvas').boundingBox();await page.mouse.move(b.x+b.width*.47,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.53,b.y+b.height*.61,{steps:24});await page.mouse.up();await page.click('#applyClearGlaze');await page.screenshot({path:path.join(dir,'06-painted.png')});
  await page.click('#toResult');await page.locator('#screen3.active').waitFor({timeout:30000});await page.waitForTimeout(1500);await page.screenshot({path:path.join(dir,'07-reveal.png')});
  console.log(JSON.stringify({errors,snapshot:await page.evaluate(async()=>{return(await import('/studio.js')).inspectStudio();})},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
