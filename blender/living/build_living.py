"""Editable afternoon window scene, using the accepted ceramic from the gallery.
Blender 3.1: blender -b --factory-startup --python build_living.py [-- --draft]
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
ROOT.mkdir(parents=True,exist_ok=True)
random.seed(84)
DRAFT='--draft' in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/'museum'/'museum-scene.blend'))
scene=bpy.context.scene
hero=next(o for o in scene.objects if o.name.startswith('HERO'))
for obj in list(bpy.data.objects):
    if obj!=hero:bpy.data.objects.remove(obj,do_unlink=True)
for col in list(bpy.data.collections):
    if not col.objects:bpy.data.collections.remove(col)
hero.location=(-1,0,1.025)
hero.name='HERO · ceramic shared with the gallery'
def collection(name):
    col=bpy.data.collections.new(name);scene.collection.children.link(col);return col
ARCH=collection('02 · Wooden window and lime plaster')
TABLE=collection('03 · Old walnut table and woven linen')
PROPS=collection('04 · Tea, branches and garden')
LIGHTS=collection('05 · Sunlight and window reflections')
CAMERAS=collection('06 · Calibrated cameras')
def move(obj,col):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    col.objects.link(obj);return obj
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def material(name,color,rough=.6):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    return mat
def node(mat,kind,name):
    n=mat.node_tree.nodes.new(kind);n.name=name;n.label=name;return n
def link(mat,a,out,b,inp):mat.node_tree.links.new(a.outputs[out],b.inputs[inp])
def ramp(mat,name,source,out,stops):
    n=node(mat,'ShaderNodeValToRGB',name)
    for i,(p,c) in enumerate(stops):
        e=n.color_ramp.elements[i] if i<2 else n.color_ramp.elements.new(p);e.position=p;e.color=(*c,1)
    link(mat,source,out,n,'Fac');return n
def noise(mat,name,scale,detail=4):
    n=node(mat,'ShaderNodeTexNoise',name);n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail;n.inputs['Roughness'].default_value=.73;return n
def box(name,loc,size,mat,col=ARCH,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);move(o,col)
    if mat:o.data.materials.append(mat)
    if bevel:
        o.data.use_auto_smooth=True
        for p in o.data.polygons:p.use_smooth=True
        m=o.modifiers.new('Rounded old edges','BEVEL');m.width=bevel;m.segments=6
        normal=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');normal.keep_sharp=True;normal.weight=50
    return o
def curve(name,points,mat,radius=.018,col=PROPS):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=radius;data.bevel_resolution=3
    if name.startswith(('Tea branch','Curved chair','Tea scoop')):
        data.resolution_u=16;s=data.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    else:
        s=data.splines.new('POLY');s.points.add(len(points)-1)
        for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,data);col.objects.link(o);data.materials.append(mat);return o

# Materials use physical scene coordinates. The wood grain runs along each board.
wood=material('WALNUT · rubbed grain, pores and fine scratches',(.08,.035,.012),.56)
bs=wood.node_tree.nodes.get('Principled BSDF');bs.inputs['Clearcoat'].default_value=.18;bs.inputs['Clearcoat Roughness'].default_value=.25
tc=node(wood,'ShaderNodeTexCoord','Timber coordinates')
mapping=node(wood,'ShaderNodeVectorMath','Long grain');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(.5,11,17);link(wood,tc,'Object',mapping,0)
grain=noise(wood,'Flowing aged grain',3.6,5);grain.inputs['Distortion'].default_value=1.9;link(wood,mapping,'Vector',grain,'Vector')
col=ramp(wood,'Walnut amber and dark pores',grain,'Fac',[(.22,(.027,.012,.004)),(.42,(.048,.022,.008)),(.61,(.092,.042,.014)),(.8,(.145,.073,.024))]);link(wood,col,'Color',bs,'Base Color')
fine=noise(wood,'Fine timber pores',38,3);link(wood,mapping,'Vector',fine,'Vector')
bump=node(wood,'ShaderNodeBump','Raised grain');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.002;link(wood,fine,'Fac',bump,'Height');link(wood,bump,'Normal',bs,'Normal')
wr=ramp(wood,'Hand-rubbed sheen variation',grain,'Fac',[(.2,(.32,.32,.32)),(.8,(.52,.52,.52))]);link(wood,wr,'Color',bs,'Roughness')
# Each frame member uses grain along its own length, rather than crosswise stripes.
def frame_material(name,axis):
    mat=wood.copy();mat.name=name
    mat.node_tree.nodes['Long grain'].inputs[1].default_value=axis
    mat.node_tree.nodes['Flowing aged grain'].inputs['Distortion'].default_value=.55
    n=mat.node_tree.nodes['Raised grain'];n.inputs['Strength'].default_value=.09;n.inputs['Distance'].default_value=.0014
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.44;bs.inputs['Clearcoat'].default_value=.08
    return mat
frame_vertical=frame_material('WINDOW · oak lengthwise vertical grain',(9,9,.28))
frame_horizontal=frame_material('WINDOW · oak lengthwise horizontal grain',(9,.28,9))
plaster=material('WALL · ivory hand-trowelled lime',(.51,.41,.27),.86)
bs=plaster.node_tree.nodes.get('Principled BSDF');pn=noise(plaster,'Plaster uneven colour',2.4,5)
pc=ramp(plaster,'Lime and sand',pn,'Fac',[(.15,(.38,.31,.22)),(.83,(.59,.50,.36))]);link(plaster,pc,'Color',bs,'Base Color')
fine=noise(plaster,'Fine sand grains',245,3);bump=node(plaster,'ShaderNodeBump','Fine porous surface');bump.inputs['Strength'].default_value=.21;bump.inputs['Distance'].default_value=.003;link(plaster,fine,'Fac',bump,'Height')
relief=node(plaster,'ShaderNodeBump','Trowel relief');relief.inputs['Strength'].default_value=.22;relief.inputs['Distance'].default_value=.012;link(plaster,pn,'Fac',relief,'Height');link(plaster,bump,'Normal',relief,'Normal');link(plaster,relief,'Normal',bs,'Normal')
linen=material('LINEN · natural flax woven warp and weft',(.38,.30,.19),.92)
bs=linen.node_tree.nodes.get('Principled BSDF');bs.inputs['Sheen'].default_value=.3
tc=node(linen,'ShaderNodeTexCoord','Cloth coordinates');warp=node(linen,'ShaderNodeTexWave','Flax warp');warp.wave_type='BANDS';warp.bands_direction='X';warp.inputs['Scale'].default_value=310;link(linen,tc,'Object',warp,'Vector')
weft=node(linen,'ShaderNodeTexWave','Flax weft');weft.wave_type='BANDS';weft.bands_direction='Y';weft.inputs['Scale'].default_value=295;link(linen,tc,'Object',weft,'Vector')
weave=node(linen,'ShaderNodeMixRGB','Interlaced threads');weave.blend_type='MULTIPLY';weave.inputs[0].default_value=1;link(linen,warp,'Color',weave,1);link(linen,weft,'Color',weave,2)
lc=ramp(linen,'Thread light and grooves',weave,'Color',[(0,(.25,.19,.115)),(.75,(.39,.31,.20))]);link(linen,lc,'Color',bs,'Base Color')
bump=node(linen,'ShaderNodeBump','Thread relief');bump.inputs['Strength'].default_value=.32;bump.inputs['Distance'].default_value=.0018;link(linen,weave,'Color',bump,'Height');link(linen,bump,'Normal',bs,'Normal')
thread=material('FLAX · loose individual edge fibres',(.34,.27,.17),.94)
branchmat=material('BRANCH · slender tea twig',(.027,.018,.008),.86)
leafmat=material('LEAF · translucent olive green',(.075,.12,.022),.48);leafbs=leafmat.node_tree.nodes.get('Principled BSDF');leafbs.inputs['Subsurface'].default_value=.12;leafbs.inputs['Subsurface Radius'].default_value=(.12,.25,.08)
ln=noise(leafmat,'Leaf fine veins',55,2);lb=node(leafmat,'ShaderNodeBump','Satin leaf veins');lb.inputs['Strength'].default_value=.16;lb.inputs['Distance'].default_value=.001;link(leafmat,ln,'Fac',lb,'Height');link(leafmat,lb,'Normal',leafbs,'Normal')
tea=material('TEA · honey amber',(.045,.018,.004),.12)
tea.node_tree.nodes.get('Principled BSDF').inputs['Transmission'].default_value=.28
stoneware=material('CUP · speckled warm stoneware',(.2,.15,.087),.32)
cn=noise(stoneware,'Cup mineral flecks',120,2);cr=ramp(stoneware,'Sand and iron',cn,'Fac',[(.3,(.1,.065,.032)),(.7,(.36,.29,.18))]);link(stoneware,cr,'Color',stoneware.node_tree.nodes.get('Principled BSDF'),'Base Color')
cb=node(stoneware,'ShaderNodeBump','Kiln-fired fine pores');cb.inputs['Strength'].default_value=.17;cb.inputs['Distance'].default_value=.0015;link(stoneware,cn,'Fac',cb,'Height');link(stoneware,cb,'Normal',stoneware.node_tree.nodes.get('Principled BSDF'),'Normal')
dark=material('CHAIR · dark aged wood',(.024,.014,.006),.42)

# Back wall offers breathing room for the real HTML caption.
box('Back wall · warm lime',(.8,3.35,3.2),(12,.24,6.5),plaster)
box('Left wall · below window',(-4.65,.5,.53),(.28,6,1.06),plaster)
box('Left wall · above window',(-4.65,.5,6.2),(.28,6,1.0),plaster)
for y in [-2.65,3.48]:box('Left wall · window side',(-4.65,y,3.35),(.28,.65,4.6),plaster)
for y in [-2.3,3.15]:box('Heavy window jamb',(-4.46,y,3.25),(.3,.23,4.6),frame_vertical,bevel=.03)
for z in [1.05,5.45]:box('Window sill and lintel',(-4.4,.42,z),(.56,5.68,.24),frame_horizontal,bevel=.038)
for y in [-1.72,-.83,.06,.95,1.84,2.59]:box('Thin timber window lattice',(-4.48,y,3.24),(.13,.073,4.32),frame_vertical,bevel=.012)
# Stagger the depth at crossings to create clean lap joints without coincident faces.
for z in [1.62,2.27,2.92,3.57,4.22,4.87]:box('Cross lattice',(-4.41,.42,z),(.13,5.42,.066),frame_horizontal,bevel=.010)
# Partial open inner sash gives an asymmetrical warm foreground frame.
for y in [-1.75,.67]:box('Inner open sash frame',(-3.9,y,3.2),(.15,.14,4.22),frame_vertical,bevel=.020)
for z in [1.09,5.31]:box('Inner sash rail',(-3.9,-.54,z),(.15,2.55,.14),frame_horizontal,bevel=.018)

# Old table boards, each a separate editable mesh.
for i in range(17):
    y=-6.42+i*.585
    o=box('RECEIVER · walnut tabletop board %02d'%i,(.35,y,.91),(12,.582,.18),wood,TABLE,.018)
box('Table front apron',(.35,-6.74,.67),(12,.12,.44),wood,TABLE,.025)
for x in [-4.5,4.6]:box('Table legs',(x,-1.95,.25),(.21,.25,1.25),dark,TABLE,.018)

# Real cloth mesh with a flat footprint for the ceramic, soft folds and ragged edge.
nx,ny=144,92;verts=[];faces=[]
def cloth_z(x,y):
    r=math.hypot(x+1,y)
    flat=max(0,min(1,(r-.7)/.5))
    return 1.042+flat*(.036*math.sin(x*2.4+y*2)+.009*math.sin(y*8-x*2)+.006*math.cos(x*9+y*5))
for j in range(ny+1):
    for i in range(nx+1):
        x=-3.5+5.8*i/nx;y=-1.59+3.1*j/ny
        x+=.008*math.sin(j*1.7)*(abs(i-nx/2)/(nx/2))**8
        y+=.018*math.sin(i*.8)*(abs(j-ny/2)/(ny/2))**8
        verts.append((x,y,cloth_z(x,y)))
for j in range(ny):
    for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Linen drape mesh');mesh.from_pydata(verts,[],faces);mesh.update()
cloth=bpy.data.objects.new('RECEIVER · woven flax with gentle folds',mesh);TABLE.objects.link(cloth);mesh.materials.append(linen)
for p in mesh.polygons:p.use_smooth=True
solid=cloth.modifiers.new('Thin natural fabric','SOLIDIFY');solid.thickness=.002
for i in range(210):
    x=-3.5+5.8*(i+.4)/210
    for y,sgn in [(-1.6,-1),(1.52,1)]:
        length=random.uniform(.04,.11);z=cloth_z(x,y)
        curve('Loose flax fringe',[(x,y,z),(x+.01,y+sgn*length*.5,z-.006),(x-.012,y+sgn*length,z-.011)],thread,.0016,TABLE)
for i in range(82):
    y=-1.6+3.1*i/82
    for x,sgn in [(-3.5,-1),(2.3,1)]:
        z=cloth_z(x,y);curve('Side frayed thread',[(x,y,z),(x+sgn*.08,y+.013,z-.005)],thread,.0014,TABLE)

# Individual crossed fibres make the open flax weave legible in grazing light.
for j in range(240):
    y=-1.58+3.08*j/239
    points=[(x,y,cloth_z(x,y)+.0025+.0006*math.sin(i*math.pi)) for i in range(33) for x in [-3.49+5.78*i/32]]
    curve('Woven linen weft',points,thread,.0014,TABLE)
for i in range(400):
    x=-3.49+5.78*i/399
    points=[(x,y,cloth_z(x,y)+.003+.0006*math.sin(j*math.pi)) for j in range(19) for y in [-1.58+3.08*j/18]]
    curve('Woven linen warp',points,thread,.0014,TABLE)

def lathe(name,profile,loc,mat,segments=96):
    vv=[];ff=[]
    for r,z in profile:
        for i in range(segments):a=i*2*math.pi/segments;vv.append((r*math.cos(a),r*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;ff.append((a,b,b+segments,a+segments))
    m=bpy.data.meshes.new(name);m.from_pydata(vv,[],ff);m.update();o=bpy.data.objects.new(name,m);PROPS.objects.link(o);o.location=loc;m.materials.append(mat)
    for p in m.polygons:p.use_smooth=True
    return o
cup=lathe('Tea cup · thrown stoneware',[(0,0),(.29,0),(.32,.06),(.40,.13),(.47,.36),(.48,.65),(.45,.67),(.43,.60),(.42,.35),(.33,.16),(0,.15)],(-3.78,-.56,1.03),stoneware)
lathe('Still amber tea',[(0,0),(.428,0)],(-3.78,-.56,1.56),tea)
box('Small tea tray',(-4.10,-1.55,1.055),(1.65,.92,.15),wood,PROPS,.06)
curve('Tea scoop',[(-4.54,-1.3,1.155),(-4.26,-1.42,1.17),(-3.73,-1.4,1.15)],dark,.055)
pitcher=lathe('Branch vase · chalk stoneware',[(0,0),(.27,0),(.31,.11),(.38,.7),(.3,1.25),(.19,1.45),(.19,1.6),(.15,1.61),(.14,1.3),(.24,.85),(.22,.2),(0,.17)],(-3.35,2.1,1.04),stoneware)

# Branches and leaves cast actual sun shadows on the lime wall.
def leaf(name,center,direction,size):
    axis=Vector(direction).normalized();side=axis.cross(Vector((0,0,1))).normalized();up=axis.cross(side).normalized();vv=[];ff=[]
    for j in range(9):
        t=j/8;mid=Vector(center)+axis*(t-.5)*size
        width=math.sin(math.pi*t)*size*.30
        for k in range(3):p=mid+side*(k-1)*width+up*(.03*size*math.sin(math.pi*t)*(1-abs(k-1)));vv.append(tuple(p))
    for j in range(8):
        for k in range(2):a=j*3+k;ff.append((a,a+1,a+4,a+3))
    m=bpy.data.meshes.new(name);m.from_pydata(vv,[],ff);m.update();o=bpy.data.objects.new(name,m);PROPS.objects.link(o);m.materials.append(leafmat)
    for p in m.polygons:p.use_smooth=True
base=Vector((-3.35,2.1,2.52))
for k,end in enumerate([(-4.15,1.6,5.55),(-3.5,2.5,5.7),(-2.65,2.0,5.5),(-3.75,2.6,4.9)]):
    end=Vector(end)
    # Keep all four stems inside the .14-radius opening until above the lip.
    root=base+Vector(((k-1.5)*.025,((k%2)-.5)*.04,0))
    neck=Vector((root.x,root.y,2.80));points=[tuple(root),tuple(neck)]
    for j in range(1,11):
        t=j/10;v=neck.lerp(end,t);v.x+=.12*math.sin(t*math.pi);points.append(tuple(v))
    stem=curve('Tea branch %02d'%k,points,branchmat,.014)
    from mathutils.geometry import interpolate_bezier
    b=stem.data.splines[0].bezier_points
    for p,q in zip(b,b[1:]):
        for sample in interpolate_bezier(p.co,p.handle_right,q.handle_left,q.co,48):
            if sample.z<=2.68:
                assert math.hypot(sample.x+3.35,sample.y-2.1)+.014<.14,'Stem intersects branch-vase neck'
    for j in range(5,12):
        p=Vector(points[j]);sign=1 if j%2 else -1
        tip=p+Vector((sign*random.uniform(.24,.46),random.uniform(-.24,.22),random.uniform(.08,.25)))
        curve('Leaf stem',[tuple(p),tuple(tip)],branchmat,.005)
        leaf('Olive green leaf',tuple(tip),tuple((tip-p)+Vector((0,-.14,0))),random.uniform(.30,.48))
        if j%2:leaf('Second small leaf',tuple(p+Vector((-.18,.06,.1))),(-.3,.12,.14),.34)

# A layered garden of individual leaves replaces visibly polygonal canopy blobs.
garden=material('GARDEN · soft moss floor',(.07,.105,.025),.96)
leaf_palette=[]
for i,color in enumerate([(.045,.10,.018),(.085,.16,.028),(.16,.235,.055),(.26,.31,.095)]):
    mat=leafmat.copy();mat.name='GARDEN · leaf tone %02d'%i
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1);leaf_palette.append(mat)
leaf('Garden leaf template',(0,0,0),(0,1,.1),1)
template=bpy.data.objects.get('Garden leaf template');leafmesh=template.data;bpy.data.objects.remove(template,do_unlink=True)
def garden_leaf(name,position,size):
    o=bpy.data.objects.new(name,leafmesh);PROPS.objects.link(o);o.location=position;o.scale=(size,size,size)
    o.rotation_euler=(random.uniform(-1.1,1.1),random.uniform(-1.0,1.0),random.uniform(-math.pi,math.pi))
    o.material_slots[0].link='OBJECT';o.material_slots[0].material=random.choice(leaf_palette);return o
for n,(x,y,z) in enumerate([(-8,-2,3),(-10,2,4),(-12,5,4),(-9,-5,5),(-8,5,2)]):
    curve('Garden tree trunk %02d'%n,[(x,y,-.3),(x+.15,y,2),(x-.4,y+.2,4),(x-.7,y+.5,6.5)],branchmat,.10)
    for k in range(10):
        angle=k*2.4;center=Vector((x+random.uniform(-.8,.8),y+math.cos(angle)*1.7,z+math.sin(angle)*1.5))
        curve('Garden fine branch',[(x,y,2.5),tuple(center),tuple(center+Vector((-.4,.2,.55)))],branchmat,.012)
        for j in range(70):
            pos=center+Vector((random.gauss(0,.55),random.gauss(0,.65),random.gauss(0,.6)))
            garden_leaf('Garden distant individual leaf',tuple(pos),random.uniform(.22,.42))
box('Garden ground',(-10,0,-.15),(15,25,.1),garden,PROPS)
# This sparse near canopy is between the sun and window; its real geometry is
# also exported to cast matching leaf shadows on the interactive ceramic.
for k in range(8):
    start=Vector((-5.15,-2.15+k*.56,4.05+random.uniform(0,1.5)))
    end=start+Vector((random.uniform(-.35,.2),random.uniform(.3,.65),random.uniform(.7,1.2)))
    obj=curve('SUNSCREEN · garden twig',[tuple(start),tuple(start.lerp(end,.55)+Vector((-.1,0,.05))),tuple(end)],branchmat,.012)
    obj.visible_camera=False
    for j in range(18):
        t=random.uniform(.1,1);pos=start.lerp(end,t)+Vector((random.uniform(-.25,.25),random.uniform(-.3,.3),random.uniform(-.18,.18)))
        obj=garden_leaf('SUNSCREEN · sunlit leaf',tuple(pos),random.uniform(.24,.48));obj.visible_camera=False

# Foreground chair is cropped and out of focus, framing the right edge.
curve('Curved chair back',[(4.75,-5.3,.9),(4.75,-5.25,1.65),(4.67,-5.1,2.2),(4.38,-4.95,2.35),(3.88,-4.92,2.36)],dark,.10)
curve('Chair spindle',[(4.13,-5.05,.65),(4.13,-5.05,2.22)],dark,.06)

def area(name,loc,target,power,color,size,size_y=None):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='RECTANGLE';data.size=size;data.size_y=size_y or size
    obj=bpy.data.objects.new(name,data);LIGHTS.objects.link(obj);obj.location=loc;aim(obj,target);return obj
sun_data=bpy.data.lights.new('Warm afternoon sun','SUN');sun_data.energy=3.9;sun_data.color=(1,.80,.54);sun_data.angle=.035
sun=bpy.data.objects.new('Warm afternoon sun',sun_data);LIGHTS.objects.link(sun);sun.location=(-9,-3.4,8);aim(sun,(-1,0,1.7))
area('Open window · cool sky soft reflection',(-4.05,-1.55,4.1),(-1,0,2.3),260,(1,.91,.78),3.3,4.3)
area('Camera side gentle bounce',(2,-5,5),(-1,0,2.1),90,(1,.87,.70),4,4)
area('Garden sunlight glow',(-10,-1,8),(-10,1,2),950,(1,.92,.7),6,6)
world=bpy.data.worlds.new('Blue sky beyond the window');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.46,.63,.83,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.13;scene.world=world

focus=bpy.data.objects.new('FOCUS · front glazed shoulder',None);CAMERAS.objects.link(focus);focus.location=(-1,-.65,2.8)
def camera(name,loc,target,lens=58,fstop=.30):
    data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);CAMERAS.objects.link(o);o.location=loc;aim(o,target);data.lens=lens;data.sensor_width=36
    data.dof.use_dof=True;data.dof.focus_object=focus;data.dof.aperture_fstop=fstop;return o
main=camera('CAMERA · full window portrait',(2.7,-16.1,4.4),(.15,.1,2.5))
above=camera('CAMERA · above linen',(2.8,-12.8,8.5),(.15,.1,2.4),fstop=.70)
detail=camera('CAMERA · detail glazed shoulder',(3.8,-10.2,4.9),(.05,0,2.55),lens=66,fstop=.22)
scene.camera=main
scene.render.engine='CYCLES';scene.cycles.samples=40 if DRAFT else 112;scene.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU'
except:scene.cycles.device='CPU'
scene.render.resolution_x=1600 if DRAFT else 1920;scene.render.resolution_y=900 if DRAFT else 1080;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
# A little suspended air softens distant foliage and reveals the slant of the sun.
air=bpy.data.materials.new('AIR · thin warm afternoon haze');air.use_nodes=True;air.node_tree.nodes.clear()
out=node(air,'ShaderNodeOutputMaterial','Air output');volume=node(air,'ShaderNodeVolumePrincipled','Fine suspended air');volume.inputs['Density'].default_value=.002;volume.inputs['Color'].default_value=(.72,.66,.49,1);volume.inputs['Anisotropy'].default_value=.25;link(air,volume,'Volume',out,'Volume')
box('Afternoon air volume',(-2,0,3),(22,24,12),air,LIGHTS)
# Keep the subtle highlight glow from the gallery compositor.
scene['art_direction']='Window afternoon / warm lime wall, walnut, linen and cast leaf shadows.'
scene['reference']='design-concepts/living-mood-v1.png; composition reference only.'
scene['website_note']='Integrated with the root webpage via calibrated clean plates, HDR and a shadow receiver.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'living-scene.blend'))
scene.render.filepath=str(ROOT/('living-draft.png' if DRAFT else 'living-final.png'))
bpy.ops.render.render(write_still=True)
print('LIVING_SCENE_READY',flush=True)
