/* Device-only persistence. IndexedDB is preferred; localStorage is the fallback.
   Version 3 adds the `journal` and `activity` stores. Upgrading keeps every record
   already saved in the version 2 stores (moods, notes, bookmarks, reflections). */
const PauseStore = (() => {
  'use strict';
  const DB = 'pause-device-data';
  const VER = 3;
  const STORES = ['moods', 'notes', 'bookmarks', 'reflections', 'journal', 'activity'];
  let dbp;

  function db() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    if (!dbp) {
      dbp = new Promise((ok, no) => {
        let r;
        try { r = indexedDB.open(DB, VER); } catch (e) { return no(e); }
        r.onupgradeneeded = () => {
          for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
        };
        r.onsuccess = () => {
          const d = r.result;
          d.onversionchange = () => { d.close(); dbp = null; };
          ok(d);
        };
        r.onerror = () => no(r.error);
        r.onblocked = () => window.Pause?.toast?.('Pause is open in another tab. Close it to finish updating your saved data.', { ms: 6000 });
      });
      dbp.catch(() => { dbp = null; });
    }
    return dbp;
  }

  function tx(store, mode, fn) {
    return db().then(d => new Promise((ok, no) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => ok(req?.result);
      t.onerror = () => no(t.error);
      t.onabort = () => no(t.error);
    }));
  }

  /* localStorage fallback helpers (same key names as the original app) */
  const lsKey = s => 'pause-' + s;
  const lsAll = s => { try { return JSON.parse(localStorage.getItem(lsKey(s)) || '[]'); } catch { return []; } };
  const lsSave = (s, a) => { try { localStorage.setItem(lsKey(s), JSON.stringify(a)); } catch { } };

  async function all(s) {
    try { return await tx(s, 'readonly', st => st.getAll()) || []; }
    catch { return lsAll(s); }
  }
  async function get(s, id) {
    try { return await tx(s, 'readonly', st => st.get(id)); }
    catch { return lsAll(s).find(x => x.id === id); }
  }
  async function put(s, v) {
    try { await tx(s, 'readwrite', st => st.put(v)); }
    catch {
      const a = lsAll(s); const i = a.findIndex(x => x.id === v.id);
      if (i >= 0) a[i] = v; else a.unshift(v);
      lsSave(s, a);
    }
    return v;
  }
  async function del(s, id) {
    try { await tx(s, 'readwrite', st => st.delete(id)); }
    catch { lsSave(s, lsAll(s).filter(x => x.id !== id)); }
  }
  async function clear(s) {
    try { await tx(s, 'readwrite', st => st.clear()); } catch { }
    try { localStorage.removeItem(lsKey(s)); } catch { }
  }
  async function wipe() { for (const s of STORES) await clear(s); }

  /* Export everything as one JSON object the person can keep as a backup. */
  async function exportAll() {
    const out = { app: 'Pause', version: VER, exported: new Date().toISOString(), stores: {} };
    for (const s of STORES) out.stores[s] = await all(s);
    try { out.prefs = JSON.parse(localStorage.getItem('pause-prefs') || '{}'); } catch { out.prefs = {}; }
    return out;
  }
  /* Import merges by id, so nothing already on this device is deleted. */
  async function importAll(data) {
    if (!data || data.app !== 'Pause' || typeof data.stores !== 'object') throw new Error('This file does not look like a Pause backup.');
    let count = 0;
    for (const s of STORES) {
      const rows = Array.isArray(data.stores[s]) ? data.stores[s] : [];
      for (const r of rows) if (r && typeof r.id === 'string') { await put(s, r); count++; }
    }
    return count;
  }

  return { all, get, put, del, clear, wipe, exportAll, importAll, STORES };
})();

/* Activity log: lets dashboards and recommendations know what was tried.
   Records are small: what, roughly how long, and when. No content. */
window.Pause = window.Pause || {};
Pause.logActivity = async function (kind, ref, title, seconds = 0, extra = {}) {
  const rec = { ...extra, id: Pause.util.uid('act'), kind, ref, title, seconds: Math.round(seconds), created: Date.now() };
  try { await PauseStore.put('activity', rec); } catch (e) { console.warn('Could not log activity', e); }
  return rec.id;
};
