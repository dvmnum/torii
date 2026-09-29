// Хранилище: chrome.storage.local в расширении, localStorage — при открытии файла напрямую (для разработки)
const Store = (() => {
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  async function get(key, fallback) {
    try {
      if (hasChrome) {
        const res = await chrome.storage.local.get(key);
        return res[key] ?? fallback;
      }
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[store] get failed', key, e);
      return fallback;
    }
  }

  async function set(key, value) {
    try {
      if (hasChrome) return await chrome.storage.local.set({ [key]: value });
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[store] set failed', key, e);
    }
  }

  async function remove(key) {
    try {
      if (hasChrome) return await chrome.storage.local.remove(key);
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  return { get, set, remove, hasChrome };
})();
