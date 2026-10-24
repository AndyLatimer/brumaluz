"""Frame every piece completely in the Blender review sheets.

Can rerender an edited source without rebuilding any GLB:
  node tools/build-hamlet.mjs --render-only
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ART = Path(__file__).resolve().parents[2] / 'art' / 'hamlet'


def render_gallery():
    assets=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))['assets']
    scene=bpy.context.scene
    camera=scene.camera
    gallery=bpy.data.collections['_Presentation_only']
    bpy.data.objects['Gallery floor (not exported)'].location.z=-.001
    ink=bpy.data.materials.get('Gallery label ink')
    if ink:
        ink.use_nodes=True
        ink.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.10,.16,.15,1)
        ink.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1

    def frame(name,target,position,scale,resolution,category=None):
        objects=[]
        for asset in assets:
            collection=bpy.data.collections[asset['name']]
            collection.hide_render=category is not None and asset['category']!=category
            if not collection.hide_render:
                objects.extend(collection.objects)
        for obj in gallery.objects:
            if 'galleryCategory' in obj:
                obj.hide_render=category is not None and obj['galleryCategory']!=category
                if not obj.hide_render:
                    objects.append(obj)
            elif obj.type=='FONT':
                obj.hide_render=category is not None
        camera.location=position
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=scale
        bpy.context.view_layer.update()
        if category:
            # Fit geometry and labels in camera space, including the side away
            # from the camera. A sphere/width heuristic clips wide grids.
            inverse=camera.matrix_world.inverted()
            points=[inverse @ (obj.matrix_world @ Vector(corner)) for obj in objects for corner in obj.bound_box]
            left,right=min(p.x for p in points),max(p.x for p in points)
            bottom,top=min(p.y for p in points),max(p.y for p in points)
            camera.location+=camera.rotation_euler.to_quaternion() @ Vector(((left+right)/2,(bottom+top)/2,0))
            aspect=resolution[0]/resolution[1]
            camera.data.ortho_scale=max(right-left,(top-bottom)*aspect)*1.14
        scene.render.resolution_x,scene.render.resolution_y=resolution
        scene.render.resolution_percentage=100
        scene.render.filepath=str(ART/name)
        bpy.ops.render.render(write_still=True)

    # Preserve the fully visible, editable gallery before rendering subsets.
    for asset in assets:
        bpy.data.collections[asset['name']].hide_render=False
    for obj in gallery.objects:
        obj.hide_render=False
    camera.location=(40,-49,49)
    camera.rotation_euler=(Vector((10,11,1))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=43
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'brumaluz-hamlet.blend'))
    frame('contact-sheet.png',(10,11,1),(40,-49,49),43,(2400,1900))
    frame('buildings.png',(8,20,2.1),(28,-13,26),27,(2200,1600),'Edificios')
    frame('furniture.png',(4.7,7.2,.45),(14,-9,16),18,(2000,1500),'Mobiliario')
    frame('decoration.png',(20,7.5,.5),(29,-8,16),18,(2000,1500),'Decoración')
    print('HAMLET_REVIEW_COMPLETE',flush=True)


if __name__=='__main__':
    bpy.ops.wm.open_mainfile(filepath=str(ART/'brumaluz-hamlet.blend'))
    render_gallery()
