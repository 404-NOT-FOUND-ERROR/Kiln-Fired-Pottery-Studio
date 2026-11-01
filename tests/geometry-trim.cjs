const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');
 const failures=await page.evaluate(async()=>{
  const {shapedGeometry,updateShapedGeometry}=await import('/vessel-geometry.js'),{starterProfile}=await import('/vessel-presets.mjs'),fail=[];
  for(const id of ['jar','bowl','meiping','yuhuchun','gourd','douli']){
   const p=starterProfile(id),g=shapedGeometry(p),uv=Array.from(g.getAttribute('uv').array),seg=g.userData.shaped.segments,rows=g.getAttribute('position').count/(seg+1);
   for(const fraction of [0,.25,.65,1]){updateShapedGeometry(g,p,fraction);const pos=g.getAttribute('position'),norm=g.getAttribute('normal');
    for(let i=0;i<=seg;i++){const n=i*rows;if(Math.hypot(pos.getX(n)-pos.getX(0),pos.getY(n)-pos.getY(0),pos.getZ(n)-pos.getZ(0))>1e-6)fail.push(id+': torn axis at '+fraction);}
    for(let i=0;i<norm.count;i++)if(Math.abs(Math.hypot(norm.getX(i),norm.getY(i),norm.getZ(i))-1)>1e-4){fail.push(id+': non-unit normal');break;}
    for(let j=0;j<rows;j++){const n=seg*rows+j;if(Math.hypot(norm.getX(j)-norm.getX(n),norm.getY(j)-norm.getY(n),norm.getZ(j)-norm.getZ(n))>1e-5){fail.push(id+': lit seam');break;}}
    if(uv.some((v,i)=>v!==g.getAttribute('uv').array[i]))fail.push(id+': shifted painting UV');
   }g.dispose();
  }return fail;
 });assert.deepEqual(failures,[]);
 await page.click('#startExperience');await page.click('[data-profile-preset="handmade"]');await page.click('#beginSculpt');await page.click('#toPaint');await page.waitForFunction(()=>document.querySelector('#preparationPanel').dataset.preparationStage==='trim'&&Number(document.querySelector('.preparation-time').getAttribute('aria-valuenow'))>42);assert.equal(await page.locator('#preparationPanel').getAttribute('data-preparation-stage'),'trim');
 await page.screenshot({path:'qa-artifacts/refinement/foot-sweep.png',fullPage:true});await page.locator('#screen2.active').waitFor();assert((await page.evaluate(async()=>(await import('/studio.js')).inspectStudio().state)).shape.trimmed);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({sixShapes:true,partialTrimAxis:true,unitNormals:true,seamLighting:true,stableUV:true,realTrimTransition:true,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
