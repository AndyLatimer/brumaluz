"""Blender-native Cumbres de Cobre (Pueblo Lagto') kit. Metres, Z up, front -Y.

Editable pieces remain organized in per-asset collections within the .blend scene;
exported GLBs use Y up, front +Z, grounded at Y=0, single mesh, painted texture atlas.
No external Python dependencies required.
"""
import bpy
import bmesh
import math
import json
import shutil
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art' / 'lagto'
OUT = ROOT / 'src' / 'assets' / 'library' / 'brumaluz-lagto'

PALETTE = {
    'copper': '#c8653b',           # 0  Cobre cálido martillado
    'copper_dark': '#84381b',      # 1  Cobre oxidado profundo
    'copper_bright': '#e5824c',    # 2  Cobre pulido / resaltes
    'copper_patina': '#427d6d',    # 3  Cardenillo / pátina verde-azulada
    'bronze': '#9e7534',           # 4  Bronce de fundición
    'iron_dark': '#2b3034',        # 5  Hierro forjado oscuro
    'iron_light': '#6c747a',       # 6  Hierro acerado / filo
    'stone_dark': '#383a40',       # 7  Basalto / roca base
    'stone_mid': '#6b6e75',        # 8  Granito de montaña
    'stone_light': '#9ca0a6',      # 9  Sillar escuadrado / pizarra clara
    'stone_copper': '#6d5248',     # 10 Roca mineralizada con vetas
    'wood_dark': '#3e2e25',        # 11 Cedro viejo de montaña
    'wood_mid': '#78563c',         # 12 Viga escuadrada
    'wood_light': '#a37a54',       # 13 Madera cepillada
    'leather_heavy': '#5c3826',    # 14 Cuero grueso de reptil
    'leather_light': '#8c583c',    # 15 Correas curtidas
    'textile_red': '#9e352b',      # 16 Rojo mineral Lagto'
    'textile_ochre': '#c9852c',    # 17 Ocre solar de las Cumbres
    'amber_glow': '#ffb03b',       # 18 Cristal de farol / resplandor
    'ember_red': '#e6421f',        # 19 Brasas incandescentes
    'crystal_ore': '#2bb3a0',      # 20 Cristales de malaquita / azurita
    'water': '#4a8891',            # 21 Agua de cisterna
    'ash': '#444448',              # 22 Ceniza de forja
    'gold_inlay': '#d4a34b',       # 23 Incrustación ceremonial
    'copper_verdigris': '#5fa896', # 24 Pátina turquesa clara
    'stone_gravel': '#524f4a',     # 25 Balasto de mena triturada
    'parchment': '#d9ca9c',        # 26 Pergamino / lienzo
    'brass_bright': '#c9a048',     # 27 Latón / bronce pulido
    'textile_pattern': '#a84c35',  # 28 Tejido de escamas y cenefa
    'banner_heraldry': '#96392c',  # 29 Pendón bordado
    'parchment_map': '#d9ca9c',    # 30 Trazado minero
    'stone_carved': '#787a73',     # 31 Cantería grabada
}

ASSETS = []
COLLECTION = None
MATERIAL = None
ATLAS = None


def init():
    global MATERIAL, ATLAS
    ART.mkdir(parents=True, exist_ok=True)
    (ART / 'objects').mkdir(parents=True, exist_ok=True)
    (ART / 'textures').mkdir(parents=True, exist_ok=True)
    (OUT / 'objects').mkdir(parents=True, exist_ok=True)
    (OUT / 'textures').mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        if col.name != 'Collection':
            bpy.data.collections.remove(col)

    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1

    from lagto_materials import create_material
    MATERIAL, ATLAS = create_material(OUT / 'textures')


def start_asset(name, label, category, description=''):
    global COLLECTION
    COLLECTION = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COLLECTION)
    COLLECTION['label'] = label
    COLLECTION['category'] = category
    COLLECTION['description'] = description
    ASSETS.append(dict(name=name, label=label, category=category, description=description))
    return COLLECTION


def _uv(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(MATERIAL)
    obj['surface'] = mat
    rgb = PALETTE[mat].lstrip('#')
    obj.color = tuple(int(rgb[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)
    uv = obj.data.uv_layers.new(name='PaintedAtlas') if not obj.data.uv_layers else obj.data.uv_layers[0]
    idx = list(PALETTE).index(mat)
    tile_x, tile_y = idx % 8, idx // 8
    coords = [v.co for v in obj.data.vertices]
    if not coords:
        return obj
    mins = [min(c[i] for c in coords) for i in range(3)]
    ranges = [max(1e-5, max(c[i] for c in coords) - mins[i]) for i in range(3)]
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for li in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            u = (p[a] - mins[a]) / ranges[a]
            v = (p[b] - mins[b]) / ranges[b]
            if mat.startswith('wood') and ranges[a] > ranges[b]:
                u, v = v, u
            uv.data[li].uv = ((tile_x + 0.055 + 0.89 * u) / 8.0, 1.0 - (tile_y + 0.055 + 0.89 * (1-v)) / 4.0)
    return obj


def mesh(name, verts, faces, mat='stone_mid'):
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


def box(name, loc, size, mat='stone_mid', bevel=0.02, rotation=None):
    sx, sy, sz = [s / 2.0 for s in size]
    verts = [
        (x * sx, y * sy, z * sz)
        for x, y, z in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    ]
    obj = mesh(name, verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat)
    if bevel > 0 and min(size) >= 0.04:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        soft = mat.startswith('textile') or ('leather' in mat and min(size) > .1)
        radius = min(max(bevel, min(size)*.28) if soft else bevel, min(size)*(.32 if soft else .2))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=radius, segments=3 if soft else 2, affect='EDGES')
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        _uv(obj, mat)
        for p in obj.data.polygons:
            p.use_smooth = True
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def cyl(name, loc, radius, depth, mat='stone_mid', vertices=14, rotation=None, radius_top=None, smooth=True):
    if vertices >= 10:
        vertices = max(vertices, 24)
    rt = radius if radius_top is None else radius_top
    verts = [
        (r * math.cos(i * math.tau / vertices), r * math.sin(i * math.tau / vertices), z)
        for r, z in [(radius, -depth / 2.0), (rt, depth / 2.0)]
        for i in range(vertices)
    ]
    faces = [tuple(reversed(range(vertices))), tuple(range(vertices, vertices * 2))]
    faces += [(i, (i + 1) % vertices, (i + 1) % vertices + vertices, i + vertices) for i in range(vertices)]
    obj = mesh(name, verts, faces, mat)
    if smooth:
        # Smooth shade lateral quads while keeping top and bottom caps flat
        for p in obj.data.polygons[2:]:
            p.use_smooth = True
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def sphere(name, loc, scale, mat='copper', subdivisions=2, rotation=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    for poly in data.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return _uv(obj, mat)


def beam(name, a, b, width, mat='wood_mid', depth=None):
    va, vb = Vector(a), Vector(b)
    length = (vb - va).length
    if length < 1e-5:
        length = 1e-3
    obj = box(name, (va + vb) / 2.0, (width, depth or width, length), mat, min(0.02, width * 0.15))
    obj.rotation_euler = (vb - va).to_track_quat('Z', 'Y').to_euler()
    return obj


def torus(name, loc, major, minor, mat='iron_dark', rotation=None, n=16, k=8):
    verts = []
    for i in range(n):
        a = math.tau * i / n
        for j in range(k):
            b = math.tau * j / k
            verts.append(((major + minor * math.cos(b)) * math.cos(a),
                          (major + minor * math.cos(b)) * math.sin(a),
                          minor * math.sin(b)))
    faces = [(i * k + j, ((i + 1) % n) * k + j, ((i + 1) % n) * k + (j + 1) % k, i * k + (j + 1) % k)
             for i in range(n) for j in range(k)]
    obj = mesh(name, verts, faces, mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def lathe(name, loc, profile, mat='copper', segments=16, rotation=None, cap_bottom=True, cap_top=True):
    if segments >= 12:
        segments = max(segments, 24)
    verts = [
        (r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
        for r, z in profile
        for i in range(segments)
    ]
    faces = []
    for row in range(len(profile) - 1):
        for i in range(segments):
            a = row * segments + i
            b = row * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    wall_count = len(faces)
    if cap_bottom:
        faces.append(tuple(reversed(range(segments))))
    if cap_top:
        faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    obj = mesh(name, verts, faces, mat)
    for p in obj.data.polygons[:wall_count]:
        p.use_smooth = True
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def ring(name, center, outer, inner, bottom, top, mat='copper', segments=16):
    x, y, z = center
    verts = []
    for zz in [bottom, top]:
        for r in [outer, inner]:
            for i in range(segments):
                ang = i * math.tau / segments
                verts.append((x + r * math.cos(ang), y + r * math.sin(ang), zz))
    faces = []
    for i in range(segments):
        nxt = (i + 1) % segments
        faces.append((i, nxt, nxt + segments * 2, i + segments * 2))
        faces.append((i + segments + segments * 2, nxt + segments + segments * 2, nxt + segments, i + segments))
        faces.append((nxt, i, i + segments, nxt + segments))
        faces.append((i + segments * 2, nxt + segments * 2, nxt + segments * 3, i + segments * 3))
    obj = mesh(name, verts, faces, mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def riveted_strap(name, cx, cy, cz, length, width, thickness=0.015, mat='copper', rivets=4, axis='X', plane='XY'):
    """Copper reinforcement strap studded with bronze rivets."""
    strap_size = (length, width, thickness) if axis == 'X' else (width, length, thickness)
    pieces=[box(f'{name}-plate', (0,0,0), strap_size, mat, bevel=0.005)]
    r_step = (length - width) / max(1, rivets - 1)
    for i in range(rivets):
        pos_offset = -(length - width) / 2.0 + i * r_step
        rx = pos_offset if axis == 'X' else 0
        ry = pos_offset if axis == 'Y' else 0
        rz = thickness / 2.0 + 0.006
        pieces.append(cyl(f'{name}-rivet-{i}', (rx,ry,rz), width*.15, .012, 'bronze', vertices=8))
    transform=Matrix.Identity(4)
    if plane=='XZ':transform=Matrix.Rotation(math.pi/2 if cy<=0 else -math.pi/2,4,'X')
    elif plane=='YZ':transform=Matrix.Rotation(math.pi/2 if cx>=0 else -math.pi/2,4,'Y')
    for obj in pieces:
        obj.location=Vector((cx,cy,cz))+transform.to_3x3() @ obj.location
        obj.rotation_euler=transform.to_euler()


def arch_frame(name, cx, cy, base_z, span, height, depth=0.35, mat='stone_light', voussoirs=7, keystone_mat='copper', axis='X'):
    """Authentic cyclopean masonry arch with curved radiating voussoirs and carved keystone."""
    half_span = span / 2.0
    r_in = half_span
    r_out = half_span + 0.32
    # Arch curve from 0 to pi
    for i in range(voussoirs):
        a1 = math.pi * i / voussoirs
        a2 = math.pi * (i + 1) / voussoirs
        mid_a = (a1 + a2) / 2.0
        # Check if center keystone
        is_keystone = (i == voussoirs // 2)
        v_mat = keystone_mat if is_keystone else mat
        v_depth = depth * 1.1 if is_keystone else depth
        hd = v_depth / 2.0

        c1 = math.cos(a1)
        s1 = math.sin(a1)
        c2 = math.cos(a2)
        s2 = math.sin(a2)

        if axis == 'X':
            x1_in, z1_in = cx - r_in * c1, base_z + r_in * s1
            x2_in, z2_in = cx - r_in * c2, base_z + r_in * s2
            x1_out, z1_out = cx - r_out * c1, base_z + r_out * s1
            x2_out, z2_out = cx - r_out * c2, base_z + r_out * s2

            verts = [
                (x1_in, cy - hd, z1_in), (x2_in, cy - hd, z2_in), (x2_out, cy - hd, z2_out), (x1_out, cy - hd, z1_out),
                (x1_in, cy + hd, z1_in), (x2_in, cy + hd, z2_in), (x2_out, cy + hd, z2_out), (x1_out, cy + hd, z1_out)
            ]
        else:
            y1_in, z1_in = cy - r_in * c1, base_z + r_in * s1
            y2_in, z2_in = cy - r_in * c2, base_z + r_in * s2
            y1_out, z1_out = cy - r_out * c1, base_z + r_out * s1
            y2_out, z2_out = cy - r_out * c2, base_z + r_out * s2

            verts = [
                (cx - hd, y1_in, z1_in), (cx - hd, y2_in, z2_in), (cx - hd, y2_out, z2_out), (cx - hd, y1_out, z1_out),
                (cx + hd, y1_in, z1_in), (cx + hd, y2_in, z2_in), (cx + hd, y2_out, z2_out), (cx + hd, y1_out, z1_out)
            ]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)
        ]
        mesh(f'{name}-voussoir-{i}', verts, faces, v_mat)


def cyclopean_wall_course(name, cx, cy, cz, width, depth, height, blocks=3, mat_main='stone_mid', mat_alt='stone_dark', bevel=0.025, axis='X'):
    """Articulated cyclopean masonry course with rusticated blocks and alternating quarry tones."""
    if axis == 'X':
        block_w = width / blocks
        for i in range(blocks):
            bx = cx - width / 2.0 + (i + 0.5) * block_w
            b_mat = mat_alt if (i % 2 == 1) else mat_main
            box(f'{name}-blk-{i}', (bx, cy, cz), (block_w * 0.98, depth, height * 0.98), b_mat, bevel=bevel)
    else:
        block_d = depth / blocks
        for i in range(blocks):
            by = cy - depth / 2.0 + (i + 0.5) * block_d
            b_mat = mat_alt if (i % 2 == 1) else mat_main
            box(f'{name}-blk-{i}', (cx, by, cz), (width, block_d * 0.98, height * 0.98), b_mat, bevel=bevel)


def saurian_war_shield(name, cx, cy, cz, scale=1.0, rotation=None):
    """Ceremonial Saurian war shield: pointed heater shape with copper rim, bronze boss, and red field."""
    s = scale
    outline=[(-.26,.36),(.26,.36),(.26,-.12),(0,-.39),(-.26,-.12)]
    inner=[(x*.82,z*.82) for x,z in outline]
    verts=[(x*s,y*s,z*s) for y in [-.035,.02] for x,z in inner]
    faces=[tuple(range(4,-1,-1)),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    field=mesh(f'{name}-field',verts,faces,'textile_red');field.location=(cx,cy,cz)
    rimverts=[(x*s,y*s,z*s) for y in [-.042,.025] for loop in [outline,inner] for x,z in loop]
    rimfaces=[]
    for i in range(5):
        n=(i+1)%5
        rimfaces.extend([(i,n,n+5,i+5),(i+10,i+15,n+15,n+10),(i,i+10,n+10,n),(i+5,n+5,n+15,i+15)])
    rim=mesh(f'{name}-copper-rim',rimverts,rimfaces,'copper_bright');rim.location=(cx,cy,cz)
    if rotation:
        field.rotation_euler=rotation;rim.rotation_euler=rotation
    sphere(f'{name}-boss', (cx, cy - 0.035 * s, cz), (0.09 * s, 0.04 * s, 0.09 * s), 'bronze', rotation=rotation)
    # Bronze crest spike
    cyl(f'{name}-spike', (cx, cy - 0.05 * s, cz), 0.025 * s, 0.12 * s, 'bronze', vertices=4, radius_top=0.005, rotation=(math.pi / 2.0, 0, 0))


def copper_standing_seam_roof(name, cx, cy, eave_z, width, depth, rise, mat='copper', seams=6):
    """High-detail hammered copper roof with understructure, standing seams and molded eaves."""
    half_w = width / 2.0
    slope = math.atan2(rise, half_w)
    length = math.hypot(half_w, rise)

    # Sub-roof decking
    for side in [-1, 1]:
        box(f'{name}-deck-{side}', (cx + side * half_w / 2.0, cy, eave_z + rise / 2.0),
            (length + 0.12, depth, 0.14), 'wood_dark', bevel=0.02, rotation=(0, side * slope, 0))
        # Copper sheet slope
        box(f'{name}-copper-sheet-{side}', (cx + side * half_w / 2.0, cy, eave_z + rise / 2.0 + 0.08),
            (length + 0.14, depth + 0.06, 0.05), mat, bevel=0.015, rotation=(0, side * slope, 0))
        # Standing seam ribs running down the pitch
        step_y = depth / max(1, seams - 1)
        for i in range(seams):
            sy = cy - depth / 2.0 + i * step_y
            beam(f'{name}-seam-{side}-{i}',
                 (cx, sy, eave_z + rise + 0.11),
                 (cx + side * (half_w + 0.08), sy, eave_z + 0.08),
                 0.06, 'copper_bright')
        # Molded eave fascia band
        beam(f'{name}-eave-fascia-{side}',
             (cx + side * (half_w + 0.06), cy - depth / 2.0 - 0.04, eave_z + 0.06),
             (cx + side * (half_w + 0.06), cy + depth / 2.0 + 0.04, eave_z + 0.06),
             0.12, 'copper_bright')

    # Heavy ridge cap
    cyl(f'{name}-ridge-cap', (cx, cy, eave_z + rise + 0.14), 0.12, depth + 0.1, 'copper_bright', vertices=10, rotation=(math.pi / 2.0, 0, 0))
    # Saurian ridge finials at both gables
    for offset_y in [-depth / 2.0 + 0.04, depth / 2.0 - 0.04]:
        gy = cy + offset_y
        cyl(f'{name}-finial-spire-{offset_y:.2f}', (cx, gy, eave_z + rise + 0.30), 0.05, 0.35, 'bronze', vertices=4, radius_top=0.01)
        sphere(f'{name}-finial-orb-{offset_y:.2f}', (cx, gy, eave_z + rise + 0.50), (0.08, 0.08, 0.08), 'gold_inlay')



def copper_brazier(name, cx, cy, cz, radius=0.45, height=0.4, mat='copper'):
    """Round hammered copper fire bowl holding burning coals and glowing embers."""
    bowl_prof = [
        (radius * 0.32, 0.0),
        (radius * 0.72, height * 0.22),
        (radius * 1.0, height * 0.65),
        (radius * 1.08, height * 0.85),
        (radius * 0.96, height * 1.0),
        (radius * 0.85, height * 1.0),
        (radius * 0.94, height * 0.85),
        (radius * 0.84, height * 0.65),
        (radius * 0.60, height * 0.30),
        (0, height * 0.25),
    ]
    lathe(f'{name}-bowl', (cx, cy, cz), bowl_prof, mat, segments=24, cap_top=False)
    cyl(f'{name}-ash', (cx, cy, cz + height * 0.7), radius * 0.88, 0.06, 'ash', vertices=12)
    for i in range(8):
        ang = i * math.tau / 8.0
        ex = cx + math.cos(ang) * radius * 0.44
        ey = cy + math.sin(ang) * radius * 0.44
        sphere(f'{name}-coal-{i}', (ex, ey, cz + height * 0.78), (0.08, 0.08, 0.06), 'ember_red', subdivisions=1)
    sphere(f'{name}-core', (cx, cy, cz + height * 0.82), (radius * 0.32, radius * 0.32, 0.09), 'amber_glow', subdivisions=2)


def copper_lantern_pendant(name, cx, cy, cz, scale=1.0):
    """Octagonal faceted copper lantern with amber glass and top hanging loop."""
    s = scale
    cyl(f'{name}-base', (cx, cy, cz + 0.03 * s), 0.16 * s, 0.06 * s, 'copper_dark', vertices=8)
    cyl(f'{name}-glass', (cx, cy, cz + 0.24 * s), 0.13 * s, 0.36 * s, 'amber_glow', vertices=8)
    for i in range(8):
        ang = i * math.tau / 8.0
        rx = cx + math.cos(ang) * 0.14 * s
        ry = cy + math.sin(ang) * 0.14 * s
        box(f'{name}-rib-{i}', (rx, ry, cz + 0.24 * s), (0.02 * s, 0.02 * s, 0.38 * s), 'copper', bevel=0.003)
    cyl(f'{name}-cap', (cx, cy, cz + 0.48 * s), 0.18 * s, 0.12 * s, 'copper_bright', vertices=8, radius_top=0.04 * s)
    cyl(f'{name}-chimney', (cx, cy, cz + 0.56 * s), 0.05 * s, 0.07 * s, 'copper_dark', vertices=8)
    torus(f'{name}-ring', (cx, cy, cz + 0.62 * s), 0.045 * s, 0.012 * s, 'iron_dark', rotation=(math.pi / 2.0, 0, 0))


def finish_asset():
    """Ground the asset at Z=0, unify into a single mesh with atlas, and export GLB."""
    from lagto_refinement import refine_asset
    refine_asset(COLLECTION)
    objects = [o for o in COLLECTION.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    lowest = min((obj.matrix_world @ Vector(corner)).z for obj in objects for corner in obj.bound_box)
    for obj in objects:
        obj.location.z -= lowest
    bpy.context.view_layer.update()

    xs = [(obj.matrix_world @ Vector(corner)).x for obj in objects for corner in obj.bound_box]
    ys = [(obj.matrix_world @ Vector(corner)).y for obj in objects for corner in obj.bound_box]
    zs = [(obj.matrix_world @ Vector(corner)).z for obj in objects for corner in obj.bound_box]
    dims = [round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(max(zs) - min(zs), 3)]

    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for obj in objects:
        dup = obj.copy()
        dup.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(dup)
        dup.select_set(True)
        copies.append(dup)

    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    exported = bpy.context.object
    exported.name = COLLECTION.name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Recalculate clean vertex normals across the unified mesh
    bm = bmesh.new()
    bm.from_mesh(exported.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=list(bm.edges))
    seen = set()
    for face in list(bm.faces):
        key = tuple(sorted(tuple(round(c,7) for c in v.co) for v in face.verts))
        if face.calc_area() < 1e-12 or key in seen:
            bm.faces.remove(face)
        else:
            seen.add(key)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(exported.data)
    bm.free()
    exported.data.update()
    if hasattr(exported.data, 'set_sharp_from_angle'):
        exported.data.set_sharp_from_angle(angle=math.radians(50))
    normals=exported.modifiers.new('Crafted weighted normals','WEIGHTED_NORMAL')
    normals.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normals.name)

    exported.data.materials.clear()
    exported.data.materials.append(MATERIAL)
    for face in exported.data.polygons:
        face.material_index = 0

    art_glb = ART / 'objects' / f'{COLLECTION.name}.glb'
    out_glb = OUT / 'objects' / f'{COLLECTION.name}.glb'

    bpy.ops.export_scene.gltf(
        filepath=str(art_glb),
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=False,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
    shutil.copy2(art_glb, out_glb)

    exported.data.calc_loop_triangles()
    ASSETS[-1]['triangles'] = len(exported.data.loop_triangles)
    ASSETS[-1]['parts'] = len(objects)
    ASSETS[-1]['dimensions_m'] = dict(width=dims[0], depth=dims[1], height=dims[2])
    ASSETS[-1]['glb'] = f'objects/{COLLECTION.name}.glb'

    mesh_data = exported.data
    bpy.data.objects.remove(exported, do_unlink=True)
    bpy.data.meshes.remove(mesh_data, do_unlink=True)
    print(f'LAGTO_ASSET: {COLLECTION.name} ({ASSETS[-1]["triangles"]} tris, {len(objects)} parts)', flush=True)
    return COLLECTION


def build_presentation_gallery():
    """Gallery arrangement of all assets in a 10x5 display grid inside _Presentation_only."""
    pres = bpy.data.collections.new('_Presentation_only')
    bpy.context.scene.collection.children.link(pres)

    cols_count = 10
    spacing_x = max(meta['dimensions_m']['width'] for meta in ASSETS)+1.5
    spacing_y = max(meta['dimensions_m']['depth'] for meta in ASSETS)+1.5
    for idx, meta in enumerate(ASSETS):
        col = bpy.data.collections.get(meta['name'])
        if not col:
            continue
        col.asset_mark()
        col.asset_data.description = f"{meta['label']} ({meta['category']}) — Cumbres de Cobre (Lagto')"

        col_idx = idx % cols_count
        row_idx = idx // cols_count
        gx = (col_idx - (cols_count - 1) / 2.0) * spacing_x
        gy = (2.0 - row_idx) * spacing_y

        # Pedestal pad
        pad = bpy.data.meshes.new(f"{meta['name']}_pad")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 4.4
            v.co.y *= 4.4
            v.co.z *= 0.08
        bm.to_mesh(pad)
        bm.free()
        pad_obj = bpy.data.objects.new(f"{meta['name']}_pad", pad)
        pad_obj.location = (gx, gy, -0.04)
        pres.objects.link(pad_obj)
        _uv(pad_obj, 'stone_dark')

        for src in col.objects:
            if src.type != 'MESH':
                continue
            dup = src.copy()
            dup.data = src.data.copy()
            dup.location = src.location + Vector((gx, gy, 0))
            pres.objects.link(dup)
        # The editable originals share a modeling origin; show only their spaced copies.
        col.hide_viewport=True
        col.hide_render=True
