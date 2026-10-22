"""Build editable category 2 weapon models in Blender and export item-ready GLBs.

Run from Blender's scripting console or CLI:
  blender --background --python tools/build-tier2-weapons.py

The scene uses the Adventurers pack's low-poly proportions, warm wood/leather,
muted steel and small class-colour accents. Each export has its origin at the grip.
"""
import bpy
import math
import os
import bmesh
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'assets', 'models', 'items', 'tier2')
os.makedirs(OUT, exist_ok=True)

MATS = {}
def mat(name, color, metal=0.0, rough=.72):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m

mat('Leather · chestnut', (.25,.115,.055)); mat('Wood · honey', (.43,.25,.10))
mat('Iron · blue grey', (.31,.39,.43), .62, .4); mat('Steel edge', (.68,.76,.77), .78, .3)
mat('Brass', (.69,.46,.16), .62, .38); mat('Cloth · forest', (.19,.31,.20))
mat('Cloth · violet', (.30,.22,.42)); mat('Crystal · amber', (.91,.58,.18), .18, .3)
mat('Book · oxblood', (.34,.12,.10)); mat('Paper', (.77,.65,.43))
mat('String', (.84,.75,.56)); mat('Shadow steel', (.19,.25,.28), .55, .45)

def assign(obj, material):
    obj.data.materials.append(MATS[material])
    return obj

def bevel(obj, width=.025):
    mod=obj.modifiers.new('Small hand-cut bevels','BEVEL'); mod.width=width; mod.segments=1
    obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj

def cube(name, loc, scale, material, bevel_width=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o,material)
    if bevel_width: bevel(o,bevel_width)
    return o

def ico(name, loc, scale, material, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; assign(o,material)
    return o

def cylinder(name, a, b, radius, material, vertices=8, r2=None):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if r2 is None else r2,
                                    depth=d.length, location=(a+b)/2)
    o=bpy.context.object; o.name=name; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y')
    assign(o,material); bevel(o,.008); return o

def band(name, z, radius, material='Brass', thickness=.018):
    bpy.ops.mesh.primitive_torus_add(major_segments=16, minor_segments=4, major_radius=radius,
                                   minor_radius=thickness, location=(0,0,z))
    o=bpy.context.object; o.name=name; assign(o,material); return o

def wrap(name, bottom, top, radius, turns=5):
    # A real raised spiral follows the cylindrical grip, visible from every angle.
    points=[(radius*math.cos(t*math.tau*turns),radius*math.sin(t*math.tau*turns),bottom+(top-bottom)*t)
            for t in [i/(turns*10) for i in range(turns*10+1)]]
    for a,b in zip(points,points[1:]): cylinder(name,a,b,.009,'Wood · honey',4)

def inset(name, outline, front, back, material):
    verts=[(x,y,z) for y in (front,back) for x,z in outline]; n=len(outline)
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.materials.append(MATS[material]); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); bevel(o,.007); return o

def blade(name, base, tip, width, material='Steel edge'):
    # A faceted diamond section, broad at the guard and tapering to the point.
    bx,by,bz=base; tx,ty,tz=tip; mid=(bz+tz)*.52
    verts=[(bx-width/2,by,bz),(bx,by-.045,bz),(bx+width/2,by,bz),(bx,by+.045,bz),
           (bx-width*.42,by,mid),(bx,by-.026,mid),(bx+width*.42,by,mid),(bx,by+.026,mid),(tx,ty,tz)]
    faces=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.materials.append(MATS[material]); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); return ob

def guard(name, width=.50, z=.98, material='Brass'):
    cube(name,(0,0,z),(width,.13,.09),material,.025)

def sword():
    blade('Tier I · broad simple blade',(0,0,1.02),(0,0,2.03),.31,'Steel edge')
    cube('Sword · fuller',(0,-.046,1.53),(.035,.012,.72),'Iron · blue grey',.003)
    guard('Sword · brass crossguard',.53,.99)
    cylinder('Sword · leather grip',(0,0,.28),(0,0,.94),.075,'Leather · chestnut',8)
    for z in (.39,.54,.69,.84): cube('Sword · grip wrap',(0,-.078,z),(.12,.025,.025),'Wood · honey',.005)
    ico('Sword · pommel',(0,0,.20),(.12,.12,.13),'Brass')
    wrap('Sword · spiral leather lacing',.32,.90,.078)
    for z in (.30,.93): band('Sword · grip collar',z,.08)
    for x in (-.27,.27):
        cylinder('Sword · swept quillon',(x,0,.99),(x*1.20,0,1.09),.05,'Brass',8,.035)
        ico('Sword · quillon steel cap',(x*1.2,0,1.09),(.055,.07,.05),'Iron · blue grey')
    ico('Sword · forest pommel inlay',(0,-.108,.20),(.042,.018,.052),'Cloth · forest')
    inset('Sword · copper leaf crest',[(-.07,1.04),(0,1.24),(.07,1.04),(0,1.08)],-.048,-.057,'Brass')

def shield():
    # front faces toward -Y, with a simple kite silhouette evocative of the starter badge shield
    outline=[(-.43,1.28),(.43,1.28),(.38,.61),(0,.18),(-.38,.61)]
    verts=[(x,y,z) for y in (-.10,.10) for x,z in outline]
    faces=[(0,1,2,3,4),(9,8,7,6,5)] + [(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    me=bpy.data.meshes.new('Tier I · oak kite shield'); me.from_pydata(verts,[],faces); me.materials.append(MATS['Wood · honey']); me.update()
    ob=bpy.data.objects.new('Tier I · oak kite shield',me); bpy.context.collection.objects.link(ob); bevel(ob,.018)
    # strap boss and class-colour chevron
    ico('Shield · iron boss',(0,-.125,.82),(.17,.055,.20),'Iron · blue grey')
    cube('Shield · green badge',(0,-.17,.83),(.13,.025,.22),'Cloth · forest',.02)
    for x,z in [(-.34,1.18),(.34,1.18),(-.27,.65),(.27,.65),(0,.31)]:
        ico('Shield · brass rivet',(x,-.12,z),(.035,.02,.035),'Brass')
    for a,b in zip(outline,outline[1:]+outline[:1]):
        cylinder('Shield · continuous iron rim',(a[0],-.11,a[1]),(b[0],-.11,b[1]),.038,'Iron · blue grey',6)
    for x in (-.25,-.13,.13,.25):
        cylinder('Shield · plank joint',(x,-.105,.59),(x,-.105,1.21),.006,'Leather · chestnut',4)
    inset('Shield · raised copper chevron',[(-.26,1.07),(0,.88),(.26,1.07),(.26,.98),(0,.79),(-.26,.98)],-.13,-.145,'Brass')
    cylinder('Shield · back handle',(0,.22,.59),(0,.22,.97),.045,'Leather · chestnut')
    for z in (.59,.97): cylinder('Shield · handle mounting',(0,.10,z),(0,.22,z),.04,'Iron · blue grey')

def staff():
    cylinder('Staff · ashwood shaft',(0,0,.12),(0,0,2.28),.065,'Wood · honey',7)
    for z in (.35,.48,1.70,1.83): cylinder('Staff · leather binding',(0,0,z),(0,0,z+.055),.074,'Leather · chestnut',7)
    ico('Staff · amber focus',(0,0,2.43),(.19,.17,.22),'Crystal · amber',2)
    for x,z in [(-.14,2.30),(.14,2.30),(0,2.62)]: cylinder('Staff · brass prong',(0,0,2.22),(x,0,z),.035,'Brass',6,.018)
    wrap('Staff · bound handgrip',.94,1.36,.068,7)
    for z in (.18,.92,1.39,2.17): band('Staff · copper ferrules',z,.066)
    for sign in (-1,1):
        points=[(sign*.05,0,2.14),(sign*.21,0,2.30),(sign*.24,0,2.48),(sign*.12,0,2.65)]
        for a,b in zip(points,points[1:]): cylinder('Staff · forked crystal cradle',a,b,.035,'Brass',6)
    ico('Staff · side emerald',(0,-.075,1.88),(.065,.025,.10),'Cloth · forest')

def dagger():
    blade('Tier I · short steel blade',(0,0,.58),(0,0,1.26),.22,'Steel edge')
    guard('Dagger · short brass guard',.34,.56)
    cylinder('Dagger · leather grip',(0,0,.16),(0,0,.52),.065,'Leather · chestnut',7)
    ico('Dagger · pommel',(0,0,.10),(.09,.09,.08),'Brass')
    wrap('Dagger · laced grip',.19,.48,.066,4)
    band('Dagger · lower collar',.17,.066)
    for side in (-1,1): cylinder('Dagger · hooked guard',(side*.15,0,.56),(side*.21,0,.64),.028,'Brass',6)
    ico('Dagger · green pommel stone',(0,-.075,.10),(.038,.018,.038),'Cloth · forest')
    cube('Dagger · dark blade groove',(0,-.038,.85),(.022,.009,.32),'Iron · blue grey',.002)

def wand():
    cylinder('Wand · carved hazel',(0,0,.10),(0,0,1.18),.045,'Wood · honey',7,.027)
    for z in (.22,.31,1.02): cylinder('Wand · brass collars',(0,0,z),(0,0,z+.035),.052,'Brass',7)
    ico('Wand · amber star',(0,0,1.31),(.12,.11,.14),'Crystal · amber',1)
    wrap('Wand · leather grip winding',.15,.48,.047,5)
    for z in (.14,.50,1.12): band('Wand · engraved collars',z,.048,thickness=.012)
    for x in (-.085,.085): cylinder('Wand · focus cage',(x,0,1.16),(x*.7,0,1.38),.015,'Brass',6)
    ico('Wand · end cap',(0,0,.10),(.062,.062,.055),'Brass')

def book():
    cube('Spellbook · leather cover',(0,0,.56),(.62,.20,.80),'Book · oxblood',.045)
    cube('Spellbook · page block',(0,-.115,.56),(.53,.035,.70),'Paper',.014)
    cube('Spellbook · spine',(0,.11,.56),(.12,.06,.82),'Leather · chestnut',.018)
    cube('Spellbook · brass clasp',(0,-.145,.56),(.10,.035,.17),'Brass',.012)
    cube('Spellbook · forest sigil',(0,-.17,.57),(.25,.025,.30),'Cloth · forest',.025)
    ico('Spellbook · sigil stone',(0,-.193,.57),(.07,.025,.09),'Crystal · amber',1)
    for z in (.29,.38,.74,.83): cube('Spellbook · gilded page edge',(0,-.14,z),(.43,.012,.012),'Brass',.002)
    # Distinct front and back covers, pages inset between them, metal corner caps.
    for y in (-.16,.15): cube('Spellbook · raised cover',(0,y,.56),(.64,.045,.83),'Cloth · forest',.018)
    cube('Spellbook · raised sigil',(0,-.20,.56),(.30,.025,.38),'Brass',.02)
    ico('Spellbook · amber centre',(0,-.233,.56),(.08,.025,.11),'Crystal · amber',2)
    for x in (-.25,.25):
        for z in (.22,.90): cube('Spellbook · brass corner',(x,-.19,z),(.12,.025,.12),'Brass',.018)
    for z in (.29,.83): cube('Spellbook · spine bands',(-.32,0,z),(.035,.34,.05),'Brass',.01)
    for z in (.35,.41,.47,.63,.69,.75): cube('Spellbook · individual page lines',(.28,0,z),(.008,.20,.006),'Leather · chestnut',.001)
    cube('Spellbook · bookmark',(.14,-.02,.10),(.055,.03,.16),'Book · oxblood',.004)

def crossbow():
    # Grip at the origin; limbs span X and stock points upward in the held view.
    cube('Crossbow · walnut stock',(0,0,.63),(.18,.16,1.02),'Wood · honey',.025)
    cube('Crossbow · steel rail',(0,-.095,1.14),(.11,.05,.64),'Iron · blue grey',.012)
    cylinder('Crossbow · prod left',(-.72,0,1.34),(0,0,1.29),.065,'Wood · honey',7,.045)
    cylinder('Crossbow · prod right',(0,0,1.29),(.72,0,1.34),.045,'Wood · honey',7,.065)
    cylinder('Crossbow · left string',(-.72,-.035,1.34),(0,-.14,.96),.010,'String',6)
    cylinder('Crossbow · right string',(0,-.14,.96),(.72,-.035,1.34),.010,'String',6)
    cube('Crossbow · trigger guard',(0,-.11,.38),(.24,.035,.24),'Brass',.025)
    cube('Crossbow · stirrup',(0,0,.07),(.26,.13,.08),'Iron · blue grey',.018)
    cylinder('Crossbow · bolt',(-.02,-.14,1.18),(-.02,-.14,1.72),.018,'Steel edge',6,.006)
    for side in (-1,1):
        cylinder('Crossbow · recurved tip',(side*.72,0,1.34),(side*.76,0,1.47),.04,'Iron · blue grey',6,.028)
        cube('Crossbow · limb binding',(side*.46,0,1.32),(.065,.16,.13),'Brass',.01)
    for z in (.46,.60,.75): cube('Crossbow · stock straps',(0,0,z),(.20,.18,.035),'Leather · chestnut',.01)
    cube('Crossbow · latch housing',(0,-.10,.93),(.20,.09,.12),'Iron · blue grey',.02)
    for side in (-1,1): cube('Crossbow · bolt fletching',(side*.038,-.15,1.19),(.045,.022,.12),'Cloth · forest',.004)
    ico('Crossbow · steel bolt head',(-.02,-.14,1.74),(.04,.03,.095),'Steel edge')

BUILDERS=[
 ('espada_cobre_t2','Category 2 · Copperleaf sword',sword),
 ('escudo_roble_t2','Category 2 · Oak kite shield',shield),
 ('baston_ambar_t2','Category 2 · Amberwood staff',staff),
 ('daga_cazador_t2','Category 2 · Hunter dagger',dagger),
 ('daga_secundaria_cazador_t2','Category 2 · Hunter offhand dagger',dagger),
 ('varita_ambar_t2','Category 2 · Amber wand',wand),
 ('grimorio_verde_t2','Category 2 · Greenbound spellbook',book),
 ('ballesta_roble_t2','Category 2 · Oak crossbow',crossbow),
]

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for key,title,build in BUILDERS:
    before=set(bpy.data.objects)
    build()
    created=[o for o in bpy.data.objects if o not in before]
    # Bake bevels and join the decorative components. One mesh, a few shared
    # material primitives, rather than dozens of separate objects per weapon.
    bpy.ops.object.select_all(action='DESELECT')
    for o in created: o.select_set(True)
    bpy.context.view_layer.objects.active=created[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    mesh=bpy.context.object; mesh.name=key+'_mesh'
    mesh.data.transform(mesh.matrix_world); mesh.matrix_world=Matrix.Identity(4)
    grip,scale=(.60,.95) if build==sword else (.76,1.0) if build==shield else (1.24,.86) if build==staff else (.34,1.0) if build==dagger else (.34,.72) if build==wand else (.56,.72) if build==book else (.40,.78)
    transform=Matrix.Scale(scale,4) @ Matrix.Translation((0,0,-grip))
    if build==crossbow: transform=Matrix.Rotation(math.pi/2,4,'X') @ transform
    if build==book: transform=Matrix.Rotation(math.pi/2,4,'Z') @ transform
    mesh.data.transform(transform)
    bm=bmesh.new(); bm.from_mesh(mesh.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh.data); bm.free()
    created=[mesh]
    # Identity root at the same grip as the corresponding Adventurers node.
    root=bpy.data.objects.new(key,None); bpy.context.collection.objects.link(root)
    root['item_id']=key; root['tier']=2; root['display_name']=title
    for o in created: o.parent=root
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root,*created]: o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,key+'.glb'), export_format='GLB',
                              use_selection=True, export_apply=True, export_yup=True)

# Keep every item in the editable master file, laid out as a clean review set.
# Each item root is moved into its own visual bay; GLBs were exported before layout.
for idx,(key,title,_) in enumerate(BUILDERS):
    root=bpy.data.objects.get(key)
    if root:
        root.location.x=(idx%4)*2.6
        root.location.y=(idx//4)*3.1
        root.location.z=1.08
bpy.ops.object.select_all(action='DESELECT')
bpy.context.scene.world.color=(.16,.18,.20)
# A reusable review camera is saved in the master scene.
bpy.ops.object.camera_add(location=(8,-10,8))
camera=bpy.context.object; camera.rotation_euler=(Vector((3.9,1.55,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=11.8; bpy.context.scene.camera=camera
scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=1600; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
shade=scene.display.shading; shade.light='STUDIO'; shade.color_type='MATERIAL'; shade.show_shadows=True; shade.show_cavity=True; shade.cavity_type='BOTH'; shade.background_type='WORLD'
scene.render.filepath=os.path.join(OUT,'tier2_preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'tier2_weapons.blend'))
bpy.ops.render.render(write_still=True)
