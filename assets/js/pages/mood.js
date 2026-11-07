/* Mood: check-in, history (charts) and insights.
   Record shape (compatible with the original app): { id, moods[], text, help, created }
   plus optional { level 1–5, factors[] }. */
(function (P) {
  'use strict';
  const { esc, fmtDate, fmtTime, dayKey, uid, DAY, truncate } = P.util;
  const C = P.catalog;
  let chartMode = 'week', monthOffset = 0;

  const tabs = active => `<div class="tabs" role="tablist" aria-label="Mood sections">
    ${[['checkin', 'Check in'], ['history', 'History'], ['insights', 'Insights']].map(([id, l]) => `<a role="tab" href="#/mood/${id}" aria-selected="${active === id}" class="tab ${active === id ? 'active' : ''}">${l}</a>`).join('')}
  </div>`;

  P.route('mood', async (view, [section = 'checkin', arg]) => {
    if (section === 'history') return history(view);
    if (section === 'insights') return insights(view);
    return checkin(view, section === 'edit' ? arg : null, section === 'checkin' ? +arg || null : null);
  });

  /* ---------- Check in ---------- */
  async function checkin(view, editId, presetLevel) {
    const existing = editId ? await PauseStore.get('moods', editId) : null;
    const st = { level: existing?.level ?? presetLevel, moods: [...(existing?.moods || [])], factors: [...(existing?.factors || [])] };
    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'No right answer', title: existing ? 'Edit check-in' : 'How are you feeling right now?', intro: 'Choose as many or as few as you like. Skipping is always okay.' })}
      ${tabs('checkin')}
      <form class="surface checkin-form" id="checkin">
        <fieldset><legend class="h3">Overall, today feels…</legend>
          <div class="level-picker" role="radiogroup" aria-label="Overall feeling">
            ${C.LEVELS.map(l => `<button type="button" role="radio" aria-checked="${st.level === l.v}" class="level-btn ${st.level === l.v ? 'selected' : ''}" data-level="${l.v}"><span class="level-dot" aria-hidden="true"></span>${esc(l.label)}</button>`).join('')}
          </div>
        </fieldset>
        <fieldset><legend class="h3">Which feelings are here?</legend>
          ${C.EMOTION_GROUPS.map(g => `<div class="emotion-group"><span class="eyebrow">${g.name}</span><div class="pill-row">${g.tags.map(t => `<button type="button" class="pill ${st.moods.includes(t) ? 'selected' : ''}" aria-pressed="${st.moods.includes(t)}" data-mood="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`).join('')}
        </fieldset>
        <div class="checkin-grid">
          <div>
            <div class="field"><label for="reflection">What has been on your mind?</label><textarea id="reflection" placeholder="Write as much or as little as you want…">${esc(existing?.text || '')}</textarea></div>
            <div class="field"><label for="help-prompt">What might help you right now?</label><textarea id="help-prompt" placeholder="Optional">${esc(existing?.help || '')}</textarea></div>
          </div>
          <div>
            <fieldset><legend class="field-label">Today I… <span class="muted">(optional, helps spot gentle patterns)</span></legend>
              <div class="pill-row">${C.DAY_FACTORS.map(f => `<button type="button" class="pill pill-sm ${st.factors.includes(f) ? 'selected' : ''}" aria-pressed="${st.factors.includes(f)}" data-factor="${esc(f)}">${esc(f)}</button>`).join('')}</div>
            </fieldset>
            <div class="privacy-box mt-3"><strong>A private moment</strong><p>Your entry is saved on this device only when you choose Save. It is not sent anywhere.</p></div>
            <div class="row-gap mt-3"><button class="btn-main" type="submit">${existing ? 'Save changes' : 'Save check-in'}</button><a class="btn-line" href="#/read">Skip to reading</a></div>
            <p id="save-status" class="muted small" aria-live="polite"></p>
          </div>
        </div>
      </form>
      <div id="after-save"></div>
    </main>`;

    const form = view.querySelector('#checkin');
    form.addEventListener('click', e => {
      const lv = e.target.closest('[data-level]');
      if (lv) { st.level = st.level === +lv.dataset.level ? null : +lv.dataset.level; form.querySelectorAll('[data-level]').forEach(b => { const on = +b.dataset.level === st.level; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); }); return; }
      const toggle = (b, list) => { const v = b.dataset.mood || b.dataset.factor, i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v); b.classList.toggle('selected', i < 0); b.setAttribute('aria-pressed', i < 0); };
      const mb = e.target.closest('[data-mood]'); if (mb) return toggle(mb, st.moods);
      const fb = e.target.closest('[data-factor]'); if (fb) return toggle(fb, st.factors);
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const rec = { ...(existing || {}), id: existing?.id || 'm' + Date.now(), moods: [...st.moods], level: st.level, factors: [...st.factors], text: form.querySelector('#reflection').value, help: form.querySelector('#help-prompt').value, created: existing?.created || Date.now(), updated: Date.now() };
      await PauseStore.put('moods', rec);
      P.toast(existing ? 'Check-in updated' : 'Saved on this device. Thank you for checking in.');
      if (existing) return P.go('mood/history');
      afterSave(view, rec);
    });
  }

  function afterSave(view, rec) {
    const safety = P.safety.check(rec.text + ' ' + rec.help);
    const recs = P.recommend({ emotions: rec.moods, level: rec.level, count: 3 });
    const group = rec.moods.map(m => C.GROUP_FOR_FEELING[m]).find(Boolean);
    const aff = P.ai.local.affirmation(group).text;
    view.querySelector('#checkin').hidden = true;
    view.querySelector('#after-save').innerHTML = `<section class="surface after-save">
      <h2>Thank you for checking in.</h2>
      ${safety ? P.safety.card(safety) : ''}
      <p class="muted">Whatever you’re feeling is allowed. Here are a few things that might fit right now. Or none, that’s okay too.</p>
      <div class="rec-list">${recs.map(P.activityCard).join('')}</div>
      ${(() => { const f = rec.moods.find(m => C.BREATH_FOR[m] || C.BREATH_ALIAS[m]); return f ? `<p class="mt-3"><a class="btn-soft btn-small" href="#/breathe/for/${encodeURIComponent(f)}">Breathing for feeling ${esc(f.toLowerCase())} →</a></p>` : ''; })()}
      <blockquote class="quote quote-sm mt-3">“${esc(aff)}”</blockquote>
      <div class="row-gap mt-3"><a class="btn-line" href="#/mood/history">See my check-ins</a><a class="btn-line" href="#/today">Back to Today</a><button class="link-btn" data-go="mood/checkin">New check-in</button></div>
    </section>`;
    view.querySelector('#after-save h2').setAttribute('tabindex', '-1'); view.querySelector('#after-save h2').focus();
  }

  /* ---------- History ---------- */
  async function history(view) {
    const rows = await P.data.moods();
    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'Your device, your pace', title: 'Mood history', intro: 'A private look back at what you chose to save.', actions: rows.length ? '<button class="btn-line btn-small" data-clear-moods>Clear history</button>' : '' })}
      ${tabs('history')}
      <section class="surface">
        <div class="card-head"><h2>Mood over time</h2>
          <div class="seg" role="group" aria-label="Chart range"><button class="seg-btn ${chartMode === 'week' ? 'active' : ''}" aria-pressed="${chartMode === 'week'}" data-chart="week">Week</button><button class="seg-btn ${chartMode === '30' ? 'active' : ''}" aria-pressed="${chartMode === '30'}" data-chart="30">30 days</button><button class="seg-btn ${chartMode === 'month' ? 'active' : ''}" aria-pressed="${chartMode === 'month'}" data-chart="month">Calendar</button></div>
        </div>
        <div id="mood-chart"></div>
        <p class="small muted">Mood here is how you described it, not a measurement. Earlier check-ins without an overall feeling appear in the calendar as “checked in”.</p>
      </section>
      <div class="two-col mt-3">
        <section class="surface"><h2>Feelings you chose most</h2><div id="tag-bars"></div></section>
        <section class="surface">
          <h2>Entries</h2>
          <div class="row-gap"><label class="sr-only" for="history-filter">Filter entries</label><input class="input" id="history-filter" placeholder="Filter by feeling or note"><span class="muted small">${rows.length} saved ${rows.length === 1 ? 'entry' : 'entries'}</span></div>
          <div id="mood-entries">${rows.length ? rows.map(m => `<article class="entry" data-search="${esc(((m.moods || []).join(' ') + ' ' + (m.text || '') + ' ' + (m.help || '')).toLowerCase())}">
            <div class="entry-top"><div><strong>${fmtDate(m.created)}</strong> <span class="muted small">${fmtTime(m.created)}</span>${m.level ? ` <span class="level-chip sm" data-level="${m.level}">${esc(C.LEVELS[m.level - 1].label)}</span>` : ''}<div class="mt-1">${(m.moods || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${(m.factors || []).map(t => `<span class="tag tag-sage">${esc(t)}</span>`).join('')}</div></div>
              <div class="entry-actions"><a class="btn-line btn-small" href="#/mood/edit/${esc(m.id)}">Edit</a><button class="btn-line btn-small" data-delete-mood="${esc(m.id)}">Delete</button></div></div>
            ${m.text ? `<p class="mt-2 mb-1">${esc(m.text)}</p>` : ''}${m.help ? `<small class="muted">Might help: ${esc(m.help)}</small>` : ''}
          </article>`).join('') : '<div class="empty">No check-ins saved yet. You can begin with a gentle check-in whenever you like. <a href="#/mood">Check in</a></div>'}</div>
        </section>
      </div>
    </main>`;
    const drawChart = () => {
      const el = view.querySelector('#mood-chart');
      if (chartMode === 'month') {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset);
        el.innerHTML = `<div class="month-nav"><button class="btn-line btn-small" data-month="-1" aria-label="Previous month">‹</button><strong>${d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button class="btn-line btn-small" data-month="1" aria-label="Next month" ${monthOffset >= 0 ? 'disabled' : ''}>›</button></div><div id="cal"></div>`;
        P.charts.calendar(el.querySelector('#cal'), rows, d);
      } else P.charts.moodLine(el, rows, { days: chartMode === 'week' ? 7 : 30 });
    };
    drawChart();
    P.charts.tagBars(view.querySelector('#tag-bars'), rows);
    view.addEventListener('click', async e => {
      const c = e.target.closest('[data-chart]');
      if (c) { chartMode = c.dataset.chart; view.querySelectorAll('[data-chart]').forEach(b => { b.classList.toggle('active', b === c); b.setAttribute('aria-pressed', b === c); }); drawChart(); return; }
      const mo = e.target.closest('[data-month]'); if (mo) { monthOffset = Math.min(0, monthOffset + +mo.dataset.month); drawChart(); return; }
      const del = e.target.closest('[data-delete-mood]');
      if (del && await P.confirm('Delete this check-in?', 'It will be removed from this device.', 'Delete', true)) { await PauseStore.del('moods', del.dataset.deleteMood); P.toast('Check-in deleted'); P.render(); }
      if (e.target.closest('[data-clear-moods]') && await P.confirm('Delete all check-ins?', 'Every saved mood check-in on this device will be removed. This cannot be undone. You can export a backup first in Settings.', 'Delete all', true)) { await PauseStore.clear('moods'); P.toast('Mood history cleared'); P.render(); }
    });
    view.querySelector('#history-filter')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      view.querySelectorAll('#mood-entries .entry').forEach(x => x.classList.toggle('hidden', !x.dataset.search.includes(q)));
    });
  }

  /* ---------- Insights (on-device first; AI reflection is optional) ---------- */
  const avg = a => a.length ? a.reduce((s, b) => s + b, 0) / a.length : null;
  const STOP = new Set('about after again also because been before being could didn does doing dont during every feel feeling felt from getting going have just know like little lot make more much need really should some something still that thats their them then there they thing things think this today very want what when where which while will with would your yourself myself into over than were'.split(' '));

  function localInsights(rows, activity) {
    const now = Date.now(), week = rows.filter(r => r.created > now - 7 * DAY), prev = rows.filter(r => r.created <= now - 7 * DAY && r.created > now - 14 * DAY);
    const out = { week, lines: [], patterns: [], themes: [] };
    if (!week.length) return out;
    const wl = avg(week.filter(r => r.level).map(r => r.level)), pl = avg(prev.filter(r => r.level).map(r => r.level));
    out.lines.push(`You checked in ${week.length} time${week.length > 1 ? 's' : ''} in the last 7 days.`);
    if (wl) out.lines.push(`Most of your check-ins described things as around “${P.charts.levelName(wl).toLowerCase()}”.` + (pl && Math.abs(wl - pl) >= .5 ? ` That’s a little ${wl > pl ? 'lighter' : 'heavier'} than the week before.` : ''));
    const counts = {}; week.forEach(r => (r.moods || []).forEach(t => { if (t !== 'Prefer not to say') counts[t] = (counts[t] || 0) + 1; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0].toLowerCase());
    if (top.length) out.lines.push(`Feelings that came up most: ${top.join(', ')}.`);
    /* Gentle patterns: average self-described level with vs without each factor (last 60 days). */
    const recent = rows.filter(r => r.level && r.created > now - 60 * DAY);
    const actDays = {}; activity.forEach(a => { if (P.catalog.KINDS[a.kind]) (actDays[dayKey(a.created)] ||= new Set()).add(a.kind); });
    const factorsOf = r => [...(r.factors || []), ...[...(actDays[dayKey(r.created)] || [])].map(k => 'Used Pause for ' + P.catalog.KINDS[k].toLowerCase())];
    const all = new Set(recent.flatMap(factorsOf));
    for (const f of all) {
      const yes = recent.filter(r => factorsOf(r).includes(f)).map(r => r.level), no = recent.filter(r => !factorsOf(r).includes(f)).map(r => r.level);
      if (yes.length >= 2 && no.length >= 2 && Math.abs(avg(yes) - avg(no)) >= .5)
        out.patterns.push({ f, yes: avg(yes), no: avg(no), n: yes.length + no.length });
    }
    out.patterns.sort((a, b) => Math.abs(b.yes - b.no) - Math.abs(a.yes - a.no));
    /* Recurring words in notes */
    const freq = {};
    week.concat(prev).forEach(r => ((r.text || '') + ' ' + (r.help || '')).toLowerCase().match(/[a-z']{4,}/g)?.forEach(w => { if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1; }));
    out.themes = Object.entries(freq).filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    return out;
  }

  async function insights(view) {
    const [rows, activity] = await Promise.all([P.data.moods(), P.data.activity()]);
    const ins = localInsights(rows, activity);
    const aiReady = P.ai.status() === 'ready';
    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'Patterns, not conclusions', title: 'Mood insights', intro: 'A gentle look at what your check-ins show. These are possible patterns in what you recorded, never causes or a diagnosis.' })}
      ${tabs('insights')}
      ${!ins.week.length ? `<section class="surface empty-state"><h2>Nothing to reflect on yet</h2><p class="muted">After a few check-ins this week, you’ll see a summary here.</p><a class="btn-main" href="#/mood">Check in</a></section>` : `
      <div class="two-col">
        <section class="surface"><div class="card-head"><h2>This week, in brief</h2>${P.ai.badge({ source: 'local' })}</div>
          <ul class="insight-list">${ins.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
          ${ins.themes.length ? `<h3 class="h4 mt-3">Words that came up in your notes</h3><div>${ins.themes.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </section>
        <section class="surface"><h2>Possible connections</h2>
          ${ins.patterns.length ? `<ul class="insight-list">${ins.patterns.slice(0, 4).map(p => `<li>On days you noted <strong>${esc(p.f.toLowerCase())}</strong>, you tended to describe your mood as a bit ${p.yes > p.no ? 'lighter' : 'heavier'} <span class="muted small">(based on ${p.n} check-ins)</span>.</li>`).join('')}</ul>
            <p class="small muted">Small numbers and many other things affect how a day feels. Treat these as things you might notice, not rules.</p>`
            : '<p class="muted">When you add an overall feeling and “Today I…” notes to check-ins, possible connections can appear here after a couple of weeks.</p>'}
        </section>
      </div>
      <section class="surface mt-3">
        <div class="card-head"><div><h2>A gentle weekly reflection</h2><p class="muted small">${aiReady ? 'AI can write a short, kind reflection on your week and suggest a few activities.' : 'Turn on AI in Settings to get a written weekly reflection. The summary above works without it.'}</p></div></div>
        ${aiReady ? `<label class="check"><input type="checkbox" id="include-notes"> Include what I wrote in my notes (otherwise only feelings, levels and “Today I…” choices are sent)</label>
          <button class="btn-main mt-2" data-weekly>Write my weekly reflection</button>` : '<a class="btn-line" href="#/settings/ai">Set up AI</a>'}
        <div id="weekly-out" aria-live="polite"></div>
      </section>`}
      <section class="surface mt-3"><h2>Suggested for how you’ve been feeling</h2><div class="rec-list">${P.recommend({ emotions: Object.keys(ins.week.reduce((o, r) => { (r.moods || []).forEach(t => { o[t] = 1; }); return o; }, {})), count: 3 }).map(P.activityCard).join('')}</div></section>
    </main>`;

    view.querySelector('[data-weekly]')?.addEventListener('click', async e => {
      const btn = e.currentTarget, out = view.querySelector('#weekly-out'), notes = view.querySelector('#include-notes').checked;
      btn.disabled = true; out.innerHTML = '<p class="muted loading">Reflecting on your week…</p>';
      const entries = ins.week.map(r => ({ day: fmtDate(r.created, { weekday: 'short', month: 'short', day: 'numeric' }), level: r.level ? P.catalog.LEVELS[r.level - 1].label : null, feelings: r.moods || [], today: r.factors || [], ...(notes ? { note: truncate((r.text || '') + (r.help ? ' | Might help: ' + r.help : ''), 400) } : {}) }));
      const r = await P.ai.run('mood', 'mood_insights', { entries, patterns: ins.patterns.slice(0, 4).map(p => `${p.f}: ${p.yes > p.no ? 'lighter' : 'heavier'} days`) }, () => ({ text: ins.lines.join(' ') }));
      btn.disabled = false;
      const d = r.data || {};
      out.innerHTML = `<div class="ai-result">${P.ai.badge(r)}
        ${d.summary || r.text ? `<p>${esc(d.summary || r.text)}</p>` : ''}
        ${d.themes?.length ? `<h3 class="h4">Themes you might notice</h3><ul>${d.themes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${d.suggestions?.length ? `<h3 class="h4">Ideas for the week ahead</h3><ul>${d.suggestions.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <button class="btn-line btn-small" data-save-weekly>Save to journal</button></div>`;
      out.querySelector('[data-save-weekly]').onclick = async () => {
        const text = [d.summary || r.text, ...(d.themes || []).map(t => '• ' + t), ...(d.suggestions || []).map(t => '→ ' + t)].filter(Boolean).join('\n');
        await PauseStore.put('journal', { id: uid('j'), title: 'Weekly reflection · ' + fmtDate(Date.now()), text, category: 'Feelings', moods: [], created: Date.now(), updated: Date.now(), source: 'insights' });
        P.toast('Saved to your journal');
      };
    });
  }
})(window.Pause);
