"""Atrezo, Minería y Decoración de las Cumbres de Cobre (Pueblo Lagto') para Blender.

20 modelos de atrezo, minería y decoración de las Cumbres de Cobre:
25. brazier_cobre_tripod: Pebetero de Cobre de las Cumbres
26. lamp_copper_pendant: Farol de Pared de Cobre y Soporte
27. cart_mine_ore: Vagoneta Minera de Cobre
28. mine_track_segment: Tramo de Raíles de Mina
29. ore_pile_copper: Montón de Menas de Cobre
30. bellows_forge_pedestal: Fuelle Gigante de Fundición
31. banner_lagto_clan: Estandarte de Guerra Lagto'
32. barrier_spiked_stone: Parapeto Defensivo de Sillar y Cobre
33. gate_quarry_post: Poste de Portal con Cadenas
34. crucible_molten_copper: Crisol con Cobre Fundido
35. quarry_crane_derrick: Grúa de Cantera y Cabestrante
36. water_cistern_copper: Cisterna de Roca y Filtro de Cobre
37. mine_cart_turnout: Desvío y Aguja de Vía Minera
38. crusher_ore_stamp: Molino Triturador de Mineral
39. ingot_stack_copper: Pila de Lingotes de Cobre
40. ventilation_windlass_shaft: Pozo de Ventilación Minero
41. warning_beacon_totem: Tótem Almenara de las Cumbres
42. cavern_crystal_geode: Geoda Gigante de Malaquita y Azurita
43. water_flume_sluice: Canaleta de Lavado de Mineral
44. tent_miner_outpost: Tienda de Campaña Minera
"""
import math
from lagto_common import (
    start_asset, finish_asset, box, cyl, sphere, beam, lathe, torus, ring,
    riveted_strap, copper_brazier, copper_lantern_pendant
)


# ==============================================================================
# 25. PEBETERO DE COBRE DE LAS CUMBRES (Copper Tripod Brazier)
# ==============================================================================
def build_brazier_cobre_tripod():
    start_asset(
        'brazier_cobre_tripod',
        'Pebetero de Cobre de las Cumbres',
        'Atrezo y decoración',
        'Pebetero exento sobre trípode de hierro forjado con remates de garra, cuenco de cobre patinado y lecho de ascuas vivas.'
    )

    for i in range(3):
        ang = i * math.tau / 3.0
        lx = math.cos(ang) * 0.42
        ly = math.sin(ang) * 0.42
        sphere(f'claw-foot-{i}', (lx, ly, 0.05), (0.07, 0.07, 0.04), 'iron_dark')
        beam(f'tripod-leg-{i}', (lx, ly, 0.05), (lx * 0.65, ly * 0.65, 0.72), 0.05, 'iron_dark')

    torus('tripod-stretcher-ring', (0, 0, 0.42), 0.22, 0.02, 'iron_dark')
    torus('tripod-bowl-collar', (0, 0, 0.74), 0.35, 0.028, 'copper_dark')
    copper_brazier('tripod-bowl', 0, 0, 0.76, radius=0.48, height=0.32, mat='copper_patina')

    finish_asset()


# ==============================================================================
# 26. FAROL DE PARED DE COBRE Y SOPORTE (Wall Copper Lantern Crane)
# ==============================================================================
def build_lamp_copper_pendant():
    start_asset(
        'lamp_copper_pendant',
        'Farol de Pared de Cobre y Soporte',
        'Atrezo y decoración',
        'Soporte mural de hierro forjado con brazo de pescante, farol ochavado de cobre con cristales ámbar y argolla de suspensión.'
    )

    box('wall-mount-plate', (0, 0.28, 1.2), (0.16, 0.04, 0.52), 'iron_dark', bevel=0.01)
    cyl('wall-stud-top', (0, 0.29, 1.4), 0.02, 0.02, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))
    cyl('wall-stud-bot', (0, 0.29, 1.0), 0.02, 0.02, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))

    beam('crane-horizontal', (0, 0.28, 1.35), (0, -0.42, 1.35), 0.045, 'iron_dark')
    beam('crane-strut', (0, 0.28, 1.05), (0, -0.28, 1.35), 0.038, 'iron_dark')
    torus('crane-tip-scroll', (0, -0.44, 1.38), 0.04, 0.012, 'iron_dark', rotation=(0, math.pi / 2.0, 0))

    cyl('suspension-link-1', (0, -0.38, 1.28), 0.012, 0.08, 'iron_dark')
    cyl('suspension-link-2', (0, -0.38, 1.21), 0.012, 0.08, 'iron_dark')

    copper_lantern_pendant('wall-lantern', 0, -0.38, 0.62, scale=0.85)

    finish_asset()


# ==============================================================================
# 27. VAGONETA MINERA DE COBRE (Copper Mine Cart)
# ==============================================================================
def build_cart_mine_ore():
    start_asset(
        'cart_mine_ore',
        'Vagoneta Minera de Cobre',
        'Atrezo y decoración',
        'Vagoneta de tolva de madera férrea y chapas de cobre remachadas sobre cuatro ruedas de fundición con carga de mena en bruto.'
    )

    for sy in [-0.52, 0.52]:
        cyl(f'cart-axle-{sy}', (0, sy, 0.16), 0.04, 0.96, 'iron_dark', vertices=8, rotation=(0, math.pi / 2.0, 0))
        for sx in [-0.44, 0.44]:
            cyl(f'wheel-tire-{sx}-{sy}', (sx, sy, 0.16), 0.16, 0.06, 'iron_light', vertices=12, rotation=(0, math.pi / 2.0, 0))
            cyl(f'wheel-flange-{sx}-{sy}', (sx + (-0.035 if sx > 0 else 0.035), sy, 0.16), 0.19, 0.02, 'iron_dark', vertices=12, rotation=(0, math.pi / 2.0, 0))
            cyl(f'wheel-hub-{sx}-{sy}', (sx + (0.04 if sx > 0 else -0.04), sy, 0.16), 0.05, 0.04, 'bronze', vertices=8, rotation=(0, math.pi / 2.0, 0))

    beam('chassis-beam-l', (-0.32, -0.75, 0.24), (-0.32, 0.75, 0.24), 0.1, 'wood_dark')
    beam('chassis-beam-r', (0.32, -0.75, 0.24), (0.32, 0.75, 0.24), 0.1, 'wood_dark')
    box('buffer-front', (0, -0.76, 0.24), (0.78, 0.12, 0.12), 'wood_dark', bevel=0.01)
    box('buffer-back', (0, 0.76, 0.24), (0.78, 0.12, 0.12), 'wood_dark', bevel=0.01)
    cyl('coupler-pin-f', (0, -0.84, 0.24), 0.03, 0.08, 'iron_dark', vertices=8)
    cyl('coupler-pin-b', (0, 0.84, 0.24), 0.03, 0.08, 'iron_dark', vertices=8)

    box('hopper-base', (0, 0, 0.35), (0.74, 1.25, 0.1), 'wood_dark', bevel=0.01)
    box('hopper-wall-f', (0, -0.62, 0.62), (0.82, 0.07, 0.52), 'wood_mid', bevel=0.015, rotation=(-0.12, 0, 0))
    box('hopper-wall-b', (0, 0.62, 0.62), (0.82, 0.07, 0.52), 'wood_mid', bevel=0.015, rotation=(0.12, 0, 0))
    box('hopper-wall-l', (-0.42, 0, 0.62), (0.07, 1.34, 0.52), 'wood_mid', bevel=0.015, rotation=(0, 0.12, 0))
    box('hopper-wall-r', (0.42, 0, 0.62), (0.07, 1.34, 0.52), 'wood_mid', bevel=0.015, rotation=(0, -0.12, 0))

    for sx in [-0.44, 0.44]:
        for sy in [-0.64, 0.64]:
            box(f'hopper-corner-copper-{sx}-{sy}', (sx, sy, 0.62), (0.12, 0.12, 0.54), 'copper', bevel=0.01)

    for i in range(7):
        ox = -0.22 + (i % 3) * 0.22
        oy = -0.38 + (i // 3) * 0.38
        sphere(f'cart-ore-rock-{i}', (ox, oy, 0.68), (0.2, 0.22, 0.15), 'stone_copper', subdivisions=1)
    sphere('cart-ore-nugget-1', (-0.1, -0.15, 0.82), (0.12, 0.14, 0.09), 'copper_bright')
    sphere('cart-ore-crystal-2', (0.12, 0.2, 0.83), (0.1, 0.12, 0.08), 'crystal_ore')

    finish_asset()


# ==============================================================================
# 28. TRAMO DE RAÍLES DE MINA (Mine Track Segment)
# ==============================================================================
def build_mine_track_segment():
    start_asset(
        'mine_track_segment',
        'Tramo de Raíles de Mina',
        'Atrezo y decoración',
        'Segmento de vía minera de 3 metros con traviesas de cedro, carriles de fundición y placas de fijación claveteadas.'
    )

    for i in range(5):
        ty = -1.2 + i * 0.6
        box(f'sleeper-{i}', (0, ty, 0.05), (1.1, 0.2, 0.1), 'wood_dark', bevel=0.012)
        for rx in [-0.38, 0.38]:
            box(f'tie-plate-{i}-{rx}', (rx, ty, 0.11), (0.12, 0.14, 0.02), 'iron_dark')
            cyl(f'spike-1-{i}-{rx}', (rx - 0.04, ty, 0.13), 0.012, 0.03, 'bronze', vertices=6)
            cyl(f'spike-2-{i}-{rx}', (rx + 0.04, ty, 0.13), 0.012, 0.03, 'bronze', vertices=6)

    for rx in [-0.38, 0.38]:
        box(f'rail-base-{rx}', (rx, 0, 0.13), (0.08, 3.0, 0.02), 'iron_dark')
        box(f'rail-web-{rx}', (rx, 0, 0.17), (0.03, 3.0, 0.06), 'iron_dark')
        box(f'rail-head-{rx}', (rx, 0, 0.21), (0.06, 3.0, 0.03), 'iron_light', bevel=0.005)

    finish_asset()


# ==============================================================================
# 29. MONTÓN DE MENAS DE COBRE (Copper Ore Boulder Cluster)
# ==============================================================================
def build_ore_pile_copper():
    start_asset(
        'ore_pile_copper',
        'Montón de Menas de Cobre',
        'Atrezo y decoración',
        'Cúmulo de roca viva excavada con vetas cristalinas de malaquita y fragmentos de cobre nativo metálico.'
    )

    sphere('boulder-base-1', (0, 0, 0.38), (0.65, 0.72, 0.45), 'stone_dark', subdivisions=1)
    sphere('boulder-base-2', (-0.45, 0.32, 0.32), (0.52, 0.48, 0.38), 'stone_mid', subdivisions=1)
    sphere('boulder-base-3', (0.52, -0.25, 0.30), (0.48, 0.55, 0.35), 'stone_copper', subdivisions=1)
    sphere('boulder-top-cap', (0.08, 0.08, 0.68), (0.42, 0.38, 0.32), 'stone_copper', subdivisions=1)

    sphere('copper-nugget-1', (0.28, 0.22, 0.65), (0.22, 0.18, 0.14), 'copper_bright', subdivisions=1)
    sphere('copper-nugget-2', (-0.25, -0.28, 0.42), (0.18, 0.22, 0.12), 'copper_bright', subdivisions=1)

    sphere('crystal-crust-1', (-0.12, 0.35, 0.58), (0.16, 0.16, 0.12), 'crystal_ore', subdivisions=1)
    sphere('crystal-crust-2', (0.35, -0.15, 0.52), (0.15, 0.14, 0.10), 'crystal_ore', subdivisions=1)

    for i in range(6):
        ang = i * math.tau / 6.0 + 0.3
        sx = math.cos(ang) * 0.85
        sy = math.sin(ang) * 0.85
        sphere(f'rubble-{i}', (sx, sy, 0.1), (0.14, 0.15, 0.1), 'stone_dark', subdivisions=1)

    finish_asset()


# ==============================================================================
# 30. FUELLE GIGANTE DE FUNDICIÓN (Forge Pedestal Bellows)
# ==============================================================================
def build_bellows_forge_pedestal():
    start_asset(
        'bellows_forge_pedestal',
        'Fuelle Gigante de Fundición',
        'Atrezo y decoración',
        'Fuelle industrial de doble cámara con armazón de cedro y cuero claveteado, pedestal de sillería y tobera de cobre.'
    )

    box('bellows-pedestal', (0, 0.25, 0.35), (1.1, 1.4, 0.7), 'stone_dark', bevel=0.03)
    box('bellows-board-bot', (0, 0.25, 0.74), (0.95, 1.25, 0.08), 'wood_dark', bevel=0.015)
    box('bellows-board-mid', (0, 0.25, 0.98), (0.92, 1.22, 0.06), 'wood_mid', bevel=0.012)
    box('bellows-board-top', (0, 0.25, 1.28), (0.95, 1.25, 0.08), 'wood_dark', bevel=0.015, rotation=(-0.16, 0, 0))

    box('bellows-leather-chamber-1', (0, 0.25, 0.86), (0.86, 1.14, 0.16), 'leather_heavy', bevel=0.02)
    box('bellows-leather-chamber-2', (0, 0.25, 1.13), (0.86, 1.14, 0.18), 'leather_heavy', bevel=0.02, rotation=(-0.08, 0, 0))

    for sy in [0.0, 0.3, 0.6]:
        for sx in [-0.44, 0.44]:
            cyl(f'bellows-tack-{sx}-{sy}', (sx, sy, 0.76), 0.018, 0.02, 'bronze', vertices=6)
            cyl(f'bellows-tack-top-{sx}-{sy}', (sx, sy, 1.3), 0.018, 0.02, 'bronze', vertices=6)

    cyl('tuyere-cone', (0, -0.55, 0.82), 0.24, 0.38, 'copper', vertices=12, radius_top=0.14, rotation=(math.pi / 2.0, 0, 0))
    cyl('tuyere-nozzle', (0, -0.88, 0.82), 0.12, 0.32, 'copper_bright', vertices=10, rotation=(math.pi / 2.0, 0, 0))

    beam('pump-lever', (0, 0.85, 1.35), (0, 1.25, 1.85), 0.09, 'wood_light')
    sphere('lever-counterweight', (0, 1.25, 1.85), (0.16, 0.16, 0.16), 'stone_dark')

    finish_asset()


# ==============================================================================
# 31. ESTANDARTE DE GUERRA LAGTO' (Lagto' Clan War Standard)
# ==============================================================================
def build_banner_lagto_clan():
    start_asset(
        'banner_lagto_clan',
        'Estandarte de Guerra Lagto\'',
        'Atrezo y decoración',
        'Mástil ceremonial sobre peana tallada con punta de lanza en garra de cobre, pendón de lana roja y lingotes de contrapeso.'
    )

    box('banner-plinth-tier1', (0, 0, 0.12), (0.9, 0.9, 0.24), 'stone_dark', bevel=0.02)
    box('banner-plinth-tier2', (0, 0, 0.3), (0.7, 0.7, 0.18), 'stone_mid', bevel=0.02)
    cyl('banner-socket', (0, 0, 0.44), 0.14, 0.14, 'copper', vertices=8)
    cyl('banner-pole', (0, 0, 2.1), 0.065, 3.4, 'wood_dark', vertices=8)

    cyl('spear-collar', (0, 0, 3.82), 0.09, 0.12, 'copper_bright', vertices=8)
    cyl('spear-blade', (0, 0, 4.15), 0.14, 0.55, 'copper_bright', vertices=4, radius_top=0.01, rotation=(0, 0, math.pi / 4.0))

    beam('banner-crossbar', (-0.65, 0, 3.65), (0.65, 0, 3.65), 0.05, 'wood_dark')
    sphere('crossbar-knob-l', (-0.68, 0, 3.65), (0.055, 0.055, 0.055), 'bronze')
    sphere('crossbar-knob-r', (0.68, 0, 3.65), (0.055, 0.055, 0.055), 'bronze')

    box('banner-cloth-main', (0, -0.02, 2.45), (1.15, 0.03, 2.3), 'textile_red', bevel=0.005)
    box('banner-emblem-sun', (0, -0.04, 2.65), (0.45, 0.02, 0.45), 'textile_ochre', rotation=(0, 0, math.pi / 4.0))
    box('banner-emblem-claw-1', (0, -0.05, 2.68), (0.06, 0.02, 0.24), 'gold_inlay')
    box('banner-emblem-claw-2', (-0.08, -0.05, 2.64), (0.05, 0.02, 0.18), 'gold_inlay', rotation=(0, 0, -0.2))
    box('banner-emblem-claw-3', (0.08, -0.05, 2.64), (0.05, 0.02, 0.18), 'gold_inlay', rotation=(0, 0, 0.2))

    cyl('banner-weight-bar', (0, -0.02, 1.28), 0.03, 1.18, 'copper', vertices=8, rotation=(0, math.pi / 2.0, 0))
    for i in range(8):
        fx = -0.5 + i * 0.14
        box(f'banner-fringe-{i}', (fx, -0.02, 1.2), (0.07, 0.02, 0.12), 'textile_ochre')

    finish_asset()


# ==============================================================================
# 32. PARAPETO DEFENSIVO DE SILLAR Y COBRE (Spiked Stone Barrier)
# ==============================================================================
def build_barrier_spiked_stone():
    start_asset(
        'barrier_spiked_stone',
        'Parapeto Defensivo de Sillar y Cobre',
        'Atrezo y decoración',
        'Muro parapeto de granito con albardilla de chapa de cobre martillado y tres puas defensivas de hierro forjado.'
    )

    box('barrier-footing', (0, 0, 0.15), (2.4, 0.8, 0.3), 'stone_dark', bevel=0.03)
    box('barrier-wall-course', (0, 0, 0.65), (2.3, 0.68, 0.75), 'stone_mid', bevel=0.03)
    box('barrier-copper-cap', (0, 0, 1.08), (2.36, 0.74, 0.14), 'copper', bevel=0.02)
    for bx in [-0.85, 0.0, 0.85]:
        riveted_strap(f'barrier-strap-{bx}', bx, 0, 1.15, 0.74, 0.1, 0.015, 'copper_bright', rivets=4, axis='Y')

    for idx, sx in enumerate([-0.7, 0.0, 0.7]):
        box(f'spike-collar-{idx}', (sx, -0.38, 0.75), (0.12, 0.06, 0.12), 'iron_dark')
        cyl(f'iron-spike-{idx}', (sx, -0.65, 0.75), 0.045, 0.52, 'iron_light', vertices=4, radius_top=0.005, rotation=(math.pi / 2.0, 0, 0))

    finish_asset()


# ==============================================================================
# 33. POSTE DE PORTAL CON CADENAS (Quarry Gate Post)
# ==============================================================================
def build_gate_quarry_post():
    start_asset(
        'gate_quarry_post',
        'Poste de Portal con Cadenas',
        'Atrezo y decoración',
        'Monolito de portal escuadrado con collarín de cobre, argollas de anclaje y cadenas pesadas de suspensión.'
    )

    box('post-plinth-tier1', (0, 0, 0.18), (1.1, 1.1, 0.36), 'stone_dark', bevel=0.03)
    box('post-plinth-tier2', (0, 0, 0.44), (0.9, 0.9, 0.22), 'stone_mid', bevel=0.025)
    box('post-shaft', (0, 0, 1.8), (0.74, 0.74, 2.5), 'stone_mid', bevel=0.03)

    box('post-glyph-band', (0, 0, 2.2), (0.78, 0.78, 0.3), 'stone_light', bevel=0.015)
    riveted_strap('post-strap-f', 0, -0.4, 2.2, 0.65, 0.12, 0.015, 'copper', rivets=4, plane='XZ')
    riveted_strap('post-strap-r', 0.4, 0, 2.2, 0.65, 0.12, 0.015, 'copper', rivets=4, axis='Y', plane='YZ')

    box('post-capital', (0, 0, 3.15), (0.95, 0.95, 0.24), 'stone_light', bevel=0.02)
    cyl('post-copper-rooflet', (0, 0, 3.42), 0.58, 0.34, 'copper_bright', vertices=4, radius_top=0.08, rotation=(0, 0, math.pi / 4.0))

    box('post-ring-eyelet', (-0.4, 0, 1.9), (0.08, 0.16, 0.16), 'iron_dark')
    torus('post-anchor-ring', (-0.46, 0, 1.9), 0.09, 0.022, 'bronze', rotation=(math.pi / 2.0, 0, 0))

    beam('chain-link-1', (-0.46, 0, 1.85), (-0.6, 0, 1.45), 0.045, 'copper')
    beam('chain-link-2', (-0.6, 0, 1.45), (-0.75, 0, 0.85), 0.045, 'copper')
    beam('chain-link-3', (-0.75, 0, 0.85), (-0.88, 0, 0.12), 0.045, 'copper')

    finish_asset()


# ==============================================================================
# 34. CRISOL CON COBRE FUNDIDO (Molten Copper Crucible)
# ==============================================================================
def build_crucible_molten_copper():
    start_asset(
        'crucible_molten_copper',
        'Crisol con Cobre Fundido',
        'Atrezo y decoración',
        'Recipiente refractario cerámico sostenido por tenazas de colada con baño de cobre líquido incandescente.'
    )

    box('crucible-pad', (0, 0, 0.08), (1.1, 1.1, 0.16), 'stone_dark', bevel=0.02)
    crucible_profile = [
        (0.24, 0.16),
        (0.38, 0.32),
        (0.44, 0.55),
        (0.42, 0.78),
        (0.36, 0.82),
    ]
    lathe('crucible-body', (0, 0, 0), crucible_profile, 'ash', segments=14)
    box('crucible-spout', (0, -0.42, 0.78), (0.14, 0.12, 0.08), 'ash', bevel=0.01)

    cyl('molten-copper-bath', (0, 0, 0.72), 0.38, 0.06, 'ember_red', vertices=12)
    sphere('molten-copper-glow', (0, 0, 0.75), (0.22, 0.22, 0.04), 'amber_glow')

    torus('tongs-cradle-ring', (0, 0, 0.52), 0.45, 0.035, 'iron_dark')
    beam('tongs-handle-l', (-0.45, 0, 0.52), (-1.2, 0, 0.52), 0.05, 'iron_dark')
    beam('tongs-handle-r', (0.45, 0, 0.52), (1.2, 0, 0.52), 0.05, 'iron_dark')

    finish_asset()


# ==============================================================================
# 35. GRÚA DE CANTERA Y CABESTRANTE (Quarry Derrick Crane)
# ==============================================================================
def build_quarry_crane_derrick():
    start_asset(
        'quarry_crane_derrick',
        'Grúa de Cantera y Cabestrante',
        'Atrezo y decoración',
        'Cabria de cantera en caballete de cedro con tambor de torno, poleas de cobre y tenaza de elevación de sillares.'
    )

    box('crane-skid-l', (-0.75, 0, 0.1), (0.16, 2.2, 0.2), 'wood_dark', bevel=0.015)
    box('crane-skid-r', (0.75, 0, 0.1), (0.16, 2.2, 0.2), 'wood_dark', bevel=0.015)
    beam('crane-skid-cross-f', (-0.75, -0.9, 0.1), (0.75, -0.9, 0.1), 0.14, 'wood_dark')
    beam('crane-skid-cross-b', (-0.75, 0.9, 0.1), (0.75, 0.9, 0.1), 0.14, 'wood_dark')

    box('counterweight-block-l', (-0.75, 0.7, 0.35), (0.42, 0.6, 0.35), 'stone_dark', bevel=0.02)
    box('counterweight-block-r', (0.75, 0.7, 0.35), (0.42, 0.6, 0.35), 'stone_dark', bevel=0.02)

    beam('mast-post-l', (-0.75, -0.5, 0.2), (0, -0.9, 3.4), 0.16, 'wood_mid')
    beam('mast-post-r', (0.75, -0.5, 0.2), (0, -0.9, 3.4), 0.16, 'wood_mid')
    beam('mast-guy-rear', (0, 0.85, 0.2), (0, -0.9, 3.4), 0.16, 'wood_mid')

    box('pulley-housing', (0, -0.9, 3.45), (0.24, 0.28, 0.22), 'copper', bevel=0.015)
    torus('pulley-wheel', (0, -0.95, 3.45), 0.14, 0.028, 'bronze', rotation=(0, math.pi / 2.0, 0))

    cyl('winch-drum', (0, -0.4, 1.1), 0.15, 0.9, 'wood_dark', vertices=10, rotation=(0, math.pi / 2.0, 0))
    cyl('winch-crank-plate', (0.48, -0.4, 1.1), 0.22, 0.04, 'copper', vertices=8, rotation=(0, math.pi / 2.0, 0))
    beam('winch-crank-arm', (0.5, -0.4, 1.1), (0.5, -0.4, 1.45), 0.04, 'iron_dark')
    cyl('winch-crank-handle', (0.54, -0.4, 1.45), 0.025, 0.12, 'wood_light', rotation=(0, math.pi / 2.0, 0))

    cyl('suspended-rope', (0, -1.05, 2.2), 0.025, 2.4, 'leather_light')
    beam('tongs-scissor-1', (-0.18, -1.05, 1.1), (0.18, -1.05, 0.85), 0.035, 'iron_dark')
    beam('tongs-scissor-2', (0.18, -1.05, 1.1), (-0.18, -1.05, 0.85), 0.035, 'iron_dark')
    box('lifted-quarry-block', (0, -1.05, 0.5), (0.65, 0.65, 0.55), 'stone_light', bevel=0.025)

    finish_asset()


# ==============================================================================
# 36. CISTERNA DE ROCA Y FILTRO DE COBRE (Stone & Copper Water Cistern)
# ==============================================================================
def build_water_cistern_copper():
    start_asset(
        'water_cistern_copper',
        'Cisterna de Roca y Filtro de Cobre',
        'Atrezo y decoración',
        'Aljibe de sillería de montaña con rejilla de filtración de cobre, grifo de bronce y cubo de servicio zunchado.'
    )

    box('cistern-stone-body', (0, 0, 0.65), (1.8, 1.3, 1.1), 'stone_mid', bevel=0.04)
    box('cistern-water-pool', (0, 0, 1.05), (1.5, 1.0, 0.14), 'water')

    for gy in [-.50,.50]:
        box(f'filter-frame-edge-y-{gy}',(.42,gy,1.215),(.75,.06,.04),'copper',bevel=.007)
    for gx in [.075,.765]:
        box(f'filter-frame-edge-x-{gx}',(gx,0,1.215),(.06,.94,.04),'copper',bevel=.007)
    for gy in [-0.4, -0.2, 0.0, 0.2, 0.4]:
        box(f'filter-slot-{gy}', (0.42, gy, 1.235), (0.65, 0.04, 0.02), 'copper_dark')

    cyl('inflow-spout', (0.42, 0.65, 1.35), 0.08, 0.32, 'copper_patina', vertices=8, rotation=(math.pi / 2.0, 0, 0))
    cyl('spigot-neck', (-0.45, -0.68, 0.35), 0.03, 0.16, 'bronze', vertices=8, rotation=(math.pi / 2.0, 0, 0))
    box('spigot-valve-cross', (-0.45, -0.74, 0.42), (0.1, 0.03, 0.03), 'copper_bright')

    cyl('dipper-bucket-staves', (-0.45, -0.85, 0.18), 0.16, 0.32, 'wood_mid', vertices=10)
    torus('bucket-copper-hoop', (-0.45, -0.85, 0.26), 0.165, 0.015, 'copper')
    torus('bucket-handle-arch', (-0.45, -0.85, 0.38), 0.15, 0.012, 'iron_dark')

    finish_asset()


# ==============================================================================
# 37. DESVÍO Y AGUJA DE VÍA MINERA (Mine Cart Turnout) - NUEVO
# ==============================================================================
def build_mine_cart_turnout():
    start_asset(
        'mine_cart_turnout',
        'Desvío y Aguja de Vía Minera',
        'Atrezo y decoración',
        'Aguja de desvío ferroviario con corazón de vía en fundición, palanca manual de contrapeso y placa de cobre.'
    )

    # 6 Wide curved sleepers
    for i in range(6):
        ty = -1.5 + i * 0.6
        w = 1.1 + (i * 0.16)
        ox = i * 0.08
        box(f'turnout-sleeper-{i}', (ox, ty, 0.05), (w, 0.22, 0.1), 'wood_dark', bevel=0.012)

    # Straight rail pair
    for rx in [-0.38, 0.38]:
        box(f'straight-rail-{rx}', (rx, 0, 0.18), (0.06, 3.4, 0.07), 'iron_light', bevel=0.005)

    # Diverging curved rail pair (veering right +X)
    for idx, (px, py) in enumerate([(0.0, -0.6), (0.28, 0.2), (0.65, 1.0), (1.05, 1.6)]):
        box(f'curve-rail-l-{idx}', (px - 0.2, py, 0.18), (0.06, 0.8, 0.07), 'iron_light', bevel=0.005, rotation=(0, 0, -0.28))
        box(f'curve-rail-r-{idx}', (px + 0.38, py, 0.18), (0.06, 0.8, 0.07), 'iron_light', bevel=0.005, rotation=(0, 0, -0.28))

    # Switch ground throw lever mechanism on side (-X)
    box('switch-stand-mount', (-0.95, -1.2, 0.14), (0.25, 0.35, 0.12), 'stone_dark', bevel=0.01)
    cyl('switch-pivot', (-0.95, -1.2, 0.24), 0.04, 0.15, 'copper', vertices=8)
    beam('switch-throw-lever', (-0.95, -1.2, 0.28), (-0.95, -1.45, 0.75), 0.04, 'iron_dark')
    sphere('switch-counterweight-ball', (-0.95, -1.45, 0.75), (0.09, 0.09, 0.09), 'copper_bright')

    finish_asset()


# ==============================================================================
# 38. MOLINO TRITURADOR DE MINERAL (Ore Stamp Crusher) - NUEVO
# ==============================================================================
def build_crusher_ore_stamp():
    start_asset(
        'crusher_ore_stamp',
        'Molino Triturador de Mineral',
        'Atrezo y decoración',
        'Mortero de trituración de sillar con dos mazas verticales de cedro calzadas en bronce, árbol de levas y tolva de descarga.'
    )

    # Heavy stone mortar trough base
    box('crusher-mortar-trough', (0, 0, 0.35), (2.0, 1.2, 0.7), 'stone_dark', bevel=0.03)
    box('crusher-mortar-cavity', (0, 0, 0.55), (1.5, 0.75, 0.35), 'stone_copper')

    # Two vertical guide frame timber posts
    for sx in [-0.85, 0.85]:
        beam(f'crusher-guide-post-{sx}', (sx, 0, 0.5), (sx, 0, 3.2), 0.18, 'wood_dark')
        box(f'crusher-post-shoe-{sx}', (sx, 0, 0.7), (0.26, 0.26, 0.3), 'copper')

    # Top cross beam
    beam('crusher-top-beam', (-0.9, 0, 3.1), (0.9, 0, 3.1), 0.18, 'wood_dark')

    # Two vertical drop stamp lifter rods with heavy bronze/iron shoes
    for idx, sx in enumerate([-0.38, 0.38]):
        cyl(f'stamp-rod-{idx}', (sx, 0, 1.8), 0.065, 2.2, 'wood_mid', vertices=8)
        # Heavy copper/bronze crushing shoe head at bottom
        box(f'stamp-shoe-{idx}', (sx, 0, 0.85), (0.34, 0.34, 0.4), 'bronze', bevel=0.02)
        # Cam follower tappet collar on rod
        torus(f'tappet-collar-{idx}', (sx, 0, 2.2), 0.09, 0.025, 'iron_dark')

    # Camshaft driving axle
    cyl('crusher-camshaft', (0, -0.22, 2.2), 0.06, 2.2, 'iron_dark', vertices=8, rotation=(0, math.pi / 2.0, 0))
    # Copper flywheel pulley at end (+X)
    torus('crusher-flywheel-rim', (1.05, -0.22, 2.2), 0.45, 0.035, 'copper_bright', rotation=(0, math.pi / 2.0, 0))

    finish_asset()


# ==============================================================================
# 39. PILA DE LINGOTES DE COBRE (Copper Ingot Stack) - NUEVO
# ==============================================================================
def build_ingot_stack_copper():
    start_asset(
        'ingot_stack_copper',
        'Pila de Lingotes de Cobre',
        'Atrezo y decoración',
        'Estiba de lingotes de cobre de fundición con marcas de ceca sobre palé de cedro y precinto de fleje de hierro.'
    )

    # Heavy cedar skid pallet
    for sx in [-0.48, 0.48]:
        box(f'pallet-runner-{sx}', (sx, 0, 0.06), (0.12, 1.2, 0.12), 'wood_dark')
    for py in [-0.45, -0.15, 0.15, 0.45]:
        box(f'pallet-deck-{py}', (0, py, 0.14), (1.1, 0.18, 0.04), 'wood_mid')

    # Stack of cast copper ingots (3 tiers of alternating crossed rows)
    # Tier 1 (4 ingots along Y)
    for ix in [-0.36, -0.12, 0.12, 0.36]:
        box(f'ingot-t1-{ix}', (ix, 0, 0.22), (0.18, 0.82, 0.09), 'copper_bright', bevel=0.01)
    # Tier 2 (4 ingots along X)
    for iy in [-0.32, -0.1, 0.1, 0.32]:
        box(f'ingot-t2-{iy}', (0, iy, 0.32), (0.84, 0.18, 0.09), 'copper', bevel=0.01)
    # Tier 3 (3 ingots along Y)
    for ix in [-0.24, 0.0, 0.24]:
        box(f'ingot-t3-{ix}', (ix, 0, 0.42), (0.18, 0.74, 0.09), 'copper_bright', bevel=0.01)

    # Iron security strapping bands binding the stack
    for bx in [-0.25, 0.25]:
        box(f'strap-band-{bx}', (bx, 0, 0.28), (0.03, 0.9, 0.32), 'iron_dark')

    finish_asset()


# ==============================================================================
# 40. POZO DE VENTILACIÓN MINERO (Ventilation Windlass Shaft) - NUEVO
# ==============================================================================
def build_ventilation_windlass_shaft():
    start_asset(
        'ventilation_windlass_shaft',
        'Pozo de Ventilación Minero',
        'Atrezo y decoración',
        'Chimenea de ventilación de pozo minero en sillería con caperuza giratoria de cobre, veleta y rejilla de seguridad.'
    )

    box('vent-foundation', (0, 0, 0.2), (1.6, 1.6, 0.4), 'stone_dark', bevel=0.03)
    cyl('vent-stone-flue', (0, 0, 1.1), 0.65, 1.4, 'stone_mid', vertices=10, radius_top=0.6)

    # Heavy copper intake collar
    box('vent-copper-cornice', (0, 0, 1.85), (1.45, 1.45, 0.14), 'copper', bevel=0.015)

    # Rotating copper wind cowl hood with tail vane
    cyl('cowl-base-neck', (0, 0, 2.05), 0.42, 0.28, 'copper_dark', vertices=10)
    cyl('cowl-hood-body', (0, -0.15, 2.35), 0.55, 0.45, 'copper_patina', vertices=8, rotation=(math.pi / 2.0, 0, 0), radius_top=0.35)

    # Large direction wind vane fin attached to cowl rear (+Y)
    box('vane-tail-sheet', (0, 0.42, 2.45), (0.02, 0.65, 0.35), 'copper_bright', bevel=0.005)

    # Security iron grate inside flue
    for gx in [-0.3, 0.0, 0.3]:
        beam(f'grate-bar-{gx}', (gx, -0.45, 1.7), (gx, 0.45, 1.7), 0.03, 'iron_dark')

    finish_asset()


# ==============================================================================
# 41. TÓTEM ALMENARA DE LAS CUMBRES (Warning Beacon Totem) - NUEVO
# ==============================================================================
def build_warning_beacon_totem():
    start_asset(
        'warning_beacon_totem',
        'Tótem Almenara de las Cumbres',
        'Atrezo y decoración',
        'Columna monolítica tallada con cabeza de saurio en altorrelieve que sostiene en sus fauces un pebetero de señales de cobre.'
    )

    # Stepped plinth
    box('totem-plinth-1', (0, 0, 0.15), (1.1, 1.1, 0.3), 'stone_dark', bevel=0.03)
    box('totem-plinth-2', (0, 0, 0.4), (0.85, 0.85, 0.22), 'stone_mid', bevel=0.02)

    # Monumental square stone pillar shaft
    box('totem-shaft', (0, 0, 1.6), (0.68, 0.68, 2.2), 'stone_mid', bevel=0.025)

    # Carved lizard scale relief belt in copper
    riveted_strap('totem-belt-f', 0, -0.36, 1.6, 0.62, 0.14, 0.015, 'copper', rivets=4, plane='XZ')
    riveted_strap('totem-belt-r', 0.36, 0, 1.6, 0.62, 0.14, 0.015, 'copper', rivets=4, axis='Y', plane='YZ')

    # Stylized lizard head bracket projecting forward at top (-Y)
    box('lizard-head-cranium', (0, -0.32, 2.75), (0.55, 0.55, 0.42), 'stone_dark', bevel=0.03)
    # Snout
    box('lizard-snout', (0, -0.65, 2.68), (0.42, 0.42, 0.28), 'stone_mid', bevel=0.02)
    # Lower jaw
    box('lizard-lower-jaw', (0, -0.62, 2.45), (0.38, 0.38, 0.14), 'stone_dark')

    # Beaten copper beacon dish held in jaws
    copper_brazier('totem-beacon-fire', 0, -0.75, 2.8, radius=0.45, height=0.35, mat='copper_bright')

    finish_asset()


# ==============================================================================
# 42. GEODA GIGANTE DE MALAQUITA Y AZURITA (Crystal Geode Boulder) - NUEVO
# ==============================================================================
def build_cavern_crystal_geode():
    start_asset(
        'cavern_crystal_geode',
        'Geoda Gigante de Malaquita y Azurita',
        'Atrezo y decoración',
        'Bloque de roca hendida de las cumbres que revela una cavidad interior tapizada de cristales de malaquita verde y azurita.'
    )

    # Outer rock husk (thick spherical shell cleaved in half)
    sphere('geode-shell-back', (0, 0.15, 0.58), (0.75, 0.65, 0.55), 'stone_dark', subdivisions=1)
    sphere('geode-shell-flank-l', (-0.52, -0.05, 0.48), (0.42, 0.45, 0.42), 'stone_copper', subdivisions=1)
    sphere('geode-shell-flank-r', (0.52, -0.05, 0.48), (0.42, 0.45, 0.42), 'stone_copper', subdivisions=1)

    # Open cavity face facing front (-Y)
    # Crystalline druse cavity bed
    sphere('geode-inner-druse', (0, 0, 0.56), (0.58, 0.42, 0.44), 'crystal_ore', subdivisions=1)

    # Jagged crystalline cluster spikes inside
    crystal_spikes = [
        (-0.25, -0.15, 0.65, 0.18, 0.12),
        (0.22, -0.12, 0.68, 0.16, 0.14),
        (0.0, -0.18, 0.45, 0.15, 0.12),
        (-0.15, -0.08, 0.38, 0.12, 0.10),
        (0.18, -0.05, 0.42, 0.14, 0.12),
    ]
    for idx, (cx, cy, cz, rad, h) in enumerate(crystal_spikes):
        cyl(f'crystal-spike-{idx}', (cx, cy, cz), rad, h, 'crystal_ore', vertices=5, radius_top=0.01)

    # Native copper vein running across rock fracture edge
    sphere('geode-copper-vein', (-0.35, -0.22, 0.72), (0.12, 0.18, 0.08), 'copper_bright')

    finish_asset()


# ==============================================================================
# 43. CANALETA DE LAVADO DE MINERAL (Water Flume Sluice) - NUEVO
# ==============================================================================
def build_water_flume_sluice():
    start_asset(
        'water_flume_sluice',
        'Canaleta de Lavado de Mineral',
        'Atrezo y decoración',
        'Canaleta inclinada de lavado de oro y cobre sobre caballetes de cedro con deflectores de cobre para decantación de arenas.'
    )

    # Two A-frame support trestles at different heights (slanted flume)
    # High trestle at rear (+Y, Z=1.1)
    box('trestle-high-tie', (0, 1.1, 0.95), (0.85, 0.12, 0.1), 'wood_dark')
    beam('trestle-high-leg-l', (-0.4, 1.1, 0.1), (-0.1, 1.1, 1.05), 0.1, 'wood_dark')
    beam('trestle-high-leg-r', (0.4, 1.1, 0.1), (0.1, 1.1, 1.05), 0.1, 'wood_dark')

    # Low trestle at front (-Y, Z=0.55)
    box('trestle-low-tie', (0, -1.1, 0.45), (0.85, 0.12, 0.1), 'wood_dark')
    beam('trestle-low-leg-l', (-0.35, -1.1, 0.1), (-0.1, -1.1, 0.55), 0.1, 'wood_dark')
    beam('trestle-low-leg-r', (0.35, -1.1, 0.1), (0.1, -1.1, 0.55), 0.1, 'wood_dark')

    # Main slanted U-trough flume (slanted downward from +Y to -Y)
    box('flume-bottom-board', (0, 0, 0.78), (0.65, 2.6, 0.06), 'wood_mid', rotation=(-0.22, 0, 0))
    box('flume-side-l', (-0.32, 0, 0.88), (0.05, 2.6, 0.22), 'wood_mid', rotation=(-0.22, 0, 0))
    box('flume-side-r', (0.32, 0, 0.88), (0.05, 2.6, 0.22), 'wood_mid', rotation=(-0.22, 0, 0))

    # Water stream flowing through flume
    box('flume-water-flow', (0, 0, 0.81), (0.58, 2.55, 0.03), 'water', rotation=(-0.22, 0, 0))

    # Transverse copper ripple riffles catching heavy ore grains
    for i in range(5):
        fy = -0.8 + i * 0.4
        fz = 0.62 + i * 0.088
        box(f'flume-riffle-{i}', (0, fy, fz), (0.58, 0.04, 0.04), 'copper_bright', rotation=(-0.22, 0, 0))

    finish_asset()


# ==============================================================================
# 44. TIENDA DE CAMPAÑA MINERA (Miner Outpost Tent) - NUEVO
# ==============================================================================
def build_tent_miner_outpost():
    start_asset(
        'tent_miner_outpost',
        'Tienda de Campaña Minera',
        'Atrezo y decoración',
        'Pabellón de campaña para prospección en cumbres con cubiertas de lona y piel encerada, mástiles de cedro y farol de interior.'
    )

    # 1. Ground groundsheet / floor canvas
    box('tent-groundsheet', (0, 0, 0.02), (2.8, 2.6, 0.04), 'leather_heavy')

    # 2. Main timber A-frame ridgepoles
    beam('ridge-pole', (0, -1.1, 2.1), (0, 1.1, 2.1), 0.1, 'wood_dark')
    beam('tent-pole-front', (0, -1.1, 0.1), (0, -1.1, 2.15), 0.09, 'wood_dark')
    beam('tent-pole-rear', (0, 1.1, 0.1), (0, 1.1, 2.15), 0.09, 'wood_dark')

    # 3. Pitched tent canvas canopy (slanted sides)
    pitch=math.atan2(2.04,1.4)
    canvas_length=math.hypot(2.04,1.4)
    box('tent-canvas-l', (-0.70, 0, 1.08), (canvas_length, 2.4, 0.04), 'textile_red', bevel=0.01, rotation=(0, -pitch, 0))
    box('tent-canvas-r', (0.70, 0, 1.08), (canvas_length, 2.4, 0.04), 'textile_red', bevel=0.01, rotation=(0, pitch, 0))

    # Ochre weather-proofing strip along ridge
    box('ridge-copper-cap', (0, 0, 2.18), (0.24, 2.45, 0.06), 'copper', bevel=0.01)

    # 4. Flapped entrance on front (-Y)
    box('tent-flap-l', (-0.45, -1.15, 1.05), (0.6, 0.02, 1.8), 'textile_ochre', rotation=(0, 0.35, 0))

    # 5. Hanging lantern inside tent entry
    copper_lantern_pendant('tent-entry-lantern', 0, -0.7, 1.35, scale=0.65)

    # 6. Exterior equipment pack resting outside
    box('expedition-pack', (1.65, -0.85, 0.21), (0.45, 0.55, 0.42), 'leather_light', bevel=0.02)
    box('pack-strap', (1.65, -0.85, 0.44), (0.47, 0.06, 0.03), 'copper')

    finish_asset()
