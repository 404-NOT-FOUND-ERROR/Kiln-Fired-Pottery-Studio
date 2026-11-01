"""Export calibrated clean photographic plates, shadow receiver and local HDR.
The gallery jar geometry, painting UV and ceramic detail are intentionally shared.
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'assets'/'art';OUT.mkdir(parents=True,exist_ok=True)
BAKES=ROOT/'web-renders';BAKES.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art-scene.blend'))
scene=bpy.context.scene
hero=next(o for o in scene.objects if o.name.startswith('HERO'))
def convert(v):return [float(v.x),float(v.z),float(-v.y)]
deps=bpy.context.evaluated_depsgraph_get();positions=[];normals=[];indices=[]
for obj in scene.objects:
    if not obj.name.startswith('RECEIVER'):continue
    ev=obj.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles();mesh.calc_normals()
    start=len(positions);matrix=obj.matrix_world;nm=matrix.to_3x3().inverted().transposed()
    for vertex in mesh.vertices:
        positions.append(convert(matrix@vertex.co));normals.append(convert((nm@vertex.normal).normalized()))
    indices.extend(start+i for triangle in mesh.loop_triangles for i in triangle.vertices)
    ev.to_mesh_clear()
values=[]
for p,n in zip(positions,normals):values.extend(p+n+[0,0])
payload=struct.pack('<%sf'%len(values),*values)+struct.pack('<%sI'%len(indices),*indices)
(OUT/'receiver.bin').write_bytes(payload)
receiver={'file':'receiver.bin','vertices':len(positions),'indices':len(indices),'stride':8,'bytes':len(payload)}
hero.hide_render=True
scene.cycles.samples=192;scene.cycles.use_denoising=True;scene.cycles.adaptive_threshold=.009
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    enabled=[d for d in prefs.devices if d.type=='OPTIX']
    for d in prefs.devices:d.use=d in enabled
    scene.cycles.device='GPU' if enabled else 'CPU'
except Exception:scene.cycles.device='CPU'
scene.render.resolution_x=2560;scene.render.resolution_y=1440;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
def camera_info(cam):
    conversion=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
    q=(conversion@cam.matrix_world.to_3x3()).to_quaternion()
    aspect=scene.render.resolution_x/scene.render.resolution_y
    return {'position':convert(cam.location),'quaternion':[q.x,q.y,q.z,q.w],
            'fov':math.degrees(2*math.atan(cam.data.sensor_width/(2*cam.data.lens*aspect))),
            'width':scene.render.resolution_x,'height':scene.render.resolution_y,
            'focusPoint':convert(cam.data.dof.focus_object.location),'fstop':cam.data.dof.aperture_fstop,'focalLength':cam.data.lens}
cameras={};anchors={}
for key in ['full','above','detail']:
    cam=next(o for o in scene.objects if o.name.startswith('CAMERA · '+key));scene.camera=cam;bpy.context.view_layer.update()
    point=cam.data.dof.focus_object.location if key=='detail' else hero.location+Vector((0,0,1.2))
    projection=world_to_camera_view(scene,cam,point);anchors[key]=[float(projection.x),float(1-projection.y)]
    scene.render.filepath=str(BAKES/('colorfield-'+key+'.png'));bpy.ops.render.render(write_still=True)
    cameras[key]=camera_info(cam)
probe=bpy.data.objects.new('WEB · color-field reflection probe',bpy.data.cameras.new('Local color-field radiance'));scene.collection.objects.link(probe)
probe.location=(-1,0,1.75);probe.rotation_euler=(math.pi/2,0,0);probe.data.type='PANO';probe.data.cycles.panorama_type='EQUIRECTANGULAR';scene.camera=probe
for obj in scene.objects:
    if obj.name.startswith('REFLECTOR'):obj.visible_camera=True
scene.render.resolution_x=2048;scene.render.resolution_y=1024;scene.cycles.samples=64;scene.use_nodes=False
scene.render.image_settings.file_format='HDR';scene.render.filepath=str(OUT/'colorfield-light.hdr');bpy.ops.render.render(write_still=True)
manifest={'version':2,'style':'art','plinth':receiver,'cameras':cameras,'plinthTop':float(scene['plinth_top']),
          'anchor':anchors['full'],'anchors':anchors,'heroPosition':convert(hero.location),'useDof':True,
          'glaze':{'specimen':'art-specimen.webp','normal':'art-normal.webp','roughness':'art-roughness.webp'},
          'source':'art-scene.blend','note':'The clean color-field plates have no ceramic or its shadow. All views share the original paintable gallery ceramic.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('ART_EXPORT_COMPLETE',flush=True)
