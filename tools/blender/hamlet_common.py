"""Blender-native Brumaluz hamlet kit. Metres, Z up, front -Y.

Editable pieces keep their names; game exports use one painted atlas/material.
No external Python packages or downloaded models are required.
"""
import bpy
import bmesh
import math
import json
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art' / 'hamlet'
OUT = ROOT / 'src' / 'assets' / 'library' / 'brumaluz-hamlet'
PALETTE = {
    'wood': '#93613d', 'wood_dark': '#513b2e', 'wood_light': '#bd8752', 'wood_mid': '#a47146',
    'iron': '#3a4144', 'brass': '#b18a43', 'stone': '#92938a', 'stone_light': '#b9b6a6',
    'stone_dark': '#686f6c', 'plaster': '#e5d4aa', 'plaster_warm': '#d7bb91',
    'roof': '#ba6740', 'roof_light': '#cc8150', 'roof_dark': '#a55338',
    'teal': '#3c7378', 'teal_light': '#639593', 'linen': '#e8ddbd', 'red': '#a95951',
    'leaf': '#617d59', 'leaf_light': '#8da369', 'leaf_dark': '#3e624d', 'pot': '#b77655',
    'soil': '#524637', 'glass': '#718f8d', 'amber': '#ffd88a', 'water': '#5c9da3',
    'book_purple': '#78627f', 'book_blue': '#536f8c',
}
ASSETS = []
COLLECTION = None
MATERIAL = None
ATLAS = None


def init():
    global MATERIAL, ATLAS
    ART.mkdir(parents=True, exist_ok=True)
    (OUT / 'objects').mkdir(parents=True, exist_ok=True)
    (OUT / 'textures').mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        if col.name != 'Collection':
            bpy.data.collections.remove(col)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    # Shared 8 x 4 painted swatches. Subtle brush/grain/edge shading is baked
    # into a real embedded PNG rather than a Blender-only procedural shader.
    width, height, tile = 512, 256, 64
    ATLAS = bpy.data.images.new('Brumaluz_Hamlet_Painted_Atlas', width, height, alpha=False)
    pixels = [0.0] * (width * height * 4)
    keys = list(PALETTE)
    for y in range(height):
        for x in range(width):
            index = (y // tile) * 8 + x // tile
            key = keys[index] if index < len(keys) else 'linen'
            color = PALETTE[key].lstrip('#')
            rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
            u, v = (x % tile) / 63, (y % tile) / 63
            brush = math.sin(u * 37 + math.sin(v * 19) * 1.8) * .018 + math.sin(v * 53 + u * 11) * .012
            shade = .97 + .045 * math.sin(v * math.pi) + brush
            if key.startswith('wood'):
                grain = math.sin(v * 94 + math.sin(u * 9) * 2.5)
                shade += .035 * grain - .06 * max(0, grain - .7)
            elif key.startswith('stone') or key.startswith('plaster'):
                shade += .025 * math.sin(u * 56 + v * 61) * math.cos(v * 42 - u * 23)
            elif key in ('linen', 'teal', 'red'):
                shade += .018 * math.sin(u * 180) * math.sin(v * 180)
            elif key.startswith('roof'):
                shade += .035 * math.cos(u * 18) + .035 * v
            offset = (y * width + x) * 4
            pixels[offset:offset+4] = [min(1, c * shade) for c in rgb] + [1]
    ATLAS.pixels.foreach_set(pixels)
    ATLAS.filepath_raw = str(OUT / 'textures' / 'hamlet-painted-atlas.png')
    ATLAS.file_format = 'PNG'
    ATLAS.save()
    ATLAS.pack()
    MATERIAL = bpy.data.materials.new('Brumaluz_Hamlet_Painted')
    MATERIAL.use_nodes = True
    bsdf = MATERIAL.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .84
    tex = MATERIAL.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = ATLAS
    tex.interpolation = 'Linear'
    MATERIAL.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])


def start_asset(name, label, category):
    global COLLECTION
    COLLECTION = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COLLECTION)
    COLLECTION['label'] = label
    COLLECTION['category'] = category
    ASSETS.append(dict(name=name, label=label, category=category))
    return COLLECTION


def _uv(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(MATERIAL)
    obj['surface'] = mat
    rgb = PALETTE[mat].lstrip('#')
    obj.color = tuple(int(rgb[i:i+2], 16) / 255 for i in (0, 2, 4)) + (1,)
    uv = obj.data.uv_layers.new(name='PaintedAtlas') if not obj.data.uv_layers else obj.data.uv_layers[0]
    idx = list(PALETTE).index(mat)
    tile_x, tile_y = idx % 8, idx // 8
    coords = [v.co for v in obj.data.vertices]
    mins = [min(c[i] for c in coords) for i in range(3)]
    ranges = [max(1e-6, max(c[i] for c in coords) - mins[i]) for i in range(3)]
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for li in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            u = (p[a] - mins[a]) / ranges[a]
            v = (p[b] - mins[b]) / ranges[b]
            uv.data[li].uv = ((tile_x + .055 + .89 * u) / 8, (tile_y + .055 + .89 * v) / 4)
    return obj


def mesh(name, verts, faces, mat='wood'):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    return _uv(obj, mat)


def box(name, loc, size, mat='wood', bevel=.02, rotation=None):
    sx, sy, sz = [s / 2 for s in size]
    verts = [(x*sx, y*sy, z*sz) for x, y, z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    obj = mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)
    if bevel > 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size)*.22), segments=1, affect='EDGES')
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        _uv(obj, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def cyl(name, loc, radius, depth, mat='wood', vertices=12, rotation=None, radius_top=None):
    rt = radius if radius_top is None else radius_top
    verts = [(r*math.cos(i*math.tau/vertices), r*math.sin(i*math.tau/vertices), z) for r,z in [(radius,-depth/2),(rt,depth/2)] for i in range(vertices)]
    faces = [tuple(reversed(range(vertices))), tuple(range(vertices,vertices*2))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    obj = mesh(name, verts, faces, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def beam(name, a, b, width, mat='wood', depth=None):
    va, vb = Vector(a), Vector(b)
    obj = box(name, (va+vb)/2, (width, depth or width, (vb-va).length), mat, min(.025,width*.14))
    obj.rotation_euler = (vb-va).to_track_quat('Z','Y').to_euler()
    return obj


def sphere(name, loc, scale, mat='leaf', subdivisions=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.location = loc
    return _uv(obj, mat)


def torus(name, loc, major, minor, mat='iron', rotation=None):
    n, k = 12, 4
    verts = []
    for i in range(n):
        a = math.tau*i/n
        for j in range(k):
            b = math.tau*j/k
            verts.append(((major+minor*math.cos(b))*math.cos(a), (major+minor*math.cos(b))*math.sin(a), minor*math.sin(b)))
    faces = [(i*k+j, ((i+1)%n)*k+j, ((i+1)%n)*k+(j+1)%k, i*k+(j+1)%k) for i in range(n) for j in range(k)]
    obj = mesh(name, verts, faces, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def lathe(name, loc, profile, mat='pot', segments=12):
    verts = [(r*math.cos(i*math.tau/segments), r*math.sin(i*math.tau/segments), z) for r,z in profile for i in range(segments)]
    faces = []
    for row in range(len(profile)-1):
        for i in range(segments):
            a = row*segments+i
            b = row*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces += [tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))]
    obj = mesh(name,verts,faces,mat)
    obj.location = loc
    return obj


def arch_panel(name, center, width, height, depth, mat='wood', segments=10):
    x,y,z = center
    r = width/2
    outline = [(-r,0),(r,0),(r,height-r)]
    outline += [(r*math.cos(i*math.pi/segments),height-r+r*math.sin(i*math.pi/segments)) for i in range(1,segments+1)]
    n = len(outline)
    verts = [(xx,yy,zz) for yy in [-depth/2,depth/2] for xx,zz in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n,n*2))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj = mesh(name,verts,faces,mat)
    obj.location=(x,y,z)
    return obj


def arch_frame(name, center, width, height, thickness, mat='stone', segments=12, closed=False, depth=None):
    """One closed solid frame, with a continuous arch/jamb junction.

    `closed` includes the bottom rail for windows. Doorways keep an open sill.
    Decorative mortar lines sit on the face, never cut through the structure.
    """
    r=width/2
    spring=height-r
    depth=depth or thickness*1.2
    inner=[(-r,0)]+[(r*math.cos(math.pi-i*math.pi/segments),spring+r*math.sin(math.pi-i*math.pi/segments)) for i in range(segments+1)]+[(r,0)]
    outer=[(-r-thickness,-thickness if closed else 0)]+[((r+thickness)*math.cos(math.pi-i*math.pi/segments),spring+(r+thickness)*math.sin(math.pi-i*math.pi/segments)) for i in range(segments+1)]+[(r+thickness,-thickness if closed else 0)]
    count=len(inner)
    verts=[(x,y,z) for y in [-depth/2,depth/2] for profile in [inner,outer] for x,z in profile]
    faces=[]
    for i in range(count if closed else count-1):
        j=(i+1)%count
        faces.extend([(i,j,j+count,i+count),
                      (i+2*count,i+3*count,j+3*count,j+2*count),
                      (i,j,j+2*count,i+2*count),
                      (i+count,i+3*count,j+3*count,j+count)])
    if not closed:
        faces.extend([(0,count,3*count,2*count),(count-1,3*count-1,4*count-1,2*count-1)])
    obj=mesh(name+'-continuous-frame',verts,faces,mat)
    obj.location=center
    obj['joinery']='closed_window_frame' if closed else 'continuous_door_frame'
    obj['opening_width']=width
    obj['opening_height']=height
    obj['frame_thickness']=thickness
    obj['frame_depth']=depth
    objects=[obj]
    if mat.startswith('stone') or mat.startswith('roof'):
        x,y,z=center
        for i in range(1,segments):
            a=math.pi*i/segments
            objects.append(beam(name+'-mortar-joint',
                (x+(r+.003)*math.cos(a),y-depth/2-.001,z+spring+(r+.003)*math.sin(a)),
                (x+(r+thickness-.003)*math.cos(a),y-depth/2-.001,z+spring+(r+thickness-.003)*math.sin(a)),
                .006,'stone_dark',.002))
    return objects


def door(name, center, width=.95, height=1.8):
    x,y,z = center
    before=set(COLLECTION.objects)
    arch_panel(name+'-recess',(x,y+.025,z),width+.18,height+.12,.08,'wood_dark')
    arch_panel(name+'-oak',(x,y-.02,z+.015),width,height,.1,'wood')
    arch_frame(name+'-stone',(x,y-.015,z),width+.03,height+.03,.13,'stone_light')
    r=width/2
    for i in range(1,6):
        xx=-r+i*width/6
        top=height-r+math.sqrt(max(0,r*r-xx*xx))
        box(name+'-plank-seam',(x+xx,y-.078,z+top/2),(.012,.012,top-.035),'wood_dark',0)
    for zz in [.35,height*.64]:
        box(name+'-strap',(x,y-.086,z+zz),(width*.82,.035,.075),'iron',.012)
        for xx in [-width*.32,width*.32]:
            sphere(name+'-rivet',(x+xx,y-.112,z+zz),(.025,.018,.025),'brass')
    torus(name+'-handle',(x+width*.25,y-.13,z+.82),.065,.014,'brass',(math.pi/2,0,0))
    box(name+'-handle-escutcheon',(x+width*.25,y-.086,z+.875),(.105,.05,.145),'iron',.012)
    cyl(name+'-handle-pivot',(x+width*.25,y-.112,z+.88),.024,.075,'brass',10,(math.pi/2,0,0))
    return list(set(COLLECTION.objects)-before)


def window(name, center, width=.65, height=.85, shutters=True):
    x,y,z=center
    before=set(COLLECTION.objects)
    arch_panel(name+'-recess',(x,y+.04,z),width+.14,height+.08,.16,'wood_dark')
    arch_panel(name+'-glass',(x,y-.025,z+.01),width,height-.01,.06,'glass')
    frame=arch_frame(name+'-frame',(x,y-.07,z),width-.016,height-.016,.065,'wood_light',12,closed=True,depth=.09)[0]
    box(name+'-mullion',(x,y-.095,z+height/2),(.042,.055,height+.025),'wood_dark',.006)
    box(name+'-cross',(x,y-.098,z+height*.45),(width+.07,.055,.042),'wood_dark',.006)
    frame['window_mullion']=name+'-mullion'
    box(name+'-sill',(x,y-.065,z-.075),(width+.3,.27,.12),'wood_light',.012)
    if shutters:
        for s in [-1,1]:
            sx=x+s*(width*.5+.184)
            box(name+'-shutter',(sx,y-.07,z+height*.39),(.27,.09,height*.80),'teal',.012)
            for dx in [-.065,.065]:
                box(name+'-shutter-plank',(sx+dx,y-.118,z+height*.39),(.009,.008,height*.75),'teal_light',0)
            for zz in [.16,height*.63]:
                box(name+'-shutter-brace',(sx,y-.118,z+zz),(.27,.03,.05),'wood_dark',.006)
                cyl(name+'-shutter-hinge',(x+s*(width*.5+.055),y-.11,z+zz),.021,.10,'iron',8)
    return list(set(COLLECTION.objects)-before)


def planter(name, center, width=1):
    x,y,z=center
    before=set(COLLECTION.objects)
    box(name+'-soil',(x,y,z+.14),(width,.28,.2),'soil')
    for sy in [-1,1]:
        box(name+'-rim',(x,y+sy*.16,z+.15),(width+.08,.07,.28),'wood')
    for sx in [-1,1]:
        box(name+'-end',(x+sx*width*.5,y,z+.155),(.08,.35,.28),'wood_light')
    for i in range(max(3,int(width*6))):
        xx=x-width*.4+i*width*.8/max(1,int(width*6)-1)
        sphere(name+'-leaves',(xx,y,z+.35),(.15,.18,.16),'leaf' if i%2 else 'leaf_light')
        sphere(name+'-flower',(xx+.02,y-.04,z+.49),(.075,.075,.07),'linen' if i%3 else 'red')
    return list(set(COLLECTION.objects)-before)


def lantern(name, center, scale=1, wall_depth=0):
    x,y,z=center
    before=set(COLLECTION.objects)
    def p(a,b,c): return (x+a*scale,y+b*scale,z+c*scale)
    box(name+'-glow',p(0,0,.18),(.18*scale,.18*scale,.29*scale),'amber',.02*scale)
    for sx in [-1,1]:
        for sy in [-1,1]:
            beam(name+'-cage',p(sx*.10,sy*.10,.02),p(sx*.10,sy*.10,.34),.025*scale,'iron')
    for zz in [0,.35]:
        box(name+'-rim',p(0,0,zz),(.25*scale,.25*scale,.04*scale),'iron')
    cyl(name+'-cap',p(0,0,.415),.21*scale,.13*scale,'iron',4,radius_top=.06*scale)
    torus(name+'-ring',p(0,0,.51),.045*scale,.013*scale,'iron',(math.pi/2,0,0))
    if wall_depth:
        box(name+'-wall-plate',(x,y+wall_depth,z+.44*scale),(.15*scale,.065,.43*scale),'iron',.012)
        beam(name+'-wall-arm',(x,y+wall_depth,z+.60*scale),p(0,0,.60),.037*scale,'iron')
        beam(name+'-wall-knee',(x,y+wall_depth,z+.32*scale),p(0,.035,.60),.027*scale,'iron')
        beam(name+'-hanging-hook',p(0,0,.60),p(0,0,.515),.027*scale,'iron')
    return list(set(COLLECTION.objects)-before)


def sign(name, center, kind='leaf', width=.8, wall_depth=0):
    x,y,z=center
    before=set(COLLECTION.objects)
    box(name+'-board',(x,y,z),(width,.12,width*.66),'wood_dark',.07)
    box(name+'-inlay',(x,y-.07,z),(width*.85,.035,width*.51),'teal',.04)
    if kind=='leaf':
        obj=sphere(name+'-leaf',(x,y-.105,z),(.11*width,.035,.21*width),'linen',2)
        obj.rotation_euler.y=-.4
        beam(name+'-stem',(x-.07*width,y-.15,z-.17*width),(x+.07*width,y-.15,z+.17*width),.018,'brass')
    elif kind in ('bread','bakery'):
        sphere(name+'-loaf',(x,y-.11,z),(.28*width,.055,.12*width),'wood_light',2)
        for xx in [-.13,0,.13]:
            beam(name+'-score',(x+xx*width-.025,y-.17,z-.04),(x+xx*width+.025,y-.17,z+.05),.018,'linen')
    elif kind in ('hammer','carpenter'):
        beam(name+'-handle',(x-.12*width,y-.098,z-.17*width),(x+.12*width,y-.098,z+.13*width),.07*width,'wood_light')
        box(name+'-head',(x+.1*width,y-.103,z+.13*width),(.29*width,.05,.12*width),'linen',.015, (0,.2,0))
    else:
        torus(name+'-crest',(x,y-.14,z),width*.17,.028,'brass',(math.pi/2,0,0))
    for xx in [-width*.32,width*.32]:
        beam(name+'-hanger',(x+xx,y,z+width*.32),(x+xx,y,z+width*.58),.025,'iron')
    if wall_depth:
        beam(name+'-hanger-crossbar',(x-width*.35,y,z+width*.58),(x+width*.35,y,z+width*.58),.035,'iron')
        box(name+'-wall-plate',(x,y+wall_depth,z+width*.46),(.14,.065,width*.36),'iron',.012)
        beam(name+'-bracket',(x,y+wall_depth,z+width*.58),(x,y,z+width*.58),.04,'iron')
        beam(name+'-bracket-knee',(x,y+wall_depth,z+width*.34),(x,y+wall_depth*.35,z+width*.58),.027,'iron')
    return list(set(COLLECTION.objects)-before)


def roof(name, cx, cy, eave_z, width, depth, rise, mat='roof', axis='Y'):
    before=set(COLLECTION.objects)
    half=width/2
    slope=math.atan2(rise,half)
    length=math.hypot(half,rise)
    # The roof has a thick, closed timber understructure and individually
    # overlapping, gently staggered tiles. Ridges are capped all the way along.
    for s in [-1,1]:
        box(name+'-underroof',(cx+s*half/2,cy,eave_z+rise/2),(length+.10,depth-.10,.13),'wood_dark',.025,(0,s*slope,0))
        rows=max(4,math.ceil(length/.38))
        cols=max(6,math.ceil(depth/.40))
        for row in range(rows):
            t=(row+.48)/rows
            for col in range(cols):
                yy=cy-depth/2+(col+.5)*depth/cols
                xx=cx+s*(half*(1-t))
                zz=eave_z+rise*t+.10+row*.012
                color=mat if (row+col)%5 else ('roof_light' if mat.startswith('roof') else 'teal_light')
                box(name+'-tile',(xx,yy,zz),(length/rows+.085,depth/cols-.012,.065),color,.018,(0,s*slope,0))
        beam(name+'-eave',(cx+s*half,cy-depth/2,eave_z),(cx+s*half,cy+depth/2,eave_z),.13,'wood_light')
    for yy in [cy-depth/2,cy+depth/2]:
        for s in [-1,1]:
            beam(name+'-bargeboard',(cx+s*half,yy,eave_z+.02),(cx,yy,eave_z+rise+.10),.15,'wood_light')
    for i in range(max(4,math.ceil(depth/.34))):
        count=max(4,math.ceil(depth/.34))
        cyl(name+'-ridge',(cx,cy-depth/2+(i+.5)*depth/count,eave_z+rise+.15+(rows-1)*.012),.115,depth/count+.03,'roof_light' if mat=='roof' else 'teal_light',8,(math.pi/2,0,0))
    created=list(set(COLLECTION.objects)-before)
    if axis=='X':
        for obj in created:
            dx,dy=obj.location.x-cx,obj.location.y-cy
            obj.location.x,obj.location.y=cx-dy,cy+dx
            obj.rotation_euler.z+=math.pi/2
    return created


def finish_asset():
    """Export one grounded mesh, retaining the named construction pieces."""
    objects=[o for o in COLLECTION.objects if o.type=='MESH']
    bpy.context.view_layer.update()
    lowest=min((obj.matrix_world @ Vector(corner)).z for obj in objects for corner in obj.bound_box)
    for obj in objects:
        obj.location.z-=lowest
    bpy.context.view_layer.update()
    # Apply construction-piece transforms only on temporary export copies.
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for obj in objects:
        duplicate=obj.copy()
        duplicate.data=obj.data.copy()
        bpy.context.scene.collection.objects.link(duplicate)
        duplicate.select_set(True)
        copies.append(duplicate)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    exported=bpy.context.object
    exported.name=COLLECTION.name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # A single unified primitive is important for editor picking and map batching.
    exported.data.materials.clear()
    exported.data.materials.append(MATERIAL)
    for face in exported.data.polygons:
        face.material_index=0
    bpy.ops.export_scene.gltf(filepath=str(OUT/'objects'/(COLLECTION.name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=False,export_materials='EXPORT',export_cameras=False,export_lights=False)
    exported.data.calc_loop_triangles()
    ASSETS[-1]['triangles']=len(exported.data.loop_triangles)
    ASSETS[-1]['parts']=len(objects)
    bpy.data.objects.remove(exported,do_unlink=True)
    print('HAMLET_ASSET '+json.dumps(ASSETS[-1],ensure_ascii=False),flush=True)
    return COLLECTION
