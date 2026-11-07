/* Guided breathing: preset and custom patterns, session timer, visual guide,
   optional soft tone at each phase change (off by default).
   "Breathing for how you feel": pick or describe a feeling and Pause suggests a
   pattern and length. After each session you can say whether it helped, and future
   suggestions for that feeling favour the patterns that helped you. */
(function (P) {
  'use strict';
  const { esc, safeLS } = P.util;
  const C = P.catalog;
  const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Rest'];
  const LENGTHS = [1, 2, 3, 5, 10];
  let session = null;

  function customPattern() {
    try { const c = JSON.parse(safeLS.get('pause-breath-custom', 'null')); if (Array.isArray(c) && c.length === 4) return c; } catch { }
    return [4, 2, 6, 0];
  }
  const patterns = () => [...C.BREATHS, { id: 'custom', name: 'My pattern', steps: customPattern(), about: 'Set your own timing.', needs: [] }];
  const guideKey = feeling => C.BREATH_FOR[feeling] ? feeling : C.BREATH_ALIAS[feeling];

  /* ---------- Suggestion logic (on-device) ----------
     Starts from the general guide for the feeling, then re-orders using the person's
     own feedback: +1 for "a bit better", -1 for "worse", for sessions done with that feeling. */
  async function suggestFor(feeling) {
    const key = guideKey(feeling);
    const g = C.BREATH_FOR[key];
    if (!g) return null;
    const history = (await PauseStore.all('activity')).filter(a => a.kind === 'breathe' && a.feeling === key && a.felt);
    const score = {};
    history.forEach(a => { const id = a.ref.split(':')[1]; score[id] = (score[id] || 0) + (a.felt === 'better' ? 1 : a.felt === 'worse' ? -1 : 0); });
    const candidates = [...new Set([...g.ids, ...Object.keys(score).filter(id => score[id] > 0 && id !== 'custom')])];
    const ranked = candidates.map((id, i) => ({ id, s: (score[id] || 0) * 2 - i * .5 })).sort((a, b) => b.s - a.s);
    const best = ranked.find(r => (score[r.id] || 0) >= 0) || ranked[0];
    const helped = score[best.id] > 0;
    const avoided = g.ids.filter(id => (score[id] || 0) < 0);
    return {
      key, feeling, id: best.id, minutes: g.min,
      why: (helped ? 'Last time you felt like this, this pattern helped. ' : '') + (best.id === g.ids[0] ? g.why : C.BREATHS.find(b => b.id === best.id)?.about || g.why),
      note: avoided.length ? `Skipped ${avoided.map(id => C.BREATHS.find(b => b.id === id)?.name).join(', ')} because you said it didn’t help before.` : ''
    };
  }

  /* ---------- Breathing audio ----------
     Sound guide: 'silent' | 'chime' | 'breath' | 'both'. Breath sounds are soft filtered-noise
     swells timed to the exact length of each inhale/exhale; chimes mark each phase change.
     Optional ambience fades in for the session and fades out at the end. */
  const audioPref = () => {
    const p = P.prefs.get();
    return { guide: p.breathSound || (p.breathCue ? 'chime' : 'breath'), ambience: p.breathAmbience || 'none' };
  };
  let ambienceStarted = false;
  function cue(phase, seconds) {
    const { guide } = audioPref();
    if (guide === 'silent' || !PauseEngine.supported()) return;
    if ((guide === 'breath' || guide === 'both') && seconds >= 1.5) {
      if (phase === 0) PauseEngine.breath.inhale(seconds);
      if (phase === 2) PauseEngine.breath.exhale(seconds);
    }
    if (guide === 'chime' || guide === 'both') PauseEngine.breath.chime(phase);
  }
  function startAudio() {
    const { guide, ambience } = audioPref();
    if (!PauseEngine.supported()) return;
    if (guide !== 'silent' || ambience !== 'none') { PauseEngine.unlock(); PauseEngine.hold(); }
    if (ambience !== 'none' && !PauseAudio.playing) { PauseAudio.applyMix({ [ambience]: 0.45 }); ambienceStarted = true; }
  }
  function stopAudio(bell) {
    const { guide, ambience } = audioPref();
    if (bell && guide !== 'silent' && PauseEngine.supported()) PauseEngine.breath.bell();
    if (ambienceStarted) { ambienceStarted = false; setTimeout(() => PauseAudio.pause(), bell ? 2500 : 0); }
    if (guide !== 'silent' || ambience !== 'none') PauseEngine.release();
  }

  async function stopSession(log = true) {
    if (!session) return null;
    const s = session; session = null;
    clearInterval(s.timer);
    stopAudio(log && s.elapsed >= s.total);
    const secs = (Date.now() - s.started - s.pausedMs) / 1000;
    if (log && secs > 15) return P.logActivity('breathe', 'breathe:' + s.pattern.id, s.pattern.name, secs, s.feeling ? { feeling: s.feeling } : {});
    return null;
  }

  P.route('breathe', async (view, [pid, arg]) => {
    const list = patterns();
    let pattern = list.find(p => p.id === pid) || list[0];
    let minutes = LENGTHS.includes(P.prefs.get().sessionMinutes) ? P.prefs.get().sessionMinutes : 3;
    let feeling = null; // guide key for this session, if chosen
    P.onLeave(() => stopSession());

    /* Pre-select a feeling from the route (#/breathe/for/Anxious) or a recent check-in. */
    let initial = pid === 'for' ? decodeURIComponent(arg || '') : null;
    if (!initial) {
      const latest = (await P.data.moods())[0];
      if (latest && Date.now() - latest.created < 12 * 3600000) initial = (latest.moods || []).find(m => guideKey(m)) || null;
    }
    const fromCheckin = initial && pid !== 'for';

    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'A few slow breaths', title: 'Breathe', intro: 'Follow the circle. If any pattern feels uncomfortable, breathe normally instead. There’s no wrong way to do this.' })}
      <section class="surface feel-card" aria-labelledby="feel-h">
        <div class="feel-head"><h2 id="feel-h" class="h3">How are you feeling right now?</h2><span class="muted small">Pick one and Pause will suggest a pattern.</span></div>
        <div class="chip-row" role="group" aria-label="How you feel">
          ${C.BREATH_FEELINGS.map(([label, key]) => `<button class="chip" aria-pressed="false" data-feel="${esc(key)}">${esc(label)}</button>`).join('')}
        </div>
        <form class="describe-row" id="describe">
          <label class="sr-only" for="feel-text">Or describe how you feel</label>
          <input class="input" id="feel-text" maxlength="200" placeholder="Or describe it, e.g. “heart racing before my viva”">
          <button class="btn-line btn-small" type="submit">Suggest</button>
        </form>
        <div id="feel-out" aria-live="polite"></div>
      </section>
      <div class="breathe-layout">
        <section class="surface breathe-stage" aria-label="Breathing guide">
          <div class="breath-visual" id="breath-visual" data-phase="idle">
            <div class="breath-ring"></div><div class="breath-core"><span id="breath-phase">Ready when you are</span><strong id="breath-count"></strong></div>
          </div>
          <p class="breath-time muted" id="breath-time" aria-live="off"></p>
          <p class="sr-only" id="breath-live" aria-live="assertive"></p>
          <div class="row-gap center" id="breath-controls">
            <button class="btn-main" data-breath="start">Start</button>
            <button class="btn-line" data-breath="pause" disabled>Pause</button>
            <button class="btn-line" data-breath="end" disabled>End</button>
          </div>
          <div id="breath-after" aria-live="polite"></div>
        </section>
        <aside class="surface breathe-side">
          <h2 class="h3">Pattern</h2>
          <div class="pattern-list" role="radiogroup" aria-label="Breathing pattern">
            ${list.map(p => `<button role="radio" aria-checked="${p.id === pattern.id}" class="pattern-btn ${p.id === pattern.id ? 'selected' : ''}" data-pattern="${p.id}"><strong>${esc(p.name)} <span class="badge-soft sugg-badge" hidden>Suggested</span></strong><span class="muted small">${p.steps.filter((s, i) => s || i % 2 === 0).join(' · ')} sec</span><span class="small">${esc(p.about)}</span></button>`).join('')}
          </div>
          <div class="custom-pattern" ${pattern.id === 'custom' ? '' : 'hidden'}>
            ${PHASES.map((ph, i) => `<label class="field-inline">${ph} <input type="number" min="${i % 2 ? 0 : 2}" max="12" value="${customPattern()[i]}" data-custom="${i}"> sec</label>`).join('')}
          </div>
          <h2 class="h3 mt-3">Length</h2>
          <div class="chip-row" role="group" aria-label="Session length">${LENGTHS.map(m => `<button class="chip ${m === minutes ? 'selected' : ''}" aria-pressed="${m === minutes}" data-minutes="${m}">${m} min</button>`).join('')}</div>
          <h2 class="h3 mt-3">Sound</h2>
          <div class="field mb-1"><label for="breath-guide">Sound guide</label><select id="breath-guide">${[['breath', 'Soft breath sounds'], ['chime', 'Gentle chimes'], ['both', 'Breath sounds + chimes'], ['silent', 'Silent']].map(([v, l]) => `<option value="${v}" ${audioPref().guide === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field mb-1"><label for="breath-amb">Background ambience</label><select id="breath-amb"><option value="none">None</option>${['ocean', 'rain', 'wind', 'stream', 'tones', 'pink'].map(id => `<option value="${id}" ${audioPref().ambience === id ? 'selected' : ''}>${PauseSoundscapes.byId[id].name}</option>`).join('')}</select></div>
          <button class="link-btn small" data-preview-sound>Hear a sample</button>
          <p class="small muted mt-2">Want a richer mix? <a href="#/sounds">Open the sound mixer</a>.</p>
        </aside>
      </div>
    </main>`;

    const $ = s => view.querySelector(s);
    const vis = $('#breath-visual'), phaseEl = $('#breath-phase'), countEl = $('#breath-count'), timeEl = $('#breath-time'), live = $('#breath-live');
    const btn = n => view.querySelector(`[data-breath="${n}"]`);

    function selectPattern(id) {
      pattern = patterns().find(p => p.id === id) || pattern;
      view.querySelectorAll('[data-pattern]').forEach(x => { const on = x.dataset.pattern === pattern.id; x.classList.toggle('selected', on); x.setAttribute('aria-checked', on); });
      $('.custom-pattern').hidden = pattern.id !== 'custom';
      history.replaceState(null, '', '#/breathe/' + pattern.id);
    }
    function selectMinutes(m) {
      minutes = m;
      view.querySelectorAll('[data-minutes]').forEach(x => { const on = +x.dataset.minutes === m; x.classList.toggle('selected', on); x.setAttribute('aria-pressed', on); });
      if (session) session.total = minutes * 60000;
    }

    /* Apply a suggestion: choose the pattern and length and explain why. */
    function applySuggestion(sg, source, src) {
      const p = C.BREATHS.find(b => b.id === sg.id);
      if (!p) return;
      feeling = sg.key || null;
      selectPattern(p.id); selectMinutes(sg.minutes);
      view.querySelectorAll('.sugg-badge').forEach(b => { b.hidden = b.closest('[data-pattern]').dataset.pattern !== p.id; });
      view.querySelectorAll('[data-feel]').forEach(b => { const on = b.dataset.feel === feeling; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
      $('#feel-out').innerHTML = `<div class="feel-suggest">
        ${src ? P.ai.badge(src) : ''}
        <p class="mb-1"><strong>Try ${esc(p.name)} for ${sg.minutes} min</strong> <span class="muted small">· ${p.steps.filter((s, i) => s || i % 2 === 0).join(' · ')} sec</span></p>
        <p class="small mb-1">${esc(sg.why)}</p>
        ${sg.note ? `<p class="small muted mb-1">${esc(sg.note)}</p>` : ''}
        ${source ? `<p class="small muted mb-1">${esc(source)}</p>` : ''}
        <button class="btn-main btn-small mt-1" data-breath="start">Start this</button>
      </div>`;
    }
    async function chooseFeeling(key, source) {
      const sg = await suggestFor(key);
      if (sg) applySuggestion(sg, source);
    }

    /* Free-text description: AI picks if allowed, otherwise on-device keyword matching. */
    async function describe(text) {
      const out = $('#feel-out');
      const level = P.safety.check(text);
      if (level) { out.innerHTML = P.safety.card(level); return; }
      const local = async () => {
        const key = /sleep|insomnia|can'?t rest|awake at night|bed/i.test(text) ? 'Sleep' : (P.feelingWords(text).map(guideKey).find(Boolean) || (/panic|racing|nervous|tense|scared|worried/i.test(text) ? 'Anxious' : /tired|drained|sleepy/i.test(text) ? 'Exhausted' : /focus|concentrat/i.test(text) ? 'Distracted' : null));
        const sg = key ? await suggestFor(key) : null;
        return { data: sg ? { pattern: sg.id, minutes: sg.minutes, reason: sg.why, feeling: key, note: sg.note } : null };
      };
      out.innerHTML = '<p class="muted small loading">Finding a pattern…</p>';
      const r = await P.ai.run('breathing', 'breath_suggest', { text, patterns: C.BREATHS.map(b => ({ id: b.id, name: b.name, steps: b.steps.join('-'), about: b.about })) }, local);
      const d = r.data;
      if (!d || !C.BREATHS.some(b => b.id === d.pattern)) { out.innerHTML = '<p class="small muted">I couldn’t match that to a pattern. Try one of the feelings above, or start with Longer exhale. It suits most moments.</p>'; return; }
      const key = guideKey(d.feeling) || null;
      applySuggestion({ key, id: d.pattern, minutes: LENGTHS.includes(+d.minutes) ? +d.minutes : 3, why: d.reason || C.BREATHS.find(b => b.id === d.pattern).about, note: d.note }, '', r);
    }

    function render(s) {
      const left = Math.max(0, Math.ceil((s.total - s.elapsed) / 1000));
      timeEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
    }
    function start() {
      stopSession(false);
      $('#breath-after').innerHTML = '';
      const steps = pattern.steps.map(Number);
      startAudio();
      session = { pattern, steps, feeling, phase: -1, phaseLeft: 0, elapsed: 0, total: minutes * 60000, started: Date.now(), pausedMs: 0, paused: false, last: Date.now() };
      btn('start').textContent = 'Restart'; btn('pause').disabled = false; btn('end').disabled = false; btn('pause').textContent = 'Pause';
      next(); session.timer = setInterval(tick, 100);
      $('.breathe-stage').scrollIntoView({ block: 'nearest', behavior: P.motionReduced() ? 'auto' : 'smooth' });
    }
    function next() {
      const s = session;
      do { s.phase = (s.phase + 1) % 4; } while (!s.steps[s.phase]);
      s.phaseLeft = s.steps[s.phase] * 1000;
      vis.dataset.phase = ['in', 'hold', 'out', 'rest'][s.phase];
      vis.style.setProperty('--dur', s.steps[s.phase] + 's');
      phaseEl.textContent = PHASES[s.phase]; live.textContent = PHASES[s.phase];
      cue(s.phase, s.steps[s.phase]);
    }
    function tick() {
      const s = session; if (!s) return;
      const now = Date.now(), dt = now - s.last; s.last = now;
      if (s.paused) { s.pausedMs += dt; return; }
      s.elapsed += dt; s.phaseLeft -= dt;
      countEl.textContent = Math.max(1, Math.ceil(s.phaseLeft / 1000));
      render(s);
      if (s.elapsed >= s.total + 30000) return finish(); // safety cap
      if (s.phaseLeft <= 0) {
        const lastPhase = s.steps[3] ? 3 : 2; // finish at the end of a full breath
        if (s.elapsed >= s.total && s.phase === lastPhase) return finish();
        next();
      }
    }
    async function finish() {
      const actId = await stopSession();
      vis.dataset.phase = 'done'; phaseEl.textContent = 'Nicely done'; countEl.textContent = ''; timeEl.textContent = 'Take a moment before moving on.';
      live.textContent = 'Session complete';
      btn('start').textContent = 'Start again'; btn('pause').disabled = true; btn('end').disabled = true;
      if (!actId) return;
      $('#breath-after').innerHTML = `<div class="after-breath">
        <p class="mb-1"><strong>How do you feel now?</strong> <span class="muted small">This helps Pause suggest better patterns for you.</span></p>
        <div class="row-gap center"><button class="chip" data-felt="better">A bit better</button><button class="chip" data-felt="same">About the same</button><button class="chip" data-felt="worse">Worse</button></div>
      </div>`;
      $('#breath-after').dataset.act = actId;
    }
    async function feedback(felt) {
      const box = $('#breath-after'), rec = await PauseStore.get('activity', box.dataset.act);
      if (rec) { rec.felt = felt; await PauseStore.put('activity', rec); P.refreshActivity(); }
      const msg = {
        better: 'Glad that helped a little. Pause will remember this pattern for next time.',
        same: 'That’s okay. Sometimes it takes a few rounds, or a different kind of pause.',
        worse: 'Thank you for saying so. Breathing exercises don’t suit everyone at every moment. Breathing normally is completely fine. Something else might help more:'
      }[felt];
      box.innerHTML = `<p class="small">${msg}</p>
        ${felt === 'worse' ? '<div class="row-gap center"><a class="btn-soft btn-small" href="#/play/grounding">Five senses grounding</a><a class="btn-soft btn-small" href="#/routine/gentle-reset">Gentle reset</a><a class="btn-line btn-small" href="#/companion">Talk it through</a></div>'
        : '<div class="row-gap center"><a class="btn-line btn-small" href="#/mood">Check in</a><a class="btn-line btn-small" href="#/today">Back to Today</a></div>'}`;
    }

    view.addEventListener('click', e => {
      const b = e.target.closest('[data-breath]')?.dataset.breath;
      if (b === 'start') start();
      if (b === 'pause' && session) { session.paused = !session.paused; btn('pause').textContent = session.paused ? 'Resume' : 'Pause'; vis.classList.toggle('paused', session.paused); phaseEl.textContent = session.paused ? 'Paused' : PHASES[session.phase]; }
      if (b === 'end') finish();
      const fb = e.target.closest('[data-feel]');
      if (fb) {
        if (feeling === fb.dataset.feel) { feeling = null; fb.classList.remove('selected'); fb.setAttribute('aria-pressed', 'false'); $('#feel-out').innerHTML = ''; view.querySelectorAll('.sugg-badge').forEach(x => { x.hidden = true; }); }
        else chooseFeeling(fb.dataset.feel);
        return;
      }
      const felt = e.target.closest('[data-felt]'); if (felt) return feedback(felt.dataset.felt);
      if (e.target.closest('[data-preview-sound]')) { const g = audioPref().guide; if (g === 'silent') return P.toast('Sound guide is set to silent'); PauseEngine.unlock(); cue(0, 3); setTimeout(() => cue(2, 3.5), 3200); return; }
      const pb = e.target.closest('[data-pattern]');
      if (pb) { selectPattern(pb.dataset.pattern); if (session) start(); }
      const mb = e.target.closest('[data-minutes]');
      if (mb) selectMinutes(+mb.dataset.minutes);
    });
    $('#describe').addEventListener('submit', e => { e.preventDefault(); const t = $('#feel-text').value.trim(); if (t) describe(t); });
    view.addEventListener('change', e => {
      if (e.target.id === 'breath-guide') P.prefs.set({ breathSound: e.target.value });
      if (e.target.id === 'breath-amb') P.prefs.set({ breathAmbience: e.target.value });
      if (e.target.dataset.custom !== undefined) {
        const vals = [...view.querySelectorAll('[data-custom]')].map((x, i) => Math.min(12, Math.max(i % 2 ? 0 : 2, +x.value || 0)));
        safeLS.set('pause-breath-custom', JSON.stringify(vals));
        pattern = { ...pattern, steps: vals };
      }
    });

    /* Only auto-suggest when no specific pattern was asked for in the link. */
    if (initial && (!pid || pid === 'for')) chooseFeeling(guideKey(initial), fromCheckin ? `Based on your recent check-in (${initial.toLowerCase()}). Choose another feeling if that’s changed.` : '');
  });
})(window.Pause);
