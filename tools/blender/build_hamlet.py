"""Build editable .blend, individual GLBs, atlas and review sheets."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hamlet_common as h
import hamlet_furniture
import hamlet_decor
import hamlet_buildings
from hamlet_common import *


def presentation():
    global camera
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.world.color=(.35,.35,.35)
    world=scene.world
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.82,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.7
    gallery=bpy.data.collections.new('_Presentation_only')
    scene.collection.children.link(gallery)
    floor_mat=bpy.data.materials.new('Gallery warm parchment')
    floor_mat.diffuse_color=(.40,.44,.37,1)
    floor_mat.use_nodes=True
    floor_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.40,.44,.37,1)
    floor_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.001))
    floor=bpy.context.object
    floor.name='Gallery floor (not exported)'
    floor.data.materials.append(floor_mat)
    for c in list(floor.users_collection): c.objects.unlink(floor)
    gallery.objects.link(floor)
    data=bpy.data.lights.new('Warm softbox','AREA')
    data.energy=3200
    data.shape='DISK'
    data.size=12
    light=bpy.data.objects.new('Warm softbox',data)
    gallery.objects.link(light)
    light.location=(-8,-12,20)
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
    sun_data=bpy.data.lights.new('Late afternoon','SUN')
    sun_data.energy=2
    sun_data.angle=.18
    sun=bpy.data.objects.new('Late afternoon',sun_data)
    gallery.objects.link(sun)
    sun.rotation_euler=(math.radians(25),math.radians(-22),math.radians(-30))
    data=bpy.data.cameras.new('Gallery camera')
    camera=bpy.data.objects.new('Gallery camera',data)
    gallery.objects.link(camera)
    data.type='ORTHO'
    scene.camera=camera
    labels_mat=bpy.data.materials.new('Gallery label ink')
    labels_mat.diffuse_color=(.10,.16,.15,1)
    labels_mat.use_nodes=True
    labels_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.10,.16,.15,1)
    def text(name,loc,size):
        data=bpy.data.curves.new(name,'FONT')
        data.body=name
        data.size=size
        data.extrude=0
        obj=bpy.data.objects.new(name,data)
        gallery.objects.link(obj)
        obj.location=loc
        obj.data.materials.append(labels_mat)
        return obj
    groups=[('Edificios',8,3,(0,16)),('Mobiliario',3.3,4,(0,4)),('Decoración',3.5,4,(15,4))]
    for category,spacing,cols,origin in groups:
        assets=[a for a in h.ASSETS if a['category']==category]
        for i,a in enumerate(assets):
            x=origin[0]+(i%cols)*spacing
            y=origin[1]+(i//cols)*spacing
            collection=bpy.data.collections[a['name']]
            collection.instance_offset=(x,y,0)
            collection.asset_mark()
            collection.asset_data.description=a['label']+' · Brumaluz · '+a['category']+' · escala métrica'
            for tag in ['Brumaluz','Rusty Hearts',a['category'],'Barrio artesanal']:
                collection.asset_data.tags.new(tag)
            for obj in collection.objects:
                obj.location.x+=x
                obj.location.y+=y
            a['galleryPosition']=[x,y,0]
            label=text(a['label'],(x-spacing*.43,y-spacing*.42,.012),.23 if category=='Edificios' else .17)
            label['galleryCategory']=category
    text('RUSTY HEARTS / BARRIO ARTESANAL',(-3,-5,.012),.74)
    text('30 piezas originales · madera, caliza y terracota',(-3,-6,.012),.34)
    text('Edificios',(-3,28,.012),.52)
    text('Mobiliario',(-1.5,12.5,.012),.42)
    text('Decoracion urbana',(13.5,16,.012),.42)
    # The .blend opens in material preview, with the gallery framed.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.region_3d.view_distance=37
                area.spaces.active.region_3d.view_location=(10,10,1)
    # Save before rendering, so a cancelled render never loses editable source.
    camera.location=(40,-49,49)
    camera.rotation_euler=(Vector((10,11,1))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=43
    if '--skip-render' in sys.argv:
        bpy.ops.wm.save_as_mainfile(filepath=str(ART/'brumaluz-hamlet.blend'))
    else:
        from render_hamlet import render_gallery
        render_gallery()


h.init()
hamlet_buildings.build_all()
hamlet_furniture.build_all()
hamlet_decor.build_all()
manifest=dict(version=1,revision=2,targetProject='Rusty Hearts',title='Brumaluz · Barrio artesanal',author='Brumaluz',description='Original Blender-native medieval city kit for Rusty Hearts. Continuous window frames, fitted roofs and connected fittings. Metres, +Y up and +Z front in GLB.',assets=h.ASSETS)
(ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
presentation()
print('HAMLET_COMPLETE '+str(len(h.ASSETS)),flush=True)
