"""Editable, self-contained museum lighting study. Blender 3.1 compatible.

Run: blender -b --factory-startup --python build_museum.py -- --draft
No external add-ons, downloaded meshes, or background photographs are used.
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
random.seed(72)
DRAFT = '--draft' in sys.argv
scene = bpy.context.scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

def collection(name):
    col=bpy.data.collections.new(name);scene.collection.children.link(col);return col
HERO=collection('01 · Hero ceramic / 主体陶器')
STONE=collection('02 · Stone plinth / 粗石展台')
ARCH=collection('03 · Gallery architecture / 展厅空间')
PROPS=collection('04 · Distant exhibits / 背景展品')
LIGHTS=collection('05 · Lighting / 光影')
CAMERAS=collection('06 · Cameras / 机位')

def move(obj,col):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    col.objects.link(obj);return obj
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def node(mat,kind,name,x=0,y=0):
    n=mat.node_tree.nodes.new(kind);n.label=name;n.name=name;n.location=(x,y);return n
def link(mat,a,out,b,inp):mat.node_tree.links.new(a.outputs[out],b.inputs[inp])
def material(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal
    return m
def ramp(mat,name,source,out,stops,x,y):
    n=node(mat,'ShaderNodeValToRGB',name,x,y);r=n.color_ramp
    while len(r.elements)>2:r.elements.remove(r.elements[-1])
    for i,(pos,col) in enumerate(stops):
        e=r.elements[i] if i<2 else r.elements.new(pos);e.position=pos;e.color=col
    link(mat,source,out,n,'Fac');return n
def tex_noise(mat,name,scale,detail=3,rough=.65,x=0,y=0):
    n=node(mat,'ShaderNodeTexNoise',name,x,y);n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail;n.inputs['Roughness'].default_value=rough;return n

# The glaze is a separate editable network, not a photograph baked onto the object.
glaze=material('CELADON / kiln colour · crackle · iron flecks',(.18,.34,.28),.23)
bs=glaze.node_tree.nodes.get('Principled BSDF');bs.location=(1220,100)
bs.inputs['IOR'].default_value=1.47;bs.inputs['Specular'].default_value=.5
bs.inputs['Clearcoat'].default_value=.82;bs.inputs['Clearcoat Roughness'].default_value=.07
bs.inputs['Subsurface'].default_value=.018;bs.inputs['Subsurface Radius'].default_value=(.28,.18,.11)
coord=node(glaze,'ShaderNodeTexCoord','Local ceramic coordinates',-1500,0)
cloud=tex_noise(glaze,'Celadon pools',2.3,3,.68,-1260,480);cloud.inputs['Distortion'].default_value=.65;link(glaze,coord,'Generated',cloud,'Vector')
palette=ramp(glaze,'Jade / sea green glaze',cloud,'Fac',[
    (.18,(.032,.084,.081,1)),(.39,(.085,.19,.18,1)),(.58,(.20,.34,.29,1)),(.79,(.40,.49,.35,1))],-980,490)
plum=tex_noise(glaze,'Plum blush variation',3.2,3,.65,-1260,170);link(glaze,coord,'Generated',plum,'Vector')
plum_mask=ramp(glaze,'Restrained plum islands',plum,'Fac',[(.52,(0,0,0,1)),(.70,(.73,.73,.73,1)),(.82,(1,1,1,1))],-1010,160)
mix=node(glaze,'ShaderNodeMixRGB','Celadon and plum',-690,440);link(glaze,plum_mask,'Color',mix,0);link(glaze,palette,'Color',mix,1);mix.inputs[2].default_value=(.18,.105,.16,1)
warp=tex_noise(glaze,'Organic distortion for crackle',9,3,.68,-1260,-170);link(glaze,coord,'Generated',warp,'Vector')
scale=node(glaze,'ShaderNodeVectorMath','Small crackle distortion',-1030,-170);scale.operation='SCALE';scale.inputs[3].default_value=.055;link(glaze,warp,'Color',scale,0)
add=node(glaze,'ShaderNodeVectorMath','Warp ceramic coordinates',-810,-170);add.operation='ADD';link(glaze,coord,'Generated',add,0);link(glaze,scale,'Vector',add,1)
crack=node(glaze,'ShaderNodeTexVoronoi','Primary glaze crazing',-570,-200);crack.feature='DISTANCE_TO_EDGE';crack.inputs['Scale'].default_value=19;link(glaze,add,'Vector',crack,'Vector')
crack_mask=ramp(glaze,'Fine stained crack lines',crack,'Distance',[(.0015,(.8,.8,.8,1)),(.010,(.24,.24,.24,1)),(.017,(0,0,0,1))],-330,-140)
crackcolor=node(glaze,'ShaderNodeMixRGB','Fine clay-coloured crackle',-60,410);link(glaze,crack_mask,'Color',crackcolor,0);link(glaze,mix,'Color',crackcolor,1);crackcolor.inputs[2].default_value=(.048,.043,.025,1)
speck=tex_noise(glaze,'Tiny iron specks',185,2,.75,-650,-590);link(glaze,coord,'Generated',speck,'Vector')
speckmask=ramp(glaze,'Sparse embedded flecks',speck,'Fac',[(.68,(0,0,0,1)),(.77,(.65,.65,.65,1)),(.87,(1,1,1,1))],-370,-520)
speckmix=node(glaze,'ShaderNodeMixRGB','Fired mineral detail',200,400);link(glaze,speckmask,'Color',speckmix,0);link(glaze,crackcolor,'Color',speckmix,1);speckmix.inputs[2].default_value=(.035,.022,.012,1)
sep=node(glaze,'ShaderNodeSeparateXYZ','Foot and lip height',-700,-850);link(glaze,coord,'Generated',sep,'Vector')
claymask=ramp(glaze,'Unglazed foot and thin lip',sep,'Z',[(0,(1,1,1,1)),(.036,(1,1,1,1)),(.048,(0,0,0,1)),(.963,(0,0,0,1)),(.987,(.65,.65,.65,1)),(1,(.8,.8,.8,1))],-380,-850)
lower=ramp(glaze,'Lower body mineral veil',sep,'Z',[(.06,(.7,.7,.7,1)),(.38,(0,0,0,1))],-150,-1030)
ash=tex_noise(glaze,'Mineral deposit islands',12,4,.7,-520,-1250);link(glaze,coord,'Generated',ash,'Vector')
ashmask=ramp(glaze,'Scattered mineral deposits',ash,'Fac',[(.4,(0,0,0,1)),(.70,(.8,.8,.8,1))],-180,-1210)
mul=node(glaze,'ShaderNodeMath','Deposits around lower body',140,-920);mul.operation='MULTIPLY';link(glaze,lower,'Color',mul,0);link(glaze,ashmask,'Color',mul,1)
ashmix=node(glaze,'ShaderNodeMixRGB','Warm fired minerals',440,580);link(glaze,mul,'Value',ashmix,0);link(glaze,speckmix,'Color',ashmix,1);ashmix.inputs[2].default_value=(.055,.040,.025,1)
claymix=node(glaze,'ShaderNodeMixRGB','Exposed warm body at edges',730,380);link(glaze,claymask,'Color',claymix,0);link(glaze,ashmix,'Color',claymix,1);claymix.inputs[2].default_value=(.18,.105,.05,1);link(glaze,claymix,'Color',bs,'Base Color')
rough=ramp(glaze,'Glaze micro-roughness',cloud,'Fac',[(.2,(.085,.085,.085,1)),(.8,(.17,.17,.17,1))],200,140);link(glaze,rough,'Color',bs,'Roughness')
grain=tex_noise(glaze,'Subtle fired orange peel',260,2,.6,-40,-510);link(glaze,coord,'Generated',grain,'Vector')
bump1=node(glaze,'ShaderNodeBump','Fine ceramic surface',250,-340);bump1.inputs['Strength'].default_value=.16;bump1.inputs['Distance'].default_value=.008;link(glaze,grain,'Fac',bump1,'Height')
bump2=node(glaze,'ShaderNodeBump','Hairline cracks beneath glaze',650,-200);bump2.inputs['Strength'].default_value=.28;bump2.inputs['Distance'].default_value=.005;bump2.invert=True;link(glaze,crack_mask,'Color',bump2,'Height');link(glaze,bump1,'Normal',bump2,'Normal');link(glaze,bump2,'Normal',bs,'Normal')

stone=material('BASALT / layered weathered mineral',(.025,.031,.027),.82)
sbs=stone.node_tree.nodes.get('Principled BSDF');sbs.location=(800,50)
sn=tex_noise(stone,'Broad basalt strata',4.8,6,.8,-900,220)
sr=ramp(stone,'Basalt dark facets',sn,'Fac',[(.15,(.008,.012,.011,1)),(.44,(.025,.034,.03,1)),(.65,(.073,.078,.061,1)),(.88,(.13,.12,.086,1))],-600,230);link(stone,sr,'Color',sbs,'Base Color')
sf=tex_noise(stone,'Broken mineral surface',52,5,.8,-850,-100)
sb=node(stone,'ShaderNodeBump','Stone grit',-350,-20);sb.inputs['Strength'].default_value=.65;sb.inputs['Distance'].default_value=.07;link(stone,sf,'Fac',sb,'Height')
sm=tex_noise(stone,'Micro mineral texture',260,2,.65,-820,-390)
sb2=node(stone,'ShaderNodeBump','Fine mineral texture',10,-90);sb2.inputs['Strength'].default_value=.35;sb2.inputs['Distance'].default_value=.015;link(stone,sm,'Fac',sb2,'Height');link(stone,sb,'Normal',sb2,'Normal');link(stone,sb2,'Normal',sbs,'Normal')

plaster=material('ARCH / charcoal limewash',(.027,.032,.026),.89)
pn=tex_noise(plaster,'Hand-trowelled wall',7,5,.7,-600,100)
pr=ramp(plaster,'Warm charcoal variations',pn,'Fac',[(.2,(.012,.018,.016,1)),(.8,(.055,.06,.046,1))],-350,130);link(plaster,pr,'Color',plaster.node_tree.nodes.get('Principled BSDF'),'Base Color')
pb=node(plaster,'ShaderNodeBump','Plaster relief',-50,-100);pb.inputs['Strength'].default_value=.35;pb.inputs['Distance'].default_value=.04;link(plaster,pn,'Fac',pb,'Height');link(plaster,pb,'Normal',plaster.node_tree.nodes.get('Principled BSDF'),'Normal')
bronze=material('METAL / aged bronze',(.10,.071,.034),.4,.7)
dark=material('ARCH / near black oak',(.012,.015,.012),.55)
paper=material('PAPER / raw silk hanging',(.27,.22,.13),.95)
floor=material('FLOOR / dark polished slate',(.025,.029,.023),.28)
fn=tex_noise(floor,'Slate uneven reflection',7,3,.7,-600,80)
fr=ramp(floor,'Slate roughness',fn,'Fac',[(.2,(.22,.22,.22,1)),(.8,(.48,.48,.48,1))],-300,80);link(floor,fr,'Color',floor.node_tree.nodes.get('Principled BSDF'),'Roughness')

def box(name,loc,size,mat,col=ARCH,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);move(o,col)
    if mat:o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def sample_profile(points,steps=7):
    result=[]
    for i in range(len(points)-1):
        a=Vector(points[max(0,i-1)]);b=Vector(points[i]);c=Vector(points[i+1]);d=Vector(points[min(len(points)-1,i+2)])
        for j in range(steps):
            t=j/steps;v=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            result.append((max(.002,v.x),v.y))
    result.append(points[-1]);return result

profile=[(.002,.03),(.46,.03),(.59,.035),(.63,.065),(.65,.12),(.69,.22),(.81,.44),(.96,.77),(1.065,1.13),(1.11,1.48),(1.075,1.71),(.97,1.91),(.80,2.045),(.59,2.12),(.50,2.17),(.495,2.26),(.54,2.30),(.55,2.35),(.51,2.375),(.465,2.355),(.45,2.315),(.448,2.23),(.48,2.16),(.58,2.08),(.75,1.99),(.91,1.86),(1.0,1.65),(1.025,1.42),(.985,1.12),(.88,.78),(.73,.43),(.59,.23),(.42,.17),(.002,.17)]
def vessel(name,loc,scale=1,mat=glaze,col=HERO):
    rings=sample_profile(profile);segments=192 if col==HERO else 96;verts=[];faces=[]
    for j,(r,z) in enumerate(rings):
        for i in range(segments):
            theta=2*math.pi*i/segments
            wobble=1+.0032*math.sin(theta*3+z*1.2)+.0018*math.sin(theta*7-z*3)
            rr=r*wobble;verts.append((rr*math.cos(theta),rr*math.sin(theta),z+.002*math.sin(theta*4+z*6)*min(1,r)))
    for j in range(len(rings)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);col.objects.link(o);o.location=loc;o.scale=(scale,)*3;mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    uv=mesh.uv_layers.new(name='GlazeUV')
    for p in mesh.polygons:
        for loop_id in p.loop_indices:
            vi=mesh.loops[loop_id].vertex_index;j,i=divmod(vi,segments);u=i/segments
            if (p.index%segments)==segments-1 and i==0:u=1
            uv.data[loop_id].uv=(u,rings[j][1]/2.375)
    return o

hero=vessel('HERO · 青岚流光 · Celadon jar',(-1.0,0,1.07))
hero['purpose']='Editable handmade jar; procedural glaze, UV channel for future user painting.'
hero['material_note']='Art-direction specimen, not a physically calibrated firing simulation.'

# Subdivided cuboid with an intentionally level landing under the ceramic foot.
rock=box('PLINTH · hewn basalt block',(-1,.1,-.06),(4.7,3.6,2.32),stone,STONE)
bpy.context.view_layer.objects.active=rock;rock.select_set(True)
bevel=rock.modifiers.new('Broken hewn edges','BEVEL');bevel.width=.26;bevel.segments=4;bpy.ops.object.modifier_apply(modifier=bevel.name)
sub=rock.modifiers.new('Stone surface subdivision','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=4;bpy.ops.object.modifier_apply(modifier=sub.name)
for v in rock.data.vertices:
    p=v.co.copy();normal=v.normal.copy()
    coarse=noise.fractal(p*1.3,1.0,2.0,3);fine=noise.noise_vector(p*11)[0]
    displacement=coarse*.15+fine*.026
    if p.z>.98:
        radius=math.sqrt(p.x*p.x+(p.y+.1)**2)
        fade=max(0,min(1,(radius-.83)/.55));displacement*=fade
        v.co.z=1.16+displacement if radius<1.35 else p.z+displacement
        if radius>.95:v.co.x+=fine*.027;v.co.y+=fine*.025
    else:v.co+=normal*displacement
rock.data.update()
for p in rock.data.polygons:p.use_smooth=False

# Gallery: actual geometry at several depths, leaving a quiet right-hand caption field.
box('Slate floor',(0,1,-1.28),(24,24,.2),floor,ARCH,.04)
for ix in range(-5,6):
    for iy in range(-2,5):
        box('Slate seam',(ix*2.6,iy*2.6,-1.174),(.012,2.6,.003),dark,ARCH)
        box('Slate seam',(ix*2.6,iy*2.6,-1.174),(2.6,.012,.003),dark,ARCH)
box('Rear gallery wall',(-2.0,6.5,3.1),(16,.5,8.5),plaster)
box('Gallery left return',(-7.2,1.4,3.1),(.45,11,8.5),plaster)
box('Ceiling shadow',(0,2.8,7.0),(20,15,.25),dark)
for x in [-6.5,-3.65,.5,3.7,7.0]:
    box('Vertical dark oak pier',(x,5.98,3),(.23,.65,8.0),dark,ARCH,.025)
box('Shadow gallery partition',(2.65,3.9,3.1),(1.5,.4,8.4),plaster)
box('Warm rear niche backing',(5.35,6.19,2.7),(2.05,.025,4.6),paper)
for x in [4.23,6.47]:box('Niche side frame',(x,5.82,2.7),(.13,.7,4.9),dark,ARCH,.012)
for z in [.26,5.14]:box('Niche head and sill',(5.35,5.82,z),(2.36,.7,.12),dark,ARCH,.012)
box('Background exhibit plinth',(5.35,5.25,-.12),(1.28,1.1,2.1),dark,PROPS,.035)
small_mat=material('DISTANT / aged ochre ceramic',(.12,.087,.043),.32)
vessel('DISTANT · niche vessel',(5.35,5.22,.95),.32,small_mat,PROPS)
box('Left exhibit plinth',(-5.5,3.2,-.27),(1.45,1.3,1.8),dark,PROPS,.035)
vessel('DISTANT · low ceramic',(-5.5,3.2,.64),.25,small_mat,PROPS)

# Long silk-like vertical panels; ink drawings can be packed into the blend.
def panel(name,x,y,z,w,h,texture_name=None):
    obj=box(name,(x,y,z),(w,.018,h),paper,PROPS,.005)
    if texture_name and (ROOT/'textures'/texture_name).exists():
        m=material(name+' silk material',(.3,.25,.17),.95);im=node(m,'ShaderNodeTexImage','Original ink study',-600,60);im.image=bpy.data.images.load(str(ROOT/'textures'/texture_name));im.image.pack()
        tc=node(m,'ShaderNodeTexCoord','Panel coordinates',-1200,0);sep=node(m,'ShaderNodeSeparateXYZ','Face plane',-1000,0);comb=node(m,'ShaderNodeCombineXYZ','Paper UV',-800,0);link(m,tc,'Generated',sep,'Vector');link(m,sep,'X',comb,'X');link(m,sep,'Z',comb,'Y');link(m,comb,'Vector',im,'Vector');link(m,im,'Color',m.node_tree.nodes.get('Principled BSDF'),'Base Color');obj.data.materials.clear();obj.data.materials.append(m)
    for zz in [z-h/2,z+h/2]:box(name+' roller',(x,y-.025,zz),(w+.12,.075,.065),bronze,PROPS,.016)
    return obj
panel('Silk panel · mountain study',-3.9,6.16,3.55,1.05,4.75,'mountain.png')
panel('Silk panel · clay and fire',.02,6.16,3.15,.68,3.95,'poem.png')

# A restrained silhouette of a branch deep in the left gallery.
branch_mat=material('BRANCH / aged bark',(.035,.025,.014),.86)
def twig(name,points,radius=.022):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12;curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);PROPS.objects.link(obj);obj.data.materials.append(branch_mat);return obj
twig('Dry branch main',[(-5.5,3.2,1.12),(-5.25,3.23,1.8),(-4.8,3.15,2.25),(-4.4,3.27,2.8)])
for i in range(7):
    t=i/7;base=(-5.43+t*.86,3.2,1.4+t*1.2);end=(base[0]+(-.5 if i%2 else .45),base[1]+random.uniform(-.22,.22),base[2]+.48)
    twig('Fine branch',[base,((base[0]+end[0])/2,base[1]-.06,base[2]+.28),end],.012)
    for j in range(2):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.045,location=(end[0]+j*.04,end[1],end[2]+j*.08));o=bpy.context.object;o.name='Dried seed';move(o,PROPS);o.scale=(1,.7,.8);o.data.materials.append(small_mat)

def light(name,kind,loc,energy,color,target,size=.5,spot=.6):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    if kind=='SPOT':data.spot_size=spot;data.spot_blend=.6;data.shadow_soft_size=size
    obj=bpy.data.objects.new(name,data);LIGHTS.objects.link(obj);obj.location=loc;aim(obj,target);return obj
light('KEY · warm museum spotlight','SPOT',(-4.4,-3.5,6.3),1100,(1,.78,.52),(-1,0,2.3),.22,.69)
windowlight=light('WINDOW · cool glaze reflection','AREA',(1.65,-2.8,4.6),100,(.69,.83,1),(-1,0,2.3),1.0);windowlight.data.shape='RECTANGLE';windowlight.data.size_y=2.0
light('RIM · warm shoulder separation','SPOT',(-2.4,2.1,5.4),650,(1,.74,.43),(-1,0,2.2),.3,.65)
light('BEAM · gallery spotlight','SPOT',(-3.0,1.5,6.6),1900,(1,.78,.52),(-1,-.1,1.0),.09,.42)
light('PAPER · dim artwork wash','SPOT',(-4.0,4.7,5.85),75,(1,.73,.42),(-3.9,6.1,3.5),.18,.9)
light('PAPER · secondary wash','SPOT',(.1,5.0,5.2),14,(1,.72,.45),(0,6.1,3.1),.12,.57)
light('NICHE · concealed downlight','AREA',(5.35,5.6,5.02),35,(1,.69,.36),(5.35,5.4,1.0),.5)
light('BOUNCE · front silk fill','AREA',(-1,-6,2.3),22,(.70,.85,.89),(-1,0,2.1),3.0)
light('STONE · low grazing warm light','SPOT',(-5,-1,2.4),170,(1,.68,.38),(-1,0,1.04),.12,.65)
world=bpy.data.worlds.new('Night gallery world');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.13,.12,1);world.node_tree.nodes['Background'].inputs[1].default_value=.035
volume=bpy.data.materials.new('ATMOSPHERE / very thin gallery haze');volume.use_nodes=True;volume.node_tree.nodes.clear();out=node(volume,'ShaderNodeOutputMaterial','Atmosphere output',300,0);vol=node(volume,'ShaderNodeVolumePrincipled','Subtle suspended air',0,0);vol.inputs['Density'].default_value=.002;vol.inputs['Color'].default_value=(.52,.57,.54,1);vol.inputs['Anisotropy'].default_value=.35;link(volume,vol,'Volume',out,'Volume')
box('Atmosphere volume',(0,1,3),(22,22,15),volume,LIGHTS)
shaftmat=volume.copy();shaftmat.name='ATMOSPHERE / local light shaft';shaftmat.node_tree.nodes['Subtle suspended air'].inputs['Density'].default_value=.022
box('Thin air behind the hero',(-2,.5,4),(4.5,3.4,7.0),shaftmat,LIGHTS)

def camera(name,loc,target,lens=58):
    data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);CAMERAS.objects.link(o);o.location=loc;aim(o,target);data.lens=lens;data.sensor_width=36;data.clip_end=120;return o
camera_main=camera('CAMERA · 01 exhibition / 16x9',(2.8,-16,4.65),(.05,.05,2.5),58)
camera_main.data.dof.use_dof=True;camera_main.data.dof.focus_object=hero;camera_main.data.dof.aperture_fstop=2.0
camera_detail=camera('CAMERA · 02 glaze detail',(.8,-5.3,3.8),(-1,0,2.48),100);camera_detail.data.dof.use_dof=True;camera_detail.data.dof.focus_object=hero;camera_detail.data.dof.aperture_fstop=8
scene.camera=camera_main
scene.render.engine='CYCLES';scene.cycles.samples=40 if DRAFT else 160;scene.cycles.use_denoising=True
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=4;scene.cycles.transmission_bounces=4;scene.cycles.volume_bounces=1
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.045 if DRAFT else .018
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU'
except Exception as ex:print('GPU fallback:',ex);scene.cycles.device='CPU'
scene.render.resolution_x=1280 if DRAFT else 1920;scene.render.resolution_y=720 if DRAFT else 1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.film_transparent=False
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=.2;scene.view_settings.gamma=1
scene.render.use_file_extension=True
scene.use_nodes=True;nodes=scene.node_tree.nodes;nodes.clear();rl=nodes.new('CompositorNodeRLayers');gl=nodes.new('CompositorNodeGlare');gl.glare_type='FOG_GLOW';gl.quality='HIGH';gl.threshold=2.5;gl.mix=-.96;comp=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(rl.outputs['Image'],gl.inputs['Image']);scene.node_tree.links.new(gl.outputs['Image'],comp.inputs['Image'])
scene['art_direction']='Museum night / celadon, basalt, warm key, cool reflection. First physical scene study.'
scene['reference']='design-concepts/museum-mood-v1.png; reference used for art direction only.'
scene['render_workflow']='Cycles / OptiX on RTX 2060. Materials and geometry remain editable.'
scene['website_note']='Scene camera and hero UV retained for future web integration. Not yet integrated in the live webpage.'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
scene.render.filepath=str(ROOT/('museum-draft.png' if DRAFT else 'museum-final.png'))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'museum-scene.blend'))
projected=world_to_camera_view(scene,camera_main,hero.location+Vector((0,0,1.2)))
print('HERO_SCREEN_POSITION',tuple(projected));print('START_RENDER',scene.render.filepath)
bpy.ops.render.render(write_still=True)
print('FINISHED_RENDER',scene.render.filepath)
if not DRAFT:
    scene.camera=camera_detail;scene.render.resolution_x=1280;scene.render.resolution_y=1280;scene.render.filepath=str(ROOT/'glaze-detail.png')
    bpy.ops.render.render(write_still=True)
    scene.camera=camera_main;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.filepath=str(ROOT/'museum-final.png')
    manifest={'blender':bpy.app.version_string,'renderer':scene.render.engine,'samples':scene.cycles.samples,'resolution':[1920,1080],'hero':hero.name,'materials':len(bpy.data.materials),'objects':len(scene.objects),'packed_images':[im.name for im in bpy.data.images if im.packed_file],'camera_main':list(camera_main.location),'camera_lens_mm':camera_main.data.lens}
    (ROOT/'scene-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'museum-scene.blend'))
