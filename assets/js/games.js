/* The six quiet games. Each game is a module with the same shape:
     mount(stage, api) -> { pause(), resume(), destroy() }
   `api` (provided by the game shell in pages/play.js) gives:
     level ('Gentle' | 'Steady' | 'Focused'), reduced (reduced motion),
     sfx(name), progress(text), complete({ title, text, extra }), controls(html) -> element.
   No timers, no scores, no penalties. Goals are gentle and the person can stop any time. */
const PauseGames = (() => {
  'use strict';
  const R = Math.random;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Shared helper: a resizing, high-DPI canvas. */
  function hiDPI(canvas, onResize) {
    const fit = () => { const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); onResize?.(w, h); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(canvas);
    return () => ro.disconnect();
  }

  /* ---------- 1. Catch the Fireflies ---------- */
  const fireflies = {
    mount(stage, api) {
      const cfg = { Gentle: { count: 14, speed: 0.55, size: 1.3, goal: 10 }, Steady: { count: 22, speed: 1, size: 1, goal: 18 }, Focused: { count: 30, speed: 1.6, size: 0.82, goal: 25 } }[api.level];
      stage.innerHTML = '<canvas class="game-canvas" tabindex="0" aria-label="Night sky with fireflies. Tap a firefly to let it drift away, or press Enter."></canvas>';
      const canvas = stage.firstChild, c = canvas.getContext('2d');
      let w = 0, h = 0, flies = [], sparks = [], released = 0, paused = false, raf = 0, done = false;
      const stars = Array.from({ length: 60 }, () => ({ x: R(), y: R() * 0.6, r: R() * 1.2 + 0.3, p: R() * 6 }));
      const k = api.reduced ? 0.3 : 1;
      const fly = (fade) => ({ x: R() * w, y: 90 + R() * Math.max(10, h - 160), vx: (R() - 0.5) * 0.55 * cfg.speed, vy: (R() - 0.5) * 0.45 * cfg.speed, r: (2 + R() * 2) * cfg.size, p: R() * 6.28, a: fade ? 0 : 1, wob: R() * 6 });
      const unfit = hiDPI(canvas, (W, H) => { const first = !w; w = W; h = H; if (first) flies = Array.from({ length: cfg.count }, () => fly()); });
      api.progress(`0 of ${cfg.goal} drifted away`);
      function draw() {
        const t = performance.now() / 1000;
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#141f38'); g.addColorStop(0.7, '#182a3a'); g.addColorStop(1, '#13262b');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        stars.forEach(s => { c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.8 * k + s.p); c.fillStyle = '#e8e6f5'; c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, 7); c.fill(); });
        c.globalAlpha = 1;
        const mg = c.createRadialGradient(w * 0.8, h * 0.16, 10, w * 0.8, h * 0.16, 110); mg.addColorStop(0, '#f4efd9'); mg.addColorStop(0.3, '#e9e3cc'); mg.addColorStop(0.31, 'rgba(233,227,204,.18)'); mg.addColorStop(1, 'rgba(233,227,204,0)');
        c.fillStyle = mg; c.beginPath(); c.arc(w * 0.8, h * 0.16, 110, 0, 7); c.fill();
        /* grass that sways a little */
        for (let i = 0; i < 26; i++) {
          const x = (i + 0.5) * w / 26, sway = Math.sin(t * 0.7 * k + i) * 8;
          c.strokeStyle = i % 2 ? '#2a5244' : '#21443a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, h);
          c.quadraticCurveTo(x + sway, h - 70 - (i % 4) * 18, x + sway * 1.6 + (i % 2 ? 12 : -10), h - 120 - (i % 3) * 30); c.stroke();
        }
        for (const f of flies) {
          if (!paused) { f.x += f.vx * k + Math.sin(t + f.wob) * 0.15 * k; f.y += f.vy * k; f.p += 0.03 * k; f.a = Math.min(1, f.a + 0.012); }
          if (f.x < 10 || f.x > w - 10) f.vx *= -1; if (f.y < 70 || f.y > h - 40) f.vy *= -1;
          const glow = (5 + Math.sin(f.p) * 3) * cfg.size, gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, glow * 3.2);
          gr.addColorStop(0, '#fff4b4'); gr.addColorStop(0.25, 'rgba(246,223,123,.55)'); gr.addColorStop(1, 'rgba(246,223,123,0)');
          c.globalAlpha = f.a; c.fillStyle = gr; c.beginPath(); c.arc(f.x, f.y, glow * 3.2, 0, 7); c.fill();
          c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill(); c.globalAlpha = 1;
        }
        sparks = sparks.filter(s => s.life > 0);
        sparks.forEach(s => { if (!paused) { s.life--; s.x += s.vx; s.y += s.vy; s.vy -= 0.02; } c.globalAlpha = s.life / 50; c.fillStyle = '#fae8a3'; c.beginPath(); c.arc(s.x, s.y, 1.8, 0, 7); c.fill(); });
        c.globalAlpha = 1;
        raf = requestAnimationFrame(draw);
      }
      draw();
      function release(i) {
        if (paused || done) return;
        const f = flies.splice(i, 1)[0];
        if (!api.reduced) for (let n = 0; n < 18; n++) sparks.push({ x: f.x, y: f.y, vx: (R() - 0.5) * 2.6, vy: (R() - 0.7) * 2.6, life: 50 });
        released++; api.sfx('sparkle');
        api.progress(`${released} of ${cfg.goal} drifted away`);
        if (released >= cfg.goal) { done = true; setTimeout(() => api.complete({ title: 'The night is quiet now', text: `You let ${released} fireflies drift up into the sky.` }), 900); return; }
        setTimeout(() => { if (!done) flies.push(fly(true)); }, 1200 + R() * 1500);
      }
      const hit = e => {
        const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, reach = (e.pointerType === 'touch' ? 46 : 34) * Math.max(1, cfg.size);
        let best = -1, bd = reach;
        flies.forEach((f, i) => { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) release(best);
      };
      const key = e => {
        if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault();
        if (!flies.length) return;
        let best = 0, bd = Infinity; flies.forEach((f, i) => { const d = Math.hypot(f.x - w / 2, f.y - h / 2); if (d < bd) { bd = d; best = i; } });
        release(best);
      };
      canvas.addEventListener('pointerdown', hit); canvas.addEventListener('keydown', key);
      return { pause() { paused = true; }, resume() { paused = false; }, destroy() { cancelAnimationFrame(raf); unfit(); canvas.removeEventListener('pointerdown', hit); canvas.removeEventListener('keydown', key); } };
    }
  };

  /* ---------- 2. Bubble Pop ---------- */
  const bubbles = {
    mount(stage, api) {
      const cfg = { Gentle: { every: 1300, speed: 16, scale: 1.2, goal: 15 }, Steady: { every: 900, speed: 12, scale: 1, goal: 25 }, Focused: { every: 600, speed: 8.5, scale: 0.82, goal: 40 } }[api.level];
      stage.innerHTML = '<div class="bubbles-stage" role="application" aria-label="Bubbles floating upward. Tap or press Enter on a bubble to pop it."><div class="bubble-sky"></div></div>';
      const box = stage.firstChild;
      let popped = 0, paused = false, done = false, spawner = 0;
      api.progress(`0 of ${cfg.goal} popped`);
      function spawn() {
        if (paused || done || !box.isConnected) return;
        if (box.querySelectorAll('.bubble:not(.popping)').length > 18) return;
        const b = document.createElement('button');
        const sz = (36 + R() * 70) * cfg.scale;
        b.className = 'bubble' + (api.reduced ? ' still' : '');
        b.setAttribute('aria-label', 'Bubble');
        b.style.cssText = `--sz:${sz}px;--x:${4 + R() * 86}%;--dur:${cfg.speed * (0.8 + R() * 0.4)}s;--sway:${(R() - 0.5) * 60}px;--hue:${190 + R() * 90}`;
        if (api.reduced) { b.style.top = `${15 + R() * 65}%`; setTimeout(() => b.isConnected && !b.classList.contains('popping') && b.remove(), 9000); }
        b.addEventListener('animationend', ev => { if (ev.animationName === 'rise') b.remove(); });
        box.appendChild(b);
      }
      function pop(b) {
        if (paused || done || b.classList.contains('popping')) return;
        b.classList.add('popping'); b.disabled = true;
        const r = b.getBoundingClientRect(), br = box.getBoundingClientRect();
        const burst = document.createElement('span'); burst.className = 'pop-burst';
        burst.style.cssText = `left:${r.left - br.left + r.width / 2}px;top:${r.top - br.top + r.height / 2}px;--sz:${r.width}px`;
        burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
        box.appendChild(burst); setTimeout(() => burst.remove(), 600);
        setTimeout(() => b.remove(), 220);
        popped++; api.sfx('pop');
        api.progress(`${popped} of ${cfg.goal} popped`);
        if (popped >= cfg.goal) { done = true; setTimeout(() => api.complete({ title: 'Light as air', text: `You popped ${popped} bubbles. The rest can float away on their own.` }), 700); }
      }
      const onDown = e => { const b = e.target.closest('.bubble'); if (b) pop(b); };
      box.addEventListener('pointerdown', onDown);
      box.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.bubble')) { e.preventDefault(); pop(e.target.closest('.bubble')); } });
      for (let i = 0; i < 5; i++) setTimeout(spawn, i * 250);
      spawner = setInterval(spawn, cfg.every);
      return {
        pause() { paused = true; box.classList.add('paused'); },
        resume() { paused = false; box.classList.remove('paused'); },
        destroy() { clearInterval(spawner); box.removeEventListener('pointerdown', onDown); }
      };
    }
  };

  /* ---------- 3. Fluid Art ---------- */
  const fluid = {
    mount(stage, api) {
      const palettes = { Ocean: ['#83c5d6', '#537aa1', '#d2ece2', '#416274'], Lavender: ['#b8a8d5', '#796d9f', '#e4cfda', '#9c83bc'], Sunset: ['#e99e84', '#d07776', '#f2d7a8', '#a95772'], Sage: ['#a7c4a0', '#758e79', '#e4dcc4', '#57756b'], Night: ['#3f5a8a', '#8fa6d6', '#c8bce8', '#f6e3a4'] };
      const BG = '#17233b';
      stage.innerHTML = '<canvas class="game-canvas" aria-label="Painting canvas. Drag to paint slow colour trails."></canvas>';
      const canvas = stage.firstChild, c = canvas.getContext('2d');
      let w = 0, h = 0, paused = false, raf = 0, down = false, last = null, strokes = 0, lastTap = 0;
      const st = { palette: 'Lavender', brush: 30, flow: 5, mirror: 0, fade: false };
      const unfit = hiDPI(canvas, (W, H) => { w = W; h = H; c.fillStyle = BG; c.fillRect(0, 0, w, h); });
      const ctrl = api.controls(`
        <div class="chip-row" role="group" aria-label="Palette">${Object.keys(palettes).map(p => `<button class="swatch ${p === st.palette ? 'selected' : ''}" data-pal="${p}" aria-label="${p} palette" style="--a:${palettes[p][0]};--b:${palettes[p][1]}"></button>`).join('')}</div>
        <label>Brush <input type="range" min="6" max="70" value="30" data-k="brush"></label>
        <label>Flow <input type="range" min="1" max="10" value="5" data-k="flow"></label>
        <label>Mirror <select data-k="mirror"><option value="0">Off</option><option value="2">2-way</option><option value="4">4-way</option><option value="6">6-way</option></select></label>
        <label><input type="checkbox" data-k="fade"> Slow fade</label>
        <button class="btn-ghost btn-small" data-act="clear">Clear</button>
        <button class="btn-main btn-small" data-act="finish">I’m finished</button>`);
      ctrl.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; st[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value; });
      ctrl.addEventListener('click', e => {
        const p = e.target.closest('[data-pal]'); if (p) { st.palette = p.dataset.pal; ctrl.querySelectorAll('[data-pal]').forEach(x => x.classList.toggle('selected', x === p)); api.sfx('select'); }
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (a === 'clear') { c.fillStyle = BG; c.fillRect(0, 0, w, h); api.sfx('whoosh'); }
        if (a === 'finish') finish();
      });
      const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      function dab(x, y) {
        const colors = palettes[st.palette], n = st.mirror || 1, cx = w / 2, cy = h / 2;
        for (let m = 0; m < n; m++) {
          let px = x, py = y;
          if (n === 2 && m === 1) px = w - x; // left-right mirror
          else if (n > 2) { const ang = Math.atan2(y - cy, x - cx) + (m * 2 * Math.PI) / n, rad = Math.hypot(x - cx, y - cy); px = cx + Math.cos(ang) * rad; py = cy + Math.sin(ang) * rad; } // kaleidoscope
          c.globalAlpha = Math.min(0.9, 0.06 + st.flow * 0.05);
          c.fillStyle = colors[Math.floor(R() * colors.length)];
          c.beginPath(); c.arc(px, py, st.brush * (0.4 + R() * 0.9), 0, 7); c.fill();
        }
        c.globalAlpha = 1;
      }
      function paint(e) {
        if (paused) return;
        const p = pos(e);
        if (last) { const dist = Math.hypot(p.x - last.x, p.y - last.y), steps = Math.max(1, Math.floor(dist / 5)); for (let i = 0; i < steps; i++) { const t = i / steps; dab(last.x + (p.x - last.x) * t, last.y + (p.y - last.y) * t); } }
        else dab(p.x, p.y);
        last = p;
      }
      const start = e => { if (paused) return; down = true; last = null; canvas.setPointerCapture?.(e.pointerId); strokes++; if (performance.now() - lastTap > 900) { api.sfx('tap'); lastTap = performance.now(); } paint(e); };
      const move = e => { if (down) paint(e); };
      const end = () => { down = false; last = null; };
      canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      (function loop() { if (st.fade && !paused) { c.globalAlpha = 0.012; c.fillStyle = BG; c.fillRect(0, 0, w, h); c.globalAlpha = 1; } raf = requestAnimationFrame(loop); })();
      api.progress('Paint as long as you like');
      function finish() {
        const img = canvas.toDataURL('image/png');
        api.complete({ title: 'A little artwork, just for you', text: strokes ? 'There’s no right way to make something calm.' : 'Even a blank canvas can be restful.', extra: `<img class="art-thumb" src="${img}" alt="Your fluid art"><a class="btn-soft btn-small" download="pause-fluid-art.png" href="${img}">Save image</a>` });
      }
      return { pause() { paused = true; down = false; }, resume() { paused = false; }, destroy() { cancelAnimationFrame(raf); unfit(); ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) => canvas.removeEventListener(ev, [start, move, end, end][i])); } };
    }
  };

  /* ---------- 4. Bubble Wrap ---------- */
  const wrap = {
    mount(stage, api) {
      const [n, cols] = { Gentle: [35, 7], Steady: [63, 9], Focused: [99, 11] }[api.level];
      stage.innerHTML = `<div class="wrap-wrap"><div class="wrap-sheet" style="--cols:${cols}" role="group" aria-label="Bubble wrap sheet. Press and drag to pop several at once.">${Array.from({ length: n }, (_, i) => `<button class="wrap-dot" aria-label="Bubble ${i + 1}"></button>`).join('')}</div></div>`;
      const sheet = stage.querySelector('.wrap-sheet');
      let left = n, paused = false, dragging = false;
      api.progress(`${left} bubbles left`);
      function pop(b) {
        if (!b || paused || b.classList.contains('popped')) return;
        b.classList.add('popped'); b.setAttribute('aria-label', 'Popped'); left--;
        api.sfx('pop'); api.progress(left ? `${left} bubble${left > 1 ? 's' : ''} left` : 'All popped');
        if (!left) setTimeout(() => api.complete({ title: 'Every last one', text: `You popped all ${n} bubbles, at your own pace.` }), 600);
      }
      const down = e => { const b = e.target.closest('.wrap-dot'); if (!b) return; dragging = true; sheet.setPointerCapture?.(e.pointerId); pop(b); };
      const move = e => { if (!dragging) return; pop(document.elementFromPoint(e.clientX, e.clientY)?.closest('.wrap-dot')); };
      const up = () => { dragging = false; };
      sheet.addEventListener('pointerdown', down); sheet.addEventListener('pointermove', move); sheet.addEventListener('pointerup', up); sheet.addEventListener('pointercancel', up);
      sheet.addEventListener('click', e => { if (e.detail === 0) pop(e.target.closest('.wrap-dot')); }); // keyboard activation
      return { pause() { paused = true; }, resume() { paused = false; }, destroy() { } };
    }
  };

  /* ---------- 5. Five Senses ---------- */
  const SENSES = [['👁', 'see', 'Look around and gently notice them. You do not need to close your eyes.'], ['✋', 'feel', 'Notice comfortable sensations, like your feet on the floor or the fabric of your clothes.'], ['👂', 'hear', 'Listen for sounds, near or far. Even quiet ones count.'], ['🌸', 'smell', 'Notice scents around you, or think of smells you like.'], ['☕', 'taste', 'Notice a taste, or choose another comfortable sensation.']];
  const grounding = {
    mount(stage, api) {
      const short = api.level === 'Gentle';
      const steps = (short ? SENSES.slice(0, 3) : SENSES).map((s, i, a) => ({ icon: s[0], count: a.length - i, verb: s[1], copy: s[2] }));
      const notes = [];
      let step = 0, paused = false;
      stage.innerHTML = '<div class="sense-wrap"><div class="sense-card surface" aria-live="polite"></div></div>';
      const card = stage.querySelector('.sense-card');
      function paint(dir = 1) {
        const s = steps[step];
        api.progress(`Step ${step + 1} of ${steps.length}`);
        card.classList.remove('in-left', 'in-right'); void card.offsetWidth; card.classList.add(dir > 0 ? 'in-right' : 'in-left');
        card.innerHTML = `<div class="sense-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}"></i>`).join('')}</div>
          <div class="sense-icon" aria-hidden="true">${s.icon}</div>
          <h2 tabindex="-1">${s.count} thing${s.count > 1 ? 's' : ''} you can ${s.verb}</h2><p>${s.copy}</p>
          <label class="sr-only" for="sense-note">Optional notes</label><textarea class="input" id="sense-note" placeholder="Optional: jot them down">${esc(notes[step] || '')}</textarea>
          <div class="row-gap mt-3">${step ? '<button class="btn-line" data-g="back">← Back</button>' : ''}<button class="btn-line" data-g="skip">Skip</button><button class="btn-main" data-g="next">${step === steps.length - 1 ? 'Finish' : 'Next →'}</button></div>`;
        card.querySelector('h2').focus({ preventScroll: true });
      }
      const onClick = e => {
        const a = e.target.closest('[data-g]')?.dataset.g; if (!a || paused) return;
        notes[step] = a === 'skip' ? notes[step] || '' : card.querySelector('#sense-note').value.trim();
        if (a === 'back') { step--; return paint(-1); }
        api.sfx('step');
        if (step < steps.length - 1) { step++; return paint(1); }
        const list = steps.map((s, i) => notes[i] ? `<li><strong>${s.count} to ${s.verb}:</strong> ${esc(notes[i])}</li>` : '').join('');
        api.complete({ title: 'Welcome back to this moment', text: 'You noticed your surroundings one sense at a time. That is grounding.', extra: list ? `<ul class="sense-summary">${list}</ul>` : '', journal: list ? steps.map((s, i) => notes[i] ? `${s.count} to ${s.verb}: ${notes[i]}` : '').filter(Boolean).join('\n') : '' });
      };
      card.addEventListener('click', onClick);
      paint();
      return { pause() { paused = true; }, resume() { paused = false; }, destroy() { card.removeEventListener('click', onClick); } };
    }
  };

  /* ---------- 6. Alphabet Categories ---------- */
  const CATS = {
    Gentle: ['Something in nature', 'An animal', 'A food', 'Something soft', 'A colour you like'],
    Steady: ['Something in nature', 'An animal', 'A food', 'A place', 'An object at home', 'Something blue', 'A drink'],
    Focused: ['A country', 'A book or film', 'A job', 'An action word', 'Something that makes you smile', 'A city', 'Something in a kitchen', 'A hobby', 'A musical instrument']
  };
  const NUDGE = { 'An animal': 'Think of a zoo, a farm, or the sea.', 'A food': 'Think of breakfast, a snack, or a festival dish.', 'A place': 'A room, a city, or somewhere you’ve been.', 'A country': 'Picture a world map, or a cricket team.', 'A city': 'Cities you’ve visited, or seen in films.', 'Something in nature': 'Look out of a window, or picture a garden.', 'A job': 'Who did you see working this week?', 'An action word': 'Something you can do: run, read, rest…', 'A hobby': 'Something people do for fun.' };
  const alphabet = {
    mount(stage, api) {
      const rounds = { Gentle: 5, Steady: 8, Focused: 12 }[api.level], cats = CATS[api.level];
      const letters = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('').sort(() => R() - 0.5);
      const answers = [];
      let round = 0, paused = false;
      stage.innerHTML = `<div class="alpha-wrap"><div class="alpha-card surface">
        <div class="eyebrow" id="a-cat"></div>
        <div class="alpha-letter" aria-live="polite"><span id="a-letter"></span></div>
        <p class="muted small">Think of an answer, or type one. No timer, no wrong answers.</p>
        <label class="sr-only" for="a-answer">Your answer</label><input class="input" id="a-answer" autocomplete="off" placeholder="Your answer (optional)">
        <p class="small muted" id="a-hint" aria-live="polite"></p>
        <div class="row-gap center"><button class="btn-line" data-g="hint">Hint</button><button class="btn-line" data-g="skip">Skip</button><button class="btn-main" data-g="next">Next →</button></div>
      </div></div>`;
      const $ = s => stage.querySelector(s);
      function deal() {
        const L = letters[round % letters.length], cat = cats[Math.floor(R() * cats.length)];
        $('#a-cat').textContent = cat; $('#a-hint').textContent = ''; $('#a-answer').value = '';
        const el = $('#a-letter'); el.classList.remove('flip'); void el.offsetWidth; el.textContent = L; el.classList.add('flip');
        api.progress(`Letter ${round + 1} of ${rounds}`);
        $('#a-answer').focus({ preventScroll: true });
      }
      const onClick = e => {
        const a = e.target.closest('[data-g]')?.dataset.g; if (!a || paused) return;
        if (a === 'hint') { const cat = $('#a-cat').textContent; $('#a-hint').textContent = `${NUDGE[cat] || 'Say the first thing that comes to mind.'} Starts with “${$('#a-letter').textContent}”.`; return; }
        const ans = $('#a-answer').value.trim();
        if (a === 'next' && ans) answers.push({ l: $('#a-letter').textContent, cat: $('#a-cat').textContent, ans });
        api.sfx(a === 'next' ? 'select' : 'tap');
        round++;
        if (round >= rounds) return api.complete({ title: 'A playful little pause', text: answers.length ? `You found ${answers.length} word${answers.length > 1 ? 's' : ''}. Every answer counts.` : 'You let your mind wander through the alphabet.', extra: answers.length ? `<div class="word-cloud">${answers.map(x => `<span title="${esc(x.cat)}"><b>${esc(x.l)}</b> ${esc(x.ans)}</span>`).join('')}</div>` : '' });
        deal();
      };
      const onKey = e => { if (e.key === 'Enter' && e.target.id === 'a-answer') { e.preventDefault(); stage.querySelector('[data-g="next"]').click(); } };
      stage.addEventListener('click', onClick); stage.addEventListener('keydown', onKey);
      deal();
      return { pause() { paused = true; }, resume() { paused = false; }, destroy() { stage.removeEventListener('click', onClick); stage.removeEventListener('keydown', onKey); } };
    }
  };

  /* Information shown on the hub and intro screens. */
  const INFO = {
    fireflies: { minutes: '3–5', rules: ['Fireflies drift across a quiet night sky.', 'Tap one (or press Enter) and it floats up and away.', 'There’s no rush: new ones arrive slowly.'], paces: { Gentle: 'Fewer, slower, bigger fireflies · 10 to release', Steady: 'A gentle meadow · 18 to release', Focused: 'Smaller and livelier · 25 to release' } },
    bubbles: { minutes: '2–4', rules: ['Bubbles rise slowly from the bottom.', 'Tap any bubble to pop it. Missed ones just float away.', 'Stop whenever you like.'], paces: { Gentle: 'Large, slow bubbles · pop 15', Steady: 'A soft stream · pop 25', Focused: 'Smaller and quicker · pop 40' } },
    fluid: { minutes: 'Any', rules: ['Drag your finger or mouse to paint slow colour trails.', 'Try a palette, brush size, or mirror mode for patterns.', 'Press “I’m finished” whenever it feels done, and save it if you like.'], paces: null },
    wrap: { minutes: '2–5', rules: ['A fresh sheet of bubble wrap.', 'Tap bubbles to pop them, or press and drag across a row.', 'Pop as many as you like. The sheet is done when every bubble is popped.'], paces: { Gentle: 'Small sheet · 35 bubbles', Steady: 'Medium sheet · 63 bubbles', Focused: 'Large sheet · 99 bubbles' } },
    grounding: { minutes: '3–5', rules: ['A gentle 5–4–3–2–1 exercise using your senses.', 'Notice things you can see, feel, hear, smell and taste.', 'Writing them down is optional. Skip any step.'], paces: { Gentle: 'Short version: 3–2–1', Steady: 'Full version: 5–4–3–2–1', Focused: 'Full version: 5–4–3–2–1' } },
    alphabet: { minutes: '3–6', rules: ['You get a letter and a category, e.g. “M · A food”.', 'Think of an answer, or type it if you like.', 'Skip freely. There are no wrong answers.'], paces: { Gentle: 'Easy categories · 5 letters', Steady: 'Everyday categories · 8 letters', Focused: 'Trickier categories · 12 letters' } }
  };

  return { modules: { fireflies, bubbles, fluid, wrap, grounding, alphabet }, INFO };
})();
