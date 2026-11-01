// Apply the platform's minimum type size to visible text without changing larger
// editorial headings. Re-evaluate after the existing responsive workbench moves.
function mountPlatformType(){
 const original=new Map(),pending=new Set();let frame=0,full=true;
 function update(){
  frame=0;
  for(const el of document.querySelectorAll('.model-btn small')){
   const parts=el.textContent.split(' · ');
   if(parts.length>1)el.textContent=parts.at(-1);
  }
  const candidates=full?[...document.body.querySelectorAll('*')]:[...pending].filter(el=>el.isConnected);
  full=false;pending.clear();
  for(const el of candidates){
   const style=original.get(el);if(!style)continue;
   if(style.value)el.style.setProperty('font-size',style.value,style.priority);else el.style.removeProperty('font-size');
   original.delete(el);
  }
  for(const el of original.keys())if(!el.isConnected)original.delete(el);
  const changes=[];
  for(const el of candidates){
   if(/^(SCRIPT|STYLE|CANVAS|SVG|PATH|LINE|CIRCLE|STOP)$/.test(el.tagName)||!el.getClientRects().length)continue;
   const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join('');
   if(!text)continue;
   const css=getComputedStyle(el),minimum=text.replace(/\s/g,'').length>=8?14:12;
   // Zero-sized palette labels and clipped accessible labels are intentional.
   if(parseFloat(css.fontSize)===0||css.clipPath==='inset(50%)'||el.closest('[aria-hidden="true"]'))continue;
   if(parseFloat(css.fontSize)<minimum)changes.push([el,minimum]);
  }
  for(const [el,size] of changes){
   original.set(el,{value:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size')});
   el.style.setProperty('font-size',size+'px','important');
  }
 }
 function schedule(all=false){full=full||all;if(!frame)frame=requestAnimationFrame(update);}
 const observer=new MutationObserver(records=>{
  for(const record of records){
   const root=record.target.nodeType===Node.ELEMENT_NODE?record.target:record.target.parentElement;
   if(!root)continue;pending.add(root);
   for(const node of record.addedNodes||[])if(node.nodeType===Node.ELEMENT_NODE){pending.add(node);for(const el of node.querySelectorAll('*'))pending.add(el);}
  }
  schedule();
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 const phases=new MutationObserver(()=>schedule(true));
 phases.observe(document.body,{attributes:true,attributeFilter:['class','data-studio-step','data-making-phase','data-panel']});
 window.addEventListener('resize',()=>schedule(true));schedule(true);
}
mountPlatformType();
