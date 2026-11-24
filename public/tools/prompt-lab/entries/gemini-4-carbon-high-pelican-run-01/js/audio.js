/**
 * Zero-asset procedural WebAudio synthesizer for Pelican Coastal Ride.
 * Synthesizes ocean breeze, freehub bicycle ratchet clicks, wooden plank hum,
 * dual-strike brass handlebar bell, wing-glide whoosh, fish gulp, and harbor chimes.
 */
export function createSoundEngine() {
  let ctx = null;
  let masterGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let ready = false;
  let ratchetAccum = 0;
  let plankAccum = 0;

  function ensureContext() {
    if (muted) return false;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);

      // Continuous pink-ish filtered noise for coastal sea breeze
      const bufSize = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.018) * 0.35;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.85;

      windGain = ctx.createGain();
      windGain.gain.value = 0.0;

      noiseSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);
      noiseSrc.start();
      ready = true;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ready && ctx.state === 'running';
  }

  function unlock() {
    ensureContext();
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.04);
    }
    if (!muted) ensureContext();
    return muted;
  }

  function isMuted() {
    return muted;
  }

  // Crisp vintage dual-strike brass bicycle bell (`叮-铃!`)
  function playBell() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const partials = [1, 2.02, 3.41, 4.88];
    const amps = [0.22, 0.14, 0.08, 0.045];

    for (const strikeOffset of [0, 0.095]) {
      const t0 = now + strikeOffset;
      const baseFreq = strikeOffset === 0 ? 1568 : 1612;
      partials.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * ratio, t0);
        const decay = 0.72 / (1 + idx * 0.75);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amps[idx], t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + decay + 0.02);
      });
    }
  }

  // Tiny metallic bicycle freehub pawl click (`哒`)
  function playFreehubTick(volume = 0.045) {
    if (!ready || muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2650 + Math.random() * 320, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.014);
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  // Soft warm wooden plank thrum under balloon tires
  function playPlankTap(volume = 0.03) {
    if (!ready || muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135 + Math.random() * 18, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.035);
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  function playHop(withWings = false) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(withWings ? 520 : 390, now + 0.16);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  function playLand(impactSpeed = 3) {
    if (!ready || muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const vol = Math.min(0.2, 0.05 + impactSpeed * 0.022);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.09);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Comical pelican beak-snap + elastic throat-pouch gulp (`咔嗒-咕嘟!`)
  function playCatch(isGold = false) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;

    // Beak clack
    const clack = ctx.createOscillator();
    const cg = ctx.createGain();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(680, now);
    clack.frequency.exponentialRampToValueAtTime(210, now + 0.045);
    cg.gain.setValueAtTime(0.16, now);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    clack.connect(cg);
    cg.connect(masterGain);
    clack.start(now);
    clack.stop(now + 0.06);

    // Pouch gulp + cheerful sparkle note
    const gulp = ctx.createOscillator();
    const gg = ctx.createGain();
    gulp.type = 'sine';
    gulp.frequency.setValueAtTime(260, now + 0.04);
    gulp.frequency.exponentialRampToValueAtTime(isGold ? 784 : 587, now + 0.16);
    gg.gain.setValueAtTime(0.15, now + 0.04);
    gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gulp.connect(gg);
    gg.connect(masterGain);
    gulp.start(now + 0.04);
    gulp.stop(now + 0.24);
  }

  // Harbor fish delivery celebratory marimba arpeggio + brass buoy chime
  function playDelivery(fishCount = 1) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51];
    const count = Math.min(notes.length, Math.max(2, fishCount + 1));
    for (let i = 0; i < count; i++) {
      const t0 = now + i * 0.065;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    }
  }

  function playBoost() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    for (const [idx, freq] of [587.33, 880, 1174.66].entries()) {
      const t0 = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.11, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }
  }

  function update(dt, { speed = 0, coasting = false, airborne = false, gliding = false }) {
    if (!ready || muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Modulate sea breeze with airspeed & wing-glide
    const targetWind = Math.min(0.18, 0.022 + (speed / 14) * 0.11 + (gliding ? 0.05 : 0));
    const targetCutoff = 320 + speed * 58 + (gliding ? 260 : 0);
    windGain.gain.setTargetAtTime(targetWind, now, 0.08);
    windFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);

    // Freehub ratchet ticks when coasting or airborne with wheel momentum!
    if ((coasting || airborne) && speed > 0.9) {
      ratchetAccum += speed * dt * 2.9;
      if (ratchetAccum >= 1) {
        ratchetAccum %= 1;
        playFreehubTick(airborne ? 0.028 : 0.045);
      }
    }

    // Subtle cedar boardwalk plank rhythm while rolling on deck
    if (!airborne && speed > 0.6) {
      plankAccum += speed * dt * 0.72;
      if (plankAccum >= 1) {
        plankAccum %= 1;
        playPlankTap(Math.min(0.032, 0.012 + speed * 0.0018));
      }
    }
  }

  return {
    unlock,
    setMuted,
    isMuted,
    playBell,
    playHop,
    playLand,
    playCatch,
    playDelivery,
    playBoost,
    update,
  };
}
