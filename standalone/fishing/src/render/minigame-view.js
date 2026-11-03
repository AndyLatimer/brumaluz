/**
 * @file minigame-view.js
 * Renderizador de la mecánica central de captura (Fase D: Captura).
 * Representa la columna acuática, la zona de captura del jugador con filigrana,
 * el pez animado con estela y la barra vertical de progreso dorada.
 */

export class MinigameView {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.sparks = [];
    this.bubbles = [];
    this.time = 0;

    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = dpr;
  }

  /**
   * Renderiza un frame del minijuego de captura.
   * @param {number} dt
   * @param {import('../core/fish-physics').FishPhysics} fish
   * @param {import('../core/reeling-mechanics').ReelingMechanics} reel
   * @param {import('../types').FishSpecies} species
   */
  render(dt, fish, reel, species) {
    if (!this.ctx || !fish || !reel) return;
    this.time += dt;

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    // Dimensiones de la pista de captura
    const trackW = Math.min(84, w * 0.42);
    const trackH = h * 0.88;
    const trackX = (w * 0.44) - (trackW / 2);
    const trackY = (h - trackH) / 2;

    // 1. Marco exterior de madera de nogal y oro
    this._renderFrame(ctx, trackX, trackY, trackW, trackH);

    // 2. Columna de agua interior
    this._renderWaterColumn(ctx, trackX, trackY, trackW, trackH, dt);

    // 3. Zona de captura del jugador (Reel Bar)
    this._renderPlayerZone(ctx, trackX, trackY, trackW, trackH, reel, dt);

    // 4. Indicador del pez con silueta y estela
    this._renderFish(ctx, trackX, trackY, trackW, trackH, fish, species, dt);

    // 5. Barra vertical de progreso dorado (derecha)
    this._renderProgressBar(ctx, trackX + trackW + 16, trackY, 20, trackH, reel.catchProgress, reel.isFishInside, dt);

    // 6. Sedal de tensión (izquierda)
    this._renderTensionLine(ctx, trackX - 14, trackY, trackH, reel.zonePosition, reel.lineTension, reel.tensionStress);

    ctx.restore();
  }

  _renderFrame(ctx, x, y, w, h) {
    // Sombra profunda
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    // Borde de madera
    ctx.fillStyle = '#2a190e';
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Filete de oro envejecido
    ctx.strokeStyle = '#c99142';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Remaches de cobre en esquinas
    [
      [x - 1, y - 1],
      [x + w + 1, y - 1],
      [x - 1, y + h + 1],
      [x + w + 1, y + h + 1]
    ].forEach(([rx, ry]) => {
      ctx.fillStyle = '#ffe2a0';
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _renderWaterColumn(ctx, x, y, w, h, dt) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.clip();

    // Fondo degradado acuático profundo
    const waterGrad = ctx.createLinearGradient(x, y, x, y + h);
    waterGrad.addColorStop(0, '#1a3c40'); // Superficie
    waterGrad.addColorStop(0.5, '#122a2d');
    waterGrad.addColorStop(1, '#0a171a'); // Fondo profundo
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x, y, w, h);

    // Líneas de profundidad / marcas
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const my = y + (h * (i / 8));
      ctx.beginPath();
      ctx.moveTo(x + 8, my);
      ctx.lineTo(x + w - 8, my);
      ctx.stroke();
    }

    // Burbujas ascendentes
    if (Math.random() < 0.25) {
      this.bubbles.push({
        x: x + 8 + Math.random() * (w - 16),
        y: y + h - 4,
        radius: 1 + Math.random() * 2,
        speed: 30 + Math.random() * 40,
        alpha: 0.6
      });
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.speed * dt;
      b.alpha -= dt * 0.15;
      if (b.y < y || b.alpha <= 0) {
        this.bubbles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(180, 240, 255, ${b.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _renderPlayerZone(ctx, x, y, w, h, reel, dt) {
    // La posición 0.0 está en el fondo, 1.0 en la superficie
    const zoneHeight = reel.zoneSize * h;
    const centerNormY = 1.0 - reel.zonePosition; // Invertir para coordenadas canvas
    const zoneTop = y + (centerNormY * h) - (zoneHeight / 2);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, zoneTop, w - 4, zoneHeight, 8);

    // Relleno: verde esmeralda / sol si tiene al pez dentro; oro suave si está fuera
    const isInside = reel.isFishInside;
    const zoneGrad = ctx.createLinearGradient(x, zoneTop, x, zoneTop + zoneHeight);

    if (isInside) {
      zoneGrad.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
      zoneGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.35)');
      zoneGrad.addColorStop(1, 'rgba(5, 150, 105, 0.45)');
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 2.2;
    } else {
      zoneGrad.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
      zoneGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.20)');
      zoneGrad.addColorStop(1, 'rgba(217, 119, 6, 0.28)');
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
    }

    ctx.fillStyle = zoneGrad;
    ctx.fill();
    ctx.stroke();

    // Abrazaderas ornamentales de filigrana superior e inferior
    ctx.fillStyle = isInside ? '#a7f3d0' : '#ffe2a0';
    ctx.fillRect(x + 4, zoneTop, w - 8, 3);
    ctx.fillRect(x + 4, zoneTop + zoneHeight - 3, w - 8, 3);

    // Indicador de Combo de Maestría
    if (reel.comboMultiplier > 1.0) {
      ctx.save();
      ctx.font = '700 11px Cinzel, serif';
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(`x${reel.comboMultiplier.toFixed(1)} COMBO`, x + (w / 2), zoneTop - 6);
      ctx.restore();
    }

    // Chispas festivas si el pez está dentro
    if (isInside && Math.random() < 0.4) {
      this.sparks.push({
        x: x + 12 + Math.random() * (w - 24),
        y: zoneTop + Math.random() * zoneHeight,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        alpha: 1.0,
        radius: 1.2 + Math.random() * 2
      });
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.alpha -= dt * 2.5;
      if (s.alpha <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 240, 160, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _renderFish(ctx, x, y, w, h, fish, species, dt) {
    const centerNormY = 1.0 - fish.position; // 0.0 abajo, 1.0 arriba
    const fishX = x + (w / 2);
    const fishY = y + (centerNormY * h);

    ctx.save();
    ctx.translate(fishX, fishY);

    // Inclinación según velocidad y dirección de nado
    const angle = (fish.facingDirection === 1 ? -0.22 : 0.22) + (fish.velocity * 0.15);
    ctx.rotate(angle);

    // Aleteo / vibración de nado
    const waggle = Math.sin(this.time * 16) * 2.5;

    // Silueta de pez estilizada
    const pCol = species.primaryColor || '#38bdf8';
    const aCol = species.accentColor || '#e0f2fe';

    // Aleta dorsal
    ctx.fillStyle = aCol;
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(1, -13 + (waggle * 0.4));
    ctx.lineTo(7, -7);
    ctx.closePath();
    ctx.fill();

    // Aleta pectoral
    ctx.fillStyle = aCol;
    ctx.beginPath();
    ctx.moveTo(-1, 3);
    ctx.lineTo(-5, 10 + (waggle * 0.5));
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();

    // Cola
    ctx.fillStyle = aCol;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-24, -7 + waggle);
    ctx.lineTo(-21, 0);
    ctx.lineTo(-24, 7 + waggle);
    ctx.closePath();
    ctx.fill();

    // Cuerpo
    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borde brillante
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Ojo con pupila animada
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(9, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(9.8, -2, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderProgressBar(ctx, x, y, w, h, progress, isInside, dt) {
    // Tubo / recipiente exterior
    ctx.save();
    ctx.fillStyle = '#2a190e';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 10);
    ctx.fill();

    ctx.strokeStyle = '#c99142';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Fondo oscuro del tubo
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.clip();

    // Nivel de líquido dorado que sube desde la base
    const fillH = Math.max(0, Math.min(1.0, progress)) * h;
    const fillY = y + h - fillH;

    const fillGrad = ctx.createLinearGradient(x, fillY, x, y + h);
    if (isInside) {
      fillGrad.addColorStop(0, '#fef08a');
      fillGrad.addColorStop(0.3, '#f59e0b');
      fillGrad.addColorStop(1, '#b45309');
    } else {
      fillGrad.addColorStop(0, '#fcd34d');
      fillGrad.addColorStop(1, '#92400e');
    }

    ctx.fillStyle = fillGrad;
    ctx.fillRect(x, fillY, w, fillH);

    // Ondulación en la superficie del líquido
    if (fillH > 4) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x + (w / 2), fillY, w / 2, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Reflejo de cristal vertical
    const glassGrad = ctx.createLinearGradient(x, y, x + w, y);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    glassGrad.addColorStop(0.35, 'transparent');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(x, y, w, h);

    ctx.restore();

    // Etiqueta de porcentaje bajo la barra
    ctx.save();
    ctx.font = '700 11px Cinzel, serif';
    ctx.fillStyle = '#ffe2a0';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(progress * 100)}%`, x + (w / 2), y + h + 16);
    ctx.restore();
  }

  _renderTensionLine(ctx, x, y, h, zonePos, tension, stress = 0) {
    ctx.save();
    const isStress = stress > 0.45 || tension > 0.85;
    ctx.strokeStyle = isStress ? '#ef4444' : (tension > 0.7 ? '#f59e0b' : 'rgba(255, 226, 160, 0.65)');
    ctx.lineWidth = isStress ? 2.4 : 1.6;

    // Vibración ligera según tensión y estrés de línea
    const jitter = isStress ? (Math.random() - 0.5) * 3.8 : (tension > 0.7 ? (Math.random() - 0.5) * 1.5 : 0);

    const reelY = y + ((1.0 - zonePos) * h);

    ctx.beginPath();
    ctx.moveTo(x + jitter, y);
    ctx.lineTo(x + jitter, reelY);
    ctx.stroke();

    // Anilla o carrete en la posición
    ctx.fillStyle = isStress ? '#ef4444' : '#c99142';
    ctx.beginPath();
    ctx.arc(x + jitter, reelY, isStress ? 4.2 : 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
