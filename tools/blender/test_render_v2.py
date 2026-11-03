"""Blender 5.2 test: Refine wood shader, smooth shading, camera framing, and bounty scale."""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art' / 'food-render'

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

def set_smooth(obj):
    if obj and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True

def setup_camera_and_lights(scene, target_z=0.18, cam_scale=1.18, cam_pos=(1.8, -2.1, 1.75)):
    # Ground shadow catcher
    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ShadowCatcher'
    ground.is_shadow_catcher = True

    # Camera target
    target = bpy.data.objects.new('CamTarget', None)
    target.location = (0, 0, target_z)
    scene.collection.objects.link(target)

    # Orthographic camera
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = cam_scale
    cam = bpy.data.objects.new('Camera', cam_data)
    cam.location = cam_pos
    scene.collection.objects.link(cam)
    scene.camera = cam

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Key warm sun
    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 3.8
    sun_data.color = (1.0, 0.97, 0.92)
    sun_data.angle = math.radians(20)
    sun = bpy.data.objects.new('KeySun', sun_data)
    sun.rotation_euler = (math.radians(65), math.radians(16), math.radians(-38))
    scene.collection.objects.link(sun)

    # Fill sun
    fill_data = bpy.data.lights.new('FillSun', 'SUN')
    fill_data.energy = 1.4
    fill_data.color = (0.85, 0.92, 1.0)
    fill = bpy.data.objects.new('FillSun', fill_data)
    fill.rotation_euler = (math.radians(50), math.radians(-25), math.radians(140))
    scene.collection.objects.link(fill)

    # Rim light
    rim_data = bpy.data.lights.new('RimSun', 'SUN')
    rim_data.energy = 1.3
    rim_data.color = (1.0, 0.94, 0.82)
    rim = bpy.data.objects.new('RimSun', rim_data)
    rim.rotation_euler = (math.radians(-30), math.radians(15), math.radians(160))
    scene.collection.objects.link(rim)

def create_lathe_wood_mat(name, dark=(0.38, 0.22, 0.12, 1), mid=(0.56, 0.36, 0.20, 1), light=(0.68, 0.46, 0.28, 1)):
    """Lathe-turned wooden platter with soft rings and grain."""
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    noise.inputs['Scale'].default_value = 3.5
    noise.inputs['Detail'].default_value = 3.0
    noise.inputs['Roughness'].default_value = 0.5

    ramp.color_ramp.elements[0].position = 0.1
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.5)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 0.9
    ramp.color_ramp.elements[2].color = light

    bump.inputs['Strength'].default_value = 0.04
    bsdf.inputs['Roughness'].default_value = 0.36
    bsdf.inputs['Specular IOR Level'].default_value = 0.55

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_board_wood_mat(name, dark=(0.28, 0.16, 0.08, 1), mid=(0.54, 0.34, 0.18, 1), light=(0.72, 0.48, 0.28, 1)):
    """Cutting board wood with long longitudinal grain."""
    mat = bpy.data.materials.new(name)
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

    # Stretch along X axis so grain flows along the board
    mapping.inputs['Scale'].default_value = (0.2, 1.8, 1.0)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value = 2.4
    wave.inputs['Distortion'].default_value = 1.5
    wave.inputs['Detail'].default_value = 2.0

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 1.0
    ramp.color_ramp.elements[2].color = light

    bump.inputs['Strength'].default_value = 0.05
    bsdf.inputs['Roughness'].default_value = 0.4

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
    links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(wave.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_bread_crust_mat():
    mat = bpy.data.materials.new('BreadCrustMat')
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp_crust = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')
    voronoi = nodes.new('ShaderNodeTexVoronoi')

    # Crust color
    noise.inputs['Scale'].default_value = 14.0
    noise.inputs['Detail'].default_value = 5.0
    ramp_crust.color_ramp.elements[0].position = 0.0
    ramp_crust.color_ramp.elements[0].color = (0.34, 0.16, 0.06, 1) # dark baked
    el_mid = ramp_crust.color_ramp.elements.new(0.45)
    el_mid.color = (0.76, 0.46, 0.17, 1) # golden
    ramp_crust.color_ramp.elements[2].position = 1.0
    ramp_crust.color_ramp.elements[2].color = (0.92, 0.68, 0.34, 1) # light golden

    # Bump with voronoi for crust cracks
    voronoi.inputs['Scale'].default_value = 24.0
    bump.inputs['Strength'].default_value = 0.20
    bump.inputs['Distance'].default_value = 0.03

    # Flour dust on top
    geometry = nodes.new('ShaderNodeNewGeometry')
    flour_math = nodes.new('ShaderNodeVectorMath')
    flour_math.operation = 'DOT_PRODUCT'
    flour_math.inputs[1].default_value = (0.0, 0.0, 1.0)
    links.new(geometry.outputs['Normal'], flour_math.inputs[0])

    flour_mult = nodes.new('ShaderNodeMath')
    flour_mult.operation = 'MULTIPLY'
    links.new(flour_math.outputs['Value'], flour_mult.inputs[0])
    links.new(noise.outputs['Fac'], flour_mult.inputs[1])

    flour_ramp = nodes.new('ShaderNodeValToRGB')
    flour_ramp.color_ramp.elements[0].position = 0.38
    flour_ramp.color_ramp.elements[1].position = 0.66
    links.new(flour_mult.outputs['Value'], flour_ramp.inputs['Fac'])

    mix_flour = nodes.new('ShaderNodeMix')
    mix_flour.data_type = 'RGBA'
    links.new(flour_ramp.outputs['Color'], mix_flour.inputs['Factor'])
    links.new(ramp_crust.outputs['Color'], mix_flour.inputs['A'])
    mix_flour.inputs['B'].default_value = (0.96, 0.94, 0.88, 1)

    bsdf.inputs['Roughness'].default_value = 0.68

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(tex_coord.outputs['Object'], voronoi.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp_crust.inputs['Fac'])
    links.new(voronoi.outputs['Distance'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(mix_flour.outputs['Result'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_crumb_mat():
    mat = bpy.data.materials.new('BreadCrumbMat')
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    bump = nodes.new('ShaderNodeBump')

    voronoi.inputs['Scale'].default_value = 36.0
    bump.inputs['Strength'].default_value = 0.38
    bump.inputs['Distance'].default_value = 0.02

    bsdf.inputs['Base Color'].default_value = (0.94, 0.87, 0.73, 1)
    bsdf.inputs['Roughness'].default_value = 0.84
    bsdf.inputs['Subsurface Weight'].default_value = 0.12

    links.new(tex_coord.outputs['Object'], voronoi.inputs['Vector'])
    links.new(voronoi.outputs['Distance'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_cheese_mat():
    mat = bpy.data.materials.new('CheeseMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.96, 0.80, 0.32, 1)
    bsdf.inputs['Roughness'].default_value = 0.35
    bsdf.inputs['Subsurface Weight'].default_value = 0.20
    bsdf.inputs['Specular IOR Level'].default_value = 0.55
    return mat

def create_berry_mat():
    mat = bpy.data.materials.new('BerryMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.75, 0.08, 0.12, 1)
    bsdf.inputs['Roughness'].default_value = 0.16
    bsdf.inputs['Subsurface Weight'].default_value = 0.26
    bsdf.inputs['Specular IOR Level'].default_value = 0.8
    return mat

def create_mush_mats():
    m_cap = bpy.data.materials.new('MushroomCap')
    bsdf = m_cap.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.42, 0.26, 0.14, 1)
    bsdf.inputs['Roughness'].default_value = 0.65

    m_stem = bpy.data.materials.new('MushroomStem')
    bsdf2 = m_stem.node_tree.nodes.get('Principled BSDF')
    bsdf2.inputs['Base Color'].default_value = (0.90, 0.86, 0.76, 1)
    bsdf2.inputs['Roughness'].default_value = 0.5
    return m_cap, m_stem

def create_herb_mat():
    mat = bpy.data.materials.new('HerbMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.22, 0.48, 0.16, 1)
    bsdf.inputs['Roughness'].default_value = 0.4
    return mat

def test_pan_duro():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.18, cam_scale=1.18)

    m_board = create_board_wood_mat('BoardWood')
    m_crust = create_bread_crust_mat()
    m_crumb = create_crumb_mat()

    # Rectangular cutting board with handle on left
    bpy.ops.mesh.primitive_cube_add(location=(0.04, 0.0, 0.024))
    board = bpy.context.active_object
    board.scale = (0.50, 0.38, 0.024)
    bpy.ops.object.transform_apply(scale=True)
    mod = board.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.02
    mod.segments = 3
    set_smooth(board)
    board.data.materials.append(m_board)

    # Handle on cutting board
    bpy.ops.mesh.primitive_cube_add(location=(-0.56, 0.0, 0.024))
    handle = bpy.context.active_object
    handle.scale = (0.10, 0.08, 0.024)
    bpy.ops.object.transform_apply(scale=True)
    mod_h = handle.modifiers.new('Bevel', 'BEVEL')
    mod_h.width = 0.015
    mod_h.segments = 2
    set_smooth(handle)
    handle.data.materials.append(m_board)

    # Bread loaf (Boule) - scaled up and bountiful
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.28, location=(-0.04, -0.02, 0.22))
    loaf = bpy.context.active_object
    loaf.scale = (1.1, 0.92, 0.74)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.12:
            v.co.z = max(0.048, v.co.z * 0.3 + 0.035)
        # Deep score cuts along top
        dist_cut1 = abs(v.co.x - v.co.y * 0.4)
        dist_cut2 = abs(v.co.y + v.co.x * 0.4)
        if v.co.z > 0.26:
            if dist_cut1 < 0.035:
                v.co.z -= (0.035 - dist_cut1) * 0.8
            if dist_cut2 < 0.035:
                v.co.z -= (0.035 - dist_cut2) * 0.8
        # Rustic organic asymmetry
        v.co.x += math.sin(v.co.y * 12.0) * 0.008
        v.co.y += math.cos(v.co.x * 12.0) * 0.008
    bm.to_mesh(loaf.data)
    bm.free()

    sub = loaf.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    set_smooth(loaf)
    loaf.data.materials.append(m_crust)

    # Cut bread slice
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.18, depth=0.048, location=(0.32, 0.08, 0.14), rotation=(math.radians(20), math.radians(40), math.radians(-25)))
    slice_obj = bpy.context.active_object
    slice_obj.scale = (1.0, 0.78, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(slice_obj)
    slice_obj.data.materials.append(m_crumb)

    # Knife
    mat_blade = bpy.data.materials.new('KnifeBlade')
    b_blade = mat_blade.node_tree.nodes.get('Principled BSDF')
    b_blade.inputs['Base Color'].default_value = (0.86, 0.88, 0.90, 1)
    b_blade.inputs['Metallic'].default_value = 0.95
    b_blade.inputs['Roughness'].default_value = 0.22

    bpy.ops.mesh.primitive_cube_add(location=(0.14, -0.28, 0.055), rotation=(0, 0, math.radians(-20)))
    blade = bpy.context.active_object
    blade.scale = (0.22, 0.02, 0.005)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(blade)
    blade.data.materials.append(mat_blade)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.015, depth=0.15, location=(-0.08, -0.36, 0.058), rotation=(0, math.radians(90), math.radians(-20)))
    knife_handle = bpy.context.active_object
    set_smooth(knife_handle)
    knife_handle.data.materials.append(m_board)

    # Breadcrumbs
    for cx, cy in [(0.24, 0.22), (0.12, 0.26), (-0.26, 0.20), (0.32, -0.10), (0.22, -0.14), (0.02, 0.24)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.014, location=(cx, cy, 0.056))
        crumb = bpy.context.active_object
        set_smooth(crumb)
        crumb.data.materials.append(m_crumb)

    out_file = str(OUT / 'test_pan_duro_v2.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def test_comida_1():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.18, cam_scale=1.18)

    m_wood = create_lathe_wood_mat('LathePlatter')
    m_crust = create_bread_crust_mat()
    m_cheese = create_cheese_mat()
    m_berry = create_berry_mat()
    m_mush_cap, m_mush_stem = create_mush_mats()
    m_herb = create_herb_mat()

    # Trencher
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.48, depth=0.055, location=(0, 0, 0.028))
    trencher = bpy.context.active_object
    trencher.scale = (1.1, 0.96, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(trencher.data)
    for v in bm.verts:
        dist = math.sqrt(v.co.x**2 + v.co.y**2)
        if v.co.z > 0.022 and dist < 0.42:
            v.co.z -= 0.022
    bm.to_mesh(trencher.data)
    bm.free()
    mod = trencher.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.016
    mod.segments = 2
    set_smooth(trencher)
    trencher.data.materials.append(m_wood)

    # Bread roll
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=0.22, location=(-0.16, -0.04, 0.18))
    loaf = bpy.context.active_object
    loaf.scale = (1.05, 0.92, 0.72)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.10:
            v.co.z = max(0.045, v.co.z * 0.35 + 0.035)
    bm.to_mesh(loaf.data)
    bm.free()
    sub = loaf.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    set_smooth(loaf)
    loaf.data.materials.append(m_crust)

    # Cheese wedge
    bm = bmesh.new()
    s = 0.24
    h = 0.09
    v0 = bm.verts.new((0, 0, 0))
    v1 = bm.verts.new((s, -s*0.45, 0))
    v2 = bm.verts.new((s, s*0.45, 0))
    v3 = bm.verts.new((0, 0, h))
    v4 = bm.verts.new((s, -s*0.45, h))
    v5 = bm.verts.new((s, s*0.45, h))
    bm.faces.new([v0, v2, v1])
    bm.faces.new([v3, v4, v5])
    bm.faces.new([v0, v1, v4, v3])
    bm.faces.new([v1, v2, v5, v4])
    bm.faces.new([v2, v0, v3, v5])
    mesh = bpy.data.meshes.new('CheeseMesh')
    bm.to_mesh(mesh)
    bm.free()
    cheese = bpy.data.objects.new('CheeseObj', mesh)
    cheese.location = (0.12, -0.15, 0.045)
    cheese.rotation_euler = (0, 0, math.radians(38))
    scene.collection.objects.link(cheese)
    mod = cheese.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.012
    mod.segments = 2
    set_smooth(cheese)
    cheese.data.materials.append(m_cheese)

    # Mushrooms
    for mx, my, mrot, r_cap, h_stem in [(0.06, 0.18, 16, 0.105, 0.12), (-0.14, 0.20, -22, 0.08, 0.095)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r_cap*0.32, depth=h_stem, location=(mx, my, 0.07), rotation=(math.radians(mrot), 0, 0))
        st = bpy.context.active_object
        set_smooth(st)
        st.data.materials.append(m_mush_stem)

        cap_z = 0.07 + h_stem * 0.48
        bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=r_cap, location=(mx, my + math.sin(math.radians(mrot))*h_stem*0.35, cap_z))
        cap = bpy.context.active_object
        cap.scale = (1.0, 1.0, 0.58)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(cap)
        cap.data.materials.append(m_mush_cap)

    # Berries
    offsets = [(0, 0, 0), (0.045, 0.03, 0.01), (-0.04, 0.035, 0.01), (0.02, -0.045, 0.01), (-0.035, -0.035, 0.015), (0.005, 0.01, 0.045), (-0.02, -0.01, 0.042)]
    for i, (ox, oy, oz) in enumerate(offsets):
        loc = (0.22 + ox, 0.12 + oy, 0.055 + oz)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.038, location=loc)
        b = bpy.context.active_object
        set_smooth(b)
        b.data.materials.append(m_berry)

    # Rosemary sprig
    start = (-0.06, -0.24, 0.05)
    rad = math.radians(42)
    length = 0.28
    dx = math.cos(rad) * length
    dy = math.sin(rad) * length
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.008, depth=length, location=(start[0] + dx*0.5, start[1] + dy*0.5, 0.052), rotation=(0, math.radians(88), rad))
    stem = bpy.context.active_object
    set_smooth(stem)
    stem.data.materials.append(m_herb)

    for t in [0.2, 0.4, 0.6, 0.8, 0.95]:
        px = start[0] + dx * t
        py = start[1] + dy * t
        for side in [-1, 1]:
            nx = px + math.cos(rad + math.pi/2 * side) * 0.034
            ny = py + math.sin(rad + math.pi/2 * side) * 0.034
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.004, depth=0.04, location=(nx, ny, 0.054), rotation=(0, math.radians(72), rad + 0.5*side))
            n = bpy.context.active_object
            set_smooth(n)
            n.data.materials.append(m_herb)

    out_file = str(OUT / 'test_comida_1_v2.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

if __name__ == '__main__':
    test_pan_duro()
    test_comida_1()
