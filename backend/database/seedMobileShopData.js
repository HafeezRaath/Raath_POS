// ============================================================
//  backend/database/seedMobileShopData.js
//  Realistic Mobile Shop & Repair Center Data Seeder
//  TARGET TENANT: tenant_muwyba5i_yix2o (User: Muhammad Hafeez)
// ============================================================

const { query } = require('../config/db');

async function seedMobileShopData(targetTenantId = 'tenant_muwyba5i_yix2o') {
  console.log(`🚀 [Seed] Starting Mobile Shop Data Seeding specifically for tenant: ${targetTenantId}...`);

  try {
    // ---------------------------------------------------------
    // 0. CLEAN UP ANY ACCIDENTAL DATA FROM tenant_default
    // ---------------------------------------------------------
    console.log('🧹 [Seed] Cleaning test data from tenant_default to avoid cross-tenant leaks...');
    const testProducts = [
      'Apple iPhone 15 Pro Max (256GB - PTA Approved)',
      'Samsung Galaxy S24 Ultra (12GB/512GB - Titanium Black)',
      'Xiaomi Redmi Note 13 Pro (8GB/256GB)',
      'Infinix Note 40 Pro 4G (8GB+8GB/256GB)',
      'Vivo V30 5G (12GB/256GB - Studio Portrait)',
      'Anker PowerPort III 65W GaN Fast Charger (3-Port)',
      'Ronin R-860 20W PD Type-C Rapid Fast Charger',
      'Faster TG-300 Low Latency TWS Gaming Earbuds',
      'Baseus 20,000mAh 65W PD Digital Display Power Bank',
      'Super D 9D Edge-to-Edge Curved Tempered Glass',
      'Original Service Pack OLED Display Assembly (Samsung A54 5G)'
    ];

    for (const pName of testProducts) {
      const prods = await query('SELECT id FROM products WHERE tenant_id = "tenant_default" AND name = ?', [pName]);
      for (const p of prods) {
        await query('DELETE FROM product_serialized_items WHERE tenant_id = "tenant_default" AND product_id = ?', [p.id]);
        await query('DELETE FROM product_variants WHERE tenant_id = "tenant_default" AND product_id = ?', [p.id]);
        await query('DELETE FROM products WHERE id = ?', [p.id]);
      }
    }
    await query('DELETE FROM work_orders WHERE tenant_id = "tenant_default" AND order_number LIKE "WO-2026-%"');
    await query('DELETE FROM staff WHERE tenant_id = "tenant_default" AND name LIKE "%(%"');
    await query('DELETE FROM services WHERE tenant_id = "tenant_default" AND name LIKE "%Replacement%"');
    await query('DELETE FROM expenses WHERE tenant_id = "tenant_default" AND title LIKE "%Monthly Rent%"');
    await query('DELETE FROM customers WHERE tenant_id = "tenant_default" AND name IN ("Muhammad Bilal", "Kashif Mehmood (Corporate Dealer)", "Dr. Tariq Jamil", "Hamza Sheikh (Installment Buyer)")');
    await query('DELETE FROM suppliers WHERE tenant_id = "tenant_default" AND company_name IN ("Cell Zone Traders Hafeez Centre", "Madina Mobile Parts Hall Road", "Airlink Distribution Ltd", "Star City Telecom Karachi")');

    // ---------------------------------------------------------
    // 1. ACCOUNTS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`💳 [Seed] Seeding Financial Accounts for ${targetTenantId}...`);
    const accountsData = [
      { name: 'Cash Counter (Till)', type: 'cash', account_number: 'CASH-TILL-01', bank_name: 'Cash in Hand', opening: 75000, current: 75000 },
      { name: 'Meezan Bank Current A/C', type: 'bank', account_number: '010203040506', bank_name: 'Meezan Bank Ltd', opening: 350000, current: 350000 },
      { name: 'HBL Business Account', type: 'bank', account_number: '123456789012', bank_name: 'Habib Bank Ltd', opening: 180000, current: 180000 },
      { name: 'JazzCash Merchant (0300-1234567)', type: 'jazzcash', account_number: '03001234567', bank_name: 'JazzCash', opening: 50000, current: 50000 },
      { name: 'EasyPaisa Merchant (0345-7654321)', type: 'easypaisa', account_number: '03457654321', bank_name: 'Telenor EasyPaisa', opening: 35000, current: 35000 },
      { name: 'SadaPay Business Wallet', type: 'bank', account_number: '03029988776', bank_name: 'SadaPay', opening: 25000, current: 25000 }
    ];

    for (const acc of accountsData) {
      const exists = await query(
        'SELECT id FROM accounts WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, acc.name]
      );
      if (exists.length === 0) {
        await query(
          `INSERT INTO accounts (tenant_id, name, type, account_number, bank_name, opening_balance, current_balance, status, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
          [targetTenantId, acc.name, acc.type, acc.account_number, acc.bank_name, acc.opening, acc.current]
        );
      }
    }
    console.log('✅ Accounts seeded.');

    // ---------------------------------------------------------
    // 2. BRANDS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`🏷️ [Seed] Seeding Brands for ${targetTenantId}...`);
    const brandsData = [
      'Apple', 'Samsung', 'Xiaomi / Redmi', 'Vivo', 'Oppo',
      'Infinix', 'Tecno', 'Realme', 'Anker', 'Ronin', 'Faster', 'Baseus'
    ];
    const brandMap = {};

    for (const b of brandsData) {
      let [row] = await query(
        'SELECT id FROM brands WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, b]
      );
      if (!row) {
        const res = await query(
          'INSERT INTO brands (tenant_id, name, status, is_deleted) VALUES (?, ?, "active", 0)',
          [targetTenantId, b]
        );
        brandMap[b] = res.insertId;
      } else {
        brandMap[b] = row.id;
      }
    }
    console.log('✅ Brands seeded.');

    // ---------------------------------------------------------
    // 3. CATEGORIES FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`📁 [Seed] Seeding Product Categories for ${targetTenantId}...`);
    const categoriesData = [
      { name: 'Smartphones (Android)', slug: 'smartphones-android' },
      { name: 'iPhones & iPads', slug: 'iphones-ipads' },
      { name: 'Fast Chargers & Cables', slug: 'chargers-cables' },
      { name: 'TWS Earbuds & Headsets', slug: 'tws-audio' },
      { name: 'Screen Protectors & Glass', slug: 'screen-protectors' },
      { name: 'Back Covers & Cases', slug: 'back-covers' },
      { name: 'Power Banks & Batteries', slug: 'power-banks' },
      { name: 'Repair Spare Parts & Displays', slug: 'repair-spare-parts' }
    ];
    const categoryMap = {};

    for (const cat of categoriesData) {
      let [row] = await query(
        'SELECT id FROM categories WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, cat.name]
      );
      if (!row) {
        const res = await query(
          'INSERT INTO categories (tenant_id, name, slug, status, is_deleted) VALUES (?, ?, ?, "active", 0)',
          [targetTenantId, cat.name, cat.slug]
        );
        categoryMap[cat.name] = res.insertId;
      } else {
        categoryMap[cat.name] = row.id;
      }
    }
    console.log('✅ Categories seeded.');

    // ---------------------------------------------------------
    // 4. SUPPLIERS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`🚚 [Seed] Seeding Suppliers for ${targetTenantId}...`);
    const suppliersData = [
      {
        name: 'Hafeez Centre Mobile Wholesalers',
        company_name: 'Cell Zone Traders Hafeez Centre',
        phone: '0300-9876543',
        email: 'cellzone.lhr@gmail.com',
        address: 'Shop # 45, 2nd Floor, Hafeez Centre, Gulberg III, Lahore',
        vat_ntn: 'NTN-7849201-3',
        opening: 0,
        current: 0
      },
      {
        name: 'Hall Road Mobile Parts & Accessories',
        company_name: 'Madina Mobile Parts Hall Road',
        phone: '0321-4567890',
        email: 'madinaparts@hallroad.pk',
        address: 'Madina Electric Market, Hall Road, Lahore',
        vat_ntn: 'NTN-4920182-1',
        opening: 0,
        current: 0
      },
      {
        name: 'Airlink Communications Official Dealership',
        company_name: 'Airlink Distribution Ltd',
        phone: '0345-9988776',
        email: 'distribution@airlinktelecom.com',
        address: 'Regional Office, MM Alam Road, Lahore',
        vat_ntn: 'NTN-1122334-9',
        opening: 0,
        current: 0
      },
      {
        name: 'Karachi Star City Telecom Importers',
        company_name: 'Star City Telecom Karachi',
        phone: '0333-1122334',
        email: 'starcity.mobile@yahoo.com',
        address: 'Shop # 12, Star City Mall, Saddar, Karachi',
        vat_ntn: 'NTN-6758493-2',
        opening: 0,
        current: 0
      }
    ];

    for (const sup of suppliersData) {
      const exists = await query(
        'SELECT id FROM suppliers WHERE tenant_id = ? AND company_name = ? AND is_deleted = 0',
        [targetTenantId, sup.company_name]
      );
      if (exists.length === 0) {
        await query(
          `INSERT INTO suppliers (tenant_id, name, company_name, phone, email, address, vat_ntn_number, opening_balance, current_balance, status, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
          [targetTenantId, sup.name, sup.company_name, sup.phone, sup.email, sup.address, sup.vat_ntn, sup.opening, sup.current]
        );
      }
    }
    console.log('✅ Suppliers seeded.');

    // ---------------------------------------------------------
    // 5. CUSTOMERS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`👥 [Seed] Seeding Customers for ${targetTenantId}...`);
    const customersData = [
      {
        name: 'Walk-in Customer (General Counter)',
        phone: '0300-0000000',
        email: 'walkin@pos.local',
        address: 'Walk-in Counter',
        city: 'Local',
        cnic: '00000-0000000-0',
        credit_limit: 0,
        current_balance: 0
      },
      {
        name: 'Muhammad Bilal',
        phone: '0301-7654321',
        email: 'bilal.ahmed92@gmail.com',
        address: 'House 14, Street 3, Johar Town',
        city: 'Lahore',
        cnic: '35201-1234567-1',
        credit_limit: 50000,
        current_balance: 0
      },
      {
        name: 'Kashif Mehmood (Corporate Dealer)',
        phone: '0322-8877665',
        email: 'kashif.techcorp@outlook.com',
        address: 'Office 402, Al-Hafeez Heights',
        city: 'Lahore',
        cnic: '35202-9876543-3',
        credit_limit: 200000,
        current_balance: 15000
      },
      {
        name: 'Dr. Tariq Jamil',
        phone: '0333-5544332',
        email: 'dr.tariq.jamil@hospital.pk',
        address: 'Sector F-8/2',
        city: 'Islamabad',
        cnic: '35201-5544332-5',
        credit_limit: 100000,
        current_balance: 0
      },
      {
        name: 'Hamza Sheikh (Installment Buyer)',
        phone: '0312-9900112',
        email: 'hamza.sheikh88@gmail.com',
        address: 'Block C, Faisal Town',
        city: 'Lahore',
        cnic: '35201-6677889-7',
        credit_limit: 150000,
        current_balance: 24000
      }
    ];

    const customerMap = {};
    for (const c of customersData) {
      let [row] = await query(
        'SELECT id FROM customers WHERE tenant_id = ? AND phone = ? AND is_deleted = 0',
        [targetTenantId, c.phone]
      );
      if (!row) {
        const res = await query(
          `INSERT INTO customers (tenant_id, name, phone, email, address, city, cnic, credit_limit, opening_balance, current_balance, status, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', 0)`,
          [targetTenantId, c.name, c.phone, c.email, c.address, c.city, c.cnic, c.credit_limit, c.current_balance]
        );
        customerMap[c.name] = res.insertId;
      } else {
        customerMap[c.name] = row.id;
      }
    }
    console.log('✅ Customers seeded.');

    // ---------------------------------------------------------
    // 6. STAFF & TECHNICIANS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`👔 [Seed] Seeding Staff & Technicians for ${targetTenantId}...`);
    const staffData = [
      { name: 'Zeeshan Ahmad (Senior Technician)', phone: '0304-1122334', role: 'technician', commission_rate: 15.00 },
      { name: 'Usama Rauf (Software Specialist)', phone: '0323-2233445', role: 'technician', commission_rate: 10.00 },
      { name: 'M. Arslan (Head Sales Executive)', phone: '0315-3344556', role: 'salesman', commission_rate: 2.50 },
      { name: 'Hamza Rafiq (Counter & Cashier)', phone: '0340-4455667', role: 'cashier', commission_rate: 0.00 }
    ];

    const staffMap = {};
    for (const s of staffData) {
      let [row] = await query(
        'SELECT id FROM staff WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, s.name]
      );
      if (!row) {
        const res = await query(
          `INSERT INTO staff (tenant_id, name, phone, role, commission_rate, status, is_deleted)
           VALUES (?, ?, ?, ?, ?, 'active', 0)`,
          [targetTenantId, s.name, s.phone, s.role, s.commission_rate]
        );
        staffMap[s.name] = res.insertId;
      } else {
        staffMap[s.name] = row.id;
      }
    }
    console.log('✅ Staff seeded.');

    // ---------------------------------------------------------
    // 7. SERVICES FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`🔧 [Seed] Seeding Mobile Repair Services for ${targetTenantId}...`);
    const servicesData = [
      { name: 'OLED / LCD Screen Replacement', desc: 'Original Display Panel change with 1 month warranty', price: 2500, time: '2 Hours' },
      { name: 'Battery Replacement (High-Capacity)', desc: '100% Battery Health replacement for iPhone & Android', price: 1500, time: '1 Hour' },
      { name: 'Charging Port & Flex Ribbon Repair', desc: 'Type-C / Lightning dock flex fix & soldering', price: 1200, time: '45 Mins' },
      { name: 'Water Damage Ultrasonic Treatment', desc: 'Chemical wash, motherboard descaling and chip diagnostic', price: 3500, time: '4 Hours' },
      { name: 'Software Flashing & FRP Unlocking', desc: 'Official firmware flash, bootloop fix and data retrieval', price: 1800, time: '1.5 Hours' }
    ];

    const serviceMap = {};
    for (const s of servicesData) {
      let [row] = await query(
        'SELECT id FROM services WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, s.name]
      );
      if (!row) {
        const res = await query(
          `INSERT INTO services (tenant_id, name, description, base_price, estimated_time, status, is_deleted)
           VALUES (?, ?, ?, ?, ?, 'active', 0)`,
          [targetTenantId, s.name, s.desc, s.price, s.time]
        );
        serviceMap[s.name] = res.insertId;
      } else {
        serviceMap[s.name] = row.id;
      }
    }
    console.log('✅ Services seeded.');

    // ---------------------------------------------------------
    // 8. EXPENSES FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`💸 [Seed] Seeding Expense Categories & Expenses for ${targetTenantId}...`);
    const expCategories = [
      { name: 'Shop Monthly Rent', color: '#f44336', desc: 'Shop & Godown Rental' },
      { name: 'Electricity & Utility Bills', color: '#ff9800', desc: 'LESCO Commercial Meter & Generator Fuel' },
      { name: 'Staff Lunch, Tea & Refreshment', color: '#4caf50', desc: 'Daily Tea, Mineral Water & Staff Meal' },
      { name: 'Internet, Software & POS', color: '#2196f3', desc: 'StormFiber Fiber Optic & Systems' },
      { name: 'Shop Tools & Rework Equipment', color: '#9c27b0', desc: 'SMD stations, soldering wire, screwdrivers' }
    ];

    const expCatMap = {};
    for (const ec of expCategories) {
      let [row] = await query(
        'SELECT id FROM expense_categories WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, ec.name]
      );
      if (!row) {
        const res = await query(
          `INSERT INTO expense_categories (tenant_id, name, color, description, is_deleted)
           VALUES (?, ?, ?, ?, 0)`,
          [targetTenantId, ec.name, ec.color, ec.desc]
        );
        expCatMap[ec.name] = res.insertId;
      } else {
        expCatMap[ec.name] = row.id;
      }
    }

    const [cashAcc] = await query('SELECT id FROM accounts WHERE tenant_id = ? AND type = "cash" LIMIT 1', [targetTenantId]);
    const [bankAcc] = await query('SELECT id FROM accounts WHERE tenant_id = ? AND type = "bank" LIMIT 1', [targetTenantId]);
    const today = new Date().toISOString().split('T')[0];

    const sampleExpenses = [
      { title: 'Shop Main Floor Monthly Rent', cat: 'Shop Monthly Rent', amount: 50000, acc: bankAcc?.id || null, method: 'bank', desc: 'Advance rent paid via cheque' },
      { title: 'LESCO Commercial Electricity Bill', cat: 'Electricity & Utility Bills', amount: 16800, acc: bankAcc?.id || null, method: 'bank', desc: 'Commercial bill for display lighting & AC' },
      { title: 'Staff Tea & Refreshment (15 Days)', cat: 'Staff Lunch, Tea & Refreshment', amount: 4200, acc: cashAcc?.id || null, method: 'cash', desc: 'Paid to market tea stall' },
      { title: 'StormFiber 50Mbps Optical Fiber Connection', cat: 'Internet, Software & POS', amount: 3600, acc: bankAcc?.id || null, method: 'bank', desc: 'POS cloud syncing & CCTV monitoring' },
      { title: 'SMD Hot Air Station & Precision Screwdriver Kit', cat: 'Shop Tools & Rework Equipment', amount: 9500, acc: cashAcc?.id || null, method: 'cash', desc: 'Hardware repair lab equipment upgrade' }
    ];

    for (const exp of sampleExpenses) {
      const exists = await query(
        'SELECT id FROM expenses WHERE tenant_id = ? AND title = ? AND is_deleted = 0',
        [targetTenantId, exp.title]
      );
      if (exists.length === 0) {
        await query(
          `INSERT INTO expenses (tenant_id, category_id, category_name, account_id, amount, title, description, date, payment_method, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [targetTenantId, expCatMap[exp.cat] || null, exp.cat, exp.acc, exp.amount, exp.title, exp.desc, today, exp.method]
        );
      }
    }
    console.log('✅ Expenses seeded.');

    // ---------------------------------------------------------
    // 9. PRODUCTS, VARIANTS & IMEIs FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`📱 [Seed] Seeding Mobile Phones, Accessories & Spare Parts for ${targetTenantId}...`);

    const productsToSeed = [
      // 1. iPhone 15 Pro Max
      {
        name: 'Apple iPhone 15 Pro Max (256GB - PTA Approved)',
        brand: 'Apple',
        category: 'iPhones & iPads',
        type: 'variable',
        unit: 'pc',
        sku: 'APL-IP15PM-256',
        barcode: '195949038221',
        purchase_price: 460000,
        sale_price: 495000,
        retail_price: 495000,
        wholesale_price: 485000,
        min_price: 480000,
        stock: 4,
        min_stock: 2,
        is_serialized: 1,
        desc: 'Titanium design, A17 Pro Chip, 48MP Camera, USB-C 3, PTA Approved official',
        variants: [
          { variant_name: 'Natural Titanium (256GB)', name: 'Natural Titanium (256GB)', sku: 'IP15PM-NT-256', barcode: '195949038222', purchase_price: 460000, sale_price: 495000, stock: 2, imeis: ['354892110293841', '354892110293842'] },
          { variant_name: 'Blue Titanium (256GB)', name: 'Blue Titanium (256GB)', sku: 'IP15PM-BT-256', barcode: '195949038223', purchase_price: 460000, sale_price: 495000, stock: 2, imeis: ['354892110293843', '354892110293844'] }
        ]
      },
      // 2. Samsung Galaxy S24 Ultra
      {
        name: 'Samsung Galaxy S24 Ultra (12GB/512GB - Titanium Black)',
        brand: 'Samsung',
        category: 'Smartphones (Android)',
        type: 'single',
        unit: 'pc',
        sku: 'SAM-S24U-512',
        barcode: '880609538201',
        purchase_price: 385000,
        sale_price: 415000,
        retail_price: 415000,
        wholesale_price: 405000,
        min_price: 400000,
        stock: 3,
        min_stock: 2,
        is_serialized: 1,
        desc: 'Galaxy AI, S-Pen included, 200MP Quad Tele System, Snapdragon 8 Gen 3',
        variants: [
          { variant_name: 'Titanium Black (512GB)', name: 'Titanium Black (512GB)', sku: 'SAM-S24U-512-TB', barcode: '880609538201', purchase_price: 385000, sale_price: 415000, stock: 3, imeis: ['358921049281721', '358921049281722', '358921049281723'] }
        ]
      },
      // 3. Redmi Note 13 Pro
      {
        name: 'Xiaomi Redmi Note 13 Pro (8GB/256GB)',
        brand: 'Xiaomi / Redmi',
        category: 'Smartphones (Android)',
        type: 'single',
        unit: 'pc',
        sku: 'XIAO-RN13P-256',
        barcode: '6941812754321',
        purchase_price: 62000,
        sale_price: 69999,
        retail_price: 69999,
        wholesale_price: 67500,
        min_price: 66500,
        stock: 6,
        min_stock: 3,
        is_serialized: 1,
        desc: '200MP OIS Camera, 120Hz AMOLED, 67W Turbo Charge, 5000mAh Battery',
        variants: [
          { variant_name: 'Midnight Black (256GB)', name: 'Midnight Black (256GB)', sku: 'RN13P-BLK', barcode: '6941812754321', purchase_price: 62000, sale_price: 69999, stock: 6, imeis: ['864920049281711', '864920049281712', '864920049281713'] }
        ]
      },
      // 4. Infinix Note 40 Pro
      {
        name: 'Infinix Note 40 Pro 4G (8GB+8GB/256GB)',
        brand: 'Infinix',
        category: 'Smartphones (Android)',
        type: 'single',
        unit: 'pc',
        sku: 'INF-N40P-256',
        barcode: '4895180792345',
        purchase_price: 61500,
        sale_price: 68500,
        retail_price: 68500,
        wholesale_price: 66000,
        min_price: 65000,
        stock: 5,
        min_stock: 2,
        is_serialized: 1,
        desc: '70W All-Round FastCharge 2.0, 20W Wireless MagCharge, 3D-Curved 120Hz AMOLED',
        variants: [
          { variant_name: 'Vintage Green (256GB)', name: 'Vintage Green (256GB)', sku: 'N40P-GRN', barcode: '4895180792345', purchase_price: 61500, sale_price: 68500, stock: 5, imeis: ['869921048291011', '869921048291012'] }
        ]
      },
      // 5. Vivo V30 5G
      {
        name: 'Vivo V30 5G (12GB/256GB - Studio Portrait)',
        brand: 'Vivo',
        category: 'Smartphones (Android)',
        type: 'single',
        unit: 'pc',
        sku: 'VIVO-V30-256',
        barcode: '6935117894561',
        purchase_price: 122000,
        sale_price: 134999,
        retail_price: 134999,
        wholesale_price: 130000,
        min_price: 128000,
        stock: 4,
        min_stock: 2,
        is_serialized: 1,
        desc: 'Smart Aura Light Portrait, Snapdragon 7 Gen 3, Ultra Slim 3D Curved Screen',
        variants: [
          { variant_name: 'Peacock Green (256GB)', name: 'Peacock Green (256GB)', sku: 'V30-PG-256', barcode: '6935117894561', purchase_price: 122000, sale_price: 134999, stock: 4, imeis: ['863819058291021', '863819058291022'] }
        ]
      },
      // 6. Anker 65W GaN Fast Charger
      {
        name: 'Anker PowerPort III 65W GaN Fast Charger (3-Port)',
        brand: 'Anker',
        category: 'Fast Chargers & Cables',
        type: 'single',
        unit: 'pc',
        sku: 'ANK-65W-GAN',
        barcode: '194644029141',
        purchase_price: 5200,
        sale_price: 7200,
        retail_price: 7200,
        wholesale_price: 6600,
        min_price: 6200,
        stock: 14,
        min_stock: 5,
        is_serialized: 0,
        desc: 'GaN II Technology, 2x USB-C + 1x USB-A, Supports MacBook, Laptops & Mobile phones',
        variants: [
          { variant_name: 'Default Black', name: 'Default Black', sku: 'ANK-65W-BLK', barcode: '194644029141', purchase_price: 5200, sale_price: 7200, stock: 14 }
        ]
      },
      // 7. Ronin R-860 20W PD Charger
      {
        name: 'Ronin R-860 20W PD Type-C Rapid Fast Charger',
        brand: 'Ronin',
        category: 'Fast Chargers & Cables',
        type: 'single',
        unit: 'pc',
        sku: 'RON-R860-20W',
        barcode: '896400039218',
        purchase_price: 1450,
        sale_price: 2200,
        retail_price: 2200,
        wholesale_price: 1900,
        min_price: 1800,
        stock: 30,
        min_stock: 8,
        is_serialized: 0,
        desc: 'Universal 20W Power Delivery adapter for iPhone 11-15 & Samsung Fast Charging',
        variants: [
          { variant_name: 'White (Adapter Only)', name: 'White (Adapter Only)', sku: 'R860-WHT', barcode: '896400039218', purchase_price: 1450, sale_price: 2200, stock: 30 }
        ]
      },
      // 8. Faster TG-300 TWS Gaming Earbuds
      {
        name: 'Faster TG-300 Low Latency TWS Gaming Earbuds',
        brand: 'Faster',
        category: 'TWS Earbuds & Headsets',
        type: 'single',
        unit: 'pc',
        sku: 'FAS-TG300-TWS',
        barcode: '896400078912',
        purchase_price: 2600,
        sale_price: 3950,
        retail_price: 3950,
        wholesale_price: 3500,
        min_price: 3300,
        stock: 18,
        min_stock: 5,
        is_serialized: 0,
        desc: '45ms Ultra Low Latency, RGB Case Lights, ENC Noise Cancellation, 30H Playtime',
        variants: [
          { variant_name: 'Matte Black', name: 'Matte Black', sku: 'TG300-BLK', barcode: '896400078912', purchase_price: 2600, sale_price: 3950, stock: 18 }
        ]
      },
      // 9. Baseus 20,000mAh 65W Power Bank
      {
        name: 'Baseus 20,000mAh 65W PD Digital Display Power Bank',
        brand: 'Baseus',
        category: 'Power Banks & Batteries',
        type: 'single',
        unit: 'pc',
        sku: 'BAS-PB-20K-65W',
        barcode: '695315629101',
        purchase_price: 8800,
        sale_price: 12500,
        retail_price: 12500,
        wholesale_price: 11200,
        min_price: 10800,
        stock: 8,
        min_stock: 3,
        is_serialized: 0,
        desc: 'Blade high power battery pack for laptops, MacBooks, tablets and smartphones',
        variants: [
          { variant_name: 'Classic Black', name: 'Classic Black', sku: 'BAS-20K-BLK', barcode: '695315629101', purchase_price: 8800, sale_price: 12500, stock: 8 }
        ]
      },
      // 10. Super D 9D Curved Tempered Glass
      {
        name: 'Super D 9D Edge-to-Edge Curved Tempered Glass',
        brand: 'Apple',
        category: 'Screen Protectors & Glass',
        type: 'single',
        unit: 'pc',
        sku: 'SCR-9D-CURVED',
        barcode: '784920182736',
        purchase_price: 120,
        sale_price: 350,
        retail_price: 350,
        wholesale_price: 250,
        min_price: 250,
        stock: 95,
        min_stock: 20,
        is_serialized: 0,
        desc: 'High hardness anti-scratch 9H protective screen protector for all models',
        variants: [
          { variant_name: 'Universal iPhone / Android', name: 'Universal iPhone / Android', sku: '9D-UNIV', barcode: '784920182736', purchase_price: 120, sale_price: 350, stock: 95 }
        ]
      },
      // 11. Samsung A54 Original OLED Display Assembly
      {
        name: 'Original Service Pack OLED Display Assembly (Samsung A54 5G)',
        brand: 'Samsung',
        category: 'Repair Spare Parts & Displays',
        type: 'single',
        unit: 'pc',
        sku: 'PART-SAM-A54-OLED',
        barcode: '880609599201',
        purchase_price: 11500,
        sale_price: 15500,
        retail_price: 15500,
        wholesale_price: 14000,
        min_price: 13500,
        stock: 5,
        min_stock: 2,
        is_serialized: 0,
        desc: '120Hz Super AMOLED with frame assembly, genuine touch sensitivity',
        variants: [
          { variant_name: 'With Frame (Awesome Black)', name: 'With Frame (Awesome Black)', sku: 'A54-OLED-FRM', barcode: '880609599201', purchase_price: 11500, sale_price: 15500, stock: 5 }
        ]
      }
    ];

    for (const prod of productsToSeed) {
      const bId = brandMap[prod.brand] || null;
      const cId = categoryMap[prod.category] || null;

      let [existingProd] = await query(
        'SELECT id FROM products WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, prod.name]
      );

      let prodId;
      if (!existingProd) {
        const res = await query(
          `INSERT INTO products (
            tenant_id, name, brand_id, category_id, type, unit, sku, barcode,
            purchase_price, sale_price, retail_price, wholesale_price, min_price,
            stock, min_stock, tax_type, tax_rate, is_serialized, description, status, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inclusive', 0, ?, ?, 'active', 0)`,
          [
            targetTenantId, prod.name, bId, cId, prod.type, prod.unit, prod.sku, prod.barcode,
            prod.purchase_price, prod.sale_price, prod.retail_price, prod.wholesale_price, prod.min_price,
            prod.stock, prod.min_stock, prod.is_serialized, prod.desc
          ]
        );
        prodId = res.insertId;
      } else {
        prodId = existingProd.id;
      }

      // Seed Variants for targetTenantId
      for (const v of prod.variants) {
        let [existingVar] = await query(
          'SELECT id FROM product_variants WHERE tenant_id = ? AND product_id = ? AND (variant_name = ? OR name = ?) AND is_deleted = 0',
          [targetTenantId, prodId, v.variant_name, v.name]
        );

        let varId;
        if (!existingVar) {
          const varRes = await query(
            `INSERT INTO product_variants (
              tenant_id, product_id, variant_name, name, sku, barcode,
              purchase_price, retail_price, sale_price, wholesale_price, minimum_retail_price,
              current_stock, stock, stock_alert_quantity, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 0)`,
            [
              targetTenantId, prodId, v.variant_name, v.name, v.sku, v.barcode,
              v.purchase_price, v.sale_price, v.sale_price, v.sale_price * 0.95, v.purchase_price,
              v.stock, v.stock
            ]
          );
          varId = varRes.insertId;
        } else {
          varId = existingVar.id;
        }

        // Seed IMEI / Serial Numbers if serialized
        if (prod.is_serialized && v.imeis && v.imeis.length > 0) {
          for (const imei of v.imeis) {
            const [serExists] = await query(
              'SELECT id FROM product_serialized_items WHERE tenant_id = ? AND serial_number = ? AND is_deleted = 0',
              [targetTenantId, imei]
            );
            if (!serExists) {
              await query(
                `INSERT INTO product_serialized_items (
                  tenant_id, product_id, product_variant_id, serial_number, serial_number_or_imei, status, is_deleted
                ) VALUES (?, ?, ?, ?, ?, 'available', 0)`,
                [targetTenantId, prodId, varId, imei, imei]
              );
            }
          }
        }
      }
    }
    console.log('✅ Products, Variants & IMEIs seeded.');

    // ---------------------------------------------------------
    // 10. WORK ORDERS FOR tenant_muwyba5i_yix2o
    // ---------------------------------------------------------
    console.log(`🛠️ [Seed] Seeding Mobile Repair Work Orders for ${targetTenantId}...`);

    const [tech1] = await query('SELECT id FROM staff WHERE tenant_id = ? AND name LIKE "%Zeeshan%" LIMIT 1', [targetTenantId]);
    const [tech2] = await query('SELECT id FROM staff WHERE tenant_id = ? AND name LIKE "%Usama%" LIMIT 1', [targetTenantId]);
    const [serv1] = await query('SELECT id FROM services WHERE tenant_id = ? AND name LIKE "%Screen%" LIMIT 1', [targetTenantId]);
    const [serv2] = await query('SELECT id FROM services WHERE tenant_id = ? AND name LIKE "%Battery%" LIMIT 1', [targetTenantId]);
    const [serv3] = await query('SELECT id FROM services WHERE tenant_id = ? AND name LIKE "%Flashing%" LIMIT 1', [targetTenantId]);
    const [serv4] = await query('SELECT id FROM services WHERE tenant_id = ? AND name LIKE "%Charging%" LIMIT 1', [targetTenantId]);

    const [custBilal] = await query('SELECT id, name FROM customers WHERE tenant_id = ? AND name LIKE "%Bilal%" LIMIT 1', [targetTenantId]);
    const [custKashif] = await query('SELECT id, name FROM customers WHERE tenant_id = ? AND name LIKE "%Kashif%" LIMIT 1', [targetTenantId]);
    const [custTariq] = await query('SELECT id, name FROM customers WHERE tenant_id = ? AND name LIKE "%Tariq%" LIMIT 1', [targetTenantId]);
    const [custHamza] = await query('SELECT id, name FROM customers WHERE tenant_id = ? AND name LIKE "%Hamza Sheikh%" LIMIT 1', [targetTenantId]);

    const sampleWorkOrders = [
      {
        order_number: 'WO-2026-001',
        customer_id: custBilal?.id || 1,
        customer_name: custBilal?.name || 'Muhammad Bilal',
        service_id: serv2?.id || 1,
        staff_id: tech1?.id || 1,
        status: 'completed',
        total_amount: 5500,
        paid_amount: 5500,
        notes: 'iPhone 13 - Battery health dropped to 72%. Replaced with original 100% health battery. Tested & Delivered.'
      },
      {
        order_number: 'WO-2026-002',
        customer_id: custKashif?.id || 1,
        customer_name: custKashif?.name || 'Kashif Mehmood',
        service_id: serv1?.id || 1,
        staff_id: tech1?.id || 1,
        status: 'in_progress',
        total_amount: 17500,
        paid_amount: 10000,
        notes: 'Samsung Galaxy S22 - Glass cracked and line on OLED. Frame + Display replacement in progress.'
      },
      {
        order_number: 'WO-2026-003',
        customer_id: custTariq?.id || 1,
        customer_name: custTariq?.name || 'Dr. Tariq Jamil',
        service_id: serv4?.id || 1,
        staff_id: tech2?.id || 1,
        status: 'pending',
        total_amount: 1800,
        paid_amount: 0,
        notes: 'Redmi Note 12 - Moisture in charging port, not charging. Scheduled for ultrasonic cleanup & flex check.'
      },
      {
        order_number: 'WO-2026-004',
        customer_id: custHamza?.id || 1,
        customer_name: custHamza?.name || 'Hamza Sheikh',
        service_id: serv3?.id || 1,
        staff_id: tech2?.id || 1,
        status: 'completed',
        total_amount: 2000,
        paid_amount: 2000,
        notes: 'Infinix Hot 30 - Bootloop restart on logo. Flashed latest stock firmware. All customer data retrieved OK.'
      }
    ];

    for (const wo of sampleWorkOrders) {
      const exists = await query(
        'SELECT id FROM work_orders WHERE tenant_id = ? AND order_number = ? AND is_deleted = 0',
        [targetTenantId, wo.order_number]
      );
      if (exists.length === 0) {
        await query(
          `INSERT INTO work_orders (
            tenant_id, order_number, customer_id, customer_name, service_id, staff_id,
            status, total_amount, paid_amount, notes, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            targetTenantId, wo.order_number, wo.customer_id, wo.customer_name, wo.service_id, wo.staff_id,
            wo.status, wo.total_amount, wo.paid_amount, wo.notes
          ]
        );
      }
    }
    console.log('✅ Work orders seeded.');

    console.log(`🎉 [Seed] MOBILE SHOP DATA FOR ${targetTenantId} SUCCESSFULLY SEEDED!`);
    return true;
  } catch (err) {
    console.error('❌ [Seed] Error seeding data:', err);
    throw err;
  }
}

if (require.main === module) {
  const tenant = process.argv[2] || 'tenant_muwyba5i_yix2o';
  seedMobileShopData(tenant)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedMobileShopData };
