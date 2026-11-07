/* Safety checks that always run on this device, before anything is sent anywhere.
   They are intentionally cautious: a false alarm only shows support options. */
(function (P) {
  'use strict';
  const CRISIS = [
    /\bsuicid/i, /\bkill(ing)?\s+my\s*self\b/i, /\bkms\b/i, /\bend(ing)?\s+(my\s+life|it\s+all|things)\b/i,
    /\b(want|wanna|going)\s+to\s+die\b/i, /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b/i,
    /\bno\s+reason\s+to\s+(live|go\s+on)\b/i, /\bbetter\s+off\s+(dead|without\s+me)\b/i, /\bself[-\s]?harm/i,
    /\b(cut|cutting|hurt|hurting|harm|harming)\s+my\s*self\b/i, /\boverdos/i, /\btake\s+all\s+(my|the)\s+pills\b/i,
    /\bnot\s+(be|being)\s+(here|around)\s+any\s*more\b/i, /\b(hurt|kill)\s+(him|her|them|someone|somebody)\b/i
  ];
  const CONCERN = [
    /\bhopeless\b/i, /\bcan'?t\s+(go\s+on|cope|take\s+(it|this)\s+any\s*more)\b/i, /\bunsafe\b/i, /\bnot\s+safe\b/i,
    /\b(being|been|getting)\s+(abused|hit|beaten)\b/i, /\bsomeone\s+(is\s+)?hurting\s+me\b/i, /\bpanic\s+attack/i, /\bworthless\b/i
  ];

  function check(text) {
    const t = String(text || '');
    if (CRISIS.some(r => r.test(t))) return 'crisis';
    if (CONCERN.some(r => r.test(t))) return 'concern';
    return null;
  }

  const MESSAGE = 'I’m having a really hard time right now and I don’t want to be alone with it. Can you call me or come be with me?';

  function card(level = 'crisis') {
    const crisis = level === 'crisis';
    return `<aside class="safety-card" role="note" aria-label="Support options">
      <h3>${crisis ? 'You deserve support from a real person right now' : 'This sounds really hard'}</h3>
      <p>${crisis
        ? 'What you’re feeling matters, and you don’t have to hold it alone. Pause can’t keep you safe in an emergency, but people can help right now.'
        : 'You don’t have to manage this alone. Talking to someone you trust, or a trained counsellor, can help.'}</p>
      <ul class="safety-list">
        ${crisis ? '<li><strong>In immediate danger in India:</strong> call <a href="tel:112">112</a>, or go to the nearest emergency department.</li>' : ''}
        <li><strong>Tele-MANAS (free, 24×7, many languages):</strong> call <a href="tel:14416">14416</a> or <a href="tel:18008914416">1-800-891-4416</a>.</li>
        <li><strong>Someone you trust:</strong> a friend, family member, teacher or neighbour. You could send:<br><q>${MESSAGE}</q> <button class="btn-line btn-small" data-copy-safety>Copy message</button></li>
        <li class="muted">Outside India, contact your local emergency number or a local crisis line.</li>
      </ul>
      <button class="btn-soft btn-small" data-go="support">More support options</button>
    </aside>`;
  }

  document.addEventListener('click', async e => {
    if (!e.target.closest('[data-copy-safety]')) return;
    try { await navigator.clipboard.writeText(MESSAGE); P.toast('Message copied'); }
    catch { P.toast('Copy didn’t work here. You can type it instead.'); }
  });

  P.safety = { check, card, MESSAGE };
})(window.Pause);
