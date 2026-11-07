/* Small, dependency-free SVG/HTML charts for mood check-ins.
   Every chart has hover/focus tooltips and a "view as table" alternative. */
(function (P) {
  'use strict';
  const { esc, dayKey, fmtDate, DAY } = P.util;
  const LV = P.catalog.LEVELS;

  /* Group entries by day: { key, date, avg|null, count, tags{} } */
  function byDay(entries, days, end = Date.now()) {
    const out = [];
    const endDay = new Date(end); endDay.setHours(12, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDay.getTime() - i * DAY);
      out.push({ key: dayKey(d), date: d, levels: [], count: 0, tags: {} });
    }
    const map = Object.fromEntries(out.map(o => [o.key, o]));
    for (const e of entries) {
      const o = map[dayKey(e.created)];
      if (!o) continue;
      o.count++;
      if (e.level) o.levels.push(e.level);
      (e.moods || []).forEach(t => { o.tags[t] = (o.tags[t] || 0) + 1; });
    }
    out.forEach(o => { o.avg = o.levels.length ? o.levels.reduce((a, b) => a + b, 0) / o.levels.length : null; });
    return out;
  }
  const levelName = v => v == null ? 'Checked in (no overall feeling chosen)' : LV[Math.round(v) - 1].label;
  const topTags = o => Object.entries(o.tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(', ');

  function tooltip(container) {
    let tip = container.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'tooltip'); container.appendChild(tip); }
    return {
      show(html, x, y) {
        tip.innerHTML = html; tip.style.display = 'block';
        const w = container.clientWidth, tw = tip.offsetWidth;
        tip.style.left = Math.min(Math.max(4, x - tw / 2), w - tw - 4) + 'px';
        tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
      },
      hide() { tip.style.display = 'none'; }
    };
  }
  function table(rows) {
    return `<details class="chart-table"><summary>View as table</summary><table><thead><tr><th>Day</th><th>Mood (self-described)</th><th>Check-ins</th><th>Feelings</th></tr></thead><tbody>
      ${rows.map(o => `<tr><td>${fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>${o.count ? esc(levelName(o.avg)) : '—'}</td><td>${o.count}</td><td>${esc(topTags(o)) || '—'}</td></tr>`).join('')}
    </tbody></table></details>`;
  }

  /* Line chart of self-described mood level per day. */
  function moodLine(el, entries, { days = 7, compact = false } = {}) {
    const rows = byDay(entries, days);
    const W = compact ? 380 : 900, H = compact ? 190 : 260, padL = compact ? 14 : 92, padR = 16, padT = 16, padB = 28;
    const iw = W - padL - (compact ? 14 : padR), ih = H - padT - padB;
    const x = i => padL + (days === 1 ? iw / 2 : (i * iw) / (days - 1));
    const y = v => padT + ih - ((v - 1) / 4) * ih;
    let path = '', pen = false;
    rows.forEach((o, i) => { if (o.avg == null) { pen = false; return; } path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(o.avg).toFixed(1) + ' '; pen = true; });
    const labelEvery = days > 14 ? 5 : 1;
    const grid = [1, 3, 5].map(v => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>${compact ? '' : `<text class="axis" x="${padL - 10}" y="${y(v) + 4}" text-anchor="end">${LV[v - 1].short}</text>`}`).join('');
    const ticks = rows.map((o, i) => (i % labelEvery === 0 || i === days - 1) ? `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${days > 7 ? o.date.getDate() : o.date.toLocaleDateString(undefined, { weekday: 'short' })}</text>` : '').join('');
    const dots = rows.map((o, i) => o.avg != null ? `<circle class="dot" cx="${x(i)}" cy="${y(o.avg)}" r="${compact ? 4 : 5}"/>` : o.count ? `<circle class="dot-x" cx="${x(i)}" cy="${padT + ih}" r="5"/>` : '').join('');
    const hits = rows.map((o, i) => `<rect class="hit" x="${x(i) - iw / days / 2}" y="${padT}" width="${iw / days}" height="${ih}" data-i="${i}" tabindex="0" aria-label="${esc(fmtDate(o.date, { weekday: 'long', month: 'short', day: 'numeric' }))}: ${o.count ? esc(levelName(o.avg)) : 'no check-in'}"/>`).join('');
    const any = rows.some(o => o.count);
    el.innerHTML = `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Self-described mood over the last ${days} days" class="${compact ? 'compact' : ''}">
        ${grid}<line class="cross" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" style="display:none"/>
        <path class="line" d="${path}"/>${dots}${ticks}${hits}
      </svg>
      ${any ? '' : '<p class="chart-empty muted">No check-ins in this period yet.</p>'}
    </div>${compact ? '' : table(rows)}`;
    const svg = el.querySelector('svg'), tip = tooltip(el.querySelector('.chart')), cross = el.querySelector('.cross');
    const show = i => {
      const o = rows[i], r = svg.getBoundingClientRect(), sx = r.width / W;
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
      tip.show(`<strong>${esc(fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</strong><br>${o.count ? `${esc(levelName(o.avg))}${o.count > 1 ? ` · ${o.count} check-ins` : ''}${topTags(o) ? `<br><span class="muted">${esc(topTags(o))}</span>` : ''}` : '<span class="muted">No check-in</span>'}`, x(i) * sx, (o.avg == null ? padT + ih / 2 : y(o.avg)) * (r.height / H));
    };
    const hide = () => { tip.hide(); cross.style.display = 'none'; };
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => show(+h.dataset.i)); h.addEventListener('focus', () => show(+h.dataset.i));
      h.addEventListener('pointerleave', hide); h.addEventListener('blur', hide);
    });
  }

  /* Month calendar: each day tinted by self-described mood (one hue, light to dark). */
  function calendar(el, entries, month = new Date()) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const end = new Date(month.getFullYear(), month.getMonth(), daysIn, 12);
    const rows = byDay(entries, daysIn, end.getTime());
    const offset = (first.getDay() + 6) % 7; // Monday first
    const today = dayKey(Date.now());
    el.innerHTML = `<div class="chart cal-wrap">
      <div class="cal-grid" role="grid" aria-label="Mood calendar for ${esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="cal-head" aria-hidden="true">${d}</div>`).join('')}
        ${'<div></div>'.repeat(offset)}
        ${rows.map((o, i) => `<button class="cal-cell ${o.key === today ? 'is-today' : ''}" data-i="${i}" data-level="${o.avg == null ? (o.count ? 'x' : '') : Math.round(o.avg)}" aria-label="${esc(fmtDate(o.date, { weekday: 'long', month: 'long', day: 'numeric' }))}: ${o.count ? esc(levelName(o.avg)) : 'no check-in'}">${o.date.getDate()}</button>`).join('')}
      </div>
      <div class="cal-legend" aria-hidden="true"><span>Heavier</span>${[1, 2, 3, 4, 5].map(v => `<i data-level="${v}"></i>`).join('')}<span>Lighter</span><i data-level="x"></i><span>Checked in, no level</span></div>
    </div>${table(rows.filter(o => o.count))}`;
    const tip = tooltip(el.querySelector('.chart'));
    el.querySelectorAll('.cal-cell').forEach(c => {
      const show = () => { const o = rows[+c.dataset.i], r = c.getBoundingClientRect(), pr = el.querySelector('.chart').getBoundingClientRect(); tip.show(`<strong>${esc(fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</strong><br>${o.count ? esc(levelName(o.avg)) + (topTags(o) ? `<br><span class="muted">${esc(topTags(o))}</span>` : '') : '<span class="muted">No check-in</span>'}`, r.left - pr.left + r.width / 2, r.top - pr.top); };
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
      c.addEventListener('pointerleave', tip.hide); c.addEventListener('blur', tip.hide);
    });
  }

  /* Horizontal bars: how often each feeling was chosen. */
  function tagBars(el, entries, limit = 8) {
    const counts = {};
    entries.forEach(e => (e.moods || []).forEach(t => { if (t !== 'Prefer not to say') counts[t] = (counts[t] || 0) + 1; }));
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    if (!rows.length) { el.innerHTML = '<p class="muted">Feelings you choose in check-ins will appear here.</p>'; return; }
    const max = rows[0][1];
    el.innerHTML = `<ul class="tag-bars">${rows.map(([t, n]) => `<li title="${esc(t)}: chosen ${n} time${n > 1 ? 's' : ''}"><span class="tb-label">${esc(t)}</span><span class="tb-track"><span class="tb-fill" style="width:${Math.max(6, (n / max) * 100)}%"></span></span><span class="tb-n">${n}</span></li>`).join('')}</ul>`;
  }

  P.charts = { byDay, moodLine, calendar, tagBars, levelName };
})(window.Pause);
