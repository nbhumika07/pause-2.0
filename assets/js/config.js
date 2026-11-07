/* Public configuration. Safe to commit: it contains NO secrets.
   aiEndpoint is the public URL of your own Pause backend (backend/worker.js),
   for example 'https://pause-ai.your-name.workers.dev'. Leave it empty until you deploy one.
   The API key lives only in the backend's environment variables, never here. */
window.PAUSE_CONFIG = {
  aiEndpoint: (location.hostname === 'localhost' && location.port === '8787') ? '/api' : '',
  /* Optional recorded soundscapes, e.g. { rain: 'assets/audio/rain.mp3' }. Leave empty to use generated sound. */
  audioAssets: {}
};
