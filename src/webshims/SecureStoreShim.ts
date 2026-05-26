export const getItemAsync = async (key) => { try { return localStorage.getItem(key); } catch { return null; } };
export const setItemAsync = async (key, value) => { try { localStorage.setItem(key, value); } catch {} };
export const deleteItemAsync = async (key) => { try { localStorage.removeItem(key); } catch {} };
