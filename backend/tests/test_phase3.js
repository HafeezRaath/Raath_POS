// ============================================================
//  backend/tests/test_phase3.js - Phase 3 Acceptance Test
// ============================================================

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Paths for persistence test
const PERSISTENT_LOCAL_DB = path.join(__dirname, '../data/test_phase3_local.sqlite3');
const CLOUD_DB_PATH = path.join(__dirname, '../data/test_phase3_cloud.sqlite3');

if (fs.existsSync(PERSISTENT_LOCAL_DB)) try { fs.unlinkSync(PERSISTENT_LOCAL_DB); } catch (_) {}
if (fs.existsSync(CLOUD_DB_PATH)) try { fs.unlinkSync(CLOUD_DB_PATH); } catch (_) {}

const Database = require('better-sqlite3');
const { initializeSqliteDatabase } = require('../database/initSqlite');

async function runTest() {
  console.log('=== PHASE 3 ACCEPTANCE TEST: Offline Login, Persistence, Auto-Push & Renumbering ===\n');

  // 1. Setup Cloud Server on port 5199
  console.log('--- Step 1: Setting up Mock Cloud Backend ---');
  const cloudDb = new Database(CLOUD_DB_PATH);
  await initializeSqliteDatabase(cloudDb);

  // Cloud product
  cloudDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_default', 'Laptop Dell XPS 15', 'DELL-XPS', 250000, 5, 'prod-dell-xps-001', 'synced')
  `).run();

  const cloudApp = express();
  cloudApp.use(express.json());

  // Cloud health
  let cloudOnline = false; // Initially OFFLINE
  cloudApp.get('/api/health', (req, res) => {
    if (!cloudOnline) return res.status(503).json({ error: 'Cloud offline' });
    res.json({ status: 'online' });
  });

  // Cloud push
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

          mapping[row.sync_uuid] = {
            id: Number(ins.lastInsertRowid),
            ...(sInv ? { invoice_number: sInv } : {})
          };
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
  await new Promise(r => cloudServer.listen(5199, r));
  console.log('✔ Cloud server listening on port 5199 (currently offline simulated).');

  // 2. Setup Local PC Database with initial seed
  console.log('\n--- Step 2: Boot Local App in Offline Mode ---');
  process.env.LOCAL_MODE = '1';
  process.env.LOCAL_DB_PATH = PERSISTENT_LOCAL_DB;
  process.env.CLOUD_API_URL = 'http://localhost:5199/api';

  delete require.cache[require.resolve('../config/sqliteClient')];
  delete require.cache[require.resolve('../config/db')];

  const { getSqliteDb } = require('../config/sqliteClient');
  let localDb = getSqliteDb();
  await initializeSqliteDatabase(localDb);

  // Seed identical product locally
  localDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_default', 'Laptop Dell XPS 15', 'DELL-XPS', 250000, 5, 'prod-dell-xps-001', 'synced')
  `).run();

  const localProd = localDb.prepare('SELECT id FROM products WHERE sync_uuid = ?').get('prod-dell-xps-001');

  // 3. Test Offline Login with cached credentials
  console.log('\n--- Step 3: Test Offline Login ---');
  const authController = require('../controllers/authController');
  let loginResult = null;
  await authController.login({
    body: { identifier: 'admin', password: 'admin123' }
  }, {
    json: (d) => { loginResult = d; },
    status: () => ({ json: (d) => { loginResult = d; } })
  }, (err) => { if (err) throw err; });

  if (!loginResult || !loginResult.token) {
    throw new Error('Offline login failed!');
  }
  console.log(`✔ Offline login successful for ${loginResult.user?.name} without internet.`);

  // 4. Create 2 Offline Sales with OFF- numbers
  console.log('\n--- Step 4: Create 2 Offline Sales ---');
  const saleUuid1 = 'phase3-sale-uuid-001';
  const saleUuid2 = 'phase3-sale-uuid-002';

  localDb.prepare(`
    INSERT INTO sales (tenant_id, invoice_number, invoice_no, customer_name, grand_total, paid_amount, payment_method, sync_uuid, sync_status)
    VALUES ('tenant_default', 'OFF-20261021-0001', 'OFF-20261021-0001', 'Walk-in 1', 250000, 250000, 'cash', ?, 'pending')
  `).run(saleUuid1);

  localDb.prepare(`
    INSERT INTO sales (tenant_id, invoice_number, invoice_no, customer_name, grand_total, paid_amount, payment_method, sync_uuid, sync_status)
    VALUES ('tenant_default', 'OFF-20261021-0002', 'OFF-20261021-0002', 'Walk-in 2', 250000, 250000, 'cash', ?, 'pending')
  `).run(saleUuid2);

  const pendingBeforeKill = localDb.prepare("SELECT COUNT(*) as c FROM sales WHERE sync_status = 'pending'").get().c;
  console.log(`✔ 2 Sales saved to local disk with OFF- prefix. Pending count: ${pendingBeforeKill}`);

  // 5. KILL THE APP (simulate crash / power outage)
  console.log('\n--- Step 5: Killing Local App Process (Simulated Power Outage) ---');
  localDb.close();
  delete require.cache[require.resolve('../config/sqliteClient')];
  delete require.cache[require.resolve('../config/db')];
  delete require.cache[require.resolve('../sync/syncClient')];
  console.log('✔ App killed. Local DB connection closed.');

  // 6. RESTART APP STILL OFFLINE
  console.log('\n--- Step 6: Restarting App Still Offline ---');
  const newSqliteClient = require('../config/sqliteClient');
  localDb = newSqliteClient.getSqliteDb();

  // Verify records survived restart intact on disk
  const salesOnDisk = localDb.prepare("SELECT id, invoice_number, sync_status FROM sales WHERE sync_uuid IN (?, ?)").all(saleUuid1, saleUuid2);
  console.log(`✔ App restarted. Verified sales on disk:`, salesOnDisk);
  if (salesOnDisk.length !== 2) {
    throw new Error(`Expected 2 sales on disk after restart, found ${salesOnDisk.length}`);
  }
  if (!salesOnDisk[0].invoice_number.startsWith('OFF-') || !salesOnDisk[1].invoice_number.startsWith('OFF-')) {
    throw new Error('Invoice numbers on disk lost OFF- prefix!');
  }
  if (salesOnDisk[0].sync_status !== 'pending' || salesOnDisk[1].sync_status !== 'pending') {
    throw new Error('Sales lost pending status on disk!');
  }

  // 7. RECONNECT: Turn cloud server ONLINE and trigger Sync Client
  console.log('\n--- Step 7: Internet Restored -> Auto Push & Renumbering ---');
  cloudOnline = true; // Connection restored!
  console.log('✔ Internet connection restored (Cloud online).');

  const syncClient = require('../sync/syncClient');
  await syncClient.performSyncCycle();

  // 8. Verify Auto-Push & Invoice Renumbering
  console.log('\n--- Step 8: Verify Auto-Push & Renumbering Results ---');
  const finalSales = localDb.prepare("SELECT id, invoice_number, invoice_no, sync_status, server_id FROM sales WHERE sync_uuid IN (?, ?)").all(saleUuid1, saleUuid2);
  console.log('Local sales after auto-sync:', finalSales);

  for (const s of finalSales) {
    if (s.sync_status !== 'synced') {
      throw new Error(`Sale ${s.id} not marked synced! Found: ${s.sync_status}`);
    }
    if (!s.invoice_number.startsWith('INV-')) {
      throw new Error(`Sale ${s.id} was not renumbered with official INV- prefix! Found: ${s.invoice_number}`);
    }
    if (!s.server_id) {
      throw new Error(`Sale ${s.id} missing server_id mapping!`);
    }
  }

  // Verify in Cloud DB
  const cloudSales = cloudDb.prepare("SELECT id, invoice_number, grand_total FROM sales WHERE sync_uuid IN (?, ?)").all(saleUuid1, saleUuid2);
  console.log('Cloud sales received:', cloudSales);
  if (cloudSales.length !== 2) {
    throw new Error(`Cloud DB only has ${cloudSales.length} sales, expected 2!`);
  }

  const remainingPending = syncClient.getSyncStatus().pendingCount;
  console.log(`✔ Remaining pending records count: ${remainingPending}`);
  if (remainingPending !== 0) {
    throw new Error(`Expected 0 pending records after sync, found ${remainingPending}`);
  }

  cloudServer.close();
  console.log('\n========================================');
  console.log('>>> PHASE 3 TEST PASSED SUCCESSFULLY! <<<');
  console.log('========================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ PHASE 3 TEST FAILED:', err.message, err.stack);
  process.exit(1);
});
