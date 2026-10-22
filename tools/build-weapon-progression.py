"""Blender: 24 RPG weapons, derived from the detailed Adventurers reference pass.

blender --background --python tools/build-weapon-progression.py
The source atlas, hand origin and native axes are retained. Each GLB has one mesh
and one embedded atlas material. The Blender master retains named construction parts.
"""
import bpy
import os
import json
import math
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPERS = os.path.join(ROOT, 'tools', 'build-tier1-weapons.py')
# Reuse the actual reference-pass geometry helpers without running its tier-one exports.
with open(HELPERS, encoding='utf-8') as source:
    exec(compile(source.read().split('\nITEMS=[')[0], HELPERS, 'exec'))
with open(os.path.join(ROOT, 'src', 'data', 'weaponProgression.json'), encoding='utf-8') as source:
    SPEC = json.load(source)
ITEM_DIR = os.path.join(ROOT, 'src', 'assets', 'models', 'items')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
ROOTS = []
TIER = 3

def gem(name, center, size):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=xyz(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Las primitivas de Blender traen UV esféricas: sustituirlas por las del atlas.
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    return palette_uv(obj, 'amber')

def front_gem(name, x, y, radius=.027, side=1):
    p = projected(x, y, side, .003)
    if p is None:
        return
    tube(name+' | bezel', p, p+Vector((0,0,side*.014)), radius*1.4, 'copper', 8, radius*1.15)
    gem(name+' | cut stone', p+Vector((0,0,side*.019)), (radius, radius*1.3, radius*.45))

def runes(center, span, count, radius=.014):
    for i in range(count):
        y = center-span/2+span*i/max(1,count-1)
        for side in [-1,1]:
            p = projected(0,y,side,.003)
            if p is None:
                continue
            mesh('Inlaid rune', [(p.x-radius,p.y,p.z),(p.x,p.y+radius*1.5,p.z),(p.x+radius,p.y,p.z),(p.x,p.y-radius*1.5,p.z)], [(0,1,2,3) if side>0 else (3,2,1,0)], 'amber')

def edged_guard(width, y):
    for side in [-1,1]:
        points=[(side*width*.55,y,0),(side*width*.85,y+.025,0),(side*width,y+.085,0)]
        for a,b in zip(points,points[1:]):
            tube('Swept engraved guard',a,b,.023,'copper',8,.016)
        gem('Guard terminal',points[-1],(.027,.035,.027))

def advanced_sword():
    edged_guard(.25+(TIER-3)*.045,.205)
    runes(.82,.62,TIER+1)
    front_gem('Pommel jewel',0,-.31,.028+(TIER-3)*.008)
    for side in [-1,1]:
        front_gem('Guard jewel',0,.29,.031,side)
        if TIER>=4:
            for x in [-.055,.055]:
                inlay('Blade chased filigree',[(x*.5,.40),(x,.55),(x*.5,.70)],.008,'copper',side)
    if TIER==5:
        for sign in [-1,1]:
            inset=[(sign*.13,.25,.018),(sign*.21,.42,.012),(sign*.17,.30,.018),(sign*.29,.35,.012)]
            mesh('Phoenix guard feather',inset,[(0,1,2),(0,2,3)],'copper')

def advanced_shield():
    p=projected(0,-.025,1,.034)
    ring('Chased central seal',p,.13+(TIER-3)*.024,.018,'copper',.011,axis=(0,0,1),sides=16)
    front_gem('Shield heart',0,-.025,.054+(TIER-3)*.012)
    for i in range(8+(TIER-3)*4):
        angle=math.tau*i/(8+(TIER-3)*4)
        x,y=.25*math.cos(angle),-.015+.33*math.sin(angle)
        front_gem('Rim inset',x,y,.012)
    for x in [-.15,0,.15]:
        front_gem('Crown seal',x,.32,.022)
    if TIER>=4:
        for sign in [-1,1]:
            inlay('Heraldic branch',[(sign*.12,-.28),(sign*.20,-.12),(sign*.22,.12)],.012,'copper')

def advanced_staff():
    p=projected(.035,.99,1,.025)
    front=p.z if p is not None else .17
    ring('Focus orbit',(.035,.99,front),.16+(TIER-3)*.025,.018,'copper',.009,axis=(0,0,1),sides=16)
    gem('Faceted focus',(.035,.99,front+.025),(.08,.13,.065))
    for sign in [-1,1]:
        tube('Sculpted focus prong',(sign*.10,.80,0),(sign*.17,1.09,0),.022,'copper',8,.013)
        gem('Prong shard',(sign*.17,1.11,0),(.035,.062,.035))
    for y in [-.58,.34,.59]:
        ring('Runic shaft band',(0,y,0),.060 if y<.5 else .112,.025,'copper',.008)
    if TIER>=4:
        for i in range(TIER):
            angle=math.tau*i/TIER
            gem('Orbit star',(.035+math.cos(angle)*.19,.99+math.sin(angle)*.19,front),(.024,.04,.024))

def advanced_dagger():
    edged_guard(.13+(TIER-3)*.025,.18)
    runes(.58,.38,TIER)
    front_gem('Heel jewel',0,-.17,.022)
    for y in [-.12,.115]:
        ring('Worked grip collar',(0,y,0),.052,.018,'copper',.007,sides=12)
    if TIER>=4:
        for side in [-1,1]:
            inlay('Blade edge scroll',[(-.035,.31),(-.025,.40),(0,.43)],.006,'copper',side)

def advanced_wand():
    center=(0,.725,0)
    ring('Wand focus halo',center,.075+(TIER-3)*.023,.016,'copper',.008,axis=(0,0,1),sides=16)
    gem('Wand focus',center,(.043,.067,.043))
    for sign in [-1,1]:
        tube('Focus crown',(sign*.025,.65,0),(sign*.065,.76,0),.012,'copper',8,.007)
    for y in [-.11,.11,.37]:
        ring('Chased wand sleeve',(0,y,0),.05 if y>.2 else .079,.018,'copper',.006,sides=12)
    if TIER>=4:
        gem('Crown tip',(0,.84+(TIER-4)*.04,0),(.025,.048,.025))

def advanced_book():
    for side in [-1,1]:
        center=(side*.139,0,.045)
        ring('Book illuminated seal',center,.108+(TIER-3)*.018,.012,'copper',.009,axis=(1,0,0),sides=16)
        gem('Book focus',(side*.155,0,.045),(.020,.05,.05))
        for y in [-.20,.20]:
            for z in [-.12,.14]:
                box('Worked cover corners',(side*.135,y,z),(.012,.05,.045),'copper',.004)
        for i in range(TIER+2):
            angle=math.tau*i/(TIER+2)
            gem('Cover constellation',(side*.15,math.sin(angle)*.10,.045+math.cos(angle)*.10),(.007,.012,.012))
    box('Book clasp',(0,.03,.216),(.19,.045,.021),'copper',.005)
    if TIER==5:
        for y in [-.17,.17]:
            ring('Ancient binding',(0,y,-.205),.083,.012,'copper',.007,axis=(0,1,0),sides=12)

def advanced_crossbow():
    for sign in [-1,1]:
        box('Engraved limb cuff',(sign*.34,.105,.698),(.055,.078,.075),'copper',.008)
        gem('Limb focus',(sign*.34,.15,.698),(.025,.022,.033))
        for z in [.35,.49]:
            tube('Stock engraved pin',(sign*.12,.045,z),(sign*.13,.045,z),.014,'copper',8)
    box('Inset runic sight',(0,.208,.44),(.04,.012,.27),'copper',.003)
    gem('Sight crystal',(0,.229,.55),(.028,.025,.042))
    if TIER>=4:
        for sign in [-1,1]:
            tube('Swept limb reinforcement',(sign*.28,.12,.70),(sign*.43,.10,.62),.017,'copper',8,.011)
            gem('Recurve terminal',(sign*.43,.10,.62),(.025,.025,.03))
    if TIER==5:
        ring('Bolt focus',(0,.13,.89),.055,.017,'copper',.009,axis=(0,0,1),sides=12)

BUILDERS={'sword':advanced_sword,'shield':advanced_shield,'staff':advanced_staff,'dagger':advanced_dagger,'wand':advanced_wand,'book':advanced_book,'crossbow':advanced_crossbow}

for tier in SPEC['tiers']:
    TIER=tier['tier']
    PALETTES.clear()
    SWATCHES['copper']=(tier['metal'],tier['dark'])
    SWATCHES['amber']=(tier['gem'],tier['dark'])
    SWATCHES['forest']=(tier['gem'],tier['dark'])
    SWATCHES['iron']=('a6bac8',tier['dark'])
    out=os.path.join(ITEM_DIR,'tier'+str(TIER))
    os.makedirs(out,exist_ok=True)
    for family in SPEC['families']:
        key=family['stem']+'_t'+str(TIER)
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ITEM_DIR,'tier1',family['reference']+'.glb'))
        imported=[obj for obj in bpy.data.objects if obj not in before]
        BASE=next(obj for obj in imported if obj.type=='MESH')
        BASE.data.transform(BASE.matrix_world)
        BASE.parent=None; BASE.matrix_world=Matrix.Identity(4)
        for obj in imported:
            if obj.type!='MESH': bpy.data.objects.remove(obj,do_unlink=True)
        family_palette='knight' if family['cls']=='guerrero' else 'rogue' if family['cls'] in ['picaro','explorador'] else 'mage'
        MATERIAL=derived_material(BASE.data.materials[0],family_palette)
        MATERIAL.name='Brumaluz_T'+str(TIER)+'_'+family_palette
        # El foco y las tapas heredadas también siguen la paleta del nuevo escalón.
        image=next(node.image for node in MATERIAL.node_tree.nodes if node.type=='TEX_IMAGE' and node.image)
        width,height=image.size
        pixels=array('f',[0])*(width*height*4)
        image.pixels.foreach_get(pixels)
        if family_palette=='mage':
            for row in [4,5]:
                fill_cell(pixels,width,height,6,row,rgb(tier['gem']),rgb(tier['dark']))
                for col in [1,2]: fill_cell(pixels,width,height,col,row,rgb(tier['dark']),rgb('22232f'))
        image.pixels.foreach_set(pixels); image.update()
        # Los atlas son gradientes: 256² conserva el aspecto y evita cargar 24 texturas de 1024².
        if width>256: image.scale(256,256)
        image.pack()
        BASE.data.materials.clear(); BASE.data.materials.append(MATERIAL)
        BUILDERS[family['kind']]()
        parts=[obj for obj in bpy.data.objects if obj not in before and obj.type=='MESH']
        root=bpy.data.objects.new(key,None); bpy.context.collection.objects.link(root)
        root['itemId']=key; root['tier']=TIER; root['displayName']=family['label']+' '+tier['suffix']
        root['reference']=family['reference']; root['rarity']=['common','uncommon','rare','epic','legendary','artifact'][TIER]
        for obj in parts: obj.parent=root
        bpy.ops.object.select_all(action='DESELECT')
        copies=[]
        depsgraph=bpy.context.evaluated_depsgraph_get()
        for obj in parts:
            evaluated=obj.evaluated_get(depsgraph)
            duplicate=bpy.data.objects.new(obj.name+'_export',bpy.data.meshes.new_from_object(evaluated))
            bpy.context.collection.objects.link(duplicate)
            duplicate.matrix_world=obj.matrix_world.copy()
            duplicate.select_set(True); copies.append(duplicate)
        bpy.context.view_layer.objects.active=copies[0]
        bpy.ops.object.join()
        merged=bpy.context.object; merged.name=key+'_mesh'
        export_root=bpy.data.objects.new(key+'_export',None); bpy.context.collection.objects.link(export_root)
        for prop,value in root.items(): export_root[prop]=value
        merged.parent=export_root; export_root.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(out,key+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
        bpy.data.objects.remove(merged,do_unlink=True); bpy.data.objects.remove(export_root,do_unlink=True)
        ROOTS.append(root)
        print('GENERATED',key,flush=True)

for i,root in enumerate(ROOTS): root.location=xyz(((i%8)*2.5,(i//8)*3.5,0))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ITEM_DIR,'weapon_progression.blend'))
print('Finished 24 models and editable Blender master.',flush=True)
