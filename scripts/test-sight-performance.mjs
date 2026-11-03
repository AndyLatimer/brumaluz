// Isolated PostgreSQL/WASM check of the generated sight geometry. No configured
// or live database is used. It loads supabase/server/18a-rpg-geometry.sql verbatim
// (table, bounds column, GiST index, blockers and function) and verifies that the
// index-filtered line of sight matches a full-scan reference on every map.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';

const modulePath=process.env.PGLITE_TEST_MODULE??join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let available=true;try{await access(modulePath);}catch{available=false;}

test('indexed line of sight matches a full blocker scan and keeps its spatial index',{skip:!available,timeout:120000},async()=>{
 const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
 try{
  const source=await readFile(new URL('../supabase/server/18a-rpg-geometry.sql',import.meta.url),'utf8');
  assert.match(source,/add column if not exists bounds box generated always as/,'18a debe declarar la columna bounds');
  assert.match(source,/create index if not exists rpg_blockers_bounds on public\.rpg_blockers using gist\(bounds\)/,'18a debe declarar el índice espacial');
  await db.exec(source.replace(/revoke all on [^;]+;/g,''));
  // Referencia: la implementación anterior sin prefiltro, recorriendo todos los bloqueadores del mapa.
  await db.exec(`create function public.game_rpg_sight_scan(loc text,x1 numeric,z1 numeric,x2 numeric,z2 numeric) returns boolean language plpgsql stable as $$
   declare b record; ax double precision;az double precision;bx double precision;bz double precision;dx double precision;dz double precision;lo double precision;hi double precision;t1 double precision;t2 double precision;tmp double precision;
   begin
    for b in select * from public.rpg_blockers where map=loc loop
    ax:=cos(b.yaw)*(x1-b.x)-sin(b.yaw)*(z1-b.z);az:=sin(b.yaw)*(x1-b.x)+cos(b.yaw)*(z1-b.z);bx:=cos(b.yaw)*(x2-b.x)-sin(b.yaw)*(z2-b.z);bz:=sin(b.yaw)*(x2-b.x)+cos(b.yaw)*(z2-b.z);dx:=bx-ax;dz:=bz-az;lo:=0.001;hi:=0.999;
    if abs(dx)<0.000001 then if ax<b.min_x or ax>b.max_x then continue;end if;else t1:=(b.min_x-ax)/dx;t2:=(b.max_x-ax)/dx;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;
    if abs(dz)<0.000001 then if az<b.min_z or az>b.max_z then continue;end if;else t1:=(b.min_z-az)/dz;t2:=(b.max_z-az)/dz;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;
    if lo<=hi then return false;end if;
    end loop;return true;end $$;`);
  const rows=(await db.query(`select count(*)::int n,count(bounds)::int with_bounds from public.rpg_blockers`)).rows[0];
  assert.ok(rows.n>3000,'la geometría publicada conserva sus bloqueadores');
  assert.equal(rows.with_bounds,rows.n,'todas las filas calculan su caja envolvente');
  assert.equal((await db.query(`select count(*)::int n from pg_indexes where indexname='rpg_blockers_bounds'`)).rows[0].n,1);
  // Segmentos entre bloqueadores reales: mezclan cortes garantizados y líneas despejadas en cada mapa.
  await db.exec('select setseed(.42)');
  const parity=(await db.query(`
   with pairs as (
    select a.map,a.x+(random()*8-4) x1,a.z+(random()*8-4) z1,c.x+(random()*8-4) x2,c.z+(random()*8-4) z2
    from (select map,x,z,row_number() over (partition by map order by random()) rn from public.rpg_blockers) a
    join (select map,x,z,row_number() over (partition by map order by random()) rn from public.rpg_blockers) c using (map,rn)
    limit 2500)
   select count(*)::int total,
    count(*) filter (where public.game_rpg_sight(map,x1::numeric,z1::numeric,x2::numeric,z2::numeric)
     is distinct from public.game_rpg_sight_scan(map,x1::numeric,z1::numeric,x2::numeric,z2::numeric))::int mismatches,
    count(*) filter (where not public.game_rpg_sight_scan(map,x1::numeric,z1::numeric,x2::numeric,z2::numeric))::int blocked
   from pairs`)).rows[0];
  assert.ok(parity.total>=2000,'la muestra cubre los mapas publicados');
  assert.equal(parity.mismatches,0,'el prefiltro espacial no puede cambiar ninguna línea de visión');
  assert.ok(parity.blocked>0&&parity.blocked<parity.total,'la muestra contiene cortes y despejes');
  // El prefiltro debe usar el índice espacial, no un recorrido completo.
  const plan=JSON.stringify((await db.query(`explain (format json) select * from public.rpg_blockers where map='pompelin' and bounds && box(point(0,0),point(10,10))`)).rows);
  assert.match(plan,/rpg_blockers_bounds/,'la consulta del prefiltro usa el índice GiST');
 }finally{await db.close();}
});
