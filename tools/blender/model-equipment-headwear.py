"""Editable quad cages, closed hems and UVs for Brumaluz headwear.
Run: Blender --background --python tools/blender/model-equipment-headwear.py.
Game coordinates X/right, Y/up, Z/front map to Blender X, -Z, Y.
"""
import bpy
import json
import math
import gzip
import bmesh
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'art' / 'equipment'
DEST.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.collections):
    for block in list(datablocks):
        if block.users == 0: datablocks.remove(block)

COLORS = dict(tunic=(.19,.31,.25), tunicTrim=(.67,.48,.24), leather=(.23,.105,.045),
              darkLeather=(.07,.04,.025), plate=(.38,.48,.53), brass=(.7,.48,.16),
              linen=(.77,.68,.48), gem=(.89,.39,.065))
MATERIALS = {}
for name, color in COLORS.items():
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .43 if name in ('plate','brass') else .83
    bsdf.inputs['Metallic'].default_value = .45 if name in ('plate','brass') else 0
    MATERIALS[name] = mat

def B(p): return (p[0], -p[2], p[1])
def G(p): return (p[0], p[2], -p[1])
def lerp(a,b,t): return a+(b-a)*t
def smooth(a,b,t):
    x = max(0,min(1,(t-a)/(b-a)))
    return x*x*(3-2*x)

collection = None
parts = []

def patch(name, rows, cols, point, material='tunic', role='crown', thickness=.018,
          subdivision=1, bevel=.004, wrap=True):
    """Quad cage with shared circumferential seam and explicit corner UVs."""
    stride = cols if wrap else cols+1
    verts = [B(point(c/cols,r/(rows-1))) for r in range(rows) for c in range(stride)]
    faces, uvs = [], []
    for r in range(rows-1):
        for c in range(cols):
            nxt=(c+1)%stride
            faces.append((r*stride+c,r*stride+nxt,(r+1)*stride+nxt,(r+1)*stride+c))
            uvs.append(((c/cols,r/(rows-1)),((c+1)/cols,r/(rows-1)),
                        ((c+1)/cols,(r+1)/(rows-1)),(c/cols,(r+1)/(rows-1))))
    mesh=bpy.data.meshes.new(name+' cage')
    mesh.from_pydata(verts,[],faces);mesh.update()
    layer=mesh.uv_layers.new(name='Panel UV')
    for poly, coords in zip(mesh.polygons,uvs):
        poly.use_smooth=True
        for loop,uv in zip(poly.loop_indices,coords): layer.data[loop].uv=uv
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[material])
    obj['material_role']=material;obj['atlas_panel']=role
    if subdivision:
        sub=obj.modifiers.new('Relax the designed quad cage','SUBSURF')
        sub.levels=subdivision;sub.render_levels=subdivision
    if thickness:
        solid=obj.modifiers.new('Fabric thickness and closed hem','SOLIDIFY')
        solid.thickness=thickness;solid.offset=0;solid.use_even_offset=True
    if bevel:
        edge=obj.modifiers.new('Soft tailored edges','BEVEL')
        edge.width=bevel;edge.segments=1;edge.limit_method='ANGLE';edge.angle_limit=.7
    parts.append(obj)
    return obj

def loft(name, rings, material='tunic', role='crown', thickness=.018, cols=20):
    # Rows may turn downwards: a bent hat tip is not a function of world height.
    def point(u,v):
        f=v*(len(rings)-1);i=min(len(rings)-2,int(f));t=f-i
        y,rx,rz,cx,cz=[lerp(a,b,t) for a,b in zip(rings[i],rings[i+1])]
        a=u*math.tau
        return (cx+math.sin(a)*rx,y,cz+math.cos(a)*rz)
    obj=patch(name,len(rings),cols,point,material,role,thickness,bevel=.002)
    if role=='crown':
        bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
        face=bm.faces.new([bm.verts[(len(rings)-1)*cols+i] for i in range(cols)])
        face.smooth=True
        bm.to_mesh(obj.data);bm.free()
    return obj

def tube(name, path, radius, material='tunicTrim', role='collar', segments=32):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1
    spline=curve.splines.new('POLY');spline.points.add(segments-1)
    for i,p in enumerate(spline.points): p.co=(*B(path(i/segments)),1)
    spline.use_cyclic_u=True;curve.bevel_depth=radius;curve.bevel_resolution=1
    obj=bpy.data.objects.new(name,curve);collection.objects.link(obj)
    curve.materials.append(MATERIALS[material]);obj['material_role']=material;obj['atlas_panel']=role
    parts.append(obj)
    return obj

def buckle(y,z,material='brass',size=.067):
    def outline(t):
        a=t*math.tau
        return (math.copysign(abs(math.sin(a))**.40,math.sin(a))*size,
                y+math.copysign(abs(math.cos(a))**.40,math.cos(a))*size*.66,z)
    tube('Hand forged buckle',outline,.009,material,'armor')

def feather(q):
    def shape(u,v):
        w=.003+.052*math.sin(v*math.pi)**.8
        return (-.40-v*.18+(u-.5)*w*2,2.065+v*.47,-.13-v*.13+.025*math.sin(v*math.pi))
    patch('Single swept feather',9,4,shape,'linen','lining',.009,1,.002,False)
    def quill(u,v):return (-.40-v*.18+(u-.5)*.008,2.065+v*.44,-.13-v*.13+.026*math.sin(v*math.pi))
    patch('Feather quill',8,2,quill,'tunicTrim','collar',.006,1,.002,False)

def mage(q):
    def brim(u,v):
        a=u*math.tau;r=lerp(.98,.46,v)
        return (math.sin(a)*.88*r,1.985+.028*math.sin(a*2+.7)*(1-v)+
                .060*math.sin(a-.6)*(1-v)**2+.025*v,math.cos(a)*.77*r-.025)
    patch('Wavy brim',5,32,brim,thickness=.034,role='brim')
    loft('Bent crown',[(1.995,.442,.421,0,-.025),(2.08,.428,.403,0,-.025),
         (2.25,.367,.339,.012,-.035),(2.44,.29,.263,.045,-.043),
         (2.63,.205,.177,.102,-.050),(2.79,.124,.103,.193,-.058),
         (2.83,.080,.067,.290,-.067),(2.82,.045,.038,.370,-.080),
         (2.76,.016,.015,.423,-.092),(2.74,.004,.004,.434,-.097)],thickness=.010,cols=24)
    loft('Broad crown band',[(2.008,.451,.429,0,-.025),(2.02,.453,.431,0,-.025),
         (2.118,.418,.395,.005,-.027),(2.13,.412,.39,.005,-.027)],'leather','belt',.022)
    buckle(2.07,.415,'darkLeather' if q==0 else 'brass')
    if q>=3:
        loft('Woven band edging',[(2.115,.424,.400,.005,-.027),(2.133,.418,.395,.005,-.027)],'tunicTrim','collar',.009)

def warrior(q):
    mat='tunic' if q==0 else 'leather' if q==1 else 'plate'
    def edge(a):return 1.43+.565*smooth(.13,.72,max(0,math.cos(a)))
    def shell(u,v):
        a=u*math.tau;phi=lerp(math.acos((edge(a)-1.69)/.61),.008,v)
        r=math.sin(phi);flare=.035*(1-v)**4*(1-smooth(.2,.7,math.cos(a)))
        return (math.sin(a)*(.532+flare)*r,1.69+math.cos(phi)*.61+
                .035*abs(math.cos(a))**8*math.sin(phi),math.cos(a)*(.516+flare)*r-.025)
    patch('Peaked open sallet',10,24,shell,mat,thickness=.034)
    tube('Rolled opening',lambda t:shell(t,0),.018,'leather' if q<2 else 'brass' if q>=4 else 'plate')
    def brow(u,v):
        a=lerp(-1.13,1.13,u);s=math.sin(a);c=math.cos(a)
        return (s*lerp(.478,.555,v),1.987+.046*c+.025*(1-v),c*lerp(.366,.493,v)-.017)
    patch('Swept brow',4,16,brow,mat,'armor',.028,1,.005,False)
    if q>=2:
        # A shaped forehead plate gives the sallet its own readable silhouette.
        def visor(u,v):
            x=(u-.5)*.88;t=abs(x/.44)
            return (x,lerp(1.915+.025*t,2.095-.070*t,v),
                    .468*math.sqrt(max(.12,1-(x/.57)**2))+.025*(1-t)**3)
        patch('Raised forehead visor',5,12,visor,mat,'armor',.026,1,.006,False)
        def keel(u,v):
            a=lerp(-1.32,1.05,v)
            return ((u-.5)*.034,1.69+math.cos(a)*.635,math.sin(a)*.533-.025)
        patch('Forged central keel',16,3,keel,'brass' if q>=4 else 'plate','collar',.012,1,.003,False)
    if q>=3:
        for s in (-1,1):
            def cheek(u,v,s=s):
                a=s*lerp(.96,1.30,u)
                return (math.sin(a)*(.527+.025*v),lerp(1.48,1.77,v),math.cos(a)*.525-.015)
            patch('Articulated cheek '+str(s),4,4,cheek,mat,'armor',.020,1,.004,False)

def rogue(q):
    def shell(u,v):
        a=u*math.tau;front=max(0,math.cos(a));low=1.365+.685*smooth(.15,.83,front)
        phi=lerp(math.acos((low-1.70)/.63),.008,v);r=math.sin(phi)
        return (math.sin(a)*.566*r,1.70+math.cos(phi)*.63,
                math.cos(a)*.551*r+.015-.060*math.sin(v*math.pi*.65)**4+
                .028*front**8*(1-v)**3)
    patch('Deep travelling hood',11,24,shell,thickness=.036)
    def fold(u,v):
        p=Vector(shell(u,v*.065));a=u*math.tau
        p.x+=math.sin(a)*(.022+.016*math.sin(v*math.pi))
        p.z+=math.cos(a)*(.022+.024*math.sin(v*math.pi))
        return p
    patch('Turned hood facing',4,32,fold,'tunic' if q==0 else 'tunicTrim','collar',.024)
    def lining(u):
        p=Vector(shell(u,.002));a=u*math.tau
        p.x+=math.sin(a)*.026;p.z+=math.cos(a)*.026
        return p
    tube('Dark inner piping',lining,.009,'darkLeather','lining')
    if q>=3:
        def seam(u,v):
            a=math.pi+(u-.5)*.025;phi=lerp(2.06,.09,v)
            return (math.sin(a)*.574*math.sin(phi),1.70+math.cos(phi)*.637,
                    math.cos(a)*.561*math.sin(phi)-.038*math.sin(v*math.pi*.65)**4+.015)
        patch('Sewn back seam',12,2,seam,'tunicTrim','collar',.005,0,.001,False)

def cleric(q):
    if q<2:
        loft('Linen pilgrim coif',[(1.98,.435,.414,0,0),(2.035,.47,.436,0,-.01),
             (2.18,.425,.38,-.025,-.035),(2.285,.285,.255,-.055,-.06),
             (2.295,.075,.08,-.09,-.075),(2.28,.003,.003,-.10,-.08)],'linen')
    else:
        rings=[(1.99,.443,.420),(2.09,.446,.35),(2.23,.38,.26),
               (2.39,.25,.15),(2.53,.10,.075),(2.59,.005,.035)]
        def mitre(u,v):
            f=v*(len(rings)-1);i=min(len(rings)-2,int(f));t=f-i
            y,rx,rz=[lerp(a,b,t) for a,b in zip(rings[i],rings[i+1])]
            a=u*math.tau;s=math.sin(a);c=math.cos(a)
            return (math.copysign(abs(s)**.78,s)*rx,y,
                    math.copysign(abs(c)**.44,c)*rz-.01)
        patch('Curved two leaf mitre',len(rings),24,mitre,thickness=.024)
        def saddle(u,v):
            z=lerp(-.045,.025,v)
            return ((u-.5)*.010,2.59-.020*math.sin(v*math.pi),z)
        patch('Recessed mitre saddle',5,2,saddle,thickness=.012,wrap=False)
        def front_trim(u,v):
            p=Vector(mitre(0,.075+v*.895));p.x=(u-.5)*lerp(.050,.020,v);p.z+=.018
            return p
        patch('Central woven orphrey',8,2,front_trim,'tunicTrim','collar',.008,1,.002,False)
    if q<2:
        loft('Folded coif band',[(1.977,.442,.422,0,-.005),(1.99,.46,.435,0,-.005),
             (2.047,.457,.43,0,-.008),(2.055,.442,.419,0,-.009)],'tunic','collar',.023)
    else:
        def band(u,v):
            a=u*math.tau;s=math.sin(a);c=math.cos(a)
            return (math.copysign(abs(s)**.78,s)*.470,1.981+v*.083,
                    math.copysign(abs(c)**.44,c)*lerp(.446,.410,v)-.01)
        patch('Mitre folded woven band',4,24,band,'tunicTrim','collar',.022)

def explorer(q):
    loft('Swept woodland crown',[(1.975,.438,.424,0,0),(2.055,.471,.486,0,.025),
         (2.18,.421,.480,.012,.06),(2.295,.274,.342,.016,.140),
         (2.325,.099,.173,.018,.260),(2.29,.006,.012,.018,.405)],cols=28)
    def brim(u,v):
        a=u*math.tau;s=math.sin(a);c=math.cos(a)
        return (s*lerp(.438,.548,v),1.98+v*(.045+.145*abs(s)**2)+.022*s*v,
                c*lerp(.422,.608,v)+v*.045)
    patch('Turned bycocket brim',5,28,brim,'tunic' if q==0 else 'leather','brim',.031)
    if q>=1: feather(q)
    if q>=3: tube('Brim woven piping',lambda u:brim(u,1),.008,'tunicTrim')

builders=[('guerrero',warrior),('mago',mage),('picaro',rogue),('clerigo',cleric),('explorador',explorer)]
cache={'version':4,'coordinates':'Y up, Z front; bind pose metres','models':{}}
for tier in range(6):
    for column,(cls,build) in enumerate(builders):
        key=f'{cls}_{tier}';collection=bpy.data.collections.new(key)
        bpy.context.scene.collection.children.link(collection)
        collection['class']=cls;collection['rarity_tier']=tier
        parts=[];build(tier)
        depsgraph=bpy.context.evaluated_depsgraph_get();evaluated=[]
        for obj in parts:
            result=obj.evaluated_get(depsgraph)
            mesh=result.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
            mesh.calc_loop_triangles();p,n,uv=[],[],[]
            for triangle in mesh.loop_triangles:
                if triangle.area<1e-12: continue
                for loop_id in triangle.loops:
                    loop=mesh.loops[loop_id]
                    p.extend(round(x,6) for x in G(mesh.vertices[loop.vertex_index].co))
                    normal=mesh.corner_normals[loop_id].vector
                    if not all(math.isfinite(x) for x in normal): normal=triangle.normal
                    n.extend(round(x,6) for x in G(normal))
                    tex=mesh.uv_layers.active
                    uv.extend(round(x,6) for x in tex.data[loop_id].uv) if tex else uv.extend((.5,.5))
            evaluated.append(dict(name=obj.name,material=obj['material_role'],role=obj['atlas_panel'],position=p,normal=n,uv=uv))
            result.to_mesh_clear()
        cache['models'][key]=evaluated
        for obj in parts: obj.location=(column*2.25,tier*2.50,0)

(DEST/'headwear.meshes.json.gz').write_bytes(gzip.compress(json.dumps(cache,separators=(',',':'),allow_nan=False).encode('utf8'),compresslevel=9,mtime=0))
scene=bpy.context.scene;scene.world.color=(.23,.23,.23)
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1800;scene.render.resolution_y=1600;scene.render.resolution_percentage=100
bpy.ops.object.light_add(type='AREA',location=(2,-4,12))
light=bpy.context.object;light.name='Large softbox';light.data.energy=1700;light.data.shape='DISK';light.data.size=10
bpy.ops.object.camera_add(location=(4.5,-13,18))
camera=bpy.context.object;camera.rotation_euler=(Vector((4.5,6,1.9))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=18.5;scene.camera=camera
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=18;area.spaces.active.region_3d.view_location=(4.5,6,2)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'brumaluz-headwear.blend'))
print('Authored 30 headwear prototypes with editable cages, closed hems and UVs.')
