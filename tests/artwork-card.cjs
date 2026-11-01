const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const out=path.resolve(__dirname,'../qa-artifacts/'+(process.env.POTTERY_HTML?'platform-':'')+'artwork-card');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',acceptDownloads:true}),requests=[],errors=[];
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.cardText=[];const native=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){if(this.canvas.width===1200&&[1200,1500].includes(this.canvas.height)){const m=this.measureText(value);window.cardText.push({value:String(value),x,y,width:m.width,font:this.font,right:x+m.actualBoundingBoxRight,left:x-m.actualBoundingBoxLeft,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});}return native.call(this,value,x,y,...rest);};});
 const snap=()=>page.evaluate(()=>window.potteryStudio.inspectStudio());
 await page.goto(pathToFileURL(process.env.POTTERY_HTML?path.resolve(process.env.POTTERY_HTML):path.resolve(__dirname,'../dist/pottery-studio.html')).href,{timeout:60000});
 await page.click('#previewPiece');await page.locator('#screen3.active').waitFor({timeout:45000});await page.click('[data-panel="photo"]');await page.fill('#pieceName','天青有声');
 async function exportCard(scene,format,name=scene+'-'+format){
  await page.click(`[data-format="${format}"]`);await page.evaluate(()=>window.cardText=[]);const before=await snap(),download=page.waitForEvent('download');await page.click('#exportPhoto');await(await download).saveAs(path.join(out,name+'.png'));const after=await snap();
  assert.deepEqual(after.geometry.camera,before.geometry.camera,'export preserves the camera');assert.deepEqual(after.geometry.rotation,before.geometry.rotation,'export preserves the ceramic');assert.deepEqual(after.photo.pose,before.photo.pose,'export preserves the photo pose');
  const png=fs.readFileSync(path.join(out,name+'.png')),height=format==='portrait'?1500:1200;assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),height);
  const text=await page.evaluate(()=>window.cardText);assert(text.length>30,'caption is drawn as real text');for(const t of text){assert(t.left>=40&&t.right<=1160&&t.top>=12&&t.bottom<=height-24,'all text fits the paper: '+JSON.stringify(t));}
  const nameText=text.filter(t=>parseFloat(t.font.replace(/^\D*/,''))>=30);assert(nameText.length>0);assert(Math.max(...nameText.map(t=>t.right))<1000,'name stays clear of the silhouette');
  const pixels=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {corner:[...ctx.getImageData(8,8,1,1).data],photo:[...ctx.getImageData(600,300,1,1).data],footer:[...ctx.getImageData(8,c.height-8,1,1).data]};},'data:image/png;base64,'+png.toString('base64'));
  assert(pixels.corner[3]===255&&pixels.corner[0]>235&&pixels.corner[0]>pixels.corner[2],'warm opaque paper edge');assert(pixels.footer[3]===255&&pixels.footer.slice(0,3).every((v,i)=>Math.abs(v-pixels.corner[i])<=8),'paper continues around photo and caption');assert.notDeepEqual(pixels.photo,pixels.corner,'live photo is inset into paper');
  return {scene,format,filename:name+'.png',width:1200,height};
 }
 const cards=[];for(const scene of ['museum','living','art','neutral']){
  await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(s=>document.querySelector('#resultView').dataset.scene===s,scene);await page.click('[data-camera="full"]');await page.waitForTimeout(250);
  for(const format of ['portrait','square'])cards.push(await exportCard(scene,format));
 }
 await page.fill('#pieceName','在窗光和窑火之间留下属于自己的这一件陶器');await exportCard('neutral','square','long-title');
 await page.click('[data-scene="living"]');await page.waitForFunction(()=>document.querySelector('#resultView').dataset.scene==='living');await page.fill('#pieceName','天青有声');await page.click('[data-camera="detail"]');await exportCard('living','portrait','detail');
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);const report={singleHTML:true,networkRequests:requests,cards,longTitleFits:true,livePhoto:true,cameraPreserved:true,detailPhoto:true,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
