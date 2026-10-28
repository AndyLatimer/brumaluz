"""Measure overlapping coplanar triangles and degenerate geometry in native art.

Run Blender with the pack .blend open. --before preserves a baseline report;
--strict makes exposed, nearly coplanar overlaps fail the verification.
Ordinary intersections between joined timbers are not classified as z-fighting.
"""
import bpy
import bmesh
import json
import sys
from pathlib import Path
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri

ART = Path(__file__).resolve().parents[2] / 'art' / 'arboleda'
DISTANCE = .0004
AREA = .0000002


def cross(a, b, p):
    return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])


def overlap_polygon(a, b, normal):
    axis=max(range(3),key=lambda i:abs(normal[i]))
    axes=[i for i in range(3) if i!=axis]
    project=lambda p:(p[axes[0]],p[axes[1]])
    polygon=[project(p) for p in a]
    clip=[project(p) for p in b]
    sign=1 if cross(clip[0],clip[1],clip[2])>=0 else -1
    for i in range(3):
        p,q=clip[i],clip[(i+1)%3]
        output=[]
        for j,start in enumerate(polygon):
            end=polygon[(j+1)%len(polygon)]
            ds,de=sign*cross(p,q,start),sign*cross(p,q,end)
            if ds>=-1e-10: output.append(start)
            if (ds>1e-10 and de<-1e-10) or (ds<-1e-10 and de>1e-10):
                t=ds/(ds-de)
                output.append((start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])))
        polygon=output
        if len(polygon)<3: return 0,None
    area=abs(sum(polygon[i][0]*polygon[(i+1)%len(polygon)][1]-polygon[i][1]*polygon[(i+1)%len(polygon)][0] for i in range(len(polygon))))*.5
    if area<=AREA: return 0,None
    # Recover a point in the shared polygon for an outward visibility probe.
    point=Vector((0,0,0))
    for i,ax in enumerate(axes): point[ax]=sum(p[i] for p in polygon)/len(polygon)
    point[axis]=(normal.dot(a[0])-sum(normal[i]*point[i] for i in axes))/normal[axis]
    return area/abs(normal[axis]),point


def audit():
    manifest=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))
    bpy.context.view_layer.update()
    reports=[]
    for asset in manifest['assets']:
        vertices=[]; triangles=[]; owners=[]; degenerate=[]; normals=[]; open_edges=Counter()
        for obj in bpy.data.collections[asset['name']].objects:
            if obj.type!='MESH': continue
            bm=bmesh.new(); bm.from_mesh(obj.data)
            count=sum(not edge.is_manifold for edge in bm.edges)
            if count: open_edges[obj.name]=count
            bm.free()
            obj.data.calc_loop_triangles()
            offset=len(vertices)
            vertices.extend(obj.matrix_world@v.co for v in obj.data.vertices)
            for face in obj.data.loop_triangles:
                triangle=tuple(offset+i for i in face.vertices)
                a,b,c=[vertices[i] for i in triangle]
                n=(b-a).cross(c-a)
                if n.length<2e-11:
                    degenerate.append(obj.name)
                    continue
                triangles.append(triangle); owners.append(obj.name); normals.append(n.normalized())
        bvh=BVHTree.FromPolygons(vertices,triangles,all_triangles=True,epsilon=DISTANCE)
        counts=Counter(); exposed=Counter(); samples=[]; roof_crossings=Counter()
        for i,j in bvh.overlap(bvh):
            if i>=j: continue
            a=[vertices[k] for k in triangles[i]]; b=[vertices[k] for k in triangles[j]]
            roof_leaf=lambda name: name.startswith(('Roof / overlapping leaf shingle','Roof / leaf shingle'))
            roof_shell=lambda name: name.startswith(('Roof / continuous dark understructure','Roof / backing shell'))
            roof_pair=owners[i]!=owners[j] and ((roof_leaf(owners[i]) and (roof_leaf(owners[j]) or roof_shell(owners[j]))) or (roof_leaf(owners[j]) and roof_shell(owners[i])))
            if roof_pair and abs(normals[i].dot(normals[j]))<.99999:
                crossed=False
                for source,target in [(a,b),(b,a)]:
                    for k in range(3):
                        delta=source[(k+1)%3]-source[k]
                        hit=intersect_ray_tri(*target,delta,source[k],True)
                        if hit is not None and .00001<(hit-source[k]).length<delta.length-.00001:
                            crossed=True; break
                    if crossed: break
                if crossed: roof_crossings[tuple(sorted([owners[i],owners[j]]))]+=1
            if normals[i].dot(normals[j])<.99999: continue
            if max(abs(normals[i].dot(p-a[0])) for p in b)>DISTANCE: continue
            area,point=overlap_polygon(a,b,normals[i])
            if area<=AREA: continue
            pair=tuple(sorted([owners[i],owners[j]]))
            counts[pair]+=1
            origin=point+normals[i]*.001
            hit,_,_,distance=bvh.ray_cast(origin,normals[i],.05)
            hidden=hit is not None and distance>.0001
            if not hidden:
                exposed[pair]+=1
                if len(samples)<60: samples.append(dict(parts=pair,area=area,point=list(point)))
        reports.append(dict(name=asset['name'],triangles=len(triangles),degenerateTriangles=len(degenerate),
                            nonManifoldEdges=sum(open_edges.values()),openParts=dict(open_edges),
                            degenerateParts=dict(Counter(degenerate)),coplanarTrianglePairs=sum(counts.values()),
                            exposedCoplanarPairs=sum(exposed.values()),
                            roofCrossings=sum(roof_crossings.values()),
                            roofCrossingParts=[dict(parts=k,count=v) for k,v in roof_crossings.most_common()],
                            exposedParts=[dict(parts=k,count=v) for k,v in exposed.most_common()],samples=samples))
        print('SURFACES '+asset['name']+' '+str(len(degenerate))+' degenerate / '+str(sum(exposed.values()))+' exposed coplanar pairs',flush=True)
    result=dict(distanceTolerance=DISTANCE,minimumOverlapArea=AREA,assets=reports,
                degenerateTriangles=sum(r['degenerateTriangles'] for r in reports),
                nonManifoldEdges=sum(r['nonManifoldEdges'] for r in reports),
                roofCrossings=sum(r['roofCrossings'] for r in reports),
                exposedCoplanarPairs=sum(r['exposedCoplanarPairs'] for r in reports))
    output=ART/'review'/('surface-audit-before.json' if '--before' in sys.argv else 'surface-audit.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if '--strict' in sys.argv:
        assert result['degenerateTriangles']==0,'Degenerate geometry remains; see surface-audit.json'
        assert result['nonManifoldEdges']==0,'Open or non-manifold construction parts remain'
        assert result['exposedCoplanarPairs']==0,'Exposed overlapping faces remain; see surface-audit.json'
        assert result['roofCrossings']==0,'Roof tiles pierce one another or their backing shell'
    return result


if __name__=='__main__':
    audit()
