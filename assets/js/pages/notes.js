/* My Notes for Therapy (original feature, preserved), with a smarter
   "organise my thoughts" helper and optional AI organising. */
(function (P) {
  'use strict';
  const { esc, fmtDate } = P.util;
  const FIELDS = ['What I have been feeling', 'What happened or may have triggered it', 'Thoughts that keep coming back', 'How it has been affecting my daily life', 'What I have tried so far', 'What helped, even a little', 'What I want my therapist to understand', 'Questions I want to ask', 'Anything else I do not want to forget'];
  /* Keyword hints for placing a sentence under the most fitting heading. */
  const HINTS = [/\b(feel|feeling|felt|sad|angry|anxious|lonely|numb|scared|overwhelm|tired|empty)/i, /\b(happened|because|after|when|started|trigger|since|exam|fight|argument)/i, /\b(keep thinking|can'?t stop|always think|what if|again and again|thought)/i, /\b(sleep|eat|eating|class|work|college|focus|daily|morning|night|energy)/i, /\b(tried|try|trying|attempted)/i, /\b(helped|helps|better|relief|calmer)/i, /\b(understand|want (you|them|my therapist) to know|important)/i, /\?$/, /./];

  function localOrganize(text) {
    const out = FIELDS.map(() => []);
    text.split(/\n+|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).forEach(s => { const i = HINTS.findIndex(r => r.test(s)); out[i].push(s); });
    return out.map(x => x.join(' '));
  }

  P.route('notes', async (view, [id]) => {
    const all = (await PauseStore.all('notes')).sort((a, b) => b.updated - a.updated);
    const moods = await P.data.moods();
    const n = id ? all.find(x => x.id === id) : null;
    let noteId = n?.id || null;
    const values = n?.fields || {};
    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'For a conversation with a real person', title: 'My Notes for Therapy', intro: 'A place to gather your thoughts before talking with a counsellor or therapist. Nothing is shared automatically.' })}
      <div class="note-grid">
        <aside class="surface">
          <a class="btn-main w-100" href="#/notes" data-new-note>＋ New note</a>
          <h2 class="h3 mt-4">Saved notes</h2>
          ${all.length ? all.map(x => `<div class="entry ${x.id === noteId ? 'current' : ''}"><strong>${esc(x.title || 'Therapy note')}</strong><div class="muted small">${fmtDate(x.date || x.updated)}</div><div class="row-gap mt-2"><a class="btn-soft btn-small" href="#/notes/${esc(x.id)}">Open</a><button class="btn-line btn-small" data-delete-note="${esc(x.id)}">Delete</button></div></div>`).join('') : '<p class="muted mt-3">Your notes will appear here.</p>'}
        </aside>
        <section class="surface">
          <div class="two-col tight"><div class="field"><label for="note-title">Note title</label><input id="note-title" value="${esc(n?.title || '')}" placeholder="A name for this note"></div>
          <div class="field"><label for="note-date">Date</label><input type="date" id="note-date" value="${esc(n?.date || new Date().toISOString().slice(0, 10))}"></div></div>
          <details class="dump"><summary><strong>Start with a brain dump</strong> <span class="muted small">Write everything here, then let Pause sort it under the headings</span></summary>
            <div class="field"><label for="note-dump" class="sr-only">Everything on my mind</label><textarea id="note-dump" placeholder="Everything on your mind, in any order…"></textarea></div>
          </details>
          ${FIELDS.map((f, i) => `<div class="field"><label for="note-${i}">${f}</label><textarea id="note-${i}" data-note-field="${i}" placeholder="Optional">${esc(values[f] || '')}</textarea></div>`).join('')}
          <div class="field"><label for="note-mood">Link to a mood check-in (optional)</label><select id="note-mood"><option value="">No linked entry</option>${moods.map(m => `<option value="${esc(m.id)}" ${n?.moodId === m.id ? 'selected' : ''}>${fmtDate(m.created)} · ${esc((m.moods || []).join(', ') || 'Reflection')}</option>`).join('')}</select></div>
          <div class="row-gap">
            <button class="btn-main" data-n="save">Save draft</button>
            <button class="btn-line" data-n="organize">Help me organise my thoughts</button>
            ${P.ai.status() === 'ready' ? '<button class="btn-line" data-n="organize-ai">Organise with AI</button>' : ''}
            <button class="btn-line" data-n="print">Print / save as PDF</button>
            <button class="btn-line" data-n="export">Export text</button>
          </div>
          <p class="muted small mt-3" id="note-status" aria-live="polite">${n ? 'Saved note opened for editing.' : ''}</p>
        </section>
      </div>
    </main>`;
    const $ = s => view.querySelector(s), fieldEls = () => [...view.querySelectorAll('[data-note-field]')];
    const status = t => { $('#note-status').textContent = t; };
    const source = () => ($('#note-dump').value.trim() || fieldEls().map(x => x.value).join('\n')).trim();
    const fill = parts => { let placed = 0; fieldEls().forEach((x, i) => { if (parts[i] && !x.value.trim()) { x.value = parts[i]; placed++; } }); return placed; };

    view.addEventListener('click', async e => {
      const a = e.target.closest('[data-n]')?.dataset.n;
      if (e.target.closest('[data-new-note]') && !id) { e.preventDefault(); P.render(); return; }
      if (a === 'save') {
        const fields = {}; fieldEls().forEach(x => { fields[FIELDS[+x.dataset.noteField]] = x.value; });
        noteId = noteId || 'n' + Date.now();
        await PauseStore.put('notes', { id: noteId, title: $('#note-title').value || 'Therapy note', date: $('#note-date').value, fields, moodId: $('#note-mood').value, updated: Date.now() });
        status('Draft saved on this device.'); P.toast('Note saved');
        if (!id) history.replaceState(null, '', '#/notes/' + noteId);
      }
      if (a === 'organize') {
        const text = source();
        if (!text) return status('Add a few thoughts first (or use the brain dump), then I can arrange them under the headings.');
        const placed = fill(localOrganize(text));
        status(placed ? `Your own words were placed under ${placed} empty heading${placed > 1 ? 's' : ''}, matched by keywords on this device. Review and edit them before saving.` : 'Every heading already has text, so nothing was moved.');
      }
      if (a === 'organize-ai') {
        const text = source();
        if (!text) return status('Add a few thoughts first, then I can arrange them.');
        status('Organising…');
        const r = await P.ai.run('journal', 'notes_organize', { text, headings: FIELDS }, () => ({ data: { fields: localOrganize(text) } }));
        const parts = Array.isArray(r.data?.fields) ? r.data.fields : localOrganize(text);
        const placed = fill(parts.map(x => String(x || '')));
        status(`${r.source === 'ai' ? (r.mock ? 'Test-mode backend organised' : 'AI organised') : 'Organised on this device:'} ${placed} heading${placed === 1 ? '' : 's'} filled. Please check every line still says what you mean.`);
      }
      if (a === 'print') window.print();
      if (a === 'export') {
        const title = $('#note-title').value || 'Therapy note';
        const text = title + '\nDate: ' + $('#note-date').value + '\n\n' + fieldEls().map((x, i) => FIELDS[i] + '\n' + x.value).join('\n\n');
        P.download('pause-therapy-note.txt', text);
      }
      const d = e.target.closest('[data-delete-note]');
      if (d && await P.confirm('Delete this note?', 'It will be removed from this device.', 'Delete', true)) { await PauseStore.del('notes', d.dataset.deleteNote); P.toast('Note deleted'); P.go('notes'); }
    });
  });
})(window.Pause);
