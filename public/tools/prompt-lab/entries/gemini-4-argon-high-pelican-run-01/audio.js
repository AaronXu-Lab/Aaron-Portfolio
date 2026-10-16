// Pure WebAudio procedural sound effects for Pelbay Courier
// Zero external assets required; works 100% offline.

export class SoundEngine {
  constructor(storageKey = 'gemini-4-argon-high-pelican-run-01:muted') {
    this.storageKey = storageKey;
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(this.storageKey) === '1';
    } catch {
      this.muted = false;
    }
    this.lastClickTime = 0;
  }

  ensureContext() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      localStorage.setItem(this.storageKey, this.muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    return this.muted;
  }

  toggleMute() {
    const next = !this.muted;
    this.setMuted(next);
    if (!next) {
      this.ensureContext();
      this.playBell();
    }
    return this.muted;
  }

  // Crisp double-strike brass bicycle bell ("ding-ding!")
  playBell() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const strikes = [0, 0.11];
    const partials = [
      { freq: 1567.98, amp: 0.22, decay: 0.85 }, // G6
      { freq: 3135.96, amp: 0.12, decay: 0.55 }, // G7
      { freq: 4210.0, amp: 0.08, decay: 0.35 },  // Metallic inharmonic partial
      { freq: 2349.32, amp: 0.09, decay: 0.65 }  // D7
    ];

    for (const offset of strikes) {
      const t0 = now + offset;
      for (const p of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, t0);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(p.amp, t0 + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.02);
      }
    }
  }

  // Beak snap + bouncy pouch gulp when catching fish or snapping beak
  playBeakSnap(caughtFish = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Wooden clack of giant pelican bill
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.075);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    if (caughtFish) {
      // Joyful water/pouch bloop + ascending chime
      const bloop = ctx.createOscillator();
      const bloopGain = ctx.createGain();
      bloop.type = 'sine';
      bloop.frequency.setValueAtTime(280, now + 0.05);
      bloop.frequency.exponentialRampToValueAtTime(660, now + 0.19);
      bloop.frequency.exponentialRampToValueAtTime(520, now + 0.28);

      bloopGain.gain.setValueAtTime(0.001, now + 0.05);
      bloopGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      bloopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

      bloop.connect(bloopGain);
      bloopGain.connect(ctx.destination);
      bloop.start(now + 0.05);
      bloop.stop(now + 0.32);
    }
  }

  // Bunny hop + wing flap whoosh
  playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Tailwind boost whoosh chime
  playBoost() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.27);
    });
  }

  // Delivery celebration fanfare at the Harbor Pier
  playDelivery(count = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [587.33, 739.99, 880.0, 1174.66]; // D5 F#5 A5 D6
    const total = Math.min(6, Math.max(2, count + 1));
    for (let i = 0; i < total; i++) {
      const t0 = now + i * 0.065;
      const freq = chord[i % chord.length] * (i >= 4 ? 1.5 : 1);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    }
  }

  // Subtle mechanical freewheel tick proportional to wheel spin
  playHubTick() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastClickTime < 0.07) return;
    this.lastClickTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.012);

    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.014);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.016);
  }
}
