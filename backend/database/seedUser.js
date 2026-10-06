const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedUser() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'raath_pos_db',
    port: process.env.DB_PORT || 3306
  });

  const tenantId = 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3';
  const name = 'hafeez';
  const username = 'hafeez';
  const email = 'hafeezraath806@gmail.com';
  const phone = '3030300303';
  const plainPassword = '123456';
  const role = 'admin';
  const shopName = 'raath';
  const shopAddress = 'anakar kali bazar';
  const businessType = 'retail';
  const currency = 'PKR';
  const status = 'active';

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // Check if user already exists
  const [existing] = await conn.execute(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  );

  if (existing.length > 0) {
    await conn.execute(
      `UPDATE users 
       SET tenant_id = ?, name = ?, username = ?, email = ?, phone = ?, password_hash = ?, 
           role = ?, shop_name = ?, shop_address = ?, business_type = ?, currency = ?, status = ?
       WHERE id = ?`,
      [tenantId, name, username, email, phone, passwordHash, role, shopName, shopAddress, businessType, currency, status, existing[0].id]
    );
    console.log('✅ User updated successfully. User ID:', existing[0].id);
  } else {
    const [result] = await conn.execute(
      `INSERT INTO users 
       (tenant_id, name, username, email, phone, password_hash, role, shop_name, shop_address, business_type, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name, username, email, phone, passwordHash, role, shopName, shopAddress, businessType, currency, status]
    );
    console.log('✅ User created successfully. User ID:', result.insertId);
  }

  const [users] = await conn.execute(
    'SELECT id, tenant_id, name, username, email, phone, role, shop_name, status, created_at FROM users WHERE email = ?',
    [email]
  );
  console.log('\n--- Verified User in Database ---');
  console.table(users);

  await conn.end();
}

seedUser().catch(console.error);
