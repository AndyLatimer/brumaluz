import { t } from './i18n';

// Composiciones originales para el dia y la noche, sin archivos externos.
export function initMenuMusic() {
  const button = document.getElementById('menu-music') as HTMLButtonElement;
  const message = document.getElementById('menu-music-message')!;
  let enabled = localStorage.getItem('brumaluz-menu-music') !== 'off';
  let unlocked = false;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let timer: number | undefined;
  let active = false;
  let generation = 0;
  let level = 0.8;
  let failed = false;
  let nextBar = 0;
  let bar = 0;
  let daytime = document.body.classList.contains('daytime');
  const voices = new Set<OscillatorNode>();
  const chords = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62]];
  const melody = [[72, 76, 79, 76], [76, 72, 69, 72], [69, 72, 76, 72], [74, 79, 76, 67]];
  const dayChords = [[48, 55, 60, 64], [53, 57, 60, 65], [43, 55, 59, 62], [48, 55, 64, 67]];
  const dayMelody = [
    [76, 79, 81, 79, 76, 74, 72, 76],
    [77, 81, 84, 81, 79, 77, 76, 72],
    [74, 79, 83, 81, 79, 76, 74, 71],
    [72, 76, 79, 84, 81, 79, 76, 72],
  ];

  function render() {
    button.textContent = t(enabled ? 'Música: activada' : 'Música: desactivada');
    button.setAttribute('aria-pressed', String(enabled));
    button.title = t(enabled ? 'Silenciar música' : 'Activar música');
    message.textContent = failed ? t('No se pudo iniciar la música. Vuelve a activarla para reintentar.') : '';
  }

  function stop() {
    generation++;
    active = false;
    window.clearInterval(timer);
    timer = undefined;
    if (master && context) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      master.disconnect();
    }
    for (const voice of voices) voice.stop();
    voices.clear();
  }

  function note(pitch: number, start: number, duration: number, volume: number, pad = false) {
    const audio = context!;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + (pad ? 0.8 : 0.035));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(master!);
    voices.add(oscillator);
    oscillator.onended = () => {
      voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function schedule() {
    if (!active || !context) return;
    // Programar por adelantado evita saltos por variaciones del temporizador.
    while (nextBar < context.currentTime + 0.5) {
      const index = bar % chords.length;
      if (daytime) {
        for (const pitch of dayChords[index]) note(pitch, nextBar, 3, 0.025, true);
        dayMelody[index].forEach((pitch, beat) => {
          const start = nextBar + beat * 0.34;
          note(pitch, start, 0.75, beat % 2 === 0 ? 0.065 : 0.045);
          note(dayChords[index][beat % 4] + 12, start + 0.17, 0.5, 0.025);
        });
        note(dayChords[index][0], nextBar, 0.9, 0.06);
        note(dayChords[index][0] + 7, nextBar + 1.36, 0.9, 0.045);
        nextBar += 2.72;
      } else {
        for (const pitch of chords[index]) note(pitch, nextBar, 5.5, 0.035, true);
        melody[index].forEach((pitch, beat) => {
          note(pitch, nextBar + beat * 1.2, 2.3, 0.065);
          note(chords[index][beat] + 12, nextBar + beat * 1.2 + 0.6, 1.8, 0.025);
        });
        nextBar += 4.8;
      }
      bar++;
    }
  }

  async function start() {
    const version = ++generation;
    active = true;
    try {
      context ??= new AudioContext();
      master ??= context.createGain();
      await context.resume();
      if (version !== generation || !active) return;
      if (context.state !== 'running') throw new Error('AudioContext is not running');
      master.gain.value = 0;
      master.connect(context.destination);
      master.gain.setTargetAtTime(0.5 * level, context.currentTime, 0.4);
      nextBar = context.currentTime + 0.05;
      bar = 0;
      schedule();
      timer = window.setInterval(schedule, 250);
    } catch (error) {
      if (version !== generation) return;
      console.error('No se pudo iniciar la música:', error);
      stop();
      enabled = false;
      failed = true;
      render();
    }
  }

  function sync() {
    const nextDaytime = document.body.classList.contains('daytime');
    if (nextDaytime !== daytime) {
      daytime = nextDaytime;
      if (active) stop();
    }
    const onMenu = document.body.matches('.auth-visible, .characters-visible')
      && !document.getElementById('account-gate')!.hidden
      && !document.body.classList.contains('playing');
    if (enabled && unlocked && onMenu && !document.hidden) {
      if (!active) void start();
    } else if (active) stop();
  }

  function unlock(event: Event) {
    if (!event.isTrusted || (event.target instanceof Node && button.contains(event.target))) return;
    unlocked = true;
    sync();
  }

  button.onclick = () => {
    enabled = !enabled;
    unlocked = true;
    failed = false;
    localStorage.setItem('brumaluz-menu-music', enabled ? 'on' : 'off');
    render();
    sync();
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('brumaluz-language-change', render);
  render();

  return {
    sync,
    setLevel(value: number) {
      level = Math.max(0, Math.min(1, value));
      if (active && context && master) master.gain.setTargetAtTime(0.5 * level, context.currentTime, 0.1);
    },
    async dispose() {
      stop();
      button.onclick = null;
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('brumaluz-language-change', render);
      if (context && context.state !== 'closed') await context.close();
    },
  };
}
