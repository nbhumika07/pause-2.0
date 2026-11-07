/* Pause core: shared helpers, preferences, toasts, dialogs and the hash router.
   Every other script attaches itself to the single global `Pause` namespace. */
window.Pause = window.Pause || {};
(function (P) {
  'use strict';

  /* ---------- Small helpers ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDate = (t, o) => new Date(t).toLocaleDateString(undefined, o || { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const uid = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const DAY = 86400000;
  /* A stable number for a string (used to choose "today's" affirmation/prompt). */
  const hash = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const dailyPick = (arr, salt = '') => arr[hash(dayKey(Date.now()) + salt) % arr.length];
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const truncate = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const safeLS = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch { } }
  };
  P.util = { $, $$, esc, pad, dayKey, fmtDate, fmtTime, uid, pick, clamp, DAY, hash, dailyPick, words, truncate, safeLS };

  /* ---------- Preferences (small settings, kept in localStorage) ---------- */
  const PREF_KEY = 'pause-prefs';
  const DEFAULT_PREFS = {
    name: '',
    theme: 'system',            // system | light | night
    reduceMotion: false,
    goals: [],                  // ids from Pause.catalog.GOALS
    activities: [],             // preferred activity kinds
    affirmationGroups: [],
    sessionMinutes: 5,
    sounds: [],
    breathCue: false,
    ai: {
      enabled: false,
      endpoint: '',
      consent: false,
      features: { companion: true, journal: true, mood: true, reading: true, affirmations: true, breathing: true },
      tone: 'gentle',           // gentle | warm-direct | practical
      length: 'short',          // short | medium
      suggestActivities: true
    }
  };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, patch) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k in patch) out[k] = isObj(patch[k]) && isObj(base?.[k]) ? merge(base[k], patch[k]) : patch[k];
    return out;
  }
  let prefCache = null;
  P.prefs = {
    get() {
      if (!prefCache) { let saved = {}; try { saved = JSON.parse(safeLS.get(PREF_KEY, '{}')) || {}; } catch { } prefCache = merge(DEFAULT_PREFS, saved); }
      return prefCache;
    },
    set(patch) {
      prefCache = merge(P.prefs.get(), patch);
      safeLS.set(PREF_KEY, JSON.stringify(prefCache));
      applyAppearance();
      document.dispatchEvent(new CustomEvent('pause:prefs'));
      return prefCache;
    },
    reset() { prefCache = null; safeLS.del(PREF_KEY); applyAppearance(); },
    defaults: DEFAULT_PREFS
  };
  /* The original app kept reduce-motion only for the session; it is now remembered. */
  function applyAppearance() {
    const p = P.prefs.get();
    document.documentElement.dataset.theme = p.theme === 'system' ? '' : p.theme;
    document.documentElement.classList.toggle('reduce-motion', !!p.reduceMotion);
    document.body?.classList.toggle('reduce-motion', !!p.reduceMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = (p.theme === 'night' || (p.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '#151b2c' : '#f7f4ee';
  }
  P.applyAppearance = applyAppearance;
  P.motionReduced = () => P.prefs.get().reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Toasts ---------- */
  P.toast = function (text, { kind = 'info', ms = 2600 } = {}) {
    let region = $('#toast-region');
    if (!region) { region = document.createElement('div'); region.id = 'toast-region'; region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite'); document.body.appendChild(region); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.textContent = text;
    region.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, ms);
  };

  /* ---------- Accessible dialogs (replace alert / confirm / prompt) ---------- */
  P.dialog = function ({ title, body = '', actions = [{ label: 'Close', value: null, kind: 'main' }], input = null, wide = false }) {
    return new Promise(resolve => {
      const previous = document.activeElement;
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${esc(title)}</h2>
        <div class="modal-body">${body}</div>
        ${input ? `<div class="field"><label for="modal-input">${esc(input.label)}</label>${input.multiline ? `<textarea id="modal-input" placeholder="${esc(input.placeholder || '')}">${esc(input.value || '')}</textarea>` : `<input id="modal-input" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}">`}</div>` : ''}
        <div class="modal-actions">${actions.map((a, i) => `<button class="btn-${a.kind || 'line'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
      document.body.appendChild(wrap);
      document.body.classList.add('modal-open');
      const modal = $('.modal', wrap);
      const focusables = () => $$('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])', modal);
      const close = value => {
        wrap.remove();
        if (!$('.modal-backdrop')) document.body.classList.remove('modal-open');
        previous?.focus?.();
        resolve(value);
      };
      wrap.addEventListener('click', e => {
        if (e.target === wrap) return close(null);
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const a = actions[+b.dataset.i];
        let v = a.value;
        if (input && a.value === 'ok') v = $('#modal-input', wrap).value;
        close(v);
      });
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        if (e.key === 'Tab') { // keep focus inside the dialog
          const f = focusables(); if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      (input ? $('#modal-input', wrap) : focusables().pop())?.focus();
    });
  };
  P.confirm = (title, body, okLabel = 'Yes, continue', danger = false) =>
    P.dialog({ title, body: `<p>${esc(body)}</p>`, actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'main' }] });
  P.promptText = (title, label, opts = {}) =>
    P.dialog({ title, body: opts.body || '', input: { label, multiline: opts.multiline, placeholder: opts.placeholder, value: opts.value }, actions: [{ label: 'Cancel', value: null }, { label: opts.okLabel || 'Save', value: 'ok', kind: 'main' }] });

  /* ---------- Download helper ---------- */
  P.download = function (filename, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------- Router ----------
     Routes look like #/journal/abc123. Each page registers with Pause.route(name, render).
     Before each navigation, registered "leave" hooks run so games/breathing/timers stop. */
  const routes = {};
  let leaveHooks = [];
  P.route = (name, render) => { routes[name] = render; };
  P.onLeave = fn => leaveHooks.push(fn);
  P.current = { name: '', params: [] };
  P.go = path => { const h = '#/' + path.replace(/^#?\/?/, ''); if (location.hash === h) P.render(); else location.hash = h; };
  const ALIASES = { home: 'today', reflections: 'mood/history', play: 'play', game: 'play' };
  P.render = async function () {
    const raw = location.hash.replace(/^#\/?/, '');
    let [name, ...params] = raw.split('/').map(decodeURIComponent);
    if (!name) name = safeLS.get('pause-visited') ? 'today' : 'welcome';
    if (ALIASES[name] && ALIASES[name] !== name) { const [n, ...rest] = ALIASES[name].split('/'); name = n; params = rest.concat(params); }
    if (!routes[name]) name = 'today';
    for (const fn of leaveHooks) { try { fn(); } catch (e) { console.warn(e); } }
    leaveHooks = [];
    P.current = { name, params };
    document.body.dataset.page = name;
    P.shell.setActive(name);
    /* A fresh #view element each time, so listeners from the previous page never pile up. */
    const old = $('#view');
    const view = old.cloneNode(false);
    old.replaceWith(view);
    view.classList.remove('view-enter');
    try {
      await routes[name](view, params);
    } catch (err) {
      console.error(err);
      view.innerHTML = `<main class="content"><div class="surface empty-state"><h1 class="page-title" tabindex="-1">Something didn't load</h1><p class="muted">This page hit a problem. Your saved data is safe on this device.</p><button class="btn-main" data-go="today">Back to Today</button></div></main>`;
    }
    void view.offsetWidth; view.classList.add('view-enter');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    const h1 = $('h1', view);
    if (h1 && P._navigated) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    P._navigated = true;
  };

  /* Elements with data-go="route" navigate on click (works for buttons and cards). */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go]');
    if (!t || t.closest('.modal')) return;
    e.preventDefault();
    P.go(t.dataset.go);
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-go][role="button"], [data-card-go]')) { e.preventDefault(); e.target.click(); }
  });
})(window.Pause);
