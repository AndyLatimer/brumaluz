"""24 additional original meshes: Wandering Oak, Royal Tide and Stellar Forge.
No existing weapon mesh is imported. Run with Blender in background mode.
"""
import bpy, json, os, math
from array import array
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPERS=os.path.join(ROOT,'tools','build-original-weapons.py')
with open(HELPERS,encoding='utf-8') as source:
    exec(compile(source.read().split('\nBUILDERS={')[0],HELPERS,'exec'))
with open(os.path.join(ROOT,'src','data','weaponCollections.json'),encoding='utf-8') as source: ITEMS=json.load(source)
OUT=os.path.join(ROOT,'src','assets','models','items','collections')
os.makedirs(OUT,exist_ok=True)
PALETTES={}; ROOTS=[]

def palette(name):
    if name in PALETTES: return PALETTES[name]
    theme={
      'roble':('c3cdc1','596251','a88b56','745137','80a36a','254731','c6db83'),
      'marea':('e3ece8','668eaa','e5bf70','5d6b7c','5da8b9','1a445f','9de1e0'),
      'forja':('c8cddd','3c3b50','ddbc7f','49414a','b27547','382e3b','ffc175'),
    }[name]
    steel,iron,copper,leather,cloth,dark,gem=theme
    swatches={'steel':(steel,iron),'iron':(iron,dark),'copper':(copper,leather),'leather':(leather,dark),'stitch':('ddcbaa',copper),'forest':(cloth,dark),'paper':('e8dfca','ada48d'),'amber':(gem,cloth)}
    image=bpy.data.images.new(name+'_original_atlas',256,256,alpha=True)
    pixels=array('f',(.65,.65,.65,1))*256*256
    for key,(top,bottom) in swatches.items(): fill_cell(pixels,256,256,*CELLS[key],rgb(top),rgb(bottom))
    image.pixels.foreach_set(pixels); image.update(); image.pack()
    material=bpy.data.materials.new('Original_'+name); material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF'); shader.inputs['Roughness'].default_value=.70 if name=='roble' else .46
    tex=material.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    PALETTES[name]=material
    return material

def star(label,center,radius,inner,color='copper',points=5,thick=.035):
    cx,cy,cz=center
    outline=[(cx+(radius if i%2==0 else inner)*math.cos(math.pi/2+i*math.pi/points),cy+(radius if i%2==0 else inner)*math.sin(math.pi/2+i*math.pi/points)) for i in range(points*2)]
    return profile(label,outline,thick,color,cz)

def leaf(label,center,length,width,color='steel'):
    x,y,z=center
    return profile(label,[(x,y-length/2),(x-width*.6,y-length*.15),(x-width/2,y+length*.16),(x,y+length/2),(x+width/2,y+length*.16),(x+width*.6,y-length*.15)],.05,color,z)

def sword_new():
    grip('Sword handgrip',.38,.052)
    if COLLECTION=='roble':
        leaf('Oak | complete leaf blade',(0,.79,0),1.18,.20)
        tube('Oak | organic guard',(-.18,.20,0),(.18,.20,0),.026,'iron',8)
        for sign in [-1,1]: leaf('Oak | guard leaf',(sign*.12,.25,.018),.15,.065,'copper')
        path('Oak | blade vein',[(0,.32,.036),(0,.80,.03),(0,1.22,.015)],.004,'iron',4)
    elif COLLECTION=='marea':
        profile('Tide | entire hooked khopesh',[(-.05,.20),(-.07,.74),(-.13,1.02),(-.06,1.22),(.16,1.38),(.35,1.29),(.39,1.12),(.26,.94),(.13,.88),(.10,.20)],.085)
        path('Tide | khopesh inlay',[(.025,.35,.048),(.025,.79,.045),(.03,1.03,.04),(.21,1.23,.03)],.007,'copper')
        tube('Tide | fish-tail guard',(-.17,.19,0),(.17,.19,0),.033,'copper',8)
        crystal('Tide | guard pearl',(0,.24,.06),(.043,.048,.025))
    else:
        box('Forge | continuous blade spine',(0,.78,0),(.068,1.15,.065),'iron',.007)
        for i in range(4):
            y=.40+i*.23; width=.19 if i<3 else .14
            profile('Forge | separate blade plate',[(-width/2,y-.10),(-width/2,y+.07),(0,y+.14),(width/2,y+.07),(width/2,y-.10)],.085,'steel')
            crystal('Forge | blade reactor',(0,y,.06),(.024,.035,.014))
        profile('Forge | final spear point',[(-.07,1.17),(0,1.49),(.07,1.17)],.075)
        box('Forge | armoured crossguard',(0,.20,0),(.45,.09,.13),'iron',.018)
        for sign in [-1,1]: star('Forge | guard cap',(sign*.22,.20,.01),.065,.028)

def shield_new():
    if COLLECTION=='roble':
        outline=[(.40*math.cos(math.tau*i/16),.49*math.sin(math.tau*i/16)) for i in range(16)]
        profile('Oak | oval wooden body',outline,.16,'leather')
        for y in [-.30,-.10,.10,.30]: box('Oak | separate plank seam',(0,y,.087),(.64,.013,.008),'iron',.002)
        path('Oak | riveted oval rim',[(x,y,.055) for x,y in outline+[outline[0]]],.023,'iron')
        for x in [-.20,.20]: box('Oak | vertical brace',(x,0,.105),(.047,.78,.028),'copper',.007)
        leaf('Oak | embossed leaf',(0,0,.12),.44,.20,'forest')
    elif COLLECTION=='marea':
        outline=[(-.32,-.30),(-.43,.12),(-.37,.37),(-.25,.48),(-.12,.40),(0,.53),(.12,.40),(.25,.48),(.37,.37),(.43,.12),(.32,-.30),(0,-.48)]
        profile('Royal shell | scalloped shell',outline,.21,'forest')
        path('Royal shell | scalloped gold rim',[(x,y,.05) for x,y in outline+[outline[0]]],.021,'copper')
        for x in [-.28,-.14,0,.14,.28]: path('Royal shell | radial raised rib',[(x,.34,.11),(x*.6,-.02,.14),(0,-.34,.10)],.015,'steel')
        crystal('Royal shell | lower pearl',(0,-.25,.16),(.075,.075,.033))
    else:
        outline=[(-.34,.47),(.34,.47),(.46,.29),(.38,-.35),(.17,-.52),(-.17,-.52),(-.38,-.35),(-.46,.29)]
        profile('Forge nucleus | tower shield',outline,.22,'iron')
        for sign in [-1,1]:
            profile('Forge nucleus | armour flank',[(sign*.18,.38),(sign*.37,.25),(sign*.30,-.25),(sign*.12,-.34)],.05,'steel',.11)
        ring('Forge nucleus | reactor housing',(0,.015,.15),.16,.035,'copper',.025,axis=(0,0,1),sides=12)
        star('Forge nucleus | captive sun',(0,.015,.18),.135,.07,'amber',6,.06)
        for y in [-.34,.33]: box('Forge nucleus | structural bracket',(0,y,.12),(.25,.055,.04),'copper',.008)
    for x in [-.13,.13]: box('Shield | back straps',(x,0,-.14),(.06,.31,.04),'leather',.008)
    tube('Shield | grip',(-.11,0,-.18),(.11,0,-.18),.025,'leather')

def staff_new():
    path('Staff | complete full shaft',[(0,-.90,0),(-.018,-.45,0),(0,0,0),(0,.45,0),(0,.70,0)],.043,'leather' if COLLECTION=='roble' else 'iron')
    lacing('Staff | raised hand wrap',-.14,.14,.049,.049,6,.0035,'stitch')
    for y in [-.78,-.20,.22,.59]: ring('Staff | shaft collar',(0,y,0),.052,.027,'copper',.009)
    if COLLECTION=='roble':
        for sign in [-1,1]:
            path('Oak | living branch',[(0,.62,0),(sign*.14,.84,0),(sign*.12,1.12,0)],.027,'leather')
            leaf('Oak | green crown leaf',(sign*.12,1.11,.01),.25,.11,'forest')
        crystal('Oak | heart seed',(0,.91,.035),(.07,.11,.06),'amber')
    elif COLLECTION=='marea':
        path('Trident | sweeping crown',[(-.23,1.15,0),(-.21,.81,0),(0,.69,0),(.21,.81,0),(.23,1.15,0)],.034,'copper')
        for x,height in [(-.23,1.19),(0,1.34),(.23,1.19)]:
            tube('Trident | upright tine',(x,.83,0),(x,height-.12,0),.026,'steel')
            profile('Trident | forged point',[(x-.065,height-.14),(x,height+.06),(x+.065,height-.14)],.06,'steel')
        crystal('Trident | neck sapphire',(0,.76,.05),(.045,.06,.03))
    else:
        for axis in [(0,0,1),(1,0,0),(.65,.65,.4)]: ring('Solar orrery | independent orbit',(0,.98,0),.23,.018,'copper',.012,axis=axis,sides=20)
        star('Solar orrery | solar nucleus',(0,.98,.015),.13,.065,'amber',7,.07)
        crystal('Solar orrery | upper star',(0,1.25,0),(.045,.07,.04))
        box('Solar orrery | mounting neck',(0,.70,0),(.13,.16,.10),'steel',.015)

def dagger_new():
    grip('Dagger handgrip',.29,.045); off=CURRENT['slot']=='offhand'
    if COLLECTION=='roble':
        outline=[(-.05,.15),(-.09,.39),(-.05,.60),(0,.96),(.05,.60),(.09,.39),(.05,.15)] if not off else [(-.05,.15),(-.10,.35),(.03,.78),(.11,.38),(.06,.15)]
        profile('Oak | fern blade' if not off else 'Oak | thorn blade',outline,.055)
        tube('Oak | branch guard',(-.12,.15,0),(.12,.15,0),.023,'leather')
        for y in [.32,.43,.54]: path('Oak | fern blade vein',[(-.035,y+.035,.033),(0,y,.036),(.035,y+.035,.033)],.003,'forest',4)
    elif COLLECTION=='marea':
        if not off: outline=[(-.04,.15),(-.10,.49),(-.04,.73),(.10,1.02),(.16,.73),(.09,.59),(.16,.48),(.07,.15)]
        else: outline=[(-.035,.15),(-.08,.40),(-.15,.70),(-.08,.65),(0,.89),(.08,.65),(.15,.70),(.08,.40),(.035,.15)]
        profile('Coral | fin blade' if not off else 'Pearl | trident parrying blade',outline,.06)
        path('Coral | curved guard',[(-.14,.19,0),(0,.13,0),(.14,.19,0)],.025,'copper')
        crystal('Coral | pearl',(0,.22,.048),(.027,.04,.017))
    else:
        if not off:
            for sign in [-1,1]: profile('Astral caliper | separate tine',[(sign*.025,.20),(sign*.11,.54),(sign*.095,.95),(sign*.04,.80),(sign*.03,.51)],.055,'steel')
            crystal('Astral caliper | open channel focus',(0,.48,0),(.028,.065,.025))
            box('Astral caliper | guard',(0,.17,0),(.28,.065,.10),'iron',.012)
        else:
            ring('Meteor fist | open knuckle ring',(0,.17,0),.095,.045,'steel',.022,axis=(0,0,1),sides=12)
            for x in [-.075,0,.075]: profile('Meteor fist | forward punch blade',[(x-.033,.23),(x,.65 if x==0 else .52),(x+.033,.23)],.05,'steel')
        star('Forge | pommel sun',(0,-.22,.012),.055,.025,'copper',6,.025)

def wand_new():
    grip('Wand handgrip',.28,.035)
    path('Wand | full stem',[(0,.12,0),(.02,.38,0),(0,.61,0)],.025,'leather' if COLLECTION=='roble' else 'iron')
    for y in [.13,.50]: ring('Wand | neck collar',(0,y,0),.039,.025,'copper',.01)
    if COLLECTION=='roble':
        crystal('Living seed | seed head',(0,.70,0),(.07,.11,.06),'amber')
        for sign in [-1,1]: leaf('Living seed | protective leaf',(sign*.055,.66,.015),.20,.055,'forest')
        for y in [.25,.35,.45]: ring('Living seed | vine coil',(0,y,0),.031,.009,'forest',.004,sides=12)
    elif COLLECTION=='marea':
        for i in range(4):
            radius=.095-i*.018
            ring('Royal conch | graduated shell coil',(.018*i,.72+.015*i,0),radius,.025,'steel' if i%2 else 'copper',.016,axis=(0,0,1),sides=16)
        crystal('Royal conch | pearl',(0,.73,.07),(.045,.05,.03),'amber')
    else:
        star('Forged star | complete star head',(0,.74,0),.17,.075,'steel',5,.07)
        star('Forged star | inset star',(0,.74,.049),.105,.045,'copper',5,.018)
        crystal('Forged star | focus',(0,.74,.07),(.04,.05,.025))

def book_new():
    box('Book | layered page block',(0,0,0),(.16,.47,.35),'paper',.004)
    for sign in [-1,1]:
        x=sign*.105
        box('Book | complete covers',(x,0,0),(.035,.53,.42),'leather' if COLLECTION=='roble' else 'forest' if COLLECTION=='marea' else 'iron',.012)
        if COLLECTION=='roble':
            for z in [-.14,0,.14]: box('Herbarium | wooden cover boards',(sign*.127,0,z),(.013,.48,.11),'leather',.004)
            leaf_obj=leaf('Herbarium | leaf cover seal',(0,0,.142),.27,.12,'forest')
            leaf_obj.data.transform(Matrix.Rotation(sign*math.pi/2,4,xyz((0,1,0))))
            for y in [-.20,.20]: box('Herbarium | leather straps',(sign*.14,y,0),(.02,.035,.37),'iron',.004)
        elif COLLECTION=='marea':
            for i in range(5):
                z=-.14+i*.07
                path('Tide atlas | raised shell ribs',[(sign*.135,.19,z),(sign*.15,0,z*.6),(sign*.135,-.19,0)],.009,'copper',6)
            crystal('Tide atlas | pearl clasp',(sign*.16,-.11,.03),(.018,.055,.055),'amber')
        else:
            ring('Stellar reliquary | gear ring',(sign*.142,0,0),.12,.025,'copper',.016,axis=(1,0,0),sides=16)
            for i in range(8):
                a=i*math.tau/8
                box('Stellar reliquary | separate gear tooth',(sign*.145,math.sin(a)*.125,math.cos(a)*.125),(.026,.042,.042),'steel',.006)
            crystal('Stellar reliquary | core',(sign*.165,0,0),(.022,.06,.06))
            for y in [-.21,.21]:
                for z in [-.16,.16]: box('Stellar reliquary | armoured corners',(sign*.135,y,z),(.03,.065,.06),'steel',.008)
    box('Book | spine',(0,0,-.21),(.26,.49,.045),'leather',.012)
    box('Book | clasp',(0,.04,.225),(.24,.045,.026),'copper',.005)
    for i in range(15): box('Book | visible page lamination',(0,-.21+i*.03,.18),(.15,.002,.005),'paper',0)

def crossbow_new():
    grip('Crossbow handgrip',.27,.047)
    box('Crossbow | full stock',(0,.055,.30),(.15,.13,.78),'leather' if COLLECTION=='roble' else 'iron',.018)
    if COLLECTION=='roble':
        for sign in [-1,1]: path('Yew | curved limbs',[(0,.10,.66),(sign*.16,.11,.73),(sign*.35,.10,.71),(sign*.47,.085,.60)],.032,'leather')
        tips=[(-.47,.085,.60),(0,.125,.16),(.47,.085,.60)]
        for z in [.06,.17,.30]: box('Yew | stock binding',(0,.13,z),(.16,.016,.02),'forest',.004)
    elif COLLECTION=='marea':
        for sign in [-1,1]:
            points=[(0,.11,.68),(sign*.19,.14,.82),(sign*.38,.12,.75),(sign*.55,.10,.58)]
            path('Royal fan | broad limbs',points,.043,'steel',8)
            path('Royal fan | golden facing',[(x,y+.03,z) for x,y,z in points],.012,'copper',6)
            for i in range(2): path('Royal fan | fan brace',[(sign*.12,.10,.62),(sign*(.27+i*.12),.12,.70-i*.04)],.012,'copper',6)
            crystal('Royal fan | limb pearl',(sign*.55,.10,.58),(.034,.032,.04))
        tips=[(-.55,.10,.58),(0,.14,.15),(.55,.10,.58)]
    else:
        for sign in [-1,1]:
            box('Zenith rail | raised rail',(sign*.055,.15,.40),(.026,.035,.76),'steel',.005)
            path('Zenith rail | mechanical limbs',[(0,.11,.69),(sign*.28,.11,.77),(sign*.45,.10,.61),(sign*.54,.10,.67)],.037,'iron',4)
            box('Zenith rail | limb joint',(sign*.28,.11,.77),(.085,.10,.08),'copper',.012)
        for z in [.30,.43,.56]: crystal('Zenith rail | contained charge',(0,.15,z),(.024,.027,.04))
        box('Zenith rail | muzzle',(0,.13,.83),(.15,.13,.08),'iron',.012)
        tips=[(-.54,.10,.67),(0,.14,.12),(.54,.10,.67)]
    path('Crossbow | complete bowstring',tips,.0035,'stitch',5)
    tube('Crossbow | loaded bolt',(0,.16,.28),(0,.16,.91),.009,'leather',6)
    crystal('Crossbow | bolt head',(0,.16,.94),(.025,.018,.05),'steel')
    ring('Crossbow | trigger guard',(0,-.04,.20),.048,.016,'copper',.008,axis=(1,0,0),sides=12)

BUILDERS={'sword':sword_new,'shield':shield_new,'staff':staff_new,'dagger':dagger_new,'wand':wand_new,'book':book_new,'crossbow':crossbow_new}
for CURRENT in ITEMS:
    COLLECTION=CURRENT['collection']; MATERIAL=palette(COLLECTION); before=set(bpy.data.objects)
    BUILDERS[CURRENT['kind']]()
    parts=[obj for obj in bpy.data.objects if obj not in before and obj.type=='MESH']
    root=bpy.data.objects.new(CURRENT['id'],None); bpy.context.collection.objects.link(root)
    root['itemId']=CURRENT['id']; root['displayName']=CURRENT['label']; root['tier']=CURRENT['tier']; root['collection']=COLLECTION
    root['construction']='Original complete mesh, built from primitives without source-mesh import'
    for obj in parts: obj.parent=root
    bpy.ops.object.select_all(action='DESELECT'); copies=[]; depsgraph=bpy.context.evaluated_depsgraph_get()
    for obj in parts:
        clone=bpy.data.objects.new(obj.name+'_export',bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph)))
        bpy.context.collection.objects.link(clone); clone.matrix_world=obj.matrix_world.copy(); clone.select_set(True); copies.append(clone)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.join(); merged=bpy.context.object; merged.name=CURRENT['id']+'_mesh'
    export_root=bpy.data.objects.new(CURRENT['id']+'_export',None); bpy.context.collection.objects.link(export_root)
    for key,value in root.items(): export_root[key]=value
    merged.parent=export_root; export_root.select_set(True)
    folder=os.path.join(OUT,COLLECTION); os.makedirs(folder,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(folder,CURRENT['id']+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
    bpy.data.objects.remove(merged,do_unlink=True); bpy.data.objects.remove(export_root,do_unlink=True); ROOTS.append(root)
    print('GENERATED',CURRENT['id'],flush=True)
for i,root in enumerate(ROOTS): root.location=xyz(((i%8)*2.5,(i//8)*3.5,0))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'new_collections.blend'))
print('Finished 24 new full models.',flush=True)
