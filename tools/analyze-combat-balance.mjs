// Read-only arithmetic reference, not a combat test or a prediction of real play.
import fs from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
const bundle='art/diagnostics/combat-analysis.mjs';
fs.mkdirSync('art/diagnostics',{recursive:true});
await build({stdin:{contents:`export {defaultChar} from './src/data/data'; export {COMBAT_KITS,starterEquipment,basicAttackDamage,attackInterval,skillPower,skillCost} from './src/data/combat'; export {vitalsOf} from './src/data/stats';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,packages:'external',platform:'node',format:'esm',outfile:bundle});
try{
 const {defaultChar,COMBAT_KITS,starterEquipment,basicAttackDamage,attackInterval,skillPower,skillCost,vitalsOf}=await import(pathToFileURL(`${process.cwd()}/${bundle}`));
 const rows=[];const f=n=>Number(n.toFixed(2));
 for(const[cls,kit]of Object.entries(COMBAT_KITS)){
  const d={...defaultChar(),cls,level:1,equipment:starterEquipment(cls)},v=vitalsOf(d),basic=basicAttackDamage(cls,1,d.equipment,d),interval=attackInterval(cls,d.equipment),skill=skillPower(cls,1,d.equipment,d)*kit.skill.hits;
  rows.push(`| ${cls} | ${f(basic)} | ${interval} | ${f(basic/interval)} | ${f(skill)}${kit.skill.healing?' curación':''} | ${kit.skill.cooldown} | ${f(skillCost(d))} | ${v.maxHealth} |`);
 }
 const report=`# Referencia aritmética de combate\n\nActualizada: 24 de octubre de 2026. Generada desde las fórmulas del juego mediante \`node tools/analyze-combat-balance.mjs\`.\n\nPersonaje humano de nivel 1, atributos iniciales y equipo de principiante. Sin encantamiento ni conjunto. El DPS de la tabla solo corresponde a ataques básicos sin interrupciones: no incluye habilidad, defensa enemiga, desplazamiento, fallos, latencia ni preparación. No demuestra equilibrio en una partida.\n\n| Clase | Básico | Intervalo (s) | DPS básico teórico | Habilidad, rango 1 | Recarga (s) | Coste | Vida |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nSe mantienen las reglas acordadas: +1 % por punto del atributo principal, +2 % por nivel adicional, +2 % de vida por Corpulencia, Guardia con rendimiento decreciente y tope del 60 %, habilidades independientes de la cadencia del arma, conjuntos numéricos y encantamientos activados por básicos. El clérigo conserva su básico ofensivo para aventura individual.\n\nLos primeros enemigos tienen 65–90 de vida y 6–8 de daño antes de Guardia. Los ataques anunciados se evitan por posición: cono frontal, carga recta o zona circular fijada al preparar el ataque. Mantenerse dentro de la zona al terminar la preparación provoca el impacto; salir de ella lo evita sin una tirada aleatoria. Los valores iniciales deben revisarse con partidas reales y distintas combinaciones de equipo.\n`;
 fs.writeFileSync('docs/COMBAT-BALANCE.md',report);console.log(rows.join('\n'));
}finally{fs.unlinkSync(bundle);}
