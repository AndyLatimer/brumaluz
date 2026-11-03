"""Report potentially overlapping, aligned faces in editable source pieces.

Projected rectangles are a diagnostic, not proof of polygon overlap or visibility.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'art/lagto/brumaluz-lagto.blend'))
manifest=json.loads((root/'art/lagto/manifest.json').read_text(encoding='utf8'))
reports=[]
for asset in manifest['assets']:
 col=bpy.data.collections[asset['name']];col.hide_viewport=False
 bpy.context.view_layer.update();planes={}
 for obj in col.objects:
  if obj.type!='MESH':continue
  normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
  for face in obj.data.polygons:
   if face.area<.003:continue
   n=(normal_matrix@face.normal).normalized();axis=max(range(3),key=lambda i:abs(n[i]))
   if abs(n[axis])<.99999:continue
   points=[obj.matrix_world@obj.data.vertices[i].co for i in face.vertices]
   key=(axis,1 if n[axis]>0 else -1,round(sum(p[axis] for p in points)/len(points),5))
   axes=[i for i in range(3) if i!=axis]
   bounds=tuple((min(p[a] for p in points),max(p[a] for p in points)) for a in axes)
   planes.setdefault(key,[]).append((obj.name,bounds))
 overlap=[]
 for key,faces in planes.items():
  for i,(a,ba) in enumerate(faces):
   for b,bb in faces[i+1:]:
    if a==b:continue
    area=math.prod(max(0,min(ba[j][1],bb[j][1])-max(ba[j][0],bb[j][0])) for j in range(2))
    if area>.004:overlap.append({'a':a,'b':b,'plane':key,'projectedOverlap':round(area,4)})
 reports.append({'asset':asset['name'],'candidates':overlap})
 col.hide_viewport=True
(root/'art/lagto-review/plane-audit.json').write_text(json.dumps(reports,indent=2),encoding='utf8')
for report in reports:
 if report['candidates']:print(report['asset'],len(report['candidates']),report['candidates'][:3],flush=True)
