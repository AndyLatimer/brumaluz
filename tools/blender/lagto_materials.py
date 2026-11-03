"""Prepared CC0 image atlases, with per-region roughness, metalness and normal detail."""
import bpy

def create_material(directory):
    material=bpy.data.materials.new('Brumaluz_Lagto_Painted')
    material.use_nodes=True
    nodes=material.node_tree.nodes
    links=material.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    def texture(filename,name,noncolor=False):
        image=bpy.data.images.load(str(directory/filename),check_existing=True)
        image.name=name
        if noncolor:image.colorspace_settings.name='Non-Color'
        image.pack()
        node=nodes.new('ShaderNodeTexImage');node.image=image;node.interpolation='Linear';node.extension='EXTEND'
        return node
    color=texture('lagto-atlas.png','Brumaluz_Lagto_Painted_Atlas')
    orm=texture('lagto-orm.png','Lagto_Roughness_Metalness',True)
    normal=texture('lagto-normal.png','Lagto_Surface_Normal',True)
    emissive=texture('lagto-emissive.png','Lagto_Emissive_Atlas')
    separate=nodes.new('ShaderNodeSeparateColor');separate.mode='RGB'
    links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
    links.new(orm.outputs['Color'],separate.inputs['Color'])
    links.new(separate.outputs['Green'],bsdf.inputs['Roughness'])
    links.new(separate.outputs['Blue'],bsdf.inputs['Metallic'])
    bump=nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.45
    links.new(normal.outputs['Color'],bump.inputs['Color']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    links.new(emissive.outputs['Color'],bsdf.inputs['Emission Color']);bsdf.inputs['Emission Strength'].default_value=.65
    return material,color.image
