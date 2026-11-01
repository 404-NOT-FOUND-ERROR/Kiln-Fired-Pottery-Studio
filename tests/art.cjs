const {prepareBlank,putOnShelf,completeFiring}=require('./workflow-helpers.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const out=path.resolve(__dirname,'../qa-artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},acceptDownloads:true}),errors=[];
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4173/?preview=1&scene=art');await page.locator('.art-mode #resultView canvas').waitFor();await page.waitForTimeout(3000);
 await page.click('[data-photo-drag="object"]');
 const fixed={x:40,y:160,width:150,height:130},ceramic={x:450,y:360,width:330,height:270};
  const background=await page.screenshot({clip:fixed}),before=await page.screenshot({clip:ceramic});
  await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(780,450,{steps:14});await page.mouse.up();await page.waitForTimeout(1800);
  assert(background.equals(await page.screenshot({clip:fixed})),'The color-field set must remain fixed during rotation');
  assert(!before.equals(await page.screenshot({clip:ceramic})),'The interactive ceramic must rotate');
  await page.click('[data-scene="museum"]');await page.waitForTimeout(400);
  const galleryGlaze=await page.screenshot({clip:ceramic});
  await page.click('[data-scene="art"]');await page.waitForTimeout(400);
  await page.click('[data-scene="museum"]');await page.waitForTimeout(400);
  const galleryRestored=await page.screenshot({clip:ceramic});
  const materialRestore=await page.evaluate(async([before,after])=>{
   async function pixels(source){const image=await createImageBitmap(await(await fetch('data:image/png;base64,'+source)).blob());const canvas=new OffscreenCanvas(image.width,image.height),context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,0,image.width,image.height).data;}
   const a=await pixels(before),b=await pixels(after);let changed=0,maxError=0;
   for(let i=0;i<a.length;i+=4){const error=Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])));if(error)changed++;maxError=Math.max(maxError,error);}
   return {changed,maxError};
  },[galleryGlaze.toString('base64'),galleryRestored.toString('base64')]);
  // Allow one-bit GPU rounding, while still rejecting changed glaze maps or lighting.
  assert(materialRestore.maxError<=1&&materialRestore.changed<100,'The art specimen treatment must not leak into the gallery');
  for(const scene of ['museum','living','art']){await page.click(`[data-scene="${scene}"]`);assert.equal(await page.getAttribute('#resultView','data-scene'),scene);}
  for(const view of ['full','detail','above']){await page.click(`[data-camera="${view}"]`);await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`art-${view}.png`)});}
  await page.click('[data-camera="detail"]');assert(await page.locator('[data-format="square"]').isVisible());
  for(const [format,height] of [['square',1200],['portrait',1500]]){
   await page.click(`[data-format="${format}"]`);const download=page.waitForEvent('download');await page.click('#exportPhoto');const file=path.join(out,`art-${format}.png`);await(await download).saveAs(file);
   const png=fs.readFileSync(file);assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),height);
  }
  await page.click('[data-camera="above"]');await page.fill('#pieceName','色场收藏检查');await putOnShelf(page);await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));
  const records=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('dongleya-pottery',1);req.onsuccess=()=>{const db=req.result,r=db.transaction('pieces').objectStore('pieces').getAll();r.onsuccess=()=>{db.close();resolve(r.result)}}}));
  assert.equal(records[0].scene,'art');assert.equal(records[0].camera,'above');assert(records[0].rotation>.5);
  await page.reload();await page.locator('.art-mode').waitFor();await page.click('#openCollection');await page.locator('.collection-item[data-example="false"]').first().click();await page.click('[data-panel="photo"]');await page.locator('.art-mode').waitFor();
  assert.equal(await page.inputValue('#pieceName'),'色场收藏检查');assert.equal(await page.getAttribute('[data-camera="above"]','aria-pressed'),'true');assert.equal(await page.getAttribute('#resultView','data-scene'),'art');
  await page.click('[data-panel="learn"]');assert.equal(await page.locator('.art-mode').count(),0);await page.click('[data-observe="before"]');await page.click('[data-observe="alternate"]');await page.click('[data-panel="photo"]');await page.locator('.art-mode').waitFor();
  for(const width of [320,390,768,1024]){
   await page.setViewportSize({width,height:844});
   for(const view of ['full','detail']){await page.click(`[data-camera="${view}"]`);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`art-${view}-${width}.png`),fullPage:true});}
  }
  await page.setViewportSize({width:1600,height:900});
  for(const form of ['jar','bowl','vase']){
   await page.click('#restart');assert.equal(await page.locator('.art-mode').count(),0);await page.click(`[data-form="${form}"]`);await prepareBlank(page);
   if(form==='jar')if(await page.locator('#onboardingDismiss').isVisible())await page.click('#onboardingDismiss');
   await page.click('#techniquePrimer [data-technique="dip"]');await page.click(`[data-glaze="${form==='vase'?'copper':'cobalt'}"]`);await page.click('#applyDip');await page.click('#toResult');await page.locator('#screen3.active').waitFor({timeout:30000});await completeFiring(page);await page.locator('.art-mode').waitFor();await page.click('[data-camera="full"]');await page.waitForTimeout(2800);await page.screenshot({path:path.join(out,`art-painted-${form}.png`)});
  }
  const optics=await page.evaluate(async()=>{
   const THREE=await import('/vendor/three.module.js'),{MuseumStage}=await import('/museum-stage.js');
   const {loadArtAssets,loadMuseumAssets}=await import('/museum-assets.js');const [art,museum]=await Promise.all([loadArtAssets(),loadMuseumAssets()]);
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});renderer.setSize(640,360);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,16/9,.1,100),mesh=new THREE.Mesh(museum.jar,new THREE.MeshPhysicalMaterial({map:museum.specimen,roughness:.25}));mesh.userData.form='jar';mesh.castShadow=true;scene.add(mesh);
   const stage=new MuseumStage({scene,camera,renderer,mesh,controls:{enabled:true,autoRotate:false}},art);stage.enter();stage.setView('detail');
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
   function pixels(){stage.render();ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,640,360).data.slice();}
   stage.optics.uniforms.strength.value=0;const sharp=pixels();stage.optics.uniforms.strength.value=1;const blurred=pixels();let changed=0,backgroundError=0;
   for(let y=0;y<360;y++)for(let x=0;x<640;x++){const p=(y*640+x)*4,d=Math.max(...[0,1,2].map(k=>Math.abs(sharp[p+k]-blurred[p+k])));if(d>3)changed++;if(x>580)backgroundError=Math.max(backgroundError,d);}
   return {changed,backgroundError,targetRestored:renderer.getRenderTarget()===null};
  });
  assert(optics.changed>100,'Art detail must blur the live ceramic according to depth');assert(optics.backgroundError<=1);assert(optics.targetRestored);
  const fallback=await browser.newPage(),fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));await fallback.route('**/assets/art/manifest.json',route=>route.fulfill({status:503,body:'Unavailable'}));await fallback.goto('http://127.0.0.1:4173/?preview=1&scene=art');await fallback.locator('#resultView canvas').waitFor();assert.equal(await fallback.locator('.art-mode').count(),0);await fallback.waitForFunction(()=>document.querySelector('#photoSceneStatus').textContent.includes('暂时无法加载'));assert.equal(await fallback.getAttribute('#resultView','data-scene'),'neutral');assert.deepEqual(fallbackErrors,[]);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({setFixed:true,ceramicRotates:true,materialRestore,sceneRestored:records[0].scene,cameraRestored:records[0].camera,forms:['jar','bowl','vase'],exports:[[1200,1200],[1200,1500]],optics,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
