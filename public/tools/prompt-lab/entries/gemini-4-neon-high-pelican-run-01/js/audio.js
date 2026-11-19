/**
 * Procedural coastal soundscape & tactile Foley via Web Audio API.
 * Zero external audio assets; unlocks lazily on the first user gesture.
 */
export class CoastalAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.breezeGain = null;
    this.breezeFilter = null;
    this.surfGain = null;
    this.muted = false;
    this.started = false;
    this._tickAccum = 0;
  }

  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);

      // Shared white/pink-ish noise buffer (2s loop)
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029;
        b1 = 0.985 * b1 + w * 0.032;
        b2 = 0.950 * b2 + w * 0.048;
        data[i] = (b0 + b1 + b2 + w * 0.02) * 1.4;
      }

      // Gentle ocean surf bed
      const surfSrc = this.ctx.createBufferSource();
      surfSrc.buffer = buf;
      surfSrc.loop = true;
      const surfFilter = this.ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 340;
      this.surfGain = this.ctx.createGain();
      this.surfGain.gain.value = 0.14;
      surfSrc.connect(surfFilter).connect(this.surfGain).connect(this.master);
      surfSrc.start();

      // Speed-reactive wind breeze
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      this.breezeFilter = this.ctx.createBiquadFilter();
      this.breezeFilter.type = 'bandpass';
      this.breezeFilter.frequency.value = 520;
      this.breezeFilter.Q.value = 0.9;
      this.breezeGain = this.ctx.createGain();
      this.breezeGain.gain.value = 0.02;
      windSrc.connect(this.breezeFilter).connect(this.breezeGain).connect(this.master);
      windSrc.start();

      this.started = true;
    } catch {
      // Audio unavailable
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute() {
    this.unlock();
    this.setMuted(!this.muted);
    return this.muted;
  }

  updateAmbient(time, speed, isCoasting, isAirborne, dt) {
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const speedNorm = Math.min(1, Math.max(0, speed / 20));

    // Gentle rhythmic ocean surf swell
    const surfWave = 0.11 + 0.055 * Math.sin(time * 0.55);
    this.surfGain.gain.setTargetAtTime(surfWave, now, 0.12);

    // Wind rush proportional to speed + extra lift when gliding
    const windLevel = 0.015 + speedNorm * 0.12 + (isAirborne ? 0.06 : 0);
    this.breezeGain.gain.setTargetAtTime(windLevel, now, 0.08);
    this.breezeFilter.frequency.setTargetAtTime(
      420 + speedNorm * 820 + (isAirborne ? 320 : 0),
      now,
      0.08
    );

    // Subtle vintage bicycle freewheel ratchet clicks when coasting
    if (isCoasting && !isAirborne && speed > 2.2) {
      this._tickAccum += dt * (speed * 2.4);
      if (this._tickAccum >= 1) {
        this._tickAccum -= 1;
        this._playFreewheelTick();
      }
    }
  }

  _playFreewheelTick() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1650 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.012);
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.018);
  }

  playBell() {
    this.unlock();
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Double vintage brass bell chime ("Ding-Ding!")
    [0, 0.115].forEach((offset, idx) => {
      const t = now + offset;
      const baseFreq = idx === 0 ? 1568 : 1760;
      const partials = [
        { mult: 1.0, amp: 0.24, decay: 0.72 },
        { mult: 2.02, amp: 0.11, decay: 0.42 },
        { mult: 3.16, amp: 0.06, decay: 0.25 },
      ];
      partials.forEach((p) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * p.mult, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(p.amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + p.decay + 0.02);
      });
    });
  }

  playHonk() {
    this.unlock();
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime + 0.06;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(345, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(205, now + 0.25);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(760, now);
    filter.frequency.linearRampToValueAtTime(1180, now + 0.1);
    filter.frequency.linearRampToValueAtTime(620, now + 0.25);
    filter.Q.value = 3.2;

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(filter).connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  playHop() {
    this.unlock();
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(490, now + 0.14);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playCatch(combo = 1) {
    this.unlock();
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const root = pentatonic[Math.min(pentatonic.length - 1, (combo - 1) % pentatonic.length)];
    [root, root * 1.5].forEach((freq, i) => {
      const t = now + i * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }
}
