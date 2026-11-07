/* Pause audio engine (Web Audio API).
   One AudioContext for the whole app, created or resumed only after a user gesture.

   Signal graph
     ambient layers ─┐
     game effects  ──┼─▶ master gain ─▶ limiter (DynamicsCompressor) ─▶ analyser ─▶ speakers
     breathing cues ─┘        ▲
     reverb sends ─▶ Convolver (generated room) ─┘

   - Every node a soundscape creates goes through a "kit" that remembers it, so
     stopping a layer disconnects every node and clears every timer (no leaks).
   - Fades use scheduled ramps, so volume changes are smooth and click-free.
   - The limiter keeps the mix from clipping when several layers play together.
   - The context suspends itself after a quiet period to save battery. */
const PauseEngine = (() => {
  'use strict';
  let ctx = null, master, limiter, analyser, ambientBus, sfxBus, breathBus, reverb, reverbIn;
  const buffers = new Map();
  let idleTimer = null, activeHolds = 0;
  const settings = loadSettings();

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('pause-audio-settings') || '{}') || {}; } catch { }
    return { master: 0.8, sfx: true, sfxVolume: 0.5, fadeIn: 3, fadeOut: 3, ...s };
  }
  function saveSettings() { try { localStorage.setItem('pause-audio-settings', JSON.stringify(settings)); } catch { } }

  const supported = () => !!(window.AudioContext || window.webkitAudioContext);

  /* Build the graph. `custom` lets tests pass an OfflineAudioContext. */
  function build(custom) {
    ctx = custom || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    master = ctx.createGain(); master.gain.value = settings.master;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 8; limiter.ratio.value = 12; limiter.attack.value = 0.004; limiter.release.value = 0.3;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.85;
    ambientBus = ctx.createGain(); sfxBus = ctx.createGain(); breathBus = ctx.createGain();
    sfxBus.gain.value = settings.sfxVolume;
    reverbIn = ctx.createGain();
    reverb = ctx.createConvolver(); reverb.buffer = impulse(2.8, 2.6);
    const reverbOut = ctx.createGain(); reverbOut.gain.value = 0.55;
    reverbIn.connect(reverb); reverb.connect(reverbOut); reverbOut.connect(master);
    [ambientBus, sfxBus, breathBus].forEach(b => b.connect(master));
    master.connect(limiter); limiter.connect(analyser); analyser.connect(ctx.destination);
  }

  /* Call from inside a click/tap handler: creates or resumes the context. */
  function unlock() {
    if (!supported()) return null;
    if (!ctx) build();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => { });
    clearTimeout(idleTimer);
    return ctx;
  }
  const ready = () => !!ctx && ctx.state !== 'closed';
  const now = () => ctx.currentTime;

  /* Something is playing (an ambient layer or a breathing session) → keep the context awake. */
  function hold() { activeHolds++; clearTimeout(idleTimer); }
  function release() {
    activeHolds = Math.max(0, activeHolds - 1);
    if (!activeHolds) scheduleIdle();
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!activeHolds && ctx && ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(() => { }); }, 20000);
  }

  /* Smooth parameter change, safe to call repeatedly (no clicks). */
  function ramp(param, value, seconds = 0.2) {
    if (!ctx) return;
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    if (seconds <= 0) param.setValueAtTime(value, t);
    else param.linearRampToValueAtTime(value, t + seconds);
  }

  /* ---------- Buffers ---------- */
  /* Seamless loop: render extra samples, then crossfade the tail into the head
     with equal-power curves so the loop point can't be heard. */
  function seamless(fill, seconds, channels = 2) {
    const sr = ctx.sampleRate, n = Math.floor(seconds * sr), xf = Math.floor(0.6 * sr);
    const buf = ctx.createBuffer(channels, n, sr);
    for (let c = 0; c < channels; c++) {
      const raw = new Float32Array(n + xf);
      fill(raw, sr, c);
      const out = buf.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] = raw[i];
      for (let i = 0; i < xf; i++) { const a = i / xf; out[i] = raw[i] * Math.sin(a * Math.PI / 2) + raw[n + i] * Math.cos(a * Math.PI / 2); }
    }
    return buf;
  }
  /* Coloured noise: white (flat), pink (softer highs), brown (deep rumble). */
  function noiseFill(kind) {
    return (d) => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') { // Paul Kellet's refined filter
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
    };
  }
  /* Cached buffers by name. Different lengths per name keep layered loops from lining up. */
  function buffer(name, makeFill, seconds, channels = 2) {
    const key = name + ':' + ctx.sampleRate;
    if (!buffers.has(key)) buffers.set(key, seamless(makeFill, seconds, channels));
    return buffers.get(key);
  }
  const noise = (kind, seconds = 9.7) => buffer('noise-' + kind + '-' + seconds, noiseFill(kind), seconds);

  /* Generated room reverb: decaying stereo noise. */
  function impulse(seconds, decay) {
    const sr = ctx.sampleRate, n = Math.floor(seconds * sr), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * 0.5; }
    return b;
  }

  /* Optional recorded files (see PAUSE_CONFIG.audioAssets). Returns null if missing. */
  async function loadAsset(url) {
    const key = 'asset:' + url;
    if (buffers.has(key)) return buffers.get(key);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Audio file not found: ' + url);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, no) => { const p = ctx.decodeAudioData(data, ok, no); if (p && p.then) p.then(ok, no); });
    buffers.set(key, buf);
    return buf;
  }

  /* ---------- Kit: node factory that tracks everything for cleanup ---------- */
  function kit(out) {
    const nodes = [], timers = [];
    let alive = true;
    const track = n => (nodes.push(n), n);
    const K = {
      ctx, out, sr: ctx.sampleRate, reverbNode: reverbIn,
      get alive() { return alive; },
      gain(v = 1) { const g = track(ctx.createGain()); g.gain.value = v; return g; },
      filter(type, freq, q = 0.7) { const f = track(ctx.createBiquadFilter()); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; },
      pan(v = 0) {
        if (ctx.createStereoPanner) { const p = track(ctx.createStereoPanner()); p.pan.value = v; return p; }
        return K.gain(1); // older Safari: no panning, still works
      },
      osc(type, freq) { const o = track(ctx.createOscillator()); o.type = type; o.frequency.value = freq; return o; },
      /* Looping buffer source started at a random point so layers never sound identical. */
      loop(buf, rate = 1) {
        const s = track(ctx.createBufferSource()); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
        s.start(ctx.currentTime + 0.02, Math.random() * buf.duration);
        return s;
      },
      oneShot(buf, when, offset = 0, dur) { const s = ctx.createBufferSource(); s.buffer = buf; s.start(when, offset, dur); s.onended = () => { try { s.disconnect(); } catch { } }; return s; },
      reverbSend(amount) { const g = K.gain(amount); g.connect(reverbIn); return g; },
      chain(...ns) { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; },
      /* Timer that stops with the layer. */
      every(ms, fn) { const id = setInterval(() => alive && fn(), ms); timers.push(() => clearInterval(id)); },
      /* Self-rescheduling random timer (birds, thunder, waves). */
      randomly(minMs, maxMs, fn, first = minMs) {
        let id;
        const go = () => { if (!alive) return; fn(); id = setTimeout(go, minMs + Math.random() * (maxMs - minMs)); };
        id = setTimeout(go, first);
        timers.push(() => clearTimeout(id));
      },
      stop() {
        alive = false;
        timers.forEach(t => t()); timers.length = 0;
        nodes.forEach(n => { try { n.stop && n.stop(); } catch { } try { n.disconnect(); } catch { } });
        nodes.length = 0;
      }
    };
    return K;
  }

  /* ---------- Soft game sound effects ----------
     Pitches come from a pentatonic scale so repeated taps never clash or grate. */
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  let lastSfx = 0;
  function tone(freq, start, dur, { type = 'sine', vol = 0.18, glide = 0, out = sfxBus, attack = 0.008, verb = 0.12 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, start + dur);
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + attack); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(out);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(reverbIn); o.onended = () => { try { s.disconnect(); } catch { } }; }
    o.start(start); o.stop(start + dur + 0.05);
  }
  function sfx(name) {
    if (!settings.sfx || !supported()) return;
    unlock();
    const t = ctx.currentTime, gap = performance.now() - lastSfx;
    if (gap < 45) return; // never machine-gun
    lastSfx = performance.now();
    const p = PENTA[Math.floor(Math.random() * PENTA.length)];
    switch (name) {
      case 'tap': tone(p, t, 0.18, { vol: 0.09 }); break;
      case 'pop': tone(p * 0.6, t, 0.09, { vol: 0.12, glide: 1.9, verb: 0.05 }); break;
      case 'select': tone(p, t, 0.2, { vol: 0.08 }); tone(p * 1.5, t + 0.07, 0.25, { vol: 0.06 }); break;
      case 'sparkle': tone(p * 2, t, 0.35, { vol: 0.05, type: 'triangle', verb: 0.3 }); break;
      case 'step': [0, 2].forEach((k, i) => tone(PENTA[k], t + i * 0.09, 0.4, { vol: 0.07, verb: 0.25 })); break;
      case 'success': [0, 2, 4].forEach((k, i) => tone(PENTA[k], t + i * 0.11, 0.6, { vol: 0.07, verb: 0.3 })); break;
      case 'complete': [0, 2, 4, 5].forEach((k, i) => tone(PENTA[k] / 2, t + i * 0.16, 1.6, { vol: 0.07, type: 'triangle', verb: 0.45 })); break;
      case 'whoosh': whoosh(t, 0.7, 400, 1600, 0.05, sfxBus); break;
    }
  }

  /* Filtered-noise swell used for transitions and breath sounds. */
  function whoosh(start, dur, f1, f2, vol, out, q = 0.9) {
    const s = ctx.createBufferSource(); s.buffer = noise('pink'); s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f1, start); bp.frequency.exponentialRampToValueAtTime(f2, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, start + dur);
    s.connect(bp); bp.connect(g); g.connect(out);
    s.start(start, Math.random() * 5); s.stop(start + dur + 0.05);
    s.onended = () => { [s, bp, g].forEach(n => { try { n.disconnect(); } catch { } }); };
  }

  /* ---------- Breathing cues ---------- */
  const breath = {
    inhale(dur, vol = 1) { unlock(); whoosh(ctx.currentTime + 0.02, dur, 260, 900, 0.07 * vol, breathBus, 0.7); },
    exhale(dur, vol = 1) { unlock(); whoosh(ctx.currentTime + 0.02, dur, 700, 220, 0.06 * vol, breathBus, 0.6); },
    chime(step = 0) {
      unlock();
      const t = ctx.currentTime + 0.02, f = [392, 523.25, 440, 349.23][step % 4];
      tone(f, t, 2.4, { vol: 0.05, type: 'sine', out: breathBus, attack: 0.03, verb: 0.4 });
      tone(f * 2.01, t, 1.6, { vol: 0.015, type: 'sine', out: breathBus, attack: 0.03, verb: 0.4 });
    },
    bell() { unlock(); const t = ctx.currentTime + 0.02; [261.63, 392, 523.25].forEach((f, i) => tone(f, t + i * 0.25, 3.5, { vol: 0.045, type: 'sine', out: breathBus, attack: 0.04, verb: 0.5 })); }
  };

  return {
    supported, unlock, ready, now, hold, release, ramp, kit, noise, buffer, loadAsset, sfx, breath, build,
    get ctx() { return ctx; }, get analyser() { return analyser; }, get ambientBus() { return ambientBus; },
    settings,
    setMaster(v) { settings.master = v; saveSettings(); if (ctx) ramp(master.gain, v, 0.15); },
    setSfx(on) { settings.sfx = !!on; saveSettings(); },
    setSfxVolume(v) { settings.sfxVolume = v; saveSettings(); if (ctx) ramp(sfxBus.gain, v, 0.1); },
    setFades(fadeIn, fadeOut) { settings.fadeIn = fadeIn; settings.fadeOut = fadeOut; saveSettings(); }
  };
})();
