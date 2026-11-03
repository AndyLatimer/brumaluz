import type {CharData} from '../data/data';
import {ARMOR_SLOTS,equippedArmor} from '../data/outfits';
import {loadWardrobe,wardrobeModelsReady,type WardrobeId} from './wardrobe';
import {loadWeaponModels,weaponModelsReady} from './weaponModels';

function needed(data:Pick<CharData,'cls'|'equipment'>){
 const wardrobes:WardrobeId[]=['medieval','traje_guerrero_artesano'];
 for(const slot of ARMOR_SLOTS){const armor=equippedArmor(data.cls,data.equipment,slot);if(armor)wardrobes.push(armor.setId as WardrobeId);}
 const items=Object.values(data.equipment).filter(item=>item?.count===1).map(item=>item!.id);
 return {wardrobes:[...new Set(wardrobes)],items};
}
export function characterModelsReady(data:Pick<CharData,'cls'|'equipment'>){const {wardrobes,items}=needed(data);return wardrobeModelsReady(wardrobes)&&weaponModelsReady(items);}
export async function loadCharacterModels(data:Pick<CharData,'cls'|'equipment'>){const {wardrobes,items}=needed(data);await Promise.all([loadWardrobe(wardrobes),loadWeaponModels(items)]);}
