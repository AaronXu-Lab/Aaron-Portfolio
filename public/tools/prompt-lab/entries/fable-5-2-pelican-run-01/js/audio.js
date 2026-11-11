// 全部音效由 WebAudio 即时合成，不加载任何音频文件
export class Sfx {
  constructor(muted) {
    this.ctx = null;
    this.muted = !!muted;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 1.5;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 风声：循环噪声 + 低通，音量跟车速
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      this.windF = ctx.createBiquadFilter();
      this.windF.type = 'lowpass';
      this.windF.frequency.value = 300;
      this.windG = ctx.createGain();
      this.windG.gain.value = 0;
      src.connect(this.windF).connect(this.windG).connect(this.master);
      src.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.03);
  }

  setWind(k) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(0.012 + k * 0.1, t, 0.15);
    this.windF.frequency.setTargetAtTime(260 + k * 900, t, 0.15);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, vol, f0, f1, q = 1, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  bell() {
    for (const d of [0, 0.16]) {
      this.tone(2093, 0.7, 'sine', 0.16, 0, d);
      this.tone(3136, 0.5, 'sine', 0.08, 0, d);
      this.tone(4186, 0.25, 'triangle', 0.03, 0, d);
    }
  }
  pickup(combo) {
    const f = 587 * Math.pow(2, Math.min(combo, 12) / 12);
    this.tone(f, 0.12, 'triangle', 0.2, 1.5);
    this.tone(f * 1.5, 0.2, 'sine', 0.13, 1, 0.07);
  }
  jump() { this.noise(0.28, 0.14, 500, 1700, 1.2); this.tone(300, 0.2, 'sine', 0.08, 1.9); }
  flap() { this.noise(0.2, 0.2, 320, 900, 0.9); this.noise(0.16, 0.1, 300, 800, 0.9, 0.11); }
  land() { this.tone(110, 0.18, 'sine', 0.26, 0.5); this.noise(0.12, 0.08, 900, 300, 0.8); }
  splash() { this.noise(0.32, 0.12, 1500, 500, 0.6); }
  bonk() { this.tone(150, 0.14, 'square', 0.09, 0.6); this.noise(0.08, 0.1, 500, 240, 1); }
  tick() { this.noise(0.022, 0.035, 3800, 3000, 5); }
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      this.tone(f, 0.38, 'triangle', 0.17, 1, i * 0.11);
      this.tone(f * 2, 0.3, 'sine', 0.05, 1, i * 0.11);
    });
  }
}
