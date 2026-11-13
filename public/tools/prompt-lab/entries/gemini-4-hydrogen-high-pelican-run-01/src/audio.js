/**
 * Procedural Web Audio synthesizer for the Pelican Cruiser.
 * Zero external audio assets; unlocks safely on first user gesture.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this._tickAccum = 0;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this._initWind();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
    if (!this.muted) {
      this.unlock();
    }
  }

  _initWind() {
    if (!this.ctx || this.windGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.035 * white) / 1.035;
      data[i] = last * 2.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 0.9;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    src.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    src.start();
  }

  updateRide(dt, speedRatio, isCoasting, isPaused) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.windGain && this.windFilter) {
      const targetGain = isPaused ? 0 : Math.min(0.11, Math.max(0, speedRatio - 0.15) * 0.09);
      const targetFreq = 260 + speedRatio * 560;
      this.windGain.gain.setTargetAtTime(targetGain, now, 0.12);
      this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
    }

    // Subtle freewheel ratchet click while coasting at speed
    if (!isPaused && isCoasting && speedRatio > 0.25) {
      this._tickAccum += dt * (4 + speedRatio * 10);
      if (this._tickAccum >= 1) {
        this._tickAccum -= 1;
        this._playRatchetTick(0.028 * Math.min(1, speedRatio));
      }
    } else {
      this._tickAccum = 0;
    }
  }

  _playRatchetTick(vol) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.018);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.024);
  }

  playBell() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const strike = (offset) => {
      const t = now + offset;
      const partials = [
        { freq: 2093, amp: 0.24, decay: 0.45 },
        { freq: 4186, amp: 0.11, decay: 0.28 },
        { freq: 5690, amp: 0.05, decay: 0.16 },
      ];
      for (const p of partials) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(p.amp, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + p.decay + 0.02);
      }
    };
    strike(0);
    strike(0.115);
  }

  playHonk() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(215, now);
    osc.frequency.exponentialRampToValueAtTime(325, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(980, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(480, now + 0.22);
    filter.Q.value = 2.6;

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  playJump(isGlideFlap = false) {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isGlideFlap ? 320 : 210;
    const endFreq = isGlideFlap ? 490 : 410;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playFishCatch() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}
