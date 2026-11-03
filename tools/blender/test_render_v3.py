"""Blender 5.2 test: Perfect wood grain (no zebra waves), rich baked bread crust, and trencher composition."""
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

def setup_camera_and_lights(scene, target_z=0.17, cam_scale=1.12, cam_pos=(1.85, -2.15, 1.65)):
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

    # Warm key sun
    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 4.0
    sun_data.color = (1.0, 0.96, 0.90)
    sun_data.angle = math.radians(20)
    sun = bpy.data.objects.new('KeySun', sun_data)
    sun.rotation_euler = (math.radians(65), math.radians(16), math.radians(-38))
    scene.collection.objects.link(sun)

    # Cool fill sun
    fill_data = bpy.data.lights.new('FillSun', 'SUN')
    fill_data.energy = 1.4
    fill_data.color = (0.85, 0.92, 1.0)
    fill = bpy.data.objects.new('FillSun', fill_data)
    fill.rotation_euler = (math.radians(48), math.radians(-25), math.radians(140))
    scene.collection.objects.link(fill)

    # Warm rim
    rim_data = bpy.data.lights.new('RimSun', 'SUN')
    rim_data.energy = 1.3
    rim_data.color = (1.0, 0.93, 0.80)
    rim = bpy.data.objects.new('RimSun', rim_data)
    rim.rotation_euler = (math.radians(-30), math.radians(15), math.radians(160))
    scene.collection.objects.link(rim)

def create_fine_wood_mat(name, dark=(0.28, 0.15, 0.08, 1), mid=(0.54, 0.33, 0.18, 1), light=(0.70, 0.46, 0.26, 1), stretch_x=0.25):
    """Natural wood shader using stretched noise for realistic planks/boards - zero zebra stripes."""
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

    mapping.inputs['Scale'].default_value = (stretch_x, 2.8, 1.0)
    noise.inputs['Scale'].default_value = 5.0
    noise.inputs['Detail'].default_value = 5.0
    noise.inputs['Roughness'].default_value = 0.6

    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.52)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 0.88
    ramp.color_ramp.elements[2].color = light

    bump.inputs['Strength'].default_value = 0.06
    bump.inputs['Distance'].default_value = 0.04
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

def create_rich_bread_mat(has_flour=True):
    """Rich golden-amber baked artisan crust with flour dusting."""
    mat = bpy.data.materials.new('RichBreadCrust')
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

    # Color variation
    noise.inputs['Scale'].default_value = 8.0
    noise.inputs['Detail'].default_value = 4.0

    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[0].color = (0.26, 0.11, 0.04, 1) # deep caramelized baked crust
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = (0.74, 0.38, 0.12, 1) # rich golden amber
    ramp.color_ramp.elements[2].position = 0.90
    ramp.color_ramp.elements[2].color = (0.92, 0.62, 0.24, 1) # warm honey crust

    # Fine bump for rustic texture
    noise_fine.inputs['Scale'].default_value = 28.0
    noise_fine.inputs['Detail'].default_value = 5.0
    noise_fine.inputs['Roughness'].default_value = 0.7
    bump.inputs['Strength'].default_value = 0.12
    bump.inputs['Distance'].default_value = 0.03

    bsdf.inputs['Roughness'].default_value = 0.65
    bsdf.inputs['Specular IOR Level'].default_value = 0.35

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(tex_coord.outputs['Object'], noise_fine.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(noise_fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    if has_flour:
        geometry = nodes.new('ShaderNodeNewGeometry')
        flour_dot = nodes.new('ShaderNodeVectorMath')
        flour_dot.operation = 'DOT_PRODUCT'
        flour_dot.inputs[1].default_value = (0.0, 0.0, 1.0)
        links.new(geometry.outputs['Normal'], flour_dot.inputs[0])

        flour_mix_fac = nodes.new('ShaderNodeMath')
        flour_mix_fac.operation = 'MULTIPLY'
        links.new(flour_dot.outputs['Value'], flour_mix_fac.inputs[0])
        links.new(noise.outputs['Fac'], flour_mix_fac.inputs[1])

        flour_ramp = nodes.new('ShaderNodeValToRGB')
        flour_ramp.color_ramp.elements[0].position = 0.36
        flour_ramp.color_ramp.elements[1].position = 0.64
        links.new(flour_mix_fac.outputs['Value'], flour_ramp.inputs['Fac'])

        mix_flour = nodes.new('ShaderNodeMix')
        mix_flour.data_type = 'RGBA'
        links.new(flour_ramp.outputs['Color'], mix_flour.inputs['Factor'])
        links.new(ramp.outputs['Color'], mix_flour.inputs['A'])
        mix_flour.inputs['B'].default_value = (0.96, 0.94, 0.88, 1) # white flour dust

        links.new(mix_flour.outputs['Result'], bsdf.inputs['Base Color'])
    else:
        links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def test_v3_pan_duro():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.18, cam_scale=1.12)

    m_board = create_fine_wood_mat('CuttingBoardWood', (0.28, 0.15, 0.08, 1), (0.54, 0.33, 0.18, 1), (0.72, 0.48, 0.28, 1), stretch_x=0.18)
    m_crust = create_rich_bread_mat(has_flour=True)

    # Crumb material
    m_crumb = bpy.data.materials.new('CrumbMat')
    b_crumb = m_crumb.node_tree.nodes.get('Principled BSDF')
    b_crumb.inputs['Base Color'].default_value = (0.94, 0.88, 0.74, 1)
    b_crumb.inputs['Roughness'].default_value = 0.85
    b_crumb.inputs['Subsurface Weight'].default_value = 0.12

    # Oval rustic baker's cutting board
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.48, depth=0.045, location=(0.04, 0.0, 0.022))
    board = bpy.context.active_object
    board.scale = (1.22, 0.86, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mod = board.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.016
    mod.segments = 3
    set_smooth(board)
    board.data.materials.append(m_board)

    # Board handle on the left
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.045, depth=0.040, location=(-0.56, 0.0, 0.022), rotation=(0, math.radians(90), 0))
    handle = bpy.context.active_object
    mod_h = handle.modifiers.new('Bevel', 'BEVEL')
    mod_h.width = 0.01
    set_smooth(handle)
    handle.data.materials.append(m_board)

    # Main Boule loaf
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.27, location=(-0.04, -0.02, 0.21))
    loaf = bpy.context.active_object
    loaf.scale = (1.1, 0.92, 0.74)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.10:
            v.co.z = max(0.042, v.co.z * 0.3 + 0.032)
        # Deep cross score cuts along top
        dist_cut1 = abs(v.co.x - v.co.y * 0.4)
        dist_cut2 = abs(v.co.y + v.co.x * 0.4)
        if v.co.z > 0.25:
            if dist_cut1 < 0.038:
                v.co.z -= (0.038 - dist_cut1) * 0.9
            if dist_cut2 < 0.038:
                v.co.z -= (0.038 - dist_cut2) * 0.9
        v.co.x += math.sin(v.co.y * 12.0) * 0.007
        v.co.y += math.cos(v.co.x * 12.0) * 0.007
    bm.to_mesh(loaf.data)
    bm.free()

    sub = loaf.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    set_smooth(loaf)
    loaf.data.materials.append(m_crust)

    # Cut bread slice
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.18, depth=0.048, location=(0.32, 0.08, 0.13), rotation=(math.radians(20), math.radians(40), math.radians(-25)))
    slice_obj = bpy.context.active_object
    slice_obj.scale = (1.0, 0.78, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(slice_obj)
    slice_obj.data.materials.append(m_crumb)

    # Rustic knife
    mat_blade = bpy.data.materials.new('KnifeBlade')
    b_blade = mat_blade.node_tree.nodes.get('Principled BSDF')
    b_blade.inputs['Base Color'].default_value = (0.86, 0.88, 0.90, 1)
    b_blade.inputs['Metallic'].default_value = 0.95
    b_blade.inputs['Roughness'].default_value = 0.22

    bpy.ops.mesh.primitive_cube_add(location=(0.14, -0.26, 0.052), rotation=(0, 0, math.radians(-20)))
    blade = bpy.context.active_object
    blade.scale = (0.22, 0.02, 0.005)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(blade)
    blade.data.materials.append(mat_blade)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.015, depth=0.15, location=(-0.08, -0.34, 0.055), rotation=(0, math.radians(90), math.radians(-20)))
    knife_handle = bpy.context.active_object
    set_smooth(knife_handle)
    knife_handle.data.materials.append(m_board)

    # Crumbs
    for cx, cy in [(0.24, 0.20), (0.12, 0.24), (-0.26, 0.18), (0.32, -0.08), (0.22, -0.12), (0.02, 0.22)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.014, location=(cx, cy, 0.052))
        crumb = bpy.context.active_object
        set_smooth(crumb)
        crumb.data.materials.append(m_crumb)

    out_file = str(OUT / 'test_pan_duro_v3.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

if __name__ == '__main__':
    test_v3_pan_duro()
