/**
 * 盐湖里的声音全部由 WebAudio 实时合成，不加载任何音频文件。
 * 第一次触摸/按键后才创建 AudioContext，避免自动播放策略报错。
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let noiseBuffer = null;
  let enabled = true;
  let ready = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      master.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 2.4);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.022 * white) / 1.022;
        data[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 380;
      windFilter.Q.value = 0.5;
      windGain = ctx.createGain();
      windGain.gain.value = 0.045;
      src.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      src.start();
      ready = true;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function env(node, t0, attack, peak, decay) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function bell() {
    ensure();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const partials = [1, 1.34, 1.67, 2.02, 2.51];
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1468 * p;
      const g = ctx.createGain();
      env(g, t, 0.006, 0.14 / (i + 1.3), 0.75 + i * 0.12);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 1.5);
    });
    // 槌子敲击的一点点沙声
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.2);
  }

  function blip(step = 0) {
    ensure();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = notes[Math.min(step, notes.length - 1)];
    [f, f * 1.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.06, t + 0.16);
      const g = ctx.createGain();
      env(g, t, 0.008, i === 0 ? 0.1 : 0.035, 0.24);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.35);
    });
  }

  function full() {
    ensure();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = t + i * 0.075;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.075, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 1);
    });
  }

  function whoosh() {
    ensure();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.32);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    env(g, t, 0.05, 0.075, 0.32);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.5);
  }

  function land() {
    ensure();
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.28);
    const g = ctx.createGain();
    env(g, t, 0.01, 0.13, 0.3);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.4);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const ng = ctx.createGain();
    env(ng, t, 0.01, 0.06, 0.22);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(master);
    src.start(t);
    src.stop(t + 0.35);
  }

  return {
    ensure,
    bell,
    blip,
    full,
    whoosh,
    land,
    get isReady() { return ready; },
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      ensure();
      if (ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
      }
    },
    setWind(speed, air) {
      if (!ctx || !ready) return;
      const t = ctx.currentTime;
      windFilter.frequency.setTargetAtTime(320 + speed * 42 + air * 240, t, 0.35);
      windGain.gain.setTargetAtTime(0.028 + speed * 0.0065 + air * 0.02, t, 0.4);
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx) ctx.resume().catch(() => {});
    },
  };
}
