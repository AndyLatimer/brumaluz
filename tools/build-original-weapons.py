"""Build 16 wholly new weapon meshes; no existing GLB mesh is imported or modified.

blender --background --python tools/build-original-weapons.py
Only the reference pass's primitive/atlas helpers are shared. Geometry, silhouettes,
atlases and construction parts are created here, in native game grip coordinates.
"""
import bpy
import json
import math
import os
from array import array
from mathutils import Vector, Matrix

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPERS=os.path.join(ROOT,'tools','build-tier1-weapons.py')
with open(HELPERS,encoding='utf-8') as source:
    exec(compile(source.read().split('\nITEMS=[')[0],HELPERS,'exec'))
with open(os.path.join(ROOT,'src','data','uniqueWeapons.json'),encoding='utf-8') as source:
    ITEMS=json.load(source)
OUT=os.path.join(ROOT,'src','assets','models','items','unique')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PALETTES={}
COLLECTION='alba'
CURRENT=None
ROOTS=[]

def palette(collection):
    if collection in PALETTES: return PALETTES[collection]
    colors={
      'alba':{'steel':('e0e9e5','90abb9'),'iron':('577c8b','2d454f'),'copper':('e2c489','927344'),'leather':('a17c55','59412e'),'stitch':('eee0bd','c3ad80'),'forest':('72a7c7','284e72'),'paper':('f3e9ce','b6a88a'),'amber':('b4ebfa','3f8cc6')},
      'eclipse':{'steel':('bac5de','77809e'),'iron':('655976','30283f'),'copper':('b9afce','706381'),'leather':('65505b','322b37'),'stitch':('b5a4c8','6d607e'),'forest':('80669c','362a49'),'paper':('ded7e4','9d90b0'),'amber':('e0b1ff','8552bc')}
    }[collection]
    image=bpy.data.images.new('Original_'+collection+'_atlas',256,256,alpha=True)
    pixels=array('f',(.65,.65,.65,1))*256*256
    for key,(top,bottom) in colors.items(): fill_cell(pixels,256,256,*CELLS[key],rgb(top),rgb(bottom))
    image.pixels.foreach_set(pixels); image.update(); image.pack()
    material=bpy.data.materials.new('Original_'+collection)
    material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.62
    tex=material.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    PALETTES[collection]=material
    return material

def crystal(name,center,size,color='amber'):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=xyz(center))
    obj=bpy.context.object; obj.name=name; obj.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    while obj.data.uv_layers: obj.data.uv_layers.remove(obj.data.uv_layers[0])
    return palette_uv(obj,color)

def profile(name,outline,thick,color='steel',z=0):
    # A raised central ridge gives each outline a genuine faceted blade section.
    n=len(outline); cx=sum(x for x,y in outline)/n; cy=sum(y for x,y in outline)/n
    vertices=[(x,y,z+side*thick*.18) for side in [-1,1] for x,y in outline]
    vertices += [(cx,cy,z-thick*.5),(cx,cy,z+thick*.5)]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,2*n),(n+j,n+i,2*n+1),(i,n+i,n+j,j)]
    return mesh(name,vertices,faces,color)

def grip(label,length=.34,radius=.05):
    tube(label+' | shaped grip',(0,-length*.55,0),(0,length*.45,0),radius,'leather',8)
    lacing(label+' | spiral binding',-length*.48,length*.38,radius+.002,radius+.002,5,.003,'stitch')
    for y in [-length*.55,length*.45]: ring(label+' | grip collar',(0,y,0),radius+.008,.025,'copper',.01)
    crystal(label+' | pommel',(0,-length*.65,0),(radius*1.2,.045,radius*1.2),'copper')

def path(label,points,radius,color='copper',sides=8):
    for a,b in zip(points,points[1:]): tube(label,a,b,radius,color,sides)

def crescent(label,center,radius,width,color='steel',start=48,end=312,steps=24):
    cx,cy,cz=center; vertices=[]
    for i in range(steps+1):
        t=i/steps; angle=math.radians(start+(end-start)*t)
        w=width*max(.04,math.sin(math.pi*t)**.6)
        vertices.extend([(cx+radius*math.cos(angle),cy+radius*math.sin(angle),cz),
                         (cx+(radius-w)*math.cos(angle),cy+(radius-w)*math.sin(angle),cz+.018)])
    return mesh(label,vertices,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(steps)],color)

def saber():
    grip('Dawn saber',.38,.052)
    profile('Dawn saber | swept falchion',[(-.065,.20),(-.09,.62),(-.04,1.10),(.10,1.43),(.23,1.28),(.19,.94),(.12,.57),(.10,.20)],.075)
    path('Dawn saber | knuckle bow',[(.17,.20,.0),(.25,.05,0),(.20,-.13,0),(.05,-.22,0)],.024)
    tube('Dawn saber | asymmetrical guard',(-.19,.19,0),(.20,.19,0),.034,'copper',8,.025)
    profile('Dawn saber | blue ricasso',[(-.045,.25),(.07,.25),(.075,.43),(0,.49)],.014,'forest',.046)
    crystal('Dawn saber | guard stone',(.01,.25,.063),(.031,.046,.018))
    path('Dawn saber | inset groove',[(.02,.49,.044),(.04,.83,.042),(.09,1.17,.025)],.004,'iron',4)

def eclipse_sword():
    grip('Eclipse sword',.38,.052)
    profile('Eclipse sword | forked lunar edge',[(-.06,.20),(-.12,.58),(-.095,1.13),(-.025,1.38),(.02,1.22),(.13,1.39),(.10,.95),(.15,.77),(.07,.20)],.08)
    crescent('Eclipse sword | crescent guard',(0,.22,.012),.22,.075,'copper',0,180,20)
    for sign in [-1,1]: crystal('Eclipse sword | guard end',(sign*.215,.23,.013),(.028,.05,.028))
    crystal('Eclipse sword | keystone',(0,.31,.058),(.045,.065,.025))
    for y in [.51,.70,.89,1.08]: crystal('Eclipse sword | blade seal',(0,y,.045),(.015,.025,.007))
    ring('Eclipse sword | hollow pommel',(0,-.29,0),.068,.025,'iron',.015,axis=(0,0,1))

def shield():
    if COLLECTION=='alba':
        outline=[(0,.49),(.40,.29),(.34,-.25),(0,-.55),(-.34,-.25),(-.40,.29)]
        profile('Bastion | convex kite shell',outline,.19,'forest')
        path('Bastion | solid steel rim',[(x,y,.045) for x,y in outline+[outline[0]]],.026,'steel')
        box('Bastion | heraldic upright',(0,-.01,.11),(.06,.85,.027),'steel',.01)
        box('Bastion | heraldic crossbar',(0,.16,.12),(.59,.055,.028),'copper',.009)
        profile('Bastion | lower silver chevron',[(-.20,-.16),(0,-.38),(.20,-.16),(0,-.28)],.018,'steel',.105)
        crystal('Bastion | azure crest',(0,.16,.16),(.055,.075,.025))
    else:
        outline=[(.43*math.cos(math.tau*i/8),-.015+.46*math.sin(math.tau*i/8)) for i in range(8)]
        profile('Sundered moon | octagonal shield',outline,.20,'iron')
        path('Sundered moon | faceted ring',[(x,y,.055) for x,y in outline+[outline[0]]],.024,'steel')
        crescent('Sundered moon | heraldic moon',(-.035,-.01,.13),.26,.10,'copper')
        crystal('Sundered moon | enclosed star',(.13,-.015,.16),(.055,.08,.025))
        for x,y in outline: crystal('Sundered moon | rim clasp',(x*.85,y*.85,.09),(.027,.035,.02),'steel')
    for x in [-.13,.13]:
        box('Shield | back leather straps',(x,0,-.13),(.065,.30,.04),'leather',.01)
        box('Shield | back buckle',(x,.06,-.158),(.085,.062,.022),'copper',.005)
    tube('Shield | hand bar',(-.11,0,-.18),(.11,0,-.18),.023,'leather',8)

def staff():
    shaft=[(0,-.91,0),(-.025,-.50,.01),(0,-.17,0),(0,.16,0),(.035,.43,.01),(0,.68,0)]
    path('Staff | carved full shaft',shaft,.043,'leather')
    lacing('Staff | hand binding',-.14,.14,.048,.048,6,.004,'stitch')
    for y in [-.80,-.22,.20,.57]: ring('Staff | shaft ferrule',(0,y,0),.051,.034,'copper',.01)
    if COLLECTION=='alba':
        for sign in [-1,1]:
            path('Celestial root | branching crown',[(0,.60,0),(sign*.13,.79,.01),(sign*.21,1.09,0),(sign*.15,1.23,0)],.034,'leather')
            crystal('Celestial root | silver branch tip',(sign*.15,1.23,0),(.04,.065,.035),'steel')
        crystal('Celestial root | cut floating focus',(0,.99,0),(.10,.20,.085))
        tube('Celestial root | focus mounting',(0,.65,0),(0,.83,0),.035,'copper')
        ring('Celestial root | neck',(0,.67,0),.075,.045,'steel',.016)
    else:
        crescent('Midnight | full lunar crook',(.025,.99,0),.29,.085,'steel',42,318,28)
        crescent('Midnight | inset violet edge',(.025,.99,.02),.25,.02,'forest',48,312,24)
        tube('Midnight | star suspension',(.12,1.18,.015),(.12,1.05,.015),.006,'copper',6)
        crystal('Midnight | suspended night star',(.12,.98,.015),(.065,.10,.055))
        profile('Midnight | neck fin',[(-.07,.62),(-.12,.79),(.05,.73),(.07,.61)],.05,'iron')

def dagger():
    grip('Dagger',.29,.045)
    offhand=CURRENT['slot']=='offhand'
    if COLLECTION=='alba':
        outline=[(-.045,.15),(-.085,.39),(-.03,.62),(.02,.98),(.13,.70),(.09,.53),(.15,.47),(.06,.15)] if not offhand else [(-.04,.15),(-.08,.44),(.02,.65),(.19,.82),(.14,.58),(.20,.52),(.075,.15)]
        profile('Blue plume | hooked feather blade' if not offhand else 'Dawn talon | parrying hook',outline,.06)
        path('Dagger | feather-shaped guard',[(-.12,.15,0),(0,.12,0),(.16,.21,0)],.022,'copper')
        for i in range(3): path('Dagger | blue feather inlay',[(.0,.35+i*.10,.035),(.055,.42+i*.10,.03)],.004,'forest',4)
    else:
        if not offhand:
            left=[]; right=[]
            for i in range(9):
                y=.16+i*.095; center=.043*math.sin(i*1.1); width=.06*(1-i/11)
                left.append((center-width,y)); right.append((center+width,y))
            outline=left+[(.025,1.06)]+list(reversed(right))
        else: outline=[(-.045,.15),(-.11,.39),(-.07,.64),(.14,.90),(.11,.65),(.17,.50),(.065,.15)]
        profile('Violet wave | forged kris' if not offhand else 'Waning moon | reverse sickle',outline,.06)
        crescent('Dagger | open moon guard',(0,.16,0),.13,.047,'copper',0,180,16)
        crystal('Dagger | violet throat',(0,.20,.045),(.028,.04,.014))
    crystal('Dagger | pommel stone',(0,-.22,0),(.048,.05,.045),'iron')

def wand():
    grip('Wand',.30,.037)
    tube('Wand | tapering stem',(0,.12,0),(0,.61,0),.029,'leather',8,.020)
    for y in [.13,.45,.60]: ring('Wand | fitted collar',(0,y,0),.038,.025,'copper',.009)
    if COLLECTION=='alba':
        for i in range(5):
            angle=math.tau*i/5
            outline=[(0,.72),(.045,.78),(0,.90),(-.045,.78)]
            obj=profile('Celestial lily | silver petal',outline,.03,'steel')
            center=xyz((0,.72,0)); rotate=Matrix.Translation(center)@Matrix.Rotation(angle,4,xyz((0,0,1)))@Matrix.Translation(-center)
            obj.data.transform(rotate)
        crystal('Celestial lily | flower heart',(0,.72,.055),(.055,.065,.035))
    else:
        center=Vector((0,.74,0)); top=center+Vector((0,.17,0)); bottom=center-Vector((0,.17,0))
        corners=[center+Vector((math.cos(i*math.pi/2)*.11,0,math.sin(i*math.pi/2)*.11)) for i in range(4)]
        for corner in corners:
            tube('Captive star | open cage',bottom,corner,.012,'steel',6)
            tube('Captive star | open cage',corner,top,.012,'steel',6)
        crystal('Captive star | suspended crystal',center,(.053,.10,.053))
        ring('Captive star | cage belt',center,.115,.012,'copper',.008,sides=12)

def hex_cover(name,x,thickness,color):
    outline=[(-.14,-.28),(.14,-.28),(.22,-.17),(.22,.18),(.13,.28),(-.14,.28),(-.22,.18),(-.22,-.17)]
    n=len(outline); vertices=[(x+side*thickness/2,y,z) for side in [-1,1] for z,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vertices,faces,color)

def book():
    if COLLECTION=='alba':
        box('Dawn codex | page block',(0,0,0),(.15,.45,.33),'paper',.005)
        for sign in [-1,1]:
            x=sign*.095
            box('Dawn codex | full blue cover',(x,0,0),(.035,.51,.39),'forest',.012)
            for y in [-.21,.21]: box('Dawn codex | silver cover bars',(x+sign*.022,y,0),(.013,.032,.35),'steel',.005)
            for z in [-.15,.15]: box('Dawn codex | golden cover edge',(x+sign*.025,0,z),(.012,.42,.022),'copper',.004)
            ring('Dawn codex | celestial seal',(sign*.124,0,.02),.09,.014,'copper',.01,axis=(1,0,0))
            crystal('Dawn codex | blue cover gem',(sign*.142,0,.02),(.022,.055,.05))
    else:
        hex_cover('Nocturnal eye | octagonal pages',0,.16,'paper')
        for sign in [-1,1]:
            hex_cover('Nocturnal eye | shaped violet cover',sign*.103,.03,'forest')
            ring('Nocturnal eye | iris mount',(sign*.128,0,.035),.117,.015,'copper',.012,axis=(1,0,0),sides=16)
            crystal('Nocturnal eye | iris',(sign*.145,0,.035),(.02,.073,.09))
            crystal('Nocturnal eye | pupil',(sign*.165,0,.035),(.008,.047,.018),'iron')
            for i in range(8):
                a=math.tau*i/8
                tube('Nocturnal eye | radial lashes',(sign*.13,math.sin(a)*.13,.035+math.cos(a)*.13),(sign*.13,math.sin(a)*.17,.035+math.cos(a)*.17),.006,'steel',5)
    box('Book | flexible spine',(0,0,-.19),(.24,.44,.04),'leather',.012)
    for y in [-.17,.17]: box('Book | spine bindings',(0,y,-.215),(.25,.026,.022),'copper',.004)
    for i in range(14): box('Book | individual page edge',(0,-.20+i*.03,.172),(.14,.0025,.006),'paper',0)
    box('Book | hinged clasp',(0,.04,.212),(.22,.04,.026),'copper',.004)

def crossbow():
    grip('Crossbow handgrip',.26,.048)
    if COLLECTION=='alba':
        box('Kingfisher | carved main stock',(0,.065,.30),(.17,.14,.77),'leather',.025)
        box('Kingfisher | blue padded cheek',(0,.155,.04),(.13,.04,.26),'forest',.014)
        for sign in [-1,1]:
            points=[(0,.10,.64),(sign*.22,.14,.76),(sign*.48,.085,.62)]
            path('Kingfisher | angular full limbs',points,.048,'leather',4)
            path('Kingfisher | silver limb facing',[(x,y+.033,z) for x,y,z in points],.018,'steel',4)
            crystal('Kingfisher | limb cap',(sign*.48,.085,.62),(.04,.035,.045),'copper')
        tips=[(-.48,.085,.62),(0,.13,.17),(.48,.085,.62)]
    else:
        box('Eclipse wings | dark stock',(0,.035,.27),(.14,.13,.74),'iron',.018)
        for sign in [-1,1]:
            box('Eclipse wings | twin silver rail',(sign*.055,.115,.37),(.022,.03,.65),'steel',.005)
            points=[(0,.10,.66),(sign*.20,.13,.79),(sign*.37,.11,.71),(sign*.46,.09,.54),(sign*.54,.11,.59)]
            path('Eclipse wings | sweeping recurved limbs',points,.035,'iron',8)
            path('Eclipse wings | chased edge',[(x,y+.027,z) for x,y,z in points],.010,'copper',6)
            crystal('Eclipse wings | violet limb terminal',(sign*.54,.11,.59),(.025,.035,.045))
        crystal('Eclipse wings | stock focus',(0,.14,.40),(.035,.027,.07))
        tips=[(-.54,.11,.59),(0,.14,.13),(.54,.11,.59)]
    path('Crossbow | tensioned bowstring',tips,.0035,'stitch',5)
    tube('Crossbow | loaded bolt',(0,.15,.30),(0,.15,.88),.009,'leather',6)
    crystal('Crossbow | broadhead',(0,.15,.91),(.026,.018,.055),'steel')
    ring('Crossbow | trigger guard',(0,-.045,.21),.05,.016,'copper',.008,axis=(1,0,0),sides=12)
    for z in [.24,.55]: box('Crossbow | raised sight',(0,.17,z),(.075,.025,.026),'copper',.005)

BUILDERS={'shield':shield,'staff':staff,'dagger':dagger,'wand':wand,'book':book,'crossbow':crossbow}
for CURRENT in ITEMS:
    COLLECTION=CURRENT['collection']; MATERIAL=palette(COLLECTION)
    before=set(bpy.data.objects)
    if CURRENT['kind']=='sword': saber() if COLLECTION=='alba' else eclipse_sword()
    else: BUILDERS[CURRENT['kind']]()
    parts=[obj for obj in bpy.data.objects if obj not in before and obj.type=='MESH']
    root=bpy.data.objects.new(CURRENT['id'],None); bpy.context.collection.objects.link(root)
    root['itemId']=CURRENT['id']; root['displayName']=CURRENT['label']; root['tier']=CURRENT['tier']
    root['construction']='Original mesh built from scratch; no source mesh import'
    root['collection']=COLLECTION
    for obj in parts: obj.parent=root
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]; depsgraph=bpy.context.evaluated_depsgraph_get()
    for obj in parts:
        duplicate=bpy.data.objects.new(obj.name+'_export',bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph)))
        bpy.context.collection.objects.link(duplicate); duplicate.matrix_world=obj.matrix_world.copy(); duplicate.select_set(True); copies.append(duplicate)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.join()
    merged=bpy.context.object; merged.name=CURRENT['id']+'_mesh'
    export_root=bpy.data.objects.new(CURRENT['id']+'_export',None); bpy.context.collection.objects.link(export_root)
    for key,value in root.items(): export_root[key]=value
    merged.parent=export_root; export_root.select_set(True)
    folder=os.path.join(OUT,COLLECTION); os.makedirs(folder,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(folder,CURRENT['id']+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
    bpy.data.objects.remove(merged,do_unlink=True); bpy.data.objects.remove(export_root,do_unlink=True)
    ROOTS.append(root)
    print('GENERATED ORIGINAL',CURRENT['id'],flush=True)

for i,root in enumerate(ROOTS): root.location=xyz(((i%8)*2.5,(i//8)*3.5,0))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'original_weapons.blend'))
print('Finished 16 original weapon models.',flush=True)
