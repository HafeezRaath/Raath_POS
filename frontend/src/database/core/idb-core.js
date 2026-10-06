// Compatibility shim - IndexedDB fully removed
export async function idbGetAll() { return []; }
export async function idbGetById() { return null; }
export async function idbAdd() { return null; }
export async function idbPut() { return null; }
export async function idbDelete() { return true; }
export async function initIndexedDB() { return null; }
export async function ensureIndexedDB() { return true; }
