/* Ambient sound mixer + player bar.
   - Several soundscapes can play together, each with its own volume.
   - Starting, stopping and switching always crossfade (fade-in / fade-out lengths are adjustable).
   - Presets and your own saved mixes really drive the engine.
   - Favourites, recently played, mix and settings are remembered on this device.
   Exposed as `PauseAudio` (the name the rest of the app already uses). */
const PauseAudio = (() => {
  'use strict';
  const E = PauseEngine, S = PauseSoundscapes;
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

  /* ---------- State ---------- */
  const DEFAULT_VOL = 0.65;
  let mix = LS.get('pause-mix', null);
  if (!mix) { // first run, or upgrading from the single-track player
    let old = null; try { old = localStorage.getItem('pause-track'); } catch { }
    const first = S.legacy[old] || 'rain';
    mix = { on: [first], vol: {} };
  }
  mix.on = (mix.on || []).filter(id => S.byId[id]);
  mix.vol = mix.vol || {};
  let favourites = LS.get('pause-sound-favs', []);
  let recent = LS.get('pause-sound-recent', []);
  let custom = LS.get('pause-mix-presets', []);
  let playing = false, sleepEnds = 0, sleepTimer = null, sleepTick = null, panelMessage = '';
  const live = new Map(); // id -> { gain, kit }
  const listeners = new Set();
  const save = () => LS.set('pause-mix', mix);
  const volOf = id => mix.vol[id] ?? DEFAULT_VOL;
  const emit = () => { renderBar(); listeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } }); };

  /* ---------- Layers ---------- */
  async function startLayer(id) {
    if (live.has(id) || !E.supported()) return;
    const ctx = E.unlock();
    const gain = ctx.createGain(); gain.gain.value = 0.0001; gain.connect(E.ambientBus);
    const kit = E.kit(gain);
    live.set(id, { gain, kit });
    E.hold();
    const asset = window.PAUSE_CONFIG?.audioAssets?.[id];
    try {
      if (asset) { const buf = await E.loadAsset(asset); if (kit.alive) kit.chain(kit.loop(buf), kit.gain(1), gain); }
      else S.byId[id].build(kit);
    } catch (err) {
      console.warn('Using generated sound for', id, err);
      if (kit.alive) { try { S.byId[id].build(kit); } catch (e2) { stopLayer(id, 0); panelMessage = 'Couldn’t start ' + S.byId[id].name; } }
    }
    E.ramp(gain.gain, volOf(id), E.settings.fadeIn);
    recent = [id, ...recent.filter(x => x !== id)].slice(0, 6); LS.set('pause-sound-recent', recent);
  }
  function stopLayer(id, fade = E.settings.fadeOut) {
    const l = live.get(id); if (!l) return;
    live.delete(id);
    E.ramp(l.gain.gain, 0.0001, fade);
    setTimeout(() => { l.kit.stop(); try { l.gain.disconnect(); } catch { } E.release(); }, fade * 1000 + 150);
  }

  /* ---------- Public controls ---------- */
  function play() {
    if (!E.supported()) { panelMessage = 'Audio isn’t supported in this browser.'; return emit(); }
    if (!mix.on.length) mix.on = [favourites[0] || recent[0] || 'rain'];
    playing = true; panelMessage = '';
    mix.on.forEach(startLayer); save(); emit();
  }
  function pause() { playing = false; [...live.keys()].forEach(id => stopLayer(id)); clearSleep(); emit(); }
  function toggle() { playing ? pause() : play(); }
  /* Turn one sound on or off inside the mix. Turning one on also starts playback. */
  function setLayer(id, on) {
    if (!S.byId[id]) return;
    if (on && !mix.on.includes(id)) mix.on.push(id);
    if (!on) mix.on = mix.on.filter(x => x !== id);
    save();
    if (on) { if (!playing) { playing = true; mix.on.forEach(startLayer); } else startLayer(id); }
    else { stopLayer(id); if (!mix.on.length) { playing = false; clearSleep(); } }
    emit();
  }
  function setVolume(id, v) {
    mix.vol[id] = +v; save();
    const l = live.get(id); if (l) E.ramp(l.gain.gain, Math.max(0.0001, +v), 0.12);
  }
  /* Apply a set of sounds with volumes; crossfades from whatever is playing. */
  function applyMix(m, label = '') {
    const ids = Object.keys(m).filter(id => S.byId[id]);
    Object.entries(m).forEach(([id, v]) => { mix.vol[id] = v; });
    [...live.keys()].filter(id => !ids.includes(id)).forEach(id => stopLayer(id));
    mix.on = ids; save();
    playing = true;
    ids.forEach(id => { const l = live.get(id); if (l) E.ramp(l.gain.gain, volOf(id), 1.2); else startLayer(id); });
    panelMessage = label ? `Playing ${label}` : '';
    emit();
  }
  /* Only this one sound (used by suggestions elsewhere in the app). */
  function solo(id) { applyMix({ [id]: volOf(id) }); }
  function stop() { pause(); }

  /* ---------- Sleep timer ---------- */
  function clearSleep() { clearTimeout(sleepTimer); clearInterval(sleepTick); sleepEnds = 0; }
  function setSleep(min) {
    clearSleep();
    if (+min > 0 && playing) {
      sleepEnds = Date.now() + min * 60000;
      const fade = Math.max(8, E.settings.fadeOut);
      sleepTimer = setTimeout(() => {
        live.forEach(l => E.ramp(l.gain.gain, 0.0001, fade));
        setTimeout(() => { if (sleepEnds) { sleepEnds = 0; pause(); } }, fade * 1000);
      }, Math.max(0, min * 60000 - fade * 1000));
      sleepTick = setInterval(emit, 30000);
    }
    emit();
  }
  const sleepLeft = () => sleepEnds ? Math.max(0, Math.ceil((sleepEnds - Date.now()) / 60000)) : 0;

  /* ---------- Favourites, recent, custom mixes ---------- */
  function toggleFavourite(id) { favourites = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id]; LS.set('pause-sound-favs', favourites); emit(); }
  function saveCustom(name) {
    const m = {}; mix.on.forEach(id => { m[id] = volOf(id); });
    if (!Object.keys(m).length) return null;
    const p = { id: 'c' + Date.now(), name: name.slice(0, 40), mix: m, custom: true };
    custom = [p, ...custom].slice(0, 20); LS.set('pause-mix-presets', custom); emit();
    return p;
  }
  function deleteCustom(pid) { custom = custom.filter(p => p.id !== pid); LS.set('pause-mix-presets', custom); emit(); }

  /* ---------- Visualiser (shared by the bar and the Sounds page) ---------- */
  const canvases = new Set();
  let raf = 0;
  function watch(canvas, style = 'bars') { canvas.dataset.style = style; canvases.add(canvas); loop(); }
  function loop() {
    cancelAnimationFrame(raf);
    const reduced = window.Pause?.motionReduced?.();
    const a = E.analyser, freq = a ? new Uint8Array(a.frequencyBinCount) : null, wave = a ? new Uint8Array(a.fftSize) : null;
    const draw = () => {
      for (const c of [...canvases]) if (!c.isConnected) canvases.delete(c);
      if (!canvases.size) return;
      const active = playing && a && E.ctx?.state === 'running';
      if (active) { a.getByteFrequencyData(freq); a.getByteTimeDomainData(wave); }
      const t = performance.now() / 1000;
      canvases.forEach(c => {
        const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
        if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const col = getComputedStyle(c).color || '#8e7cc3';
        g.fillStyle = col; g.strokeStyle = col;
        if (c.dataset.style === 'wave') {
          /* Layered soft waves: amplitude follows the sound energy. */
          let energy = 0; if (active) { for (let i = 0; i < 64; i++) energy += freq[i]; energy /= 64 * 255; }
          const amp = active ? Math.min(0.4, 0.12 + energy * 0.9) : 0.06;
          for (let k = 0; k < 3; k++) {
            g.globalAlpha = 0.18 + k * 0.18; g.lineWidth = 2; g.beginPath();
            for (let x = 0; x <= w; x += 4) {
              const ph = reduced ? 0 : t * (0.4 + k * 0.25);
              const y = h / 2 + Math.sin(x / w * Math.PI * (2 + k) + ph + k) * h * amp * (0.6 + k * 0.25) * Math.sin(Math.PI * x / w);
              x ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            g.stroke();
          }
          g.globalAlpha = 1;
        } else {
          const n = Math.max(4, Math.floor(w / 6)), bw = w / n;
          for (let i = 0; i < n; i++) {
            const v = active ? freq[Math.floor(Math.pow(i / n, 1.6) * freq.length * 0.6)] / 255 : 0.12 + 0.05 * Math.sin(i);
            const bh = Math.max(2, v * h * 0.95);
            g.globalAlpha = 0.55 + v * 0.45;
            g.beginPath(); g.roundRect ? g.roundRect(i * bw + 1, (h - bh) / 2, bw - 2, bh, 2) : g.rect(i * bw + 1, (h - bh) / 2, bw - 2, bh); g.fill();
          }
          g.globalAlpha = 1;
        }
      });
      if (active && !reduced) raf = requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- Player bar ---------- */
  const label = () => {
    const names = (playing ? [...live.keys()] : mix.on).map(id => S.byId[id]?.name).filter(Boolean);
    if (!names.length) return 'No sounds selected';
    return names.length > 2 ? `${names[0]} + ${names.length - 1} more` : names.join(' + ');
  };
  function renderBar() {
    const el = document.getElementById('audio-player'); if (!el) return;
    el.classList.toggle('is-playing', playing);
    el.innerHTML = `<div class="player-main">
      <button class="pl-btn pl-play" data-audio="toggle" aria-label="${playing ? 'Pause' : 'Play'} background sound">${playing ? '❚❚' : '▶'}</button>
      <canvas class="pl-viz" aria-hidden="true"></canvas>
      <div class="pl-text"><strong>${label()}</strong><small>${panelMessage || (playing ? (sleepLeft() ? `Stops in ${sleepLeft()} min` : 'Playing') : 'Sound is off · press play')}</small></div>
      <label class="pl-vol"><span class="sr-only">Master volume</span><input type="range" min="0" max="1" step="0.01" value="${E.settings.master}" data-audio="master" aria-label="Master volume"></label>
      <a class="pl-open" href="#/sounds" aria-label="Open sound mixer">Mixer<span aria-hidden="true"> →</span></a>
    </div>`;
    watch(el.querySelector('.pl-viz'), 'bars');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-audio]')?.dataset.audio;
    if (a === 'toggle') toggle();
  });
  document.addEventListener('input', e => {
    if (e.target.dataset.audio === 'master') { E.unlock(); E.setMaster(+e.target.value); document.querySelectorAll('[data-audio="master"]').forEach(x => { if (x !== e.target) x.value = e.target.value; }); }
  });
  /* If the browser suspends audio (e.g. phone call, tab sleep), resume on the next tap. */
  document.addEventListener('pointerdown', () => { if (playing && E.ctx?.state === 'suspended') E.unlock(); }, { passive: true });

  /* ---------- Compatibility with the rest of the app ---------- */
  const resolve = nameOrId => S.byId[nameOrId] ? nameOrId : S.legacy[nameOrId] || S.SCAPES.find(s => s.name === nameOrId)?.id;
  function playTrack(name) { const id = resolve(name); if (id) solo(id); }
  function select(name) { const id = resolve(name); if (!id) return; if (!favourites.includes(id)) toggleFavourite(id); if (!playing) { mix.on = [id]; save(); emit(); } }

  return {
    render: renderBar, play, pause, toggle, stop, setLayer, setVolume, applyMix, solo, playTrack, select, setSleep, sleepLeft,
    toggleFavourite, saveCustom, deleteCustom, watch, subscribe: fn => (listeners.add(fn), () => listeners.delete(fn)),
    get playing() { return playing; }, get mix() { return mix; }, isLive: id => live.has(id), volOf,
    get favourites() { return favourites; }, get recent() { return recent; }, get custom() { return custom; },
    get tracks() { return S.SCAPES.map(s => s.name); },
    get state() { return { track: S.byId[mix.on[0]]?.name || 'Gentle Rain', playing }; }
  };
})();
