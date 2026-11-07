/* Sounds: the full mixer. Soundscape cards with their own toggles and volumes,
   presets, saved mixes, favourites, recently played, fades, sleep timer, a live
   visualiser, and settings for game and breathing sounds. */
(function (P) {
  'use strict';
  const { esc } = P.util;
  const S = PauseSoundscapes, E = PauseEngine;
  let filter = 'All';

  P.route('sounds', view => {
    const A = PauseAudio;
    const groups = ['All', 'Favourites', ...new Set(S.SCAPES.map(s => s.group))];

    const card = s => {
      const on = A.mix.on.includes(s.id), fav = A.favourites.includes(s.id);
      return `<article class="sound-card ${on ? 'on' : ''}" data-scape="${s.id}" style="--art:${s.art}">
        <div class="sc-art" aria-hidden="true"><span class="sc-icon">${s.icon}</span><span class="eq"><i></i><i></i><i></i><i></i></span></div>
        <div class="sc-body">
          <div class="sc-top"><h3>${esc(s.name)}</h3><button class="icon-btn ${fav ? 'on' : ''}" data-fav="${s.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites: ${esc(s.name)}">${fav ? '♥' : '♡'}</button></div>
          <p class="muted small">${esc(s.desc)}</p>
          <div class="sc-controls">
            <button class="sc-toggle" data-toggle="${s.id}" aria-pressed="${on}"><span class="sc-dot" aria-hidden="true"></span>${on ? 'On' : 'Off'}</button>
            <input type="range" min="0" max="1" step="0.01" value="${A.volOf(s.id)}" data-vol="${s.id}" aria-label="${esc(s.name)} volume">
          </div>
        </div>
      </article>`;
    };
    const presetCard = p => `<article class="preset-card"><button class="preset-main" data-preset="${p.id}"><span class="preset-icon" aria-hidden="true">${p.icon || '✦'}</span><span><strong>${esc(p.name)}</strong><small class="muted">${esc(p.desc || Object.keys(p.mix).map(id => S.byId[id]?.name).filter(Boolean).join(' + '))}</small></span></button>${p.custom ? `<button class="icon-btn" data-del-preset="${p.id}" aria-label="Delete mix ${esc(p.name)}">✕</button>` : ''}</article>`;

    view.innerHTML = `<main class="content sounds-page">
      <section class="sound-hero">
        <div class="sh-copy">
          <div class="eyebrow">Your soundscape</div>
          <h1 class="page-title">Sounds</h1>
          <p class="muted">Mix calming sounds together. Each one is generated on your device, so it plays offline and never repeats exactly.</p>
          <div class="sh-now"><button class="sh-play" data-sp="toggle" aria-label="Play or pause"></button><div><small class="muted" id="sh-status"></small><strong id="sh-label"></strong></div></div>
        </div>
        <canvas class="sh-viz" id="sh-viz" aria-hidden="true"></canvas>
        <div class="sh-settings">
          <label class="sh-field">Master volume <input type="range" min="0" max="1" step="0.01" value="${E.settings.master}" data-audio="master" aria-label="Master volume"></label>
          <div class="sh-field"><span>Sleep timer</span><div class="chip-row" role="group" aria-label="Sleep timer">${[0, 15, 30, 45, 60, 90].map(m => `<button class="chip chip-sm" data-sleep="${m}">${m ? m + ' min' : 'Off'}</button>`).join('')}</div></div>
          <div class="sh-row">
            <label class="sh-field">Fade in <select data-fade="in">${[1, 3, 5, 10].map(s => `<option value="${s}" ${E.settings.fadeIn === s ? 'selected' : ''}>${s} s</option>`).join('')}</select></label>
            <label class="sh-field">Fade out <select data-fade="out">${[1, 3, 5, 10].map(s => `<option value="${s}" ${E.settings.fadeOut === s ? 'selected' : ''}>${s} s</option>`).join('')}</select></label>
          </div>
        </div>
      </section>

      <section class="mt-4">
        <div class="card-head wrap"><h2>Presets</h2><button class="btn-line btn-small" data-sp="save">＋ Save current mix</button></div>
        <div class="preset-grid" id="presets"></div>
      </section>

      <section class="mt-4">
        <div class="card-head wrap"><h2>Soundscapes</h2><div class="chip-row" role="group" aria-label="Filter soundscapes">${groups.map(g => `<button class="chip chip-sm ${g === filter ? 'selected' : ''}" aria-pressed="${g === filter}" data-filter="${g}">${g === 'Favourites' ? '♥ ' : ''}${g}</button>`).join('')}</div></div>
        <div id="recent-row"></div>
        <div class="sound-grid" id="sound-grid"></div>
      </section>

      <section class="surface mt-4">
        <h2>Game and breathing sounds</h2>
        <label class="switch"><input type="checkbox" data-sfx-on ${E.settings.sfx ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span> Soft sound effects in games</label>
        <label class="sh-field mt-2" style="max-width:320px">Effects volume <input type="range" min="0" max="1" step="0.01" value="${E.settings.sfxVolume}" data-sfx-vol aria-label="Game sound effects volume"></label>
        <button class="btn-line btn-small mt-2" data-sp="sfx-test">Play a sample</button>
        <p class="small muted mt-2">Breathing sounds are set on the Breathe page. Everything follows the master volume.</p>
      </section>
      <p class="small muted mt-3">On iPhone, Web Audio is silent when the ring/silent switch is on silent. If you hear nothing, check that switch and your volume.</p>
    </main>`;

    const $ = s => view.querySelector(s);
    const paintGrid = () => {
      const list = S.SCAPES.filter(s => filter === 'All' || (filter === 'Favourites' ? A.favourites.includes(s.id) : s.group === filter));
      $('#sound-grid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">Tap ♡ on any sound to keep it here.</div>';
      const rec = A.recent.filter(id => S.byId[id]).slice(0, 5);
      $('#recent-row').innerHTML = rec.length ? `<div class="recent-row"><span class="muted small">Recently played</span>${rec.map(id => `<button class="chip chip-sm ${A.mix.on.includes(id) ? 'selected' : ''}" data-toggle="${id}">${S.byId[id].icon} ${esc(S.byId[id].name)}</button>`).join('')}</div>` : '';
    };
    const paintPresets = () => { $('#presets').innerHTML = [...S.PRESETS, ...A.custom].map(presetCard).join(''); };
    const paintStatus = () => {
      $('.sh-play').textContent = A.playing ? '❚❚' : '▶';
      $('.sh-play').classList.toggle('playing', A.playing);
      $('.sound-hero').classList.toggle('playing', A.playing);
      const names = A.mix.on.map(id => S.byId[id]?.name).filter(Boolean);
      $('#sh-label').textContent = names.length ? names.join(' · ') : 'Choose a sound below';
      $('#sh-status').textContent = A.playing ? (A.sleepLeft() ? `Playing · stops in ${A.sleepLeft()} min` : 'Now playing') : 'Paused';
      view.querySelectorAll('[data-sleep]').forEach(b => b.classList.toggle('selected', A.playing && A.sleepLeft() ? Math.abs(+b.dataset.sleep - A.sleepLeft()) < 1 : +b.dataset.sleep === 0));
      view.querySelectorAll('.sound-card').forEach(c => {
        const id = c.dataset.scape, on = A.mix.on.includes(id);
        c.classList.toggle('on', on); c.classList.toggle('live', A.playing && on);
        const t = c.querySelector('.sc-toggle'); t.setAttribute('aria-pressed', on); t.lastChild.textContent = on ? 'On' : 'Off';
      });
    };
    paintGrid(); paintPresets(); paintStatus();
    A.watch($('#sh-viz'), 'wave');
    const unsub = A.subscribe(() => { paintStatus(); A.watch($('#sh-viz'), 'wave'); });
    P.onLeave(unsub);

    view.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-sp="toggle"]')) return A.toggle();
      const tg = t.closest('[data-toggle]');
      if (tg) { const id = tg.dataset.toggle; A.setLayer(id, !A.mix.on.includes(id)); if (tg.classList.contains('chip')) paintGrid(); return; }
      const fv = t.closest('[data-fav]'); if (fv) { A.toggleFavourite(fv.dataset.fav); paintGrid(); return; }
      const fl = t.closest('[data-filter]'); if (fl) { filter = fl.dataset.filter; view.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('selected', b === fl); b.setAttribute('aria-pressed', b === fl); }); paintGrid(); return; }
      const pr = t.closest('[data-preset]');
      if (pr) { const p = [...S.PRESETS, ...A.custom].find(x => x.id === pr.dataset.preset); A.applyMix(p.mix, p.name); paintGrid(); P.toast(`${p.name} is fading in`); return; }
      const dp = t.closest('[data-del-preset]'); if (dp && await P.confirm('Delete this mix?', 'It will be removed from this device.', 'Delete', true)) { A.deleteCustom(dp.dataset.delPreset); paintPresets(); return; }
      if (t.closest('[data-sp="save"]')) {
        if (!A.mix.on.length) return P.toast('Turn on at least one sound first');
        const name = await P.promptText('Save this mix', 'Name your mix', { placeholder: 'e.g. Study night' });
        if (name?.trim()) { A.saveCustom(name.trim()); paintPresets(); P.toast('Mix saved on this device'); }
        return;
      }
      const sl = t.closest('[data-sleep]');
      if (sl) { if (+sl.dataset.sleep && !A.playing) A.play(); A.setSleep(+sl.dataset.sleep); P.toast(+sl.dataset.sleep ? `Sound will fade out in ${sl.dataset.sleep} min` : 'Sleep timer off'); return; }
      if (t.closest('[data-sp="sfx-test"]')) { const was = E.settings.sfx; E.setSfx(true); E.sfx('success'); E.setSfx(was); }
    });
    view.addEventListener('input', e => {
      const v = e.target.dataset.vol; if (v) A.setVolume(v, e.target.value);
      if (e.target.matches('[data-sfx-vol]')) { E.unlock(); E.setSfxVolume(+e.target.value); }
    });
    view.addEventListener('change', e => {
      if (e.target.dataset.fade) E.setFades(+view.querySelector('[data-fade="in"]').value, +view.querySelector('[data-fade="out"]').value);
      if (e.target.matches('[data-sfx-on]')) { E.setSfx(e.target.checked); if (e.target.checked) E.sfx('select'); }
    });
  });
})(window.Pause);
