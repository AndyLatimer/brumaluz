"""Blender 5.2 script: Models and renders 12 detailed 2D-painted isometric furniture assets for Ebanistería in Cycles."""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art' / 'furniture-render'
OUT.mkdir(parents=True, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    return scene

def create_wood_material(name, dark_color, mid_color, light_color, grain_scale=9.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    wave = nodes.new('ShaderNodeTexWave')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    mapping.inputs['Scale'].default_value = (1.0, 1.0, 3.5)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs['Scale'].default_value = grain_scale
    wave.inputs['Distortion'].default_value = 3.5
    wave.inputs['Detail'].default_value = 4.0
    wave.inputs['Detail Scale'].default_value = 1.6

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = dark_color
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = mid_color
    ramp.color_ramp.elements[2].position = 1.0
    ramp.color_ramp.elements[2].color = light_color

    bump.inputs['Strength'].default_value = 0.07
    bump.inputs['Distance'].default_value = 0.08

    bsdf.inputs['Roughness'].default_value = 0.38
    bsdf.inputs['Specular IOR Level'].default_value = 0.65

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
    links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(wave.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_metal_mat(name, color, metallic=0.9, roughness=0.32):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

def create_color_mat(name, color, roughness=0.75, subsurface=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    if subsurface > 0:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
    return mat

def create_glass_flame_mats():
    m_glass = bpy.data.materials.new('GlassMat')
    m_glass.use_nodes = True
    bsdf_g = m_glass.node_tree.nodes.get('Principled BSDF')
    bsdf_g.inputs['Base Color'].default_value = (0.95, 0.92, 0.82, 1)
    bsdf_g.inputs['Roughness'].default_value = 0.12
    bsdf_g.inputs['Transmission Weight'].default_value = 0.85
    bsdf_g.inputs['IOR'].default_value = 1.45

    m_flame = bpy.data.materials.new('FlameMat')
    m_flame.use_nodes = True
    nodes = m_flame.node_tree.nodes
    nodes.clear()
    out_node = nodes.new('ShaderNodeOutputMaterial')
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (1.0, 0.72, 0.22, 1)
    em.inputs['Strength'].default_value = 12.0
    m_flame.node_tree.links.new(em.outputs['Emission'], out_node.inputs['Surface'])

    return m_glass, m_flame

def add_box(name, loc, size, mat, bevel=0.012, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return obj

def add_cyl(name, loc, radius, depth, mat, vertices=24, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return obj

def add_sphere(name, loc, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def setup_camera_and_lights(scene, target_z=0.4, cam_scale=1.65):
    # Shadow catcher plane
    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ShadowCatcher'
    ground.is_shadow_catcher = True

    # Empty target for camera
    target = bpy.data.objects.new('CamTarget', None)
    target.location = (0, 0, target_z)
    scene.collection.objects.link(target)

    # Orthographic camera at 3/4 isometric perspective
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = cam_scale
    cam = bpy.data.objects.new('Camera', cam_data)
    cam.location = (2.4, -2.6, 2.3)
    scene.collection.objects.link(cam)
    scene.camera = cam

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Key light: Soft warm sun
    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 3.6
    sun_data.color = (1.0, 0.98, 0.93)
    sun_data.angle = math.radians(26)
    sun = bpy.data.objects.new('KeySun', sun_data)
    sun.rotation_euler = (math.radians(72), math.radians(16), math.radians(-40))
    scene.collection.objects.link(sun)

    # Ambient fill
    fill_data = bpy.data.lights.new('FillSun', 'SUN')
    fill_data.energy = 1.3
    fill_data.color = (0.82, 0.90, 1.0)
    fill = bpy.data.objects.new('FillSun', fill_data)
    fill.rotation_euler = (math.radians(60), math.radians(-25), math.radians(140))
    scene.collection.objects.link(fill)

    # Warm rim
    rim_data = bpy.data.lights.new('RimSun', 'SUN')
    rim_data.energy = 1.0
    rim_data.color = (1.0, 0.94, 0.82)
    rim = bpy.data.objects.new('RimSun', rim_data)
    rim.rotation_euler = (math.radians(-30), math.radians(15), math.radians(160))
    scene.collection.objects.link(rim)


# ==============================================================================
# 12 MODEL BUILDERS
# ==============================================================================

# 1. TABURETE
def build_taburete(m):
    add_cyl('seat_top', (0, 0, 0.52), 0.32, 0.07, m['wood'], vertices=24, bevel=0.01)
    add_cyl('seat_rim', (0, 0, 0.48), 0.34, 0.03, m['wood_light'], vertices=24)
    # Turned legs with stretchers
    for i in range(4):
        ang = i * (math.pi / 2.0) + math.pi / 4.0
        lx, ly = math.cos(ang) * 0.18, math.sin(ang) * 0.18
        tx, ty = math.sin(ang) * 0.10, -math.cos(ang) * 0.10
        add_cyl(f'leg_{i}', (lx * 1.15, ly * 1.15, 0.24), 0.028, 0.46, m['wood'], rot=(ty, tx, 0))
        add_cyl(f'cap_{i}', (lx * 1.28, ly * 1.28, 0.03), 0.032, 0.06, m['brass'], rot=(ty, tx, 0))
    add_cyl('stretcher_ring', (0, 0, 0.20), 0.22, 0.022, m['brass'], vertices=16)

# 2. MESA
def build_mesa(m):
    # Tabletop planks
    for idx, py in enumerate([-0.30, -0.10, 0.10, 0.30]):
        mat = m['wood'] if idx % 2 == 0 else m['wood_light']
        add_box(f'plank_{idx}', (0, py, 0.74), (1.45, 0.19, 0.07), mat, bevel=0.008)
    # Apron
    add_box('apron_x1', (0, -0.32, 0.67), (1.28, 0.04, 0.08), m['wood'], bevel=0.005)
    add_box('apron_x2', (0, 0.32, 0.67), (1.28, 0.04, 0.08), m['wood'], bevel=0.005)
    add_box('apron_y1', (-0.62, 0, 0.67), (0.04, 0.60, 0.08), m['wood'], bevel=0.005)
    add_box('apron_y2', (0.62, 0, 0.67), (0.04, 0.60, 0.08), m['wood'], bevel=0.005)
    # Sturdy legs with brass feet
    for lx in [-0.58, 0.58]:
        for ly in [-0.30, 0.30]:
            add_box(f'leg_{lx}_{ly}', (lx, ly, 0.34), (0.085, 0.085, 0.66), m['wood'], bevel=0.008)
            add_box(f'leg_cap_{lx}_{ly}', (lx, ly, 0.035), (0.092, 0.092, 0.07), m['brass'], bevel=0.005)
    # Stretcher rails
    add_box('stretcher_x', (0, 0, 0.18), (1.16, 0.05, 0.04), m['wood_light'], bevel=0.005)
    for sx in [-0.58, 0.58]:
        add_box(f'stretcher_y_{sx}', (sx, 0, 0.18), (0.05, 0.60, 0.04), m['wood_light'], bevel=0.005)
        # Brass corner brackets
        for sy in [-0.30, 0.30]:
            add_box(f'bracket_{sx}_{sy}', (sx, sy, 0.70), (0.095, 0.095, 0.03), m['brass'], bevel=0.004)

# 3. BIBLIOTECA
def build_biblioteca(m):
    # Outer frame
    add_box('plinth', (0, 0, 0.05), (1.15, 0.44, 0.10), m['wood'], bevel=0.01)
    add_box('cornice', (0, 0, 1.48), (1.18, 0.46, 0.08), m['wood_light'], bevel=0.015)
    add_box('back_panel', (0, 0.17, 0.76), (1.08, 0.03, 1.38), m['wood'], bevel=0.005)
    for side in [-0.52, 0.52]:
        add_box(f'side_{side}', (side, 0, 0.76), (0.06, 0.40, 1.38), m['wood'], bevel=0.01)
    # Shelves
    shelf_heights = [0.15, 0.55, 0.95, 1.35]
    for idx, sh in enumerate(shelf_heights):
        add_box(f'shelf_{idx}', (0, 0, sh), (1.02, 0.38, 0.04), m['wood_light'], bevel=0.005)
    # Books on shelf 1 (mid-low: sh=0.55)
    book_colors = [m['book_red'], m['book_blue'], m['book_green'], m['book_gold'], m['book_dark']]
    for b_idx in range(9):
        bx = -0.42 + b_idx * 0.095
        bh = 0.28 + (b_idx % 3) * 0.03
        bcol = book_colors[b_idx % len(book_colors)]
        add_box(f'book1_{b_idx}', (bx, -0.04, 0.57 + bh / 2.0), (0.075, 0.26, bh), bcol, bevel=0.005)
        add_box(f'spine_gold_{b_idx}', (bx, -0.172, 0.57 + bh / 2.0), (0.068, 0.01, bh * 0.75), m['brass'], bevel=0.002)
    # Books on shelf 2 (upper: sh=0.95)
    for b_idx in range(7):
        bx = -0.42 + b_idx * 0.10
        bh = 0.25 + (b_idx % 2) * 0.04
        bcol = book_colors[(b_idx + 2) % len(book_colors)]
        add_box(f'book2_{b_idx}', (bx, -0.04, 0.97 + bh / 2.0), (0.08, 0.24, bh), bcol, bevel=0.005)
    # Scroll on shelf 2
    add_cyl('scroll_on_shelf', (0.35, -0.06, 1.01), 0.04, 0.24, m['parchment'], rot=(math.pi/2.0, 0, 0))
    add_cyl('scroll_seal', (0.35, -0.06, 1.05), 0.02, 0.05, m['book_red'], rot=(math.pi/2.0, 0, 0))

# 4. ESTACION (Banco de Trabajo)
def build_estacion(m):
    # Heavy workbench top
    add_box('bench_top', (0, 0, 0.72), (1.40, 0.65, 0.10), m['wood'], bevel=0.012)
    # Sturdy legs
    for lx in [-0.58, 0.58]:
        for ly in [-0.25, 0.25]:
            add_box(f'leg_{lx}_{ly}', (lx, ly, 0.34), (0.10, 0.10, 0.66), m['wood'], bevel=0.008)
    # Tool shelf below
    add_box('lower_shelf', (0, 0, 0.18), (1.18, 0.50, 0.04), m['wood_light'], bevel=0.005)
    # Iron Vise on front left
    add_box('vise_body', (-0.48, -0.36, 0.76), (0.24, 0.12, 0.12), m['iron'], bevel=0.008)
    add_box('vise_jaw', (-0.48, -0.44, 0.77), (0.24, 0.04, 0.11), m['wood_light'], bevel=0.005)
    add_cyl('vise_screw', (-0.48, -0.40, 0.74), 0.024, 0.16, m['iron'], rot=(math.pi/2.0, 0, 0))
    add_cyl('vise_handle', (-0.48, -0.48, 0.74), 0.015, 0.20, m['wood'])
    # Wood hand plane on top
    add_box('hand_plane', (0.22, -0.08, 0.81), (0.26, 0.09, 0.07), m['wood'], bevel=0.006, rot=(0, 0, math.radians(20)))
    add_box('plane_blade', (0.22, -0.08, 0.86), (0.06, 0.06, 0.08), m['iron'], bevel=0.002, rot=(0, math.radians(25), math.radians(20)))
    # Wood shavings curl
    add_cyl('wood_curls', (0.38, 0.10, 0.78), 0.04, 0.06, m['wood_light'], rot=(math.pi/3.0, 0, 0))

# 5. SILLA
def build_silla(m):
    # Seat
    add_box('seat', (0, -0.02, 0.46), (0.54, 0.52, 0.06), m['wood'], bevel=0.01)
    # Turned legs
    for lx in [-0.22, 0.22]:
        for ly in [-0.22, 0.20]:
            add_cyl(f'leg_{lx}_{ly}', (lx, ly, 0.22), 0.026, 0.44, m['wood'])
            add_cyl(f'cap_{lx}_{ly}', (lx, ly, 0.03), 0.030, 0.06, m['brass'])
    # Stretchers
    add_box('stretcher_front', (0, -0.22, 0.16), (0.42, 0.03, 0.03), m['wood_light'])
    add_box('stretcher_side1', (-0.22, -0.01, 0.16), (0.03, 0.40, 0.03), m['wood_light'])
    add_box('stretcher_side2', (0.22, -0.01, 0.16), (0.03, 0.40, 0.03), m['wood_light'])
    # Backrest stiles
    for sx in [-0.22, 0.22]:
        add_cyl(f'back_stile_{sx}', (sx, 0.20, 0.74), 0.026, 0.54, m['wood'])
        add_sphere(f'finial_{sx}', (sx, 0.20, 1.02), 0.038, m['brass'])
    # Curved top crest rail
    add_box('crest_rail', (0, 0.20, 0.96), (0.54, 0.05, 0.08), m['wood_light'], bevel=0.008)
    # Slats
    for sl in [-0.11, 0, 0.11]:
        add_box(f'slat_{sl}', (sl, 0.20, 0.70), (0.04, 0.02, 0.38), m['wood'], bevel=0.004)

# 6. BANCO
def build_banco(m):
    # Seat plank
    add_box('bench_seat', (0, 0, 0.42), (1.30, 0.46, 0.06), m['wood'], bevel=0.008)
    # Tufted fabric cushion
    add_box('cushion', (0, 0, 0.48), (1.24, 0.40, 0.07), m['cloth_amber'], bevel=0.018)
    for bx in [-0.40, -0.15, 0.15, 0.40]:
        add_sphere(f'tuft_{bx}', (bx, 0, 0.51), 0.016, m['wood'])
    # Turned legs
    for lx in [-0.54, 0.54]:
        for ly in [-0.17, 0.17]:
            add_cyl(f'leg_{lx}_{ly}', (lx, ly, 0.20), 0.032, 0.40, m['wood'])
            add_cyl(f'cap_{lx}_{ly}', (lx, ly, 0.03), 0.036, 0.06, m['brass'])
    # Central stretcher rail
    add_box('stretcher_main', (0, 0, 0.15), (1.06, 0.05, 0.04), m['wood_light'], bevel=0.005)

# 7. MESITA
def build_mesita(m):
    # Round tabletop with beveled edge
    add_cyl('tabletop', (0, 0, 0.62), 0.36, 0.06, m['wood'], vertices=32, bevel=0.008)
    add_cyl('tabletop_rim', (0, 0, 0.58), 0.38, 0.025, m['wood_light'], vertices=32)
    # Central turned pedestal baluster
    add_cyl('pedestal_top', (0, 0, 0.50), 0.07, 0.14, m['wood'])
    add_sphere('pedestal_bulb', (0, 0, 0.38), 0.10, m['brass'])
    add_cyl('pedestal_mid', (0, 0, 0.24), 0.06, 0.18, m['wood'])
    add_cyl('pedestal_base', (0, 0, 0.12), 0.14, 0.06, m['wood_light'], vertices=24)
    # 3 tripod feet
    for i in range(3):
        ang = i * (2.0 * math.pi / 3.0) + math.pi / 6.0
        fx, fy = math.cos(ang) * 0.26, math.sin(ang) * 0.26
        add_box(f'foot_{i}', (fx, fy, 0.05), (0.16, 0.06, 0.07), m['wood'], bevel=0.006, rot=(0, 0, -ang))
        add_sphere(f'foot_ball_{i}', (fx * 1.35, fy * 1.35, 0.03), 0.025, m['brass'])

# 8. ARCON
def build_arcon(m):
    # Main trunk body
    add_box('body', (0, 0, 0.26), (0.90, 0.56, 0.44), m['wood'], bevel=0.015)
    # Plinth base
    add_box('plinth', (0, 0, 0.03), (0.96, 0.62, 0.06), m['wood_light'], bevel=0.01)
    # Curved barrel lid
    add_cyl('lid_curve', (0, 0, 0.48), 0.28, 0.92, m['wood'], vertices=32, rot=(0, math.pi/2.0, 0), bevel=0.01)
    # Wrought iron straps
    for sx in [-0.28, 0.28]:
        add_box(f'strap_body_{sx}', (sx, 0, 0.26), (0.05, 0.57, 0.45), m['iron'], bevel=0.005)
        add_cyl(f'strap_lid_{sx}', (sx, 0, 0.48), 0.286, 0.05, m['iron'], vertices=32, rot=(0, math.pi/2.0, 0))
        for sy in [-0.288, 0.288]:
            for sz in [0.12, 0.24, 0.36]:
                add_sphere(f'rivet_{sx}_{sz}', (sx, sy, sz), 0.014, m['brass'])
    # Brass lock plate and hasp
    add_box('lock_plate', (0, -0.285, 0.38), (0.10, 0.02, 0.14), m['brass'], bevel=0.008)
    add_cyl('hasp', (0, -0.29, 0.38), 0.018, 0.03, m['brass'], rot=(math.pi/2.0, 0, 0))
    # Side handles
    for hx in [-0.46, 0.46]:
        add_box(f'h_plate_{hx}', (hx, 0, 0.28), (0.02, 0.10, 0.05), m['iron'], bevel=0.004)
        add_cyl(f'h_ring_{hx}', (hx + (0.02 if hx > 0 else -0.02), 0, 0.25), 0.045, 0.012, m['iron'], rot=(0, math.pi/2.0, 0))

# 9. ALFOMBRA
def build_alfombra(m):
    # Main rug canvas
    add_box('rug_body', (0, 0, 0.015), (1.45, 1.05, 0.03), m['cloth_amber'], bevel=0.005)
    # Inner border
    add_box('rug_inner', (0, 0, 0.022), (1.30, 0.90, 0.02), m['cloth_green'], bevel=0.004)
    # Center diamond medallion
    add_box('rug_center', (0, 0, 0.028), (0.42, 0.42, 0.015), m['cloth_red'], bevel=0.003, rot=(0, 0, math.pi/4.0))
    add_box('rug_star', (0, 0, 0.032), (0.22, 0.22, 0.01), m['brass'], rot=(0, 0, math.pi/4.0))
    # Fringe tassels along short ends (X = -0.73 and +0.73)
    for fx in [-0.73, 0.73]:
        for ti in range(13):
            ty = -0.48 + ti * 0.08
            add_cyl(f'fringe_{fx}_{ti}', (fx + (0.03 if fx > 0 else -0.03), ty, 0.012), 0.012, 0.06, m['parchment'], rot=(0, math.pi/2.0, 0))

# 10. FAROL
def build_farol(m):
    # Iron base
    add_cyl('lantern_base', (0, 0, 0.04), 0.18, 0.08, m['iron'], vertices=8, bevel=0.01)
    # 4 Iron corner posts
    for cx in [-0.12, 0.12]:
        for cy in [-0.12, 0.12]:
            add_box(f'post_{cx}_{cy}', (cx, cy, 0.30), (0.025, 0.025, 0.48), m['iron'], bevel=0.004)
    # Glass window panes
    add_box('glass_box', (0, 0, 0.30), (0.23, 0.23, 0.44), m['glass'], bevel=0.004)
    # Interior beeswax candle
    add_cyl('candle', (0, 0, 0.20), 0.045, 0.22, m['parchment'], vertices=16)
    # Glowing flame
    add_sphere('flame', (0, 0, 0.34), 0.028, m['flame'])
    # Interior point light for realistic cast glow on lantern frame
    p_light_data = bpy.data.lights.new('FlamePoint', 'POINT')
    p_light_data.energy = 8.0
    p_light_data.color = (1.0, 0.65, 0.18)
    p_light = bpy.data.objects.new('FlamePoint', p_light_data)
    p_light.location = (0, 0, 0.34)
    bpy.context.scene.collection.objects.link(p_light)
    # Pyramid metal cap
    add_cyl('cap_pyramid', (0, 0, 0.58), 0.18, 0.14, m['iron'], vertices=8)
    # Brass finial and ring handle
    add_sphere('top_finial', (0, 0, 0.67), 0.032, m['brass'])
    add_cyl('handle_ring', (0, 0, 0.73), 0.06, 0.015, m['brass'], rot=(0, math.pi/2.0, 0))

# 11. MACETERO
def build_macetero(m):
    # Terracotta urn pot
    add_cyl('pot_rim', (0, 0, 0.36), 0.28, 0.06, m['terracotta'], vertices=24, bevel=0.01)
    add_cyl('pot_body', (0, 0, 0.20), 0.24, 0.28, m['terracotta'], vertices=24)
    add_cyl('pot_base', (0, 0, 0.04), 0.18, 0.08, m['terracotta'], vertices=24)
    # Dark rich soil
    add_cyl('soil', (0, 0, 0.35), 0.25, 0.03, m['book_dark'], vertices=24)
    # Lush cluster of 7 broad green leaves
    for i in range(7):
        ang = i * (2.0 * math.pi / 7.0)
        dist = 0.14
        lx = math.cos(ang) * dist
        ly = math.sin(ang) * dist
        # Stems
        add_cyl(f'stem_{i}', (lx, ly, 0.44), 0.012, 0.18, m['leaf_green'], rot=(math.sin(ang)*0.35, -math.cos(ang)*0.35, 0))
        # Broad leaf blade
        leaf_x = math.cos(ang) * 0.26
        leaf_y = math.sin(ang) * 0.26
        leaf_rot = (math.sin(ang)*0.6, -math.cos(ang)*0.6, ang)
        mat_leaf = m['leaf_green'] if i % 2 == 0 else m['leaf_bright']
        add_box(f'leaf_{i}', (leaf_x, leaf_y, 0.55), (0.16, 0.22, 0.015), mat_leaf, bevel=0.005, rot=leaf_rot)
        # Leaf rib
        add_box(f'rib_{i}', (leaf_x, leaf_y, 0.555), (0.018, 0.20, 0.018), m['leaf_bright'], rot=leaf_rot)

# 12. BIOMBO
def build_biombo(m):
    # 3 Folding panels in accordion Z-fold
    panel_angles = [-math.radians(18), math.radians(14), -math.radians(16)]
    panel_xs = [-0.42, 0.0, 0.42]
    for idx, (px, ang) in enumerate(zip(panel_xs, panel_angles)):
        # Wooden outer frame
        add_box(f'frame_bottom_{idx}', (px, 0, 0.08), (0.38, 0.045, 0.06), m['wood'], rot=(0, 0, ang))
        add_box(f'frame_top_{idx}', (px, 0, 1.38), (0.38, 0.045, 0.06), m['wood_light'], rot=(0, 0, ang))
        add_box(f'stile_l_{idx}', (px - 0.17 * math.cos(ang), -0.17 * math.sin(ang), 0.73), (0.04, 0.045, 1.36), m['wood'], rot=(0, 0, ang))
        add_box(f'stile_r_{idx}', (px + 0.17 * math.cos(ang), 0.17 * math.sin(ang), 0.73), (0.04, 0.045, 1.36), m['wood'], rot=(0, 0, ang))
        # Stretched linen screen
        add_box(f'screen_{idx}', (px, 0, 0.73), (0.31, 0.015, 1.25), m['cloth_amber'], rot=(0, 0, ang))
        # Geometric wood lattice cross
        add_box(f'lattice_h_{idx}', (px, 0, 0.73), (0.31, 0.025, 0.025), m['wood_light'], rot=(0, 0, ang))
        add_box(f'lattice_v_{idx}', (px, 0, 0.73), (0.025, 0.025, 0.60), m['wood_light'], rot=(0, 0, ang))
        # Brass hinges connecting panels
        if idx < 2:
            hx = px + 0.19 * math.cos(ang)
            hy = 0.19 * math.sin(ang)
            for hz in [0.25, 0.75, 1.20]:
                add_cyl(f'hinge_{idx}_{hz}', (hx, hy, hz), 0.016, 0.05, m['brass'])


# ==============================================================================
# RENDER ALL 12 FURNITURE ASSETS
# ==============================================================================

FURNITURE_REGISTRY = [
    ('taburete', build_taburete, 0.32, 1.15),
    ('mesa', build_mesa, 0.42, 1.85),
    ('biblioteca', build_biblioteca, 0.78, 1.95),
    ('estacion', build_estacion, 0.45, 1.80),
    ('silla', build_silla, 0.52, 1.45),
    ('banco', build_banco, 0.32, 1.70),
    ('mesita', build_mesita, 0.35, 1.15),
    ('arcon', build_arcon, 0.34, 1.35),
    ('alfombra', build_alfombra, 0.02, 1.75),
    ('farol', build_farol, 0.38, 1.15),
    ('macetero', build_macetero, 0.35, 1.15),
    ('biombo', build_biombo, 0.72, 1.85),
]

for name, builder, target_z, cam_scale in FURNITURE_REGISTRY:
    scene = reset_scene()
    
    # Create materials palette
    mats = {
        'wood': create_wood_material('RichWalnut', (0.16, 0.08, 0.04, 1), (0.36, 0.21, 0.11, 1), (0.50, 0.32, 0.18, 1), grain_scale=10.0),
        'wood_light': create_wood_material('LightOak', (0.30, 0.18, 0.10, 1), (0.52, 0.36, 0.22, 1), (0.64, 0.46, 0.28, 1), grain_scale=11.0),
        'brass': create_metal_mat('AntiqueBrass', (0.86, 0.66, 0.24, 1), metallic=0.92, roughness=0.28),
        'iron': create_metal_mat('WroughtIron', (0.12, 0.13, 0.15, 1), metallic=0.85, roughness=0.45),
        'cloth_amber': create_color_mat('ClothAmber', (0.76, 0.58, 0.34, 1), roughness=0.88),
        'cloth_green': create_color_mat('ClothGreen', (0.32, 0.45, 0.28, 1), roughness=0.88),
        'cloth_red': create_color_mat('ClothRed', (0.58, 0.18, 0.15, 1), roughness=0.88),
        'parchment': create_color_mat('Parchment', (0.88, 0.82, 0.68, 1), roughness=0.70),
        'terracotta': create_color_mat('Terracotta', (0.72, 0.35, 0.20, 1), roughness=0.76),
        'leaf_green': create_color_mat('LeafGreen', (0.20, 0.42, 0.16, 1), roughness=0.38, subsurface=0.25),
        'leaf_bright': create_color_mat('LeafBright', (0.35, 0.58, 0.22, 1), roughness=0.38, subsurface=0.25),
        'book_red': create_color_mat('BookRed', (0.55, 0.12, 0.12, 1), roughness=0.55),
        'book_blue': create_color_mat('BookBlue', (0.14, 0.28, 0.52, 1), roughness=0.55),
        'book_green': create_color_mat('BookGreen', (0.18, 0.42, 0.22, 1), roughness=0.55),
        'book_gold': create_color_mat('BookGold', (0.75, 0.55, 0.18, 1), roughness=0.50),
        'book_dark': create_color_mat('BookDark', (0.16, 0.13, 0.12, 1), roughness=0.60),
    }
    m_glass, m_flame = create_glass_flame_mats()
    mats['glass'] = m_glass
    mats['flame'] = m_flame

    # Build geometry
    builder(mats)

    # Setup lights and camera
    setup_camera_and_lights(scene, target_z=target_z, cam_scale=cam_scale)

    out_file = OUT / f'{name}.png'
    scene.render.filepath = str(out_file)
    print(f"Rendering {name} to {out_file}...", flush=True)
    bpy.ops.render.render(write_still=True)
    print(f"Completed {name}.", flush=True)

print("ALL_12_FURNITURE_ASSETS_RENDERED_SUCCESSFULLY", flush=True)

