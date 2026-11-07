/* Content and vocabulary shared by every page: feelings, goals, activities,
   affirmations, journal prompts and reading needs. Editing this file is the easiest
   way to add new content without touching page logic. */
(function (P) {
  'use strict';

  /* Mood level is self-described, never a score of emotional health. */
  const LEVELS = [
    { v: 1, label: 'Really heavy', short: 'Heavy' },
    { v: 2, label: 'A bit low', short: 'Low' },
    { v: 3, label: 'Somewhere in between', short: 'In between' },
    { v: 4, label: 'Fairly okay', short: 'Okay' },
    { v: 5, label: 'Light and good', short: 'Good' }
  ];

  /* The first 13 are the original Pause check-in options, kept so old entries still match. */
  const EMOTION_GROUPS = [
    { name: 'Pleasant', tags: ['Calm', 'A little better', 'Happy', 'Content', 'Grateful', 'Hopeful', 'Energised'] },
    { name: 'Heavy', tags: ['Sad', 'Lonely', 'Numb', 'Exhausted', 'Low-energy', 'Disappointed'] },
    { name: 'Stirred up', tags: ['Anxious', 'Overwhelmed', 'Stressed', 'Angry', 'Frustrated', 'Restless', 'Distracted', 'Unmotivated'] },
    { name: 'Other', tags: ['Unsure', 'Other', 'Prefer not to say'] }
  ];
  const EMOTIONS = EMOTION_GROUPS.flatMap(g => g.tags);

  /* Feeling -> what kind of help tends to fit. Used by the recommendation engine. */
  const NEED_OF = {
    Anxious: ['calm', 'ground'], Overwhelmed: ['unload', 'calm'], Stressed: ['calm', 'unload'], Angry: ['release', 'calm'],
    Frustrated: ['release', 'unload'], Restless: ['release', 'ground'], Distracted: ['focus'], Unmotivated: ['start'],
    Sad: ['comfort', 'connect'], Lonely: ['connect', 'comfort'], Numb: ['ground', 'gentle'], Exhausted: ['rest', 'gentle'],
    'Low-energy': ['gentle', 'rest'], Disappointed: ['comfort', 'reflect'], Unsure: ['reflect', 'ground'],
    Calm: ['savour', 'reflect'], 'A little better': ['savour', 'gentle'], Happy: ['savour'], Content: ['savour', 'reflect'],
    Grateful: ['savour'], Hopeful: ['start', 'savour'], Energised: ['start', 'focus']
  };

  const GOALS = [
    { id: 'calm', label: 'Feel calmer day to day', needs: ['calm', 'ground'] },
    { id: 'rest', label: 'Rest and sleep better', needs: ['rest', 'gentle'] },
    { id: 'focus', label: 'Focus a little better', needs: ['focus', 'start'] },
    { id: 'kind', label: 'Be kinder to myself', needs: ['comfort', 'savour'] },
    { id: 'understand', label: 'Understand my feelings', needs: ['reflect', 'unload'] },
    { id: 'connect', label: 'Feel more connected', needs: ['connect'] },
    { id: 'start', label: 'Get started on things', needs: ['start', 'focus'] }
  ];

  const KINDS = {
    breathe: 'Breathing', game: 'Quiet game', routine: 'Guided moment', read: 'Reading', journal: 'Writing', sound: 'Soundscape', affirmation: 'Affirmation'
  };

  /* Breathing patterns: seconds for inhale, hold, exhale, hold-after-exhale. */
  const BREATHS = [
    { id: 'exhale', name: 'Longer exhale', steps: [4, 0, 6, 0], about: 'Breathing out a little longer than you breathe in can feel settling.', needs: ['calm', 'rest'] },
    { id: 'box', name: 'Box breathing', steps: [4, 4, 4, 4], about: 'Four even sides. Steady and easy to follow.', needs: ['calm', 'focus', 'ground'] },
    { id: 'coherent', name: 'Even breathing', steps: [5, 0, 5, 0], about: 'A slow, even rhythm of about six breaths a minute.', needs: ['calm', 'focus'] },
    { id: '478', name: '4 · 7 · 8', steps: [4, 7, 8, 0], about: 'A longer pattern. Skip the hold if it feels uncomfortable.', needs: ['rest', 'calm'] },
    { id: 'sigh', name: 'Double inhale sigh', steps: [3, 1, 6, 0], about: 'Breathe in, take a small extra sip of air, then a long slow sigh out.', needs: ['release', 'calm'] }
  ];

  /* Breathing for how you feel: candidate patterns (best first), a length and a reason.
     These are gentle general suggestions, not medical advice. */
  const BREATH_FOR = {
    Anxious: { ids: ['exhale', 'box'], min: 3, why: 'Breathing out for longer than you breathe in can help a racing body slow down.' },
    Stressed: { ids: ['exhale', 'coherent'], min: 3, why: 'A longer out-breath gives your body a signal that it can ease off a little.' },
    Overwhelmed: { ids: ['sigh', 'exhale'], min: 2, why: 'A few long sighs can release some pressure before you deal with anything else.' },
    Angry: { ids: ['sigh', 'exhale'], min: 2, why: 'Slow, audible sighs give strong feelings somewhere to go.' },
    Frustrated: { ids: ['sigh', 'exhale'], min: 2, why: 'A long sigh out can loosen the tension that builds up with frustration.' },
    Restless: { ids: ['box', 'coherent'], min: 3, why: 'An even, countable rhythm gives restless energy a steady shape.' },
    Distracted: { ids: ['box', 'coherent'], min: 2, why: 'Counting four even sides gently gathers scattered attention.' },
    Unmotivated: { ids: ['box', 'coherent'], min: 2, why: 'A short, steady pattern can help you arrive before starting something.' },
    Exhausted: { ids: ['coherent', 'exhale'], min: 2, why: 'Easy, even breaths with no long holds, so it asks very little of you.' },
    'Low-energy': { ids: ['coherent', 'exhale'], min: 2, why: 'Easy, even breaths with no long holds, so it asks very little of you.' },
    Sleep: { ids: ['478', 'exhale'], min: 5, why: 'A slow pattern with long out-breaths, often used to wind down before sleep.' },
    Sad: { ids: ['coherent', 'exhale'], min: 3, why: 'A gentle, steady rhythm to keep you company. Nothing to push through.' },
    Lonely: { ids: ['coherent', 'exhale'], min: 3, why: 'A gentle, steady rhythm to keep you company. Nothing to push through.' },
    Numb: { ids: ['box', 'coherent'], min: 2, why: 'Counting each side can help you notice your body again, gently.' },
    Disappointed: { ids: ['exhale', 'coherent'], min: 3, why: 'Slow out-breaths make a little room around a heavy feeling.' },
    Calm: { ids: ['coherent'], min: 2, why: 'A few even breaths to enjoy feeling steadier.' },
    Happy: { ids: ['coherent'], min: 1, why: 'A minute of even breathing to savour a good moment.' }
  };
  /* Feelings shown on the Breathe page, mapped to the keys above. */
  const BREATH_FEELINGS = [['Anxious', 'Anxious'], ['Stressed', 'Stressed'], ['Overwhelmed', 'Overwhelmed'], ['Angry or frustrated', 'Angry'], ['Restless', 'Restless'], ['Distracted', 'Distracted'], ['Tired', 'Exhausted'], ['Can’t sleep', 'Sleep'], ['Sad or low', 'Sad'], ['Calm', 'Calm']];
  const BREATH_ALIAS = { Frustrated: 'Frustrated', 'Low-energy': 'Low-energy', Content: 'Calm', Grateful: 'Calm', Hopeful: 'Calm', 'A little better': 'Calm', Energised: 'Happy', Unmotivated: 'Unmotivated' };

  const GAMES = [
    { id: 'fireflies', title: 'Catch the Fireflies', about: 'Tap a glow and watch it drift away. No timer, no score.', icon: '🌙', color: 'var(--g-night)', needs: ['calm', 'gentle', 'focus'] },
    { id: 'bubbles', title: 'Bubble Pop', about: 'Let a few translucent bubbles float by.', icon: '🫧', color: 'var(--g-sky)', needs: ['release', 'gentle'] },
    { id: 'fluid', title: 'Fluid Art', about: 'Make slow colour trails with your finger or cursor.', icon: '🎨', color: 'var(--g-lav)', needs: ['release', 'savour', 'calm'] },
    { id: 'wrap', title: 'Bubble Wrap', about: 'Pop as many as you like, at your own pace.', icon: '◉', color: 'var(--g-blush)', needs: ['release'] },
    { id: 'grounding', title: 'Five Senses', about: 'A gentle 5–4–3–2–1 grounding exercise.', icon: '🌿', color: 'var(--g-sage)', needs: ['ground', 'calm'] },
    { id: 'alphabet', title: 'Alphabet Categories', about: 'A tiny word game with no timer and no wrong answers.', icon: '✳', color: 'var(--g-peach)', needs: ['focus', 'ground'] }
  ];

  /* Short guided moments (played by the routine player in play.js). */
  const ROUTINES = [
    { id: 'start-2', title: 'Two-minute start', icon: '⏱', about: 'Pick one task and do only the first tiny piece of it for two minutes.', minutes: 2, needs: ['start', 'focus'],
      steps: [
        { t: 'Choose one thing', d: 'Name one task that has been waiting. Write it below if that helps.', input: 'The task I will start' },
        { t: 'Make it tiny', d: 'What is the smallest visible first action? Opening a file, writing one line, putting the book on the table.', input: 'My tiny first action' },
        { t: 'Two minutes, starting now', d: 'Do just that. You are allowed to stop when the timer ends.', seconds: 120 },
        { t: 'You started', d: 'Whatever happened in those two minutes counts. Continue if you would like to, or stop here.' }
      ] },
    { id: 'thought-dump', title: 'Thought dump', icon: '🗒', about: 'Empty everything circling in your head onto the page, then sort it gently.', minutes: 5, needs: ['unload', 'reflect'],
      steps: [
        { t: 'Let it all out', d: 'Write whatever is on your mind, in any order. Spelling and sense do not matter.', input: 'Everything on my mind', long: true, seconds: 180 },
        { t: 'Notice one thing', d: 'Looking at what you wrote, what is one thing that can wait until later?', input: 'Can wait' },
        { t: 'One small next step', d: 'What is one thing you could do in the next ten minutes?', input: 'Small next step' },
        { t: 'Set it down', d: 'You can save this to your journal and sort it into sections there.', save: true }
      ] },
    { id: 'gentle-reset', title: 'Gentle reset', icon: '☁', about: 'Four tiny low-energy steps to reset your body a little.', minutes: 4, needs: ['gentle', 'rest'],
      steps: [
        { t: 'Have some water', d: 'If you can, take a few sips of water. No rush.', seconds: 30 },
        { t: 'Loosen your shoulders', d: 'Lift your shoulders toward your ears, hold for a moment, then let them drop. Repeat a few times.', seconds: 45 },
        { t: 'Find the light', d: 'Look toward a window or the farthest point in the room. Let your eyes soften.', seconds: 45 },
        { t: 'Three slow breaths', d: 'Breathe in through your nose and out slowly through your mouth, three times.', seconds: 40 },
        { t: 'That was enough', d: 'A small reset is still a reset. Be gentle with the rest of your day.' }
      ] },
    { id: 'gratitude-3', title: 'Three small things', icon: '✿', about: 'Notice three small things that were okay today, however ordinary.', minutes: 3, needs: ['savour', 'comfort'],
      steps: [
        { t: 'One small thing', d: 'Something that was okay today. A warm drink, a message, the weather.', input: 'First thing' },
        { t: 'Another one', d: 'It can be really small.', input: 'Second thing' },
        { t: 'And one more', d: 'Something you did, or something someone else did.', input: 'Third thing' },
        { t: 'Keep them', d: 'You can save these to your journal if you would like to look back later.', save: true }
      ] },
    { id: 'body-scan', title: 'Short body scan', icon: '◌', about: 'Move your attention slowly from head to feet. Nothing to fix.', minutes: 3, needs: ['ground', 'calm', 'rest'],
      steps: [
        { t: 'Head and face', d: 'Notice your forehead, jaw and eyes. Let them soften if they can.', seconds: 35 },
        { t: 'Shoulders and arms', d: 'Notice any weight or tension. You do not need to change it.', seconds: 35 },
        { t: 'Chest and belly', d: 'Feel the gentle movement of your breath.', seconds: 35 },
        { t: 'Legs and feet', d: 'Notice where your feet meet the floor, or where your body is supported.', seconds: 35 },
        { t: 'Back to the room', d: 'Look around and notice one colour. Return whenever you are ready.' }
      ] },
    { id: 'reach-out', title: 'Reach out to someone', icon: '✉', about: 'Write a short, low-pressure message to someone you trust.', minutes: 3, needs: ['connect', 'comfort'],
      steps: [
        { t: 'Who feels safe?', d: 'Think of one person who would be glad to hear from you. A friend, family member, classmate or mentor.', input: 'Person' },
        { t: 'Keep it small', d: 'You do not need to explain everything. For example: “Hey, thinking of you. Up for a short call this week?” or “I’m having a rough day. Could you keep me company for a bit?”', input: 'My message', long: true },
        { t: 'Send it when ready', d: 'Copy your message and send it whenever it feels right. It is okay to wait.', copy: true }
      ] }
  ];

  /* Everything the recommender can suggest, in one list. */
  const ACTIVITIES = [
    ...BREATHS.map(b => ({ id: 'breathe:' + b.id, kind: 'breathe', title: b.name, about: b.about, minutes: 2, needs: b.needs, go: 'breathe/' + b.id, icon: '◯' })),
    ...GAMES.map(g => ({ id: 'game:' + g.id, kind: 'game', title: g.title, about: g.about, minutes: 5, needs: g.needs, go: 'play/' + g.id, icon: g.icon })),
    ...ROUTINES.map(r => ({ id: 'routine:' + r.id, kind: 'routine', title: r.title, about: r.about, minutes: r.minutes, needs: r.needs, go: 'routine/' + r.id, icon: r.icon })),
    { id: 'journal:write', kind: 'journal', title: 'Write for five minutes', about: 'Open a fresh journal page with a gentle prompt.', minutes: 5, needs: ['reflect', 'unload'], go: 'journal/new', icon: '✎' },
    { id: 'read:pick', kind: 'read', title: 'Read something short', about: 'A two-minute reflection matched to how you feel.', minutes: 3, needs: ['comfort', 'reflect', 'gentle'], go: 'read', icon: '❧' },
    { id: 'sound:rain', kind: 'sound', title: 'Rain and rest', about: 'Put on gentle rain and simply sit for a while.', minutes: 10, needs: ['rest', 'calm', 'gentle'], go: 'sound/Gentle rain', icon: '☂' },
    { id: 'sound:brown', kind: 'sound', title: 'Focus sound', about: 'A soft, steady brown noise to help you settle into a task.', minutes: 20, needs: ['focus', 'start'], go: 'sound/Brown noise', icon: '≋' },
    { id: 'affirm:pick', kind: 'affirmation', title: 'A kind sentence', about: 'Find a supportive reminder that fits right now.', minutes: 1, needs: ['comfort', 'savour'], go: 'affirmations', icon: '♡' }
  ];

  /* Things a person might have done today; used for gentle activity/mood patterns. */
  const DAY_FACTORS = ['Slept reasonably', 'Moved my body', 'Time outside', 'Talked with someone', 'Ate regular meals', 'Long study/work day', 'Lots of screen time', 'Took a break'];

  /* Affirmations. The first 16 are the original Pause list, in the original order, so
     previously saved favourites (id "affirm-<index>") still line up. */
  const AFFIRMATIONS = [
    ['Self-worth', 'I am worthy of being loved, exactly as I am.', 'Self-worth'],
    ['Confidence', 'I am the best version of myself when I show up with care and courage.', 'Confidence'],
    ['Growth', 'I can learn at my own pace; I do not have to have it all figured out.', 'Self-compassion'],
    ['Belonging', 'I deserve kindness, including from myself.', 'Self-compassion'],
    ['Strength', 'I have made it through hard moments before, one moment at a time.', 'Resilience'],
    ['Rest', 'I am allowed to rest without earning it first.', 'Rest & calm'],
    ['Self-trust', 'I can make the next choice with the information I have today.', 'Confidence'],
    ['Love', 'I can receive love without being perfect.', 'Self-worth'],
    ['Courage', 'Small steps count, even when nobody else sees them.', 'Motivation'],
    ['Enoughness', 'I am enough while I am still becoming.', 'Self-worth'],
    ['Boundaries', 'My needs matter, and I can express them with care.', 'Self-worth'],
    ['Hope', 'A difficult day is one part of my story, not the whole of it.', 'Resilience'],
    ['Self-respect', 'I can be proud of myself without comparing my path to anyone else’s.', 'Confidence'],
    ['Patience', 'I can begin again gently, as many times as I need.', 'Self-compassion'],
    ['Agency', 'I am allowed to change my mind as I learn more.', 'Confidence'],
    ['Care', 'I deserve the same patience I try to give to people I love.', 'Self-compassion'],
    ['Confidence', 'I can feel unsure and still take the next step.', 'Confidence'],
    ['Confidence', 'My voice is allowed to take up space.', 'Confidence'],
    ['Confidence', 'I have handled new things before, and I can learn this too.', 'Confidence'],
    ['Self-compassion', 'I can notice a mistake without turning it against myself.', 'Self-compassion'],
    ['Self-compassion', 'It makes sense that this feels hard. I can be kind to myself while it does.', 'Self-compassion'],
    ['Self-compassion', 'I do not need to be at my best to deserve care.', 'Self-compassion'],
    ['Motivation', 'I do not have to feel ready to begin. Starting small is enough.', 'Motivation'],
    ['Motivation', 'Ten honest minutes is real progress.', 'Motivation'],
    ['Motivation', 'I can do one thing now and let the rest wait.', 'Motivation'],
    ['Motivation', 'Progress can be quiet and still be progress.', 'Motivation'],
    ['Gratitude', 'Something small went okay today, and I can notice it.', 'Gratitude'],
    ['Gratitude', 'I can appreciate what is here without pretending everything is fine.', 'Gratitude'],
    ['Gratitude', 'There are people and moments that have helped me get here.', 'Gratitude'],
    ['Gratitude', 'My body has carried me through today. I can thank it with a little care.', 'Gratitude'],
    ['Resilience', 'This feeling is strong right now, and feelings can shift.', 'Resilience'],
    ['Resilience', 'I can ask for help; that is part of being strong.', 'Resilience'],
    ['Resilience', 'I have more options than this moment makes it look like.', 'Resilience'],
    ['Resilience', 'I can bend without breaking, and rest when I need to.', 'Resilience'],
    ['Rest', 'Slowing down is a choice I am allowed to make.', 'Rest & calm'],
    ['Calm', 'I can take one breath at a time.', 'Rest & calm'],
    ['Calm', 'Right now, in this moment, I can let my shoulders drop.', 'Rest & calm'],
    ['Connection', 'Reaching out is a strength, not a burden.', 'Connection'],
    ['Connection', 'I am allowed to need people.', 'Connection'],
    ['Connection', 'The right people will be glad I told them how I feel.', 'Connection'],
    ['Connection', 'I can let someone in a little at a time.', 'Connection'],
    ['Self-worth', 'My worth is not a grade, a number or a comparison.', 'Self-worth']
  ].map(([cat, text, group], i) => ({ i, cat, text, group }));
  const AFFIRMATION_GROUPS = ['Confidence', 'Self-compassion', 'Motivation', 'Gratitude', 'Resilience', 'Rest & calm', 'Self-worth', 'Connection'];
  const GROUP_FOR_FEELING = {
    Anxious: 'Rest & calm', Overwhelmed: 'Rest & calm', Stressed: 'Rest & calm', Angry: 'Self-compassion', Frustrated: 'Self-compassion',
    Restless: 'Rest & calm', Distracted: 'Motivation', Unmotivated: 'Motivation', Sad: 'Self-compassion', Lonely: 'Connection',
    Numb: 'Self-compassion', Exhausted: 'Rest & calm', 'Low-energy': 'Rest & calm', Disappointed: 'Resilience', Unsure: 'Confidence',
    Calm: 'Gratitude', 'A little better': 'Resilience', Happy: 'Gratitude', Content: 'Gratitude', Grateful: 'Gratitude', Hopeful: 'Motivation', Energised: 'Motivation'
  };

  const JOURNAL_PROMPTS = [
    'What is taking up the most space in your mind today?', 'What is one thing you managed today, however small?',
    'What would make tomorrow a little easier?', 'Describe a moment today when you felt even slightly at ease.',
    'What are you carrying that is not yours to carry?', 'If your feelings today were weather, what would they be?',
    'What do you need more of this week? What do you need less of?', 'Write a short note to yourself from a kind friend.',
    'What is something you are looking forward to, even a little?', 'What drained your energy today? What restored some?',
    'What is a worry you could set down until tomorrow?', 'Who made your day slightly better, and how?',
    'What is one boundary that would protect your energy?', 'What did you learn about yourself this week?',
    'What is something you have been avoiding? What makes it hard?', 'Describe a place where you feel safe and calm.',
    'What would you tell a friend who felt the way you do right now?', 'What is one thing you are proud of that nobody noticed?',
    'Which thought kept coming back today? What does it want you to know?', 'What does rest look like for you right now?',
    'What small habit has been helping you lately?', 'What are three things you can see, hear and feel right now?',
    'What has been surprisingly okay recently?', 'What is one question you would like an answer to?',
    'What part of today would you like to remember?', 'What is one kind thing you could do for yourself this evening?',
    'What expectations are you holding yourself to? Are they fair?', 'What has changed for you in the past month?',
    'When did you last laugh? What happened?', 'What would “good enough” look like for this week?'
  ];

  /* Journal categories, detected on-device by keywords (AI can suggest one too). */
  const JOURNAL_CATEGORIES = {
    'Study & work': /\b(exam|study|studying|class|college|school|assignment|deadline|project|work|job|internship|placement|marks|grade|interview|semester|lecture|boss|office)\b/i,
    'Relationships': /\b(friend|friends|family|mom|mum|dad|mother|father|parents|sister|brother|partner|boyfriend|girlfriend|relationship|roommate|classmate|people)\b/i,
    'Worries': /\b(worr|anxious|anxiety|scared|afraid|fear|nervous|what if|panic|uncertain|overthink)/i,
    'Rest & health': /\b(sleep|tired|exhausted|rest|sick|headache|ate|eating|food|exercise|walk|body|energy)\b/i,
    'Gratitude': /\b(grateful|thankful|glad|appreciate|lucky|blessed|happy that|good thing)\b/i,
    'Goals & growth': /\b(goal|plan|habit|improve|learn|learning|progress|future|career|start|starting)\b/i,
    'Feelings': /\b(feel|feeling|felt|sad|angry|lonely|numb|cry|upset|frustrat|overwhelm|hurt)\b/i
  };

  /* Reading needs: groups the 37 articles by what someone may be looking for. */
  const READING_NEEDS = [
    { id: 'overwhelm', label: 'Feeling overwhelmed', match: /overwhelm|stress|exhaust|difficult days|change|disappoint/i, feelings: ['Overwhelmed', 'Stressed', 'Exhausted', 'Disappointed'] },
    { id: 'mind', label: 'A busy mind', match: /overthink|rumination|uncertain|fear of failure|perfection/i, feelings: ['Anxious', 'Restless', 'Unsure'] },
    { id: 'study', label: 'Study & getting started', match: /academic|exam|procrastin|left behind|habits/i, feelings: ['Unmotivated', 'Distracted', 'Stressed'] },
    { id: 'connection', label: 'People & connection', match: /lonel|relationship|friend|family|misunderstood|connection/i, feelings: ['Lonely', 'Sad'] },
    { id: 'self', label: 'Being kind to yourself', match: /self-doubt|compassion|confidence|comparison/i, feelings: ['Sad', 'Disappointed', 'Unsure'] },
    { id: 'rest', label: 'Rest & boundaries', match: /rest|boundar|saying no/i, feelings: ['Exhausted', 'Low-energy'] },
    { id: 'feelings', label: 'Understanding feelings', match: /understanding emotions|anger|numb/i, feelings: ['Angry', 'Frustrated', 'Numb'] },
    { id: 'support', label: 'Getting support', match: /help|therap|support/i, feelings: ['Lonely', 'Overwhelmed'] }
  ];

  P.catalog = { BREATH_FOR, BREATH_FEELINGS, BREATH_ALIAS, LEVELS, EMOTION_GROUPS, EMOTIONS, NEED_OF, GOALS, KINDS, BREATHS, GAMES, ROUTINES, ACTIVITIES, DAY_FACTORS, AFFIRMATIONS, AFFIRMATION_GROUPS, GROUP_FOR_FEELING, JOURNAL_PROMPTS, JOURNAL_CATEGORIES, READING_NEEDS };

  /* Reading helpers used by several pages. */
  P.reading = {
    minutes: a => Math.max(1, Math.round(P.util.words(a.body) / 200)),
    needsOf: a => READING_NEEDS.filter(n => n.match.test(a.topic)).map(n => n.id),
    categorize(text) {
      const t = String(text || '');
      const hits = Object.entries(JOURNAL_CATEGORIES).map(([k, re]) => [k, (t.match(new RegExp(re.source, 'gi')) || []).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
      return hits[0]?.[0] || 'Everyday';
    }
  };
})(window.Pause);
