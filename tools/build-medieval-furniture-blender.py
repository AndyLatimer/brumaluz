"""
build-medieval-furniture-blender.py
====================================
Script para Blender que genera muebles medievales al estilo KayKit
(compatible con el look & feel de Brumaluz).

Uso en Blender:
  1. Abre Blender
  2. Ventana Scripting > Nuevo
  3. Pega este script y pulsa Ejecutar Script
  4. Cada mueble se crea como colección separada con su nombre
  5. Exporta cada colección como GLB: Archivo > Exportar > glTF 2.0 (.glb)

Requisitos: Blender 3.0+ (usa bpy, incluido por defecto)
"""

import bpy
import math
from mathutils import Vector

# ---------------------------------------------------------------------------
# Paleta de colores estilo KayKit (misma que el resto de assets de Brumaluz)
# ---------------------------------------------------------------------------
PALETTE = {
    "wood":      (0.545, 0.353, 0.204, 1.0),   # #8b5a34
    "woodDark":  (0.361, 0.220, 0.125, 1.0),   # #5c3820
    "woodLight": (0.847, 0.718, 0.502, 1.0),   # #d8b780
    "iron":      (0.420, 0.447, 0.502, 1.0),   # #6b7280
    "ironDark":  (0.216, 0.255, 0.329, 1.0),   # #374151
    "gold":      (0.902, 0.710, 0.278, 1.0),   # #e6b445
    "straw":     (0.914, 0.769, 0.416, 1.0),   # #e9c46a
    "leather":   (0.651, 0.486, 0.322, 1.0),   # #a67c52
}


def new_material(name, color_key):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r, g, b, a = PALETTE[color_key]
    bsdf.inputs["Base Color"].default_value = (r, g, b, a)
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Metallic"].default_value = 0.1
    return mat


def assign_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def create_collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def link_to_collection(obj, coll):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)


# ---------------------------------------------------------------------------
# 1. BAÚL MEDIEVAL
# ---------------------------------------------------------------------------
def build_chest():
    coll = create_collection("medieval-chest")
    mat_wood = new_material("wood", "wood")
    mat_iron = new_material("iron", "iron")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.275))
    body = bpy.context.active_object
    body.scale = (0.9, 0.5, 0.55)
    body.name = "chest-body"
    assign_material(body, mat_wood)
    link_to_collection(body, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.55))
    lid = bpy.context.active_object
    lid.scale = (0.94, 0.54, 0.08)
    lid.name = "chest-lid"
    assign_material(lid, mat_wood)
    link_to_collection(lid, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.42, 0, 0.57))
    hinge = bpy.context.active_object
    hinge.scale = (0.06, 0.42, 0.04)
    hinge.name = "chest-hinge"
    assign_material(hinge, mat_iron)
    link_to_collection(hinge, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.23, 0.555))
    lock = bpy.context.active_object
    lock.scale = (0.12, 0.08, 0.06)
    lock.name = "chest-lock"
    assign_material(lock, mat_iron)
    link_to_collection(lock, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.275))
    band1 = bpy.context.active_object
    band1.scale = (0.94, 0.52, 0.03)
    band1.name = "chest-band-1"
    assign_material(band1, mat_iron)
    link_to_collection(band1, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.55))
    band2 = bpy.context.active_object
    band2.scale = (0.92, 0.52, 0.03)
    band2.name = "chest-band-2"
    assign_material(band2, mat_iron)
    link_to_collection(band2, coll)


# ---------------------------------------------------------------------------
# 2. BARRIL DE MADERA
# ---------------------------------------------------------------------------
def build_barrel():
    coll = create_collection("medieval-barrel")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")
    mat_iron = new_material("iron", "iron")

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.44, depth=0.92, location=(0, 0, 0.46))
    barrel = bpy.context.active_object
    barrel.name = "barrel-body"
    assign_material(barrel, mat_wood)
    link_to_collection(barrel, coll)

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.44, depth=0.05, location=(0, 0, 0))
    bottom = bpy.context.active_object
    bottom.name = "barrel-bottom"
    assign_material(bottom, mat_wood_dark)
    link_to_collection(bottom, coll)

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.44, depth=0.05, location=(0, 0, 0.92))
    top = bpy.context.active_object
    top.name = "barrel-top"
    assign_material(top, mat_wood_dark)
    link_to_collection(top, coll)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.47, minor_radius=0.018, location=(0, 0, 0.12))
    hoop1 = bpy.context.active_object
    hoop1.rotation_euler = (math.pi / 2, 0, 0)
    hoop1.name = "barrel-hoop-1"
    assign_material(hoop1, mat_iron)
    link_to_collection(hoop1, coll)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.47, minor_radius=0.018, location=(0, 0, 0.8))
    hoop2 = bpy.context.active_object
    hoop2.rotation_euler = (math.pi / 2, 0, 0)
    hoop2.name = "barrel-hoop-2"
    assign_material(hoop2, mat_iron)
    link_to_collection(hoop2, coll)


# ---------------------------------------------------------------------------
# 3. CALDERO
# ---------------------------------------------------------------------------
def build_cauldron():
    coll = create_collection("medieval-cauldron")
    mat_iron = new_material("iron", "iron")
    mat_iron_dark = new_material("ironDark", "ironDark")

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.5, depth=0.42, location=(0, 0, 0.42))
    pot = bpy.context.active_object
    pot.scale = (0.8, 1.0, 1.0)
    pot.name = "cauldron-pot"
    assign_material(pot, mat_iron_dark)
    link_to_collection(pot, coll)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.52, minor_radius=0.025, location=(0, 0, 0.63))
    rim = bpy.context.active_object
    rim.rotation_euler = (math.pi / 2, 0, 0)
    rim.name = "cauldron-rim"
    assign_material(rim, mat_iron_dark)
    link_to_collection(rim, coll)

    for i in range(3):
        angle = i * 2 * math.pi / 3
        x = math.cos(angle) * 0.32
        y = math.sin(angle) * 0.32
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.035, depth=0.5, location=(x, y, 0.25))
        leg = bpy.context.active_object
        leg.name = f"cauldron-leg-{i}"
        assign_material(leg, mat_iron)
        link_to_collection(leg, coll)


# ---------------------------------------------------------------------------
# 4. MESA DE BANQUETE
# ---------------------------------------------------------------------------
def build_banquet_table():
    coll = create_collection("medieval-banquet-table")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75))
    top = bpy.context.active_object
    top.scale = (2.4, 0.7, 0.1)
    top.name = "table-top"
    assign_material(top, mat_wood)
    link_to_collection(top, coll)

    for x in (-1.05, 1.05):
        for y in (-0.28, 0.28):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.4))
            leg = bpy.context.active_object
            leg.scale = (0.09, 0.09, 0.7)
            leg.name = f"table-leg-{x}-{y}"
            assign_material(leg, mat_wood)
            link_to_collection(leg, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15))
    sx = bpy.context.active_object
    sx.scale = (2.2, 0.05, 0.05)
    sx.name = "table-stretcher-x"
    assign_material(sx, mat_wood_dark)
    link_to_collection(sx, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15))
    sz = bpy.context.active_object
    sz.scale = (0.05, 0.55, 0.05)
    sz.name = "table-stretcher-z"
    assign_material(sz, mat_wood_dark)
    link_to_collection(sz, coll)


# ---------------------------------------------------------------------------
# 5. TRONO
# ---------------------------------------------------------------------------
def build_throne():
    coll = create_collection("medieval-throne")
    mat_wood = new_material("wood", "wood")
    mat_gold = new_material("gold", "gold")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
    seat = bpy.context.active_object
    seat.scale = (0.7, 0.55, 0.12)
    seat.name = "throne-seat"
    assign_material(seat, mat_wood)
    link_to_collection(seat, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.22, 1.0))
    back = bpy.context.active_object
    back.scale = (0.7, 0.1, 0.8)
    back.name = "throne-back"
    assign_material(back, mat_wood)
    link_to_collection(back, coll)

    for x in (-0.28, 0.28):
        for y in (-0.2, 0.2):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.25))
            leg = bpy.context.active_object
            leg.scale = (0.08, 0.08, 0.5)
            leg.name = f"throne-leg-{x}-{y}"
            assign_material(leg, mat_wood)
            link_to_collection(leg, coll)

    for x in (-0.3, 0.3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0.62))
        arm = bpy.context.active_object
        arm.scale = (0.14, 0.45, 0.08)
        arm.name = f"throne-arm-{x}"
        assign_material(arm, mat_wood)
        link_to_collection(arm, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.23, 1.15))
    carving = bpy.context.active_object
    carving.scale = (0.3, 0.04, 0.3)
    carving.name = "throne-carving"
    assign_material(carving, mat_gold)
    link_to_collection(carving, coll)


# ---------------------------------------------------------------------------
# 6. ATRIL
# ---------------------------------------------------------------------------
def build_lectern():
    coll = create_collection("medieval-lectern")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.06))
    base = bpy.context.active_object
    base.scale = (0.45, 0.45, 0.12)
    base.name = "lectern-base"
    assign_material(base, mat_wood)
    link_to_collection(base, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.6))
    post = bpy.context.active_object
    post.scale = (0.09, 0.09, 1.0)
    post.name = "lectern-post"
    assign_material(post, mat_wood)
    link_to_collection(post, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.135, 1.18))
    top = bpy.context.active_object
    top.scale = (0.5, 0.35, 0.06)
    top.name = "lectern-top"
    assign_material(top, mat_wood)
    link_to_collection(top, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.175, 1.195))
    lip = bpy.context.active_object
    lip.scale = (0.5, 0.08, 0.04)
    lip.name = "lectern-lip"
    assign_material(lip, mat_wood_dark)
    link_to_collection(lip, coll)


# ---------------------------------------------------------------------------
# 7. PACA DE HENO
# ---------------------------------------------------------------------------
def build_hay_bale():
    coll = create_collection("medieval-hay-bale")
    mat_straw = new_material("straw", "straw")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.25))
    bale = bpy.context.active_object
    bale.scale = (0.9, 0.9, 0.5)
    bale.name = "hay-bale"
    assign_material(bale, mat_straw)
    link_to_collection(bale, coll)

    for i in range(14):
        angle = i * 2 * math.pi / 14
        x = math.cos(angle) * 0.38
        y = math.sin(angle) * 0.38
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.025, depth=0.5, location=(x, y, 0.25))
        strand = bpy.context.active_object
        strand.rotation_euler = (math.pi / 2, angle, 0)
        strand.name = f"hay-strand-{i}"
        assign_material(strand, mat_straw)
        link_to_collection(strand, coll)


# ---------------------------------------------------------------------------
# 8. BANCO DE MADERA
# ---------------------------------------------------------------------------
def build_bench():
    coll = create_collection("medieval-bench")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.48))
    seat = bpy.context.active_object
    seat.scale = (1.4, 0.4, 0.08)
    seat.name = "bench-seat"
    assign_material(seat, mat_wood)
    link_to_collection(seat, coll)

    for x in (-0.6, 0.6):
        for y in (-0.14, 0.14):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.22))
            leg = bpy.context.active_object
            leg.scale = (0.07, 0.07, 0.44)
            leg.name = f"bench-leg-{x}-{y}"
            assign_material(leg, mat_wood)
            link_to_collection(leg, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.22))
    support = bpy.context.active_object
    support.scale = (1.2, 0.06, 0.06)
    support.name = "bench-support"
    assign_material(support, mat_wood_dark)
    link_to_collection(support, coll)


# ---------------------------------------------------------------------------
# 9. COMEDERO DE ANIMALES
# ---------------------------------------------------------------------------
def build_feeding_trough():
    coll = create_collection("medieval-feeding-trough")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.21))
    outer = bpy.context.active_object
    outer.scale = (1.0, 0.52, 0.42)
    outer.name = "trough-outer"
    assign_material(outer, mat_wood)
    link_to_collection(outer, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.2))
    inner = bpy.context.active_object
    inner.scale = (0.94, 0.46, 0.4)
    inner.name = "trough-inner"
    assign_material(inner, mat_wood_dark)
    link_to_collection(inner, coll)

    for x in (-0.42, 0.42):
        for y in (-0.22, 0.22):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.2))
            leg = bpy.context.active_object
            leg.scale = (0.07, 0.07, 0.4)
            leg.name = f"trough-leg-{x}-{y}"
            assign_material(leg, mat_wood)
            link_to_collection(leg, coll)


# ---------------------------------------------------------------------------
# 10. CARRETA DE MADERA
# ---------------------------------------------------------------------------
def build_cart():
    coll = create_collection("medieval-cart")
    mat_wood = new_material("wood", "wood")
    mat_wood_dark = new_material("woodDark", "woodDark")
    mat_iron = new_material("iron", "iron")

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.7))
    bed = bpy.context.active_object
    bed.scale = (1.2, 0.7, 0.35)
    bed.name = "cart-bed"
    assign_material(bed, mat_wood)
    link_to_collection(bed, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.63, 0, 0.925))
    side_l = bpy.context.active_object
    side_l.scale = (0.06, 0.72, 0.45)
    side_l.name = "cart-side-left"
    assign_material(side_l, mat_wood)
    link_to_collection(side_l, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.63, 0, 0.925))
    side_r = bpy.context.active_object
    side_r.scale = (0.06, 0.72, 0.45)
    side_r.name = "cart-side-right"
    assign_material(side_r, mat_wood)
    link_to_collection(side_r, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.39, 0.925))
    front = bpy.context.active_object
    front.scale = (1.2, 0.06, 0.45)
    front.name = "cart-front"
    assign_material(front, mat_wood)
    link_to_collection(front, coll)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.39, 0.925))
    back = bpy.context.active_object
    back.scale = (1.2, 0.06, 0.45)
    back.name = "cart-back"
    assign_material(back, mat_wood)
    link_to_collection(back, coll)

    for x in (-0.65, 0.65):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.32, depth=0.1, location=(x, 0, 0.5))
        wheel = bpy.context.active_object
        wheel.rotation_euler = (0, math.pi / 2, 0)
        wheel.name = f"cart-wheel-{x}"
        assign_material(wheel, mat_wood_dark)
        link_to_collection(wheel, coll)

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.09, depth=0.12, location=(x, 0, 0.5))
        hub = bpy.context.active_object
        hub.rotation_euler = (0, math.pi / 2, 0)
        hub.name = f"cart-hub-{x}"
        assign_material(hub, mat_wood_dark)
        link_to_collection(hub, coll)

    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.04, depth=1.4, location=(0, 0, 0.5))
    axle = bpy.context.active_object
    axle.rotation_euler = (0, math.pi / 2, 0)
    axle.name = "cart-axle"
    assign_material(axle, mat_iron)
    link_to_collection(axle, coll)


# ---------------------------------------------------------------------------
# Registro y ejecución
# ---------------------------------------------------------------------------
BUILDERS = {
    "medieval-chest": build_chest,
    "medieval-barrel": build_barrel,
    "medieval-cauldron": build_cauldron,
    "medieval-banquet-table": build_banquet_table,
    "medieval-throne": build_throne,
    "medieval-lectern": build_lectern,
    "medieval-hay-bale": build_hay_bale,
    "medieval-bench": build_bench,
    "medieval-feeding-trough": build_feeding_trough,
    "medieval-cart": build_cart,
}


def main():
    # Limpiar escena por defecto (cubo, cámara, luz)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    for name, builder in BUILDERS.items():
        print(f"Creando {name}...")
        builder()

    print("\nTodos los muebles medievales creados en colecciones separadas.")
    print("Exporta cada colección como GLB para usar en el editor de mapas de Brumaluz.")


if __name__ == "__main__":
    main()

