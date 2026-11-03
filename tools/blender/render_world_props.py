"""Render Cycles contact sheet and category close-ups for the 18 Pompelín world-map props."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art' / 'world-props'

bpy.ops.wm.open_mainfile(filepath=str(ART / 'pompelin-world-props.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = False

world = bpy.data.worlds.new('PompelinWorldPropsPreview')
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs[0].default_value = (.87, .82, .72, 1)
bg.inputs[1].default_value = .95
scene.world = world

sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = 3.2
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new('Sun', sun_data)
sun.rotation_euler = (math.radians(52), math.radians(-16), math.radians(32))
scene.collection.objects.link(sun)

fill_data = bpy.data.lights.new('Fill', 'SUN')
fill_data.energy = 1.0
fill_data.color = (.88, .93, 1.0)
fill = bpy.data.objects.new('Fill', fill_data)
fill.rotation_euler = (math.radians(62), math.radians(24), math.radians(-142))
scene.collection.objects.link(fill)

cam_data = bpy.data.cameras.new('Camera')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('Camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

stage = bpy.data.collections.new('RenderStage')
scene.collection.children.link(stage)


def clear_stage():
    for obj in list(stage.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def place_asset(name, x, y):
    col = bpy.data.collections.get(name)
    for src in col.objects:
        if src.type != 'MESH':
            continue
        dup = src.copy()
        dup.data = src.data.copy()
        dup.location = src.location + Vector((x, y, 0))
        stage.objects.link(dup)


def look_at(camera, location, target, scale):
    camera.location = location
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale


for col in bpy.data.collections:
    if col.name != 'RenderStage':
        col.hide_render = True


def render_sheet(filename, items, cols, spacing_x, spacing_y, cam_loc, cam_target, ortho_scale, res_x=2200, res_y=1450):
    clear_stage()
    rows = math.ceil(len(items) / cols)
    for idx, name in enumerate(items):
        col_i = idx % cols
        row_i = idx // cols
        gx = (col_i - (cols - 1) / 2) * spacing_x
        gy = ((rows - 1) / 2 - row_i) * spacing_y
        place_asset(name, gx, gy)

    look_at(cam, cam_loc, cam_target, ortho_scale)
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.filepath = str(ART / filename)
    bpy.ops.render.render(write_still=True)
    print(f'RENDERED {filename}', flush=True)


caminos_items = [
    'milestone_carved', 'signpost_wayfarer', 'wayside_shrine',
    'ancient_ruin_arch', 'stone_footbridge', 'boundary_obelisk',
]
campamentos_items = [
    'campfire_cooking_tripod', 'traveler_tent', 'roadside_bench_shelter',
    'expedition_supply_cache', 'wayside_water_well', 'scout_watchtower',
]
oficio_items = [
    'merchant_wagon', 'wooden_handcart', 'hay_drying_rack',
    'river_jetty_dock', 'beehive_apiary_stand', 'field_irrigation_wheel',
]
all_items = caminos_items + campamentos_items + oficio_items

render_sheet(
    'contact-sheet.png',
    all_items,
    cols=6,
    spacing_x=4.8,
    spacing_y=7.2,
    cam_loc=(3.8, -24.0, 15.5),
    cam_target=(0, 0.2, 1.05),
    ortho_scale=30.2,
    res_x=2600,
    res_y=1760,
)

render_sheet(
    'category-caminos.png',
    caminos_items,
    cols=3,
    spacing_x=4.6,
    spacing_y=7.2,
    cam_loc=(2.4, -16.5, 10.5),
    cam_target=(0, 0.2, 1.15),
    ortho_scale=15.8,
    res_x=2100,
    res_y=1480,
)

render_sheet(
    'category-campamentos.png',
    campamentos_items,
    cols=3,
    spacing_x=4.6,
    spacing_y=7.2,
    cam_loc=(2.5, -16.8, 10.6),
    cam_target=(0, 0.2, 1.15),
    ortho_scale=16.2,
    res_x=2100,
    res_y=1480,
)

render_sheet(
    'category-oficio-transporte.png',
    oficio_items,
    cols=3,
    spacing_x=4.6,
    spacing_y=6.8,
    cam_loc=(2.8, -16.8, 10.4),
    cam_target=(0, 0.1, 1.05),
    ortho_scale=16.0,
    res_x=2100,
    res_y=1460,
)
