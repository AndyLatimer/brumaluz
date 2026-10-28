"""Original Blender-native elven grove kit. Run with tools/build-arboleda.mjs.

Metres, Z up, front -Y; exports are Y up / front +Z. Named construction
parts remain editable; each game asset is a single mesh with a painted atlas.
No downloaded models, fonts, images or Python dependencies.
"""
import sys
import math
import json
import warnings
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hamlet_common as h
from hamlet_common import box, cyl, sphere, lathe, torus, mesh, beam

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art' / 'arboleda'
OUT = ROOT / 'src' / 'assets' / 'library' / 'brumaluz-arboleda'
TAU = math.tau
warnings.filterwarnings('ignore', category=DeprecationWarning)
h.ART, h.OUT = ART, OUT
h.PALETTE = {
    'wood': '#77604a', 'wood_dark': '#393b30', 'wood_light': '#bca77a', 'wood_mid': '#93805a',
    'iron': '#344e48', 'brass': '#c3ab68', 'stone': '#9aa991', 'stone_light': '#e1dfc0',
    'stone_dark': '#627b6e', 'plaster': '#eee6ce', 'plaster_warm': '#d1d8ae',
    'roof': '#326e58', 'roof_light': '#729953', 'roof_dark': '#214d45',
    'teal': '#397f78', 'teal_light': '#91c5a0', 'linen': '#f1e4bb', 'red': '#bf869d',
    'leaf': '#528653', 'leaf_light': '#a0b767', 'leaf_dark': '#2d624b', 'pot': '#789e88',
    'soil': '#414539', 'glass': '#65bdaa', 'amber': '#e8e5a3', 'water': '#66b5b5',
    'book_purple': '#8677a0', 'book_blue': '#507c80',
}


def clean_mesh(obj):
    """Weld collapsed lathe tips before triangulation; keep UVs and hard edges."""
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7)
    invalid=[f for f in bm.faces if f.calc_area()<1e-12]
    if invalid: bmesh.ops.delete(bm,geom=invalid,context='FACES')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return obj


def lathe(name, loc, profile, mat='pot', segments=12):
    return clean_mesh(h.lathe(name,loc,profile,mat,segments))


def tube(name, points, radius=.05, mat='brass', sides=7):
    """Closed tapered sweep, with stable frames even along vertical trunks."""
    pts = [Vector(p) for p in points]
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * len(pts)
    closed=(pts[0]-pts[-1]).length<1e-7
    if closed:
        pts=pts[:-1]
        radii=radii[:-1]
    verts = []
    previous_u = None
    for i, p in enumerate(pts):
        tangent = (pts[(i+1)%len(pts)]-pts[(i-1)%len(pts)]).normalized() if closed else (pts[min(i+1, len(pts)-1)]-pts[max(0,i-1)]).normalized()
        # Transport the frame; switching reference axes midway through a coil
        # creates pinched, apparently disconnected sections at every turn.
        if previous_u is None:
            ref = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
            u = tangent.cross(ref).normalized()
        else:
            u = (previous_u-tangent*previous_u.dot(tangent)).normalized()
            if u.length < .1:
                ref = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
                u = tangent.cross(ref).normalized()
        previous_u = u
        v = tangent.cross(u).normalized()
        for j in range(sides):
            verts.append(p + radii[i] * (math.cos(TAU*j/sides)*u + math.sin(TAU*j/sides)*v))
    faces = [] if closed else [tuple(reversed(range(sides))), tuple((len(pts)-1)*sides+j for j in range(sides))]
    for i in range(len(pts) if closed else len(pts)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            c,d=((i+1)%len(pts))*sides+(j+1)%sides,((i+1)%len(pts))*sides+j
            faces.append((a,b,c,d))
    obj = mesh(name, verts, faces, mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    obj['closed_sweep']=closed
    return obj


def leaf(name, base, tip, width, mat='leaf', bend=.09, vein=False, rows=7):
    """Thick folded lanceolate leaf, used as botanical ornament and roof tile."""
    a, b = Vector(base), Vector(tip)
    d = b-a
    normal = Vector((0, 0, 1)) if abs(d.normalized().z) < .9 else Vector((0, -1, 0))
    side = d.cross(normal).normalized()
    up = side.cross(d).normalized()
    verts = []
    thickness=min(.018,max(.0015,width*.06))
    for layer in [0, 1]:
        for i in range(rows):
            t = i/(rows-1)
            w = width * .5 * math.sin(math.pi*t)**.8 + max(.0008,width*.006)
            center = a+d*t+up*(bend*math.sin(math.pi*t)-layer*thickness)
            ridge=width*.1*(.06+.94*math.sin(math.pi*t))
            verts.extend([center-side*w, center+up*ridge, center+side*w])
    faces = []
    n = rows*3
    for layer in range(2):
        for i in range(rows-1):
            for j in range(2):
                k = layer*n+i*3+j
                face = (k, k+3, k+4, k+1)
                faces.append(face if layer == 0 else tuple(reversed(face)))
    for i in range(rows-1):
        for j in [0, 2]:
            k = i*3+j
            faces.append((k, k+n, k+n+3, k+3))
    faces.extend([(0,1,2,n+2,n+1,n), (n-3,2*n-3,2*n-2,2*n-1,n-1,n-2)])
    obj = mesh(name, verts, faces, mat)
    if vein:
        vein_radius=min(.009,width*.025)
        tube(name+' / central inlay', [a+d*t+up*(bend*math.sin(math.pi*t)+width*.1*(.06+.94*math.sin(math.pi*t))+vein_radius*.65) for t in [0,.2,.4,.6,.8,1]], vein_radius, 'brass', 5)
    return obj


def ring(name, center, radius, minor=.04, mat='brass', n=48):
    x,y,z = center
    return tube(name, [(x+radius*math.cos(TAU*i/n), y+radius*math.sin(TAU*i/n), z) for i in range(n+1)], minor, mat, 6)


def pointed(name, center, w, height, mat='wood_light', thickness=.07):
    x,y,z = center
    left=[(x-w*.5,y,z),(x-w*.5,y,z+height*.52),(x-w*.43,y,z+height*.73),
          (x-w*.24,y,z+height*.91),(x,y,z+height)]
    right=[(x+w*.24,y,z+height*.91),(x+w*.43,y,z+height*.73),(x+w*.5,y,z+height*.52),(x+w*.5,y,z)]
    return tube(name,left+right,thickness,mat)


def ogive_panel(name, center, width, height, mat, depth=.07):
    x,y,z = center
    outline = [(-width*.5,0), (width*.5,0), (width*.5,height*.52),
               (width*.43,height*.73), (width*.24,height*.91), (0,height),
               (-width*.24,height*.91), (-width*.43,height*.73), (-width*.5,height*.52)]
    n = len(outline)
    verts = [(x+a,y+b,z+c) for b in [-depth/2,depth/2] for a,c in outline]
    return mesh(name, verts, [tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)], mat)


def window(center, width=.7, height=1.35, angle=0):
    before = set(h.COLLECTION.objects)
    x,y,z = center
    ogive_panel('Window / deep reveal',center,width+.14,height+.08,'wood_dark')
    ogive_panel('Window / jade glazing',(x,y-.055,z+.03),width,height,'glass')
    pointed('Window / carved ivory frame',(x,y-.10,z),width+.05,height+.04,'wood_light',.055)
    beam('Window / sill',(x-width*.60,y-.07,z),(x+width*.60,y-.07,z),.1,'stone_light')
    tube('Window / gilded mullion',[(x,y-.12,z),(x,y-.12,z+height*.96)],.019,'brass',5)
    for s in [-1,1]:
        tube('Window / branching tracery',[(x+s*width*.46,y-.12,z+height*.37),(x,y-.12,z+height*.64),(x+s*width*.30,y-.12,z+height*.82)],.016,'brass',5)
    if angle:
        rotate_parts(set(h.COLLECTION.objects)-before, center, angle)


def rotate_parts(objects, center, angle):
    from mathutils import Matrix
    bpy.context.view_layer.update()
    pivot = Vector(center)
    transform = Matrix.Translation(pivot) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Translation(-pivot)
    for obj in objects:
        obj.matrix_world = transform @ obj.matrix_world


def door(center, width=1.05, height=2.1):
    x,y,z = center
    ogive_panel('Door / shadow reveal',center,width+.2,height+.10,'wood_dark',.12)
    ogive_panel('Door / living oak',(x,y-.08,z+.03),width,height,'wood',.12)
    pointed('Door / flowing surround',(x,y-.17,z),width+.09,height+.06,'wood_light',.105)
    for i in range(-2,3):
        xx = i*width/6
        top = height*(.98-.55*(abs(xx)/(width*.5))**1.5)
        tube('Door / board seam',[(x+xx,y-.145,z+.08),(x+xx,y-.145,z+top)],.009,'wood_dark',4)
    for s in [-1,1]:
        tube('Door / vine hinge',[(x+s*width*.43,y-.17,z+.4),(x+s*width*.1,y-.18,z+.55),(x+s*width*.25,y-.18,z+.85)],.023,'brass',5)
    torus('Door / ring pull',(x+width*.23,y-.20,z+.94),.065,.013,'brass',(math.pi/2,0,0))
    leaf('Door / sigil',(x,y-.19,z+1.15),(x,y-.19,z+1.65),.20,'teal_light',.02,True)


def canopy(center, radius, rise, petals=10):
    """Conforming scalloped shingles with measured clearances, without crossings.

    Every backing, tile and rib uses the same radial height function. Separate
    sectors have a real reveal; crowns meet a cap rather than collapsing to a
    pile of intersecting leaves. The offsets are geometry, not depth bias.
    """
    x,y,z = center
    power=1.10
    height=lambda r:rise*(1-(max(0,r)/radius)**(1/power))
    radial=lambda t:radius*(1-t)**power
    profile=[(radial(i/12),rise*i/12) for i in range(13)]
    shell=lathe('Roof / backing shell',center,profile,'roof_dark',petals*4)
    shell['surface_role']='roof_backing'
    row_limits=[0,.24,.48,.72,.93]
    minimum_gap=.012
    for row in range(4):
        outer=radial(row_limits[row])-.008
        inner=radial(row_limits[row+1])+.008
        count=petals if row<3 else petals-2
        for i in range(count):
            middle=TAU*(i+(row%2)*.5)/count
            half=math.pi/count-minimum_gap/(2*inner)
            verts=[]; steps=4; across=4
            for layer in range(2):
                for j in range(steps+1):
                    t=j/steps
                    for k in range(across+1):
                        u=2*k/across-1
                        # Retract the two corners of the eave to form a leaf tip.
                        scallop=(outer-inner)*.16*abs(u)**2
                        r=inner+(outer-inner-scallop)*t
                        angle=middle+u*half
                        relief=.017*(1-u*u)*math.sin(math.pi*t)
                        lift=.055+relief-layer*.018
                        verts.append((x+r*math.cos(angle),y+r*math.sin(angle),z+height(r)+lift))
            grid=across+1; size=(steps+1)*grid; faces=[]
            for layer in range(2):
                for j in range(steps):
                    for k in range(across):
                        a=layer*size+j*grid+k
                        f=(a,a+1,a+grid+1,a+grid)
                        faces.append(f if layer==0 else tuple(reversed(f)))
            perimeter=list(range(grid))+[j*grid+across for j in range(1,steps+1)]+[steps*grid+k for k in range(across-1,-1,-1)]+[j*grid for j in range(steps-1,0,-1)]
            for j,a in enumerate(perimeter):
                b=perimeter[(j+1)%len(perimeter)]
                faces.append((a,a+size,b+size,b))
            color=['roof','roof','roof_light','leaf_dark'][(i+row)%4]
            tile=mesh('Roof / leaf shingle',verts,faces,color)
            tile['surface_role']='roof_shingle'
            tile['backing_clearance']=.030
            tile['row']=row
            vein=[]
            for j in range(6):
                t=j/5
                r=inner+(outer-inner)*t
                zz=z+height(r)+.063+.017*math.sin(math.pi*t)
                vein.append((x+r*math.cos(middle),y+r*math.sin(middle),zz))
            tube('Roof / leaf midrib',vein,.012,'brass',6)
    ring('Roof / golden drip edge',(x,y,z+.045),radius,.040)
    cap_radius=radial(.925)+.035
    lathe('Roof / crown cap',(x,y,z+rise*.925+.07),[(cap_radius,0),(.04,rise*.075),(.035,rise*.075+.05)],'brass',petals*2)
    lathe('Roof / bud finial',(x,y,z+rise+.08),[(.055,0),(.10,.12),(.055,.22),(0,.42)],'brass',12)


def roots(center, radius=1, height=3, count=7):
    x,y,z = center
    for i in range(count):
        a = TAU*i/count+.13
        tube('Living timber / spreading buttress root',
             [(x+math.cos(a)*radius*1.65,y+math.sin(a)*radius*1.65,z+.035),
              (x+math.cos(a)*radius*.95,y+math.sin(a)*radius*.95,z+.23),
              (x+math.cos(a)*radius*.67,y+math.sin(a)*radius*.67,z+height*.4),
              (x+math.cos(a+.12)*radius*.55,y+math.sin(a+.12)*radius*.55,z+height)],
             [.06*radius,.18*radius,.13*radius,.03*radius],'wood',9)


def flower(center, scale=.3, color='linen'):
    x,y,z = center
    tube('Flower / stalk',[(x,y,z),(x+.04*scale,y,z+scale*.6),(x,y,z+scale)],.015*scale,'leaf_dark',5)
    for i in range(5):
        a=TAU*i/5
        leaf('Flower / petal',(x,y,z+scale),(x+math.cos(a)*scale*.38,y+math.sin(a)*scale*.38,z+scale*1.13),scale*.28,color,.035)
    sphere('Flower / pollen',(x,y,z+scale*1.08),(.065*scale,)*3,'brass',1)


def fern(center, scale=1, fronds=7):
    x,y,z = center
    for i in range(fronds):
        a=TAU*i/fronds
        pts=[]
        for j in range(7):
            t=j/6
            pts.append((x+math.cos(a)*scale*(.025+.68*t),y+math.sin(a)*scale*(.025+.68*t),z+scale*(.9*t-.48*t*t)))
        tube('Fern / arched rachis',pts,.012*scale,'leaf_light',5)
        for j in range(1,6):
            p=Vector(pts[j]); t=j/6
            for side in [-1,1]:
                d=Vector((math.cos(a+side*1.0),math.sin(a+side*1.0),.14))
                leaf('Fern / paired leaflet',p,p+d*scale*.26*(1-t*.75),scale*.095*(1-t*.6),'leaf' if i%2 else 'leaf_light',.018,rows=3)


def bottle(center, scale=.3, color='glass'):
    x,y,z=center
    profile=[(.08,0),(.18,.06),(.20,.30),(.10,.41),(.065,.47),(.065,.67),(.08,.68)]
    lathe('Alchemy / glazed flask',(x,y,z),[(r*scale,zz*scale) for r,zz in profile],color,12)
    cyl('Alchemy / cork',(x,y,z+.70*scale),.060*scale,.10*scale,'wood_light',10)
    ring('Alchemy / gold collar',(x,y,z+.57*scale),.071*scale,.012*scale,'brass',16)
    box('Alchemy / ivory label',(x,y-.19*scale,z+.22*scale),(.20*scale,.015*scale,.17*scale),'linen',.005)


def lantern(center, scale=1):
    x,y,z=center
    sphere('Lantern / firefly heart',(x,y,z+.28*scale),(.13*scale,.13*scale,.23*scale),'amber',2)
    for i in range(6):
        a=TAU*i/6
        tube('Lantern / petal cage',[(x,y,z),(x+math.cos(a)*.21*scale,y+math.sin(a)*.21*scale,z+.20*scale),
             (x+math.cos(a)*.17*scale,y+math.sin(a)*.17*scale,z+.46*scale),(x,y,z+.62*scale)],.024*scale,'brass',6)
    ring('Lantern / girdle',(x,y,z+.23*scale),.20*scale,.022*scale)
    tube('Lantern / hanger',[(x,y,z+.60*scale),(x,y,z+.78*scale)],.025*scale,'brass',6)


def start(name,label,category,description):
    h.start_asset(name,label,category)
    h.ASSETS[-1]['description']=description


def finish():
    h.finish_asset()


def surface_masks():
    """Exportable PBR atlas: satin metal inlays and softly luminous fireflies."""
    width,height=512,256
    pbr=[0.0]*(width*height*4)
    glow=[0.0]*(width*height*4)
    keys=list(h.PALETTE)
    for y in range(height):
        for x in range(width):
            index=(y//64)*8+x//64
            key=keys[index] if index<len(keys) else 'linen'
            rough=.38 if key in ['brass','glass','water'] else .83
            metal=.62 if key=='brass' else (.32 if key=='iron' else 0)
            offset=(y*width+x)*4
            pbr[offset:offset+4]=[1,rough,metal,1]
            glow[offset:offset+4]=[.42,.46,.18,1] if key=='amber' else [0,0,0,1]
    nodes=h.MATERIAL.node_tree.nodes; links=h.MATERIAL.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    for name,pixels,noncolor in [('Arboleda_Metal_Roughness',pbr,True),('Arboleda_Firefly_Emission',glow,False)]:
        img=bpy.data.images.new(name,width,height,alpha=False)
        if noncolor: img.colorspace_settings.name='Non-Color'
        img.pixels.foreach_set(pixels)
        img.filepath_raw=str(OUT/'textures'/(name.lower()+'.png')); img.file_format='PNG'; img.save(); img.pack()
        texture=nodes.new('ShaderNodeTexImage'); texture.image=img
        if noncolor:
            separate=nodes.new('ShaderNodeSeparateColor')
            links.new(texture.outputs['Color'],separate.inputs['Color'])
            links.new(separate.outputs['Green'],bsdf.inputs['Roughness'])
            links.new(separate.outputs['Blue'],bsdf.inputs['Metallic'])
        else:
            links.new(texture.outputs['Color'],bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value=.65


def buildings():
    start('house_leafhaven','Casa Brote del Alba','Edificios','Vivienda élfica circular con tejado de hojas solapadas, ventanales ojivales y raíces habitables.')
    lathe('House / limestone plinth',(0,0,0),[(2.1,0),(2.1,.14),(1.95,.25)],'stone_light',32)
    cyl('House / warm lime walls',(0,0,1.65),1.62,2.8,'plaster',32)
    for z in [.34,2.94]: ring('House / carved belt',(0,0,z),1.65,.095,'wood_light')
    for i in range(8):
        a=TAU*i/8
        tube('House / grown column',[(1.7*math.cos(a),1.7*math.sin(a),.2),(1.64*math.cos(a+.03),1.64*math.sin(a+.03),1.6),(1.85*math.cos(a),1.85*math.sin(a),3.12)], [.12,.085,.13],'wood',9)
    door((0,-1.63,.25))
    for a in [-math.pi/2, math.pi/2, math.pi]:
        window((1.63*math.sin(a),-1.63*math.cos(a),1.1),.73,1.45,a)
    canopy((0,0,3.02),2.22,2.05,12)
    for s in [-1,1]:
        fern((s*1.35,-1.37,.25),.65,5)
        lantern((s*.90,-1.58,1.85),.70)
    box('House / doorstep',(0,-1.95,.14),(1.45,.75,.22),'stone_light',.08)
    finish()

    start('laboratory_dew','Alquimería del Rocío','Edificios','Laboratorio arbóreo de dos alturas, alambique exterior, balcón y cubierta vegetal.')
    lathe('Laboratory / pedestal',(0,0,0),[(2.2,0),(2.2,.18),(2,.30)],'stone',32)
    cyl('Laboratory / lower walls',(0,0,1.9),1.76,3.3,'plaster_warm',32)
    cyl('Laboratory / upper walls',(0,0,4.03),1.20,1.2,'plaster',24)
    roots((0,0,.12),1.48,4.5,9)
    for z,r in [(.34,1.8),(3.42,1.83),(3.55,1.29),(4.67,1.27)]: ring('Laboratory / cornice',(0,0,z),r,.085,'wood_light')
    door((0,-1.79,.3),1.12,2.3)
    for a in [-1.05,1.05,2.7]: window((1.78*math.sin(a),-1.78*math.cos(a),1.3),.8,1.65,a)
    window((0,-1.23,3.62),.65,.95)
    canopy((0,0,4.65),1.73,1.8,10)
    # Balcony on the lower roof: visible turned posts and braided rails.
    for i in range(13):
        a=math.pi+math.pi*i/12
        x,y=2.02*math.cos(a),2.02*math.sin(a)
        beam('Balcony / spindle',(x,y,3.37),(x,y,3.97),.048,'wood_light')
    for z in [3.37,3.97]:
        tube('Balcony / crescent rail',[(2.02*math.cos(math.pi+math.pi*i/24),2.02*math.sin(math.pi+math.pi*i/24),z) for i in range(25)],.06,'wood_light')
    lathe('Balcony / floor',(0,0,3.30),[(1.95,0),(1.95,.12)],'wood',32)
    # A projecting copper alembic with a connected condenser.
    lathe('Exterior / copper retort',(2.05,.35,.2),[(.40,0),(.5,.25),(.47,.70),(.16,1.08),(.08,1.4)],'brass',16)
    tube('Exterior / condenser neck',[(2.05,.35,1.6),(2.05,.35,1.9),(2.6,.35,2.1),(2.85,.35,1.85),(2.85,.35,.8)],.055,'brass',8)
    bottle((2.85,.35,.2),.9,'glass')
    lantern((-.85,-1.85,2.30),.85)
    finish()

    start('pavilion_moonwell','Pabellón del Manantial','Edificios','Santuario abierto con seis columnas ramificadas y rosetón vegetal.')
    lathe('Pavilion / steps',(0,0,0),[(2.6,0),(2.6,.14),(2.35,.14),(2.35,.31),(2.10,.31),(2.10,.43)],'stone_light',48)
    for i in range(6):
        a=TAU*i/6
        x,y=1.77*math.cos(a),1.77*math.sin(a)
        lathe('Pavilion / column foot',(x,y,.42),[(.25,0),(.25,.12),(.15,.23)],'stone',12)
        tube('Pavilion / grown column',[(x,y,.61),(x*.97,y*.97,1.5),(x,y,2.7),(x*1.1,y*1.1,3.25)],[.13,.09,.1,.055],'wood_light',10)
        for s in [-1,1]:
            aa=a+s*math.pi/6
            tube('Pavilion / branching capital',[(x,y,2.25),(x*.7+.5*math.cos(aa),y*.7+.5*math.sin(aa),2.9),(1.8*math.cos(aa),1.8*math.sin(aa),3.25)],[.08,.06,.025],'wood_light',7)
    ring('Pavilion / ring beam',(0,0,3.20),1.98,.11,'wood_light')
    canopy((0,0,3.24),2.43,1.65,12)
    lathe('Pavilion / sacred basin',(0,0,.43),[(.7,0),(.55,.15),(.30,.25),(.27,.63),(.65,.85),(.72,.98),(.60,1),(.48,.87),(.02,.85)],'stone_light',24)
    cyl('Pavilion / water',(0,0,1.32),.53,.025,'water',32)
    for a in [0,TAU/3,2*TAU/3]: leaf('Pavilion / lily',(math.cos(a)*.10,math.sin(a)*.10,1.35),(math.cos(a)*.43,math.sin(a)*.43,1.42),.25,'leaf',.02)
    finish()

    start('tower_starwatch','Atalaya de las Copas','Edificios','Torre de vigía de madera viva, escalera helicoidal y mirador de hojas.')
    lathe('Tower / foundation',(0,0,0),[(1.65,0),(1.65,.2),(1.45,.35)],'stone',28)
    lathe('Tower / heartwood',(0,0,.25),[(.65,0),(.48,1),(.37,3),(.35,4.8)],'wood',16)
    roots((0,0,0),.95,4.7,7)
    for i in range(31):
        a=-math.pi/2+i*.22
        step=box('Tower / spiral tread',(math.cos(a)*.80,math.sin(a)*.80,.35+i*.12),(.92,.30,.12),'wood_light',.025, (0,0,a))
        x,y=math.cos(a)*1.25,math.sin(a)*1.25
        beam('Tower / stair baluster',(x,y,.42+i*.12),(x,y,1.13+i*.12),.035,'wood_mid')
    tube('Tower / continuous handrail',[(math.cos(-math.pi/2+i*.22)*1.25,math.sin(-math.pi/2+i*.22)*1.25,1.13+i*.12) for i in range(31)],.045,'wood_light')
    cyl('Tower / lookout deck',(0,0,4.13),1.53,.16,'wood',32)
    for i in range(10):
        a=TAU*i/10
        x,y=1.42*math.cos(a),1.42*math.sin(a)
        beam('Tower / lookout rail post',(x,y,4.2),(x,y,4.94),.055,'wood_light')
        if i%2==0: tube('Tower / canopy support',[(x,y,4.2),(x*.95,y*.95,5.20),(x*.8,y*.8,6.0)],[.085,.06,.10],'wood_light')
    ring('Tower / lookout railing',(0,0,4.94),1.42,.055,'wood_light')
    canopy((0,0,5.90),1.85,1.8,10)
    finish()

    start('greenhouse_moonfern','Invernadero de Lunhelecho','Edificios','Invernadero octogonal de cristal de jade con nervaduras, parterres y flores lunares.')
    lathe('Greenhouse / plinth',(0,0,0),[(2.05,0),(2.05,.20),(1.92,.30)],'stone_light',8)
    cyl('Greenhouse / glazed walls',(0,0,1.45),1.83,2.35,'glass',8)
    for i in range(8):
        a=TAU*i/8+math.pi/8
        x,y=1.83*math.cos(a),1.83*math.sin(a)
        tube('Greenhouse / ivory rib',[(x,y,.23),(x,y,2.6),(x*.8,y*.8,3.1),(0,0,3.95)],.055,'wood_light',8)
    for z in [.32,1.05,2.60]: ring('Greenhouse / binding',(0,0,z),1.83,.055,'brass',8)
    lathe('Greenhouse / glazed cupola',(0,0,2.60),[(1.84,0),(1.48,.5),(.03,1.35)],'teal_light',8)
    door((0,-1.72,.30),.96,2.0)
    for s in [-1,1]:
        box('Greenhouse / raised herb bed',(s*1.28,-1.42,.43),(.65,.75,.30),'stone',.07)
        fern((s*1.28,-1.42,.58),.67,6)
        for j in range(3): flower((s*1.28+j*.1-.1,-1.57,.60),.30,'linen')
    lathe('Greenhouse / finial',(0,0,3.95),[(.08,0),(.13,.14),(0,.40)],'brass',10)
    finish()


def construction():
    start('gateway_twining','Umbral de las Dos Ramas','Construcción','Gran arco transitable de ramas entrelazadas, hojas y faroles de luciérnaga.')
    tube('Gateway / grown arch',[(-1.6,0,.2),(-1.65,0,1.5),(-1.45,0,2.7),(-.9,0,3.55),(0,0,4.15),
         (.9,0,3.55),(1.45,0,2.7),(1.65,0,1.5),(1.6,0,.2)],
         [.20,.16,.15,.11,.04,.11,.15,.16,.20],'wood',10)
    tube('Gateway / golden inner vine',[(-1.38,-.12,.3),(-1.38,-.12,1.8),(-1.1,-.12,2.85),(-.65,-.12,3.52),(0,-.12,3.95),
         (.65,-.12,3.52),(1.1,-.12,2.85),(1.38,-.12,1.8),(1.38,-.12,.3)],.035,'brass',7)
    for s in [-1,1]:
        lathe('Gateway / carved plinth',(s*1.6,0,0),[(.45,0),(.45,.17),(.31,.30)],'stone_light',12)
        for i in range(5):
            x=s*(1.60-i*.20); z=2.45+i*.30
            leaf('Gateway / crown leaf',(x,0,z),(x+s*.48,.10,z+.46),.35,'leaf' if i%2 else 'leaf_light',.08,True)
        lantern((s*1.27,0,2.0),.85)
        tube('Gateway / lamp hook',[(s*1.6,0,2.95),(s*1.27,0,3.03),(s*1.27,0,2.66)],.045,'brass')
    finish()


    start('bridge_rootwoven','Puente de Raíz Trenzada','Construcción','Pasarela arqueada de cinco metros con tablas separadas y barandillas entrelazadas.')
    for i in range(22):
        x=-2.5+(i+.5)*5/22
        z=.16+.64*(1-(x/2.5)**2)
        box('Bridge / individual plank',(x,0,z),(5/22-.014,1.75,.16),'wood_light' if i%3 else 'wood',.025,(0,math.atan(.205*x),0))
    for s in [-1,1]:
        for j in range(7):
            x=-2.5+j*5/6; z=.16+.64*(1-(x/2.5)**2)
            tube('Bridge / rail post',[(x,s*.89,z),(x,s*.94,z+.85)],.055,'wood',8)
        for zz in [-.1,.95]:
            tube('Bridge / swept rail',[(x,s*.94,.16+.64*(1-(x/2.5)**2)+zz) for x in [-2.5+i*5/32 for i in range(33)]],.08 if zz<0 else .065,'wood',8)
        for phase in [0,math.pi]:
            tube('Bridge / woven vine',[(x,s*.94+.034*math.cos(x*3+phase),.65+.64*(1-(x/2.5)**2)+.22*math.sin(x*3+phase)) for x in [-2.5+i*5/40 for i in range(41)]],.025,'brass',5)
    finish()

    start('fence_vinepanel','Valla de Sarmientos · 2 m','Construcción','Módulo de dos metros con extremos encajables y hojas de latón.')
    for x in [-1,1]:
        cyl('Fence / stone foot',(x,0,.10),.16,.20,'stone',10)
        tube('Fence / post',[(x,0,.12),(x,0,.75),(x,0,1.16)],[.07,.055,.035],'wood_light')
        leaf('Fence / terminal bud',(x,0,1.13),(x,0,1.39),.15,'brass',.02)
    for z in [.30,1.0]: tube('Fence / rail',[(-1,0,z),(0,0,z+.05),(1,0,z)],.05,'wood')
    for phase in [0,math.pi]:
        tube('Fence / braid',[(x,.032*math.cos(x*math.pi*2+phase),.65+.29*math.sin(x*math.pi*2+phase)) for x in [-1+i/16 for i in range(33)]],.024,'wood_light',6)
    for x in [-.65,0,.65]: leaf('Fence / leaf',(x,0,.58),(x+.18,0,.90),.16,'brass',.015)
    finish()


def legs(width,depth,height,mat='wood'):
    for sx in [-1,1]:
        for sy in [-1,1]:
            x,y=sx*width/2,sy*depth/2
            tube('Furniture / curved root leg',[(x*1.12,y*1.12,.035),(x,y,height*.25),(x*.88,y*.88,height*.7),(x,y,height)],[.065,.052,.045,.075],mat,8)


def book(center, width=.18, height=.5, color='book_purple'):
    x,y,z=center
    box('Book / pages',(x,y,z+height/2),(width*.82,.31,height*.91),'linen',.005)
    for xx in [-width/2,width/2]: box('Book / cover',(x+xx,y,z+height/2),(.025,.35,height),color,.007)
    box('Book / spine',(x,y-.17,z+height/2),(width,.05,height),color,.012)
    for zz in [.17,.78]: box('Book / gilt rib',(x,y-.2,z+height*zz),(width+.006,.012,.018),'brass',.002)


def furniture():
    start('table_alchemist','Mesa de la Transmutación','Alquimia','Mesa de trabajo con herbario abierto, matraces, mortero, retorta y diagrama alquímico.')
    legs(1.6,.72,.92)
    for i in range(5): box('Table / planed board',(0,-.48+(i+.5)*.96/5,.94),(2.15,.96/5-.009,.12),'wood_light' if i%2 else 'wood_mid',.025)
    for sy in [-1,1]: beam('Table / carved apron',(-.94,sy*.42,.79),(.94,sy*.42,.79),.1,'wood')
    for sx in [-1,1]:
        tube('Table / scroll bracket',[(sx*.65,-.40,.56),(sx*.58,-.40,.76),(sx*.32,-.40,.82)],.035,'brass')
    ring('Table / transmutation seal',(.35,0,1.007),.29,.010,'brass',32)
    for i in range(3):
        a=TAU*i/3
        beam('Table / triangle',(.35+.23*math.cos(a),.23*math.sin(a),1.011),(.35+.23*math.cos(a+TAU/3),.23*math.sin(a+TAU/3),1.011),.012,'brass')
    for x,y,s,c in [(-.75,.27,.65,'glass'),(-.47,.25,.5,'book_purple'),(.76,.26,.6,'teal')]: bottle((x,y,1.0),s,c)
    for s in [-1,1]: box('Herbarium / open pages',(-.52+s*.13,-.20,1.035),(.26,.34,.035),'linen',.006,(0,s*.12,0))
    for i in range(3): leaf('Herbarium / pressed leaf',(-.63+i*.10,-.28,1.065),(-.60+i*.10,-.09,1.066),.05,'leaf_dark',.001)
    lathe('Mortar / bowl',(.78,-.22,1.0),[(.13,0),(.16,.18),(.14,.20),(.10,.15),(.04,.08)],'stone',16)
    beam('Mortar / pestle',(.74,-.24,1.05),(.89,-.20,1.30),.045,'stone_light')
    finish()

    start('chair_leafback','Silla Hoja de Laurel','Mobiliario','Silla con respaldo lanceolado, incrustación vegetal y cojín verde.')
    legs(.48,.45,.49)
    box('Chair / seat',(0,0,.50),(.64,.61,.12),'wood_light',.04)
    box('Chair / moss cushion',(0,-.02,.585),(.53,.49,.10),'teal',.045)
    tube('Chair / flowing stile',[(-.25,.23,.3),(-.29,.25,.85),(-.23,.26,1.18),(0,.26,1.55),(.23,.26,1.18),(.29,.25,.85),(.25,.23,.3)],
         [.045,.04,.035,.018,.035,.04,.045],'wood_light')
    leaf('Chair / leaf back',(0,.26,.68),(0,.26,1.51),.43,'roof',.02,True)
    finish()

    start('bench_bough','Banco de Ramas Gemelas','Mobiliario','Banco de jardín con asiento entablado, brazos curvos y respaldo trenzado.')
    legs(1.52,.46,.48)
    for i in range(3): box('Bench / seat slat',(0,-.26+(i+.5)*.52/3,.49),(1.95,.16,.10),'wood_light',.025)
    tube('Bench / branching back',[(-.76,.22,.12),(-.80,.24,.75),(-.65,.24,1.1),(0,.24,1.18),(.65,.24,1.1),(.80,.24,.75),(.76,.22,.12)],
         [.07,.06,.045,.025,.045,.06,.07],'wood')
    for s in [-1,1]:
        tube('Bench / arm',[(s*.82,-.25,.52),(s*.86,-.20,.80),(s*.82,.22,.85)],.052,'wood_light')
    for phase in [0,math.pi]: tube('Bench / woven back',[(x,.24+.032*math.cos(x*5+phase),.90+.13*math.sin(x*5+phase)) for x in [-.76+i*1.52/24 for i in range(25)]],.024,'brass',6)
    finish()

    start('bed_ferncanopy','Lecho del Sueño Verde','Mobiliario','Cama con dosel de hojas, sábanas de lino, manta cosida y cuatro postes orgánicos.')
    legs(1.17,1.95,.45)
    box('Bed / carved frame',(0,0,.46),(1.48,2.30,.20),'wood',.05)
    box('Bed / linen mattress',(0,0,.64),(1.35,2.16,.23),'linen',.08)
    box('Bed / woven coverlet',(0,-.31,.785),(1.38,1.30,.075),'teal',.04)
    for x in [-.55,-.48,.48,.55]: box('Bed / embroidered stripe',(x,-.31,.825),(.021,1.22,.009),'brass',0)
    for x in [-.34,.34]: box('Bed / pillow',(x,.76,.82),(.57,.44,.17),'linen',.08, (0,0,.06 if x<0 else -.06))
    for sx in [-1,1]:
        for sy in [-1,1]:
            tube('Bed / grown canopy post',[(sx*.69,sy*1.05,.2),(sx*.72,sy*1.05,1.5),(sx*.70,sy*1.05,2.23)],[.075,.05,.045],'wood_light',8)
    for sy in [-1,1]:
        tube('Bed / canopy leaf support',[(-.74,sy*1.05,2.23),(0,sy*1.05,2.23),(.74,sy*1.05,2.23)],.038,'wood_light',8)
        for i in range(5):
            x=-.7+i*.35
            leaf('Bed / canopy leaf',(x,sy*1.05,2.23),(x*.50,sy*.25,2.54),.27,'leaf' if i%2 else 'roof',.08,True)
    leaf('Bed / headboard',(0,1.06,.6),(0,1.06,1.65),1.05,'wood_light',.01,True)
    finish()

    start('cabinet_seedkeeper','Armario del Guardasemillas','Mobiliario','Armario ojival con puertas talladas, cajones, herrajes de latón y pequeñas semillas de cristal.')
    legs(.92,.42,.20)
    box('Cabinet / carcass',(0,0,.98),(1.16,.56,1.65),'wood',.035)
    for sx in [-1,1]:
        ogive_panel('Cabinet / leaf door',(sx*.275,-.30,.58),.50,1.19,'roof',.06)
        pointed('Cabinet / door edge',(sx*.275,-.35,.58),.50,1.19,'wood_light',.027)
        leaf('Cabinet / marquetry',(sx*.275,-.35,.76),(sx*.275,-.35,1.56),.24,'teal_light',.01,True)
        sphere('Cabinet / knob',(sx*.1,-.38,1.04),(.035,)*3,'brass',2)
    for z in [.32,.48]:
        box('Cabinet / drawer',(0,-.305,z),(1.03,.09,.13),'wood_light',.015)
        for x in [-.3,.3]: sphere('Cabinet / drawer pull',(x,-.37,z),(.026,)*3,'brass',1)
    for i in range(7):
        x=-.55+i*.183
        leaf('Cabinet / crown',(x,0,1.78),(x*.7,0,2.05+(.18 if i==3 else 0)),.14,'wood_light',.025)
    finish()

    start('shelf_herbarium','Estantería del Herbario','Alquimia','Estantes curvos con libros encuadernados, frascos de colores y plantas medicinales.')
    for sx in [-1,1]: tube('Shelf / living upright',[(sx*.69,0,.02),(sx*.64,0,.9),(sx*.72,0,1.7),(sx*.40,0,2.20)],[.09,.06,.07,.025],'wood_light',9)
    for z in [.15,.79,1.44,2.01]:
        box('Shelf / board',(0,0,z),(1.48,.48,.085),'wood',.02)
        box('Shelf / gilded front lip',(0,-.24,z+.015),(1.46,.025,.035),'brass',.005)
    for i in range(5): book((-.48+i*.19,-.015,.20),.16,.39+(i%3)*.065,'book_purple' if i%2 else 'book_blue')
    for z in [.835,1.485]:
        for i in range(4): bottle((-.48+i*.32,0,z),.58+(i%2)*.2,['glass','teal','book_purple','amber'][i])
    fern((.17,0,2.055),.39,5)
    finish()

    start('cauldron_bloom','Caldero de Savia Lunar','Alquimia','Caldero abierto con infusión luminosa, hojas flotantes y soporte de raíces.')
    for i in range(3):
        a=TAU*i/3
        tube('Cauldron / root tripod',[(.60*math.cos(a),.60*math.sin(a),.02),(.43*math.cos(a),.43*math.sin(a),.35),(.36*math.cos(a),.36*math.sin(a),.67)],[.07,.055,.09],'wood',8)
    lathe('Cauldron / hollow bronze vessel',(0,0,.29),[(.20,0),(.45,.12),(.54,.40),(.49,.66),(.40,.70),(.36,.65),(.45,.41),(.37,.19),(.04,.16)],'iron',24)
    ring('Cauldron / gold rim',(0,0,.98),.44,.035)
    cyl('Cauldron / infusion',(0,0,.88),.43,.025,'glass',32)
    for i in range(5):
        a=TAU*i/5
        leaf('Cauldron / floating herb',(.1*math.cos(a),.1*math.sin(a),.90),(.34*math.cos(a),.34*math.sin(a),.92),.14,'leaf_light',.015)
    for s in [-1,1]: torus('Cauldron / ring handle',(s*.53,0,.73),.13,.023,'brass',(math.pi/2,0,0))
    beam('Cauldron / stirring spoon',(.23,.12,.66),(.69,.16,1.41),.045,'wood_light')
    finish()

    start('distiller_spiral','Alambique de la Espiral','Alquimia','Alambique completo con retorta de cobre, serpentín helicoidal, baño refrigerante y matraz receptor.')
    box('Distiller / base',(0,0,.10),(1.85,.82,.20),'wood',.04)
    lathe('Distiller / burner',(-.51,0,.2),[(.34,0),(.34,.19),(.25,.30)],'stone',16)
    lathe('Distiller / copper retort',(-.51,0,.48),[(.16,0),(.34,.13),(.37,.48),(.20,.67),(.10,.88),(.09,1.11)],'brass',20)
    ring('Distiller / retort seam',(-.51,0,.91),.375,.02,'wood_dark',32)
    tube('Distiller / swan neck',[(-.51,0,1.59),(-.51,0,1.81),(-.22,0,1.98),(.20,0,1.88),(.45,0,1.62)],.047,'brass',9)
    coil=[(.45+.20*math.sin(TAU*4*i/96),.20*math.cos(TAU*4*i/96),1.62-i*.008) for i in range(97)]
    tube('Distiller / helical condenser',[(.45,0,1.62)]+coil+[(.45,0,.76),(.77,0,.66),(.77,0,.52)],.027,'brass',7)
    lathe('Distiller / cooling bath',(.45,0,.2),[(.27,0),(.29,.24),(.29,.78),(.255,.78),(.255,.08)],'teal',20)
    bottle((.77,0,.2),.43,'glass')
    for z in [.30,.84]: ring('Distiller / bath hoop',(.45,0,z),.29,.02,'brass',24)
    finish()


def decorations():
    start('lantern_budpost','Farola Capullo de Luciérnagas','Decoración','Farola vegetal de pie con jaula de seis pétalos y remate de hojas.')
    lathe('Lamp / foot',(0,0,0),[(.29,0),(.29,.12),(.17,.24)],'stone_light',16)
    tube('Lamp / stem',[(0,0,.20),(-.07,0,1.2),(.08,0,2.0),(.37,0,2.40),(.55,0,2.26),(.55,0,2.04)],[.07,.05,.045,.035,.03,.025],'wood_light',8)
    lantern((.55,0,1.43),1)
    for z,s in [(1.1,-1),(1.7,1)]: leaf('Lamp / leaf',(0,0,z),(s*.48,0,z+.45),.30,'roof',.05,True)
    finish()

    start('fountain_lotus','Fuente del Loto Esmeralda','Decoración','Fuente de dos niveles con receptáculo abierto, pétalos tallados y agua turquesa.')
    lathe('Fountain / stepped base',(0,0,0),[(1.25,0),(1.25,.12),(1.10,.23),(.98,.30)],'stone',40)
    lathe('Fountain / hollow lower basin',(0,0,.30),[(.93,0),(1.07,.30),(1.07,.40),(.96,.43),(.78,.12),(.2,.10)],'stone_light',40)
    cyl('Fountain / lower pool',(0,0,.49),.92,.02,'water',40)
    lathe('Fountain / stem',(0,0,.4),[(.35,0),(.23,.20),(.14,.70),(.24,.96)],'stone_light',24)
    for i in range(9):
        a=TAU*i/9
        leaf('Fountain / carved lotus petal',(math.cos(a)*.1,math.sin(a)*.1,1.24),(math.cos(a)*.73,math.sin(a)*.73,1.58),.38,'teal_light',.12,True)
    cyl('Fountain / upper pool',(0,0,1.37),.43,.02,'water',32)
    lathe('Fountain / lotus heart',(0,0,1.38),[(.12,0),(.15,.20),(.08,.36),(0,.48)],'brass',12)
    for a in [0,TAU/3,2*TAU/3]:
        tube('Fountain / falling stream',[(.50*math.cos(a),.50*math.sin(a),1.40),(.70*math.cos(a),.70*math.sin(a),1.16),(.78*math.cos(a),.78*math.sin(a),.53)],.018,'water',7)
    finish()

    start('waystone_leafrune','Menhir del Pacto Verde','Decoración','Monolito facetado de piedra clara, runas talladas, medallón y musgo.')
    lathe('Waystone / monolith',(0,0,0),[(.46,0),(.39,.20),(.31,1.6),(.22,2.1),(0,2.38)],'stone_light',7)
    ring('Waystone / base collar',(0,0,.17),.40,.025)
    leaf('Waystone / leaf seal',(0,-.31,1.35),(0,-.22,1.98),.27,'teal',.02,True)
    for i in range(4):
        z=.40+i*.19
        tube('Waystone / gilded rune',[(-.12,-.37+i*.016,z+.10),(0,-.38+i*.016,z),(.12,-.37+i*.016,z+.10)],.014,'brass',5)
    for i in range(5):
        a=TAU*i/5
        sphere('Waystone / moss',(math.cos(a)*.34,math.sin(a)*.34,.08),(.19,.17,.09),'leaf',1)
    finish()

    start('armillary_moon','Esfera de las Tres Lunas','Alquimia','Instrumento astral con tres aros inclinados, esfera central y base tallada.')
    lathe('Armillary / pedestal',(0,0,0),[(.45,0),(.45,.10),(.29,.22),(.18,.8),(.28,.94)],'stone_light',20)
    for angle in [(0,0,0),(.8,.5,0),(-.65,.3,0)]:
        obj=ring('Armillary / orbital ring',(0,0,0),.59,.027,'brass',56)
        obj.rotation_euler=angle
        obj.location=(0,0,1.55)
    sphere('Armillary / jade world',(0,0,1.55),(.20,)*3,'glass',2)
    beam('Armillary / axis',(-.36,0,1.02),(.36,0,2.08),.035,'brass')
    for x,z in [(-.51,1.55),(.32,1.94),(.36,1.16)]: sphere('Armillary / satellite',(x,0,z),(.065,)*3,'linen',2)
    finish()

    start('rack_dryingherbs','Secadero de Hierbas','Alquimia','Bastidor con cinco manojos de plantas suspendidos de cuerdas de lino.')
    for s in [-1,1]:
        tube('Herbs / upright',[(s*.72,0,.02),(s*.70,0,1.15),(s*.77,0,1.8)],[.065,.045,.04],'wood',8)
        beam('Herbs / splayed foot',(s*.72,-.34,.04),(s*.72,.34,.04),.08,'wood')
    tube('Herbs / crossbar',[(-.84,0,1.75),(0,0,1.82),(.84,0,1.75)],.06,'wood_light')
    for i in range(5):
        x=-.55+i*.275
        tube('Herbs / linen tie',[(x,0,1.79),(x,0,1.48)],.012,'linen',5)
        for j in range(5):
            dx=(j-2)*.035
            tube('Herbs / bundled stalk',[(x,0,1.48),(x+dx,0,1.15),(x+dx*1.6,.02,.98)],.010,'wood_light',4)
            for z in [1.05,1.17,1.29]: leaf('Herbs / drying leaves',(x+dx,0,z),(x+dx+(-.1 if j%2 else .1),-.04,z-.12),.07,'leaf' if i%2 else 'leaf_light',.015)
        ring('Herbs / binding',(x,0,1.45),.045,.010,'linen',12)
    finish()

    start('planter_moonlily','Jardinera de Flores Lunares','Decoración','Macetero de cerámica verde con borde dorado, helechos y flores de cinco pétalos.')
    lathe('Planter / hollow ceramic urn',(0,0,0),[(.30,0),(.25,.13),(.43,.46),(.38,.65),(.32,.67),(.30,.56),(.15,.12)],'pot',24)
    ring('Planter / golden lip',(0,0,.64),.36,.022,'brass',32)
    cyl('Planter / earth',(0,0,.57),.31,.04,'soil',24)
    fern((0,0,.59),.57,6)
    for i in range(5):
        a=TAU*i/5
        flower((.21*math.cos(a),.21*math.sin(a),.60),.39+(i%2)*.14,'linen' if i%2 else 'red')
    finish()

    start('potion_tray','Bandeja de Elixires','Alquimia','Bandeja de latón con cinco frascos etiquetados de distintos tamaños y colores.')
    lathe('Tray / rim',(0,0,0),[(.44,0),(.44,.045),(.40,.10),(.38,.10),(.38,.05)],'brass',24)
    for i in range(5):
        a=TAU*i/5
        bottle((.23*math.cos(a),.23*math.sin(a),.06),.39+(i%3)*.10,['glass','teal','book_purple','amber','pot'][i])
    finish()


def tree(center=(0,0,0),scale=1,willow=False,sapling=False):
    x,y,z=center
    def p(a,b,c): return (x+a*scale,y+b*scale,z+c*scale)
    tube('Tree / tapering twisted trunk',[p(0,0,0),p(-.13,.05,.7),p(.12,-.04,1.8),p(.05,.05,3.1),p(-.23,0,4.3)],
         [r*scale for r in [.39,.27,.22,.14,.035]],'wood',12)
    roots((x,y,z),.45*scale,1.5*scale,7)
    for i in range(7 if not sapling else 4):
        a=TAU*i/(7 if not sapling else 4)+.2
        reach=1.25+(i%3)*.32
        zz=2.5+(i%3)*.55
        end=p(math.cos(a)*reach,math.sin(a)*reach,zz+.75)
        tube('Tree / sweeping bough',[p(.03,0,1.6+i*.13),p(math.cos(a)*.65,math.sin(a)*.65,zz),end],
             [.14*scale,.105*scale,.028*scale],'wood',9)
        sphere('Tree / sculpted foliage',end,(scale*.90,scale*.77,scale*.53),['leaf_dark','leaf','leaf_light'][i%3],2)
        for j in range(3):
            aa=a+(j-1)*.6
            base=Vector(end)+Vector((math.cos(aa)*.4*scale,math.sin(aa)*.4*scale,0))
            leaf('Tree / silhouette leaf',base,base+Vector((math.cos(aa)*.80*scale,math.sin(aa)*.80*scale,.10*scale)),.40*scale,'leaf' if j%2 else 'leaf_light',.06*scale)
        if willow:
            for j in range(4):
                aa=a+(j-1.5)*.32
                bx,by=math.cos(aa)*(reach+.35),math.sin(aa)*(reach+.35)
                pts=[p(bx,by,zz+.85),p(bx*1.1,by*1.1,zz+.40),p(bx*1.15,by*1.15,zz-.45),p(bx*1.10,by*1.10,zz-1.2)]
                tube('Willow / hanging twig',pts,.016*scale,'wood_mid',5)
                for k in range(6):
                    t=k/6
                    start=Vector(p(bx*(1.10+.05*math.sin(t*math.pi)),by*(1.10+.05*math.sin(t*math.pi)),zz+.30-t*1.45))
                    leaf('Willow / pendant leaf',start,start+Vector((.08*scale,-.02*scale,-.30*scale)),.11*scale,'leaf' if k%2 else 'leaf_light',.02,rows=4)
    sphere('Tree / crown',p(-.18,0,4.0),(1.0*scale,.90*scale,.7*scale),'leaf',2)


def nature():
    start('tree_ancient_oak','Roble Ancestral','Naturaleza','Árbol de copa escalonada, tronco retorcido, raíces expuestas y hojas de silueta.')
    tree(scale=1.45)
    for i in range(3): fern((math.cos(i*2.1)*.64,math.sin(i*2.1)*.64,0),.55,6)
    finish()

    start('tree_weeping_willow','Sauce de la Memoria','Naturaleza','Sauce con ramas arqueadas, cortinas de hojas individuales y raíces sinuosas.')
    tree(scale=1.2,willow=True)
    finish()

    start('tree_young_rowan','Serbal de los Brotes','Naturaleza','Árbol joven de tres metros con follaje claro y bayas doradas.')
    tree(scale=.66,sapling=True)
    for i in range(8):
        a=TAU*i/8
        for j in range(3): sphere('Rowan / berries',(.8*math.cos(a)+j*.035,.8*math.sin(a),1.90+(i%3)*.2),(.045,)*3,'amber',1)
    finish()

    start('fern_cluster','Macizo de Helechos','Naturaleza','Tres helechos con frondes arqueadas y foliolos modelados, sin planos de transparencia.')
    for x,y,s in [(-.32,0,.95),(.35,.17,.68),(.13,-.3,.6)]: fern((x,y,0),s,7)
    finish()

    start('mushrooms_mooncap','Setas de Luna','Naturaleza','Grupo de siete setas con sombrerillos de jade, motas claras y láminas radiales.')
    for i in range(7):
        a=TAU*i/7
        x,y=math.cos(a)*.38,math.sin(a)*.35
        s=.40+(i%3)*.20
        lathe('Mushroom / curved stem',(x,y,0),[(.06,0),(.05,s*.5),(.07,s*.79)],'linen',10)
        lathe('Mushroom / bell cap',(x,y,s*.65),[(s*.38,0),(s*.42,.06*s),(s*.30,.30*s),(.05*s,.46*s),(0,.47*s)],'teal' if i%2 else 'roof_light',16)
        for j in range(5):
            aa=TAU*j/5
            sphere('Mushroom / pale fleck',(x+math.cos(aa)*s*.22,y+math.sin(aa)*s*.22,s*1.0),(.035*s,.045*s,.016*s),'linen',1)
        for j in range(8):
            aa=TAU*j/8
            beam('Mushroom / gill',(x+.07*math.cos(aa),y+.07*math.sin(aa),s*.67),(x+s*.34*math.cos(aa),y+s*.34*math.sin(aa),s*.67),.008,'stone_light')
    finish()

    start('crystals_dewstone','Cristales de Rocío','Naturaleza','Drusa de cuarzo verde con puntas facetadas, vetas doradas y base musgosa.')
    sphere('Crystal / mossy stone',(0,0,.11),(.62,.49,.17),'stone_dark',2)
    for i in range(6):
        a=TAU*i/6
        x,y=.30*math.cos(a),.28*math.sin(a)
        height=.48+(i%3)*.23
        obj=lathe('Crystal / hexagonal point',(x,y,.13),[(.13,0),(.14,height*.68),(.13,height*.82),(0,height)],'glass' if i%2 else 'teal_light',6)
        obj.rotation_euler=(math.sin(a)*.2,math.cos(a)*.22,0)
        tube('Crystal / gold vein',[(x-.07,y-.10,.18),(x-.04,y-.12,height*.55),(x+.025,y-.09,height*.8)],.009,'brass',4)
    fern((-.40,.12,.11),.35,5)
    finish()

    start('flowers_starmeadow','Flores Estrella del Claro','Naturaleza','Rodal de nueve flores blancas y malvas, con hojas y alturas variadas.')
    for i in range(9):
        a=i*2.4; r=.18+.34*(i%3)/2
        x,y=r*math.cos(a),r*math.sin(a)
        s=.28+(i%4)*.07
        flower((x,y,0),s,'linen' if i%3 else 'red')
        for side in [-1,1]: leaf('Meadow / basal leaf',(x,y,.02),(x+side*.14,y+.09,.16),.10,'leaf',.025)
    finish()


def presentation():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.36,.48,.44,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    gallery=bpy.data.collections.new('_Presentation_only')
    scene.collection.children.link(gallery)
    def link(obj):
        for c in list(obj.users_collection): c.objects.unlink(obj)
        gallery.objects.link(obj)
    floor_mat=bpy.data.materials.new('Grove / dark botanical backdrop')
    floor_mat.diffuse_color=(.055,.105,.082,1)
    floor_mat.use_nodes=True
    floor_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.055,.105,.082,1)
    floor_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.015))
    floor=bpy.context.object; floor.name='Gallery floor'; floor.data.materials.append(floor_mat); link(floor)
    for name,loc,energy,size,color in [('Warm key',(-8,-12,22),4200,12,(1,.86,.63)),('Cool rim',(12,10,17),5000,10,(.63,.87,1))]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color
        obj=bpy.data.objects.new(name,data); gallery.objects.link(obj); obj.location=loc
        obj.rotation_euler=(Vector((0,4,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.lights.new('Sun through the leaves','SUN'); data.energy=1.7; data.angle=.15
    obj=bpy.data.objects.new('Sun through the leaves',data); gallery.objects.link(obj); obj.rotation_euler=(.5,-.4,-.5)
    data=bpy.data.cameras.new('Arboleda / presentation camera'); camera=bpy.data.objects.new(data.name,data); gallery.objects.link(camera)
    data.type='ORTHO'; scene.camera=camera
    # Each collection has an offset, so Asset Browser instances stay at ground origin.
    building_positions=[(-9,8),(0,8),(8,8),(-5,17),(4,17)]
    for i,a in enumerate(h.ASSETS):
        if i<5: x,y=building_positions[i]
        elif i<8: x,y=(-9+(i-5)*7,0)
        elif i<23: x,y=(-10+((i-8)%8)*3.0,-5-((i-8)//8)*4.0)
        else: x,y=(14+((i-23)%3)*5.5,((i-23)//3)*7)
        coll=bpy.data.collections[a['name']]
        coll.instance_offset=(x,y,0)
        coll.asset_mark(); coll.asset_data.description=a['description']
        for tag in ['Brumaluz','Arboleda','Elfos',a['category']]: coll.asset_data.tags.new(tag)
        for obj in coll.objects: obj.location.x+=x; obj.location.y+=y
        a['galleryPosition']=[x,y,0]
    camera.location=(43,-57,45)
    camera.rotation_euler=(Vector((5,5,1.5))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=49
    scene.render.resolution_x=2000; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.region_3d.view_distance=42
                area.spaces.active.region_3d.view_location=(5,5,1.5)
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'brumaluz-arboleda.blend'))
    if '--skip-render' not in sys.argv:
        render_gallery()


def render_gallery():
    scene=bpy.context.scene
    camera=scene.camera
    selected=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--asset=')),None)
    camera_location=camera.location.copy(); camera_rotation=camera.rotation_euler.copy()
    camera_scale=camera.data.ortho_scale
    original_resolution=(scene.render.resolution_x,scene.render.resolution_y)
    try:
        if not selected:
            scene.render.filepath=str(ART/'arboleda-collection.png'); bpy.ops.render.render(write_still=True)
        # Close views make joinery, roof shingles and small alchemy fittings reviewable.
        details=[selected] if selected else ['house_leafhaven','laboratory_dew','pavilion_moonwell','table_alchemist','distiller_spiral','tree_weeping_willow']
        for name in details:
            entry=next(a for a in h.ASSETS if a['name']==name)
            coll=bpy.data.collections[name]
            for a in h.ASSETS: bpy.data.collections[a['name']].hide_render=a['name']!=name
            bpy.context.view_layer.update()
            corners=[obj.matrix_world@Vector(v) for obj in coll.objects for v in obj.bound_box]
            lower=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
            upper=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
            center=(lower+upper)*.5
            size=upper-lower
            camera.location=center+Vector((1,-1.55,1.1))*max(size)
            camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.ortho_scale=max(size)*1.45
            scene.render.resolution_x=1200; scene.render.resolution_y=1200
            scene.render.filepath=str(ART/(name+'.png')); bpy.ops.render.render(write_still=True)
    finally:
        for a in h.ASSETS: bpy.data.collections[a['name']].hide_render=False
        camera.location=camera_location; camera.rotation_euler=camera_rotation
        camera.data.ortho_scale=camera_scale
        scene.render.resolution_x,scene.render.resolution_y=original_resolution


if __name__=='__main__':
    h.init()
    h.ATLAS.name='Brumaluz_Arboleda_Painted_Atlas'
    h.MATERIAL.name='Brumaluz_Arboleda_Painted'
    old_atlas=Path(h.ATLAS.filepath_raw)
    target=OUT/'textures'/'arboleda-painted-atlas.png'
    old_atlas.replace(target)
    h.ATLAS.filepath_raw=str(target)
    surface_masks()
    buildings()
    construction()
    furniture()
    decorations()
    nature()
    manifest=dict(version=1,revision=2,title='Arboleda · Cuna de los Elfos',author='Brumaluz',
                  description='Arte original de Blender: arquitectura de madera viva, hojas, piedra lunar y alquimia botánica. Escala métrica. GLB +Y arriba, +Z frente.',
                  assets=h.ASSETS)
    # Save the manifest before expensive render work.
    (ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    presentation()
    (ART/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ARBOLEDA_COMPLETE '+str(len(h.ASSETS)),flush=True)

