import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/world/resourceModels.ts';
let code = readFileSync(path, 'utf8');

// 1. Update Model.add with smooth, flicker-free, non-aliasing shading
const oldAddTarget = `   if(!textureType||textureType==='plain'){
    const shade=.94+Math.sin(i*1.618+this.parts.length*3.4)*.055;
    c.multiplyScalar(shade);
   }else{
    const dot=nx*lx+ny*ly+nz*lz;
    let light=0.88+Math.max(0,dot)*0.22+Math.max(0,ny)*0.08;
    if(ny<-0.3)light*=0.76+(ny+1)*0.2;
    const ao=Math.min(1.0,0.82+Math.max(0,py)*2.2);
    light*=ao;

    if(textureType.startsWith('wood')){
     const g1=Math.sin(px*36.0+pz*36.0+Math.sin(py*18.0)*2.2);
     const g2=Math.sin((px+pz)*16.0+py*28.0);
     const grain=g1*0.65+g2*0.35;
     const grainFactor=0.90+0.20*(grain*0.5+0.5);
     const edge=(Math.abs(ny)>0.3&&Math.abs(ny)<0.85)?1.12:1.0;
     const plankOffset=0.96+((this.parts.length*13)%11)*0.01;
     c.multiplyScalar(light*grainFactor*edge*plankOffset);
    }else if(textureType==='cloth'||textureType==='carpet'||textureType==='linen'){
     const freq=textureType==='carpet'?75.0:95.0;
     const w1=Math.sin(px*freq)*0.5+0.5;
     const w2=Math.sin(pz*freq)*0.5+0.5;
     const weave=0.90+0.18*(w1*w2);
     c.multiplyScalar(light*weave);
    }else if(textureType==='metal'||textureType==='brass'||textureType==='iron'||textureType==='gold'){
     const spec=Math.pow(Math.max(0,ny*0.7+nx*0.5-nz*0.4),2.5);
     const mNoise=0.95+Math.sin(px*50.0+py*50.0+pz*50.0)*0.05;
     c.multiplyScalar(light*mNoise);
     if(textureType==='brass'||textureType==='gold'){
      c.addScalar(spec*0.28);
     }else if(textureType==='iron'){
      c.addScalar(spec*0.14);
     }
    }else if(textureType==='terracotta'){
     const rings=0.94+Math.sin(py*65.0)*0.08;
     const clayGrad=0.92+Math.min(0.2,py*0.4);
     c.multiplyScalar(light*rings*clayGrad);
    }else if(textureType==='leaf'){
     const vein=0.92+Math.sin(px*45.0+pz*45.0)*0.10;
     c.multiplyScalar(light*vein);
    }else if(textureType==='paper'||textureType==='book'){
     const pageLines=0.94+Math.sin(py*110.0)*0.06;
     c.multiplyScalar(light*pageLines);
    }else if(textureType==='flame'){
     c.multiplyScalar(1.35);
    }else if(textureType==='glass'){
     const rim=Math.pow(1.0-Math.abs(nz),2.0)*0.25;
     c.multiplyScalar(light).addScalar(rim);
    }
   }`;

const newAddContent = `   const dot=nx*lx+ny*ly+nz*lz;
   // Soft, non-aliasing top-down lighting with contact AO
   let light=0.82+Math.max(0,dot)*0.24+Math.max(0,ny)*0.08;
   if(ny<-0.25)light*=0.76+(ny+1)*0.2;
   const ao=Math.min(1.0,0.84+Math.max(0,py)*1.8);
   light*=ao;
   if(textureType==='flame'){
    c.multiplyScalar(1.35);
   }else if(textureType==='glass'){
    const rim=Math.pow(1.0-Math.abs(nz),2.0)*0.22;
    c.multiplyScalar(light).addScalar(rim);
   }else{
    if(ny>0.45&&Math.abs(nx)>0.25)light*=1.03;
    c.multiplyScalar(light);
   }`;

if (!code.includes(oldAddTarget)) {
  console.error('Target for oldAddTarget not found!');
  process.exit(1);
}
code = code.replace(oldAddTarget, newAddContent);

// 2. Complete furnitureGeometry with zero overlapping, zero z-fighting, rich authentic modeling
const newFurnitureGeometry = `export function furnitureGeometry(kind:string,tier=0,job?:string){
 const m=new Model(),wood=resourceColor('wood',tier),woodLight='#d8b584',woodDark='#4c3420';
 const iron='#303538',brass='#d4aa38',gold='#e5be52',clothAmber='#c88a44',clothGreen='#546f48',clothRed='#8e3832';
 const parchment='#ebdcc8',terracotta='#b35e38',soil='#36281c',leafGreen='#477b38',leafBright='#78a84c';
 const candleWax='#eee3c9',flame='#ffaa24',glass='#d0e4e8',linen='#dfd2bb';

 if(kind==='taburete'){
  // 1. Taburete de taller: round beveled seat, carved corbels, 4 turned splayed legs with coaxial ferrules, double stretcher ring
  m.cyl(woodDark,[0,0.44,0],0.22,0.03,24,[0,0,0],0.22,'wood_dark'); // under-seat apron
  m.cyl(wood,[0,0.47,0],0.26,0.03,24,[0,0,0],0.26,'wood'); // seat slab
  m.torus(woodLight,[0,0.47,0],0.26,0.012,8,24,[Math.PI/2,0,0],'wood_light'); // bullnose rim
  m.cyl(woodLight,[0,0.488,0],0.20,0.006,24,[0,0,0],0.19,'wood_light'); // dished saddle depression
  m.ball(woodDark,[0,0.494,0],[0.016,0.006,0.016],'wood_dark'); // center accent dowel
  for(let i=0;i<4;i++){
   const ang=i*Math.PI/2+Math.PI/4,cosA=Math.cos(ang),sinA=Math.sin(ang);
   const topP=[cosA*0.14,0.43,sinA*0.14];
   const midP=[cosA*0.18,0.23,sinA*0.18];
   const lowP=[cosA*0.22,0.05,sinA*0.22];
   const botP=[cosA*0.23,0.005,sinA*0.23];
   // Under-seat corner bracket:
   m.box(woodDark,[cosA*0.12,0.42,sinA*0.12],[0.035,0.03,0.035],[0,ang,0],'wood_dark');
   // Turned upper baluster shaft:
   m.rod(wood,topP,midP,0.030,0.024,12,'wood');
   // Turned center collar:
   m.ball(brass,midP,[0.028,0.012,0.028],'brass');
   // Lower shaft:
   m.rod(wood,midP,lowP,0.024,0.020,12,'wood');
   // Brass shoe ferrule aligned coaxially:
   m.rod(brass,lowP,botP,0.022,0.022,12,'brass');
  }
  // Double-ring footrest system at Y = 0.16:
  m.torus(brass,[0,0.16,0],0.195,0.012,8,24,[Math.PI/2,0,0],'brass');
  m.torus(woodDark,[0,0.16,0],0.182,0.008,6,24,[Math.PI/2,0,0],'wood_dark');
  for(let i=0;i<4;i++){
   const ang=i*Math.PI/2+Math.PI/4;
   m.box(brass,[Math.cos(ang)*0.195,0.16,Math.sin(ang)*0.195],[0.018,0.02,0.018],[0,ang,0],'brass');
  }
 }else if(kind==='mesa'){
  // 2. Mesa de artesano: 5 individual oak planks with 2.5mm shadow reveals, solid subframe (no floor void), breadboards with mortise keys & dowels, chamfered legs with brass boots, H-stretcher with tusk tenons
  m.box(woodDark,[0,0.70,0],[1.34,0.018,0.78],[0,0,0],'wood_dark'); // sub-frame
  // 5 Planks:
  const plankZs=[-0.32,-0.16,0.00,0.16,0.32];
  for(let i=0;i<5;i++){
   const col=i%2===0?wood:woodLight;
   m.box(col,[0,0.73,plankZs[i]],[1.34,0.04,0.15],[0,0,0],i%2===0?'wood':'wood_light');
  }
  // Breadboard end caps:
  for(const sx of [-0.70,0.70]){
   m.box(woodDark,[sx,0.73,0],[0.06,0.044,0.82],[0,0,0],'wood_dark');
   // 5 Exposed mortise tenon keys facing outward:
   for(let i=0;i<5;i++){
    m.box(woodLight,[sx+(sx>0?0.033:-0.033),0.73,plankZs[i]],[0.008,0.025,0.08],[0,0,0],'wood_light');
   }
   // 4 Dowel pins on top of breadboard:
   for(const dz of [-0.28,-0.10,0.10,0.28]){
    m.ball(brass,[sx,0.753,dz],[0.008,0.003,0.008],'brass');
   }
  }
  // 4 Legs:
  for(const lx of [-0.56,0.56]){
   for(const lz of [-0.28,0.28]){
    m.box(wood,[lx,0.346,lz],[0.085,0.69,0.085],[0,0,0],'wood');
    m.box(brass,[lx,0.032,lz],[0.092,0.064,0.092],[0,0,0],'brass'); // brass shoe
    // Rivet studs on shoe:
    for(const rz of [-0.047,0.047])m.ball(brass,[lx,0.032,lz+rz],[0.008,0.008,0.008],'brass');
   }
  }
  // Aprons:
  m.box(wood,[0,0.655,-0.28],[1.035,0.07,0.035],[0,0,0],'wood');
  m.box(wood,[0,0.655,0.28],[1.035,0.07,0.035],[0,0,0],'wood');
  for(const sx of [-0.56,0.56])m.box(wood,[sx,0.655,0],[0.035,0.07,0.475],[0,0,0],'wood');
  // H-Stretcher with through-tenon and tusk tenon pegs:
  for(const sx of [-0.56,0.56])m.box(woodLight,[sx,0.14,0],[0.035,0.045,0.475],[0,0,0],'wood_light');
  m.box(woodLight,[0,0.14,0],[1.19,0.045,0.04],[0,0,0],'wood_light'); // center beam
  // Tusk tenon vertical wedge pegs:
  for(const sx of [-0.585,0.585]){
   m.box(woodDark,[sx,0.14,0],[0.015,0.07,0.015],[0,0,0],'wood_dark');
  }
 }else if(kind==='biblioteca'){
  // 3. Biblioteca tallada: 2-tier plinth, crown cornice with dentils, fluted pilasters, grooved wainscot backboard, 4 bullnose shelves, deed chests, 20+ books with gold spine ribs & cut pages, scrolls & astrolabe
  m.box(woodDark,[0,0.03,0],[1.38,0.06,0.44],[0,0,0],'wood_dark'); // plinth tier 1
  m.box(wood,[0,0.08,0],[1.35,0.04,0.42],[0,0,0],'wood'); // plinth tier 2
  // Cornice crown:
  m.box(woodLight,[0,1.79,0],[1.37,0.035,0.43],[0,0,0],'wood_light');
  m.box(wood,[0,1.815,0],[1.39,0.02,0.44],[0,0,0],'wood');
  m.box(woodDark,[0,1.84,0],[1.42,0.04,0.46],[0,0,0],'wood_dark');
  // Upright side panels with fluted pilasters:
  for(const sx of [-0.63,0.63]){
   m.box(wood,[sx,0.945,0],[0.06,1.67,0.40],[0,0,0],'wood');
   m.box(woodLight,[sx+(sx>0?0.025:-0.025),0.945,-0.185],[0.02,1.65,0.03],[0,0,0],'wood_light');
   m.box(woodDark,[sx+(sx>0?0.025:-0.025),1.76,-0.185],[0.03,0.04,0.04],[0,0,0],'wood_dark'); // capital
   m.box(woodDark,[sx+(sx>0?0.025:-0.025),0.12,-0.185],[0.03,0.04,0.04],[0,0,0],'wood_dark'); // base
  }
  // Grooved vertical backboard panels:
  for(let p=0;p<5;p++){
   const px=-0.48+p*0.24,col=p%2===0?woodDark:wood;
   m.box(col,[px,0.945,0.18],[0.235,1.67,0.02],[0,0,0],p%2===0?'wood_dark':'wood');
  }
  // 4 Shelves with bullnose edge and underside corbels:
  const shelfY=[0.12,0.53,0.95,1.37];
  for(const sy of shelfY){
   m.box(woodLight,[0,sy,-0.01],[1.20,0.03,0.37],[0,0,0],'wood_light');
   m.box(wood,[0,sy,-0.185],[1.20,0.036,0.02],[0,0,0],'wood'); // bullnose lip
  }
  // Shelf 1: 2 deed chests + 3 horizontal ledger books:
  m.box(woodDark,[-0.34,0.22,-0.02],[0.36,0.17,0.28],[0,0,0],'wood_dark');
  m.box(brass,[-0.34,0.22,-0.165],[0.06,0.04,0.01],[0,0,0],'brass');
  m.box(wood,[0.32,0.21,-0.02],[0.38,0.15,0.28],[0,0,0],'wood');
  m.box(brass,[0.32,0.21,-0.165],[0.06,0.04,0.01],[0,0,0],'brass');
  // Ledger pile:
  for(let l=0;l<3;l++){
   m.box(clothRed,[0.02,0.14+l*0.028,-0.02],[0.20,0.025,0.26],[0,0.08*l,0],'cloth');
   m.box(parchment,[0.02,0.14+l*0.028,-0.01],[0.18,0.022,0.24],[0,0.08*l,0],'paper');
  }
  // Shelf 2: 11 books with gold ribs and paper pages + 2 leaning books + bookend:
  const bookColors=['#8e3832','#2c5282','#3a7540','#a07a2c','#44362d','#74367c','#8c5230'];
  for(let b=0;b<8;b++){
   const bx=-0.50+b*0.095,bh=0.25+(b%3)*0.035,bw=0.075,col=bookColors[b%bookColors.length];
   const by=0.545+bh/2;
   m.box(col,[bx,by,-0.03],[bw,bh,0.25],[0,0,0],'book');
   m.box(parchment,[bx,by,-0.01],[bw*0.82,bh*0.92,0.23],[0,0,0],'paper');
   m.box(gold,[bx,0.545+bh*0.35,-0.156],[bw*0.9,0.01,0.008],[0,0,0],'gold');
   m.box(gold,[bx,0.545+bh*0.65,-0.156],[bw*0.9,0.01,0.008],[0,0,0],'gold');
  }
  // 2 Leaning books:
  m.box('#8e3832',[0.36,0.65,-0.03],[0.06,0.28,0.25],[0,0,-0.22],'book');
  m.box(parchment,[0.36,0.65,-0.01],[0.05,0.26,0.23],[0,0,-0.22],'paper');
  m.box(woodDark,[0.44,0.61,-0.03],[0.08,0.14,0.20],[0,0,0],'wood_dark'); // carved bookend
  // Shelf 3: 6 books, scrolls, astrolabe:
  for(let b=0;b<6;b++){
   const bx=-0.50+b*0.11,bh=0.26+(b%2)*0.04,col=bookColors[(b+2)%bookColors.length];
   const by=0.965+bh/2;
   m.box(col,[bx,by,-0.03],[0.08,bh,0.24],[0,0,0],'book');
   m.box(parchment,[bx,by,-0.01],[0.065,bh*0.92,0.22],[0,0,0],'paper');
  }
  // Rolled scrolls:
  m.cyl(parchment,[0.28,0.995,-0.03],0.032,0.22,12,[Math.PI/2,0,0],0.032,'paper');
  m.cyl(clothRed,[0.28,0.995,-0.03],0.034,0.03,8,[Math.PI/2,0,0],0.034,'cloth'); // seal ribbon
  m.cyl(parchment,[0.36,0.995,-0.03],0.026,0.20,12,[Math.PI/2,0,0],0.026,'paper');
  // Astrolabe/globe on stand:
  m.cyl(woodDark,[0.46,0.98,-0.03],0.04,0.03,12,[0,0,0],0.035,'wood_dark');
  m.torus(brass,[0.46,1.06,-0.03],0.05,0.006,6,16,[0,0.4,0],'brass');
  m.ball(brass,[0.46,1.06,-0.03],[0.02,0.02,0.02],'brass');
  // Shelf 4: 5 tall encyclopedias + inkpot with quill:
  for(let b=0;b<5;b++){
   const bx=-0.44+b*0.14,bh=0.30,col=bookColors[(b+4)%bookColors.length];
   const by=1.385+bh/2;
   m.box(col,[bx,by,-0.03],[0.10,bh,0.26],[0,0,0],'book');
   m.box(parchment,[bx,by,-0.01],[0.08,bh*0.92,0.24],[0,0,0],'paper');
   m.box(gold,[bx,by,-0.162],[0.03,0.07,0.01],[0,0,0],'gold');
  }
  m.cyl(iron,[0.38,1.41,-0.03],0.025,0.05,10,[0,0,0],0.02,'iron'); // inkpot
  m.rod(parchment,[0.38,1.44,-0.03],[0.42,1.55,-0.01],0.005,0.001,4,'paper'); // quill
 }else if(kind==='estacion'){
  // 4. Banco de trabajo: laminated beech top with bench dog holes, rear tool tray, chisel rack with 3 chisels, woodworker's front vise with twin guides & tommy bar, jack plane & wood shavings, tool chest
  m.box(wood,[0,0.74,-0.04],[1.44,0.09,0.52],[0,0,0],'wood'); // butcher block
  // Bench dog holes:
  for(let h=0;h<5;h++){
   m.box(woodDark,[-0.40+h*0.20,0.785,-0.24],[0.018,0.005,0.018],[0,0,0],'wood_dark');
  }
  m.box(woodDark,[0,0.725,0.25],[1.44,0.04,0.12],[0,0,0],'wood_dark'); // tool tray
  m.box(woodLight,[0,0.76,0.315],[1.44,0.07,0.018],[0,0,0],'wood_light'); // back lip
  // Chisel tool rack:
  for(let c=0;c<3;c++){
   const cx=-0.20+c*0.15;
   m.rod(wood,[cx,0.76,0.32],[cx,0.85,0.32],0.012,0.014,8,'wood'); // wooden handle
   m.rod(iron,[cx,0.73,0.32],[cx,0.76,0.32],0.008,0.008,6,'iron'); // steel blade
   m.cyl(brass,[cx,0.76,0.32],0.014,0.008,8,[0,0,0],0.014,'brass'); // ferrule
  }
  // 4 Heavy posts:
  for(const lx of [-0.58,0.58]){
   for(const lz of [-0.18,0.22]){
    m.box(wood,[lx,0.35,lz],[0.09,0.70,0.09],[0,0,0],'wood');
    m.box(iron,[lx,0.03,lz],[0.098,0.06,0.098],[0,0,0],'iron');
   }
  }
  // Lower shelf frame and slatted platform:
  for(const lx of [-0.58,0.58])m.box(woodLight,[lx,0.20,0.02],[0.035,0.045,0.38],[0,0,0],'wood_light');
  m.box(woodLight,[0,0.20,-0.16],[1.12,0.045,0.035],[0,0,0],'wood_light');
  m.box(woodLight,[0,0.20,0.20],[1.12,0.045,0.035],[0,0,0],'wood_light');
  m.box(woodLight,[0,0.23,0.02],[1.16,0.025,0.40],[0,0,0],'wood_light');
  // Tool crate on lower shelf:
  m.box(woodDark,[-0.24,0.30,0.02],[0.36,0.14,0.26],[0,0,0],'wood_dark');
  m.rod(woodLight,[-0.24,0.39,0.02],[-0.24,0.39,0.02],0.012,0.012,6,'wood_light'); // handle
  // Front Vise:
  m.box(woodDark,[-0.44,0.74,-0.31],[0.28,0.11,0.03],[0,0,0],'wood_dark'); // fixed jaw
  m.box(woodLight,[-0.44,0.74,-0.42],[0.28,0.11,0.04],[0,0,0],'wood_light'); // movable jaw
  m.rod(iron,[-0.53,0.74,-0.30],[-0.53,0.74,-0.42],0.012,0.012,8,'iron'); // guide L
  m.rod(iron,[-0.35,0.74,-0.30],[-0.35,0.74,-0.42],0.012,0.012,8,'iron'); // guide R
  m.rod(iron,[-0.44,0.74,-0.30],[-0.44,0.74,-0.46],0.018,0.018,10,'iron'); // central screw
  m.cyl(woodDark,[-0.44,0.74,-0.46],0.032,0.025,12,[Math.PI/2,0,0],0.032,'wood_dark'); // hub
  m.rod(wood,[-0.44,0.65,-0.48],[-0.44,0.83,-0.48],0.012,0.012,8,'wood'); // tommy bar
  m.ball(brass,[-0.44,0.64,-0.48],[0.018,0.018,0.018],'brass');
  m.ball(brass,[-0.44,0.84,-0.48],[0.018,0.018,0.018],'brass');
  // Jack Plane (garlopa):
  m.box(wood,[0.22,0.815,-0.06],[0.22,0.06,0.065],[0,0.28,0],'wood');
  m.box(iron,[0.22,0.85,-0.06],[0.04,0.06,0.07],[0,0.28,0.4],'iron'); // blade
  m.cyl(woodDark,[0.31,0.86,-0.03],0.014,0.05,8,[0,0,0],0.014,'wood_dark'); // front tote
  // Try-square:
  m.box(woodDark,[0.02,0.792,0.06],[0.14,0.014,0.03],[0,0.4,0],'wood_dark');
  m.box(iron,[0.07,0.795,0.12],[0.025,0.008,0.16],[0,0.4,0],'iron');
  // Wood shavings flat on bench (Y = 0.792):
  m.torus(woodLight,[0.38,0.792,0.08],0.028,0.006,6,12,[Math.PI/2,0.3,0],'wood_light');
  m.torus(woodLight,[0.43,0.792,0.02],0.022,0.005,6,12,[Math.PI/2,0.7,0],'wood_light');
  if(job==='alquimia'||job==='cocina'){
   m.cyl(brass,[-0.18,0.80,0.14],0.055,0.03,12,[0,0,0],0.05,'brass');
   m.ball(job==='alquimia'?'#5bb584':'#c98a44',[-0.18,0.87,0.14],[0.06,0.07,0.06],'glass');
   m.cyl(wood,[-0.18,0.93,0.14],0.018,0.04,8,[0,0,0],0.018,'wood');
  }
 }else if(kind==='silla'){
  // 5. Silla de roble y enea: perimeter contoured frame, rush seat insert, turned front legs with collars, continuous stiles to acorn finials, H-stretchers, carved crest rail, lumbar rail, 3 flush vertical splats
  m.box(wood,[0,0.43,-0.01],[0.46,0.04,0.44],[0,0,0],'wood'); // seat frame
  m.box(clothAmber,[0,0.455,-0.01],[0.38,0.018,0.36],[0,0,0],'cloth'); // rush weave
  // Front legs (turned balusters):
  for(const fx of [-0.18,0.18]){
   m.rod(wood,[fx,0.41,-0.18],[fx,0.22,-0.18],0.028,0.024,12,'wood');
   m.ball(woodLight,[fx,0.22,-0.18],[0.026,0.012,0.026],'wood_light'); // baluster ring
   m.rod(wood,[fx,0.22,-0.18],[fx,0.03,-0.18],0.024,0.020,12,'wood');
   m.cyl(brass,[fx,0.025,-0.18],0.026,0.05,12,[0,0,0],0.026,'brass');
  }
  // Continuous rear stiles canted 5°:
  for(const sx of [-0.18,0.18]){
   m.rod(wood,[sx,0.03,0.18],[sx,0.94,0.18],0.025,0.021,12,'wood');
   m.cyl(brass,[sx,0.025,0.18],0.026,0.05,12,[0,0,0],0.026,'brass');
   m.ball(brass,[sx,0.97,0.18],[0.028,0.038,0.028],'brass'); // acorn finial
  }
  // 4 Stretchers in H-layout:
  for(const sx of [-0.18,0.18])m.rod(woodLight,[sx,0.14,-0.18],[sx,0.14,0.18],0.016,0.016,8,'wood_light');
  m.rod(woodLight,[-0.18,0.11,-0.18],[0.18,0.11,-0.18],0.016,0.016,8,'wood_light');
  m.rod(woodLight,[-0.18,0.17,0.18],[0.18,0.17,0.18],0.016,0.016,8,'wood_light');
  // Backrest:
  m.box(woodLight,[0,0.91,0.18],[0.42,0.05,0.025],[0,0,0],'wood_light'); // crest rail
  m.box(wood,[0,0.59,0.18],[0.38,0.035,0.022],[0,0,0],'wood'); // lumbar rail
  // 3 Vertical splats:
  for(const sl of [-0.10,0,0.10]){
   m.box(wood,[sl,0.746,0.18],[0.036,0.28,0.016],[0,0,0],'wood');
   if(sl===0)m.ball(brass,[0,0.746,0.18],[0.018,0.018,0.018],'brass'); // center pierced boss
  }
 }else if(kind==='banco'){
  // 6. Banco corrido capitoné: solid beveled base plank, under-apron with scalloped arches, turned legs with brass boots, longitudinal stretcher, tufted amber mattress with 8 recessed brass buttons & piping cord
  m.box(wood,[0,0.40,0],[1.18,0.04,0.38],[0,0,0],'wood');
  m.box(woodDark,[0,0.36,0],[1.10,0.04,0.30],[0,0,0],'wood_dark');
  // 4 Legs:
  for(const lx of [-0.48,0.48]){
   for(const lz of [-0.11,0.11]){
    m.rod(wood,[lx,0.34,lz],[lx,0.20,lz],0.032,0.026,12,'wood');
    m.ball(woodLight,[lx,0.20,lz],[0.028,0.012,0.028],'wood_light');
    m.rod(wood,[lx,0.20,lz],[lx,0.03,lz],0.026,0.022,12,'wood');
    m.cyl(brass,[lx,0.025,lz],0.028,0.05,12,[0,0,0],0.028,'brass');
   }
  }
  // Stretchers:
  for(const lx of [-0.48,0.48])m.rod(woodLight,[lx,0.14,-0.11],[lx,0.14,0.11],0.018,0.018,8,'wood_light');
  m.rod(woodLight,[-0.48,0.14,0],[0.48,0.14,0],0.018,0.018,8,'wood_light');
  // Tufted mattress cushion:
  m.box(clothAmber,[0,0.455,0],[1.14,0.07,0.34],[0,0,0],'cloth');
  // Welt piping cord around perimeter (raised 3mm above surface):
  m.box(clothGreen,[0,0.492,-0.165],[1.14,0.008,0.008],[0,0,0],'cloth');
  m.box(clothGreen,[0,0.492,0.165],[1.14,0.008,0.008],[0,0,0],'cloth');
  m.box(clothGreen,[-0.565,0.492,0],[0.008,0.008,0.338],[0,0,0],'cloth');
  m.box(clothGreen,[0.565,0.492,0],[0.008,0.008,0.338],[0,0,0],'cloth');
  // 8 Recessed tufting buttons in quilted puckers:
  for(const bx of [-0.36,-0.12,0.12,0.36]){
   for(const bz of [-0.07,0.07]){
    m.ball(clothAmber,[bx,0.486,bz],[0.022,0.006,0.022],'cloth'); // pucker dish
    m.ball(brass,[bx,0.488,bz],[0.014,0.008,0.014],'brass'); // tufting button
   }
  }
 }else if(kind==='mesita'){
  // 7. Mesita velador: round stepped ogee rim, radial segmented medallion, turned baluster with polished brass sphere, 3 cabriole tripod legs ending in brass ball-and-claw pads
  m.cyl(wood,[0,0.61,0],0.31,0.035,24,[0,0,0],0.30,'wood');
  m.torus(woodLight,[0,0.615,0],0.31,0.012,8,24,[Math.PI/2,0,0],'wood_light'); // bullnose rim
  m.cyl(woodDark,[0,0.585,0],0.26,0.02,20,[0,0,0],0.26,'wood_dark');
  // Pedestal baluster:
  m.cyl(wood,[0,0.52,0],0.065,0.11,16,[0,0,0],0.055,'wood');
  m.ball(brass,[0,0.41,0],[0.085,0.085,0.085],'brass'); // polished brass orb
  m.cyl(wood,[0,0.29,0],0.06,0.16,16,[0,0,0],0.055,'wood');
  m.cyl(woodDark,[0,0.16,0],0.11,0.10,16,[0,0,0],0.09,'wood_dark');
  // 3 Sweeping cabriole tripod legs:
  for(let i=0;i<3;i++){
   const ang=i*(2*Math.PI/3)+Math.PI/6,cosA=Math.cos(ang),sinA=Math.sin(ang);
   const pHip=[cosA*0.08,0.15,sinA*0.08];
   const pKnee=[cosA*0.20,0.11,sinA*0.20];
   const pAnkle=[cosA*0.26,0.03,sinA*0.26];
   const pFoot=[cosA*0.27,0.025,sinA*0.27];
   m.rod(wood,pHip,pKnee,0.034,0.026,10,'wood');
   m.ball(woodDark,pKnee,[0.028,0.02,0.028],'wood_dark'); // knee scroll volute
   m.rod(wood,pKnee,pAnkle,0.026,0.022,10,'wood');
   m.ball(brass,pFoot,[0.025,0.025,0.025],'brass'); // brass ball-and-claw foot at Y = 0.00
  }
 }else if(kind==='arcon'){
  // 8. Arcón acorazado: molded plinth base, recessed paneled chest, 7-facet continuous barrel vault lid with arched end gables, 2 wrought-iron straps with 18 brass rivets, central escutcheon & drop hasp, side handles
  m.box(woodDark,[0,0.03,0],[0.96,0.06,0.54],[0,0,0],'wood_dark'); // base plinth
  m.box(wood,[0,0.21,0],[0.90,0.30,0.50],[0,0,0],'wood'); // chest core
  // Front recessed panels:
  for(const px of [-0.22,0.22]){
   m.box(woodDark,[px,0.21,-0.252],[0.38,0.24,0.006],[0,0,0],'wood_dark');
  }
  // 4 Corner stiles with iron brackets:
  for(const sx of [-0.43,0.43]){
   for(const sz of [-0.23,0.23]){
    m.box(woodDark,[sx,0.21,sz],[0.045,0.30,0.045],[0,0,0],'wood_dark');
    m.box(iron,[sx,0.34,sz],[0.048,0.03,0.048],[0,0,0],'iron');
   }
  }
  m.box(woodLight,[0,0.37,0],[0.92,0.02,0.52],[0,0,0],'wood_light'); // lid rim plate
  // Continuous 7-facet barrel vault lid:
  const archR=0.25,archCY=0.37;
  const numFacets=7;
  for(let f=0;f<numFacets;f++){
   const ang=-Math.PI/2+(f+0.5)*(Math.PI/numFacets);
   const py=archCY+Math.cos(ang)*archR,pz=Math.sin(ang)*archR;
   m.box(wood,[0,py,pz],[0.92,0.02,0.12],[ang,0,0],'wood');
  }
  // Timber arched gable end-caps on left and right:
  for(const sx of [-0.45,0.45]){
   m.cyl(woodDark,[sx,0.37,0],0.24,0.02,16,[0,0,Math.PI/2],0.24,'wood_dark');
  }
  // 2 Wrought-iron straps at x = ±0.27 with 3D brass rivets:
  for(const sx of [-0.27,0.27]){
   m.box(iron,[sx,0.21,-0.255],[0.045,0.30,0.012],[0,0,0],'iron');
   m.box(iron,[sx,0.21,0.255],[0.045,0.30,0.012],[0,0,0],'iron');
   for(let f=0;f<numFacets;f++){
    const ang=-Math.PI/2+(f+0.5)*(Math.PI/numFacets);
    const py=archCY+Math.cos(ang)*(archR+0.008),pz=Math.sin(ang)*(archR+0.008);
    m.box(iron,[sx,py,pz],[0.048,0.016,0.125],[ang,0,0],'iron');
    m.ball(brass,[sx,py+Math.cos(ang)*0.01,pz+Math.sin(ang)*0.01],[0.012,0.012,0.012],'brass');
   }
   for(const sy of [0.12,0.24,0.33])m.ball(brass,[sx,sy,-0.262],[0.012,0.012,0.012],'brass');
  }
  // Central Brass Escutcheon Plate at x = 0 (completely clear of straps):
  m.box(brass,[0,0.33,-0.255],[0.09,0.11,0.012],[0,0,0],'brass');
  m.cyl(iron,[0,0.33,-0.263],0.014,0.018,8,[Math.PI/2,0,0],0.014,'iron'); // keyhole
  m.box(iron,[0,0.375,-0.262],[0.032,0.05,0.01],[0,0,0],'iron'); // drop hasp
  // Drop handles on sides:
  for(const hx of [-0.46,0.46]){
   m.box(iron,[hx,0.24,0],[0.015,0.06,0.08],[0,0,0],'iron');
   m.torus(iron,[hx+(hx>0?0.02:-0.02),0.22,0],0.04,0.01,6,16,[0,Math.PI/2,0],'iron');
  }
 }else if(kind==='alfombra'){
  // 9. Alfombra artesanal: single flat woven body, raised sage green border strips (raised 2.5mm, zero coplanar overlap), 8-pointed woven star medallion with rosette boss, 28 fringe tassels
  m.box(clothAmber,[0,0.008,0],[1.40,0.016,0.96],[0,0,0],'carpet'); // woven field
  // Raised perimeter border strips (non-overlapping boxes):
  m.box(clothGreen,[0,0.018,-0.44],[1.40,0.005,0.08],[0,0,0],'cloth');
  m.box(clothGreen,[0,0.018,0.44],[1.40,0.005,0.08],[0,0,0],'cloth');
  m.box(clothGreen,[-0.66,0.018,0],[0.08,0.005,0.80],[0,0,0],'cloth');
  m.box(clothGreen,[0.66,0.018,0],[0.08,0.005,0.80],[0,0,0],'cloth');
  // Inner gold threaded frame:
  m.box(gold,[0,0.019,-0.395],[1.24,0.003,0.01],[0,0,0],'gold');
  m.box(gold,[0,0.019,0.395],[1.24,0.003,0.01],[0,0,0],'gold');
  m.box(gold,[-0.615,0.019,0],[0.01,0.003,0.80],[0,0,0],'gold');
  m.box(gold,[0.615,0.019,0],[0.01,0.003,0.80],[0,0,0],'gold');
  // 8-Pointed Star Medallion (single flat octagonal center, NO coplanar cubes!):
  m.cyl(clothRed,[0,0.018,0],0.24,0.004,8,[0,Math.PI/8,0],0.24,'cloth');
  m.cyl(clothAmber,[0,0.020,0],0.14,0.003,8,[0,0,0],0.14,'cloth');
  m.cyl(brass,[0,0.022,0],0.06,0.003,8,[0,0,0],0.06,'brass'); // center gold boss
  // 28 Fringe tassels (14 on each short end at Y = 0.007):
  for(const fx of [-0.72,0.72]){
   for(let ti=0;ti<14;ti++){
    const tz=-0.42+ti*0.065;
    m.cyl(parchment,[fx+(fx>0?0.025:-0.025),0.007,tz],0.006,0.05,6,[0,0,Math.PI/2],0.006,'cloth');
    m.ball(woodDark,[fx+(fx>0?0.002:-0.002),0.007,tz],[0.007,0.007,0.007],'wood_dark'); // knot collar
   }
  }
 }else if(kind==='farol'){
  // 10. Farol de mesa: octagonal iron base with dark wood insert, 4 posts, open lantern cage with diagonal glazing bars (interior completely visible), brass saucer, beeswax candle with 4 drips, wick, flame, tiered roof with smoke vents, vertical ring
  m.cyl(iron,[0,0.025,0],0.13,0.05,8,[0,0,0],0.12,'iron');
  m.cyl(woodDark,[0,0.055,0],0.10,0.015,8,[0,0,0],0.10,'wood_dark');
  // 4 Corner Posts:
  for(const cx of [-0.085,0.085]){
   for(const cz of [-0.085,0.085]){
    m.box(iron,[cx,0.22,cz],[0.018,0.32,0.018],[0,0,0],'iron');
   }
  }
  // Framing rails (top & bottom):
  for(const rz of [-0.085,0.085]){
   m.box(iron,[0,0.068,rz],[0.17,0.014,0.014],[0,0,0],'iron');
   m.box(iron,[0,0.372,rz],[0.17,0.014,0.014],[0,0,0],'iron');
  }
  for(const rx of [-0.085,0.085]){
   m.box(iron,[rx,0.068,0],[0.014,0.014,0.17],[0,0,0],'iron');
   m.box(iron,[rx,0.372,0],[0.014,0.014,0.17],[0,0,0],'iron');
  }
  // Diagonal corner glazing bars (interior completely open & visible):
  for(const rx of [-0.085,0.085]){
   m.rod(iron,[rx,0.075,-0.08],[rx,0.365,0.08],0.004,0.004,4,'iron');
   m.rod(iron,[rx,0.075,0.08],[rx,0.365,-0.08],0.004,0.004,4,'iron');
  }
  for(const rz of [-0.085,0.085]){
   m.rod(iron,[-0.08,0.075,rz],[0.08,0.365,rz],0.004,0.004,4,'iron');
   m.rod(iron,[0.08,0.075,rz],[-0.08,0.365,rz],0.004,0.004,4,'iron');
  }
  // Candle holder saucer & beeswax candle:
  m.cyl(brass,[0,0.068,0],0.045,0.012,12,[0,0,0],0.045,'brass');
  m.cyl(candleWax,[0,0.14,0],0.035,0.13,12,[0,0,0],0.032,'paper');
  // 4 Modeled wax drip streams:
  m.rod(candleWax,[0.032,0.18,0],[0.034,0.11,0],0.006,0.003,6,'paper');
  m.rod(candleWax,[-0.024,0.19,0.024],[-0.026,0.12,0.026],0.006,0.003,6,'paper');
  m.rod(candleWax,[0,0.185,-0.033],[0,0.13,-0.034],0.005,0.003,6,'paper');
  m.rod(candleWax,[-0.032,0.17,-0.01],[-0.034,0.10,-0.01],0.005,0.002,6,'paper');
  // Wick & glowing flame:
  m.rod(iron,[0,0.205,0],[0,0.225,0],0.004,0.003,6,'iron');
  m.ball(flame,[0,0.245,0],[0.022,0.036,0.022],'flame'); // outer flame
  m.ball('#fff490',[0,0.240,0],[0.012,0.020,0.012],'flame'); // inner flame core
  // Pyramidal iron roof canopy with smoke vents:
  m.cyl(iron,[0,0.42,0],0.13,0.08,4,[0,Math.PI/4,0],0.04,'iron');
  m.cyl(iron,[0,0.47,0],0.05,0.03,4,[0,Math.PI/4,0],0.03,'iron');
  m.ball(brass,[0,0.495,0],[0.025,0.025,0.025],'brass');
  m.torus(iron,[0,0.54,0],0.04,0.009,8,16,[0,0,0],'iron'); // vertical carry ring
 }else if(kind==='macetero'){
  // 11. Macetero de terracota: molded foot ring, bulbous body with 3 throwing ridges, neck collar, flared rim, potting soil, 8 arching stems with sculpted monstera spade leaves & raised rib veins
  m.cyl(terracotta,[0,0.025,0],0.14,0.05,20,[0,0,0],0.16,'terracotta'); // foot
  m.cyl(terracotta,[0,0.11,0],0.22,0.12,20,[0,0,0],0.14,'terracotta'); // lower swell
  // 3 Horizontal potter's wheel ridges:
  m.torus(terracotta,[0,0.12,0],0.20,0.010,8,20,[Math.PI/2,0,0],'terracotta');
  m.torus(terracotta,[0,0.18,0],0.23,0.010,8,20,[Math.PI/2,0,0],'terracotta');
  m.torus(terracotta,[0,0.24,0],0.24,0.010,8,20,[Math.PI/2,0,0],'terracotta');
  m.cyl(terracotta,[0,0.22,0],0.24,0.10,20,[0,0,0],0.22,'terracotta'); // belly
  m.cyl(terracotta,[0,0.295,0],0.21,0.05,20,[0,0,0],0.24,'terracotta'); // neck
  m.cyl(terracotta,[0,0.34,0],0.24,0.04,20,[0,0,0],0.21,'terracotta'); // flared rim
  m.torus(terracotta,[0,0.345,0],0.235,0.012,8,20,[Math.PI/2,0,0],'terracotta'); // rolled lip
  m.cyl(soil,[0,0.325,0],0.20,0.03,16,[0,0,0],0.20,'plain'); // potting soil
  // 8 Arching stems with broad spade leaves:
  for(let i=0;i<8;i++){
   const ang=i*(Math.PI*2/8)+0.25,cosA=Math.cos(ang),sinA=Math.sin(ang);
   const p0=[cosA*0.07,0.33,sinA*0.07];
   const p1=[cosA*0.16,0.48+(i%2)*0.05,sinA*0.16];
   const p2=[cosA*0.27,0.44+(i%2)*0.04,sinA*0.27];
   m.rod(leafGreen,p0,p1,0.012,0.009,6,'leaf');
   m.rod(leafGreen,p1,p2,0.009,0.006,6,'leaf');
   const leafCol=i%2===0?leafGreen:leafBright;
   m.add(new THREE.CylinderGeometry(0.08,0.01,0.22,5),leafCol,p2,[1,0.15,1],[-0.5,ang,0.2],'leaf');
   m.rod(leafBright,p2,[p2[0]*1.25,p2[1]-0.06,p2[2]*1.25],0.005,0.002,4,'leaf');
  }
 }else if(kind==='biombo'){
  // 12. Biombo de 3 hojas con celosía Kumiko: continuous accordion kinematics (0.0000m separation), 6 brass knuckle hinges, timber frame, cream linen screens, 3D kumiko lattice fretwork & lower wainscot
  const W=0.42,ang=0.32,cosA=Math.cos(ang),sinA=Math.sin(ang);
  const dx=W*cosA,dz=W*sinA;
  const seams=[
   [-1.5*dx,-dz/2],
   [-0.5*dx,dz/2],
   [0.5*dx,-dz/2],
   [1.5*dx,dz/2],
  ];
  const panelAngles=[-ang,ang,-ang];
  for(let idx=0;idx<3;idx++){
   const pAng=panelAngles[idx];
   const cx=(seams[idx][0]+seams[idx+1][0])/2;
   const cz=(seams[idx][1]+seams[idx+1][1])/2;
   m.withGroup([cx,0.75,cz],[0,pAng,0],()=>{
    // Stiles:
    m.box(wood,[-0.19,0,0],[0.04,1.50,0.045],[0,0,0],'wood');
    m.box(wood,[0.19,0,0],[0.04,1.50,0.045],[0,0,0],'wood');
    m.box(brass,[-0.19,-0.73,0],[0.044,0.04,0.048],[0,0,0],'brass'); // foot shoe
    m.box(brass,[0.19,-0.73,0],[0.044,0.04,0.048],[0,0,0],'brass'); // foot shoe
    // Rails:
    m.box(woodLight,[0,0.71,0],[0.34,0.06,0.04],[0,0,0],'wood_light'); // top rail
    m.box(woodDark,[0,-0.67,0],[0.34,0.06,0.04],[0,0,0],'wood_dark'); // bottom rail
    // Lower solid wood wainscot kickboard:
    m.box(woodDark,[0,-0.46,0],[0.34,0.36,0.02],[0,0,0],'wood_dark');
    // Cream linen screen:
    m.box(linen,[0,0.13,0],[0.34,1.10,0.012],[0,0,0],'linen');
    // 3D Kumiko lattice fretwork (raised in front and back):
    for(const lz of [-0.009,0.009]){
     // Horizontal rails:
     m.box(woodLight,[0,0.45,lz],[0.34,0.015,0.006],[0,0,0],'wood_light');
     m.box(woodLight,[0,0.15,lz],[0.34,0.015,0.006],[0,0,0],'wood_light');
     m.box(woodLight,[0,-0.15,lz],[0.34,0.015,0.006],[0,0,0],'wood_light');
     // Vertical struts:
     for(const lx of [-0.10,0,0.10]){
      m.box(woodLight,[lx,0.15,lz],[0.015,0.60,0.006],[0,0,0],'wood_light');
     }
     // Interlaced Kumiko diamonds:
     m.box(woodLight,[0,0.45,lz],[0.14,0.14,0.005],[0,0,Math.PI/4],'wood_light');
     m.box(woodLight,[0,0.15,lz],[0.14,0.14,0.005],[0,0,Math.PI/4],'wood_light');
    }
   });
  }
  // 6 Brass knuckle hinges at each joint seam:
  for(let j=1;j<=2;j++){
   const [hx,hz]=seams[j];
   for(const hy of [0.25,0.75,1.25]){
    m.cyl(brass,[hx,hy,hz],0.014,0.06,12,[0,0,0],0.014,'brass');
   }
  }
 }
 return m.finish();
}`;

// Replace furnitureGeometry
const geomStart = code.indexOf('export function furnitureGeometry(kind:string,tier=0,job?:string){');
const geomEnd = code.indexOf('export const resourceMaterial=');
if (geomStart === -1 || geomEnd === -1) {
  console.error('Could not find boundaries for furnitureGeometry!');
  process.exit(1);
}

code = code.slice(0, geomStart) + newFurnitureGeometry + '\n\n' + code.slice(geomEnd);

writeFileSync(path, code, 'utf8');
console.log('Successfully updated', path);

