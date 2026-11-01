// A light display row: existing saved thumbnails, no renderer, rack or position picker.
export function mountCollectionList({container,records,currentId,onOpen}){
 container.replaceChildren();
 for(const record of records){
  const button=document.createElement('button');button.className='collection-item';button.dataset.example=String(!!record.example);button.dataset.current=String(record.id===currentId);if(record.id===currentId)button.classList.add('entered');
  const image=new Image();if(record.thumbnail)image.src=record.thumbnail;image.alt=record.thumbnail?'':'打开作品查看';image.loading='lazy';
  const info=document.createElement('span');info.className='collection-info';const title=document.createElement('strong');title.textContent=record.name;const description=document.createElement('small');description.textContent=`${record.settings.object} · ${record.settings.glazeNames.join('、')} · ${record.settings.cooling}`;info.append(title,description);
  const badge=document.createElement('span');badge.className='example-badge';badge.textContent=record.example?'示例 · 可以打开观察':record.id===currentId?'已收藏 · 当前作品':'我的作品 · 打开看看';info.append(document.createElement('br'),badge);button.append(image,info);button.onclick=()=>onOpen(record);container.append(button);
 }
 return {dispose(){}};
}
