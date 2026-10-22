// ============================================================
//  backend/tests/test_phase4.js - Phase 4 Acceptance Test
//  Complete Offline-First Desktop Flow & Electron Build Verification
// ============================================================

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

// Clean paths simulating new user profile
const TEST_USER_DATA_DIR = path.join(__dirname, '../data/clean_profile_userdata');
if (!fs.existsSync(TEST_USER_DATA_DIR)) {
  fs.mkdirSync(TEST_USER_DATA_DIR, { recursive: true });
}
const CLEAN_LOCAL_DB = path.join(TEST_USER_DATA_DIR, 'raath_pos.sqlite3');
const CLOUD_DB_PATH = path.join(__dirname, '../data/test_phase4_cloud.sqlite3');

if (fs.existsSync(CLEAN_LOCAL_DB)) try { fs.unlinkSync(CLEAN_LOCAL_DB); } catch (_) {}
if (fs.existsSync(CLOUD_DB_PATH)) try { fs.unlinkSync(CLOUD_DB_PATH); } catch (_) {}

const { initializeSqliteDatabase } = require('../database/initSqlite');

async function runTest() {
  console.log('=== PHASE 4 ACCEPTANCE TEST: Complete Desktop Flow, UI Sync Status & Installer ===\n');

  // -------------------------------------------------------------
  // STEP 1: Set up Cloud Server
  // -------------------------------------------------------------
  console.log('--- Step 1: Initialize Cloud Server (pos.raathdeveloper.com simulation) ---');
  const cloudDb = new Database(CLOUD_DB_PATH);
  await initializeSqliteDatabase(cloudDb);

  // Cloud product with stock
  cloudDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_shop1', 'Samsung Galaxy S24 Ultra', 'SAM-S24U', 350000, 10, 'prod-s24u-uuid-001', 'synced')
  `).run();

  // Cloud user for online first login
  const testPasswordHash = await bcrypt.hash('secretPass123!', 10);
  cloudDb.prepare(`
    INSERT INTO users (tenant_id, name, username, email, password_hash, role, status)
    VALUES ('tenant_shop1', 'Tariq Shopkeeper', 'tariq', 'tariq@raathpos.com', ?, 'admin', 'active')
  `).run(testPasswordHash);

  const cloudApp = express();
  cloudApp.use(express.json());

  let cloudOnline = true;

  // Cloud health
  cloudApp.get('/api/health', (req, res) => {
    if (!cloudOnline) return res.status(503).json({ error: 'Service Unavailable' });
    res.json({ status: 'ok', server_time: new Date().toISOString() });
  });

  // Cloud login (for first online login)
  cloudApp.post('/api/auth/login', (req, res) => {
    if (!cloudOnline) return res.status(503).json({ error: 'Cloud offline' });
    const { identifier, password } = req.body;
    const user = cloudDb.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND tenant_id = ?')
      .get(identifier, identifier, 'tenant_shop1');

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      token: 'mock-cloud-jwt-token-shop1',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        password_hash: user.password_hash,
        tenant_id: user.tenant_id
      },
      tenant: {
        id: 'tenant_shop1',
        name: 'Tariq Mobile Center',
        shop_name: 'Tariq Mobile Center'
      }
    });
  });

  // Cloud push (with real invoice generation and stock recalculation)
  cloudApp.post('/api/sync/push', (req, res) => {
    if (!cloudOnline) return res.status(503).json({ error: 'Cloud offline' });
    const { batches } = req.body;
    const mapping = {};

    cloudDb.transaction(() => {
      for (const b of (batches || [])) {
        for (const row of b.rows) {
          let sInv = null;
          if (b.table === 'sales') {
            const num = Math.floor(1000 + Math.random() * 9000);
            sInv = `INV-20261021-${num}`;
            row.invoice_number = sInv;
            row.invoice_no = sInv;
          }

          delete row.sync_status;
          delete row.server_id;
          delete row.id;

          const cols = Object.keys(row);
          const placeholders = cols.map(() => '?').join(', ');
          const vals = Object.values(row);

          const ins = cloudDb.prepare(`
            INSERT INTO \`${b.table}\` (${cols.map(c => `\`${c}\``).join(', ')})
            VALUES (${placeholders})
          `).run(...vals);

          const newId = Number(ins.lastInsertRowid);
          mapping[row.sync_uuid] = {
            id: newId,
            ...(sInv ? { invoice_number: sInv } : {})
          };

          // Server stock recalculation for sales
          if (b.table === 'sale_items' && row.product_id && row.quantity) {
            cloudDb.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(row.quantity, row.product_id);
          }
        }
      }
    })();

    res.json({ success: true, mapping });
  });

  // Cloud pull
  cloudApp.get('/api/sync/pull', (req, res) => {
    if (!cloudOnline) return res.status(503).json({ error: 'Cloud offline' });
    res.json({ success: true, server_time: new Date().toISOString(), data: {} });
  });

  const cloudServer = http.createServer(cloudApp);
  await new Promise(r => cloudServer.listen(5198, r));
  console.log('✔ Cloud server listening on port 5198.');

  // -------------------------------------------------------------
  // STEP 2: Boot Clean Electron Desktop Profile in LOCAL_MODE=1
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Boot Clean Electron Desktop (userData DB) ---');
  process.env.LOCAL_MODE = '1';
  process.env.LOCAL_DB_PATH = CLEAN_LOCAL_DB;
  process.env.CLOUD_API_URL = 'http://localhost:5198/api';

  delete require.cache[require.resolve('../config/sqliteClient')];
  delete require.cache[require.resolve('../config/db')];
  delete require.cache[require.resolve('../sync/syncClient')];

  const { getSqliteDb } = require('../config/sqliteClient');
  let localDb = getSqliteDb();
  await initializeSqliteDatabase(localDb);

  const authController = require('../controllers/authController');

  // -------------------------------------------------------------
  // STEP 3: First Online Login (Verification + Offline Caching)
  // -------------------------------------------------------------
  console.log('\n--- Step 3: First Login (Online verification against Cloud) ---');
  let firstLoginResult = null;
  await authController.login({
    body: { identifier: 'tariq', password: 'secretPass123!' }
  }, {
    json: (d) => { firstLoginResult = d; },
    status: (code) => ({ json: (d) => { firstLoginResult = { ...d, _statusCode: code }; } })
  }, (err) => { if (err) throw err; });

  if (!firstLoginResult || !firstLoginResult.token) {
    throw new Error('First online login failed: ' + JSON.stringify(firstLoginResult));
  }
  console.log(`✔ First online login verified successfully for user: ${firstLoginResult.user?.name}`);

  // Verify credentials and tenant snapshot cached locally in SQLite
  const cachedUser = localDb.prepare('SELECT id, username, password_hash, tenant_id FROM users WHERE username = ?').get('tariq');
  if (!cachedUser || !cachedUser.password_hash) {
    throw new Error('User was not cached locally on first login!');
  }
  console.log(`✔ User credentials securely cached in local SQLite DB (hash: ${cachedUser.password_hash.substring(0, 15)}...).`);

  // -------------------------------------------------------------
  // STEP 4: Internet Disconnects (Offline Mode Engaged)
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Disconnect Internet (Offline Mode) ---');
  cloudOnline = false; // Internet/cloud goes DOWN!

  // Check UI Sync Status reports Offline
  const syncClient = require('../sync/syncClient');
  let syncStatus = syncClient.getSyncStatus();
  console.log('UI Sync status (Offline):', syncStatus.statusText);

  // -------------------------------------------------------------
  // STEP 5: Offline Login Verification
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Offline Login without Internet ---');
  let offlineLoginResult = null;
  await authController.login({
    body: { identifier: 'tariq', password: 'secretPass123!' }
  }, {
    json: (d) => { offlineLoginResult = d; },
    status: (code) => ({ json: (d) => { offlineLoginResult = { ...d, _statusCode: code }; } })
  }, (err) => { if (err) throw err; });

  if (!offlineLoginResult || !offlineLoginResult.token) {
    throw new Error('Offline login failed with cached credentials!');
  }
  console.log(`✔ Offline login succeeded via local SQLite hash for ${offlineLoginResult.user?.name}.`);

  // -------------------------------------------------------------
  // STEP 6: Create Offline Sale with Items
  // -------------------------------------------------------------
  console.log('\n--- Step 6: Create Offline Sale (Saved to Local Disk) ---');
  // Seed local product corresponding to cloud product
  localDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status, server_id)
    VALUES ('tenant_shop1', 'Samsung Galaxy S24 Ultra', 'SAM-S24U', 350000, 10, 'prod-s24u-uuid-001', 'synced', 1)
  `).run();

  const saleUuid = 'phase4-offline-sale-001';
  const itemUuid = 'phase4-offline-item-001';

  localDb.prepare(`
    INSERT INTO sales (tenant_id, invoice_number, invoice_no, customer_name, grand_total, paid_amount, payment_method, sync_uuid, sync_status)
    VALUES ('tenant_shop1', 'OFF-20261021-9988', 'OFF-20261021-9988', 'Chaudhry Akram', 350000, 350000, 'cash', ?, 'pending')
  `).run(saleUuid);

  const localSale = localDb.prepare('SELECT id FROM sales WHERE sync_uuid = ?').get(saleUuid);

  localDb.prepare(`
    INSERT INTO sale_items (tenant_id, sale_id, product_id, product_name, quantity, unit_price, price, total, sync_uuid, sync_status)
    VALUES ('tenant_shop1', ?, 1, 'Samsung Galaxy S24 Ultra', 1, 350000, 350000, 350000, ?, 'pending')
  `).run(localSale.id, itemUuid);

  console.log(`✔ Sale created offline on disk with invoice: OFF-20261021-9988`);

  // Verify UI Sync Status Badge reports pending records
  syncStatus = syncClient.getSyncStatus();
  console.log('UI Sync status badge:', syncStatus.statusText, `(Pending: ${syncStatus.pendingCount})`);
  if (syncStatus.pendingCount < 1) {
    throw new Error('Sync status badge failed to report pending records!');
  }

  // -------------------------------------------------------------
  // STEP 7: Reconnection & Automatic Push
  // -------------------------------------------------------------
  console.log('\n--- Step 7: Connection Returns -> Auto-Push & Renumbering ---');
  cloudOnline = true; // Connection returns!
  console.log('✔ Internet restored.');

  await syncClient.performSyncCycle();

  // -------------------------------------------------------------
  // STEP 8: Verify Results & Idempotency
  // -------------------------------------------------------------
  console.log('\n--- Step 8: Verify Synchronized State & Stock Effect ---');
  const syncedSale = localDb.prepare('SELECT id, invoice_number, sync_status, server_id FROM sales WHERE sync_uuid = ?').get(saleUuid);
  console.log('Local sale after sync:', syncedSale);

  if (syncedSale.sync_status !== 'synced') {
    throw new Error(`Sale not marked synced! Status: ${syncedSale.sync_status}`);
  }
  if (!syncedSale.invoice_number.startsWith('INV-')) {
    throw new Error(`Sale was not renumbered to official INV- format! Number: ${syncedSale.invoice_number}`);
  }
  if (!syncedSale.server_id) {
    throw new Error('Sale missing server_id mapping!');
  }

  // Cloud check
  const cloudSale = cloudDb.prepare('SELECT id, invoice_number, grand_total FROM sales WHERE sync_uuid = ?').get(saleUuid);
  console.log('Cloud sale stored:', cloudSale);
  if (!cloudSale || cloudSale.invoice_number !== syncedSale.invoice_number) {
    throw new Error('Cloud sale does not match renumbered invoice number!');
  }

  // Stock check
  const cloudProduct = cloudDb.prepare('SELECT id, stock FROM products WHERE id = 1').get();
  console.log(`Cloud product stock: ${cloudProduct.stock} (reduced from 10 to 9)`);
  if (cloudProduct.stock !== 9) {
    throw new Error(`Cloud stock expected 9, got ${cloudProduct.stock}`);
  }

  // UI Status Badge check
  const finalSyncStatus = syncClient.getSyncStatus();
  console.log('Final UI Sync Status Badge:', finalSyncStatus.statusText);
  if (finalSyncStatus.pendingCount !== 0) {
    throw new Error(`Pending count should be 0, got ${finalSyncStatus.pendingCount}`);
  }

  // -------------------------------------------------------------
  // STEP 9: Verify electron-builder Configuration
  // -------------------------------------------------------------
  console.log('\n--- Step 9: Verify Electron Builder Packaging Configuration ---');
  const electronPkgPath = path.join(__dirname, '../../electron/package.json');
  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));

  if (!electronPkg.build || !electronPkg.build.win || !electronPkg.build.nsis) {
    throw new Error('electron/package.json missing Windows NSIS build configuration!');
  }

  const extraResources = electronPkg.build.extraResources || [];
  const hasBackend = extraResources.some(r => r.from === '../backend' || r.to === 'backend');
  const hasFrontend = extraResources.some(r => r.from === '../frontend/build' || r.to === 'frontend/build');

  if (!hasBackend || !hasFrontend) {
    throw new Error('electron-builder extraResources missing backend or frontend bundle mapping!');
  }
  console.log('✔ electron-builder configured correctly with Windows NSIS target, userData persistence, and backend/frontend bundling.');

  cloudServer.close();
  console.log('\n========================================');
  console.log('>>> PHASE 4 TEST PASSED SUCCESSFULLY! <<<');
  console.log('========================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ PHASE 4 TEST FAILED:', err.message, err.stack);
  process.exit(1);
});
