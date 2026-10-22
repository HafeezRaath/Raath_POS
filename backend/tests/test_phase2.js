// ============================================================
//  backend/tests/test_phase2.js - Phase 2 Acceptance Test
// ============================================================

const path = require('path');
const fs = require('fs');

const CLOUD_DB_PATH = path.join(__dirname, '../data/test_cloud.sqlite3');
const LOCAL_DB_PATH = path.join(__dirname, '../data/test_local_pc.sqlite3');

if (fs.existsSync(CLOUD_DB_PATH)) try { fs.unlinkSync(CLOUD_DB_PATH); } catch (_) {}
if (fs.existsSync(LOCAL_DB_PATH)) try { fs.unlinkSync(LOCAL_DB_PATH); } catch (_) {}

process.env.LOCAL_MODE = '1';
process.env.LOCAL_DB_PATH = CLOUD_DB_PATH;

const Database = require('better-sqlite3');
const http = require('http');
const { initializeSqliteDatabase } = require('../database/initSqlite');

async function runTest() {
  console.log('=== PHASE 2 ACCEPTANCE TEST: Sync Migration, Push/Pull & Idempotency ===\n');

  // 1. Initialize Cloud DB
  const cloudDb = new Database(CLOUD_DB_PATH);
  await initializeSqliteDatabase(cloudDb);
  console.log('✔ Cloud DB initialized with all syncable tables and sync fields.');

  // 2. Initialize Local PC DB
  const localDb = new Database(LOCAL_DB_PATH);
  await initializeSqliteDatabase(localDb);
  console.log('✔ Local PC DB initialized.');

  // Seed product on both Cloud and Local with stock = 10
  const prodUuid = 'prod-uuid-test-phone-999';
  cloudDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_default', 'Samsung Galaxy A55', 'SAM-A55', 85000, 10, ?, 'synced')
  `).run(prodUuid);

  localDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_default', 'Samsung Galaxy A55', 'SAM-A55', 85000, 10, ?, 'synced')
  `).run(prodUuid);

  const localProd = localDb.prepare('SELECT id FROM products WHERE sync_uuid = ?').get(prodUuid);
  const cloudProd = cloudDb.prepare('SELECT id FROM products WHERE sync_uuid = ?').get(prodUuid);
  console.log(`✔ Baseline product created: Local ID ${localProd.id}, Cloud ID ${cloudProd.id}, Initial Stock 10.`);

  // 3. Create an Offline Sale on Local PC (Internet OFF)
  console.log('\n--- 1. Creating Sale on Local PC while Offline ---');
  const saleUuid = 'sale-uuid-offline-001';
  const itemUuid = 'item-uuid-offline-001';
  const offInvoice = 'OFF-20261021-1234';

  localDb.transaction(() => {
    // Insert Sale
    localDb.prepare(`
      INSERT INTO sales (
        tenant_id, invoice_number, invoice_no, customer_name,
        subtotal, grand_total, paid_amount, due_amount, payment_method,
        sale_date, status, sync_uuid, sync_status
      ) VALUES (
        'tenant_default', ?, ?, 'Customer Ali',
        85000, 85000, 85000, 0, 'cash',
        '2026-10-21 17:30:00', 'paid', ?, 'pending'
      )
    `).run(offInvoice, offInvoice, saleUuid);

    const localSaleId = localDb.prepare('SELECT id FROM sales WHERE sync_uuid = ?').get(saleUuid).id;

    // Insert Sale Item with IMEI
    localDb.prepare(`
      INSERT INTO sale_items (
        tenant_id, sale_id, product_id, product_name, quantity, unit_price, total,
        sync_uuid, sync_status
      ) VALUES (
        'tenant_default', ?, ?, 'Samsung Galaxy A55 (IMEI: 356789012345678)', 1, 85000, 85000,
        ?, 'pending'
      )
    `).run(localSaleId, localProd.id, itemUuid);

    // Deduct stock locally
    localDb.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(localProd.id);
  })();

  const pendingSalesCount = localDb.prepare("SELECT COUNT(*) as c FROM sales WHERE sync_status = 'pending'").get().c;
  const pendingItemsCount = localDb.prepare("SELECT COUNT(*) as c FROM sale_items WHERE sync_status = 'pending'").get().c;
  const localStockAfterSale = localDb.prepare('SELECT stock FROM products WHERE id = ?').get(localProd.id).stock;

  console.log(`✔ Offline sale saved locally:`);
  console.log(`  -> Invoice: ${offInvoice}`);
  console.log(`  -> Pending sales: ${pendingSalesCount}, Pending items: ${pendingItemsCount}`);
  console.log(`  -> Local stock deducted to: ${localStockAfterSale}`);

  if (pendingSalesCount !== 1 || localStockAfterSale !== 9) {
    throw new Error('Local offline sale state incorrect!');
  }

  // 4. Simulate Reconnect: PUSH offline sale to Cloud
  console.log('\n--- 2. Simulating Reconnection: PUSH to Cloud ---');

  // Read pending rows from Local PC
  const localSaleRow = localDb.prepare('SELECT * FROM sales WHERE sync_uuid = ?').get(saleUuid);
  const localItemRow = localDb.prepare('SELECT * FROM sale_items WHERE sync_uuid = ?').get(itemUuid);

  // Map product_id to cloud's product_id
  localItemRow.product_id = cloudProd.id;

  // Simulate Cloud Push Endpoint call
  const mockReq = {
    tenant_id: 'tenant_default',
    body: {
      batches: [
        { table: 'sales', rows: [localSaleRow] },
        { table: 'sale_items', rows: [localItemRow] }
      ]
    }
  };

  let pushResponseData = null;
  const mockRes = {
    json: (d) => { pushResponseData = d; }
  };

  // We set LOCAL_MODE to point query to Cloud DB
  process.env.LOCAL_MODE = '1';
  process.env.LOCAL_DB_PATH = CLOUD_DB_PATH;
  delete require.cache[require.resolve('../config/db')];
  delete require.cache[require.resolve('../config/sqliteClient')];
  delete require.cache[require.resolve('../sync/syncServer')];
  const cloudSyncServer = require('../sync/syncServer');

  await cloudSyncServer.push(mockReq, mockRes, (err) => { if (err) throw err; });

  console.log('✔ Cloud push processed. Response mapping:', JSON.stringify(pushResponseData.mapping));

  // Check Cloud DB state
  const cloudSale = cloudDb.prepare('SELECT * FROM sales WHERE sync_uuid = ?').get(saleUuid);
  const cloudItems = cloudDb.prepare('SELECT * FROM sale_items WHERE sync_uuid = ?').all(itemUuid);
  const cloudStockAfterPush = cloudDb.prepare('SELECT stock FROM products WHERE id = ?').get(cloudProd.id).stock;

  console.log(`  -> Cloud Sale ID: ${cloudSale.id}`);
  console.log(`  -> Official Cloud Invoice: ${cloudSale.invoice_number}`);
  console.log(`  -> Cloud Grand Total: ${cloudSale.grand_total}`);
  console.log(`  -> Cloud Items count: ${cloudItems.length} (${cloudItems[0].product_name})`);
  console.log(`  -> Cloud Stock deducted from 10 to: ${cloudStockAfterPush}`);

  if (!cloudSale.invoice_number.startsWith('INV-')) {
    throw new Error(`Expected official INV-* number on cloud, got: ${cloudSale.invoice_number}`);
  }
  if (Number(cloudStockAfterPush) !== 9) {
    throw new Error(`Expected cloud stock 9 after sale item push, got: ${cloudStockAfterPush}`);
  }

  // 5. Test IDEMPOTENCY: Push the exact same batch again
  console.log('\n--- 3. Testing IDEMPOTENCY: Pushing Same Batch Twice ---');
  let duplicatePushResponse = null;
  const mockDupRes = { json: (d) => { duplicatePushResponse = d; } };

  await cloudSyncServer.push(mockReq, mockDupRes, (err) => { if (err) throw err; });

  const totalCloudSales = cloudDb.prepare('SELECT COUNT(*) as c FROM sales WHERE sync_uuid = ?').get(saleUuid).c;
  const totalCloudItems = cloudDb.prepare('SELECT COUNT(*) as c FROM sale_items WHERE sync_uuid = ?').get(itemUuid).c;

  console.log(`✔ After 2nd push: Cloud sales count with uuid: ${totalCloudSales}, items count: ${totalCloudItems}`);
  if (totalCloudSales !== 1 || totalCloudItems !== 1) {
    throw new Error(`IDEMPOTENCY FAILED: Duplicate rows created in cloud! Sales: ${totalCloudSales}, Items: ${totalCloudItems}`);
  }
  console.log('✔ Idempotency test passed: ZERO duplicates created.');

  // 6. Local PC marks records synced with official server invoice number
  console.log('\n--- 4. Updating Local PC State Post-Push ---');
  const serverMeta = pushResponseData.mapping[saleUuid];
  localDb.prepare("UPDATE sales SET sync_status = 'synced', server_id = ?, invoice_number = ?, invoice_no = ? WHERE sync_uuid = ?")
    .run(serverMeta.id, serverMeta.invoice_number, serverMeta.invoice_number, saleUuid);
  localDb.prepare("UPDATE sale_items SET sync_status = 'synced', server_id = ? WHERE sync_uuid = ?")
    .run(pushResponseData.mapping[itemUuid].id, itemUuid);

  const localUpdatedSale = localDb.prepare('SELECT invoice_number, sync_status FROM sales WHERE sync_uuid = ?').get(saleUuid);
  console.log(`✔ Local Sale updated: Invoice: ${localUpdatedSale.invoice_number}, Status: ${localUpdatedSale.sync_status}`);
  if (localUpdatedSale.invoice_number !== serverMeta.invoice_number || localUpdatedSale.sync_status !== 'synced') {
    throw new Error('Local sale not properly updated to server invoice number or synced status!');
  }

  // 7. Test PULL: Add product on Cloud and Pull to Local PC
  console.log('\n--- 5. Testing PULL Cloud Changes to Local PC ---');
  const newCloudProdUuid = 'prod-uuid-cloud-item-777';
  cloudDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status)
    VALUES ('tenant_default', 'Wireless Earbuds Pro', 'EAR-PRO-01', 4500, 25, ?, 'synced')
  `).run(newCloudProdUuid);

  let pullResult = null;
  await cloudSyncServer.pull({
    tenant_id: 'tenant_default',
    query: { since: '1970-01-01 00:00:00' }
  }, { json: (d) => { pullResult = d; } }, (err) => { if (err) throw err; });

  const pulledProds = pullResult.data?.products || [];
  const foundPulled = pulledProds.find(p => p.sync_uuid === newCloudProdUuid);
  if (!foundPulled) {
    throw new Error('Cloud pull did not return newly created product!');
  }

  // Apply to local DB
  localDb.prepare(`
    INSERT INTO products (tenant_id, name, sku, sale_price, stock, sync_uuid, sync_status, server_id)
    VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)
  `).run(foundPulled.tenant_id, foundPulled.name, foundPulled.sku, foundPulled.sale_price, foundPulled.stock, foundPulled.sync_uuid, foundPulled.id);

  const localNewProd = localDb.prepare('SELECT * FROM products WHERE sync_uuid = ?').get(newCloudProdUuid);
  console.log(`✔ Pulled product successfully down to Local PC: ${localNewProd.name} (Stock: ${localNewProd.stock}, Status: ${localNewProd.sync_status})`);

  console.log('\n========================================');
  console.log('>>> PHASE 2 TEST PASSED SUCCESSFULLY! <<<');
  console.log('========================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ PHASE 2 TEST FAILED:', err.message, err.stack);
  process.exit(1);
});
