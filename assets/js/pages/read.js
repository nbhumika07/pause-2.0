/* Reading library and reader. Brings together the original reading features
   (excerpts, bookmarks, bookshelf reflections, text size, distraction-free mode,
   takeaways, progress bar) with smart search, needs categories, reading times,
   read status and optional AI summaries. */
(function (P) {
  'use strict';
  const { esc, truncate, fmtDate } = P.util;
  const C = P.catalog;
  let need = '', query = '', recOffset = 0;

  /* Smart search: synonyms widen the query, matches are weighted by field. */
  const SYN = {
    exam: ['academic', 'study', 'exam'], study: ['academic', 'exam', 'study'], marks: ['academic', 'exam', 'failure'], lonely: ['loneliness', 'connection', 'alone'],
    alone: ['loneliness', 'connection'], anxious: ['overthinking', 'uncertain', 'worry'], anxiety: ['overthinking', 'uncertain', 'worry'], worry: ['overthinking', 'uncertain'],
    tired: ['exhaustion', 'rest', 'low-energy'], burnout: ['exhaustion', 'rest', 'boundaries'], sad: ['difficult', 'disappointment', 'numb'], angry: ['anger', 'frustration'],
    parents: ['family'], friend: ['friendship'], therapy: ['therapist', 'therapy'], lazy: ['procrastination', 'starting'], procrastinate: ['procrastination', 'starting'],
    compare: ['comparison', 'left behind'], confidence: ['confidence', 'self-doubt'], stress: ['stress', 'overwhelm', 'pressure'], help: ['help', 'support']
  };
  function search(q) {
    /* light stemming so "exams", "studying", "worried" still match */
    const stem = t => t.replace(/(ing|ed|es|s)$/, '');
    const terms = [...new Set(q.toLowerCase().split(/\W+/).filter(t => t.length > 2).flatMap(t => [t, stem(t)]).filter(t => t.length > 2))];
    if (!terms.length) return PauseArticles.map(a => ({ a, score: 0 }));
    const expanded = [...new Set(terms.flatMap(t => [t, ...(SYN[t] || []), ...(SYN[stem(t)] || [])]))];
    return PauseArticles.map(a => {
      const title = a.title.toLowerCase(), topic = a.topic.toLowerCase(), body = (a.excerpt + ' ' + a.body).toLowerCase();
      let score = 0;
      for (const t of expanded) { const w = terms.includes(t) ? 1 : .6; if (title.includes(t)) score += 4 * w; if (topic.includes(t)) score += 3 * w; if (body.includes(t)) score += 1 * w; }
      return { a, score };
    }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  }
  async function readSet() { return new Set((await P.data.activity()).filter(a => a.kind === 'read').map(a => a.ref.slice(5))); }
  const heart = (on, id, title) => `<button class="icon-btn ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'Remove bookmark' : 'Save article'}: ${esc(title)}" data-bookmark="${esc(id)}">${on ? '♥' : '♡'}</button>`;

  P.route('read', async view => {
    const [bookmarks, read, latest] = await Promise.all([PauseStore.all('bookmarks'), readSet(), P.data.moods().then(m => m[0])]);
    const marked = new Set(bookmarks.map(b => b.id));
    const feelings = latest?.moods || [];
    const needIds = new Set(C.READING_NEEDS.filter(n => n.feelings.some(f => feelings.includes(f))).map(n => n.id));
    const ranked = PauseArticles.map(a => ({ a, s: P.reading.needsOf(a).filter(n => needIds.has(n)).length + (read.has(a.id) ? -.5 : 0) + Math.random() * .3 })).sort((x, y) => y.s - x.s).map(x => x.a);
    const recs = () => Array.from({ length: 3 }, (_, i) => ranked[(recOffset + i) % ranked.length]);

    const card = a => `<article class="lib-card" data-id="${a.id}">
      <div class="lib-top"><span class="eyebrow">${esc(a.topic)}</span>${heart(marked.has(a.id), a.id, a.title)}</div>
      <h3><a href="#/article/${a.id}">${esc(a.title)}</a></h3><p class="muted">${esc(a.excerpt)}</p>
      <div class="lib-foot"><span class="small muted">${P.reading.minutes(a)} min read</span>${read.has(a.id) ? '<span class="small read-tick">✓ Read</span>' : ''}</div>
    </article>`;
    const recCard = a => `<article class="surface article-card" data-id="${a.id}">
      <div class="lib-top"><span class="eyebrow">${esc(a.topic)} · ${P.reading.minutes(a)} min</span>${heart(marked.has(a.id), a.id, a.title)}</div>
      <h2 class="h3">${esc(a.title)}</h2><p class="excerpt" data-excerpt-index="0">${esc(a.excerpt)}</p>
      <div class="row-gap"><a class="btn-main btn-small" href="#/article/${a.id}">Read the full article</a><button class="btn-line btn-small" data-excerpt-next="${a.id}">Another excerpt</button><button class="btn-line btn-small" data-resonates>This resonates with me</button></div>
    </article>`;

    view.innerHTML = `<main class="content">
      ${P.header({ eyebrow: 'A few words for this moment', title: 'Read gently', intro: 'Short, original reflections first. Open a full article only if you choose.' })}
      ${feelings.length ? `<p class="muted small">Suggestions related to your last check-in: ${esc(feelings.join(', '))}</p>` : ''}
      <div class="card-grid" id="recs">${recs().map(recCard).join('')}</div>
      <button class="link-btn mt-2" data-another>Show me another ↻</button>

      <section class="surface mt-4">
        <div class="card-head wrap"><div><div class="eyebrow">Explore all ${PauseArticles.length}</div><h2>The little library</h2><p class="small muted">${read.size} of ${PauseArticles.length} read · ${bookmarks.filter(b => PauseArticles.some(a => a.id === b.id)).length} saved</p></div>
          <div class="search-box"><label class="sr-only" for="article-search">Search the library</label><input class="input" id="article-search" type="search" placeholder="Search: exams, lonely, tired…" value="${esc(query)}"></div></div>
        <div class="chip-row" role="group" aria-label="What do you need?">${[{ id: '', label: 'Everything' }, ...C.READING_NEEDS].map(n => `<button class="chip ${need === n.id ? 'selected' : ''}" aria-pressed="${need === n.id}" data-need="${n.id}">${esc(n.label)}</button>`).join('')}</div>
        <p class="small muted" id="lib-count" aria-live="polite"></p>
        <div class="card-grid" id="article-list"></div>
      </section>

      <section class="surface mt-4" id="book-shelf">
        <div class="eyebrow">Original writing inspired by book themes</div><h2>Reflections from the bookshelf</h2><p class="muted">These are new reflections, not quotations from the books.</p>
        <div class="card-grid">${PauseBookReflections.map((b, i) => `<article class="book-reflection"><div class="eyebrow">Inspired by ${esc(b.book)}</div><h3>${esc(b.title)}</h3><small class="muted">${esc(b.author)} · ${esc(b.theme)}</small><blockquote>${esc(b.text)}</blockquote><button class="btn-soft btn-small" data-save-book="${i}" ${marked.has('book-' + i) ? 'disabled' : ''}>${marked.has('book-' + i) ? 'Saved ♥' : 'Save reflection ♡'}</button></article>`).join('')}</div>
      </section>

      <section class="surface mt-4" id="saved-reading">
        <div class="eyebrow">Saved on this device</div><h2>Saved reading</h2>
        ${bookmarks.length ? bookmarks.map(x => `<article class="entry"><strong>${esc(x.title || 'Saved reflection')}</strong><small class="muted d-block">${esc(x.kind || 'Article')}</small>${x.text ? `<p>${esc(x.text)}</p>` : ''}<div class="row-gap">${PauseArticles.some(a => a.id === x.id) ? `<a class="btn-soft btn-small" href="#/article/${esc(x.id)}">Open</a>` : ''}<button class="btn-line btn-small" data-delete-bookmark="${esc(x.id)}">Remove</button></div></article>`).join('') : '<div class="empty">No saved reading yet. Bookmark an article or reflection to keep it here.</div>'}
      </section>
    </main>`;

    const list = view.querySelector('#article-list'), count = view.querySelector('#lib-count');
    const paintList = () => {
      let rows = query.trim() ? search(query).map(x => x.a) : PauseArticles;
      if (need) rows = rows.filter(a => P.reading.needsOf(a).includes(need));
      count.textContent = query || need ? `${rows.length} article${rows.length === 1 ? '' : 's'} found` : '';
      list.innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty">Nothing matched. Try a different word, like “stress”, “sleep” or “family”.</div>';
    };
    paintList();
    view.querySelector('#article-search').addEventListener('input', e => { query = e.target.value; paintList(); });

    view.addEventListener('click', async e => {
      const n = e.target.closest('[data-need]');
      if (n) { need = n.dataset.need; view.querySelectorAll('[data-need]').forEach(b => { b.classList.toggle('selected', b === n); b.setAttribute('aria-pressed', b === n); }); paintList(); return; }
      if (e.target.closest('[data-another]')) { recOffset = (recOffset + 3) % ranked.length; view.querySelector('#recs').innerHTML = recs().map(recCard).join(''); return; }
      const ex = e.target.closest('[data-excerpt-next]');
      if (ex) { const a = PauseArticles.find(x => x.id === ex.dataset.excerptNext), p = ex.closest('.article-card').querySelector('.excerpt'); const i = (+p.dataset.excerptIndex + 1) % a.excerpts.length; p.dataset.excerptIndex = i; p.textContent = a.excerpts[i]; return; }
      const rs = e.target.closest('[data-resonates]');
      if (rs) { rs.textContent = 'Saved for this moment ✓'; rs.disabled = true; P.toast('Kept with you for this moment'); return; }
      const bm = e.target.closest('[data-bookmark]');
      if (bm) { await toggleBookmark(bm); return; }
      const sb = e.target.closest('[data-save-book]');
      if (sb) { const b = PauseBookReflections[+sb.dataset.saveBook]; await PauseStore.put('bookmarks', { id: 'book-' + sb.dataset.saveBook, title: b.title, kind: 'original reflection', text: b.text }); P.toast('Reflection saved on this device'); P.render(); return; }
      const db = e.target.closest('[data-delete-bookmark]');
      if (db) { await PauseStore.del('bookmarks', db.dataset.deleteBookmark); P.toast('Removed from saved reading'); P.render(); }
    });
  });

  async function toggleBookmark(btn) {
    const id = btn.dataset.bookmark, a = PauseArticles.find(x => x.id === id);
    const on = btn.getAttribute('aria-pressed') === 'true';
    if (on) await PauseStore.del('bookmarks', id); else await PauseStore.put('bookmarks', { id, title: a?.title, kind: 'article' });
    document.querySelectorAll(`[data-bookmark="${id}"]`).forEach(b => { b.textContent = on ? '♡' : '♥'; b.setAttribute('aria-pressed', String(!on)); b.classList.toggle('on', !on); b.setAttribute('aria-label', (on ? 'Save article' : 'Remove bookmark') + ': ' + (a?.title || '')); });
    P.toast(on ? 'Bookmark removed' : 'Article saved on this device');
  }

  /* ---------- Reader ---------- */
  P.route('article', async (view, [id]) => {
    const a = PauseArticles.find(x => x.id === id);
    if (!a) return P.go('read');
    const marked = !!(await PauseStore.get('bookmarks', a.id));
    const alreadyRead = (await readSet()).has(a.id);
    P.logActivity('read-open', a.id, a.title);
    const related = PauseArticles.filter(x => x.id !== a.id && P.reading.needsOf(x).some(n => P.reading.needsOf(a).includes(n))).slice(0, 4);
    const size = +P.util.safeLS.get('pause-reader-size', '17');
    view.innerHTML = `<div class="reader-progress"><span id="reading-progress"></span></div>
    <main class="content">
      <article class="article-layout" id="reader">
        <a class="btn-line btn-small mb-3" href="#/read">← Back to your reading</a>
        <div class="eyebrow">${esc(a.topic)} · ${P.reading.minutes(a)} min read${alreadyRead ? ' · ✓ Read' : ''}</div>
        <h1 class="page-title">${esc(a.title)}</h1>
        <div class="reader-controls">
          <label>Text size <input type="range" min="15" max="23" value="${size}" data-reader-size aria-label="Adjust reading text size"></label>
          <button class="btn-line btn-small" data-reading-mode aria-pressed="false">Distraction-free reading</button>
          ${heart(marked, a.id, a.title).replace('icon-btn', 'btn-line btn-small').replace(/>(♥|♡)</, `>${marked ? 'Saved ♥' : 'Save article ♡'}<`)}
          <button class="btn-soft btn-small" data-summarize>Summarise</button>
        </div>
        <div id="summary" aria-live="polite"></div>
        <div class="reader-body" style="--reader-size:${size}px">${a.body.split('\n\n').map(p => `<p class="reader-copy">${esc(p)}</p>`).join('')}</div>
        <button class="btn-soft btn-small mt-3" data-save-takeaway>Add my own takeaway to my journal</button>
        <div class="surface mt-4"><div class="eyebrow">A moment to reflect</div><p class="mb-0">${esc(a.prompt)}</p><button class="link-btn small mt-2" data-reflect-journal>Write about this in my journal →</button></div>
        ${related.length ? `<h2 class="h3 mt-4">Related reading</h2><div class="chip-row">${related.map(x => `<a class="pill" href="#/article/${x.id}">${esc(x.title)}</a>`).join('')}</div>` : ''}
        <a class="btn-line mt-4" href="#/read">Return to excerpts</a>
      </article>
    </main>`;

    const bar = view.querySelector('#reading-progress');
    let marked90 = alreadyRead;
    const progress = () => {
      const d = document.documentElement, max = d.scrollHeight - d.clientHeight, pct = max > 0 ? Math.min(100, Math.max(0, scrollY / max * 100)) : 100;
      bar.style.width = pct + '%';
      if (pct > 88 && !marked90) { marked90 = true; P.logActivity('read', 'read:' + a.id, a.title, P.reading.minutes(a) * 60); }
    };
    window.addEventListener('scroll', progress, { passive: true });
    setTimeout(progress, 300);
    P.onLeave(() => { window.removeEventListener('scroll', progress); document.body.classList.remove('reading-mode'); });

    view.addEventListener('input', e => { if (e.target.matches('[data-reader-size]')) { view.querySelector('.reader-body').style.setProperty('--reader-size', e.target.value + 'px'); P.util.safeLS.set('pause-reader-size', e.target.value); } });
    view.addEventListener('click', async e => {
      const rm = e.target.closest('[data-reading-mode]');
      if (rm) { const on = document.body.classList.toggle('reading-mode'); rm.textContent = on ? 'Exit distraction-free reading' : 'Distraction-free reading'; rm.setAttribute('aria-pressed', on); return; }
      const bm = e.target.closest('[data-bookmark]');
      if (bm) { await toggleBookmark(bm); bm.textContent = bm.getAttribute('aria-pressed') === 'true' ? 'Saved ♥' : 'Save article ♡'; return; }
      if (e.target.closest('[data-summarize]')) {
        const out = view.querySelector('#summary'); out.innerHTML = '<p class="muted loading">Summarising…</p>';
        const r = await P.ai.run('reading', 'article_summary', { title: a.title, body: a.body }, () => P.ai.local.articleSummary(a));
        const pts = r.data?.points || (r.text ? [r.text] : []);
        out.innerHTML = `<div class="ai-result">${P.ai.badge(r)} <span class="small muted">${r.source === 'local' ? 'Key passages from the article' : 'Only this article’s text was sent.'}</span><ul>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
        return;
      }
      if (e.target.closest('[data-save-takeaway]')) {
        const text = await P.promptText('Your takeaway', 'Write your own takeaway. Only your words will be saved.', { multiline: true, placeholder: 'What I want to remember…' });
        if (text?.trim()) { await PauseStore.put('reflections', { id: 'r' + Date.now(), text: text.trim(), source: a.title, created: Date.now() }); P.toast('Your takeaway was saved on this device'); }
        return;
      }
      if (e.target.closest('[data-reflect-journal]')) {
        P.util.safeLS.set('pause-journal-draft', JSON.stringify({ id: P.util.uid('j'), title: 'Reflecting on: ' + a.title, text: a.prompt + '\n\n', category: '', moods: [], created: Date.now(), aiAllowed: false, isNew: true, prompt: a.prompt }));
        P.go('journal');
      }
    });
  });
})(window.Pause);
