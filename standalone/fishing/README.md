# 🐟 Minijuego de Pesca Independiente — Brumaluz (Pompelín)

Prototipo de pesca completo, reactivo y desacoplado, diseñado para el MMORPG cozy **Brumaluz**. 
Inspirado en la accesibilidad y satisfacción de *Stardew Valley* y la tensión atmosférica de *DREDGE*, pero con mecánicas analíticas originales, física de agua suave y estética adaptada al estilo cálido de madera y pergamino del proyecto.

---

## 📌 Guía de Inicio Rápido

### Opción 1: Servidor ligero sin dependencias (Recomendado)
Desde la raíz del repositorio o dentro de la carpeta:
```bash
node standalone/fishing/serve.mjs
```
Abre tu navegador en `http://localhost:3030/` (o el puerto mostrado en la consola).

### Opción 2: Vite
```bash
npx vite standalone/fishing
```

### Ejecución de Pruebas Automatizadas
```bash
# Pruebas unitarias de física, máquina de estados y motores
node --test standalone/fishing/tests/fishing-logic.test.mjs

# Pruebas de integración E2E en navegador real (Chromium)
node --test standalone/fishing/tests/browser-smoke.test.mjs

# Todas las pruebas
node --test standalone/fishing/tests/*.test.mjs
```

---

## 🎮 Controles de Juego

| Acción | Teclado | Ratón / Táctil |
| :--- | :--- | :--- |
| **Lanzar caña (Fase A)** | `Espacio` o `W` | Click en "Lanzar Caña al Agua" |
| **Soltar potencia (Fase B)** | Soltar `Espacio` | Click en "¡Soltar Lance!" |
| **Clavar anzuelo (Fase D / Hook)** | `Espacio`, `W` o `Flecha Arriba` | Click en "¡Clavar Anzuelo!" |
| **Control de captura (Fase D)** | Mantener `Espacio` para subir | Mantener Click / Toque izquierdo en el lienzo |
| **Control alternativo (Accesible)** | Puntero directo sobre el agua | Mover ratón verticalmente para guiar la zona |
| **Silenciar sonido** | Tecla de acceso en pantalla | Botón `🔊` / `🔇` superior derecho |

---

## 🌊 El Ciclo Jugable de 5 Fases

```
[Fase A: Preparación] ──> [Fase B: Lanzamiento] ──> [Fase C: Espera]
                                                            │
                                                            ▼
[Fase E: Resultado]   <── [Fase D: Captura]     <── [Fase D: Picada/Hook]
```

1. **Fase A: Preparación**: Selección de caña (diferencias de anchura de zona, inercia y velocidad), cebo (afinidad de especies y reducción de espera) y zona de pesca.
2. **Fase B: Lanzamiento**: Medidor de potencia oscilante. Soltar cerca del punto dulce dorado maximiza la distancia (hasta 32 m), desbloqueando especies raras de aguas hondas.
3. **Fase C: Espera**: El flotador descansa sobre las corrientes procedurales. Se producen perturbaciones sutiles (toques / *nibbles*) y anillos de agua.
4. **Fase D (Inicio): Picada**: Alerta visual "¡PICA!" con destello y sonido, otorgando una ventana de reacción humana antes de que el pez escape.
5. **Fase D (Combate): Captura**: Minijuego central. El jugador regula la zona de captura dorada/esmeralda sobre el pez, que nada según su patrón conductual (`smooth`, `dart`, `sinker`, `floater`, `erratic`, `rhythmic`). El progreso avanza al cubrir al pez y decae si escapa.
6. **Fase E: Resultado**: Ficha de pergamino con nombre, rareza, tamaño (cm), peso (kg), calidad (1 a 4 estrellas), cita de lore y firma de telemetría lista para su procesamiento por el servidor.

---

## 🎛️ Panel de Pruebas y Calibración (Debug HUD)

Haz clic en el botón superior izquierdo **`🛠️ Modo Pruebas`** para:
- **Forzar especie**: Selecciona inmediatamente cualquier pez del catálogo para probarlo.
- **Calibrar dificultad**: Slider de dificultad en tiempo real (1.0 a 10.0).
- **Multiplicador de velocidad**: Modifica la agilidad del pez (0.5x a 2.5x).
- **Acciones instantáneas**:
  - `Forzar Picada Inmediata`: Salta el tiempo de espera.
  - `Forzar Combate Captura`: Entra directamente a la fase de recogida.
  - `Reiniciar Minijuego`: Regresa a la fase de preparación en 1 clic.
- **Telemetría en directo**: Monitor de posición del pez, posición de la barra, tensión del sedal y porcentaje de captura.

---

## 🏗️ Arquitectura y Estructura de Ficheros

```
standalone/fishing/
├── index.html                   # Entrypoint jugable con inspector de eventos API
├── serve.mjs                    # Servidor local sin dependencias (Node.js nativo)
├── README.md                    # Este documento
├── styles/
│   └── fishing.css              # Estilos cozy (Cinzel, Alegreya, pergamino y madera)
├── src/
│   ├── types.ts                 # Definiciones TypeScript de todos los contratos
│   ├── api/
│   │   └── fishing-api.js       # Fachada principal: FishingMinigameController
│   ├── core/
│   │   ├── engine.js            # Motor lógico desacoplado (sin dependencias DOM)
│   │   ├── state-machine.js     # Máquina de estados finita determinista
│   │   ├── fish-physics.js      # Dinámica y patrones de movimiento del pez
│   │   └── reeling-mechanics.js # Física del carrete, cobertura y cálculo de progreso
│   ├── data/
│   │   ├── species.js           # Catálogo de especies de peces y gráficos SVG
│   │   ├── equipment.js         # Cañas y cebos configurables
│   │   └── zones.js             # Zonas de Pompelín (Río Brumaluz, Canal del Olmo, etc.)
│   ├── render/
│   │   ├── canvas-water.js      # Renderizador 2D de agua, ondas y flotador
│   │   ├── minigame-view.js     # Renderizador de la columna y barra de captura
│   │   └── ui-manager.js        # Gestión de modales, HUD y eventos de interfaz
│   ├── audio/
│   │   └── sound-synthesizer.js # Web Audio procedimental (silbidos, carrete, fanfarria)
│   └── dev/
│       └── debug-panel.js       # Panel de desarrollo y calibración
└── tests/
    ├── fishing-logic.test.mjs   # Tests unitarios de lógica pura (Node test runner)
    └── browser-smoke.test.mjs   # Tests E2E en Chromium con Playwright
```

---

## 🔌 Contrato de Integración con el MMORPG

Este prototipo está preparado para ser integrado por otra IA o desarrollador sin reescribir la lógica ni acoplarse indebidamente al juego principal.

### 1. Inicialización en un Contenedor o Modal

```javascript
import { FishingMinigameController } from './standalone/fishing/src/api/fishing-api.js';

// Crear y lanzar el minijuego dentro de un modal o elemento del DOM
const container = document.getElementById('fishing-modal-container');

const fishingGame = FishingMinigameController.launch(container, {
  zoneId: 'rio_brumaluz',          // ID de zona según la posición del jugador
  rodId: playerEquipment.rodId,     // Caña equipada en el inventario
  baitId: playerEquipment.baitId,   // Cebo equipado (opcional)
  accessibleMode: false             // Ajuste de accesibilidad del usuario
});
```

### 2. Suscripción a Eventos

El controlador emite eventos de ciclo de vida estructurados:

```javascript
// Cambio de fase (PREPARATION, CASTING, WAITING, HOOKING, REELING, RESULT)
fishingGame.on('phaseChange', (phase) => {
  console.log(`Fase actual: ${phase}`);
  if (phase === 'WAITING') {
    // Ejemplo: reproducir animación de personaje sentado en el cliente Three.js
  }
});

// Aviso de picada
fishingGame.on('bite', () => {
  console.log('¡El flotador se ha hundido!');
});

// Captura exitosa (resultado completo firmado)
fishingGame.on('catch', (result) => {
  console.log('¡Pez capturado!', result);
  /*
  Estructura de `result`:
  {
    success: true,
    escaped: false,
    species: { id: "salmon_del_alba", name: "Salmón Real del Lucero del Alba", ... },
    size: 78.4,            // Longitud en cm
    weight: 6.82,          // Masa en kg
    quality: 3,            // 1=Normal, 2=Plata, 3=Oro, 4=Estelar
    castDistance: 24.6,    // Distancia en metros
    reelingAccuracy: 0.89, // % de tiempo en zona
    reelingDuration: 8.2,  // Segundos de combate
    rodId: "cana_fresno_cobre",
    baitId: "gusano_brillante",
    zoneId: "rio_brumaluz",
    timestamp: 1730598000000,
    clientSignature: "sig_fish_salmon_del_alba_..."
  }
  */

  // Enviar `result` al servidor mediante RPC/WebSocket para otorgar recompensas
  socket.emit('player:finishFishing', result);
});

// Pez escapado
fishingGame.on('escape', (result) => {
  console.log('El pez escapó:', result.species?.name);
  socket.emit('player:fishingEscaped', { zoneId: result.zoneId });
});

// Cancelación por parte del jugador
fishingGame.on('cancel', () => {
  console.log('Pesca cancelada.');
});
```

### 3. Cierre y Liberación Limpia de Recursos

Cuando el jugador cierra la ventana o se aleja del punto de agua:

```javascript
// Cancela animación, destruye bucles, eventos y contextos Web Audio
fishingGame.destroy();
```

---

## 🐟 Cómo Añadir Nuevas Especies sin Tocar la Lógica

Para añadir una nueva especie de pez, abre `src/data/species.js` y añade un nuevo objeto al array `FISH_SPECIES`:

```javascript
{
  id: 'barbo_plateado',
  name: 'Barbo Plateado de las Cumbres',
  description: 'Pez robusto de aguas frías de montaña.',
  lore: 'Nativo de los arroyos cercanos al Pueblo Lagto\'.',
  rarity: 'uncommon',           // 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical'
  difficulty: 4.5,              // 1.0 (muy fácil) a 10.0 (maestro)
  baseSpeed: 1.2,               // Agilidad
  pattern: 'sinker',            // 'smooth' | 'dart' | 'sinker' | 'floater' | 'erratic' | 'rhythmic'
  reactionTime: 2.1,            // Segundos para reaccionar al picar
  spawnWeight: 75,              // Peso relativo de probabilidad
  minDistance: 10,              // Metros mínimos para encontrarlo
  habitats: ['rio_brumaluz'],   // IDs de zonas donde vive
  preferredBaits: ['lombriz_jardin'],
  sizeRange: [30, 60],          // [min, max] en cm
  weightRange: [1.0, 4.0],      // [min, max] en kg
  primaryColor: '#7dd3fc',
  accentColor: '#e0f2fe'
}
```

Añade su ID a la zona correspondiente en `src/data/zones.js` y estará automáticamente disponible en el juego y en el panel de pruebas.

---

## 🔒 Principios de Aislamiento y Seguridad

- **Cero modificaciones al MMORPG existente**: El prototipo vive exclusivamente en `standalone/fishing/` y no modifica modelos, base de datos ni mecánicas existentes.
- **Validación del servidor**: El prototipo calcula la precisión y la firma del cliente, pero **no otorga objetos reales de inventario**. La validación de botín, XP de oficio y registro en mochila debe gestionarse en el backend del servidor mediante los datos emitidos por el evento `catch`.
