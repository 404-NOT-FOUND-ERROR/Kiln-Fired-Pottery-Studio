async function prepareBlank(page){
 if(await page.locator('#beginSculpt').isVisible())await page.click('#beginSculpt');
 await page.click('#toPaint');await page.locator('#screen2.active').waitFor({timeout:30000});
}
async function waitForFiring(page){await page.locator('#screen3.active').waitFor({timeout:30000});await page.locator('#firingOverlay').waitFor({state:'hidden'});}
async function completeFiring(page,mode='photo'){
 await waitForFiring(page);await page.click(`[data-panel="${mode}"]`);
 if(mode==='photo'){const scene=new URL(page.url()).searchParams.get('scene')||'museum';await page.click(`[data-scene="${scene}"]`);await page.waitForFunction(key=>document.querySelector('#resultView').dataset.scene===key,scene,{timeout:45000});}
}
async function putOnShelf(page){await page.click('#save');await page.waitForFunction(()=>document.querySelector('#save').textContent.includes('已收藏'));}
module.exports={prepareBlank,putOnShelf,completeFiring,waitForFiring};
