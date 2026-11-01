const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {prepareBlank}=require('./workflow-helpers.cjs');
const portable=process.env.GLAZE_PORTABLE==='1',baseline=process.env.GLAZE_BASELINE==='1';
const out=path.resolve('qa-artifacts/glaze-samples'+(baseline?'-baseline':portable?'-portable':''));fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1452,height:900},reducedMotion:'reduce'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));if(portable)await page.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await page.goto(portable?pathToFileURL(path.resolve('dist/pottery-studio.html')).href:'http://127.0.0.1:4173/');await page.click('#startExperience');if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');await prepareBlank(page);
 const report=[];
 for(const color of ['sky','moon','cobalt']){
  await page.click(`[data-glaze="${color}"]`);await page.click('[data-fire="还原焰"]');
  await page.mouse.move(0,0);await page.locator('.glaze-finishes').screenshot({path:path.join(out,color+'-selectors.png')});
  const data=await page.locator('[data-glaze-finish] canvas').evaluateAll(list=>{
   const images=list.map(c=>{const r=c.getBoundingClientRect(),small=document.createElement('canvas');small.width=Math.round(r.width);small.height=Math.round(r.height);const ctx=small.getContext('2d');ctx.drawImage(c,0,0,small.width,small.height);return {name:c.closest('button').dataset.glazeFinish,data:ctx.getImageData(0,0,small.width,small.height).data,width:small.width,height:small.height};}),pairs=[];
   for(let a=0;a<images.length;a++)for(let b=a+1;b<images.length;b++){
    let sum=0,n=0;const x=images[a],y=images[b],local=[];for(let i=0;i<x.data.length;i+=4)if(x.data[i+3]>220&&y.data[i+3]>220){let d=0;for(let c=0;c<3;c++)d+=Math.abs(x.data[i+c]-y.data[i+c]);sum+=d;n+=3;local.push(d/3);}local.sort((a,b)=>a-b);pairs.push({pair:x.name+' / '+y.name,difference:sum/n,patternDifference:local[Math.floor(local.length*.97)]});
   }return {dimensions:images.map(({name,width,height})=>({name,width,height})),pairs};
  });
  report.push({color,...data});
 }
 await page.click('[data-glaze="sky"]');await page.locator('[data-glaze-finish="gloss"]').click();await page.mouse.move(0,0);await page.screenshot({path:path.join(out,'painting.png')});
 for(const [width,height] of [[1280,720],[1672,941]]){await page.setViewportSize({width,height});const r=await page.locator('.glaze-finishes').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);await page.locator('.glaze-finishes').screenshot({path:path.join(out,'selectors-'+width+'.png')});}
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({portable,report,errors,requests},null,2));console.log(JSON.stringify({portable,report,errors,requests}));
 // Sparse crystals and speckles can share a ground colour; require visible
 // local pattern differences as well as a difference across the whole sample.
 if(!baseline)for(const sample of report)for(const p of sample.pairs)assert(p.difference>2&&p.patternDifference>=8,'samples remain distinct at their displayed size: '+sample.color+' '+JSON.stringify(p));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
