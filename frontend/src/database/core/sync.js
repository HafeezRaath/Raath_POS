// ============================================================
//  frontend/src/database/core/sync.js - No-Op Sync Stub
//  Direct MySQL API replaces offline cloud sync
// ============================================================

export const cloudSync = {
  syncEnabled: false,
  isOnline: true,
  push: async () => true,
  pull: async () => [],
  pullDoc: async () => null,
  remove: async () => true,
  getStatus: () => ({ online: true, synced: true }),
  setShopId: () => {},
  getShopId: () => 'shop_1'
};

export async function syncToCloud() { return true; }
export async function syncDeleteToCloud() { return true; }
export default cloudSync;
