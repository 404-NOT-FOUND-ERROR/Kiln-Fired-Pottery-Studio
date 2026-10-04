import * as THREE from 'three';
import { RGBELoader } from './vendor/RGBELoader.js';

const base = new URL('./assets/museum/', import.meta.url);
async function checked(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Museum asset ${response.status}: ${url}`);
  return response;
}
async function geometry(info, directory=base) {
  const data = await (await checked(new URL(info.file, directory))).arrayBuffer();
  if (data.byteLength !== info.bytes) throw new Error(`Incomplete mesh: ${info.file}`);
  const g = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(new Float32Array(data, 0, info.vertices * 8), 8);
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  g.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 6));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(data, info.vertices * 32, info.indices), 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

export async function loadMuseumAssets() {
  const manifest = await (await checked(new URL('manifest.json', base))).json();
  const loader = new THREE.TextureLoader();
  async function texture(name, color = false) {
    const tex = await loader.loadAsync(new URL(name, base).href);
    tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  const [jar, plinth, normal, roughness, detail, specimen, specimenPaint, full, above, hdr] = await Promise.all([
    geometry(manifest.jar), geometry(manifest.plinth),
    texture('glaze-normal.webp'), texture('glaze-roughness.webp'), texture('glaze-detail.webp', true),
    texture('specimen-albedo.webp', true), texture('specimen-paint.webp', true), texture('gallery-full.webp', true), texture('gallery-above.webp', true),
    new RGBELoader().loadAsync(new URL('gallery-light.hdr', base).href)
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const jarSurface=[];const position=jar.getAttribute('position'),uv=jar.getAttribute('uv');
  for(let i=0;i<position.count;i++)if(uv.getX(i)===0)jarSurface.push({point:new THREE.Vector2(Math.hypot(position.getX(i),position.getZ(i)),position.getY(i)),v:uv.getY(i)});
  return { manifest, jar, jarSurface, plinth, normal, roughness, detail, specimen, specimenPaint, plates: { full, above }, hdr };
}

export async function loadLivingAssets() {
  const directory=new URL('./assets/living/',import.meta.url);
  const manifest=await(await checked(new URL('manifest.json',directory))).json();
  const loader=new THREE.TextureLoader();
  async function plate(name){const texture=await loader.loadAsync(new URL(name,directory).href);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
  const [plinth,full,above,detail,foliage,hdr]=await Promise.all([
    geometry(manifest.plinth,directory),plate('window-full.webp'),plate('window-above.webp'),plate('window-detail.webp'),geometry(manifest.foliage,directory),new RGBELoader().loadAsync(new URL('window-light.hdr',directory).href)
  ]);
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  return {manifest,plinth,foliage,plates:{full,above,detail},hdr};
}

export function applyGlazeSurface(material, assets, { before = false, specimen = false, cooling = '缓冷' } = {}) {
  if (!assets) return;
  material.normalMap = before ? null : assets.normal;
  material.normalScale.set(.55, .55);
  material.roughnessMap = before ? null : assets.roughness;
  material.roughness = before ? .64 : cooling === '快冷' ? .82 : 1.2;
  material.clearcoat = before ? .12 : .8;
  material.clearcoatRoughness = before ? .3 : .075;
  material.ior = 1.47; material.specularIntensity = .8; material.sheen = 0;
  material.userData.museumDetailStrength = before || specimen ? 0 : .68;
  if (!material.userData.museumShaderInstalled) {
    material.userData.museumShaderInstalled = true;
    material.onBeforeCompile = shader => {
      shader.uniforms.glazeDetailTexture = { value: assets.detail };
      shader.uniforms.glazeDetailStrength = { value: material.userData.museumDetailStrength };
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D glazeDetailTexture;\nuniform float glazeDetailStrength;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), texture2D(glazeDetailTexture, vMapUv).rgb, glazeDetailStrength);');
      material.userData.museumShader = shader;
    };
    material.customProgramCacheKey = () => 'museum-glaze-detail-v1';
  }
  if (material.userData.museumShader) material.userData.museumShader.uniforms.glazeDetailStrength.value = material.userData.museumDetailStrength;
  material.needsUpdate = true;
}
