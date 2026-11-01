const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let currentStep = 0;

function placeCamera() {
  const camera = $('.workshop-camera');
  if(document.body.classList.contains('mobile-portrait')){document.querySelector('#portraitCamera')?.prepend(camera);return;}
  const destination = innerWidth <= 900 && (currentStep === 1 || currentStep === 2)
    ? $(currentStep === 1 ? '.selection-stage' : '.paint-stage') : $('.module-dock');
  if (destination && camera.parentElement !== destination) destination.append(camera);
}

function paragraph(className, text) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

function stageHeading(parent, kicker, title, subtitle) {
  parent.querySelector('h1').textContent = title;
  parent.querySelector('.subline').textContent = subtitle;
  parent.prepend(paragraph('workshop-kicker', kicker));
}

export function setupStudioUI() {
  const backdrop = document.createElement('div');
  backdrop.className = 'workshop-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.prepend(backdrop);

  const selection = $('#screen1 .layout');
  const selectionStage = document.createElement('div');
  selectionStage.className = 'selection-stage';
  selection.prepend(selectionStage);
  selectionStage.append($('#selectView'));
  const selectionControls = selection.lastElementChild;
  selectionControls.classList.add('selection-controls');
  selectionControls.prepend($('#screen1 .screen-head'));
  stageHeading(selectionControls.querySelector('.screen-head'), '01 / 选坯',
    '选一件素坯', '从器形开始，留下自己的颜色。');
  selectionControls.querySelector('.screen-head').after(paragraph('blank-status', '素烧瓷坯 · 尚未施釉'));
  const processNote = document.createElement('details');
  processNote.className = 'blank-explainer';
  processNote.innerHTML = '<summary>为什么从素烧坯开始？</summary><p>这次体验从已成型、已素烧的瓷坯开始。常见的二次烧成流程是：成型 → 干燥 → 素烧 → 施釉并干燥 → 釉烧 → 冷却。这里体验后半段；还有一次烧成等其他工艺。</p><p>瓷泥本身可以是浅色，素烧坯也可以呈米白色；此时没有烧成釉面的光泽。坯色会随泥料和烧成条件变化。</p>';
  selectionControls.querySelector('.model-select').after(processNote);
  const backToIntro = document.createElement('button');
  backToIntro.id = 'backToIntro';
  backToIntro.className = 'secondary';
  backToIntro.textContent = '返回工坊';
  selectionControls.querySelector('.actions').append(backToIntro);

  const paintControls = $('.paint-controls');
  paintControls.prepend($('.paint-stage-head'));
  stageHeading(paintControls.querySelector('.paint-stage-head'), '02 / 施釉',
    '为素坯施釉', '颜色藏在窑火之后。');
  const status = paragraph('blank-status', '素烧瓷坯 · 尚未施釉');
  status.id = 'blankStageStatus';
  paintControls.querySelector('.paint-stage-head').after(status);
  $('.control-heading').remove();
  const tabs = document.createElement('div');
  tabs.className = 'workshop-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', '施釉工具分类');
  tabs.innerHTML = '<button type="button" data-workshop-tab="glaze" aria-pressed="true">釉色</button><button type="button" data-workshop-tab="tools" aria-pressed="false">笔触与施釉</button>';
  status.after(tabs);

  const paintBody = document.createElement('div');
  paintBody.className = 'paint-controls-body';
  const sections = [...paintControls.querySelectorAll('.control-section')];
  sections[0].dataset.workshopPanel = 'glaze';
  sections[0].querySelector('strong').textContent = '烧后釉色参考';
  sections[0].querySelector('.section-title small').textContent = '色块参考烧后效果；画布显示未烧釉层示意。';
  sections.slice(1, 4).forEach(section => { section.dataset.workshopPanel = 'tools'; section.hidden = true; });
  const sliders = document.createElement('div');
  sliders.className = 'basic-brush-controls';
  sliders.dataset.workshopPanel = 'tools';sliders.hidden=true;
  sliders.innerHTML = '<label for="brushSizeRange"><span>笔刷大小</span><input id="brushSizeRange" type="range" min="12" max="60" value="34" aria-label="笔刷大小"></label><label for="glazeLoadRange"><span>相对釉量</span><input id="glazeLoadRange" type="range" min="20" max="100" value="55" aria-label="相对釉量"></label><p>未烧釉层以哑光、低彩度显示；实际生釉颜色因配方而异。</p>';
  paintBody.append(sections[0], sliders, ...sections.slice(1, 4));

  const paintActions = paintControls.querySelector('.actions');
  paintActions.classList.add('workflow-actions');
  const backToSelect = document.createElement('button');
  backToSelect.id = 'backToSelect';
  backToSelect.className = 'secondary';
  backToSelect.textContent = '返回选坯';
  const secondaryActions = document.createElement('div');
  secondaryActions.className = 'workflow-secondary';
  secondaryActions.append(backToSelect, $('#clearPaint'));
  paintActions.append(secondaryActions);
  const paintFooter = document.createElement('div');
  paintFooter.className = 'paint-controls-footer';
  paintFooter.append(paintActions);

  const firingSettings = document.createElement('details');
  firingSettings.className = 'firing-settings';
  firingSettings.innerHTML = '<summary>烧成设置 <span id="firingSettingsSummary">氧化气氛 · 缓冷</span></summary>';
  firingSettings.append(sections[4], $('.control-footnote'));
  paintFooter.prepend(firingSettings);
  paintControls.append(paintBody, paintFooter);
  tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    tabs.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    paintBody.querySelectorAll('[data-workshop-panel]').forEach(section => {
      section.hidden = section.dataset.workshopPanel !== button.dataset.workshopTab;
    });
    paintBody.scrollTop = 0;
  }));

  const paintTools = document.createElement('div');
  paintTools.className = 'paint-tool-dock';
  $('.paint-canvas-wrap').append(paintTools);

  const dock = document.createElement('div');
  dock.className = 'exhibition-dock';
  $('.exhibit-main').append(dock);
  dock.append($('.camera-bar'));
  $('#photoPanel .photo-format').before($('.scene-picker'));
  $('#resultPanel').append($('.artifact-notes'));
  $('.camera-bar').setAttribute('aria-label', '取景与旋转');

  setStudioStep(0);
  window.addEventListener('resize', placeCamera);
}

export function arrangePaintTools() {
  const primer = $('#techniquePrimer');
  if (primer) {
    const techniqueSection = $('.technique-grid').parentElement;
    techniqueSection.prepend(primer);
  }
  const zoom = $('.zoom-control');
  if (zoom) $('.workshop-camera').prepend(zoom);
}

export function setStudioStep(step) {
  currentStep = step;
  document.body.dataset.studioStep = String(step);
  $('#workshopRotate').setAttribute('aria-pressed', String(step === 1));
  $$('.studio-progress [data-studio-step]').forEach(item => {
    if (item.dataset.studioStep === (step===1&&document.body.dataset.makingPhase==='choose'?'choose':String(step))) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  const collection = $('#openCollection');
  const home = $('#collectionHome');
  const destination = step === 3 ? $('.exhibition-library') : home;
  if (destination && collection.parentElement !== destination) destination.append(collection);
  collection.setAttribute('aria-label', '打开我的作品');
  placeCamera();
}
