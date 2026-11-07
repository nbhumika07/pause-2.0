/* Welcome: the original Pause landing screen, kept as the first thing new visitors see. */
(function (P) {
  'use strict';
  P.route('welcome', view => {
    const on = P.prefs.get().reduceMotion;
    view.innerHTML = `<section class="welcome">
      <div class="welcome-inner">
        <div>
          <div class="eyebrow">A little space for you</div>
          <h1>Pause. You don't have to figure everything out right now.</h1>
          <p>A little space to breathe, play, and make sense of what you're feeling.</p>
          <p class="welcome-small">Play a gentle game, listen to a soundscape, write a little, or simply be here.</p>
          <div class="welcome-actions">
            <button class="btn-main btn-glow" data-welcome="begin">Let's take a little break <span aria-hidden="true">→</span></button>
            <button class="btn-ghost" data-welcome="explore">Explore Pause</button>
          </div>
          <p class="welcome-note">No account. Your writing stays on this device. <button class="link-btn" data-action="motion">Reduce motion: <span data-motion-state>${on ? 'On' : 'Off'}</span></button></p>
        </div>
        <div class="garden-art" aria-hidden="true"><div class="moon"></div><div class="hill"></div><div class="hill two"></div>
          ${Array.from({ length: 9 }, (_, i) => `<i class="plant" style="left:${5 + i * 11}%;height:${90 + (i % 3) * 38}px"></i>`).join('')}
          ${Array.from({ length: 22 }, (_, i) => `<i class="firefly" style="left:${8 + (i * 37) % 84}%;top:${10 + (i * 23) % 72}%"></i>`).join('')}
        </div>
      </div>
    </section>`;
    view.querySelector('[data-welcome="begin"]').onclick = () => { P.markVisited(); P.go('play/fireflies'); };
    view.querySelector('[data-welcome="explore"]').onclick = () => { P.markVisited(); P.go('today'); };
  });
})(window.Pause);
