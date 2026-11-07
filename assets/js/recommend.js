/* Personalised wellness recommendations, computed on this device.
   Inputs: current feelings, mood level, time available, goals, preferred activity kinds,
   and what was done recently. A little randomness keeps suggestions from repeating. */
(function (P) {
  'use strict';
  const { DAY } = P.util;
  let recent = []; // cached activity records (refreshed from storage)

  P.refreshActivity = async () => {
    try { recent = (await PauseStore.all('activity')).sort((a, b) => b.created - a.created).slice(0, 200); } catch { recent = []; }
    return recent;
  };
  /* Keep the cache fresh whenever something is logged. */
  const originalLog = P.logActivity;
  P.logActivity = async (...args) => { const id = await originalLog(...args); await P.refreshActivity(); return id; };

  const REASON = {
    calm: 'helps things slow down', ground: 'brings you back to the present', unload: 'gets thoughts out of your head',
    release: 'lets some tension out', focus: 'gently gathers your attention', start: 'makes starting feel smaller',
    comfort: 'offers a little comfort', connect: 'helps you feel less alone', rest: 'supports rest', gentle: 'asks very little energy',
    reflect: 'helps you make sense of things', savour: 'helps a good moment last'
  };

  /**
   * @param {object} o  emotions[], level (1-5), minutes, exclude[] (activity ids), count
   * @returns {{activity, reason}[]}
   */
  P.recommend = function (o = {}) {
    const { emotions = [], level = null, minutes = null, exclude = [], count = 3 } = o;
    const prefs = P.prefs.get();
    const C = P.catalog;
    const wanted = {};
    const add = (need, w) => { wanted[need] = (wanted[need] || 0) + w; };
    emotions.forEach(e => (C.NEED_OF[e] || []).forEach((n, i) => add(n, i ? 2 : 3)));
    if (level !== null && level <= 2) { add('gentle', 2); add('comfort', 1.5); }
    if (level >= 4) { add('savour', 1); add('start', .8); }
    prefs.goals.forEach(g => (C.GOALS.find(x => x.id === g)?.needs || []).forEach(n => add(n, 1.2)));
    if (!Object.keys(wanted).length) { add('calm', 1); add('gentle', 1); add('reflect', .8); }

    const now = Date.now();
    const scored = C.ACTIVITIES.filter(a => !exclude.includes(a.id)).map(a => {
      let score = 0, best = null, bestW = 0;
      for (const n of a.needs) if (wanted[n]) { score += wanted[n]; if (wanted[n] > bestW) { bestW = wanted[n]; best = n; } }
      if (prefs.activities.includes(a.kind)) score += 1.5;
      if (minutes) score += a.minutes <= minutes ? 1.2 : -4;
      const last = recent.find(r => r.ref === a.id);
      if (last && now - last.created < DAY) score -= 2.2;
      else if (last && now - last.created < 3 * DAY) score -= 1;
      const neverTried = !recent.some(r => r.ref === a.id);
      if (neverTried) score += .4;
      score += Math.random() * 1.6;
      let reason;
      const feeling = emotions.find(e => (C.NEED_OF[e] || []).includes(best));
      if (feeling && best) reason = `You mentioned feeling ${feeling.toLowerCase()}. This ${REASON[best]}.`;
      else if (best) reason = `This ${REASON[best]}.`;
      else reason = 'Something different, just in case.';
      if (minutes && a.minutes <= minutes) reason += ` Fits in ${minutes} min.`;
      else if (neverTried) reason += ' You haven’t tried this one yet.';
      return { activity: a, score, reason };
    }).sort((a, b) => b.score - a.score);

    /* Prefer variety: avoid two of the same kind when possible. */
    const out = [], kinds = new Set();
    for (const s of scored) { if (out.length >= count) break; if (!kinds.has(s.activity.kind)) { out.push(s); kinds.add(s.activity.kind); } }
    for (const s of scored) { if (out.length >= count) break; if (!out.includes(s)) out.push(s); }
    return out;
  };

  /* Markup for one suggestion card. Sound suggestions play directly (needs a click). */
  P.activityCard = function ({ activity: a, reason }) {
    const { esc } = P.util;
    const action = a.kind === 'sound' ? `data-play-sound="${esc(a.go.split('/')[1])}"` : `data-go="${esc(a.go)}"`;
    return `<article class="rec-card">
      <div class="rec-icon" aria-hidden="true">${a.icon}</div>
      <div class="rec-body"><div class="eyebrow">${esc(P.catalog.KINDS[a.kind])} · ${a.minutes} min</div><h3>${esc(a.title)}</h3><p class="muted">${esc(reason || a.about)}</p></div>
      <button class="btn-soft btn-small" ${action} aria-label="Start ${esc(a.title)}">Start</button>
    </article>`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-play-sound]');
    if (!b) return;
    PauseAudio.playTrack(b.dataset.playSound);
    P.logActivity('sound', 'sound:' + (b.dataset.playSound === 'Brown noise' ? 'brown' : 'rain'), b.dataset.playSound);
    P.toast(`${b.dataset.playSound} is playing. Use the sound bar to change or stop it.`);
  });
})(window.Pause);
