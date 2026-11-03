-- Restores the previous line-of-sight implementation and removes its spatial index.
begin;
CREATE OR REPLACE FUNCTION public.game_rpg_sight(loc text, x1 numeric, z1 numeric, x2 numeric, z2 numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare b record; ax double precision;az double precision;bx double precision;bz double precision;dx double precision;dz double precision;lo double precision;hi double precision;t1 double precision;t2 double precision;tmp double precision;
begin
 for b in select * from public.rpg_blockers where map=loc loop
 ax:=cos(b.yaw)*(x1-b.x)-sin(b.yaw)*(z1-b.z);az:=sin(b.yaw)*(x1-b.x)+cos(b.yaw)*(z1-b.z);bx:=cos(b.yaw)*(x2-b.x)-sin(b.yaw)*(z2-b.z);bz:=sin(b.yaw)*(x2-b.x)+cos(b.yaw)*(z2-b.z);dx:=bx-ax;dz:=bz-az;lo:=0.001;hi:=0.999;
 if abs(dx)<0.000001 then if ax<b.min_x or ax>b.max_x then continue;end if;else t1:=(b.min_x-ax)/dx;t2:=(b.max_x-ax)/dx;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;
 if abs(dz)<0.000001 then if az<b.min_z or az>b.max_z then continue;end if;else t1:=(b.min_z-az)/dz;t2:=(b.max_z-az)/dz;if t1>t2 then tmp:=t1;t1:=t2;t2:=tmp;end if;lo:=greatest(lo,t1);hi:=least(hi,t2);end if;
 if lo<=hi then return false;end if;
 end loop;return true;end $function$
;
alter table public.rpg_blockers drop column if exists bounds;
notify pgrst, 'reload schema';
commit;
