export class AmbientSoundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private birdsTimer: number | undefined;
  private bellTimer: number | undefined;
  private active = false;
  private level = 1;
  private generation = 0;
  private connected = false;
  private hour=12;
  private indoors=false;
  setWorldTime(hour:number,indoors=false){this.hour=Number.isFinite(hour)?((hour%24)+24)%24:12;this.indoors=indoors;}

  get enabled() {
    return this.active;
  }

  // Volumen relativo (0-1) del paisaje sonoro: ambiente × volumen general.
  setLevel(level: number) {
    this.level = Math.max(0, Math.min(1, level));
    if (this.active && this.context && this.master) this.master.gain.setTargetAtTime(0.72 * this.level, this.context.currentTime, 0.1);
  }

  async prepare() {
    if (!this.context) this.createSoundscape();
    await this.context!.resume();
  }

  async setEnabled(enabled: boolean) {
    const generation = ++this.generation;
    this.active = enabled;
    window.clearTimeout(this.birdsTimer);
    window.clearTimeout(this.bellTimer);
    this.birdsTimer = undefined;
    this.bellTimer = undefined;
    if (!enabled) {
      if (this.master && this.context) {
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setValueAtTime(0, this.context.currentTime);
        if (this.connected) this.master.disconnect(this.context.destination);
        this.connected = false;
      }
      return;
    }
    if (!this.context) this.createSoundscape();
    await this.context!.resume();
    if (generation !== this.generation || !this.active) return;
    if (this.context!.state !== 'running') throw new Error('No se pudo iniciar el sonido ambiental.');
    if (!this.connected) {
      this.master!.connect(this.context!.destination);
      this.connected = true;
    }
    this.master!.gain.cancelAndHoldAtTime(this.context!.currentTime);
    this.master!.gain.setTargetAtTime(0.72 * this.level, this.context!.currentTime, 0.15);
    this.scheduleBirds();
  }

  async dispose() {
    await this.setEnabled(false);
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }

  private createSoundscape() {
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;

    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const noise = buffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;

    const wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const windGain = context.createGain();
    windGain.gain.value = 0.1;
    wind.connect(windFilter).connect(windGain).connect(this.master);
    wind.start();

    const breeze = context.createOscillator();
    const breezeDepth = context.createGain();
    breeze.frequency.value = 0.07;
    breezeDepth.gain.value = 0.045;
    breeze.connect(breezeDepth).connect(windGain.gain);
    breeze.start();

    const stream = context.createBufferSource();
    stream.buffer = buffer;
    stream.loop = true;
    const streamFilter = context.createBiquadFilter();
    streamFilter.type = 'bandpass';
    streamFilter.frequency.value = 560;
    streamFilter.Q.value = 0.45;
    const streamGain = context.createGain();
    streamGain.gain.value = 0.045;
    stream.connect(streamFilter).connect(streamGain).connect(this.master);
    stream.start();

    const town = context.createBufferSource();
    town.buffer = buffer;
    town.loop = true;
    const townFilter = context.createBiquadFilter();
    townFilter.type = 'bandpass';
    townFilter.frequency.value = 330;
    townFilter.Q.value = 0.8;
    const townGain = context.createGain();
    townGain.gain.value = 0.018;
    const townPan = context.createStereoPanner();
    townPan.pan.value = -0.35;
    town.connect(townFilter).connect(townGain).connect(townPan).connect(this.master);
    town.start();
    const murmur = context.createOscillator();
    const murmurDepth = context.createGain();
    murmur.frequency.value = 0.18;
    murmurDepth.gain.value = 0.01;
    murmur.connect(murmurDepth).connect(townGain.gain);
    murmur.start();
  }

  private scheduleBirds() {
    if (!this.active || !this.context) return;
    this.birdsTimer = window.setTimeout(() => {
      if(!this.indoors&&this.hour>=5&&this.hour<20.5)this.chirp();
      this.scheduleBirds();
    }, 2200 + Math.random() * 5200);
    if (this.bellTimer === undefined) this.scheduleBell();
  }

  private scheduleBell() {
    if (!this.active || !this.context) return;
    this.bellTimer = window.setTimeout(() => {
      this.bellTimer = undefined;
      this.ringBell();
      this.scheduleBell();
    }, 26_000 + Math.random() * 30_000);
  }

  private ringBell() {
    if (!this.context || !this.master||this.indoors) return;
    const context = this.context;
    const night=this.hour<5||this.hour>=21;
    const count = !night&&Math.random() < 0.3 ? 2 : 1;
    for (let strike = 0; strike < count; strike++) {
      const start = context.currentTime + strike * 1.4;
      const fundamental = [220,293.6648,440][Math.floor(Math.random()*3)];
      for (const [partial, amplitude] of [[1, 0.055], [2.76, 0.022], [5.4, 0.01]]) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = fundamental * partial;
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(amplitude*(night?.4:1), start + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 2.8 / partial);
        oscillator.connect(envelope).connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + 3);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
        };
      }
    }
  }

  private chirp() {
    const context = this.context!;
    const now = context.currentTime;
    const chirps = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < chirps; i++) {
      const start = now + i * (0.13 + Math.random() * 0.1);
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const pan = context.createStereoPanner();
      const pitch = 1900 + Math.random() * 1100;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(pitch * (0.7 + Math.random() * 0.6), start + 0.12);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.11, start + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      pan.pan.value = Math.random() * 1.4 - 0.7;
      oscillator.connect(envelope).connect(pan).connect(this.master!);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        pan.disconnect();
      };
    }
  }
}
