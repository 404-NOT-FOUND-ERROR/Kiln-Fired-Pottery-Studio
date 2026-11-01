import {fireLayers} from './glaze-firing.mjs';
self.onmessage=e=>{
  try{
    const input=e.data,current=fireLayers(input),alternate=fireLayers({...input,cooling:input.cooling==='缓冷'?'快冷':'缓冷'});
    self.postMessage({current,alternate},[...Object.values(current),...Object.values(alternate)].map(a=>a.buffer));
  }catch(error){self.postMessage({error:error.message});}
};
