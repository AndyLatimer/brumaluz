export const packs = [
  ['resources', 'KayKit_ResourceBits_1.0_FREE', 'Recursos y materiales'],
  ['forest', 'KayKit_Forest_Nature_Pack_1.0_FREE', 'Bosque y naturaleza'],
  ['adventurers', 'KayKit_Adventurers_2.0_FREE', 'Aventureros'],
  ['skeletons', 'KayKit_Skeletons_1.1_FREE', 'Esqueletos'],
  ['dungeon', 'KayKit_Dungeon_Pack_1.1_FREE', 'Mazmorras'],
  ['character-animations', 'KayKit_Character_Animations_1.1', 'Animaciones de personajes (Medium y Large)'],
  ['mixed-bag', 'KayKit_Mixed_Bag_1_FREE', 'Objetos variados'],
  ['restaurant', 'KayKit_Restaurant_Bits_1.0_FREE', 'Cocina y taberna (seleccion medieval)'],
  ['furniture', 'KayKit_Furniture_Bits_1.0_FREE', 'Mobiliario'],
  ['rpg-tools', 'KayKit_RPGToolsBits_1.0_FREE', 'Herramientas y oficios'],
  ['medieval-builder', 'KayKit Medieval Builder Pack 1.0', 'Construccion medieval'],
  ['kenney-hexagon', 'kenney_hexagon-kit', 'Terreno hexagonal (Kenney)', 'Kenney'],
];
export const assetName = file => file.split(/[\\/]/).pop().replace(/\.(gltf|glb|obj)$/i, '').replace(/\.gltf$/i, '');

// Reviewed against the author's contents/sample images: no appliances, chrome
// furniture, industrial sinks/counters, squeeze bottles or burger assemblies.
export const restaurantMedieval = new Set([
  'bowl', 'bowl_dirty', 'bowl_small', 'chair_B',
  'crate', 'crate_buns', 'crate_carrots', 'crate_cheese', 'crate_ham', 'crate_lettuce',
  'crate_lid', 'crate_onions', 'crate_potatoes', 'crate_steak', 'crate_tomatoes', 'cuttingboard',
  'food_dinner', 'food_stew',
  'food_ingredient_bun', 'food_ingredient_bun_bottom', 'food_ingredient_bun_top',
  'food_ingredient_carrot', 'food_ingredient_carrot_chopped', 'food_ingredient_carrot_pieces',
  'food_ingredient_cheese', 'food_ingredient_cheese_chopped', 'food_ingredient_cheese_slice',
  'food_ingredient_ham', 'food_ingredient_ham_cooked', 'food_ingredient_ham_trash',
  'food_ingredient_lettuce', 'food_ingredient_lettuce_chopped', 'food_ingredient_lettuce_slice',
  'food_ingredient_onion', 'food_ingredient_onion_chopped', 'food_ingredient_onion_rings',
  'food_ingredient_potato', 'food_ingredient_potato_chopped', 'food_ingredient_potato_mashed',
  'food_ingredient_steak', 'food_ingredient_steak_pieces',
  'food_ingredient_tomato', 'food_ingredient_tomato_slice', 'food_ingredient_tomato_slices',
  'jar_A_large', 'jar_A_medium', 'jar_A_small', 'jar_B_large', 'jar_B_medium', 'jar_B_small',
  'knife', 'lid_A', 'lid_B', 'lid_large', 'pan_006', 'pan_A', 'pan_B',
  'plate', 'plate_dirty', 'plate_small', 'pot_A', 'pot_A_stew', 'pot_B', 'pot_B_stew',
  'pot_large', 'stew_bowl', 'stew_pot', 'table_round_B',
]);
export const restaurantExclusion = 'Fuera de la seleccion medieval: electrodomestico, mobiliario/accesorio moderno o comida de restaurante moderno.';
