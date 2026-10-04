"""Open the delivered .blend independently, check packed assets, and render a thumbnail."""
import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'museum-scene.blend'))
scene=bpy.context.scene
hero=next(o for o in scene.objects if o.name.startswith('HERO'))
minimum=min((hero.matrix_world@Vector(corner)).z for corner in hero.bound_box)
images=[{'name':im.name,'packed':bool(im.packed_file)} for im in bpy.data.images if im.source=='FILE']
assert all(im['packed'] for im in images),'External image dependency is not packed'
assert scene.camera and scene.camera.name.startswith('CAMERA · 01')
assert hero.data.uv_layers.get('GlazeUV')
assert 1.08<minimum<1.12,minimum
assert (scene.render.resolution_x,scene.render.resolution_y)==(1920,1080)
result={'reopened':True,'packed_images':images,'hero_bottom':minimum,'camera':scene.camera.name,'hero_polygons':len(hero.data.polygons),'objects':len(scene.objects),'main_image':(root/'museum-final.png').is_file(),'detail_image':(root/'glaze-detail.png').is_file()}
scene.render.resolution_percentage=20;scene.cycles.samples=8;scene.render.filepath=str(root/'reopen-check.png');bpy.ops.render.render(write_still=True)
result['reopen_render']=True
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('DELIVERY_VERIFIED',json.dumps(result,ensure_ascii=False))
