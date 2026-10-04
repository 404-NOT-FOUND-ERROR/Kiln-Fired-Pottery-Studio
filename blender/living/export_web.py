"""Export clean Cycles plates, local radiance and the matching shadow receiver.
Ceramic geometry and PBR detail remain shared with the museum.
"""
import bpy, math, json, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'living';OUT.mkdir(parents=True,exist_ok=True)
BAKES=ROOT/'web-renders';BAKES.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'living-scene.blend'))
scene=bpy.context.scene
hero=next(o for o in scene.objects if o.name.startswith('HERO'))
def convert(v):return [float(v.x),float(v.z),float(-v.y)]
# Cloth and table are depth/occlusion surfaces in the browser, not duplicate colours.
def export_geometry(prefix,filename):
    deps=bpy.context.evaluated_depsgraph_get();pos=[];norm=[];indices=[]
    for obj in list(scene.objects):
        if not obj.name.startswith(prefix):continue
        if 'woven flax' in obj.name:
            dec=obj.modifiers.new('Portable shadow receiver','DECIMATE');dec.ratio=.32
        ev=obj.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles();mesh.calc_normals()
        offset=len(pos);matrix=obj.matrix_world;normalmatrix=matrix.to_3x3().inverted().transposed()
        for v in mesh.vertices:
            pos.append(convert(matrix@v.co));norm.append(convert((normalmatrix@v.normal).normalized()))
        indices.extend(offset+i for t in mesh.loop_triangles for i in t.vertices);ev.to_mesh_clear()
    values=[]
    for p,n in zip(pos,norm):values.extend(p+n+[0,0])
    payload=struct.pack('<%sf'%len(values),*values)+struct.pack('<%sI'%len(indices),*indices)
    (OUT/filename).write_bytes(payload)
    return {'file':filename,'vertices':len(pos),'indices':len(indices),'stride':8,'bytes':len(payload)}
receiver=export_geometry('RECEIVER','receiver.bin')
foliage=export_geometry('SUNSCREEN','foliage-shadow.bin')
hero.hide_render=True
scene.cycles.samples=112
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU'
except:scene.cycles.device='CPU'
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
def camera_info(cam):
    conversion=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
    q=(conversion@cam.matrix_world.to_3x3()).to_quaternion()
    aspect=scene.render.resolution_x/scene.render.resolution_y
    fov=2*math.atan(cam.data.sensor_width/(2*cam.data.lens*aspect))
    return {'position':convert(cam.location),'quaternion':[q.x,q.y,q.z,q.w],'fov':math.degrees(fov),'width':scene.render.resolution_x,'height':scene.render.resolution_y,
            'focusPoint':convert(cam.data.dof.focus_object.location),'fstop':cam.data.dof.aperture_fstop,'focalLength':cam.data.lens}
cameras={}
for key,prefix in [('full','CAMERA · full'),('above','CAMERA · above'),('detail','CAMERA · detail')]:
    cam=next(o for o in scene.objects if o.name.startswith(prefix));scene.camera=cam;bpy.context.view_layer.update()
    scene.render.filepath=str(BAKES/('window-'+key+'.png'));bpy.ops.render.render(write_still=True)
    cameras[key]=camera_info(cam)
pano=bpy.data.objects.new('WEB · window reflection probe',bpy.data.cameras.new('Local radiance'));scene.collection.objects.link(pano)
pano.location=(-1,0,2.3);pano.rotation_euler=(math.pi/2,0,0);pano.data.type='PANO';pano.data.cycles.panorama_type='EQUIRECTANGULAR';scene.camera=pano
scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.cycles.samples=48;scene.use_nodes=False
scene.render.image_settings.file_format='HDR';scene.render.filepath=str(OUT/'window-light.hdr');bpy.ops.render.render(write_still=True)
manifest={'version':2,'style':'living','plinth':receiver,'foliage':foliage,'cameras':cameras,'plinthTop':1.055,'anchor':[.385,.49],'anchors':{'detail':[.35,.49]},'heroPosition':[-1,1.025,0],
 'source':'living-scene.blend','note':'Clean photographic plates have no hero ceramic or its shadow; receiver matches the woven cloth and tabletop.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('LIVING_EXPORT_COMPLETE',flush=True)
