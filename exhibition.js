import * as THREE from 'three';
import { MuseumStage } from './museum-stage.js';
import { applyGlazeSurface } from './museum-assets.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const scenes = {
  museum: { title: '01 / 藏品 · THE GALLERY', note: '让一束光，认真看见你的作品。', top: '#101f1a', bottom: '#354b38', ink: '#e2e7d5', label: '藏品' },
  living: { title: '02 / 窗边 · A QUIET AFTERNOON', note: '一方窗光，给日常添一件喜欢。', top: '#d3d8c3', bottom: '#f0e6cb', ink: '#37291b', label: '窗边' },
  art: { title: '03 / 色场 · OBJECTS OF IMAGINATION', note: '让颜色相遇，让灵感自由生长。', top: '#b5afd1', bottom: '#e2dbe7', ink: '#4d4966', label: '色场' },
  neutral: { title: '观察室 / 同一视角 · 中性光照', note: '固定光照与视角，让差异更容易被看见。', top: '#d1d3ce', bottom: '#edeee7', ink: '#485146', label: '观察室' }
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const imageFrom = src => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src; });
const processName = fire => ({ '氧化焰': '氧化气氛', '还原焰': '还原气氛', '柴烧': '柴烧预设' }[fire] || fire);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dongleya-pottery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pieces', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storage(action, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pieces', action === 'put' ? 'readwrite' : 'readonly');
    const request = tx.objectStore('pieces')[action](...(value === undefined ? [] : [value]));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('保存已取消')); };
  });
}

export function createExhibition({ toast, onLoad, assets = null, livingAssets = null, initialScene = 'museum' }) {
  let current, world, decor, sceneKey = 'museum', panel = 'photo', observed = 'after', cameraKey = 'full', format = 'portrait';
  let alternate, busy = false, activeRecord = null, libraryTrigger, museum, living, activeStage;
  const settingsToggle=document.createElement('button');settingsToggle.className='museum-settings';settingsToggle.textContent='作品信息与导出设置 ＋';settingsToggle.setAttribute('aria-expanded','false');
  $('#photoPanel').append(settingsToggle);settingsToggle.onclick=()=>{const expanded=$('#photoPanel').classList.toggle('settings-expanded');settingsToggle.setAttribute('aria-expanded',String(expanded));settingsToggle.textContent=expanded?'收起作品信息 −':'作品信息与导出设置 ＋';};
  const livingPoem=document.createElement('p');livingPoem.className='living-poem';livingPoem.textContent='一次窑火，只此一件。';
  const livingMetadata=document.createElement('p');livingMetadata.className='living-metadata';
  $('#pieceDescription').after(livingPoem,livingMetadata);
  const backgrounds = new Map();
  const dialog = document.createElement('dialog');
  dialog.className = 'collection-dialog';
  dialog.setAttribute('aria-labelledby', 'collectionTitle');
  dialog.innerHTML = '<div class="collection-header"><h2 id="collectionTitle">我的作品架</h2><button aria-label="关闭作品架">×</button></div><p>那些亲手留下的颜色，值得再看一次。<br>收藏仅保存在当前浏览器；清除网站数据会移除收藏，可下载作品卡留念。</p><div class="collection-grid"></div>';
  document.body.append(dialog);
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => libraryTrigger?.focus());

  function background(key) {
    if (backgrounds.has(key)) return backgrounds.get(key);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'), s = scenes[key];
    const g = ctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, s.top); g.addColorStop(1, s.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    const glow = ctx.createRadialGradient(215, 230, 15, 250, 300, 360);
    glow.addColorStop(0, key === 'museum' ? '#aab78225' : '#ffffed45'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    backgrounds.set(key, texture); return texture;
  }
  function clearDecor() {
    if (!decor) return;
    world.scene.remove(decor);
    decor.traverse(node => { node.geometry?.dispose(); if (node.material) { node.material.map?.dispose(); node.material.dispose(); } });
  }
  function object(geometry, color, position, roughness = .8) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness }));
    mesh.position.set(...position); mesh.receiveShadow = true; mesh.castShadow = true; decor.add(mesh); return mesh;
  }
  function buildDecor(key) {
    clearDecor(); decor = new THREE.Group(); world.scene.add(decor);
    if (key === 'museum') {
      object(new THREE.CylinderGeometry(1.43, 1.47, .36, 96), '#343e2d', [0, .14, 0]);
      object(new THREE.CylinderGeometry(1.45, 1.45, .012, 96), '#7c7958', [0, .323, 0], .48);
      object(new THREE.CylinderGeometry(1.46, 1.46, .025, 96), '#353f31', [0, -.04, 0]);
    } else if (key === 'living') {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#bdab84'; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 250; i++) { const y = i * 2.1; ctx.strokeStyle = i % 3 ? '#7a60330d' : '#fff3c512'; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(170, y + Math.sin(i) * 4, 320, y - 4, 512, y + 3); ctx.stroke(); }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const table = object(new THREE.BoxGeometry(22, .15, 16), '#ffffff', [0, -.085, 0]); table.material.map = texture;
      object(new THREE.CylinderGeometry(1.38, 1.42, .15, 80), '#d9d2b5', [0, .075, 0]);
      const wall = object(new THREE.PlaneGeometry(22, 12), '#dfdfc8', [0, 3, -3]); wall.castShadow = false;
      // A window-light study, drawn locally so the scene remains self-contained.
      const patch = document.createElement('canvas'); patch.width = patch.height = 512; const p = patch.getContext('2d');
      p.fillStyle = '#fff7d4'; p.fillRect(0, 0, 512, 512); p.fillStyle = '#9baf8770'; p.fillRect(225, 0, 21, 512); p.fillRect(0, 250, 512, 18);
      p.strokeStyle = '#6e875949'; p.lineWidth = 7; p.beginPath(); p.moveTo(490, 530); p.quadraticCurveTo(270, 220, 430, 20); p.stroke();
      for (let i = 0; i < 11; i++) { p.save(); p.translate(350 + Math.sin(i) * 48, 30 + i * 44); p.rotate(i * .7); p.fillStyle = '#6e875935'; p.beginPath(); p.ellipse(0, 0, 65, 12, -.7, 0, Math.PI * 2); p.fill(); p.restore(); }
      const t = new THREE.CanvasTexture(patch); t.colorSpace = THREE.SRGBColorSpace;
      const windowLight = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .53 })); windowLight.position.set(-1.6, 2.25, -2.985); windowLight.rotation.z = -.15; decor.add(windowLight);
      const mat = object(new THREE.BoxGeometry(1.35, .016, 2.3), '#72826a', [2.35, .008, -.4]); mat.rotation.y = -.3;
      object(new THREE.CylinderGeometry(.32, .3, .07, 64), '#9b8058', [2.2, .06, .1]);
      object(new THREE.CylinderGeometry(.26, .18, .3, 64, 1, true), '#d7d4b8', [2.2, .24, .1]);
    } else if (key === 'art') {
      object(new THREE.PlaneGeometry(80, 80), '#c7bdd4', [0, -.06, 0]).rotation.x = -Math.PI / 2;
      object(new THREE.CylinderGeometry(1.32, 1.32, .38, 96), '#d6df9d', [0, .13, 0]);
      const ring = object(new THREE.TorusGeometry(1.8, .13, 20, 100), '#dce7a5', [-.65, 1.85, -1.5], .55); ring.rotation.set(.15, -.3, .4);
      object(new THREE.SphereGeometry(.45, 48, 32), '#868ba7', [2.2, .4, -.7], .5);
      const box = object(new THREE.BoxGeometry(.75, .75, .75), '#a7b79b', [-2, .32, .5]); box.rotation.y = .4;
    } else {
      object(new THREE.CylinderGeometry(1.4, 1.4, .14, 80), '#c0c4ba', [0, .07, 0]);
    }
  }
  function setScene(key, resetCamera = false) {
    if (!world) return;
    const calibrated = key==='museum'?museum:key==='living'?living:null;
    if(activeStage!==calibrated){activeStage?.leave();world.controls.autoRotate=false;$('#autoRotate').setAttribute('aria-pressed','false');}
    activeStage=calibrated;
    $('#app').classList.toggle('museum-mode', Boolean(calibrated)&&key==='museum');
    $('#app').classList.toggle('living-mode', Boolean(calibrated)&&key==='living');
    if (calibrated) {
      clearDecor();decor=null;
      $('#resultView').dataset.scene=key;$('#sceneCaption').textContent=scenes[key].title;
      $('#sceneNote').textContent=key==='living'?'把器物，放回一段有光的日常。':'左右拖动，细看窑火留下的痕迹。';
      calibrated.enter();calibrated.setView(cameraKey);
      return;
    }
    const s = scenes[key]; world.scene.background = background(key); buildDecor(key);
    $('#resultView').dataset.scene = key; $('#sceneCaption').textContent = s.title; $('#sceneNote').textContent = s.note;
    const lights = world.exhibitLights;
    lights.forEach(({ light, intensity, color }) => { light.intensity = intensity * .5; light.color.copy(color); });
    world.scene.fog = null;
    if (key === 'museum') {
      lights.forEach(({ light }) => { light.intensity *= light.isHemisphereLight ? .3 : .85; });
      world.renderer.toneMappingExposure = .78;
    } else if (key === 'living') {
      lights.forEach(({ light }) => { if (light.isRectAreaLight) light.color.set('#fff5dd'); });
      world.renderer.toneMappingExposure = .84;
    } else { world.renderer.toneMappingExposure = key === 'neutral' ? .86 : .82; }
    world.mesh.position.y = key === 'living' || key === 'neutral' ? .155 : .332;
    if (resetCamera || assets) setCamera(cameraKey);
  }
  function setCamera(key) {
    if (!world) return;
    cameraKey = key;
    if (activeStage?.active) {
      activeStage.setView(key);
      $$('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===key)));
      return;
    }
    const size = new THREE.Box3().setFromObject(world.mesh).getSize(new THREE.Vector3());
    const aspect = Math.max(.35, world.camera.aspect);
    const fov = THREE.MathUtils.degToRad(world.camera.fov);
    const height = Math.max(size.y, 1.5), width = Math.max(size.x, 2.4);
    const distance = Math.max(height / (2 * Math.tan(fov / 2)), width / (2 * Math.tan(fov / 2) * aspect)) * 1.5;
    const target = new THREE.Vector3(0, world.mesh.position.y + size.y * .43, 0);
    if (key === 'detail') { target.y = world.mesh.position.y + size.y * .65; world.camera.position.set(distance * .08, target.y + .12, distance * .56); }
    else if (key === 'above') world.camera.position.set(distance * .16, target.y + distance * .65, distance * .72);
    else world.camera.position.set(distance * .07, target.y + distance * .15, distance);
    world.controls.target.copy(target); world.controls.minDistance = Math.max(.7, distance * .32); world.controls.maxDistance = distance * 2;
    world.controls.minPolarAngle = .12; world.controls.maxPolarAngle = Math.PI * .52; world.controls.update();
    $$('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.camera === key)));
  }
  function setObserved(value) {
    if (!current) return;
    observed = value;
    if (value === 'alternate' && !alternate) alternate = current.alternate();
    world.mesh.material.map = (value === 'before' ? current.before : value === 'alternate' ? alternate : current.after).texture;
    const cool = value === 'alternate' ? (current.settings.cooling === '缓冷' ? '快冷' : '缓冷') : current.settings.cooling;
    world.mesh.material.roughness = value === 'before' ? .65 : cool === '快冷' ? .17 : .25;
    world.mesh.material.clearcoat = value === 'before' ? .18 : .94;
    world.mesh.material.clearcoatRoughness = value === 'before' ? .35 : cool === '快冷' ? .08 : .14;
    world.mesh.material.envMapIntensity = value === 'before' ? .4 : .65;
    applyGlazeSurface(world.mesh.material, assets, { before:value==='before', specimen:current.settings.specimen, cooling:cool });
    world.mesh.material.needsUpdate = true;
    $('#viewBadge').textContent = value === 'before' ? '烧前釉层' : value === 'alternate' ? `对照 · ${cool}` : `烧后成品 · ${current.settings.cooling}`;
    $$('[data-observe]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.observe === value)));
  }
  function setPanel(value) {
    panel = value;
    $('#photoPanel').hidden = value !== 'photo'; $('#learnPanel').hidden = value !== 'learn';
    $$('[data-panel]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panel === value)));
    $$('.scene-picker button').forEach(b => { b.disabled = value === 'learn'; });
    setObserved('after'); setScene(value === 'learn' ? 'neutral' : sceneKey);
    if (value === 'learn') { world.controls.autoRotate = false; $('#autoRotate').setAttribute('aria-pressed', 'false'); }
  }
  function title() { return $('#pieceName').value.trim() || `${current.settings.glazeNames.join('·')} · ${current.settings.object}`; }

  function renderPhoto(width, height) {
    if (activeStage?.active) return activeStage.renderPhoto(width,height);
    const { renderer, camera, controls } = world;
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = camera.aspect;
    const position = camera.position.clone(), rotation = controls.autoRotate;
    const result = document.createElement('canvas'); result.width = width; result.height = height;
    try {
      controls.autoRotate = false;
      // Maintain composition in narrow portrait exports without changing the user's view.
      const distance = position.distanceTo(controls.target);
      const scale = cameraKey === 'detail' ? 1 : Math.max(1, 3.25 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (width / height) * distance));
      camera.position.copy(controls.target).add(position.clone().sub(controls.target).multiplyScalar(scale));
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.render(world.scene, camera); result.getContext('2d').drawImage(renderer.domElement, 0, 0);
    } finally {
      camera.position.copy(position); camera.aspect = aspect; camera.updateProjectionMatrix(); renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); controls.autoRotate = rotation; renderer.render(world.scene, camera);
    }
    return result;
  }
  function drawText(ctx, value, x, y, maxWidth) {
    let str = value; while (str.length > 1 && ctx.measureText(str).width > maxWidth) str = str.slice(0, -1);
    ctx.fillText(str === value ? str : `${str.slice(0, -1)}…`, x, y);
  }
  function pieceCard() {
    const width = 1200, height = format === 'portrait' ? 1500 : 1200;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'), photoHeight = height - 225;
    ctx.fillStyle = sceneKey==='museum'?'#121a15':sceneKey==='living'?'#ece0c9':'#f5f3ec'; ctx.fillRect(0, 0, width, height); ctx.drawImage(renderPhoto(width, photoHeight), 0, 0);
    ctx.fillStyle = scenes[sceneKey].ink; ctx.font = '17px sans-serif'; ctx.fillText('懂了鸭 / 一器一会', 53, 60); ctx.textAlign = 'right'; ctx.fillText(scenes[sceneKey].title, width - 53, 60); ctx.textAlign = 'left';
    ctx.fillStyle = sceneKey==='museum'?'#e2d5b6':sceneKey==='living'?'#37291b':'#354937'; ctx.font = '42px "Songti SC", "Microsoft YaHei", serif'; drawText(ctx, title(), 53, photoHeight + 76, width - 106);
    ctx.fillStyle = sceneKey==='museum'?'#a69e88':sceneKey==='living'?'#776347':'#7e8a76'; ctx.font = '19px "Microsoft YaHei", sans-serif';
    drawText(ctx, `${current.settings.object} / ${current.settings.glazeNames.join('、')} / ${processName(current.settings.fire)} / ${current.settings.cooling}`, 53, photoHeight + 122, width - 106);
    ctx.strokeStyle = sceneKey==='museum'?'#4b4d3d':'#d4dacb'; ctx.beginPath(); ctx.moveTo(53, height - 65); ctx.lineTo(width - 53, height - 65); ctx.stroke();
    ctx.font = '14px sans-serif'; ctx.fillText('亲手留下的颜色，值得被看见。', 53, height - 32); ctx.textAlign = 'right'; ctx.fillText('数字陶艺 · 艺术化工艺示意', width - 53, height - 32);
    return canvas;
  }
  function comparisonCard() {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1120; const ctx = canvas.getContext('2d');
    const savedObserved = observed, savedScene = panel === 'learn' ? 'neutral' : sceneKey;
    const poses = { p: world.camera.position.clone(), t: world.controls.target.clone(), key: cameraKey };
    const other = current.settings.cooling === '缓冷' ? '快冷' : '缓冷';
    try {
      setScene('neutral'); setCamera('full');
      ctx.fillStyle = '#f5f3ec'; ctx.fillRect(0, 0, 1600, 1120);
      ctx.fillStyle = '#354937'; ctx.font = '36px "Microsoft YaHei", sans-serif'; drawText(ctx, `${title()} / 一次只改变冷却`, 60, 78, 1480);
      setObserved('after'); ctx.drawImage(renderPhoto(720, 750), 60, 130);
      setObserved('alternate'); ctx.drawImage(renderPhoto(720, 750), 820, 130);
      ctx.font = '26px "Microsoft YaHei", sans-serif'; ctx.fillText(`本次烧成 · ${current.settings.cooling}`, 60, 930); ctx.fillText(`对照烧成 · ${other}`, 820, 930);
      ctx.fillStyle = '#7a8773'; ctx.font = '21px "Microsoft YaHei", sans-serif'; ctx.fillText('同一器物、同一釉层、同一烧成预设与中性光照，仅切换冷却条件。', 60, 992);
      ctx.font = '18px "Microsoft YaHei", sans-serif'; ctx.fillText('本图为艺术化示意，不预测真实釉料结果；是否结晶取决于配方与温度曲线等条件。', 60, 1040);
      ctx.font = '15px sans-serif'; ctx.fillText('懂了鸭 / 每一次动手，都离理解更近一点。', 60, 1080);
    } finally { setScene(savedScene); setObserved(savedObserved); world.camera.position.copy(poses.p); world.controls.target.copy(poses.t); cameraKey = poses.key; world.controls.update(); $$('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.camera === cameraKey))); }
    return canvas;
  }
  async function download(canvas, suffix) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('图片编码失败')), 'image/png'));
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${title().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}-${suffix}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function guarded(button, action, failure) {
    if (busy) return; busy = true; button.disabled = true;
    try { await action(); } catch (error) { console.error(error); toast(failure); } finally { busy = false; button.disabled = false; }
  }
  async function openCollection(event) {
    libraryTrigger = event?.currentTarget || document.activeElement;
    const grid = dialog.querySelector('.collection-grid'); grid.replaceChildren();
    const message = document.createElement('p'); message.className = 'collection-empty'; message.textContent = '正在打开作品架…'; grid.append(message); dialog.showModal();
    try {
      const records = (await storage('getAll')).sort((a, b) => b.updated - a.updated);
      if (!records.length) { message.textContent = '还没有收藏。完成一次窑火，把第一件作品留在这里。'; return; }
      grid.replaceChildren();
      for (const record of records) {
        const button = document.createElement('button'); button.className = 'collection-item';
        const img = document.createElement('img'); img.src = record.thumbnail; img.alt = record.name; img.loading = 'lazy';
        const name = document.createElement('strong'); name.textContent = record.name;
        const info = document.createElement('small'); info.textContent = `${record.settings.object} · ${new Date(record.updated).toLocaleDateString('zh-CN')}`;
        button.append(img, name, info); grid.append(button);
        button.onclick = () => guarded(button, async () => {
          const images = {};
          for (const [key, src] of Object.entries(record.layers)) images[key] = await imageFrom(src);
          await onLoad(record, images); dialog.close(); $('#pieceName').focus({ preventScroll: true }); toast('已打开收藏，可换场景继续拍照');
        }, '作品读取失败，请重新打开作品架');
      }
    } catch (error) { console.error(error); message.textContent = '当前浏览器未允许本地收藏。你仍然可以下载作品卡留念。'; }
  }
  $('#openCollection').onclick = openCollection;
  const introCollection = document.createElement('button'); introCollection.textContent = '打开我的作品架 ↗'; introCollection.className = 'collection-intro'; introCollection.onclick = openCollection; $('.intro-action').append(introCollection);
  $$('[data-scene]').filter(b => b.tagName === 'BUTTON').forEach(b => b.onclick = () => {
    sceneKey = b.dataset.scene; $$('.scene-picker button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); setScene(sceneKey);
  });
  $$('[data-panel]').forEach(b => b.onclick = () => setPanel(b.dataset.panel));
  $$('[data-camera]').forEach(b => b.onclick = () => setCamera(b.dataset.camera));
  $$('[data-observe]').forEach(b => b.onclick = () => setObserved(b.dataset.observe));
  $$('[data-format]').forEach(b => b.onclick = () => { format = b.dataset.format; $$('[data-format]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('#autoRotate').onclick = () => { if(activeStage?.active){activeStage.autoRotate=!activeStage.autoRotate;$('#autoRotate').setAttribute('aria-pressed',String(activeStage.autoRotate));return;}world.controls.autoRotate = !world.controls.autoRotate; world.controls.autoRotateSpeed = .45; $('#autoRotate').setAttribute('aria-pressed', String(world.controls.autoRotate)); };
  $('#pieceName').addEventListener('input', () => { $('#save').innerHTML = '收藏这件作品 <span>＋</span>'; });
  $('#exportPhoto').onclick = e => guarded(e.currentTarget, async () => { await download(pieceCard(), scenes[sceneKey].label); toast('作品卡已生成，正在下载'); }, '图片生成失败，请重试');
  $('#exportComparison').onclick = e => guarded(e.currentTarget, async () => { await download(comparisonCard(), '冷却对照'); toast('实验对照卡已生成，正在下载'); }, '对照卡生成失败，请重试');
  $('#save').onclick = e => guarded(e.currentTarget, async () => {
    const card = pieceCard(), thumb = document.createElement('canvas'); thumb.width = 360; thumb.height = 360; thumb.getContext('2d').drawImage(card, 0, 0, card.width, card.width, 0, 0, 360, 360);
    const record = { id: activeRecord || crypto.randomUUID(), name: title(), updated: Date.now(), scene: sceneKey, settings: current.settings, rotation:world.mesh.rotation.y, camera:cameraKey, layers: current.capture(), thumbnail: thumb.toDataURL('image/jpeg', .8) };
    await storage('put', record); activeRecord = record.id; $('#save').innerHTML = '已收藏 · 更新作品 <span>✓</span>'; toast('已保存到作品架，刷新后仍可查看');
  }, '收藏失败：浏览器存储不可用或空间不足，请下载作品卡');

  return {
    present(data, record = null) {
      activeStage?.leave();activeStage=null;
      alternate?.texture.dispose(); alternate = null; current = data; world = data.world; activeRecord = record?.id || null;
      world.mesh.scale.setScalar(1);
      if (!world.exhibitLights) {
        world.exhibitLights = []; world.scene.traverse(light => { if (light.isLight) world.exhibitLights.push({ light, intensity: light.intensity, color: light.color.clone() }); });
        const studio = new THREE.Scene(); studio.background = new THREE.Color('#777777');
        for (const [width,height,x,y,z,color] of [[3,7,-4,3,3,'#ffffff'],[2,6,4,2,1,'#cdded8'],[5,3,0,6,-3,'#fff3d9']]) {
          const softbox = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide})); softbox.position.set(x,y,z);softbox.lookAt(0,1,0);studio.add(softbox);
        }
        const pmrem = new THREE.PMREMGenerator(world.renderer); world.scene.environment?.dispose();world.exhibitEnvironment=pmrem.fromScene(studio,.04);world.scene.environment=world.exhibitEnvironment.texture;
        studio.traverse(node=>{node.geometry?.dispose();node.material?.dispose()});pmrem.dispose();
      }
      if(assets&&!museum)museum=new MuseumStage(world,assets);
      if(livingAssets&&!living)living=new MuseumStage(world,livingAssets);
      const box = new THREE.Box3().setFromObject(world.mesh), size = box.getSize(new THREE.Vector3());
      world.mesh.scale.setScalar(Math.min(2.7 / size.y, 2.15 / Math.max(size.x, size.z)));
      world.controls.autoRotate = false; $('#autoRotate').setAttribute('aria-pressed', 'false');
      world.renderer.domElement.setAttribute('aria-label', '三维陶器，拖动旋转；也可使用下方全貌、特写、俯视按钮');
      const s = current.settings; sceneKey = record?.scene || (scenes[initialScene]?initialScene:'museum'); cameraKey = record?.camera || 'full';
      if(record&&Number.isFinite(record.rotation))world.mesh.rotation.y=record.rotation;
      if(museum)museum.autoRotate=false;
      if(living)living.autoRotate=false;
      $('#pieceName').value = record?.name || `${s.glazeNames[0]}有声`;
      $('#pieceDescription').textContent = `${s.object}，${s.glazeNames.join('、')}。从你留下的色彩关系里，生长出属于这一件的表情。`;
      $('#factShape').textContent = s.object; $('#factGlaze').textContent = s.glazeNames.join(' · '); $('#factFire').textContent = `${processName(s.fire)} · ${s.temp}`; $('#factCool').textContent = s.cooling;
      livingMetadata.textContent=`${s.object} · ${s.glazeNames.join('、')} · ${s.cooling}`;
      const other = s.cooling === '缓冷' ? '快冷' : '缓冷'; $('#alternateLabel').textContent = `只改冷却 → ${other}`;
      $('#coolingQuestion').textContent = `从${s.cooling}，换成${other}。`;
      $('#coolingFinding').textContent = `本演示让缓冷预设出现更多细小斑点、表面略柔和；快冷预设更光滑。切换对照时，器形、釉层和烧成预设都保持不变。真实结果仍取决于具体釉料与温度曲线。`;
      $('#save').innerHTML = record ? '已收藏 · 更新作品 <span>✓</span>' : '收藏这件作品 <span>＋</span>';
      $$('.scene-picker button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === sceneKey)));
      setPanel('photo'); world.fit = () => setCamera(cameraKey); world.resize();
      $('#resultView').classList.remove('revealing');
      if (!record && !reducedMotion.matches) { void $('#resultView').offsetWidth; $('#resultView').classList.add('revealing'); }
    }
  };
}
