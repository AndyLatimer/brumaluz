import {spawnSync} from 'node:child_process';
const blender=process.env.BLENDER_PATH??(process.platform==='win32'?'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe':'blender');
const result=spawnSync(blender,['--background','--factory-startup','--python-exit-code','1','--python','tools/blender/model-equipment-headwear.py'],{stdio:'inherit'});
if(result.error)throw new Error(`Set BLENDER_PATH to your Blender executable. ${result.error.message}`);
process.exitCode=result.status??1;
