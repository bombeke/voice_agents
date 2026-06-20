const stores = {};

class MMKVWeb {
  constructor(options) {
    this.id = (options && options.id) || 'default';
    if (!stores[this.id]) stores[this.id] = {};
    this._store = stores[this.id];
  }
  set(key, value) {
    try { localStorage.setItem(this.id + '_' + key, JSON.stringify(value)); } catch { this._store[key] = value; }
  }
  getString(key) {
    try { const v = localStorage.getItem(this.id + '_' + key); return v !== null ? JSON.parse(v) : undefined; } catch { return this._store[key]; }
  }
  getNumber(key) {
    const v = this.getString(key); return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key) {
    const v = this.getString(key); return typeof v === 'boolean' ? v : undefined;
  }
  getBuffer(key) { return undefined; }
  delete(key) {
    try { localStorage.removeItem(this.id + '_' + key); } catch { delete this._store[key]; }
  }
  getAllKeys() {
    try { return Object.keys(localStorage).filter(k => k.startsWith(this.id + '_')).map(k => k.slice(this.id.length + 1)); } catch { return Object.keys(this._store); }
  }
  clearAll() {
    try { this.getAllKeys().forEach(k => this.delete(k)); } catch { stores[this.id] = {}; this._store = stores[this.id]; }
  }
  contains(key) { return this.getString(key) !== undefined; }
  addOnValueChangedListener(cb) { return { remove: () => {} }; }
  recrypt() {}
}

export const MMKV = MMKVWeb;
export function createMMKV(options) { return new MMKVWeb(options); }
export default MMKVWeb;
