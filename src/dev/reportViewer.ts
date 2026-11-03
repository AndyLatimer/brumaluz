import type { BugReport, ReportCategory, ReportStatus } from './bugReportTypes';
import {
  fetchAllBugReports,
  updateBugReportStatus,
  deleteBugReport,
  saveBugReport,
  formatReportToMarkdown,
} from './bugReportStorage';

let reports: BugReport[] = [];
let selectedId: string | null = null;
let currentStatusFilter: 'all' | ReportStatus = 'all';
let currentCategoryFilter: 'all' | ReportCategory = 'all';
let currentSearch = '';

const statusEl = document.getElementById('status')!;
const listEl = document.getElementById('reports-list')!;
const detailEl = document.getElementById('report-detail-view')!;
const assistantEl = document.getElementById('assistant-tools-view')!;
const totalBadge = document.getElementById('reports-total-badge')!;

async function init() {
  statusEl.textContent = 'Cargando reportes desde el servidor…';
  try {
    reports = await fetchAllBugReports();
    statusEl.textContent = `Catálogo listo: ${reports.length} reportes cargados.`;
    renderCounts();
    renderList();
    if (reports.length > 0) {
      selectReport(reports[0].id);
    }
  } catch (err) {
    statusEl.textContent = 'Error al cargar reportes: ' + (err instanceof Error ? err.message : String(err));
  }

  setupEventListeners();
}

function renderCounts() {
  const total = reports.length;
  const pending = reports.filter((r) => r.status === 'pending').length;
  const inProgress = reports.filter((r) => r.status === 'in_progress').length;
  const resolved = reports.filter((r) => r.status === 'resolved').length;

  totalBadge.textContent = String(total);
  document.getElementById('count-all')!.textContent = String(total);
  document.getElementById('count-pending')!.textContent = String(pending);
  document.getElementById('count-progress')!.textContent = String(inProgress);
  document.getElementById('count-resolved')!.textContent = String(resolved);
}

function getFilteredList(): BugReport[] {
  return reports.filter((r) => {
    if (currentStatusFilter !== 'all' && r.status !== currentStatusFilter) return false;
    if (currentCategoryFilter !== 'all' && r.category !== currentCategoryFilter) return false;
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase();
      const match =
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.location?.zoneName?.toLowerCase().includes(q) ||
        r.character?.name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

function renderList() {
  const filtered = getFilteredList();
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="placeholder-msg"><p>No hay reportes con los filtros seleccionados.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((r) => {
      const isSelected = r.id === selectedId;
      const imgSrc = r.screenshot || r.screenshotUrl || '';
      return `
      <div class="report-card ${isSelected ? 'selected' : ''}" data-id="${r.id}" role="button" tabindex="0">
        <div class="report-card-thumb">
          ${imgSrc ? `<img src="${imgSrc}" alt="" loading="lazy">` : ''}
        </div>
        <div class="report-card-info">
          <h3 class="report-card-title">${escapeHtml(r.title)}</h3>
          <div class="report-card-meta">
            <span class="badge-status ${r.status}">${r.status === 'resolved' ? 'Resuelto' : r.status === 'in_progress' ? 'En curso' : 'Pendiente'}</span>
            <span>📍 ${r.location?.zoneName || 'Mundo'}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  listEl.querySelectorAll<HTMLElement>('.report-card').forEach((card) => {
    card.onclick = () => selectReport(card.dataset.id!);
  });
}

function selectReport(id: string) {
  selectedId = id;
  listEl.querySelectorAll('.report-card').forEach((c) => {
    c.classList.toggle('selected', (c as HTMLElement).dataset.id === id);
  });

  const report = reports.find((r) => r.id === id);
  if (!report) {
    renderDetail(null);
    renderAssistant(null);
    return;
  }

  renderDetail(report);
  renderAssistant(report);
}

function renderDetail(report: BugReport | null) {
  if (!report) {
    detailEl.innerHTML = `<div class="placeholder-msg"><p>Selecciona un reporte de la lista.</p></div>`;
    return;
  }

  const imgSrc = report.screenshot || report.screenshotUrl || '';
  const pos = report.location?.position;
  const rs = report.system?.renderStats;

  detailEl.innerHTML = `
    <div class="detail-header-row">
      <div>
        <span class="eyebrow">${report.category.toUpperCase()} · SEVERIDAD ${report.severity.toUpperCase()}</span>
        <h2 class="detail-title">${escapeHtml(report.title)}</h2>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">
          ${report.dateFormatted} · ID: <code>${report.id}</code>
        </div>
      </div>
      <span class="badge-status ${report.status}">${report.status === 'resolved' ? 'Resuelto' : report.status === 'in_progress' ? 'En progreso' : 'Pendiente'}</span>
    </div>

    ${
      imgSrc
        ? `
      <div class="detail-screenshot-wrap" id="detail-img-wrap" title="Clic para ampliar captura">
        <img id="detail-img" src="${imgSrc}" alt="Captura de pantalla del reporte">
      </div>
    `
        : ''
    }

    <div>
      <span class="eyebrow" style="margin-bottom:6px;">Descripción del problema</span>
      <div class="detail-desc-box">${escapeHtml(report.description || '(Sin descripción)')}</div>
    </div>

    <div class="detail-grid-metrics">
      <div class="metric-card">
        <strong>Ubicación</strong>
        <div>Zona: ${report.location?.zoneName || 'Mundo'} (<code>${report.location?.zone || '-'}</code>)</div>
        <div>Coords: <code>${pos ? `${pos.x}, ${pos.y}, ${pos.z}` : '-'}</code></div>
        <div>Giro: ${report.location?.yawDegrees ?? 0}°</div>
      </div>

      <div class="metric-card">
        <strong>Personaje</strong>
        <div>Nombre: ${report.character?.name || 'Aventurero'}</div>
        <div>Clase / Raza: ${report.character?.cls || '-'} · ${report.character?.race || '-'}</div>
        <div>Salud: ${report.character?.health ?? '-'} / ${report.character?.maxHealth ?? '-'}</div>
      </div>

      <div class="metric-card">
        <strong>Cámara y Pantalla</strong>
        <div>Yaw ${report.camera?.yaw ?? '-'}, Pitch ${report.camera?.pitch ?? '-'}</div>
        <div>Distancia: ${report.camera?.dist ?? '-'}</div>
        <div>Resolución: ${report.system?.viewport?.width ?? 0}x${report.system?.viewport?.height ?? 0} (DPR: ${report.system?.pixelRatio ?? 1})</div>
      </div>

      ${
        rs
          ? `
        <div class="metric-card">
          <strong>Rendimiento 3D</strong>
          <div>Llamadas de dibujado: ${rs.drawCalls}</div>
          <div>Triángulos: ${rs.triangles.toLocaleString()}</div>
          <div>Geometrías / Texturas: ${rs.geometries} / ${rs.textures}</div>
        </div>
      `
          : ''
      }
    </div>
  `;

  document.getElementById('detail-img')?.addEventListener('click', () => {
    if (imgSrc) openLightbox(imgSrc);
  });
}

function renderAssistant(report: BugReport | null) {
  if (!report) {
    assistantEl.innerHTML = `<div class="placeholder-msg"><p>Sin reporte seleccionado.</p></div>`;
    return;
  }

  const pos = report.location?.position;
  const teleportCmd = `window.brumaluz.move(${pos?.x ?? 0}, ${pos?.z ?? 0});`;

  assistantEl.innerHTML = `
    <div>
      <span class="eyebrow" style="margin-bottom:6px;">Estado del reporte</span>
      <div class="quick-filter-pills">
        <button type="button" class="filter-chip-btn ${report.status === 'pending' ? 'active' : ''}" id="asst-btn-pending">Pendiente</button>
        <button type="button" class="filter-chip-btn ${report.status === 'in_progress' ? 'active' : ''}" id="asst-btn-progress">En curso</button>
        <button type="button" class="filter-chip-btn ${report.status === 'resolved' ? 'active' : ''}" id="asst-btn-resolved">Resuelto</button>
      </div>
    </div>

    <div>
      <span class="eyebrow" style="margin-bottom:6px;">Notas del desarrollador</span>
      <textarea id="asst-notes-input" class="notes-textarea" placeholder="Escribe el commit, archivo o solución implementada...">${escapeHtml(report.resolutionNotes || '')}</textarea>
      <button type="button" class="btn-secondary" id="asst-save-notes-btn" style="margin-top:6px;width:100%;">Guardar notas</button>
    </div>

    <div>
      <span class="eyebrow" style="margin-bottom:6px;">Asistente IA (Antigravity)</span>
      <button type="button" class="btn-action-wide" id="asst-copy-prompt-btn">
        📋 Copiar Prompt para Antigravity
      </button>
    </div>

    <div>
      <span class="eyebrow" style="margin-bottom:6px;">Comando de Teletransporte</span>
      <div class="code-snippet-box" id="asst-teleport-snippet" title="Clic para copiar">${teleportCmd}</div>
    </div>

    <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
      <div class="btn-row">
        <button type="button" class="btn-secondary" id="asst-download-btn">Descargar captura</button>
        <button type="button" class="btn-secondary" id="asst-delete-btn" style="color:var(--accent-red);">Eliminar</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn-secondary" id="asst-export-btn">Exportar JSON</button>
        <button type="button" class="btn-secondary" id="asst-import-btn">Importar JSON</button>
      </div>
    </div>
  `;

  document.getElementById('asst-btn-pending')?.addEventListener('click', () => updateStatus(report.id, 'pending'));
  document.getElementById('asst-btn-progress')?.addEventListener('click', () => updateStatus(report.id, 'in_progress'));
  document.getElementById('asst-btn-resolved')?.addEventListener('click', () => updateStatus(report.id, 'resolved'));

  document.getElementById('asst-save-notes-btn')?.addEventListener('click', async () => {
    const notes = (document.getElementById('asst-notes-input') as HTMLTextAreaElement).value.trim();
    await updateBugReportStatus(report.id, report.status, notes);
    report.resolutionNotes = notes;
    statusEl.textContent = `Notas actualizadas para ${report.id}.`;
  });

  document.getElementById('asst-copy-prompt-btn')?.addEventListener('click', () => {
    const md = formatReportToMarkdown(report);
    void navigator.clipboard.writeText(md).then(() => {
      statusEl.textContent = '¡Prompt de reporte copiado al portapapeles! Listo para pegar en el chat del asistente.';
    });
  });

  document.getElementById('asst-teleport-snippet')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(teleportCmd).then(() => {
      statusEl.textContent = 'Comando copiado al portapapeles.';
    });
  });

  document.getElementById('asst-download-btn')?.addEventListener('click', () => {
    const src = report.screenshot || report.screenshotUrl;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `brumaluz-${report.id}.jpg`;
    a.click();
  });

  document.getElementById('asst-delete-btn')?.addEventListener('click', async () => {
    if (confirm(`¿Eliminar el reporte "${report.title}"?`)) {
      await deleteBugReport(report.id);
      reports = reports.filter((r) => r.id !== report.id);
      renderCounts();
      renderList();
      selectedId = null;
      renderDetail(null);
      renderAssistant(null);
      statusEl.textContent = 'Reporte eliminado.';
    }
  });

  document.getElementById('asst-export-btn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, reports }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brumaluz-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('asst-import-btn')?.addEventListener('click', () => {
    document.getElementById('import-json-input')?.click();
  });
}

async function updateStatus(id: string, status: ReportStatus) {
  await updateBugReportStatus(id, status);
  const rep = reports.find((r) => r.id === id);
  if (rep) rep.status = status;
  renderCounts();
  renderList();
  if (selectedId === id && rep) {
    renderDetail(rep);
    renderAssistant(rep);
  }
  statusEl.textContent = `Estado actualizado a "${status}".`;
}

function openLightbox(src: string) {
  const box = document.getElementById('report-lightbox')!;
  const img = document.getElementById('lightbox-img')! as HTMLImageElement;
  img.src = src;
  box.hidden = false;
}

function closeLightbox() {
  document.getElementById('report-lightbox')!.hidden = true;
}

function setupEventListeners() {
  // Píldoras de filtro por estado
  document.querySelectorAll<HTMLButtonElement>('#status-filter-pills .filter-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#status-filter-pills .filter-chip-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status as 'all' | ReportStatus;
      renderList();
    });
  });

  // Filtro por categoría
  document.getElementById('category-filter-select')?.addEventListener('change', (e) => {
    currentCategoryFilter = (e.target as HTMLSelectElement).value as 'all' | ReportCategory;
    renderList();
  });

  // Buscador
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    currentSearch = (e.target as HTMLInputElement).value;
    renderList();
  });

  // Importar JSON
  document.getElementById('import-json-input')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: BugReport[] = Array.isArray(parsed) ? parsed : parsed.reports;
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.id && item.title) {
            await saveBugReport(item);
          }
        }
        reports = await fetchAllBugReports();
        renderCounts();
        renderList();
        statusEl.textContent = 'Importación de reportes completada.';
      }
    } catch (err) {
      statusEl.textContent = 'Error al importar: ' + String(err);
    }
  });

  // Lightbox
  document.getElementById('report-lightbox')?.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

init();
