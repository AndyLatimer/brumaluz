"""Orquestador de modelado y exportación de las Cumbres de Cobre (Pueblo Lagto') en Blender.

Construye 50 recursos originales organizados en colecciones editables,
genera el atlas texturizado pintado, exporta cada GLB individual de una sola malla,
crea la galería de presentación y guarda art/lagto/brumaluz-lagto.blend y manifest.json.
"""
import sys
import json
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lagto_common as common
from lagto_common import init, build_presentation_gallery, ASSETS, ART, OUT

import lagto_buildings as buildings
import lagto_furniture as furniture
import lagto_decor as decor


def main():
    print('Iniciando generador de arte de las Cumbres de Cobre (Pueblo Lagto\')...', flush=True)
    init()

    # 1. Edificios (12 modelos)
    print('\n[1/3] Construyendo edificios...', flush=True)
    buildings.build_house_copper_bastion()
    buildings.build_forge_cobre_foundry()
    buildings.build_tower_drake_watch()
    buildings.build_cavern_terrace_shelter()
    buildings.build_shrine_scale_ancestor()
    buildings.build_hall_stone_council()
    buildings.build_gatehouse_copper_rampart()
    buildings.build_mine_shaft_headframe()
    buildings.build_bridge_copper_arch()
    buildings.build_granary_silo_stone()
    buildings.build_barracks_drake_guard()
    buildings.build_market_stall_ore_smith()

    # 2. Mobiliario (18 modelos)
    print('\n[2/3] Construyendo mobiliario...', flush=True)
    furniture.build_throne_basalt_copper()
    furniture.build_table_stone_refectory()
    furniture.build_bench_quarry_slab()
    furniture.build_chair_high_carved()
    furniture.build_bed_cavern_hearth()
    furniture.build_cabinet_vaulted_copper()
    furniture.build_chest_ore_strongbox()
    furniture.build_shelf_mason_tools()
    furniture.build_desk_cartographer_copper()
    furniture.build_anvil_master_forge()
    furniture.build_hearth_brazier_hewn()
    furniture.build_rug_lizard_weave()
    furniture.build_weapon_rack_stone_copper()
    furniture.build_bunk_bed_miner()
    furniture.build_low_table_cushions()
    furniture.build_bookcase_tablet_vault()
    furniture.build_washing_basin_copper()
    furniture.build_cauldron_hearth_tripod()

    # 3. Atrezo y Decoración (20 modelos)
    print('\n[3/3] Construyendo atrezo y minería...', flush=True)
    decor.build_brazier_cobre_tripod()
    decor.build_lamp_copper_pendant()
    decor.build_cart_mine_ore()
    decor.build_mine_track_segment()
    decor.build_ore_pile_copper()
    decor.build_bellows_forge_pedestal()
    decor.build_banner_lagto_clan()
    decor.build_barrier_spiked_stone()
    decor.build_gate_quarry_post()
    decor.build_crucible_molten_copper()
    decor.build_quarry_crane_derrick()
    decor.build_water_cistern_copper()
    decor.build_mine_cart_turnout()
    decor.build_crusher_ore_stamp()
    decor.build_ingot_stack_copper()
    decor.build_ventilation_windlass_shaft()
    decor.build_warning_beacon_totem()
    decor.build_cavern_crystal_geode()
    decor.build_water_flume_sluice()
    decor.build_tent_miner_outpost()

    print('\nGenerando galería de presentación en Blender...', flush=True)
    build_presentation_gallery()

    manifest = dict(
        version=2,
        pack='brumaluz-lagto',
        title='Cumbres de Cobre · Pueblo Lagto\'',
        author='Brumaluz',
        description='Arquitectura de sillar, cantería y cobre martillado para las Cumbres de Cobre del pueblo Lagto\': bastiones, fundiciones, atalayas, templos y mobiliario reforzado. Escala métrica, +Y arriba y +Z frente en GLB.',
        units='meters',
        up_axis_blender='Z',
        up_axis_glb='Y',
        front_axis_blender='-Y',
        front_axis_glb='+Z',
        count=len(ASSETS),
        atlas='textures/lagto-atlas.png',
        blend='brumaluz-lagto.blend',
        assets=ASSETS,
    )
    (ART / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    blend_path = ART / 'brumaluz-lagto.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f'\nProyecto Blender guardado en {blend_path}', flush=True)
    print(f'BUILD_LAGTO_COMPLETED: {len(ASSETS)} modelos listos.\n', flush=True)


if __name__ == '__main__':
    main()

