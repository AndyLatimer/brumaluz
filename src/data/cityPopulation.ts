/** Stable IDs remain unchanged when a resident gets a name or a different routine. */
export const RESIDENT_IDS = [
  'vecino_levante_1', 'vecino_levante_2', 'vecino_levante_3',
  'vecino_pozo_1', 'vecino_pozo_2', 'vecino_pozo_3',
  'vecino_jardin_1', 'vecino_jardin_2', 'vecino_jardin_3',
  'vecino_artesanos_1', 'vecino_artesanos_2', 'vecino_artesanos_3',
  'vecino_huertas_1', 'vecino_huertas_2', 'vecino_huertas_3',
  'vecino_lonja_1', 'vecino_lonja_2', 'vecino_lonja_3',
  'habitante_brumaluz_19',
  'habitante_brumaluz_20',
  'habitante_brumaluz_21',
  'habitante_brumaluz_22',
  'habitante_brumaluz_23',
  'habitante_brumaluz_24',
  'habitante_brumaluz_25',
  'habitante_brumaluz_26',
  'habitante_brumaluz_27',
  'habitante_brumaluz_28',
  'habitante_brumaluz_29',
  'habitante_brumaluz_30',
  'habitante_brumaluz_31',
  'habitante_brumaluz_32',
  'habitante_brumaluz_33',
  'habitante_brumaluz_34',
  'habitante_brumaluz_35',
  'habitante_brumaluz_36',
  'habitante_brumaluz_37',
  'habitante_brumaluz_38',
  'habitante_brumaluz_39',
  'habitante_brumaluz_40',
  'habitante_brumaluz_41',
  'habitante_brumaluz_42',
  'habitante_brumaluz_43',
  'habitante_brumaluz_44',
  'habitante_brumaluz_45',
  'habitante_brumaluz_46',
  'habitante_brumaluz_47',
  'habitante_brumaluz_48',
  'habitante_brumaluz_49',
  'habitante_brumaluz_50',
  'habitante_brumaluz_51',
  'habitante_brumaluz_52',
  'habitante_brumaluz_53',
  'habitante_brumaluz_54',
] as const;
export type ResidentId = typeof RESIDENT_IDS[number];
const ambientResidentIds = new Set<string>(RESIDENT_IDS);
export const isAmbientResident = (id: string): id is ResidentId => ambientResidentIds.has(id);
export type PopulationPoint = readonly [number, number];
export type Words = readonly [es: string, en: string];
export interface PopulationExchange {
  id: string;
  lines: readonly Words[];
  near?: { position: PopulationPoint; radius: number };
}
export interface PopulationDistrict {
  id: string;
  residents: readonly ResidentId[];
  route: readonly PopulationPoint[];
  spawns?: readonly PopulationPoint[];
  greetings: readonly Words[];
  exchanges: readonly PopulationExchange[];
}
export interface CityPopulationDefinition { districts: readonly PopulationDistrict[] }

export const RESIDENT_SUBTITLE = ['Habitante de Brumaluz', 'Brumaluz resident'] as const;
/** Names stay individual; residents share a functional subtitle. */
export const RESIDENT_IDENTITIES = [
  "Aldina",
  "Faelion",
  "Ishtar",
  "Lumiro",
  "Elora",
  "Laerion",
  "Kashik",
  "Nilin",
  "Marena",
  "Sylanor",
  "Rek'li",
  "Rosia",
  "Belina",
  "Thalwen",
  "Tolsha",
  "Tisro",
  "Corina",
  "Aerin",
  "Islina",
  "Nythas",
  "Artir",
  "Bairi",
  "Aneria",
  "Daelnora",
  "Eksek",
  "Closu",
  "Edeth",
  "Gaelalas",
  "Issnak",
  "Furu",
  "Gaora",
  "Liadir",
  "Krokar",
  "Jubel",
  "Luisa",
  "Myrdal",
  "Razek",
  "Lodo",
  "Perela",
  "Serearia",
  "Skar'li",
  "Nalia",
  "Viran",
  "Viraalas",
  "Tzathar",
  "Poluna",
  "Marmir",
  "Ithneth",
  "Kasak",
  "Senei",
  "Ariana",
  "Aurlia",
  "Arlik",
  "Tislia"
].map(name => [name, ...RESIDENT_SUBTITLE] as const);

// Geography stays authored. The controller prepares ordered street patrols separately.
export const CITY_POPULATIONS: Readonly<Record<string, CityPopulationDefinition>> = {
  brumaluz: { districts: [
    { id: 'levante', residents: ["vecino_levante_1","vecino_levante_2","habitante_brumaluz_19","habitante_brumaluz_20","habitante_brumaluz_21","habitante_brumaluz_22"],
      spawns: [[148,0],[116,0],[132,0],[156,0],[124,0],[140,0]], route: [[148,0],[116,0],[132,0],[156,0]],
      greetings: [
        ["Buenas.","Hello."],
        ["Si buscas el centro, sigue esta calle.","For the centre, follow this street."],
      ], exchanges: [
        { id: 'levante_salida', near: {"position":[172,0],"radius":28}, lines: [
          ["¿Por dónde se sale a Pompelín?","Which way leads out to Pompelín?"],
          ["Por la puerta del Este, al final de esta calle.","Through the East Gate, at the end of this street."],
        ] },
        { id: 'levante_saludo', lines: [
          ["Buenas, ¿qué tal?","Hello. How are you?"],
          ["Bien. He salido a estirar las piernas.","Well. I came out to stretch my legs."],
        ] },
      ] },
    { id: 'pozo', residents: ["vecino_levante_3","vecino_pozo_1","habitante_brumaluz_23","habitante_brumaluz_24","habitante_brumaluz_25","habitante_brumaluz_26"],
      spawns: [[-24,0],[8,0],[-8,0],[16,0],[-16,0],[-32,0]], route: [[-24,0],[8,0],[-8,0],[16,0]],
      greetings: [
        ["Hola.","Hello."],
        ["La plaza del Levante queda al este, por esta calle.","Levante Square is east along this street."],
      ], exchanges: [
        { id: 'pozo_levante', near: {"position":[0,0],"radius":14}, lines: [
          ["¿Cómo se llega a la plaza del Levante?","How do you get to Levante Square?"],
          ["Sigue esta calle hacia el este.","Follow this street east."],
        ] },
        { id: 'pozo_pausa', lines: [
          ["¿Llevas mucho aquí?","Have you been here long?"],
          ["No, acabo de parar.","No, I only just stopped."],
        ] },
      ] },
    { id: 'jardin', residents: ["vecino_pozo_2","vecino_pozo_3","habitante_brumaluz_27","habitante_brumaluz_28","habitante_brumaluz_29","habitante_brumaluz_30"],
      spawns: [[28,34.641],[44,34.641],[36,27.713],[20,34.641],[24,34.641],[32,34.641]], route: [[28,34.641],[44,34.641],[36,27.713],[20,34.641]],
      greetings: [
        ["Buenas. Puedes descansar un rato en el jardín.","Hello. You can rest for a while in the garden."],
        ["Hola.","Hello."],
      ], exchanges: [
        { id: 'jardin_descanso', near: {"position":[36,34.641],"radius":12}, lines: [
          ["Me duelen un poco los pies.","My feet are a bit sore."],
          ["Quédate aquí un rato.","Stay here for a while."],
        ] },
        { id: 'jardin_saludo', lines: [
          ["¿Qué tal estás?","How are you?"],
          ["Bien, ¿y tú?","Well. And you?"],
          ["Bien, gracias.","Well, thanks."],
        ] },
      ] },
    { id: 'artesanos', residents: ["vecino_jardin_1","vecino_jardin_2","habitante_brumaluz_31","habitante_brumaluz_32","habitante_brumaluz_33","habitante_brumaluz_34"],
      spawns: [[-116,0],[-148,0],[-132,0],[-156,0],[-124,0],[-140,0]], route: [[-116,0],[-148,0],[-132,0],[-156,0]],
      greetings: [
        ["Los maestros de oficio están dentro de los talleres.","The craft masters are inside their workshops."],
        ["Buenas.","Hello."],
      ], exchanges: [
        { id: 'artesanos_muebles', lines: [
          ["¿En qué taller hacen muebles?","Which workshop makes furniture?"],
          ["En Ebanistería.","The furniture workshop."],
        ] },
        { id: 'artesanos_reparacion', lines: [
          ["¿También reparan herramientas en Herrería?","Does the smith repair tools too?"],
          ["Sí, hacen reparaciones.","Yes, they do repairs."],
        ] },
      ] },
    { id: 'huertas', residents: ["vecino_jardin_3","vecino_artesanos_1","habitante_brumaluz_35","habitante_brumaluz_36","habitante_brumaluz_37","habitante_brumaluz_38"],
      spawns: [[-28,76.21],[4,76.21],[-12,76.21],[20,76.21],[-20,76.21],[12,76.21]], route: [[-28,76.21],[4,76.21],[-12,76.21],[20,76.21]],
      greetings: [
        ["La plaza del pozo queda hacia el norte.","Well Square is to the north."],
        ["Buenas.","Hello."],
      ], exchanges: [
        { id: 'huertas_centro', lines: [
          ["¿Por dónde se vuelve al centro?","Which way goes back to the centre?"],
          ["Hacia el norte, hasta la plaza del pozo.","North, as far as Well Square."],
        ] },
        { id: 'huertas_apetito', lines: [
          ["Me apetece algo de comer.","I feel like something to eat."],
          ["¿Dulce o salado?","Sweet or savoury?"],
          ["Salado.","Savoury."],
        ] },
      ] },
    { id: 'lonja', residents: ["vecino_artesanos_2","vecino_artesanos_3","habitante_brumaluz_39","habitante_brumaluz_40","habitante_brumaluz_41","habitante_brumaluz_42"],
      spawns: [[60,-103.923],[76,-131.636],[68,-117.779],[84,-145.492],[64,-110.851],[80,-138.564]], route: [[60,-103.923],[76,-131.636],[68,-117.779],[84,-145.492]],
      greetings: [
        ["Hola.","Hello."],
        ["Buenas. Los talleres están en el Barrio de los Artesanos.","Hello. The workshops are in the Artisans’ Quarter."],
      ], exchanges: [
        { id: 'lonja_joyeria', lines: [
          ["¿También hacen colgantes en Joyería?","Does the jeweller make pendants too?"],
          ["Sí, y anillos.","Yes, and rings."],
        ] },
        { id: 'lonja_saludo', lines: [
          ["Me alegra verte.","Good to see you."],
          ["Igualmente.","You too."],
        ] },
      ] },
    { id: 'telares', residents: ["vecino_huertas_1","vecino_huertas_2","habitante_brumaluz_43","habitante_brumaluz_44","habitante_brumaluz_45","habitante_brumaluz_46"],
      spawns: [[60,103.923],[76,131.636],[68,117.779],[84,145.492],[64,110.851],[80,138.564]], route: [[60,103.923],[76,131.636],[68,117.779],[84,145.492]],
      greetings: [
        ["Buenas.","Hello."],
        ["La puerta está al final de esta calle.","The gate is at the end of this street."],
      ], exchanges: [
        { id: 'telares_plaza', near: {"position":[86,148.956],"radius":28}, lines: [
          ["¿Por aquí se vuelve a la plaza?","Does this way lead back to the square?"],
          ["Sí, por esta misma calle.","Yes, along this street."],
        ] },
        { id: 'telares_pausa', lines: [
          ["Voy a parar un momento.","I’m stopping for a moment."],
          ["Me viene bien descansar a mí también.","I could do with a rest too."],
        ] },
      ] },
    { id: 'olmo', residents: ["vecino_huertas_3","vecino_lonja_1","habitante_brumaluz_47","habitante_brumaluz_48","habitante_brumaluz_49","habitante_brumaluz_50"],
      spawns: [[-60,103.923],[-76,131.636],[-68,117.779],[-84,145.492],[-64,110.851],[-80,138.564]], route: [[-60,103.923],[-76,131.636],[-68,117.779],[-84,145.492]],
      greetings: [
        ["Buenas. Este es el Barrio del Olmo.","Hello. This is the Olmo Quarter."],
        ["Hola.","Hello."],
      ], exchanges: [
        { id: 'olmo_barrio', near: { position: [-72,124], radius: 30 }, lines: [
          ["Me gusta esta parte de Brumaluz.","I like this part of Brumaluz."],
          ["Está bien, aunque queda un poco lejos del centro.","It’s nice, though it’s a bit far from the centre."],
        ] },
        { id: 'olmo_saludo', lines: [
          ["Buenas.","Hello."],
          ["Hola. ¿Qué tal?","Hello. How are you?"],
          ["Todo bien.","All well."],
        ] },
      ] },
    { id: 'ronda', residents: ["vecino_lonja_2","vecino_lonja_3","habitante_brumaluz_51","habitante_brumaluz_52","habitante_brumaluz_53","habitante_brumaluz_54"],
      spawns: [[-60,-103.923],[-76,-131.636],[-68,-117.779],[-84,-145.492],[-64,-110.851],[-80,-138.564]], route: [[-60,-103.923],[-76,-131.636],[-68,-117.779],[-84,-145.492]],
      greetings: [
        ["Hola.","Hello."],
        ["Esta calle lleva hacia el centro.","This street leads towards the centre."],
      ], exchanges: [
        { id: 'ronda_salida', near: {"position":[-86,-148.956],"radius":28}, lines: [
          ["¿Por aquí también se sale a Pompelín?","Does this gate lead out to Pompelín too?"],
          ["Sí, esta es otra de las puertas.","Yes, this is another of the gates."],
        ] },
        { id: 'ronda_descanso', lines: [
          ["¿Te encuentras bien?","Are you all right?"],
          ["Sí, solo estoy descansando.","Yes, I’m just resting."],
        ] },
      ] },
  ] },
};

export function residentDistrict(id: string) {
  return Object.values(CITY_POPULATIONS).flatMap(city => city.districts).find(district => district.residents.some(resident => resident === id));
}
export const POPULATION_TRANSLATIONS: Record<string, string> = Object.fromEntries([
  [RESIDENT_SUBTITLE[0], RESIDENT_SUBTITLE[1]],
  ...Object.values(CITY_POPULATIONS).flatMap(city => city.districts.flatMap(district => [
    ...district.greetings, ...district.exchanges.flatMap(exchange => exchange.lines),
  ])),
]);
