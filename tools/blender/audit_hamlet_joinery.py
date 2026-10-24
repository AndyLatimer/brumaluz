"""Find visibly suspended construction groups in the editable Blender source.

Bounding boxes give conservative candidates, not proof of mesh intersection.
Intentional independent floor props are excluded. Inspect the named candidates
alongside the close-up renders; no geometry is modified by this audit.
"""
import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector
import numpy as np

ART=Path(__file__).resolve().parents[2]/'art'/'hamlet'
manifest=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))
bpy.context.view_layer.update()
report=[]
checks=dict(bedPosts=0,closedWindows=0,continuousFrames=0)
for asset in manifest['assets']:
    objects=[o for o in bpy.data.collections[asset['name']].objects if o.type=='MESH']
    bounds=np.array([[(obj.matrix_world@Vector(corner))[:] for corner in obj.bound_box] for obj in objects])
    lower,upper=bounds.min(axis=1),bounds.max(axis=1)
    delta=np.maximum(0,np.maximum(lower[:,None,:]-upper[None,:,:],lower[None,:,:]-upper[:,None,:]))
    distance=np.linalg.norm(delta,axis=2)
    parent=list(range(len(objects)))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    for i,j in np.argwhere(np.triu(distance<=.004,1)):
        parent[find(int(i))]=find(int(j))
    groups={}
    for i in range(len(objects)):
        groups.setdefault(find(i),[]).append(i)
    ground=lower[:,2].min()
    if asset['name']=='bed_linen_quilt':
        posts=[i for i,obj in enumerate(objects) if obj.get('joinery')=='bed_load_bearing_post']
        assert len(posts)==4,'The bed must have exactly four load-bearing corner posts'
        assert all(abs(lower[i,2]-ground)<.002 for i in posts),'Every bed corner must reach the floor'
        assert not any(obj.name.startswith(('bed-leg','bed-foot')) for obj in objects),'Duplicate bed supports'
        checks['bedPosts']=len(posts)
    for obj in objects:
        if obj.get('joinery') not in ['closed_window_frame','continuous_door_frame']:
            continue
        bm=bmesh.new()
        bm.from_mesh(obj.data)
        assert all(edge.is_manifold for edge in bm.edges),f'Open frame: {obj.name}'
        unseen=set(bm.verts)
        pending=[unseen.pop()]
        while pending:
            for edge in pending.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in unseen:
                        unseen.remove(vertex)
                        pending.append(vertex)
        assert not unseen,f'Disconnected frame sections: {obj.name}'
        bm.free()
        checks['continuousFrames']+=1
        if obj.get('joinery')=='closed_window_frame':
            bar=bpy.data.objects[str(obj['window_mullion'])]
            local=[obj.matrix_world.inverted()@(bar.matrix_world@Vector(c)) for c in bar.bound_box]
            assert min(p.z for p in local)<=0 and max(p.z for p in local)>=obj['opening_height'],f'Mullion fails to reach frame: {obj.name}'
            checks['closedWindows']+=1
    for members in groups.values():
        if lower[members,2].min()<=ground+.012:
            continue
        others=[i for i in range(len(objects)) if i not in members]
        if not others:
            continue
        gap=float(distance[np.ix_(members,others)].min())
        if gap<.006:
            continue
        report.append(dict(asset=asset['name'],gap=round(gap,4),parts=len(members),names=[objects[i].name for i in members]))
target=ART/'review'/'joinery-candidates.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for row in report:
    print('JOINERY '+json.dumps(row,ensure_ascii=False),flush=True)
print('JOINERY_CANDIDATES '+str(len(report)),flush=True)
checks['suspendedCandidates']=len(report)
(ART/'review'/'joinery-checks.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
print('JOINERY_CHECKS '+json.dumps(checks),flush=True)
