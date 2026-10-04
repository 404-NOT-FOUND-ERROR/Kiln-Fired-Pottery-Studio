const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4173/');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/vendor/three.module.js'),{LivingOptics}=await import('/living-optics.js');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
    renderer.setSize(420,280);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1.5,.1,100);
    camera.position.set(0,1.2,5);camera.lookAt(0,1,0);
    const backdrop=document.createElement('canvas');backdrop.width=backdrop.height=16;
    const bc=backdrop.getContext('2d');bc.fillStyle='#c0aa84';bc.fillRect(0,0,16,16);
    const plate=new THREE.CanvasTexture(backdrop);plate.colorSpace=THREE.SRGBColorSpace;scene.background=plate;
    const paint=document.createElement('canvas');paint.width=paint.height=256;const pc=paint.getContext('2d');
    pc.fillStyle='#33776d';pc.fillRect(0,0,256,256);pc.fillStyle='#bbdbb7';
    for(let x=0;x<256;x+=8)pc.fillRect(x,0,3,256);
    const texture=new THREE.CanvasTexture(paint);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshBasicMaterial({map:texture}));
    mesh.position.set(0,1,0);mesh.geometry.computeBoundingBox();scene.add(mesh);
    const copy=document.createElement('canvas');copy.width=420;copy.height=280;const ctx=copy.getContext('2d');
    function pixels(){ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,420,280).data.slice();}
    renderer.render(scene,camera);const direct=pixels();
    const optics=new LivingOptics({renderer,scene,camera,mesh});
    const info={focalLength:66,fstop:.22,width:1920},crop={w:1920};
    optics.uniforms.strength.value=0;optics.render(info,crop);const sharp=pixels();
    optics.uniforms.strength.value=1;optics.render(info,crop);const blurred=pixels();
    let changed=0,backgroundError=0,colourError=0;
    for(let y=0;y<280;y++)for(let x=0;x<420;x++){
      const p=(y*420+x)*4,d=Math.abs(sharp[p]-blurred[p])+Math.abs(sharp[p+1]-blurred[p+1])+Math.abs(sharp[p+2]-blurred[p+2]);
      if(d>6)changed++;
      if(x<40)backgroundError=Math.max(backgroundError,Math.abs(direct[p]-blurred[p]),Math.abs(direct[p+1]-blurred[p+1]),Math.abs(direct[p+2]-blurred[p+2]));
      if(x>180&&x<240&&y>110&&y<170)colourError=Math.max(colourError,Math.abs(direct[p]-sharp[p]),Math.abs(direct[p+1]-sharp[p+1]),Math.abs(direct[p+2]-sharp[p+2]));
    }
    return {changed,backgroundError,colourError,focus:optics.uniforms.focus.value,targetRestored:renderer.getRenderTarget()===null,backgroundRestored:scene.background===plate};
  });
  assert(result.changed>1000,'Lens blur must affect actual geometry, not just the background');
  assert(result.backgroundError<=2,'Lens pass must retain the baked plate colours');
  assert(result.colourError<=2,'Sharp lens pass must preserve ceramic tone mapping');
  assert(result.targetRestored&&result.backgroundRestored);
  const shadows=await page.evaluate(async()=>{
    const THREE=await import('/vendor/three.module.js'),{MuseumStage}=await import('/museum-stage.js');
    const {loadLivingAssets,loadMuseumAssets}=await import('/museum-assets.js');
    const [assets,museum]=await Promise.all([loadLivingAssets(),loadMuseumAssets()]);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
    renderer.setSize(800,450);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,16/9,.1,100);
    const mesh=new THREE.Mesh(museum.jar,new THREE.MeshStandardMaterial({color:'#739885',roughness:.35}));
    mesh.userData.form='jar';mesh.castShadow=true;scene.add(mesh);
    const world={scene,camera,renderer,mesh,controls:{enabled:true,autoRotate:false}};
    const stage=new MuseumStage(world,assets);stage.enter();stage.setView('full');
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;const ctx=canvas.getContext('2d');
    function pixels(){stage.render();ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,800,450).data.slice();}
    const leaves=stage.group.getObjectByName('Garden leaves casting dappled sunlight');
    const withLeaves=pixels();leaves.castShadow=false;const withoutLeaves=pixels();
    const bounds=new THREE.Box3().setFromObject(mesh),screen=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const p=new THREE.Vector3(x,y,z).project(camera);screen.push([(p.x+1)*400,(1-p.y)*225]);
    }
    const left=Math.min(...screen.map(p=>p[0]))-3,right=Math.max(...screen.map(p=>p[0]))+3;
    const top=Math.min(...screen.map(p=>p[1]))-3,bottom=Math.max(...screen.map(p=>p[1]))+3;
    let ceramicChanged=0,furnitureError=0;
    for(let y=0;y<450;y++)for(let x=0;x<800;x++){
      const p=(y*800+x)*4,d=Math.max(...[0,1,2].map(k=>Math.abs(withLeaves[p+k]-withoutLeaves[p+k])));
      if(x>=left&&x<=right&&y>=top&&y<=bottom){if(d>3)ceramicChanged++;}
      else furnitureError=Math.max(furnitureError,d);
    }
    return {ceramicChanged,furnitureError};
  });
  console.log(JSON.stringify({optics:result,shadows}));
  assert(shadows.ceramicChanged>50,'Garden leaves must cast visible shadows on the interactive ceramic');
  assert(shadows.furnitureError<=1,'Garden leaf shadows must not be duplicated on the baked furniture');
  assert.deepEqual(errors,[]);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
