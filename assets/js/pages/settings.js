/* Settings & privacy: appearance, personalisation, AI setup and consent,
   and full control over locally stored data (export, import, delete). */
(function (P) {
  'use strict';
  const { esc, fmtDate } = P.util;
  const C = P.catalog;

  P.route('settings', async (view, [section]) => {
    const p = P.prefs.get();
    const counts = {};
    for (const s of PauseStore.STORES) counts[s] = (await PauseStore.all(s)).length;
    const LABEL = { moods: 'Mood check-ins', journal: 'Journal entries', notes: 'Therapy notes', bookmarks: 'Saved reading', reflections: 'Affirmations & takeaways', activity: 'Activity history' };
    const st = P.ai.status();
    const check = (name, value, list, label) => `<label class="check-chip"><input type="checkbox" data-pref-list="${name}" value="${esc(value)}" ${list.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`;

    view.innerHTML = `<main class="content settings">
      ${P.header({ eyebrow: 'Your space, your choices', title: 'Settings & privacy' })}
      <nav class="settings-nav" aria-label="Settings sections"><a href="#s-look">Appearance</a><a href="#s-you">Personalise</a><a href="#s-ai">AI</a><a href="#s-data">Your data</a><a href="#s-about">About</a></nav>

      <section class="surface" id="s-look"><h2>Appearance & comfort</h2>
        <div class="field"><span class="field-label">Theme</span><div class="seg" role="radiogroup" aria-label="Theme">${[['system', 'Match device'], ['light', 'Light'], ['night', 'Night']].map(([v, l]) => `<button role="radio" aria-checked="${p.theme === v}" class="seg-btn ${p.theme === v ? 'active' : ''}" data-theme-set="${v}">${l}</button>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" data-pref="reduceMotion" ${p.reduceMotion ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Reduce motion <span class="muted small">(also follows your device setting)</span></label>
      </section>

      <section class="surface mt-3" id="s-you"><h2>Personalise</h2><p class="muted small">All optional. Used only on this device to tailor suggestions.</p>
        <div class="field"><label for="pref-name">What should Pause call you?</label><input id="pref-name" data-pref-text="name" value="${esc(p.name)}" maxlength="40" placeholder="Optional"></div>
        <fieldset class="field"><legend class="field-label">Your wellness goals</legend><div class="check-row">${C.GOALS.map(g => check('goals', g.id, p.goals, g.label)).join('')}</div></fieldset>
        <fieldset class="field"><legend class="field-label">Activities you enjoy</legend><div class="check-row">${Object.entries(C.KINDS).map(([k, l]) => check('activities', k, p.activities, l)).join('')}</div></fieldset>
        <fieldset class="field"><legend class="field-label">Favourite affirmation categories</legend><div class="check-row">${C.AFFIRMATION_GROUPS.map(g => check('affirmationGroups', g, p.affirmationGroups, g)).join('')}</div></fieldset>
        <div class="two-col tight">
          <div class="field"><label for="pref-min">Preferred session length</label><select id="pref-min" data-pref-num="sessionMinutes">${[1, 2, 3, 5, 10].map(m => `<option value="${m}" ${p.sessionMinutes === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></div>
          <div class="field"><label for="pref-sound">Favourite soundscape</label><select id="pref-sound" data-pref-sound>${PauseAudio.tracks.map(t => `<option ${PauseAudio.state.track === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
      </section>

      <section class="surface mt-3" id="s-ai"><h2>AI assistance</h2>
        <p class="ai-status"><span class="dot dot-${st}"></span>${esc(P.ai.statusLine())}</p>
        <label class="switch"><input type="checkbox" data-ai="enabled" ${p.ai.enabled ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Use AI features</label>
        <div class="ai-config" ${p.ai.enabled ? '' : 'hidden'}>
          <div class="field mt-3"><label for="ai-endpoint">Backend address</label>
            <div class="row-gap nowrap"><input id="ai-endpoint" class="input" placeholder="${esc(window.PAUSE_CONFIG?.aiEndpoint || 'https://pause-ai.your-name.workers.dev')}" value="${esc(p.ai.endpoint)}"><button class="btn-line btn-small" data-ai-test>Test</button></div>
            <p class="small muted">The address of <em>your</em> Pause backend (see the setup guide in the project README). Never paste an API key here. Leave empty to use the address in <code>assets/js/config.js</code>.</p>
            <p class="small" id="ai-test-out" aria-live="polite"></p>
          </div>
          <fieldset class="field"><legend class="field-label">Use AI for</legend><div class="check-row">
            ${[['companion', 'Companion conversations'], ['journal', 'Journal assistant & therapy notes'], ['mood', 'Weekly mood reflection'], ['reading', 'Article summaries'], ['affirmations', 'Personal affirmations'], ['breathing', 'Breathing suggestions']].map(([k, l]) => `<label class="check-chip"><input type="checkbox" data-ai-feature="${k}" ${p.ai.features[k] !== false ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div></fieldset>
          <div class="two-col tight">
            <div class="field"><label for="ai-tone">Response style</label><select id="ai-tone" data-ai-sel="tone">${[['gentle', 'Gentle and soft'], ['warm-direct', 'Warm but direct'], ['practical', 'Practical and brief']].map(([v, l]) => `<option value="${v}" ${p.ai.tone === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="ai-len">Response length</label><select id="ai-len" data-ai-sel="length">${[['short', 'Short'], ['medium', 'Medium']].map(([v, l]) => `<option value="${v}" ${p.ai.length === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
          <label class="switch"><input type="checkbox" data-ai="suggestActivities" ${p.ai.suggestActivities ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Let the companion suggest Pause activities</label>
          ${p.ai.consent ? '<p class="small mt-2">You agreed to the AI data notice. <button class="link-btn small" data-ai-revoke>Withdraw consent</button></p>' : ''}
        </div>
        <details class="mt-3"><summary><strong>What is sent when you use AI?</strong></summary>
          <table class="data-table"><thead><tr><th>Feature</th><th>Sent when you press the button</th><th>Never sent</th></tr></thead><tbody>
            <tr><td>Companion</td><td>This conversation’s messages, the chosen mode, activity names</td><td>Journal, check-ins, your name</td></tr>
            <tr><td>Journal assistant</td><td>The text of the one entry, only if “Allow AI for this entry” is on</td><td>Other entries</td></tr>
            <tr><td>Journal prompts</td><td>Feeling words from your last few check-ins</td><td>Notes or entries</td></tr>
            <tr><td>Weekly reflection</td><td>This week’s levels, feelings, “Today I…” choices; notes only if you tick the box</td><td>Journal, therapy notes</td></tr>
            <tr><td>Therapy notes</td><td>The note text, when you press “Organise with AI”</td><td>Everything else</td></tr>
            <tr><td>Article summary</td><td>The public article text</td><td>Anything personal</td></tr>
            <tr><td>Breathing suggestions</td><td>The few words you type to describe how you feel</td><td>Check-ins, journal</td></tr>
            <tr><td>Affirmations</td><td>The category and the optional few words you type</td><td>Anything else</td></tr>
          </tbody></table>
          <p class="small muted">The included backend doesn’t store or log what you send. The AI provider it forwards to has its own privacy policy. Safety checks for crisis language always run on your device first.</p>
        </details>
      </section>

      <section class="surface mt-3" id="s-data"><h2>Your data</h2>
        <p>Pause stores everything in this browser using IndexedDB, with a local-storage fallback. Nothing is sent to a server, analytics provider or therapist. There is no account and no tracking. Data may not follow you to another device, and clearing browser data can delete it. This is not an encrypted backup.</p>
        <ul class="data-counts">${PauseStore.STORES.map(s => `<li><span>${LABEL[s]}</span><span class="muted">${counts[s]}</span>${counts[s] ? `<button class="link-btn small" data-clear-store="${s}">Delete</button>` : ''}</li>`).join('')}</ul>
        <div class="row-gap mt-3">
          <button class="btn-main" data-export>Export all my data (JSON)</button>
          <label class="btn-line file-btn">Import a backup<input type="file" accept="application/json,.json" data-import hidden></label>
          <button class="btn-danger" data-wipe>Delete everything</button>
        </div>
        <p class="small muted mt-2">Importing adds to what’s here and never deletes anything.</p>
      </section>

      <section class="surface mt-3" id="s-about"><h2>About & support</h2>
        <div class="privacy-box"><strong>Audio</strong><p>Sound is generated locally by your browser after you choose Play. No external audio service is used. Choose Silence or Stop to end sound.</p></div>
        <div class="privacy-box mt-2"><strong>About Pause</strong><p>Pause is a supportive self-reflection tool. It does not diagnose or replace professional care. If you would like more support, consider speaking with someone you trust or a qualified mental-health professional.</p></div>
        <a class="btn-soft mt-3" href="#/support">More about support →</a>
      </section>
    </main>`;

    const $ = s => view.querySelector(s);
    if (section) setTimeout(() => $('#s-' + section)?.scrollIntoView({ block: 'start' }), 50);
    view.querySelectorAll('.settings-nav a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({ behavior: P.motionReduced() ? 'auto' : 'smooth' }); }));

    view.addEventListener('change', async e => {
      const t = e.target;
      if (t.dataset.pref) { P.prefs.set({ [t.dataset.pref]: t.checked }); P.toast('Saved'); }
      if (t.dataset.prefList) { const name = t.dataset.prefList; P.prefs.set({ [name]: [...view.querySelectorAll(`[data-pref-list="${name}"]:checked`)].map(x => x.value) }); }
      if (t.dataset.prefText) P.prefs.set({ [t.dataset.prefText]: t.value.trim() });
      if (t.dataset.prefNum) P.prefs.set({ [t.dataset.prefNum]: +t.value });
      if (t.dataset.prefSound !== undefined) { P.prefs.set({ sounds: [t.value] }); PauseAudio.select(t.value); P.toast('Default sound saved. Press Play in the sound bar to listen.'); }
      if (t.dataset.ai === 'enabled') { P.prefs.set({ ai: { enabled: t.checked } }); P.render(); }
      if (t.dataset.ai === 'suggestActivities') P.prefs.set({ ai: { suggestActivities: t.checked } });
      if (t.dataset.aiFeature) P.prefs.set({ ai: { features: { [t.dataset.aiFeature]: t.checked } } });
      if (t.dataset.aiSel) P.prefs.set({ ai: { [t.dataset.aiSel]: t.value } });
      if (t.id === 'ai-endpoint') {
        const v = t.value.trim();
        if (v && !P.ai.validEndpoint(v)) { $('#ai-test-out').textContent = 'Use an https:// address (http is allowed only for localhost).'; return; }
        P.prefs.set({ ai: { endpoint: v } }); $('#ai-test-out').textContent = 'Saved.';
      }
      if (t.matches('[data-import]') && t.files[0]) {
        try { const n = await PauseStore.importAll(JSON.parse(await t.files[0].text())); P.toast(`Imported ${n} items`); P.render(); }
        catch (err) { P.dialog({ title: 'Import didn’t work', body: `<p>${esc(err.message || 'The file could not be read.')}</p>` }); }
      }
    });
    view.addEventListener('click', async e => {
      const th = e.target.closest('[data-theme-set]');
      if (th) { P.prefs.set({ theme: th.dataset.themeSet }); view.querySelectorAll('[data-theme-set]').forEach(b => { const on = b === th; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); }); return; }
      if (e.target.closest('[data-ai-test]')) {
        const v = $('#ai-endpoint').value.trim(); if (v) P.prefs.set({ ai: { endpoint: v } });
        const out = $('#ai-test-out'); out.textContent = 'Testing…';
        try { const r = await P.ai.request('ping', { deep: true }); out.textContent = r.mock ? '✓ Connected, but the backend is in test mode (PROVIDER=mock). Responses won’t come from AI.' : r.data?.keyConfigured === false ? `⚠ Connected, but the backend has no API key (or MODEL) set for “${r.data.provider}”. See the setup guide.` : `✓ Connected, and the AI answered. Provider: ${r.data?.provider || 'configured'}${r.data?.model ? ' · model ' + r.data.model : ''}.`; }
        catch (err) { out.textContent = '✗ ' + err.message; }
        return;
      }
      if (e.target.closest('[data-ai-revoke]')) { P.prefs.set({ ai: { consent: false } }); P.toast('Consent withdrawn. You’ll be asked again before anything is sent.'); P.render(); }
      if (e.target.closest('[data-export]')) {
        const data = await PauseStore.exportAll();
        P.download(`pause-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
        P.toast('Backup downloaded. Keep it somewhere private.');
      }
      const cs = e.target.closest('[data-clear-store]');
      if (cs && await P.confirm(`Delete all ${LABEL[cs.dataset.clearStore].toLowerCase()}?`, 'This removes them from this device. You can export a backup first.', 'Delete', true)) { await PauseStore.clear(cs.dataset.clearStore); P.toast('Deleted'); P.render(); }
      if (e.target.closest('[data-wipe]') && await P.confirm('Delete everything?', 'Every check-in, journal entry, note, bookmark, affirmation, activity record and preference on this device will be removed. This cannot be undone.', 'Delete everything', true)) {
        await PauseStore.wipe();
        ['pause-prefs', 'pause-journal-draft', 'pause-game-levels', 'pause-breath-custom', 'pause-reader-size', 'pause-visited'].forEach(k => P.util.safeLS.del(k));
        P.prefs.reset(); P.refreshActivity();
        P.toast('All saved data cleared'); P.render();
      }
    });
  });

  P.route('support', view => {
    view.innerHTML = `<main class="content"><article class="article-layout">
      <div class="eyebrow">Support, at your pace</div>
      <h1 class="page-title">You do not have to manage alone.</h1>
      <p>Pause can offer a quiet activity or help you organise a thought, but it cannot provide crisis care or replace a therapist. You can reach out to a trusted person, a qualified counsellor, or a health professional when you need more support.</p>
      ${P.safety.card('crisis')}
      <p class="small muted">Service details can change. Check the official <a href="https://112.gov.in/" target="_blank" rel="noopener">112</a> and <a href="https://dghs.mohfw.gov.in/national-mental-health-programme.php" target="_blank" rel="noopener">Tele-MANAS</a> pages for current information.</p>
      <div class="surface mt-3"><h2 class="h3">Make the next step small</h2><p>You could tell someone: “I’m having a hard time and I don’t want to be alone right now. Can you stay with me?”</p><a class="btn-soft" href="#/routine/reach-out">Write a message to someone</a></div>
      <div class="surface mt-3"><h2 class="h3">Preparing for therapy</h2><p>If you’re thinking about seeing a counsellor, <a href="#/notes">My Notes for Therapy</a> can help you gather your thoughts beforehand.</p></div>
      <a class="btn-line mt-4" href="#/settings">← Settings & privacy</a>
    </article></main>`;
  });
})(window.Pause);
