"""Close-up renders of the repaired joints, using the editable source."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

ART=Path(__file__).resolve().parents[2]/'art'/'hamlet'
OUT=ART/'review'/'polish'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ART/'brumaluz-hamlet.blend'))
scene=bpy.context.scene
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=1280
scene.render.resolution_y=960
scene.render.resolution_percentage=100
camera=scene.camera
bpy.data.objects['Gallery floor (not exported)'].location.z=-.001
WANTED=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
assets=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))['assets']
for obj in bpy.data.collections['_Presentation_only'].objects:
    if obj.type=='FONT':
        obj.hide_render=True


def render(name,asset,direction,prefixes=None):
    if WANTED and name not in WANTED:
        return
    for entry in assets:
        bpy.data.collections[entry['name']].hide_render=entry['name']!=asset
    collection=bpy.data.collections[asset]
    objects=[o for o in collection.objects if o.type=='MESH' and (not prefixes or o.name.startswith(tuple(prefixes)))]
    assert objects,asset
    bpy.context.view_layer.update()
    world=[obj.matrix_world@Vector(corner) for obj in objects for corner in obj.bound_box]
    low=Vector([min(p[a] for p in world) for a in range(3)])
    high=Vector([max(p[a] for p in world) for a in range(3)])
    target=(low+high)/2
    camera.location=target+Vector(direction)*3
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    inverse=camera.matrix_world.inverted()
    points=[inverse@p for p in world]
    left,right=min(p.x for p in points),max(p.x for p in points)
    bottom,top=min(p.y for p in points),max(p.y for p in points)
    camera.location+=camera.rotation_euler.to_quaternion()@Vector(((left+right)/2,(bottom+top)/2,0))
    camera.data.ortho_scale=max(right-left,(top-bottom)*4/3)*1.17
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)


render('bed-four-posts','bed_linen_quilt',(3,-4,2.6))
render('bed-side-joints','bed_linen_quilt',(4,-2,1.3))
render('window-closed-frame','house_willow_cottage',(.7,-4,1),['willow_front_window_-1-'])
render('window-side-frame','house_lantern_townhouse',(4,-.8,1),['townhouse_side_upper_1-'])
render('shop-brackets','building_herbalist_shop',(1,-4,1),['herbalist_entry-','herbalist_leaf_sign-','herbalist_lantern-'])
render('well-rope-and-masonry','well_courtyard',(3,-4,2.8))
render('fence-back-joints','fence_oak_panel',(2,4,1.7))
print('HAMLET_JOINERY_REVIEW_COMPLETE',flush=True)
