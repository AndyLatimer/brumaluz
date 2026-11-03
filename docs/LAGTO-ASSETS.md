# Cumbres de Cobre · Pueblo Lagto'

Colección original de cincuenta edificios, muebles, piezas de minería y atrezo para las **Cumbres de Cobre** (región de origen del pueblo **Lagto'**), modelada en Blender con escala métrica y atlas PBR locales.

## Revisión vigente: 3 de noviembre de 2026

El usuario pide mejorar el paquete completo, con modelos texturizados, bien
construidos y cuidados. Se conservan los cincuenta IDs y sus categorías; no se
colocan recursos regionales en mapas ajenos ni se guardan cambios en cuentas.

- El atlas de color pasa de 512 × 256 a **2048 × 1024**, con 32 regiones de
  256 px y márgenes de 14 px. Hay mapas independientes de color,
  rugosidad/metal, normales y emisión. Cobre, pátina, piedra, madera, cuero y
  lana responden de forma distinta a la luz. Los GLB son autocontenidos.
- Se preparan mapas CC0 de [Poly Haven](https://polyhaven.com/license):
  [Granite Tile 03](https://polyhaven.com/a/granite_tile_03),
  [Wood Table 001](https://polyhaven.com/a/wood_table_001),
  [Brown Leather](https://polyhaven.com/a/brown_leather),
  [Metal Plate 02](https://polyhaven.com/a/metal_plate_02) y
  [Rough Linen](https://polyhaven.com/a/rough_linen). Autores, direcciones,
  licencias y SHA-256 están en `textures/sources.json`. Powered by Poly Haven.
  La pátina y los motivos regionales se preparan sobre esas superficies.
- Los cantos tienen biseles con más segmentos y normales ponderadas; las
  curvas conservan su suavidad. El registro elimina triángulos degenerados
  y superficies exactamente duplicadas, y fija filtrado con mipmaps.
- Bastión, torre, consejo y cuartel reciben huecos y rebajes reales donde
  antes la pared o el marco macizo tapaban las puertas y ventanas.
- Los escudos tienen un cerco abierto alrededor del campo, sin dos placas
  coplanares. Los pebeteros tienen pared interior y boca abierta para poder
  ver las brasas. Bisagras, flejes de arcones y otras pletinas se orientan
  sobre la cara correspondiente, con los remaches mirando hacia fuera.
- Las mantas ganan caída; alfombra y estandarte integran su ornamento en el
  tejido. Los mapas del cartógrafo tienen trazado y las tablillas, grabados.
  El mobiliario conserva su carácter de piedra, cuero, cedro y metal trabajado.
- La galería del `.blend` separa las piezas según sus dimensiones y oculta
  las colecciones originales que comparten el origen de modelado. Estas se
  conservan editables, sin superponer cincuenta modelos en la vista inicial.

La carga de imágenes comparte también su fuente de GPU cuando el mismo atlas
se repite en varios GLB; cada material conserva sus ajustes de muestreo y color.
El visor de recursos proporciona reflejos de entorno al inspeccionar este
paquete para que el cobre pueda leerse como metal.

```powershell
node tools/build-lagto-textures.mjs  # preparación de texturas; necesita red para verificar fuentes
npm.cmd run art:lagto               # reconstrucción de Blender y GLB con los atlas preparados
npm.cmd run test:lagto
node tools/review-lagto.mjs
```

`tools/blender/lagto_materials.py` prepara el material compartido y
`lagto_refinement.py` contiene las correcciones de construcción. Las fuentes
descargadas se conservan en `.art-sources/lagto-textures/`; los atlas preparados
se incluyen en `art/lagto/textures/` y `src/assets/library/brumaluz-lagto/textures/`.
Los editores y el juego no necesitan contactar con Poly Haven.

Las pruebas comprueban los cincuenta GLB, hashes, límites, atlas incrustados,
normales y triángulos. La revisión visual carga todas las piezas, las muestra
con el renderizador real del juego y revisa el visor y el catálogo de mapas.
Capturas e informe en `art/lagto-review/`. El ensayo usa una muestra temporal de
recursos dentro del juego; no publica una nueva región ni modifica los mapas.
Estas verificaciones no garantizan ausencia de artefactos en todas las cámaras
y tarjetas gráficas posibles.

La colección `brumaluz-lagto` está disponible en `/assets.html` (vista de recursos) y en `/maps.html` (editor de mapas).

## Identidad visual y materiales

De acuerdo con el lore de Pompelín (`docs/LORE.md`), los **Lagto'** proceden de las **Cumbres de Cobre**, entre montañas pedregosas, grietas y cavernas. Se describen como recios, pacientes y conocedores de los pasos ocultos de la roca y maestros de la metalurgia y la cantería.

El pack comparte una paleta cromática y textura propia cocinada en `textures/lagto-atlas.png`:
- **Cobre y bronce:** cobre martillado con textura de repujado (`copper`), resaltes pulidos (`copper_bright`), cobre envejecido/oxidado (`copper_dark`), cardenillo/pátina de intemperie (`copper_patina`) y bronce fundido para herrajes y remaches (`bronze`).
- **Cantería pesada:** basalto oscuro de base (`stone_dark`), granito de montaña (`stone_mid`), sillar escuadrado y pizarra pulida (`stone_light`), y roca mineralizada con vetas (`stone_copper`).
- **Maderas de montaña:** cedro viejo oscuro (`wood_dark`), vigas estructurales (`wood_mid`) y traviesas claras (`wood_light`).
- **Cuero y textiles:** piel rugosa de reptil (`leather_heavy`), correas de fijación (`leather_light`), lana roja de las cumbres (`textile_red`) y ocre solar ceremonial (`textile_ochre`).
- **Luminotecnia y fundición:** cristal ámbar de faroles (`amber_glow`), carbones y ascuas incandescentes (`ember_red`), y cristales de malaquita y azurita (`crystal_ore`).

## Inventario de piezas (50 recursos)

### 1. Edificios (12 piezas)
1. **house_copper_bastion** (`Bastión de Sillar y Cobre`): Vivienda fortificada de sillar escalonado, esquinas almohadilladas, alero de cobre martillado con juntas de engarce, puerta claveteada con zunchos y aspilleras enrejadas.
2. **forge_cobre_foundry** (`Gran Fundición de las Cumbres`): Taller de fundición monumental con hornos gemelos de cobre y toberas de tiraje, chimenea de sillería, tolva de almacenamiento de mena y solera de colada con moldes de lingotes.
3. **tower_drake_watch** (`Torreón Vigía de Roca`): Atalaya octogonal con base en talud, escalera frontal, aspilleras abocinadas, matacanes de cobre martillado sobre canes de piedra y pebetero cenital de señales bajo templete.
4. **cavern_terrace_shelter** (`Refugio de Risco y Caverna`): Refugio excavado en el canchal con pies derechos y tornapuntas de cedro, marquesina inclinada de cobre, portón de doble hoja acorazado y terraza superior con pretil.
5. **shrine_scale_ancestor** (`Santuario de los Ancestros de Roca`): Templo ceremonial con podio escalonado de 3 gradas, cuatro pilares con fajas en relieve de escama de reptil, entablamento con friso de cobre y pebetero con llama eterna.
6. **hall_stone_council** (`Cámara del Consejo de las Cumbres`): Gran sala consistorial sobre podio monumental con escalinata, pórtico de cuatro columnas fajadas en cobre remachado, frontón con el medallón de garra del clan Lagto' y lucernario escalonado.
7. **gatehouse_copper_rampart** (`Puerta Fortificada de las Cumbres`): Bastión de paso con torres gemelas flanqueantes, matacanes, adarve almenado rematado en cobre, rastrillo de barras de cobre y faroles murales.
8. **mine_shaft_headframe** (`Bocamina y Castañete de Extracción`): Castañete minero con castillete en tijera de cedro, ruedas gemelas de extracción de cobre, tolva de vertido y brocal de sillería sobre el pozo.
9. **bridge_copper_arch** (`Puente de Cantería y Cobre`): Puente monumental de arco escarzano en sillería de granito, calzada empedrada, pretiles con albardilla de cobre remachada y cuatro pilones con faroles.
10. **granary_silo_stone** (`Silo y Granero de Roca`): Depósito cilíndrico de sillar con zunchos de refuerzo de cobre, ranuras de ventilación con enrejado de cobre, cubierta cónica con veleta y tolva inferior de descarga.
11. **barracks_drake_guard** (`Cuartel de la Guardia de Escama`): Pabellón militar de sillar con soportal de cuatro pilares zunchados en cobre, cubierta a dos aguas de cobre acanalado y escudos heráldicos con umbos de bronce.
12. **market_stall_ore_smith** (`Puesto de Comercio Minero y Cobre`): Puesto de tasación de mineral con mostrador de granito pulido, balanza de cobre, toldo de cuero de montaña y lingotes expuestos.

### 2. Mobiliario (18 piezas)
13. **throne_basalt_copper** (`Trono de Basalto y Cobre`): Asiento ceremonial tallado en roca oscura de las cumbres con apoyabrazos guarnecidos de cobre remachado, remates de garra, respaldo con cresta de escamas y cojín acolchado de piel roja.
14. **table_stone_refectory** (`Mesa de Cantero Reforzada`): Mesa comunal con tablero de gruesa losa de pizarra pulida, pies en caballete con arquería calada, traviesa pasante de cedro acuñada y cantoneras de cobre.
15. **bench_quarry_slab** (`Banco Corrido de Roca y Cuero`): Banco de sillar de granito con colchoneta de cuero atada por cinchas con hebillas de cobre.
16. **chair_high_carved** (`Silla Alta de las Cumbres`): Silla de cedro con respaldo alto, placa central de pizarra con glifos geométricos saurianes, clavazón de bronce y chambranas en H.
17. **bed_cavern_hearth** (`Cama Térmica de Piedra y Pieles`): Cama de sillería con base provista de canales térmicos para el frío de las cumbres, manta de piel de borrego, mantas de lana roja y ocre, y farolillos de cobre en el cabecero.
18. **cabinet_vaulted_copper** (`Alacena Acorazada de Cobre`): Armario de dos puertas con batientes chapeados en lámina de cobre martillado repujado, cerrojo pasador y herrajes de hierro forjado.
19. **chest_ore_strongbox** (`Arcón Blindado de Mineral`): Arcón de madera férrea y sillar con tapa abovedada, zunchos de cobre cruzados con remaches de bronce, gran candado de fundición y asas basculantes.
20. **shelf_mason_tools** (`Estantería de Cantería y Menas`): Mueble de 3 alturas con repisas de pizarra, cajones con muestras de roca y menas, frascos de cobre, cinceles, martillo de cantero y geoda de malaquita.
21. **desk_cartographer_copper** (`Mesa de Trazado y Mapas Mineros`): Pupitre inclinado de agrimensor con losa de dibujo, tope inferior de cobre, mapa minero enrollado, escuadra de bronce, tintero y gavetas.
22. **anvil_master_forge** (`Gran Yunque de Fundición`): Yunque de doble cuerno sobre tajo de roble zunchado con aros de hierro, cubeta de agua para templar y martillo de forja.
23. **hearth_brazier_hewn** (`Hogar de Suelo y Campana de Cobre`): Hogar circular exento de cantería con lecho de brasas, parrilla giratoria y campana cónica suspendida de cobre batido.
24. **rug_lizard_weave** (`Alfombra de Lana y Cuero Lagto'`): Tapiz de suelo con patrón geométrico de escamas de reptil en rombos de rojo y ocre, cenefa de cuero trenzado y flecos.
25. **weapon_rack_stone_copper** (`Armero de Cantería y Cobre`): Armero de suelo con montantes de sillar tallado, barretas de cedro, espigas de cobre y alabardas saurianes de ceremonia.
26. **bunk_bed_miner** (`Litera Minera de Cedro y Sillar`): Litera doble de cedro zunchada a pies de sillar, con jergones de lana montañesa, almohadones, barandilla de cobre y escala integrada.
27. **low_table_cushions** (`Mesa Baja con Cojines de Suelo`): Mesa de té o tertulia de losa pulida rodeada por cuatro cojines cilíndricos de cuero y tela con tetera y cuencos de cobre batido.
28. **bookcase_tablet_vault** (`Librería de Tablillas y Cilindros`): Mueble archivador de sillería con alvéolos y repisas cargadas de tablillas de mineral y cilindros de planos pergamino enrollados.
29. **washing_basin_copper** (`Aguamanil y Palancana de Cobre`): Aguamanil con pedestal de sillar moldurado, palangana de cobre batido con agua, jarra de latón y paño de lino sobre toallero.
30. **cauldron_hearth_tripod** (`Caldero de Cobre sobre Trípode`): Marmita de cobre repujado sobre fogón de ascuas y trípode de forja con gancho de tiro y pala de cedro para remover brea o guisos.

### 3. Atrezo y Minería (20 piezas)
31. **brazier_cobre_tripod** (`Pebetero de Cobre de las Cumbres`): Trípode de hierro forjado con patas en garra, cuenco de cobre patinado y ascuas incandescentes.
32. **lamp_copper_pendant** (`Farol de Pared de Cobre y Soporte`): Pescante mural de hierro forjado con farol ochavado de cobre, paneles de vidrio ámbar y argolla.
33. **cart_mine_ore** (`Vagoneta Minera de Cobre`): Tolva minera sobre cuatro ruedas de fundición con pestañas para raíl, chasis de vigas y carga de roca y mena de cobre.
34. **mine_track_segment** (`Tramo de Raíles de Mina`): Tramo recto de 3 metros con traviesas de cedro, carriles de fundición y placas con clavos.
35. **ore_pile_copper** (`Montón de Menas de Cobre`): Agrupación de rocas extraídas de la montaña con vetas de cobre nativo metálico y cristales de malaquita.
36. **bellows_forge_pedestal** (`Fuelle Gigante de Fundición`): Fuelle de doble cámara de cuero y madera sobre zócalo de sillería, tobera cónica de cobre y palanca de bombeo con contrapeso de piedra.
37. **banner_lagto_clan** (`Estandarte de Guerra Lagto'`): Mástil sobre peana tallada con remate de garra de cobre, pendón de lana roja con el sol y la garra ocre, y barra inferior de contrapeso.
38. **barrier_spiked_stone** (`Parapeto Defensivo de Sillar y Cobre`): Muro bajo modular de granito con albardilla de chapa de cobre martillado y tres puas defensivas de hierro forjado.
39. **gate_quarry_post** (`Poste de Portal con Cadenas`): Monolito escuadrado con collarín de cobre grabado, tejadillo piramidal, argollas y cadena colgante de cobre.
40. **crucible_molten_copper** (`Crisol con Cobre Fundido`): Recipiente cerámico refractario sobre peana de piedra, abrazado por tenazas dobles de transporte con baño de cobre líquido incandescente.
41. **quarry_crane_derrick** (`Grúa de Cantera y Cabestrante`): Cabria en A de vigas de cedro con zapatas de lastre, torno con manivela, poleas de cobre y tenaza de elevación de bloques de cantería.
42. **water_cistern_copper** (`Cisterna de Roca y Filtro de Cobre`): Aljibe de sillería de montaña con rejilla de filtración de cobre para sedimentos, grifo inferior de bronce y cubo de servicio zunchado.
43. **mine_cart_turnout** (`Desvío y Aguja de Vía Minera`): Aguja de cambio ferroviario para vía estrecha con corazón de fundición, traviesas curvadas y palanca de maniobra con contrapeso de cobre.
44. **crusher_ore_stamp** (`Molino Triturador de Mineral`): Molino de maza doble sobre mortero de sillería con guías de cedro, zapatas de bronce y árbol de levas con volante de inercia de cobre.
45. **ingot_stack_copper** (`Pila de Lingotes de Cobre`): Estiba de lingotes de cobre apilados en cruz con marcado de fundición sobre bancada de cedro zunchada con flejes de hierro.
46. **ventilation_windlass_shaft** (`Pozo de Ventilación Minero`): Brocal de ventilación en sillar con cuello de cobre y caperuza giratoria orientada por veleta de cola para tiro de aire en galerías.
47. **warning_beacon_totem** (`Tótem Almenara de las Cumbres`): Pilar monolítico tallado en granito con cabeza de saurio en altorrelieve que sujeta un cuenco de señales con ascuas y resina.
48. **cavern_crystal_geode** (`Geoda Gigante de Malaquita y Azurita`): Gran bloque de roca de cumbre partido que exhibe una cavidad drusa tapizada de cristales de malaquita y azurita con vetas de cobre nativo.
49. **water_flume_sluice** (`Canaleta de Lavado de Mineral`): Canaleta de cedro en rampa sobre caballetes altos con corriente de agua y deflectores dentados de cobre para lavado de mineral.
50. **tent_miner_outpost** (`Tienda de Campaña Minera`): Pabellón de prospección con armazón a dos aguas de cedro, lonas rojas y ocres impermeabilizadas, petate exterior y farol interior suspendido.

## Usarlo en el editor de mapas y en el visor de recursos

1. **Visor de recursos:** Abre `assets.html` en el navegador y en el selector de **Paquete** elige **Cumbres de Cobre · Pueblo Lagto'**. Puedes examinar cada uno de los 50 modelos con rotación 3D, zoom, detalles de caras, dimensiones e inspección del atlas.
2. **Editor de mapas:** Abre `maps.html`. En la pestaña de catálogo aparece el grupo **Cumbres de Cobre · Pueblo Lagto'** con las categorías **Edificios**, **Mobiliario** y **Atrezo y decoración**. Su escala predeterminada es `[1, 1, 1]` y las piezas apoyan a ras de suelo (`Y = 0`).

## Fuentes y comandos de construcción

| Archivo / Carpeta | Descripción |
| --- | --- |
| `art/lagto/brumaluz-lagto.blend` | Archivo fuente de Blender 5 con una colección editable por recurso y escena de galería `_Presentation_only`. |
| `art/lagto/manifest.json` | Registro de metadatos, nombres, categorías y dimensiones. |
| `art/lagto/textures/lagto-atlas.png` | Atlas pintado con las texturas de cobre martillado, pátina, cantería, cedro y ascuas. |
| `art/lagto/objects/*.glb` | Los 50 GLB independientes exportados desde Blender. |
| `src/assets/library/brumaluz-lagto/catalog.json` | Catálogo registrado con hashes SHA-256, recuento de triángulos, cajas de límites y materiales. |
| `tools/blender/build_lagto.py` | Generador reproducible completo en Python para Blender. |
| `tools/blender/audit_lagto.py` | Auditoría de uniones, apoyos en suelo y elementos suspendidos en Blender. |
| `tools/build-lagto.mjs` | Script de Node para ejecutar Blender y registrar el catálogo. |
| `tools/register-lagto.mjs` | Validador de GLB, cálculo de límites y generador del catálogo. |
| `scripts/test-lagto.mjs` | Batería de pruebas automatizadas y verificación en navegador real con Playwright. |

Para regenerar todo el conjunto:
```powershell
npm run art:lagto
```

Para ejecutar las pruebas:
```powershell
npm run test:lagto
```

## Retoque y consolidación de uniones (Edificios y mobiliario)

Los apartados siguientes describen la revisión anterior del modelado. La revisión vigente y sus verificaciones son las del 3 de noviembre, descritas arriba; las comprobaciones anteriores no habían detectado los problemas de construcción y materiales corregidos ahora.

### Solución técnica de popping y stuttering
1. **Sombreado suave de normales (*Smooth Shading*):**
   - Todos los cilindros, tornos, esferas y toros incorporan interpolación suave de normales en sus caras laterales curvas (`p.use_smooth = True`), preservando la nitidez de tapas y molduras planas.
   - Esto suprime el salto abrupto de iluminación especular y difusa (*facet popping*) que ocurría al girar la cámara en el visor y en el juego.
2. **Eliminación de coplanaridad y z-fighting (*Anti-stuttering*):**
   - Se han reajustado todas las intersecciones de sillares, peldaños, cubiertas, herrajes y gavetas con embebidos o resaltes deliberados (1 a 2 cm), evitando caras concurrentes a distancia cero que provocaban parpadeo o stuttering de píxeles.
3. **Auditoría topológica estricta (`tools/blender/audit_lagto.py`):**
   - La auditoría anterior comprueba proximidad entre cajas y apoyo en el suelo. Esa proximidad no demuestra por sí sola ausencia de huecos, solapamientos ni superficies coplanares.

### Mejoras arquitectónicas en los 12 edificios
- **house_copper_bastion** (12.884 tris, 311 partes): Muros de sillar rústico en hiladas articuladas (`cyclopean_wall_course`), sillares almohadillados en las cuatro esquinas, portal con arco real de dovelas radiales (`arch_frame`) y clave de cobre, puertas dobles de cedro con zunchos y anillas de bronce, aspilleras abocinadas, canes de cedro tallados, cubierta a dos aguas de cobre martillado con juntas alistonadas (`copper_standing_seam_roof`), chimenea escalonada con caperuza octogonal y pescante de forja con farol suspendido.
- **forge_cobre_foundry** (10.396 tris, 216 partes): Taller monumental con solera de losas, muros ciclópeos con armazón visto de cedro y tornapuntas con zapatas de cobre, hornos gemelos de fundición con cuerpos troncocónicos zunchados en bronce, piqueras con colada incandescente, colector de humos a chimenea monumental, trinchera de colada con 6 moldes de lingotes (líquido, enfriando y desmoldado), tolva de menas con geodas de malaquita/azurita, yunque sobre tajo de roble y cubeta de temple.
- **tower_drake_watch** (6.368 tris, 194 partes): Base octogonal en talud escalonado con peldaños de acceso, fuste ochavado en tres cuerpos decrecientes con frisos de cobre y saeteras abocinadas, galería superior en voladizo sobre matacanes de triple canecillo de piedra, 8 almenas rematadas en cobre, templete cenital de forja y pebetero monumental de señales con ascuas y núcleo de fuego.
- **cavern_terrace_shelter** (5.316 tris, 133 partes): Risco tallado en estratos pétreos escalonados, gran portal en arco ciclópeo de dovelas con clave de cobre, doble portón de madera férrea con herrajes remachados, pies derechos de cedro con zapatas de cobre, marquesina alistonada con tornapuntas, terraza superior con pretil almenado y pebeteros de guardia.
- **shrine_scale_ancestor** (7.840 tris, 128 partes): Pirámide ceremonial de 3 gradas de granito y basalto, cuatro columnas colosales ochavadas con triple collarín de escamas en relieve y capiteles de palmetas, arquitrabe continuo con friso de cobre repujado con el sol y la garra, cubierta piramidal con aguja de bronce y orbe de oro, altar central escalonado con acanaladuras de libación y pebetero sacrificial con fuego eterno.
- **hall_stone_council** (9.920 tris, 182 partes): Podio cívico con escalinata monumental de 6 peldaños y pretiles con pebeteros en los pilones, pórtico de 4 columnas colosales con capiteles de volutas, frontón con el gran medallón de bronce del clan Lagto' con garra de oro incrustada, portal abocinado con puertas de cobre con 24 tachones de bronce, claristorio superior y cubierta escalonada de cobre con cumbrera rematada.
- **gatehouse_copper_rampart** (3.872 tris, 116 partes): Torres poligonales gemelas con base en talud y saeteras, túnel abovedado con arcos de dovelas al frente y detrás, rastrillo de barras de cobre con púas de cincel sobre guías pétreas, adarve con suelo de losas y pretiles almenados con albardilla de cobre remachada, y faroles ochavados en pescantes de forja.
- **mine_shaft_headframe** (3.000 tris, 62 partes): Brocal ciclópeo de sillería sobre la boca del pozo con rejilla de seguridad, castillete en tijera de 4 postes de cedro con zapatas de cobre y arriostramiento en cruz de San Andrés con cartelas de forja, tornapuntas traseras ancladas en zapatas de piedra, plataforma superior con barandilla, poleas gemelas de extracción de 1,2 m de diámetro con radios de bronce, cables de acero descendiendo al pozo con cubo de extracción basculante y tolva inclinada forrada en cobre.
- **bridge_copper_arch** (4.280 tris, 150 partes): Arco escarzano monumental con roscas de dovelas labradas en ambas caras y tajamares en los estribos, calzada con abombamiento y juntas de empedrado, pretiles de sillería con albardilla de cobre remachada, y 4 pilones de esquina coronados por faroles ochavados sobre zócalos de piedra.
- **granary_silo_stone** (5.308 tris, 76 partes): Cimiento circular de dos gradas, tambor cilíndrico de sillar con 4 zunchos de cobre martillado y tachonado de bronce, 6 ranuras de ventilación con guardapolvos de piedra y malla de cobre, cornisa moldurada, cúpula cónica de cardenillo y veleta con cruz de los vientos, saeta de cola de dragón y orbe dorado, junto a tolva de descarga y escala lateral de trepa.
- **barracks_drake_guard** (4.600 tris, 116 partes): Sala de guardia de sillar almohadillado con soportal de 4 pilares con zapatas y capiteles de cobre, cubierta a dos aguas alistonada (`copper_standing_seam_roof`), portal abovedado con puerta claveteada, y dos escudos de guerra saurianes en altorrelieve con campo rojo, borde de cobre, umbo apuntado de bronce y lanzas cruzadas.
- **market_stall_ore_smith** (2.348 tris, 60 partes): Mostrador en ángulo de sillería con encimera de pizarra pulida y cantoneras de cobre, armazón de cedro con zapatas y tornapuntas, toldo de lana de montaña listada en rojo y ocre con faldón festoneado continuo, balanza de tasación con pedestal, cruz, cadenas y platillos de cobre con menas, bloque de pesas escalonadas de latón y pilas piramidales de lingotes de cobre sellados.

### Mejoras en las 18 piezas de mobiliario
- **throne_basalt_copper** (1.988 tris): Trono en roca oscura sobre grada doble, apoyabrazos con garras de bronce sujetando orbes de cobre, respaldo con relieve repujado de escamas en cobre y tres remates con collarines de bronce y orbes dorados, con cojín capitoné de cuero y lana roja con botones de bronce.
- **table_stone_refectory** (1.824 tris): Gruesa losa de pizarra pulida con 4 escuadras de cobre remachadas, caballetes de piedra con arquería calada, viga pasante de cedro acuñada por llaves de madera, jarra de cobre con asa y tapa, fuente de pizarra con alimentos y copas de cobre.
- **bench_quarry_slab** (664 tris): Losa de granito con pedestales moldurados, colchoneta de cuero con ribete de lana y 3 cinchas completas con hebillas y lengüetas de cobre.
- **chair_high_carved** (1.312 tris): Silla de cedro con patas acanaladas y zapatas de cobre, chambranas en H, asiento con tachuelas de bronce, respaldo alto con montantes rematados en pirámides de cobre, pala central de pizarra con glifo de clan en cobre y cresta moldurada.
- **bed_cavern_hearth** (2.288 tris): Cama térmica sobre plataforma de sillería con 3 rejillas de hogar radiante y ascuas incandescentes, cabecero con cresta de cobre, jergón de lana roja, colcha de ocre doblada, manta de piel de borrego, almohadones, faroles de lectura y escabel lateral.
- **cabinet_vaulted_copper** (1.468 tris): Alacena sobre plinto de basalto con pilastras laterales de cedro, cornisa moldurada de cobre, puertas con placas de cobre repujadas con diamantes saurianes, 6 bisagras de forja y cerrojo pasador con anilla de bronce.
- **chest_ore_strongbox** (1.412 tris): Arcón abovedado de madera férrea sobre pies de sillar con zapatas de cobre, 3 zunchos envolventes con remaches, cerrojo de forja con candado macizo de bronce y asas laterales basculantes con topes.
- **shelf_mason_tools** (1.380 tris): Estantería de cedro con zapatas y remates de cobre, 4 baldas de pizarra pulida sobre ménsulas de cobre, 2 cajas de muestras de roca y menas, frascos de cobre y latón, maza de cantero, cinceles y geoda de malaquita/azurita.
- **desk_cartographer_copper** (1.112 tris): Pupitre de agrimensor con largueros de cedro, reposapiés, cajonera de 2 gavetas con anillas de bronce, tablero inclinado de pizarra con tope de cobre, plano de galerías desenrollado, tubo de pergamino, regla de bronce, tintero de cobre y cálamo.
- **anvil_master_forge** (1.088 tris): Yunque de doble cuerno sobre tajo de roble zunchado con aros de hierro y grapas de anclaje, cuerno cónico, talón cuadrado, ojo de macho y de punzón, martillo de forja, tenazas sujetando un lingote incandescente y cubeta de temple staved con agua.
- **hearth_brazier_hewn** (1.520 tris): Hogar de suelo con brocal de sillar en 16 segmentos, lecho de ceniza, ascuas incandescentes, parrilla giratoria de hierro con barrotes y campana cónica de cobre autoportante sobre trípode de forja con zapatas de bronce y cadenas de tiro.
- **rug_lizard_weave** (1.184 tris): Tapiz de lana roja con ribete de cuero trenzado, campo central con 3 medallones romboidales en ocre y basalto con cuentas doradas (sin caras coplanares) y flecos anudados de lana en los testeros.
- **weapon_rack_stone_copper** (996 tris): Armero con montantes de sillar y remates de cobre, artesa inferior guarnecida en chapa de cobre, traviesa ranurada con 4 espigas y pasadores de bronce, cruz de refuerzo con escudo del clan y 2 alabardas ceremoniales de asta de cedro, hacha de hierro y punta de lanza de cobre.
- **bunk_bed_miner** (1.476 tris): Litera doble con postes de cedro sobre zapatas de sillar, jergones de lana roja y ocre con almohadas, barandilla de seguridad de cobre alistonada, escala lateral con peldaños encastrados y gaveta inferior sobre guías.
- **low_table_cushions** (1.344 tris): Mesa baja de granito pulido con cantoneras de cobre y 4 pies de basalto, juego de té con tetera de cobre de cuello de cisne y dos cuencos con té, rodeada de 4 pufs circulares de cuero y lana roja con botón central de bronce.
- **bookcase_tablet_vault** (1.232 tris): Archivador de sillería con pilastras y cornisa rematada en cobre, 6 alvéolos con filas de tablillas de terracota y cobre grabadas, y cilindros de planos en cuero con tapas de bronce.
- **washing_basin_copper** (776 tris): Aguamanil sobre pedestal moldurado de piedra, palangana de cobre batido llena de agua con borde enrollado, jarra de latón con asa curva y pico vertedor, y toallero de cedro con paño de lino.
- **cauldron_hearth_tripod** (1.112 tris): Fuego de ascuas sobre bandeja de sillería, trípode de forja con patas en garra y anilla superior, cadena con gancho en S, marmita de cobre con asa basculante llena de guiso/brea y pala de cedro para remover.


