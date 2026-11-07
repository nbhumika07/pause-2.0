/* App shell: navigation, shared page header, and start-up.
   Pages live in assets/js/pages/ and register themselves with Pause.route(). */
(function (P) {
  'use strict';
  const { $, $$, esc, safeLS } = P.util;

  const NAV = [
    ['today', 'Today'], ['companion', 'Companion'], ['mood', 'Mood'], ['journal', 'Journal'],
    ['breathe', 'Breathe'], ['play', 'Play'], ['sounds', 'Sounds'], ['read', 'Read'], ['affirmations', 'Affirmations']
  ];
  const MORE = [['notes', 'Therapy notes'], ['settings', 'Settings & privacy'], ['support', 'Support']];
  const GROUP = { game: 'play', routine: 'play', article: 'read' };

  P.shell = {
    build() {
      document.getElementById('app').innerHTML = `
        <a class="skip-link" href="#view" data-skip>Skip to content</a>
        <header class="topbar">
          <a class="brand" href="#/welcome" aria-label="Pause, go to the home screen">Pause<span>.</span></a>
          <nav class="nav-links" aria-label="Main">
            ${NAV.map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${label}</a>`).join('')}
            <div class="nav-more">
              <button class="nav-more-btn" aria-expanded="false" aria-haspopup="true" data-nav-more>More ▾</button>
              <div class="nav-menu" hidden>${MORE.map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${label}</a>`).join('')}</div>
            </div>
          </nav>
          <button class="menu-btn" aria-expanded="false" aria-controls="drawer" data-menu><span aria-hidden="true">☰</span><span class="sr-only">Open menu</span></button>
        </header>
        <div class="drawer" id="drawer" hidden>
          <nav aria-label="Main (mobile)">${[...NAV, ...MORE].map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${label}</a>`).join('')}</nav>
        </div>
        <div id="view" tabindex="-1"></div>
        <div id="audio-player" class="player" role="region" aria-label="Background sound"></div>`;
      PauseAudio.render();
    },
    setActive(name) {
      const key = GROUP[name] || name;
      $$('[data-nav]').forEach(a => { const on = a.dataset.nav === key; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
      $('.nav-more-btn')?.classList.toggle('active', MORE.some(m => m[0] === key));
      closeMenus();
    }
  };
  function closeMenus() {
    const d = $('#drawer'); if (d) d.hidden = true;
    $('[data-menu]')?.setAttribute('aria-expanded', 'false');
    const m = $('.nav-menu'); if (m) m.hidden = true;
    $('[data-nav-more]')?.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-menu]')) { const d = $('#drawer'); d.hidden = !d.hidden; e.target.closest('[data-menu]').setAttribute('aria-expanded', String(!d.hidden)); if (!d.hidden) $('a', d)?.focus(); return; }
    if (e.target.closest('[data-nav-more]')) { const m = $('.nav-menu'); m.hidden = !m.hidden; e.target.closest('[data-nav-more]').setAttribute('aria-expanded', String(!m.hidden)); return; }
    if (e.target.closest('[data-skip]')) { e.preventDefault(); $('#view h1')?.focus() || $('#view').focus(); return; }
    if (!e.target.closest('.nav-more')) { const m = $('.nav-menu'); if (m && !m.hidden) { m.hidden = true; $('[data-nav-more]')?.setAttribute('aria-expanded', 'false'); } }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

  /* Shared page header markup */
  P.header = ({ eyebrow = '', title, intro = '', actions = '' }) => `
    <div class="page-head">
      <div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1 class="page-title">${esc(title)}</h1>${intro ? `<p class="muted lead">${intro}</p>` : ''}</div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;

  /* Reduce-motion toggle works from any page (welcome screen and settings). */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="motion"]');
    if (!b) return;
    const on = !P.prefs.get().reduceMotion;
    P.prefs.set({ reduceMotion: on });
    $$('[data-motion-state]').forEach(x => { x.textContent = on ? 'On' : 'Off'; });
    P.toast(on ? 'Reduced motion is on' : 'Reduced motion is off');
  });

  /* Data helpers used by several pages */
  P.data = {
    moods: async () => (await PauseStore.all('moods')).sort((a, b) => b.created - a.created),
    journal: async () => (await PauseStore.all('journal')).sort((a, b) => (b.updated || b.created) - (a.updated || a.created)),
    activity: async () => (await PauseStore.all('activity')).sort((a, b) => b.created - a.created)
  };

  function boot() {
    P.applyAppearance();
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', P.applyAppearance);
    P.shell.build();
    P.refreshActivity();
    window.addEventListener('hashchange', P.render);
    P.render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    }
    window.addEventListener('offline', () => P.toast('You’re offline. Everything except AI keeps working.', { ms: 4000 }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  P.markVisited = () => safeLS.set('pause-visited', '1');
})(window.Pause);
