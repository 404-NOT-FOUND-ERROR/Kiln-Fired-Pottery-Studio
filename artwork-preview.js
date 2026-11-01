// Share the export composition, but only render a small image after framing settles.
export function mountArtworkPreview({host,render,key,active,onDownload,pause}){
  const format=host.querySelector('.photo-format'),section=document.createElement('div');
  section.className='artwork-preview-row';
  format.before(section);section.append(format);
  const button=document.createElement('button');button.id='artworkPreview';button.type='button';button.disabled=true;
  button.setAttribute('aria-label','放大预览作品卡');button.setAttribute('aria-haspopup','dialog');
  button.innerHTML='<canvas width="320" height="400" aria-label="作品卡缩略预览"></canvas><span>预览 ↗</span>';
  section.append(button);
  const canvas=button.querySelector('canvas');
  const dialog=document.createElement('dialog');dialog.id='artworkPreviewDialog';dialog.className='artwork-preview-dialog';
  dialog.setAttribute('aria-labelledby','artworkPreviewTitle');
  dialog.innerHTML='<header><h2 id="artworkPreviewTitle">作品卡预览</h2><button type="button" aria-label="关闭作品卡预览" autofocus>×</button></header><div class="artwork-preview-paper"><canvas aria-label="完整作品卡"></canvas></div><footer><span id="artworkPreviewRatio"></span><button type="button">下载作品卡 ↓</button></footer>';
  document.body.append(dialog);
  let lastKey=null,candidate=null,changedAt=0,renderedAt=0,timer,resume;
  const copy=(target,source)=>{target.width=source.width;target.height=source.height;target.getContext('2d').drawImage(source,0,0);};
  function update(now,state){
    try{
      copy(canvas,render(320));
      button.disabled=false;button.setAttribute('aria-busy','false');
      button.setAttribute('aria-label','放大预览作品卡');
      button.dataset.revision=String((Number(button.dataset.revision)||0)+1);
      lastKey=state;renderedAt=now;
    }catch(error){
      button.disabled=true;button.setAttribute('aria-label','作品卡预览暂不可用');
      button.setAttribute('aria-busy','false');
      // Retry only after another input, rather than rendering a failing scene repeatedly.
      lastKey=state;
    }
  }
  function poll(){
    clearTimeout(timer);
    if(active()&&!dialog.open&&!document.hidden){
      const state=key(),now=performance.now();
      if(state===null){button.disabled=true;button.setAttribute('aria-busy','true');}
      else if(state!==lastKey){
        button.setAttribute('aria-busy','true');
        if(candidate!==state){candidate=state;changedAt=now;}
        // Dragging remains responsive; slow automatic rotation gets a periodic still.
        if(lastKey===null||now-changedAt>=180||now-renderedAt>=1400)update(now,state);
      }
    }
    timer=setTimeout(poll,200);
  }
  button.onclick=()=>{
    try{
      resume=pause?.();
      const card=render(720);copy(dialog.querySelector('canvas'),card);
      dialog.querySelector('#artworkPreviewRatio').textContent=card.height>card.width?'竖幅 · 4:5':'方形 · 1:1';
      dialog.showModal();
    }catch(error){resume?.();resume=null;button.disabled=true;lastKey=null;}
  };
  dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.querySelector('footer button').onclick=onDownload;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{resume?.();resume=null;button.focus({preventScroll:true});lastKey=null;});
  document.addEventListener('visibilitychange',poll);
  poll();
}
