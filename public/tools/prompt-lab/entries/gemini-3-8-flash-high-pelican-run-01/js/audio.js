// Procedural Web Audio Synthesizer for Pelican Coast Cruiser
// Zero external files, 100% offline, procedural sound effects

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.windGain = null;
    this.windFilter = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.initAmbientWind();
      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext init failed', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.windGain) {
      this.windGain.gain.setValueAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime);
    }
    return this.muted;
  }

  initAmbientWind() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // pinkish noise
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = this.muted ? 0 : 0.04;

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    whiteNoise.start();
  }

  updateWind(speedRatio) {
    if (!this.ctx || !this.windFilter || !this.windGain) return;
    const t = this.ctx.currentTime;
    const targetFreq = 300 + speedRatio * 850;
    const targetGain = this.muted ? 0 : (0.02 + speedRatio * 0.09);
    this.windFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
    this.windGain.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  playBell() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const ringTone = (freq, delay, duration, gainVal) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      // Subtle harmonic overtone
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(gainVal, now + delay + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + duration);
    };

    // Realistic double chime "ding-ding!"
    // First ding
    ringTone(2093, 0.0, 0.65, 0.28);
    ringTone(3135, 0.0, 0.45, 0.12);
    ringTone(4186, 0.0, 0.25, 0.08);

    // Second crisp ding
    ringTone(2637, 0.12, 0.8, 0.32);
    ringTone(3951, 0.12, 0.55, 0.14);
    ringTone(5274, 0.12, 0.3, 0.09);
  }

  playHonk() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Comical pelican throat squawk / honk
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.3);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playGulp() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Cartoon gulp sound: low sweep up then drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.26);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playCatch() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Cheerful 3-note arpeggio chime (C6, E6, G6)
    const notes = [1046.5, 1318.5, 1567.98];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  }

  playJump() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playClick() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }
}

export const sounds = new SoundSystem();
