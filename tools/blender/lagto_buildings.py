"""Edificios de las Cumbres de Cobre (Pueblo Lagto') para Blender.

12 modelos arquitectónicos monumentales de sillar, cantería y cobre martillado:
1. house_copper_bastion: Bastión de Sillar y Cobre
2. forge_cobre_foundry: Gran Fundición de las Cumbres
3. tower_drake_watch: Torreón Vigía de Roca
4. cavern_terrace_shelter: Refugio de Risco y Caverna
5. shrine_scale_ancestor: Santuario de los Ancestros de Roca
6. hall_stone_council: Cámara del Consejo de las Cumbres
7. gatehouse_copper_rampart: Puerta Fortificada de las Cumbres
8. mine_shaft_headframe: Bocamina y Castañete de Extracción
9. bridge_copper_arch: Puente de Cantería y Cobre
10. granary_silo_stone: Silo y Granero de Roca
11. barracks_drake_guard: Cuartel de la Guardia de Escama
12. market_stall_ore_smith: Puesto de Comercio Minero y Cobre
"""
import math
from lagto_common import (
    start_asset, finish_asset, box, cyl, sphere, beam, lathe, torus, ring,
    riveted_strap, arch_frame, copper_standing_seam_roof, cyclopean_wall_course,
    copper_brazier, copper_lantern_pendant, saurian_war_shield
)


# ==============================================================================
# 1. BASTIÓN DE SILLAR Y COBRE (Vivienda fortificada Lagto')
# ==============================================================================
def build_house_copper_bastion():
    start_asset(
        'house_copper_bastion',
        'Bastión de Sillar y Cobre',
        'Edificios',
        'Vivienda fortificada de las Cumbres con muros de sillar escalonado, alero de cobre martillado y aspilleras enrejadas.'
    )

    # 1. Stepped foundation podium in dark basalt
    box('foundation-tier1', (0, 0, 0.16), (4.9, 5.5, 0.32), 'stone_dark', bevel=0.04)
    box('foundation-tier2', (0, 0, 0.38), (4.65, 5.25, 0.22), 'stone_mid', bevel=0.03)

    # Wide entrance steps in front (-Y)
    for i in range(4):
        sz = 0.09 * (4 - i)
        box(f'front-stair-{i}', (0, -2.72 - i * 0.28, sz), (2.6, 0.32, 0.20), 'stone_light', bevel=0.02)
        # Stone step curbs
        for sx in [-1.35, 1.35]:
            box(f'stair-curb-{sx}-{i}', (sx, -2.72 - i * 0.28, sz + 0.08), (0.16, 0.32, 0.24), 'stone_dark', bevel=0.015)

    # 2. Ground floor main cyclopean walls
    box('ground-core', (0, 0, 1.8), (4.1, 4.7, 2.66), 'stone_mid', bevel=0.03)

    # Articulated stone wall courses
    for z_c, cz in enumerate([0.7, 1.3, 1.9, 2.5]):
        cyclopean_wall_course(f'gwall-f-{z_c}', 0, -2.36, cz, 4.15, 0.12, 0.54, blocks=5, mat_main='stone_mid', mat_alt='stone_dark')
        cyclopean_wall_course(f'gwall-b-{z_c}', 0, 2.36, cz, 4.15, 0.12, 0.54, blocks=5, mat_main='stone_mid', mat_alt='stone_dark')
        cyclopean_wall_course(f'gwall-l-{z_c}', -2.06, 0, cz, 0.12, 4.75, 0.54, blocks=5, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'gwall-r-{z_c}', 2.06, 0, cz, 0.12, 4.75, 0.54, blocks=5, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')

    # Rusticated quoins on all 4 corners
    for sx in [-2.06, 2.06]:
        for sy in [-2.36, 2.36]:
            for z_tier in range(6):
                sz = 0.65 + z_tier * 0.44
                box(f'corner-quoin-{sx}-{sy}-{z_tier}', (sx, sy, sz), (0.44, 0.44, 0.36), 'stone_dark', bevel=0.03)

    # 3. Molded stone belt cornice separating floors
    box('belt-cornice-lower', (0, 0, 3.08), (4.32, 4.92, 0.16), 'stone_mid', bevel=0.02)
    box('belt-cornice-main', (0, 0, 3.22), (4.45, 5.05, 0.14), 'stone_light', bevel=0.025)
    box('belt-copper-bead', (0, 0, 3.31), (4.48, 5.08, 0.04), 'copper_bright')

    # 4. Upper floor recessed masonry
    box('upper-core', (0, 0.05, 4.3), (3.8, 4.3, 2.04), 'stone_light', bevel=0.03)
    for z_c, cz in enumerate([3.7, 4.4, 5.0]):
        cyclopean_wall_course(f'uwall-f-{z_c}', 0, -2.11, cz, 3.82, 0.10, 0.62, blocks=4, mat_main='stone_light', mat_alt='stone_mid')
        cyclopean_wall_course(f'uwall-b-{z_c}', 0, 2.21, cz, 3.82, 0.10, 0.62, blocks=4, mat_main='stone_light', mat_alt='stone_mid')

    # 5. Cantilevered timber brackets with copper shoes supporting the roof
    for sx in [-1.7, -0.85, 0.0, 0.85, 1.7]:
        for sy in [-2.15, 2.25]:
            dir_y = 1 if sy > 0 else -1
            beam(f'roof-bracket-main-{sx}-{sy}', (sx, sy, 5.1), (sx, sy + dir_y * 0.45, 5.45), 0.16, 'wood_dark')
            beam(f'roof-bracket-strut-{sx}-{sy}', (sx, sy - dir_y * 0.1, 4.8), (sx, sy + dir_y * 0.4, 5.35), 0.12, 'wood_mid')
            box(f'bracket-shoe-{sx}-{sy}', (sx, sy + dir_y * 0.42, 5.42), (0.2, 0.16, 0.08), 'copper')

    # 6. Hammered copper standing-seam roof
    copper_standing_seam_roof('bastion-roof', 0, 0.05, 5.42, 4.6, 5.2, 1.45, mat='copper_patina', seams=8)

    # 7. Entrance doorway (front facade -Y)
    box('door-threshold', (0, -2.42, 0.52), (1.8, 0.36, 0.12), 'stone_dark', bevel=0.02)
    # Door jambs
    for sx in [-0.78, 0.78]:
        box(f'door-jamb-{sx}', (sx, -2.42, 1.55), (0.34, 0.32, 1.94), 'stone_dark', bevel=0.025)
        box(f'door-jamb-plinth-{sx}', (sx, -2.42, 0.65), (0.38, 0.36, 0.22), 'stone_mid', bevel=0.02)
        box(f'door-jamb-cap-{sx}', (sx, -2.42, 2.45), (0.38, 0.36, 0.12), 'stone_light', bevel=0.02)

    # Radiating voussoir arch frame
    arch_frame('door-arch', 0, -2.42, 2.45, 1.25, 0.65, depth=0.34, mat='stone_light', voussoirs=7, keystone_mat='copper')

    # Double heavy paneled cedar doors recessed into reveal
    for idx, dx in enumerate([-0.31, 0.31]):
        box(f'door-leaf-{idx}', (dx, -2.32, 1.5), (0.58, 0.09, 1.84), 'wood_dark', bevel=0.015)
        # Carved door panel relief
        box(f'door-panel-top-{idx}', (dx, -2.37, 1.95), (0.44, 0.03, 0.68), 'wood_mid', bevel=0.01)
        box(f'door-panel-bot-{idx}', (dx, -2.37, 1.05), (0.44, 0.03, 0.68), 'wood_mid', bevel=0.01)
        # Hinges
        for hz in [0.75, 1.45, 2.15]:
            hinge_x = dx + (0.18 if dx > 0 else -0.18)
            riveted_strap(f'door-hinge-{idx}-{hz}', hinge_x, -2.38, hz, 0.36, 0.09, 0.015, 'copper', rivets=3, plane='XZ')
        # Pull ring
        torus(f'door-pull-ring-{idx}', (dx + (-0.15 if dx > 0 else 0.15), -2.40, 1.4), 0.065, 0.015, 'bronze')

    # 8. Windows with copper grilles & stone sills
    # Front upper window
    box('win-front-sill', (0, -2.18, 3.85), (1.1, 0.24, 0.16), 'stone_light', bevel=0.02)
    box('win-front-lintel', (0, -2.18, 4.95), (1.1, 0.24, 0.18), 'stone_light', bevel=0.02)
    arch_frame('win-front-arch', 0, -2.18, 4.75, 0.72, 0.38, depth=0.22, mat='stone_mid', voussoirs=5, keystone_mat='copper')
    box('win-front-recess', (0, -2.12, 4.35), (0.78, 0.12, 0.88), 'stone_dark')
    for gy in [4.05, 4.35, 4.65]:
        beam(f'win-grille-h-{gy}', (-0.38, -2.16, gy), (0.38, -2.16, gy), 0.035, 'copper_bright')
    for gx in [-0.24, 0.0, 0.24]:
        beam(f'win-grille-v-{gx}', (gx, -2.16, 3.92), (gx, -2.16, 4.78), 0.035, 'copper_bright')

    # Side loophole slits with abocinated stone frames
    for sz in [1.9, 4.3]:
        base_sx = 2.08 if sz == 1.9 else 1.92
        for sx in [-base_sx, base_sx]:
            box(f'slit-frame-t-{sx:.2f}-{sz}', (sx, 0.3, sz + 0.5), (0.18, 0.65, 0.12), 'stone_light', bevel=0.015)
            box(f'slit-frame-b-{sx:.2f}-{sz}', (sx, 0.3, sz - 0.5), (0.18, 0.65, 0.12), 'stone_light', bevel=0.015)
            box(f'slit-frame-l-{sx:.2f}-{sz}', (sx, 0.0, sz), (0.18, 0.14, 0.92), 'stone_dark', bevel=0.015)
            box(f'slit-frame-r-{sx:.2f}-{sz}', (sx, 0.6, sz), (0.18, 0.14, 0.92), 'stone_dark', bevel=0.015)
            box(f'slit-void-{sx:.2f}-{sz}', (sx * 0.98, 0.3, sz), (0.10, 0.44, 0.82), 'stone_dark')
            beam(f'slit-bar-{sx:.2f}-{sz}', (sx, 0.3, sz - 0.44), (sx, 0.3, sz + 0.44), 0.035, 'copper')

    # 9. Heavy masonry chimney on side (+X)
    box('chimney-plinth', (1.95, 1.2, 0.35), (1.1, 1.1, 0.7), 'stone_dark', bevel=0.03)
    box('chimney-shaft-1', (1.95, 1.2, 2.2), (0.95, 0.95, 3.0), 'stone_mid', bevel=0.03)
    box('chimney-corbel-course', (1.95, 1.2, 3.8), (1.05, 1.05, 0.2), 'stone_light', bevel=0.025)
    box('chimney-shaft-2', (1.95, 1.2, 5.0), (0.85, 0.85, 2.2), 'stone_mid', bevel=0.03)
    box('chimney-cap', (1.95, 1.2, 6.2), (1.05, 1.05, 0.2), 'stone_light', bevel=0.02)
    cyl('chimney-cowl', (1.95, 1.2, 6.6), 0.42, 0.55, 'copper_bright', vertices=8, radius_top=0.1)
    torus('chimney-cowl-ring', (1.95, 1.2, 6.35), 0.44, 0.03, 'copper_dark')

    # 10. Wall-mounted forged iron lantern crane & lantern
    beam('lantern-crane-arm', (0.85, -2.42, 2.5), (1.15, -2.65, 2.5), 0.045, 'iron_dark')
    beam('lantern-crane-strut', (0.85, -2.42, 2.25), (1.15, -2.65, 2.5), 0.04, 'iron_dark')
    box('lantern-wall-plate', (0.84, -2.42, 2.38), (0.08, 0.16, 0.4), 'iron_dark', bevel=0.01)
    copper_lantern_pendant('entrance-lantern', 1.15, -2.65, 1.85, scale=0.95)

    finish_asset()


# ==============================================================================
# 2. GRAN FUNDICIÓN DE LAS CUMBRES (Smelting & Foundry Workshop)
# ==============================================================================
def build_forge_cobre_foundry():
    start_asset(
        'forge_cobre_foundry',
        'Gran Fundición de las Cumbres',
        'Edificios',
        'Taller de fundición monumental con hornos gemelos de cobre, chimenea de tiraje, depósito de mineral y solera de colada.'
    )

    # Foundation & heavy workshop flagstone platform
    box('foundry-base-tier1', (0, 0.2, 0.15), (6.8, 6.4, 0.3), 'stone_dark', bevel=0.04)
    box('foundry-base-tier2', (0, 0.2, 0.35), (6.5, 6.1, 0.2), 'stone_mid', bevel=0.03)

    # Perimeter ashlar walls with exposed timber post-and-beam frame
    box('wall-back', (0, 2.9, 2.2), (6.1, 0.55, 3.5), 'stone_mid', bevel=0.04)
    for z_c, cz in enumerate([0.9, 1.7, 2.5, 3.3]):
        cyclopean_wall_course(f'foundry-bwall-{z_c}', 0, 2.9, cz, 6.0, 0.58, 0.72, blocks=5, mat_main='stone_mid', mat_alt='stone_dark')

    box('wall-left', (-3.05, 0.5, 2.1), (0.55, 4.4, 3.3), 'stone_mid', bevel=0.04)
    box('wall-right', (3.05, 0.5, 2.1), (0.55, 4.4, 3.3), 'stone_mid', bevel=0.04)
    for z_c, cz in enumerate([1.0, 2.0, 3.0]):
        cyclopean_wall_course(f'foundry-lwall-{z_c}', -3.05, 0.5, cz, 0.58, 4.3, 0.88, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'foundry-rwall-{z_c}', 3.05, 0.5, cz, 0.58, 4.3, 0.88, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')

    # Front monumental portal columns
    for sx in [-3.05, -1.1, 1.1, 3.05]:
        box(f'front-col-plinth-{sx}', (sx, -1.85, 0.65), (0.68, 0.68, 0.42), 'stone_dark', bevel=0.03)
        box(f'front-col-shaft-{sx}', (sx, -1.85, 2.0), (0.54, 0.54, 2.3), 'stone_mid', bevel=0.025)
        riveted_strap(f'front-col-band1-{sx}', sx, -1.85, 1.5, 0.58, 0.12, 0.02, 'copper', rivets=4, axis='X', plane='XZ')
        riveted_strap(f'front-col-band2-{sx}', sx, -1.85, 2.7, 0.58, 0.12, 0.02, 'copper', rivets=4, axis='X', plane='XZ')
        box(f'front-col-cap-{sx}', (sx, -1.85, 3.3), (0.66, 0.66, 0.28), 'stone_light', bevel=0.025)

    # Heavy timber architrave spanning front columns
    beam('front-main-architrave', (-3.25, -1.85, 3.52), (3.25, -1.85, 3.52), 0.32, 'wood_dark', depth=0.34)

    # King-post heavy timber trusses supporting gabled roof
    for sy in [-1.85, 0.5, 2.9]:
        beam(f'truss-tie-{sy}', (-3.05, sy, 3.65), (3.05, sy, 3.65), 0.24, 'wood_dark')
        beam(f'truss-rafter-l-{sy}', (-3.1, sy, 3.65), (0, sy, 5.25), 0.22, 'wood_dark')
        beam(f'truss-rafter-r-{sy}', (3.1, sy, 3.65), (0, sy, 5.25), 0.22, 'wood_dark')
        beam(f'truss-king-{sy}', (0, sy, 3.65), (0, sy, 5.25), 0.20, 'wood_dark')
        beam(f'truss-strut-l-{sy}', (-1.5, sy, 4.4), (0, sy, 3.8), 0.16, 'wood_mid')
        beam(f'truss-strut-r-{sy}', (1.5, sy, 4.4), (0, sy, 3.8), 0.16, 'wood_mid')

    # Standing-seam copper roof decks with ventilation gap
    copper_standing_seam_roof('foundry-roof', 0, 0.5, 3.65, 6.8, 5.2, 1.6, mat='copper_patina', seams=9)

    # Dual smelting blast furnaces
    box('furnace-hearth-hewn', (0, 2.1, 0.85), (3.4, 1.4, 0.9), 'stone_dark', bevel=0.04)
    for idx, fx in enumerate([-0.95, 0.95]):
        # Furnace plinth
        box(f'furnace-sub-base-{idx}', (fx, 2.1, 1.25), (1.35, 1.35, 0.3), 'stone_mid', bevel=0.02)
        # Tapered furnace body in copper
        cyl(f'blast-furnace-body-{idx}', (fx, 2.1, 2.15), 0.65, 1.5, 'copper', vertices=16, radius_top=0.48)
        # Forged bronze reinforcing hoops with rivets
        for hz in [1.65, 2.2, 2.75]:
            torus(f'furnace-hoop-{idx}-{hz}', (fx, 2.1, hz), 0.63 - (hz - 1.65) * 0.12, 0.04, 'bronze')
        # Transitional flared collar
        torus(f'furnace-collar-{idx}', (fx, 2.1, 2.95), 0.48, 0.045, 'bronze')
        # Copper stack
        cyl(f'blast-furnace-stack-{idx}', (fx, 2.1, 3.75), 0.38, 1.5, 'copper_dark', vertices=14, radius_top=0.30)
        # Molten taphole with glowing stream
        box(f'taphole-arch-{idx}', (fx, 1.42, 0.75), (0.44, 0.25, 0.45), 'stone_dark', bevel=0.02)
        cyl(f'taphole-stream-{idx}', (fx, 1.35, 0.68), 0.12, 0.28, 'ember_red', vertices=8)
        sphere(f'taphole-glow-{idx}', (fx, 1.35, 0.68), (0.18, 0.18, 0.14), 'amber_glow')

    # Transverse exhaust flue duct connecting both furnaces
    cyl('exhaust-manifold', (0, 2.1, 4.3), 0.24, 2.2, 'iron_dark', vertices=10, rotation=(0, math.pi / 2.0, 0))
    # Stone central chimney rising above roof
    box('foundry-stone-chimney', (0, 2.65, 5.2), (1.35, 1.35, 3.6), 'stone_mid', bevel=0.04)
    box('foundry-chimney-cornice', (0, 2.65, 6.95), (1.5, 1.5, 0.22), 'stone_light', bevel=0.03)
    cyl('chimney-copper-cowl', (0, 2.65, 7.22), 0.62, 0.55, 'copper_bright', vertices=10, radius_top=0.72)

    # Casting trench & ingot molds
    box('casting-trench-curb-l', (-0.52, 0.2, 0.44), (0.16, 2.4, 0.18), 'stone_light', bevel=0.02)
    box('casting-trench-curb-r', (0.52, 0.2, 0.44), (0.16, 2.4, 0.18), 'stone_light', bevel=0.02)
    box('casting-sand-bed', (0, 0.2, 0.38), (0.84, 2.38, 0.08), 'ash')

    for i in range(6):
        iy = -0.7 + i * 0.38
        box(f'ingot-mold-box-{i}', (0, iy, 0.46), (0.48, 0.26, 0.12), 'iron_dark', bevel=0.01)
        m_mat = 'ember_red' if i < 2 else ('copper' if i < 4 else 'copper_bright')
        box(f'ingot-fill-{i}', (0, iy, 0.50), (0.38, 0.18, 0.07), m_mat, bevel=0.008)
        if i < 2:
            sphere(f'ingot-glow-{i}', (0, iy, 0.52), (0.12, 0.08, 0.04), 'amber_glow')

    # Ore bunker with raw copper ore and crystal druses
    box('ore-bin-front', (-2.3, 0.6, 0.8), (0.16, 2.4, 0.85), 'wood_dark', bevel=0.02)
    box('ore-bin-divider', (-2.75, 0.6, 0.8), (0.85, 0.16, 0.85), 'wood_dark', bevel=0.02)
    box('ore-bin-back', (-3.05, 0.6, 0.8), (0.16, 2.4, 0.85), 'wood_dark', bevel=0.02)
    for i in range(8):
        ox = -2.7 + (i % 2) * 0.38
        oy = -0.3 + (i // 2) * 0.55
        sphere(f'ore-boulder-{i}', (ox, oy, 0.72), (0.24, 0.26, 0.22), 'stone_copper', subdivisions=1)
        sphere(f'ore-vein-{i}', (ox + 0.04, oy, 0.84), (0.14, 0.14, 0.10), 'crystal_ore', subdivisions=1)

    # Blacksmith props: anvil on stump and quenching tub
    cyl('foundry-stump', (2.3, -0.2, 0.55), 0.38, 0.45, 'wood_dark', vertices=12)
    box('foundry-anvil-body', (2.3, -0.2, 0.9), (0.45, 0.24, 0.26), 'iron_dark', bevel=0.015)
    box('foundry-anvil-face', (2.3, -0.2, 1.05), (0.52, 0.26, 0.08), 'iron_light', bevel=0.01)
    cyl('foundry-tub', (2.3, 1.2, 0.58), 0.32, 0.45, 'wood_mid', vertices=12)
    torus('foundry-tub-band', (2.3, 1.2, 0.65), 0.325, 0.02, 'copper')
    cyl('foundry-tub-water', (2.3, 1.2, 0.74), 0.29, 0.04, 'water', vertices=10)

    finish_asset()


# ==============================================================================
# 3. TORREÓN VIGÍA DE ROCA (Octagonal Megalithic Watchtower)
# ==============================================================================
def build_tower_drake_watch():
    start_asset(
        'tower_drake_watch',
        'Torreón Vigía de Roca',
        'Edificios',
        'Atalaya de sillería octogonal con aspilleras reforzadas, matacanes de cobre martillado y pebetero cenital de señales.'
    )

    # 1. Stepped octagonal talus foundation
    cyl('tower-foundation-tier1', (0, 0, 0.2), 2.85, 0.4, 'stone_dark', vertices=8, rotation=(0, 0, math.pi / 8.0))
    cyl('tower-foundation-tier2', (0, 0, 0.55), 2.65, 0.35, 'stone_mid', vertices=8, rotation=(0, 0, math.pi / 8.0))

    # Stepped stone approach stairs
    for i in range(5):
        box(f'tower-step-{i}', (0, -2.48 - i * 0.26, 0.1 * (5 - i)), (1.6, 0.30, 0.22), 'stone_light', bevel=0.02)

    # 2. Lower octagonal shaft with slight battering
    cyl('tower-shaft-lower', (0, 0, 2.4), 2.25, 3.5, 'stone_mid', vertices=8, radius_top=2.05, rotation=(0, 0, math.pi / 8.0))

    # Molded stone belt course with copper frieze
    cyl('tower-belt-course', (0, 0, 4.2), 2.15, 0.24, 'stone_light', vertices=8, rotation=(0, 0, math.pi / 8.0))
    for i in range(8):
        ang = i * math.tau / 8.0 + math.pi / 8.0
        bx = math.cos(ang) * 2.16
        by = math.sin(ang) * 2.16
        riveted_strap(f'tower-belt-strap-{i}', bx, by, 4.2, 0.75, 0.14, 0.02, 'copper_bright', rivets=4, axis='X')

    # 3. Upper octagonal shaft
    cyl('tower-shaft-upper', (0, 0, 5.85), 2.02, 3.1, 'stone_light', vertices=8, radius_top=1.92, rotation=(0, 0, math.pi / 8.0))

    # 4. Overhanging machicolated fighting gallery on triple stone corbels
    for i in range(8):
        ang = i * math.tau / 8.0 + math.pi / 8.0
        cx = math.cos(ang) * 1.95
        cy = math.sin(ang) * 1.95
        # Stepped 3-tier corbel block
        box(f'corbel-tier1-{i}', (cx, cy, 7.15), (0.42, 0.42, 0.22), 'stone_dark', bevel=0.02, rotation=(0, 0, ang))
        box(f'corbel-tier2-{i}', (cx * 1.08, cy * 1.08, 7.35), (0.46, 0.46, 0.22), 'stone_mid', bevel=0.02, rotation=(0, 0, ang))
        box(f'corbel-tier3-{i}', (cx * 1.16, cy * 1.16, 7.55), (0.50, 0.50, 0.22), 'stone_light', bevel=0.02, rotation=(0, 0, ang))
        riveted_strap(f'corbel-copper-strap-{i}', cx * 1.18, cy * 1.18, 7.56, 0.48, 0.12, 0.02, 'copper', rivets=3)

    # Parapet floor platform
    cyl('parapet-floor', (0, 0, 7.7), 2.55, 0.24, 'stone_dark', vertices=8, rotation=(0, 0, math.pi / 8.0))
    parapet_top = 7.82

    # 8 crenellated merlons with chamfered copper coping and arrow loops
    for i in range(8):
        ang = i * math.tau / 8.0 + math.pi / 8.0
        mx = math.cos(ang) * 2.42
        my = math.sin(ang) * 2.42
        box(f'merlon-wall-{i}', (mx, my, 8.35), (1.2, 0.26, 1.08), 'stone_mid', bevel=0.02, rotation=(0, 0, ang + math.pi / 2.0))
        box(f'merlon-copper-coping-{i}', (mx, my, 8.94), (1.26, 0.32, 0.12), 'copper', bevel=0.015, rotation=(0, 0, ang + math.pi / 2.0))
        box(f'merlon-slit-{i}', (mx, my, 8.35), (0.14, 0.34, 0.52), 'stone_dark', rotation=(0, 0, ang + math.pi / 2.0))

    # Central signal beacon with hammered copper brazier
    cyl('signal-dais', (0, 0, 8.05), 0.85, 0.46, 'stone_dark', vertices=8)
    cyl('signal-pedestal', (0, 0, 8.45), 0.65, 0.38, 'stone_light', vertices=8)
    copper_brazier('signal-beacon-brazier', 0, 0, 8.64, radius=0.68, height=0.48, mat='copper_patina')

    # Beacon canopy templete
    canopy_h = 2.65
    for i in range(4):
        ang = i * math.tau / 4.0 + math.pi / 4.0
        px = math.cos(ang) * 1.05
        py = math.sin(ang) * 1.05
        box(f'canopy-shoe-{i}', (px, py, parapet_top + 0.1), (0.24, 0.24, 0.2), 'copper', bevel=0.015)
        cyl(f'canopy-post-{i}', (px, py, parapet_top + canopy_h / 2.0), 0.08, canopy_h, 'iron_dark', vertices=10)
        # Architrave ring connecting posts
        nxt_ang = ((i + 1) % 4) * math.tau / 4.0 + math.pi / 4.0
        nx = math.cos(nxt_ang) * 1.05
        ny = math.sin(nxt_ang) * 1.05
        beam(f'canopy-lintel-{i}', (px, py, parapet_top + canopy_h), (nx, ny, parapet_top + canopy_h), 0.09, 'iron_dark')

    cyl('signal-roof-pyramid', (0, 0, parapet_top + canopy_h + 0.35), 1.35, 0.7, 'copper_bright', vertices=4, radius_top=0.12, rotation=(0, 0, math.pi / 4.0))
    cyl('signal-spire', (0, 0, parapet_top + canopy_h + 0.85), 0.06, 0.45, 'bronze', vertices=8, radius_top=0.01)
    sphere('signal-orb', (0, 0, parapet_top + canopy_h + 1.1), (0.1, 0.1, 0.1), 'gold_inlay')

    # Tower entrance door
    box('tower-door-frame', (0, -2.18, 1.45), (1.3, 0.28, 2.1), 'stone_dark', bevel=0.03)
    arch_frame('tower-door-arch', 0, -2.18, 2.3, 0.9, 0.45, depth=0.3, mat='stone_light', voussoirs=5, keystone_mat='copper')
    box('tower-door-leaf', (0, -2.10, 1.35), (0.88, 0.09, 1.76), 'wood_dark', bevel=0.015)
    riveted_strap('tower-door-strap-1', 0, -2.16, 1.85, 0.84, 0.11, 0.016, 'copper', rivets=4, plane='XZ')
    riveted_strap('tower-door-strap-2', 0, -2.16, 0.95, 0.84, 0.11, 0.016, 'copper', rivets=4, plane='XZ')

    # Windows and arrow loops on mid and upper levels
    for level, lz in [(1, 3.4), (2, 5.6)]:
        for ang in [math.pi / 2.0, -math.pi / 2.0, 0.0]:
            wx = math.cos(ang) * 1.98
            wy = math.sin(ang) * 1.98
            box(f'tower-slit-frame-{level}-{ang:.2f}', (wx, wy, lz), (0.28, 0.28, 0.88), 'stone_light', bevel=0.02, rotation=(0, 0, ang))
            box(f'tower-slit-void-{level}-{ang:.2f}', (wx * 0.98, wy * 0.98, lz), (0.14, 0.14, 0.74), 'stone_dark', rotation=(0, 0, ang))
            beam(f'tower-slit-grille-{level}-{ang:.2f}', (wx, wy, lz - 0.35), (wx, wy, lz + 0.35), 0.03, 'copper', depth=0.03)

    finish_asset()


# ==============================================================================
# 4. REFUGIO DE RISCO Y CAVERNA (Cavern Terrace Shelter)
# ==============================================================================
def build_cavern_terrace_shelter():
    start_asset(
        'cavern_terrace_shelter',
        'Refugio de Risco y Caverna',
        'Edificios',
        'Refugio integrado en la roca viva con arriostramientos de cedro, marquesina de cobre, portón reforzado y terraza superior.'
    )

    # Rock base platform
    box('rock-base-plate', (0, 0.1, 0.25), (5.5, 4.8, 0.5), 'stone_dark', bevel=0.06)
    box('rock-floor-slab', (0, 0.1, 0.52), (5.2, 4.5, 0.12), 'stone_mid', bevel=0.03)

    # Cavern cliff walls
    box('cavern-wall-back', (0, 1.6, 2.2), (4.9, 1.2, 3.4), 'stone_dark', bevel=0.06)
    box('cavern-wall-left', (-2.1, 0.1, 2.1), (1.1, 2.8, 3.2), 'stone_mid', bevel=0.05)
    box('cavern-wall-right', (2.1, 0.1, 2.1), (1.1, 2.8, 3.2), 'stone_mid', bevel=0.05)

    # Exposed rock strata courses
    for z_c, cz in enumerate([0.9, 1.7, 2.5, 3.2]):
        cyclopean_wall_course(f'cavern-strata-l-{z_c}', -2.1, 0.1, cz, 1.15, 2.7, 0.72, blocks=3, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'cavern-strata-r-{z_c}', 2.1, 0.1, cz, 1.15, 2.7, 0.72, blocks=3, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')

    # Cedar timber posts with copper boots and diagonal knee braces
    for sx in [-1.55, 1.55]:
        box(f'timber-post-{sx}', (sx, -1.35, 2.05), (0.28, 0.28, 3.1), 'wood_dark', bevel=0.02)
        box(f'post-shoe-{sx}', (sx, -1.35, 0.72), (0.36, 0.36, 0.38), 'copper', bevel=0.02)
        beam(f'knee-brace-f-{sx}', (sx, -1.35, 2.8), (sx * 0.45, -1.35, 3.45), 0.18, 'wood_mid')
        beam(f'knee-brace-s-{sx}', (sx, -1.35, 2.8), (sx, -0.6, 3.45), 0.18, 'wood_mid')

    # Transverse heavy lintel beam
    beam('main-front-beam', (-1.7, -1.35, 3.5), (1.7, -1.35, 3.5), 0.28, 'wood_dark', depth=0.28)

    # Standing seam copper awning canopy
    box('awning-deck', (0, -1.75, 3.55), (3.6, 1.25, 0.12), 'wood_dark', bevel=0.02, rotation=(0.28, 0, 0))
    box('awning-copper-sheet', (0, -1.75, 3.63), (3.65, 1.28, 0.05), 'copper', bevel=0.015, rotation=(0.28, 0, 0))
    box('awning-copper-trim', (0, -2.3, 3.42), (3.7, 0.14, 0.14), 'copper_bright', bevel=0.02)
    for sx in [-1.4, -0.7, 0.0, 0.7, 1.4]:
        beam(f'awning-seam-{sx}', (sx, -1.2, 3.75), (sx, -2.25, 3.45), 0.06, 'copper_bright')
        beam(f'awning-bracket-{sx}', (sx, -1.15, 3.4), (sx, -2.15, 3.25), 0.10, 'wood_dark')

    # Continuous stone portal arch connecting jambs and keystone cleanly
    box('arch-frame-l', (-1.05, -1.25, 1.7), (0.3, 0.3, 2.2), 'stone_dark', bevel=0.025)
    box('arch-frame-r', (1.05, -1.25, 1.7), (0.3, 0.3, 2.2), 'stone_dark', bevel=0.025)
    arch_frame('cavern-arch', 0, -1.25, 2.65, 1.8, 0.75, depth=0.34, mat='stone_light', voussoirs=7, keystone_mat='copper')

    # Double heavy door leaves resting on threshold
    box('door-threshold', (0, -1.22, 0.56), (1.85, 0.32, 0.1), 'stone_dark', bevel=0.015)
    for idx, dx in enumerate([-0.45, 0.45]):
        box(f'door-leaf-{idx}', (dx, -1.18, 1.62), (0.86, 0.09, 2.06), 'wood_dark', bevel=0.015)
        box(f'door-panel-relief-{idx}', (dx, -1.23, 1.62), (0.7, 0.03, 1.8), 'wood_mid', bevel=0.01)
        for dy in [0.95, 1.6, 2.25]:
            hinge_x = dx + (-0.25 if dx > 0 else 0.25)
            riveted_strap(f'door-hinge-{idx}-{dy}', hinge_x, -1.24, dy, 0.48, 0.1, 0.016, 'copper', rivets=4, plane='XZ')
        torus(f'door-ring-{idx}', (dx + (-0.18 if dx > 0 else 0.18), -1.26, 1.55), 0.065, 0.015, 'bronze')

    # Upper terrace with crenellated parapet
    box('terrace-floor', (0, 0.3, 3.8), (4.5, 3.1, 0.26), 'stone_light', bevel=0.03)
    box('terrace-parapet-front', (0, -1.15, 4.25), (4.4, 0.26, 0.68), 'stone_mid', bevel=0.025)
    box('terrace-parapet-left', (-2.1, 0.3, 4.25), (0.26, 2.7, 0.68), 'stone_mid', bevel=0.025)
    box('terrace-parapet-right', (2.1, 0.3, 4.25), (0.26, 2.7, 0.68), 'stone_mid', bevel=0.025)

    # Riveted copper parapet coping
    box('terrace-coping-f', (0, -1.15, 4.62), (4.46, 0.32, 0.08), 'copper', bevel=0.015)
    box('terrace-coping-l', (-2.1, 0.3, 4.62), (0.32, 2.76, 0.08), 'copper', bevel=0.015)
    box('terrace-coping-r', (2.1, 0.3, 4.62), (0.32, 2.76, 0.08), 'copper', bevel=0.015)

    # Corner braziers on pedestals
    for sx in [-2.1, 2.1]:
        box(f'terrace-corner-pedestal-{sx}', (sx, -1.15, 4.3), (0.42, 0.42, 0.78), 'stone_dark', bevel=0.02)
        box(f'terrace-corner-cap-{sx}', (sx, -1.15, 4.72), (0.46, 0.46, 0.1), 'copper_patina', bevel=0.015)
        copper_brazier(f'terrace-brazier-{sx}', sx, -1.15, 4.77, radius=0.32, height=0.28, mat='copper')

    # Stone chimney with copper hood
    box('rock-chimney-base', (1.4, 1.0, 4.4), (0.85, 0.85, 1.8), 'stone_dark', bevel=0.03)
    box('rock-chimney-cap', (1.4, 1.0, 5.35), (0.95, 0.95, 0.16), 'stone_light', bevel=0.02)
    cyl('chimney-copper-hood', (1.4, 1.0, 5.55), 0.45, 0.45, 'copper_bright', vertices=10, radius_top=0.15)

    finish_asset()


# ==============================================================================
# 5. SANTUARIO DE LOS ANCESTROS DE ROCA (Stepped Ancestor Altar)
# ==============================================================================
def build_shrine_scale_ancestor():
    start_asset(
        'shrine_scale_ancestor',
        'Santuario de los Ancestros de Roca',
        'Edificios',
        'Templo ceremonial de sillería escalonada con pilares esculpidos en escama, entablamento de cobre y pebetero sacrificial con llama eterna.'
    )

    # 3-tier stepped ceremonial pyramid
    box('terrace-tier-1', (0, 0, 0.2), (5.8, 5.8, 0.4), 'stone_dark', bevel=0.04)
    box('terrace-tier-2', (0, 0, 0.52), (4.9, 4.9, 0.32), 'stone_mid', bevel=0.035)
    box('terrace-tier-3', (0, 0, 0.8), (4.0, 4.0, 0.28), 'stone_light', bevel=0.03)
    tier3_top = 0.94

    # 4 colossal columns with carved reptilian scale bands and palmette capitals
    for sx in [-1.45, 1.45]:
        for sy in [-1.45, 1.45]:
            # Square basalt plinth
            box(f'pillar-plinth-{sx}-{sy}', (sx, sy, 1.15), (0.75, 0.75, 0.42), 'stone_dark', bevel=0.025)
            # Octagonal column shaft
            cyl(f'pillar-shaft-{sx}-{sy}', (sx, sy, 2.45), 0.32, 2.4, 'stone_mid', vertices=12, radius_top=0.28)
            # Triple hammered copper scale collars
            for bz in [1.7, 2.4, 3.1]:
                torus(f'pillar-copper-collar-{sx}-{sy}-{bz}', (sx, sy, bz), 0.33, 0.045, 'copper')
                sphere(f'pillar-scale-glyph-{sx}-{sy}-{bz}', (sx + 0.33, sy, bz), (0.05, 0.05, 0.04), 'copper_bright')
            # Flared palmette stone capital
            box(f'pillar-capital-sub-{sx}-{sy}', (sx, sy, 3.7), (0.7, 0.7, 0.16), 'stone_mid', bevel=0.02)
            box(f'pillar-capital-{sx}-{sy}', (sx, sy, 3.85), (0.82, 0.82, 0.2), 'stone_light', bevel=0.025)

    # Architrave entablature spanning all four sides
    box('architrave-front', (0, -1.45, 4.05), (3.7, 0.52, 0.3), 'stone_light', bevel=0.025)
    box('architrave-back', (0, 1.45, 4.05), (3.7, 0.52, 0.3), 'stone_light', bevel=0.025)
    box('architrave-left', (-1.45, 0, 4.05), (0.52, 3.7, 0.3), 'stone_light', bevel=0.025)
    box('architrave-right', (1.45, 0, 4.05), (0.52, 3.7, 0.3), 'stone_light', bevel=0.025)

    # Continuous hammered copper repoussé frieze with sun-and-claw symbols
    for side, fy in [('f', -1.72), ('b', 1.72)]:
        riveted_strap(f'frieze-copper-{side}', 0, fy, 4.05, 3.2, 0.22, 0.02, 'copper_bright', rivets=9, plane='XZ')
        cyl(f'frieze-sun-medallion-{side}', (0, fy + (-0.015 if side == 'f' else 0.015), 4.05), 0.2, 0.04, 'gold_inlay', vertices=12, rotation=(math.pi / 2.0, 0, 0))

    # Stepped copper pyramid roof with standing seams
    box('roof-cornice-lower', (0, 0, 4.25), (3.9, 3.9, 0.2), 'stone_light', bevel=0.025)
    box('roof-cornice-copper', (0, 0, 4.38), (4.0, 4.0, 0.1), 'copper_patina', bevel=0.02)
    cyl('roof-pyramid-cap', (0, 0, 5.0), 1.7, 1.25, 'copper', vertices=4, radius_top=0.35, rotation=(0, 0, math.pi / 4.0))

    # Hip seam ribs on roof
    for ang in [math.pi / 4.0, 3 * math.pi / 4.0, 5 * math.pi / 4.0, 7 * math.pi / 4.0]:
        rx = math.cos(ang) * 1.55
        ry = math.sin(ang) * 1.55
        beam(f'shrine-roof-seam-{ang:.2f}', (0, 0, 5.65), (rx, ry, 4.45), 0.08, 'copper_bright')

    # Totem spire and gold finial orb
    cyl('totem-spire-base', (0, 0, 5.7), 0.35, 0.15, 'copper_dark', vertices=8)
    cyl('totem-spire', (0, 0, 6.2), 0.12, 0.85, 'bronze', vertices=8, radius_top=0.02)
    sphere('totem-finial-orb', (0, 0, 6.7), (0.22, 0.22, 0.22), 'gold_inlay')

    # Central ceremonial libation altar
    box('altar-base-step', (0, 0, tier3_top + 0.12), (1.65, 1.65, 0.24), 'stone_dark', bevel=0.025)
    altar_table_z = tier3_top + 0.36
    box('altar-table-slab', (0, 0, altar_table_z), (1.35, 1.35, 0.26), 'stone_light', bevel=0.03)

    # Carved copper borders with rivets on altar
    riveted_strap('altar-border-f', 0, -0.62, altar_table_z + 0.12, 1.25, 0.12, 0.02, 'copper', rivets=5, plane='XZ')
    riveted_strap('altar-border-b', 0, 0.62, altar_table_z + 0.12, 1.25, 0.12, 0.02, 'copper', rivets=5, plane='XZ')

    # Sacred eternal flame brazier
    copper_brazier('sacred-fire-bowl', 0, 0, altar_table_z + 0.14, radius=0.55, height=0.42, mat='copper_bright')

    # Flanking incense pedestals
    for ix in [-0.85, 0.85]:
        cyl(f'incense-podium-{ix}', (ix, 0, tier3_top + 0.2), 0.18, 0.4, 'stone_dark', vertices=8)
        copper_brazier(f'incense-bowl-{ix}', ix, 0, tier3_top + 0.4, radius=0.18, height=0.16, mat='copper')

    finish_asset()


# ==============================================================================
# 6. CÁMARA DEL CONSEJO DE LAS CUMBRES (Clan Council Hall)
# ==============================================================================
def build_hall_stone_council():
    start_asset(
        'hall_stone_council',
        'Cámara del Consejo de las Cumbres',
        'Edificios',
        'Gran sala consistorial con columnata de sillar fajada en cobre, frontón escalonado y medallón del clan de los Lagto\'.'
    )

    # Civic podium with grand staircase
    box('hall-podium-tier1', (0, 0.1, 0.22), (7.2, 6.6, 0.44), 'stone_dark', bevel=0.04)
    box('hall-podium-tier2', (0, 0.0, 0.55), (6.6, 6.0, 0.26), 'stone_mid', bevel=0.03)

    # Monumental 6-step staircase flanked by balustrades
    for i in range(6):
        sz = 0.09 * (6 - i)
        box(f'hall-stair-{i}', (0, -2.95 - i * 0.28, sz), (3.4, 0.32, 0.20), 'stone_light', bevel=0.02)
    for bx in [-1.85, 1.85]:
        box(f'hall-balustrade-{bx}', (bx, -3.6, 0.5), (0.28, 1.8, 0.7), 'stone_mid', bevel=0.03)
        box(f'hall-balustrade-cap-{bx}', (bx, -3.6, 0.88), (0.34, 1.85, 0.12), 'copper', bevel=0.015)
        # Terminal pedestal with small brazier
        box(f'hall-pylon-{bx}', (bx, -4.55, 0.5), (0.42, 0.42, 1.0), 'stone_dark', bevel=0.02)
        copper_brazier(f'hall-pylon-brazier-{bx}', bx, -4.55, 0.98, radius=0.22, height=0.18, mat='copper_bright')

    # Main council chamber walls
    box('hall-main-chamber', (0, 0.45, 2.5), (5.8, 4.6, 3.8), 'stone_mid', bevel=0.04)
    for z_c, cz in enumerate([1.0, 1.9, 2.8, 3.7]):
        cyclopean_wall_course(f'hall-lwall-{z_c}', -2.85, 0.45, cz, 0.12, 4.5, 0.84, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'hall-rwall-{z_c}', 2.85, 0.45, cz, 0.12, 4.5, 0.84, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'hall-bwall-{z_c}', 0, 2.7, cz, 5.6, 0.12, 0.84, blocks=5, mat_main='stone_mid', mat_alt='stone_dark')

    # Colonnade of 4 colossal columns
    col_x_positions = [-2.1, -0.7, 0.7, 2.1]
    for idx, cx in enumerate(col_x_positions):
        box(f'col-plinth-{idx}', (cx, -2.05, 0.95), (0.68, 0.68, 0.55), 'stone_dark', bevel=0.03)
        cyl(f'col-shaft-{idx}', (cx, -2.05, 2.5), 0.28, 2.65, 'stone_light', vertices=12)
        for bz in [1.6, 2.5, 3.4]:
            torus(f'col-copper-band-{idx}-{bz:.1f}', (cx, -2.05, bz), 0.30, 0.04, 'copper')
        box(f'col-capital-{idx}', (cx, -2.05, 3.95), (0.72, 0.72, 0.28), 'stone_light', bevel=0.025)

    # Portico architrave and pediment
    box('portico-architrave', (0, -2.05, 4.2), (5.6, 0.75, 0.34), 'stone_light', bevel=0.03)
    box('pediment-cornice', (0, -2.05, 4.45), (5.4, 0.70, 0.20), 'stone_mid', bevel=0.025)
    box('pediment-copper-frieze', (0, -2.08, 4.75), (5.0, 0.68, 0.45), 'copper', bevel=0.025)

    # Great Saurian Clan Medallion in the pediment
    cyl('clan-medallion-base', (0, -2.44, 4.75), 0.52, 0.08, 'bronze', vertices=20, rotation=(math.pi / 2.0, 0, 0))
    cyl('clan-medallion-rim', (0, -2.48, 4.75), 0.46, 0.06, 'copper_bright', vertices=20, rotation=(math.pi / 2.0, 0, 0))
    # Triple claw gold glyph
    box('clan-glyph-claw-1', (0, -2.52, 4.8), (0.07, 0.04, 0.3), 'gold_inlay', rotation=(0, 0, 0.2))
    box('clan-glyph-claw-2', (-0.12, -2.52, 4.74), (0.06, 0.04, 0.26), 'gold_inlay', rotation=(0, 0, -0.25))
    box('clan-glyph-claw-3', (0.12, -2.52, 4.74), (0.06, 0.04, 0.26), 'gold_inlay', rotation=(0, 0, 0.5))

    # Recessed entrance with studded copper doors
    box('portal-jamb-l', (-1.1, -1.95, 1.9), (0.32, 0.26, 2.45), 'stone_dark', bevel=0.025)
    box('portal-jamb-r', (1.1, -1.95, 1.9), (0.32, 0.26, 2.45), 'stone_dark', bevel=0.025)
    arch_frame('portal-arch', 0, -1.95, 2.9, 1.9, 0.8, depth=0.34, mat='stone_light', voussoirs=7, keystone_mat='copper')

    box('portal-door-l', (-0.48, -1.88, 1.85), (0.86, 0.09, 2.2), 'copper_dark', bevel=0.015)
    box('portal-door-r', (0.48, -1.88, 1.85), (0.86, 0.09, 2.2), 'copper_dark', bevel=0.015)
    for dx in [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]:
        for dz in [1.0, 1.5, 2.0, 2.5]:
            cyl(f'door-stud-{dx:.2f}-{dz:.1f}', (dx, -1.93, dz), 0.03, 0.025, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))

    # Multi-tiered copper standing seam hipped roof
    box('clerestory-walls', (0, 0.55, 4.7), (4.6, 3.6, 0.85), 'stone_light', bevel=0.03)
    copper_standing_seam_roof('council-roof', 0, 0.55, 4.95, 5.4, 4.4, 1.4, mat='copper_patina', seams=7)

    finish_asset()


# ==============================================================================
# 7. PUERTA FORTIFICADA DE LAS CUMBRES (Gatehouse Rampart)
# ==============================================================================
def build_gatehouse_copper_rampart():
    start_asset(
        'gatehouse_copper_rampart',
        'Puerta Fortificada de las Cumbres',
        'Edificios',
        'Bastión de paso fortificado con torres gemelas, rastrillo de rejas de cobre, matacanes y adarve almenado.'
    )

    # Base foundation slab
    box('gate-base-slab', (0, 0, 0.25), (6.8, 4.0, 0.5), 'stone_dark', bevel=0.05)

    # Twin bastion towers flanking the central gateway
    for sx in [-2.55, 2.55]:
        # Battered tower base plinth
        box(f'gate-tower-talus-{sx}', (sx, 0, 0.8), (1.9, 3.6, 0.8), 'stone_dark', bevel=0.04)
        box(f'gate-tower-shaft-{sx}', (sx, 0, 2.5), (1.75, 3.4, 2.7), 'stone_mid', bevel=0.03)

        # Quoins and ashlar courses
        for z_c, cz in enumerate([1.5, 2.3, 3.1]):
            cyclopean_wall_course(f'tower-fwall-{sx}-{z_c}', sx, -1.68, cz, 1.72, 0.12, 0.74, blocks=2, mat_main='stone_mid', mat_alt='stone_dark')

        # Machicolations on triple corbels
        for ty in [-1.3, 0.0, 1.3]:
            box(f'machicolation-corbel-{sx}-{ty}', (sx + (-0.18 if sx > 0 else 0.18), ty, 4.05), (0.42, 0.42, 0.4), 'stone_dark', bevel=0.02)
        box(f'tower-parapet-{sx}', (sx, 0, 4.45), (1.9, 3.55, 0.75), 'stone_light', bevel=0.025)
        box(f'tower-copper-coping-{sx}', (sx, 0, 4.85), (1.98, 3.62, 0.12), 'copper', bevel=0.015)

        # Defensive loophole slits
        box(f'tower-slit-f-{sx}', (sx, -1.72, 2.6), (0.18, 0.14, 0.9), 'stone_dark')
        box(f'tower-slit-frame-{sx}', (sx, -1.74, 2.6), (0.26, 0.04, 0.98), 'copper')

    # Central vaulted gateway
    box('gate-arch-lintel-f', (0, -1.5, 3.4), (3.4, 0.5, 1.2), 'stone_light', bevel=0.03)
    box('gate-arch-lintel-b', (0, 1.5, 3.4), (3.4, 0.5, 1.2), 'stone_light', bevel=0.03)
    arch_frame('gate-arch-f', 0, -1.55, 2.2, 2.5, 1.2, depth=0.38, mat='stone_light', voussoirs=9, keystone_mat='copper')
    arch_frame('gate-arch-b', 0, 1.55, 2.2, 2.5, 1.2, depth=0.38, mat='stone_light', voussoirs=9, keystone_mat='copper')

    # Adarve walkway bridging the towers
    box('adarve-floor', (0, 0, 3.85), (3.4, 3.4, 0.3), 'stone_dark', bevel=0.03)
    # Crenellated adarve parapet front & back
    for side, py in [('f', -1.65), ('b', 1.65)]:
        box(f'adarve-parapet-{side}', (0, py, 4.3), (3.35, 0.32, 0.65), 'stone_mid', bevel=0.02)
        box(f'adarve-coping-{side}', (0, py, 4.65), (3.4, 0.36, 0.1), 'copper_patina', bevel=0.012)
        # Embrasures in the parapet
        for ex in [-0.85, 0.85]:
            box(f'adarve-embrasure-{side}-{ex}', (ex, py, 4.45), (0.42, 0.36, 0.35), 'stone_dark')

    # Heavy sliding portcullis with chisel-pointed spike tips
    for px in [-1.0, -0.5, 0.0, 0.5, 1.0]:
        cyl(f'portcullis-vert-{px}', (px, 0, 1.8), 0.04, 2.6, 'copper', vertices=10)
        cyl(f'portcullis-spike-{px}', (px, 0, 0.4), 0.04, 0.22, 'copper_bright', vertices=4, radius_top=0.005)
    for pz in [0.9, 1.7, 2.5]:
        beam(f'portcullis-horiz-{pz}', (-1.15, 0, pz), (1.15, 0, pz), 0.07, 'copper_dark')
        for px in [-1.0, -0.5, 0.0, 0.5, 1.0]:
            cyl(f'portcullis-rivet-{px}-{pz}', (px, -0.04, pz), 0.02, 0.03, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))

    # Flanking copper lanterns with solid mounting arms
    beam('gate-lantern-crane-l', (-1.55, -1.72, 2.7), (-1.7, -1.85, 2.7), 0.045, 'iron_dark')
    beam('gate-lantern-crane-r', (1.55, -1.72, 2.7), (1.7, -1.85, 2.7), 0.045, 'iron_dark')
    copper_lantern_pendant('gate-lantern-l', -1.7, -1.85, 2.15, scale=0.9)
    copper_lantern_pendant('gate-lantern-r', 1.7, -1.85, 2.15, scale=0.9)

    finish_asset()


# ==============================================================================
# 8. BOCAMINA Y CASTAÑETE DE EXTRACCIÓN (Mine Shaft Headframe)
# ==============================================================================
def build_mine_shaft_headframe():
    start_asset(
        'mine_shaft_headframe',
        'Bocamina y Castañete de Extracción',
        'Edificios',
        'Castañete de extracción minera con castillete de cedro, ruedas de polea gemelas de cobre, tolva de descarga y bocamina en sillería.'
    )

    # 1. Cyclopean brocal stone collar around the shaft void
    box('shaft-brocal-back', (0, 0.9, 0.55), (3.0, 0.55, 1.1), 'stone_dark', bevel=0.035)
    box('shaft-brocal-left', (-1.35, 0, 0.55), (0.55, 2.0, 1.1), 'stone_dark', bevel=0.035)
    box('shaft-brocal-right', (1.35, 0, 0.55), (0.55, 2.0, 1.1), 'stone_dark', bevel=0.035)
    box('shaft-brocal-front', (0, -0.9, 0.4), (3.0, 0.4, 0.8), 'stone_dark', bevel=0.035)
    box('shaft-pit-void', (0, 0, 0.15), (2.0, 1.45, 0.3), 'stone_dark')

    # Brocal molded copper coping
    box('brocal-coping-b', (0, 0.9, 1.12), (3.08, 0.62, 0.08), 'copper_patina', bevel=0.015)
    box('brocal-coping-l', (-1.35, 0, 1.12), (0.62, 2.08, 0.08), 'copper_patina', bevel=0.015)
    box('brocal-coping-r', (1.35, 0, 1.12), (0.62, 2.08, 0.08), 'copper_patina', bevel=0.015)

    # 2. A-frame heavy timber extraction derrick (4 main legs)
    for sx in [-1.05, 1.05]:
        for sy in [-0.75, 0.75]:
            beam(f'headframe-leg-{sx}-{sy}', (sx, sy, 0.6), (sx * 0.65, sy * 0.65, 4.6), 0.20, 'wood_dark')
            box(f'headframe-shoe-{sx}-{sy}', (sx, sy, 0.72), (0.30, 0.30, 0.32), 'copper', bevel=0.02)

    # Diagonal backstays anchored in massive stone footings behind the shaft
    box('backstay-footing-l', (-1.05, 2.45, 0.35), (0.55, 0.65, 0.7), 'stone_dark', bevel=0.03)
    box('backstay-footing-r', (1.05, 2.45, 0.35), (0.55, 0.65, 0.7), 'stone_dark', bevel=0.03)
    beam('backstay-strut-l', (-1.05, 2.45, 0.65), (-0.68, 0.5, 4.6), 0.22, 'wood_dark')
    beam('backstay-strut-r', (1.05, 2.45, 0.65), (0.68, 0.5, 4.6), 0.22, 'wood_dark')

    # Horizontal and X-braces tying the derrick tower
    for bz in [1.9, 3.4]:
        beam(f'derrick-cross-xf-{bz}', (-0.9, -0.58, bz), (0.9, -0.58, bz), 0.14, 'wood_mid')
        beam(f'derrick-cross-xb-{bz}', (-0.9, 0.58, bz), (0.9, 0.58, bz), 0.14, 'wood_mid')
        beam(f'derrick-cross-yl-{bz}', (-0.9, -0.58, bz), (-0.9, 0.58, bz), 0.14, 'wood_mid')
        beam(f'derrick-cross-yr-{bz}', (0.9, -0.58, bz), (0.9, 0.58, bz), 0.14, 'wood_mid')

    # X-bracing diagonals
    beam('derrick-diag-1', (-0.9, -0.58, 1.9), (0.7, -0.45, 3.4), 0.10, 'wood_mid')
    beam('derrick-diag-2', (0.9, -0.58, 1.9), (-0.7, -0.45, 3.4), 0.10, 'wood_mid')

    # 3. Top platform and bearing blocks
    box('headframe-cap-platform', (0, 0, 4.7), (1.8, 1.6, 0.22), 'wood_dark', bevel=0.02)
    box('sheave-bearing-l', (-0.52, 0, 4.98), (0.16, 0.48, 0.4), 'copper_dark', bevel=0.015)
    box('sheave-bearing-r', (0.52, 0, 4.98), (0.16, 0.48, 0.4), 'copper_dark', bevel=0.015)

    # 4. Twin 1.2m copper spoked extraction sheave wheels
    for wx in [-0.28, 0.28]:
        torus(f'sheave-rim-{wx}', (wx, 0, 5.35), 0.54, 0.045, 'copper_bright', rotation=(0, math.pi / 2.0, 0))
        cyl(f'sheave-hub-{wx}', (wx, 0, 5.35), 0.14, 0.16, 'bronze', vertices=12, rotation=(0, math.pi / 2.0, 0))
        for i in range(8):
            ang = i * math.tau / 8.0
            beam(f'sheave-spoke-{wx}-{i}', (wx, -0.48 * math.cos(ang), 5.35 - 0.48 * math.sin(ang)),
                 (wx, 0.48 * math.cos(ang), 5.35 + 0.48 * math.sin(ang)), 0.035, 'bronze')
        # Steel hoisting cables descending down into the shaft
        beam(f'sheave-cable-{wx}', (wx, 0.54, 5.35), (wx, 0.54, 0.2), 0.025, 'iron_light')

    # Ore bucket suspended over the shaft
    cyl('hoist-bucket-body', (-0.28, 0.54, 1.2), 0.26, 0.42, 'iron_dark', vertices=12)
    torus('hoist-bucket-hoop', (-0.28, 0.54, 1.35), 0.265, 0.02, 'copper')
    torus('hoist-bucket-bail', (-0.28, 0.54, 1.48), 0.24, 0.018, 'iron_light', rotation=(math.pi / 2.0, 0, 0))

    # 5. Slanted copper-lined ore hopper and discharge chute
    box('discharge-chute', (0, -1.2, 1.95), (1.2, 1.35, 0.12), 'wood_dark', bevel=0.015, rotation=(-0.48, 0, 0))
    box('chute-copper-lining', (0, -1.2, 1.99), (1.1, 1.3, 0.04), 'copper', rotation=(-0.48, 0, 0))
    box('chute-lip-l', (-0.56, -1.2, 2.05), (0.08, 1.3, 0.16), 'wood_dark', rotation=(-0.48, 0, 0))
    box('chute-lip-r', (0.56, -1.2, 2.05), (0.08, 1.3, 0.16), 'wood_dark', rotation=(-0.48, 0, 0))

    finish_asset()


# ==============================================================================
# 9. PUENTE DE CANTERÍA Y COBRE (Copper Arch Bridge)
# ==============================================================================
def build_bridge_copper_arch():
    start_asset(
        'bridge_copper_arch',
        'Puente de Cantería y Cobre',
        'Edificios',
        'Puente monumental de arco escarzano en sillería de granito, calzada empedrada, pretiles de cobre remachados y pilones con faroles.'
    )

    # 1. Abutments with cutwaters
    box('abutment-north', (0, 2.85, 0.8), (3.6, 1.4, 1.6), 'stone_dark', bevel=0.04)
    box('abutment-south', (0, -2.85, 0.8), (3.6, 1.4, 1.6), 'stone_dark', bevel=0.04)

    # 2. Segmental barrel arch with voussoirs on both lateral faces
    arch_frame('bridge-arch-face-l', -1.65, 0, 0.45, 4.4, 1.4, depth=0.36, mat='stone_light', voussoirs=11, keystone_mat='copper', axis='Y')
    arch_frame('bridge-arch-face-r', 1.65, 0, 0.45, 4.4, 1.4, depth=0.36, mat='stone_light', voussoirs=11, keystone_mat='copper', axis='Y')
    # Barrel vault soffit
    box('bridge-arch-vault', (0, 0, 1.15), (3.2, 4.2, 0.7), 'stone_mid', bevel=0.03)

    # 3. Paved deck with cambered cobblestones & stone curbs
    box('bridge-deck-slate', (0, 0, 1.68), (3.0, 6.4, 0.26), 'stone_light', bevel=0.02)
    for i in range(12):
        py = -2.8 + i * 0.51
        box(f'deck-paving-seam-{i}', (0, py, 1.82), (2.8, 0.04, 0.02), 'stone_mid')

    # 4. Parapet walls with riveted copper coping
    for sx in [-1.55, 1.55]:
        box(f'parapet-stone-{sx}', (sx, 0, 2.15), (0.32, 6.5, 0.82), 'stone_mid', bevel=0.025)
        box(f'parapet-copper-coping-{sx}', (sx, 0, 2.58), (0.38, 6.55, 0.1), 'copper', bevel=0.015)
        # Copper reinforcement straps with rivets
        for py in [-2.2, -1.1, 0.0, 1.1, 2.2]:
            riveted_strap(f'bridge-cap-strap-{sx}-{py}', sx, py, 2.62, 0.4, 0.1, 0.018, 'copper_bright', rivets=3, axis='X')

    # 5. Four corner terminal pylons with mounted octagonal copper lanterns
    for sx in [-1.68, 1.68]:
        for sy in [-3.35, 3.35]:
            box(f'pylon-base-{sx}-{sy}', (sx, sy, 1.55), (0.65, 0.65, 1.9), 'stone_dark', bevel=0.03)
            box(f'pylon-cornice-{sx}-{sy}', (sx, sy, 2.55), (0.75, 0.75, 0.16), 'stone_light', bevel=0.02)
            box(f'pylon-copper-cap-{sx}-{sy}', (sx, sy, 2.66), (0.78, 0.78, 0.08), 'copper_bright', bevel=0.015)
            # Mounting pad
            box(f'pylon-mount-{sx}-{sy}', (sx, sy, 2.72), (0.38, 0.38, 0.04), 'stone_dark', bevel=0.01)
            # Octagonal pendant lantern resting solidly
            copper_lantern_pendant(f'bridge-pylon-lantern-{sx}-{sy}', sx, sy, 2.74, scale=0.85)

    finish_asset()


# ==============================================================================
# 10. SILO Y GRANERO DE ROCA (Rock Granary Silo)
# ==============================================================================
def build_granary_silo_stone():
    start_asset(
        'granary_silo_stone',
        'Silo y Granero de Roca',
        'Edificios',
        'Depósito cilíndrico de sillar con zunchos de refuerzo de cobre, ranuras de ventilación y cubierta cónica de cobre con veleta.'
    )

    # Stepped circular ashlar foundation
    cyl('silo-foundation-tier1', (0, 0, 0.2), 2.35, 0.4, 'stone_dark', vertices=16)
    cyl('silo-foundation-tier2', (0, 0, 0.5), 2.15, 0.3, 'stone_mid', vertices=16)

    # Main cylindrical ashlar drum
    cyl('silo-main-drum', (0, 0, 2.65), 1.95, 4.1, 'stone_mid', vertices=16, radius_top=1.85)

    # 4 hammered copper zuncho bands with bronze dome rivets
    for bz in [1.2, 2.2, 3.2, 4.2]:
        torus(f'silo-copper-band-{bz:.1f}', (0, 0, bz), 1.93, 0.045, 'copper')
        for i in range(8):
            ang = i * math.tau / 8.0
            rx = math.cos(ang) * 1.96
            ry = math.sin(ang) * 1.96
            sphere(f'silo-rivet-{bz:.1f}-{i}', (rx, ry, bz), (0.03, 0.03, 0.03), 'bronze')

    # Vertical louvered ventilation slits with stone hood moldings and copper mesh
    for i in range(6):
        ang = i * math.tau / 6.0
        vx = math.cos(ang) * 1.9
        vy = math.sin(ang) * 1.9
        box(f'silo-vent-hood-{i}', (vx * 1.02, vy * 1.02, 3.65), (0.28, 0.28, 0.12), 'stone_light', bevel=0.015, rotation=(0, 0, ang))
        box(f'silo-vent-slit-{i}', (vx, vy, 3.1), (0.18, 0.18, 1.0), 'stone_dark', rotation=(0, 0, ang))
        box(f'silo-vent-mesh-{i}', (vx * 1.03, vy * 1.03, 3.1), (0.24, 0.04, 1.06), 'copper', rotation=(0, 0, ang))

    # Molded stone cornice supporting roof
    box('silo-cornice', (0, 0, 4.75), (4.1, 4.1, 0.22), 'stone_light', bevel=0.03)
    cyl('silo-cornice-ring', (0, 0, 4.88), 2.1, 0.12, 'stone_dark', vertices=16)

    # Steep verdigris conical copper roof
    cyl('silo-copper-roof', (0, 0, 6.0), 2.15, 2.3, 'copper_patina', vertices=16, radius_top=0.18)

    # Elaborate bronze weathervane spire: compass arms (N-S-E-W), pointer arrow, orb
    cyl('silo-spire-rod', (0, 0, 7.4), 0.05, 0.9, 'bronze', vertices=8)
    # N-S and E-W arms
    beam('weathervane-arm-ns', (0, -0.35, 7.35), (0, 0.35, 7.35), 0.035, 'bronze')
    beam('weathervane-arm-ew', (-0.35, 0, 7.35), (0.35, 0, 7.35), 0.035, 'bronze')
    # Pointer arrow
    beam('weathervane-arrow-shaft', (-0.45, 0.15, 7.55), (0.45, -0.15, 7.55), 0.03, 'copper_bright')
    cyl('weathervane-arrow-head', (0.5, -0.17, 7.55), 0.06, 0.14, 'copper_bright', vertices=4, radius_top=0.005, rotation=(0, math.pi / 2.0, 0.32))
    sphere('silo-spire-orb', (0, 0, 7.9), (0.15, 0.15, 0.15), 'gold_inlay')

    # Elevated discharge chute with heavy timber hopper and ladder
    box('discharge-chute-box', (0, -1.95, 1.05), (0.75, 0.55, 0.55), 'wood_dark', bevel=0.02)
    cyl('discharge-spout', (0, -2.25, 0.85), 0.16, 0.42, 'copper', vertices=10, rotation=(0.45, 0, 0))

    # Side maintenance rungs along silo
    for lz in [0.8, 1.3, 1.8, 2.3, 2.8, 3.3, 3.8, 4.3]:
        box(f'silo-rung-{lz}', (0, 1.95, lz), (0.46, 0.06, 0.045), 'copper_bright')

    finish_asset()


# ==============================================================================
# 11. CUARTEL DE LA GUARDIA DE ESCAMA (Drake Guard Barracks)
# ==============================================================================
def build_barracks_drake_guard():
    start_asset(
        'barracks_drake_guard',
        'Cuartel de la Guardia de Escama',
        'Edificios',
        'Cuartel defensivo de infantería sauria con pórtico de sillar, cubierta de cobre alistonada, escudos de armas y armeros exteriores.'
    )

    # Podium
    box('barracks-podium', (0, 0.05, 0.25), (7.2, 5.0, 0.5), 'stone_dark', bevel=0.04)

    # Main ashlar hall
    box('barracks-main-hall', (0, 0.45, 2.0), (6.5, 3.9, 3.0), 'stone_mid', bevel=0.035)
    for z_c, cz in enumerate([0.9, 1.8, 2.7]):
        cyclopean_wall_course(f'barracks-lwall-{z_c}', -3.22, 0.45, cz, 0.12, 3.85, 0.86, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'barracks-rwall-{z_c}', 3.22, 0.45, cz, 0.12, 3.85, 0.86, blocks=4, mat_main='stone_mid', mat_alt='stone_dark', axis='Y')
        cyclopean_wall_course(f'barracks-bwall-{z_c}', 0, 2.38, cz, 6.4, 0.12, 0.86, blocks=5, mat_main='stone_mid', mat_alt='stone_dark')

    # Front colonnade / porch piers
    for px in [-2.75, -0.95, 0.95, 2.75]:
        box(f'barracks-pier-{px}', (px, -1.75, 1.8), (0.48, 0.48, 2.6), 'stone_dark', bevel=0.025)
        box(f'barracks-pier-shoe-{px}', (px, -1.75, 0.72), (0.55, 0.55, 0.35), 'copper', bevel=0.02)
        box(f'barracks-pier-cap-{px}', (px, -1.75, 3.12), (0.55, 0.55, 0.15), 'stone_light', bevel=0.02)

    beam('barracks-porch-lintel', (-3.0, -1.75, 3.28), (3.0, -1.75, 3.28), 0.28, 'wood_dark', depth=0.28)

    # Gabled standing-seam copper roof
    copper_standing_seam_roof('barracks-roof', 0, 0.25, 3.45, 7.2, 4.6, 1.5, mat='copper', seams=9)

    # Entrance doorway
    box('barracks-door-frame', (0, -1.55, 1.6), (1.45, 0.26, 2.3), 'stone_dark', bevel=0.025)
    arch_frame('barracks-door-arch', 0, -1.55, 2.4, 1.1, 0.55, depth=0.3, mat='stone_light', voussoirs=5, keystone_mat='copper')
    box('barracks-door', (0, -1.48, 1.5), (1.1, 0.1, 2.05), 'wood_dark', bevel=0.015)
    riveted_strap('barracks-door-strap-1', 0, -1.54, 2.05, 1.05, 0.11, 0.016, 'copper', rivets=5, plane='XZ')
    riveted_strap('barracks-door-strap-2', 0, -1.54, 1.05, 1.05, 0.11, 0.016, 'copper', rivets=5, plane='XZ')

    # Mounted ceremonial Saurian Drake Guard shields on facade
    for sx in [-1.85, 1.85]:
        beam(f'shield-bracket-{sx}', (sx, -1.68, 2.1), (sx, -1.52, 2.1), 0.045, 'iron_dark')
        # Crossed guard spears behind shield
        beam(f'shield-spear-1-{sx}', (sx - 0.35, -1.55, 1.6), (sx + 0.35, -1.55, 2.6), 0.035, 'wood_mid')
        beam(f'shield-spear-2-{sx}', (sx + 0.35, -1.55, 1.6), (sx - 0.35, -1.55, 2.6), 0.035, 'wood_mid')
        saurian_war_shield(f'drake-shield-{sx}', sx, -1.50, 2.1, scale=1.1)

    finish_asset()


# ==============================================================================
# 12. PUESTO DE COMERCIO MINERO Y COBRE (Ore Smith Market Stall)
# ==============================================================================
def build_market_stall_ore_smith():
    start_asset(
        'market_stall_ore_smith',
        'Puesto de Comercio Minero y Cobre',
        'Edificios',
        'Puesto de tasación y venta de mineral con mostrador de granito, balanza de cobre, toldo de cuero rojo y lingotes expuestos.'
    )

    # Foundation
    box('stall-podium', (0, 0, 0.16), (3.6, 2.8, 0.32), 'stone_dark', bevel=0.03)

    # Solid dressed stone counter with polished slate countertop
    box('stall-counter-front', (0, -0.7, 0.75), (3.0, 0.65, 0.9), 'stone_mid', bevel=0.03)
    box('stall-counter-top', (0, -0.7, 1.23), (3.15, 0.78, 0.1), 'stone_light', bevel=0.02)
    # Countertop copper corner brackets
    for cx in [-1.52, 1.52]:
        box(f'counter-bracket-{cx}', (cx, -0.7, 1.24), (0.14, 0.74, 0.11), 'copper', bevel=0.01)

    # 4 cedar canopy posts with copper shoes and diagonal braces
    for sx in [-1.5, 1.5]:
        for sy in [-1.05, 1.05]:
            beam(f'canopy-post-{sx}-{sy}', (sx, sy, 0.32), (sx, sy, 2.85), 0.14, 'wood_dark')
            box(f'canopy-foot-{sx}-{sy}', (sx, sy, 0.44), (0.22, 0.22, 0.24), 'copper', bevel=0.015)
            beam(f'canopy-brace-x-{sx}-{sy}', (sx, sy, 2.3), (sx * 0.6, sy, 2.8), 0.09, 'wood_mid')
            beam(f'canopy-brace-y-{sx}-{sy}', (sx, sy, 2.3), (sx, sy * 0.4, 2.8), 0.09, 'wood_mid')

    # Perimeter canopy beams
    beam('canopy-beam-f', (-1.5, -1.05, 2.85), (1.5, -1.05, 2.85), 0.12, 'wood_mid')
    beam('canopy-beam-b', (-1.5, 1.05, 3.1), (1.5, 1.05, 3.1), 0.12, 'wood_mid')
    beam('canopy-beam-l', (-1.5, -1.05, 2.85), (-1.5, 1.05, 3.1), 0.12, 'wood_mid')
    beam('canopy-beam-r', (1.5, -1.05, 2.85), (1.5, 1.05, 3.1), 0.12, 'wood_mid')

    # Red and ochre striped mountain wool awning with deep undulating folds
    box('stall-awning-main', (0, 0, 3.0), (3.2, 2.35, 0.07), 'textile_red', bevel=0.015, rotation=(0.11, 0, 0))
    for sx in [-0.8, 0.8]:
        box(f'stall-awning-stripe-{sx}', (sx, 0, 3.03), (0.45, 2.37, 0.05), 'textile_ochre', rotation=(0.11, 0, 0))

    # Scalloped valance overhang seamlessly connected to front hem
    for i in range(7):
        vx = -1.2 + i * 0.4
        v_mat = 'textile_ochre' if i % 2 == 1 else 'textile_red'
        box(f'valance-{i}', (vx, -1.18, 2.76), (0.36, 0.04, 0.26), v_mat, bevel=0.008)

    # Merchant assay balance scale with real bronze suspension chains
    cyl('scale-pedestal-base', (-0.65, -0.7, 1.3), 0.08, 0.04, 'bronze', vertices=12)
    cyl('scale-stand', (-0.65, -0.7, 1.55), 0.03, 0.46, 'bronze', vertices=10)
    sphere('scale-pivot-ball', (-0.65, -0.7, 1.78), (0.05, 0.05, 0.05), 'gold_inlay')
    beam('scale-beam', (-1.05, -0.7, 1.78), (-0.25, -0.7, 1.78), 0.024, 'bronze')

    for px in [-1.05, -0.25]:
        cyl(f'scale-pan-{px}', (px, -0.7, 1.48), 0.13, 0.025, 'copper_bright', vertices=14)
        # 3 bronze suspension chains
        for ang in [0, math.pi * 2 / 3, math.pi * 4 / 3]:
            cx = px + math.cos(ang) * 0.11
            cy = -0.7 + math.sin(ang) * 0.11
            beam(f'scale-chain-{px}-{ang:.2f}', (px, -0.7, 1.78), (cx, cy, 1.5), 0.01, 'bronze')
        # Ore samples in pans
        sphere(f'pan-ore-{px}', (px, -0.7, 1.51), (0.06, 0.06, 0.03), 'crystal_ore', subdivisions=1)

    # Calibration weights block with graduated brass weights
    box('weights-block', (-0.45, -0.7, 1.3), (0.24, 0.14, 0.06), 'wood_dark', bevel=0.008)
    for idx, wx in enumerate([-0.52, -0.47, -0.42, -0.38]):
        wh = 0.06 - idx * 0.008
        cyl(f'cal-weight-{idx}', (wx, -0.7, 1.31 + wh / 2.0), 0.022 - idx * 0.003, wh, 'brass_bright', vertices=8)

    # Stacks of stamped copper ingots (tier of 3, 2, 1)
    for tier, count in enumerate([3, 2, 1]):
        for j in range(count):
            ix = 0.55 + j * 0.22 - (tier * 0.1)
            box(f'ingot-t{tier}-{j}', (ix, -0.7, 1.30 + tier * 0.05), (0.20, 0.13, 0.06), 'copper_bright', bevel=0.008)

    finish_asset()
