"""Blender 5.2 script: Models and renders 6 culinary icons for Cocina in Cycles.
All models feature:
- Centered, bountiful compositions filling the 256x256 framing
- Organic smooth shading with subsurface scattering
- Natural wood grain with zero periodic zebra waves
- Authentic medieval culinary ingredients (artisan breads, cheeses, berries, cured meats, savory roasts, herbs)
"""
import bpy
import bmesh
import math
from pathlib import Path

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

# ----------------- MATERIALS -----------------

def create_wood_mat(name, dark=(0.28, 0.15, 0.08, 1), mid=(0.54, 0.33, 0.18, 1), light=(0.72, 0.48, 0.28, 1), stretch_x=0.22):
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

    mapping.inputs['Scale'].default_value = (stretch_x, 2.6, 1.0)
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

def create_metal_mat(name, color=(0.90, 0.75, 0.28, 1), metallic=0.95, roughness=0.22):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

def create_bread_crust_mat(name='BreadCrust', dark=(0.26, 0.11, 0.04, 1), mid=(0.76, 0.40, 0.14, 1), light=(0.94, 0.65, 0.26, 1), has_flour=True):
    mat = bpy.data.materials.new(name)
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
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.48)
    el_mid.color = mid
    ramp.color_ramp.elements[2].position = 0.90
    ramp.color_ramp.elements[2].color = light

    noise_fine.inputs['Scale'].default_value = 26.0
    noise_fine.inputs['Detail'].default_value = 5.0
    bump.inputs['Strength'].default_value = 0.10

    bsdf.inputs['Roughness'].default_value = 0.65
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
        flour_mix_fac = nodes.new('ShaderNodeMath')
        flour_mix_fac.operation = 'MULTIPLY'
        flour_ramp = nodes.new('ShaderNodeValToRGB')
        flour_ramp.color_ramp.elements[0].position = 0.36
        flour_ramp.color_ramp.elements[1].position = 0.64
        mix_flour = nodes.new('ShaderNodeMix')
        mix_flour.data_type = 'RGBA'
        mix_flour.inputs['B'].default_value = (0.96, 0.94, 0.88, 1)

        links.new(geometry.outputs['Normal'], flour_dot.inputs[0])
        links.new(flour_dot.outputs['Value'], flour_mix_fac.inputs[0])
        links.new(noise.outputs['Fac'], flour_mix_fac.inputs[1])
        links.new(flour_mix_fac.outputs['Value'], flour_ramp.inputs['Fac'])
        links.new(flour_ramp.outputs['Color'], mix_flour.inputs['Factor'])
        links.new(ramp.outputs['Color'], mix_flour.inputs['A'])
        links.new(mix_flour.outputs['Result'], bsdf.inputs['Base Color'])
    else:
        links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_crumb_mat(name='CrumbMat'):
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out_node = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_coord = nodes.new('ShaderNodeTexCoord')
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    bump = nodes.new('ShaderNodeBump')

    voronoi.inputs['Scale'].default_value = 32.0
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.02

    bsdf.inputs['Base Color'].default_value = (0.94, 0.88, 0.75, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Subsurface Weight'].default_value = 0.12

    links.new(tex_coord.outputs['Object'], voronoi.inputs['Vector'])
    links.new(voronoi.outputs['Distance'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    return mat

def create_cheese_mat(name='CheeseMat', color=(0.96, 0.80, 0.32, 1), subsurface=0.20):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.34
    bsdf.inputs['Subsurface Weight'].default_value = subsurface
    bsdf.inputs['Specular IOR Level'].default_value = 0.55
    return mat

def create_berry_mat(name='BerryMat', color=(0.76, 0.08, 0.12, 1), subsurface=0.26):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.16
    bsdf.inputs['Subsurface Weight'].default_value = subsurface
    bsdf.inputs['Specular IOR Level'].default_value = 0.8
    return mat

def create_roast_mat(name='RoastMeatMat', dark=(0.22, 0.08, 0.03, 1), glaze=(0.68, 0.25, 0.06, 1)):
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    noise.inputs['Scale'].default_value = 16.0
    noise.inputs['Detail'].default_value = 4.0
    ramp.color_ramp.elements[0].position = 0.1
    ramp.color_ramp.elements[0].color = dark
    el_mid = ramp.color_ramp.elements.new(0.5)
    el_mid.color = glaze
    ramp.color_ramp.elements[2].position = 0.9
    ramp.color_ramp.elements[2].color = (0.84, 0.42, 0.10, 1)

    bump.inputs['Strength'].default_value = 0.15
    bsdf.inputs['Roughness'].default_value = 0.24
    bsdf.inputs['Specular IOR Level'].default_value = 0.85
    bsdf.inputs['Subsurface Weight'].default_value = 0.12

    links.new(tex.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def create_bone_mat(name='BoneMat', color=(0.92, 0.90, 0.84, 1)):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.35
    bsdf.inputs['Subsurface Weight'].default_value = 0.08
    return mat

def create_pastry_mat(name='PastryMat'):
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    bump = nodes.new('ShaderNodeBump')

    noise.inputs['Scale'].default_value = 10.0
    noise.inputs['Detail'].default_value = 4.0
    ramp.color_ramp.elements[0].position = 0.1
    ramp.color_ramp.elements[0].color = (0.44, 0.22, 0.06, 1)
    el = ramp.color_ramp.elements.new(0.5)
    el.color = (0.86, 0.52, 0.16, 1)
    ramp.color_ramp.elements[2].position = 0.9
    ramp.color_ramp.elements[2].color = (0.96, 0.74, 0.34, 1)

    bump.inputs['Strength'].default_value = 0.10
    bsdf.inputs['Roughness'].default_value = 0.42
    bsdf.inputs['Specular IOR Level'].default_value = 0.65

    links.new(tex.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def create_herb_mat(name='HerbMat', color=(0.22, 0.48, 0.16, 1)):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.4
    return mat

# ----------------- REUSABLE BUILDERS -----------------

def add_trencher(radius=0.38, height=0.05, wood_mat=None, rim_mat=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=height, location=(0, 0, height/2.0))
    trencher = bpy.context.active_object
    trencher.scale = (1.1, 0.96, 1.0)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(trencher.data)
    for v in bm.verts:
        dist = math.sqrt(v.co.x**2 + v.co.y**2)
        if v.co.z > height * 0.4 and dist < radius * 0.85:
            v.co.z -= height * 0.45
    bm.to_mesh(trencher.data)
    bm.free()

    mod = trencher.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.015
    mod.segments = 2
    set_smooth(trencher)
    if wood_mat:
        trencher.data.materials.append(wood_mat)

    if rim_mat:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius*0.96, minor_radius=0.009, major_segments=40, minor_segments=10, location=(0, 0, height*0.96))
        rim = bpy.context.active_object
        rim.scale = (1.1, 0.96, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(rim)
        rim.data.materials.append(rim_mat)

    return trencher

def add_cheese(loc=(0.11, -0.07, 0.042), rot=40, size=0.22, height=0.09, mat=None):
    bm = bmesh.new()
    s = size
    h = height
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
    obj = bpy.data.objects.new('CheeseObj', mesh)
    obj.location = loc
    obj.rotation_euler = (0, 0, math.radians(rot))
    bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.012
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def add_mushrooms(positions, cap_mat, stem_mat):
    for mx, my, mrot, r_cap, h_stem in positions:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r_cap*0.32, depth=h_stem, location=(mx, my, 0.065), rotation=(math.radians(mrot), 0, 0))
        st = bpy.context.active_object
        set_smooth(st)
        st.data.materials.append(stem_mat)

        cap_z = 0.065 + h_stem * 0.48
        bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=r_cap, location=(mx, my + math.sin(math.radians(mrot))*h_stem*0.35, cap_z))
        cap = bpy.context.active_object
        cap.scale = (1.0, 1.0, 0.58)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(cap)
        cap.data.materials.append(cap_mat)

def add_berries(center, count, radius, berry_mat):
    offsets = [(0, 0, 0), (0.040, 0.025, 0.01), (-0.035, 0.03, 0.01), (0.018, -0.040, 0.01), (-0.03, -0.03, 0.012), (0.005, 0.008, 0.040), (-0.018, -0.01, 0.038), (0.028, 0.01, 0.036)]
    for i in range(min(count, len(offsets))):
        ox, oy, oz = offsets[i]
        loc = (center[0] + ox, center[1] + oy, center[2] + oz)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=radius*(0.88 + 0.18*math.sin(i*2.1)), location=loc)
        b = bpy.context.active_object
        set_smooth(b)
        b.data.materials.append(berry_mat)

def add_rosemary(start=(-0.08, -0.16, 0.048), angle=35, length=0.28, herb_mat=None):
    rad = math.radians(angle)
    dx = math.cos(rad) * length
    dy = math.sin(rad) * length
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.008, depth=length, location=(start[0] + dx*0.5, start[1] + dy*0.5, 0.050), rotation=(0, math.radians(88), rad))
    stem = bpy.context.active_object
    set_smooth(stem)
    if herb_mat:
        stem.data.materials.append(herb_mat)

    for t in [0.2, 0.4, 0.6, 0.8, 0.95]:
        px = start[0] + dx * t
        py = start[1] + dy * t
        for side in [-1, 1]:
            nx = px + math.cos(rad + math.pi/2 * side) * 0.032
            ny = py + math.sin(rad + math.pi/2 * side) * 0.032
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.004, depth=0.036, location=(nx, ny, 0.052), rotation=(0, math.radians(72), rad + 0.5*side))
            n = bpy.context.active_object
            set_smooth(n)
            if herb_mat:
                n.data.materials.append(herb_mat)

def add_realistic_drumstick(loc=(0.04, -0.04, 0.10), rot=(12, -22, 35), roast_mat=None, bone_mat=None):
    """Realistic RPG roasted poultry drumstick with ivory bone knuckle and caramelized meat joint."""
    bm_b = bmesh.new()
    b_verts_1 = []
    b_verts_2 = []
    for a in range(12):
        ang = a * (2 * math.pi / 12)
        by = math.cos(ang) * 0.016
        bz = math.sin(ang) * 0.016
        b_verts_1.append(bm_b.verts.new((-0.16, by, bz)))
        b_verts_2.append(bm_b.verts.new((0.02, by, bz)))
    for a in range(12):
        a_next = (a + 1) % 12
        bm_b.faces.new([b_verts_1[a], b_verts_1[a_next], b_verts_2[a_next], b_verts_2[a]])
    for ky in [-0.016, 0.016]:
        v_knob = [
            bm_b.verts.new((-0.19, ky, 0)),
            bm_b.verts.new((-0.16, ky - 0.018, 0)),
            bm_b.verts.new((-0.16, ky + 0.018, 0)),
            bm_b.verts.new((-0.16, ky, -0.018)),
            bm_b.verts.new((-0.16, ky, 0.018)),
            bm_b.verts.new((-0.13, ky, 0)),
        ]
        bm_b.faces.new([v_knob[0], v_knob[1], v_knob[3]])
        bm_b.faces.new([v_knob[0], v_knob[3], v_knob[2]])
        bm_b.faces.new([v_knob[0], v_knob[2], v_knob[4]])
        bm_b.faces.new([v_knob[0], v_knob[4], v_knob[1]])
        bm_b.faces.new([v_knob[5], v_knob[3], v_knob[1]])
        bm_b.faces.new([v_knob[5], v_knob[2], v_knob[3]])
        bm_b.faces.new([v_knob[5], v_knob[4], v_knob[2]])
        bm_b.faces.new([v_knob[5], v_knob[1], v_knob[4]])

    mesh_bone = bpy.data.meshes.new('BoneMesh')
    bm_b.to_mesh(mesh_bone)
    bm_b.free()
    bone_obj = bpy.data.objects.new('BoneObj', mesh_bone)
    bone_obj.location = loc
    bone_obj.rotation_euler = (math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2]))
    bone_obj.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    set_smooth(bone_obj)
    if bone_mat:
        bone_obj.data.materials.append(bone_mat)
    bpy.context.scene.collection.objects.link(bone_obj)

    # Meat
    bm_m = bmesh.new()
    rings = [
        (-0.02, 0.045),
        (0.04, 0.085),
        (0.10, 0.125),
        (0.16, 0.135),
        (0.20, 0.115),
        (0.24, 0.06),
        (0.255, 0.01),
    ]
    prev_r = None
    first_r = None
    for rx, r_rad in rings:
        cur_r = []
        for a in range(14):
            ang = a * (2 * math.pi / 14)
            vy = math.cos(ang) * r_rad * 1.08
            vz = math.sin(ang) * r_rad * 0.92
            cur_r.append(bm_m.verts.new((rx, vy, vz)))
        if prev_r:
            for a in range(14):
                an = (a + 1) % 14
                bm_m.faces.new([prev_r[a], prev_r[an], cur_r[an], cur_r[a]])
        else:
            first_r = cur_r
        prev_r = cur_r
    bm_m.faces.new(list(reversed(prev_r)))
    bm_m.faces.new(first_r)

    mesh_meat = bpy.data.meshes.new('MeatMesh')
    bm_m.to_mesh(mesh_meat)
    bm_m.free()
    meat_obj = bpy.data.objects.new('MeatObj', mesh_meat)
    meat_obj.location = loc
    meat_obj.rotation_euler = (math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2]))
    meat_obj.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    set_smooth(meat_obj)
    if roast_mat:
        meat_obj.data.materials.append(roast_mat)
    bpy.context.scene.collection.objects.link(meat_obj)

# ----------------- TIER DEFINITIONS -----------------

def render_pan_duro():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.16, cam_scale=0.98)

    m_board = create_wood_mat('BoardWood', (0.28, 0.15, 0.08, 1), (0.54, 0.33, 0.18, 1), (0.72, 0.48, 0.28, 1), stretch_x=0.18)
    m_crust = create_bread_crust_mat('BreadCrust', has_flour=True)
    m_crumb = create_crumb_mat('CrumbMat')
    m_steel = create_metal_mat('BladeSteel', (0.86, 0.88, 0.90, 1), metallic=0.95, roughness=0.22)

    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.42, depth=0.045, location=(0.04, 0.0, 0.022))
    board = bpy.context.active_object
    board.scale = (1.20, 0.86, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mod = board.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.016
    mod.segments = 3
    set_smooth(board)
    board.data.materials.append(m_board)

    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.042, depth=0.040, location=(-0.50, 0.0, 0.022), rotation=(0, math.radians(90), 0))
    handle = bpy.context.active_object
    mod_h = handle.modifiers.new('Bevel', 'BEVEL')
    mod_h.width = 0.01
    set_smooth(handle)
    handle.data.materials.append(m_board)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.26, location=(-0.04, -0.02, 0.21))
    loaf = bpy.context.active_object
    loaf.scale = (1.1, 0.92, 0.74)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.10:
            v.co.z = max(0.042, v.co.z * 0.3 + 0.032)
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

    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.17, depth=0.046, location=(0.30, 0.08, 0.13), rotation=(math.radians(20), math.radians(40), math.radians(-25)))
    slice_obj = bpy.context.active_object
    slice_obj.scale = (1.0, 0.78, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(slice_obj)
    slice_obj.data.materials.append(m_crumb)

    bpy.ops.mesh.primitive_cube_add(location=(0.14, -0.24, 0.050), rotation=(0, 0, math.radians(-20)))
    blade = bpy.context.active_object
    blade.scale = (0.20, 0.02, 0.005)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(blade)
    blade.data.materials.append(m_steel)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.015, depth=0.14, location=(-0.06, -0.31, 0.053), rotation=(0, math.radians(90), math.radians(-20)))
    knife_handle = bpy.context.active_object
    set_smooth(knife_handle)
    knife_handle.data.materials.append(m_board)

    for cx, cy in [(0.22, 0.18), (0.10, 0.22), (-0.24, 0.16), (0.28, -0.06), (0.20, -0.10), (0.02, 0.20)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.014, location=(cx, cy, 0.050))
        crumb = bpy.context.active_object
        set_smooth(crumb)
        crumb.data.materials.append(m_crumb)

    out_file = str(OUT / 'pan_duro.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def render_comida_1():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.15, cam_scale=0.92)

    m_wood = create_wood_mat('PlatterWood', (0.30, 0.17, 0.09, 1), (0.58, 0.36, 0.20, 1), (0.74, 0.50, 0.28, 1))
    m_crust = create_bread_crust_mat('BreadCrust', has_flour=True)
    m_cheese = create_cheese_mat('FarmhouseCheese', (0.96, 0.80, 0.32, 1))
    m_berry = create_berry_mat('WildBerries', (0.76, 0.08, 0.12, 1))
    m_mush_cap = create_cheese_mat('MushroomCap', (0.46, 0.28, 0.15, 1), subsurface=0.05)
    m_mush_stem = create_cheese_mat('MushroomStem', (0.92, 0.88, 0.78, 1), subsurface=0.08)
    m_herb = create_herb_mat('RosemaryHerb')

    add_trencher(radius=0.38, height=0.05, wood_mat=m_wood)

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

    add_cheese(loc=(0.11, -0.07, 0.042), rot=40, size=0.22, height=0.09, mat=m_cheese)
    add_mushrooms([(0.12, 0.15, 14, 0.095, 0.11), (0.01, 0.20, -18, 0.075, 0.09)], m_mush_cap, m_mush_stem)
    add_berries(center=(-0.18, -0.12, 0.05), count=7, radius=0.036, berry_mat=m_berry)
    add_rosemary(start=(-0.08, -0.16, 0.048), angle=35, length=0.28, herb_mat=m_herb)

    out_file = str(OUT / 'comida_1.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def render_comida_2():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.15, cam_scale=0.92)

    m_wood = create_wood_mat('OficialWood', (0.24, 0.13, 0.07, 1), (0.50, 0.30, 0.16, 1), (0.68, 0.44, 0.24, 1))
    m_brass = create_metal_mat('PlatterBrass', (0.88, 0.72, 0.28, 1), metallic=0.92, roughness=0.28)
    m_crust = create_bread_crust_mat('BreadCrust', (0.28, 0.12, 0.05, 1), (0.76, 0.42, 0.14, 1), (0.94, 0.66, 0.28, 1), has_flour=False)
    m_sausage = create_roast_mat('SausageMeat', dark=(0.28, 0.10, 0.05, 1), glaze=(0.70, 0.24, 0.08, 1))
    m_cheese = create_cheese_mat('AgedCheese', (0.96, 0.82, 0.26, 1))
    m_berry = create_berry_mat('Blackberries', (0.38, 0.05, 0.16, 1))
    m_redberry = create_berry_mat('RedBerries', (0.78, 0.08, 0.12, 1))
    m_chanterelle = create_cheese_mat('Chanterelle', (0.72, 0.44, 0.14, 1), subsurface=0.08)
    m_mush_stem = create_cheese_mat('Stem', (0.90, 0.86, 0.76, 1), subsurface=0.08)
    m_herb = create_herb_mat('Rosemary')

    add_trencher(radius=0.39, height=0.052, wood_mat=m_wood, rim_mat=m_brass)

    # Cured roasted sausage link
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.044, depth=0.30, location=(0.04, -0.06, 0.075), rotation=(0, math.radians(90), math.radians(-18)))
    sausage = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(sausage.data)
    for v in bm.verts:
        v.co.y += (v.co.x**2) * 1.6
        if abs(v.co.x) > 0.10:
            factor = max(0.1, min(1.0, (0.15 - abs(v.co.x)) / 0.05))
            v.co.y *= factor
            v.co.z *= factor
    bm.to_mesh(sausage.data)
    bm.free()
    sub = sausage.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    set_smooth(sausage)
    sausage.data.materials.append(m_sausage)

    # Golden roll
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=0.18, location=(-0.14, 0.06, 0.16))
    roll = bpy.context.active_object
    roll.scale = (1.05, 0.90, 0.74)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(roll.data)
    for v in bm.verts:
        if v.co.z < 0.10:
            v.co.z = max(0.045, v.co.z * 0.35 + 0.035)
    bm.to_mesh(roll.data)
    bm.free()
    set_smooth(roll)
    roll.data.materials.append(m_crust)

    add_cheese(loc=(0.14, -0.10, 0.042), rot=44, size=0.20, height=0.088, mat=m_cheese)
    add_mushrooms([(0.06, 0.16, 14, 0.09, 0.105)], m_chanterelle, m_mush_stem)
    add_berries(center=(0.18, 0.07, 0.05), count=6, radius=0.035, berry_mat=m_berry)
    add_berries(center=(-0.20, -0.12, 0.048), count=5, radius=0.030, berry_mat=m_redberry)
    add_rosemary(start=(-0.08, -0.18, 0.048), angle=36, length=0.26, herb_mat=m_herb)

    out_file = str(OUT / 'comida_2.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def render_comida_3():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.15, cam_scale=0.92)

    m_wood = create_wood_mat('WalnutWood', (0.16, 0.09, 0.05, 1), (0.36, 0.21, 0.11, 1), (0.54, 0.34, 0.18, 1))
    m_brass = create_metal_mat('PolishedBrass', (0.92, 0.76, 0.26, 1), metallic=0.95, roughness=0.22)
    m_brioche = create_bread_crust_mat('BriocheCrust', (0.36, 0.16, 0.05, 1), (0.84, 0.48, 0.14, 1), (0.98, 0.72, 0.32, 1), has_flour=False)
    m_roast = create_roast_mat('RoastGlaze')
    m_bone = create_bone_mat('BoneMat')
    m_cheese = create_cheese_mat('SharpCheddar', (0.98, 0.74, 0.22, 1))
    m_grapes = create_berry_mat('PurpleGrapes', (0.34, 0.05, 0.26, 1), subsurface=0.30)
    m_mush_cap = create_cheese_mat('KingMushroom', (0.46, 0.28, 0.14, 1), subsurface=0.06)
    m_mush_stem = create_cheese_mat('StemIvory', (0.90, 0.88, 0.80, 1), subsurface=0.08)
    m_herb = create_herb_mat('ThymeSprig', (0.20, 0.46, 0.18, 1))

    add_trencher(radius=0.40, height=0.054, wood_mat=m_wood, rim_mat=m_brass)

    # Braided brioche rolls on the left
    for bx, by, rz in [(-0.18, 0.04, 25), (-0.08, 0.12, 15), (0.01, 0.16, 5)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.105, location=(bx, by, 0.13), rotation=(0, 0, math.radians(rz)))
        roll = bpy.context.active_object
        roll.scale = (1.2, 0.85, 0.75)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(roll)
        roll.data.materials.append(m_brioche)

    # Realistic roasted poultry drumstick
    add_realistic_drumstick(loc=(0.04, -0.05, 0.10), rot=(12, -22, 35), roast_mat=m_roast, bone_mat=m_bone)

    # Sharp cheddar
    add_cheese(loc=(0.14, -0.10, 0.042), rot=46, size=0.19, height=0.09, mat=m_cheese)

    # Grapes
    add_berries(center=(0.16, 0.09, 0.05), count=7, radius=0.036, berry_mat=m_grapes)

    # Forest mushroom
    add_mushrooms([(-0.18, -0.12, 10, 0.08, 0.095)], m_mush_cap, m_mush_stem)

    # Thyme
    add_rosemary(start=(0.02, -0.18, 0.048), angle=38, length=0.25, herb_mat=m_herb)

    out_file = str(OUT / 'comida_3.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def render_comida_4():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.13, cam_scale=0.85)

    m_wood = create_wood_mat('MahoganyWood', (0.20, 0.07, 0.04, 1), (0.42, 0.17, 0.08, 1), (0.62, 0.26, 0.12, 1))
    m_gold = create_metal_mat('MasterGold', (0.95, 0.80, 0.30, 1), metallic=0.96, roughness=0.18)
    m_pastry = create_pastry_mat('PastyCrust')
    m_roast = create_roast_mat('MasterRoast', dark=(0.20, 0.07, 0.03, 1), glaze=(0.76, 0.28, 0.08, 1))
    m_bone = create_bone_mat('BoneIvory', (0.94, 0.92, 0.86, 1))
    m_truffle = create_cheese_mat('BlackTruffle', (0.16, 0.11, 0.08, 1), subsurface=0.04)
    m_fig = create_berry_mat('HoneyedFig', (0.48, 0.12, 0.22, 1), subsurface=0.30)
    m_cheese = create_cheese_mat('GourmetCheese', (0.98, 0.85, 0.36, 1))
    m_herb = create_herb_mat('MasterGarnish', (0.22, 0.50, 0.18, 1))

    add_trencher(radius=0.38, height=0.052, wood_mat=m_wood, rim_mat=m_gold)

    # Golden savory meat pasty on the left (generously sized)
    bm = bmesh.new()
    steps = 14
    rad = 0.21
    thick = 0.065
    top_v = []
    bot_v = []
    for i in range(steps + 1):
        ang = i * (math.pi / steps)
        px = math.cos(ang) * rad
        py = math.sin(ang) * rad * 0.85
        pz_top = thick * (1.0 - (px**2 + py**2)/(rad**2) * 0.45)
        top_v.append(bm.verts.new((px, py, pz_top)))
        bot_v.append(bm.verts.new((px, py, 0)))
    for i in range(steps):
        bm.faces.new([bot_v[i], bot_v[i+1], top_v[i+1], top_v[i]])
    bm.faces.new([bot_v[steps], bot_v[0], top_v[0], top_v[steps]])
    bm.faces.new(bot_v)
    bm.faces.new(list(reversed(top_v)))

    mesh_pasty = bpy.data.meshes.new('PastyMesh')
    bm.to_mesh(mesh_pasty)
    bm.free()

    pasty = bpy.data.objects.new('PastyObj', mesh_pasty)
    pasty.location = (-0.11, 0.02, 0.04)
    pasty.rotation_euler = (math.radians(12), math.radians(10), math.radians(-25))
    pasty.modifiers.new('Bevel', 'BEVEL').width = 0.012
    pasty.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    bpy.context.scene.collection.objects.link(pasty)
    set_smooth(pasty)
    pasty.data.materials.append(m_pastry)

    for i in range(steps):
        ang = (i + 0.5) * (math.pi / steps)
        bx = math.cos(ang) * rad * 1.02
        by = math.sin(ang) * rad * 0.87
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.015, location=(0,0,0))
        bead = bpy.context.active_object
        bead.location = (
            -0.11 + (bx * math.cos(math.radians(-25)) - by * math.sin(math.radians(-25))),
            0.02 + (bx * math.sin(math.radians(-25)) + by * math.cos(math.radians(-25))),
            0.04 + thick*0.4
        )
        set_smooth(bead)
        bead.data.materials.append(m_pastry)

    # Realistic roast drumstick
    add_realistic_drumstick(loc=(0.06, -0.05, 0.10), rot=(12, -22, 35), roast_mat=m_roast, bone_mat=m_bone)

    # Gourmet cheese
    add_cheese(loc=(0.14, -0.11, 0.040), rot=48, size=0.18, height=0.09, mat=m_cheese)

    # Honeyed figs
    add_berries(center=(0.16, 0.08, 0.05), count=6, radius=0.038, berry_mat=m_fig)

    # Black truffles in front
    for tx, ty in [(-0.16, -0.11), (-0.06, -0.16)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.038, location=(tx, ty, 0.045))
        tr = bpy.context.active_object
        tr.scale = (1.0, 0.9, 0.8)
        bpy.ops.object.transform_apply(scale=True)
        set_smooth(tr)
        tr.data.materials.append(m_truffle)

    add_rosemary(start=(-0.02, -0.17, 0.045), angle=36, length=0.26, herb_mat=m_herb)

    out_file = str(OUT / 'comida_4.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

def render_comida_5():
    scene = reset_scene()
    setup_camera_and_lights(scene, target_z=0.13, cam_scale=0.85)

    m_wood = create_wood_mat('ImperialPlatter', (0.18, 0.06, 0.04, 1), (0.44, 0.16, 0.08, 1), (0.66, 0.26, 0.12, 1))
    m_gold = create_metal_mat('ImperialGold', (0.98, 0.84, 0.32, 1), metallic=0.98, roughness=0.14)
    m_celestial = create_bread_crust_mat('CelestialBread', (0.28, 0.11, 0.04, 1), (0.84, 0.44, 0.14, 1), (0.98, 0.72, 0.28, 1), has_flour=False)
    m_roast = create_roast_mat('ImperialRoast', dark=(0.20, 0.07, 0.03, 1), glaze=(0.84, 0.32, 0.08, 1))
    m_bone = create_metal_mat('GoldBone', (0.96, 0.82, 0.30, 1), metallic=0.92, roughness=0.20)
    m_ambrosia = create_berry_mat('AmbrosiaBerries', (0.85, 0.18, 0.42, 1), subsurface=0.35)
    m_gold_mush = create_cheese_mat('GoldenChanterelle', (0.98, 0.74, 0.22, 1), subsurface=0.22)
    m_cheese = create_cheese_mat('ImperialCheese', (0.99, 0.88, 0.42, 1))
    m_herb = create_herb_mat('CelestialGarnish', (0.24, 0.54, 0.20, 1))

    add_trencher(radius=0.38, height=0.054, wood_mat=m_wood, rim_mat=m_gold)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.26, minor_radius=0.006, major_segments=40, minor_segments=8, location=(0, 0, 0.034))
    inner_ring = bpy.context.active_object
    inner_ring.scale = (1.1, 0.96, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    set_smooth(inner_ring)
    inner_ring.data.materials.append(m_gold)

    # Imperial golden crown roast
    add_realistic_drumstick(loc=(0.06, -0.05, 0.10), rot=(12, -22, 35), roast_mat=m_roast, bone_mat=m_bone)

    # Celestial golden brioche loaf with rich honey color and score cuts
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.20, location=(-0.11, 0.03, 0.17))
    loaf = bpy.context.active_object
    loaf.scale = (1.08, 0.92, 0.74)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(loaf.data)
    for v in bm.verts:
        if v.co.z < 0.10:
            v.co.z = max(0.045, v.co.z * 0.35 + 0.035)
        dist_cut = abs(v.co.x + 0.11 - (v.co.y - 0.03)*0.4)
        if v.co.z > 0.20 and dist_cut < 0.035:
            v.co.z -= (0.035 - dist_cut) * 0.7
    bm.to_mesh(loaf.data)
    bm.free()
    sub = loaf.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    set_smooth(loaf)
    loaf.data.materials.append(m_celestial)

    # Imperial cheese
    add_cheese(loc=(0.14, -0.11, 0.040), rot=48, size=0.18, height=0.09, mat=m_cheese)

    # Ambrosial starberries
    add_berries(center=(0.16, 0.08, 0.05), count=8, radius=0.038, berry_mat=m_ambrosia)

    # Golden chanterelles in front
    add_mushrooms([(-0.16, -0.11, 12, 0.085, 0.10)], m_gold_mush, m_gold_mush)

    # Celestial rosemary
    add_rosemary(start=(-0.04, -0.17, 0.045), angle=38, length=0.28, herb_mat=m_herb)

    lamp_data = bpy.data.lights.new('RadianceLamp', 'POINT')
    lamp_data.energy = 16.0
    lamp_data.color = (1.0, 0.86, 0.52)
    lamp = bpy.data.objects.new('RadianceLamp', lamp_data)
    lamp.location = (0.0, 0.0, 0.45)
    scene.collection.objects.link(lamp)

    out_file = str(OUT / 'comida_5.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")


if __name__ == '__main__':
    print("Rendering pan_duro...")
    render_pan_duro()
    print("Rendering comida_1...")
    render_comida_1()
    print("Rendering comida_2...")
    render_comida_2()
    print("Rendering comida_3...")
    render_comida_3()
    print("Rendering comida_4...")
    render_comida_4()
    print("Rendering comida_5...")
    render_comida_5()
    print("All food renders completed successfully!")
