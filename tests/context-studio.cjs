const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {prepareBlank}=require('./workflow-helpers.cjs');
const portable=process.env.CONTEXT_PORTABLE==='1',out='qa-artifacts/context-studio'+(portable?'-portable':'');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(portable)await page.route(/^https?:/,r=>r.abort());
 const snap=()=>page.evaluate(async portable=>portable?window.potteryStudio.inspectStudio():(await import('/studio.js')).inspectStudio(),portable);
 const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
 const check=async(selectors,label)=>{const r=await page.evaluate(list=>({pageScroll:document.documentElement.scrollHeight>innerHeight+1,items:list.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {selector:s,visible:e.checkVisibility(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,reachable:!!hit&&(e.contains(hit)||hit.contains(e)),clipped:e.scrollHeight>e.clientHeight+2};})}),selectors);assert(!r.pageScroll,label+' page scrolls');for(const e of r.items){assert(e.visible&&e.x>=-1&&e.y>=-1&&e.right<=page.viewportSize().width+1&&e.bottom<=page.viewportSize().height+1,label+' not in view '+JSON.stringify(e));assert(e.reachable,label+' obscured '+JSON.stringify(e));}return r;};
 const railCheck=async label=>{const boxes=await page.evaluate(()=>['#contextGuide','.paint-method-controls','.workbench-tools','.quiet-brush-presets','.quiet-paint-dock','.workbench-colors'].map(selector=>{const e=document.querySelector(selector);if(!e?.checkVisibility())return null;const r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}).filter(Boolean));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j],overlap=Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;assert(!overlap,label+' panels overlap '+JSON.stringify([a,b]));}for(const selector of ['#brushSizeRange','#glazeLoadRange',...((await snap()).state.technique==='wheel'?['#wheelSpeed']:(await snap()).state.technique==='dip'?['#dipDepth']:[])]){const hits=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),vertical=r.height>r.width;return [.15,.5,.85].map(t=>{const hit=document.elementFromPoint(r.x+r.width*(vertical?.5:t),r.y+r.height*(vertical?t:.5));return hit===e||e.contains(hit);});});assert(hits.every(Boolean),label+' slider track obscured '+selector);}return boxes;};
 await page.goto(portable?pathToFileURL(path.resolve('dist/pottery-studio.html')).href:'http://127.0.0.1:4173/');await page.waitForFunction(()=>document.querySelector('#startExperience')&&!document.querySelector('#startExperience').disabled,{timeout:30000}).catch(async e=>{console.log(errors);await shot('boot-error');throw e;});await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');await shot('choose');await page.click('#beginSculpt');
 for(const [tool,title] of [['push','推拉'],['pinch','手捏'],['dent','压痕'],['smooth','抚平'],['height','拉高']]){await page.click(`[data-sculpt="${tool}"]`);await page.locator('#contextGuide').waitFor();assert.equal(await page.locator('#contextGuideTitle').innerText(),title);assert.equal(await page.locator('#contextGuide').getAttribute('data-option'),tool);}
 await page.click('[data-sculpt="pinch"]');await shot('sculpt');const before=(await snap()).state.shape,r=await page.locator('#selectView canvas').boundingBox();await page.mouse.move(r.x+r.width*.52,r.y+r.height*.46);await page.mouse.down();await page.mouse.move(r.x+r.width*.58,r.y+r.height*.48,{steps:15});await page.mouse.up();assert.notDeepEqual((await snap()).state.shape,before);await page.click('#undoShape');assert.deepEqual((await snap()).state.shape,before);
 await page.click('#closeContextGuide');assert(await page.locator('#contextGuide').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.dataset.sculpt),'pinch');await page.click('[data-sculpt="pinch"]');assert(await page.locator('#contextGuide').isVisible());
 const sizes=[[1672,941],[1920,1080],[1600,900],[1452,811],[1366,768],[1280,720],[1024,720]],sculpt=['#toPaint','#sculptRadius','#sculptStrength','[data-sculpt="push"]','[data-sculpt="pinch"]','[data-sculpt="dent"]','[data-sculpt="smooth"]','[data-sculpt="height"]','#resetShape','#zoomRange','#closeContextGuide'];
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(100);await check(sculpt,'sculpt '+width);assert.equal(await page.locator('.selection-controls-body').evaluate(e=>e.scrollHeight>e.clientHeight+2),false);}
 await page.setViewportSize({width:1672,height:941});await prepareBlank(page);await page.click('[data-glaze-finish="gloss"]');await shot('paint');
 assert.equal(await page.locator('#paintView canvas').count(),1,'the painting vessel is initialized');
 const previews=await page.locator('[data-glaze-finish] canvas').evaluateAll(list=>list.map(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<data.length;i+=4)alpha+=data[i];return alpha;}));assert(previews.every(n=>n>10000),'all material previews render a vessel');
 const panelContains=async()=>{const outer=await page.locator('#workbenchOptions').boundingBox();for(const selector of ['#toResult','#backToSelect','.cooling']){const inner=await page.locator(selector).boundingBox();assert(inner.y+inner.height<=outer.y+outer.height+1,'settings remain inside the glass panel: '+selector);}};
 await panelContains();
 const fixed=await page.locator('#workbenchOptions').boundingBox();
 for(const [kind,option,title] of [['method','dip','浸釉'],['method','wheel','转台'],['method','pour','淋釉'],['method','brush','刷釉'],['finish','satin','晶花'],['finish','speckle','铁斑'],['finish','crackle','开片'],['fire','还原焰','还原烧成'],['fire','柴烧','柴烧'],['cooling','快冷','快冷'],['material','underglaze','彩绘']]){const selector=kind==='method'?`.primer-card[data-technique="${option}"]`:kind==='finish'?`[data-glaze-finish="${option}"]`:kind==='fire'?`[data-fire="${option}"]`:kind==='cooling'?`[data-cooling="${option}"]`:`[data-decoration="${option}"]`;await page.click(selector);assert.equal(await page.locator('#contextGuideTitle').innerText(),title);assert.deepEqual(await page.locator('#workbenchOptions').boundingBox(),fixed,'context does not move the settings');}
 await page.click('[data-glaze-finish="gloss"]');assert.equal((await snap()).state.decoration,'glaze');
 const sample=()=>page.locator('#contextGuideVisual canvas').first().evaluate(c=>c.toDataURL());const old=await sample();await page.click('[data-glaze="cobalt"]');assert((await sample())!==old,'help sample follows chosen color');
 const paint=['#toResult','#brushSizeRange','#glazeLoadRange','.primer-card[data-technique="brush"]','.primer-card[data-technique="wheel"]','.primer-card[data-technique="dip"]','.primer-card[data-technique="pour"]','[data-pattern="leaf"]','[data-pattern="flower"]','#applyBaseGlaze','#undoPaint','#clearPaint','[data-glaze-finish="gloss"]','[data-glaze-finish="satin"]','[data-glaze-finish="speckle"]','[data-glaze-finish="crackle"]','[data-fire="氧化焰"]','[data-fire="还原焰"]','[data-fire="柴烧"]','[data-cooling="缓冷"]','[data-cooling="快冷"]','#zoomRange'];
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);await panelContains();
  for(const method of ['brush','wheel','dip','pour']){
   await page.click(`.primer-card[data-technique="${method}"]`);
   try{
    await check([...paint,'#closeContextGuide',...(method==='wheel'?['#wheelSpeed','#wheelToggle']:method==='dip'?['#dipDepth','#applyDip']:[])],'paint '+width+' '+method);
    await railCheck(width+'x'+height+' '+method);
    if(method==='wheel'||method==='dip'){
     if(width===1452)await shot('paint-'+method);
     for(const selector of ['[data-glaze-finish="satin"]','[data-fire="还原焰"]','[data-cooling="快冷"]']){await page.click(selector);await railCheck(width+' '+method+' '+selector);}
     const controls=await page.locator('.paint-method-controls').boundingBox(),brush=await page.locator('.workbench-tools').boundingBox();
     await page.click('#closeContextGuide');
     assert.deepEqual(await page.locator('.paint-method-controls').boundingBox(),controls,'closing help keeps method controls stationary');
     assert.deepEqual(await page.locator('.workbench-tools').boundingBox(),brush,'closing help keeps brush stationary');
     await railCheck('closed '+width+' '+method);
    }
   }catch(e){await shot('failure-'+width+'-'+height+'-'+method);throw e;}
  }
 }
 // The transparent-glaze status adds a row. Exercise both material modes at
 // the embedded browser's actual short height, rather than only effect glazes.
 const materialLayouts=[];
 for(const [width,height] of [...sizes,[1191,668],[1280,668],[1024,668]]){
  await page.setViewportSize({width,height});await page.click('.primer-card[data-technique="brush"]');
  for(const decoration of ['underglaze','glaze']){
   await page.click(`[data-decoration="${decoration}"]`);await panelContains();
   await check([...paint,...(decoration==='underglaze'?['#applyClearGlaze']:[])],`${width}x${height} ${decoration}`);
   const sections=await page.locator('#workbenchOptions').evaluate(panel=>[...panel.children].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {name:e.className,top:r.top,bottom:r.bottom};}));
   for(let i=1;i<sections.length;i++)assert(sections[i].top>=sections[i-1].bottom-.5,'settings sections overlap '+JSON.stringify(sections.slice(i-1,i+1)));
   const panel=await page.locator('#workbenchOptions').boundingBox(),cameraTop=await page.locator('#zoomRange').evaluate(e=>e.closest('.workshop-camera').getBoundingClientRect().top);assert(panel.y+panel.height<cameraTop,'settings leave the camera controls clear');
   materialLayouts.push({width,height,decoration});if(width===1191)await shot('paint-1191-'+decoration);
  }
 }
 await page.click('.primer-card[data-technique="wheel"]');await page.locator('#wheelSpeed').fill('80');assert(Math.abs((await snap()).state.turnSpeed-.82)<1e-8);await page.click('#wheelToggle');assert((await snap()).state.turntablePaused);await page.click('#wheelToggle');assert(!(await snap()).state.turntablePaused);
 await page.click('.primer-card[data-technique="dip"]');await page.click('#clearPaint');await page.locator('#dipDepth').fill('70');await page.click('#applyDip');assert((await snap()).state.painted>0,'dip still coats the vessel');await page.click('#undoPaint');assert.equal((await snap()).state.painted,0);
 await page.setViewportSize({width:1672,height:941});await page.click('.primer-card[data-technique="brush"]');await page.click('[data-glaze="sky"]');await page.click('#clearPaint');await page.click('#applyBaseGlaze');assert((await snap()).state.painted>0);await page.click('#undoPaint');assert.equal((await snap()).state.painted,0);
 await page.locator('#brushSizeRange').fill('60');await page.locator('#glazeLoadRange').fill('75');
 const vessel=await page.locator('#paintView canvas').boundingBox();
 for(const offset of [0,.06,.12]){await page.mouse.move(vessel.x+vessel.width*(.36+offset),vessel.y+vessel.height*(.41+offset));await page.mouse.down();await page.mouse.move(vessel.x+vessel.width*(.50+offset),vessel.y+vessel.height*(.52+offset),{steps:24});await page.mouse.up();}
 assert((await snap()).state.painted>0,'brush strokes attach to the vessel');
 await page.click('[data-glaze="cobalt"]');await page.locator('#brushSizeRange').fill('25');
 for(const [x,y,endX,endY] of [[.55,.33,.45,.59],[.53,.40,.60,.39],[.51,.46,.43,.43]]){await page.mouse.move(vessel.x+vessel.width*x,vessel.y+vessel.height*y);await page.mouse.down();await page.mouse.move(vessel.x+vessel.width*endX,vessel.y+vessel.height*endY,{steps:24});await page.mouse.up();}
 await page.click('[data-fire="氧化焰"]');await page.click('[data-cooling="缓冷"]');await page.click('[data-glaze="sky"]');await page.click('[data-glaze-finish="gloss"]');await page.mouse.move(0,0);await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));await shot('paint-guide');
 for(const width of [768,390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await check(['#brushSizeRange','#glazeLoadRange','[data-mobile-tab="kiln"]','#toResult'],'portrait tools '+width);await page.click('[data-mobile-tab="kiln"]');await check(['[data-fire="氧化焰"]','[data-cooling="缓冷"]','#toResult'],'portrait settings '+width);await page.click('[data-mobile-tab="brush"]');await shot('mobile-'+width);}
 assert.deepEqual(errors,[]);const report={portable,desktop:sizes,materialLayouts,sculptGuides:5,paintGuides:true,dynamicSamples:true,fixedPanel:true,wholePanelsDoNotOverlap:true,sliderTracksReachable:true,guideCloseKeepsAdjustments:true,wheelSpeedAndPause:true,dipAndUndo:true,shaping:true,undo:true,baseCoat:true,mobile:[768,390,320],errors};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
