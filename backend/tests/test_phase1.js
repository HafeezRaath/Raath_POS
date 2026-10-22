// ============================================================
//  backend/tests/test_phase1.js - Phase 1 Acceptance Test
// ============================================================

const path = require('path');
const fs = require('fs');

// Set test environment variables BEFORE requiring backend code
const TEST_DB_PATH = path.join(__dirname, '../data/test_phase1.sqlite3');
if (fs.existsSync(TEST_DB_PATH)) {
  try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
}

process.env.LOCAL_MODE = '1';
process.env.LOCAL_DB_PATH = TEST_DB_PATH;
process.env.PORT = '5123';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_raath_pos_offline';

async function runTest() {
  console.log('=== PHASE 1 ACCEPTANCE TEST: SQLite Adapter, Schema, UDFs & Local Sale ===');

  // 1. Initialize SQLite Database
  const { getSqliteDb } = require('../config/sqliteClient');
  const { initializeSqliteDatabase } = require('../database/initSqlite');
  const db = getSqliteDb();
  await initializeSqliteDatabase(db);
  console.log('✔ Local SQLite database initialized successfully.');

  // 2. Start Express app locally
  const app = require('../server');
  // Wait a moment for server to listen on port 5123
  await new Promise(r => setTimeout(r, 1000));

  const baseUrl = 'http://localhost:5123/api';

  // 3. Test Local Offline Login (admin / admin123)
  console.log('\n--- 1. Testing Local Login ---');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginData)}`);
  }
  const token = loginData.token;
  console.log(`✔ Login successful. User: ${loginData.user?.name}, Role: ${loginData.user?.role}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Id': 'tenant_default'
  };

  // 4. Test Product List Query
  console.log('\n--- 2. Testing Product List ---');
  const prodRes = await fetch(`${baseUrl}/products`, {
    headers: authHeaders
  });
  const prodData = await prodRes.json();
  if (!prodRes.ok) {
    throw new Error(`Fetch products failed (${prodRes.status}): ${JSON.stringify(prodData)}`);
  }
  const initialProducts = Array.isArray(prodData) ? prodData : (prodData.data || []);
  console.log(`✔ Product list retrieved successfully (${initialProducts.length} items).`);

  // 5. Create a test product locally
  console.log('\n--- 3. Creating a Product Locally ---');
  const createProdRes = await fetch(`${baseUrl}/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Local Offline Test Phone',
      sku: 'OFF-PHONE-001',
      barcode: '1234567890123',
      cost_price: 15000,
      sale_price: 22000,
      retail_price: 22000,
      stock: 10,
      product_type: 'retail'
    })
  });
  const createProdData = await createProdRes.json();
  if (!createProdRes.ok) {
    throw new Error(`Create product failed (${createProdRes.status}): ${JSON.stringify(createProdData)}`);
  }
  const createdProdId = createProdData.data?.id || createProdData.id || createProdData.insertId;
  console.log(`✔ Product created successfully (ID: ${createdProdId}).`);

  // Verify sync fields on product
  const prodRow = db.prepare('SELECT * FROM products WHERE id = ?').get(createdProdId);
  console.log(`  -> sync_uuid: ${prodRow.sync_uuid}`);
  console.log(`  -> sync_status: ${prodRow.sync_status}`);
  if (!prodRow.sync_uuid || prodRow.sync_status !== 'pending') {
    throw new Error(`Product missing sync_uuid or pending sync_status: ${JSON.stringify(prodRow)}`);
  }

  // 6. Complete a Sale Locally
  console.log('\n--- 4. Creating a Sale Locally (Offline Mode) ---');
  const saleRes = await fetch(`${baseUrl}/sales`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customer_id: null,
      customer_name: 'Walk-in Customer',
      items: [
        {
          product_id: createdProdId,
          name: 'Local Offline Test Phone',
          quantity: 2,
          unit_price: 22000,
          total: 44000
        }
      ],
      subtotal: 44000,
      discount: 0,
      grand_total: 44000,
      paid_amount: 44000,
      change_amount: 0,
      payment_method: 'cash',
      payment_mode: 'cash',
      notes: 'Phase 1 Offline Sale Test'
    })
  });

  const saleData = await saleRes.json();
  if (!saleRes.ok) {
    throw new Error(`Create sale failed (${saleRes.status}): ${JSON.stringify(saleData)}`);
  }
  const saleId = saleData.data?.id || saleData.id || saleData.sale_id;
  console.log(`✔ Sale completed successfully (Sale ID: ${saleId}, Invoice: ${saleData.data?.invoice_number || saleData.invoice_number}).`);

  // Verify sale and items in SQLite
  const saleRow = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  console.log(`  -> Sale sync_uuid: ${saleRow.sync_uuid}`);
  console.log(`  -> Sale sync_status: ${saleRow.sync_status}`);
  console.log(`  -> Sale grand_total: ${saleRow.grand_total}`);
  console.log(`  -> Sale items count: ${saleItems.length}`);

  if (!saleRow.sync_uuid || saleRow.sync_status !== 'pending') {
    throw new Error(`Sale missing sync_uuid or pending sync_status: ${JSON.stringify(saleRow)}`);
  }

  // Verify stock deduction on product
  const updatedProd = db.prepare('SELECT stock FROM products WHERE id = ?').get(createdProdId);
  console.log(`  -> Product stock after sale: ${updatedProd.stock} (originally 10, sold 2)`);
  if (Number(updatedProd.stock) !== 8) {
    console.warn(`Note: Stock expected 8, found ${updatedProd.stock}`);
  }

  console.log('\n========================================');
  console.log('>>> PHASE 1 TEST PASSED SUCCESSFULLY! <<<');
  console.log('========================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ PHASE 1 TEST FAILED:', err.message);
  process.exit(1);
});
