/* AI Wellness Companion.
   Conversations stay in memory only (they disappear on reload) unless the person
   chooses "Save to journal". Safety checks run on-device before every send. */
(function (P) {
  'use strict';
  const { esc, uid, fmtTime } = P.util;
  P.companionModes = [
    { id: 'vent', label: 'I need to vent', hint: 'Let it out. I’ll listen without judging.' },
    { id: 'understand', label: 'Help me understand my feelings', hint: 'We can gently name what’s going on.' },
    { id: 'motivation', label: 'I need motivation', hint: 'Let’s find one small, doable step.' },
    { id: 'calm', label: 'Help me calm down', hint: 'Let’s slow things down together.' },
    { id: 'listen', label: 'Just listen', hint: 'No advice unless you ask for it.' },
    { id: 'activity', label: 'Give me a small activity', hint: 'I’ll suggest something short to try.' }
  ];
  const NUDGE_AFTER = 12; // gentle reminder about real-world support after this many messages
  let convo = { mode: 'listen', messages: [], nudged: false };

  function bubble(m) {
    if (m.role === 'safety') return `<div class="msg msg-safety">${P.safety.card(m.level)}</div>`;
    if (m.role === 'note') return `<div class="msg msg-note" role="note">${esc(m.content)}</div>`;
    const act = m.suggestion ? P.catalog.ACTIVITIES.find(a => a.id === m.suggestion) : null;
    return `<div class="msg msg-${m.role}">
      <div class="msg-bubble">${esc(m.content).replace(/\n/g, '<br>')}</div>
      ${act ? `<div class="msg-suggest">${P.activityCard({ activity: act, reason: act.about })}</div>` : ''}
      <div class="msg-meta">${m.role === 'assistant' ? P.ai.badge(m.src) + ' · ' : ''}${fmtTime(m.at)}</div>
    </div>`;
  }

  P.route('companion', view => {
    if (P.companionStart) { convo.mode = P.companionStart.mode || convo.mode; }
    const mode = () => P.companionModes.find(m => m.id === convo.mode);
    view.innerHTML = `<main class="content companion">
      ${P.header({ eyebrow: 'A gentle place to talk', title: 'Companion', intro: 'Share what’s on your mind. The companion offers support for everyday stress, motivation and emotional awareness. It doesn’t diagnose, and it isn’t a replacement for a therapist or the people in your life.' })}
      <div class="companion-layout">
        <aside class="surface companion-side">
          <h2 class="h3">How can I help?</h2>
          <div class="mode-list" role="radiogroup" aria-label="Conversation mode">
            ${P.companionModes.map(m => `<button role="radio" aria-checked="${m.id === convo.mode}" class="mode-btn ${m.id === convo.mode ? 'selected' : ''}" data-mode="${m.id}"><strong>${esc(m.label)}</strong><span>${esc(m.hint)}</span></button>`).join('')}
          </div>
          <div class="ai-status small"><span class="dot dot-${P.ai.status()}"></span>${esc(P.ai.statusLine())} ${P.ai.status() !== 'ready' ? '<a href="#/settings/ai">Set up AI</a>' : ''}</div>
          <p class="small muted">This conversation is not saved unless you choose <em>Save to journal</em>.</p>
        </aside>
        <section class="surface chat" aria-label="Conversation">
          <div class="chat-log" id="chat-log" aria-live="polite">
            ${convo.messages.length ? convo.messages.map(bubble).join('') : `<div class="chat-empty"><div class="chat-orb" aria-hidden="true"></div><p><strong id="mode-hint">${esc(mode().hint)}</strong></p><p class="muted small">Type below whenever you’re ready. You can change the mode at any time.</p></div>`}
          </div>
          <form class="composer" id="composer">
            <label for="chat-input" class="sr-only">Your message</label>
            <textarea id="chat-input" rows="2" maxlength="2000" placeholder="Write as much or as little as you like…"></textarea>
            <button class="btn-main" type="submit" id="chat-send">Send</button>
          </form>
          <div class="chat-tools">
            <button class="link-btn" data-chat="save" ${convo.messages.length ? '' : 'disabled'}>Save to journal</button>
            <button class="link-btn" data-chat="clear" ${convo.messages.length ? '' : 'disabled'}>Clear conversation</button>
            <span class="muted small">Enter to send · Shift+Enter for a new line</span>
          </div>
        </section>
      </div>
    </main>`;

    const log = view.querySelector('#chat-log'), input = view.querySelector('#chat-input'), send = view.querySelector('#chat-send');
    const paint = () => { log.innerHTML = convo.messages.map(bubble).join(''); log.scrollTop = log.scrollHeight; view.querySelectorAll('[data-chat]').forEach(b => { b.disabled = !convo.messages.length; }); };
    if (convo.messages.length) log.scrollTop = log.scrollHeight;

    async function submit() {
      const text = input.value.trim();
      if (!text) return;
      input.value = ''; send.disabled = true;
      convo.messages.push({ role: 'user', content: text, at: Date.now() });
      const level = P.safety.check(text);
      if (level) convo.messages.push({ role: 'safety', level, at: Date.now() });
      convo.messages.push({ role: 'typing', content: '…', at: Date.now() });
      paint();
      log.lastElementChild.innerHTML = '<div class="msg-bubble typing" aria-label="Companion is writing"><span></span><span></span><span></span></div>';
      const history = convo.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }));
      const r = await P.ai.run('companion', 'companion', {
        mode: convo.mode, messages: history, safetyFlag: level || null,
        activities: P.prefs.get().ai.suggestActivities ? P.catalog.ACTIVITIES.map(a => ({ id: a.id, title: a.title, minutes: a.minutes })) : []
      }, () => level === 'crisis'
        ? { text: 'I’m really glad you told me. I’m an app and can’t keep you safe, but the people and services above can help right now. If you can, reach out to one of them or to someone near you. You don’t have to go through this alone.', data: {} }
        : P.ai.local.companion(convo.mode, text));
      convo.messages = convo.messages.filter(m => m.role !== 'typing');
      const reply = (r.data?.reply || r.text || '').trim() || 'I’m here with you.';
      const suggestion = P.catalog.ACTIVITIES.some(a => a.id === r.data?.suggestion) ? r.data.suggestion : null;
      convo.messages.push({ role: 'assistant', content: reply, suggestion, src: { source: r.source, mock: r.mock }, at: Date.now() });
      const userCount = convo.messages.filter(m => m.role === 'user').length;
      if (userCount >= NUDGE_AFTER && !convo.nudged) {
        convo.nudged = true;
        convo.messages.push({ role: 'note', content: 'We’ve been talking for a while. I’m glad to be here, and it can also help to share some of this with someone you trust, or a counsellor. Taking a short break is okay too.', at: Date.now() });
      }
      send.disabled = false; paint(); input.focus();
    }

    view.querySelector('#composer').addEventListener('submit', e => { e.preventDefault(); submit(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    view.addEventListener('click', async e => {
      const mb = e.target.closest('[data-mode]');
      if (mb) {
        convo.mode = mb.dataset.mode;
        view.querySelectorAll('[data-mode]').forEach(b => { const on = b === mb; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); });
        const hint = view.querySelector('#mode-hint'); if (hint) hint.textContent = mode().hint;
        if (convo.messages.length) { convo.messages.push({ role: 'note', content: 'Mode changed to “' + mode().label + '”.', at: Date.now() }); paint(); }
        input.focus();
        return;
      }
      const tool = e.target.closest('[data-chat]')?.dataset.chat;
      if (tool === 'clear' && await P.confirm('Clear this conversation?', 'It hasn’t been saved, so it will be gone.', 'Clear', true)) { convo = { mode: convo.mode, messages: [], nudged: false }; P.render(); }
      if (tool === 'save') {
        const text = convo.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => (m.role === 'user' ? 'Me: ' : 'Companion: ') + m.content).join('\n\n');
        const entry = { id: uid('j'), title: 'Conversation · ' + mode().label, text, category: P.reading.categorize(text), moods: [], created: Date.now(), updated: Date.now(), aiAllowed: false, source: 'companion' };
        await PauseStore.put('journal', entry);
        P.toast('Saved to your journal on this device');
      }
    });

    if (P.companionStart) {
      const s = P.companionStart; P.companionStart = null;
      if (s.text?.trim()) { input.value = s.text; submit(); } else input.focus();
    }
  });
})(window.Pause);
