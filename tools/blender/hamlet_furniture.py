"""Twelve original, furnished and fully modelled Brumaluz interior pieces."""
from hamlet_common import *


def legs(name, xs, ys, top, turned=False):
    for x in xs:
        for y in ys:
            if turned:
                lathe(name+'-turned-leg',(x,y,0),[(.08,0),(.10,.045),(.07,.12),(.055,top*.60),(.10,top*.73),(.07,top)],'wood',10)
            else:
                box(name+'-foot',(x,y,.06),(.16,.16,.12),'wood_dark')
                box(name+'-leg',(x,y,(top+.10)/2),(.11,.11,top-.10),'wood')


def planked_top(name, z, width, depth, x=0, y=0):
    n=max(3,round(depth/.18))
    for i in range(n):
        box(name+'-plank',(x,y-depth/2+(i+.5)*depth/n,z),(width,depth/n-.012,.09),'wood_light' if i%3==0 else 'wood_mid',.018)
    for sx in [-1,1]:
        box(name+'-end-cap',(x+sx*width/2,y,z),(.075,depth+.04,.12),'wood')
        for sy in [-1,1]:
            sphere(name+'-peg',(x+sx*(width/2-.10),y+sy*(depth/2-.08),z+.048),(.025,.025,.008),'wood_dark')


def book(name, loc, size=(.10,.30,.38), color='book_blue', tilt=0):
    x,y,z=loc
    w,d,h=size
    before=set(bpy.data.objects)
    box(name+'-pages',(x,y,z+h/2),(w-.02,d-.035,h-.025),'linen',.008)
    for s in [-1,1]:
        box(name+'-cover',(x+s*w/2,y,z+h/2),(.018,d+.015,h+.025),color,.006)
    box(name+'-spine',(x,y-d/2,z+h/2),(w+.018,.035,h+.02),color,.008)
    for zz in [.10,h-.08]:
        box(name+'-spine-band',(x,y-d/2-.020,z+zz),(w*.8,.012,.016),'brass',.003)
    for obj in set(bpy.data.objects)-before:
        if tilt:
            obj.location.x=x+(obj.location.x-x)*math.cos(tilt)+(obj.location.z-z)*math.sin(tilt)
            obj.location.z=z-(obj.location.x-x)*math.sin(tilt)+(obj.location.z-z)*math.cos(tilt)
            obj.rotation_euler.y+=tilt


def bottle(name,loc,color='teal',scale=1):
    profile=[(.075,0),(.10,.035),(.105,.19),(.055,.25),(.04,.27),(.04,.35),(.055,.355),(.055,.38)]
    lathe(name,loc,[(r*scale,z*scale) for r,z in profile],color)
    x,y,z=loc
    cyl(name+'-cork',(x,y,z+.39*scale),.037*scale,.045*scale,'wood_light',10)
    box(name+'-label',(x,y-.103*scale,z+.13*scale),(.11*scale,.012,.10*scale),'linen',.006)


def bowl(name,loc,r=.16):
    lathe(name,loc,[(r*.5,0),(r*.75,.015),(r,.09),(r,.11),(r*.87,.11),(r*.70,.035)],'pot')


def table():
    start_asset('table_tavern_feast','Mesa de la posada','Mobiliario')
    # Trestles, through tenons and feet support the visibly separate planks.
    for x in [-.72,.72]:
        box('trestle-foot',(x,0,.075),(.25,.78,.15),'wood_dark',.04)
        box('trestle-upright',(x,0,.43),(.15,.23,.65),'wood',.025)
        box('trestle-head',(x,0,.73),(.25,.76,.13),'wood')
        for s in [-1,1]:
            beam('angled-trestle',(x,s*.32,.17),(x,0,.65),.09,'wood_light')
    box('through-stretcher',(0,0,.26),(1.75,.11,.14),'wood_dark')
    for x in [-.86,.86]:
        box('wedged-tenon',(x,-.008,.27),(.065,.17,.22),'wood_light',.015)
    planked_top('table',.82,2.1,.90)
    box('runner',(0,0,.88),(1.38,.28,.025),'teal',.01)
    for x in [-.63,.63]:
        box('runner-end',(x,0,.896),(.035,.28,.01),'linen',.002)
    for x in [-.68,.67]:
        bowl('earthenware-bowl',(x,.23,.864),.13)
    lathe('cider-pitcher',(.10,.08,.891),[(.10,0),(.16,.06),(.17,.24),(.10,.32),(.12,.38),(.09,.39)],'pot')
    torus('pitcher-handle',(.28,.08,1.111),.10,.022,'pot',(math.pi/2,0,0))
    sphere('bread-loaf',(-.28,-.06,.96),(.24,.13,.09),'wood_light',2)
    for x in [-.39,-.28,-.17]:
        beam('bread-score',(x-.02,-.10,1.02),(x+.02,-.02,1.04),.014,'linen')
    finish_asset()


def chair():
    start_asset('chair_oak_carved','Silla de roble tallado','Mobiliario')
    legs('chair',[-.24,.24],[-.22,.22],.49,True)
    for y in [-.22,.22]:
        beam('chair-rung',(-.24,y,.22),(.24,y,.22),.05,'wood_dark')
    planked_top('seat',.50,.62,.58)
    box('sage-cushion',(0,-.015,.58),(.49,.43,.11),'teal',.045)
    for x in [-.25,.25]:
        beam('back-post',(x,.23,.45),(x,.30,1.22),.10,'wood')
        sphere('carved-finial',(x,.30,1.26),(.09,.09,.10),'wood_light',2)
    arch_panel('carved-back',(0,.28,.76),.42,.43,.08,'wood_mid')
    box('back-diamond',(0,.227,1.03),(.13,.024,.13),'teal',.01,(0,math.pi/4,0))
    box('back-lower-rail',(0,.255,.78),(.53,.095,.075),'wood_dark')
    finish_asset()


def bench():
    start_asset('bench_garden','Banco del jardín','Mobiliario')
    legs('bench',[-.70,.70],[-.20,.20],.49)
    planked_top('bench-seat',.51,1.8,.57)
    for x in [-.72,.72]:
        beam('bench-back-post',(x,.22,.37),(x,.32,1.12),.10,'wood')
        box('bench-arm',(x,0,.76),(.12,.64,.085),'wood_light')
        beam('arm-support',(x,-.20,.52),(x,-.20,.76),.065,'wood')
    for z in [.82,1.02]:
        box('bench-back-plank',(0,.29,z),(1.58,.09,.14),'wood_mid')
    for x in [-.68,.68]:
        for z in [.82,1.02]:
            sphere('bench-brass-pin',(x,.235,z),(.024,.014,.024),'brass')
    finish_asset()


def stool():
    start_asset('stool_round','Taburete del artesano','Mobiliario')
    for i in range(3):
        a=math.tau*i/3
        beam('splayed-stool-leg',(.26*math.cos(a),.26*math.sin(a),.03),(.17*math.cos(a),.17*math.sin(a),.51),.085,'wood')
        b=math.tau*(i+1)/3
        beam('stool-rung',(.22*math.cos(a),.22*math.sin(a),.21),(.22*math.cos(b),.22*math.sin(b),.21),.043,'wood_dark')
    cyl('seat-rim',(0,0,.51),.33,.10,'wood_dark',16)
    cyl('seat-top',(0,0,.57),.315,.04,'wood_mid',16)
    for x in [-.12,.12]:
        box('seat-plank-joint',(x,0,.592),(.009,.55,.004),'wood_dark',0)
    finish_asset()


def bed():
    start_asset('bed_linen_quilt','Cama con colcha de lino','Mobiliario')
    box('bed-frame',(0,0,.42),(1.32,2.05,.19),'wood_dark',.035)
    for x in [-.66,.66]:
        box('bed-side-rail',(x,0,.54),(.10,2.12,.18),'wood_mid')
        for y in [-1,1]:
            height=1.14 if y==1 else .84
            post=box('bed-post',(x,y,height/2),(.14,.14,height),'wood')
            post['joinery']='bed_load_bearing_post'
            sphere('bed-post-cap',(x,y,height+.055),(.105,.105,.09),'wood_light',2)
    box('headboard',(0,1,.91),(1.23,.10,.40),'wood_mid',.04)
    box('footboard',(0,-1,.72),(1.23,.10,.22),'wood_mid')
    for x in [-.35,0,.35]:
        box('headboard-inlay',(x,.937,.93),(.11,.025,.11),'teal',.008,(0,math.pi/4,0))
    box('mattress',(0,0,.63),(1.23,1.95,.23),'linen',.07)
    box('quilt',(0,-.23,.77),(1.25,1.42,.105),'teal',.045)
    for x in [-.49,.49]:
        box('quilt-border',(x,-.23,.827),(.055,1.36,.012),'linen',.004)
    for y in [-.80,-.46,-.12,.22]:
        box('quilt-seam',(0,y,.824),(.98,.014,.006),'teal_light',.002)
    box('turned-down-sheet',(0,.48,.80),(1.22,.18,.10),'linen',.02)
    box('pillow',(0,.72,.815),(.82,.42,.16),'linen',.065)
    finish_asset()


def cabinet():
    start_asset('cabinet_apothecary','Alacena del boticario','Mobiliario')
    legs('cabinet',[-.57,.57],[-.22,.22],.22)
    box('cabinet-case',(0,0,.79),(1.32,.60,1.25),'wood_dark',.035)
    for x in [-.66,.66]:
        box('cabinet-pilaster',(x,-.02,.85),(.11,.67,1.35),'wood')
    planked_top('cabinet-cornice',1.51,1.50,.69)
    # Nine real inset drawers, each with its own brass pull.
    for row in range(3):
        for col in range(3):
            x=(col-1)*.397
            z=.39+row*.35
            box('drawer-reveal',(x,-.312,z),(.375,.035,.32),'wood_dark',.012)
            box('drawer-front',(x,-.344,z),(.348,.065,.287),'wood_mid' if (row+col)%2 else 'wood',.02)
            box('label-holder',(x,-.382,z+.055),(.13,.018,.06),'brass',.006)
            box('drawer-label',(x,-.394,z+.055),(.09,.008,.027),'linen',.002)
            sphere('drawer-pull',(x,-.405,z-.045),(.035,.029,.035),'brass',2)
    for i in range(3):
        bottle('medicine-bottle',(-.47+i*.28,.04,1.553),['teal','book_purple','glass'][i],.8+i*.1)
    bowl('mortar',(.46,-.01,1.553),.14)
    beam('pestle',(.43,-.01,1.623),(.54,.03,1.833),.044,'stone_light')
    finish_asset()


def bookcase():
    start_asset('bookcase_scholar','Librería del cronista','Mobiliario')
    box('bookcase-plinth',(0,0,.075),(1.53,.52,.15),'wood_dark',.025)
    box('bookcase-back',(0,.23,.98),(1.40,.055,1.82),'wood_dark')
    for x in [-.70,.70]:
        box('bookcase-side',(x,0,1.03),(.13,.51,1.92),'wood')
    for z in [.18,.68,1.20,1.75,2.01]:
        box('bookcase-shelf',(0,-.01,z),(1.51,.55,.09),'wood_mid')
    rng=random.Random(417)
    colors=['book_blue','teal','red','wood_light','book_purple']
    for row,z in enumerate([.23,.73,1.25]):
        for col in range(7 if row!=1 else 5):
            xx=-.54+col*.15
            book('bound-volume',(xx,.015,z),(.11,.31,.29+rng.random()*.12),colors[(row+col)%5])
    bottle('ink-bottle',(.40,-.01,.73),'glass',.7)
    sphere('cabinet-vase',(.50,0,1.86),(.15,.15,.11),'pot',2)
    box('bookcase-crown',(0,0,2.09),(1.65,.62,.10),'wood_light',.03)
    finish_asset()


def desk():
    start_asset('desk_cartographer','Escritorio del cartógrafo','Mobiliario')
    legs('desk',[-.62,.62],[-.27,.27],.78,True)
    box('desk-apron',(0,0,.65),(1.36,.61,.17),'wood_dark')
    planked_top('desk-top',.83,1.59,.82)
    for x in [-.39,.39]:
        box('desk-drawer',(x,-.33,.67),(.66,.08,.15),'wood_mid')
        sphere('desk-pull',(x,-.39,.67),(.04,.025,.028),'brass',2)
    box('unrolled-map',(-.13,-.06,.885),(.73,.49,.018),'linen',.005,(0,0,.07))
    # Graphic map marks are actual modelled inlays and survive the GLB export.
    for i in range(4):
        beam('map-river',(-.42+i*.15,-.14+i%2*.035,.899),(-.27+i*.15,-.12+(i+1)%2*.035,.899),.012,'teal')
    for x,y in [(-.35,.07),(-.08,.10),(.08,-.21)]:
        box('map-building',(x,y,.901),(.06,.045,.004),'wood',.002)
    cyl('scroll',(.43,.05,.938),.065,.43,'linen',12,(0,math.pi/2,0))
    torus('scroll-tie',(.43,.05,.938),.068,.012,'red',(0,math.pi/2,0))
    bottle('ink',(-.59,.20,.873),'book_blue',.55)
    beam('quill',(-.57,.20,1.02),(-.48,.22,1.26),.018,'linen')
    lantern('desk-lantern',(.57,.24,.874),.65)
    finish_asset()


def counter():
    start_asset('counter_shop','Mostrador del mercader','Mobiliario')
    box('counter-plinth',(0,0,.075),(1.83,.78,.15),'wood_dark')
    box('counter-core',(0,0,.53),(1.74,.68,.85),'wood_dark')
    for x in [-.77,-.26,.26,.77]:
        box('counter-front-panel',(x,-.355,.54),(.43,.055,.68),'wood')
        box('panel-inlay',(x,-.39,.55),(.20,.018,.37),'teal',.025)
    for z in [.21,.84]:
        box('counter-rail',(0,-.41,z),(1.83,.09,.09),'wood_light')
    planked_top('counter-top',1,1.98,.88)
    bowl('counter-tray',(-.54,0,1.043),.19)
    for i in range(4):
        cyl('stacked-coin',(-.55+i*.045,-.02,1.086+i*.015),.037,.017,'brass',10)
    book('ledger',(.14,.10,1.06),(.13,.29,.32),'red')
    bottle('counter-jar',(.64,.06,1.043),'glass',.7)
    finish_asset()


def chest():
    start_asset('chest_ironbound','Arcón de viaje reforzado','Mobiliario')
    legs('chest',[-.43,.43],[-.24,.24],.19)
    box('chest-core',(0,0,.37),(1,.62,.48),'wood_dark',.025)
    for i in range(5):
        box('chest-front-board',(-.40+i*.20,-.325,.37),(.185,.055,.43),'wood_mid' if i%2 else 'wood')
        box('chest-back-board',(-.40+i*.20,.325,.37),(.185,.055,.43),'wood')
    # Rounded lid is a closed elliptical vault rather than a flat slab.
    n=12
    outline=[(-.34,0),(.34,0)]+[(.34*math.cos(i*math.pi/n),.24*math.sin(i*math.pi/n)) for i in range(1,n)]
    verts=[(x,y,z+.61) for x in [-.53,.53] for y,z in outline]
    count=len(outline)
    mesh('arched-lid',verts,[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)],'wood_mid')
    for x in [-.37,.37]:
        box('iron-band-front',(x,-.364,.41),(.09,.035,.51),'iron')
        box('iron-band-back',(x,.364,.41),(.09,.035,.51),'iron')
        for i in range(10):
            a,b=math.pi*i/10,math.pi*(i+1)/10
            beam('lid-hoop',(x,.35*math.cos(a),.61+.25*math.sin(a)),(x,.35*math.cos(b),.61+.25*math.sin(b)),.035,'iron',.08)
        for z in [.23,.48]:
            sphere('band-rivet',(x,-.389,z),(.024,.015,.024),'brass')
    box('lock-plate',(0,-.377,.57),(.15,.045,.19),'brass',.018)
    box('keyhole',(0,-.406,.57),(.027,.012,.06),'iron',.006)
    for x in [-.553,.553]:
        torus('side-handle',(x,0,.40),.11,.022,'iron',(0,math.pi/2,0))
        box('side-handle-plate',(math.copysign(.51,x),0,.50),(.035,.16,.14),'iron',.012)
        cyl('side-handle-pivot',(math.copysign(.534,x),0,.51),.026,.075,'iron',10,(0,math.pi/2,0))
    finish_asset()


def hearth():
    start_asset('hearth_cookfire','Hogar de piedra y cobre','Mobiliario')
    box('hearth-base',(0,0,.08),(1.47,.84,.16),'stone_dark',.035)
    box('hearth-rear',(0,.30,.87),(1.30,.18,1.55),'stone')
    for s in [-1,1]:
        for row in range(4):
            box('stacked-hearth-stone',(s*.57,0,.25+row*.24),(.24,.65,.23),'stone_light' if row%2 else 'stone',.03)
    arch_frame('hearth-arch',(0,-.27,.18),.83,1.10,.18,'stone_light',9)
    box('mantel',(0,-.02,1.39),(1.52,.87,.16),'wood_dark',.035)
    box('chimney',(0,.20,1.75),(1.05,.38,.62),'plaster_warm',.045)
    for i in range(3):
        obj=cyl('split-firewood',(-.25+i*.24,-.08,.22),.085,.50,'wood_dark',8,(math.pi/2,0,.15 if i%2 else -.14))
    for i in range(3):
        sphere('warm-coals',(-.22+i*.22,-.16,.27),(.11,.14,.06),'amber')
    beam('pot-hanger',(-.46,-.06,1.05),(.46,-.06,1.05),.045,'iron')
    beam('kettle-chain',(0,-.06,.65),(0,-.06,1.05),.018,'iron')
    lathe('copper-pot',(0,-.06,.38),[(.17,0),(.23,.08),(.24,.23),(.19,.28),(.22,.30),(.18,.31)],'pot',16)
    torus('kettle-handle',(0,-.06,.77),.22,.025,'iron',(math.pi/2,0,0))
    for x in [-.48,.48]:
        bottle('mantel-bottle',(x,.02,1.48),'teal',.65)
    finish_asset()


def rug():
    start_asset('rug_woven_teal','Alfombra tejida de Brumaluz','Mobiliario')
    box('rug-foundation',(0,0,.018),(1.58,2.08,.036),'teal',.012)
    for x in [-.70,.70]:
        box('rug-length-border',(x,0,.039),(.10,1.98,.008),'linen',.003)
    for y in [-.91,.91]:
        box('rug-end-border',(0,y,.039),(1.302,.10,.008),'linen',.002)
    for y in [-.55,0,.55]:
        box('woven-diamond',(0,y,.038),(.29,.29,.006),'teal_light',.001,(0,0,math.pi/4))
        box('diamond-heart',(0,y,.043),(.13,.13,.006),'linen',.001,(0,0,math.pi/4))
    for s in [-1,1]:
        for i in range(16):
            beam('knotted-fringe',(-.70+i*.093,s*1.04,.021),(-.70+i*.093,s*1.14,.021),.024,'linen')
    finish_asset()


def build_all():
    for build in [table,chair,bench,stool,bed,cabinet,bookcase,desk,counter,chest,hearth,rug]:
        build()
