/**
 * @file canvas-water.js
 * Renderizado de ambiente acuático procedural: ondas, reflejos, faroles,
 * partículas flotantes, flotador y anillos de perturbación.
 */

export class CanvasWaterRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.ripples = [];
    this.particles = [];
    this.bobber = {
      x: 0.5,
      y: 0.55,
      baseY: 0.55,
      tilt: 0,
      dipOffset: 0,
      visible: false
    };

    this.time = 0;
    this._initParticles();
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

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < 28; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        radius: 1 + Math.random() * 2.5,
        speedX: (Math.random() - 0.5) * 0.015,
        speedY: -0.01 - Math.random() * 0.02,
        alpha: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  addRipple(normalizedX, normalizedY, strength = 1.0) {
    this.ripples.push({
      x: normalizedX,
      y: normalizedY,
      radius: 4,
      maxRadius: 36 * strength,
      alpha: 0.9 * strength,
      speed: 42 * strength
    });
  }

  setBobberVisible(visible) {
    this.bobber.visible = visible;
  }

  dipBobber(amount = 12) {
    this.bobber.dipOffset = amount;
    this.addRipple(this.bobber.x, this.bobber.y, 1.2);
  }

  /**
   * @param {number} dt (segundos)
   * @param {import('../types').FishingPhase} currentPhase
   */
  render(dt, currentPhase) {
    if (!this.ctx) return;
    this.time += dt;

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // 1. Fondo atmosférico (gradiente río al atardecer en Brumaluz)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#102226'); // Aguas profundas / noche brumosa
    bgGrad.addColorStop(0.45, '#16353d');
    bgGrad.addColorStop(1, '#0c1a1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Ondas y reflejo de faroles de cobre
    this._renderWaterWaves(ctx, w, h);
    this._renderLanternReflections(ctx, w, h);

    // 3. Partículas flotantes (bruma / polen / pequeñas motas)
    this._renderParticles(ctx, w, h, dt);

    // 4. Anillos de agua (ripples)
    this._renderRipples(ctx, w, h, dt);

    // 5. Flotador
    if (this.bobber.visible && ['WAITING', 'HOOKING'].includes(currentPhase)) {
      this._renderBobber(ctx, w, h, dt);
    }

    ctx.restore();
  }

  _renderWaterWaves(ctx, w, h) {
    ctx.strokeStyle = 'rgba(125, 211, 230, 0.08)';
    ctx.lineWidth = 1.5;

    for (let layer = 0; layer < 5; layer++) {
      const yBase = h * (0.35 + layer * 0.14);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 15) {
        const wave = Math.sin((x * 0.012) + (this.time * 1.8) + (layer * 1.2)) * (4 + layer * 1.5);
        if (x === 0) ctx.moveTo(x, yBase + wave);
        else ctx.lineTo(x, yBase + wave);
      }
      ctx.stroke();
    }
  }

  _renderLanternReflections(ctx, w, h) {
    // Reflejo cálido de farol en el muelle
    const lanternX = w * 0.35;
    const glowGrad = ctx.createRadialGradient(lanternX, h * 0.35, 10, lanternX, h * 0.65, w * 0.45);
    glowGrad.addColorStop(0, 'rgba(255, 217, 120, 0.12)');
    glowGrad.addColorStop(0.5, 'rgba(212, 136, 52, 0.05)');
    glowGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }

  _renderParticles(ctx, w, h, dt) {
    for (const p of this.particles) {
      p.x += p.speedX * dt;
      p.y += p.speedY * dt;
      if (p.y < 0) p.y = 1;
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;

      const px = p.x * w;
      const py = p.y * h;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 2 + p.phase);

      ctx.fillStyle = `rgba(227, 246, 255, ${p.alpha * pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _renderRipples(ctx, w, h, dt) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed * dt;
      r.alpha -= dt * 0.65;

      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
        continue;
      }

      const rx = r.x * w;
      const ry = r.y * h;

      ctx.strokeStyle = `rgba(180, 235, 245, ${r.alpha * 0.7})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(rx, ry, r.radius * 1.6, r.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _renderBobber(ctx, w, h, dt) {
    // Oscilación suave con el agua
    const bob = Math.sin(this.time * 2.5) * 3;
    const dip = this.bobber.dipOffset;
    if (this.bobber.dipOffset > 0) {
      this.bobber.dipOffset = Math.max(0, this.bobber.dipOffset - dt * 35);
    }

    const bx = this.bobber.x * w;
    const by = (this.bobber.baseY * h) + bob + dip;

    // Sombra del flotador bajo el agua
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(bx, by + 10, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo del flotador (estilo artesanal madera roja y crema)
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(this.time * 2) * 0.12);

    // Mástil / punta
    ctx.strokeStyle = '#ffe2a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -6);
    ctx.stroke();

    // Mitad superior roja / naranja
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(0, -4, 9, Math.PI, 0);
    ctx.fill();

    // Mitad inferior blanca / crema
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(0, -4, 9, 0, Math.PI);
    ctx.fill();

    // Ribete de latón
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -4, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
