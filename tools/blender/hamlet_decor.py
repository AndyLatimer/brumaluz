"""Twelve original, grounded decoration assets for the Brumaluz hamlet.

Construction pieces remain separate and named in the editable Blender source.
Every component uses the shared painted atlas. Front is -Y; dimensions are m.
"""
from hamlet_common import *


def _ring(name, center, outer, inner, bottom, top, mat='iron', segments=16):
    """A real annulus: open centre, closed inner/outer walls and two lips."""
    x, y, z = center
    verts = [(x + r * math.cos(i * math.tau / segments),
              y + r * math.sin(i * math.tau / segments), z + zz)
             for r, zz in [(outer, bottom), (outer, top), (inner, top), (inner, bottom)]
             for i in range(segments)]
    faces = []
    for row in range(4):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((row * segments + i, row * segments + j,
                          ((row + 1) % 4) * segments + j,
                          ((row + 1) % 4) * segments + i))
    return mesh(name, verts, faces, mat)


def _stone_wedge(name, angle, span, inner, outer, bottom, top, mat='stone'):
    """Individually mortared, chamfered voussoir; no hidden basin lid."""
    chamfer = .018
    profile = [(outer - chamfer, bottom), (outer, bottom + chamfer),
               (outer, top - chamfer), (outer - chamfer, top),
               (inner + chamfer, top), (inner, top - chamfer),
               (inner, bottom + chamfer), (inner + chamfer, bottom)]
    verts = [(r * math.cos(a), r * math.sin(a), z)
             for a in [angle - span / 2, angle + span / 2]
             for r, z in profile]
    n = len(profile)
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, verts, faces, mat)


def _leaf(name, start, tip, width=.10, mat='leaf'):
    a, b = Vector(start), Vector(tip)
    direction = b - a
    side = Vector((-direction.y, direction.x, 0))
    if side.length < .001:
        side = Vector((1, 0, 0))
    side.normalize()
    outline = [a, a + direction * .28 + side * width,
               a + direction * .68 + side * width * .72, b,
               a + direction * .68 - side * width * .72,
               a + direction * .28 - side * width]
    ridge = a + direction * .48 + Vector((0, 0, width * .28))
    underside = ridge - Vector((0, 0, .018))
    verts = [tuple(p) for p in outline + [ridge, underside]]
    faces = [(i, (i + 1) % 6, 6) for i in range(6)]
    faces += [((i + 1) % 6, i, 7) for i in range(6)]
    return mesh(name, verts, faces, mat)


def _flower(name, x, y, z, color='linen', scale=1):
    cyl(name + '-stem', (x, y, z - .095 * scale), .012 * scale, .19 * scale, 'leaf_dark', 6)
    for i in range(5):
        angle = i * math.tau / 5
        sphere(name + '-petal', (x + math.cos(angle) * .055 * scale,
                                y + math.sin(angle) * .055 * scale, z),
               (.056 * scale, .044 * scale, .023 * scale), color)
    sphere(name + '-heart', (x, y, z + .02 * scale), (.028 * scale,) * 3, 'amber')


def _arrow(name, center, width, height, direction=1, mat='wood'):
    x, y, z = center
    edge = width / 2
    outline = [(-edge, -height / 2), (edge - height * .65, -height / 2),
               (edge, 0), (edge - height * .65, height / 2), (-edge, height / 2)]
    verts = [(x + direction * xx, y + yy, z + zz)
             for yy in [-.055, .055] for xx, zz in outline]
    faces = [tuple(reversed(range(5))), tuple(range(5, 10))]
    faces += [(i, (i + 1) % 5, (i + 1) % 5 + 5, i + 5) for i in range(5)]
    return mesh(name, verts, faces, mat)


def _vegetables(name, x, y, z, count=9):
    for i in range(count):
        xx = x + ((i % 3) - 1) * .15
        yy = y + ((i // 3) - (count // 3 - 1) / 2) * .15
        if i % 3 == 0:
            sphere(name + '-cabbage', (xx, yy, z), (.12, .11, .10), 'leaf_light')
            for j in range(3):
                angle = j * math.tau / 3
                _leaf(name + '-cabbage-leaf', (xx, yy, z - .07),
                      (xx + math.cos(angle) * .13, yy + math.sin(angle) * .13, z + .03), .055, 'leaf')
        else:
            sphere(name + '-apple', (xx, yy, z), (.075, .073, .072), 'red' if i % 2 else 'wood_light')
            cyl(name + '-fruit-stem', (xx, yy, z + .077), .01, .045, 'wood_dark', 5)


def build_lantern_street_oak():
    start_asset('lantern_street_oak', 'Farol del barrio', 'Decoración')
    box('foot-chamfered-stone', (0, .08, .085), (.37, .37, .17), 'stone', .025)
    box('oak-post', (0, .08, 1.31), (.15, .15, 2.36), 'wood', .022)
    for zz in [.22, .38, 1.91, 2.43]:
        box('post-collar', (0, .08, zz), (.185, .185, .065), 'iron', .01)
    box('hanging-crossarm', (0, -.245, 2.50), (.13, .80, .12), 'wood_light', .02)
    beam('diagonal-arm-brace', (0, .08, 2.10), (0, -.45, 2.45), .085, 'wood_dark')
    beam('lantern-hook', (0, -.49, 2.50), (0, -.49, 2.43), .035, 'iron')
    lantern('amber-lantern', (0, -.49, 1.82), 1.2)
    for yy in [-.62, -.36]:
        beam('lantern-crossbar', (-.12, yy, 1.96), (.12, yy, 1.96), .025, 'iron')
    cyl('post-cap', (0, .08, 2.545), .13, .11, 'wood_light', 4, radius_top=.025)
    for zz in [.25, 2.43]:
        sphere('collar-rivet', (0, -.027, zz), (.024, .017, .024), 'brass')
    finish_asset()


def build_lantern_wall():
    start_asset('lantern_wall', 'Farol de pared', 'Decoración')
    # The mounting plate, rather than a metre of invisible empty space, starts at Z=0.
    box('wall-mount-plate', (0, .13, .31), (.18, .065, .62), 'iron', .025)
    box('oak-mount-inlay', (0, .09, .31), (.11, .04, .46), 'wood', .012)
    beam('wall-arm', (0, .10, .59), (0, -.29, .62), .055, 'iron')
    beam('wall-curved-brace', (0, .09, .40), (0, -.23, .61), .035, 'iron')
    beam('hanging-hook', (0, -.29, .62), (0, -.29, .54), .027, 'iron')
    lantern('warm-wall-lantern', (0, -.29, .025), 1)
    for xx in [-.105, .105]:
        beam('glass-lattice', (xx, -.395, .10), (-xx, -.395, .31), .018, 'iron')
    for zz in [.075, .55]:
        for xx in [-.055, .055]:
            sphere('mount-bolt', (xx, .088, zz), (.018, .015, .018), 'brass')
    finish_asset()


def build_signpost_crossroads():
    start_asset('signpost_crossroads', 'Señal de caminos', 'Decoración')
    box('foot-stone', (0, 0, .08), (.34, .34, .16), 'stone', .025)
    box('weathered-oak-post', (0, 0, 1), (.16, .16, 1.90), 'wood', .02)
    cyl('post-pointed-cap', (0, 0, 1.94), .145, .12, 'wood_light', 4, radius_top=.025)
    for z, direction, x in [(1.65, 1, .19), (1.28, -1, -.15)]:
        _arrow('direction-arrow', (x, -.12, z), 1.22, .27, direction, 'wood_light')
        _arrow('painted-arrow-inlay', (x, -.18, z), 1.07, .18, direction, 'teal' if direction == 1 else 'linen')
        for zz in [-.095, .095]:
            box('board-edge', (x - direction * .06, -.184, z + zz), (.85, .024, .024), 'wood_dark', .004)
        for xx in [-.27, .27]:
            sphere('arrow-rivet', (x + xx, -.20, z), (.021, .014, .021), 'iron')
        for xx in [-.16, .04]:
            beam('carved-trail-mark', (x + xx - .025, -.205, z - .044),
                 (x + xx + .02, -.205, z + .035), .025, 'wood_dark')
    _leaf('herbalist-way-symbol', (.35, -.21, 1.59), (.45, -.21, 1.73), .036, 'linen')
    box('post-bottom-ferrule', (0, 0, .25), (.18, .18, .13), 'iron', .012)
    for zz in [.25, .91]:
        sphere('post-fixing', (0, -.10, zz), (.027, .018, .027), 'brass')
    finish_asset()


def build_planter_herb_trough():
    start_asset('planter_herb_trough', 'Jardinera aromática', 'Decoración')
    for xx in [-.48, .48]:
        box('raised-oak-foot', (xx, 0, .065), (.18, .49, .13), 'wood_dark', .018)
    box('bottom-planks', (0, 0, .17), (1.30, .43, .10), 'wood_dark', .018)
    for yy in [-.24, .24]:
        for zz in [.24, .38]:
            box('long-wall-plank', (0, yy, zz), (1.40, .075, .13), 'wood_mid' if zz < .3 else 'wood', .014)
        box('upper-rounded-lip', (0, yy, .47), (1.46, .095, .07), 'wood_light', .018)
    for xx in [-.675, .675]:
        box('end-board', (xx, 0, .32), (.08, .49, .30), 'wood', .016)
        for yy in [-.17, .17]:
            box('corner-iron-strap', (xx, yy, .32), (.10, .045, .28), 'iron', .008)
            sphere('strap-nail', (xx, yy - .025, .41), (.019, .014, .019), 'brass')
    box('recessed-rich-soil', (0, 0, .405), (1.24, .39, .065), 'soil', .014)
    for i in range(5):
        xx = -.49 + i * .245
        yy = -.035 if i % 2 else .035
        stemtop = .72 + (i % 3) * .07
        beam('herb-stalk', (xx, yy, .42), (xx + .02, yy, stemtop), .018, 'leaf_dark')
        for j in range(5):
            angle = j * math.tau / 5 + i * .4
            _leaf('sage-leaf', (xx, yy, .50 + j * .02),
                  (xx + math.cos(angle) * .17, yy + math.sin(angle) * .17, .65 + (j % 2) * .09),
                  .060, 'leaf' if (i + j) % 2 else 'leaf_light')
        if i % 2 == 0:
            _flower('herb-blossom', xx + .015, yy, stemtop + .055, 'book_purple', .72)
    finish_asset()


def build_planter_flower_urn():
    start_asset('planter_flower_urn', 'Maceta de flores', 'Decoración')
    lathe('terracotta-urn', (0, 0, 0),
          [(0, .015), (.20, .015), (.24, .07), (.24, .13), (.17, .16),
           (.24, .22), (.32, .38), (.34, .52), (.30, .61), (.29, .65),
           (.25, .65), (.27, .58), (.28, .45), (.20, .27), (0, .24)], 'pot', 14)
    _ring('rolled-urn-rim', (0, 0, 0), .325, .25, .615, .675, 'roof_light', 14)
    _ring('lower-urn-collar', (0, 0, 0), .245, .19, .065, .10, 'roof_light', 14)
    cyl('soil-visible-between-stems', (0, 0, .60), .25, .025, 'soil', 14)
    for side in [-1, 1]:
        torus('urn-loop-handle', (side * .315, 0, .44), .09, .027, 'pot', (math.pi / 2, 0, 0))
    for i in range(7):
        angle = i * math.tau / 7
        xx, yy = .15 * math.cos(angle), .15 * math.sin(angle)
        flowerz = .86 + .11 * (i % 3)
        beam('flower-supporting-stalk', (xx, yy, .60), (xx, yy, flowerz - .07), .016, 'leaf_dark')
        _flower('garden-flower', xx, yy, flowerz, 'red' if i % 3 else 'linen')
        _leaf('trailing-leaf', (xx, yy, .66),
              (math.cos(angle) * .38, math.sin(angle) * .38, .76), .11,
              'leaf_light' if i % 2 else 'leaf')
    finish_asset()


def build_barrel_cider():
    start_asset('barrel_cider', 'Barril de sidra con grifo', 'Decoración')
    rings = [(.035, .32), (.16, .37), (.49, .425), (.81, .37), (.94, .32)]
    count = 14
    for i in range(count):
        a = math.tau * i / count
        spread = math.tau / count * .475
        verts = [(r * math.cos(phi), r * math.sin(phi), z)
                 for z, radius in rings
                 for r, phi in [(radius, a - spread), (radius, a + spread),
                                (radius - .035, a + spread), (radius - .035, a - spread)]]
        faces = [tuple(reversed(range(4))), tuple(range(16, 20))]
        for row in range(4):
            for edge in range(4):
                faces.append((row * 4 + edge, row * 4 + (edge + 1) % 4,
                              (row + 1) * 4 + (edge + 1) % 4, (row + 1) * 4 + edge))
        mesh('bowed-oak-stave', verts, faces, 'wood' if i % 3 else 'wood_mid')
    cyl('barrel-bottom', (0, 0, .05), .32, .08, 'wood_dark', 14)
    for zz, radius in [(.14, .373), (.30, .409), (.70, .409), (.85, .373)]:
        _ring('forged-iron-hoop', (0, 0, 0), radius + .018, radius - .010, zz - .025, zz + .025, 'iron', 14)
        for j in range(4):
            angle = j * math.pi / 2
            sphere('hoop-rivet', ((radius + .024) * math.cos(angle), (radius + .024) * math.sin(angle), zz),
                   (.018, .018, .018), 'brass')
    for i in range(5):
        xx = (i - 2) * .112
        length = 2 * math.sqrt(max(0, .305 ** 2 - xx ** 2))
        box('barrel-head-plank', (xx, 0, .945), (.105, length, .045), 'wood_light' if i % 2 else 'wood', .009)
    _ring('head-rim', (0, 0, 0), .343, .305, .925, .975, 'wood_dark', 14)
    cyl('cider-bung', (.10, .06, .979), .045, .027, 'wood_dark', 10)
    cyl('tap-seat', (0, -.403, .32), .073, .085, 'wood_dark', 10, (math.pi / 2, 0, 0))
    cyl('brass-tap-spout', (0, -.478, .32), .031, .115, 'brass', 8, (math.pi / 2, 0, 0))
    cyl('downturned-tap-mouth', (0, -.53, .289), .033, .068, 'brass', 8)
    cyl('spout-dark-opening', (0, -.53, .253), .022, .009, 'wood_dark', 8)
    box('wooden-tap-handle', (0, -.465, .40), (.16, .055, .035), 'wood_dark', .01)
    box('cider-maker-label', (0, -.416, .60), (.23, .035, .18), 'teal', .025)
    sphere('carved-apple-emblem', (0, -.44, .60), (.06, .015, .06), 'linen')
    _leaf('emblem-apple-leaf', (0, -.445, .655), (.05, -.445, .69), .02, 'linen')
    finish_asset()


def build_crate_harvest():
    start_asset('crate_harvest', 'Caja de cosecha', 'Decoración')
    for xx in [-.36, .36]:
        box('bottom-skid', (xx, 0, .04), (.085, .65, .08), 'wood_dark', .012)
    for i in range(5):
        box('crate-floor-plank', ((i - 2) * .18, 0, .105), (.172, .64, .07), 'wood', .009)
    for yy in [-.34, .34]:
        for zz in [.20, .34, .48]:
            box('slatted-long-side', (0, yy, zz), (.96, .065, .105), 'wood' if zz < .4 else 'wood_light', .014)
        for xx in [-.41, .41]:
            box('corner-upright', (xx, yy, .30), (.085, .095, .44), 'wood_dark', .011)
            for zz in [.20, .48]:
                sphere('crate-nail', (xx, yy + math.copysign(.052, yy), zz), (.018, .013, .018), 'iron')
    for xx in [-.46, .46]:
        for zz in [.20, .34]:
            box('slatted-end', (xx, 0, zz), (.065, .64, .105), 'wood_mid', .012)
        # Two short shoulders leave a real, visible handhold below the top rail.
        for yy in [-.245, .245]:
            box('handle-shoulder', (xx, yy, .48), (.07, .16, .105), 'wood_light', .012)
        box('handle-top-rail', (xx, 0, .555), (.075, .66, .06), 'wood_light', .012)
    box('protective-straw-bed', (0, 0, .235), (.84, .55, .19), 'linen', .028)
    _vegetables('harvest', 0, 0, .39, 9)
    finish_asset()


def build_market_handcart():
    start_asset('market_handcart', 'Carro de verdulero', 'Decoración')
    cy = .55
    for i in range(6):
        box('cart-floor-plank', ((i - 2.5) * .19, cy, .64), (.18, 1.53, .085), 'wood' if i % 2 else 'wood_mid', .012)
    for yy in [.04, 1.10]:
        box('floor-cross-support', (0, yy, .55), (1.28, .12, .12), 'wood_dark', .018)
    cyl('continuous-iron-axle', (0, cy, .44), .055, 1.72, 'iron', 10, (0, math.pi / 2, 0))
    for xx in [-.78, .78]:
        torus('wheel-oak-felloe', (xx, cy, .44), .365, .060, 'wood_dark', (0, math.pi / 2, 0))
        torus('wheel-iron-tyre', (xx, cy, .44), .413, .023, 'iron', (0, math.pi / 2, 0))
        cyl('wheel-hub', (xx, cy, .44), .095, .18, 'wood_light', 10, (0, math.pi / 2, 0))
        cyl('axle-pin-cap', (xx + math.copysign(.105, xx), cy, .44), .053, .035, 'iron', 8, (0, math.pi / 2, 0))
        for j in range(8):
            angle = j * math.tau / 8
            beam('radial-wheel-spoke', (xx, cy, .44),
                 (xx, cy + math.cos(angle) * .36, .44 + math.sin(angle) * .36), .045, 'wood_light')
    for xx in [-.61, .61]:
        for zz in [.78, .94, 1.10]:
            box('sideboard', (xx, cy, zz), (.075, 1.60, .12), 'wood_mid' if zz == .94 else 'wood', .014)
        for yy in [-.20, 1.30]:
            box('corner-post', (xx, yy, .90), (.10, .11, .65), 'wood_dark', .018)
            for zz in [.77, 1.10]:
                sphere('cart-corner-bolt', (xx + math.copysign(.063, xx), yy, zz), (.019, .019, .019), 'iron')
    for yy in [-.24, 1.34]:
        for zz in [.78, .94, 1.10]:
            box('end-board', (0, yy, zz), (1.23, .065, .12), 'wood_mid', .012)
    for xx in [-.44, .44]:
        beam('long-pulling-shaft', (xx, .10, .58), (xx, -1.30, .78), .085, 'wood_dark')
        box('comfortable-hand-grip', (xx, -1.19, .765), (.11, .30, .10), 'wood_light', .025, (-.13, 0, 0))
        box('parking-leg', (xx, -.58, .245), (.095, .095, .49), 'wood_dark', .014)
        box('parking-foot', (xx, -.58, .035), (.15, .15, .07), 'iron', .012)
    box('straw-supporting-produce', (0, cy, .83), (1.12, 1.45, .30), 'linen', .035)
    box('teal-folded-sack', (.28, .90, 1.08), (.34, .42, .19), 'teal', .04)
    for i in range(4):
        box('sack-fold', (.16 + i * .075, .90, 1.18), (.02, .39, .015), 'teal_light', .003)
    _vegetables('cart-produce', -.12, .30, 1.04, 12)
    finish_asset()


def build_well_courtyard():
    start_asset('well_courtyard', 'Pozo de patio', 'Decoración')
    _ring('recessed-well-mortar',(0,0,0),.773,.545,.02,.675,'stone_dark',24)
    for course in range(2):
        for i in range(12):
            angle = (i + course * .5) * math.tau / 12
            _stone_wedge('individual-well-block', angle, math.tau / 12 - .021, .53, .79,
                         .025 + course * .31, .32 + course * .31,
                         'stone' if (i + course) % 4 else 'stone_light')
    for i in range(12):
        _stone_wedge('chamfered-coping-stone', i * math.tau / 12, math.tau / 12 - .018,
                     .50, .835, .65, .78, 'stone_light')
    cyl('water-deep-in-open-shaft', (0, 0, .18), .525, .018, 'water', 16)
    for xx in [-.68, .68]:
        box('roof-oak-upright', (xx, .04, 1.405), (.14, .16, 1.43), 'wood', .02)
        box('upright-stone-shoe', (xx, .04, .745), (.22, .23, .19), 'stone_dark', .018)
        beam('roof-knee-brace', (xx, .04, 1.62), (xx * .48, .04, 1.97), .085, 'wood_light')
    beam('roof-crossbar', (-.76, .04, 1.96), (.76, .04, 1.96), .12, 'wood_dark')
    cyl('wooden-windlass', (0, .04, 1.72), .060, 1.82, 'wood_light', 10, (0, math.pi / 2, 0))
    for xx in [-.73, .73]:
        cyl('windlass-bearing', (xx, .04, 1.72), .095, .10, 'iron', 10, (0, math.pi / 2, 0))
    beam('crank-iron-arm', (.88, .04, 1.72), (.88, .04, 1.48), .045, 'iron')
    cyl('crank-wood-grip', (.96, .04, 1.48), .043, .20, 'wood_dark', 8, (0, math.pi / 2, 0))
    for xx in [-.06, 0, .06]:
        torus('windlass-wound-rope', (xx, .04, 1.72), .071, .017, 'linen', (0, math.pi / 2, 0))
    cyl('hanging-rope', (0, .04, 1.495), .017, .45, 'linen', 6)
    lathe('open-oak-bucket', (0, .04, .82),
          [(0, .02), (.15, .02), (.21, .29), (.22, .34), (.185, .34), (.15, .065), (0, .065)], 'wood', 10)
    for zz, rr in [(.90, .17), (1.12, .217)]:
        _ring('bucket-hoop', (0, .04, 0), rr + .012, rr - .008, zz - .015, zz + .015, 'iron', 10)
    # Inverted U handle is built from short rods, leaving the bucket opening clear.
    beam('bucket-handle-left', (-.19, .04, 1.12), (-.16, .04, 1.28), .022, 'iron')
    beam('bucket-handle-top', (-.16, .04, 1.28), (.16, .04, 1.28), .022, 'iron')
    beam('bucket-handle-right', (.16, .04, 1.28), (.19, .04, 1.12), .022, 'iron')
    half, rise, depth, eave = 1.02, .46, 1.48, 1.91
    slope, length = math.atan2(rise, half), math.hypot(half, rise)
    for side in [-1, 1]:
        box('roof-timber-underlay', (side * half / 2, .04, eave + rise / 2),
            (length + .08, depth - .10, .10), 'wood_dark', .018, (0, side * slope, 0))
        for row in range(3):
            t = (row + .5) / 3
            for col in range(4):
                yy = .04 - depth / 2 + (col + .5) * depth / 4
                box('overlapping-terracotta-tile', (side * half * (1 - t), yy, eave + rise * t + .07 + row*.012),
                    (length / 3 + .06, depth / 4 - .012, .06),
                    'roof_light' if (row + col) % 4 == 0 else 'roof', .012, (0, side * slope, 0))
        beam('roof-eave-wood', (side * half, -.70, eave), (side * half, .78, eave), .11, 'wood_light')
        for yy in [-.70, .78]:
            beam('gable-bargeboard', (side * half, yy, eave), (0, yy, eave + rise + .06), .10, 'wood_light')
    for i in range(5):
        cyl('ridge-cap-tile', (0, -.70 + (i + .5) * depth / 5, 2.439), .085, depth / 5 + .02,
            'roof_light', 8, (math.pi / 2, 0, 0))
    finish_asset()


def build_fountain_lily():
    start_asset('fountain_lily', 'Fuente del Nenúfar', 'Decoración')
    lathe('octagonal-fountain-foot', (0, 0, 0),
          [(0, 0), (.54, 0), (.62, .06), (.62, .12), (.54, .19), (0, .19)], 'stone_dark', 8)
    lathe('open-carved-stone-basin', (0, 0, 0),
          [(0, .16), (.73, .16), (.90, .24), (.99, .45), (1, .56),
           (.98, .62), (.88, .62), (.81, .43), (.73, .29), (0, .29)], 'stone', 16)
    _ring('basin-light-coping', (0, 0, 0), 1.015, .875, .55, .635, 'stone_light', 16)
    cyl('still-water-in-lower-basin', (0, 0, .435), .81, .012, 'water', 24)
    lathe('central-carved-stem', (0, 0, 0),
          [(0, .29), (.24, .29), (.23, .40), (.13, .51), (.115, 1.30), (.20, 1.40), (0, 1.40)], 'stone_light', 12)
    lathe('open-upper-petal-bowl', (0, 0, 0),
          [(0, .83), (.28, .83), (.49, .93), (.55, 1.08), (.50, 1.12),
           (.43, 1.04), (.24, .94), (0, .94)], 'stone', 12)
    _ring('upper-bowl-rim', (0, 0, 0), .55, .48, 1.065, 1.13, 'stone_light', 12)
    cyl('upper-pool', (0, 0, 1.055), .465, .012, 'water', 20)
    for i in range(6):
        angle = i * math.tau / 6
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        side = Vector((-math.sin(angle), math.cos(angle), 0))
        # Thick carved petals curve upward; all faces are modelled, including undersides.
        points = [direction * .08 + Vector((0, 0, 1.41)),
                  direction * .29 + side * .15 + Vector((0, 0, 1.49)),
                  direction * .50 + side * .12 + Vector((0, 0, 1.69)),
                  direction * .56 + Vector((0, 0, 1.81)),
                  direction * .50 - side * .12 + Vector((0, 0, 1.69)),
                  direction * .29 - side * .15 + Vector((0, 0, 1.49))]
        top = direction * .31 + Vector((0, 0, 1.56))
        verts = [tuple(p) for p in points + [top]]
        verts += [tuple(p - Vector((0, 0, .045))) for p in points + [top]]
        faces = [(j, (j + 1) % 6, 6) for j in range(6)]
        faces += [((j + 1) % 6 + 7, j + 7, 13) for j in range(6)]
        faces += [(j, j + 7, (j + 1) % 6 + 7, (j + 1) % 6) for j in range(6)]
        mesh('carved-lily-petal', verts, faces, 'stone_light' if i % 2 else 'stone')
        _leaf('pedestal-carved-leaf', tuple(direction * .12 + Vector((0, 0, .58))),
              tuple(direction * .22 + Vector((0, 0, .91))), .075, 'stone_light')
        beam('lily-water-jet', tuple(direction * .51 + Vector((0, 0, 1.72))),
             tuple(direction * .37 + Vector((0, 0, 1.075))), .026, 'water', .018)
        if i % 2 == 0:
            beam('lower-falling-water', tuple(direction * .525 + Vector((0, 0, 1.085))),
                 tuple(direction * .66 + Vector((0, 0, .445))), .035, 'water', .022)
            sphere('water-droplet', tuple(direction * .62 + Vector((0, 0, .57))), (.035, .035, .055), 'water')
    sphere('lily-central-bud', (0, 0, 1.72), (.15, .15, .28), 'stone_light', 2)
    for i in range(3):
        angle = i * math.tau / 3 + .5
        xx, yy = math.cos(angle) * .58, math.sin(angle) * .58
        sphere('floating-lily-pad', (xx, yy, .45), (.14, .12, .018), 'leaf')
    finish_asset()


def build_fence_oak_panel():
    start_asset('fence_oak_panel', 'Valla de roble', 'Decoración')
    for xx in [-.875, .875]:
        box('post-ground-shoe', (xx, 0, .06), (.18, .19, .12), 'stone_dark', .014)
        box('oak-fence-post', (xx, 0, .45), (.16, .16, .90), 'wood_dark', .018)
        box('post-cap-collar', (xx, 0, .90), (.20, .20, .07), 'wood_light', .014)
        cyl('pointed-post-cap', (xx, 0, .95), .125, .10, 'wood_light', 4, radius_top=.012)
    for zz in [.27, .68]:
        box('horizontal-fence-rail', (0, .012, zz), (1.83, .105, .105), 'wood', .012)
    for i in range(9):
        xx = (i - 4) * .177
        box('individual-oak-picket', (xx, -.065, .455), (.10, .065, .73), 'wood_mid' if i % 3 else 'wood_light', .012)
        verts = [(xx + x, -.065 + y, z) for y in [-.0325, .0325]
                 for x, z in [(-.05, .82), (.05, .82), (0, .91)]]
        mesh('picket-point', verts, [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], 'wood_light')
        for zz in [.27, .68]:
            sphere('picket-iron-nail', (xx, -.107, zz), (.017, .012, .017), 'iron')
    beam('back-diagonal-stiffener', (-.77, .065, .21), (.77, .065, .73), .060, 'wood_dark')
    finish_asset()


def build_gate_garden():
    start_asset('gate_garden', 'Portilla del jardín', 'Decoración')
    for xx in [-.715, .715]:
        box('independent-grounded-post', (xx, 0, .52), (.18, .18, 1.04), 'wood_dark', .022)
        box('post-cap', (xx, 0, 1.055), (.22, .22, .075), 'wood_light', .018)
        cyl('post-cap-point', (xx, 0, 1.13), .135, .10, 'wood_light', 4, radius_top=.015)
        box('post-iron-foot', (xx, 0, .13), (.19, .19, .12), 'iron', .008)
    for zz in [.33, .77]:
        box('gate-crossrail', (0, .015, zz), (1.25, .10, .10), 'wood', .014)
    for i in range(7):
        xx = (i - 3) * .176
        top = 1.035 + .10 * math.cos(xx / .65 * math.pi / 2)
        bottom = .16
        box('crowned-gate-picket', (xx, -.065, (bottom + top) / 2), (.135, .075, top - bottom),
            'wood_mid' if i % 2 else 'wood', .018)
        for zz in [.33, .77]:
            sphere('gate-picket-nail', (xx, -.113, zz), (.017, .013, .017), 'iron')
    beam('gate-diagonal-brace', (-.58, .09, .24), (.58, .09, .86), .09, 'wood_light')
    for zz in [.32, .80]:
        box('forged-hinge-strap', (-.43, -.12, zz), (.47, .035, .065), 'iron', .012)
        cyl('hinge-barrel', (-.665, -.12, zz), .04, .14, 'iron', 8)
        cyl('hinge-pin', (-.665, -.12, zz + .09), .020, .055, 'brass', 8)
        for xx in [-.59, -.30]:
            sphere('hinge-fixing', (xx, -.144, zz), (.018, .013, .018), 'brass')
    box('latch-mount', (.53, -.125, .64), (.11, .035, .20), 'iron', .015)
    beam('pivoting-latch-bar', (.44, -.16, .66), (.72, -.16, .69), .035, 'iron')
    torus('gate-pull-ring', (.53, -.17, .57), .05, .012, 'brass', (math.pi / 2, 0, 0))
    cyl('gate-ring-pivot',(.53,-.153,.62),.021,.065,'brass',8,(math.pi/2,0,0))
    finish_asset()


def build_all():
    build_lantern_street_oak()
    build_lantern_wall()
    build_signpost_crossroads()
    build_planter_herb_trough()
    build_planter_flower_urn()
    build_barrel_cider()
    build_crate_harvest()
    build_market_handcart()
    build_well_courtyard()
    build_fountain_lily()
    build_fence_oak_panel()
    build_gate_garden()
