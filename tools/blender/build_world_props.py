"""Blender-native Pompelín world-map props kit (18 non-city, non-tree/rock assets).

Metres, Z up, front -Y in Blender; exported GLB uses Y up, front +Z, grounded at Y=0.
Editable construction pieces keep their names inside per-asset collections in the .blend file;
game-ready GLB exports join into one mesh per prop using a shared painted texture atlas.
"""
import bpy
import bmesh
import math
import json
import shutil
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art' / 'world-props'
OUT = ROOT / 'src' / 'assets' / 'library' / 'pompelin-world-props'

PALETTE = {
    'wood': '#93613d', 'wood_dark': '#513b2e', 'wood_light': '#bd8752', 'wood_mid': '#a47146',
    'iron': '#3a4144', 'brass': '#b18a43', 'stone': '#92938a', 'stone_light': '#b9b6a6',
    'stone_dark': '#686f6c', 'plaster': '#e5d4aa', 'plaster_warm': '#d7bb91',
    'roof': '#ba6740', 'roof_light': '#cc8150', 'roof_dark': '#a55338',
    'teal': '#3c7378', 'teal_light': '#639593', 'linen': '#e8ddbd', 'red': '#a95951',
    'leaf': '#617d59', 'leaf_light': '#8da369', 'leaf_dark': '#3e624d', 'pot': '#b77655',
    'soil': '#524637', 'glass': '#718f8d', 'amber': '#ffd88a', 'water': '#5c9da3',
    'straw': '#d9b468', 'ash': '#484542',
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

    width, height, tile = 128, 64, 16
    ATLAS = bpy.data.images.new('Pompelin_WorldProps_Painted_Atlas', width, height, alpha=False)
    pixels = [0.0] * (width * height * 4)
    keys = list(PALETTE)
    for y in range(height):
        for x in range(width):
            index = (y // tile) * 8 + x // tile
            key = keys[index] if index < len(keys) else 'linen'
            color = PALETTE[key].lstrip('#')
            rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
            u, v = (x % tile) / (tile - 1), (y % tile) / (tile - 1)
            shade = .96 + .05 * math.sin(v * math.pi)
            if key.startswith('wood') or key == 'straw':
                shade += .03 * math.sin(v * math.tau * 3)
            elif key.startswith('stone') or key.startswith('plaster') or key == 'ash':
                shade += .02 * math.cos(v * math.tau * 2)
            elif key.startswith('roof'):
                shade += .035 * v
            offset = (y * width + x) * 4
            pixels[offset:offset+4] = [min(1.0, max(0.0, c * shade)) for c in rgb] + [1.0]

    ATLAS.pixels.foreach_set(pixels)
    ATLAS.filepath_raw = str(OUT / 'textures' / 'world-props-atlas.png')
    ATLAS.file_format = 'PNG'
    ATLAS.save()
    # Save a copy in art/world-props/textures as well
    ATLAS.filepath_raw = str(ART / 'textures' / 'world-props-atlas.png')
    ATLAS.save()
    ATLAS.filepath_raw = str(OUT / 'textures' / 'world-props-atlas.png')
    ATLAS.pack()

    MATERIAL = bpy.data.materials.new('Pompelin_WorldProps_Painted')
    MATERIAL.use_nodes = True
    bsdf = MATERIAL.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .82
    tex = MATERIAL.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = ATLAS
    tex.interpolation = 'Linear'
    MATERIAL.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])


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
    verts = [
        (x * sx, y * sy, z * sz)
        for x, y, z in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    ]
    obj = mesh(name, verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat)
    if bevel > 0 and min(size) >= .055:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * .22), segments=1, affect='EDGES')
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
    verts = [
        (r * math.cos(i * math.tau / vertices), r * math.sin(i * math.tau / vertices), z)
        for r, z in [(radius, -depth / 2), (rt, depth / 2)]
        for i in range(vertices)
    ]
    faces = [tuple(reversed(range(vertices))), tuple(range(vertices, vertices * 2))]
    faces += [(i, (i + 1) % vertices, (i + 1) % vertices + vertices, i + vertices) for i in range(vertices)]
    obj = mesh(name, verts, faces, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def beam(name, a, b, width, mat='wood', depth=None):
    va, vb = Vector(a), Vector(b)
    length = (vb - va).length
    if length < 1e-5:
        length = 1e-3
    obj = box(name, (va + vb) / 2, (width, depth or width, length), mat, min(.025, width * .14))
    obj.rotation_euler = (vb - va).to_track_quat('Z', 'Y').to_euler()
    return obj


def sphere(name, loc, scale, mat='leaf', subdivisions=1, rotation=None):
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
    if rotation:
        obj.rotation_euler = rotation
    return _uv(obj, mat)


def torus(name, loc, major, minor, mat='iron', rotation=None, n=14, k=6):
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
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def lathe(name, loc, profile, mat='pot', segments=14, rotation=None):
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
    faces += [tuple(reversed(range(segments))), tuple((len(profile) - 1) * segments + i for i in range(segments))]
    obj = mesh(name, verts, faces, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    return obj


def ring(name, center, outer, inner, bottom, top, mat='iron', segments=14):
    x, y, z = center
    verts = [
        (x + r * math.cos(i * math.tau / segments),
         y + r * math.sin(i * math.tau / segments), z + zz)
        for r, zz in [(outer, bottom), (outer, top), (inner, top), (inner, bottom)]
        for i in range(segments)
    ]
    faces = []
    for row in range(4):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((row * segments + i, row * segments + j,
                          ((row + 1) % 4) * segments + j,
                          ((row + 1) % 4) * segments + i))
    return mesh(name, verts, faces, mat)


def arch_panel(name, center, width, height, depth, mat='stone', segments=12):
    x, y, z = center
    r = width / 2
    outline = [(-r, 0), (r, 0), (r, height - r)]
    outline += [(r * math.cos(i * math.pi / segments), height - r + r * math.sin(i * math.pi / segments))
                for i in range(1, segments + 1)]
    n = len(outline)
    verts = [(xx, yy, zz) for yy in [-depth / 2, depth / 2] for xx, zz in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    obj = mesh(name, verts, faces, mat)
    obj.location = (x, y, z)
    return obj


def arch_frame(name, center, width, height, thickness, mat='stone', segments=12, closed=False, depth=None):
    r = width / 2
    spring = height - r
    depth = depth or thickness * 1.2
    inner = [(-r, 0)] + [
        (r * math.cos(math.pi - i * math.pi / segments), spring + r * math.sin(math.pi - i * math.pi / segments))
        for i in range(segments + 1)
    ] + [(r, 0)]
    outer = [(-r - thickness, -thickness if closed else 0)] + [
        ((r + thickness) * math.cos(math.pi - i * math.pi / segments),
         spring + (r + thickness) * math.sin(math.pi - i * math.pi / segments))
        for i in range(segments + 1)
    ] + [(r + thickness, -thickness if closed else 0)]
    count = len(inner)
    verts = [(x, y, z) for y in [-depth / 2, depth / 2] for profile in [inner, outer] for x, z in profile]
    faces = []
    for i in range(count if closed else count - 1):
        j = (i + 1) % count
        faces.extend([
            (i, j, j + count, i + count),
            (i + 2 * count, i + 3 * count, j + 3 * count, j + 2 * count),
            (i, j, j + 2 * count, i + 2 * count),
            (i + count, i + 3 * count, j + 3 * count, j + count),
        ])
    if not closed:
        faces.extend([(0, count, 3 * count, 2 * count), (count - 1, 3 * count - 1, 4 * count - 1, 2 * count - 1)])
    obj = mesh(name, verts, faces, mat)
    obj.location = center
    return obj


def lantern_unit(name, center, scale=1.0):
    """Hanging or resting lantern whose bottom rests at center.z and top ring reaches center.z + 0.54*scale."""
    x, y, z = center
    def p(a, b, c):
        return (x + a * scale, y + b * scale, z + c * scale)
    box(name + '-base', p(0, 0, .025), (.24 * scale, .24 * scale, .05 * scale), 'iron', .008 * scale)
    box(name + '-glow', p(0, 0, .19), (.17 * scale, .17 * scale, .29 * scale), 'amber', .02 * scale)
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            beam(name + '-cage', p(sx * .095, sy * .095, .03), p(sx * .095, sy * .095, .35), .024 * scale, 'iron')
    box(name + '-top-rim', p(0, 0, .36), (.25 * scale, .25 * scale, .045 * scale), 'iron', .008 * scale)
    cyl(name + '-hood', p(0, 0, .425), .20 * scale, .12 * scale, 'iron', 4, radius_top=.055 * scale)
    torus(name + '-ring', p(0, 0, .50), .042 * scale, .013 * scale, 'brass', (math.pi / 2, 0, 0))


def spoked_wheel(name, center, radius=.42, width=.08, spokes=8, mat_wood='wood_dark', mat_spoke='wood_light'):
    """Wheel aligned with X axis (rolls along Y)."""
    cx, cy, cz = center
    torus(name + '-felloe', (cx, cy, cz), radius - .045, .048, mat_wood, (0, math.pi / 2, 0), n=16, k=6)
    torus(name + '-iron-tyre', (cx, cy, cz), radius, .020, 'iron', (0, math.pi / 2, 0), n=16, k=6)
    cyl(name + '-hub', (cx, cy, cz), .09, width * 2.1, mat_spoke, 10, (0, math.pi / 2, 0))
    cyl(name + '-hub-band-in', (cx - width * .65, cy, cz), .096, .03, 'iron', 10, (0, math.pi / 2, 0))
    cyl(name + '-hub-band-out', (cx + width * .65, cy, cz), .096, .03, 'iron', 10, (0, math.pi / 2, 0))
    cyl(name + '-axle-cap', (cx + math.copysign(width * 1.1, cx if cx != 0 else 1), cy, cz),
        .052, .04, 'brass', 8, (0, math.pi / 2, 0))
    for i in range(spokes):
        angle = i * math.tau / spokes
        beam(name + '-spoke', (cx, cy, cz),
             (cx, cy + math.cos(angle) * (radius - .05), cz + math.sin(angle) * (radius - .05)),
             .042, mat_spoke)


def small_barrel(name, center, height=.56, radius=.22, horizontal=False):
    cx, cy, cz = center
    if not horizontal:
        cyl(name + '-core', (cx, cy, cz + height * .5), radius * .88, height * .92, 'wood_dark', 12)
        cyl(name + '-belly', (cx, cy, cz + height * .5), radius, height * .58, 'wood', 12)
        cyl(name + '-top-taper', (cx, cy, cz + height * .84), radius, height * .22, 'wood_mid', 12, radius_top=radius * .86)
        cyl(name + '-bot-taper', (cx, cy, cz + height * .16), radius * .86, height * .22, 'wood_mid', 12, radius_top=radius)
        for zz, r in [(.12, radius * .90), (.32, radius * .99), (.68, radius * .99), (.88, radius * .90)]:
            ring(name + '-hoop', (cx, cy, cz), r + .012, r - .01, height * (zz - .03), height * (zz + .03), 'iron', 12)
        cyl(name + '-lid', (cx, cy, cz + height * .95), radius * .82, .03, 'wood_light', 12)
    else:
        cyl(name + '-core', (cx, cy, cz), radius * .88, height * .94, 'wood_dark', 12, (0, math.pi / 2, 0))
        cyl(name + '-belly', (cx, cy, cz), radius, height * .60, 'wood', 12, (0, math.pi / 2, 0))
        for sx in [-.34, -.15, .15, .34]:
            torus(name + '-hoop', (cx + sx * height, cy, cz), radius * (.93 if abs(sx) > .2 else .99),
                  .014, 'iron', (0, math.pi / 2, 0), n=12, k=4)


def direction_arrow(name, center, length, height, direction=1, angle_z=0.0, mat='wood_light', inlay='teal'):
    x, y, z = center
    half = length / 2
    outline = [
        (-half, -height / 2),
        (half - height * .65, -height / 2),
        (half, 0),
        (half - height * .65, height / 2),
        (-half, height / 2),
    ]
    verts = [(direction * xx, yy, zz) for yy in [-.042, .042] for xx, zz in outline]
    faces = [tuple(reversed(range(5))), tuple(range(5, 10))]
    faces += [(i, (i + 1) % 5, (i + 1) % 5 + 5, i + 5) for i in range(5)]
    board = mesh(name + '-board', verts, faces, mat)
    board.location = (x, y, z)
    board.rotation_euler = (0, 0, angle_z)

    in_half = length * .42
    in_h = height * .62
    outline_in = [
        (-in_half, -in_h / 2),
        (in_half - in_h * .65, -in_h / 2),
        (in_half, 0),
        (in_half - in_h * .65, in_h / 2),
        (-in_half, in_h / 2),
    ]
    verts_in = [(direction * xx, yy, zz) for yy in [-.050, .050] for xx, zz in outline_in]
    plaque = mesh(name + '-inlay', verts_in, faces, inlay)
    plaque.location = (x, y, z)
    plaque.rotation_euler = (0, 0, angle_z)
    return board, plaque


def wildflower_tuft(name, x, y, z, color='red', scale=1.0):
    sphere(name + '-foliage', (x, y, z + .04 * scale), (.12 * scale, .12 * scale, .06 * scale), 'leaf')
    for i in range(3):
        ang = i * math.tau / 3 + .4
        bx = x + math.cos(ang) * .055 * scale
        by = y + math.sin(ang) * .055 * scale
        sphere(name + '-blossom', (bx, by, z + .09 * scale), (.038 * scale, .038 * scale, .032 * scale), color)


def finish_asset():
    """Ground the asset at Z=0, record metrics, and export a single-mesh GLB."""
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
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(duplicate)
        duplicate.select_set(True)
        copies.append(duplicate)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    exported = bpy.context.object
    exported.name = COLLECTION.name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

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
    bpy.data.objects.remove(exported, do_unlink=True)
    print('WORLD_PROP_ASSET ' + json.dumps(ASSETS[-1], ensure_ascii=False), flush=True)
    return COLLECTION


# ==============================================================================
# CATEGORÍA 1: CAMINOS Y ORIENTACIÓN (6 modelos)
# ==============================================================================

def build_milestone_carved():
    start_asset(
        'milestone_carved',
        'Mojón de camino tallado',
        'Caminos y orientación',
        'Hito de sillería con capitel moldurado, placa de bronce con rosa de los vientos, argolla de amarre y farolillo.'
    )
    # Stepped stone plinth + small roadside curb stone
    box('plinth-foundation', (0, 0, .07), (1.02, .92, .14), 'stone_dark', .025)
    box('plinth-step', (0, 0, .19), (.82, .74, .14), 'stone', .022)
    box('plinth-molding', (0, 0, .30), (.66, .58, .10), 'stone_light', .018)
    box('front-curb-step', (0, -.48, .05), (.62, .22, .10), 'stone_light', .018)

    # Moss & wildflower tufts at base corners
    for sx, sy in [(-1, -1), (1, -1), (-1, 1)]:
        sphere('base-moss-cushion', (sx * .36, sy * .30, .13), (.15, .12, .07), 'leaf' if sx > 0 else 'leaf_dark')
    wildflower_tuft('base-flower', -.38, -.32, .14, 'amber', .85)

    # Main carved monolith shaft with corner pilasters & arched crown
    box('monolith-shaft', (0, 0, .86), (.48, .40, 1.06), 'stone', .035)
    for sx in [-.22, .22]:
        for sy in [-.18, .18]:
            box('corner-chamfer-pilaster', (sx, sy, .84), (.06, .06, .96), 'stone_light', .01)
    arch_panel('monolith-arched-crown', (0, 0, 1.24), .54, .46, .44, 'stone_light', segments=12)
    box('monolith-neck-collar', (0, 0, 1.25), (.56, .46, .08), 'stone_dark', .015)
    box('front-hood-gablet', (0, -.22, 1.28), (.40, .08, .07), 'stone_light', .012)
    sphere('crown-finial-orb', (0, 0, 1.74), (.095, .095, .095), 'stone_light')
    cyl('crown-finial-neck', (0, 0, 1.66), .07, .08, 'brass', 10)

    # Recessed front bronze wayfinder plaque (-Y front)
    box('plaque-frame', (0, -.20, 1.02), (.34, .04, .44), 'iron', .01)
    box('bronze-plaque', (0, -.212, 1.02), (.28, .035, .38), 'brass', .008)
    torus('compass-ring', (0, -.23, 1.06), .08, .015, 'iron', (math.pi / 2, 0, 0))
    sphere('compass-boss', (0, -.234, 1.06), (.032, .018, .032), 'linen')
    for angle in [0, math.pi / 2, math.pi, 3 * math.pi / 2]:
        beam('compass-ray', (0, -.23, 1.06),
             (math.cos(angle) * .095, -.23, 1.06 + math.sin(angle) * .095), .018, 'brass')

    # Carved distance tally grooves on lower front + iron hitching ring on left side (-X)
    for i, xx in enumerate([-.09, -.03, .03, .09]):
        box(f'league-tally-{i}', (xx, -.198, .62), (.022, .03, .16), 'stone_dark', .004)
    box('tally-ledge', (0, -.204, .50), (.36, .05, .05), 'stone_light', .008)
    cyl('hitch-mount', (-.25, 0, .78), .045, .06, 'iron', 8, (0, math.pi / 2, 0))
    torus('hitch-ring', (-.28, 0, .73), .065, .016, 'iron', (0, math.pi / 2, 0))

    # Side wrought-iron bracket & small lantern on right (+X)
    box('bracket-plate', (.245, 0, 1.16), (.04, .12, .30), 'iron', .008)
    beam('bracket-arm', (.245, 0, 1.28), (.50, 0, 1.28), .038, 'iron')
    beam('bracket-scroll-lower', (.245, 0, 1.06), (.44, 0, 1.26), .028, 'iron')
    beam('bracket-scroll-upper', (.245, 0, 1.35), (.38, 0, 1.28), .024, 'brass')
    beam('lantern-drop-hook', (.48, 0, 1.28), (.48, 0, 1.19), .024, 'iron')
    lantern_unit('wayside-lantern', (.48, 0, .77), scale=.84)

    finish_asset()


def build_signpost_wayfarer():
    start_asset(
        'signpost_wayfarer',
        'Poste indicador de encrucijada',
        'Caminos y orientación',
        'Poste de roble sobre cairn de sillería con tres flechas de ruta, placas colgantes, avisos y farol.'
    )
    # Stacked stone cairn & timber base
    box('stone-footing', (0, 0, .09), (.84, .84, .18), 'stone_dark', .025)
    box('stone-curb', (0, 0, .24), (.62, .62, .16), 'stone', .022)
    box('stone-collar-block', (0, 0, .38), (.44, .44, .14), 'stone_light', .018)
    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        box('cairn-corner-stone', (sx * .28, sy * .28, .20), (.20, .20, .14), 'stone_dark', .02)
    wildflower_tuft('cairn-flower', -.32, -.28, .18, 'red', .9)

    for sx in [-1, 1]:
        beam('timber-knee-brace-x', (sx * .22, 0, .34), (sx * .08, 0, .78), .078, 'wood_dark')
    for sy in [-1, 1]:
        beam('timber-knee-brace-y', (0, sy * .22, .34), (0, sy * .08, .78), .078, 'wood_dark')

    # Main central oak post
    box('oak-post', (0, 0, 1.42), (.20, .20, 2.52), 'wood', .022)
    for zz in [.44, 1.18, 1.74, 2.52]:
        box('iron-collar', (0, 0, zz), (.235, .235, .068), 'iron', .01)
        for s in [-1, 1]:
            sphere('collar-rivet', (s * .075, -.122, zz), (.02, .015, .02), 'brass')

    # Pointed cap and brass weathervane finial
    cyl('post-cap', (0, 0, 2.72), .17, .15, 'wood_light', 4, radius_top=.03)
    cyl('finial-rod', (0, 0, 2.86), .024, .22, 'brass', 8)
    sphere('finial-ball', (0, 0, 2.96), (.058, .058, .058), 'brass')
    box('weathervane-banner', (.10, 0, 2.90), (.18, .02, .07), 'brass', .005)

    # Three directional sign blades at distinct heights & angles + hanging distance tags
    direction_arrow('arrow-east', (.40, -.09, 2.32), 1.06, .25, direction=1, angle_z=0.0, mat='wood_light', inlay='teal')
    box('arrow-east-clamp', (.02, 0, 2.32), (.24, .24, .14), 'iron', .01)
    # Small brass league tag hanging under east arrow
    for dx in [.28, .52]:
        beam('tag-link', (dx, -.09, 2.20), (dx, -.09, 2.13), .018, 'iron')
    box('distance-subtag', (.40, -.09, 2.09), (.34, .035, .09), 'brass', .008)

    direction_arrow('arrow-west', (-.38, -.08, 1.98), 1.02, .25, direction=-1, angle_z=.18, mat='wood_light', inlay='red')
    box('arrow-west-clamp', (-.02, 0, 1.98), (.24, .24, .14), 'iron', .01)

    direction_arrow('arrow-north', (.28, .24, 1.64), .94, .23, direction=1, angle_z=.78, mat='wood_mid', inlay='linen')
    box('arrow-north-clamp', (0, 0, 1.64), (.24, .24, .13), 'iron', .01)

    # Hanging lantern arm pointing forward (-Y)
    beam('lantern-arm', (0, -.08, 2.48), (0, -.66, 2.48), .085, 'wood_dark')
    beam('lantern-strut', (0, -.08, 2.14), (0, -.50, 2.46), .065, 'wood_dark')
    beam('lantern-chain', (0, -.60, 2.48), (0, -.60, 2.34), .028, 'iron')
    lantern_unit('crossroads-lantern', (0, -.60, 1.84), scale=.95)

    # Notice tablet on lower front of post with small wooden hood
    box('notice-hood', (0, -.13, 1.21), (.44, .09, .05), 'wood_light', .008, (.18, 0, 0))
    box('notice-board', (0, -.12, 1.02), (.40, .05, .34), 'wood_dark', .01)
    box('notice-parchment', (0, -.146, 1.02), (.30, .02, .25), 'linen', .005)
    sphere('notice-wax-seal', (.08, -.158, .94), (.028, .012, .028), 'red')

    finish_asset()


def build_wayside_shrine():
    start_asset(
        'wayside_shrine',
        'Humilladero de caminantes',
        'Caminos y orientación',
        'Altar techado de piedra y roble con hornacina enrejada, estela solar, cuenco de ofrenda, velas y farol.'
    )
    # Stepped stone podium & front kneeling apron
    box('podium-lower', (0, -.04, .08), (1.42, 1.24, .16), 'stone_dark', .025)
    box('podium-upper', (0, 0, .22), (1.20, .98, .14), 'stone', .022)
    box('front-kneeling-step', (0, -.54, .15), (.86, .28, .12), 'stone_light', .02)
    box('altar-pedestal', (0, .05, .58), (.92, .68, .60), 'stone', .025)
    box('altar-mensa-slab', (0, .03, .92), (1.06, .82, .11), 'stone_light', .02)

    # Front carved relief on pedestal
    box('pedestal-panel', (0, -.30, .58), (.62, .04, .40), 'stone_dark', .01)
    torus('pedestal-rosette', (0, -.32, .58), .11, .022, 'brass', (math.pi / 2, 0, 0))
    for sx in [-.22, .22]:
        sphere('pedestal-boss', (sx, -.32, .58), (.03, .018, .03), 'brass')

    # Stone niche walls & arched opening above altar table
    box('shrine-back-wall', (0, .30, 1.42), (.86, .16, .94), 'stone_dark', .02)
    for sx in [-1, 1]:
        box('shrine-side-wall', (sx * .36, .06, 1.38), (.16, .54, .86), 'stone', .02)
        # Carved stone colonnettes flanking niche
        cyl('niche-colonnette', (sx * .28, -.18, 1.26), .045, .54, 'stone_light', 10)
        box('colonnette-capital', (sx * .28, -.18, 1.55), (.11, .11, .06), 'stone_dark', .008)
        # Front timber posts supporting roof overhang
        box('front-oak-post', (sx * .44, -.30, 1.40), (.11, .11, .90), 'wood_dark', .016)
        box('post-iron-shoe', (sx * .44, -.30, .99), (.135, .135, .08), 'iron', .008)
        beam('front-knee-brace', (sx * .44, -.30, 1.62), (sx * .24, -.30, 1.82), .068, 'wood')

    arch_frame('niche-stone-arch', (0, -.16, .96), .54, .84, .12, 'stone_light', segments=12, closed=False, depth=.18)

    # Low wrought-iron communion rail at front of niche
    beam('niche-iron-rail', (-.26, -.22, 1.08), (.26, -.22, 1.08), .022, 'iron')
    for xx in [-.18, -.09, 0, .09, .18]:
        beam('niche-rail-bar', (xx, -.22, .96), (xx, -.22, 1.08), .016, 'iron')

    # Interior sacred stele, brass sun emblem, offering bowl, two candles & flower
    arch_panel('interior-stele', (0, .18, .96), .38, .66, .08, 'stone_light', segments=10)
    torus('sun-halo', (0, .13, 1.40), .115, .02, 'brass', (math.pi / 2, 0, 0))
    sphere('sun-center', (0, .13, 1.40), (.058, .025, .058), 'amber')
    lathe('offering-bowl', (-.13, -.06, .96),
          [(0, 0), (.07, 0), (.10, .04), (.11, .08), (.08, .08), (.06, .03), (0, .03)], 'pot', 12)
    for cx, ch in [(.12, .15), (.19, .10)]:
        cyl('votive-candle', (cx, -.05, .96 + ch / 2), .034, ch, 'linen', 10)
        sphere('candle-flame', (cx, -.05, .96 + ch + .03), (.028, .028, .05), 'amber')
    wildflower_tuft('altar-offering-flower', -.02, -.12, .96, 'red', .7)

    # Pitched timber & tile roof + bargeboards + finial
    half_w, depth, eave_z, rise = .66, 1.06, 1.82, .44
    slope = math.atan2(rise, half_w)
    length = math.hypot(half_w, rise)
    for s in [-1, 1]:
        box('roof-deck', (s * half_w / 2, .02, eave_z + rise / 2),
            (length + .08, depth, .09), 'wood_dark', .018, (0, s * slope, 0))
        beam('front-bargeboard', (s * half_w, -.51, eave_z + .02), (0, -.51, eave_z + rise + .09), .09, 'wood_light')
        for row in range(3):
            t = (row + .45) / 3
            for col in range(4):
                yy = .02 - depth / 2 + (col + .5) * depth / 4
                xx = s * half_w * (1 - t)
                zz = eave_z + rise * t + .06 + row * .01
                box('roof-tile', (xx, yy, zz), (length / 3 + .05, depth / 4 - .015, .05),
                    'roof' if (row + col) % 2 else 'roof_light', .012, (0, s * slope, 0))
    beam('ridge-beam', (0, -.54, eave_z + rise + .09), (0, .58, eave_z + rise + .09), .12, 'roof_dark')
    cyl('roof-peak-finial', (0, -.50, eave_z + rise + .20), .05, .14, 'brass', 8, radius_top=.015)

    # Small hanging welcome lantern under front gable
    beam('gable-hook', (0, -.46, 2.12), (0, -.46, 2.02), .025, 'iron')
    lantern_unit('shrine-lantern', (0, -.46, 1.66), scale=.68)

    finish_asset()


def build_ancient_ruin_arch():
    start_asset(
        'ancient_ruin_arch',
        'Arco antiguo en ruinas',
        'Caminos y orientación',
        'Vestigio de portal de sillería antigua con pilar entero, arco truncado con medallón, columna caída y brasero.'
    )
    # Ancient paved threshold slabs
    box('threshold-slab-main', (-.15, 0, .07), (1.82, 1.22, .14), 'stone_dark', .028)
    box('threshold-slab-east', (.90, -.06, .06), (.76, .98, .12), 'stone', .025, (0, 0, -.08))
    box('threshold-step', (-.10, -.44, .15), (1.46, .46, .12), 'stone_light', .022)

    # Left pillar (-X): intact tall stone pier with base, fluted pilasters, capital & partial arch voussoirs
    px = -.78
    box('west-pier-plinth', (px, 0, .24), (.64, .64, .26), 'stone_dark', .025)
    box('west-pier-base', (px, 0, .44), (.56, .56, .18), 'stone_light', .02)
    for i, zz in enumerate([.72, 1.12, 1.52, 1.92]):
        box(f'west-pier-block-{i}', (px, 0, zz), (.48, .48, .39),
            'stone' if i % 2 == 0 else 'stone_light', .022)
    for fx in [-.12, 0, .12]:
        box('pier-flute-groove', (px + fx, -.242, 1.32), (.04, .03, 1.38), 'stone_dark', .005)
    box('west-pier-capital', (px, 0, 2.20), (.60, .60, .18), 'stone_light', .022)
    box('west-pier-abacus', (px, 0, 2.34), (.66, .64, .12), 'stone_dark', .02)
    torus('capital-medallion', (px, -.31, 2.20), .07, .016, 'brass', (math.pi / 2, 0, 0))

    # Partial arch springing from left pier toward center
    arch_cx, arch_cz, arch_r = 0.0, 2.28, .78
    for i in range(6):
        a = math.pi - (i + .45) * (math.pi * .55 / 6)
        vx = arch_cx + arch_r * math.cos(a)
        vz = arch_cz + arch_r * math.sin(a)
        rot_y = math.pi - a
        box(f'arch-voussoir-west-{i}', (vx, 0, vz), (.34, .44, .26),
            'stone_light' if i % 2 else 'stone', .02, (0, rot_y, 0))

    # Right pillar (+X): broken half-height pier with tilted top block
    rx = .78
    box('east-pier-plinth', (rx, 0, .24), (.64, .64, .26), 'stone_dark', .025)
    box('east-pier-base', (rx, 0, .44), (.56, .56, .18), 'stone_light', .02)
    box('east-pier-block-0', (rx, 0, .72), (.48, .48, .39), 'stone', .022)
    box('east-pier-block-1', (rx, .02, 1.10), (.46, .46, .36), 'stone_light', .022, (.03, -.04, .06))
    box('east-pier-fractured-top', (rx - .03, -.02, 1.36), (.42, .42, .22), 'stone_dark', .02, (-.05, .08, -.12))

    # Fallen carved blocks & fluted column drum resting on threshold at right
    box('fallen-voussoir-1', (.30, -.24, .24), (.36, .42, .28), 'stone', .02, (.12, .28, -.35))
    cyl('fallen-column-drum', (.48, .26, .26), .19, .46, 'stone_light', 12, (.15, math.pi / 2 - .18, .45))

    # Climbing ivy vine & moss cushions on joints
    beam('climbing-ivy-stem', (-1.02, -.22, .36), (-.92, -.24, 1.88), .045, 'leaf_dark')
    for pos, sc in [
        ((-.78, -.25, .38), (.18, .10, .08)),
        ((-.96, -.24, .88), (.14, .11, .14)),
        ((-.94, -.24, 1.46), (.15, .11, .13)),
        ((-.78, -.24, 2.26), (.16, .10, .09)),
        ((.78, -.23, 1.24), (.17, .12, .08)),
        ((.32, -.20, .38), (.14, .12, .07)),
    ]:
        sphere('ruin-moss', pos, sc, 'leaf')

    # Ancient bronze & iron traveller brazier beside the intact pier
    bx, by = -.28, -.18
    cyl('brazier-pedestal', (bx, by, .22), .18, .18, 'stone_dark', 10)
    for i in range(3):
        ang = i * math.tau / 3 + .3
        beam('brazier-leg', (bx + math.cos(ang) * .15, by + math.sin(ang) * .15, .28),
             (bx + math.cos(ang) * .19, by + math.sin(ang) * .19, .62), .038, 'iron')
    lathe('brazier-bowl', (bx, by, .52),
          [(0, 0), (.14, .02), (.24, .10), (.27, .18), (.22, .18), (.14, .08), (0, .06)], 'brass', 12)
    sphere('brazier-embers', (bx, by, .66), (.18, .18, .07), 'amber')
    sphere('brazier-flame', (bx, by, .74), (.09, .09, .13), 'red')

    finish_asset()


def build_stone_footbridge():
    start_asset(
        'stone_footbridge',
        'Puente rústico de arroyo',
        'Caminos y orientación',
        'Pasarela arqueada de sillería y tablones de roble con pretiles bajos, estribos de piedra y farol de paso.'
    )
    # Stone abutments at left (-X) and right (+X)
    for sx in [-1, 1]:
        box('abutment-footing', (sx * 1.28, 0, .14), (.68, 1.56, .28), 'stone_dark', .025)
        box('abutment-pier', (sx * 1.18, 0, .42), (.56, 1.44, .34), 'stone', .022)
        for sy in [-.64, .64]:
            box('end-newel-pillar', (sx * 1.24, sy, .78), (.28, .28, .68), 'stone_light', .02)
            box('newel-cap', (sx * 1.24, sy, 1.15), (.32, .32, .09), 'stone_dark', .015)

    # Sloped stone approach ramps at both ends
    for sx in [-1, 1]:
        box('approach-ramp', (sx * 1.54, 0, .20), (.58, 1.32, .16), 'stone', .02, (0, sx * .26, 0))

    # Segmental stone arch ribs & oak deck planks spanning X from -1.18 to +1.18
    segs = 9
    span = 2.28
    rise = .30
    base_z = .48
    for i in range(segs):
        t = (i + .5) / segs
        u = (t - .5) * 2  # -1 to +1
        xx = u * (span / 2)
        zz = base_z + rise * (1 - u * u)
        slope_y = math.atan2(2 * rise * u / (span / 2), 1.0)
        # Arch stone voussoir under deck
        for sy in [-.56, .56]:
            box(f'arch-rib-{i}', (xx, sy, zz - .12), (.31, .22, .20),
                'stone_light' if i % 2 else 'stone', .018, (0, slope_y, 0))
        # Heavy oak deck plank
        box(f'bridge-deck-plank-{i}', (xx, 0, zz + .02), (.26, 1.36, .08),
            'wood' if i % 2 else 'wood_mid', .012, (0, slope_y, 0))

    # Timber parapet railings on both sides (-Y and +Y)
    for sy in [-.62, .62]:
        for xx, pz in [(-.62, .94), (0, 1.04), (.62, .94)]:
            box('railing-post', (xx, sy, pz), (.10, .10, .52), 'wood_dark', .012)
        beam('handrail-west', (-1.22, sy, 1.06), (0, sy, 1.24), .085, 'wood_light')
        beam('handrail-east', (0, sy, 1.24), (1.22, sy, 1.06), .085, 'wood_light')
        beam('midrail-west', (-1.22, sy, .84), (0, sy, 1.00), .055, 'wood')
        beam('midrail-east', (0, sy, 1.00), (1.22, sy, .84), .055, 'wood')

    # Wrought-iron lantern standard on front-left newel pillar
    box('bridge-lantern-stem', (-1.24, -.64, 1.48), (.07, .07, .62), 'iron', .008)
    beam('bridge-lantern-arm', (-1.24, -.64, 1.76), (-.92, -.64, 1.76), .04, 'iron')
    lantern_unit('bridge-lantern', (-.94, -.64, 1.32), scale=.78)

    finish_asset()


def build_boundary_obelisk():
    start_asset(
        'boundary_obelisk',
        'Obelisco fronterizo de comarca',
        'Caminos y orientación',
        'Aguja monolítica tallada con anillos de bronce, escudos comarcales, bolardos con cadenas y farol.'
    )
    # Octagonal/stepped stone platform
    box('obelisk-plinth-1', (0, 0, .08), (1.56, 1.56, .16), 'stone_dark', .025)
    box('obelisk-plinth-2', (0, 0, .22), (1.18, 1.18, .14), 'stone', .022)
    box('obelisk-pedestal', (0, 0, .58), (.72, .72, .62), 'stone_light', .025)
    box('pedestal-cornice', (0, 0, .92), (.82, .82, .10), 'stone_dark', .018)

    # Bronze heraldic plaques on all 4 pedestal faces
    for rot_z, dx, dy in [(0, 0, -.37), (math.pi / 2, .37, 0), (math.pi, 0, .37), (-math.pi / 2, -.37, 0)]:
        box('heraldic-plaque', (dx, dy, .58), (.36, .04, .38), 'brass', .008, (0, 0, rot_z))
        torus('heraldic-ring', (dx * 1.03, dy * 1.03, .58), .10, .016, 'iron', (math.pi / 2, 0, rot_z))

    # Tapered stone obelisk spire (3 tiers + pyramidion cap)
    cyl('obelisk-tier-1', (0, 0, 1.42), .34, .92, 'stone', 4, (0, 0, math.pi / 4), radius_top=.27)
    box('bronze-collar-1', (0, 0, 1.89), (.42, .42, .07), 'brass', .01)
    cyl('obelisk-tier-2', (0, 0, 2.32), .26, .82, 'stone_light', 4, (0, 0, math.pi / 4), radius_top=.19)
    box('bronze-collar-2', (0, 0, 2.74), (.31, .31, .06), 'brass', .008)
    cyl('obelisk-pyramidion', (0, 0, 3.00), .19, .46, 'brass', 4, (0, 0, math.pi / 4), radius_top=.01)
    sphere('obelisk-apex-sun', (0, 0, 3.26), (.065, .065, .065), 'amber')

    # Four corner stone bollards linked with sagging iron chains
    corners = [(-.62, -.62), (.62, -.62), (.62, .62), (-.62, .62)]
    for cx, cy in corners:
        cyl('corner-bollard', (cx, cy, .36), .10, .44, 'stone_dark', 8)
        sphere('bollard-cap', (cx, cy, .60), (.105, .105, .07), 'iron')
    for i in range(4):
        x1, y1 = corners[i]
        x2, y2 = corners[(i + 1) % 4]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        beam('perimeter-chain-a', (x1, y1, .48), (mx, my, .36), .028, 'iron')
        beam('perimeter-chain-b', (mx, my, .36), (x2, y2, .48), .028, 'iron')

    # Resting bronze lantern on front pedestal ledge
    lantern_unit('border-lantern', (.26, -.42, .29), scale=.74)

    finish_asset()


# ==============================================================================
# CATEGORÍA 2: CAMPAMENTOS Y DESCANSO (6 modelos)
# ==============================================================================

def build_campfire_cooking_tripod():
    start_asset(
        'campfire_cooking_tripod',
        'Hoguera de viajero con trípode',
        'Campamentos y descanso',
        'Hoguera cercada de piedra con trípode de forja, caldero colgante, dos troncos de asiento, pan y leña.'
    )
    # Packed earth & ash bed
    cyl('earth-pad', (0, 0, .03), 1.12, .06, 'soil', 16)
    cyl('ash-hearth', (0, 0, .065), .64, .05, 'ash', 14)

    # Ring of 10 hearth stones
    stone_count = 10
    for i in range(stone_count):
        ang = i * math.tau / stone_count
        rx = math.cos(ang) * .64
        ry = math.sin(ang) * .64
        box(f'hearth-stone-{i}', (rx, ry, .12), (.26, .20, .16),
            'stone' if i % 2 else 'stone_dark', .03, (0, 0, ang + math.pi / 2))

    # Crossed firewood logs & glowing embers
    for i in range(4):
        ang = i * math.pi / 4 + .2
        beam(f'fire-log-{i}',
             (math.cos(ang) * .42, math.sin(ang) * .42, .11),
             (-math.cos(ang) * .38, -math.sin(ang) * .38, .22),
             .11, 'wood_dark' if i % 2 else 'wood')
    sphere('ember-core', (0, 0, .14), (.34, .34, .10), 'amber')
    sphere('flame-main', (0, 0, .28), (.19, .17, .25), 'amber')
    sphere('flame-tip', (.04, -.03, .43), (.11, .10, .18), 'red')

    # Forged iron tripod (3 tall legs meeting at apex ring)
    apex = (0, 0, 1.58)
    for i in range(3):
        ang = i * math.tau / 3 - math.pi / 2
        foot = (math.cos(ang) * .78, math.sin(ang) * .78, .06)
        box(f'tripod-foot-pad-{i}', foot, (.12, .12, .06), 'stone_dark', .01)
        beam(f'tripod-leg-{i}', foot, apex, .048, 'iron')
    torus('tripod-apex-ring', apex, .085, .022, 'iron', (0, 0, 0))
    cyl('tripod-apex-collar', (0, 0, 1.54), .065, .10, 'brass', 10)

    # Hanging chain & cast-iron cooking cauldron
    for i, zz in enumerate([1.44, 1.32, 1.20, 1.08]):
        torus(f'suspension-chain-{i}', (0, 0, zz), .045, .013, 'iron',
              (math.pi / 2, math.pi / 2 if i % 2 else 0, 0))
    lathe('iron-cauldron', (0, 0, .54),
          [(0, 0), (.18, .02), (.29, .12), (.32, .26), (.27, .38),
           (.30, .42), (.25, .42), (.23, .36), (.25, .22), (0, .18)], 'iron', 14)
    cyl('stew-broth', (0, 0, .90), .24, .04, 'amber', 12)
    torus('cauldron-bail-handle', (0, 0, .96), .26, .018, 'iron', (math.pi / 2, 0, 0))
    beam('wooden-ladle', (.06, -.04, .91), (.24, -.18, 1.12), .032, 'wood_light')

    # Front split-log bench seat + second angled log seat on left + small meal crate with mug
    cyl('log-seat-main', (0, -.98, .20), .17, .96, 'wood', 10, (0, math.pi / 2, .10))
    for sx in [-.32, .32]:
        box('log-seat-chock', (sx, -.98, .08), (.16, .28, .12), 'wood_dark', .015)

    cyl('log-seat-side', (-.92, .28, .18), .15, .78, 'wood_mid', 10, (0, math.pi / 2, 1.25))
    box('camp-stool-crate', (-.66, -.72, .16), (.32, .28, .22), 'wood_light', .012, (0, 0, -.3))
    cyl('traveler-mug', (-.64, -.70, .31), .045, .09, 'pot', 10)
    sphere('camp-bread-loaf', (-.72, -.74, .29), (.07, .055, .04), 'straw')

    # Stacked spare firewood on right
    for row, zz in enumerate([.10, .20]):
        for col in range(3 - row):
            lx = .78 + (col - (2 - row) * .5) * .12
            cyl(f'spare-firewood-{row}-{col}', (lx, .56, zz), .06, .48, 'wood_light' if col % 2 else 'wood', 8, (math.pi / 2, 0, .3))

    finish_asset()


def build_traveler_tent():
    start_asset(
        'traveler_tent',
        'Tienda de campaña de viajero',
        'Campamentos y descanso',
        'Tienda de lona y roble con vientos tensores, petate, mesa de campaña con mapa, escudo y farol.'
    )
    # Woven groundcloth & timber base sills
    box('groundsheet-mat', (0, .05, .035), (1.78, 2.28, .07), 'wood_dark', .018)
    for sx in [-.84, .84]:
        box('tent-base-rail', (sx, .05, .09), (.09, 2.22, .09), 'wood', .014)

    # Front (-Y) and Rear (+Y) A-frame poles + ridgepole with finial pegs
    ridge_z = 1.56
    for yy in [-.98, 1.08]:
        box('upright-tent-pole', (0, yy, ridge_z / 2 + .04), (.095, .095, ridge_z), 'wood', .014)
        cyl('pole-top-spindle', (0, yy, ridge_z + .16), .035, .14, 'brass', 8, radius_top=.01)
        for sx in [-1, 1]:
            beam('a-frame-rafter', (sx * .84, yy, .10), (0, yy, ridge_z + .04), .075, 'wood_mid')
    box('ridgepole', (0, .05, ridge_z + .05), (.10, 2.42, .10), 'wood_light', .016)

    # Pitched canvas roof panels (two slopes) + decorative teal stripe + ridge cap
    half_w = .88
    rise = ridge_z - .14
    slope = math.atan2(rise, half_w)
    panel_len = math.hypot(half_w, rise)
    for sx in [-1, 1]:
        box('canvas-roof-slope', (sx * half_w / 2, .05, .14 + rise / 2),
            (panel_len + .06, 2.16, .055), 'linen', .012, (0, sx * slope, 0))
        box('canvas-trim-band', (sx * half_w * .62, .05, .14 + rise * .38 + .02),
            (.28, 2.18, .058), 'teal', .01, (0, sx * slope, 0))
    box('canvas-ridge-crest', (0, .05, ridge_z + .09), (.22, 2.20, .05), 'teal_light', .01)

    # Rear closed gable & front parted entrance flaps
    verts_back = [(-.84, 1.08, .12), (.84, 1.08, .12), (0, 1.08, ridge_z + .02)]
    mesh('rear-gable-canvas', verts_back, [(0, 1, 2)], 'linen')
    box('rear-gable-seam', (0, 1.10, .80), (.08, .05, 1.36), 'wood_mid', .008)

    for sx in [-1, 1]:
        beam('front-tied-flap', (sx * .80, -.98, .12), (sx * .22, -.96, 1.38), .22, 'teal_light', depth=.06)

    # Guy ropes & wooden stakes on both sides
    for sx in [-1, 1]:
        for yy in [-.78, 0.05, .88]:
            stake_pos = (sx * 1.18, yy, .12)
            eave_pos = (sx * .86, yy, .24)
            box('wooden-stake', stake_pos, (.06, .06, .24), 'wood_light', .008, (0, -sx * .25, 0))
            box('stake-iron-band', (sx * 1.16, yy, .21), (.07, .07, .04), 'iron', .005, (0, -sx * .25, 0))
            beam('guy-rope', eave_pos, (sx * 1.16, yy, .18), .024, 'straw')

    # Rolled bedroll outside front left + traveler shield leaning against front frame
    cyl('bedroll-blanket', (-.52, -1.24, .16), .15, .74, 'red', 12, (0, math.pi / 2, .15))
    cyl('bedroll-core', (-.52, -1.24, .16), .09, .78, 'linen', 10, (0, math.pi / 2, .15))
    for dx in [-.20, .20]:
        torus('bedroll-strap', (-.52 + dx, -1.24 + dx * .15, .16), .155, .016, 'wood_dark', (0, math.pi / 2, .15))

    # Round wooden buckler shield & staff propped by entrance
    cyl('traveler-buckler', (-.24, -1.04, .32), .22, .04, 'wood', 12, (math.pi / 2 - .28, 0, -.25))
    torus('buckler-rim', (-.24, -1.04, .32), .22, .018, 'iron', (math.pi / 2 - .28, 0, -.25))
    sphere('buckler-boss', (-.25, -1.07, .33), (.06, .04, .06), 'brass')

    # Short lantern stake & small camp map crate at front right
    box('camp-map-crate', (.32, -1.16, .18), (.38, .32, .26), 'wood', .012, (0, 0, -.12))
    box('unrolled-map', (.32, -1.16, .32), (.28, .22, .02), 'linen', .004, (0, 0, -.12))
    box('camp-lantern-stake', (.66, -1.18, .48), (.08, .08, .96), 'wood_dark', .012)
    beam('camp-lantern-arm', (.66, -1.18, .92), (.66, -1.42, .92), .05, 'iron')
    lantern_unit('camp-lantern', (.66, -1.42, .42), scale=.80)

    finish_asset()


def build_roadside_bench_shelter():
    start_asset(
        'roadside_bench_shelter',
        'Refugio y banco de camino',
        'Campamentos y descanso',
        'Apeadero techado de piedra y roble con celosías laterales, banco corrido, farol colgante, barril de agua y bastón.'
    )
    # Stone flagstone base
    box('flagstone-deck', (0, 0, .06), (2.32, 1.28, .12), 'stone_dark', .025)
    for i, xx in enumerate([-.72, 0, .72]):
        box(f'inlaid-paver-{i}', (xx, -.06, .125), (.66, .98, .04),
            'stone' if i % 2 == 0 else 'stone_light', .012)

    # Four corner oak posts on stone plinth blocks + knee braces + side windbreak rails
    for sx in [-.92, .92]:
        for yy, h in [(-.42, 1.88), (.42, 1.56)]:
            box('post-stone-shoe', (sx, yy, .20), (.22, .22, .16), 'stone_light', .018)
            box('shelter-post', (sx, yy, .20 + h / 2), (.13, .13, h), 'wood_dark', .018)
            box('post-iron-collar', (sx, yy, .32), (.15, .15, .06), 'iron', .008)
        beam('side-tie-beam', (sx, -.46, 1.82), (sx, .46, 1.50), .11, 'wood')
        beam('front-brace', (sx, -.42, 1.42), (sx * .68, -.42, 1.84), .08, 'wood_mid')
        for zz in [.64, .92, 1.20]:
            box('side-windbreak-slat', (sx, 0, zz), (.045, .74, .12), 'wood_mid', .008)

    beam('front-header-beam', (-1.04, -.42, 1.86), (1.04, -.42, 1.86), .12, 'wood')
    beam('back-header-beam', (-1.04, .42, 1.54), (1.04, .42, 1.54), .12, 'wood')

    # Back half-wall wainscotting
    for zz in [.52, .74, .96, 1.18, 1.38]:
        box('back-wall-plank', (0, .42, zz), (1.88, .06, .18),
            'wood' if int(zz * 10) % 2 else 'wood_mid', .012)

    # Built-in heavy oak bench (supports, seat planks, backrest, armrests)
    for sx in [-.82, 0, .82]:
        box('bench-leg', (sx, .08, .32), (.11, .48, .38), 'wood_dark', .016)
    for yy in [-.08, .08, .24]:
        box('bench-seat-plank', (0, yy, .52), (1.82, .14, .065), 'wood_light', .012)
    for zz in [.72, .90]:
        box('bench-backrest', (0, .35, zz), (1.82, .055, .14), 'wood_light', .012)

    # Sloped shed roof (higher in front -Y, sloping down to back +Y)
    roof_tilt = math.atan2(1.88 - 1.56, .84)
    box('roof-sheathing', (0, 0, 1.76), (2.32, 1.32, .08), 'wood_dark', .018, (-roof_tilt, 0, 0))
    for row in range(4):
        ry = -.48 + row * .32
        rz = 1.91 - row * .105
        for col in range(6):
            rx = -.92 + col * .368
            box('shelter-tile', (rx, ry, rz), (.35, .34, .05),
                'roof' if (row + col) % 2 else 'roof_light', .012, (-roof_tilt, 0, 0))

    # Hanging lantern under front eave + water cask with dipper + resting pack & walking staff
    beam('eave-lantern-hook', (0, -.42, 1.82), (0, -.42, 1.72), .024, 'iron')
    lantern_unit('shelter-lantern', (0, -.42, 1.34), scale=.70)

    box('cask-stand', (-.66, -.22, .20), (.34, .34, .16), 'wood_dark', .012)
    small_barrel('courtesy-water-cask', (-.66, -.22, .26), height=.44, radius=.17)
    cyl('tin-dipper-cup', (-.66, -.22, .74), .045, .08, 'brass', 10)

    sphere('resting-pack', (.46, .08, .66), (.20, .16, .18), 'teal', rotation=(0, 0, -.2))
    box('pack-flap', (.46, .06, .74), (.24, .20, .06), 'wood_mid', .01, (0, 0, -.2))
    beam('walking-staff', (.78, -.28, .12), (.70, .28, 1.18), .036, 'wood_light')

    finish_asset()


def build_expedition_supply_cache():
    start_asset(
        'expedition_supply_cache',
        'Alijo de suministros de caravana',
        'Campamentos y descanso',
        'Puesto de avituallamiento sobre tarima con cajas herradas, toneles, ánfora, sacos, lona y farol.'
    )
    # Raised timber pallet skid
    for yy in [-.52, 0, .52]:
        box('pallet-runner', (0, yy, .055), (1.88, .12, .11), 'wood_dark', .015)
    for i in range(7):
        xx = -.78 + i * .26
        box(f'pallet-deck-{i}', (xx, 0, .135), (.23, 1.26, .06),
            'wood' if i % 2 else 'wood_mid', .01)

    # Large iron-bound expedition crate (back-left)
    cx, cy, cz = -.38, .16, .48
    box('cargo-crate-body', (cx, cy, cz), (.78, .68, .64), 'wood', .018)
    for sx in [-.37, .37]:
        for sy in [-.32, .32]:
            box('crate-corner-post', (cx + sx, cy + sy, cz), (.08, .08, .66), 'wood_dark', .01)
    for zz in [.22, .74]:
        box('crate-iron-band', (cx, cy, zz), (.81, .71, .05), 'iron', .008)
    box('crate-lock-plate', (cx, cy - .35, cz), (.12, .03, .16), 'brass', .006)

    # Smaller stacked crate on top + brass lantern
    box('top-crate', (-.42, .18, .98), (.52, .48, .38), 'wood_light', .015, (0, 0, .14))
    box('top-crate-strap', (-.42, .18, .98), (.54, .50, .06), 'iron', .008, (0, 0, .14))
    lantern_unit('cache-beacon-lantern', (-.42, .18, 1.16), scale=.78)

    # Two barrels on right (one standing, one horizontal on chocks) + terracotta amphora
    small_barrel('supply-barrel-upright', (.46, .24, .16), height=.64, radius=.24)
    for sx in [.22, .56]:
        box('barrel-chock', (sx, -.28, .20), (.09, .36, .10), 'wood_dark', .01)
    small_barrel('supply-barrel-horiz', (.39, -.28, .38), height=.58, radius=.21, horizontal=True)

    lathe('terracotta-amphora', (.74, -.12, .16),
          [(0, 0), (.07, .02), (.14, .16), (.15, .30), (.08, .42), (.06, .48), (.08, .50), (.05, .50)], 'pot', 12)

    # Grain sacks at front-left
    sphere('grain-sack-1', (-.48, -.34, .32), (.24, .20, .22), 'linen', rotation=(.1, -.1, .2))
    cyl('sack-1-neck', (-.48, -.34, .52), .07, .08, 'linen', 8)
    torus('sack-1-tie', (-.48, -.34, .49), .065, .016, 'red')

    sphere('grain-sack-2', (-.14, -.36, .29), (.22, .19, .19), 'plaster_warm', rotation=(-.1, .15, -.3))
    cyl('sack-2-neck', (-.14, -.36, .46), .065, .07, 'plaster_warm', 8)
    torus('sack-2-tie', (-.14, -.36, .43), .06, .015, 'teal')

    # Folded waterproof canvas tarp & tie-down ropes over back corner
    box('folded-tarp-top', (-.02, .22, .83), (.68, .62, .08), 'teal', .02, (.06, .18, -.08))
    box('folded-tarp-drop', (.26, .24, .58), (.12, .60, .48), 'teal_light', .02, (0, -.15, 0))
    for yy in [-.02, .38]:
        beam('tie-down-rope', (-.78, yy, .14), (.74, yy, .14), .028, 'straw')
        beam('tie-down-over-crate', (-.78, yy, .14), (-.38, yy, .82), .026, 'straw')
        beam('tie-down-over-barrel', (-.38, yy, .82), (.74, yy, .14), .026, 'straw')

    finish_asset()


def build_wayside_water_well():
    start_asset(
        'wayside_water_well',
        'Pozo y abrevadero de camino',
        'Campamentos y descanso',
        'Pozo de sillería con torno de madera, tejadillo a dos aguas, cubo colgante y abrevadero adosado.'
    )
    # Cobblestone base platform
    cyl('well-flagstone-base', (-.12, 0, .06), 1.08, .12, 'stone_dark', 12)
    box('trough-pad', (.82, 0, .06), (.76, 1.18, .12), 'stone_dark', .02)

    # Circular masonry well curb (walled ring + interior dark water + coping rim)
    cx, cy = -.18, 0.0
    ring('well-masonry-wall', (cx, cy, 0), .68, .48, .10, .82, 'stone', 14)
    ring('well-stone-coping', (cx, cy, 0), .74, .46, .78, .90, 'stone_light', 14)
    cyl('well-water-surface', (cx, cy, .36), .49, .06, 'water', 14)

    # Two upright oak posts + windlass roller + iron crank + rope + hanging wooden bucket
    for sy in [-.60, .60]:
        box('well-post', (cx, sy, 1.48), (.13, .13, 1.42), 'wood_dark', .016)
        box('well-post-strap', (cx, sy, .92), (.15, .15, .07), 'iron', .008)
        beam('well-roof-brace', (cx, sy, 1.76), (cx, sy * .45, 2.08), .07, 'wood')

    cyl('windlass-axle', (cx, 0, 1.54), .09, 1.14, 'wood_light', 10, (math.pi / 2, 0, 0))
    for dy in [-.18, -.10, -.02, .06, .14]:
        torus('wound-rope-coil', (cx, dy, 1.54), .105, .018, 'straw', (math.pi / 2, 0, 0))
    # Iron hand crank at front (-Y)
    beam('crank-arm', (cx, -.68, 1.54), (cx, -.68, 1.78), .035, 'iron')
    cyl('crank-handle', (cx, -.76, 1.78), .024, .16, 'wood_light', 8, (math.pi / 2, 0, 0))

    # Hanging rope & bucket over the well mouth
    beam('hanging-rope', (cx, 0, 1.54), (cx, 0, 1.08), .024, 'straw')
    cyl('wooden-bucket', (cx, 0, .98), .14, .24, 'wood', 10, radius_top=.16)
    ring('bucket-hoop', (cx, 0, 0), .158, .135, .98, 1.03, 'iron', 10)
    cyl('bucket-water', (cx, 0, 1.07), .13, .03, 'water', 10)

    # Pitched shingle roof over the well
    eave_z, rise, half_w, depth = 2.04, .42, .68, 1.48
    slope = math.atan2(rise, half_w)
    plen = math.hypot(half_w, rise)
    for sx in [-1, 1]:
        box('well-roof-slope', (cx + sx * half_w / 2, 0, eave_z + rise / 2),
            (plen + .06, depth, .07), 'wood_dark', .015, (0, sx * slope, 0))
        for row in range(3):
            t = (row + .45) / 3
            rx = cx + sx * half_w * (1 - t)
            rz = eave_z + rise * t + .05
            box('well-roof-tile-course', (rx, 0, rz), (plen / 3 + .04, depth - .04, .045),
                'roof' if row % 2 else 'roof_light', .012, (0, sx * slope, 0))
    beam('well-ridge-beam', (cx, -depth / 2 - .04, eave_z + rise + .07),
         (cx, depth / 2 + .04, eave_z + rise + .07), .11, 'roof_dark')

    # Attached stone water trough on right (+X) fed by a bronze spout from the well
    tx = .82
    cyl('bronze-water-spout', (.34, 0, .62), .038, .28, 'brass', 8, (0, math.pi / 2, 0))
    box('trough-bottom', (tx, 0, .20), (.56, 1.02, .16), 'stone', .02)
    for sx, w in [(-1, .09), (1, .09)]:
        box('trough-long-wall', (tx + sx * .24, 0, .36), (w, 1.02, .24), 'stone_light', .016)
    for sy in [-.46, .46]:
        box('trough-end-wall', (tx, sy, .36), (.46, .09, .24), 'stone_light', .016)
    box('trough-water', (tx, 0, .42), (.38, .84, .05), 'water', .008)

    finish_asset()


def build_scout_watchtower():
    start_asset(
        'scout_watchtower',
        'Atalaya de madera de vigía',
        'Campamentos y descanso',
        'Torre de observación de caminos sobre cuatro pilotes arriostrados con escalera, plataforma, toldo y brasero.'
    )
    # Four stone foundation pads & heavy timber corner posts
    deck_z = 1.92
    top_z = 3.18
    for sx in [-.74, .74]:
        for sy in [-.74, .74]:
            box('tower-foot-stone', (sx, sy, .10), (.34, .34, .20), 'stone_dark', .02)
            box('tower-leg-post', (sx, sy, top_z / 2 + .08), (.14, .14, top_z), 'wood_dark', .018)
            box('leg-iron-collar', (sx, sy, .28), (.165, .165, .07), 'iron', .008)

    # Horizontal mid-girts and corner knee braces below deck
    for sx in [-.74, .74]:
        beam('side-mid-girt', (sx, -.74, 1.02), (sx, .74, 1.02), .09, 'wood')
        for sy in [-1, 1]:
            beam('side-knee-brace', (sx, sy * .74, 1.38), (sx, sy * .32, deck_z - .08), .075, 'wood')
    beam('back-mid-girt', (-.74, .74, 1.02), (.74, .74, 1.02), .09, 'wood')
    for sx in [-1, 1]:
        beam('back-knee-brace', (sx * .74, .74, 1.38), (sx * .32, .74, deck_z - .08), .075, 'wood')
        beam('front-knee-brace', (sx * .74, -.74, 1.38), (sx * .32, -.74, deck_z - .08), .075, 'wood')

    # Platform joists & plank deck at Z = 1.92
    for sy in [-.74, 0, .74]:
        box('deck-girder', (0, sy, deck_z - .08), (1.76, .12, .12), 'wood_dark', .015)
    for i in range(7):
        xx = -.72 + i * .24
        box(f'tower-deck-plank-{i}', (xx, 0, deck_z), (.22, 1.72, .065),
            'wood' if i % 2 else 'wood_mid', .01)

    # Guardrails around the observation deck (leaving ladder opening at front-left)
    box('front-rail-newel-post', (-.05, -.74, deck_z + .36), (.09, .09, .72), 'wood_dark', .012)
    for zz in [deck_z + .34, deck_z + .64]:
        beam('back-rail', (-.76, .74, zz), (.76, .74, zz), .07, 'wood_light')
        beam('left-rail', (-.74, -.76, zz), (-.74, .76, zz), .07, 'wood_light')
        beam('right-rail', (.74, -.76, zz), (.74, .76, zz), .07, 'wood_light')
        beam('front-half-rail', (-.05, -.74, zz), (.76, -.74, zz), .07, 'wood_light')

    # Slanted wooden boarding ladder at front-left (-Y)
    for lx in [-.56, -.16]:
        beam('ladder-stave', (lx, -1.36, .04), (lx, -.74, deck_z + .08), .065, 'wood_dark')
    for k in range(7):
        t = (k + .6) / 7.5
        ry = -1.36 * (1 - t) + (-.74) * t
        rz = .04 * (1 - t) + (deck_z + .06) * t
        beam(f'ladder-rung-{k}', (-.56, ry, rz), (-.16, ry, rz), .042, 'wood_light')

    # Sloped timber & canvas canopy roof at top + pennant banner + signal brazier
    roof_tilt = .16
    box('canopy-frame', (0, 0, top_z + .06), (1.88, 1.88, .08), 'wood_dark', .015, (-roof_tilt, 0, 0))
    box('canopy-canvas', (0, 0, top_z + .12), (1.94, 1.94, .05), 'teal', .012, (-roof_tilt, 0, 0))
    for sx in [-.64, 0, .64]:
        box('canopy-stripe', (sx, 0, top_z + .13), (.22, 1.96, .052), 'linen', .01, (-roof_tilt, 0, 0))

    # Signal brazier basket & spyglass on front-right rail
    beam('brazier-outrigger', (.74, -.74, deck_z + .54), (1.08, -1.02, deck_z + .58), .05, 'iron')
    cyl('signal-basket', (1.08, -1.02, deck_z + .44), .16, .24, 'iron', 8, radius_top=.21)
    sphere('signal-fire', (1.08, -1.02, deck_z + .58), (.15, .15, .18), 'amber')

    # Wayfinder banner hanging from right post
    beam('banner-crossbar', (.78, -.74, deck_z + .98), (1.26, -.74, deck_z + .98), .04, 'wood_light')
    box('watchtower-banner', (1.02, -.74, deck_z + .62), (.38, .03, .68), 'red', .008)
    box('banner-emblem', (1.02, -.755, deck_z + .66), (.18, .02, .18), 'amber', .005)

    finish_asset()


# ==============================================================================
# CATEGORÍA 3: OFICIO RURAL Y RIBERAS (6 modelos)
# ==============================================================================

def build_merchant_wagon():
    start_asset(
        'merchant_wagon',
        'Carromato cubierto de mercader',
        'Oficio rural y riberas',
        'Carromato de cuatro ruedas radiadas con toldo abovedado, pescante, freno de palanca, rueda de repuesto y carga.'
    )
    # Four spoked wheels (front pair slightly smaller than rear pair, all touching Z=0)
    for sx in [-.76, .76]:
        spoked_wheel('front-wheel', (sx, -.78, .38), radius=.38, width=.07, spokes=8)
        spoked_wheel('rear-wheel', (sx, .74, .44), radius=.44, width=.08, spokes=10)

    # Axles, hounds & chassis bolsters
    cyl('front-axle', (0, -.78, .38), .055, 1.68, 'iron', 10, (0, math.pi / 2, 0))
    cyl('rear-axle', (0, .74, .44), .060, 1.68, 'iron', 10, (0, math.pi / 2, 0))
    box('front-bolster', (0, -.78, .52), (1.28, .18, .22), 'wood_dark', .018)
    box('rear-bolster', (0, .74, .55), (1.28, .18, .16), 'wood_dark', .018)
    beam('center-reach-beam', (0, -.84, .48), (0, .84, .50), .12, 'wood_dark')

    # Hitch tongue & resting prop stand at front (-Y)
    for sx in [-.18, .18]:
        beam('hitch-hound', (sx, -.78, .44), (0, -1.32, .42), .07, 'wood_dark')
    beam('wagon-tongue', (0, -1.26, .42), (0, -2.02, .34), .085, 'wood')
    beam('doubletree-whiffletree', (-.48, -1.42, .42), (.48, -1.42, .42), .06, 'wood_light')
    box('tongue-prop-leg', (0, -1.78, .19), (.07, .07, .36), 'wood_dark', .01)
    box('tongue-prop-foot', (0, -1.78, .03), (.18, .18, .06), 'stone_dark', .01)

    # Wagon bed floor & sideboards
    for i in range(6):
        xx = -.55 + i * .22
        box(f'bed-plank-{i}', (xx, -.02, .65), (.20, 2.24, .07),
            'wood' if i % 2 else 'wood_mid', .01)
    for sx in [-.64, .64]:
        for zz in [.76, .92, 1.08]:
            box('wagon-sideboard', (sx, .08, zz), (.07, 2.02, .13),
                'wood_light' if zz > 1.0 else 'wood', .012)
        for yy in [-.84, -.22, .38, .98]:
            box('side-stake', (sx * 1.04, yy, .90), (.07, .07, .52), 'wood_dark', .01)
    box('rear-tailgate', (0, 1.06, .92), (1.28, .07, .46), 'wood_mid', .012)

    # Driver's box, seat, and iron brake lever at front (-Y)
    box('driver-footboard', (0, -1.08, .72), (1.18, .32, .07), 'wood_dark', .012, (.22, 0, 0))
    box('driver-seat-riser', (0, -.82, .88), (1.16, .34, .34), 'wood', .015)
    box('driver-seat-cushion', (0, -.82, 1.07), (1.20, .38, .09), 'red', .02)
    for sx in [-.58, .58]:
        box('seat-armrest', (sx, -.82, 1.18), (.07, .36, .16), 'wood_dark', .012)
    beam('handbrake-lever', (.68, -.52, .56), (.74, -.94, 1.24), .036, 'iron')
    sphere('handbrake-grip', (.74, -.94, 1.26), (.035, .035, .06), 'brass')

    # Side water keg on right rack & spare wheel mounted at rear
    small_barrel('side-water-keg', (.76, .08, .82), height=.38, radius=.14, horizontal=False)
    box('keg-bracket', (.72, .08, .78), (.18, .32, .06), 'iron', .008)

    # Arched canvas tilt cover over cargo bay (wooden hoop ribs + continuous vaulted canvas shell)
    tilt_base_z = 1.10
    for yy in [-.56, -.08, .40, .88]:
        arch_frame('wagon-hoop-rib', (0, yy, tilt_base_z), 1.18, .66, .055, 'wood_dark', segments=12, depth=.07)

    arch_frame('wagon-canvas-hood', (0, .16, tilt_base_z), 1.24, .70, .065, 'linen', segments=14, depth=1.68)
    for yy in [-.64, .16, .96]:
        arch_frame('wagon-canvas-band', (0, yy, tilt_base_z), 1.26, .71, .072, 'teal', segments=14, depth=.16)
    for sx in [-1, 1]:
        box('canvas-bottom-batten', (sx * .65, .16, tilt_base_z + .04), (.06, 1.72, .08), 'wood_light', .01)

    # Cargo visible inside & hanging lantern at front left
    box('cargo-chest', (-.24, .56, .88), (.48, .58, .38), 'wood_dark', .014)
    small_barrel('cargo-cask', (.28, .62, .68), height=.48, radius=.19)
    beam('driver-lantern-arm', (-.64, -.86, 1.22), (-.86, -.98, 1.28), .04, 'iron')
    lantern_unit('wagon-lantern', (-.86, -.98, .84), scale=.75)

    finish_asset()


def build_wooden_handcart():
    start_asset(
        'wooden_handcart',
        'Carretilla de carga de camino',
        'Oficio rural y riberas',
        'Carro de mano de dos ruedas de radios con varales de tiro, caballete, barril, sacos, ánfora y farol.'
    )
    # Two spoked wheels at Y = 0.15
    wy, wz = .15, .40
    for sx in [-.66, .66]:
        spoked_wheel('cart-wheel', (sx, wy, wz), radius=.40, width=.065, spokes=8)
    cyl('cart-iron-axle', (0, wy, wz), .048, 1.46, 'iron', 10, (0, math.pi / 2, 0))

    # Two long shafts extending forward (-Y) + front resting prop legs
    for sx in [-.52, .52]:
        beam('cart-shaft', (sx, -1.22, .48), (sx, .92, .54), .085, 'wood_dark')
        beam('front-support-leg', (sx, -.68, .50), (sx, -.62, .03), .065, 'wood_dark')
        box('support-leg-shoe', (sx, -.62, .03), (.11, .11, .06), 'iron', .008)
    beam('front-handle-crossbar', (-.56, -1.18, .48), (.56, -1.18, .48), .07, 'wood_light')

    # Slatted cart bed & slatted sides with iron corner brackets
    for i in range(5):
        xx = -.44 + i * .22
        box(f'cart-bed-plank-{i}', (xx, .14, .57), (.20, 1.48, .06),
            'wood' if i % 2 else 'wood_mid', .01)
    for sx in [-.53, .53]:
        for zz in [.68, .82, .96]:
            box('cart-side-rail', (sx, .14, zz), (.055, 1.44, .09), 'wood_light', .01)
        for yy in [-.50, .14, .78]:
            box('cart-side-post', (sx, yy, .79), (.07, .07, .44), 'wood_dark', .01)
            box('cart-iron-bracket', (sx * 1.03, yy, .64), (.08, .08, .12), 'iron', .006)
    for yy in [-.55, .83]:
        for zz in [.68, .84]:
            box('cart-end-board', (0, yy, zz), (1.06, .055, .12), 'wood', .01)

    # Cargo inside cart: horizontal barrel, 2 sacks, terracotta jug, tool box & coiled rope
    small_barrel('cart-barrel', (-.08, .42, .80), height=.52, radius=.20, horizontal=True)
    sphere('cart-sack-a', (-.22, -.18, .76), (.22, .24, .18), 'linen', rotation=(.15, 0, .2))
    sphere('cart-sack-b', (.20, -.20, .75), (.21, .22, .17), 'plaster_warm', rotation=(-.1, .1, -.25))
    lathe('cart-jug', (.30, .36, .60),
          [(0, 0), (.07, .01), (.12, .12), (.11, .24), (.06, .32), (.07, .36), (.04, .36)], 'pot', 10)
    torus('coiled-rope', (.22, -.12, .94), .11, .028, 'straw', (.1, .1, 0))

    # Small lantern hanging from front-left shaft
    lantern_unit('cart-front-lantern', (-.52, -.92, .14), scale=.62)
    beam('cart-lantern-chain', (-.52, -.92, .48), (-.52, -.92, .44), .02, 'iron')

    finish_asset()


def build_hay_drying_rack():
    start_asset(
        'hay_drying_rack',
        'Almiar y secadero de heno',
        'Oficio rural y riberas',
        'Secadero rural de madera con tejadillo a dos aguas, heno apilado, escalera de mano, fardos y horca.'
    )
    # Stone footing pads & timber frame
    for sx in [-.78, .78]:
        box('stone-foot-pad', (sx, 0, .08), (.36, .72, .16), 'stone_dark', .02)
        box('main-rack-post', (sx, 0, 1.16), (.14, .14, 2.04), 'wood_dark', .018)
        for sy in [-1, 1]:
            beam('bottom-brace', (sx, sy * .28, .16), (sx, 0, .58), .08, 'wood')
            beam('top-rafter-strut', (sx, 0, 1.72), (sx, sy * .46, 2.06), .075, 'wood')

    # Horizontal drying crossbars along X
    for zz in [.46, .78, 1.10, 1.42, 1.74]:
        beam('drying-rail', (-.88, 0, zz), (.88, 0, zz), .07, 'wood_mid')

    # Thick layered golden hay mass hung across the rack
    for zz, w, d in [
        (.56, 1.48, .86),
        (.88, 1.56, .94),
        (1.20, 1.52, .88),
        (1.52, 1.38, .76),
    ]:
        box('hay-layer-core', (0, 0, zz), (w, d, .34), 'straw', .06)
        for sx in [-.42, 0, .42]:
            for sy in [-1, 1]:
                sphere('hay-tuft', (sx, sy * (d * .46), zz - .04), (.28, .16, .20),
                       'straw' if (sx + zz) % 2 else 'wood_light')

    # Small pitched timber shingle roof over the rack
    eave_z, rise, half_d = 1.98, .36, .64
    slope = math.atan2(rise, half_d)
    plen = math.hypot(half_d, rise)
    for sy in [-1, 1]:
        box('rack-roof-slope', (0, sy * half_d / 2, eave_z + rise / 2),
            (1.96, plen + .06, .07), 'wood', .015, (-sy * slope, 0, 0))
        for plank in range(3):
            t = (plank + .5) / 3
            py = sy * half_d * (1 - t)
            pz = eave_z + rise * t + .045
            box('roof-clapboard', (0, py, pz), (1.98, plen / 3 + .04, .045),
                'roof' if plank % 2 else 'roof_light', .01, (-sy * slope, 0, 0))
    beam('rack-ridge-cap', (-1.02, 0, eave_z + rise + .07), (1.02, 0, eave_z + rise + .07), .11, 'wood_dark')

    # Wooden farm ladder leaning on left side (-X)
    for ly in [-.18, .18]:
        beam('hay-ladder-rail', (-1.12, ly, .04), (-.82, ly, 1.68), .05, 'wood_light')
    for k in range(5):
        t = (k + .5) / 5
        lx = -1.12 * (1 - t) + (-.82) * t
        lz = .04 * (1 - t) + 1.68 * t
        beam(f'hay-ladder-rung-{k}', (lx, -.18, lz), (lx, .18, lz), .035, 'wood')

    # Bound hay bales at front base & pitchfork leaning against right post
    box('bound-hay-bale', (-.32, -.64, .22), (.64, .44, .38), 'straw', .04, (0, 0, -.15))
    for dx in [-.18, .18]:
        box('bale-twine', (-.32 + dx, -.64, .22), (.03, .46, .40), 'wood_dark', .005, (0, 0, -.15))
    sphere('loose-straw-pile', (.24, -.58, .08), (.32, .24, .10), 'straw')

    h_bot = Vector((.96, -.48, .04))
    h_top = Vector((.82, -.12, 1.48))
    beam('pitchfork-handle', h_bot, h_top, .038, 'wood_light')
    box('pitchfork-yoke', (.95, -.45, .22), (.22, .04, .05), 'iron', .006)
    for tx in [-.08, 0, .08]:
        beam('pitchfork-tine', (.95 + tx, -.45, .22), (.98 + tx, -.52, .03), .018, 'iron')

    finish_asset()


def build_river_jetty_dock():
    start_asset(
        'river_jetty_dock',
        'Embarcadero de madera de ribera',
        'Oficio rural y riberas',
        'Muelle rústico de pilotes y tablones con barandilla de soga, rampa, bolardo, nasa, cubo y farol.'
    )
    # Six heavy timber pilings driven into the riverbed (Z=0 is riverbed/ground level)
    for sx in [-.78, .78]:
        for yy in [-.92, 0.0, .92]:
            cyl('timber-piling', (sx, yy, .52), .11, 1.04, 'wood_dark', 10)
            ring('piling-iron-band', (sx, yy, 0), .12, .10, .88, .95, 'iron', 10)
            cyl('piling-cap', (sx, yy, 1.05), .115, .05, 'wood_light', 10)
            ring('waterline-moss', (sx, yy, 0), .122, .10, .14, .26, 'leaf_dark', 10)

    # Rope safety stanchions on left side (-X) + tall mooring bollard at front-left
    cyl('mooring-bollard', (-.78, -.92, .68), .125, 1.36, 'wood_dark', 10)
    cyl('bollard-brass-cap', (-.78, -.92, 1.38), .135, .06, 'brass', 10)
    box('bollard-cross-pin', (-.78, -.92, 1.22), (.34, .06, .06), 'iron', .008)
    for yy in [0.0, .92]:
        cyl('side-rope-post', (-.78, yy, .94), .085, .52, 'wood_dark', 8)
    beam('dock-guard-rope-1', (-.78, -.92, 1.12), (-.78, 0.0, 1.14), .032, 'straw')
    beam('dock-guard-rope-2', (-.78, 0.0, 1.14), (-.78, .92, 1.12), .032, 'straw')

    # Lantern post at front-right
    box('jetty-lantern-post', (.78, -.92, 1.15), (.13, .13, 2.18), 'wood_dark', .016)
    beam('jetty-lantern-arm', (.78, -.92, 2.12), (.42, -.92, 2.12), .06, 'iron')
    beam('jetty-lantern-brace', (.78, -.92, 1.86), (.52, -.92, 2.10), .04, 'iron')
    lantern_unit('jetty-lantern', (.44, -.92, 1.62), scale=.88)

    # Longitudinal stringer beams & cross joists at Z = 0.68
    for sx in [-.68, 0, .68]:
        box('deck-stringer', (sx, 0, .66), (.11, 2.18, .12), 'wood_dark', .015)
    for yy in [-.92, 0.0, .92]:
        box('cross-bearer', (0, yy, .58), (1.72, .12, .12), 'wood_dark', .015)

    # Deck planks along Y
    for i in range(9):
        yy = -.96 + i * .24
        box(f'jetty-deck-plank-{i}', (0, yy, .75), (1.68, .21, .065),
            'wood' if i % 2 else 'wood_mid', .012)
        for sx in [-.68, .68]:
            sphere('deck-spike', (sx, yy, .785), (.018, .018, .012), 'iron')

    # Sloped shore approach ramp at +Y end (reaches down to Z=0)
    ramp_angle = math.atan2(.75, .78)
    for sx in [-.58, .58]:
        box('ramp-stringer', (sx, 1.42, .38), (.10, .92, .10), 'wood_dark', .012, (ramp_angle, 0, 0))
    for i in range(4):
        t = (i + .5) / 4
        ry = 1.06 + t * .72
        rz = .74 * (1 - t) + .04
        box(f'ramp-plank-{i}', (0, ry, rz), (1.52, .19, .055), 'wood_light', .01, (ramp_angle, 0, 0))
    box('shore-stone-sill', (0, 1.82, .06), (1.64, .28, .12), 'stone', .02)

    # Coiled mooring rope around bollard + wicker fish trap, tackle crate & bucket on deck
    for k, zz in enumerate([.80, .85, .90]):
        torus(f'mooring-coil-{k}', (-.52, -.76, zz), .16 - k * .015, .028, 'straw')
    beam('mooring-line', (-.78, -.92, 1.08), (-.52, -.76, .88), .032, 'straw')

    cyl('wicker-fish-trap', (.42, .18, .92), .18, .48, 'wood_light', 10, (0, math.pi / 2, .35), radius_top=.11)
    for dx in [-.14, 0, .14]:
        torus('trap-hoop', (.42 + dx * .9, .18 + dx * .3, .92), .16, .016, 'wood_dark', (0, math.pi / 2, .35))
    box('tackle-crate', (.38, -.32, .89), (.38, .32, .22), 'wood', .012, (0, 0, -.12))
    cyl('fisherman-bucket', (-.46, .48, .90), .12, .22, 'wood_mid', 10, radius_top=.14)

    finish_asset()


def build_beehive_apiary_stand():
    start_asset(
        'beehive_apiary_stand',
        'Colmenar rústico de pradera',
        'Oficio rural y riberas',
        'Bancada techada con tres colmenas trenzadas de paja, tarros de miel, ahumador de latón y flores.'
    )
    # Stone footings & timber bench stand
    for sx in [-.86, .86]:
        box('apiary-stone-foot', (sx, 0, .07), (.32, .78, .14), 'stone_dark', .02)
        for sy in [-.28, .28]:
            box('stand-leg', (sx, sy, .30), (.11, .11, .42), 'wood_dark', .014)
        box('roof-support-post', (sx, 0, 1.08), (.11, .11, 1.88), 'wood_dark', .015)
        for sy in [-1, 1]:
            beam('apiary-roof-brace', (sx, 0, 1.56), (sx, sy * .42, 1.88), .065, 'wood')

    # Bench plank shelf at Z = 0.52
    for sy in [-.22, 0, .22]:
        box('hive-shelf-plank', (0, sy, .52), (1.96, .19, .065), 'wood_light', .012)
    beam('front-shelf-rail', (-.96, -.32, .50), (.96, -.32, .50), .06, 'wood')

    # Three traditional coiled-straw skep beehives on wooden base boards
    for idx, hx in enumerate([-.58, 0.0, .58]):
        cyl(f'hive-baseboard-{idx}', (hx, 0, .57), .25, .04, 'wood', 12)
        # Coiled straw dome built with lathe profile
        lathe(f'straw-skep-{idx}', (hx, 0, .59),
              [(0, 0), (.23, 0), (.25, .10), (.24, .24), (.20, .38), (.13, .48), (.05, .54), (0, .55)],
              'straw' if idx != 1 else 'wood_light', 14)
        for rz, rr in [(.12, .245), (.26, .23), (.40, .185)]:
            torus(f'skep-coil-ring-{idx}', (hx, 0, .59 + rz), rr, .016, 'straw')
        cyl(f'skep-top-knob-{idx}', (hx, 0, 1.16), .045, .06, 'wood_dark', 8)
        # Little flight-hole entrance porch at front (-Y)
        box(f'flight-landing-ledge-{idx}', (hx, -.24, .63), (.12, .08, .025), 'wood_light', .005)
        box(f'flight-hole-{idx}', (hx, -.23, .66), (.07, .04, .045), 'wood_dark', .004)

    # Pitched timber & terracotta roof sheltering the hives
    eave_z, rise, half_d = 1.84, .32, .58
    slope = math.atan2(rise, half_d)
    plen = math.hypot(half_d, rise)
    for sy in [-1, 1]:
        box('apiary-roof-deck', (0, sy * half_d / 2, eave_z + rise / 2),
            (2.16, plen + .06, .065), 'wood_dark', .014, (-sy * slope, 0, 0))
        for row in range(3):
            t = (row + .45) / 3
            py = sy * half_d * (1 - t)
            pz = eave_z + rise * t + .04
            box('apiary-roof-tile', (0, py, pz), (2.18, plen / 3 + .03, .04),
                'roof' if row % 2 else 'roof_light', .01, (-sy * slope, 0, 0))
    beam('apiary-ridge', (-1.10, 0, eave_z + rise + .06), (1.10, 0, eave_z + rise + .06), .10, 'roof_dark')

    # Honey crate, amber honey jars & brass bee-smoker at front base
    box('honey-crate', (-.36, -.52, .16), (.52, .36, .24), 'wood', .012, (0, 0, .08))
    for jx, jy, jh in [(-.46, -.50, .18), (-.26, -.54, .15)]:
        cyl('honey-jar', (jx, jy, .28 + jh / 2), .065, jh, 'amber', 10)
        cyl('jar-linen-cap', (jx, jy, .28 + jh + .015), .072, .035, 'linen', 10)
        torus('jar-twine', (jx, jy, .28 + jh), .068, .01, 'red')

    # Brass smoker beside crate
    cyl('brass-smoker-body', (.28, -.48, .16), .08, .22, 'brass', 10)
    cyl('smoker-cone-nozzle', (.28, -.48, .31), .08, .10, 'brass', 10, radius_top=.025)
    box('smoker-bellows', (.38, -.48, .15), (.08, .14, .18), 'wood_mid', .008)

    # Wildflower patches at corners (bees' forage)
    for fx, fy, col in [(-1.02, -.36, 'amber'), (.98, -.32, 'red'), (.68, -.52, 'linen')]:
        wildflower_tuft('apiary-flower', fx, fy, .04, col, 1.0)

    finish_asset()


def build_field_irrigation_wheel():
    start_asset(
        'field_irrigation_wheel',
        'Noria y canal de labranza',
        'Oficio rural y riberas',
        'Rueda hidráulica rural sobre canal de sillería con cangilones, acueducto de madera y artesa de riego.'
    )
    # Stone millrace channel & support piers
    box('channel-floor', (-.22, 0, .08), (1.42, 2.26, .16), 'stone_dark', .025)
    box('channel-water-stream', (-.22, 0, .18), (.68, 2.22, .06), 'water', .01)
    for sx in [-.68, .24]:
        box('channel-wall-pier', (sx, 0, .48), (.28, 1.86, .68), 'stone', .022)
        box('pier-cap-slab', (sx, 0, .85), (.34, 1.92, .08), 'stone_light', .015)
        box('axle-bearing-block', (sx, 0, .98), (.22, .36, .18), 'wood_dark', .015)

    # Waterwheel centered at X = -0.22, Y = 0, Z = 1.06 (rotates in Y-Z plane around X axis)
    wx, wy, wz = -.22, 0.0, 1.06
    wheel_r = .78
    cyl('waterwheel-main-shaft', (wx, wy, wz), .09, 1.24, 'wood_dark', 10, (0, math.pi / 2, 0))
    for dx in [-.48, .48]:
        ring('shaft-iron-gudgeon', (wx + dx, wy, wz - .04), .10, .08, 0, .08, 'iron', 10)

    # Double wooden rims & 12 paddles + brass/clay water buckets (cangilones)
    for dx in [-.16, .16]:
        torus('wheel-wooden-rim', (wx + dx, wy, wz), wheel_r, .045, 'wood', (0, math.pi / 2, 0), n=16, k=6)
    torus('wheel-iron-band', (wx, wy, wz), wheel_r + .035, .016, 'iron', (0, math.pi / 2, 0), n=16, k=4)

    paddles = 12
    for i in range(paddles):
        ang = i * math.tau / paddles
        py = wy + math.cos(ang) * wheel_r
        pz = wz + math.sin(ang) * wheel_r
        if i % 2 == 0:
            for dx in [-.16, .16]:
                beam('wheel-spoke', (wx + dx, wy, wz), (wx + dx, py, pz), .05, 'wood_light')
        # Paddle blade & bucket
        box(f'wheel-paddle-{i}', (wx, py, pz), (.38, .04, .18), 'wood_mid', .008, (ang, 0, 0))
        cyl(f'wheel-bucket-{i}', (wx + .22, py * .92, pz * .92 + .08), .055, .14, 'pot', 8, (ang + .4, 0, 0))

    # Elevated wooden flume / launder trough catching water on right (+X) & feeding stone basin
    flume_x = .52
    for sy in [-.68, .48]:
        box('flume-trestle-leg', (flume_x, sy, .56), (.10, .10, .96), 'wood_dark', .012)
        beam('flume-trestle-brace', (flume_x - .18, sy, .28), (flume_x + .18, sy, .92), .06, 'wood')
    box('wooden-flume-chute', (flume_x, -.12, 1.06), (.34, 1.62, .18), 'wood', .014, (.06, 0, 0))
    box('flume-water-ribbon', (flume_x, -.12, 1.13), (.22, 1.56, .04), 'water', .006, (.06, 0, 0))

    # Stone irrigation basin at front-right receiving water from the flume
    bx, by = .62, -.88
    box('irrigation-basin-base', (bx, by, .22), (.78, .72, .32), 'stone', .022)
    box('irrigation-basin-rim', (bx, by, .40), (.84, .78, .08), 'stone_light', .016)
    box('basin-water-pool', (bx, by, .42), (.64, .58, .05), 'water', .008)
    # Splash column from flume into basin
    cyl('water-fall-stream', (flume_x, -.86, .72), .045, .62, 'water', 8)

    finish_asset()


# ==============================================================================
# GALLERY PRESENTATION & SAVE
# ==============================================================================

def build_presentation_gallery():
    """Place translated copies of all 18 props in a 6x3 gallery inside _Presentation_only."""
    pres = bpy.data.collections.new('_Presentation_only')
    bpy.context.scene.collection.children.link(pres)

    spacing_x, spacing_y = 4.6, 5.4
    for idx, meta in enumerate(ASSETS):
        col = bpy.data.collections.get(meta['name'])
        col.asset_mark()
        col.asset_data.description = f"{meta['label']} ({meta['category']}) — Prop de mapa mundo de Pompelín"

        gx = (idx % 6 - 2.5) * spacing_x
        gy = (1.0 - idx // 6) * spacing_y

        pad = bpy.data.meshes.new(f"{meta['name']}_pad")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 3.4
            v.co.y *= 3.4
            v.co.z *= 0.06
        bm.to_mesh(pad)
        bm.free()
        pad_obj = bpy.data.objects.new(f"{meta['name']}_pad", pad)
        pad_obj.location = (gx, gy, -0.03)
        pres.objects.link(pad_obj)
        _uv(pad_obj, 'stone_light')

        for src in col.objects:
            if src.type != 'MESH':
                continue
            dup = src.copy()
            dup.data = src.data.copy()
            dup.location = src.location + Vector((gx, gy, 0))
            pres.objects.link(dup)


def main():
    init()
    # Categoría 1: Caminos y orientación (6)
    build_milestone_carved()
    build_signpost_wayfarer()
    build_wayside_shrine()
    build_ancient_ruin_arch()
    build_stone_footbridge()
    build_boundary_obelisk()

    # Categoría 2: Campamentos y descanso (6)
    build_campfire_cooking_tripod()
    build_traveler_tent()
    build_roadside_bench_shelter()
    build_expedition_supply_cache()
    build_wayside_water_well()
    build_scout_watchtower()

    # Categoría 3: Oficio rural y riberas (6)
    build_merchant_wagon()
    build_wooden_handcart()
    build_hay_drying_rack()
    build_river_jetty_dock()
    build_beehive_apiary_stand()
    build_field_irrigation_wheel()

    build_presentation_gallery()

    manifest = dict(
        version=1,
        pack='pompelin-world-props',
        title='Pompelín · Caminos y campamentos',
        author='Brumaluz',
        description='Atrezo original de Blender para el mapa mundo de Pompelín: hitos, señales, humilladeros, ruinas, puentes de arroyo, obeliscos, hogueras, tiendas, refugios, suministros, pozos, atalayas, carromatos, almiares, embarcaderos, colmenares y norias. Escala métrica, +Y arriba y +Z frente en GLB.',
        units='meters',
        up_axis_blender='Z',
        up_axis_glb='Y',
        front_axis_blender='-Y',
        front_axis_glb='+Z',
        count=len(ASSETS),
        atlas='textures/world-props-atlas.png',
        blend='pompelin-world-props.blend',
        assets=ASSETS,
    )
    (ART / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'pompelin-world-props.blend'))
    print('WORLD_PROPS_DONE ' + str(len(ASSETS)), flush=True)


if __name__ == '__main__':
    main()
