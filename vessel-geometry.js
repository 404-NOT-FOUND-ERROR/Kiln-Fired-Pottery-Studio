import * as THREE from 'three';
import {surfaceRows,deformationAt} from './vessel-profile.mjs';
export function shapedGeometry(profile,segments=96,resolution=72) {
  const rows=surfaceRows(profile,resolution),geometry=new THREE.LatheGeometry(rows.map(p=>new THREE.Vector2(p.r,p.y)),segments),uv=geometry.getAttribute('uv'),colors=new Float32Array(uv.count*3);
  for(let i=0;i<=segments;i++)for(let j=0;j<rows.length;j++){const n=i*rows.length+j,p=rows[j];uv.setXY(n,i/segments,p.v);const shade=p.inner?.58+.42*Math.pow(Math.min(1,p.y/(profile.height+.035)),.45):1;colors.set([shade,shade,shade],n*3);}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv2',uv.clone());geometry.userData.shaped={segments,resolution};updateShapedGeometry(geometry,profile);return geometry;
}
export function updateShapedGeometry(geometry,profile,trimFraction=null){
  const info=geometry.userData.shaped;if(!info)return false;
  const rows=surfaceRows(profile,info.resolution),positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  const cutRows=trimFraction===null?null:surfaceRows({...profile,trimmed:true},info.resolution);
  for(let i=0;i<=info.segments;i++){
    const phi=i/info.segments*Math.PI*2,s=Math.sin(phi),c=Math.cos(phi);
    for(let j=0;j<rows.length;j++){
      let p=rows[j];
      // Lift the recessed centre as one surface. Sweeping its radial fan made a
      // triangular peak between the already-cut and not-yet-cut halves.
      if(cutRows&&j<7){const turn=(i===info.segments?0:i)/info.segments,amount=j<3?THREE.MathUtils.smoothstep(trimFraction,0,1):trimFraction>=1?1:THREE.MathUtils.smoothstep(trimFraction-turn,0,.045);p={...p,r:THREE.MathUtils.lerp(p.r,cutRows[j].r,amount),y:THREE.MathUtils.lerp(p.y,cutRows[j].y,amount)};}
      const d=p.r>.05?deformationAt(profile,(p.y-.035)/profile.height,phi):{radial:0,lift:0},n=i*rows.length+j,r=p.r+d.radial;
      positions.setXYZ(n,r*s,p.y+d.lift,r*c);
    }
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
  // Every longitude meets at the same axis vertex; share its normal too.
  // Separate axis heights during a partial cut create a torn radial fan.
  for(const j of [0,rows.length-1])for(let i=0;i<=info.segments;i++)normals.setXYZ(i*rows.length+j,0,j===0?-1:1,0);
  // The UV seam has duplicate vertices, but it must share the same lighting normal.
  for(let j=0;j<rows.length;j++){const other=info.segments*rows.length+j,x=normals.getX(j)+normals.getX(other),y=normals.getY(j)+normals.getY(other),z=normals.getZ(j)+normals.getZ(other),length=Math.hypot(x,y,z)||1;normals.setXYZ(j,x/length,y/length,z/length);normals.setXYZ(other,x/length,y/length,z/length);}
  normals.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();return true;
}

export function legacyVesselProfile(form){
  if(form==='bowl')return[[0,0],[.43,0],[.5,.12],[.68,.4],[.93,.82],[1.04,1.0],[.96,1.04],[.87,.91],[.68,.52],[.49,.2],[.3,.12],[0,.1]];
  if(form==='jar')return[[0,0],[.62,0],[.7,.1],[.72,.25],[.68,.38],[.82,.7],[.98,1.16],[1.02,1.48],[.94,1.78],[.72,2.08],[.54,2.18],[.48,2.3],[.55,2.38],[.54,2.5],[.42,2.56],[.33,2.52],[.33,2.34],[.43,2.29],[.34,2.17],[.31,2.0],[.45,1.7],[.58,1.35],[.58,.95],[.46,.55],[.26,.32],[0,.25]];
  return[[0,0],[.58,0],[.66,.1],[.66,.23],[.49,.3],[.4,.72],[.5,1.2],[.7,1.72],[.82,2.15],[.75,2.53],[.53,2.78],[.46,3.02],[.5,3.18],[.62,3.28],[.6,3.43],[.4,3.5],[.31,3.47],[.31,3.28],[.43,3.22],[.36,3.08],[.34,2.82],[.42,2.48],[.55,2.1],[.57,1.72],[.49,1.25],[.37,.8],[.27,.42],[0,.28]]
}
