"""Blender 5.2 test: Compact trencher, zoom framing (cam_scale=0.92), and tightly packed bounty."""
import bpy
import bmesh
import math
from pathlib import Path

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

def setup_camera_and_lights(scene, target_z=0.15, cam_scale=0.92, cam_pos=(1.6, -1.9, 1.55)):
    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ShadowCatcher'
    ground.is_shadow_catcher = True

    target = bpy.data.objects.new('CamTarget', None)
    target.location = (0, 0, target_z)
    scene.collection.objects.link(target)

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

    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.96, 0.90)
    sun_data.angle = math.radians(20)
    sun = bpy.data.objects.new('KeySun', sun_data)
    sun.rotation_euler = (math.radians(65), math.radians(16), math.radians(-38))
    scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new('FillSun', 'SUN')
    fill_data.energy = 1.4
    fill_data.color = (0.85, 0.92, 1.0)
    fill = bpy.data.objects.new('FillSun', fill_data)
    fill.rotation_euler = (math.radians(48), math.radians(-25), math.radians(140))
    scene.collection.objects.link(fill)

    rim_data = bpy.data.lights.new('RimSun', 'SUN')
    rim_data.energy = 1.4
    rim_data.color = (1.0, 0.93, 0.80)
    rim = bpy.data.objects.new('RimSun', rim_data)
    rim.rotation_euler = (math.radians(-30), math.radians(15), math.radians(160))
    scene.collection.objects.link(rim)

def create_wood_mat(name, dark=(0.28, 0.15, 0.08, 1), mid=(0.54, 0.33, 0.18, 1), light=(0.72, 0.48, 0.28, 1)):
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    mapping.inputs['Scale'].default_value = (0.22, 2.6, 1.0)
    noise.inputs['Scale'].default_value = 5.0
    noise.inputs['Detail'].default_value = 5.0
    noise.inputs['Roughness'].default_value = 0.6
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.52)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 0.88
    ramp.color_ramp.elements[2].color = light
    bump.inputs['Strength'].default_value = 0.05
    bsdf.inputs['Roughness'].default_value = 0.38
    bsdf.inputs['Specular IOR Level'].default_value = 0.55

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_bread_crust_mat():
    mat = bpy.data.materials.new('BreadCrust')
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise_fine = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    noise.inputs['Scale'].default_value = 8.0
    noise.inputs['Detail'].default_value = 4.0
    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[0].color = (0.26, 0.11, 0.04, 1)
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = (0.76, 0.40, 0.14, 1)
    ramp.color_ramp.elements[2].position = 0.90
    ramp.color_ramp.elements[2].color = (0.94, 0.65, 0.26, 1)

    noise_fine.inputs['Scale'].default_value = 26.0
    noise_fine.inputs['Detail'].default_value = 5.0
    bump.inputs['Strength'].default_value = 0.10

    geometry = nodes.new('ShaderNodeNewGeometry')
    flour_dot = nodes.new('ShaderNodeVectorMath')
    flour_dot.operation = 'DOT_PRODUCT'
    flour_dot.inputs[1].default_value = (0.0, 0.0, 1.0)
    flour_mix_fac = nodes.new('ShaderNodeMath')
    flour_mix_fac.operation = 'MULTIPLY'
    flour_ramp = nodes.new('ShaderNodeValToRGB')
    flour_ramp.color_ramp.elements[0].position = 0.36
    flour_ramp.color_ramp.elements[1].position = 0.64
    mix_flour = nodes.new('ShaderNodeMix')
    mix_flour.data_type = 'RGBA'
    mix_flour.inputs['B'].default_value = (0.96, 0.94, 0.88, 1)

    bsdf.inputs['Roughness'].default_value = 0.65
    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(tex_coord.outputs['Object'], noise_fine.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(noise_fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(geometry.outputs['Normal'], flour_dot.inputs[0])
    links.new(flour_dot.outputs['Value'], flour_mix_fac.inputs[0])
    links.new(noise.outputs['Fac'], flour_mix_fac.inputs[1])
    links.new(flour_mix_fac.outputs['Value'], flour_ramp.inputs['Fac'])
    links.new(flour_ramp.outputs['Color'], mix_flour.inputs['Factor'])
    links.new(ramp.outputs['Color'], mix_flour.inputs['A'])
    links.new(mix_flour.outputs['Result'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_cheese_mat():
    mat = bpy.data.materials.new('CheeseMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.96, 0.80, 0.32, 1)
    bsdf.inputs['Roughness'].default_value = 0.34
    bsdf.inputs['Subsurface Weight'].default_value = 0.20
    bsdf.inputs['Specular IOR Level'].default_value = 0.55
    return mat

def create_berry_mat():
    mat = bpy.data.materials.new('BerryMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.76, 0.08, 0.12, 1)
    bsdf.inputs['Roughness'].default_value = 0.16
    bsdf.inputs['Subsurface Weight'].default_value = 0.26
    bsdf.inputs['Specular IOR Level'].default_value = 0.8
    return mat

def create_mush_mats():
    m_cap = bpy.data.materials.new('MushroomCap')
    bsdf = m_cap.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.46, 0.28, 0.15, 1)
    bsdf.inputs['Roughness'].default_value = 0.55

    m_stem = bpy.data.materials.new('MushroomStem')
    bsdf2 = m_stem.node_tree.nodes.get('Principled BSDF')
    bsdf2.inputs['Base Color'].default_value = (0.92, 0.88, 0.78, 1)
    bsdf2.inputs['Roughness'].default_value = 0.45
    return m_cap, m_stem

def create_herb_mat():
    mat = bpy.data.materials.new('HerbMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.22, 0.48, 0.16, 1)
    bsdf.inputs['Roughness'].default_value = 0.4
    return mat

def test_compact_comida_1():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.15, cam_scale=0.92)

    m_wood = create_wood_mat('PlatterWood')
    m_crust = create_bread_crust_mat()
    m_cheese = create_cheese_mat()
    m_berry = create_berry_mat()
    m_mush_cap, m_mush_stem = create_mush_mats()
    m_herb = create_herb_mat()

    # Compact, deep wooden trencher
    radius = 0.38
    height = 0.05
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=height, location=(0, 0, height/2.0))
    trencher = bpy.context.active_object
    trencher.scale = (1.1, 0.96, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(trencher.data)
    for v in bm.verts:
        dist = math.sqrt(v.co.x**2 + v.co.y**2)
        if v.co.z > height * 0.4 and dist < radius * 0.84:
            v.co.z -= height * 0.45
    bm.to_mesh(trencher.data)
    bm.free()
    mod = trencher.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.015
    mod.segments = 2
    set_smooth(trencher)
    trencher.data.materials.append(m_wood)

    # Bread roll
    bpy.ops.mesh.primitive_uv_sphere_add(segments=30, ring_count=22, radius=0.20, location=(-0.11, 0.02, 0.18))
    loaf = bpy.context.active_object
    loaf.scale = (1.08, 0.94, 0.76)
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
    s = 0.22
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
    cheese.location = (0.11, -0.07, 0.042)
    cheese.rotation_euler = (0, 0, math.radians(40))
    scene.collection.objects.link(cheese)
    mod = cheese.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.012
    set_smooth(cheese)
    cheese.data.materials.append(m_cheese)

    # Mushrooms (in upper right)
    for mx, my, mrot, r_cap, h_stem in [(0.12, 0.15, 14, 0.095, 0.11), (0.01, 0.20, -18, 0.075, 0.09)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r_cap*0.32, depth=h_stem, location=(mx, my, 0.065), rotation=(math.radians(mrot), 0, 0))
        st = bpy.context.active_object
        set_smooth(st)
        st.data.materials.append(m_mush_stem)

        cap_z = 0.065 + h_stem * 0.48
        bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=r_cap, location=(mx, my + math.sin(math.radians(mrot))*h_stem*0.35, cap_z))
        cap = bpy.context.active_object
        cap.scale = (1.0, 1.0, 0.58)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(cap)
        cap.data.materials.append(m_mush_cap)

    # Berries clustered tightly
    offsets = [(0, 0, 0), (0.040, 0.025, 0.01), (-0.035, 0.03, 0.01), (0.018, -0.040, 0.01), (-0.03, -0.03, 0.012), (0.005, 0.008, 0.040), (-0.018, -0.01, 0.038)]
    for ox, oy, oz in offsets:
        loc = (-0.18 + ox, -0.12 + oy, 0.05 + oz)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.036, location=loc)
        b = bpy.context.active_object
        set_smooth(b)
        b.data.materials.append(m_berry)

    # Rosemary sprig in foreground
    start = (-0.08, -0.16, 0.048)
    rad = math.radians(35)
    length = 0.28
    dx = math.cos(rad) * length
    dy = math.sin(rad) * length
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.008, depth=length, location=(start[0] + dx*0.5, start[1] + dy*0.5, 0.050), rotation=(0, math.radians(88), rad))
    stem = bpy.context.active_object
    set_smooth(stem)
    stem.data.materials.append(m_herb)

    for t in [0.2, 0.4, 0.6, 0.8, 0.95]:
        px = start[0] + dx * t
        py = start[1] + dy * t
        for side in [-1, 1]:
            nx = px + math.cos(rad + math.pi/2 * side) * 0.032
            ny = py + math.sin(rad + math.pi/2 * side) * 0.032
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.004, depth=0.036, location=(nx, ny, 0.052), rotation=(0, math.radians(72), rad + 0.5*side))
            n = bpy.context.active_object
            set_smooth(n)
            n.data.materials.append(m_herb)

    out_file = str(OUT / 'test_compact_comida_1.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

if __name__ == '__main__':
    test_compact_comida_1()
