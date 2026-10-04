import * as THREE from 'three';

// The plate already has Cycles lens blur. This pass adds depth-dependent blur
// to the actual painted ceramic, retaining the plate's original colour.
export class LivingOptics {
  constructor(world) {
    this.world=world;
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.target.samples=world.renderer.capabilities.isWebGL2?4:0;
    this.uniforms={
      colour:{value:this.target.texture},depth:{value:this.target.depthTexture},plate:{value:null},
      plateMatrix:{value:new THREE.Matrix3()},pixel:{value:new THREE.Vector2()},
      near:{value:.1},far:{value:100},focus:{value:10},lens:{value:66},fstop:{value:.72},
      sensorWidth:{value:36},cropWidth:{value:1},strength:{value:1}
    };
    this.material=new THREE.ShaderMaterial({
      uniforms:this.uniforms,depthTest:false,depthWrite:false,
      vertexShader:`varying vec2 vUv;
        void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:`
        uniform sampler2D colour,depth,plate;
        uniform mat3 plateMatrix;
        uniform vec2 pixel;
        uniform float near,far,focus,lens,fstop,sensorWidth,cropWidth,strength;
        varying vec2 vUv;
        float distanceAt(vec2 uv){float z=texture2D(depth,uv).x;return near*far/(far-z*(far-near));}
        void main(){
          vec4 centre=texture2D(colour,vUv), result=centre;
          // Only the opaque ceramic needs a second lens pass. Baked furniture
          // and the translucent contact shadow retain the photographic blur.
          if(centre.a>.98){
            float d=distanceAt(vUv),f=lens*.001;
            float coc=abs(d-focus)*f*f/(fstop*d*max(focus-f,.01));
            vec2 radius=vec2(coc/(sensorWidth*.001*cropWidth))*vec2(1.0,pixel.y/pixel.x)*strength;
            radius=min(radius,pixel*9.0);
            vec4 sum=centre;float weight=1.0;
            for(int i=0;i<24;i++){
              float a=float(i)*2.39996323;
              float r=sqrt((float(i)+.5)/24.0);
              vec2 uv=vUv+vec2(cos(a),sin(a))*radius*r;
              vec4 sampleColour=texture2D(colour,uv);
              float w=smoothstep(.85,.99,sampleColour.a);
              sum+=sampleColour*w;weight+=w;
            }
            result=sum/weight;
          }
          float alpha=result.a;
          vec3 surface=result.rgb/max(alpha,.0001);
          #ifdef TONE_MAPPING
            surface=toneMapping(surface);
          #endif
          vec3 room=texture2D(plate,(plateMatrix*vec3(vUv,1.0)).xy).rgb;
          gl_FragColor=vec4(mix(room,surface,alpha),1.0);
          #include <colorspace_fragment>
        }`
    });
    this.scene=new THREE.Scene();this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  }
  render(info,crop) {
    const {renderer,scene,camera,mesh}=this.world;
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(this.target.width!==size.x||this.target.height!==size.y)this.target.setSize(size.x,size.y);
    const u=this.uniforms;
    u.pixel.value.set(1/size.x,1/size.y);u.near.value=camera.near;u.far.value=camera.far;
    u.plate.value=scene.background;u.plateMatrix.value.copy(scene.background.matrix);
    u.lens.value=info.focalLength;u.fstop.value=info.fstop;u.cropWidth.value=crop.w/info.width;
    // Focus on the front shoulder of each form, including restored rotations.
    const bounds=mesh.geometry.boundingBox,dimensions=bounds.getSize(new THREE.Vector3());
    const front=camera.position.clone().sub(mesh.position);front.y=0;front.normalize();
    const point=mesh.position.clone().addScaledVector(front,dimensions.x*mesh.scale.x*.42);
    point.y+=bounds.min.y*mesh.scale.y+dimensions.y*mesh.scale.y*.66;
    const axis=camera.getWorldDirection(new THREE.Vector3());
    u.focus.value=point.sub(camera.position).dot(axis);
    const background=scene.background,target=renderer.getRenderTarget();
    const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    try {
      scene.background=null;renderer.setClearColor(0,0);renderer.setRenderTarget(this.target);
      renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(target);renderer.render(this.scene,this.camera);
    } finally {scene.background=background;renderer.setRenderTarget(target);renderer.setClearColor(clear,alpha);}
  }
}
