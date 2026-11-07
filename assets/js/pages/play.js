/* Play: the games hub ("Take a Little Break"), the shared game shell
   (intro → playing ⇄ paused → complete), play progress, and guided moments.
   Nothing here is scored or timed; progress is a private record, not a streak. */
(function (P) {
  'use strict';
  const { esc, safeLS, uid, DAY, fmtDate, fmtTime, dailyPick } = P.util;
  const C = P.catalog;
  const PACES = ['Gentle', 'Steady', 'Focused'];
  const LS = (k, d) => { try { return JSON.parse(safeLS.get(k, 'null')) ?? d; } catch { return d; } };
  const levelOf = id => LS('pause-game-levels', {})[id] || 'Steady';
  const setLevel = (id, v) => safeLS.set('pause-game-levels', JSON.stringify({ ...LS('pause-game-levels', {}), [id]: v }));
  const favs = () => LS('pause-game-favs', []);
  const toggleFav = id => { const f = favs(); safeLS.set('pause-game-favs', JSON.stringify(f.includes(id) ? f.filter(x => x !== id) : [...f, id])); };
  const mins = s => s >= 60 ? `${Math.round(s / 60)} min` : `${Math.max(1, Math.round(s))} sec`;

  /* CSS-drawn illustration for each game (no image files). */
  const art = id => `<div class="g-art g-art-${id}" aria-hidden="true">${{
    fireflies: '<span class="moon"></span>' + Array.from({ length: 9 }, (_, i) => `<i style="--i:${i};left:${8 + i * 10}%;top:${28 + (i * 37) % 50}%"></i>`).join(''),
    bubbles: Array.from({ length: 6 }, (_, i) => `<i style="--i:${i};left:${6 + i * 15}%;bottom:${8 + (i * 23) % 55}%"></i>`).join(''),
    fluid: '<i></i><i></i><i></i>',
    wrap: Array.from({ length: 15 }, (_, i) => `<i class="${[2, 6, 7, 11].includes(i) ? 'p' : ''}"></i>`).join(''),
    grounding: '<span class="leaf"></span>' + Array.from({ length: 5 }, (_, i) => `<i style="--i:${i}"></i>`).join(''),
    alphabet: '<b>A</b><b>m</b><b>z</b>'
  }[id]}</div>`;

  async function playStats() {
    const acts = (await P.data.activity()).filter(a => a.kind === 'game');
    const per = {};
    acts.forEach(a => { const id = a.ref.split(':')[1]; const s = per[id] ||= { times: 0, secs: 0, last: 0, done: 0 }; s.times++; s.secs += a.seconds || 0; s.last = Math.max(s.last, a.created); if (a.completed) s.done++; });
    return { acts, per, total: acts.reduce((t, a) => t + (a.seconds || 0), 0) };
  }

  /* ---------- Hub ---------- */
  P.route('play', async (view, [gameId]) => {
    if (gameId) return gameShell(view, gameId);
    const { acts, per, total } = await playStats();
    const F = favs();
    const featured = dailyPick(C.GAMES, 'game');
    const recentIds = [...new Set(acts.map(a => a.ref.split(':')[1]))].filter(id => C.GAMES.some(g => g.id === id)).slice(0, 4);
    const most = Object.entries(per).sort((a, b) => b[1].times - a[1].times)[0];
    const info = id => PauseGames.INFO[id];

    const card = g => `<article class="g-card" data-game="${g.id}">
      ${art(g.id)}
      <div class="g-body">
        <div class="g-meta"><span>⏱ ${info(g.id).minutes} min</span>${info(g.id).paces ? `<span>Pace · ${levelOf(g.id)}</span>` : '<span>Free play</span>'}</div>
        <h3>${esc(g.title)}</h3>
        <p class="muted">${esc(g.about)}</p>
        <div class="g-foot">
          <a class="g-play" href="#/play/${g.id}" aria-label="Play ${esc(g.title)}"><span aria-hidden="true">▶</span> Play</a>
          <span class="small muted">${per[g.id] ? `Played ${per[g.id].times}×` : 'New to you'}</span>
          <button class="icon-btn ${F.includes(g.id) ? 'on' : ''}" data-gfav="${g.id}" aria-pressed="${F.includes(g.id)}" aria-label="${F.includes(g.id) ? 'Remove from' : 'Add to'} favourites: ${esc(g.title)}">${F.includes(g.id) ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;

    view.innerHTML = `<main class="content play-hub">
      <section class="hub-hero">
        <div class="hub-deco" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="eyebrow">Play, gently</div>
        <h1 class="page-title">Take a Little Break</h1>
        <p class="lead muted">Six quiet games with no timers, no scores and nothing to win. Choose whatever feels good, and stop whenever you like.</p>
      </section>

      <section class="featured" aria-labelledby="feat-h">
        ${art(featured.id)}
        <div class="feat-body">
          <div class="eyebrow">Game of the day</div>
          <h2 id="feat-h">${esc(featured.title)}</h2>
          <p class="muted">${esc(featured.about)}</p>
          <ul class="feat-rules">${info(featured.id).rules.slice(0, 2).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
          <a class="g-play big" href="#/play/${featured.id}"><span aria-hidden="true">▶</span> Play now · ${info(featured.id).minutes} min</a>
        </div>
      </section>

      ${recentIds.length ? `<section class="mt-4"><h2 class="h3">Recently played</h2><div class="recent-games">${recentIds.map(id => { const g = C.GAMES.find(x => x.id === id); return `<a class="recent-game" href="#/play/${id}">${art(id)}<span><strong>${esc(g.title)}</strong><small class="muted">${fmtDate(per[id].last, { weekday: 'short', month: 'short', day: 'numeric' })}</small></span></a>`; }).join('')}</div></section>` : ''}

      <section class="mt-4"><h2 class="section-sub">All games</h2><div class="g-grid">${C.GAMES.map(card).join('')}</div></section>

      <section class="mt-5">
        <h2 class="section-sub">Small guided moments</h2>
        <p class="muted">Two to five minutes, step by step.</p>
        <div class="routine-grid">${C.ROUTINES.map(r => `<a class="routine-card" href="#/routine/${r.id}"><span class="rec-icon" aria-hidden="true">${r.icon}</span><span><strong>${esc(r.title)}</strong><span class="muted small d-block">${r.minutes} min · ${esc(r.about)}</span></span></a>`).join('')}</div>
      </section>

      <details class="surface play-journal mt-5" ${acts.length ? '' : ''}>
        <summary><strong>Your play journal</strong> <span class="muted small">· private, just a record. No streaks.</span></summary>
        ${acts.length ? `<div class="stat-tiles">
            <div><span class="big-soft">${acts.length}</span><small class="muted">games played</small></div>
            <div><span class="big-soft">${mins(total)}</span><small class="muted">spent playing</small></div>
            <div><span class="big-soft">${Object.values(per).reduce((t, s) => t + s.done, 0)}</span><small class="muted">games finished</small></div>
            <div><span class="big-soft small-text">${most ? esc(C.GAMES.find(g => g.id === most[0])?.title || '') : '—'}</span><small class="muted">played most</small></div>
          </div>
          <h3 class="h4 mt-3">Favourites</h3>
          <p>${F.length ? F.map(id => `<a class="pill" href="#/play/${id}">${esc(C.GAMES.find(g => g.id === id)?.title)}</a>`).join(' ') : '<span class="muted small">Tap ♡ on a game to keep it here.</span>'}</p>
          <h3 class="h4 mt-3">History</h3>
          <ul class="mini-list">${acts.slice(0, 12).map(a => `<li><span>${esc(a.title)}${a.completed ? ' <span class="badge-soft">finished</span>' : ''}</span><span class="muted small">${fmtDate(a.created, { month: 'short', day: 'numeric' })} ${fmtTime(a.created)} · ${mins(a.seconds || 0)}</span></li>`).join('')}</ul>`
          : '<p class="muted mt-2">Games you play will be noted here, only on this device.</p>'}
      </details>
      <p class="footer-note">You can stop or switch at any time.</p>
    </main>`;

    view.addEventListener('click', e => {
      const f = e.target.closest('[data-gfav]');
      if (f) { e.preventDefault(); toggleFav(f.dataset.gfav); const on = favs().includes(f.dataset.gfav); f.classList.toggle('on', on); f.textContent = on ? '♥' : '♡'; f.setAttribute('aria-pressed', on); PauseEngine.sfx('tap'); }
    });
  });

  /* ---------- Game shell ---------- */
  function gameShell(view, id) {
    const g = C.GAMES.find(x => x.id === id);
    if (!g) return P.go('play');
    const info = PauseGames.INFO[id], mod = PauseGames.modules[id];
    let instance = null, state = 'intro', started = 0, pausedAt = 0, pausedMs = 0, logged = false;

    view.innerHTML = `<main class="content content-wide">
      <div class="game-shell" data-state="intro">
        <header class="gs-bar">
          <a class="gs-exit" href="#/play" aria-label="Exit to games">←</a>
          <div class="gs-title"><strong>${esc(g.title)}</strong><small id="gs-progress" aria-live="polite"></small></div>
          <div class="gs-actions">
            <button class="gs-btn" data-gs="sound" aria-pressed="${PauseEngine.settings.sfx}" title="Game sounds">${PauseEngine.settings.sfx ? '🔔' : '🔕'}<span class="sr-only">Game sounds</span></button>
            <button class="gs-btn" data-gs="restart" title="Restart">↻<span class="sr-only">Restart</span></button>
            <button class="gs-btn gs-pause" data-gs="pause" title="Pause">❚❚<span class="sr-only">Pause</span></button>
          </div>
        </header>
        <div class="gs-stage ${id === 'bubbles' ? 'stage-sky' : ''} ${['grounding', 'alphabet', 'wrap'].includes(id) ? 'stage-soft' : ''}" id="gs-stage"></div>
        <div class="gs-controls" id="gs-controls" hidden></div>

        <div class="gs-overlay gs-intro" role="dialog" aria-labelledby="gi-h">
          <div class="gs-panel">
            ${art(id)}
            <div class="eyebrow">A moment for you · ${info.minutes} min</div>
            <h1 id="gi-h" class="page-title">${esc(g.title)}</h1>
            <ul class="gs-rules">${info.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            ${info.paces ? `<div class="gs-pace"><span class="field-label">Pace</span><div class="seg" role="radiogroup" aria-label="Pace">${PACES.map(p => `<button role="radio" aria-checked="${p === levelOf(id)}" class="seg-btn ${p === levelOf(id) ? 'active' : ''}" data-pace="${p}">${p}</button>`).join('')}</div><small class="muted" id="pace-note">${esc(info.paces[levelOf(id)])}</small></div>` : ''}
            <label class="switch mt-2"><input type="checkbox" data-gs-sfx ${PauseEngine.settings.sfx ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Soft sound effects</label>
            <div class="row-gap center mt-3"><button class="btn-main btn-lg" data-gs="start">Begin <span aria-hidden="true">→</span></button><a class="btn-line" href="#/play">Choose another</a></div>
          </div>
        </div>

        <div class="gs-overlay gs-paused" role="dialog" aria-labelledby="gp-h">
          <div class="gs-panel small">
            <div class="pause-orb" aria-hidden="true"></div>
            <h2 id="gp-h">Paused</h2><p class="muted">Take your time. Everything will be right where you left it.</p>
            <div class="row-gap center"><button class="btn-main" data-gs="resume">Resume</button><button class="btn-line" data-gs="restart">Restart</button><a class="btn-line" href="#/play">Exit</a></div>
          </div>
        </div>

        <div class="gs-overlay gs-done" role="dialog" aria-labelledby="gd-h">
          <div class="gs-panel">
            <div class="done-glow" aria-hidden="true"><span>✦</span></div>
            <h2 id="gd-h"></h2><p class="muted" id="gd-text"></p>
            <div id="gd-extra"></div>
            <p class="small muted" id="gd-time"></p>
            <div class="row-gap center mt-2"><button class="btn-main" data-gs="again">Play again</button><a class="btn-line" href="#/play">Choose another</a><a class="btn-line" href="#/mood">Check in</a></div>
          </div>
        </div>
      </div>
    </main>`;

    const shell = view.querySelector('.game-shell'), stage = view.querySelector('#gs-stage'), controls = view.querySelector('#gs-controls');
    const setState = s => { state = s; shell.dataset.state = s; const focusEl = shell.querySelector(`.gs-${s === 'playing' ? 'stage' : s === 'complete' ? 'done' : s} button, .gs-${s} [data-gs]`); if (s !== 'playing') setTimeout(() => focusEl?.focus({ preventScroll: true }), 50); };
    const elapsed = () => (Date.now() - started - pausedMs - (pausedAt ? Date.now() - pausedAt : 0)) / 1000;
    const log = (completed = false) => {
      if (logged || !started) return;
      const secs = elapsed();
      if (completed || secs > 10) { logged = true; P.logActivity('game', 'game:' + id, g.title, secs, { completed, level: info.paces ? levelOf(id) : null }); }
    };

    const api = {
      get level() { return levelOf(id); },
      reduced: P.motionReduced(),
      sfx: name => PauseEngine.sfx(name),
      progress: text => { view.querySelector('#gs-progress').textContent = text; },
      controls: html => { controls.innerHTML = html; controls.hidden = false; return controls; },
      complete: ({ title, text, extra = '', journal = '' }) => {
        if (state === 'complete') return;
        log(true);
        instance?.pause?.();
        view.querySelector('#gd-h').textContent = title;
        view.querySelector('#gd-text').textContent = text;
        view.querySelector('#gd-extra').innerHTML = extra + (journal ? '<button class="btn-soft btn-small mt-2" data-gs="journal">Save to my journal</button>' : '');
        view.querySelector('#gd-extra').dataset.journal = journal;
        view.querySelector('#gd-time').textContent = `You spent ${mins(elapsed())} here.`;
        PauseEngine.sfx('complete');
        setState('complete');
      }
    };
    function start() {
      instance?.destroy?.(); stage.innerHTML = ''; controls.innerHTML = ''; controls.hidden = true;
      started = Date.now(); pausedMs = 0; pausedAt = 0; logged = false;
      PauseEngine.sfx('whoosh');
      setState('playing');
      instance = mod.mount(stage, api);
      stage.querySelector('canvas, button, input, textarea')?.focus({ preventScroll: true });
    }
    function pause() { if (state !== 'playing') return; instance?.pause?.(); pausedAt = Date.now(); setState('paused'); }
    function resume() { if (state !== 'paused') return; pausedMs += Date.now() - pausedAt; pausedAt = 0; instance?.resume?.(); setState('playing'); }

    P.onLeave(() => { log(false); instance?.destroy?.(); instance = null; });
    view.addEventListener('click', async e => {
      const pace = e.target.closest('[data-pace]');
      if (pace) { setLevel(id, pace.dataset.pace); view.querySelectorAll('[data-pace]').forEach(b => { const on = b === pace; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); }); view.querySelector('#pace-note').textContent = info.paces[pace.dataset.pace]; PauseEngine.sfx('select'); return; }
      const a = e.target.closest('[data-gs]')?.dataset.gs;
      if (a === 'start' || a === 'again') { if (a === 'again') log(false); start(); }
      if (a === 'pause') state === 'paused' ? resume() : pause();
      if (a === 'resume') resume();
      if (a === 'restart') { log(false); start(); }
      if (a === 'sound') { PauseEngine.setSfx(!PauseEngine.settings.sfx); const b = e.target.closest('[data-gs]'); b.textContent = PauseEngine.settings.sfx ? '🔔' : '🔕'; b.setAttribute('aria-pressed', PauseEngine.settings.sfx); PauseEngine.sfx('select'); P.toast(PauseEngine.settings.sfx ? 'Game sounds on' : 'Game sounds off'); }
      if (a === 'journal') {
        const text = view.querySelector('#gd-extra').dataset.journal;
        await PauseStore.put('journal', { id: uid('j'), title: `${g.title} · ${fmtDate(Date.now())}`, text, category: 'Everyday', moods: [], created: Date.now(), updated: Date.now(), source: 'game' });
        e.target.disabled = true; P.toast('Saved to your journal');
      }
    });
    view.addEventListener('change', e => { if (e.target.matches('[data-gs-sfx]')) { PauseEngine.setSfx(e.target.checked); if (e.target.checked) PauseEngine.sfx('select'); } });
    /* Escape pauses (or resumes); leaving the tab pauses automatically. */
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) { if (state === 'playing') pause(); else if (state === 'paused') resume(); } };
    const onHide = () => { if (document.hidden) pause(); };
    document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onHide);
    P.onLeave(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); });
    setState('intro');
  }

  /* ---------- Guided moments ---------- */
  P.route('routine', (view, [rid]) => {
    const r = C.ROUTINES.find(x => x.id === rid) || C.ROUTINES[0];
    const answers = {}; let step = 0, timer = null, logged = false;
    const started = Date.now();
    const log = () => { if (!logged && Date.now() - started > 20000) { logged = true; P.logActivity('routine', 'routine:' + r.id, r.title, (Date.now() - started) / 1000); } };
    P.onLeave(() => { clearInterval(timer); log(); });

    view.innerHTML = `<main class="content narrow">
      <a class="link-btn" href="#/play">← All activities</a>
      ${P.header({ eyebrow: `Guided moment · ${r.minutes} min`, title: r.title, intro: esc(r.about) })}
      <div class="step-dots" aria-hidden="true">${r.steps.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <section class="surface routine-step" id="routine-step" aria-live="polite"></section>
    </main>`;
    const box = view.querySelector('#routine-step');

    function paint() {
      clearInterval(timer);
      const s = r.steps[step], last = step === r.steps.length - 1;
      view.querySelectorAll('.step-dots i').forEach((d, i) => { d.classList.toggle('done', i < step); d.classList.toggle('now', i === step); });
      const summary = r.steps.filter(x => x.input).map(x => answers[x.input] ? `${x.input}: ${answers[x.input]}` : '').filter(Boolean);
      box.innerHTML = `<div class="eyebrow">Step ${step + 1} of ${r.steps.length}</div><h2 tabindex="-1">${esc(s.t)}</h2><p>${esc(s.d)}</p>
        ${s.input ? `<label class="sr-only" for="r-in">${esc(s.input)}</label>${s.long ? `<textarea class="input" id="r-in" rows="6" placeholder="${esc(s.input)}">${esc(answers[s.input] || '')}</textarea>` : `<input class="input" id="r-in" placeholder="${esc(s.input)}" value="${esc(answers[s.input] || '')}">`}` : ''}
        ${s.seconds ? `<div class="routine-timer"><div class="progress-line"><span id="r-bar"></span></div><span class="muted small" id="r-left"></span> <button class="link-btn small" data-r="timer">Start timer</button></div>` : ''}
        ${(s.save || s.copy) && summary.length ? `<div class="privacy-box mt-3">${summary.map(x => `<p class="mb-1">${esc(x)}</p>`).join('')}</div>` : ''}
        <div class="row-gap mt-3">
          ${step ? '<button class="btn-line" data-r="back">← Back</button>' : ''}
          ${s.save && summary.length ? '<button class="btn-soft" data-r="save">Save to journal</button>' : ''}
          ${s.copy ? '<button class="btn-soft" data-r="copy">Copy my message</button>' : ''}
          ${last ? '<a class="btn-main" href="#/today" data-r="finish">Finish</a>' : '<button class="btn-main" data-r="next">Next →</button>'}
        </div>`;
      box.querySelector('h2').focus();
      if (s.seconds && !s.input) startTimer(s.seconds);
    }
    function startTimer(sec) {
      clearInterval(timer);
      const end = Date.now() + sec * 1000, bar = box.querySelector('#r-bar'), left = box.querySelector('#r-left');
      box.querySelector('[data-r="timer"]')?.remove();
      const tick = () => {
        const ms = Math.max(0, end - Date.now());
        if (bar) bar.style.width = (100 - ms / (sec * 10)) + '%';
        if (left) left.textContent = ms ? `${Math.ceil(ms / 1000)} sec` : 'Time’s up. Move on whenever you’re ready.';
        if (!ms) clearInterval(timer);
      };
      tick(); timer = setInterval(tick, 250);
    }
    const keep = () => { const inp = box.querySelector('#r-in'); if (inp) answers[r.steps[step].input] = inp.value.trim(); };
    view.addEventListener('click', async e => {
      const a = e.target.closest('[data-r]')?.dataset.r;
      if (a === 'next') { keep(); step++; paint(); }
      if (a === 'back') { keep(); step--; paint(); }
      if (a === 'timer') startTimer(r.steps[step].seconds);
      if (a === 'finish') log();
      if (a === 'save') {
        keep();
        const text = r.steps.filter(x => x.input && answers[x.input]).map(x => `${x.input}:\n${answers[x.input]}`).join('\n\n');
        await PauseStore.put('journal', { id: uid('j'), title: `${r.title} · ${fmtDate(Date.now())}`, text, category: P.reading.categorize(text), moods: [], created: Date.now(), updated: Date.now(), source: 'routine' });
        P.toast('Saved to your journal'); e.target.disabled = true;
      }
      if (a === 'copy') {
        try { await navigator.clipboard.writeText(answers['My message'] || ''); P.toast('Copied. Send it whenever you’re ready.'); } catch { P.toast('Copy didn’t work here'); }
      }
    });
    paint();
  });
})(window.Pause);
