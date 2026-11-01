// Keep the live vessel, material samples and collection cutouts on one glass model.
// Effect colour is carried by the firing maps, rather than by embossed geometry.
export const glazeSurfaces={
 gloss:{roughness:.16,clearcoat:.88,clearcoatRoughness:.075,bumpScale:.004},
 satin:{roughness:.22,clearcoat:.76,clearcoatRoughness:.11,bumpScale:.0024},
 speckle:{roughness:.17,clearcoat:.88,clearcoatRoughness:.08,bumpScale:.0015},
 crackle:{roughness:.15,clearcoat:.9,clearcoatRoughness:.065,bumpScale:.0008}
};
export function applyFiredGlaze(material,finish='gloss'){
 const surface=glazeSurfaces[finish]||glazeSurfaces.gloss;
 Object.assign(material,{roughness:material.roughnessMap?1:surface.roughness,clearcoat:surface.clearcoat,clearcoatRoughness:surface.clearcoatRoughness,bumpScale:surface.bumpScale,metalness:0,ior:1.5,specularIntensity:1,envMapIntensity:1,sheen:0});
 material.specularColor?.set('#ffffff');material.needsUpdate=true;
}
