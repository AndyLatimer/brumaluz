import type { BugReport, ReportStatus, ReportCategory } from './bugReportTypes';

const DB_NAME = 'brumaluz_reports_db';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Guarda o actualiza un reporte en IndexedDB */
export async function saveLocalReport(report: BugReport): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(report);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[BugStorage] No se pudo guardar en IndexedDB:', err);
  }
}

/** Obtiene todos los reportes de IndexedDB */
export async function getLocalReports(): Promise<BugReport[]> {
  try {
    const db = await openDB();
    return await new Promise<BugReport[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as BugReport[];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[BugStorage] No se pudieron cargar de IndexedDB:', err);
    return [];
  }
}

/** Elimina un reporte de IndexedDB */
export async function deleteLocalReport(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[BugStorage] No se pudo eliminar de IndexedDB:', err);
  }
}

/** Guarda un reporte tanto en el servidor local (disco de la máquina) como en IndexedDB */
export async function saveBugReport(report: BugReport): Promise<{ ok: boolean; savedToServer: boolean; report: BugReport }> {
  await saveLocalReport(report);

  let savedToServer = false;
  try {
    const res = await fetch('/__dev/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.report) {
        report = { ...report, ...data.report };
        await saveLocalReport(report);
      }
      savedToServer = true;
    }
  } catch (err) {
    console.warn('[BugStorage] Servidor de desarrollo no disponible, guardado en IndexedDB local:', err);
  }

  return { ok: true, savedToServer, report };
}

/** Obtiene la lista combinada de reportes */
export async function fetchAllBugReports(): Promise<BugReport[]> {
  const localList = await getLocalReports();
  const map = new Map<string, BugReport>();

  for (const item of localList) {
    map.set(item.id, item);
  }

  try {
    const res = await fetch('/__dev/reports', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.reports)) {
        for (const item of data.reports as BugReport[]) {
          map.set(item.id, item);
          void saveLocalReport(item);
        }
      }
    }
  } catch {}

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged;
}

/** Actualiza el estado o notas de un reporte */
export async function updateBugReportStatus(
  id: string,
  status: ReportStatus,
  resolutionNotes?: string
): Promise<void> {
  const localList = await getLocalReports();
  const item = localList.find((r) => r.id === id);
  if (item) {
    item.status = status;
    if (resolutionNotes !== undefined) item.resolutionNotes = resolutionNotes;
    await saveLocalReport(item);
  }

  try {
    await fetch(`/__dev/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolutionNotes }),
    });
  } catch {}
}

/** Elimina un reporte */
export async function deleteBugReport(id: string): Promise<void> {
  await deleteLocalReport(id);
  try {
    await fetch(`/__dev/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}
}

/** Sugerencias de archivos del código fuente según la categoría */
export function getRecommendedSourceFiles(category: ReportCategory): string[] {
  switch (category) {
    case 'combat':
      return ['src/game/combat.ts', 'src/data/combat.ts', 'src/ui/targetFrame.ts', 'src/game/combatSound.ts'];
    case 'visual':
      return ['src/world/city.ts', 'src/world/mapCity.ts', 'src/world/dayNight.ts', 'src/character/character.ts'];
    case 'quest':
      return ['src/story/quests.ts', 'src/story/scenes.ts', 'src/story/npcs.ts', 'src/ui/questWindow.ts'];
    case 'performance':
      return ['src/game/loop.ts', 'src/world/render.ts', 'src/world/graphics.ts', 'src/game/stage.ts'];
    case 'suggestion':
      return ['docs/LORE.md', 'docs/POLISH.md', 'src/game/playSession.ts'];
    case 'bug':
    default:
      return ['src/game/interaction.ts', 'src/game/movement.ts', 'src/game/stage.ts', 'src/game/state.ts'];
  }
}

/** Formatea un reporte a Markdown para copiarlo al asistente o pegarlo en un issue */
export function formatReportToMarkdown(report: BugReport): string {
  const categoryNames: Record<string, string> = {
    bug: '🐛 Bug / Error',
    visual: '🎨 Visual / Gráficos',
    suggestion: '💡 Sugerencia / Mejora',
    combat: '⚔️ Combate / Jugabilidad',
    quest: '📜 Misión / Historia',
    performance: '⚡ Rendimiento',
  };
  const severityNames: Record<string, string> = {
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    blocker: 'Bloqueante',
  };
  const statusNames: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    resolved: 'Resuelto',
  };

  const pos = report.location?.position;
  const posText = pos ? `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}` : 'Desconocida';
  const recFiles = getRecommendedSourceFiles(report.category);

  let logsSection = '';
  if (report.logs && report.logs.length > 0) {
    const errorLogs = report.logs.filter((l) => l.type === 'error' || l.type === 'exception');
    if (errorLogs.length > 0) {
      logsSection = `\n#### Excepciones / Errores de consola registrados\n\`\`\`text\n${errorLogs.map((l) => `[${l.type.toUpperCase()}] ${l.message}`).join('\n')}\n\`\`\`\n`;
    }
  }

  let renderStatsSection = '';
  if (report.system?.renderStats) {
    const rs = report.system.renderStats;
    renderStatsSection = `- **Rendimiento 3D**: Draw calls: ${rs.drawCalls}, Triángulos: ${rs.triangles.toLocaleString()}, Geometrías: ${rs.geometries}, Texturas: ${rs.textures}`;
  }

  return `### [${categoryNames[report.category] ?? report.category}] ${report.title}

- **ID**: \`${report.id}\`
- **Fecha**: ${report.dateFormatted} (${report.timestamp})
- **Estado**: ${statusNames[report.status] ?? report.status}
- **Severidad**: ${severityNames[report.severity] ?? report.severity}
- **Zona**: \`${report.location?.zone ?? 'desconocida'}\` (${report.location?.zoneName ?? ''})
- **Posición**: \`${posText}\` (Giro: ${report.location?.yawDegrees ?? 0}°)
- **Cámara**: Yaw ${report.camera?.yaw?.toFixed(2) ?? '-'}, Pitch ${report.camera?.pitch?.toFixed(2) ?? '-'}, Dist ${report.camera?.dist?.toFixed(1) ?? '-'}
- **Personaje**: ${report.character?.name ?? 'Sin nombre'} (${report.character?.race ?? '-'}, ${report.character?.cls ?? '-'})
- **Gráficos / Pantalla**: Modo ${report.system?.graphicsMode ?? 'normal'} (${report.system?.viewport?.width ?? 0}x${report.system?.viewport?.height ?? 0}, DPR: ${report.system?.pixelRatio ?? 1})
${renderStatsSection ? `${renderStatsSection}\n` : ''}${report.screenshotPath ? `- **Captura en disco**: \`${report.screenshotPath}\`` : ''}

#### Descripción
${report.description || '*(Sin descripción detallada)*'}
${report.resolutionNotes ? `\n#### Notas de resolución\n${report.resolutionNotes}` : ''}${logsSection}
#### Comando de reproducción en consola
\`\`\`js
window.brumaluz.move(${pos?.x ?? 0}, ${pos?.z ?? 0});
\`\`\`

#### Archivos recomendados a revisar
${recFiles.map((f) => `- [${f}](file:///${f})`).join('\n')}
`;
}
