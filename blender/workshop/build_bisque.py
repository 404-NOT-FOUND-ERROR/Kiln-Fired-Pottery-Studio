"""Bake an unglazed ceramic surface on the same arc-length UV as the glaze tool.
The workshop plate stays photographic; geometry, light and painted layers stay live.
Blender 3.1: blender -b --factory-startup --python-exit-code 1 --python build_bisque.py
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'assets'/'workshop'
OUT.mkdir(parents=True,exist_ok=True)
BAKES=ROOT/'bakes';BAKES.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'

manifest=json.loads((PROJECT/'assets'/'museum'/'manifest.json').read_text(encoding='utf-8'))
info=manifest['jar'];payload=(PROJECT/'assets'/'museum'/info['file']).read_bytes()
rows=[struct.unpack_from('<8f',payload,i*32) for i in range(info['vertices'])]
indices=struct.unpack_from('<%sI'%info['indices'],payload,info['vertices']*32)
vertices=[]
for x,y,z,nx,ny,nz,u,v in rows:
    r=math.hypot(x,z);theta=math.atan2(-z,x)
    # Modest throwing traces; these are shallow tool marks, not decorative rings.
    inward=x*nx+z*nz<-.03
    mask=min(1,max(0,(y-.10)*8))*min(1,max(0,(2.29-y)*12))
    wave=.0017*math.sin(y*108+math.sin(theta*2)*.18)+.0008*math.sin(y*57+.9)
    wobble=.0014*math.sin(theta*3+y*2.2)
    rr=max(.002,r+(wave*mask+wobble)*(1 if not inward else .55))
    vertices.append((rr*math.cos(theta),rr*math.sin(theta),y))
mesh=bpy.data.meshes.new('Thrown bisque · shared glaze UV')
mesh.from_pydata(vertices,[],[indices[i:i+3] for i in range(0,len(indices),3)])
mesh.update();uv=mesh.uv_layers.new(name='GlazeUV')
for face in mesh.polygons:
    face.use_smooth=True
    for loop in face.loop_indices:
        index=mesh.loops[loop].vertex_index
        uv.data[loop].uv=(rows[index][6],rows[index][7])
hero=bpy.data.objects.new('BISQUE · unglazed porcelain blank',mesh);scene.collection.objects.link(hero)

mat=bpy.data.materials.new('BISQUE · dry mineral body / wheel traces / open pores')
mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
bs=nodes.get('Principled BSDF');output=nodes.get('Material Output')
bs.inputs['Roughness'].default_value=.91;bs.inputs['Specular'].default_value=.16
coord=nodes.new('ShaderNodeTexCoord')
def noise(name,scale,detail):
    n=nodes.new('ShaderNodeTexNoise');n.name=name;n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail
    links.new(coord.outputs['Object'],n.inputs['Vector']);return n
cloud=noise('Very subtle mineral variation',4.2,3)
clay=nodes.new('ShaderNodeValToRGB');clay.name='Warm chalk porcelain · not glazed white'
clay.color_ramp.elements[0].position=.18;clay.color_ramp.elements[0].color=(.38,.335,.28,1)
clay.color_ramp.elements[1].position=.82;clay.color_ramp.elements[1].color=(.54,.49,.41,1)
links.new(cloud.outputs['Fac'],clay.inputs['Fac'])
fine=noise('Microscopic mineral pores',210,2)
flecks=nodes.new('ShaderNodeValToRGB');flecks.name='Sparse natural pinholes'
flecks.color_ramp.elements[0].position=.72;flecks.color_ramp.elements[0].color=(1,1,1,1)
flecks.color_ramp.elements[1].position=.79;flecks.color_ramp.elements[1].color=(.31,.28,.23,1)
links.new(fine.outputs['Fac'],flecks.inputs['Fac'])
albedo=nodes.new('ShaderNodeMixRGB');albedo.blend_type='MULTIPLY';albedo.inputs[0].default_value=.65
links.new(clay.outputs['Color'],albedo.inputs[1]);links.new(flecks.outputs['Color'],albedo.inputs[2]);links.new(albedo.outputs[0],bs.inputs['Base Color'])
micro=noise('Fine dry body grain',520,2)
bump=nodes.new('ShaderNodeBump');bump.name='Dry ceramic grain';bump.inputs['Strength'].default_value=.25;bump.inputs['Distance'].default_value=.006
links.new(micro.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal'])
rough=nodes.new('ShaderNodeMapRange');rough.inputs['From Min'].default_value=0;rough.inputs['From Max'].default_value=1;rough.inputs['To Min'].default_value=.82;rough.inputs['To Max'].default_value=.98
links.new(fine.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs[0],bs.inputs['Roughness'])
hero.data.materials.append(mat)
bpy.context.view_layer.objects.active=hero;hero.select_set(True)
target=nodes.new('ShaderNodeTexImage');target.name='Portable PBR bake'
emit=nodes.new('ShaderNodeEmission')
def bake(name,kind='EMIT',socket=None,color=False,size=2048):
    image=bpy.data.images.new(name,width=size,height=size,alpha=False)
    image.colorspace_settings.name='sRGB' if color else 'Non-Color'
    target.image=image
    for node in nodes:node.select=False
    target.select=True;nodes.active=target
    if kind=='EMIT':links.new(socket,emit.inputs['Color']);links.new(emit.outputs[0],output.inputs['Surface'])
    else:links.new(bs.outputs[0],output.inputs['Surface'])
    bpy.ops.object.bake(type=kind,use_clear=True,margin=16)
    image.filepath_raw=str(BAKES/(name+'.png'));image.file_format='PNG';image.save()
    print('BAKED',name,flush=True)
bake('bisque-albedo',socket=albedo.outputs[0],color=True)
bake('bisque-normal',kind='NORMAL')
bake('bisque-roughness',socket=rough.outputs[0],size=1024)
bake('bisque-ao',kind='AO',size=1024)
links.new(bs.outputs[0],output.inputs['Surface'])

mesh.calc_normals();values=[]
for i,vertex in enumerate(mesh.vertices):
    p=vertex.co;n=vertex.normal
    values.extend((p.x,p.z,-p.y,n.x,n.z,-n.y,rows[i][6],rows[i][7]))
(OUT/'bisque-jar.bin').write_bytes(struct.pack('<%sf'%len(values),*values)+struct.pack('<%sI'%len(indices),*indices))

# A simple diffuse light proxy for the photo's left window and warm workshop.
# It is intentionally approximate; the plate is not a measured HDR panorama.
def material(name,color,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=.95
    if emission:b.inputs['Emission'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
def plane(name,location,scale,rotation,mat):
    bpy.ops.mesh.primitive_plane_add(size=2,location=location,rotation=rotation)
    o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return o
wall=material('Proxy · plaster',(.55,.51,.44))
wood=material('Proxy · old timber',(.23,.12,.055))
window=material('Proxy · diffuse daylight',(.81,.88,1),2.5)
plane('Proxy · bench', (0,0,0),(6,6,1),(0,0,0),wood)
plane('Proxy · rear plaster',(0,4,3),(6,3,1),(math.pi/2,0,0),wall)
plane('Proxy · right plaster',(4,0,3),(6,3,1),(0,math.pi/2,0),wall)
plane('Proxy · upper left window',(-3.5,1.8,3.7),(1.7,2.0,1),(0,math.pi/2,0),window)
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.46,.5,.54,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.25
hero.hide_render=True
camera=bpy.data.objects.new('Workshop · diffuse reflection probe',bpy.data.cameras.new('Diffuse reflection probe'))
scene.collection.objects.link(camera);camera.location=(0,0,1.2);camera.rotation_euler=(math.pi/2,0,0)
camera.data.type='PANO';camera.data.cycles.panorama_type='EQUIRECTANGULAR';scene.camera=camera
scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.cycles.samples=48;scene.render.image_settings.file_format='HDR';scene.render.filepath=str(OUT/'workshop-light.hdr')
bpy.ops.render.render(write_still=True)
hero.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bisque-workshop.blend'))
record={'version':1,'jar':{**info,'file':'bisque-jar.bin'},'albedo':'bisque-albedo.webp','normal':'bisque-normal.webp','roughness':'bisque-roughness.webp','ao':'bisque-ao.webp','hdr':'workshop-light.hdr','source':'blender/workshop/bisque-workshop.blend','note':'Dry unglazed mineral body, with shared arc-length painting UV. Diffuse workshop light proxy is an art-direction approximation.'}
(OUT/'bisque.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('BISQUE_COMPLETE',flush=True)
