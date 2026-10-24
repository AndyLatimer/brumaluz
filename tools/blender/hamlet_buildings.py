"""Six original Brumaluz buildings, with reusable Blender construction helpers.

The source stays deliberately modular: every timber, tile, shutter and fitting
is editable in the collection produced by ``hamlet_common.start_asset``.
Units are metres, Z is up, and the front elevation faces -Y.
"""

from math import atan2, cos, pi, sin

import bpy
from mathutils import Matrix, Vector

from hamlet_common import *
from hamlet_common import window as _joined_window


ASSET_METADATA = [
    {"id": "house_willow_cottage", "label": "Casa del Sauce", "category": "Edificios",
     "description": "Casa de cal cálida, entramado de nogal, teja irregular y jardineras de sauce."},
    {"id": "house_lantern_townhouse", "label": "Casa del Farol", "category": "Edificios",
     "description": "Vivienda de dos plantas con piso volado, contraventanas turquesa y farol de latón."},
    {"id": "building_herbalist_shop", "label": "Herbolario de la Bruma", "category": "Edificios",
     "description": "Herbolario con toldo verde azulado, botellas, macetas y hierbas en secado."},
    {"id": "building_bakery", "label": "Horno de la Plaza", "category": "Edificios",
     "description": "Panadería con horno abovedado exterior, toldo de lino y exposición de hogazas."},
    {"id": "building_carpenter_workshop", "label": "Taller del Roble", "category": "Edificios",
     "description": "Taller abierto con banco, sierra, herramientas y almacén de tablones."},
    {"id": "building_watchtower", "label": "Torre del Alba", "category": "Edificios",
     "description": "Torre de piedra con galería de madera, campana de latón y remate de veleta."},
]


def window(name, center, width=0.65, height=0.85, shutters=True):
    return _joined_window(name,center,width,height,shutters)


def roof(name, cx, cy, eave_z, width, depth, rise, mat="roof", axis="Y"):
    """Geometric overlapping tiles with a low triangle cost and warm clay caps."""
    before = set(bpy.data.objects)
    half = width / 2
    slope = atan2(rise, half)
    length = (half * half + rise * rise) ** 0.5
    rows = max(4, int(length / 0.4 + 0.999))
    cols = max(6, int(depth / 0.46 + 0.999))
    for side in (-1, 1):
        box(name + "_underroof_" + str(side), (cx + side * half / 2, cy, eave_z + rise / 2),
            (length + 0.1, depth - 0.10, 0.13), "wood_dark", 0.025, rotation=(0, side * slope, 0))
        for row in range(rows):
            t = (row + 0.48) / rows
            for col in range(cols):
                yy = cy - depth / 2 + (col + 0.5) * depth / cols
                # Offset alternating seams while retaining a straight roof edge.
                if row % 2 and 0 < col < cols - 1:
                    yy += depth / cols * 0.13
                color = mat if (row + col) % 5 else ("roof" if mat == "roof_dark" else "roof_light")
                box(name + f"_tile_{side}_{row}_{col}",
                    (cx + side * half * (1 - t), yy, eave_z + rise * t + 0.1 + row * 0.012),
                    (length / rows + 0.085, depth / cols - 0.012, 0.065), color, 0,
                    rotation=(0, side * slope, 0))
        beam(name + "_eave_" + str(side), (cx + side * half, cy - depth / 2, eave_z),
             (cx + side * half, cy + depth / 2, eave_z), 0.13, "wood_light")
    for yy in (cy - depth / 2, cy + depth / 2):
        for side in (-1, 1):
            beam(name + "_bargeboard_" + str(side) + "_" + str(yy),
                 (cx + side * half, yy, eave_z + 0.02), (cx, yy, eave_z + rise + 0.1), 0.15, "wood_light")
    count = max(4, int(depth / 0.34 + 0.999))
    for i in range(count):
        cyl(name + "_ridge_cap_" + str(i), (cx, cy - depth / 2 + (i + 0.5) * depth / count, eave_z + rise + 0.15 + (rows - 1) * 0.012),
            0.115, depth / count + 0.03, "roof_light", 8, rotation=(pi / 2, 0, 0))
    if axis == "X":
        pivot = Vector((cx, cy, 0))
        transform = Matrix.Translation(pivot) @ Matrix.Rotation(pi / 2, 4, "Z") @ Matrix.Translation(-pivot)
        bpy.context.view_layer.update()
        for obj in set(bpy.data.objects) - before:
            obj.matrix_world = transform @ obj.matrix_world


def _oriented(fn, name, center, yaw=0.0, **kwargs):
    """Turn compound facade details, preserving the common helper's -Y front."""
    before = set(bpy.data.objects)
    result = fn(name, center, **kwargs)
    created = set(bpy.data.objects) - before
    if yaw:
        bpy.context.view_layer.update()
        transform = Matrix.Translation(Vector(center)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation(-Vector(center))
        for obj in created:
            if obj.parent not in created:
                obj.matrix_world = transform @ obj.matrix_world
    return result


def _fitted_roof(name, wall_width, roof_width, roof_depth, eave, rise, mat='roof'):
    # Extend the gable's actual slope into the overhang. Raising the eaves
    # without extending the pitch leaves a visible wedge of air above the wall.
    extended_rise=rise*roof_width/wall_width
    roof(name,0,0,eave-(extended_rise-rise)+.045,roof_width,roof_depth,extended_rise,mat)


def _gable(name, width, y, eave, rise, mat="plaster_warm", thickness=0.14):
    verts = [(-width / 2, y - thickness / 2, eave),
             (width / 2, y - thickness / 2, eave), (0, y - thickness / 2, eave + rise),
             (-width / 2, y + thickness / 2, eave),
             (width / 2, y + thickness / 2, eave), (0, y + thickness / 2, eave + rise)]
    return mesh(name, verts, [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], mat)


def _stone_course(name, width, depth, z=0.18, height=0.32):
    """A low, close fitting foundation; no terrain slab outside the footprint."""
    count = max(4, round(width / 0.58))
    for side in (-1, 1):
        for i in range(count):
            x = -width / 2 + (i + 0.5) * width / count
            box(f"{name}_foundation_front_{side}_{i}", (x, side * depth / 2, z),
                (width / count - 0.025, 0.18, height), "stone_light" if i % 3 == 0 else "stone", 0.028)
    count = max(4, round(depth / 0.58))
    for side in (-1, 1):
        for i in range(count):
            y = -depth / 2 + (i + 0.5) * depth / count
            box(f"{name}_foundation_side_{side}_{i}", (side * width / 2, y, z),
                (0.18, depth / count - 0.025, height), "stone", 0.028)


def _house_shell(name, width, depth, eave, rise, plaster="plaster_warm", base=0.28,
                 timber=True, roof_extra=0.65, roof_mat="roof"):
    box(name + "_walls", (0, 0, (base + eave) / 2), (width, depth, eave - base), plaster, 0.035)
    _stone_course(name, width, depth)
    for side in (-1, 1):
        _gable(name + f"_gable_{side}", width, side * depth / 2, eave - 0.025, rise, plaster)
        if timber:
            beam(name + f"_gable_left_{side}", (-width / 2, side * (depth / 2 + 0.065), eave),
                 (0, side * (depth / 2 + 0.065), eave + rise), 0.14, "wood_dark")
            beam(name + f"_gable_right_{side}", (width / 2, side * (depth / 2 + 0.065), eave),
                 (0, side * (depth / 2 + 0.065), eave + rise), 0.14, "wood_dark")
            beam(name + f"_gable_upright_{side}", (0, side * (depth / 2 + 0.07), eave),
                 (0, side * (depth / 2 + 0.07), eave + rise - 0.04), 0.12, "wood_dark")
    if timber:
        for x in (-width / 2, width / 2):
            for y in (-depth / 2, depth / 2):
                box(name + f"_corner_{x}_{y}", (x, y, (base + eave) / 2),
                    (0.17, 0.17, eave - base + 0.08), "wood_dark", 0.022)
        for z in (base + 0.07, eave - 0.08):
            for y in (-depth / 2 - 0.025, depth / 2 + 0.025):
                box(name + f"_crossbeam_{y}_{z}", (0, y, z), (width + 0.12, 0.15, 0.16), "wood_dark", 0.018)
            for x in (-width / 2 - 0.025, width / 2 + 0.025):
                box(name + f"_sidebeam_{x}_{z}", (x, 0, z), (0.15, depth + 0.12, 0.16), "wood_dark", 0.018)
    _fitted_roof(name + "_tiled_roof",width,width+roof_extra,depth+roof_extra,eave,rise,roof_mat)


def _roof_braces(name, width, depth, eave, rise):
    for y in (-depth / 2 - 0.082, depth / 2 + 0.082):
        for side in (-1, 1):
            beam(name + f"_brace_{y}_{side}", (side * width * 0.32, y, eave + 0.05),
                 (side * width * 0.08, y, eave + rise * 0.56), 0.095, "wood")


def _chimney(name, center, height=1.7, width=0.58):
    x, y, z = center
    box(name + "_core", (x, y, z + height / 2), (width, width * 0.95, height), "stone", 0.035)
    rows = max(3, round(height / 0.29))
    for row in range(rows):
        rz = z + (row + 0.5) * height / rows
        for side in (-1, 1):
            offset = (-0.12 if row % 2 else 0.12) * width
            box(name + f"_masonry_front_{side}_{row}", (x + offset, y + side * width * 0.49, rz),
                (width * 0.64, 0.055, height / rows - 0.025), "stone_light" if row % 3 == 0 else "stone_dark", 0.015)
            box(name + f"_masonry_side_{side}_{row}", (x + side * width * 0.52, y - offset, rz),
                (0.055, width * 0.63, height / rows - 0.025), "stone", 0.015)
    box(name + "_cap_lower", (x, y, z + height - 0.035), (width + 0.14, width + 0.11, 0.13), "roof_dark", 0.025)
    box(name + "_black_flue", (x, y, z + height + 0.04), (width * 0.66, width * 0.66, 0.03), "iron", 0.008)
    for side in (-1, 1):
        box(name + f"_rim_x_{side}", (x + side * width * 0.43, y, z + height + 0.09),
            (0.13, width, 0.15), "roof", 0.025)
        box(name + f"_rim_y_{side}", (x, y + side * width * 0.43, z + height + 0.09),
            (width * 0.74, 0.13, 0.15), "roof", 0.025)


def _corner_stones(name, width, depth, height=2.5):
    for sx in (-1, 1):
        for sy in (-1, 1):
            for row in range(int(height / 0.43)):
                box(name + f"_quoin_{sx}_{sy}_{row}", (sx * width / 2, sy * depth / 2, 0.45 + row * 0.43),
                    (0.36 if row % 2 else 0.25, 0.25 if row % 2 else 0.36, 0.25), "stone_light", 0.035)


def _awning(name, center, width=2.7, depth=0.95, colors=("teal", "teal_light")):
    x, wall_y, z = center
    rise = 0.22
    strips = 9
    for i in range(strips):
        sx = x - width / 2 + (i + 0.5) * width / strips
        mat = colors[i % len(colors)]
        box(name + f"_cloth_{i}", (sx, wall_y - depth / 2, z - rise / 2),
            (width / strips + 0.005, (depth ** 2 + rise ** 2) ** 0.5, 0.055), mat, 0.018,
            rotation=(atan2(rise, depth), 0, 0))
        box(name + f"_valance_{i}", (sx, wall_y - depth + 0.015, z - rise - 0.09),
            (width / strips - 0.006, 0.055, 0.19), mat, 0.045)
    beam(name + "_wall_bar", (x - width / 2 - 0.08, wall_y, z),
         (x + width / 2 + 0.08, wall_y, z), 0.075, "wood_dark")
    beam(name + "_front_bar", (x - width / 2 - 0.08, wall_y - depth, z - rise),
         (x + width / 2 + 0.08, wall_y - depth, z - rise), 0.075, "wood_dark")
    for side in (-1, 1):
        sx = x + side * (width / 2 - 0.06)
        beam(name + f"_strut_{side}", (sx, wall_y + 0.025, z - 0.65),
             (sx, wall_y - depth + 0.06, z - rise + 0.025), 0.065, "wood")


def _pot(name, center, scale=1.0, flowers=False):
    x, y, z = center
    lathe(name + "_pot", center, [(0.13 * scale, 0), (0.16 * scale, 0.04 * scale),
          (0.21 * scale, 0.31 * scale), (0.23 * scale, 0.34 * scale),
          (0.23 * scale, 0.39 * scale), (0.18 * scale, 0.39 * scale)], "pot", 10)
    cyl(name + "_soil", (x, y, z + 0.365 * scale), 0.178 * scale, 0.025 * scale, "soil", 10)
    for i in range(5):
        a = i * 2.399
        p = (x + cos(a) * 0.105 * scale, y + sin(a) * 0.105 * scale, z + (0.63 + (i % 2) * 0.12) * scale)
        beam(name + f"_stem_{i}", (x, y, z + 0.35 * scale), p, 0.025 * scale, "leaf_dark")
        sphere(name + f"_leaves_{i}", (p[0], p[1], p[2] - 0.045 * scale),
               (0.14 * scale, 0.105 * scale, 0.16 * scale), "leaf_light" if i % 2 else "leaf", 1)
        if flowers and i % 2 == 0:
            sphere(name + f"_flower_{i}", (p[0], p[1], p[2] + 0.11 * scale),
                   (0.065 * scale,) * 3, "linen" if i % 3 else "red", 1)


def _bottle(name, center, height=0.32, mat="teal"):
    r = height * 0.24
    lathe(name, center, [(r * 0.76, 0), (r, height * 0.08), (r, height * 0.57),
          (r * 0.44, height * 0.72), (r * 0.42, height * 0.92), (r * 0.51, height * 0.94),
          (r * 0.51, height)], mat, 10)
    x, y, z = center
    cyl(name + "_cork", (x, y, z + height + 0.015), r * 0.38, 0.045, "wood_light", 8)
    box(name + "_label", (x, y - r - 0.003, z + height * 0.37), (r * 1.28, 0.012, height * 0.23), "linen", 0.009)


def _porch_step(name, x, front_y, width=1.25):
    box(name + "_lower", (x, front_y - 0.3, 0.07), (width + 0.22, 0.6, 0.14), "stone", 0.035)
    box(name + "_upper", (x, front_y - 0.12, 0.18), (width, 0.4, 0.16), "stone_light", 0.035)


def _willow_cottage():
    w, d, eave, rise = 4.25, 3.45, 2.92, 1.58
    _house_shell("willow", w, d, eave, rise)
    _roof_braces("willow", w, d, eave, rise)
    door("willow_entry", (0.05, -d / 2 - 0.065, 0.28), width=1.0, height=1.88)
    _porch_step("willow_step", 0.05, -d / 2 - 0.07)
    for side in (-1, 1):
        window("willow_front_window_" + str(side), (side * 1.34, -d / 2 - 0.07, 1.14), width=0.72, height=0.91)
        planter("willow_front_planter_" + str(side), (side * 1.34, -d / 2 - 0.2, 0.87), width=0.94)
        _oriented(window, "willow_side_window_" + str(side),
                  (side * (w / 2 + 0.065), 0.15, 1.1), yaw=side * pi / 2, width=0.78, height=1.02)
        _oriented(window, "willow_rear_window_" + str(side),
                  (side * 1.1, d / 2 + 0.065, 1.14), yaw=pi, width=0.7, height=0.9)
    window("willow_attic", (0, -d / 2 - 0.09, 3.16), width=0.54, height=0.62, shutters=False)
    _oriented(window, "willow_attic_rear", (0, d / 2 + 0.09, 3.16), yaw=pi, width=0.5, height=0.57, shutters=False)
    _chimney("willow_chimney", (-1.25, 0.83, 3.35), 1.45, 0.56)
    lantern("willow_lantern", (0.76, -d / 2 - 0.23, 2.2), scale=0.72, wall_depth=.23)
    _pot("willow_door_pot", (-0.78, -d / 2 - 0.34, 0), 0.8, True)
    # Slender willow shoots climb the rear corner without expanding the base.
    for i in range(4):
        x = -w / 2 - 0.07
        z = 0.5 + i * 0.48
        beam("willow_climber_stem_" + str(i), (x, 0.85, z), (x, 0.95, z + 0.58), 0.028, "leaf_dark")
        for j in range(2):
            sphere("willow_climber_leaf_" + str(i) + "_" + str(j),
                   (x - 0.035, 0.76 + j * 0.31, z + 0.33), (0.08, 0.22, 0.13), "leaf", 1)


def _lantern_townhouse():
    w, d = 3.28, 3.12
    # The narrow masonry ground floor supports a visibly overhanging timber floor.
    box("townhouse_lower_walls", (0, 0, 1.43), (w, d, 2.56), "stone", 0.04)
    _stone_course("townhouse", w, d)
    _corner_stones("townhouse", w, d, 2.35)
    upper_w, upper_d, floor_z, eave, rise = 3.6, 3.42, 2.56, 5.0, 1.26
    box("townhouse_upper_plaster", (0, 0, (floor_z + eave) / 2),
        (upper_w, upper_d, eave - floor_z), "plaster", 0.03)
    for y in (-upper_d / 2 - 0.025, upper_d / 2 + 0.025):
        for z in (floor_z, floor_z + 0.26, eave - 0.08):
            box("townhouse_floor_band_" + str(y) + "_" + str(z), (0, y, z),
                (upper_w + 0.16, 0.17, 0.17), "wood_dark", 0.025)
        for x in (-upper_w / 2, 0, upper_w / 2):
            box("townhouse_upright_" + str(y) + "_" + str(x), (x, y, (floor_z + eave) / 2),
                (0.14, 0.15, eave - floor_z), "wood_dark", 0.02)
    for x in (-upper_w / 2, upper_w / 2):
        for y in (-upper_d / 2, upper_d / 2, 0):
            box("townhouse_side_stud_" + str(x) + "_" + str(y), (x, y, (floor_z + eave) / 2),
                (0.15, 0.14, eave - floor_z), "wood_dark", 0.018)
        for z in (floor_z, floor_z + 0.26, eave - 0.08):
            box("townhouse_side_band_" + str(x) + "_" + str(z), (x, 0, z),
                (0.17, upper_d + 0.12, 0.17), "wood_dark", 0.018)
    for y in (-d / 2 - 0.07, d / 2 + 0.07):
        for x in (-1.35, -0.52, 0.52, 1.35):
            beam("townhouse_corbel_" + str(x) + "_" + str(y), (x, y, 2.14),
                 (x, y + (-0.18 if y < 0 else 0.18), 2.58), 0.12, "wood")
    for side in (-1, 1):
        _gable("townhouse_gable_" + str(side), upper_w, side * upper_d / 2, eave, rise, "plaster")
        beam("townhouse_gable_diagonal_l_" + str(side), (-upper_w / 2, side * (upper_d / 2 + 0.06), eave),
             (0, side * (upper_d / 2 + 0.06), eave + rise), 0.14, "wood_dark")
        beam("townhouse_gable_diagonal_r_" + str(side), (upper_w / 2, side * (upper_d / 2 + 0.06), eave),
             (0, side * (upper_d / 2 + 0.06), eave + rise), 0.14, "wood_dark")
    _fitted_roof("townhouse_roof",upper_w,4.2,4.02,eave,rise)
    door("townhouse_front_door", (-0.77, -d / 2 - 0.08, 0.22), width=0.91, height=1.92)
    _porch_step("townhouse_entry_step", -0.77, -d / 2 - 0.08, 1.06)
    window("townhouse_lower_front", (0.8, -d / 2 - 0.08, 1.05), width=0.7, height=1.07)
    for sx in (-1, 1):
        window("townhouse_upper_front_" + str(sx), (sx * 0.87, -upper_d / 2 - 0.075, 3.37), width=0.78, height=1.15)
        _oriented(window, "townhouse_upper_rear_" + str(sx), (sx * 0.87, upper_d / 2 + 0.075, 3.37),
                  yaw=pi, width=0.72, height=1.03)
        _oriented(window, "townhouse_side_upper_" + str(sx), (sx * (upper_w / 2 + 0.07), 0, 3.37),
                  yaw=sx * pi / 2, width=0.84, height=1.15)
        _oriented(window, "townhouse_side_lower_" + str(sx), (sx * (w / 2 + 0.07), 0.1, 1.1),
                  yaw=sx * pi / 2, width=0.65, height=1.02)
    _oriented(door, "townhouse_rear_door", (0, d / 2 + 0.075, 0.22), yaw=pi, width=0.85, height=1.78)
    window("townhouse_attic", (0, -upper_d / 2 - 0.09, 5.23), width=0.46, height=0.56, shutters=False)
    planter("townhouse_flowerbox", (0.87, -upper_d / 2 - 0.22, 3.05), width=0.98)
    lantern("townhouse_signature_lantern", (-1.43, -d / 2 - 0.36, 2.07), scale=1.05, wall_depth=.36)
    _chimney("townhouse_chimney", (1.1, 0.85, 4.84), 1.54, 0.51)
    # Little iron tie plates give the masonry a convincing repaired character.
    for z in (0.8, 2.17):
        for x in (-1.35, 1.35):
            box("townhouse_iron_tie_" + str(x) + "_" + str(z), (x, -d / 2 - 0.105, z),
                (0.19, 0.035, 0.19), "iron", 0.018, rotation=(0, pi / 4, 0))


def _herbalist_shop():
    w, d, eave, rise = 4.42, 3.68, 3.12, 1.56
    _house_shell("herbalist", w, d, eave, rise, "plaster", roof_mat="roof_dark")
    _roof_braces("herbalist", w, d, eave, rise)
    door("herbalist_entry", (1.19, -d / 2 - 0.07, 0.25), width=0.92, height=1.96)
    _porch_step("herbalist_entry_step", 1.19, -d / 2 - 0.08, 1.12)
    window("herbalist_shopfront", (-0.71, -d / 2 - 0.09, 1.04), width=1.57, height=1.1, shutters=False)
    _awning("herbalist_awning", (-0.68, -d / 2 - 0.12, 2.65), 2.75, 0.88)
    # Bottles sit in a real projecting sill under the glazed display.
    box("herbalist_display_sill", (-0.72, -d / 2 - 0.26, 1.04), (1.84, 0.43, 0.11), "wood", 0.025)
    for i, mat in enumerate(("teal", "amber", "book_purple", "teal_light", "amber")):
        _bottle("herbalist_window_bottle_" + str(i), (-1.31 + i * 0.3, -d / 2 - 0.26, 1.1),
                0.25 + (i % 3) * 0.055, mat)
    sign("herbalist_leaf_sign", (1.68, -d / 2 - 0.49, 2.83), kind="leaf", width=0.76, wall_depth=.49)
    window("herbalist_attic", (0, -d / 2 - 0.09, 3.36), width=0.62, height=0.71)
    for side in (-1, 1):
        _oriented(window, "herbalist_side_window_" + str(side),
                  (side * (w / 2 + 0.07), -0.2, 1.3), yaw=side * pi / 2, width=0.8, height=1.04)
        _oriented(window, "herbalist_rear_window_" + str(side),
                  (side * 1.1, d / 2 + 0.07, 1.22), yaw=pi, width=0.7, height=0.94)
    _chimney("herbalist_chimney", (-1.37, 0.86, 3.43), 1.42, 0.53)
    lantern("herbalist_lantern", (1.85, -d / 2 - 0.24, 1.88), scale=0.71, wall_depth=.24)
    _pot("herbalist_pot_large", (-1.94, -d / 2 - 0.48, 0), 1.08, True)
    _pot("herbalist_pot_small", (1.95, -d / 2 - 0.34, 0), 0.67)
    # The drying rack is flush to the left elevation, so the building can tile.
    for y in (0.5, 1.6):
        beam("herbalist_drying_upright_" + str(y), (-w / 2 - 0.14, y, 0.25),
             (-w / 2 - 0.14, y, 2.51), 0.07, "wood")
    beam("herbalist_drying_rail", (-w / 2 - 0.15, 0.45, 2.47),
         (-w / 2 - 0.15, 1.65, 2.47), 0.08, "wood_dark")
    for i in range(6):
        y = 0.58 + i * 0.18
        beam("herbalist_bundle_tie_" + str(i), (-w / 2 - 0.18, y, 2.47),
             (-w / 2 - 0.2, y, 2.16), 0.019, "linen")
        for j in range(3):
            sphere("herbalist_drying_bundle_" + str(i) + "_" + str(j),
                   (-w / 2 - 0.21, y + (j - 1) * 0.075, 1.98 + (j % 2) * 0.07),
                   (0.11, 0.095, 0.19), "leaf_dark" if i % 2 else "leaf", 1)


def _bread(name, center, scale=1.0, round_loaf=False):
    x, y, z = center
    sphere(name, center, ((0.19 if round_loaf else 0.27) * scale, 0.14 * scale, 0.105 * scale), "wood_light", 2)
    for i in range(3):
        sx = x + (i - 1) * 0.105 * scale
        beam(name + "_score_" + str(i), (sx - 0.027 * scale, y - 0.06 * scale, z + 0.085 * scale),
             (sx + 0.027 * scale, y + 0.06 * scale, z + 0.085 * scale), 0.018 * scale, "linen")


def _bread_oven(name, center):
    x, y, z = center
    # A faceted masonry dome with an inset arched mouth and individual voussoirs.
    radius = 0.81
    rings = [(0.86, 0), (0.86, 0.43), (0.81, 0.8), (0.65, 1.12), (0.38, 1.35), (0.12, 1.43)]
    lathe(name + "_dome", center, rings, "plaster_warm", 16)
    box(name + "_plinth", (x, y, z + 0.12), (1.79, 1.75, 0.25), "stone", 0.055)
    arch_panel(name + "_dark_opening", (x, y - radius - 0.018, z + 0.37), 0.69, 0.72, 0.055, "iron", 12)
    arch_frame(name + "_mouth_bricks", (x, y - radius - 0.07, z + 0.33), 0.77, 0.8, 0.13, "roof_dark", 9)
    box(name + "_hearth_shelf", (x, y - radius - 0.16, z + 0.38), (1.0, 0.49, 0.14), "stone_light", 0.035)
    _chimney(name + "_flue", (x, y + 0.1, z + 1.24), 1.29, 0.42)
    for side in (-1, 1):
        for row in range(2):
            box(name + f"_side_patch_{side}_{row}", (x + side * 0.8, y, z + 0.43 + row * 0.23),
                (0.07, 0.42, 0.14), "roof", 0.025)


def _bakery():
    w, d, eave, rise = 4.6, 3.8, 3.03, 1.46
    _house_shell("bakery", w, d, eave, rise, "plaster_warm", roof_mat="roof_light")
    _roof_braces("bakery", w, d, eave, rise)
    door("bakery_entry", (-1.43, -d / 2 - 0.075, 0.25), width=0.92, height=1.94)
    _porch_step("bakery_entry_step", -1.43, -d / 2 - 0.08, 1.08)
    window("bakery_display_window", (0.61, -d / 2 - 0.085, 1.12), width=1.67, height=1.1, shutters=False)
    _awning("bakery_awning", (0.58, -d / 2 - 0.12, 2.63), 2.97, 0.98, ("linen", "red", "linen"))
    box("bakery_display_counter", (0.61, -d / 2 - 0.37, 0.73), (2.2, 0.57, 0.73), "wood", 0.025)
    for i in range(7):
        box("bakery_counter_front_plank_" + str(i), (-0.34 + i * 0.315, -d / 2 - 0.665, 0.72),
            (0.292, 0.035, 0.61), "wood_mid" if i % 2 else "wood", 0.012)
    box("bakery_counter_top", (0.61, -d / 2 - 0.38, 1.13), (2.32, 0.65, 0.13), "wood_light", 0.028)
    for i in range(5):
        _bread("bakery_fresh_loaf_" + str(i), (-0.2 + i * 0.39, -d / 2 - 0.44, 1.272), 0.74, i % 2 == 0)
    # Pretzel silhouette is readable even at the map editor's placement zoom.
    sign("bakery_bread_sign", (-1.72, -d / 2 - 0.43, 2.74), kind="bread", width=0.79, wall_depth=.43)
    window("bakery_attic_window", (0, -d / 2 - 0.09, 3.28), width=0.61, height=0.67, shutters=False)
    for side in (-1, 1):
        _oriented(window, "bakery_rear_window_" + str(side), (side * 1.2, d / 2 + 0.07, 1.25),
                  yaw=pi, width=0.8, height=0.98)
    _oriented(window, "bakery_left_window", (-w / 2 - 0.07, 0.25, 1.15), yaw=-pi / 2, width=0.88, height=1.04)
    _oriented(window, "bakery_right_window", (w / 2 + 0.07, -0.98, 1.4), yaw=pi / 2, width=0.59, height=0.81)
    _bread_oven("bakery_outdoor_oven", (w / 2 + 0.48, 0.55, 0))
    lantern("bakery_lantern", (-0.78, -d / 2 - 0.22, 2.15), scale=0.71, wall_depth=.22)
    _pot("bakery_flower_pot", (-2.02, -d / 2 - 0.32, 0), 0.7, True)
    # Bakers' peel and split logs are attached to the side of the oven.
    beam("bakery_peel_handle", (3.25, 0.55, 0.1), (3.1, 0.57, 1.9), 0.045, "wood_light")
    box("bakery_peel_paddle", (3.095, 0.57, 1.9), (0.35, 0.065, 0.43), "wood_light", 0.08, rotation=(0, -0.09, 0))
    for i in range(4):
        cyl("bakery_firewood_" + str(i), (2.76 + (i % 2) * 0.24, 1.57, 0.13 + (i // 2) * 0.21),
            0.12, 0.58, "wood", 8, rotation=(pi / 2, 0, 0))


def _sawblade(name, center, radius=0.3):
    x, y, z = center
    verts = []
    for i in range(48):
        angle = 2 * pi * i / 48
        r = radius * (1.0 if i % 2 else 0.88)
        verts.append((x + cos(angle) * r, y, z + sin(angle) * r))
    verts.append(center)
    mesh(name, verts, [(48, i, (i + 1) % 48) for i in range(48)], "iron")
    cyl(name + "_hub", (x, y - 0.025, z), radius * 0.16, 0.07, "brass", 10, rotation=(pi / 2, 0, 0))


def _workbench(name, center):
    x, y, z = center
    for side_x in (-1, 1):
        for side_y in (-1, 1):
            box(name + f"_leg_{side_x}_{side_y}", (x + side_x * 0.67, y + side_y * 0.25, z + 0.43),
                (0.12, 0.12, 0.86), "wood_dark", 0.018)
    for j in range(4):
        box(name + "_top_plank_" + str(j), (x, y - 0.29 + j * 0.195, z + 0.9),
            (1.62, 0.18, 0.13), "wood_light" if j % 2 else "wood", 0.018)
    for sy in (-1, 1):
        box(name + "_apron_" + str(sy), (x, y + sy * 0.27, z + 0.71), (1.48, 0.09, 0.22), "wood", 0.015)
    box(name + "_lower_shelf", (x, y, z + 0.22), (1.43, 0.53, 0.1), "wood_mid", 0.018)
    box(name + "_vice_base", (x + 0.48, y - 0.38, z + 0.96), (0.37, 0.16, 0.12), "iron", 0.025)
    box(name + "_vice_jaw", (x + 0.48, y - 0.47, z + 1.04), (0.34, 0.065, 0.18), "iron", 0.02)
    cyl(name + "_vice_screw", (x + 0.48, y - 0.55, z + 0.92), 0.032, 0.32, "iron", 10, rotation=(pi / 2, 0, 0))
    beam(name + "_vice_handle", (x + 0.48, y - 0.7, z + 0.78), (x + 0.48, y - 0.7, z + 1.06), 0.028, "wood_light")
    # Plane, hammer and a half worked plank give the bench its trade identity.
    box(name + "_working_plank", (x - 0.18, y, z + .999), (0.95, 0.17, 0.075), "wood_light", 0.015,
        rotation=(0, 0, -0.12))
    box(name + "_hand_plane", (x - 0.32, y, z + 1.074), (0.32, 0.13, 0.09), "wood_dark", 0.022)
    box(name + "_plane_iron", (x - 0.32, y, z + 1.129), (0.055, 0.11, 0.07), "iron", 0.008,
        rotation=(0, -0.35, 0))
    beam(name + "_hammer_handle", (x + 0.22, y + 0.1, z + .985), (x + 0.49, y + 0.17, z + .985), 0.04, "wood")
    box(name + "_hammer_head", (x + 0.49, y + 0.17, z + 1.005), (0.08, 0.2, 0.08), "iron", 0.015)


def _carpenter_workshop():
    w, d, eave, rise = 4.82, 3.8, 3.06, 1.5
    # The work bay is genuinely open, with a visible interior and rear wall.
    box("carpenter_floor", (0, 0, 0.13), (w, d, 0.26), "stone", 0.035)
    box("carpenter_rear_wall", (0, d / 2 - 0.1, 1.64), (w, 0.2, eave - 0.26), "plaster_warm", 0.02)
    for side in (-1, 1):
        box("carpenter_side_wall_" + str(side), (side * (w / 2 - 0.1), 0, 1.64),
            (0.2, d, eave - 0.26), "plaster_warm", 0.02)
        for y in (-d / 2, d / 2):
            box("carpenter_corner_post_" + str(side) + "_" + str(y), (side * w / 2, y, 1.64),
                (0.19, 0.19, eave - 0.12), "wood_dark", 0.025)
        box("carpenter_side_topbeam_" + str(side), (side * w / 2, 0, eave - 0.07),
            (0.18, d + 0.14, 0.19), "wood_dark", 0.02)
    box("carpenter_front_door_wall", (-1.66, -d / 2, 1.58), (1.5, 0.2, 2.84), "plaster_warm", 0.02)
    box("carpenter_bay_divider", (-0.86, -d / 2, 1.62), (0.17, 0.22, eave - 0.12), "wood_dark", 0.02)
    box("carpenter_front_header", (0, -d / 2, eave - 0.12), (w + 0.12, 0.22, 0.24), "wood_dark", 0.025)
    box("carpenter_rear_header", (0, d / 2, eave - 0.12), (w + 0.12, 0.22, 0.24), "wood_dark", 0.025)
    _stone_course("carpenter", w, d)
    for side in (-1, 1):
        _gable("carpenter_gable_" + str(side), w, side * d / 2, eave, rise, "wood_mid")
        for i in range(-5, 6):
            x = i * 0.38
            top = eave + rise * (1 - abs(x) / (w / 2))
            if top > eave + 0.08:
                beam("carpenter_gable_plank_" + str(side) + "_" + str(i),
                     (x, side * (d / 2 + 0.082), eave + 0.03),
                     (x, side * (d / 2 + 0.082), top - 0.025), 0.025, "wood_dark")
    _fitted_roof("carpenter_tiled_roof",w,w+.7,d+.7,eave,rise,"roof_dark")
    _roof_braces("carpenter", w, d, eave, rise)
    door("carpenter_side_entry", (-1.66, -d / 2 - 0.12, 0.25), width=0.86, height=1.95)
    _porch_step("carpenter_entry_step", -1.66, -d / 2 - 0.12, 1.03)
    for side in (-1, 1):
        _oriented(window, "carpenter_side_window_" + str(side), (side * (w / 2 + 0.065), 0.23, 1.24),
                  yaw=side * pi / 2, width=0.9, height=1.06)
        _oriented(window, "carpenter_rear_window_" + str(side), (side * 1.22, d / 2 + 0.065, 1.26),
                  yaw=pi, width=0.77, height=0.94)
    sign("carpenter_hammer_sign", (-0.7, -d / 2 - 0.39, 2.74), kind="hammer", width=0.82, wall_depth=.39)
    _workbench("carpenter_workbench", (0.66, -0.9, 0.26))
    # Tool board is visible through the bay; no black facade disguises the opening.
    box("carpenter_toolboard", (0.62, d / 2 - 0.24, 1.84), (2.14, 0.11, 1.15), "wood", 0.025)
    _sawblade("carpenter_wall_saw", (0.3, d / 2 - 0.31, 1.98), 0.33)
    for i in range(3):
        x = 0.93 + i * 0.25
        beam("carpenter_hanging_tool_handle_" + str(i), (x, d / 2 - 0.33, 1.48),
             (x, d / 2 - 0.33, 2.05), 0.045, "wood_light")
        box("carpenter_hanging_tool_head_" + str(i), (x, d / 2 - 0.35, 2.05),
            (0.21 if i != 1 else 0.11, 0.07, 0.1 if i != 1 else 0.25), "iron", 0.015)
        cyl("carpenter_tool_peg_"+str(i),(x,d/2-.315,1.84),.025,.13,'iron',8,(pi/2,0,0))
    # Outdoor timber rack follows the right wall, with restrained footprint.
    for y in (-0.75, 1.12):
        beam("carpenter_timber_rack_" + str(y), (w / 2 + 0.13, y, 0.06),
             (w / 2 + 0.13, y, 1.1), 0.09, "wood_dark")
        beam("carpenter_timber_shelf_" + str(y), (w / 2 - 0.01, y, 0.42),
             (w / 2 + 0.65, y, 0.42), 0.09, "wood_dark")
    for i in range(7):
        box("carpenter_stock_plank_" + str(i), (w / 2 + 0.22 + (i % 2) * 0.19, 0.14, 0.51 + (i // 2) * 0.098),
            (0.15, 2.34 - (i % 3) * 0.1, 0.1), "wood_light" if i % 3 == 0 else "wood", 0.016)
    lantern("carpenter_lantern", (w/2, -d / 2 - 0.19, 2.3), scale=0.75, wall_depth=.19)
    _chimney("carpenter_chimney", (-1.57, 0.88, 3.38), 1.38, 0.49)


def _arrow_slit(name, center, yaw=0.0):
    def build(local_name, local_center):
        x, y, z = local_center
        box(local_name+'_reveal',(x,y+.025,z+.45),(.32,.10,.92),'stone_dark',.008)
        arch_panel(local_name + "_shadow", (x, y - 0.035, z), 0.25, 0.92, 0.055, "iron", 8)
        arch_frame(local_name + "_frame", (x, y - 0.06, z - 0.035), 0.34, 1.0, 0.08, "stone_light", 8)
        box(local_name + "_cross_slit", (x, y - 0.105, z + 0.37), (0.45, 0.025, 0.11), "iron", 0.01)
    _oriented(build, name, center, yaw=yaw)


def _watchtower():
    w, d, stone_top = 2.86, 2.86, 3.81
    box("watchtower_stone_shaft", (0, 0, stone_top / 2), (w, d, stone_top), "stone", 0.05)
    _stone_course("watchtower", w + 0.13, d + 0.13, 0.17, 0.34)
    _corner_stones("watchtower", w, d, stone_top)
    # Sparse, irregular masonry patches keep the stone readable at game scale.
    for side in (-1, 1):
        for row in range(6):
            z = 0.52 + row * 0.48
            for i in range(2):
                x = (-0.71 if i == 0 else 0.58) + (0.12 if row % 2 else -0.04)
                if side < 0 and abs(x) < 0.88 and z < 2.2:
                    continue
                box("watchtower_front_patch_" + str(side) + "_" + str(row) + "_" + str(i),
                    (x, side * (d / 2 + 0.015), z), (0.39 + (row % 2) * 0.09, 0.045, 0.2),
                    "stone_light" if (row + i) % 3 else "stone_dark", 0.02)
                box("watchtower_side_patch_" + str(side) + "_" + str(row) + "_" + str(i),
                    (side * (w / 2 + 0.015), x, z), (0.045, 0.44, 0.2), "stone_dark" if row % 3 == 0 else "stone_light", 0.02)
    door("watchtower_entry", (0, -d / 2 - 0.065, 0.2), width=0.96, height=1.97)
    _porch_step("watchtower_entry_step", 0, -d / 2 - 0.07, 1.14)
    for side in (-1, 1):
        _arrow_slit("watchtower_side_slit_" + str(side), (side * (w / 2 + 0.055), 0, 2.12), side * pi / 2)
    _arrow_slit("watchtower_rear_slit", (0, d / 2 + 0.055, 2.1), pi)
    _arrow_slit("watchtower_front_slit", (0, -d / 2 - 0.055, 2.57))
    gallery_w, gallery_d, floor_z, eave, rise = 3.65, 3.65, 3.86, 5.15, 1.15
    box("watchtower_gallery_floor", (0, 0, floor_z), (gallery_w, gallery_d, 0.2), "wood_dark", 0.025)
    for i in range(11):
        box("watchtower_gallery_floorboard_" + str(i), (-1.66 + i * 0.333, 0, floor_z + 0.12),
            (0.312, gallery_d - 0.1, 0.055), "wood" if i % 2 else "wood_mid", 0.012)
    # Open gallery and a compact central bell frame create a distinct silhouette.
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("watchtower_gallery_post_" + str(sx) + "_" + str(sy),
                (sx * 1.67, sy * 1.67, (floor_z + eave) / 2), (0.16, 0.16, eave - floor_z + 0.05), "wood_dark", 0.022)
            beam("watchtower_corbel_" + str(sx) + "_" + str(sy), (sx * 1.32, sy * 1.32, 3.24),
                 (sx * 1.69, sy * 1.69, floor_z - 0.04), 0.16, "wood")
    for sy in (-1, 1):
        box("watchtower_topbeam_front_" + str(sy), (0, sy * 1.67, eave - 0.06),
            (3.56, 0.18, 0.17), "wood_dark", 0.02)
        box("watchtower_gallery_rail_front_" + str(sy), (0, sy * 1.67, 4.51),
            (3.52, 0.12, 0.12), "wood", 0.02)
        for i in range(9):
            x = -1.43 + i * 0.3575
            box("watchtower_baluster_front_" + str(sy) + "_" + str(i), (x, sy * 1.67, 4.25),
                (0.065, 0.075, 0.46), "wood_mid", 0.012)
    for sx in (-1, 1):
        box("watchtower_topbeam_side_" + str(sx), (sx * 1.67, 0, eave - 0.06),
            (0.18, 3.56, 0.17), "wood_dark", 0.02)
        box("watchtower_gallery_rail_side_" + str(sx), (sx * 1.67, 0, 4.51),
            (0.12, 3.52, 0.12), "wood", 0.02)
        for i in range(9):
            y = -1.43 + i * 0.3575
            box("watchtower_baluster_side_" + str(sx) + "_" + str(i), (sx * 1.67, y, 4.25),
                (0.075, 0.065, 0.46), "wood_mid", 0.012)
    _fitted_roof("watchtower_tiled_roof",3.58,4.28,4.28,eave,rise,"roof")
    # Shallow wooden gables leave the upper gallery visually open on all sides.
    for sy in (-1, 1):
        _gable("watchtower_wood_gable_" + str(sy), 3.58, sy * 1.67, eave - 0.02, rise, "wood_mid")
    _roof_braces("watchtower", 3.58, 3.34, eave, rise)
    beam("watchtower_bell_crossbar", (-0.8, 0, 4.96), (0.8, 0, 4.96), 0.13, "wood_dark")
    torus("watchtower_bell_hanger", (0, 0, 4.86), 0.09, 0.025, "iron", rotation=(pi / 2, 0, 0))
    lathe("watchtower_bell", (0, 0, 4.22), [(0.35, 0), (0.38, 0.06), (0.3, 0.12),
          (0.22, 0.29), (0.17, 0.49), (0.09, 0.56), (0.06, 0.6)], "brass", 16)
    sphere("watchtower_bell_clapper", (0, -0.02, 4.18), (0.07, 0.07, 0.09), "iron", 1)
    beam("watchtower_bell_rope", (0.08, 0, 4.32), (0.08, 0, 4.01), 0.023, "linen")
    lantern("watchtower_entry_lantern", (0.85, -d / 2 - 0.2, 2.03), scale=0.84, wall_depth=.2)
    # A light, asymmetric pennant reads better than a heavy rooftop ornament.
    cyl("watchtower_weather_spindle", (0, 0, 6.5), 0.035, 0.68, "iron", 10)
    sphere("watchtower_weather_finial", (0, 0, 6.86), (0.085, 0.085, 0.11), "brass", 1)
    mesh("watchtower_teal_pennant", [(0.03, 0, 6.73), (0.74, 0, 6.61), (0.48, 0, 6.47),
         (0.03, 0, 6.46), (0.03, 0.035, 6.73), (0.74, 0.035, 6.61), (0.48, 0.035, 6.47),
         (0.03, 0.035, 6.46)], [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2),
         (2, 6, 7, 3), (3, 7, 4, 0)], "teal")


def build_all():
    """Populate one asset collection per building and return common metadata."""
    builders = (_willow_cottage, _lantern_townhouse, _herbalist_shop, _bakery,
                _carpenter_workshop, _watchtower)
    results = []
    for metadata, builder in zip(ASSET_METADATA, builders):
        start_asset(metadata["id"], metadata["label"], metadata["category"])
        builder()
        finish_asset()
        results.append({**metadata, **ASSETS[-1]})
    return results
