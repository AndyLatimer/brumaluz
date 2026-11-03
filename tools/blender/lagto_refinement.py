"""Construction corrections and craft details, applied to editable source collections."""
import math
import bpy
import bmesh
from mathutils import Vector

def _remove(obj):
    data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
    if data.users==0:bpy.data.meshes.remove(data)

def _pocket(collection,label,loc,size,targets):
    from lagto_common import box,_uv
    cutter=box(label,loc,size,'stone_dark',bevel=0)
    bpy.context.view_layer.update()
    for obj in list(collection.objects):
        if obj==cutter or obj.type!='MESH' or not any(obj.name.startswith(p) for p in targets):continue
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Recess with real wall returns','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        if not obj.data.vertices:
            _remove(obj)
        else:
            _uv(obj,obj.get('surface','stone_mid'))
    _remove(cutter)

def _union(collection,prefixes):
    """Construct one solid joint where separate pieces would expose the same plane."""
    objects=[o for o in collection.objects if o.type=='MESH' and any(o.name.startswith(p) for p in prefixes)]
    if len(objects)<2:return
    base=objects[0]
    for other in objects[1:]:
        bpy.context.view_layer.objects.active=base
        mod=base.modifiers.new('Solid joined contact','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=other
        bpy.ops.object.modifier_apply(modifier=mod.name);_remove(other)

def _cloth(collection,obj,vertical=False,pattern=None):
    """Closed cloth sheet with a gentle continuous drape; no stacked relief motifs."""
    from lagto_common import mesh, _uv
    vertices=[v.co for v in obj.data.vertices]
    mins=[min(p[i] for p in vertices) for i in range(3)];maxs=[max(p[i] for p in vertices) for i in range(3)]
    nx,ny=20,20
    verts=[]
    for layer in [0,1]:
        for j in range(ny+1):
            for i in range(nx+1):
                u=i/nx;v=j/ny
                x=mins[0]+u*(maxs[0]-mins[0])
                if vertical:
                    z=mins[2]+v*(maxs[2]-mins[2]);y=mins[1]+layer*.018+.045*math.sin(u*math.tau*2.5)*(1-v)**1.5
                else:
                    y=mins[1]+v*(maxs[1]-mins[1]);fall=max(0,(abs(u-.5)-.41)/.09)
                    z=maxs[2]-layer*.016-.14*fall+.012*math.sin(u*math.tau*3)*math.sin(v*math.pi)
                verts.append((x,y,z))
    count=(nx+1)*(ny+1);faces=[]
    for layer in [0,1]:
        off=layer*count
        for j in range(ny):
            for i in range(nx):
                a=off+j*(nx+1)+i;f=(a,a+1,a+nx+2,a+nx+1);faces.append(f if layer==0 else tuple(reversed(f)))
    boundary=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
    for i,a in enumerate(boundary):b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+count,a+count))
    cloth=mesh(f'{obj.name}-draped',verts,faces,pattern or obj.get('surface','textile_red'))
    cloth.matrix_world=obj.matrix_world.copy()
    for face in cloth.data.polygons:face.use_smooth=True
    _uv(cloth,pattern or obj.get('surface','textile_red'))
    _remove(obj)

def refine_asset(collection):
    from lagto_common import box,beam,torus,cyl,_uv
    name=collection.name
    # Cloth copies world transforms; update after the builder's location assignments.
    bpy.context.view_layer.update()
    if name=='house_copper_bastion':
        _pocket(collection,'door wall pocket',(0,-2.36,1.52),(1.29,.37,1.92),['ground-core','gwall-f'])
        _pocket(collection,'upper window pocket',(0,-2.11,4.35),(.79,.34,.88),['upper-core','uwall-f'])
        for sx,z in [(2.08,1.9),(-2.08,1.9),(1.92,4.3),(-1.92,4.3)]:
            _pocket(collection,'side slit pocket',(sx,.3,z),(.40,.45,.84),['ground-core','upper-core','gwall-l','gwall-r'])
    elif name=='tower_drake_watch':
        _pocket(collection,'tower entry pocket',(0,-2.12,1.35),(.90,.30,1.79),['tower-door-frame','tower-shaft','tower-main','tower-body'])
    elif name=='hall_stone_council':
        _pocket(collection,'council entrance pocket',(0,-1.86,1.85),(1.86,.34,2.22),['hall-main-chamber'])
    elif name=='barracks_drake_guard':
        _pocket(collection,'barracks entrance pocket',(0,-1.50,1.5),(1.12,.34,2.07),['barracks-main-hall','barracks-door-frame'])
    elif name=='water_cistern_copper':
        _pocket(collection,'open cistern basin',(0,0,1.10),(1.50,1.0,.70),['cistern-stone-body'])

    # Decorative cloth remains real cloth instead of stone/metal polygons on top.
    for obj in list(collection.objects):
        if obj.type!='MESH':continue
        part=obj.name
        if name=='rug_lizard_weave' and any(p in part for p in ['diamond-motif','diamond-eye','diamond-bead']):
            _remove(obj);continue
        if name=='rug_lizard_weave' and part.startswith('rug-base'):_uv(obj,'textile_pattern')
        if name=='banner_lagto_clan':
            if part.startswith('banner-emblem'):_remove(obj);continue
            if part.startswith('banner-cloth-main'):_cloth(collection,obj,True,'banner_heraldry');continue
        if any(p in part for p in ['blanket-layer','bed-fur-fold','blanket-top','blanket-lower']):
            _cloth(collection,obj,False,'textile_pattern');continue
        if obj.get('surface')=='parchment' and any(p in part for p in ['map','plan','chart']):_uv(obj,'parchment_map')
        if obj.get('surface') in ['stone_light','stone_mid'] and any(p in part for p in ['tablet','stele']):_uv(obj,'stone_carved')

    # Joinery accents sized to read in the editor and during normal play.
    if name in ['bed_cavern_hearth','bunk_bed_miner','bench_quarry_slab']:
        for obj in list(collection.objects):
            if obj.type=='MESH' and ('pillow' in obj.name or 'cushion' in obj.name):
                _uv(obj,'textile_pattern')
    if name=='cabinet_vaulted_copper':
        for obj in list(collection.objects):
            if 'door-copper-panel' in obj.name:_uv(obj,'copper_patina')
    if name=='desk_cartographer_copper':
        # Existing paper and measuring tools get a legible survey drawing in the atlas.
        for obj in collection.objects:
            if obj.get('surface')=='parchment':_uv(obj,'parchment_map')
    if name=='table_stone_refectory':
        for sx in [-1,1]:
            for sy in [-1,1]:_union(collection,[f'bracket-top-x-{sx}-{sy}',f'bracket-top-y-{sx}-{sy}'])
    if name=='bed_cavern_hearth':_union(collection,['bed-stone-frame','bed-footboard'])
    if name=='cabinet_vaulted_copper':_union(collection,['cab-back-wall','cab-wall-','cab-floor','cab-roof','cab-kickboard','cab-header-rail','cab-jamb-','cab-astragal-stop'])
    if name=='mine_cart_turnout':_union(collection,['straight-rail-','curve-rail-'])
    if name=='crusher_ore_stamp':_union(collection,['crusher-guide-post-','crusher-top-beam'])
    if name=='warning_beacon_totem':_union(collection,['lizard-head-cranium','lizard-snout'])
    for obj in collection.objects:
        if obj.name.startswith('tongs-scissor-2'):obj.location.y+=.045
        if obj.name.startswith('rack-shelf-bot'):obj.location.z-=.012
