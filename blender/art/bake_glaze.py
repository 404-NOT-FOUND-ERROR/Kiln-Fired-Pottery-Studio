"""Bake the art-direction example glaze on the shared arc-length painting UV."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'web-bakes';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art-scene.blend'))
scene=bpy.context.scene;hero=next(o for o in scene.objects if o.name.startswith('HERO'))
scene.cycles.samples=16
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    devices=[d for d in prefs.devices if d.type=='OPTIX']
    for d in prefs.devices:d.use=d in devices
    scene.cycles.device='GPU' if devices else 'CPU'
except Exception:scene.cycles.device='CPU'
for obj in scene.objects:
    if obj.type=='MESH' and obj!=hero:obj.hide_render=True
bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
mat=hero.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links
bs=nodes.get('Principled BSDF');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
surface=output.inputs['Surface'].links[0].from_socket
emit=nodes.new('ShaderNodeEmission');emit.inputs['Strength'].default_value=1
target=nodes.new('ShaderNodeTexImage');target.name='ART BAKE TARGET'
scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=16
def bake(name,socket=None,kind='EMIT',color=False):
    image=bpy.data.images.new(name,width=2048,height=2048,alpha=False)
    image.colorspace_settings.name='sRGB' if color else 'Non-Color';target.image=image
    for n in nodes:n.select=False
    target.select=True;nodes.active=target
    if kind=='EMIT':links.new(socket,emit.inputs['Color']);links.new(emit.outputs[0],output.inputs['Surface'])
    else:links.new(surface,output.inputs['Surface'])
    bpy.ops.object.bake(type=kind,use_clear=True,margin=16)
    image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG';image.save();print('BAKED',name,flush=True)
bake('art-specimen',bs.inputs['Base Color'].links[0].from_socket,color=True)
bake('art-roughness',bs.inputs['Roughness'].links[0].from_socket)
bake('art-normal',kind='NORMAL')
print('ART_GLAZE_READY',flush=True)
