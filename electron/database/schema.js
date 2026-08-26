function createAllTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    parent_id INTEGER,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    category_id INTEGER,
    type TEXT DEFAULT 'single',
    unit TEXT DEFAULT 'pc',
    tax_type TEXT DEFAULT 'inclusive',
    is_serialized INTEGER DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'active',
    image_url TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    variant_name TEXT DEFAULT 'Default',
    purchase_price DECIMAL(15,2) DEFAULT 0,
    retail_price DECIMAL(15,2) DEFAULT 0,
    wholesale_price DECIMAL(15,2) DEFAULT 0,
    minimum_retail_price DECIMAL(15,2) DEFAULT 0,
    stock_alert_quantity DECIMAL(12,3) DEFAULT 5,
    current_stock DECIMAL(12,3) DEFAULT 0,
    image_url TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS product_serialized_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    serial_number_or_imei TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available',
    sale_id INTEGER,
    purchase_item_id INTEGER,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    vat_ntn_number TEXT,
    address TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    purchase_no TEXT UNIQUE NOT NULL,
    supplier_invoice_no TEXT,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    status TEXT DEFAULT 'received',
    total_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    shipping_charges DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'due',
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    created_by INTEGER,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    sub_total DECIMAL(15,2) DEFAULT 0,
    expiry_date DATE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    return_no TEXT UNIQUE NOT NULL,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    supplier_id INTEGER NOT NULL,
    total_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'processed',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_by INTEGER,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_return_id INTEGER NOT NULL,
    purchase_item_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    return_price DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    sub_total DECIMAL(15,2) DEFAULT 0,
    reason TEXT,
    FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    manager_name TEXT,
    phone TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS warehouse_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    UNIQUE(warehouse_id, product_variant_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    cnic TEXT,
    address TEXT,
    district TEXT,
    province TEXT,
    shop_name TEXT,
    customer_type TEXT DEFAULT 'retail',
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'active',
    notes TEXT,
    reference_name TEXT,
    reference_phone TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    customer_id INTEGER,
    customer_name TEXT,
    customer_ntn TEXT,
    subtotal DECIMAL(15,2) DEFAULT 0,
    item_discount DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    tax_type TEXT DEFAULT 'inclusive',
    tax_rate DECIMAL(5,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_amount DECIMAL(15,2) DEFAULT 0,
    change_amount DECIMAL(15,2) DEFAULT 0,
    payment_mode TEXT,
    payment_status TEXT DEFAULT 'paid',
    sale_type TEXT DEFAULT 'retail',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    fbr_status TEXT DEFAULT 'PENDING',
    fbr_reference TEXT,
    fbr_synced_at DATETIME,
    fbr_tax_rate DECIMAL(5,2) DEFAULT 0,
    fbr_tax_amount DECIMAL(15,2) DEFAULT 0,
    fbr_enabled INTEGER DEFAULT 0,
    fbr_business_type TEXT DEFAULT 'retail',
    fbr_mode INTEGER DEFAULT 0,
    dummy_fbr_reference TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS fbr_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    invoice_no TEXT NOT NULL,
    fbr_status TEXT DEFAULT 'PENDING',
    fbr_reference TEXT,
    fbr_qr_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 10,
    error_message TEXT,
    fbr_response TEXT,
    fbr_tax_rate DECIMAL(5,2) DEFAULT 0,
    fbr_tax_amount DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME,
    last_retry_at DATETIME,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_variant_id INTEGER,
    product_id INTEGER,
    serialized_item_id INTEGER,
    quantity DECIMAL(12,3) DEFAULT 0,
    price DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (serialized_item_id) REFERENCES product_serialized_items(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS general_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT NOT NULL,
    reference_id INTEGER,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT UNIQUE,
    customer_id INTEGER NOT NULL,
    product_variant_id INTEGER,
    product_name TEXT,
    product_sku TEXT,
    product_retail_price DECIMAL(15,2) DEFAULT 0,
    product_cost_price DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    down_payment DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) DEFAULT 0,
    emi_amount DECIMAL(15,2) DEFAULT 0,
    interest_rate DECIMAL(5,2) DEFAULT 0,
    total_months INTEGER DEFAULT 0,
    paid_months INTEGER DEFAULT 0,
    start_date TEXT,
    next_due_date TEXT,
    due_day INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    salesman_id INTEGER,
    shop_location TEXT,
    notes TEXT,
    agreement_signed INTEGER DEFAULT 0,
    agreement_date TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_guarantors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emi_id INTEGER NOT NULL,
    guarantor_type INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT,
    cnic TEXT NOT NULL,
    address TEXT,
    occupation TEXT,
    monthly_income DECIMAL(15,2) DEFAULT 0,
    relation_to_customer TEXT,
    passport_photo_path TEXT,
    blank_check_photo_path TEXT,
    cnic_front_photo_path TEXT,
    cnic_back_photo_path TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emi_id) REFERENCES emi_records(id) ON DELETE CASCADE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_visit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emi_id INTEGER NOT NULL,
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_type TEXT DEFAULT 'visit',
    staff_id INTEGER,
    staff_name TEXT,
    notes TEXT,
    outcome TEXT,
    next_action TEXT,
    next_action_date TEXT,
    location TEXT,
    customer_met INTEGER DEFAULT 0,
    amount_collected DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emi_id) REFERENCES emi_records(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emi_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emi_id) REFERENCES emi_records(id) ON DELETE CASCADE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emi_id INTEGER,
    amount DECIMAL(15,2),
    payment_date TEXT,
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    FOREIGN KEY (emi_id) REFERENCES emi_records(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customer_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    previous_balance DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    payment_mode TEXT,
    reference_no TEXT,
    sale_id INTEGER,
    items_json TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    type TEXT,
    amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#757575',
    description TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category_id INTEGER,
    payment_mode TEXT DEFAULT 'cash',
    date TEXT,
    description TEXT,
    reference_no TEXT,
    receipt_no TEXT,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NULL,
    invoice_no TEXT NOT NULL,
    return_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER NULL,
    return_date TEXT NOT NULL,
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_return_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity REAL DEFAULT 0,
    price REAL DEFAULT 0,
    sub_total REAL DEFAULT 0,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_return_id) REFERENCES sale_returns(id),
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NULL,
    customer_id INTEGER NULL,
    amount REAL DEFAULT 0,
    type TEXT,
    payment_mode TEXT DEFAULT 'cash',
    note TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    password_legacy TEXT,
    role TEXT DEFAULT 'cashier',
    shop_name TEXT,
    shop_address TEXT,
    business_type TEXT DEFAULT 'retail',
    currency TEXT DEFAULT 'PKR',
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT DEFAULT 'primary',
    permissions TEXT,
    pages TEXT,
    is_default INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value DECIMAL(15,2) DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    min_purchase_amount DECIMAL(15,2) DEFAULT 0,
    applicable_to TEXT DEFAULT 'all',
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    original_total REAL DEFAULT 0,
    final_total REAL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS offer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER,
    product_id INTEGER,
    variant_id INTEGER,
    product_name TEXT,
    variant_name TEXT,
    sku TEXT,
    original_price REAL,
    offer_price REAL,
    category_id INTEGER,
    FOREIGN KEY (offer_id) REFERENCES offers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(15,2) DEFAULT 0,
    estimated_time TEXT,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'technician',
    commission_rate DECIMAL(5,2) DEFAULT 0,
    base_salary DECIMAL(15,2) DEFAULT 0,
    active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    staff_id INTEGER,
    customer_id INTEGER,
    machine_name TEXT,
    device_model TEXT,
    imei TEXT,
    problem_description TEXT,
    status TEXT DEFAULT 'pending',
    parts_used TEXT,
    notes TEXT,
    total_cost DECIMAL(15,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    payment_mode TEXT DEFAULT 'pending',
    commission_amount DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS salesmen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    cnic TEXT,
    address TEXT,
    joining_date TEXT,
    target_amount DECIMAL(15,2) DEFAULT 0,
    commission_percent DECIMAL(5,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS salesman_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER NOT NULL,
    customer_id INTEGER,
    customer_name TEXT,
    location TEXT,
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Pending',
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    shipping DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    payment_term INTEGER DEFAULT 0,
    payment_term_type TEXT DEFAULT 'Days',
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_amount DECIMAL(15,2) DEFAULT 0,
    note TEXT,
    commission_amount DECIMAL(15,2) DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS salesman_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_variant_id INTEGER,
    product_id INTEGER,
    product_name TEXT,
    sku TEXT,
    quantity DECIMAL(12,3) DEFAULT 0,
    price DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES salesman_sales(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customer_sales_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    salesman_id INTEGER,
    total_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_amount DECIMAL(15,2) DEFAULT 0,
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_mode TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (sale_id) REFERENCES salesman_sales(id),
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id)
  )`);
    // ============================================================
  // ACCOUNTS & CASH BOOK MODULE
  // ============================================================

  db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash',
    account_number TEXT,
    bank_name TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS account_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    previous_balance DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) DEFAULT 0,
    reference_type TEXT,
    reference_id INTEGER,
    reference_no TEXT,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS account_daily_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) DEFAULT 0,
    total_credits DECIMAL(15,2) DEFAULT 0,
    total_debits DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, date),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);

  // Indexes for fast statements & lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_acc_tx_account ON account_transactions(account_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_acc_tx_date ON account_transactions(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_acc_tx_ref ON account_transactions(reference_type, reference_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_bal ON account_daily_balances(account_id, date)`);

  // ── Add payment_mode columns if missing (migration) ──
  try {
    db.exec(`ALTER TABLE account_transactions ADD COLUMN payment_mode TEXT DEFAULT 'cash'`);
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE general_ledger ADD COLUMN payment_mode TEXT DEFAULT 'cash'`);
  } catch (e) { /* column already exists */ }
}

module.exports = { createAllTables };