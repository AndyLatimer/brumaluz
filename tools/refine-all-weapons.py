"""Non-destructive, repeatable finishing pass. Always reads the archived source."""
import bpy, bmesh, json, os, shutil, math
from mathutils import Matrix, Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELPERS=os.path.join(ROOT,'tools','build-more-weapons.py')
with open(HELPERS,encoding='utf8') as f:
    exec(compile(f.read().split('\ndef star(')[0],HELPERS,'exec'))
OUT=os.path.join(ROOT,'src/assets/models/items')
BACK=os.path.join(ROOT,'.art-sources/weapon-quality-pass/before')
with open(os.path.join(OUT,'weapon_manifest.json'),encoding='utf8') as f: catalog=json.load(f)
native={'sword':'sword_1handed','shield':'shield_badge','staff':'staff','dagger':'dagger','wand':'wand','book':'spellbook_closed','crossbow':'crossbow_1handed'}
roots=[]; report=[]
for item in catalog:
    destination=os.path.join(OUT,item['model']); source=os.path.join(BACK,item['model'])
    os.makedirs(os.path.dirname(destination),exist_ok=True)
    if not os.path.exists(source):
        os.makedirs(os.path.dirname(source),exist_ok=True)
        origin=destination if os.path.exists(destination) else os.path.join(ROOT,'src/assets/library/adventurers/objects',native[item['kind']]+'.glb')
        shutil.copy2(origin,source)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=source)
    imported=set(bpy.data.objects)-before
    meshes=[o for o in imported if o.type=='MESH']
    for obj in meshes:
        transform=obj.matrix_world.copy(); obj.parent=None
        obj.data.transform(transform); obj.matrix_world=Matrix.Identity(4)
    for obj in imported:
        if obj.type!='MESH': bpy.data.objects.remove(obj,do_unlink=True)
    initial=sum(len(o.data.polygons) for o in meshes)
    for obj in meshes:
        bm=bmesh.new(); bm.from_mesh(obj.data)
        edges=[e for e in bm.edges if e.is_manifold and e.calc_length()>.075 and e.calc_face_angle(0)>.8]
        if edges:
            bmesh.ops.bevel(bm,geom=edges,offset=.0018,segments=2,affect='EDGES',profile=.5,clamp_overlap=True)
        bm.to_mesh(obj.data); bm.free(); obj.data.update()
    BASE=max(meshes,key=lambda o:len(o.data.polygons))
    # Fittings share a compact atlas, while all original materials remain intact.
    MATERIAL=palette(item.get('collection') if item.get('collection') in ['roble','marea','forja'] else ('roble' if item['tier']<2 else 'marea' if item['tier']<4 else 'forja'))
    added=set(bpy.data.objects)
    vertices=[Vector((v.co.x,v.co.z,-v.co.y)) for o in meshes for v in o.data.vertices]
    low=Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    high=Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    span=high-low; mid=(high+low)*.5
    def stud(x,y,side=1):
        start=xyz((x,y,side*(max(abs(low.z),abs(high.z))+1)))
        hit,p,n,face=BASE.ray_cast(start,xyz((0,0,-side)))
        if hit:
            c=(p.x,p.z,-p.y+side*.003)
            crystal('Peened fitting',c,(.009,.009,.005),'copper')
    kind=item['kind']
    if kind=='shield':
        for i in range(12):
            angle=math.tau*i/12
            for side in [-1,1]: stud(mid.x+span.x*.37*math.cos(angle),mid.y+span.y*.37*math.sin(angle),side)
    elif kind in ['sword','dagger']:
        for side in [-1,1]:
            for x in [-.035,.035]: stud(x,low.y+span.y*.29,side)
            for y in [.38,.43,.48]: stud(0,low.y+span.y*y,side)
    elif kind in ['staff','wand']:
        for fraction in [.20,.23,.58,.61]:
            y=low.y+span.y*fraction
            for x in [-.018,.018]: stud(x,y)
    elif kind=='crossbow':
        for x in [-.045,.045]:
            for f in [.25,.42,.60,.76]: stud(x,low.y+span.y*f)
    elif kind=='book':
        # Hinge studs project onto the actual cover instead of assuming its size.
        for f in [.15,.3,.7,.85]:
            for x in [mid.x-span.x*.30,mid.x+span.x*.30]: stud(x,low.y+span.y*f)
    details=[o for o in set(bpy.data.objects)-added if o.type=='MESH']
    parts=meshes+details
    bpy.ops.object.select_all(action='DESELECT')
    # Master retains named construction parts; export uses a disposable joined copy.
    copies=[]
    root=bpy.data.objects.new(item['id'],None); bpy.context.collection.objects.link(root)
    for obj in parts:
        obj.parent=root
        clone=obj.copy(); clone.data=obj.data.copy(); clone.parent=None; bpy.context.collection.objects.link(clone)
        clone.select_set(True); copies.append(clone)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.join()
    merged=bpy.context.object; merged.name=item['id']+'_finished'
    merged['itemId']=item['id']; merged['tier']=item['tier']; merged['qualityPass']='2026-10 bevels and fitted hardware'
    bpy.ops.export_scene.gltf(filepath=destination,export_format='GLB',use_selection=True,export_extras=True)
    report.append({'id':item['id'],'sourceFaces':initial,'finishedFaces':len(merged.data.polygons),'fittings':len(details),'model':item['model']})
    bpy.data.objects.remove(merged,do_unlink=True)
    root.location=(len(roots)%8*2.7,len(roots)//8*2.7,0); roots.append(root)
with open(os.path.join(OUT,'quality_report.json'),'w',encoding='utf8') as f: json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'all_weapons_refined.blend'))
print('Refined',len(report),'weapons; original geometry and grip transforms preserved.')
