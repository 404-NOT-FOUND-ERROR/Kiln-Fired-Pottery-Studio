"""Bake portable PBR textures and calibrated photographic plates for Three.js.
Run with Blender 3.1; does not modify the source .blend.
"""
import bpy, math, json, struct, ast, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'museum';OUT.mkdir(parents=True,exist_ok=True)
BAKES=ROOT/'web-bakes';BAKES.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'museum-scene.blend'))
scene=bpy.context.scene
hero=next(o for o in scene.objects if o.name.startswith('HERO'))
plinth=next(o for o in scene.objects if o.name.startswith('PLINTH'))
scene.cycles.samples=16
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU'
except:scene.cycles.device='CPU'

# Arc-length UV separates inner and outer walls, and matches the painting tools.
mesh=hero.data;segments=192;ring_count=len(mesh.vertices)//segments
rings=[]
for j in range(ring_count):
    vv=[v.co for v in mesh.vertices[j*segments:(j+1)*segments]]
    rings.append(Vector((sum(math.hypot(v.x,v.y) for v in vv)/segments,sum(v.z for v in vv)/segments)))
lengths=[0.0]
for j in range(1,ring_count):lengths.append(lengths[-1]+(rings[j]-rings[j-1]).length)
lengths=[v/lengths[-1] for v in lengths]
uv=mesh.uv_layers['GlazeUV']
for poly in mesh.polygons:
    for loop in poly.loop_indices:
        vi=mesh.loops[loop].vertex_index;j,i=divmod(vi,segments);u=i/segments
        if poly.index%segments==segments-1 and i==0:u=1
        uv.data[loop].uv=(u,lengths[j])
mesh.update()
mesh.calc_normals()

def convert(v):return [float(v.x),float(v.z),float(-v.y)]
def write_geometry(name,positions,normals,uvs,indices):
    # Interleaved float32 attributes followed by uint32 triangle indices.
    values=[]
    for p,n,t in zip(positions,normals,uvs):values.extend(p+n+t)
    payload=struct.pack('<%sf'%len(values),*values)+struct.pack('<%sI'%len(indices),*indices)
    (OUT/(name+'.bin')).write_bytes(payload)
    return {'file':name+'.bin','vertices':len(positions),'indices':len(indices),'stride':8,'bytes':len(payload)}

pos=[];norm=[];uvs=[];ix=[];nseg=96
for j in range(ring_count):
    for i in range(nseg+1):
        vi=j*segments+(i*2)%segments;v=mesh.vertices[vi]
        pos.append(convert(v.co));norm.append(convert(v.normal));uvs.append([i/nseg,lengths[j]])
for j in range(ring_count-1):
    for i in range(nseg):
        a=j*(nseg+1)+i;b=a+1;c=b+nseg+1;d=a+nseg+1;ix.extend([a,b,c,a,c,d])
jar_data=write_geometry('jar',pos,norm,uvs,ix)

bpy.context.view_layer.objects.active=plinth
decimate=plinth.modifiers.new('Web shadow receiver reduction','DECIMATE');decimate.ratio=.35
deps=bpy.context.evaluated_depsgraph_get();ev=plinth.evaluated_get(deps);pm=ev.to_mesh();pm.calc_loop_triangles();pm.calc_normals()
pos=[convert(plinth.matrix_world@v.co) for v in pm.vertices]
norm=[convert(plinth.matrix_world.to_3x3()@v.normal) for v in pm.vertices]
plinth_data=write_geometry('plinth',pos,norm,[[0,0] for v in pm.vertices],[i for t in pm.loop_triangles for i in t.vertices])
ev.to_mesh_clear()

# Bake the unchanged Cycles glaze network; procedural crack detail stays independent
# from a user's colour layer in the browser.
mat=hero.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links
bs=nodes.get('Principled BSDF');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
original_surface=output.inputs['Surface'].links[0].from_socket
emit=nodes.new('ShaderNodeEmission');emit.inputs['Strength'].default_value=1
target=nodes.new('ShaderNodeTexImage');target.name='WEB BAKE TARGET'
bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=12
def bake(name,socket=None,kind='EMIT',color=False):
    image=bpy.data.images.new(name,width=1024,height=1024,alpha=False)
    image.colorspace_settings.name='sRGB' if color else 'Non-Color'
    target.image=image
    for n in nodes:n.select=False
    target.select=True;nodes.active=target
    if kind=='EMIT':
        links.new(socket,emit.inputs['Color']);links.new(emit.outputs[0],output.inputs['Surface'])
    else:links.new(original_surface,output.inputs['Surface'])
    bpy.ops.object.bake(type=kind,use_clear=True,margin=12)
    image.filepath_raw=str(BAKES/(name+'.png'));image.file_format='PNG';image.save()
    print('BAKED',name,flush=True)
base_socket=bs.inputs['Base Color'].links[0].from_socket
rough_socket=bs.inputs['Roughness'].links[0].from_socket
bake('specimen-albedo',base_socket,color=True)
bake('specimen-paint',nodes['Celadon and plum'].outputs[0],color=True)
bake('glaze-roughness',rough_socket)
bake('glaze-normal',kind='NORMAL')
detail=nodes.new('ShaderNodeMixRGB');detail.inputs[1].default_value=(1,1,1,1);detail.inputs[2].default_value=(.20,.16,.12,1);links.new(nodes['Fine stained crack lines'].outputs['Color'],detail.inputs[0])
iron=nodes.new('ShaderNodeMixRGB');iron.inputs[2].default_value=(.11,.09,.07,1);links.new(detail.outputs[0],iron.inputs[1]);links.new(nodes['Sparse embedded flecks'].outputs['Color'],iron.inputs[0])
bake('glaze-detail',iron.outputs[0],color=True)
links.new(original_surface,output.inputs['Surface'])
if '--bake-only' in sys.argv:sys.exit(0)

hero.hide_render=True;scene.cycles.samples=96
main=scene.camera
def camera_info(cam):
    c=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
    q=(c@cam.matrix_world.to_3x3()).to_quaternion()
    aspect=scene.render.resolution_x/scene.render.resolution_y
    vfov=2*math.atan(cam.data.sensor_width/(2*cam.data.lens*aspect))
    return {'position':convert(cam.location),'quaternion':[q.x,q.y,q.z,q.w],'fov':math.degrees(vfov),'width':scene.render.resolution_x,'height':scene.render.resolution_y}
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.filepath=str(BAKES/'gallery-full.png');bpy.ops.render.render(write_still=True)
cameras={'full':camera_info(main)}
above=main.copy();above.data=main.data.copy();scene.collection.objects.link(above);above.name='WEB · above camera';above.location=(2.8,-12.6,9.1);above.rotation_euler=(Vector((.05,.05,2.4))-above.location).to_track_quat('-Z','Y').to_euler();above.data.dof.use_dof=False
scene.camera=above;bpy.context.view_layer.update();scene.render.filepath=str(BAKES/'gallery-above.png');bpy.ops.render.render(write_still=True);cameras['above']=camera_info(above)

# A linear radiance panorama sampled at the ceramic, not an unrelated studio HDRI.
pano=bpy.data.objects.new('WEB · local reflection probe',bpy.data.cameras.new('Local reflection probe'));scene.collection.objects.link(pano);pano.location=(-1,0,2.25);pano.rotation_euler=(math.pi/2,0,0);pano.data.type='PANO';pano.data.cycles.panorama_type='EQUIRECTANGULAR';scene.camera=pano
scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.cycles.samples=48;scene.use_nodes=False
scene.render.image_settings.file_format='HDR';scene.render.filepath=str(OUT/'gallery-light.hdr');bpy.ops.render.render(write_still=True)
profile=None
for n in ast.parse((ROOT/'build_museum.py').read_text(encoding='utf-8')).body:
    if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='profile' for t in n.targets):profile=ast.literal_eval(n.value)
manifest={'version':1,'jar':jar_data,'plinth':plinth_data,'profile':profile,'cameras':cameras,'heroPosition':[-1,1.07,0],'plinthTop':1.1,'source':'museum-scene.blend','note':'Photographic plates contain no hero ceramic or its shadow. UV is arc length across inner and outer walls.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('EXPORT_COMPLETE',str(OUT),flush=True)
