"""Editable color-field still life, sharing the accepted gallery ceramic.
Blender 3.1: blender -b --factory-startup --python-exit-code 1 --python build_art.py [-- --draft]
"""
import bpy, math, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
DRAFT = '--draft' in sys.argv
random.seed(213)
bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/'museum'/'museum-scene.blend'))
scene = bpy.context.scene
hero = next(o for o in scene.objects if o.name.startswith('HERO'))
for obj in list(bpy.data.objects):
    if obj != hero: bpy.data.objects.remove(obj, do_unlink=True)
for col in list(bpy.data.collections):
    if not col.objects: bpy.data.collections.remove(col)
hero.name = 'HERO · shared celadon in the color field'
hero.location = (-1, 0, .40)

def collection(name):
    col = bpy.data.collections.new(name); scene.collection.children.link(col); return col
FIELDS = collection('02 · Terracotta, indigo and gold')
STONE = collection('03 · Honed limestone and weathered basalt')
PROPS = collection('04 · Dried branch and berries')
LIGHTS = collection('05 · Warm softbox and blue bounce')
CAMERAS = collection('06 · Calibrated full, detail and above')

def move(obj, col):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    col.objects.link(obj); return obj
def aim(obj, target): obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def material(name, color, roughness=.7):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color,1); bs.inputs['Roughness'].default_value = roughness
    return mat
def node(mat, kind, name):
    n = mat.node_tree.nodes.new(kind); n.name = n.label = name; return n
def link(mat, a, out, b, inp): mat.node_tree.links.new(a.outputs[out], b.inputs[inp])

# The example jar has an editable art-direction material. User-painted colour
# layers and the shared vessel geometry remain independent of this specimen.
glaze=hero.data.materials[0].copy();glaze.name='ART CELADON · grey jade, mineral islands and layered crackle';hero.data.materials[0]=glaze
gn=glaze.node_tree.nodes;gb=gn.get('Principled BSDF')
for element,colour in zip(gn['Jade / sea green glaze'].color_ramp.elements,[(.055,.090,.093,1),(.15,.22,.205,1),(.28,.33,.27,1),(.47,.48,.35,1)]):element.color=colour
gn['Plum blush variation'].inputs['Scale'].default_value=2.8;gn['Plum blush variation'].inputs['Detail'].default_value=4
gn['Celadon and plum'].inputs[2].default_value=(.105,.060,.088,1)
gn['Primary glaze crazing'].inputs['Scale'].default_value=12.5
gn['Small crackle distortion'].inputs[3].default_value=.080
gb.inputs['Clearcoat'].default_value=.76;gb.inputs['Clearcoat Roughness'].default_value=.065
# A restrained irregular plum deposit on the front shoulder, embedded beneath
# the same crack network. It is a 3D mineral mask rather than image-space paint.
origin=node(glaze,'ShaderNodeVectorMath','Front shoulder mineral centre');origin.operation='SUBTRACT';origin.inputs[1].default_value=(.58,.09,.67)
link(glaze,gn['Local ceramic coordinates'],'Generated',origin,0)
ellipse=node(glaze,'ShaderNodeVectorMath','Elongated plum deposit');ellipse.operation='MULTIPLY';ellipse.inputs[1].default_value=(7.0,3.5,4.8);link(glaze,origin,'Vector',ellipse,0)
distance=node(glaze,'ShaderNodeVectorMath','Mineral deposit distance');distance.operation='LENGTH';link(glaze,ellipse,'Vector',distance,0)
falloff=node(glaze,'ShaderNodeMapRange','Plum mineral feathering');falloff.inputs['From Min'].default_value=.10;falloff.inputs['From Max'].default_value=1
falloff.inputs['To Min'].default_value=1;falloff.inputs['To Max'].default_value=0;link(glaze,distance,'Value',falloff,'Value')
ragged=node(glaze,'ShaderNodeTexNoise','Organic plum boundary');ragged.inputs['Scale'].default_value=15;ragged.inputs['Detail'].default_value=4
link(glaze,gn['Local ceramic coordinates'],'Generated',ragged,'Vector')
organic=node(glaze,'ShaderNodeMapRange','Uneven mineral intensity');organic.inputs['From Min'].default_value=.28;organic.inputs['From Max'].default_value=.72
organic.inputs['To Min'].default_value=.50;organic.inputs['To Max'].default_value=1;link(glaze,ragged,'Fac',organic,'Value')
factor=node(glaze,'ShaderNodeMath','Feathered plum island');factor.operation='MULTIPLY';link(glaze,falloff,'Result',factor,0);link(glaze,organic,'Result',factor,1)
deposit=node(glaze,'ShaderNodeMixRGB','Shoulder plum kiln deposit');link(glaze,factor,'Value',deposit,0);link(glaze,gn['Celadon and plum'],'Color',deposit,1)
deposit.inputs[2].default_value=(.060,.024,.068,1);link(glaze,deposit,'Color',gn['Fine clay-coloured crackle'],1)
cells=node(glaze,'ShaderNodeTexVoronoi','Uneven mineral cell opacity');cells.inputs['Scale'].default_value=12.5
link(glaze,gn['Warp ceramic coordinates'],'Vector',cells,'Vector')
cellramp=node(glaze,'ShaderNodeValToRGB','Grey ivory translucent islands')
cellramp.color_ramp.elements[0].color=(.14,.18,.16,1);cellramp.color_ramp.elements[1].color=(.46,.44,.31,1)
link(glaze,cells,'Color',cellramp,'Fac')
cellmix=node(glaze,'ShaderNodeMixRGB','Subtle glazed mineral platelets');cellmix.inputs[0].default_value=.18
link(glaze,gn['Warm fired minerals'],'Color',cellmix,1);link(glaze,cellramp,'Color',cellmix,2)
plumfinish=node(glaze,'ShaderNodeMixRGB','Mineral purple beneath the clear glaze')
link(glaze,factor,'Value',plumfinish,0);link(glaze,cellmix,'Color',plumfinish,1)
plumfinish.inputs[2].default_value=(.070,.024,.077,1)
link(glaze,plumfinish,'Color',gn['Exposed warm body at edges'],1)
mesh=hero.data;segments_uv=192;ring_count=len(mesh.vertices)//segments_uv;uvrings=[]
for j in range(ring_count):
    vv=[v.co for v in mesh.vertices[j*segments_uv:(j+1)*segments_uv]]
    uvrings.append(Vector((sum(math.hypot(v.x,v.y) for v in vv)/segments_uv,sum(v.z for v in vv)/segments_uv)))
lengths=[0.0]
for j in range(1,ring_count):lengths.append(lengths[-1]+(uvrings[j]-uvrings[j-1]).length)
lengths=[v/lengths[-1] for v in lengths]
for poly in mesh.polygons:
    for loop in poly.loop_indices:
        j,i=divmod(mesh.loops[loop].vertex_index,segments_uv);u=i/segments_uv
        if poly.index%segments_uv==segments_uv-1 and i==0:u=1
        mesh.uv_layers['GlazeUV'].data[loop].uv=(u,lengths[j])

def scanned(name, asset, colors, tile=1, normal_strength=.6, relief=.008, roughness=.84):
    """CC0 photo material, box projected in physical object coordinates."""
    mat=material(name,colors[0],roughness);bs=mat.node_tree.nodes.get('Principled BSDF')
    tc=node(mat,'ShaderNodeTexCoord','Physical scan coordinates')
    mapping=node(mat,'ShaderNodeVectorMath','Calibrated scan size');mapping.operation='SCALE';mapping.inputs[3].default_value=tile
    link(mat,tc,'Object',mapping,0)
    def image_map(suffix,color=False):
        filename=next((ROOT/'textures').glob(asset+'_'+suffix+'_2k.*'))
        tex=node(mat,'ShaderNodeTexImage','Scanned '+suffix);tex.image=bpy.data.images.load(str(filename),check_existing=True)
        tex.image.colorspace_settings.name='sRGB' if color else 'Non-Color';tex.projection='BOX';tex.projection_blend=.18
        tex.extension='REPEAT';link(mat,mapping,'Vector',tex,'Vector');return tex
    diffuse=image_map('diff',True)
    ramp=node(mat,'ShaderNodeValToRGB','Stone and pigment palette')
    ramp.color_ramp.elements[0].position=.055;ramp.color_ramp.elements[0].color=(*colors[0],1)
    ramp.color_ramp.elements[1].position=.62;ramp.color_ramp.elements[1].color=(*colors[1],1)
    link(mat,diffuse,'Color',ramp,'Fac');link(mat,ramp,'Color',bs,'Base Color')
    normal=image_map('nor_gl');nm=node(mat,'ShaderNodeNormalMap','Photographed micro normals');nm.space='OBJECT';nm.inputs['Strength'].default_value=normal_strength
    # Box-projected relief uses the displacement map instead of a tangent map
    # across projection seams. Keep the normal image as editable source data.
    height=image_map('disp');bump=node(mat,'ShaderNodeBump','Photographed pits and grains')
    bump.inputs['Strength'].default_value=normal_strength;bump.inputs['Distance'].default_value=relief
    link(mat,height,'Color',bump,'Height');link(mat,bump,'Normal',bs,'Normal')
    scanned_rough=image_map('rough');rough=node(mat,'ShaderNodeMapRange','Matte mineral finish')
    rough.inputs['To Min'].default_value=roughness-.10;rough.inputs['To Max'].default_value=min(.99,roughness+.08)
    link(mat,scanned_rough,'Color',rough,'Value');link(mat,rough,'Result',bs,'Roughness')
    return mat
def textured(name, colors, scale, grain, bump_distance, roughness=.8):
    mat = material(name, colors[0], roughness); bs = mat.node_tree.nodes.get('Principled BSDF')
    tc = node(mat,'ShaderNodeTexCoord','Physical surface coordinates')
    broad = node(mat,'ShaderNodeTexNoise','Slow handmade variation'); broad.inputs['Scale'].default_value = scale
    broad.inputs['Detail'].default_value = 4; broad.inputs['Roughness'].default_value = .75
    link(mat,tc,'Object',broad,'Vector')
    ramp = node(mat,'ShaderNodeValToRGB','Natural mineral tones')
    for e, p, c in zip(ramp.color_ramp.elements,[.22,.8],colors): e.position=p; e.color=(*c,1)
    link(mat,broad,'Fac',ramp,'Fac'); link(mat,ramp,'Color',bs,'Base Color')
    fine = node(mat,'ShaderNodeTexNoise','Fine visible surface grain'); fine.inputs['Scale'].default_value = grain
    fine.inputs['Detail'].default_value = 3; link(mat,tc,'Object',fine,'Vector')
    bump = node(mat,'ShaderNodeBump','Tactile micro relief'); bump.inputs['Strength'].default_value = .3
    bump.inputs['Distance'].default_value = bump_distance
    link(mat,fine,'Fac',bump,'Height'); link(mat,bump,'Normal',bs,'Normal')
    return mat
red = scanned('TERRACOTTA · dense rust suede fibers','scuba_suede',[(.072,.010,.004),(.22,.039,.015)],.62,.42,.0035,.91)
bs=red.node_tree.nodes.get('Principled BSDF')
position=node(red,'ShaderNodeNewGeometry','Clay sheet height');height=node(red,'ShaderNodeSeparateXYZ','Sheet vertical position')
link(red,position,'Position',height,0)
shade=node(red,'ShaderNodeMapRange','Deep rust above, warm clay below')
shade.inputs['From Min'].default_value=0;shade.inputs['From Max'].default_value=6
shade.inputs['To Min'].default_value=1.30;shade.inputs['To Max'].default_value=.33;link(red,height,'Z',shade,'Value')
multiply=node(red,'ShaderNodeMixRGB','Quiet upper color field');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
link(red,red.node_tree.nodes['Stone and pigment palette'],'Color',multiply,1);link(red,shade,'Result',multiply,2);link(red,multiply,'Color',bs,'Base Color')
blue = scanned('INDIGO · midnight matte textile','scuba_suede',[(.005,.016,.035),(.015,.035,.070)],.55,.28,.002,.94)
def pigment_grain(mat,scale,distance,strength):
    tc=mat.node_tree.nodes['Physical scan coordinates'];bs=mat.node_tree.nodes.get('Principled BSDF')
    grain=node(mat,'ShaderNodeTexNoise','Dense pigment and fiber grain');grain.inputs['Scale'].default_value=scale;grain.inputs['Detail'].default_value=3
    link(mat,tc,'Object',grain,'Vector');bump=node(mat,'ShaderNodeBump','Soft mineral pile')
    bump.inputs['Distance'].default_value=distance;bump.inputs['Strength'].default_value=strength
    link(mat,grain,'Fac',bump,'Height');link(mat,mat.node_tree.nodes['Photographed pits and grains'],'Normal',bump,'Normal');link(mat,bump,'Normal',bs,'Normal')
pigment_grain(red,70,.025,.55);pigment_grain(blue,90,.013,.38)
gold = textured('GOLD · pale warm uncoated paper',[(.62,.38,.12),(.82,.55,.23)],18,250,.0015,.86)
sand = scanned('FLOOR · fine ochre mineral dust','clay_plaster',[(.21,.147,.083),(.49,.37,.235)],.42,.40,.007,.9)
pigment_grain(sand,180,.006,.5)
limestone = scanned('LIMESTONE · freshly fractured pale side','rock_boulder_dry',[(.23,.171,.100),(.50,.405,.274)],1.75,.62,.011,.9)
limestone_top = scanned('LIMESTONE · finely honed chalky top','rock_boulder_dry',[(.38,.301,.204),(.55,.445,.310)],.90,.19,.003,.86)
basalt = material('SHADOW FLAG · matte charcoal',(.009,.007,.005),.95)
branchmat = textured('BRANCH · weathered dark wood',[(.021,.013,.006),(.066,.037,.016)],8,80,.003,.82)
berrymat = textured('BERRIES · dried burnished rust',[(.045,.012,.006),(.18,.045,.014)],12,90,.002,.65)

def box(name, location, dimensions, mat, col=FIELDS):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj=bpy.context.object; obj.name=name; obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    move(obj,col); obj.data.materials.append(mat); return obj
box('Infinite sandstone floor',(0,1,-.15),(40,40,.3),sand,STONE)
box('Indigo gallery wall',(0,5.3,4.4),(32,.25,13),blue)

# A single continuous clay-colored sweep; its free edge descends diagonally.
# Dense quads and a thin solidified lip keep the lower curl smooth in close views.
verts=[]; faces=[]; nx=96; nz=100
for j in range(nz+1):
    t=j/nz; z=.004+9*t
    right=3.45-7.2*(t**.70)
    y=.7+3.1*(1-math.exp(-t*12))
    for i in range(nx+1):
        u=i/nx; x=-12+(right+12)*u
        curl=.45*max(0,math.sin(math.pi*(u-.84)/.16))*math.exp(-t*45) if u>.84 else 0
        verts.append((x,y+.18*math.sin(u*math.pi)*math.exp(-t*3),z+curl))
for j in range(nz):
    for i in range(nx):
        a=j*(nx+1)+i; faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Continuous terracotta sweep'); mesh.from_pydata(verts,[],faces); mesh.update()
sweep=bpy.data.objects.new('Color field · curved terracotta sheet',mesh); FIELDS.objects.link(sweep); mesh.materials.append(red)
for p in mesh.polygons:p.use_smooth=True
solid=sweep.modifiers.new('Thin curled sheet edge','SOLIDIFY'); solid.thickness=.035
bevel=sweep.modifiers.new('Soft paper-like lip','BEVEL'); bevel.width=.012; bevel.segments=3

# A large disk beyond the frame gives the upper-right corner a warm golden arc.
bpy.ops.mesh.primitive_cylinder_add(vertices=192,radius=3.65,depth=.07,location=(7.4,5.08,5.05),rotation=(math.pi/2,0,0))
disc=move(bpy.context.object,FIELDS); disc.name='Color field · cropped golden circle'; disc.data.materials.append(gold)
disc.visible_shadow=False
disc.data.use_auto_smooth=True
bevel=disc.modifiers.new('Soft golden perimeter','BEVEL'); bevel.width=.025; bevel.segments=4
disc.modifiers.new('Disc weighted normals','WEIGHTED_NORMAL')

# The central landing is truly flat; only the visible outer edge is chipped.
segments=896; rings=56; radius=2.08; top=.43; bottom=.012
hero.location.z=top-min(v.co.z for v in hero.data.vertices)
stone_rng=random.Random(721)
# Sharp irregular cavities, with many small pores and a few broken chips.
# Local indexing avoids evaluating every pore against every surface vertex.
cuts=np.zeros((rings+1,segments),dtype=np.float32)
for k in range(930):
    angle=stone_rng.uniform(0,2*math.pi);height=stone_rng.uniform(bottom+.012,top-.012)
    width=stone_rng.uniform(.009,.028) if k<800 else stone_rng.uniform(.028,.080)
    vertical=width*stone_rng.uniform(.4,1.1);depth=width*stone_rng.uniform(.7,1.8)
    ix=int(angle/(2*math.pi)*segments);iz=int((height-bottom)/(top-bottom)*rings)
    for j in range(max(0,iz-int(vertical/(top-bottom)*rings)-2),min(rings,iz+int(vertical/(top-bottom)*rings)+2)+1):
        z=bottom+(top-bottom)*j/rings
        for offset in range(-int(width/radius*segments/(2*math.pi))-2,int(width/radius*segments/(2*math.pi))+3):
            i=(ix+offset)%segments;a=2*math.pi*i/segments
            da=abs((a-angle+math.pi)%(2*math.pi)-math.pi)*radius
            d=abs(da/width)*.8+abs((z-height)/vertical)
            if d<1:cuts[j,i]+=depth*(1-d**2)**.55
v=[]; f=[]
for j in range(rings+1):
    z=bottom+(top-bottom)*j/rings
    for i in range(segments):
        a=2*math.pi*i/segments
        p=Vector((math.cos(a)*radius,math.sin(a)*radius,z))
        r=radius+.018*noise.fractal(p*5,1,2,3)+.012*noise.noise(p*77)-float(cuts[j,i])
        edge_z=z
        if j==rings:edge_z-=.008+.012*abs(noise.fractal(p*13,1,2,3))
        v.append((r*math.cos(a),r*math.sin(a),edge_z))
for j in range(rings):
    for i in range(segments):
        a=j*segments+i; b=j*segments+(i+1)%segments; f.extend([(a,b,b+segments),(a,b+segments,a+segments)])
# Annular bands blend the chipped outside into the perfectly level landing.
previous=rings*segments
side_faces=len(f)
for r in [2.055,2.025,1.92,1.5,1.15,.7,.25]:
    start=len(v)
    for i in range(segments):
        a=2*math.pi*i/segments; v.append((r*math.cos(a),r*math.sin(a),top))
    for i in range(segments):f.append((previous+i,previous+(i+1)%segments,start+(i+1)%segments,start+i))
    previous=start
center=len(v);v.append((0,0,top))
for i in range(segments):f.append((previous+i,previous+(i+1)%segments,center))
mesh=bpy.data.meshes.new('Carved porous limestone slab');mesh.from_pydata(v,[],f);mesh.update()
plinth=bpy.data.objects.new('RECEIVER · circular limestone landing',mesh);STONE.objects.link(plinth);plinth.location=(-1,.02,0);mesh.materials.append(limestone);mesh.materials.append(limestone_top)
for p in mesh.polygons:
    p.use_smooth=p.index>=side_faces;p.material_index=0 if p.index<side_faces else 1
assert abs(hero.location.z+min(v.co.z for v in hero.data.vertices)-top)<1e-6,'Ceramic foot must sit on the level landing'

# Photogrammetry supplies actual erosion, fissures and a nonuniform silhouette.
# glTF is inert geometry plus local textures; no external Blender script is run.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/'rock_09'/'rock_09_2k.gltf'))
imported=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
assert len(imported)==1,'One scanned foreground rock is expected'
rock_source=imported[0]
# Bake the importer axis transform before sizing the two differently posed stones.
bpy.ops.object.select_all(action='DESELECT');rock_source.select_set(True);bpy.context.view_layer.objects.active=rock_source
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
coords=[v.co for v in rock_source.data.vertices]
centre=Vector(tuple((min(p[i] for p in coords)+max(p[i] for p in coords))/2 for i in range(3)))
for v in rock_source.data.vertices:v.co-=centre
rock_mat=rock_source.data.materials[0]
bs=next(n for n in rock_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for name,value in [('Metallic',0),('Roughness',.88),('Specular',.18)]:
    for edge in list(bs.inputs[name].links):rock_mat.node_tree.links.remove(edge)
    bs.inputs[name].default_value=value
diffuse=bs.inputs['Base Color'].links[0].from_node
shade=node(rock_mat,'ShaderNodeMixRGB','Weathered warm charcoal');shade.blend_type='MULTIPLY';shade.inputs[0].default_value=1
shade.inputs[2].default_value=(.48,.39,.29,1);link(rock_mat,diffuse,'Color',shade,1);link(rock_mat,shade,'Color',bs,'Base Color')
def rock(name,location,dimensions,rotation,original=False):
    obj=rock_source if original else rock_source.copy()
    if not original:STONE.objects.link(obj)
    else:move(obj,STONE)
    obj.name=name;obj.location=location;obj.rotation_euler=(0,0,0);obj.dimensions=dimensions
    obj.rotation_euler=rotation
    return obj
rock('Foreground rock · scanned weathered crown',(-3.65,-3.8,.55),(3.30,2.75,2.80),(.15,.24,-.5),True)
rock('Foreground rock · softly cropped near stone',(-2.85,-6.0,-.15),(4.2,3.0,2.45),(.24,.25,2.2))
for o in list(bpy.data.objects):
    if o not in before and o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)

def twig(name,points,radius=.022):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=16;data.bevel_depth=radius;data.bevel_resolution=4
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for i,(p,co) in enumerate(zip(spline.bezier_points,points)):
        p.co=co;p.handle_left_type=p.handle_right_type='AUTO';p.radius=1-.55*i/max(1,len(points)-1)
    obj=bpy.data.objects.new(name,data);PROPS.objects.link(obj);data.materials.append(branchmat);return obj
stempoints=[(-6.0,-.9,1.45),(-5.1,-.5,1.90),(-4.4,-.3,2.16),(-3.4,-.25,2.55),(-2.60,-.15,2.80)]
branch=twig('Dried branch · left diagonal',stempoints,.028)
from mathutils.geometry import interpolate_bezier
b=branch.data.splines[0].bezier_points;samples=[]
for p,q in zip(b,b[1:]):samples.extend(interpolate_bezier(p.co,p.handle_right,q.handle_left,q.co,24))
for k in range(9):
    start=samples[20+k*8]
    end=start+Vector((random.uniform(-.18,.15),random.uniform(-.09,.08),random.uniform(.10,.30)))
    twig('Small dry berry stem',[tuple(start),tuple(start.lerp(end,.6)+Vector((-.04,.03,0))),tuple(end)],.009)
    for n in range(random.randint(3,5)):
        pos=end+Vector((random.uniform(-.065,.065),random.uniform(-.05,.05),random.uniform(-.045,.06)))
        twig('Attached berry pedicel',[tuple(end),tuple(pos)],.0035)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=random.uniform(.022,.045),location=pos)
        berry=move(bpy.context.object,PROPS);berry.name='Wrinkled dried berry';berry.scale=(1,.8,1.10);berry.data.materials.append(berrymat)
        for v in berry.data.vertices:v.co*=1+.12*noise.fractal(v.co*170,1,2,3)
        for p in berry.data.polygons:p.use_smooth=True

# A second irregular fork breaks the straight stem silhouette.
fork=twig('Dried branch · crooked upper fork',[(-5.12,-.5,1.89),(-4.95,-.45,2.23),(-4.55,-.40,2.57),(-4.47,-.32,3.16)],.020)
for k in range(6):
    start=Vector((-4.85+.075*k,-.38,2.38+.13*k));end=start+Vector((-.13 if k%2 else .18,-.025,.10))
    twig('Fork berry pedicel',[tuple(start),tuple(end)],.004)
    for n in range(3):
        pos=end+Vector((random.uniform(-.06,.06),random.uniform(-.045,.045),random.uniform(-.025,.055)))
        twig('Fork fruit attachment',[tuple(end),tuple(pos)],.0025)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=random.uniform(.024,.043),location=pos)
        berry=move(bpy.context.object,PROPS);berry.name='Wrinkled fork berry';berry.scale=(1,.80,1.10);berry.data.materials.append(berrymat)
        for p in berry.data.polygons:p.use_smooth=True

# Off-camera stems cast quiet long shadows across the foreground sandstone.
for i in range(5):
    obj=twig('Off-camera shadow branch',[(9+i*.45,-7.0,3.2),(8.0+i*.5,-5.7,3.4),(6.6+i*.55,-3.7,3.6)],.042)
    obj.visible_camera=False
flag=box('Off-camera flag · shaded foreground',(2,-7.6,3.8),(16,2.8,.035),basalt,PROPS);flag.visible_camera=False
for k in range(12):
    t=k/11;centre=Vector((6.8-1.2*t,-2.5+2.0*t,1.8-.3*t))
    offset=Vector(((-1 if k%2 else 1)*.32,.16,.08))
    twig_obj=twig('Gobo · leafy twig',[tuple(centre),tuple(centre+offset)],.015);twig_obj.visible_camera=False
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=8,radius=1,location=centre+offset)
    leaf=move(bpy.context.object,PROPS);leaf.name='Gobo · soft leaf shadow';leaf.scale=(.40,.125,.007);leaf.rotation_euler=(.35,-.15,k*.7)
    leaf.data.materials.append(branchmat);leaf.visible_camera=False;leaf.visible_glossy=False;leaf.visible_diffuse=False

def light(name,kind,location,energy,color,target,size=1,size_y=None):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    if kind=='AREA':data.shape='RECTANGLE';data.size=size;data.size_y=size_y or size
    if kind=='SUN':data.angle=.045
    obj=bpy.data.objects.new(name,data);LIGHTS.objects.link(obj);obj.location=location;aim(obj,target);return obj
light('KEY · late warm sun','SUN',(6,-5,7.5),2.35,(1,.85,.66),(-1,0,1.7))
light('KEY · right warm silk', 'AREA',(4.6,-3.4,5.4),280,(1,.91,.80),(-1,0,1.8),1.4,2.2)
light('REFLECTION · tall left silk','AREA',(-4.8,-3.5,3.8),75,(.84,.91,1),(-1,0,1.8),1.0,2.0)
light('RIM · upper warm porcelain','AREA',(-2.5,2.4,5.1),120,(1,.82,.64),(-1,0,2),2.2,1.8)
light('GOLD · soft disk wash','AREA',(5.4,-1.5,7.1),260,(1,.93,.80),(7.4,5,4.6),3,3)
def reflection_card(name,location,size,colour,power):
    bpy.ops.mesh.primitive_plane_add(size=1,location=location);o=move(bpy.context.object,LIGHTS);o.name='REFLECTOR · '+name
    o.scale=(*size,1);aim(o,(-1,0,1.8));m=bpy.data.materials.new(name+' radiance');m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*colour,1)
    bs.inputs['Emission'].default_value=(*colour,1);bs.inputs['Emission Strength'].default_value=power;bs.inputs['Roughness'].default_value=1
    o.data.materials.append(m);o.visible_camera=False;o.visible_shadow=False;o.visible_diffuse=False
    return o
reflection_card('left rectangular silk',(-4.8,-3.5,3.8),(1.0,2.0),(.84,.91,1),2.8)
reflection_card('right rectangular silk',(4.6,-3.4,5.4),(1.4,2.2),(1,.91,.80),3.6)
world=bpy.data.worlds.new('Color field · quiet blue studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.13,.20,.28,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.045;scene.world=world

focus=bpy.data.objects.new('FOCUS · front glaze shoulder',None);CAMERAS.objects.link(focus);focus.location=(-1,-.68,2.11)
def camera(name,location,target,lens=58,fstop=1.4):
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);CAMERAS.objects.link(obj)
    obj.location=location;aim(obj,target);data.lens=lens;data.sensor_width=36;data.clip_end=100
    data.dof.use_dof=True;data.dof.focus_object=focus;data.dof.aperture_fstop=fstop;return obj
main=camera('CAMERA · full color field',(2.2,-16,3.1),(.1,.1,1.53),fstop=.9)
camera('CAMERA · above limestone',(2.7,-12.9,7.5),(.05,.1,1.55),fstop=2.0)
camera('CAMERA · detail glazed shoulder',(2.6,-9.6,4.10),(-.05,.05,1.84),lens=72,fstop=.35)
scene.camera=main;scene.render.engine='CYCLES';scene.cycles.samples=32 if DRAFT else 192
scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.045 if DRAFT else .009
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=4;scene.cycles.volume_bounces=1
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    enabled=[d for d in prefs.devices if d.type=='OPTIX']
    for d in prefs.devices:d.use=d in enabled
    scene.cycles.device='GPU' if enabled else 'CPU'
except Exception:scene.cycles.device='CPU'
scene.render.resolution_x=1280 if DRAFT else 2560;scene.render.resolution_y=720 if DRAFT else 1440;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=.1;scene.view_settings.gamma=1
scene['art_direction']='Terracotta sweep, indigo wall, ochre disk, carved limestone, soft foreground basalt.'
scene['reference']='design-concepts/art-mood-v1.png; composition and mood reference.'
scene['website_note']='Calibrated clean plates, local HDR, shared live ceramic and shadow receiver.'
scene['plinth_top']=top
bpy.context.preferences.filepaths.save_version=0
for image in bpy.data.images:
    if image.source=='FILE' and image.filepath:
        image.filepath=bpy.path.relpath(bpy.path.abspath(image.filepath),start=str(ROOT))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-scene.blend'),relative_remap=False)
print('HERO_SCREEN_POSITION',tuple(world_to_camera_view(scene,main,hero.location+Vector((0,0,1.2)))),flush=True)
if '--no-render' not in sys.argv:
    scene.render.filepath=str(ROOT/('art-draft.png' if DRAFT else 'art-final.png'))
    bpy.ops.render.render(write_still=True)
print('ART_SCENE_READY',flush=True)
