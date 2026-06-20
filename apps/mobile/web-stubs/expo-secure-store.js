const store = {};
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS = 'ALWAYS';
export const ALWAYS_THIS_DEVICE_ONLY = 'ALWAYS_THIS_DEVICE_ONLY';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export async function getItemAsync(key) {
  try { return localStorage.getItem('secure_' + key) || null; } catch { return store[key] || null; }
}
export async function setItemAsync(key, value) {
  try { localStorage.setItem('secure_' + key, value); } catch { store[key] = value; }
}
export async function deleteItemAsync(key) {
  try { localStorage.removeItem('secure_' + key); } catch { delete store[key]; }
}
export function getItem(key) {
  try { return localStorage.getItem('secure_' + key) || null; } catch { return store[key] || null; }
}
export function setItem(key, value) {
  try { localStorage.setItem('secure_' + key, value); } catch { store[key] = value; }
}
export function deleteItem(key) {
  try { localStorage.removeItem('secure_' + key); } catch { delete store[key]; }
}
export default { getItemAsync, setItemAsync, deleteItemAsync, getItem, setItem, deleteItem, AFTER_FIRST_UNLOCK, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, ALWAYS, ALWAYS_THIS_DEVICE_ONLY, WHEN_PASSCODE_SET_THIS_DEVICE_ONLY, WHEN_UNLOCKED, WHEN_UNLOCKED_THIS_DEVICE_ONLY };
