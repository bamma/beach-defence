// All sounds are synthesised with WebAudio, no audio files needed.
export class GameAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(comp);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Surf ambience
    const surf = ctx.createBufferSource();
    surf.buffer = this.noiseBuf;
    surf.loop = true;
    const surfF = ctx.createBiquadFilter();
    surfF.type = 'lowpass';
    surfF.frequency.value = 450;
    const surfG = ctx.createGain();
    surfG.gain.value = 0.1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.07;
    lfo.connect(lfoG).connect(surfG.gain);
    surf.connect(surfF).connect(surfG).connect(this.master);
    surf.start();
    lfo.start();

    // Outboard motor drone
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const engF = ctx.createBiquadFilter();
    engF.type = 'lowpass';
    engF.frequency.value = 260;
    for (const f of [46, 49.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(engF);
      o.start();
    }
    engF.connect(this.engineGain).connect(this.master);
  }

  noise(duration, type, freq, vol, { q = 0.7, rate = 1, attack = 0.002 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + duration + 0.05);
  }

  tone(type, f0, f1, duration, vol, attack = 0.005) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  gunshot() {
    if (!this.ctx) return;
    this.noise(0.16, 'lowpass', 2200, 0.8, { rate: 0.8 + Math.random() * 0.3 });
    this.noise(0.05, 'highpass', 3500, 0.25);
    this.tone('sine', 130, 42, 0.12, 0.9);
  }

  thud() {
    if (!this.ctx) return;
    this.noise(0.08, 'lowpass', 600, 0.25);
  }

  bigSplash() {
    if (!this.ctx) return;
    this.noise(1.2, 'lowpass', 900, 0.7, { attack: 0.02, rate: 0.6 });
    this.tone('sine', 90, 30, 0.6, 0.6);
  }

  overheat() {
    if (!this.ctx) return;
    this.noise(1.0, 'highpass', 5000, 0.2, { attack: 0.05 });
    this.tone('square', 900, 700, 0.15, 0.08);
  }

  breach() {
    if (!this.ctx) return;
    this.tone('square', 520, 510, 0.18, 0.12);
    setTimeout(() => this.tone('square', 390, 380, 0.25, 0.12), 180);
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.15);
    g.gain.setValueAtTime(0.18, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    for (const fr of [110, 165.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.connect(f);
      o.start(t);
      o.stop(t + 1.7);
    }
    f.connect(g).connect(this.master);
  }

  setEngine(level) {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(Math.min(1, level) * 0.12, this.ctx.currentTime, 0.3);
  }

  suspend() {
    this.ctx?.suspend();
  }
}
