"""Blender 5.2 script: Models and renders 5 3D isometric enchantment scrolls in Cycles."""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / 'art' / 'scrolls-textures'
OUT = ROOT / 'art' / 'scrolls-render'
OUT.mkdir(parents=True, exist_ok=True)

# 1. Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.film_transparent = True

# 2. Camera: Isometric 3/4 with tight framing
cam_data = bpy.data.cameras.new('Camera')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.05
cam = bpy.data.objects.new('Camera', cam_data)
# 3/4 isometric position looking at origin
cam.location = (2.2, -2.6, 2.3)
cam.rotation_euler = (math.radians(56), 0, math.radians(40))
scene.collection.objects.link(cam)
scene.camera = cam

# 3. Lighting
sun_data = bpy.data.lights.new('KeySun', 'SUN')
sun_data.energy = 4.2
sun_data.color = (1.0, 0.97, 0.92)
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new('KeySun', sun_data)
sun.rotation_euler = (math.radians(52), math.radians(-12), math.radians(28))
scene.collection.objects.link(sun)

fill_data = bpy.data.lights.new('FillSun', 'SUN')
fill_data.energy = 1.4
fill_data.color = (0.78, 0.86, 1.0)
fill = bpy.data.objects.new('FillSun', fill_data)
fill.rotation_euler = (math.radians(65), math.radians(25), math.radians(-135))
scene.collection.objects.link(fill)

rim_data = bpy.data.lights.new('RimSun', 'SUN')
rim_data.energy = 1.0
rim_data.color = (1.0, 0.95, 0.85)
rim = bpy.data.objects.new('RimSun', rim_data)
rim.rotation_euler = (math.radians(-40), math.radians(10), math.radians(170))
scene.collection.objects.link(rim)

# 4. Shadow Catcher Ground
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.01))
ground = bpy.context.active_object
ground.name = 'ShadowCatcher'
ground.is_shadow_catcher = True

# 5. Build Scroll 3D Geometry
# 5a. Rolled cylinder at the top rear
bpy.ops.mesh.primitive_cylinder_add(
    vertices=24, radius=0.20, depth=1.55,
    location=(-0.1, 0.45, 0.22),
    rotation=(0, math.pi / 2.0, math.radians(-18))
)
scroll_roll = bpy.context.active_object
scroll_roll.name = 'ScrollRoll'

# Wood rod ends extending out of roll
bpy.ops.mesh.primitive_cylinder_add(
    vertices=16, radius=0.07, depth=1.85,
    location=(-0.1, 0.45, 0.22),
    rotation=(0, math.pi / 2.0, math.radians(-18))
)
rod_core = bpy.context.active_object
rod_core.name = 'RodCore'

# Turned wooden knobs on rod ends
for side in [-1, 1]:
    kx = -0.1 + side * 0.95 * math.cos(math.radians(-18))
    ky = 0.45 + side * 0.95 * math.sin(math.radians(-18))
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.12,
        location=(kx, ky, 0.22)
    )
    knob = bpy.context.active_object
    knob.name = f'RodKnob_{side}'

# 5b. Unfurling Curved Parchment Sheet
sheet_mesh = bpy.data.meshes.new('ParchmentSheet')
bm = bmesh.new()

seg_y = 16
seg_x = 10
width = 1.35
length = 1.45

verts = []
for iy in range(seg_y + 1):
    ty = iy / seg_y
    row = []
    for ix in range(seg_x + 1):
        tx = ix / seg_x
        lx = (tx - 0.5) * width
        ly = (ty - 0.5) * length

        if ty > 0.75:
            curve_t = (ty - 0.75) / 0.25
            lz = 0.08 + curve_t * 0.16 + math.sin(curve_t * math.pi) * 0.08
        elif ty < 0.15:
            curve_t = (0.15 - ty) / 0.15
            lz = 0.03 + curve_t * 0.04
        else:
            lz = 0.04 + math.sin(ty * math.pi) * 0.04

        ang = math.radians(-18)
        rx = lx * math.cos(ang) - ly * math.sin(ang) - 0.05
        ry = lx * math.sin(ang) + ly * math.cos(ang) - 0.10
        v = bm.verts.new((rx, ry, lz))
        row.append(v)
    verts.append(row)

for iy in range(seg_y):
    for ix in range(seg_x):
        bm.faces.new([
            verts[iy][ix],
            verts[iy][ix + 1],
            verts[iy + 1][ix + 1],
            verts[iy + 1][ix]
        ])

bm.to_mesh(sheet_mesh)
bm.free()

sheet_obj = bpy.data.objects.new('ParchmentSheet', sheet_mesh)
scene.collection.objects.link(sheet_obj)

# Add UV Map to sheet
bm = bmesh.new()
bm.from_mesh(sheet_mesh)
uv_layer = bm.loops.layers.uv.verify()

for face in bm.faces:
    for loop in face.loops:
        v = loop.vert
        ang = math.radians(-18)
        dx = v.co.x + 0.05
        dy = v.co.y + 0.10
        lx = dx * math.cos(-ang) - dy * math.sin(-ang)
        ly = dx * math.sin(-ang) + dy * math.cos(-ang)
        u = (lx / width) + 0.5
        v_coord = (ly / length) + 0.5
        loop[uv_layer].uv = (u, v_coord)

bm.to_mesh(sheet_mesh)
bm.free()

mod_sol = sheet_obj.modifiers.new('Solidify', 'SOLIDIFY')
mod_sol.thickness = 0.012

# 5c. Binding Ribbon & Wax Seal on the cylinder roll
bpy.ops.mesh.primitive_cylinder_add(
    vertices=20, radius=0.215, depth=0.12,
    location=(-0.1, 0.45, 0.22),
    rotation=(0, math.pi / 2.0, math.radians(-18))
)
ribbon = bpy.context.active_object
ribbon.name = 'BindingRibbon'

# Wax seal medallion resting on ribbon
bpy.ops.mesh.primitive_cylinder_add(
    vertices=20, radius=0.16, depth=0.05,
    location=(-0.08, 0.26, 0.29),
    rotation=(math.radians(45), 0, math.radians(-18))
)
seal = bpy.context.active_object
seal.name = 'WaxSeal'

# 6. Materials
# Wood material for rod
mat_wood = bpy.data.materials.new('RodWood')
mat_wood.use_nodes = True
nodes = mat_wood.node_tree.nodes
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.22, 0.13, 0.07, 1) # dark walnut
bsdf.inputs['Roughness'].default_value = 0.4
rod_core.data.materials.append(mat_wood)
for side in [-1, 1]:
    bpy.data.objects[f'RodKnob_{side}'].data.materials.append(mat_wood)

# Ribbon material
mat_ribbon = bpy.data.materials.new('RibbonMat')
mat_ribbon.use_nodes = True
bsdf_ribbon = mat_ribbon.node_tree.nodes.get('Principled BSDF')
bsdf_ribbon.inputs['Base Color'].default_value = (0.45, 0.12, 0.16, 1) # dark crimson velvet
bsdf_ribbon.inputs['Roughness'].default_value = 0.5
ribbon.data.materials.append(mat_ribbon)

# Wax seal material
mat_seal = bpy.data.materials.new('SealMat')
mat_seal.use_nodes = True
bsdf_seal = mat_seal.node_tree.nodes.get('Principled BSDF')
bsdf_seal.inputs['Roughness'].default_value = 0.28
seal.data.materials.append(mat_seal)

# Parchment Material with Separate Diffuse and Emission Texture Nodes
mat_parchment = bpy.data.materials.new('ParchmentMat')
mat_parchment.use_nodes = True
p_nodes = mat_parchment.node_tree.nodes
p_links = mat_parchment.node_tree.links
p_nodes.clear()

node_output = p_nodes.new('ShaderNodeOutputMaterial')
node_bsdf = p_nodes.new('ShaderNodeBsdfPrincipled')
node_tex_diffuse = p_nodes.new('ShaderNodeTexImage')
node_tex_emission = p_nodes.new('ShaderNodeTexImage')
node_uv = p_nodes.new('ShaderNodeTexCoord')
node_emission = p_nodes.new('ShaderNodeEmission')
node_mix = p_nodes.new('ShaderNodeAddShader')

node_bsdf.inputs['Roughness'].default_value = 0.75
node_bsdf.inputs['Subsurface Weight'].default_value = 0.15
node_bsdf.inputs['Subsurface Radius'].default_value = (0.08, 0.05, 0.03)

p_links.new(node_uv.outputs['UV'], node_tex_diffuse.inputs['Vector'])
p_links.new(node_uv.outputs['UV'], node_tex_emission.inputs['Vector'])

p_links.new(node_tex_diffuse.outputs['Color'], node_bsdf.inputs['Base Color'])
p_links.new(node_tex_emission.outputs['Color'], node_emission.inputs['Color'])
node_emission.inputs['Strength'].default_value = 3.2

p_links.new(node_bsdf.outputs['BSDF'], node_mix.inputs[0])
p_links.new(node_emission.outputs['Emission'], node_mix.inputs[1])
p_links.new(node_mix.outputs['Shader'], node_output.inputs['Surface'])

sheet_obj.data.materials.append(mat_parchment)
scroll_roll.data.materials.append(mat_parchment)


# 7. Render each elemental scroll
ELEMENT_SEAL_COLORS = {
    'fire': (0.92, 0.25, 0.05, 1),
    'frost': (0.08, 0.52, 0.92, 1),
    'lightning': (0.95, 0.72, 0.06, 1),
    'vampirism': (0.68, 0.04, 0.12, 1),
    'dark': (0.42, 0.08, 0.65, 1),
}

for elem, seal_color in ELEMENT_SEAL_COLORS.items():
    diff_path = TEXTURES / f'{elem}-parchment.png'
    em_path = TEXTURES / f'{elem}-emission.png'
    if not diff_path.exists():
        print(f"Skipping {elem}, texture not found: {diff_path}")
        continue

    # Load diffuse and emission textures
    img_diff = bpy.data.images.load(str(diff_path), check_existing=True)
    img_diff.reload()
    node_tex_diffuse.image = img_diff

    img_em = bpy.data.images.load(str(em_path), check_existing=True)
    img_em.reload()
    node_tex_emission.image = img_em

    # Update seal color
    bsdf_seal.inputs['Base Color'].default_value = seal_color

    render_path = OUT / f'{elem}.png'
    scene.render.filepath = str(render_path)
    print(f"Rendering {elem} to {render_path}...", flush=True)
    bpy.ops.render.render(write_still=True)
    print(f"Completed {elem}.", flush=True)

print("ALL_SCROLLS_RENDERED_SUCCESSFULLY", flush=True)

