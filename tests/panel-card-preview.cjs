const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const out=path.resolve('qa-artifacts/'+(process.env.POTTERY_HTML?'platform-':'')+'panel-card-preview');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1448,height:754},acceptDownloads:true}),errors=[],network=[];
  await context.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  await page.goto(pathToFileURL(path.resolve(process.env.POTTERY_HTML||'dist/pottery-studio.html')).href);
  await page.waitForFunction(()=>window.potteryStudio&&!document.querySelector('#startExperience').disabled);
  await page.click('#startExperience');await page.click('#beginSculpt');
  const prepSizes=[[1448,754],[1191,668],[1024,768],[768,1024],[390,753],[352,447]];
  for(const [width,height] of prepSizes){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);await page.click('#toPaint');
   await page.waitForFunction(()=>document.querySelector('#preparationPanel').dataset.preparationStage==='trim');
   const measurements=await page.evaluate(()=>{
    const p=document.querySelector('#preparationPanel'),mobile=document.body.classList.contains('mobile-portrait'),outer=(mobile?p:p.parentElement).getBoundingClientRect();
    const selectors=['.workshop-kicker','.preparation-time','#prepareTitle','#prepareCopy','.process-tip','#cancelPreparation'];
    return {mobile,outer:{x:outer.x,y:outer.y,right:outer.right,bottom:outer.bottom},items:selectors.map(s=>p.querySelector(s)).filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect(),css=getComputedStyle(e);return {id:e.id||e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:parseFloat(css.fontSize)};})};
   });
   const {outer,items,mobile}=measurements;
   for(const r of items)assert(r.x>=outer.x-1&&r.right<=outer.right+1&&r.y>=outer.y-1&&r.bottom<=outer.bottom+1,'preparation fits '+width+' '+JSON.stringify(measurements));
   if(!mobile){
    assert(items[0].font<=14,'status uses small kicker typography');
    assert(items[0].y>=outer.y+15,'top inset');
    assert(items.at(-1).bottom<=outer.bottom-14,'bottom inset');
    for(let i=1;i<items.length;i++)assert(items[i].y>=items[i-1].bottom-1,'preparation vertical spacing');
   }
   if(width===1448||width===390)await shot('preparation-'+width);
   await page.click('#cancelPreparation');
  }
  await page.setViewportSize({width:1448,height:795});await page.emulateMedia({reducedMotion:'reduce'});
  await page.click('#toPaint');await page.locator('#screen2.active').waitFor();await page.click('#applyBaseGlaze');await page.click('#toResult');
  await page.locator('#screen3.active').waitFor({timeout:60000});await page.locator('#firingOverlay').waitFor({state:'hidden'});
  await page.click('[data-panel="photo"]');
  const preview=page.locator('#artworkPreview');
  await page.waitForFunction(()=>!document.querySelector('#artworkPreview').disabled&&document.querySelector('#artworkPreview').getAttribute('aria-busy')==='false');
  const revision=()=>preview.getAttribute('data-revision');
  const updated=async old=>page.waitForFunction(n=>document.querySelector('#artworkPreview').dataset.revision!==n&&document.querySelector('#artworkPreview').getAttribute('aria-busy')==='false',old);
  await page.click('[data-scene="neutral"]');await page.waitForFunction(()=>document.querySelector('#resultView').dataset.scene==='neutral');
  await page.waitForTimeout(1600);
  const idle=await revision(),pose=await page.evaluate(()=>window.potteryStudio.inspectStudio().geometry);
  await page.waitForTimeout(1600);assert.equal(await revision(),idle,'idle preview does not rerender');
  assert.deepEqual((await page.evaluate(()=>window.potteryStudio.inspectStudio())).geometry,pose,'preview preserves the live model and camera');
  let before=await revision();await page.fill('#pieceName','一抹天青');await updated(before);
  before=await revision();await page.click('[data-format="square"]');await updated(before);
  assert.equal(await preview.locator('canvas').evaluate(c=>c.width/c.height),1);
  before=await revision();await page.click('[data-format="portrait"]');await updated(before);
  assert.equal(await preview.locator('canvas').evaluate(c=>c.width/c.height),.8);
  before=await revision();await page.click('[data-camera="above"]');await updated(before);
  await page.click('[data-camera="full"]');await page.waitForTimeout(1500);
  await shot('photo-desktop');
  const sizes=[[1448,795],[1440,810],[1191,668],[1024,768]];
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await page.waitForTimeout(400);
   const boxes=await page.evaluate(()=>{
    const parent=document.querySelector('.exhibit-panel').getBoundingClientRect();
    return {parent:{x:parent.x,y:parent.y,right:parent.right,bottom:parent.bottom},items:['.observation-heading','.panel-tabs','.piece-identity','.photo-interaction','.scene-picker','.artwork-preview-row','.result-actions','.exhibit-footer'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {s,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})};
   });
   for(const b of boxes.items)assert(b.x>=boxes.parent.x&&b.right<=boxes.parent.right+1&&b.y>=boxes.parent.y&&b.bottom<=boxes.parent.bottom+1,'photo panel fits '+width+' '+JSON.stringify(boxes));
   for(let i=1;i<boxes.items.length;i++)assert(boxes.items[i].y>=boxes.items[i-1].bottom-1,'photo rows do not overlap '+width+' '+JSON.stringify(boxes));
   if(width===1191)await shot('photo-compact');
  }
  for(const scene of ['museum','living','art']){
   before=await revision();await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(s=>document.querySelector('#resultView').dataset.scene===s,scene);await updated(before);
  }
  await page.setViewportSize({width:1448,height:795});await page.waitForTimeout(1500);
  const download=page.waitForEvent('download');await page.click('#exportPhoto');await(await download).saveAs(path.join(out,'export.png'));
  const png=fs.readFileSync(path.join(out,'export.png'));
  const diff=await page.evaluate(async src=>{
   const image=new Image();image.src=src;await image.decode();const preview=document.querySelector('#artworkPreview canvas'),c=document.createElement('canvas');c.width=preview.width;c.height=preview.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);
   const a=ctx.getImageData(0,0,c.width,c.height).data,b=preview.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let sum=0;for(let i=0;i<a.length;i++)if(i%4!==3)sum+=Math.abs(a[i]-b[i]);return sum/(a.length*.75);
  },'data:image/png;base64,'+png.toString('base64'));
  assert(diff<12,'preview matches downloaded composition: '+diff);
  await page.click('#autoRotate');await page.waitForTimeout(250);
  await preview.click();await page.locator('#artworkPreviewDialog').waitFor({state:'visible'});await shot('expanded-card');
  const held=await page.evaluate(()=>window.potteryStudio.inspectStudio().geometry.rotation);
  await page.waitForTimeout(400);assert.deepEqual((await page.evaluate(()=>window.potteryStudio.inspectStudio())).geometry.rotation,held,'enlarged card holds its composition');
  const dialogDownload=page.waitForEvent('download');await page.locator('#artworkPreviewDialog footer button').click();await(await dialogDownload).saveAs(path.join(out,'dialog-export.png'));
  await page.keyboard.press('Escape');assert(await page.locator('#artworkPreviewDialog').isHidden());assert(await preview.evaluate(e=>e===document.activeElement));
  await page.click('#autoRotate');
  for(const [width,height] of [[390,753],[352,447],[768,1024]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);await preview.scrollIntoViewIfNeeded();
   await preview.click();await page.locator('#artworkPreviewDialog').waitFor({state:'visible'});
   const r=await page.locator('#artworkPreviewDialog').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,'mobile card dialog fits');
   await page.locator('#artworkPreviewDialog [aria-label="关闭作品卡预览"]').click();
   if(width===390)await shot('photo-mobile');
  }
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  const report={prepSizes,sizes,previewUsesExportLayout:true,previewExportPixelDifference:diff,idleDoesNotRender:true,formatsAndScenesUpdate:true,offline:true,errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
