// Painted panel atlas: edge shading, folds, stitches and material response in the GLB.
import {deflateSync} from 'node:zlib';
const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0};
const chunk=(type,data)=>{const t=Buffer.from(type),h=Buffer.alloc(4),c=Buffer.alloc(4);h.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([h,t,data,c])};
function png(size,pixel){
 const stride=size*4,rows=Buffer.alloc((stride+1)*size);let previous=Buffer.alloc(stride);
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c};
 for(let y=0;y<size;y++){
  const raw=Buffer.alloc(stride);for(let x=0;x<size;x++)raw.set([...pixel(x,y),255],x*4);
  let best=raw,filter=0,score=Infinity;
  for(let f=0;f<5;f++){
   const data=Buffer.alloc(stride);let cost=0;
   for(let i=0;i<stride;i++){const a=i>=4?raw[i-4]:0,b=previous[i],c=i>=4?previous[i-4]:0,pred=f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):paeth(a,b,c),d=(raw[i]-pred+256)%256;data[i]=d;cost+=Math.min(d,256-d)}
   if(cost<score){score=cost;best=data;filter=f}
  }
  rows[y*(stride+1)]=filter;rows.set(best,y*(stride+1)+1);previous=raw;
 }
 const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export const PANEL={body:0,back:1,skirt:2,sleeve:3,collar:4,belt:5,armor:6,plain:7,crown:8,brim:9,trousers:10,boots:11,strap:12,crest:13,lining:14,neutral:15};
// Albedo uses a small painted palette. An indexed PNG preserves those colors
// without carrying three almost identical channels in every exported part.
function paintedPNG(size,pixel){
 const palette=[],lookup=new Map(),rows=Buffer.alloc((size+1)*size);let previous=Buffer.alloc(size);
 for(let y=0;y<size;y++){
  const raw=Buffer.alloc(size);for(let x=0;x<size;x++){const color=pixel(x,y),key=color.join(',');let index=lookup.get(key);if(index==null){index=palette.length;lookup.set(key,index);palette.push(color)}if(index>255)throw Error('Albedo palette overflow');raw[x]=index}
  let best=raw,filter=0,score=Infinity;
  for(let f=0;f<3;f++){const data=Buffer.alloc(size);let cost=0;for(let i=0;i<size;i++){const d=(raw[i]-(f===1?(i?raw[i-1]:0):f===2?previous[i]:0)+256)%256;data[i]=d;cost+=Math.min(d,256-d)}if(cost<score){score=cost;best=data;filter=f}}
  rows[y*(size+1)]=filter;rows.set(best,y*(size+1)+1);previous=raw;
 }
 const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=3;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('PLTE',Buffer.from(palette.flat())),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),gauss=(x,s)=>Math.exp(-((x/s)**2));
function sample(material,collection,tier,x,y){
 const tile=Math.floor(x/128)+4*Math.floor(y/128),u=(x%128)/127,v=(y%128)/127;
 const metal=['plate','brass'].includes(material),leather=/leather|sole/i.test(material),trim=material==='tunicTrim';
 const edge=Math.min(u,1-u,v,1-v),rim=gauss(edge-.036,.012),seam=gauss(edge-.014,.009);
 const wide=gauss(u-.22,.065)*Math.sin(v*3.1)**2+gauss(u-.72,.10)*Math.sin(v*3.1)**2;
 let shade=.90-.18*gauss(edge,.045)+.065*rim-.12*seam,height=.06*rim-.035*seam;
 shade+=.045*Math.cos((u-.34)*Math.PI)-.06*v;
 if([0,1,2,3,8,10].includes(tile)&&!metal){shade-=wide*.20;shade+=gauss(u-.27,.035)*.085*Math.sin(v*3.1)**2;height-=wide*.20;height+=gauss(u-.27,.035)*.06}
 if(tile===0&&material==='tunic'&&tier<2&&collection!=='medieval'){const a=(u*6+v*5)%1,b=(u*6-v*5+20)%1;const quilt=gauss(Math.min(a,1-a),.055)+gauss(Math.min(b,1-b),.055);shade-=quilt*.07;height-=quilt*.045}
 if(tile===2){shade-=gauss(v-.08,.03)*.14;shade+=gauss(v-.11,.015)*.065;height-=gauss(v-.08,.025)*.12}
 if(tile===4||tile===9||trim){shade-=gauss(u-.10,.018)*.17;shade+=gauss(u-.14,.014)*.10}
 if(leather){shade-=.045;shade+=.018*Math.sin(u*48+Math.sin(v*19)*2);height+=.008*Math.sin(u*48+v*22)}
 if(metal){shade=.67+.24*gauss(u-.30,.26)+.07*Math.sin(u*6.3)-.18*gauss(edge,.035)+.16*rim;height=.09*rim-.09*seam;if(tile===6){const ridge=gauss(u-.5,.025);shade+=ridge*.11;height+=ridge*.18}}
 const stitched=[2,4,5,9,11,12].includes(tile)||trim;
 if(stitched&&edge>.034&&edge<.054&&((u<v?u:v)*128)%9<4){shade+=.095;height+=.035}
 if(tile===13){const a=(u-.5)*2,b=(v-.5)*2,r=Math.hypot(a,b);const emblem=collection==='roble'?Math.abs(a)<.045&&Math.abs(b)<.55||Math.abs(Math.abs(a)-(.48-Math.abs(b)*.65))<.055&&Math.abs(b)<.5:collection==='eclipse'?Math.abs(Math.hypot(a+.10,b)-.46)<.065&&a<.28:collection==='marea'?Math.abs(b-.14*Math.sin(a*9))<.06&&Math.abs(a)<.55:Math.abs(Math.abs(a)+Math.abs(b)-.54)<.065;if(tier>=2&&emblem){shade+=.17;height+=.10}shade-=gauss(r-.71,.025)*.10}
 if(tier>=3&&(trim||tile===4||tile===9)&&u>.25&&u<.75){const a=Math.abs((u*8)%1-.5),b=Math.abs((v*8)%1-.5);if(Math.abs(a+b-.35)<.035){shade+=.08;height+=.04}}
 if(!metal&&!leather)shade+=((Math.floor(x)%3===0?1:0)-(Math.floor(y)%3===0?1:0))*.006;
 return {shade:clamp(shade,.38,1),height,rough:metal?.36+.18*v:leather?.72:.89,ao:clamp(1-.22*seam-.08*gauss(edge,.035),.6,1)};
}
export function outfitTexture(material,collection,tier=0){return paintedPNG(512,(x,y)=>{const s=Math.round(sample(material,collection,tier,x,y).shade*127)/127;return [Math.round(255*s),Math.round(255*s*(.98+.02*s)),Math.round(255*s*(.96+.04*s))]})}
export function outfitSurfaceTexture(material,collection='',tier=0){return png(128,(x,y)=>{const s=sample(material,collection,tier,x*4,y*4);return [Math.round(255*s.ao),Math.round(255*s.rough),255]})}
export function outfitNormalTexture(material,collection,tier=0){return png(256,(x,y)=>{x*=2;y*=2;const h=(a,b)=>sample(material,collection,tier,clamp(a,0,511),clamp(b,0,511)).height;const dx=(h(x+1,y)-h(x-1,y))*2.8,dy=(h(x,y+1)-h(x,y-1))*2.8,len=Math.hypot(dx,dy,1);return [Math.round(127.5-dx/len*127.5),Math.round(127.5+dy/len*127.5),Math.round(127.5+127.5/len)]})}
