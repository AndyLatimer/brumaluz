// Slice the authored 5 x 4 atlas into transparent, individually packed game assets.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import ts from 'typescript';
const input=process.argv[2];if(!input)throw Error('Pass the generated 5 x 4 atlas path.');
const out='src/assets/icons/inventory-painted';await mkdir(out,{recursive:true});
const code=ts.transpileModule(await readFile('src/data/resourceAppearance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {RESOURCE_PALETTES}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const names=['ore','wood','herb','fiber','fruit','mushroom','grain','gem','head','pendant','chest','hands','ring','weapon','offhand','legs','trinket','pickaxe','axe','sickle'];
const meta=await sharp(input).metadata();
const atlas=await sharp(input).ensureAlpha().raw().toBuffer();
const cuts=(axis,count)=>{
 const length=axis===0?meta.width:meta.height,other=axis===0?meta.height:meta.width,result=[0];
 for(let i=1;i<count;i++){const expected=length*i/count,range=length/count*.15;let best=Math.round(expected),score=Infinity;
  for(let at=Math.round(expected-range);at<=Math.round(expected+range);at++){
   let occupied=0;for(let n=0;n<other;n++){const pixel=axis===0?n*meta.width+at:at*meta.width+n;if(atlas[pixel*4+3]>24)occupied++;}
   const value=occupied+Math.abs(at-expected)*.005;if(value<score){score=value;best=at;}
  }result.push(best);
 }return [...result,length];
};
const columns=cuts(0,5),rows=cuts(1,4);
function hsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=!d?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return [(h*60+360)%360,max?d/max:0,max];}
function rgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const p=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return p.map(n=>Math.round((n+m)*255));}
const manifest=[];
for(let i=0;i<names.length;i++){
 const name=names[i],left=columns[i%5],top=rows[Math.floor(i/5)],right=columns[i%5+1],bottom=rows[Math.floor(i/5)+1];
 const cropped=await sharp(input).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
 const tile=await sharp(cropped).trim({threshold:8}).resize(224,224,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:16,bottom:16,left:16,right:16,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
 if(tile.length!==256*256*4)throw Error('Unexpected portrait dimensions: '+name);
 const palettes=RESOURCE_PALETTES[name];
 for(let tier=0;tier<(palettes?6:1);tier++){
  const pixels=Buffer.from(tile);
  if(tier){const hex=palettes[tier],target=hsv(...[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)));
   for(let p=0;p<pixels.length;p+=4){if(pixels[p+3]<20)continue;const [h,s,v]=hsv(pixels[p],pixels[p+1],pixels[p+2]);
    const selected=name==='gem'?h>150&&h<235:name==='fruit'?h<38||h>325:h<65||h>335;
    const y=Math.floor(p/4/256);
    if(!selected||s<.09||v<.14||((name==='herb'||name==='fiber')&&y>160)||(name==='mushroom'&&s<.36))continue;
    const tinted=rgb(target[0],Math.min(.8,s*.15+target[1]*.85),v);for(let c=0;c<3;c++)pixels[p+c]=tinted[c];
   }
  }
  const file=`${name}${palettes?`-${tier}`:''}.webp`;await sharp(pixels,{raw:{width:256,height:256,channels:4}}).webp({quality:94,alphaQuality:100}).toFile(`${out}/${file}`);manifest.push(file);
 }
}
await writeFile(`${out}/manifest.json`,JSON.stringify({source:'Brumaluz painted inventory atlas',columns,rows,resources:48,equipmentSlots:9,tools:3,files:manifest},null,2)+'\n');
console.log(JSON.stringify({prepared:manifest.length,directory:out}));
