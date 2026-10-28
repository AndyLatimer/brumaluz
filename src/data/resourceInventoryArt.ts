import {resourceColor,type ResourceFamily} from './resourceAppearance';
import {resourcePainting} from '../art/inventoryPaintings';

/** Inventory portraits, separate from the deliberately simple map symbols. */
export function resourceInventoryDrawing(family:ResourceFamily,tier=0):string {
 const painting=resourcePainting(family,tier);if(painting)return painting;
 const color=resourceColor(family,tier),ink='#30271f',cream='#f4dfad';
 const paint='url(#resource-art-paint)',leaf='url(#resource-art-leaf)',cut='url(#resource-art-cut)';
 const path=(d:string,fill:string,stroke=ink,width=1.6)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
 const vein=(d:string)=>path(d,'none','#b4c986',1.1);
 let art='';
 if(family==='ore'){
  art=path('M13 66 20 41 39 29 66 35 82 59 75 77 42 83 20 77Z','#666a60')+path('m20 41 19-12 27 6-15 18-22 5Z','#9d9e85')+path('m51 53 15-18 16 24-7 18-21-7Z','#515b55');
  for(const [x,y,s]of [[26,43,1],[51,48,.85],[40,64,.65]])art+=`<g transform="translate(${x} ${y}) scale(${s})">${path('m0 0 12-9 14 6 2 15-14 9-15-7Z',paint)}${path('m0 0 12-9 2 16-15 7Z',color)}${path('m12-9 14 6-12 10Z',cream,'none')}${path('m14 7 14-10-9 13-5 11Z',color)}${path('m1 2 8-6m-6 19 6 2','none',cream,1.2)}</g>`;
  art+=path('m20 72 8 3m31-1 8-3m-37-38 7-2','none','#b9ae8b',1.2);
 }else if(family==='gem'){
  const shift=tier%3*2;
  art=path('m16 72 11-13 28-6 25 14-8 13-37 3Z','#626b63');
  for(const [x,y,s]of [[38,13,1],[65,38,.66],[17,43,.56]])art+=`<g transform="translate(${x} ${y+shift}) scale(${s})">${path('m0 13 12-13 17 11-2 42-18 10-14-16Z',paint)}${path('m0 13 12-13-3 29-14 18Z',cream)}${path('m12 0 17 11-20 18Z',color)}${path('m9 29 20-18-2 42-18 10Z',color)}${path('m9 29 0 34m-9-50 9 16 18 24','none','#f6efcc',1.5)}</g>`;
 }else if(family==='wood'){
  for(const [x,y,s]of [[18,42,.8],[29,26,1]])art+=`<g transform="translate(${x} ${y}) scale(${s})">${path('m0 20 36-22 22 12v25L22 60 0 46Z',paint)}${path('m0 20 22 13v27L0 46Z',cut)}${path('m3 25 15 9v19L3 44Z','none','#966c42',1.5)}${path('m7 31 7 6v8l-7-5Z','none','#b88d53',1.3)}${path('m22 33 36-23m-31 31 25-17m-25 25 20-12m-31-15 31-20','none',ink,1.8)}${path('m24 31 22-14m-17 20 13-8','none','#d6bc89',1.3)}${tier===2?path('m28 43 6-4m2-13 6-4m3 9 7-5','none','#efe4bd',3):''}</g>`;
 }else if(family==='herb'||family==='fiber'){
  art=path('m32 80 24-56m-19 52 30-36M40 71 21 37','none','#516a39',3);
  for(const [x,y,angle]of [[32,62,-40],[47,45,30],[55,61,70],[24,38,-50],[61,31,25]])art+=`<g transform="translate(${x} ${y}) rotate(${angle})">${path('M0 0Q-17-7-10-27 9-18 0 0Z',leaf)}${vein('M0 0-7-21m4 11-6-4m5 9 5-7')}</g>`;
  if(family==='herb')for(const [x,y,s]of [[54,22,1],[26,34,.7],[69,40,.65]])art+=`<g transform="translate(${x} ${y}) scale(${s})">${[0,72,144,216,288].map(a=>`<g transform="rotate(${a})">${path('M0 0Q-12-8-4-15 7-17 8-7Z',paint)}</g>`).join('')}<circle r="4.2" fill="#d7a84c" stroke="${ink}"/><circle cx="-1.3" cy="-1.2" r="1.3" fill="${cream}"/></g>`;
  else for(const [x,y,s]of [[51,23,1],[28,34,.78],[67,43,.74]])art+=`<g transform="translate(${x} ${y}) scale(${s})">${path('M-10 5C-23-1-13-15-5-10-3-23 14-19 14-9 28-5 22 11 10 10 2 18-10 16-10 5Z',paint)}${path('M-12 0q5-9 10-6m3-4 7-2M1 7q6-6 12-4','none',cream,2)}</g>`;
  art+=path('m29 70 16 9-3 5-17-10Z','#b7834c')+path('m31 72 11 7m-8-3-7 10m12-6 6 6','none',cream,1.2);
 }else if(family==='fruit'){
  art=path('M46 38Q39 12 69 15 67 34 46 38Z',leaf)+vein('m48 34 16-15')+path('m40 37 5-16','none','#947147',4);
  art+=path('M43 39C21 22 8 40 15 62 17 77 31 83 42 76 57 85 73 70 72 52 73 34 56 28 43 39Z',paint)+path('M27 43Q18 48 24 60','none','#fae0b0',3)+path('M43 43q-3 14-2 25','none',color,1.3);
  for(const [x,y,r]of [[66,66,11],[75,56,9],[77,75,8]])art+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${paint}" stroke="${ink}" stroke-width="1.6"/><path d="m${x-4} ${y-4} 3-2" stroke="${cream}" stroke-width="2" stroke-linecap="round"/>`;
  art+=path('M66 57q-6-15 10-18 6 10-10 18Z',leaf);
 }else if(family==='mushroom'){
  art=path('M36 42q4 22-6 34 14 9 28 0-11-16-8-34Z',cut)+path('m40 51-2 20m8-18 4 20','none','#b2936a',1.4);
  art+=path('M11 43Q14 12 40 12 68 10 75 43 48 58 11 43Z',paint)+path('M13 43q31-11 59 0-28 13-59 0Z','#d3b993')+path('m20 44 17 4m25-4-17 4','none','#806648',1.2);
  art+=path('m65 64-2 15q9 5 17-1l-4-17Z',cut)+path('M54 63Q55 43 71 43 87 43 88 63q-16 10-34 0Z',paint);
  for(const [x,y,r]of [[28,29,4],[44,23,3],[57,34,4],[66,53,2],[79,57,2]])art+=`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.64}" fill="${cream}" opacity=".85"/>`;
 }else{
  art=path('M30 84 49 14M40 84 70 26M35 83 23 36','none','#ae8950',2.3);
  for(const [x,y,angle,s]of [[46,26,15,1],[63,39,30,.85],[25,45,-25,.7]])art+=`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${s})">${[0,12,24,36].map(y=>path(`M0 ${y}q-18-2-13-13 12-1 13 13Zm0 0q0-17 11-16 8 9-11 16Z`,paint)).join('')}${path('m0-12 0-13m-11 12-3-8m25 5 4-8','none',cream,1)}</g>`;
  art+=path('m27 72 20 7-2 6-20-8Z','#ac7647')+path('m30 75 12 5m-7-3-6 11m9-9 6 9','none',cream,1.3);
 }
 return `<svg x="1.2" y="1.2" width="21.6" height="21.6" viewBox="0 0 96 96"><defs><linearGradient id="resource-art-paint" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${cream}"/><stop offset=".32" stop-color="${color}"/><stop offset="1" stop-color="${ink}"/></linearGradient><linearGradient id="resource-art-leaf" x2=".8" y2="1"><stop stop-color="#b9ca79"/><stop offset=".45" stop-color="#789653"/><stop offset="1" stop-color="#354a30"/></linearGradient><linearGradient id="resource-art-cut" x2=".7" y2="1"><stop stop-color="#f3deb1"/><stop offset="1" stop-color="#ba8e58"/></linearGradient></defs><ellipse cx="48" cy="82" rx="34" ry="6" fill="#100e0b" opacity=".55"/><g stroke-linejoin="round">${art}</g></svg>`;
}
