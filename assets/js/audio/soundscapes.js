/* Soundscapes, each with its own layered sound design.
   Every soundscape is generated in the browser (no downloads, works offline):
   coloured noise beds, filters and slow modulation for texture, plus pre-rendered
   "event" buffers (raindrops, crackles, bubbles, cricket chirps) and live-scheduled
   events (bird calls, wave swells, thunder) so nothing sounds like a short loop.

   Recorded files are optional: list them in PAUSE_CONFIG.audioAssets and the mixer
   plays the file instead, falling back to these generators if it fails to load. */
const PauseSoundscapes = (() => {
  'use strict';
  const R = Math.random;
  const E = () => PauseEngine;

  /* ---------- Pre-rendered event buffers (sample-level synthesis) ---------- */
  /* Raindrops: tiny bursts of filtered noise with fast decay, scattered in stereo. */
  const dropsFill = (rate, softness) => (d, sr, ch) => {
    const n = Math.floor(d.length / sr * rate);
    for (let k = 0; k < n; k++) {
      const t0 = Math.floor(R() * d.length), len = Math.floor((0.002 + R() * 0.012) * sr);
      const amp = (0.04 + Math.pow(R(), 3) * 0.45) * (ch === (R() < 0.5 ? 0 : 1) ? 1 : 0.55);
      const a = 0.15 + R() * 0.6 * (1 - softness), decay = 4 / len;
      let lp = 0;
      for (let i = 0; i < len && t0 + i < d.length; i++) { lp += a * ((R() * 2 - 1) - lp); d[t0 + i] += lp * amp * Math.exp(-i * decay); }
    }
  };
  /* Fire crackles: clusters of very short clicks plus the occasional soft pop. */
  const crackleFill = rate => (d, sr) => {
    const bursts = Math.floor(d.length / sr * rate);
    for (let b = 0; b < bursts; b++) {
      const centre = Math.floor(R() * d.length), clicks = 1 + Math.floor(R() * 6);
      for (let k = 0; k < clicks; k++) {
        const t0 = centre + Math.floor(R() * 0.08 * sr), pop = R() < 0.12;
        const len = Math.floor((pop ? 0.006 + R() * 0.014 : 0.0003 + R() * 0.0012) * sr);
        const amp = pop ? 0.25 + R() * 0.25 : 0.1 + Math.pow(R(), 2) * 0.7, decay = 5 / len;
        let lp = 0;
        for (let i = 0; i < len && t0 + i < d.length; i++) { const w = R() * 2 - 1; lp = pop ? lp + 0.25 * (w - lp) : w; d[t0 + i] += lp * amp * Math.exp(-i * decay); }
      }
    }
  };
  /* Stream bubbles: short sine "blips" whose pitch rises as they decay (like real bubbles). */
  const bubbleFill = rate => (d, sr, ch) => {
    const n = Math.floor(d.length / sr * rate);
    for (let k = 0; k < n; k++) {
      const t0 = Math.floor(R() * d.length), dur = 0.012 + R() * 0.045, len = Math.floor(dur * sr);
      const f0 = 380 + Math.pow(R(), 2) * 1500, amp = (0.015 + R() * 0.06) * (R() < 0.5 ? 1 : 0.4);
      let ph = 0;
      for (let i = 0; i < len && t0 + i < d.length; i++) {
        const t = i / sr, f = f0 * (1 + 1.8 * t / dur);
        ph += 2 * Math.PI * f / sr;
        d[t0 + i] += Math.sin(ph) * amp * Math.exp(-6 * t / dur) * Math.min(1, i / 40);
      }
    }
  };
  /* Crickets: groups of short sine pulses around 4–5 kHz, each cricket with its own rhythm. */
  const cricketFill = count => (d, sr, ch) => {
    for (let j = 0; j < count; j++) {
      const f = 4100 + R() * 900, period = 0.45 + R() * 0.5, pulses = 3 + Math.floor(R() * 2);
      const side = R(), amp = 0.05 * (ch === 0 ? 1 - side * 0.7 : 0.3 + side * 0.7);
      for (let t0 = R() * period; t0 < d.length / sr; t0 += period * (0.9 + R() * 0.2)) {
        for (let p = 0; p < pulses; p++) {
          const s = Math.floor((t0 + p * 0.032) * sr), len = Math.floor(0.016 * sr);
          for (let i = 0; i < len && s + i < d.length; i++) d[s + i] += Math.sin(2 * Math.PI * f * i / sr) * amp * Math.sin(Math.PI * i / len);
        }
      }
    }
  };

  /* ---------- Live events ---------- */
  function birdCall(K) {
    const c = K.ctx, t = c.currentTime + 0.05;
    const out = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (pan.pan) pan.pan.value = R() * 1.6 - 0.8;
    out.gain.value = 0.5 + R() * 0.5;
    out.connect(pan); pan.connect(K.out);
    const send = c.createGain(); send.gain.value = 0.35; out.connect(send); send.connect(K.reverbNode);
    const note = (f1, f2, start, dur, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f1, start); o.frequency.exponentialRampToValueAtTime(f2, start + dur);
      g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g); g.connect(out); o.start(start); o.stop(start + dur + 0.02);
    };
    const kind = R(); let end = t;
    if (kind < 0.45) { // chirps
      const base = 2600 + R() * 1600, n = 2 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) { const s = t + i * (0.11 + R() * 0.07); note(base * (0.95 + R() * 0.1), base * (1.25 + R() * 0.2), s, 0.07 + R() * 0.05, 0.035); end = s + 0.15; }
    } else if (kind < 0.75) { // trill
      const base = 3000 + R() * 900, n = 10 + Math.floor(R() * 10);
      for (let i = 0; i < n; i++) { const s = t + i * 0.045; note(base * (1 - i * 0.008), base * (1.05 - i * 0.008), s, 0.035, 0.022); end = s + 0.05; }
    } else { // two-tone whistle
      const a = 2500 + R() * 700;
      note(a, a * 1.03, t, 0.32, 0.03); note(a * 0.82, a * 0.8, t + 0.38, 0.38, 0.028); end = t + 0.8;
    }
    setTimeout(() => { [out, pan, send].forEach(n => { try { n.disconnect(); } catch { } }); }, (end - c.currentTime + 1.5) * 1000);
  }
  function thunderRoll(K) {
    const c = K.ctx, t = c.currentTime + 0.05, s = c.createBufferSource();
    s.buffer = E().noise('brown', 12.1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(90, t + 7);
    const g = c.createGain(), peak = 0.5 + R() * 0.4, attack = 0.6 + R() * 1.2, decay = 5 + R() * 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    const p = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (p.pan) p.pan.value = R() * 1.2 - 0.6;
    s.connect(lp); lp.connect(g); g.connect(p); p.connect(K.out);
    const send = c.createGain(); send.gain.value = 0.4; g.connect(send); send.connect(K.reverbNode);
    s.start(t, R() * 6); s.stop(t + attack + decay + 0.1);
    s.onended = () => [s, lp, g, p, send].forEach(n => { try { n.disconnect(); } catch { } });
  }
  /* One rolling wave: body and brightness rise to a crest, foam hisses just after, then it recedes. */
  function wave(K, v) {
    const c = K.ctx, t = c.currentTime + 0.05, dur = 6.5 + R() * 5, peak = 0.18 + R() * 0.12, crest = t + dur * (0.38 + R() * 0.12);
    const set = (param, pts) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); pts.forEach(([time, val]) => param.linearRampToValueAtTime(val, time)); };
    set(v.body.gain, [[crest, peak], [t + dur, 0.06]]);
    set(v.lp.frequency, [[crest, 1100 + R() * 600], [t + dur, 280]]);
    set(v.foam.gain, [[crest, 0.01], [crest + dur * 0.12, 0.05 + R() * 0.05], [t + dur, 0.002]]);
    return dur;
  }
  function waveVoice(K, panVal) {
    const body = K.gain(0.06), lp = K.filter('lowpass', 300, 0.5), foam = K.gain(0.002), p = K.pan(panVal);
    K.chain(K.loop(E().noise('brown', 10.9)), lp, body, p, K.out);
    K.chain(K.loop(E().noise('pink', 8.3)), K.filter('highpass', 1600, 0.4), K.filter('lowpass', 7000), foam, p);
    const v = { body, lp, foam };
    const next = () => { if (!K.alive) return; const d = wave(K, v); setTimeout(next, d * 1000 * (0.75 + R() * 0.2)); };
    return next;
  }
  /* Slow random drift of a gain (gusts, intensity). */
  const drift = (K, param, lo, hi, ms, tc) => K.every(ms, () => param.setTargetAtTime(lo + R() * (hi - lo), K.ctx.currentTime, tc));

  /* ---------- Soundscape definitions ---------- */
  const SCAPES = [
    { id: 'rain', name: 'Gentle Rain', group: 'Nature', icon: '☂', art: 'linear-gradient(160deg,#c9d6e6,#8ea7c2 60%,#6f86a3)', desc: 'Soft rainfall with close patter and distant drops.', legacy: ['Gentle rain'],
      build(K) {
        const bed = K.gain(0.2);
        K.chain(K.loop(E().noise('pink', 10.3)), K.filter('highpass', 280), K.filter('lowpass', 5200), bed, K.out);
        drift(K, bed.gain, 0.15, 0.25, 1700, 3);
        K.chain(K.loop(E().buffer('drops-far', dropsFill(110, 0.2), 11.3)), K.filter('highpass', 1300), K.gain(0.55), K.out);
        K.chain(K.loop(E().buffer('drops-near', dropsFill(14, 0.6), 7.9)), K.filter('lowpass', 3800), K.gain(0.5), K.out);
        K.chain(K.loop(E().noise('brown', 12.7)), K.filter('lowpass', 170), K.gain(0.22), K.out);
      } },
    { id: 'thunder', name: 'Distant Thunder', group: 'Nature', icon: '⛈', art: 'linear-gradient(160deg,#9aa3bd,#5e6a8a 60%,#3f4866)', desc: 'Faraway rumbles every so often. Lovely with rain.', legacy: [],
      build(K) {
        K.chain(K.loop(E().noise('brown', 11.7)), K.filter('lowpass', 120), K.gain(0.12), K.out);
        K.randomly(18000, 55000, () => thunderRoll(K), 2500);
      } },
    { id: 'ocean', name: 'Ocean Waves', group: 'Nature', icon: '〰', art: 'linear-gradient(160deg,#cfe6ea,#86b9c6 55%,#4f8aa0)', desc: 'Waves rolling in and drawing back, with foam on each crest.', legacy: ['Ocean waves'],
      build(K) {
        K.chain(K.loop(E().noise('brown', 9.1)), K.filter('lowpass', 240), K.gain(0.06), K.out);
        const a = waveVoice(K, -0.35), b = waveVoice(K, 0.35);
        a(); setTimeout(() => K.alive && b(), 4200);
      } },
    { id: 'forest', name: 'Forest Ambience', group: 'Nature', icon: '🌲', art: 'linear-gradient(160deg,#d6e4cc,#9bb98f 55%,#5f8460)', desc: 'Rustling leaves, a light breeze and birds near and far.', legacy: ['Forest birds', 'Forest ambience'],
      build(K) {
        const wind = K.gain(0.2);
        K.chain(K.loop(E().noise('brown', 10.1)), K.filter('lowpass', 480), wind, K.out);
        drift(K, wind.gain, 0.12, 0.26, 1400, 2.5);
        const leaves = K.gain(0.03);
        K.chain(K.loop(E().noise('pink', 7.7)), K.filter('bandpass', 2600, 0.6), leaves, K.pan(0.2), K.out);
        drift(K, leaves.gain, 0.015, 0.08, 650, 0.5);
        K.randomly(1300, 5200, () => birdCall(K), 800);
      } },
    { id: 'wind', name: 'Soft Wind', group: 'Nature', icon: '༄', art: 'linear-gradient(160deg,#eae6dc,#c7c2b4 55%,#9a9a8e)', desc: 'Slow gusts that move gently from side to side.', legacy: ['Soft wind'],
      build(K) {
        [-0.5, 0.5].forEach(pv => {
          const bp = K.filter('bandpass', 400, 1.4), g = K.gain(0.25);
          K.chain(K.loop(E().noise('brown', pv < 0 ? 10.7 : 8.9)), bp, g, K.pan(pv), K.out);
          K.every(1100, () => { const t = K.ctx.currentTime; bp.frequency.setTargetAtTime(180 + R() * 520, t, 2.8); g.gain.setTargetAtTime(0.14 + R() * 0.26, t, 2.4); });
        });
        const whistle = K.gain(0.006);
        K.chain(K.loop(E().noise('pink', 9.4)), K.filter('bandpass', 1150, 7), whistle, K.out);
        drift(K, whistle.gain, 0.001, 0.012, 1800, 3);
      } },
    { id: 'crickets', name: 'Night Crickets', group: 'Nature', icon: '☾', art: 'linear-gradient(160deg,#3b4668,#26304d 60%,#1a2238)', desc: 'A warm night with crickets close by and further away.', legacy: ['Night crickets'],
      build(K) {
        K.chain(K.loop(E().noise('brown', 9.9)), K.filter('lowpass', 300), K.gain(0.12), K.out);
        K.chain(K.loop(E().buffer('crickets-near', cricketFill(2), 6.1)), K.filter('highpass', 2500), K.gain(0.8), K.out);
        const far = K.gain(0.35);
        K.chain(K.loop(E().buffer('crickets-far', cricketFill(4), 8.3)), K.filter('lowpass', 3200), far, K.out);
        far.connect(K.reverbSend(0.5));
      } },
    { id: 'fire', name: 'Fireplace', group: 'Cosy', icon: '🔥', art: 'linear-gradient(160deg,#f6d7b8,#e09a6d 55%,#a85a3f)', desc: 'A low roar of flames with soft crackles and pops.', legacy: ['Warm fire', 'Fireplace'],
      build(K) {
        const roar = K.gain(0.18);
        K.chain(K.loop(E().noise('brown', 9.3)), K.filter('lowpass', 650, 0.6), roar, K.out);
        drift(K, roar.gain, 0.12, 0.22, 280, 0.25);
        K.chain(K.loop(E().noise('pink', 7.1)), K.filter('highpass', 3200), K.gain(0.01), K.out);
        K.chain(K.loop(E().buffer('crackle-a', crackleFill(9), 6.7)), K.filter('highpass', 700), K.gain(0.5), K.pan(-0.25), K.out);
        K.chain(K.loop(E().buffer('crackle-b', crackleFill(6), 9.1)), K.filter('highpass', 900), K.gain(0.4), K.pan(0.3), K.out);
      } },
    { id: 'stream', name: 'Gentle Stream', group: 'Nature', icon: '≈', art: 'linear-gradient(160deg,#d8ece6,#9fcfc2 55%,#5e9e8f)', desc: 'Water bubbling over stones in a shallow stream.', legacy: ['Flowing stream'],
      build(K) {
        const flow = K.gain(0.16);
        K.chain(K.loop(E().noise('pink', 8.7)), K.filter('bandpass', 950, 0.6), flow, K.out);
        drift(K, flow.gain, 0.1, 0.22, 170, 0.08);
        K.chain(K.loop(E().noise('brown', 11.9)), K.filter('lowpass', 380), K.gain(0.16), K.out);
        K.chain(K.loop(E().noise('pink', 6.9)), K.filter('highpass', 3000), K.gain(0.02), K.out);
        K.chain(K.loop(E().buffer('bubbles-a', bubbleFill(28), 7.3)), K.gain(0.8), K.pan(-0.2), K.out);
        K.chain(K.loop(E().buffer('bubbles-b', bubbleFill(18), 9.7)), K.filter('lowpass', 2600), K.gain(0.6), K.pan(0.25), K.out);
      } },
    { id: 'white', name: 'White Noise', group: 'Focus', icon: '▤', art: 'linear-gradient(160deg,#f3f1ec,#dcd8d0 60%,#bdb8ae)', desc: 'Even, steady noise, softened at the top so it isn’t harsh.', legacy: [],
      build(K) { K.chain(K.loop(E().noise('white', 10.1)), K.filter('lowpass', 7500, 0.5), K.gain(0.16), K.out); } },
    { id: 'pink', name: 'Pink Noise', group: 'Focus', icon: '▥', art: 'linear-gradient(160deg,#f6e3e1,#e6bcb8 60%,#c9928d)', desc: 'Warmer than white noise, like steady rainfall. Good for sleep.', legacy: [],
      build(K) { K.chain(K.loop(E().noise('pink', 10.5)), K.filter('lowpass', 9000, 0.5), K.gain(0.2), K.out); } },
    { id: 'brown', name: 'Brown Noise', group: 'Focus', icon: '▦', art: 'linear-gradient(160deg,#e9dccb,#c4a888 60%,#8c6d50)', desc: 'A deep, low rumble that many people find calming for focus.', legacy: ['Brown noise'],
      build(K) { K.chain(K.loop(E().noise('brown', 11.1)), K.filter('lowpass', 900, 0.5), K.gain(0.24), K.out); } },
    { id: 'focus', name: 'Deep Focus', group: 'Focus', icon: '◎', art: 'linear-gradient(160deg,#e3defa,#b4a8e0 55%,#7d6db8)', desc: 'Soft low noise under a slowly evolving warm pad.', legacy: [],
      build(K) {
        K.chain(K.loop(E().noise('brown', 10.3)), K.filter('lowpass', 420), K.gain(0.09), K.out);
        const pad = K.gain(1), lp = K.filter('lowpass', 700, 0.8);
        K.chain(lp, pad, K.out); pad.connect(K.reverbSend(0.6));
        const lfo = K.osc('sine', 0.045), depth = K.gain(320); lfo.connect(depth); depth.connect(lp.frequency); lfo.start();
        const chords = [[110, 164.81, 220, 277.18], [98, 146.83, 196, 246.94], [87.31, 130.81, 174.61, 220], [103.83, 155.56, 207.65, 261.63]];
        const voices = chords[0].map((f, i) => {
          const a = K.osc('sine', f), b = K.osc('triangle', f * 1.004), g = K.gain([0.03, 0.02, 0.013, 0.008][i]);
          a.connect(g); b.connect(g); g.connect(lp); a.start(); b.start();
          return [a, b];
        });
        let ci = 0;
        K.every(22000, () => { ci = (ci + 1) % chords.length; const t = K.ctx.currentTime; voices.forEach(([a, b], i) => { a.frequency.setTargetAtTime(chords[ci][i], t, 3); b.frequency.setTargetAtTime(chords[ci][i] * 1.004, t, 3); }); });
      } },
    { id: 'tones', name: 'Soft Tones', group: 'Calm', icon: '✧', art: 'linear-gradient(160deg,#f4e6f0,#d9bfd6 55%,#a989ad)', desc: 'Sparse, bell-like notes floating over a quiet drone.', legacy: ['Ambient tones', 'Calm instrumental'],
      build(K) {
        const drone = K.gain(0.025);
        [130.81, 196].forEach(f => { const o = K.osc('sine', f); o.connect(drone); o.start(); });
        K.chain(drone, K.filter('lowpass', 600), K.out);
        const notes = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
        const send = K.reverbSend(0.7);
        K.randomly(2500, 6500, () => {
          const c = K.ctx, t = c.currentTime + 0.05, f = notes[Math.floor(R() * notes.length)];
          [1, 2.01, 3.02].forEach((m, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.frequency.value = f * m; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime([0.05, 0.012, 0.005][i], t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 4 - i);
            o.connect(g); g.connect(K.out); g.connect(send); o.start(t); o.stop(t + 4.2);
            o.onended = () => { try { g.disconnect(); } catch { } };
          });
        }, 600);
      } }
  ];

  const byId = Object.fromEntries(SCAPES.map(s => [s.id, s]));
  const legacy = {};
  SCAPES.forEach(s => s.legacy.forEach(n => { legacy[n] = s.id; }));

  const PRESETS = [
    { id: 'deep-focus', name: 'Deep Focus', icon: '◎', desc: 'Soft noise with a gentle ambient pad', mix: { brown: 0.45, focus: 0.7 } },
    { id: 'rainy-evening', name: 'Rainy Evening', icon: '☂', desc: 'Rain with distant thunder', mix: { rain: 0.8, thunder: 0.55 } },
    { id: 'forest-escape', name: 'Forest Escape', icon: '🌲', desc: 'Breeze, leaves and birds', mix: { forest: 0.8, wind: 0.35, stream: 0.25 } },
    { id: 'cozy-night', name: 'Cozy Night', icon: '🔥', desc: 'Fireplace and gentle wind', mix: { fire: 0.75, wind: 0.3, crickets: 0.15 } },
    { id: 'ocean-calm', name: 'Ocean Calm', icon: '〰', desc: 'Waves with a soft wind over the water', mix: { ocean: 0.85, wind: 0.2 } },
    { id: 'sleep', name: 'Sleep Atmosphere', icon: '☾', desc: 'Pink noise with soft, sparse tones', mix: { pink: 0.4, tones: 0.3, rain: 0.15 } }
  ];

  return { SCAPES, byId, legacy, PRESETS };
})();
