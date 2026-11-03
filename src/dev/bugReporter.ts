// Sistema de captura de pantalla, anotación y reporte de bugs/mejoras para Brumaluz.
import * as THREE from 'three';
import { canvas, renderer, stage, scene, camera, holder, playerVel, marker, graphics, TEST } from '../game/stage';
import { play, session, view, ui, fight } from '../game/state';
import { locationName } from '../data/data';
import { vitalsOf } from '../data/stats';
import { toast } from '../ui/toast';
import { $ } from '../ui/dom';
import type {
  BugReport,
  BugReportCamera,
  BugReportCharacter,
  BugReportGameplay,
  BugReportLocation,
  BugReportLogEntry,
  BugReportRenderStats,
  BugReportSystem,
  ReportCategory,
  ReportSeverity,
  ReportStatus,
} from './bugReportTypes';
import {
  saveBugReport,
  fetchAllBugReports,
  updateBugReportStatus,
  deleteBugReport,
  formatReportToMarkdown,
} from './bugReportStorage';

// Buffer circular de logs recientes de consola
const logRingBuffer: BugReportLogEntry[] = [];
const MAX_LOGS = 25;

export function initConsoleLogCapture(): void {
  const origWarn = console.warn;
  const origError = console.error;

  const pushLog = (type: 'warn' | 'error' | 'exception', args: unknown[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ');
      logRingBuffer.push({ type, message: msg.slice(0, 300), timestamp: new Date().toISOString() });
      if (logRingBuffer.length > MAX_LOGS) logRingBuffer.shift();
    } catch {}
  };

  console.warn = (...args) => {
    pushLog('warn', args);
    origWarn.apply(console, args);
  };
  console.error = (...args) => {
    pushLog('error', args);
    origError.apply(console, args);
  };
  window.addEventListener('error', (event) => {
    pushLog('exception', [event.message, event.filename, event.lineno]);
  });
}

// Variables de estado del reportero
let currentDraftReport: BugReport | null = null;
let cleanScreenshotData = '';
let selectedCategory: ReportCategory = 'bug';
let currentReviewReports: BugReport[] = [];
let currentFilterStatus: 'all' | ReportStatus = 'all';
let currentSearchQuery = '';
let selectedReportId: string | null = null;

// Variables de la herramienta de dibujo/anotación
type AnnotationTool = 'pen' | 'rect' | 'arrow';
let activeTool: AnnotationTool = 'pen';
let activeColor = '#e74c3c';
let isDrawing = false;
let startX = 0;
let startY = 0;
let annotationHistory: ImageData[] = [];
let annotCanvas: HTMLCanvasElement | null = null;
let annotCtx: CanvasRenderingContext2D | null = null;

/** Reproduce un destello visual y un clic de obturador sintético */
export function playShutterFeedback(): void {
  // Destello visual
  const flash = $('#camera-shutter-flash');
  if (flash) {
    flash.hidden = false;
    flash.classList.add('flash-active');
    setTimeout(() => {
      flash.classList.remove('flash-active');
      setTimeout(() => { flash.hidden = true; }, 180);
    }, 40);
  }

  // Sonido de obturador sintético con Web Audio
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch {}
}

/** Captura una imagen del lienzo WebGL en formato JPEG optimizado */
export function captureSceneScreenshot(maxWidth = 1280, quality = 0.82): string {
  try {
    if (TEST) {
      renderer.render(scene, camera);
    } else {
      stage.render();
    }

    const srcW = canvas.width;
    const srcH = canvas.height;
    if (srcW === 0 || srcH === 0) return '';

    const scale = Math.min(1, maxWidth / srcW);
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', quality);

    ctx.drawImage(canvas, 0, 0, targetW, targetH);
    return offscreen.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('[BugReporter] No se pudo capturar el fotograma:', err);
    try {
      return canvas.toDataURL('image/jpeg', quality);
    } catch {
      return '';
    }
  }
}

/** Obtiene métricas de rendimiento actuales del renderizador Three.js */
export function getRenderStats(): BugReportRenderStats | undefined {
  if (!renderer?.info) return undefined;
  try {
    return {
      drawCalls: renderer.info.render.calls || 0,
      triangles: renderer.info.render.triangles || 0,
      geometries: renderer.info.memory.geometries || 0,
      textures: renderer.info.memory.textures || 0,
    };
  } catch {
    return undefined;
  }
}

/** Recopila metadatos contextuales del mundo, jugador y sistema */
export function gatherBugReportContext(): {
  location: BugReportLocation;
  camera: BugReportCamera;
  character: BugReportCharacter;
  system: BugReportSystem;
  gameplay: BugReportGameplay;
  logs: BugReportLogEntry[];
} {
  const char = session.state;
  const currentCity = play.city?.locationId ?? char?.location ?? 'brumaluz';
  const currentCityName = locationName(currentCity);

  const posX = Number(holder.position.x.toFixed(2));
  const posY = Number(holder.position.y.toFixed(2));
  const posZ = Number(holder.position.z.toFixed(2));
  const yawDeg = Math.round((((holder.rotation.y * 180) / Math.PI) % 360 + 360) % 360);

  const loc: BugReportLocation = {
    zone: currentCity,
    zoneName: currentCityName,
    position: { x: posX, y: posY, z: posZ },
    yawDegrees: yawDeg,
  };

  const cam: BugReportCamera = {
    yaw: Number(view.yaw.toFixed(3)),
    pitch: Number(view.pitch.toFixed(3)),
    dist: Number(view.followDist.toFixed(1)),
  };

  const v = char ? vitalsOf(char) : null;
  const characterInfo: BugReportCharacter = {
    name: char?.name || 'Aventurero',
    race: char?.race || 'humano',
    cls: char?.cls || 'guerrero',
    level: char?.level || 1,
    health: v?.health,
    maxHealth: v?.maxHealth,
  };

  const isMobile = window.innerWidth <= 768;
  const systemInfo: BugReportSystem = {
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pixelRatio: Number((window.devicePixelRatio || 1).toFixed(2)),
    graphicsMode: graphics.compatible ? 'compatible' : 'normal',
    renderStats: getRenderStats(),
    deviceType: isMobile ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop',
  };

  const gameplayInfo: BugReportGameplay = {
    openWindow: ui.openWindow,
    target: fight.combatEncounter ? 'enemigo' : null,
  };

  return {
    location: loc,
    camera: cam,
    character: characterInfo,
    system: systemInfo,
    gameplay: gameplayInfo,
    logs: [...logRingBuffer],
  };
}

/** Prepara el lienzo de dibujo sobre la captura */
function setupAnnotationCanvas(imageDataUrl: string): void {
  annotCanvas = $<HTMLCanvasElement>('#bug-annotation-canvas');
  if (!annotCanvas) return;
  annotCtx = annotCanvas.getContext('2d');
  if (!annotCtx) return;

  const img = new Image();
  img.onload = () => {
    if (!annotCanvas || !annotCtx) return;
    annotCanvas.width = img.naturalWidth || 800;
    annotCanvas.height = img.naturalHeight || 450;
    annotCtx.drawImage(img, 0, 0);
    // Guardar estado inicial limpio
    annotationHistory = [annotCtx.getImageData(0, 0, annotCanvas.width, annotCanvas.height)];
  };
  img.src = imageDataUrl;
}

function pushAnnotationHistory(): void {
  if (!annotCanvas || !annotCtx) return;
  annotationHistory.push(annotCtx.getImageData(0, 0, annotCanvas.width, annotCanvas.height));
  if (annotationHistory.length > 20) annotationHistory.shift();
}

function undoAnnotation(): void {
  if (!annotCanvas || !annotCtx || annotationHistory.length <= 1) return;
  annotationHistory.pop(); // Quitar estado actual
  const prev = annotationHistory[annotationHistory.length - 1];
  if (prev) {
    annotCtx.putImageData(prev, 0, 0);
  }
}

function clearAnnotations(): void {
  if (!annotCanvas || !annotCtx || annotationHistory.length === 0) return;
  const initial = annotationHistory[0];
  if (initial) {
    annotCtx.putImageData(initial, 0, 0);
    annotationHistory = [initial];
  }
}

function getCanvasCoords(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if (!annotCanvas) return { x: 0, y: 0 };
  const rect = annotCanvas.getBoundingClientRect();
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  const scaleX = annotCanvas.width / rect.width;
  const scaleY = annotCanvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number): void {
  const headLen = 18;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

/** Abre el modal de reporte con captura de pantalla instantánea */
export function openBugReportModal(): void {
  playShutterFeedback();

  // Tomar captura y recopilar contexto
  cleanScreenshotData = captureSceneScreenshot();
  const context = gatherBugReportContext();

  const now = new Date();
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  currentDraftReport = {
    id,
    timestamp: now.toISOString(),
    dateFormatted: now.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
    title: '',
    description: '',
    category: selectedCategory,
    severity: 'normal',
    status: 'pending',
    screenshot: cleanScreenshotData,
    originalScreenshot: cleanScreenshotData,
    location: context.location,
    camera: context.camera,
    character: context.character,
    system: context.system,
    gameplay: context.gameplay,
    logs: context.logs,
  };

  // Preparar lienzo de dibujo
  setupAnnotationCanvas(cleanScreenshotData);

  // Actualizar píldoras informativas
  const metaPills = $('#bug-meta-pills');
  metaPills.innerHTML = `
    <div class="bug-pill-row">
      <span class="bug-pill">📍 <strong>${context.location.zoneName}</strong> [${context.location.position.x}, ${context.location.position.y}, ${context.location.position.z}]</span>
      <span class="bug-pill">👤 <strong>${context.character.name}</strong> (${context.character.race} · ${context.character.cls})</span>
    </div>
    <div class="bug-pill-row">
      <span class="bug-pill">🖥️ Modo ${context.system.graphicsMode} · ${context.system.viewport.width}x${context.system.viewport.height}</span>
      ${context.system.renderStats ? `<span class="bug-pill">⚡ ${context.system.renderStats.drawCalls} llamadas · ${context.system.renderStats.triangles} tri</span>` : ''}
    </div>
  `;

  // Botones de categoría
  document.querySelectorAll<HTMLButtonElement>('#bug-category-chips .bug-cat-chip').forEach((chip) => {
    const cat = chip.dataset.category as ReportCategory;
    const isActive = cat === selectedCategory;
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-checked', String(isActive));
  });

  // Limpiar campos
  $<HTMLInputElement>('#bug-title-input').value = '';
  const descInput = $<HTMLTextAreaElement>('#bug-desc-input');
  descInput.value = '';
  $<HTMLSelectElement>('#bug-severity-select').value = 'normal';

  // Mostrar diálogo
  const backdrop = $('#bug-report-backdrop');
  backdrop.hidden = false;
  setTimeout(() => descInput.focus(), 60);
}

/** Cierra el modal de reporte */
export function closeBugReportModal(): void {
  const backdrop = $('#bug-report-backdrop');
  backdrop.hidden = true;
  currentDraftReport = null;
  annotationHistory = [];
}

/** Guarda el reporte introducido por el usuario */
export async function submitBugReport(): Promise<void> {
  if (!currentDraftReport) return;

  const desc = $<HTMLTextAreaElement>('#bug-desc-input').value.trim();
  if (!desc) {
    $<HTMLTextAreaElement>('#bug-desc-input').focus();
    toast('Descripción requerida', 'Por favor explica brevemente el bug o qué mejorar.', true);
    return;
  }

  const rawTitle = $<HTMLInputElement>('#bug-title-input').value.trim();
  const title = rawTitle || desc.slice(0, 50) + (desc.length > 50 ? '…' : '');
  const severity = $<HTMLSelectElement>('#bug-severity-select').value as ReportSeverity;

  // Si hay anotaciones en el lienzo, guardar la imagen compuesta
  let finalScreenshot = cleanScreenshotData;
  if (annotCanvas && annotationHistory.length > 1) {
    try {
      finalScreenshot = annotCanvas.toDataURL('image/jpeg', 0.82);
    } catch {}
  }

  const reportToSave: BugReport = {
    ...currentDraftReport,
    title,
    description: desc,
    category: selectedCategory,
    severity,
    screenshot: finalScreenshot,
    originalScreenshot: cleanScreenshotData,
  };

  const submitBtn = $<HTMLButtonElement>('#bug-btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  try {
    const result = await saveBugReport(reportToSave);
    closeBugReportModal();
    const dest = result.savedToServer ? 'en disco (reports/) y navegador' : 'en almacenamiento local';
    toast('Reporte guardado', `Se ha registrado "${title}" ${dest}.`);
  } catch (err) {
    console.error('[BugReporter] Error al guardar reporte:', err);
    toast('Error al guardar', 'No se pudo guardar el reporte.', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar reporte';
  }
}

/** Abre el visor de revisión de reportes */
export async function openBugReviewModal(targetReportId?: string): Promise<void> {
  closeBugReportModal();
  const backdrop = $('#bug-review-backdrop');
  backdrop.hidden = false;

  await refreshBugReviewList(targetReportId);
}

/** Cierra el visor de revisión */
export function closeBugReviewModal(): void {
  $('#bug-review-backdrop').hidden = true;
}

/** Recarga la lista de reportes en el visor */
export async function refreshBugReviewList(preferId?: string): Promise<void> {
  currentReviewReports = await fetchAllBugReports();

  const total = currentReviewReports.length;
  const pending = currentReviewReports.filter((r) => r.status === 'pending').length;
  const inProgress = currentReviewReports.filter((r) => r.status === 'in_progress').length;
  const resolved = currentReviewReports.filter((r) => r.status === 'resolved').length;

  $('#count-all').textContent = String(total);
  $('#count-pending').textContent = String(pending);
  $('#count-progress').textContent = String(inProgress);
  $('#count-resolved').textContent = String(resolved);

  renderReviewList();

  if (preferId && currentReviewReports.some((r) => r.id === preferId)) {
    selectReviewReport(preferId);
  } else if (!selectedReportId || !currentReviewReports.some((r) => r.id === selectedReportId)) {
    const filtered = getFilteredReports();
    if (filtered.length > 0) {
      selectReviewReport(filtered[0].id);
    } else {
      renderReviewDetail(null);
    }
  } else {
    selectReviewReport(selectedReportId);
  }
}

function getFilteredReports(): BugReport[] {
  let list = currentReviewReports;
  if (currentFilterStatus !== 'all') {
    list = list.filter((r) => r.status === currentFilterStatus);
  }
  if (currentSearchQuery.trim()) {
    const q = currentSearchQuery.toLowerCase();
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.location?.zoneName?.toLowerCase().includes(q) ||
        r.character?.name?.toLowerCase().includes(q)
    );
  }
  return list;
}

function renderReviewList(): void {
  const container = $('#bug-reports-list');
  const filtered = getFilteredReports();

  if (filtered.length === 0) {
    container.innerHTML = `<div class="bug-detail-placeholder"><p>No hay reportes que coincidan con el filtro.</p></div>`;
    return;
  }

  container.innerHTML = filtered
    .map((r) => {
      const isSelected = r.id === selectedReportId;
      const imgSrc = r.screenshot || r.screenshotUrl || '';
      const statusPill = `<span class="bug-status-pill ${r.status}">${r.status === 'resolved' ? 'Resuelto' : r.status === 'in_progress' ? 'En curso' : 'Pendiente'}</span>`;
      return `
      <div class="bug-card ${isSelected ? 'selected' : ''}" data-report-id="${r.id}" role="button" tabindex="0">
        <div class="bug-card-thumb">
          ${imgSrc ? `<img src="${imgSrc}" alt="" loading="lazy" />` : '<div style="background:#222;height:100%"></div>'}
        </div>
        <div class="bug-card-info">
          <div class="bug-card-header">
            <h4 class="bug-card-title">${escapeHtml(r.title)}</h4>
            ${statusPill}
          </div>
          <div class="bug-card-meta">
            <span>${r.dateFormatted || ''}</span>
            <span>·</span>
            <span>📍 ${r.location?.zoneName || 'Mundo'}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  container.querySelectorAll<HTMLElement>('.bug-card').forEach((card) => {
    card.onclick = () => selectReviewReport(card.dataset.reportId!);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectReviewReport(card.dataset.reportId!);
      }
    };
  });
}

function selectReviewReport(id: string): void {
  selectedReportId = id;
  document.querySelectorAll('#bug-reports-list .bug-card').forEach((card) => {
    card.classList.toggle('selected', (card as HTMLElement).dataset.reportId === id);
  });
  const report = currentReviewReports.find((r) => r.id === id) || null;
  renderReviewDetail(report);
}

function renderReviewDetail(report: BugReport | null): void {
  const container = $('#bug-report-detail');
  if (!report) {
    container.innerHTML = `
      <div class="bug-detail-placeholder">
        <p>Selecciona un reporte de la lista para ver sus detalles y captura.</p>
      </div>
    `;
    return;
  }

  const categoryNames: Record<string, string> = {
    bug: '🐛 Bug / Error',
    visual: '🎨 Visual / Gráficos',
    suggestion: '💡 Sugerencia / Mejora',
    combat: '⚔️ Combate',
    quest: '📜 Misión',
    performance: '⚡ Rendimiento',
  };
  const severityNames: Record<string, string> = {
    low: 'Severidad: Baja',
    normal: 'Severidad: Normal',
    high: 'Severidad: Alta',
    blocker: 'Severidad: Bloqueante',
  };

  const imgSrc = report.screenshot || report.screenshotUrl || '';
  const pos = report.location?.position;
  const posText = pos ? `${pos.x}, ${pos.y}, ${pos.z}` : '-';

  container.innerHTML = `
    <div class="bug-detail-header">
      <div class="bug-detail-top-row">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="bug-pill"><strong>${categoryNames[report.category] || report.category}</strong></span>
          <span class="bug-pill">${severityNames[report.severity] || report.severity}</span>
        </div>
        <div class="bug-status-switcher">
          <span class="bug-status-pill ${report.status}">${report.status === 'resolved' ? 'Resuelto' : report.status === 'in_progress' ? 'En progreso' : 'Pendiente'}</span>
          <button type="button" class="btn ghost" id="btn-status-pending" ${report.status === 'pending' ? 'disabled' : ''}>Pendiente</button>
          <button type="button" class="btn ghost" id="btn-status-progress" ${report.status === 'in_progress' ? 'disabled' : ''}>En progreso</button>
          <button type="button" class="btn ghost" id="btn-status-resolved" ${report.status === 'resolved' ? 'disabled' : ''}>Resuelto</button>
        </div>
      </div>
      <h3 class="bug-detail-title">${escapeHtml(report.title)}</h3>
      <div class="bug-detail-date">Registrado el ${report.dateFormatted} · ID: <code>${report.id}</code></div>
    </div>

    ${
      imgSrc
        ? `
      <div class="bug-detail-media" title="Clic para ampliar imagen">
        <img id="detail-screenshot-img" src="${imgSrc}" alt="Captura del reporte" />
      </div>
    `
        : ''
    }

    <div>
      <label class="bug-label">Descripción</label>
      <div class="bug-detail-desc-box">${escapeHtml(report.description)}</div>
    </div>

    <div class="bug-context-grid">
      <div class="bug-context-item">
        <strong>Ubicación</strong>
        <span>${report.location?.zoneName || 'Mundo'}</span>
        <div>Coords: <code>${posText}</code></div>
        ${pos ? `<button type="button" class="bug-teleport-btn" id="btn-teleport-here">🚀 Teletransportar aquí</button>` : ''}
      </div>
      <div class="bug-context-item">
        <strong>Personaje</strong>
        <span>${report.character?.name || 'Aventurero'}</span>
        <div>${report.character?.race || '-'} · ${report.character?.cls || '-'}</div>
      </div>
      <div class="bug-context-item">
        <strong>Cámara</strong>
        <div>Yaw: ${report.camera?.yaw ?? '-'}</div>
        <div>Pitch: ${report.camera?.pitch ?? '-'} · Dist: ${report.camera?.dist ?? '-'}</div>
      </div>
      <div class="bug-context-item">
        <strong>Sistema</strong>
        <div>Modo: ${report.system?.graphicsMode || 'normal'}</div>
        <div>${report.system?.viewport?.width ?? 0}x${report.system?.viewport?.height ?? 0} (DPR: ${report.system?.pixelRatio ?? 1})</div>
      </div>
    </div>

    ${
      report.logs && report.logs.some((l) => l.type === 'error' || l.type === 'exception')
        ? `
      <div>
        <label class="bug-label" style="color:#b33924;">⚠️ Errores de consola registrados</label>
        <pre class="bug-detail-logs-box">${report.logs
          .filter((l) => l.type === 'error' || l.type === 'exception')
          .map((l) => `[${l.type.toUpperCase()}] ${escapeHtml(l.message)}`)
          .join('\n')}</pre>
      </div>
    `
        : ''
    }

    <div>
      <label class="bug-label" for="detail-resolution-notes">Notas de solución o corrección</label>
      <textarea id="detail-resolution-notes" class="bug-textarea" rows="2" placeholder="Añade notas sobre el arreglo o commit...">${escapeHtml(report.resolutionNotes || '')}</textarea>
      <button type="button" class="btn ghost" id="btn-save-notes" style="margin-top:4px;padding:3px 10px;font-size:12px;">Guardar notas</button>
    </div>

    <div class="bug-detail-actions-bar">
      <button type="button" class="btn gold bug-copy-ai-btn" id="btn-copy-markdown">
        📋 Copiar para el Asistente IA (Markdown)
      </button>
      <div style="display:flex;gap:8px;">
        ${imgSrc ? `<button type="button" class="btn ghost" id="btn-download-img">Descargar captura</button>` : ''}
        <button type="button" class="btn ghost" id="btn-delete-report" style="color:#b33924;">Eliminar reporte</button>
      </div>
    </div>
  `;

  $('#btn-status-pending')?.addEventListener('click', () => changeReportStatus(report.id, 'pending'));
  $('#btn-status-progress')?.addEventListener('click', () => changeReportStatus(report.id, 'in_progress'));
  $('#btn-status-resolved')?.addEventListener('click', () => changeReportStatus(report.id, 'resolved'));

  $('#btn-teleport-here')?.addEventListener('click', () => {
    teleportToReport(report);
  });

  $('#btn-copy-markdown')?.addEventListener('click', () => {
    const md = formatReportToMarkdown(report);
    void navigator.clipboard.writeText(md).then(() => {
      toast('Copiado al portapapeles', 'Reporte copiado en formato Markdown para el asistente IA.');
    });
  });

  $('#btn-save-notes')?.addEventListener('click', async () => {
    const notes = ($('#detail-resolution-notes') as HTMLTextAreaElement).value.trim();
    await updateBugReportStatus(report.id, report.status, notes);
    toast('Notas guardadas', 'Se han actualizado las notas del reporte.');
    await refreshBugReviewList(report.id);
  });

  $('#btn-download-img')?.addEventListener('click', () => {
    if (!imgSrc) return;
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = `brumaluz-${report.id}.jpg`;
    a.click();
  });

  $('#btn-delete-report')?.addEventListener('click', async () => {
    if (confirm(`¿Eliminar el reporte "${report.title}"?`)) {
      await deleteBugReport(report.id);
      toast('Reporte eliminado', `Se ha eliminado el reporte.`);
      selectedReportId = null;
      await refreshBugReviewList();
    }
  });

  $('#detail-screenshot-img')?.addEventListener('click', () => {
    openLightbox(imgSrc);
  });
}

async function changeReportStatus(id: string, status: ReportStatus): Promise<void> {
  await updateBugReportStatus(id, status);
  const statusNames: Record<ReportStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    resolved: 'Resuelto',
  };
  toast('Estado actualizado', `Reporte marcado como ${statusNames[status]}.`);
  await refreshBugReviewList(id);
}

/** Teletransporta al personaje a la posición exacta de un reporte */
export function teleportToReport(report: BugReport): void {
  const pos = report.location?.position;
  if (!pos) return;

  const targetY = play.city ? play.city.groundY(pos.x, pos.z) : pos.y;
  holder.position.set(pos.x, targetY, pos.z);
  play.groundHeight = holder.position.y;
  play.lastPlatformY = null;
  playerVel.set(0, 0, 0);
  play.moveTarget = null;
  marker.visible = false;

  if (session.state) {
    session.state.position = {
      ...session.state.position,
      x: pos.x,
      z: pos.z,
      yaw: report.location?.yawDegrees ? (report.location.yawDegrees * Math.PI) / 180 : view.yaw,
    };
  }

  if (report.camera) {
    view.yaw = report.camera.yaw;
    view.pitch = report.camera.pitch;
    view.followDist = report.camera.dist;
    view.zoomTarget = report.camera.dist;
  }

  toast('Teletransporte', `Movido a [${pos.x}, ${targetY.toFixed(2)}, ${pos.z}] en ${report.location.zoneName}.`);
}

/** Abre el visor ampliado para una imagen */
export function openLightbox(src: string): void {
  const lightbox = $('#bug-lightbox');
  const img = $<HTMLImageElement>('#bug-lightbox-img');
  img.src = src;
  lightbox.hidden = false;
  lightbox.setAttribute('aria-hidden', 'false');
}

export function closeLightbox(): void {
  const lightbox = $('#bug-lightbox');
  lightbox.hidden = true;
  lightbox.setAttribute('aria-hidden', 'true');
}

/** Exporta todos los reportes a un archivo JSON */
export async function exportReportsAsJson(): Promise<void> {
  const reports = await fetchAllBugReports();
  const jsonStr = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), reports }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brumaluz-bug-reports-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exportado', `Se han exportado ${reports.length} reportes a JSON.`);
}

/** Importa reportes desde un archivo JSON */
export async function importReportsFromJson(file: File): Promise<void> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const reports: BugReport[] = Array.isArray(data) ? data : data.reports;
    if (!Array.isArray(reports)) throw new Error('Formato JSON no válido');

    for (const report of reports) {
      if (report.id && report.title) {
        await saveBugReport(report);
      }
    }
    toast('Importación completada', `Se han importado reportes con éxito.`);
    await refreshBugReviewList();
  } catch (err) {
    console.error('Error al importar reportes:', err);
    toast('Error de importación', 'El archivo no contiene un JSON de reportes válido.', true);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inicializa todos los manejadores de eventos del sistema de reportes */
export function installBugReporter(): void {
  initConsoleLogCapture();

  // Botón flotante rápido en el HUD
  $('#quick-bug-btn')?.addEventListener('click', () => {
    openBugReportModal();
  });

  // Botones en el menú de juego
  $('#game-menu-bug-report')?.addEventListener('click', () => {
    openBugReportModal();
  });
  $('#game-menu-bug-review')?.addEventListener('click', () => {
    void openBugReviewModal();
  });

  // Botones en el modal de nuevo reporte
  $('#bug-btn-cancel')?.addEventListener('click', closeBugReportModal);
  $('#bug-btn-submit')?.addEventListener('click', () => void submitBugReport());
  $('#bug-btn-view-all')?.addEventListener('click', () => void openBugReviewModal());

  // Configuración de herramientas de anotación
  document.querySelectorAll<HTMLButtonElement>('.annot-tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.annot-tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool as AnnotationTool;
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.annot-color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.annot-color-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeColor = btn.dataset.color || '#e74c3c';
    });
  });

  $('#annot-undo-btn')?.addEventListener('click', undoAnnotation);
  $('#annot-clear-btn')?.addEventListener('click', clearAnnotations);

  // Manejadores de dibujo en el lienzo de anotación
  const canvasEl = $<HTMLCanvasElement>('#bug-annotation-canvas');
  if (canvasEl) {
    const onDown = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const coords = getCanvasCoords(e);
      startX = coords.x;
      startY = coords.y;
      if (annotCtx) {
        annotCtx.strokeStyle = activeColor;
        annotCtx.lineWidth = 4;
        annotCtx.lineCap = 'round';
        annotCtx.lineJoin = 'round';
        if (activeTool === 'pen') {
          annotCtx.beginPath();
          annotCtx.moveTo(startX, startY);
        }
      }
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing || !annotCtx || !annotCanvas) return;
      const coords = getCanvasCoords(e);

      if (activeTool === 'pen') {
        annotCtx.lineTo(coords.x, coords.y);
        annotCtx.stroke();
      } else if (activeTool === 'rect' || activeTool === 'arrow') {
        // Restaurar estado anterior mientras se arrastra
        const lastState = annotationHistory[annotationHistory.length - 1];
        if (lastState) annotCtx.putImageData(lastState, 0, 0);

        annotCtx.strokeStyle = activeColor;
        annotCtx.lineWidth = 4;
        if (activeTool === 'rect') {
          annotCtx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
        } else if (activeTool === 'arrow') {
          drawArrow(annotCtx, startX, startY, coords.x, coords.y);
        }
      }
    };

    const onUp = () => {
      if (!isDrawing) return;
      isDrawing = false;
      pushAnnotationHistory();
    };

    canvasEl.addEventListener('mousedown', onDown);
    canvasEl.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    canvasEl.addEventListener('touchstart', onDown, { passive: true });
    canvasEl.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  }

  // Selector de categorías por botones chip
  document.querySelectorAll<HTMLButtonElement>('#bug-category-chips .bug-cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedCategory = chip.dataset.category as ReportCategory;
      document.querySelectorAll('#bug-category-chips .bug-cat-chip').forEach((c) => {
        const active = c === chip;
        c.classList.toggle('active', active);
        c.setAttribute('aria-checked', String(active));
      });
    });
  });

  // Botones en el modal de revisión
  $('#bug-review-close-btn')?.addEventListener('click', closeBugReviewModal);
  $('#bug-review-new-btn')?.addEventListener('click', () => {
    closeBugReviewModal();
    openBugReportModal();
  });

  // Pestañas de filtro de estado
  document.querySelectorAll<HTMLButtonElement>('.bug-filter-status .bug-status-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bug-filter-status .bug-status-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilterStatus = tab.dataset.status as 'all' | ReportStatus;
      renderReviewList();
      const filtered = getFilteredReports();
      if (filtered.length > 0) selectReviewReport(filtered[0].id);
      else renderReviewDetail(null);
    });
  });

  // Búsqueda en reportes
  $('#bug-search-input')?.addEventListener('input', (e) => {
    currentSearchQuery = (e.target as HTMLInputElement).value;
    renderReviewList();
  });

  // Exportar / Importar
  $('#bug-review-export-btn')?.addEventListener('click', () => void exportReportsAsJson());
  $('#bug-review-import-btn')?.addEventListener('click', () => {
    $<HTMLInputElement>('#bug-review-file-input')?.click();
  });
  $('#bug-review-file-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void importReportsFromJson(file);
  });

  // Lightbox
  $('#bug-lightbox')?.addEventListener('click', closeLightbox);

  // Atajos dentro del modal de reporte
  window.addEventListener('keydown', (e) => {
    const reportOpen = !$('#bug-report-backdrop').hidden;
    const reviewOpen = !$('#bug-review-backdrop').hidden;
    const lightboxOpen = !$('#bug-lightbox').hidden;

    if (lightboxOpen && e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
      return;
    }

    if (reportOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBugReportModal();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void submitBugReport();
      }
      return;
    }

    if (reviewOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBugReviewModal();
      }
    }
  });
}
