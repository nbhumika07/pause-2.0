/* Journal with an optional AI assistant.
   Entries: { id, title, text, category, moods[], created, updated, aiAllowed, prompt }.
   AI tools only run on an entry when "Allow AI for this entry" is switched on. */
(function (P) {
  'use strict';
  const { esc, uid, fmtDate, dailyPick, truncate, safeLS, words } = P.util;
  const C = P.catalog;
  const DRAFT_KEY = 'pause-journal-draft';
  let filter = { q: '', cat: '' }, promptQueue = [];

  P.route('journal', async (view, [id]) => {
    const all = await P.data.journal();
    const takeaways = (await PauseStore.all('reflections')).filter(x => x.kind !== 'affirmation').sort((a, b) => b.created - a.created);
    let entry = id && id !== 'new' ? all.find(e => e.id === id) : null;
    if (!entry) {
      let draft = null; try { draft = JSON.parse(safeLS.get(DRAFT_KEY, 'null')); } catch { }
      entry = draft && id !== 'new' ? draft : { id: uid('j'), title: '', text: '', category: '', moods: [], created: Date.now(), aiAllowed: false, isNew: true };
      if (id === 'new' && draft?.text) entry = draft;
    }
    const prompt = entry.prompt || dailyPick(C.JOURNAL_PROMPTS, 'prompt');
    const cats = [...new Set(all.map(e => e.category).filter(Boolean))];

    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'Private by default', title: 'Journal', intro: 'Write freely. Entries stay on this device. AI help is optional and works only on entries you allow.' })}
      <div class="journal-layout">
        <aside class="surface journal-side">
          <button class="btn-main w-100" data-new-entry>＋ New entry</button>
          <label class="sr-only" for="j-search">Search entries</label>
          <input class="input mt-3" id="j-search" placeholder="Search entries" value="${esc(filter.q)}">
          ${cats.length ? `<div class="chip-row mt-2">${['', ...cats].map(c => `<button class="chip chip-sm ${filter.cat === c ? 'selected' : ''}" data-cat="${esc(c)}">${esc(c || 'All')}</button>`).join('')}</div>` : ''}
          <ul class="entry-list" id="entry-list">${all.length ? '' : '<li class="muted small">Entries you save will appear here.</li>'}</ul>
          ${takeaways.length ? `<details class="mt-3"><summary><strong>Reading takeaways</strong> <span class="muted small">(${takeaways.length})</span></summary>
            ${takeaways.map(x => `<div class="saved-takeaway"><small class="muted">${fmtDate(x.created)} · ${esc(x.source || 'Reading')}</small><p>${esc(x.text)}</p><button class="link-btn small" data-delete-takeaway="${esc(x.id)}">Delete</button></div>`).join('')}</details>` : ''}
        </aside>

        <section class="journal-main">
          <div class="surface prompt-card">
            <div><div class="eyebrow">Writing inspiration</div><p class="prompt-text" id="prompt-text">${esc(prompt)}</p></div>
            <div class="row-gap"><button class="btn-line btn-small" data-prompt="next">Another prompt</button><button class="btn-line btn-small" data-prompt="ai">Prompts for me</button><button class="btn-soft btn-small" data-prompt="use">Use this prompt</button></div>
          </div>

          <form class="surface editor" id="editor" autocomplete="off">
            <div class="field"><label for="j-title">Title</label><input id="j-title" value="${esc(entry.title)}" placeholder="${esc(fmtDate(entry.created, { weekday: 'long', month: 'long', day: 'numeric' }))}"></div>
            <div class="field"><label for="j-text">Your thoughts</label><textarea id="j-text" class="journal-text" placeholder="Start anywhere…">${esc(entry.text)}</textarea></div>
            <div class="editor-meta">
              <label class="field-inline">Category <select id="j-cat">${['', ...Object.keys(C.JOURNAL_CATEGORIES), 'Everyday'].map(c => `<option value="${esc(c)}" ${entry.category === c ? 'selected' : ''}>${c || 'Detect automatically'}</option>`).join('')}</select></label>
              <span class="muted small" id="j-count">${words(entry.text)} words</span>
              <span class="muted small" id="j-saved" aria-live="polite">${entry.isNew ? '' : 'Saved ' + fmtDate(entry.updated || entry.created)}</span>
            </div>
            <label class="switch mt-2"><input type="checkbox" id="j-ai" ${entry.aiAllowed ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Allow AI for this entry <span class="muted small">(AI tools send this entry’s text only when you press one)</span></label>
            <div class="row-gap mt-3">
              <button class="btn-main" type="submit">Save entry</button>
              ${entry.isNew ? '' : '<button type="button" class="btn-line" data-delete-entry>Delete</button><button type="button" class="btn-line" data-export-entry>Export</button>'}
            </div>
          </form>

          <section class="surface assistant" aria-labelledby="as-h">
            <div class="card-head"><h2 id="as-h" class="h3">Journal assistant</h2><span class="muted small" id="as-mode"></span></div>
            <div class="tool-grid">
              <button class="tool-btn" data-tool="reflect"><strong>Reflect</strong><span>Gentle questions about what you wrote</span></button>
              <button class="tool-btn" data-tool="organize"><strong>Organise my thoughts</strong><span>Sort scattered thoughts into sections</span></button>
              <button class="tool-btn" data-tool="summarize"><strong>Summarise</strong><span>A short version of a long entry</span></button>
              <button class="tool-btn" data-tool="takeaway"><strong>Positive takeaway</strong><span>Something kind to notice</span></button>
              <button class="tool-btn" data-tool="categorize"><strong>Suggest a category</strong><span>Helps you find it later</span></button>
            </div>
            <div id="tool-out" aria-live="polite"></div>
          </section>
        </section>
      </div>
    </main>`;

    const $ = s => view.querySelector(s);
    const list = $('#entry-list');
    const paintList = () => {
      const q = filter.q.toLowerCase();
      const rows = all.filter(e => (!filter.cat || e.category === filter.cat) && (!q || (e.title + ' ' + e.text).toLowerCase().includes(q)));
      if (all.length) list.innerHTML = rows.length ? rows.map(e => `<li><a href="#/journal/${esc(e.id)}" class="${e.id === entry.id ? 'current' : ''}" ${e.id === entry.id ? 'aria-current="true"' : ''}><strong>${esc(e.title || 'Untitled entry')}</strong><span class="muted small">${fmtDate(e.updated || e.created)} · ${esc(e.category || 'Everyday')}</span><span class="small">${esc(truncate(e.text, 70))}</span></a></li>`).join('') : '<li class="muted small">No entries match.</li>';
    };
    paintList();
    const assistantMode = () => { $('#as-mode').innerHTML = $('#j-ai').checked && P.ai.status() === 'ready' ? 'AI will be used when you press a tool' : 'On-device suggestions' + (P.ai.status() === 'ready' ? ' (turn on “Allow AI” to use AI)' : ''); };
    assistantMode();

    const collect = () => {
      const text = $('#j-text').value;
      return { ...entry, title: $('#j-title').value.trim(), text, category: $('#j-cat').value || P.reading.categorize(text), aiAllowed: $('#j-ai').checked, prompt: $('#prompt-text').textContent, updated: Date.now() };
    };
    let dirty = false, draftTimer;
    const markDirty = () => {
      dirty = true; $('#j-saved').textContent = 'Not saved yet'; $('#j-count').textContent = words($('#j-text').value) + ' words';
      clearTimeout(draftTimer);
      if (entry.isNew) draftTimer = setTimeout(() => safeLS.set(DRAFT_KEY, JSON.stringify(collect())), 800);
    };
    $('#editor').addEventListener('input', markDirty);
    $('#j-ai').addEventListener('change', assistantMode);
    async function save() {
      const e = collect(); delete e.isNew;
      if (!e.text.trim() && !e.title) { P.toast('Write something first'); return null; }
      await PauseStore.put('journal', e);
      if (entry.isNew) { safeLS.del(DRAFT_KEY); P.logActivity('journal', 'journal:write', 'Journal entry', 0); }
      dirty = false; P.toast('Saved on this device');
      if (entry.isNew) { P.go('journal/' + e.id); } else { entry = e; $('#j-saved').textContent = 'Saved just now'; const i = all.findIndex(x => x.id === e.id); all[i] = e; paintList(); }
      return e;
    }
    $('#editor').addEventListener('submit', e => { e.preventDefault(); save(); });
    $('#editor').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
    P.onLeave(() => { if (dirty && !entry.isNew) P.toast('You left an entry with unsaved changes.', { kind: 'warn' }); });

    $('#j-search').addEventListener('input', e => { filter.q = e.target.value; paintList(); });

    view.addEventListener('click', async e => {
      const cb = e.target.closest('[data-cat]'); if (cb) { filter.cat = cb.dataset.cat; view.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('selected', b === cb)); paintList(); return; }
      if (e.target.closest('[data-new-entry]')) { if (dirty && !await P.confirm('Start a new entry?', 'Your unsaved changes to this entry will be lost.', 'Start new')) return; safeLS.del(DRAFT_KEY); dirty = false; P.go('journal/new'); return; }
      const pr = e.target.closest('[data-prompt]')?.dataset.prompt;
      if (pr === 'next') { $('#prompt-text').textContent = promptQueue.shift() || P.util.pick(C.JOURNAL_PROMPTS); return; }
      if (pr === 'use') { const t = $('#j-text'); if (!t.value.includes($('#prompt-text').textContent)) t.value = ($('#prompt-text').textContent + '\n\n' + t.value).trim() + '\n'; t.focus(); t.setSelectionRange(t.value.length, t.value.length); markDirty(); return; }
      if (pr === 'ai') {
        const recent = (await P.data.moods()).slice(0, 5).flatMap(m => m.moods || []);
        e.target.disabled = true;
        const r = await P.ai.run('journal', 'journal_prompts', { recentFeelings: [...new Set(recent)].slice(0, 8) }, () => P.ai.local.prompts(recent));
        e.target.disabled = false;
        promptQueue = (r.data?.prompts || []).slice(0);
        $('#prompt-text').textContent = promptQueue.shift() || P.util.pick(C.JOURNAL_PROMPTS);
        P.toast(r.source === 'ai' ? 'New prompts based on your recent feelings (only feeling words were sent)' : 'Prompts chosen on this device from your recent feelings');
        return;
      }
      const tool = e.target.closest('[data-tool]')?.dataset.tool;
      if (tool) return runTool(tool);
      if (e.target.closest('[data-delete-entry]') && await P.confirm('Delete this entry?', 'It will be removed from this device.', 'Delete', true)) { await PauseStore.del('journal', entry.id); dirty = false; P.toast('Entry deleted'); P.go('journal/new'); }
      if (e.target.closest('[data-export-entry]')) { const x = collect(); P.download((x.title || 'journal-entry').replace(/[^\w-]+/g, '-').toLowerCase() + '.txt', `${x.title || 'Journal entry'}\n${fmtDate(x.created)}\nCategory: ${x.category}\n\n${x.text}`); }
      const dt = e.target.closest('[data-delete-takeaway]');
      if (dt && await P.confirm('Delete this takeaway?', 'It will be removed from this device.', 'Delete', true)) { await PauseStore.del('reflections', dt.dataset.deleteTakeaway); P.render(); }
      const ins = e.target.closest('[data-insert]');
      if (ins) { const t = $('#j-text'); t.value = t.value.trimEnd() + '\n\n' + ins.dataset.insert; markDirty(); P.toast('Added to your entry. Remember to save.'); }
      const setCat = e.target.closest('[data-set-cat]');
      if (setCat) { const sel = $('#j-cat'); if (![...sel.options].some(o => o.value === setCat.dataset.setCat)) sel.add(new Option(setCat.dataset.setCat, setCat.dataset.setCat)); sel.value = setCat.dataset.setCat; markDirty(); }
    });

    async function runTool(tool) {
      const text = $('#j-text').value.trim(), out = $('#tool-out');
      if (words(text) < 4) { out.innerHTML = '<p class="muted">Write a few sentences first, then try this.</p>'; return; }
      const safety = P.safety.check(text);
      const useAI = $('#j-ai').checked;
      out.innerHTML = '<p class="muted loading">Thinking gently…</p>';
      const tasks = { reflect: 'journal_reflect', organize: 'journal_organize', summarize: 'journal_summary', takeaway: 'journal_takeaway', categorize: 'journal_categorize' };
      const fallback = () => P.ai.local[tool](text);
      const r = useAI ? await P.ai.run('journal', tasks[tool], { text }, fallback) : { source: 'local', ...fallback() };
      const d = r.data || {};
      let html = '';
      if (tool === 'reflect') { const qs = d.questions || [r.text]; html = `<ul class="q-list">${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ul><button class="btn-line btn-small" data-insert="${esc(qs.map(q => '• ' + q).join('\n'))}">Add questions to my entry</button>`; }
      if (tool === 'summarize') { const pts = d.points || [r.text]; html = `<ul>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul><button class="btn-line btn-small" data-insert="${esc('Summary:\n' + pts.map(p => '• ' + p).join('\n'))}">Add summary to my entry</button>`; }
      if (tool === 'takeaway') { const t = d.takeaway || r.text; html = `<p class="takeaway">${esc(t)}</p><button class="btn-line btn-small" data-insert="${esc('A kind takeaway: ' + t)}">Add to my entry</button>`; }
      if (tool === 'categorize') { const c = d.category || r.text; html = `<p>Suggested category: <strong>${esc(c)}</strong></p><button class="btn-line btn-small" data-set-cat="${esc(c)}">Use this category</button>`; }
      if (tool === 'organize') {
        const secs = d.sections || [];
        const asText = secs.map(s => s.title + '\n' + s.items.map(i => '• ' + i).join('\n')).join('\n\n');
        html = secs.length ? `${secs.map(s => `<div class="org-sec"><h4>${esc(s.title)}</h4><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}<button class="btn-line btn-small" data-insert="${esc('Organised:\n\n' + asText)}">Add organised version to my entry</button>` : `<p>${esc(r.text || 'Could not organise this one.')}</p>`;
      }
      out.innerHTML = `<div class="ai-result">${P.ai.badge(r)}${r.source === 'local' && !useAI && P.ai.status() === 'ready' ? '<span class="muted small"> Switch on “Allow AI for this entry” for an AI version.</span>' : ''}${safety ? P.safety.card(safety) : ''}${html}</div>`;
    }

    if (location.hash.endsWith('/new')) $('#j-text').focus();
  });
})(window.Pause);
