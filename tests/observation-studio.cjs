const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const out=path.resolve(__dirname,'../qa-artifacts/observation-studio');fs.mkdirSync(out,{recursive:true});
const portable=process.env.OBSERVATION_PORTABLE==='1';
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
  const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce',acceptDownloads:true});
  const errors=[],network=[];if(portable)await context.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=portable?pathToFileURL(path.resolve(__dirname,'../dist/pottery-studio.html')).href:'http://127.0.0.1:4173/?v=glaze-observation-20261011';
  const snap=()=>page.evaluate(async()=>window.potteryStudio?window.potteryStudio.inspectStudio():(await import('/studio.js')).inspectStudio());
  const shot=n=>page.screenshot({path:path.join(out,(portable?'offline-':'')+n+'.png'),fullPage:true});
  async function settled(){await page.waitForTimeout(600);}
  async function controlsFit(selectors,label){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+2),false,label+': fits vertically');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+': fits horizontally');
    for(const selector of selectors){const result=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {visible:r.width>0&&r.height>0,inside:r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1,uncovered:e.contains(document.elementFromPoint(x,y))};});assert(result.visible&&result.inside&&result.uncovered,label+' '+selector+' '+JSON.stringify(result));}
    const body=await page.locator('.result-panel-body').evaluate(e=>({content:e.scrollHeight,available:e.clientHeight}));assert(body.content<=body.available+2,label+': panel content fits '+JSON.stringify(body));
  }
  await page.goto(url,{timeout:60000});await page.click('#previewPiece');await page.locator('#screen3.active').waitFor({timeout:45000});
  await page.click('[data-panel="result"]');await settled();await shot('glaze');
  const materialPixels=await page.locator('#glazeNoteSample').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...d].reduce((s,v)=>s+v,0);});assert(materialPixels>100000,'live glaze detail renders');
  const signature=()=>page.locator('#glazeNoteSample').evaluate(c=>c.toDataURL());const soft=await signature(),probe=(await snap()).photo.observation.environment;
  await page.click('[data-glaze-light="side"]');await settled();assert.notEqual((await snap()).photo.observation.environment,probe);assert.notEqual(await signature(),soft,'side lighting changes the actual glaze');await shot('side-light');
  const position=(await snap()).photo.observation.key;await page.locator('#glazeLightDirection').fill('40');assert.notDeepEqual((await snap()).photo.observation.key,position,'slider moves the light');await settled();
  await page.click('[data-glaze-light="rim"]');await settled();await shot('rim-light');await page.click('[data-glaze-light="soft"]');
  await page.click('#closeGlazeDetail');assert(await page.locator('#glazeDetailCard').isHidden());await page.click('#openGlazeDetail');await settled();assert(await page.locator('#glazeDetailCard').isVisible());
  for(const key of ['detail','above','full']){await page.click(`[data-inspect-camera="${key}"]`);await settled();await shot('glaze-'+key);}
  const camera=(await snap()).geometry.camera;await page.locator('#observationZoom').fill('140');assert.notDeepEqual((await snap()).geometry.camera,camera);await page.click('#resetResultView');
  await page.click('[data-panel="learn"]');await settled();await shot('comparison');
  await page.locator('#compareSplit').fill('65');assert.equal(await page.locator('.compare-divider').evaluate(e=>e.style.left),'65%');
  const box=await page.locator('#resultView').boundingBox();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.42);await page.mouse.down();await page.mouse.move(box.x+box.width*.43,box.y+box.height*.42,{steps:10});await page.mouse.up();assert(Math.abs((await snap()).photo.observation.split-.43)<.02,'divider drags directly');
  const old=await page.locator('#glazeDetailAfter').evaluate(c=>c.toDataURL());await page.click('[data-glaze-finding="texture"]');await settled();assert.equal((await snap()).photo.observation.finding,'texture');assert.notEqual(await page.locator('#glazeDetailAfter').evaluate(c=>c.toDataURL()),old,'finding uses another surface patch');
  await page.click('[data-compare="cooling"]');await settled();assert((await page.locator('#glazeBeforeCaption').innerText()).includes('缓冷'));assert((await page.locator('#glazeAfterCaption').innerText()).includes('快冷'));await shot('cooling');
  await page.click('[data-observe="before"]');assert(await page.locator('.comparison-overlay').isHidden());await page.click('[data-compare="fire"]');await settled();
  const beforeExport=(await snap()).geometry.camera;const download=page.waitForEvent('download');await page.click('#exportComparison');await(await download).saveAs(path.join(out,'comparison-export.png'));assert.deepEqual((await snap()).geometry.camera,beforeExport,'export preserves view');
  const resultSelectors=['#save','#inspectGoPhoto','#glazeLightDirection','[data-glaze-light="soft"]','#observationZoom','#openCollection','#closeGlazeDetail'];
  const learnSelectors=['#save','#exportComparison','#compareSplit','[data-glaze-finding="color"]','[data-glaze-finding="shine"]','[data-glaze-finding="texture"]','#observationZoom','#openCollection','#closeGlazeDetail'];
  for(const [width,height] of [[1672,941],[1920,1080],[1440,900],[1366,768],[1280,720],[1024,720]]){
    await page.setViewportSize({width,height});for(const mode of ['result','learn']){await page.click(`[data-panel="${mode}"]`);await settled();try{await controlsFit(mode==='result'?resultSelectors:learnSelectors,width+'/'+mode);}catch(e){await shot('failure-'+width+'-'+mode);throw e;}if(width===1366)await shot(mode+'-laptop');}
  }
  await page.setViewportSize({width:1672,height:941});await page.click('[data-panel="result"]');await page.fill('#pieceName','观釉的小罐');await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));await page.click('#openCollection');await page.locator('.collection-item[data-example="false"]').first().click();await settled();assert.equal(await page.locator('#pieceName').inputValue(),'观釉的小罐');
  await page.click('#inspectGoPhoto');await page.waitForFunction(()=>document.querySelector('#resultView').dataset.scene==='museum');assert(await page.locator('#glazeDetailCard').isHidden());
  for(const scene of ['museum','living','art','neutral']){await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(s=>document.querySelector('#resultView').dataset.scene===s,scene);await page.click('[data-camera="detail"]');await page.click('[data-camera="full"]');await settled();}
  for(const width of [768,390,320]){await page.setViewportSize({width,height:844});for(const mode of ['result','learn']){await page.click(`[data-panel="${mode}"]`);await settled();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+'/'+mode+' no horizontal overflow');if(width===390)await shot(mode+'-mobile');}}
  assert.deepEqual(errors,[]);if(portable)assert.deepEqual(network,[]);
  const report={portable,lightingChangesSurface:true,liveDetail:true,alignedComparison:true,draggableDivider:true,contextFindings:true,exportPreservesView:true,collectionRestore:true,photoScenes:true,desktopWidths:[1672,1920,1440,1366,1280,1024],mobileWidths:[768,390,320],errors,network};fs.writeFileSync(path.join(out,(portable?'offline-':'')+'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
