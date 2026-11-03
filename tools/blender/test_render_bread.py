"""Blender 5.2 script: Model and render pan_duro (rustic artisan bread on cutting board)."""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art' / 'food-render'
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

def create_wood_material(name, dark=(0.28, 0.16, 0.08, 1), mid=(0.58, 0.38, 0.20, 1), light=(0.78, 0.54, 0.32, 1)):
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
    wave.inputs['Scale'].default_value = 10.0
    wave.inputs['Distortion'].default_value = 3.5
    wave.inputs['Detail'].default_value = 4.0

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 1.0
    ramp.color_ramp.elements[2].color = light

    bump.inputs['Strength'].default_value = 0.08
    bsdf.inputs['Roughness'].default_value = 0.42

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
    links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(wave.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_bread_crust_material():
    mat = bpy.data.materials.new('BreadCrustMat')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp_crust = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')
    geometry = nodes.new('ShaderNodeNewGeometry')
    mix_flour = nodes.new('ShaderNodeMix')
    mix_flour.data_type = 'RGBA'

    # Noise for baked crust color variation
    noise.inputs['Scale'].default_value = 18.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.65

    # Color ramp: dark golden baked brown to warm crust amber
    ramp_crust.color_ramp.elements[0].position = 0.0
    ramp_crust.color_ramp.elements[0].color = (0.35, 0.17, 0.06, 1) # dark baked crust
    el_mid = ramp_crust.color_ramp.elements.new(0.45)
    el_mid.color = (0.76, 0.45, 0.16, 1) # golden crust
    ramp_crust.color_ramp.elements[2].position = 1.0
    ramp_crust.color_ramp.elements[2].color = (0.92, 0.68, 0.32, 1) # light golden

    # Flour dust on top surfaces
    # Dot product or normal Z > 0.6 mixed with noise
    flour_color = (0.96, 0.94, 0.88, 1) # dusted flour

    # Bump for crust crackle
    bump.inputs['Strength'].default_value = 0.22
    bump.inputs['Distance'].default_value = 0.04

    bsdf.inputs['Roughness'].default_value = 0.68
    bsdf.inputs['Specular IOR Level'].default_value = 0.25

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp_crust.inputs['Fac'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    # Mix crust color with flour dust based on noise and upward normal
    flour_math = nodes.new('ShaderNodeVectorMath')
    flour_math.operation = 'DOT_PRODUCT'
    flour_math.inputs[1].default_value = (0.0, 0.0, 1.0)
    links.new(geometry.outputs['Normal'], flour_math.inputs[0])

    flour_mult = nodes.new('ShaderNodeMath')
    flour_mult.operation = 'MULTIPLY'
    links.new(flour_math.outputs['Value'], flour_mult.inputs[0])
    links.new(noise.outputs['Fac'], flour_mult.inputs[1])

    flour_ramp = nodes.new('ShaderNodeValToRGB')
    flour_ramp.color_ramp.elements[0].position = 0.35
    flour_ramp.color_ramp.elements[1].position = 0.65
    links.new(flour_mult.outputs['Value'], flour_ramp.inputs['Fac'])

    links.new(flour_ramp.outputs['Color'], mix_flour.inputs['Factor'])
    links.new(ramp_crust.outputs['Color'], mix_flour.inputs['A'])
    mix_flour.inputs['B'].default_value = flour_color

    links.new(mix_flour.outputs['Result'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_crumb_material():
    mat = bpy.data.materials.new('BreadCrumbMat')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    bump = nodes.new('ShaderNodeBump')

    voronoi.inputs['Scale'].default_value = 35.0
    bump.inputs['Strength'].default_value = 0.45
    bump.inputs['Distance'].default_value = 0.02

    bsdf.inputs['Base Color'].default_value = (0.92, 0.85, 0.70, 1) # warm wheat crumb
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Subsurface Weight'].default_value = 0.15

    links.new(tex_coord.outputs['Object'], voronoi.inputs['Vector'])
    links.new(voronoi.outputs['Distance'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def setup_camera_and_lights(scene, target_z=0.3, cam_scale=1.55):
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
    cam.location = (2.2, -2.4, 2.2)
    scene.collection.objects.link(cam)
    scene.camera = cam

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Warm sun
    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 3.6
    sun_data.color = (1.0, 0.97, 0.92)
    sun_data.angle = math.radians(24)
    sun = bpy.data.objects.new('KeySun', sun_data)
    sun.rotation_euler = (math.radians(70), math.radians(14), math.radians(-38))
    scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new('FillSun', 'SUN')
    fill_data.energy = 1.3
    fill_data.color = (0.84, 0.91, 1.0)
    fill = bpy.data.objects.new('FillSun', fill_data)
    fill.rotation_euler = (math.radians(55), math.radians(-25), math.radians(140))
    scene.collection.objects.link(fill)

    rim_data = bpy.data.lights.new('RimSun', 'SUN')
    rim_data.energy = 1.1
    rim_data.color = (1.0, 0.94, 0.82)
    rim = bpy.data.objects.new('RimSun', rim_data)
    rim.rotation_euler = (math.radians(-30), math.radians(15), math.radians(160))
    scene.collection.objects.link(rim)

def model_pan_duro():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.25, cam_scale=1.5)

    m_board = create_wood_material('BoardWood', (0.22, 0.13, 0.06, 1), (0.50, 0.32, 0.16, 1), (0.72, 0.48, 0.28, 1))
    m_crust = create_bread_crust_material()
    m_crumb = create_crumb_material()

    # Wooden cutting board
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.62, depth=0.06, location=(0, 0, 0.03))
    board = bpy.context.active_object
    board.name = 'CuttingBoard'
    board.scale = (1.15, 0.88, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mod = board.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.016
    mod.segments = 3
    board.data.materials.append(m_board)

    # Bread loaf (Boule)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=0.34, location=(-0.08, -0.05, 0.26))
    loaf = bpy.context.active_object
    loaf.name = 'BreadLoaf'
    loaf.scale = (1.05, 0.88, 0.72)
    bpy.ops.object.transform_apply(scale=True)

    # Flatten the bottom of the bread loaf
    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.22:
            v.co.z = max(0.06, v.co.z * 0.4 + 0.04)
        # Add slight organic bumps
        v.co.x += math.sin(v.co.y * 12.0) * 0.012
        v.co.y += math.cos(v.co.x * 12.0) * 0.012
    bm.to_mesh(loaf.data)
    bm.free()

    sub = loaf.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    loaf.data.materials.append(m_crust)

    # Score cut on the loaf (cross-hatch decorative score)
    for rot_z in [0.4, -0.4]:
        bpy.ops.mesh.primitive_cube_add(location=(-0.08, -0.05, 0.42), rotation=(0, 0, rot_z))
        score = bpy.context.active_object
        score.scale = (0.28, 0.02, 0.03)
        bpy.ops.object.transform_apply(scale=True)
        score.data.materials.append(m_crumb)

    # Bread slice resting against board
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.22, depth=0.045, location=(0.36, 0.12, 0.16), rotation=(math.radians(22), math.radians(45), math.radians(-30)))
    slice_obj = bpy.context.active_object
    slice_obj.name = 'BreadSlice'
    slice_obj.scale = (1.0, 0.75, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    slice_obj.data.materials.append(m_crumb)

    # Bread knife
    mat_blade = bpy.data.materials.new('KnifeBlade')
    mat_blade.use_nodes = True
    b_blade = mat_blade.node_tree.nodes.get('Principled BSDF')
    b_blade.inputs['Base Color'].default_value = (0.85, 0.88, 0.90, 1)
    b_blade.inputs['Metallic'].default_value = 0.95
    b_blade.inputs['Roughness'].default_value = 0.25

    bpy.ops.mesh.primitive_cube_add(location=(0.18, -0.38, 0.075), rotation=(0, 0, math.radians(-22)))
    blade = bpy.context.active_object
    blade.scale = (0.24, 0.022, 0.006)
    bpy.ops.object.transform_apply(scale=True)
    blade.data.materials.append(mat_blade)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016, depth=0.18, location=(-0.08, -0.48, 0.078), rotation=(0, math.radians(90), math.radians(-22)))
    handle = bpy.context.active_object
    handle.data.materials.append(m_board)

    # Crumbs
    for cx, cy in [(0.26, 0.28), (0.15, 0.32), (-0.32, 0.25), (0.38, -0.15), (0.22, -0.18)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.014, location=(cx, cy, 0.068))
        crumb = bpy.context.active_object
        crumb.data.materials.append(m_crumb)

    out_file = str(OUT / 'test_pan_duro.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered pan_duro to {out_file}")

if __name__ == '__main__':
    model_pan_duro()
