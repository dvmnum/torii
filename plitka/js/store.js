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

  // несколько ключей одним запросом (при старте вкладки — вместо цепочки get по очереди) → { key: value ?? fallback }
  async function getMany(defaults) {
    const keys = Object.keys(defaults);
    try {
      if (hasChrome) {
        const res = await chrome.storage.local.get(keys);
        return Object.fromEntries(keys.map(k => [k, res[k] ?? defaults[k]]));
      }
      return Object.fromEntries(keys.map(k => { const raw = localStorage.getItem(k); return [k, raw ? JSON.parse(raw) : defaults[k]]; }));
    } catch (e) {
      console.warn('[store] getMany failed', keys, e);
      return { ...defaults };
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

  return { get, getMany, set, remove, hasChrome };
})();
