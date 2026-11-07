/* AI service layer.
   - The browser never holds an API key. It talks to YOUR backend endpoint
     (see backend/worker.js), which holds the key in an environment variable.
   - Nothing is sent unless: AI is switched on in Settings, an endpoint is set,
     the person has agreed to the consent screen, that feature is enabled, and the
     person pressed a button that asks for AI help.
   - When AI is off or fails, pages use the on-device helpers in `P.ai.local`, and the
     UI labels those results as on-device suggestions, never as AI. */
(function (P) {
  'use strict';
  const { esc, pick, truncate } = P.util;
  const TIMEOUT_MS = 30000;
  const MAX_TEXT = 6000;

  class AIError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }

  function endpoint() {
    const p = P.prefs.get().ai;
    return (p.endpoint || window.PAUSE_CONFIG?.aiEndpoint || '').trim();
  }
  function validEndpoint(url) {
    if (!url) return false;
    if (url.startsWith('/')) return true; // same-origin, e.g. the local dev server
    try { const u = new URL(url); return u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname); } catch { return false; }
  }
  /* 'off' = switched off, 'unconfigured' = on but no valid endpoint, 'ready' */
  function status() {
    const p = P.prefs.get().ai;
    if (!p.enabled) return 'off';
    if (!validEndpoint(endpoint())) return 'unconfigured';
    return 'ready';
  }
  function allowed(feature) {
    const p = P.prefs.get().ai;
    return status() === 'ready' && p.consent && p.features[feature] !== false;
  }

  /* Shown once before anything personal leaves the device. */
  async function ensureConsent(feature) {
    if (status() !== 'ready') return false;
    const p = P.prefs.get().ai;
    if (p.features[feature] === false) return false;
    if (p.consent) return true;
    const ok = await P.dialog({
      title: 'Before Pause sends anything to AI',
      wide: true,
      body: `<p>AI help is optional. Here is exactly what happens when you use it:</p>
        <ul class="consent-list">
          <li><strong>Sent:</strong> only the text for the action you choose (for example, this one message or this one journal entry), plus your AI style settings (tone and length).</li>
          <li><strong>Not sent:</strong> your other entries, your name, your mood history (unless you use mood insights), or any device identifier.</li>
          <li><strong>Where it goes:</strong> to <code>${esc(endpoint())}</code>, which forwards it to an AI provider. That provider's own privacy terms apply.</li>
          <li><strong>Not stored by Pause's backend:</strong> the included backend does not save or log your text.</li>
          <li>AI can be wrong. It does not diagnose and is not a therapist.</li>
        </ul>
        <p class="muted">You can turn AI off or switch off individual features any time in Settings.</p>`,
      actions: [{ label: 'Not now', value: false }, { label: 'I understand, use AI', value: true, kind: 'main' }]
    });
    if (ok) P.prefs.set({ ai: { consent: true } });
    return !!ok;
  }

  async function request(task, input) {
    if (status() !== 'ready') throw new AIError('config', 'AI is not set up.');
    if (!navigator.onLine) throw new AIError('offline', 'You appear to be offline.');
    const p = P.prefs.get().ai;
    const body = JSON.stringify({ task, input: clip(input), prefs: { tone: p.tone, length: p.length, suggestActivities: p.suggestActivities }, client: 'pause-web/3' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      throw new AIError(e.name === 'AbortError' ? 'timeout' : 'network', e.name === 'AbortError' ? 'The AI took too long to answer.' : 'Could not reach the AI service.');
    } finally { clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch { }
    if (res.status === 429) throw new AIError('rate', 'The AI service is busy. Please try again in a few minutes.');
    if (!res.ok || !data?.ok) throw new AIError('server', data?.error || 'The AI service returned an error.');
    return data;
  }
  /* Trim long strings so a single request stays small. */
  function clip(v) {
    if (typeof v === 'string') return v.slice(0, MAX_TEXT);
    if (Array.isArray(v)) return v.slice(-16).map(clip);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = clip(v[k]); return o; }
    return v;
  }

  /* One call for pages: try AI if allowed, otherwise (or on failure) run the local fallback.
     Returns { source: 'ai' | 'local', text?, data?, mock?, safety?, error? } */
  async function run(feature, task, input, fallback) {
    if (allowed(feature) || (status() === 'ready' && await ensureConsent(feature))) {
      try {
        const r = await request(task, input);
        return { source: 'ai', text: r.text, data: r.data, mock: !!r.mock, safety: r.safety };
      } catch (e) {
        P.toast((e.message || 'AI is unavailable') + ' Showing an on-device suggestion instead.', { kind: 'warn', ms: 4200 });
        return { source: 'local', error: e.kind, ...(await fallback()) };
      }
    }
    return { source: 'local', ...(await fallback()) };
  }

  function badge(r) {
    if (r?.source === 'ai') return r.mock ? '<span class="src-badge src-mock" title="The backend is in test mode. This text is not from an AI model.">Test mode · not AI</span>' : '<span class="src-badge src-ai">AI suggestion · may be imperfect</span>';
    return '<span class="src-badge src-local" title="Generated by simple rules in your browser. Nothing was sent anywhere.">On-device suggestion</span>';
  }
  function statusLine() {
    const s = status();
    if (s === 'ready') return P.prefs.get().ai.consent ? 'AI is on. Text is sent only when you press an AI button.' : 'AI is set up. You will be asked before anything is sent.';
    if (s === 'unconfigured') return 'AI is switched on but no backend address is set. Using on-device suggestions.';
    return 'AI is off. You’ll get on-device suggestions; nothing leaves this device.';
  }

  /* ---------- On-device fallbacks (simple, honest rule-based helpers) ---------- */
  const sentences = text => String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 2);
  const STOP = new Set('i me my myself we our you your he she it its they them a an the and or but if then so to of in on at for with about as is am are was were be been being have has had do did does not no just really very that this these those there what which who when where why how can could would should will today feel felt feeling like get got'.split(' '));
  /* Spot feeling words in free text by their stem ("anxio" matches anxious/anxiety). */
  const SKIP = new Set(['Other', 'Unsure', 'Content', 'Energised', 'Prefer not to say', 'A little better']);
  const feelingWords = text => P.catalog.EMOTIONS.filter(e => !SKIP.has(e)).filter(e => new RegExp('\\b' + e.slice(0, 5).toLowerCase(), 'i').test(text || ''));
  P.feelingWords = feelingWords;

  const local = {
    companion(mode, text) {
      const feel = feelingWords(text)[0];
      const named = feel ? `a lot of ${feel.toLowerCase()} feelings` : 'a lot';
      const responses = {
        vent: [`That sounds like ${named} to be carrying. You can keep going. What feels most important to get out?`, `Thank you for putting that into words. It makes sense that this is weighing on you. What else is part of it?`],
        understand: [`Let’s look at it gently. If you had to name the strongest feeling in what you wrote, what would it be? Sometimes there is a quieter feeling underneath, like worry under anger, or tiredness under frustration.`, `When did you first notice feeling this way today? Noticing what came just before can help make sense of a feeling.`],
        motivation: [`You don’t need to feel motivated to begin. What is the smallest visible first step, small enough that it feels almost too easy? The two-minute start might help.`, `Starting is often the hardest part. Could you pick one tiny piece and give it just two minutes?`],
        calm: [`Let’s slow things down together. Try breathing in for four counts and out for six, a few times. A short guided breathing session is just one tap away.`, `Notice where your body is supported right now: the chair, the floor, your feet. You are here, and this moment can be a little slower.`],
        listen: ['I’m here, and I’m listening. Take your time.', 'Mm. That sounds like a lot. Go on, if you’d like.', 'Thank you for sharing that with me.'],
        activity: [`Here’s a small idea for right now. Pick whichever feels easiest.`, `How about something gentle and short? Here’s one that fits this moment.`]
      };
      const suggestFor = { motivation: 'routine:start-2', calm: 'breathe:exhale', activity: null, vent: null, understand: 'journal:write', listen: null };
      let suggestion = suggestFor[mode] || null;
      if (mode === 'activity' || (!suggestion && /overwhelm|too much|so much/i.test(text))) suggestion = P.recommend({ emotions: feelingWords(text), count: 1 })[0]?.activity.id || 'routine:thought-dump';
      return { text: pick(responses[mode] || responses.listen), data: { suggestion } };
    },
    reflect(text) {
      const qs = [];
      if (/overwhelm|too much|stress|so much/i.test(text)) qs.push('What might have made today feel overwhelming?');
      if (/concentrat|focus|distract/i.test(text)) qs.push('What tends to pull your attention away, and what helps you come back?');
      if (/\b(friend|friends|family|parent|parents|people|they|he|she|him|her|mom|dad)\b/i.test(text)) qs.push('What do you wish the other person understood about how you feel?');
      if (/tired|exhaust|sleep/i.test(text)) qs.push('What would real rest look like for you this week?');
      if (/worr|anxious|scared|what if/i.test(text)) qs.push('What do you know for sure right now, and what is still uncertain?');
      if (/sad|lonely|down|low/i.test(text)) qs.push('What would feel comforting right now, even a little?');
      qs.push('What is one thing you managed to accomplish?', 'What is one small thing that could make tomorrow easier?');
      return { data: { questions: [...new Set(qs)].slice(0, 4) } };
    },
    summarize(text) {
      const ss = sentences(text);
      if (ss.length <= 3) return { data: { points: ss } };
      const freq = {};
      for (const w of text.toLowerCase().match(/[a-z']+/g) || []) if (!STOP.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1;
      const scored = ss.map((s, i) => ({ s, i, score: (s.toLowerCase().match(/[a-z']+/g) || []).reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(s.length) }));
      return { data: { points: scored.sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i).map(x => x.s) } };
    },
    takeaway(text) {
      const good = sentences(text).filter(s => /\b(managed|finished|did|helped|better|glad|proud|grateful|good|enjoyed|laughed|tried|started|okay)\b/i.test(s));
      return { text: good.length ? `Something worth noticing: “${truncate(good[0], 180)}” Even on a hard day, that counts.` : 'You took time to put your thoughts into words. That is a real way of looking after yourself.' };
    },
    organize(text) {
      const groups = { 'What happened': [], 'How I feel': [], 'What is worrying me': [], 'What I could do': [], 'Good things': [], 'Other thoughts': [] };
      for (const s of sentences(text)) {
        if (/\b(should|could|need to|have to|will|plan|try|maybe i|next)\b/i.test(s)) groups['What I could do'].push(s);
        else if (/\b(worr|afraid|scared|what if|anxious|nervous|might not|fear)/i.test(s)) groups['What is worrying me'].push(s);
        else if (/\b(glad|grateful|good|nice|happy|proud|enjoyed|helped|better|managed|finished)\b/i.test(s)) groups['Good things'].push(s);
        else if (/\b(feel|felt|feeling|sad|angry|tired|lonely|overwhelm|frustrat|upset|numb)/i.test(s)) groups['How I feel'].push(s);
        else if (/\b(today|yesterday|happened|went|said|told|when|after|class|work|exam|met)\b/i.test(s)) groups['What happened'].push(s);
        else groups['Other thoughts'].push(s);
      }
      return { data: { sections: Object.entries(groups).filter(([, v]) => v.length).map(([title, items]) => ({ title, items })) } };
    },
    categorize(text) { return { data: { category: P.reading.categorize(text) } }; },
    prompts(tags = []) {
      const pool = P.catalog.JOURNAL_PROMPTS;
      const fits = pool.filter(p => tags.some(t => ({ Overwhelmed: /space|carry|wait|easier/, Stressed: /worry|wait|carry/, Sad: /kind|comfort|friend/, Lonely: /who|friend/, Anxious: /worry|know|safe/, Unmotivated: /avoid|good enough|small/ }[t] || /x^/).test(p)));
      const out = [...new Set([...fits.sort(() => Math.random() - .5), ...pool.slice().sort(() => Math.random() - .5)])].slice(0, 3);
      return { data: { prompts: out } };
    },
    affirmation(group) {
      const list = P.catalog.AFFIRMATIONS.filter(a => !group || a.group === group);
      return { text: pick(list.length ? list : P.catalog.AFFIRMATIONS).text };
    },
    articleSummary(a) { return { data: { points: [a.excerpt, ...(a.excerpts || []).slice(1, 3).map(x => truncate(x, 200))] } }; }
  };

  P.ai = { status, allowed, ensureConsent, request, run, badge, statusLine, endpoint, validEndpoint, local, AIError };
})(window.Pause);
