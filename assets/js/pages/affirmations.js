/* Affirmations: daily affirmation, categories, mood-based picks, AI-written ones,
   your own words, and saved favourites (stored in "reflections" with kind "affirmation"). */
(function (P) {
  'use strict';
  const { esc, dailyPick, uid } = P.util;
  const C = P.catalog;
  let group = '', index = null, current = null;

  P.route('affirmations', async view => {
    const pool = () => C.AFFIRMATIONS.filter(a => !group || a.group === group);
    if (!current) { const d = dailyPick(C.AFFIRMATIONS, 'affirm'); current = { ...d, kind: 'daily' }; index = d.i; }
    const saved = (await PauseStore.all('reflections')).filter(x => x.kind === 'affirmation').sort((a, b) => b.created - a.created);
    const favGroups = P.prefs.get().affirmationGroups;
    const groups = [...favGroups, ...C.AFFIRMATION_GROUPS.filter(g => !favGroups.includes(g))];
    const savedIds = new Set(saved.map(s => s.id));
    const idOf = c => c.ai || c.custom ? c.id : 'affirm-' + c.i;

    view.innerHTML = `<main class="content affirmation-page">
      ${P.header({ eyebrow: 'A kind word to keep', title: 'Affirmations', intro: 'Choose a sentence that feels supportive. You can leave any that do not feel right for you. Kind words help, but they don’t have to fix everything.' })}
      <div class="chip-row" role="group" aria-label="Affirmation category">
        ${['', ...groups].map(g => `<button class="chip ${group === g ? 'selected' : ''}" aria-pressed="${group === g}" data-group="${esc(g)}">${esc(g || 'All')}${favGroups.includes(g) ? ' ♡' : ''}</button>`).join('')}
      </div>
      <section class="affirmation-card" aria-live="polite">
        <span class="aff-kicker">${current.kind === 'daily' ? 'Today’s affirmation · ' : ''}${esc(current.cat)}</span>
        <blockquote>“${esc(current.text)}”</blockquote>
        ${current.ai ? `<div class="mb-2">${P.ai.badge(current.src)}</div>` : ''}
        <div class="row-gap center">
          <button class="btn-main" data-aff="next">Another gentle reminder</button>
          <button class="btn-soft" data-aff="save" ${savedIds.has(idOf(current)) ? 'disabled' : ''}>${savedIds.has(idOf(current)) ? 'Saved ♥' : 'Save this one ♡'}</button>
          <button class="btn-line" data-aff="mood">For how I feel now</button>
        </div>
      </section>

      <div class="two-col mt-4">
        <section class="surface">
          <h2>Write one for me</h2>
          <p class="muted small">${P.ai.status() === 'ready' ? 'AI writes a realistic, supportive affirmation. Only the category, and the few words below if you add them, are sent.' : 'With AI off, Pause picks one from its library that fits the category.'}</p>
          <div class="field"><label for="aff-cat">Category</label><select id="aff-cat">${C.AFFIRMATION_GROUPS.map(g => `<option ${g === (group || favGroups[0]) ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label for="aff-context">What’s going on? <span class="muted">(optional, a few words)</span></label><input id="aff-context" maxlength="160" placeholder="e.g. nervous about an interview tomorrow"></div>
          <button class="btn-main" data-aff="generate">Create an affirmation</button>
        </section>
        <section class="surface">
          <h2>Your own words</h2>
          <p class="muted small">Write an affirmation in language that feels like yours.</p>
          <div class="field"><label for="custom-affirmation">A sentence for yourself</label><textarea id="custom-affirmation" placeholder="I am learning to…"></textarea></div>
          <button class="btn-line" data-aff="custom">Save my words</button>
        </section>
      </div>

      <section class="surface mt-4">
        <h2>Saved affirmations</h2>
        ${saved.length ? `<div class="saved-grid">${saved.map(x => `<article class="saved-aff"><span class="eyebrow">${esc(x.category || 'Your words')}</span><p class="affirmation-saved">${esc(x.text)}</p><button class="link-btn small" data-delete-affirmation="${esc(x.id)}">Remove</button></article>`).join('')}</div>` : '<div class="empty">Save a reminder to find it here next time.</div>'}
      </section>
    </main>`;

    view.addEventListener('click', async e => {
      const g = e.target.closest('[data-group]');
      if (g) { group = g.dataset.group; const p = pool(); const pickA = p[Math.floor(Math.random() * p.length)]; current = { ...pickA }; index = pickA.i; return P.render(); }
      const a = e.target.closest('[data-aff]')?.dataset.aff;
      if (a === 'next') {
        const p = pool(); const at = p.findIndex(x => x.i === index); const nx = p[(at + 1) % p.length];
        current = { ...nx }; index = nx.i; return P.render();
      }
      if (a === 'save') {
        await PauseStore.put('reflections', { id: idOf(current), kind: 'affirmation', category: current.cat, text: current.text, created: Date.now() });
        P.toast('Saved on this device'); return P.render();
      }
      if (a === 'mood') {
        const latest = (await P.data.moods())[0];
        const grp = (latest?.moods || []).map(m => C.GROUP_FOR_FEELING[m]).find(Boolean);
        if (!latest) P.toast('No check-in yet, so here is a gentle general one');
        const p = C.AFFIRMATIONS.filter(x => !grp || x.group === grp);
        const pickA = p[Math.floor(Math.random() * p.length)];
        current = { ...pickA, cat: grp ? `For feeling ${latest.moods.find(m => C.GROUP_FOR_FEELING[m] === grp).toLowerCase()}` : pickA.cat }; index = pickA.i;
        return P.render();
      }
      if (a === 'generate') {
        const cat = view.querySelector('#aff-cat').value, ctx = view.querySelector('#aff-context').value.trim();
        const btn = e.target.closest('button'); btn.disabled = true; btn.textContent = 'Writing…';
        const r = await P.ai.run('affirmations', 'affirmation', { category: cat, context: ctx }, () => P.ai.local.affirmation(cat));
        const text = (r.data?.affirmation || r.text || '').replace(/^["“]|["”]$/g, '').trim();
        current = r.source === 'ai' ? { id: uid('affirm-ai-'), cat, text, ai: true, src: r } : { ...(C.AFFIRMATIONS.find(x => x.text === text) || { i: 0, cat, text }) };
        if (r.source === 'local' && P.ai.status() !== 'ready') P.toast('Picked from the library (AI is off)');
        return P.render();
      }
      if (a === 'custom') {
        const text = view.querySelector('#custom-affirmation').value.trim();
        if (!text) return P.toast('Write a sentence first');
        await PauseStore.put('reflections', { id: 'affirm-custom-' + Date.now(), kind: 'affirmation', category: 'Your words', text, created: Date.now() });
        P.toast('Your words were saved'); return P.render();
      }
      const d = e.target.closest('[data-delete-affirmation]');
      if (d) { await PauseStore.del('reflections', d.dataset.deleteAffirmation); P.toast('Removed'); P.render(); }
    });
  });
})(window.Pause);
