import * as THREE from 'three';

// Reproject one continuous photograph using the existing support's depth.
// A connected image mesh keeps table edges continuous during small camera moves.
export class PhotoBackdrop {
  constructor(world,geometry){
    this.world=world;
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.depthTarget=new THREE.WebGLRenderTarget(768,432,{depthBuffer:true});
    this.depthTarget.depthTexture=new THREE.DepthTexture(768,432,THREE.UnsignedIntType);
    this.smoothTarget=new THREE.WebGLRenderTarget(768,432,{type:THREE.HalfFloatType,depthBuffer:false});
    this.smoothScene=new THREE.Scene();
    this.smoothScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:{depth:{value:this.depthTarget.depthTexture}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D depth;varying vec2 vUv;
        void main(){float sum=0.0,weight=0.0;
          for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
            vec2 offset=vec2(float(x),float(y));float w=exp(-dot(offset,offset)*.5);
            float z=texture2D(depth,clamp(vUv+offset*vec2(4.0/768.0,4.0/432.0),vec2(.001),vec2(.999))).x;
            float d=10.0/(100.0-z*99.9);sum+=d*w;weight+=w;
          }gl_FragColor=vec4(sum/weight,0.0,0.0,1.0);}`
    })));
    this.screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.reference=new THREE.PerspectiveCamera(30,16/9,.1,100);
    const depthMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    this.depthScene=new THREE.Scene();this.depthScene.add(new THREE.Mesh(geometry,depthMaterial));
    this.plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),depthMaterial);this.depthScene.add(this.plane);
    this.uniforms={plate:{value:null},depth:{value:this.smoothTarget.texture},inverse:{value:new THREE.Matrix4()}};
    const grid=new THREE.PlaneGeometry(2,2,384,216),uv=grid.getAttribute('uv');
    // Overscan the outside edge so modest camera movement still fills the frame.
    for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)-.5)*1.4+.5,(uv.getY(i)-.5)*1.4+.5);
    this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`uniform sampler2D depth;uniform mat4 inverse;varying vec2 photoUV;
        void main(){photoUV=uv;float d=texture2D(depth,clamp(uv,vec2(.001),vec2(.999))).x;float z=100.0*(d-.1)/(d*99.9);
        vec4 p=inverse*vec4(uv*2.0-1.0,z*2.0-1.0,1.0);p/=p.w;
        gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform sampler2D plate;varying vec2 photoUV;
        void main(){gl_FragColor=vec4(texture2D(plate,clamp(photoUV,vec2(.001),vec2(.999))).rgb,1.0);
        #include <colorspace_fragment>}`});
    this.scene=new THREE.Scene();const mesh=new THREE.Mesh(grid,this.material);mesh.frustumCulled=false;this.scene.add(mesh);
  }
  configure(info,texture,focus){
    if(this.info===info&&this.texture===texture)return;
    this.info=info;this.texture=texture;this.needsDepth=true;
    const c=this.reference;c.position.fromArray(info.position);c.quaternion.fromArray(info.quaternion);
    c.fov=info.fov;c.aspect=info.width/info.height;c.updateProjectionMatrix();c.updateMatrixWorld();
    this.uniforms.plate.value=texture;
    this.uniforms.inverse.value.multiplyMatrices(c.matrixWorld,c.projectionMatrixInverse);
    const forward=c.getWorldDirection(new THREE.Vector3()),distance=c.position.distanceTo(focus)+4;
    this.plane.position.copy(c.position).addScaledVector(forward,distance);this.plane.quaternion.copy(c.quaternion);
    const height=2*distance*Math.tan(THREE.MathUtils.degToRad(c.fov)/2);this.plane.scale.set(height*c.aspect*2,height*2,1);
  }
  render(){
    const {renderer,camera}=this.world,size=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(this.target.width!==size.x||this.target.height!==size.y)this.target.setSize(size.x,size.y);
    const previous=renderer.getRenderTarget();
    try{
      if(this.needsDepth){renderer.setRenderTarget(this.depthTarget);renderer.render(this.depthScene,this.reference);renderer.setRenderTarget(this.smoothTarget);renderer.render(this.smoothScene,this.screenCamera);this.needsDepth=false;}
      renderer.setRenderTarget(this.target);renderer.render(this.scene,camera);
    }finally{renderer.setRenderTarget(previous);}
    return this.target.texture;
  }
}
