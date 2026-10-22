"""Build modest tier-one upgrades from the actual CC0 Adventurers meshes.

blender --background --python tools/build-tier1-weapons.py

Original silhouettes, bevels, UV gradients and grip coordinates are preserved.
Fittings use spare cells in a copy of each source texture atlas. Each GLB has
one mesh, one material and an embedded texture. The .blend retains named parts.
"""
import bpy
import math
import os
from array import array
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'src', 'assets', 'library', 'adventurers', 'objects')
OUT = os.path.join(ROOT, 'src', 'assets', 'models', 'items', 'tier1')
os.makedirs(OUT, exist_ok=True)

# Builders use game coordinates: X side, Y up, Z front.
def xyz(v): return Vector((v[0], -v[2], v[1]))
def game(v): return Vector((v[0], v[2], -v[1]))
def rgb(value): return tuple(int(value[i:i+2], 16)/255 for i in (0, 2, 4))

SWATCHES = {
    'steel': ('cbd3cf', '87989b'), 'iron': ('7c8988', '424e51'),
    'copper': ('c39a70', '79543c'), 'leather': ('9d7253', '543c2f'),
    'stitch': ('d0b58a', '957855'), 'forest': ('819074', '405746'),
    'paper': ('e7dfc8', 'b3aa92'), 'amber': ('dfb16b', '9f6037'),
}
CELLS = {name: (7, i) for i, name in enumerate(SWATCHES)}
PALETTES = {}
MATERIAL = None
BASE = None

def fill_cell(pixels, width, height, col, row, top, bottom):
    cell_w, cell_h = width//8, height//8
    for y in range(cell_h):
        t = y/max(1, cell_h-1)
        color = [bottom[i]*(1-t)+top[i]*t for i in range(3)]
        line = array('f', (*color, 1))*cell_w
        offset = (((7-row)*cell_h+y)*width+col*cell_w)*4
        pixels[offset:offset+cell_w*4] = line

def derived_material(source, family):
    if family in PALETTES: return PALETTES[family]
    original = next(n.image for n in source.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    width, height = original.size
    pixels = array('f', [0])*(width*height*4)
    original.pixels.foreach_get(pixels)
    for color, (top, bottom) in SWATCHES.items():
        fill_cell(pixels, width, height, *CELLS[color], rgb(top), rgb(bottom))
    # Tanned wood/leather: source UVs and broad gradients stay in place.
    fill_cell(pixels, width, height, 5, 2, rgb('bf8c64'), rgb('956142'))
    fill_cell(pixels, width, height, 5, 3, rgb('956142'), rgb('60412f'))
    if family == 'mage':
        fill_cell(pixels, width, height, 6, 4, rgb('e8c27c'), rgb('c5914e'))
        fill_cell(pixels, width, height, 6, 5, rgb('c5914e'), rgb('8c5939'))
        for row, a, b in [(4, '78866e', '526d59'), (5, '526d59', '354c42')]:
            fill_cell(pixels, width, height, 2, row, rgb(a), rgb(b))
            fill_cell(pixels, width, height, 1, row, rgb(a), rgb(b))
    image = bpy.data.images.new('Brumaluz_'+family+'_tier1_atlas', width, height, alpha=True)
    image.colorspace_settings.name = original.colorspace_settings.name
    image.pixels.foreach_set(pixels); image.update(); image.pack()
    material = bpy.data.materials.new('Adventurers_'+family+'_tier1')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .78
    shader.inputs['Metallic'].default_value = .02
    texture = nodes.new('ShaderNodeTexImage'); texture.image = image
    texture.interpolation = 'Linear'; nodes.active = texture
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    material.diffuse_color = (.44, .48, .40, 1)
    PALETTES[family] = material
    return material

def palette_uv(obj, color):
    obj.data.materials.append(MATERIAL)
    col, row = CELLS[color]
    layer = obj.data.uv_layers.new(name='UVMap')
    vertices = [game(v.co) for v in obj.data.vertices]
    low = min(v.y for v in vertices); high = max(v.y for v in vertices)
    for polygon in obj.data.polygons:
        for loop in polygon.loop_indices:
            v = vertices[obj.data.loops[loop].vertex_index]
            t = (v.y-low)/(high-low) if high-low > .00001 else .6
            layer.data[loop].uv = ((col+.5)/8, 1-(row+.86-.72*t)/8)
    return obj

def mesh(name, vertices, faces, color):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in vertices], [], faces); data.update()
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    return palette_uv(obj, color)

def bevel(obj, width=.005):
    modifier = obj.modifiers.new('Small crafted edge', 'BEVEL'); modifier.width=width; modifier.segments=1
    modifier = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL'); modifier.keep_sharp=True
    return obj

def box(name, center, size, color, edge=.004):
    x,y,z=center; a,b,c=[v/2 for v in size]
    signs=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
    points=[(x+i*a,y+j*b,z+k*c) for i,j,k in signs]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
    obj=mesh(name,points,faces,color)
    return bevel(obj,edge) if edge else obj

def tube(name, a, b, radius, color, sides=8, end_radius=None):
    a,b=Vector(a),Vector(b); axis=(b-a).normalized()
    u=axis.cross(Vector((0,1,0)) if abs(axis.y)<.9 else Vector((1,0,0))).normalized()
    v=axis.cross(u); r2=radius if end_radius is None else end_radius
    vertices=[p+r*(math.cos(i*math.tau/sides)*u+math.sin(i*math.tau/sides)*v) for p,r in [(a,radius),(b,r2)] for i in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return mesh(name,vertices,faces,color)

def ring(name, center, radius, width, color, thickness=.006, axis=(0,1,0), sides=12):
    center=Vector(center); axis=Vector(axis).normalized()
    u=axis.cross(Vector((0,0,1)) if abs(axis.z)<.9 else Vector((1,0,0))).normalized(); v=axis.cross(u)
    vertices=[]
    for y,r in [(-width/2,radius-thickness),(width/2,radius-thickness),(-width/2,radius),(width/2,radius)]:
        vertices += [center+axis*y+r*(math.cos(i*math.tau/sides)*u+math.sin(i*math.tau/sides)*v) for i in range(sides)]
    faces=[]
    for a,b in [(0,1),(2,0),(1,3),(3,2)]:
        faces += [(a*sides+i,a*sides+(i+1)%sides,b*sides+(i+1)%sides,b*sides+i) for i in range(sides)]
    return mesh(name,vertices,faces,color)

def lacing(name, bottom, top, rx, rz, turns=4, radius=.0035, color='stitch'):
    # One continuous strip gives clean joins and a small triangle count.
    steps=turns*12; sides=5; vertices=[]
    for i in range(steps+1):
        t=i/steps; angle=t*math.tau*turns
        center=Vector((rx*math.cos(angle),bottom+(top-bottom)*t,rz*math.sin(angle)))
        outward=Vector((math.cos(angle),0,math.sin(angle))); up=Vector((0,1,0))
        vertices += [center+radius*(math.cos(j*math.tau/sides)*outward+math.sin(j*math.tau/sides)*up) for j in range(sides)]
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(steps) for j in range(sides)]
    return mesh(name,vertices,faces,color)

def projected(x,y,side=1,offset=.002):
    hit,p,_,_=BASE.ray_cast(xyz((x,y,side*3)),xyz((0,0,-side)))
    if not hit: return None
    p=game(p); p.z += side*offset
    return p

def inlay(name, coords, width, color, side=1):
    vertices=[]
    for x,y in coords:
        a,b=projected(x-width/2,y,side),projected(x+width/2,y,side)
        if a is None or b is None: return
        vertices += [a,b]
    obj=mesh(name,vertices,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(coords)-1)],color)
    # Thin surface inlays can be viewed on either side without flipped normals.
    if side<0:
        for polygon in obj.data.polygons: polygon.flip()
    return obj

def rivet(name, x,y, radius=.012, color='copper', side=1):
    p=projected(x,y,side)
    if p is None: return
    return tube(name,p,p+Vector((0,0,side*.007)),radius,color,8,radius*.8)

def sword():
    # Source shoulders, small nicks and broad hand-cut point are retained.
    for v in BASE.data.vertices:
        if v.co.z>.27: v.co.x*=1.045
    BASE.data.update()
    ring('Sword | grip ferrule', (0,.125,0), .058,.024,'copper',thickness=.008)
    ring('Sword | heel ferrule', (0,-.143,0), .058,.022,'iron',thickness=.008)
    lacing('Sword | continuous leather seam',-.12,.105,.055,.055,5,.0035,'leather')
    for side in (-1,1):
        inlay('Sword | recessed fuller',[(0,.37),(0,.72),(0,1.16)],.012,'iron',side)
        for x in (-.18,.18): rivet('Sword | peened guard pin',x,.20,.013,'copper',side)
        rivet('Sword | pommel pin',0,-.32,.016,'copper',side)
    box('Sword | short ricasso collar',(0,.275,0),(.17,.045,.075),'iron',.007)

def shield():
    for x in (-.19,-.065,.065,.19):
        inlay('Shield | recessed oak board join',[(x,-.25),(x,0),(x,.27)],.005,'leather')
    for x,y in [(-.355,.31),(.355,.31),(-.32,.03),(.32,.03),(-.19,-.31),(.19,-.31),(0,-.465)]:
        rivet('Shield | low peened rim rivet',x,y,.016)
    p=projected(0,-.025)
    tube('Shield | shallow steel boss',p,p+Vector((0,0,.022)),.082,'iron',12,.067)
    ring('Shield | boss washer',p+Vector((0,0,.024)),.055,.009,'copper',.008,(0,0,1))
    tube('Shield | boss central pin',p+Vector((0,0,.022)),p+Vector((0,0,.031)),.019,'steel',8,.015)
    for x in (-.12,.12):
        box('Shield | back strap buckle',(x,0,-.154),(.035,.10,.014),'copper',.004)
        for y in (-.022,.022): tube('Shield | strap stitching',(x-.008,y,-.164),(x+.008,y+.008,-.164),.002,'stitch',4)

def staff():
    ring('Staff | fitted neck band',(0,.595,0),.113,.030,'copper',.008)
    ring('Staff | lower shaft sleeve',(0,-.58,0),.053,.045,'iron',.007)
    ring('Staff | shaft collar',(0,.38,0),.060,.035,'copper',.007)
    lacing('Staff | grip seam',-.12,.12,.083,.083,4,.004,'leather')
    for x in (-.065,.065): rivet('Staff | neck peen',x,.595,.011,'iron')
    for x,y in [(.26,1.01),(.20,.84)]: rivet('Staff | focus mounting pin',x,y,.015,'copper')
    inlay('Staff | carved shaft seam',[(.015,-.55),(.015,-.32),(.015,-.19)],.006,'leather')

def dagger():
    for v in BASE.data.vertices:
        if v.co.z>.25: v.co.x*=1.035
    BASE.data.update()
    lacing('Dagger | fitted leather seam',-.118,.111,.051,.032,4,.003,'leather')
    ring('Dagger | grip heel',(0,-.14,0),.053,.018,'copper',.007,sides=8)
    for side in (-1,1):
        for x in (-.076,.076): rivet('Dagger | flush guard stud',x,.196,.008,'copper',side)
        inlay('Dagger | short spine finish',[(.012,.34),(.012,.54),(.025,.74)],.006,'steel',side)

def wand():
    # Keep the crooked wood and small tip appropriate to beginner equipment.
    ring('Wand | upper grip band',(0,.12,0),.082,.022,'copper',.007)
    ring('Wand | lower grip band',(0,-.126,0),.082,.020,'iron',.007)
    ring('Wand | end-grain cap',(0,-.237,0),.058,.022,'iron',.007)
    for y in (-.07,0,.07):
        for x in (-.033,.033): rivet('Wand | grip stitching',x,y,.003,'stitch')
    ring('Wand | small focus setting',(-.039,.695,0),.024,.025,'copper',.006,axis=(-.47,.883,0),sides=8)
    tube('Wand | small amber inset',(-.045,.708,0),(-.057,.731,0),.019,'amber',8,.007)

def book():
    # Native covers face +/-X. Fittings follow the original grip orientation.
    for side in (-1,1):
        x=side*.119
        for y in (-.238,.238):
            for z in (-.125,.163):
                box('Book | corner cap upright',(x,y,z),(.012,.075,.018),'copper',.003)
                box('Book | corner cap return',(x,y+(-.025 if y<0 else .025),z-.018),(.012,.022,.055),'copper',.003)
        for y in [-.19+i*.038 for i in range(11)]:
            tube('Book | cover stitching',(x,y,.167),(x,y+.012,.160),.0018,'stitch',4)
        vertices=[(side*.126,0,.043),(side*.126,.048,.078),(side*.126,0,.113),(side*.126,-.048,.078)]
        mesh('Book | pressed leaf seal',vertices,[(0,1,2,3) if side>0 else (3,2,1,0)],'copper')
    for y in [-.216+i*.027 for i in range(17)]:
        box('Book | individual page edge', (0,y,.185),(.100,.0018,.0025),'paper',0)
    for y in (-.17,.17): box('Book | sewn spine rib',(0,y,-.207),(.242,.025,.017),'leather',.003)
    mesh('Book | cloth bookmark',[(-.014,-.235,.151),(.014,-.235,.151),(.014,-.344,.114),(0,-.329,.114),(-.014,-.344,.114)],[(4,3,2,1,0)],'forest')

def crossbow():
    # Native recurved limbs, trigger housing and profiled wooden stock stay intact.
    for side in (-1,1):
        box('Crossbow | stock side plate',(side*.104,.045,.42),(.014,.095,.20),'iron',.006)
        for z in (.35,.49):
            tube('Crossbow | side plate pin',(side*.112,.045,z),(side*.120,.045,z),.010,'copper',8,.008)
        box('Crossbow | leather limb binding',(side*.34,.106,.698),(.045,.071,.060),'leather',.005)
        tube('Crossbow | limb binding stud',(side*.34,.142,.698),(side*.34,.150,.698),.009,'copper',8,.007)
    for z in (.27,.55):
        box('Crossbow | inset sight bridge',(0,.196,z),(.073,.013,.024),'iron',.004)
    box('Crossbow | rail inlay',(0,.202,.414),(.012,.008,.22),'steel',.002)
    for z in (-.12,-.06,0): box('Crossbow | padded grip strap',(0,-.135,z),(.145,.018,.014),'leather',.004)

ITEMS=[
    ('espada_cobre_t1','Espada de la Hoja de Cobre','sword_1handed','knight',sword),
    ('escudo_roble_t1','Escudo de roble reforzado','shield_badge','knight',shield),
    ('baston_ambar_t1','Bastón de ámbar','staff','mage',staff),
    ('daga_cazador_t1','Daga del cazador','dagger','rogue',dagger),
    ('daga_secundaria_cazador_t1','Daga secundaria del cazador','dagger','rogue',dagger),
    ('varita_ambar_t1','Varita de ámbar','wand','mage',wand),
    ('grimorio_verde_t1','Grimorio del sello verde','spellbook_closed','mage',book),
    ('ballesta_roble_t1','Ballesta de roble reforzada','crossbow_1handed','rogue',crossbow),
]

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
roots=[]
for key,title,reference,family,details in ITEMS:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SOURCE,reference+'.glb'))
    BASE=next(o for o in bpy.data.objects if o not in before and o.type=='MESH')
    BASE.data.transform(BASE.matrix_world); BASE.matrix_world=Matrix.Identity(4)
    BASE.name=key+' | original shaped body'
    MATERIAL=derived_material(BASE.data.materials[0],family)
    BASE.data.materials.clear(); BASE.data.materials.append(MATERIAL)
    details()
    pieces=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    root=bpy.data.objects.new(key,None); bpy.context.collection.objects.link(root)
    root['item_id']=key; root['tier']=1; root['display_name']=title
    root['source']='KayKit Adventurers 2.0 / '+reference+' (CC0, Kay Lousberg)'
    root['revision']='Reference mesh pass: original UV gradients and grip space'
    for piece in pieces: piece.parent=root
    # Evaluated duplicates are joined for export; construction parts stay editable.
    bpy.ops.object.select_all(action='DESELECT'); duplicates=[]
    for piece in pieces:
        duplicate=piece.copy(); duplicate.data=piece.data.copy(); duplicate.parent=None
        bpy.context.collection.objects.link(duplicate); duplicate.select_set(True); duplicates.append(duplicate)
    bpy.context.view_layer.objects.active=duplicates[0]
    bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
    exported=bpy.context.object; exported.name=key+'_mesh'
    export_root=bpy.data.objects.new(key+'_export',None); bpy.context.collection.objects.link(export_root)
    for prop,value in root.items(): export_root[prop]=value
    exported.parent=export_root; export_root.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,key+'.glb'), export_format='GLB',
        use_selection=True,export_apply=True,export_yup=True,export_extras=True)
    bpy.data.objects.remove(exported,do_unlink=True); bpy.data.objects.remove(export_root,do_unlink=True)
    roots.append(root)

# Equal-size display bays affect the master scene only, never exported grip space.
for i,root in enumerate(roots):
    if ITEMS[i][2]=='spellbook_closed': root.rotation_euler.z=-math.pi/2
    if ITEMS[i][2]=='crossbow_1handed': root.rotation_euler.x=-.7
    bpy.context.view_layer.update()
    points=[obj.matrix_world@Vector(v) for obj in root.children for v in obj.bound_box]
    low=Vector(tuple(min(p[k] for p in points) for k in range(3)))
    high=Vector(tuple(max(p[k] for p in points) for k in range(3)))
    root.scale*=1.8/max(high-low)
    center=(low+high)*.5*root.scale.x
    root.location=Vector(((i%4)*2.7,(i//4)*3.6,1.15))-center

scene=bpy.context.scene
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.70,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.camera_add(location=(6,-12,9))
camera=bpy.context.object; camera.name='Review camera'
camera.rotation_euler=(Vector((4.05,1.8,1.2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=11.4; scene.camera=camera
for loc,power,size in [((1,-5,8),950,7),((9,2,6),700,6)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    lamp=bpy.context.object; lamp.data.energy=power; lamp.data.shape='DISK'; lamp.data.size=size
    lamp.rotation_euler=(Vector((4,1,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES'; scene.cycles.samples=20; scene.cycles.use_denoising=True
scene.render.resolution_x=2000; scene.render.resolution_y=1250; scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
scene.render.image_settings.file_format='PNG'; scene.render.filepath=os.path.join(OUT,'tier1_preview.png')
scene.render.film_transparent=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'tier1_weapons.blend'))
bpy.ops.render.render(write_still=True)
