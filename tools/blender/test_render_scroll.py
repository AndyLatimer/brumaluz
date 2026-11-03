import bpy
import math
from mathutils import Vector

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.film_transparent = True

# World background
world = bpy.data.worlds.new('ScrollWorld')
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs[0].default_value = (0.05, 0.04, 0.03, 1)
bg.inputs[1].default_value = 0.5
scene.world = world

# Camera (Orthographic 3/4 isometric)
cam_data = bpy.data.cameras.new('Camera')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.4
cam = bpy.data.objects.new('Camera', cam_data)
# 3/4 isometric angle
cam.location = (2.2, -2.6, 2.2)
cam.rotation_euler = (math.radians(58), 0, math.radians(40))
scene.collection.objects.link(cam)
scene.camera = cam

# Lights
sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = 4.5
sun_data.color = (1.0, 0.96, 0.90)
sun_data.angle = math.radians(6)
sun = bpy.data.objects.new('Sun', sun_data)
sun.rotation_euler = (math.radians(50), math.radians(-15), math.radians(25))
scene.collection.objects.link(sun)

fill_data = bpy.data.lights.new('Fill', 'SUN')
fill_data.energy = 1.2
fill_data.color = (0.75, 0.85, 1.0)
fill = bpy.data.objects.new('Fill', fill_data)
fill.rotation_euler = (math.radians(65), math.radians(30), math.radians(-130))
scene.collection.objects.link(fill)

# Test render output
scene.render.filepath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/test_blender_check.png'
bpy.ops.render.render(write_still=True)
print("SUCCESS: Blender Cycles render completed.")

