/* Today: the personal wellness dashboard. No streaks, no scores, no guilt. */
(function (P) {
  'use strict';
  const { esc, dayKey, fmtDate, fmtTime, dailyPick, truncate, DAY } = P.util;
  const C = P.catalog;
  let minutes = null, shown = [];

  function greeting() {
    const h = new Date().getHours(), name = P.prefs.get().name.trim();
    const part = h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return part + (name ? ', ' + name : '');
  }

  P.route('today', async view => {
    P.markVisited();
    const [moods, journal, activity, bookmarks] = await Promise.all([P.data.moods(), P.data.journal(), P.data.activity(), PauseStore.all('bookmarks')]);
    const todayKey = dayKey(Date.now());
    const todays = moods.filter(m => dayKey(m.created) === todayKey);
    const latest = todays[0] || null;
    const daily = dailyPick(C.AFFIRMATIONS, 'affirm');
    const weekAgo = Date.now() - 7 * DAY;
    const weekActs = activity.filter(a => a.created > weekAgo);
    const minutesPaused = Math.round(weekActs.reduce((s, a) => s + (a.seconds || 0), 0) / 60);
    const readIds = new Set(activity.filter(a => a.kind === 'read' && a.ref?.startsWith('read:')).map(a => a.ref.slice(5)));
    const lastOpened = activity.find(a => a.kind === 'read-open');
    const continueArticle = lastOpened && !readIds.has(lastOpened.ref) ? PauseArticles.find(x => x.id === lastOpened.ref) : null;
    const kindCounts = {};
    weekActs.filter(a => C.KINDS[a.kind]).forEach(a => { kindCounts[a.kind] = (kindCounts[a.kind] || 0) + 1; });

    view.innerHTML = `<main class="content today">
      <section class="today-hero">
        <div>
          <div class="eyebrow">${esc(fmtDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
          <h1 class="page-title">${esc(greeting())}.</h1>
          <p class="muted lead">${latest ? 'Thank you for checking in today. Here are a few small things that might help.' : 'How are you, really? There is no right answer.'}</p>
        </div>
      </section>

      <div class="dash-grid">
        <section class="surface dash-checkin" aria-labelledby="ci-h">
          <div class="card-head"><h2 id="ci-h">Today’s check-in</h2>${latest ? `<a class="link-btn" href="#/mood">Add another</a>` : ''}</div>
          ${latest ? `<div class="checkin-summary">
              ${latest.level ? `<div class="level-chip" data-level="${latest.level}">${esc(C.LEVELS[latest.level - 1].label)}</div>` : ''}
              <div>${(latest.moods || []).map(t => `<span class="tag">${esc(t)}</span>`).join('') || '<span class="muted">No feelings chosen</span>'}</div>
              <small class="muted">Saved at ${fmtTime(latest.created)}${todays.length > 1 ? ` · ${todays.length} check-ins today` : ''}</small>
            </div>`
            : `<p class="muted">Tap whatever feels closest. You can add details next.</p>
              <div class="level-picker" role="group" aria-label="How are you feeling overall?">
                ${C.LEVELS.map(l => `<button class="level-btn" data-level="${l.v}" data-go="mood/checkin/${l.v}"><span class="level-dot" aria-hidden="true"></span>${esc(l.label)}</button>`).join('')}
              </div>`}
        </section>

        <section class="surface dash-affirm" aria-labelledby="af-h">
          <div class="eyebrow" id="af-h">Today’s affirmation · ${esc(daily.group)}</div>
          <blockquote class="quote">“${esc(daily.text)}”</blockquote>
          <div class="row-gap"><button class="btn-soft btn-small" data-save-daily>Save ♡</button><a class="link-btn" href="#/affirmations">More affirmations</a></div>
        </section>

        <section class="surface dash-companion" aria-labelledby="co-h">
          <h2 id="co-h">Talk it through</h2>
          <p class="muted small">A gentle companion for everyday stress. It is not a therapist.</p>
          <form data-quick-companion>
            <label class="sr-only" for="quick-msg">What’s on your mind?</label>
            <textarea id="quick-msg" rows="2" placeholder="What’s on your mind?"></textarea>
            <div class="chip-row mt-2">${P.companionModes.slice(0, 4).map(m => `<button type="button" class="chip" data-quick-mode="${m.id}">${esc(m.label)}</button>`).join('')}</div>
            <button class="btn-main btn-small mt-2" type="submit">Open companion →</button>
          </form>
        </section>

        <section class="surface dash-recs span-2" aria-labelledby="rec-h">
          <div class="card-head"><div><h2 id="rec-h">Something small for right now</h2><p class="muted small">Chosen on this device from your check-ins, goals and recent activities.</p></div>
            <div class="chip-row" role="group" aria-label="Time available">${[2, 5, 10, 20].map(m => `<button class="chip ${minutes === m ? 'selected' : ''}" aria-pressed="${minutes === m}" data-minutes="${m}">${m} min</button>`).join('')}</div>
          </div>
          <div class="rec-list" id="rec-list"></div>
          <button class="link-btn mt-2" data-more-recs>Show different ideas ↻</button>
        </section>


        <section class="surface dash-week" aria-labelledby="wk-h">
          <div class="card-head"><h2 id="wk-h">Your week</h2><a class="link-btn" href="#/mood/insights">See insights</a></div>
          <div id="dash-week-chart"></div>
        </section>

        <section class="surface" aria-labelledby="jr-h">
          <div class="card-head"><h2 id="jr-h">Recent journal</h2><a class="link-btn" href="#/journal/new">Write</a></div>
          ${journal.length ? `<ul class="mini-list">${journal.slice(0, 3).map(j => `<li><a href="#/journal/${esc(j.id)}"><strong>${esc(j.title || 'Untitled entry')}</strong><span class="muted small">${fmtDate(j.updated || j.created)} · ${esc(j.category || 'Everyday')}</span><span class="small">${esc(truncate(j.text, 90))}</span></a></li>`).join('')}</ul>`
            : `<div class="empty-mini"><p class="muted">Your journal is empty. Today’s prompt:</p><p class="prompt-text">${esc(dailyPick(C.JOURNAL_PROMPTS, 'prompt'))}</p></div>`}
        </section>

        <section class="surface" aria-labelledby="ac-h">
          <h2 id="ac-h">This week’s pauses</h2>
          ${weekActs.length ? `<p class="big-soft">${minutesPaused ? `${minutesPaused} min` : 'A few moments'}<span class="muted small"> spent pausing</span></p>
            <ul class="kind-list">${Object.entries(kindCounts).map(([k, n]) => `<li><span>${esc(C.KINDS[k])}</span><span class="muted">${n}×</span></li>`).join('')}</ul>
            <details class="mt-2"><summary class="small">Recent activity</summary><ul class="mini-list">${weekActs.filter(a => C.KINDS[a.kind]).slice(0, 6).map(a => `<li><span>${esc(a.title || C.KINDS[a.kind])}</span><span class="muted small">${fmtDate(a.created, { weekday: 'short' })} ${fmtTime(a.created)}</span></li>`).join('')}</ul></details>`
            : '<p class="muted">Breathing sessions, games and reading you do will gather here. No targets, just a record.</p>'}
        </section>

        <section class="surface" aria-labelledby="rd-h">
          <div class="card-head"><h2 id="rd-h">Reading</h2><a class="link-btn" href="#/read">Library</a></div>
          <div class="progress-line" role="img" aria-label="${readIds.size} of ${PauseArticles.length} articles read"><span style="width:${(readIds.size / PauseArticles.length) * 100}%"></span></div>
          <p class="small muted">${readIds.size} of ${PauseArticles.length} read · ${bookmarks.length} saved</p>
          ${continueArticle ? `<a class="continue-card" href="#/article/${esc(continueArticle.id)}"><span class="eyebrow">Continue reading</span><strong>${esc(continueArticle.title)}</strong></a>` : ''}
        </section>
      </div>
    </main>`;

    P.charts.moodLine(view.querySelector('#dash-week-chart'), moods, { days: 7, compact: true });
    const emotions = latest?.moods || [], level = latest?.level ?? null;
    const paintRecs = (fresh = false) => {
      const recs = P.recommend({ emotions, level, minutes, exclude: fresh ? shown : [], count: 3 });
      shown = recs.map(r => r.activity.id);
      view.querySelector('#rec-list').innerHTML = recs.map(P.activityCard).join('');
    };
    paintRecs();
    view.addEventListener('click', async e => {
      const m = e.target.closest('[data-minutes]');
      if (m) { minutes = minutes === +m.dataset.minutes ? null : +m.dataset.minutes; view.querySelectorAll('[data-minutes]').forEach(b => { const on = +b.dataset.minutes === minutes; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); }); paintRecs(); return; }
      if (e.target.closest('[data-more-recs]')) return paintRecs(true);
      if (e.target.closest('[data-save-daily]')) {
        await PauseStore.put('reflections', { id: 'affirm-' + daily.i, kind: 'affirmation', category: daily.cat, text: daily.text, created: Date.now() });
        e.target.textContent = 'Saved ♥'; P.toast('Affirmation saved on this device');
      }
      const qm = e.target.closest('[data-quick-mode]');
      if (qm) { P.companionStart = { mode: qm.dataset.quickMode, text: view.querySelector('#quick-msg').value }; P.go('companion'); }
    });
    view.querySelector('[data-quick-companion]').addEventListener('submit', e => { e.preventDefault(); P.companionStart = { mode: 'listen', text: view.querySelector('#quick-msg').value }; P.go('companion'); });
  });

  /* "sound/<track>" route, used by links outside a click context */
  P.route('sound', (view, [track]) => { PauseAudio.playTrack(track); P.go('today'); });
})(window.Pause);
