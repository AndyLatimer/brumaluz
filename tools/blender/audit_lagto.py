import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector
import numpy as np

ART = Path(__file__).resolve().parents[2] / 'art' / 'lagto'
manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
bpy.context.view_layer.update()

buildings = [
    'house_copper_bastion', 'forge_cobre_foundry', 'tower_drake_watch',
    'cavern_terrace_shelter', 'shrine_scale_ancestor', 'hall_stone_council',
    'gatehouse_copper_rampart', 'mine_shaft_headframe', 'bridge_copper_arch',
    'granary_silo_stone', 'barracks_drake_guard', 'market_stall_ore_smith'
]
furniture = [
    'throne_basalt_copper', 'table_stone_refectory', 'bench_quarry_slab',
    'chair_high_carved', 'bed_cavern_hearth', 'cabinet_vaulted_copper',
    'chest_ore_strongbox', 'shelf_mason_tools', 'desk_cartographer_copper',
    'anvil_master_forge', 'hearth_brazier_hewn', 'rug_lizard_weave',
    'weapon_rack_stone_copper', 'bunk_bed_miner', 'low_table_cushions',
    'bookcase_tablet_vault', 'washing_basin_copper', 'cauldron_hearth_tripod'
]

target_assets = set(buildings + furniture)

print("\n=== AUDITING LAGTO BUILDINGS AND FURNITURE ===")
for asset in manifest['assets']:
    name = asset['name']
    if name not in target_assets:
        continue
    col = bpy.data.collections.get(name)
    if not col:
        print(f"ERROR: Missing collection {name}")
        continue
    objects = [o for o in col.objects if o.type == 'MESH']
    bounds = np.array([[(obj.matrix_world @ Vector(corner))[:] for corner in obj.bound_box] for obj in objects])
    lower, upper = bounds.min(axis=1), bounds.max(axis=1)
    ground = lower[:, 2].min()

    # Calculate pairwise distances
    delta = np.maximum(0, np.maximum(lower[:, None, :] - upper[None, :, :], lower[None, :, :] - upper[:, None, :]))
    distance = np.linalg.norm(delta, axis=2)
    parent = list(range(len(objects)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i, j in np.argwhere(np.triu(distance <= 0.005, 1)):
        parent[find(int(i))] = find(int(j))

    groups = {}
    for i in range(len(objects)):
        groups.setdefault(find(i), []).append(i)

    # Check for disconnected / suspended groups
    suspended = []
    for members in groups.values():
        if lower[members, 2].min() <= ground + 0.02:
            continue # touches ground
        others = [i for i in range(len(objects)) if i not in members]
        if not others:
            continue
        gap = float(distance[np.ix_(members, others)].min())
        if gap > 0.005:
            suspended.append((gap, [objects[i].name for i in members]))

    if suspended:
        print(f"\n[GAP] {name} has {len(suspended)} suspended group(s):")
        for gap, names in suspended:
            print(f"  gap={gap:.4f}m: {names[:5]} (total {len(names)})")
    else:
        print(f"[OK] {name}: {len(objects)} parts, {len(groups)} connected components, ground={ground:.4f}")


