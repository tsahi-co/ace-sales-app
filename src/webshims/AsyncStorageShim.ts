const AsyncStorage = {
  getItem: async (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: async (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} },
  removeItem: async (key: string) => { try { localStorage.removeItem(key); } catch {} },
  multiGet: async (keys: string[]) => keys.map(k => [k, localStorage.getItem(k)]),
  multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => localStorage.setItem(k, v)); },
  multiRemove: async (keys: string[]) => { keys.forEach(k => localStorage.removeItem(k)); },
  getAllKeys: async () => Object.keys(localStorage),
  clear: async () => localStorage.clear(),
};
export default AsyncStorage;
