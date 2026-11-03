"""Blender 5.2 test: Drumstick + Pasty together."""
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

def setup_camera_and_lights(scene):
    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ShadowCatcher'
    ground.is_shadow_catcher = True

    target = bpy.data.objects.new('CamTarget', None)
    target.location = (0, 0, 0.15)
    scene.collection.objects.link(target)

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 0.90
    cam = bpy.data.objects.new('Camera', cam_data)
    cam.location = (1.6, -1.9, 1.55)
    scene.collection.objects.link(cam)
    scene.camera = cam

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.96, 0.90)
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

def create_wood_mat():
    mat = bpy.data.materials.new('Wood')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.54, 0.33, 0.18, 1)
    bsdf.inputs['Roughness'].default_value = 0.38
    return mat

def create_roast_mat():
    mat = bpy.data.materials.new('RoastMat')
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
    ramp.color_ramp.elements[0].color = (0.22, 0.08, 0.03, 1)
    el_mid = ramp.color_ramp.elements.new(0.5)
    el_mid.color = (0.64, 0.24, 0.06, 1)
    ramp.color_ramp.elements[2].position = 0.9
    ramp.color_ramp.elements[2].color = (0.82, 0.40, 0.10, 1)

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

def create_bone_mat():
    mat = bpy.data.materials.new('BoneMat')
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.92, 0.90, 0.84, 1)
    bsdf.inputs['Roughness'].default_value = 0.35
    bsdf.inputs['Subsurface Weight'].default_value = 0.08
    return mat

def create_pastry_mat():
    mat = bpy.data.materials.new('PastryMat')
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
    ramp.color_ramp.elements[0].color = (0.44, 0.22, 0.06, 1) # browned edge
    el = ramp.color_ramp.elements.new(0.5)
    el.color = (0.86, 0.52, 0.16, 1) # golden egg wash
    ramp.color_ramp.elements[2].position = 0.9
    ramp.color_ramp.elements[2].color = (0.96, 0.74, 0.34, 1) # puff pastry

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

def add_pasty(loc=(-0.12, 0.06, 0.05), rot=(15, 10, -25), pastry_mat=None):
    """Cornish / medieval golden savory meat pasty with crimped border."""
    bm = bmesh.new()
    # Half-moon flattened cylinder
    steps = 14
    rad = 0.18
    thick = 0.055
    top_v = []
    bot_v = []
    # Straight back edge from -rad to +rad at y=0
    # Curved front arch
    for i in range(steps + 1):
        ang = i * (math.pi / steps)
        px = math.cos(ang) * rad
        py = math.sin(ang) * rad * 0.85
        # Puff top in center
        pz_top = thick * (1.0 - (px**2 + py**2)/(rad**2) * 0.45)
        top_v.append(bm.verts.new((px, py, pz_top)))
        bot_v.append(bm.verts.new((px, py, 0)))

    # Faces along curved side
    for i in range(steps):
        bm.faces.new([bot_v[i], bot_v[i+1], top_v[i+1], top_v[i]])
    # Back face
    bm.faces.new([bot_v[steps], bot_v[0], top_v[0], top_v[steps]])
    # Bottom face
    bm.faces.new(bot_v)
    # Top face
    bm.faces.new(list(reversed(top_v)))

    mesh = bpy.data.meshes.new('PastyMesh')
    bm.to_mesh(mesh)
    bm.free()

    pasty = bpy.data.objects.new('PastyObj', mesh)
    pasty.location = loc
    pasty.rotation_euler = (math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2]))
    pasty.modifiers.new('Bevel', 'BEVEL').width = 0.012
    pasty.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    bpy.context.scene.collection.objects.link(pasty)
    set_smooth(pasty)
    if pastry_mat:
        pasty.data.materials.append(pastry_mat)

    # Crimped edge beads along the curved arch
    for i in range(steps):
        ang = (i + 0.5) * (math.pi / steps)
        bx = math.cos(ang) * rad * 1.02
        by = math.sin(ang) * rad * 0.87
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.014, location=(0,0,0))
        bead = bpy.context.active_object
        bead.location = (
            loc[0] + (bx * math.cos(math.radians(rot[2])) - by * math.sin(math.radians(rot[2]))),
            loc[1] + (bx * math.sin(math.radians(rot[2])) + by * math.cos(math.radians(rot[2]))),
            loc[2] + thick*0.4
        )
        set_smooth(bead)
        if pastry_mat:
            bead.data.materials.append(pastry_mat)

def test():
    scene = reset_scene()
    setup_camera_and_lights(scene)

    m_wood = create_wood_mat()
    m_roast = create_roast_mat()
    m_bone = create_bone_mat()
    m_pastry = create_pastry_mat()

    # Trencher
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.40, depth=0.05, location=(0, 0, 0.025))
    trencher = bpy.context.active_object
    set_smooth(trencher)
    trencher.data.materials.append(m_wood)

    # Pasty on the left
    add_pasty(loc=(-0.10, 0.06, 0.04), rot=(12, 10, -25), pastry_mat=m_pastry)

    # Drumstick on the right
    bm = bmesh.new()
    b_verts_1 = []
    b_verts_2 = []
    for a in range(12):
        ang = a * (2 * math.pi / 12)
        by = math.cos(ang) * 0.016
        bz = math.sin(ang) * 0.016
        b_verts_1.append(bm.verts.new((-0.16, by, bz)))
        b_verts_2.append(bm.verts.new((0.02, by, bz)))
    for a in range(12):
        a_next = (a + 1) % 12
        bm.faces.new([b_verts_1[a], b_verts_1[a_next], b_verts_2[a_next], b_verts_2[a]])
    for ky in [-0.016, 0.016]:
        v_knob = [
            bm.verts.new((-0.19, ky, 0)),
            bm.verts.new((-0.16, ky - 0.018, 0)),
            bm.verts.new((-0.16, ky + 0.018, 0)),
            bm.verts.new((-0.16, ky, -0.018)),
            bm.verts.new((-0.16, ky, 0.018)),
            bm.verts.new((-0.13, ky, 0)),
        ]
        bm.faces.new([v_knob[0], v_knob[1], v_knob[3]])
        bm.faces.new([v_knob[0], v_knob[3], v_knob[2]])
        bm.faces.new([v_knob[0], v_knob[2], v_knob[4]])
        bm.faces.new([v_knob[0], v_knob[4], v_knob[1]])
        bm.faces.new([v_knob[5], v_knob[3], v_knob[1]])
        bm.faces.new([v_knob[5], v_knob[2], v_knob[3]])
        bm.faces.new([v_knob[5], v_knob[4], v_knob[2]])
        bm.faces.new([v_knob[5], v_knob[1], v_knob[4]])

    mesh_bone = bpy.data.meshes.new('BoneMesh')
    bm.to_mesh(mesh_bone)
    bm.free()
    bone_obj = bpy.data.objects.new('BoneObj', mesh_bone)
    bone_obj.location = (0.04, -0.06, 0.10)
    bone_obj.rotation_euler = (math.radians(12), math.radians(-22), math.radians(35))
    bone_obj.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    set_smooth(bone_obj)
    bone_obj.data.materials.append(m_bone)
    scene.collection.objects.link(bone_obj)

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
    meat_obj.location = (0.04, -0.06, 0.10)
    meat_obj.rotation_euler = (math.radians(12), math.radians(-22), math.radians(35))
    meat_obj.modifiers.new('Subsurf', 'SUBSURF').levels = 1
    set_smooth(meat_obj)
    meat_obj.data.materials.append(m_roast)
    scene.collection.objects.link(meat_obj)

    out_file = str(OUT / 'test_pasty_drumstick.png')
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_file}")

if __name__ == '__main__':
    test()
