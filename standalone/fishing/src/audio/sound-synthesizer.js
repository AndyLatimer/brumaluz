/**
 * @file sound-synthesizer.js
 * Sintetizador procedimental de efectos sonoros mediante Web Audio API.
 * Proporciona audio inmersivo y dinámico sin dependencias de ficheros externos.
 */

export class FishingSoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterVolume = 0.65;
    this.lastReelClickTime = 0;
  }

  _initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Silbido dinámico de lanzamiento de caña.
   */
  playCast() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.35);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  /**
   * Salpicadura en el agua (ruido blanco filtrado con caída exponencial).
   */
  playSplash() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45 * this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  /**
   * Perturbación leve / toque de aviso antes de picar.
   */
  playNibble() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.1);

    gain.gain.setValueAtTime(0.18 * this.masterVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Alerta clara y festiva de picada ("¡PICA!").
   */
  playBiteAlert() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Doble tono brillante
    [587.33, 880.0].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.001, t + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.4 * this.masterVolume, t + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.4);
    });

    // Pequeño chapoteo simultáneo
    setTimeout(() => this.playSplash(), 60);
  }

  /**
   * Clic rítmico del carrete al recoger sedal.
   */
  playReelClick() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const now = Date.now();
    if (now - this.lastReelClickTime < 75) return; // Limitar frecuencia de clics
    this.lastReelClickTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 300, t);

    gain.gain.setValueAtTime(0.08 * this.masterVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  /**
   * Burbujeo suave cuando el pez está dentro de la zona.
   */
  playProgressTick() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.04);

    gain.gain.setValueAtTime(0.04 * this.masterVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Fanfarria acogedora al capturar con éxito (acorde mayor arpegiado).
   */
  playCatchFanfare() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);

      gain.gain.setValueAtTime(0.001, t + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.28 * this.masterVolume, t + idx * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.75);
    });
  }

  /**
   * Cadencia suave al escapar el pez.
   */
  playEscape() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [392.00, 349.23, 293.66]; // G4, F4, D4

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.14);

      gain.gain.setValueAtTime(0.22 * this.masterVolume, t + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.14);
      osc.stop(t + idx * 0.14 + 0.5);
    });
  }

  /**
   * Crujido de tensión del sedal cuando está en estrés crítico.
   */
  playCreak() {
    if (this.muted) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.08);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08 * this.masterVolume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  }
}
