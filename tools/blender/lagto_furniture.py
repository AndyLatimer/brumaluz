"""Mobiliario de las Cumbres de Cobre (Pueblo Lagto') para Blender.

18 modelos de mobiliario reforzado de cantería, sillar, cedro y cobre martillado:
13. throne_basalt_copper: Trono de Basalto y Cobre
14. table_stone_refectory: Mesa de Cantero Reforzada
15. bench_quarry_slab: Banco Corrido de Roca y Cuero
16. chair_high_carved: Silla Alta de las Cumbres
17. bed_cavern_hearth: Cama Térmica de Piedra y Pieles
18. cabinet_vaulted_copper: Alacena Acorazada de Cobre
19. chest_ore_strongbox: Arcón Blindado de Mineral
20. shelf_mason_tools: Estantería de Cantería y Menas
21. desk_cartographer_copper: Mesa de Trazado y Mapas Mineros
22. anvil_master_forge: Gran Yunque de Fundición
23. hearth_brazier_hewn: Hogar de Suelo y Campana de Cobre
24. rug_lizard_weave: Alfombra de Lana y Cuero Lagto'
25. weapon_rack_stone_copper: Armero de Cantería y Cobre
26. bunk_bed_miner: Litera Minera de Cedro y Sillar
27. low_table_cushions: Mesa Baja con Cojines de Suelo
28. bookcase_tablet_vault: Librería de Tablillas y Cilindros
29. washing_basin_copper: Aguamanil y Palancana de Cobre
30. cauldron_hearth_tripod: Caldero de Cobre sobre Trípode
"""
import math
from lagto_common import (
    start_asset, finish_asset, mesh, box, cyl, sphere, beam, lathe, torus, ring,
    riveted_strap, copper_brazier, copper_lantern_pendant
)


def _barrel_vault_lid(name, loc, length, radius, height, mat='wood_dark', segments=12):
    """Watertight half-cylinder vaulted lid with solid timber gable ends and flat bottom mating face."""
    cx, cy, cz = loc
    half_l = length / 2.0
    verts = []
    for x in [-half_l, half_l]:
        for i in range(segments + 1):
            theta = math.pi * i / segments
            y = -radius * math.cos(theta)
            z = height * math.sin(theta)
            verts.append((x, y, z))
    n1 = segments + 1
    faces = []
    for i in range(segments):
        faces.append((i, i + 1, n1 + i + 1, n1 + i))
    faces.append(tuple(reversed(range(n1))))
    faces.append(tuple(range(n1, n1 * 2)))
    faces.append((0, n1, n1 * 2 - 1, segments))
    obj = mesh(name, verts, faces, mat)
    for p in obj.data.polygons[:segments]:
        p.use_smooth = True
    obj.location = (cx, cy, cz)
    return obj


# ==============================================================================
# 13. TRONO DE BASALTO Y COBRE (Chieftain Throne)
# ==============================================================================
def build_throne_basalt_copper():
    start_asset(
        'throne_basalt_copper',
        'Trono de Basalto y Cobre',
        'Mobiliario',
        'Asiento ceremonial tallado en roca oscura de las Cumbres con apoyabrazos de cobre martillado y respaldo con cresta de escamas.'
    )

    # 1. Stepped dais platform (2 tiers, grounded at Z=0.0)
    box('dais-tier-1', (0, 0.05, 0.08), (1.68, 1.60, 0.16), 'stone_dark', bevel=0.03)
    box('dais-tier-2', (0, 0.05, 0.22), (1.48, 1.40, 0.14), 'stone_mid', bevel=0.025)

    # 2. Carved stone seat plinth & core
    box('seat-sub-base', (0, 0.08, 0.36), (1.20, 1.12, 0.14), 'stone_dark', bevel=0.02)
    box('seat-block', (0, 0.08, 0.50), (1.08, 1.04, 0.16), 'stone_mid', bevel=0.025)

    # Seat front panel relief and medallion
    box('seat-front-relief', (0, -0.45, 0.50), (0.86, 0.04, 0.14), 'stone_light', bevel=0.015)
    sphere('seat-front-glyph', (0, -0.48, 0.50), (0.09, 0.03, 0.09), 'copper_bright')

    # 3. Armrests with dragon claw terminals gripping copper orbs
    # Pedestals positioned at sx=±0.52 with width 0.22, leaving 0.82m inner clearance
    for sx in [-0.52, 0.52]:
        box(f'armrest-pedestal-{sx}', (sx, 0.02, 0.69), (0.22, 0.94, 0.42), 'stone_dark', bevel=0.02)
        box(f'armrest-copper-cap-{sx}', (sx, 0.01, 0.91), (0.24, 0.98, 0.04), 'copper', bevel=0.012)
        sphere(f'armrest-claw-terminal-{sx}', (sx, -0.47, 0.91), (0.09, 0.10, 0.07), 'bronze')
        sphere(f'armrest-orb-{sx}', (sx, -0.52, 0.88), (0.065, 0.065, 0.065), 'copper_bright')

    # 4. Tufted leather & red wool cushion (fits snugly between armrests with zero clipping)
    box('cushion-base', (0, -0.04, 0.62), (0.78, 0.74, 0.10), 'leather_heavy', bevel=0.02)
    box('cushion-wool-insert', (0, -0.04, 0.68), (0.66, 0.62, 0.04), 'textile_red', bevel=0.015)
    for bx in [-0.18, 0.18]:
        for by in [-0.18, 0.10]:
            sphere(f'cushion-button-{bx}-{by}', (bx, by, 0.705), (0.03, 0.03, 0.015), 'bronze')

    # 5. Monumental stone backrest slab extending down to seat base (no rear void)
    box('backrest-slab', (0, 0.44, 1.20), (1.12, 0.22, 1.56), 'stone_dark', bevel=0.03)
    box('backrest-panel-frame', (0, 0.32, 1.30), (0.92, 0.04, 1.12), 'stone_mid', bevel=0.02)
    box('backrest-copper-panel', (0, 0.29, 1.30), (0.82, 0.025, 1.02), 'copper', bevel=0.015)

    # Saurian scale diamond repoussé motif in copper with distinct relief steps
    for idx, dz in enumerate([1.05, 1.30, 1.55]):
        cyl(f'back-scale-diamond-{idx}', (0, 0.27, dz), 0.16, 0.02, 'copper_bright', vertices=4, rotation=(math.pi / 2.0, 0, math.pi / 4.0))
        sphere(f'back-scale-core-{idx}', (0, 0.255, dz), (0.05, 0.02, 0.05), 'gold_inlay')

    # 6. Crest finials with bronze collars
    back_top = 1.98
    for idx, fx in enumerate([-0.36, 0.0, 0.36]):
        h = 0.32 if fx == 0 else 0.22
        box(f'crest-collar-{idx}', (fx, 0.44, back_top + 0.02), (0.18, 0.18, 0.04), 'copper', bevel=0.01)
        cyl(f'crest-finial-{idx}', (fx, 0.44, back_top + 0.04 + h / 2.0), 0.08, h, 'bronze', vertices=4, radius_top=0.015, rotation=(0, 0, math.pi / 4.0))
        sphere(f'crest-orb-{idx}', (fx, 0.44, back_top + 0.04 + h + 0.04), (0.05, 0.05, 0.05), 'gold_inlay')

    finish_asset()


# ==============================================================================
# 14. MESA DE CANTERO REFORZADA (Refectory Quarry Table)
# ==============================================================================
def build_table_stone_refectory():
    start_asset(
        'table_stone_refectory',
        'Mesa de Cantero Reforzada',
        'Mobiliario',
        'Mesa comunal de losa de pizarra pulida sobre pedestales de piedra escuadrada, traviesa de cedro y cantoneras de cobre remachadas.'
    )

    # 1. Thick polished slate tabletop
    box('tabletop-slate', (0, 0, 0.90), (2.50, 1.25, 0.14), 'stone_light', bevel=0.03)

    # 4 authentic wrap-around copper L-corner brackets (cantoneras) that hug the tabletop edges
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            # Top corner flanges
            box(f'bracket-top-x-{sx}-{sy}', (sx * 1.14, sy * 0.585, 0.976), (0.22, 0.08, 0.012), 'copper')
            box(f'bracket-top-y-{sx}-{sy}', (sx * 1.21, sy * 0.515, 0.976), (0.08, 0.22, 0.012), 'copper')
            # Side edge wrapping flanges
            box(f'bracket-side-x-{sx}-{sy}', (sx * 1.14, sy * 0.631, 0.90), (0.22, 0.012, 0.14), 'copper')
            box(f'bracket-side-y-{sx}-{sy}', (sx * 1.256, sy * 0.515, 0.90), (0.012, 0.22, 0.14), 'copper')
            # Bronze rivets on the bracket plates
            cyl(f'bracket-rivet-tx-{sx}-{sy}', (sx * 1.10, sy * 0.585, 0.985), 0.018, 0.012, 'bronze', vertices=8)
            cyl(f'bracket-rivet-ty-{sx}-{sy}', (sx * 1.21, sy * 0.475, 0.985), 0.018, 0.012, 'bronze', vertices=8)

    # 2. Carved stone trestle ends with true open mortise apertures
    for sx in [-0.8, 0.8]:
        # Molded sled foot
        box(f'trestle-sled-{sx}', (sx, 0, 0.10), (0.36, 1.10, 0.20), 'stone_dark', bevel=0.03)
        box(f'trestle-sled-toe-f-{sx}', (sx, -0.52, 0.09), (0.34, 0.16, 0.18), 'stone_mid', bevel=0.02)
        box(f'trestle-sled-toe-b-{sx}', (sx, 0.52, 0.09), (0.34, 0.16, 0.18), 'stone_mid', bevel=0.02)

        # Twin stone piers flanking the central mortise aperture
        box(f'trestle-pier-f-{sx}', (sx, -0.32, 0.48), (0.28, 0.26, 0.56), 'stone_mid', bevel=0.02)
        box(f'trestle-pier-b-{sx}', (sx, 0.32, 0.48), (0.28, 0.26, 0.56), 'stone_mid', bevel=0.02)

        # Bottom and top transom framing the mortise opening and cradling the stretcher beam
        box(f'trestle-transom-bot-{sx}', (sx, 0, 0.36), (0.28, 0.46, 0.16), 'stone_dark', bevel=0.015)
        box(f'trestle-transom-top-{sx}', (sx, 0, 0.68), (0.28, 0.46, 0.08), 'stone_dark', bevel=0.015)

        # Top arch header supporting the slate slab
        box(f'trestle-arch-top-{sx}', (sx, 0, 0.79), (0.32, 1.04, 0.14), 'stone_light', bevel=0.025)

    # 3. Cedar through-stretcher beam resting directly on the stone mortise transoms
    beam('stretcher-beam', (-1.15, 0, 0.46), (1.15, 0, 0.46), 0.18, 'wood_dark', depth=0.14)
    box('wedge-key-l', (-0.98, 0, 0.46), (0.05, 0.26, 0.28), 'wood_light', bevel=0.01)
    box('wedge-key-r', (0.98, 0, 0.46), (0.05, 0.26, 0.28), 'wood_light', bevel=0.01)

    # 4. Tableware props
    flagon_prof = [
        (0.06, 0.0),
        (0.12, 0.08),
        (0.14, 0.20),
        (0.09, 0.32),
        (0.10, 0.38),
    ]
    lathe('flagon-body', (-0.60, 0.22, 0.97), flagon_prof, 'copper_bright', segments=14)
    torus('flagon-handle', (-0.72, 0.22, 1.15), 0.08, 0.018, 'copper_dark', rotation=(math.pi / 2.0, 0, 0))
    cyl('flagon-lid', (-0.60, 0.22, 1.37), 0.105, 0.03, 'bronze', vertices=12)

    # Slate serving platter with bread loaf
    box('slate-platter', (0.35, -0.15, 0.99), (0.48, 0.34, 0.035), 'stone_dark', bevel=0.01)
    sphere('platter-bread', (0.35, -0.15, 1.04), (0.16, 0.12, 0.07), 'wood_light')

    # Flared copper tumblers (open vessels with water/wine fill)
    cup_prof = [(0.04, 0.0), (0.06, 0.04), (0.075, 0.11)]
    for idx, tx in enumerate([0.65, -0.20]):
        lathe(f'copper-cup-{idx}', (tx, 0.18, 0.97), cup_prof, 'copper', segments=12, cap_top=False)
        cyl(f'cup-liquid-{idx}', (tx, 0.18, 1.03), 0.065, 0.02, 'water', vertices=10)

    finish_asset()


# ==============================================================================
# 15. BANCO CORRIDO DE ROCA Y CUERO (Quarry Slab Bench)
# ==============================================================================
def build_bench_quarry_slab():
    start_asset(
        'bench_quarry_slab',
        'Banco Corrido de Roca y Cuero',
        'Mobiliario',
        'Banco corrido de sillar de granito con colchoneta de cuero atada por cinchas con hebillas de cobre.'
    )

    # 1. Granite bench slab
    box('bench-granite-slab', (0, 0, 0.42), (2.10, 0.58, 0.12), 'stone_mid', bevel=0.025)

    # 2. Monolithic stone pedestals with stepped moldings
    for sx in [-0.75, 0.75]:
        box(f'bench-plinth-{sx}', (sx, 0, 0.08), (0.42, 0.54, 0.16), 'stone_dark', bevel=0.02)
        box(f'bench-support-{sx}', (sx, 0, 0.23), (0.34, 0.48, 0.14), 'stone_mid', bevel=0.02)
        box(f'bench-capital-{sx}', (sx, 0, 0.33), (0.38, 0.52, 0.06), 'stone_light', bevel=0.015)

    # 3. Quilted reptile hide cushion pad with wool trim
    box('bench-leather-pad', (0, 0, 0.53), (1.98, 0.52, 0.08), 'leather_heavy', bevel=0.02)
    box('bench-wool-trim', (0, 0, 0.575), (1.85, 0.42, 0.012), 'textile_red', bevel=0.006)

    # 4. 3 wrap-around leather cinches (continuous external loop, zero solid interior collision)
    for sx in [-0.60, 0.0, 0.60]:
        box(f'bench-strap-top-{sx}', (sx, 0, 0.582), (0.08, 0.53, 0.012), 'leather_light')
        box(f'bench-strap-front-{sx}', (sx, -0.265, 0.475), (0.08, 0.012, 0.225), 'leather_light')
        box(f'bench-strap-back-{sx}', (sx, 0.265, 0.475), (0.08, 0.012, 0.225), 'leather_light')
        box(f'bench-strap-bot-{sx}', (sx, 0, 0.354), (0.08, 0.53, 0.012), 'leather_light')
        # Copper buckle on front with tongue
        box(f'bench-buckle-body-{sx}', (sx, -0.275, 0.475), (0.11, 0.02, 0.08), 'copper', bevel=0.006)
        box(f'bench-buckle-tongue-{sx}', (sx, -0.282, 0.475), (0.02, 0.01, 0.05), 'bronze')

    finish_asset()


# ==============================================================================
# 16. SILLA ALTA DE LAS CUMBRES (High Carved Chair)
# ==============================================================================
def build_chair_high_carved():
    start_asset(
        'chair_high_carved',
        'Silla Alta de las Cumbres',
        'Mobiliario',
        'Silla de cedro oscuro y respaldo alto con placa de pizarra esculpida en motivos geométricos y clavazón de cobre.'
    )

    # 1. 4 chamfered cedar legs with copper footing boots
    for sx in [-0.28, 0.28]:
        for sy in [-0.26, 0.26]:
            box(f'chair-leg-{sx}-{sy}', (sx, sy, 0.25), (0.08, 0.08, 0.50), 'wood_dark', bevel=0.01)
            box(f'chair-foot-{sx}-{sy}', (sx, sy, 0.05), (0.095, 0.095, 0.09), 'copper', bevel=0.008)

    # Box H-stretcher joinery
    beam('stretcher-l', (-0.28, -0.26, 0.16), (-0.28, 0.26, 0.16), 0.045, 'wood_mid')
    beam('stretcher-r', (0.28, -0.26, 0.16), (0.28, 0.26, 0.16), 0.045, 'wood_mid')
    beam('stretcher-m', (-0.28, 0, 0.16), (0.28, 0, 0.16), 0.045, 'wood_mid')

    # 2. Seat frame & reptile leather cushion
    box('seat-wood-frame', (0, 0, 0.50), (0.64, 0.60, 0.07), 'wood_dark', bevel=0.012)
    box('seat-cushion', (0, -0.02, 0.55), (0.54, 0.50, 0.06), 'leather_heavy', bevel=0.018)
    for bx in [-0.24, 0.24]:
        for by in [-0.22, 0.22]:
            sphere(f'chair-nail-{bx}-{by}', (bx, by, 0.54), (0.015, 0.015, 0.015), 'bronze')

    # 3. High backrest uprights rising directly from the seat frame
    for sx in [-0.26, 0.26]:
        box(f'back-upright-{sx}', (sx, 0.26, 0.95), (0.07, 0.07, 0.90), 'wood_dark', bevel=0.01)
        cyl(f'back-finial-{sx}', (sx, 0.26, 1.44), 0.045, 0.08, 'copper', vertices=4, radius_top=0.01, rotation=(0, 0, math.pi / 4.0))

    # Top crest rail and copper trim
    box('back-top-rail', (0, 0.26, 1.35), (0.58, 0.08, 0.10), 'wood_dark', bevel=0.012)
    box('back-top-copper-crest', (0, 0.26, 1.41), (0.60, 0.09, 0.03), 'copper', bevel=0.008)

    # Bottom cross-rail closing the void between splat and seat frame
    box('back-bottom-rail', (0, 0.26, 0.57), (0.52, 0.07, 0.08), 'wood_dark', bevel=0.01)

    # Carved slate splat trapped seamlessly between bottom and top rails (zero gaps)
    box('back-stone-splat', (0, 0.25, 0.955), (0.46, 0.04, 0.69), 'stone_light', bevel=0.012)
    sphere('back-glyph-body', (0, 0.22, 0.96), (0.09, 0.02, 0.14), 'copper_bright')
    cyl('back-glyph-ring', (0, 0.22, 0.96), 0.12, 0.02, 'bronze', vertices=12, rotation=(math.pi / 2.0, 0, 0))

    finish_asset()


# ==============================================================================
# 17. CAMA TÉRMICA DE PIEDRA Y PIELES (Cavern Hearth Bed)
# ==============================================================================
def build_bed_cavern_hearth():
    start_asset(
        'bed_cavern_hearth',
        'Cama Térmica de Piedra y Pieles',
        'Mobiliario',
        'Cama de sillería con base de canales térmicos para el frío de las cumbres, manta de piel de borrego y faroles de cobre.'
    )

    # 1. Thermal stone base platform
    box('bed-stone-plinth', (0, -0.05, 0.12), (2.30, 2.50, 0.24), 'stone_dark', bevel=0.03)
    box('bed-stone-frame', (0, -0.05, 0.32), (2.20, 2.40, 0.22), 'stone_mid', bevel=0.025)

    # 3 radiant flue vents with copper grilles at the foot of the bed
    for fx in [-0.68, 0.0, 0.68]:
        box(f'flue-vent-arch-{fx}', (fx, -1.26, 0.22), (0.40, 0.09, 0.24), 'stone_light', bevel=0.015)
        box(f'flue-grille-h-{fx}', (fx, -1.28, 0.22), (0.36, 0.02, 0.04), 'copper')
        box(f'flue-grille-v1-{fx}', (fx - 0.10, -1.28, 0.22), (0.03, 0.02, 0.18), 'copper')
        box(f'flue-grille-v2-{fx}', (fx + 0.10, -1.28, 0.22), (0.03, 0.02, 0.18), 'copper')
        sphere(f'flue-glow-{fx}', (fx, -1.22, 0.22), (0.10, 0.06, 0.06), 'ember_red')

    # 2. Stepped stone headboard and integrated footboard
    box('bed-headboard', (0, 1.10, 0.88), (1.92, 0.16, 0.95), 'stone_mid', bevel=0.035)
    box('headboard-copper-crest', (0, 1.10, 1.38), (2.34, 0.26, 0.08), 'copper', bevel=0.015)
    box('bed-footboard', (0, -1.21, 0.46), (2.04, 0.08, 0.18), 'stone_light', bevel=0.015)

    # 3. Layered bedding meeting headboard seamlessly (zero void)
    box('bed-mattress', (0, -0.11, 0.54), (1.96, 2.18, 0.24), 'textile_red', bevel=0.025)
    box('bed-head-bolster', (0, 0.88, 0.69), (1.92, 0.18, 0.12), 'wood_dark', bevel=0.015)
    box('bed-blanket-layer-1', (0, -0.38, 0.68), (1.98, 1.54, 0.06), 'textile_ochre', bevel=0.02)
    box('bed-fur-fold', (0, -0.85, 0.74), (2.00, 0.60, 0.08), 'leather_heavy', bevel=0.03)

    for px in [-0.55, 0.55]:
        box(f'bed-pillow-{px}', (px, 0.70, 0.74), (0.74, 0.44, 0.16), 'textile_ochre', bevel=0.025)

    # 4. Corner posts with forged copper reading lanterns
    for sx in [-1.06, 1.06]:
        box(f'bed-post-{sx}', (sx, 1.10, 0.95), (0.24, 0.24, 1.45), 'stone_dark', bevel=0.025)
        cyl(f'bed-post-cap-{sx}', (sx, 1.10, 1.70), 0.15, 0.08, 'copper', vertices=10)
        beam(f'bed-lantern-crane-{sx}', (sx, 1.10, 1.55), (sx, 0.86, 1.55), 0.035, 'copper_dark')
        copper_lantern_pendant(f'bed-lantern-{sx}', sx, 0.86, 1.15, scale=0.65)

    # 5. Symmetrical bedside stepping blocks
    for sx in [-1.18, 1.18]:
        box(f'bed-step-{sx}', (sx, -0.30, 0.14), (0.28, 0.80, 0.26), 'stone_light', bevel=0.015)
        box(f'bed-step-copper-{sx}', (sx, -0.30, 0.275), (0.30, 0.82, 0.03), 'copper', bevel=0.008)

    finish_asset()


# ==============================================================================
# 18. ALACENA ACORAZADA DE COBRE (Vaulted Copper Cabinet)
# ==============================================================================
def build_cabinet_vaulted_copper():
    start_asset(
        'cabinet_vaulted_copper',
        'Alacena Acorazada de Cobre',
        'Mobiliario',
        'Armario de cedro oscuro con puertas paneladas en chapa de cobre martillado, cerrojo pasador y herrajes forjados.'
    )

    # 1. Stepped basalt plinth
    box('cab-stone-plinth', (0, 0, 0.14), (1.46, 0.76, 0.28), 'stone_dark', bevel=0.03)

    # 2. Hollow cedar carcass (open front, solid back and side walls)
    box('cab-back-wall', (0, 0.31, 1.22), (1.16, 0.08, 1.86), 'wood_dark', bevel=0.015)
    box('cab-wall-l', (-0.63, 0, 1.22), (0.10, 0.70, 1.86), 'wood_dark', bevel=0.015)
    box('cab-wall-r', (0.63, 0, 1.22), (0.10, 0.70, 1.86), 'wood_dark', bevel=0.015)
    box('cab-floor', (0, 0, 0.32), (1.20, 0.66, 0.08), 'wood_mid', bevel=0.01)
    box('cab-roof', (0, 0, 2.12), (1.20, 0.66, 0.08), 'wood_mid', bevel=0.01)

    # Interior shelves
    for sz in [0.90, 1.50]:
        box(f'cab-inner-shelf-{sz}', (0, 0.02, sz), (1.16, 0.60, 0.06), 'wood_mid', bevel=0.01)

    # 3. Front face frame: kickboard, header rail, side jambs, and central meeting stop
    box('cab-kickboard', (0, -0.33, 0.40), (1.36, 0.06, 0.16), 'wood_dark', bevel=0.015)
    box('cab-header-rail', (0, -0.33, 2.06), (1.36, 0.06, 0.16), 'wood_dark', bevel=0.015)
    box('cab-jamb-l', (-0.63, -0.34, 1.23), (0.12, 0.06, 1.52), 'wood_dark', bevel=0.01)
    box('cab-jamb-r', (0.63, -0.34, 1.23), (0.12, 0.06, 1.52), 'wood_dark', bevel=0.01)
    box('cab-astragal-stop', (0, -0.34, 1.23), (0.04, 0.04, 1.50), 'wood_dark')

    # Molded cornice capped with riveted copper
    box('cab-cornice-wood', (0, 0, 2.18), (1.46, 0.80, 0.12), 'wood_mid', bevel=0.025)
    box('cab-cornice-copper', (0, 0, 2.26), (1.50, 0.84, 0.06), 'copper', bevel=0.015)

    # 4. Twin arched doors with hammered copper panels in repoussé relief (snug fit, zero central void)
    for idx, dx in enumerate([-0.285, 0.285]):
        box(f'door-frame-{idx}', (dx, -0.36, 1.23), (0.56, 0.05, 1.48), 'wood_mid', bevel=0.015)
        box(f'door-copper-panel-{idx}', (dx, -0.385, 1.23), (0.46, 0.025, 1.36), 'copper', bevel=0.012)
        # Diamond scale badge
        cyl(f'door-diamond-badge-{idx}', (dx, -0.402, 1.23), 0.13, 0.015, 'copper_bright', vertices=4, rotation=(math.pi / 2.0, 0, math.pi / 4.0))
        sphere(f'door-badge-core-{idx}', (dx, -0.412, 1.23), (0.04, 0.015, 0.04), 'gold_inlay')

        # 3 forged iron strap hinges extending from jamb to door
        for hz in [0.65, 1.23, 1.80]:
            hinge_x = dx + (0.18 if dx > 0 else -0.18)
            riveted_strap(f'cab-hinge-{idx}-{hz}', hinge_x, -0.40, hz, 0.32, 0.06, 0.015, 'iron_dark', rivets=3, plane='XZ')

    # Heavy forged sliding bolt latch bridging the meeting stiles
    box('cab-slide-housing', (0, -0.40, 1.23), (0.22, 0.06, 0.14), 'iron_dark', bevel=0.012)
    box('cab-slide-bolt', (0, -0.43, 1.23), (0.32, 0.035, 0.05), 'copper_bright')
    torus('cab-slide-ring', (0, -0.45, 1.23), 0.04, 0.01, 'bronze')

    finish_asset()


# ==============================================================================
# 19. ARCÓN BLINDADO DE MINERAL (Ore Strongbox Chest)
# ==============================================================================
def build_chest_ore_strongbox():
    start_asset(
        'chest_ore_strongbox',
        'Arcón Blindado de Mineral',
        'Mobiliario',
        'Arcón de madera férrea y sillar con tapa abovedada, zunchos de cobre remachados y candado macizo de fundición.'
    )

    # 1. Stepped stone corner block feet with copper shoes
    for sx in [-0.58, 0.58]:
        for sy in [-0.36, 0.36]:
            box(f'chest-foot-{sx}-{sy}', (sx, sy, 0.06), (0.18, 0.18, 0.12), 'stone_dark', bevel=0.02)
            box(f'chest-foot-shoe-{sx}-{sy}', (sx, sy, 0.13), (0.20, 0.20, 0.04), 'copper', bevel=0.008)

    # 2. Heavy ironwood chest body (top at Z=0.68)
    box('chest-body', (0, 0, 0.40), (1.26, 0.80, 0.56), 'wood_dark', bevel=0.02)
    box('chest-rim-frame', (0, 0, 0.67), (1.28, 0.82, 0.04), 'wood_dark', bevel=0.01)

    # 3. Watertight half-cylinder vaulted lid (no interior bulging or penetration)
    _barrel_vault_lid('chest-lid-vault', (0, 0, 0.68), length=1.26, radius=0.40, height=0.32, mat='wood_dark', segments=12)

    # 4. Vertical copper reinforcement straps wrapping body and vaulted lid
    for bx in [-0.48, 0.0, 0.48]:
        riveted_strap(f'chest-band-f-{bx}', bx, -0.405, 0.40, 0.54, 0.08, 0.015, 'copper', rivets=4, axis='Y', plane='XZ')
        riveted_strap(f'chest-band-b-{bx}', bx, 0.405, 0.40, 0.54, 0.08, 0.015, 'copper', rivets=4, axis='Y', plane='XZ')
        # Curved arch strap following lid profile
        _barrel_vault_lid(f'chest-lid-strap-{bx}', (bx, 0, 0.68), length=0.08, radius=0.412, height=0.33, mat='copper', segments=12)
        for i in range(5):
            ang = math.pi * (i + 1) / 6.0
            rx = bx
            ry = -0.415 * math.cos(ang)
            rz = 0.68 + 0.335 * math.sin(ang)
            sphere(f'chest-lid-rivet-{bx}-{i}', (rx, ry, rz), (0.015, 0.015, 0.015), 'bronze')

    # Horizontal copper rim bands
    riveted_strap('chest-rim-f', 0, -0.41, 0.67, 1.26, 0.06, 0.015, 'copper_bright', rivets=6, plane='XZ')
    riveted_strap('chest-rim-b', 0, 0.41, 0.67, 1.26, 0.06, 0.015, 'copper_bright', rivets=6, plane='XZ')

    # 5. Forged iron hasp and massive bronze padlock
    box('chest-hasp-plate', (0, -0.415, 0.67), (0.16, 0.05, 0.16), 'iron_dark', bevel=0.01)
    cyl('chest-padlock-body', (0, -0.445, 0.58), 0.065, 0.045, 'bronze', vertices=10)
    torus('chest-padlock-shackle', (0, -0.445, 0.64), 0.04, 0.012, 'iron_light')

    # 6. Pivoting bronze drop-handles on side mounting plates
    for sx in [-0.64, 0.64]:
        box(f'handle-plate-{sx}', (sx, 0, 0.44), (0.03, 0.16, 0.14), 'copper', bevel=0.008)
        torus(f'handle-ring-{sx}', (sx + (-0.035 if sx > 0 else 0.035), 0, 0.42), 0.06, 0.016, 'bronze', rotation=(math.pi / 2.0, 0, 0))

    finish_asset()


# ==============================================================================
# 20. ESTANTERÍA DE CANTERÍA Y MENAS (Mason & Ore Tool Shelf)
# ==============================================================================
def build_shelf_mason_tools():
    start_asset(
        'shelf_mason_tools',
        'Estantería de Cantería y Menas',
        'Mobiliario',
        'Armazón de cedro y repisas de pizarra con cajones de menas, cinceles de cantero y probetas de cobre.'
    )

    # 1. 4 cedar uprights with copper footing boots and top caps
    for sx in [-0.70, 0.70]:
        box(f'shelf-foot-{sx}', (sx, 0, 0.08), (0.14, 0.62, 0.16), 'copper', bevel=0.012)
        box(f'shelf-upright-f-{sx}', (sx, -0.24, 1.12), (0.10, 0.10, 2.20), 'wood_dark', bevel=0.01)
        box(f'shelf-upright-b-{sx}', (sx, 0.24, 1.12), (0.10, 0.10, 2.20), 'wood_dark', bevel=0.01)
        cyl(f'shelf-top-cap-f-{sx}', (sx, -0.24, 2.24), 0.06, 0.05, 'copper', vertices=8)
        cyl(f'shelf-top-cap-b-{sx}', (sx, 0.24, 2.24), 0.06, 0.05, 'copper', vertices=8)

    # 2. Side cross-bearers and rear retention back-rails at each tier
    for idx, sz in enumerate([0.22, 0.78, 1.34, 1.90]):
        # Side timber bearers between front and back uprights
        for sx in [-0.70, 0.70]:
            box(f'shelf-bearer-{idx}-{sx}', (sx, 0, sz - 0.05), (0.10, 0.44, 0.05), 'wood_dark', bevel=0.008)
        # Rear retention back-rail preventing items from falling behind
        box(f'shelf-back-rail-{idx}', (0, 0.24, sz + 0.08), (1.36, 0.04, 0.08), 'wood_dark', bevel=0.01)
        # Slate shelf slab resting securely on the bearers
        box(f'shelf-slab-{idx}', (0, 0, sz), (1.46, 0.52, 0.07), 'stone_light', bevel=0.015)

    # 3. Forged iron X-brace on the rear (anti-racking rigidity)
    beam('shelf-x-brace-1', (-0.65, 0.26, 0.35), (0.65, 0.26, 1.85), 0.025, 'iron_dark')
    beam('shelf-x-brace-2', (-0.65, 0.26, 1.85), (0.65, 0.26, 0.35), 0.025, 'iron_dark')
    sphere('shelf-x-boss', (0, 0.265, 1.10), (0.04, 0.04, 0.04), 'bronze')

    # 4. Bottom shelf: 2 mineral sample crates
    box('ore-crate-1', (-0.36, 0, 0.39), (0.48, 0.38, 0.26), 'wood_mid', bevel=0.015)
    sphere('ore-chunk-c1', (-0.36, 0, 0.49), (0.17, 0.14, 0.12), 'stone_copper', subdivisions=1)
    box('ore-crate-2', (0.36, 0, 0.39), (0.48, 0.38, 0.26), 'wood_mid', bevel=0.015)
    sphere('ore-chunk-c2', (0.36, 0, 0.49), (0.17, 0.14, 0.12), 'stone_dark', subdivisions=1)

    # 5. Second shelf: copper assay flasks
    cyl('flask-copper-1', (-0.45, 0.04, 0.96), 0.10, 0.30, 'copper', vertices=10, radius_top=0.04)
    cyl('flask-copper-2', (-0.24, 0.04, 0.94), 0.09, 0.26, 'copper_bright', vertices=10, radius_top=0.035)
    cyl('flask-copper-3', (-0.05, 0.04, 0.92), 0.08, 0.22, 'brass_bright', vertices=10, radius_top=0.03)

    # 6. Third shelf: stonemason's mallet & chisel
    box('mason-hammer-head', (0.35, 0.04, 1.41), (0.18, 0.08, 0.08), 'iron_light', bevel=0.01)
    beam('mason-hammer-handle', (0.35, 0.04, 1.41), (0.35, -0.16, 1.39), 0.032, 'wood_dark')
    beam('mason-chisel', (0.15, 0.04, 1.395), (0.15, -0.15, 1.39), 0.022, 'iron_light')

    # 7. Top shelf: crystal geode cluster
    sphere('crystal-geode-cluster', (0, 0, 2.08), (0.30, 0.24, 0.22), 'crystal_ore', subdivisions=2)
    sphere('crystal-geode-rock', (0.05, -0.04, 2.06), (0.28, 0.22, 0.20), 'stone_copper', subdivisions=1)

    finish_asset()


# ==============================================================================
# 21. MESA DE TRAZADO Y MAPAS MINEROS (Cartographer Drafting Desk)
# ==============================================================================
def build_desk_cartographer_copper():
    start_asset(
        'desk_cartographer_copper',
        'Mesa de Trazado y Mapas Mineros',
        'Mobiliario',
        'Pupitre inclinado de cantero y agrimensor con losa de dibujo, pergamino de galerías, escuadra de bronce y cajonería.'
    )

    # 1. 4 chamfered legs with copper shoes
    for sx in [-0.70, 0.70]:
        for sy in [-0.38, 0.38]:
            box(f'desk-leg-{sx}-{sy}', (sx, sy, 0.44), (0.10, 0.10, 0.88), 'wood_dark', bevel=0.012)
            box(f'desk-foot-{sx}-{sy}', (sx, sy, 0.05), (0.12, 0.12, 0.10), 'copper', bevel=0.008)

    # Perimeter stretchers & footrest
    beam('desk-rail-f', (-0.70, -0.38, 0.84), (0.70, -0.38, 0.84), 0.08, 'wood_dark')
    beam('desk-rail-b', (-0.70, 0.38, 0.84), (0.70, 0.38, 0.84), 0.08, 'wood_dark')
    beam('desk-footrest', (-0.70, 0.12, 0.22), (0.22, 0.12, 0.22), 0.08, 'wood_dark')

    # Bank of 2 drawers on right
    box('desk-drawer-bank', (0.45, 0, 0.48), (0.48, 0.72, 0.80), 'wood_mid', bevel=0.02)
    for dz in [0.28, 0.58]:
        box(f'desk-drawer-face-{dz}', (0.45, -0.37, dz), (0.42, 0.03, 0.24), 'wood_dark', bevel=0.01)
        torus(f'drawer-handle-{dz}', (0.45, -0.40, dz), 0.035, 0.009, 'bronze')

    # 2. Level horizontal rear shelf for inkpot, stylus rest and spare scrolls (no spilling)
    box('desk-rear-shelf', (0, 0.28, 0.99), (1.52, 0.24, 0.06), 'stone_mid', bevel=0.015)
    cyl('inkpot', (0.52, 0.28, 1.06), 0.05, 0.09, 'copper_dark', vertices=10)
    box('stylus-tray', (0.32, 0.28, 1.03), (0.22, 0.06, 0.02), 'copper')
    beam('copper-stylus', (0.24, 0.28, 1.045), (0.40, 0.28, 1.045), 0.012, 'copper_bright')

    # 3. Slanted drafting board with copper retaining lip (tilt angle theta=0.14 rad)
    # Riser wedges supporting the board
    for sx in [-0.58, 0.18]:
        beam(f'drafting-wedge-{sx}', (sx, -0.34, 0.88), (sx, 0.18, 0.96), 0.07, 'wood_mid')

    box('desk-drafting-board', (-0.08, -0.08, 0.94), (1.52, 0.62, 0.07), 'stone_light', bevel=0.015, rotation=(0.14, 0, 0))
    box('drafting-lip', (-0.08, -0.38, 0.895), (1.52, 0.04, 0.06), 'copper', bevel=0.008, rotation=(0.14, 0, 0))

    # 4. Props lying 100% flush on the slanted board (sharing exact rotation=(0.14, 0, 0), zero clipping/floating)
    box('parchment-sheet', (-0.16, -0.10, 0.978), (0.68, 0.44, 0.01), 'parchment', rotation=(0.14, 0, 0))
    cyl('parchment-scroll', (-0.16, 0.11, 1.01), 0.04, 0.65, 'parchment', vertices=12, rotation=(0.14, math.pi / 2.0, 0))
    box('surveyor-ruler', (0.36, -0.22, 0.958), (0.04, 0.30, 0.012), 'bronze', rotation=(0.14, 0, 0))

    finish_asset()


# ==============================================================================
# 22. GRAN YUNQUE DE FUNDICIÓN (Master Forge Anvil)
# ==============================================================================
def build_anvil_master_forge():
    start_asset(
        'anvil_master_forge',
        'Gran Yunque de Fundición',
        'Mobiliario',
        'Yunque monumental de doble cuerno sobre tajo de roble zunchado en hierro, cubeta de temple y martillos de forja.'
    )

    # 1. Basalt base slab
    box('anvil-stone-base', (0, 0, 0.08), (1.40, 1.30, 0.16), 'stone_dark', bevel=0.025)

    # 2. Oak log stump with dual iron hoops (offset so quenching tub stands completely clear)
    cyl('log-stump', (-0.16, 0, 0.46), 0.44, 0.60, 'wood_dark', vertices=16)
    torus('stump-band-1', (-0.16, 0, 0.26), 0.445, 0.035, 'iron_dark')
    torus('stump-band-2', (-0.16, 0, 0.66), 0.445, 0.035, 'iron_dark')

    # Anvil hold-down iron staples
    for ang in [math.pi / 4.0, 3 * math.pi / 4.0, 5 * math.pi / 4.0, 7 * math.pi / 4.0]:
        hx = -0.16 + math.cos(ang) * 0.34
        hy = math.sin(ang) * 0.34
        box(f'anvil-staple-{ang:.2f}', (hx, hy, 0.78), (0.06, 0.06, 0.06), 'iron_dark', bevel=0.008)

    # 3. Master smith's anvil body (face top at Z=1.06)
    box('anvil-waist', (-0.16, 0, 0.85), (0.58, 0.30, 0.24), 'iron_dark', bevel=0.02)
    box('anvil-face', (-0.16, 0, 1.01), (0.66, 0.34, 0.10), 'iron_light', bevel=0.015)

    # Conical round horn and square heel
    cyl('anvil-round-horn', (-0.66, 0, 1.01), 0.12, 0.36, 'iron_light', vertices=12, radius_top=0.02, rotation=(0, -math.pi / 2.0, 0))
    cyl('anvil-square-heel', (0.28, 0, 1.01), 0.11, 0.26, 'iron_light', vertices=4, radius_top=0.04, rotation=(0, math.pi / 2.0, math.pi / 4.0))

    # Hardy & pritchel holes on anvil face
    cyl('anvil-hardy-hole', (0.02, 0, 1.06), 0.03, 0.02, 'stone_dark', vertices=4, rotation=(0, 0, math.pi / 4.0))
    cyl('anvil-pritchel-hole', (0.12, 0, 1.06), 0.018, 0.02, 'stone_dark', vertices=8)

    # 4. Tools resting cleanly on anvil face (zero clipping through iron)
    box('hammer-head', (-0.22, 0.02, 1.09), (0.16, 0.07, 0.07), 'iron_light', bevel=0.01)
    beam('hammer-handle', (-0.22, 0.02, 1.08), (0.08, -0.10, 1.07), 0.026, 'wood_light')

    beam('tongs-jaw-1', (-0.42, -0.12, 1.07), (-0.30, -0.04, 1.07), 0.018, 'iron_dark')
    beam('tongs-jaw-2', (-0.42, -0.08, 1.07), (-0.30, 0.0, 1.07), 0.018, 'iron_dark')
    box('hot-ingot', (-0.48, -0.10, 1.07), (0.10, 0.06, 0.035), 'ember_red', bevel=0.005)

    # 5. Staved wooden quenching bucket standing completely clear of the stump
    cyl('quenching-tub-staves', (0.50, 0.18, 0.32), 0.23, 0.48, 'wood_mid', vertices=12)
    torus('tub-copper-hoop-1', (0.50, 0.18, 0.16), 0.235, 0.018, 'copper')
    torus('tub-copper-hoop-2', (0.50, 0.18, 0.48), 0.235, 0.018, 'copper')
    cyl('tub-water-fill', (0.50, 0.18, 0.52), 0.21, 0.04, 'water', vertices=10)

    finish_asset()


# ==============================================================================
# 23. HOGAR DE SUELO Y CAMPANA DE COBRE (Hewn Hearth & Smoke Hood)
# ==============================================================================
def build_hearth_brazier_hewn():
    start_asset(
        'hearth_brazier_hewn',
        'Hogar de Suelo y Campana de Cobre',
        'Mobiliario',
        'Hogar circular exento de cantería con lecho de brasas, parrilla giratoria de hierro y campana suspendida de cobre batido.'
    )

    # 1. Circular cyclopean stone curb ring
    ring('hearth-curb', (0, 0, 0), 1.18, 0.76, 0.0, 0.32, 'stone_mid', segments=16)
    cyl('hearth-ash-bed', (0, 0, 0.18), 0.80, 0.16, 'ash', vertices=16)

    # Glowing charcoal mound & core glow
    for i in range(10):
        ang = i * math.tau / 10.0
        ex = math.cos(ang) * 0.38
        ey = math.sin(ang) * 0.38
        sphere(f'hearth-coal-{i}', (ex, ey, 0.28), (0.14, 0.14, 0.10), 'ember_red', subdivisions=1)
    sphere('hearth-core-glow', (0, 0, 0.34), (0.36, 0.36, 0.14), 'amber_glow', subdivisions=2)

    # 2. Forged iron tripod legs securely supporting the smoke hood at its rim
    for i in range(3):
        ang = i * math.tau / 3.0 + math.pi / 6.0
        cx = math.cos(ang) * 0.98
        cy = math.sin(ang) * 0.98
        box(f'hood-foot-{i}', (cx, cy, 0.33), (0.14, 0.14, 0.06), 'iron_dark', bevel=0.01)
        beam(f'hood-support-leg-{i}', (cx, cy, 0.36), (cx * 1.15, cy * 1.15, 1.55), 0.05, 'iron_dark')
        # Forged clamp bracket gripping the hood rim
        box(f'hood-support-bracket-{i}', (cx * 1.15, cy * 1.15, 1.55), (0.09, 0.09, 0.09), 'bronze', bevel=0.01)

    # 3. Conical hammered copper smoke hood
    cyl('smoke-hood-cone', (0, 0, 1.90), 1.12, 0.75, 'copper', vertices=16, radius_top=0.38)
    torus('smoke-hood-rim', (0, 0, 1.53), 1.13, 0.035, 'copper_bright')
    cyl('smoke-hood-flue', (0, 0, 2.58), 0.34, 0.75, 'copper_dark', vertices=14)

    # 4. Central cooking suspension chain hanging down from the flue over the fire
    beam('hood-pot-chain', (0, 0, 2.45), (0, 0, 0.85), 0.028, 'iron_dark')
    torus('hood-pot-hook', (0, 0, 0.84), 0.035, 0.01, 'iron_light')

    # 5. Iron vertical stanchion with rotating swing arm and grill
    cyl('grill-post', (-0.92, 0, 0.65), 0.045, 1.10, 'iron_dark', vertices=10)
    beam('grill-arm', (-0.92, 0, 0.74), (0, 0, 0.74), 0.04, 'iron_dark')
    torus('grill-rim', (0, 0, 0.74), 0.34, 0.022, 'iron_dark')
    for gy in [-0.22, -0.11, 0.0, 0.11, 0.22]:
        beam(f'grill-bar-{gy}', (-0.26, gy, 0.74), (0.26, gy, 0.74), 0.018, 'iron_light')

    finish_asset()


# ==============================================================================
# 24. ALFOMBRA DE LANA Y CUERO LAGTO' (Lizard Weave Rug)
# ==============================================================================
def build_rug_lizard_weave():
    start_asset(
        'rug_lizard_weave',
        'Alfombra de Lana y Cuero Lagto\'',
        'Mobiliario',
        'Tapiz de suelo de lana gruesa y ribetes de cuero trenzado con patrón geométrico de escamas de reptil en rojo y ocre.'
    )

    # 1. Heavy red wool rug base (grounded at Z=0.0, top at Z=0.030)
    box('rug-base', (0, 0, 0.015), (2.90, 1.90, 0.03), 'textile_red', bevel=0.005)

    # 2. Braided leather borders
    box('border-north', (0, 0.91, 0.022), (2.94, 0.14, 0.02), 'leather_heavy')
    box('border-south', (0, -0.91, 0.022), (2.94, 0.14, 0.02), 'leather_heavy')
    box('border-west', (-1.41, 0, 0.022), (0.14, 1.66, 0.02), 'leather_heavy')
    box('border-east', (1.41, 0, 0.022), (0.14, 1.66, 0.02), 'leather_heavy')

    # Forged copper corner weights/clasps locking the mitered joints to the floor
    for sx in [-1.41, 1.41]:
        for sy in [-0.91, 0.91]:
            box(f'rug-corner-clasp-{sx}-{sy}', (sx, sy, 0.026), (0.16, 0.16, 0.024), 'copper', bevel=0.006)
            sphere(f'rug-corner-rivet-{sx}-{sy}', (sx, sy, 0.040), (0.025, 0.025, 0.015), 'bronze')

    # 3. Geometric Saurian diamond scale medallions (generous 10-15mm step offsets, zero z-fighting)
    for idx, dx in enumerate([-0.75, 0.0, 0.75]):
        # Outer ochre diamond (top surface at Z=0.045, 15mm proud of base)
        cyl(f'diamond-motif-{idx}', (dx, 0, 0.038), 0.38, 0.014, 'textile_ochre', vertices=4, rotation=(0, 0, math.pi / 4.0))
        # Inner dark basalt eye accent (top surface at Z=0.054)
        cyl(f'diamond-eye-{idx}', (dx, 0, 0.048), 0.18, 0.012, 'stone_dark', vertices=4, rotation=(0, 0, math.pi / 4.0))
        # Central gold bead (top at Z=0.068)
        sphere(f'diamond-bead-{idx}', (dx, 0, 0.058), (0.05, 0.05, 0.02), 'gold_inlay')

    # Knotted ochre wool fringe along short ends
    for fx in [-1.48, 1.48]:
        for i in range(14):
            fy = -0.80 + i * 0.123
            box(f'fringe-{fx}-{i}', (fx, fy, 0.012), (0.09, 0.05, 0.015), 'textile_ochre')

    finish_asset()


# ==============================================================================
# 25. ARMERO DE CANTERÍA Y COBRE (Weapon Rack)
# ==============================================================================
def build_weapon_rack_stone_copper():
    start_asset(
        'weapon_rack_stone_copper',
        'Armero de Cantería y Cobre',
        'Mobiliario',
        'Armero de suelo con montantes de sillar, traviesas de cedro ranuradas y guarniciones de cobre para alabardas y mandobles.'
    )

    # 1. Heavy stone end uprights with stepped base pedestals and copper caps
    for sx in [-0.90, 0.90]:
        box(f'rack-end-foot-{sx}', (sx, 0, 0.14), (0.26, 0.70, 0.28), 'stone_dark', bevel=0.025)
        box(f'rack-end-post-{sx}', (sx, 0, 0.92), (0.20, 0.28, 1.35), 'stone_mid', bevel=0.02)
        box(f'rack-end-cap-{sx}', (sx, 0, 1.62), (0.24, 0.32, 0.12), 'copper', bevel=0.015)

    # 2. Lower butt rest trough with hammered copper lining and retaining lips
    box('rack-shelf-bot', (0, 0, 0.22), (1.68, 0.44, 0.12), 'wood_dark', bevel=0.015)
    box('rack-shelf-copper-lining', (0, 0, 0.285), (1.64, 0.38, 0.015), 'copper')
    box('rack-trough-lip-f', (0, -0.19, 0.31), (1.64, 0.04, 0.08), 'wood_dark', bevel=0.008)
    box('rack-trough-lip-b', (0, 0.19, 0.31), (1.64, 0.04, 0.08), 'wood_dark', bevel=0.008)

    # 3. Upper notched retention bar with paired copper prongs forming true U-shaped cradles
    beam('rack-notch-bar', (-0.85, 0, 1.25), (0.85, 0, 1.25), 0.12, 'wood_dark')
    slot_xs = [-0.54, -0.18, 0.18, 0.54]
    for i, wx in enumerate(slot_xs):
        # Left and right prongs forming genuine cradle
        box(f'weapon-prong-l-{i}', (wx - 0.05, -0.10, 1.25), (0.025, 0.16, 0.035), 'copper_bright')
        box(f'weapon-prong-r-{i}', (wx + 0.05, -0.10, 1.25), (0.025, 0.16, 0.035), 'copper_bright')
        cyl(f'weapon-pin-l-{i}', (wx - 0.05, -0.17, 1.28), 0.012, 0.07, 'bronze', vertices=8)
        cyl(f'weapon-pin-r-{i}', (wx + 0.05, -0.17, 1.28), 0.012, 0.07, 'bronze', vertices=8)

    # Center stone cross-brace with carved clan emblem
    box('rack-cross-brace', (0, 0, 0.75), (1.68, 0.10, 0.18), 'stone_light', bevel=0.015)
    sphere('rack-clan-boss', (0, -0.06, 0.75), (0.08, 0.02, 0.08), 'bronze')

    # 4. Weapons resting properly in cradles (butts resting on bottom copper lining at Z=0.29)
    for idx, hx in enumerate([-0.18, 0.18]):
        cyl(f'halberd-shaft-{idx}', (hx, -0.10, 1.24), 0.028, 1.90, 'wood_mid', vertices=8)
        box(f'halberd-axe-head-{idx}', (hx, -0.10, 1.98), (0.28, 0.025, 0.36), 'iron_light', bevel=0.008)
        cyl(f'halberd-spear-tip-{idx}', (hx, -0.10, 2.24), 0.045, 0.28, 'copper_bright', vertices=4, radius_top=0.005)

    # Heavy broadsword in slot 0
    cyl('sword-blade', (-0.54, -0.10, 0.82), 0.035, 1.05, 'iron_light', vertices=4, rotation=(0, 0, math.pi / 4.0))
    box('sword-crossguard', (-0.54, -0.10, 1.36), (0.24, 0.04, 0.04), 'bronze', bevel=0.008)
    beam('sword-grip', (-0.54, -0.10, 1.36), (-0.54, -0.10, 1.58), 0.026, 'leather_heavy')
    sphere('sword-pommel', (-0.54, -0.10, 1.60), (0.04, 0.04, 0.04), 'copper_bright')

    finish_asset()


# ==============================================================================
# 26. LITERA MINERA DE CEDRO Y SILLAR (Miner Bunk Bed)
# ==============================================================================
def build_bunk_bed_miner():
    start_asset(
        'bunk_bed_miner',
        'Litera Minera de Cedro y Sillar',
        'Mobiliario',
        'Litera doble de cuadrantes de cedro anclada a pies de sillar, con jergones de lana, barandilla de cobre y escala lateral.'
    )

    # 1. 4 cedar corner posts anchored into stone footing shoes
    for sx in [-0.90, 0.90]:
        for sy in [-1.20, 1.20]:
            box(f'bunk-foot-{sx}-{sy}', (sx, sy, 0.16), (0.22, 0.22, 0.32), 'stone_dark', bevel=0.02)
            beam(f'bunk-post-{sx}-{sy}', (sx, sy, 0.32), (sx, sy, 2.30), 0.14, 'wood_dark')
            cyl(f'bunk-cap-{sx}-{sy}', (sx, sy, 2.33), 0.08, 0.06, 'copper', vertices=8)

    # 2. Solid cedar headboards and footboards on BOTH bunks (enclosed ends, zero fallout)
    # Lower bunk headboard & footboard
    box('lower-headboard', (0, 1.14, 0.76), (1.66, 0.06, 0.44), 'wood_dark', bevel=0.015)
    box('lower-footboard', (0, -1.14, 0.68), (1.66, 0.06, 0.28), 'wood_dark', bevel=0.015)
    # Upper bunk headboard & footboard
    box('upper-headboard', (0, 1.14, 1.84), (1.66, 0.06, 0.48), 'wood_dark', bevel=0.015)
    box('upper-footboard', (0, -1.14, 1.76), (1.66, 0.06, 0.32), 'wood_dark', bevel=0.015)

    # 3. Lower bunk frame and bedding
    box('lower-bunk-frame', (0, 0, 0.48), (1.68, 2.26, 0.12), 'wood_dark', bevel=0.015)
    box('lower-bunk-mattress', (0, 0, 0.58), (1.52, 2.12, 0.16), 'textile_red', bevel=0.02)
    box('lower-bunk-pillow', (0, 0.78, 0.69), (0.75, 0.44, 0.14), 'textile_ochre', bevel=0.018)

    # 4. Upper bunk frame and bedding
    box('upper-bunk-frame', (0, 0, 1.52), (1.68, 2.26, 0.12), 'wood_dark', bevel=0.015)
    box('upper-bunk-mattress', (0, 0, 1.62), (1.52, 2.12, 0.16), 'textile_ochre', bevel=0.02)
    box('upper-bunk-pillow', (0, 0.78, 1.73), (0.75, 0.44, 0.14), 'textile_red', bevel=0.018)

    # 5. Upper safety railing on outer face (+X)
    beam('safety-rail-top', (0.90, -1.20, 1.90), (0.90, 0.25, 1.90), 0.06, 'copper')
    for by in [-1.0, -0.65, -0.3, 0.05]:
        beam(f'safety-baluster-{by}', (0.90, by, 1.52), (0.90, by, 1.90), 0.04, 'copper_bright')

    # 6. Side climbing ladder on -X side firmly bracketed to the bunk frame with horizontal rungs
    beam('ladder-stile-1', (-0.96, -0.90, 0.0), (-0.96, -0.90, 2.22), 0.06, 'wood_dark')
    beam('ladder-stile-2', (-0.96, -0.46, 0.0), (-0.96, -0.46, 2.22), 0.06, 'wood_dark')
    for sy in [-0.90, -0.46]:
        box(f'ladder-bracket-bot-{sy}', (-0.90, sy, 0.48), (0.12, 0.05, 0.06), 'copper', bevel=0.008)
        box(f'ladder-bracket-top-{sy}', (-0.90, sy, 1.52), (0.12, 0.05, 0.06), 'copper', bevel=0.008)
    for rz in [0.42, 0.78, 1.14, 1.50, 1.86]:
        cyl(f'ladder-rung-{rz}', (-0.96, -0.68, rz), 0.022, 0.42, 'wood_light', vertices=10, rotation=(math.pi / 2.0, 0, 0))

    # 7. Under-bed cedar storage drawer
    for sy in [-0.70, 0.70]:
        beam(f'drawer-runner-{sy}', (-0.75, sy, 0.40), (0.75, sy, 0.40), 0.08, 'wood_dark')
    box('bunk-drawer', (0, 0, 0.28), (1.55, 1.60, 0.26), 'wood_mid', bevel=0.015)
    box('bunk-drawer-face', (0.78, 0, 0.28), (0.06, 1.50, 0.24), 'wood_dark', bevel=0.01)
    torus('bunk-drawer-handle', (0.82, 0, 0.28), 0.04, 0.01, 'copper')

    finish_asset()


# ==============================================================================
# 27. MESA BAJA CON COJINES DE SUELO (Low Table & Poufs)
# ==============================================================================
def build_low_table_cushions():
    start_asset(
        'low_table_cushions',
        'Mesa Baja con Cojines de Suelo',
        'Mobiliario',
        'Mesa de tertulia baja de granito pulido rodeada de cuatro pufs de cuero reptiliano con tetera y cuencos de cobre.'
    )

    # 1. Polished light granite tabletop slab
    box('low-table-slab', (0, 0, 0.38), (1.60, 1.20, 0.09), 'stone_light', bevel=0.025)

    # 2. Solid cedar sub-frame / apron under the slab binding all 4 pedestals
    box('low-table-apron-n', (0, 0.44, 0.31), (1.24, 0.06, 0.07), 'wood_dark', bevel=0.01)
    box('low-table-apron-s', (0, -0.44, 0.31), (1.24, 0.06, 0.07), 'wood_dark', bevel=0.01)
    box('low-table-apron-e', (0.62, 0, 0.31), (0.06, 0.84, 0.07), 'wood_dark', bevel=0.01)
    box('low-table-apron-w', (-0.62, 0, 0.31), (0.06, 0.84, 0.07), 'wood_dark', bevel=0.01)

    # 3. 4 stepped dark basalt pedestal feet
    for sx in [-0.60, 0.60]:
        for sy in [-0.42, 0.42]:
            box(f'low-table-plinth-{sx}-{sy}', (sx, sy, 0.08), (0.28, 0.28, 0.16), 'stone_dark', bevel=0.02)
            box(f'low-table-shaft-{sx}-{sy}', (sx, sy, 0.22), (0.22, 0.22, 0.18), 'stone_mid', bevel=0.015)

    # 4. Flush copper corner brackets wrapping the slab edges
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            box(f'low-table-bracket-top-{sx}-{sy}', (sx * 0.73, sy * 0.53, 0.43), (0.12, 0.12, 0.012), 'copper')
            sphere(f'low-table-rivet-{sx}-{sy}', (sx * 0.73, sy * 0.53, 0.44), (0.015, 0.015, 0.012), 'bronze')

    # 5. Hammered copper teapot
    teapot_prof = [
        (0.06, 0.0),
        (0.14, 0.08),
        (0.16, 0.18),
        (0.08, 0.26),
        (0.06, 0.30),
    ]
    lathe('teapot-body', (0, 0, 0.425), teapot_prof, 'copper_bright', segments=14)
    torus('teapot-handle', (0, 0.14, 0.535), 0.07, 0.016, 'copper_dark', rotation=(math.pi / 2.0, 0, 0))
    cyl('teapot-spout', (0, -0.16, 0.555), 0.025, 0.14, 'copper_bright', vertices=8, rotation=(-0.65, 0, 0))
    sphere('teapot-knob', (0, 0, 0.735), (0.025, 0.025, 0.025), 'bronze')

    # 6. Flared copper tea bowls (open vessels with fragrant tea visible inside)
    bowl_prof = [(0.035, 0.0), (0.065, 0.03), (0.075, 0.07)]
    for idx, (bx, by) in enumerate([(-0.35, -0.18), (0.35, 0.18)]):
        lathe(f'tea-bowl-{idx}', (bx, by, 0.425), bowl_prof, 'copper', segments=12, cap_top=False)
        cyl(f'tea-fill-{idx}', (bx, by, 0.465), 0.062, 0.02, 'water', vertices=10)

    # 7. 4 round floor poufs
    poufs = [(-1.05, 0), (1.05, 0), (0, -0.85), (0, 0.85)]
    for idx, (px, py) in enumerate(poufs):
        p_mat = 'leather_heavy' if idx % 2 == 0 else 'textile_red'
        cyl(f'pouf-body-{idx}', (px, py, 0.11), 0.35, 0.22, p_mat, vertices=16)
        torus(f'pouf-seam-{idx}', (px, py, 0.21), 0.33, 0.018, 'leather_light')
        sphere(f'pouf-tuft-{idx}', (px, py, 0.23), (0.06, 0.06, 0.03), 'bronze')

    finish_asset()


# ==============================================================================
# 28. LIBRERÍA DE TABLILLAS Y CILINDROS (Clay Tablet Bookcase)
# ==============================================================================
def build_bookcase_tablet_vault():
    start_asset(
        'bookcase_tablet_vault',
        'Librería de Tablillas y Cilindros',
        'Mobiliario',
        'Estantería de archivo de sillería con alvéolos para tablillas de terracota, mapas de galerías en cilindro y reglas de bronce.'
    )

    # 1. Stepped stone plinth
    box('archive-plinth', (0, 0, 0.14), (1.72, 0.76, 0.28), 'stone_dark', bevel=0.03)

    # 2. Open-front architectural carcass (solid back and side walls, open front opening)
    box('archive-back-wall', (0, 0.28, 1.22), (1.38, 0.08, 1.86), 'stone_mid', bevel=0.02)
    box('archive-wall-l', (-0.75, 0, 1.22), (0.12, 0.64, 1.86), 'stone_mid', bevel=0.02)
    box('archive-wall-r', (0.75, 0, 1.22), (0.12, 0.64, 1.86), 'stone_mid', bevel=0.02)
    box('archive-shelf-base', (0, -0.02, 0.32), (1.46, 0.60, 0.08), 'stone_light', bevel=0.015)

    # 3. Thick stone shelves spanning between the side walls (open depth of 52cm)
    for idx, sz in enumerate([0.82, 1.32, 1.82]):
        box(f'archive-shelf-{idx}', (0, -0.02, sz), (1.46, 0.54, 0.07), 'stone_light', bevel=0.012)

    # 4. Vertical stone partitions dividing the bays
    for dx in [-0.25, 0.25]:
        box(f'archive-divider-tier1-{dx}', (dx, -0.02, 0.57), (0.06, 0.52, 0.43), 'stone_light')
        box(f'archive-divider-tier2-{dx}', (dx, -0.02, 1.07), (0.06, 0.52, 0.43), 'stone_light')
        box(f'archive-divider-tier3-{dx}', (dx, -0.02, 1.57), (0.06, 0.52, 0.43), 'stone_light')

    # 5. Molded stone cornice and copper cresting at the top
    box('archive-cornice', (0, 0, 2.18), (1.72, 0.76, 0.14), 'stone_light', bevel=0.025)
    box('archive-copper-crest', (0, 0, 2.27), (1.76, 0.80, 0.06), 'copper', bevel=0.012)

    # 6. Archival contents resting directly on the stone shelves (clean physical depth, zero floating)
    # Tier 1: Terracotta tablets & inscribed copper plates resting on shelf base (top at Z=0.36)
    for i in range(6):
        tx = -0.62 + i * 0.08
        t_mat = 'copper_dark' if i % 2 == 0 else 'stone_copper'
        box(f'tablet-row1-{i}', (tx, -0.02, 0.50), (0.05, 0.36, 0.28), t_mat, bevel=0.006)

    # Tier 2: Rolled map survey cylinders resting on shelf 0 (top at Z=0.855)
    for i in range(4):
        cx = -0.15 + i * 0.10
        cyl(f'map-cylinder-{i}', (cx, -0.02, 0.90), 0.045, 0.36, 'textile_ochre', vertices=10, rotation=(math.pi / 2.0, 0, 0))
        cyl(f'map-cap-{i}', (cx, -0.20, 0.90), 0.048, 0.025, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))

    # Tier 3: Mineral assay tablets resting on shelf 1 (top at Z=1.355)
    for i in range(5):
        tx = 0.32 + i * 0.07
        box(f'tablet-row3-{i}', (tx, -0.02, 1.485), (0.045, 0.34, 0.26), 'stone_dark', bevel=0.005)

    finish_asset()


# ==============================================================================
# 29. AGUAMANIL Y PALANCANA DE COBRE (Washing Basin Stand)
# ==============================================================================
def build_washing_basin_copper():
    start_asset(
        'washing_basin_copper',
        'Aguamanil y Palancana de Cobre',
        'Mobiliario',
        'Lavamanos de pedestal de sillar tallado con palangana de cobre batido, aguamanil de latón y toallero de cedro con paño.'
    )

    # 1. Stepped octagonal stone pedestal base
    box('wash-pedestal-plinth', (0, 0, 0.10), (0.75, 0.75, 0.20), 'stone_dark', bevel=0.03)
    cyl('wash-pedestal-shaft', (0, 0, 0.52), 0.22, 0.64, 'stone_mid', vertices=12)
    torus('wash-pedestal-collar', (0, 0, 0.78), 0.23, 0.035, 'copper')
    box('wash-pedestal-top', (0, 0, 0.88), (0.76, 0.76, 0.14), 'stone_light', bevel=0.025)

    # 2. Beaten copper wash basin bowl (OPEN VESSEL with rolled rim and visible water fill)
    basin_prof = [
        (0.18, 0.0),
        (0.30, 0.06),
        (0.35, 0.16),
        (0.32, 0.20),
    ]
    lathe('wash-basin-bowl', (0, 0, 0.94), basin_prof, 'copper_bright', segments=16, cap_top=False)
    torus('wash-basin-rim', (0, 0, 1.14), 0.33, 0.02, 'copper_bright')
    cyl('wash-water-fill', (0, 0, 1.06), 0.30, 0.04, 'water', vertices=12)

    # 3. Tall hammered brass water ewer sitting securely on the stone top slab
    ewer_prof = [
        (0.04, 0.0),
        (0.09, 0.08),
        (0.10, 0.18),
        (0.06, 0.26),
        (0.07, 0.32),
    ]
    lathe('wash-ewer-body', (-0.24, -0.24, 0.95), ewer_prof, 'brass_bright', segments=12)
    torus('wash-ewer-handle', (-0.31, -0.24, 1.15), 0.06, 0.014, 'bronze', rotation=(math.pi / 2.0, 0, 0))
    cyl('wash-ewer-spout', (-0.17, -0.24, 1.25), 0.025, 0.09, 'brass_bright', vertices=8, rotation=(0.5, 0, 0))

    # 4. Cedar towel bar arm with copper rosettes and folded ochre towel
    beam('towel-rail-arm', (0.38, -0.24, 0.85), (0.38, 0.24, 0.85), 0.035, 'wood_dark')
    box('towel-bracket-f', (0.38, -0.24, 0.88), (0.06, 0.04, 0.10), 'copper')
    box('towel-bracket-b', (0.38, 0.24, 0.88), (0.06, 0.04, 0.10), 'copper')
    box('towel-cloth', (0.38, 0, 0.74), (0.025, 0.36, 0.26), 'textile_ochre', bevel=0.008)

    finish_asset()


# ==============================================================================
# 30. CALDERO DE COBRE SOBRE TRÍPODE (Hearth Cauldron Tripod)
# ==============================================================================
def build_cauldron_hearth_tripod():
    start_asset(
        'cauldron_hearth_tripod',
        'Caldero de Cobre sobre Trípode',
        'Mobiliario',
        'Gran marmita de cobre martillado con asa de arco suspendida sobre trípode de forja, bandeja de rescoldo y cucharón de madera.'
    )

    # 1. Stepped stone ash pan curb and glowing charcoal bed
    box('cauldron-ash-pan', (0, 0, 0.08), (1.20, 1.20, 0.16), 'stone_dark', bevel=0.025)
    cyl('cauldron-ash-bed', (0, 0, 0.16), 0.48, 0.06, 'ash', vertices=14)
    for i in range(8):
        ang = i * math.tau / 8.0
        ex = math.cos(ang) * 0.28
        ey = math.sin(ang) * 0.28
        sphere(f'cauldron-coal-{i}', (ex, ey, 0.19), (0.10, 0.10, 0.07), 'ember_red', subdivisions=1)
    sphere('cauldron-ember-glow', (0, 0, 0.21), (0.24, 0.24, 0.08), 'amber_glow', subdivisions=2)

    # 2. Forged iron tripod with top collar ring and mid spreader ring
    for i in range(3):
        ang = i * math.tau / 3.0
        lx = math.cos(ang) * 0.62
        ly = math.sin(ang) * 0.62
        box(f'tripod-foot-{i}', (lx, ly, 0.09), (0.10, 0.10, 0.04), 'iron_dark', bevel=0.01)
        beam(f'cauldron-tripod-leg-{i}', (lx, ly, 0.09), (0, 0, 1.62), 0.048, 'iron_dark')

    # Top collar ring, suspension eye, chain and S-hook
    cyl('cauldron-top-collar', (0, 0, 1.62), 0.09, 0.06, 'iron_dark', vertices=12)
    torus('cauldron-top-eye', (0, 0, 1.66), 0.045, 0.012, 'iron_dark', rotation=(math.pi / 2.0, 0, 0))
    torus('tripod-spreader-ring', (0, 0, 0.72), 0.46, 0.024, 'iron_dark')

    beam('cauldron-chain', (0, 0, 1.63), (0, 0, 1.51), 0.026, 'iron_dark')
    torus('cauldron-s-hook', (0, 0, 1.50), 0.035, 0.01, 'iron_light')

    # 3. Round-bottomed hammered copper cauldron pot (OPEN VESSEL with stew visible inside)
    cauldron_prof = [
        (0.20, 0.22),
        (0.42, 0.38),
        (0.46, 0.65),
        (0.40, 0.80),
    ]
    lathe('cauldron-pot', (0, 0, 0.28), cauldron_prof, 'copper', segments=16, cap_top=False)
    torus('cauldron-rim', (0, 0, 1.08), 0.41, 0.025, 'copper_bright')
    torus('cauldron-bail-handle', (0, 0, 1.08), 0.41, 0.022, 'iron_dark', rotation=(math.pi / 2.0, 0, 0))

    # Cauldron stew fill visible inside the open kettle
    cyl('cauldron-fill', (0, 0, 0.96), 0.41, 0.06, 'water', vertices=14)

    # 4. Wooden stirring paddle resting inside the open cauldron
    beam('stir-paddle-handle', (0.42, 0.35, 0.20), (0.16, 0.12, 1.20), 0.038, 'wood_mid')
    box('stir-paddle-blade', (0.16, 0.12, 0.98), (0.09, 0.02, 0.18), 'wood_mid', bevel=0.005)

    finish_asset()
