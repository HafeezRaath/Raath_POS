-- ============================================================
--  RAATH POS - Master MySQL Database Schema
--  Compatible with Hostinger MySQL & Local Development
--  Contains all tables from Electron & Server Schemas
-- ============================================================

CREATE DATABASE IF NOT EXISTS `raath_pos_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `raath_pos_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. System Settings
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  `value` LONGTEXT,
  `description` VARCHAR(255),
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Audit Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `action` VARCHAR(100) NOT NULL,
  `table_name` VARCHAR(100),
  `record_id` INT,
  `old_values` LONGTEXT,
  `new_values` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` VARCHAR(50) PRIMARY KEY,
  `label` VARCHAR(100) NOT NULL,
  `color` VARCHAR(50) DEFAULT 'primary',
  `permissions` LONGTEXT,
  `pages` LONGTEXT,
  `is_default` TINYINT(1) DEFAULT 0,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `username` VARCHAR(100) UNIQUE,
  `email` VARCHAR(150) UNIQUE NOT NULL,
  `phone` VARCHAR(50),
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'cashier',
  `shop_name` VARCHAR(150) DEFAULT 'RAATH POS Store',
  `shop_address` TEXT,
  `business_type` VARCHAR(50) DEFAULT 'retail',
  `currency` VARCHAR(20) DEFAULT 'PKR',
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  INDEX idx_users_email (`email`),
  INDEX idx_users_role (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Brands
CREATE TABLE IF NOT EXISTS `brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) UNIQUE,
  `parent_id` INT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cat_parent (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Expense Categories
CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `color` VARCHAR(50) DEFAULT '#757575',
  `description` TEXT,
  `is_deleted` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Accounts (Cash & Bank)
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `account_number` VARCHAR(100),
  `bank_name` VARCHAR(150),
  `opening_balance` DECIMAL(15,2) DEFAULT 0,
  `current_balance` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Suppliers
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `company_name` VARCHAR(150),
  `phone` VARCHAR(50),
  `email` VARCHAR(150),
  `vat_ntn_number` VARCHAR(50),
  `address` TEXT,
  `opening_balance` DECIMAL(15,2) DEFAULT 0,
  `current_balance` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suppliers_phone (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Warehouses
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `location` VARCHAR(255),
  `manager_name` VARCHAR(150),
  `phone` VARCHAR(50),
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Services
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT,
  `base_price` DECIMAL(15,2) DEFAULT 0,
  `estimated_time` VARCHAR(100),
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Deals
CREATE TABLE IF NOT EXISTS `deals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `discount_type` VARCHAR(50) DEFAULT 'percentage',
  `discount_value` DECIMAL(15,2) DEFAULT 0,
  `start_date` DATE,
  `end_date` DATE,
  `min_purchase_amount` DECIMAL(15,2) DEFAULT 0,
  `applicable_to` VARCHAR(50) DEFAULT 'all',
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Offers
CREATE TABLE IF NOT EXISTS `offers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `discount_type` VARCHAR(50) DEFAULT 'percentage',
  `discount_value` DECIMAL(15,2) DEFAULT 0,
  `start_date` DATE,
  `end_date` DATE,
  `status` VARCHAR(20) DEFAULT 'active',
  `original_total` DECIMAL(15,2) DEFAULT 0,
  `final_total` DECIMAL(15,2) DEFAULT 0,
  `items_count` INT DEFAULT 0,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Offer Items
CREATE TABLE IF NOT EXISTS `offer_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `offer_id` INT NOT NULL,
  `product_id` INT,
  `variant_id` INT,
  `product_name` VARCHAR(200),
  `variant_name` VARCHAR(150),
  `sku` VARCHAR(100),
  `original_price` DECIMAL(15,2) DEFAULT 0,
  `offer_price` DECIMAL(15,2) DEFAULT 0,
  `category_id` INT,
  INDEX idx_oi_offer (`offer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. EMI Penalty Rules
CREATE TABLE IF NOT EXISTS `emi_penalty_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rule_name` VARCHAR(150) NOT NULL,
  `days_after_due` INT DEFAULT 1,
  `penalty_type` VARCHAR(50) DEFAULT 'fixed',
  `penalty_value` DECIMAL(15,2) DEFAULT 0,
  `max_penalty_cap` DECIMAL(15,2) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Products
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `brand_id` INT NULL,
  `category_id` INT NULL,
  `type` VARCHAR(50) DEFAULT 'single',
  `unit` VARCHAR(50) DEFAULT 'pc',
  `sku` VARCHAR(100),
  `barcode` VARCHAR(100),
  `purchase_price` DECIMAL(15,2) DEFAULT 0,
  `sale_price` DECIMAL(15,2) DEFAULT 0,
  `retail_price` DECIMAL(15,2) DEFAULT 0,
  `wholesale_price` DECIMAL(15,2) DEFAULT 0,
  `min_price` DECIMAL(15,2) DEFAULT 0,
  `stock` DECIMAL(15,2) DEFAULT 0,
  `min_stock` DECIMAL(15,2) DEFAULT 5,
  `tax_type` VARCHAR(50) DEFAULT 'inclusive',
  `tax_rate` DECIMAL(5,2) DEFAULT 0,
  `is_serialized` TINYINT(1) DEFAULT 0,
  `description` TEXT,
  `status` VARCHAR(20) DEFAULT 'active',
  `image_url` LONGTEXT,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prod_barcode (`barcode`),
  INDEX idx_prod_sku (`sku`),
  INDEX idx_prod_cat (`category_id`),
  INDEX idx_prod_brand (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Product Variants
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `variant_name` VARCHAR(150) DEFAULT 'Default',
  `sku` VARCHAR(100),
  `barcode` VARCHAR(100),
  `purchase_price` DECIMAL(15,2) DEFAULT 0,
  `retail_price` DECIMAL(15,2) DEFAULT 0,
  `wholesale_price` DECIMAL(15,2) DEFAULT 0,
  `minimum_retail_price` DECIMAL(15,2) DEFAULT 0,
  `stock_alert_quantity` DECIMAL(12,3) DEFAULT 5,
  `current_stock` DECIMAL(12,3) DEFAULT 0,
  `image_url` LONGTEXT,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pv_prod (`product_id`),
  INDEX idx_pv_sku (`sku`),
  INDEX idx_pv_barcode (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Product Serialized Items
CREATE TABLE IF NOT EXISTS `product_serialized_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NULL,
  `product_variant_id` INT NULL,
  `serial_number` VARCHAR(100) NOT NULL,
  `serial_number_or_imei` VARCHAR(100),
  `status` VARCHAR(50) DEFAULT 'available',
  `sale_id` INT NULL,
  `purchase_id` INT NULL,
  `purchase_item_id` INT NULL,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_serial_no (`serial_number`),
  INDEX idx_serial_imei (`serial_number_or_imei`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. Warehouse Stocks
CREATE TABLE IF NOT EXISTS `warehouse_stocks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `warehouse_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `variant_id` INT NULL,
  `product_variant_id` INT NULL,
  `quantity` DECIMAL(15,2) DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ws_wh (`warehouse_id`),
  INDEX idx_ws_prod (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. Customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50),
  `email` VARCHAR(150),
  `cnic` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `district` VARCHAR(100),
  `province` VARCHAR(100),
  `shop_name` VARCHAR(150),
  `customer_type` VARCHAR(50) DEFAULT 'retail',
  `opening_balance` DECIMAL(15,2) DEFAULT 0,
  `current_balance` DECIMAL(15,2) DEFAULT 0,
  `credit_limit` DECIMAL(15,2) DEFAULT 0,
  `payment_terms` VARCHAR(50) DEFAULT 'cash',
  `status` VARCHAR(20) DEFAULT 'active',
  `notes` TEXT,
  `reference_name` VARCHAR(150),
  `reference_phone` VARCHAR(50),
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cust_phone (`phone`),
  INDEX idx_cust_cnic (`cnic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. Salesmen
CREATE TABLE IF NOT EXISTS `salesmen` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50),
  `cnic` VARCHAR(50),
  `address` TEXT,
  `joining_date` DATE,
  `base_salary` DECIMAL(15,2) DEFAULT 0,
  `target_amount` DECIMAL(15,2) DEFAULT 0,
  `commission_percent` DECIMAL(5,2) DEFAULT 0,
  `commission_rate` DECIMAL(5,2) DEFAULT 0,
  `current_sales` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sm_phone (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. Staff
CREATE TABLE IF NOT EXISTS `staff` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50),
  `role` VARCHAR(100) DEFAULT 'technician',
  `commission_rate` DECIMAL(5,2) DEFAULT 0,
  `base_salary` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `active` TINYINT(1) DEFAULT 1,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23. Purchases
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_no` VARCHAR(100) UNIQUE,
  `purchase_number` VARCHAR(100) UNIQUE,
  `supplier_id` INT NULL,
  `supplier_name` VARCHAR(150),
  `supplier_invoice_no` VARCHAR(100),
  `warehouse_id` INT NULL,
  `purchase_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATETIME NULL,
  `subtotal` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `shipping_cost` DECIMAL(15,2) DEFAULT 0,
  `shipping_charges` DECIMAL(15,2) DEFAULT 0,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `due_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_method` VARCHAR(50) DEFAULT 'cash',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `payment_status` VARCHAR(50) DEFAULT 'paid',
  `account_id` INT NULL,
  `status` VARCHAR(50) DEFAULT 'received',
  `notes` TEXT,
  `created_by` INT NULL,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purch_sup (`supplier_id`),
  INDEX idx_purch_date (`purchase_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24. Purchase Items
CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `product_id` INT NULL,
  `product_variant_id` INT NULL,
  `product_name` VARCHAR(200),
  `quantity` DECIMAL(15,2) NOT NULL,
  `unit_cost` DECIMAL(15,2) DEFAULT 0,
  `purchase_price` DECIMAL(15,2) DEFAULT 0,
  `tax_percentage` DECIMAL(5,2) DEFAULT 0,
  `sub_total` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `expiry_date` DATE NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pi_purch (`purchase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 25. Purchase Returns
CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NULL,
  `return_no` VARCHAR(100) UNIQUE NOT NULL,
  `supplier_id` INT NOT NULL,
  `return_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) DEFAULT 0,
  `notes` TEXT,
  `status` VARCHAR(50) DEFAULT 'processed',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pret_sup (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 26. Purchase Return Items
CREATE TABLE IF NOT EXISTS `purchase_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_return_id` INT NOT NULL,
  `purchase_item_id` INT NULL,
  `product_variant_id` INT NULL,
  `product_id` INT NULL,
  `quantity` DECIMAL(15,2) NOT NULL,
  `return_price` DECIMAL(15,2) DEFAULT 0,
  `tax_percentage` DECIMAL(5,2) DEFAULT 0,
  `sub_total` DECIMAL(15,2) DEFAULT 0,
  `reason` TEXT,
  INDEX idx_pri_ret (`purchase_return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 27. Sales
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(100) UNIQUE,
  `invoice_number` VARCHAR(100) UNIQUE,
  `customer_id` INT NULL,
  `customer_name` VARCHAR(150),
  `customer_ntn` VARCHAR(100),
  `user_id` INT NULL,
  `subtotal` DECIMAL(15,2) DEFAULT 0,
  `item_discount` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `discount_type` VARCHAR(20) DEFAULT 'fixed',
  `tax` DECIMAL(15,2) DEFAULT 0,
  `tax_type` VARCHAR(50) DEFAULT 'inclusive',
  `tax_rate` DECIMAL(5,2) DEFAULT 0,
  `shipping_cost` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `change_amount` DECIMAL(15,2) DEFAULT 0,
  `due_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_method` VARCHAR(50) DEFAULT 'cash',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `payment_status` VARCHAR(50) DEFAULT 'paid',
  `sale_type` VARCHAR(50) DEFAULT 'retail',
  `account_id` INT NULL,
  `status` VARCHAR(50) DEFAULT 'completed',
  `notes` TEXT,
  `sale_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `fbr_status` VARCHAR(50) DEFAULT 'PENDING',
  `fbr_reference` VARCHAR(150),
  `fbr_synced_at` DATETIME NULL,
  `fbr_tax_rate` DECIMAL(5,2) DEFAULT 0,
  `fbr_tax_amount` DECIMAL(15,2) DEFAULT 0,
  `fbr_enabled` TINYINT(1) DEFAULT 0,
  `fbr_business_type` VARCHAR(50) DEFAULT 'retail',
  `fbr_mode` INT DEFAULT 0,
  `dummy_fbr_reference` VARCHAR(150),
  INDEX idx_sales_inv (`invoice_number`),
  INDEX idx_sales_inv_no (`invoice_no`),
  INDEX idx_sales_cust (`customer_id`),
  INDEX idx_sales_date (`sale_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 28. Sale Items
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NULL,
  `product_variant_id` INT NULL,
  `serialized_item_id` INT NULL,
  `product_name` VARCHAR(200),
  `variant_id` INT NULL,
  `quantity` DECIMAL(15,2) NOT NULL,
  `unit_price` DECIMAL(15,2) DEFAULT 0,
  `price` DECIMAL(15,2) DEFAULT 0,
  `purchase_price` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) NOT NULL,
  `serials` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_si_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 29. Sale Returns
CREATE TABLE IF NOT EXISTS `sale_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `return_number` VARCHAR(100) UNIQUE,
  `return_no` VARCHAR(100) UNIQUE,
  `sale_id` INT NULL,
  `invoice_no` VARCHAR(100),
  `customer_id` INT NULL,
  `total_refund` DECIMAL(15,2) DEFAULT 0,
  `refund_amount` DECIMAL(15,2) DEFAULT 0,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_method` VARCHAR(50) DEFAULT 'cash',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `account_id` INT NULL,
  `reason` TEXT,
  `notes` TEXT,
  `return_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sret_sale (`sale_id`),
  INDEX idx_sret_cust (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 30. Sale Return Items
CREATE TABLE IF NOT EXISTS `sale_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_return_id` INT NOT NULL,
  `product_id` INT NULL,
  `product_variant_id` INT NULL,
  `quantity` DECIMAL(15,2) NOT NULL,
  `unit_price` DECIMAL(15,2) DEFAULT 0,
  `price` DECIMAL(15,2) DEFAULT 0,
  `sub_total` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `reason` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sri_ret (`sale_return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 31. FBR Invoices
CREATE TABLE IF NOT EXISTS `fbr_invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `invoice_no` VARCHAR(100),
  `fbr_invoice_number` VARCHAR(150),
  `fbr_status` VARCHAR(50) DEFAULT 'PENDING',
  `fbr_reference` VARCHAR(150),
  `fbr_qr_code` LONGTEXT,
  `qr_code` LONGTEXT,
  `retry_count` INT DEFAULT 0,
  `max_retries` INT DEFAULT 10,
  `error_message` TEXT,
  `fbr_response` LONGTEXT,
  `response_data` LONGTEXT,
  `fbr_tax_rate` DECIMAL(5,2) DEFAULT 0,
  `fbr_tax_amount` DECIMAL(15,2) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `synced_at` DATETIME NULL,
  `last_retry_at` DATETIME NULL,
  INDEX idx_fbr_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 32. Payments (Direct Customer/Supplier Receipts & Vouchers)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `supplier_id` INT NULL,
  `customer_id` INT NULL,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `type` VARCHAR(50),
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `note` TEXT,
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  INDEX idx_pay_cust (`customer_id`),
  INDEX idx_pay_sup (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 33. Expenses
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `category_name` VARCHAR(150),
  `account_id` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `payment_method` VARCHAR(50) DEFAULT 'cash',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `date` DATE NOT NULL,
  `description` TEXT,
  `reference_no` VARCHAR(100),
  `receipt_no` VARCHAR(100),
  `status` VARCHAR(20) DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exp_cat (`category_id`),
  INDEX idx_exp_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 34. General Ledger
CREATE TABLE IF NOT EXISTS `general_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `account_type` VARCHAR(50) NOT NULL,
  `reference_id` INT,
  `debit` DECIMAL(15,2) DEFAULT 0,
  `credit` DECIMAL(15,2) DEFAULT 0,
  `description` TEXT,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 35. Supplier Ledger
CREATE TABLE IF NOT EXISTS `supplier_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `supplier_id` INT NOT NULL,
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `type` VARCHAR(50),
  `amount` DECIMAL(15,2) DEFAULT 0,
  `description` VARCHAR(255),
  `debit` DECIMAL(15,2) DEFAULT 0,
  `credit` DECIMAL(15,2) DEFAULT 0,
  `balance` DECIMAL(15,2) DEFAULT 0,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `reference_type` VARCHAR(50),
  `reference_id` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sl_sup (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 36. Customer Ledger
CREATE TABLE IF NOT EXISTS `customer_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `type` VARCHAR(50) NOT NULL DEFAULT 'invoice',
  `amount` DECIMAL(15,2) DEFAULT 0,
  `previous_balance` DECIMAL(15,2) DEFAULT 0,
  `balance_after` DECIMAL(15,2) DEFAULT 0,
  `debit` DECIMAL(15,2) DEFAULT 0,
  `credit` DECIMAL(15,2) DEFAULT 0,
  `balance` DECIMAL(15,2) DEFAULT 0,
  `description` VARCHAR(255),
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `reference_type` VARCHAR(50),
  `reference_no` VARCHAR(100),
  `reference_id` INT,
  `sale_id` INT NULL,
  `items_json` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cl_cust (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 37. Work Orders
CREATE TABLE IF NOT EXISTS `work_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(100) UNIQUE,
  `service_id` INT NULL,
  `staff_id` INT NULL,
  `customer_id` INT NULL,
  `customer_name` VARCHAR(150),
  `machine_name` VARCHAR(150),
  `device_model` VARCHAR(150),
  `imei` VARCHAR(100),
  `problem_description` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `parts_used` TEXT,
  `notes` TEXT,
  `total_cost` DECIMAL(15,2) DEFAULT 0,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_status` VARCHAR(50) DEFAULT 'unpaid',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `commission_amount` DECIMAL(15,2) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  INDEX idx_wo_cust (`customer_id`),
  INDEX idx_wo_staff (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 38. Salesman Sales
CREATE TABLE IF NOT EXISTS `salesman_sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(100) UNIQUE,
  `salesman_id` INT NOT NULL,
  `customer_id` INT,
  `customer_name` VARCHAR(150),
  `location` VARCHAR(200),
  `sale_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) DEFAULT 'Pending',
  `subtotal` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `tax` DECIMAL(15,2) DEFAULT 0,
  `shipping` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) DEFAULT 0,
  `payment_mode` VARCHAR(50) DEFAULT 'Cash',
  `payment_term` INT DEFAULT 0,
  `payment_term_type` VARCHAR(50) DEFAULT 'Days',
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `due_amount` DECIMAL(15,2) DEFAULT 0,
  `note` TEXT,
  `commission_amount` DECIMAL(15,2) DEFAULT 0,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sms_salesman (`salesman_id`),
  INDEX idx_sms_cust (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 39. Salesman Sale Items
CREATE TABLE IF NOT EXISTS `salesman_sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_variant_id` INT,
  `product_id` INT,
  `product_name` VARCHAR(200),
  `sku` VARCHAR(100),
  `quantity` DECIMAL(12,3) DEFAULT 0,
  `price` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) DEFAULT 0,
  INDEX idx_smsi_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 40. Customer Sales History
CREATE TABLE IF NOT EXISTS `customer_sales_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `sale_id` INT,
  `salesman_id` INT,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `due_amount` DECIMAL(15,2) DEFAULT 0,
  `sale_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `payment_mode` VARCHAR(50),
  INDEX idx_csh_cust (`customer_id`),
  INDEX idx_csh_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 41. Salesman Salary Payments
CREATE TABLE IF NOT EXISTS `salesman_salary_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `salesman_id` INT NOT NULL,
  `month_year` VARCHAR(50) NOT NULL,
  `base_salary` DECIMAL(15,2) DEFAULT 0,
  `bonus` DECIMAL(15,2) DEFAULT 0,
  `deduction` DECIMAL(15,2) DEFAULT 0,
  `advance_deducted` DECIMAL(15,2) DEFAULT 0,
  `net_payable` DECIMAL(15,2) DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_date` DATE,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `note` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sm_sal_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 42. Salesman Commission Payouts
CREATE TABLE IF NOT EXISTS `salesman_commission_payouts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `salesman_id` INT NOT NULL,
  `sale_id` INT,
  `commission_amount` DECIMAL(15,2) DEFAULT 0,
  `payout_amount` DECIMAL(15,2) DEFAULT 0,
  `payout_date` DATE,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `note` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sm_comm_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 43. Salesman Advances
CREATE TABLE IF NOT EXISTS `salesman_advances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `salesman_id` INT NOT NULL,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `advance_type` VARCHAR(50) DEFAULT 'salary',
  `reason` TEXT,
  `given_date` DATE,
  `repayment_amount` DECIMAL(15,2) DEFAULT 0,
  `remaining_amount` DECIMAL(15,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sm_adv_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 44. Salesman Ledger
CREATE TABLE IF NOT EXISTS `salesman_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `salesman_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `previous_balance` DECIMAL(15,2) DEFAULT 0,
  `balance_after` DECIMAL(15,2) DEFAULT 0,
  `description` TEXT,
  `reference_id` INT,
  `reference_type` VARCHAR(50),
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT,
  INDEX idx_sm_led_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 45. Salesman Sale Returns
CREATE TABLE IF NOT EXISTS `salesman_sale_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `return_no` VARCHAR(100) UNIQUE NOT NULL,
  `customer_id` INT,
  `salesman_id` INT NOT NULL,
  `return_date` DATE NOT NULL,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `refund_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `notes` TEXT,
  `status` VARCHAR(50) DEFAULT 'processed',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  INDEX idx_sm_sr_sm (`salesman_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 46. Salesman Sale Return Items
CREATE TABLE IF NOT EXISTS `salesman_sale_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_return_id` INT NOT NULL,
  `product_variant_id` INT,
  `quantity` DECIMAL(12,3) DEFAULT 0,
  `price` DECIMAL(15,2) DEFAULT 0,
  `sub_total` DECIMAL(15,2) DEFAULT 0,
  `reason` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sm_sri_ret (`sale_return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 47. Distributors
CREATE TABLE IF NOT EXISTS `distributors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `company_name` VARCHAR(150),
  `phone` VARCHAR(50),
  `email` VARCHAR(150),
  `cnic` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `district` VARCHAR(100),
  `province` VARCHAR(100),
  `territory` VARCHAR(150),
  `area` VARCHAR(150),
  `opening_balance` DECIMAL(15,2) DEFAULT 0,
  `current_balance` DECIMAL(15,2) DEFAULT 0,
  `credit_limit` DECIMAL(15,2) DEFAULT 0,
  `payment_terms` VARCHAR(50) DEFAULT 'cash',
  `commission_percent` DECIMAL(5,2) DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `notes` TEXT,
  `reference_name` VARCHAR(150),
  `reference_phone` VARCHAR(50),
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 48. Distributor Orders
CREATE TABLE IF NOT EXISTS `distributor_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `distributor_id` INT NOT NULL,
  `order_no` VARCHAR(100) UNIQUE NOT NULL,
  `order_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATETIME NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `shipping_charges` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `due_amount` DECIMAL(15,2) DEFAULT 0,
  `payment_status` VARCHAR(50) DEFAULT 'due',
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `notes` TEXT,
  `created_by` INT,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  INDEX idx_do_dist (`distributor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 49. Distributor Order Items
CREATE TABLE IF NOT EXISTS `distributor_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_variant_id` INT,
  `product_name` VARCHAR(200),
  `sku` VARCHAR(100),
  `quantity` DECIMAL(12,3) DEFAULT 0,
  `price` DECIMAL(15,2) DEFAULT 0,
  `discount` DECIMAL(15,2) DEFAULT 0,
  `total` DECIMAL(15,2) DEFAULT 0,
  INDEX idx_doi_order (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 50. Distributor Payments
CREATE TABLE IF NOT EXISTS `distributor_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `distributor_id` INT NOT NULL,
  `order_id` INT,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `payment_date` DATE,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `cheque_no` VARCHAR(100),
  `cheque_date` DATE,
  `cheque_status` VARCHAR(50) DEFAULT 'pending',
  `bank_name` VARCHAR(150),
  `note` TEXT,
  `receipt_no` VARCHAR(100) UNIQUE,
  `created_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dp_dist (`distributor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 51. Distributor Ledger
CREATE TABLE IF NOT EXISTS `distributor_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `distributor_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(15,2) DEFAULT 0,
  `previous_balance` DECIMAL(15,2) DEFAULT 0,
  `balance_after` DECIMAL(15,2) DEFAULT 0,
  `description` TEXT,
  `reference_id` INT,
  `reference_type` VARCHAR(50),
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT,
  INDEX idx_dl_dist (`distributor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 52. Distributor Returns
CREATE TABLE IF NOT EXISTS `distributor_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT,
  `distributor_id` INT NOT NULL,
  `return_no` VARCHAR(100) UNIQUE NOT NULL,
  `return_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `total_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `tax_amount` DECIMAL(15,2) DEFAULT 0,
  `grand_total` DECIMAL(15,2) DEFAULT 0,
  `notes` TEXT,
  `status` VARCHAR(50) DEFAULT 'processed',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_by` INT,
  INDEX idx_dr_dist (`distributor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 53. Distributor Return Items
CREATE TABLE IF NOT EXISTS `distributor_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `distributor_return_id` INT NOT NULL,
  `product_variant_id` INT,
  `quantity` DECIMAL(12,3) DEFAULT 0,
  `return_price` DECIMAL(15,2) DEFAULT 0,
  `sub_total` DECIMAL(15,2) DEFAULT 0,
  `reason` TEXT,
  INDEX idx_dri_ret (`distributor_return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 54. EMI Records (Full Master Table)
CREATE TABLE IF NOT EXISTS `emi_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_no` VARCHAR(100) UNIQUE NOT NULL,
  `customer_id` INT NOT NULL,
  `customer_name` VARCHAR(150),
  `product_variant_id` INT,
  `product_id` INT,
  `sale_id` INT,
  `product_name` VARCHAR(200),
  `product_sku` VARCHAR(100),
  `product_retail_price` DECIMAL(15,2) DEFAULT 0,
  `product_cost_price` DECIMAL(15,2) DEFAULT 0,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `down_payment` DECIMAL(15,2) DEFAULT 0,
  `remaining_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `emi_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `installment_amount` DECIMAL(15,2) DEFAULT 0,
  `interest_rate` DECIMAL(5,2) DEFAULT 0,
  `total_months` INT DEFAULT 0,
  `total_installments` INT DEFAULT 0,
  `paid_months` INT DEFAULT 0,
  `paid_installments` INT DEFAULT 0,
  `start_date` DATE,
  `end_date` DATE,
  `next_due_date` DATE,
  `due_day` INT DEFAULT 1,
  `last_payment_date` DATE,
  `status` VARCHAR(50) DEFAULT 'active',
  `salesman_id` INT,
  `shop_location` VARCHAR(150),
  `notes` TEXT,
  `agreement_signed` TINYINT(1) DEFAULT 0,
  `agreement_date` DATE,
  `agreement_file_path` VARCHAR(255),
  `is_deleted` TINYINT(1) DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT,
  `updated_by` INT,
  INDEX idx_emi_app_no (`application_no`),
  INDEX idx_emi_cust (`customer_id`),
  INDEX idx_emi_status (`status`),
  INDEX idx_emi_next_due (`next_due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 55. EMI Guarantors
CREATE TABLE IF NOT EXISTS `emi_guarantors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `guarantor_type` INT DEFAULT 1,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50),
  `cnic` VARCHAR(50) NOT NULL,
  `address` TEXT,
  `occupation` VARCHAR(150),
  `monthly_income` DECIMAL(15,2) DEFAULT 0,
  `relation_to_customer` VARCHAR(100),
  `passport_photo_path` VARCHAR(255),
  `blank_check_photo_path` VARCHAR(255),
  `cnic_front_photo_path` VARCHAR(255),
  `cnic_back_photo_path` VARCHAR(255),
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_guar_emi (`emi_id`),
  INDEX idx_guar_cnic (`cnic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 56. EMI Schedule
CREATE TABLE IF NOT EXISTS `emi_schedule` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `installment_no` INT NOT NULL,
  `due_date` DATE NOT NULL,
  `planned_amount` DECIMAL(15,2) DEFAULT 0,
  `principal_portion` DECIMAL(15,2) DEFAULT 0,
  `interest_portion` DECIMAL(15,2) DEFAULT 0,
  `paid_amount` DECIMAL(15,2) DEFAULT 0,
  `paid_date` DATE,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sched_emi (`emi_id`),
  INDEX idx_sched_due (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 57. EMI Payments
CREATE TABLE IF NOT EXISTS `emi_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `installment_number` INT DEFAULT 1,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `penalty_amount` DECIMAL(15,2) DEFAULT 0,
  `discount_amount` DECIMAL(15,2) DEFAULT 0,
  `total_received` DECIMAL(15,2) DEFAULT 0,
  `payment_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATE NULL,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `payment_method` VARCHAR(50) DEFAULT 'cash',
  `account_id` INT NULL,
  `status` VARCHAR(50) DEFAULT 'paid',
  `bank_name` VARCHAR(150),
  `cheque_no` VARCHAR(100),
  `cheque_date` DATE,
  `cheque_clearance_date` DATE,
  `cheque_status` VARCHAR(50) DEFAULT 'pending',
  `receipt_no` VARCHAR(100) UNIQUE,
  `notes` TEXT,
  `is_reversal` TINYINT(1) DEFAULT 0,
  `reversed_payment_id` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT,
  INDEX idx_ep_emi (`emi_id`),
  INDEX idx_ep_date (`payment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 58. EMI Reschedule Log
CREATE TABLE IF NOT EXISTS `emi_reschedule_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `old_emi_amount` DECIMAL(15,2),
  `new_emi_amount` DECIMAL(15,2),
  `old_total_months` INT,
  `new_total_months` INT,
  `old_next_due_date` DATE,
  `new_next_due_date` DATE,
  `old_interest_rate` DECIMAL(5,2),
  `new_interest_rate` DECIMAL(5,2),
  `reason` TEXT,
  `approved_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resch_emi (`emi_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 59. EMI Documents
CREATE TABLE IF NOT EXISTS `emi_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_hash` VARCHAR(100),
  `description` TEXT,
  `uploaded_by` INT,
  `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doc_emi (`emi_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 60. EMI Visit Log
CREATE TABLE IF NOT EXISTS `emi_visit_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `emi_id` INT NOT NULL,
  `visit_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `visit_type` VARCHAR(50) DEFAULT 'visit',
  `staff_id` INT,
  `staff_name` VARCHAR(150),
  `notes` TEXT,
  `outcome` TEXT,
  `next_action` TEXT,
  `next_action_date` DATE,
  `location` VARCHAR(255),
  `customer_met` TINYINT(1) DEFAULT 0,
  `amount_collected` DECIMAL(15,2) DEFAULT 0,
  `photo_path` VARCHAR(255),
  `signature_path` VARCHAR(255),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT,
  INDEX idx_ev_emi (`emi_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 61. Customer EMI Summary
CREATE TABLE IF NOT EXISTS `customer_emi_summary` (
  `customer_id` INT PRIMARY KEY,
  `total_emis` INT DEFAULT 0,
  `active_emis` INT DEFAULT 0,
  `closed_emis` INT DEFAULT 0,
  `defaulted_emis` INT DEFAULT 0,
  `total_principal` DECIMAL(15,2) DEFAULT 0,
  `total_down_paid` DECIMAL(15,2) DEFAULT 0,
  `total_paid` DECIMAL(15,2) DEFAULT 0,
  `total_penalty_paid` DECIMAL(15,2) DEFAULT 0,
  `total_discount_given` DECIMAL(15,2) DEFAULT 0,
  `total_outstanding` DECIMAL(15,2) DEFAULT 0,
  `total_overdue_amount` DECIMAL(15,2) DEFAULT 0,
  `last_payment_date` DATE,
  `next_due_date` DATE,
  `risk_level` VARCHAR(50) DEFAULT 'low',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 62. Account Transactions
CREATE TABLE IF NOT EXISTS `account_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `transaction_type` VARCHAR(50),
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `previous_balance` DECIMAL(15,2) DEFAULT 0,
  `balance_after` DECIMAL(15,2) DEFAULT 0,
  `reference_type` VARCHAR(50),
  `reference_id` INT,
  `reference_no` VARCHAR(100),
  `description` TEXT,
  `payment_mode` VARCHAR(50) DEFAULT 'cash',
  `date` DATE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_act_acc (`account_id`),
  INDEX idx_act_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 63. Account Daily Balances
CREATE TABLE IF NOT EXISTS `account_daily_balances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `opening_balance` DECIMAL(15,2) DEFAULT 0,
  `closing_balance` DECIMAL(15,2) DEFAULT 0,
  `total_credits` DECIMAL(15,2) DEFAULT 0,
  `total_debits` DECIMAL(15,2) DEFAULT 0,
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_acc_date (`account_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== VIEWS ====================

DROP VIEW IF EXISTS `v_emi_ledger`;
CREATE VIEW `v_emi_ledger` AS
SELECT
  r.id AS emi_id,
  r.application_no,
  r.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.cnic AS customer_cnic,
  r.tenant_id,
  r.product_name,
  r.product_sku,
  r.total_amount,
  r.down_payment,
  r.remaining_amount,
  r.emi_amount,
  r.interest_rate,
  r.total_months,
  r.paid_months,
  r.start_date,
  r.next_due_date,
  r.status,
  r.agreement_signed,
  r.shop_location,
  r.created_at AS emi_created_at,
  COALESCE(SUM(p.amount), 0) AS total_paid,
  COALESCE(SUM(p.penalty_amount), 0) AS total_penalty,
  COUNT(p.id) AS payment_count,
  MAX(p.payment_date) AS last_payment_date,
  (r.total_amount - r.down_payment - COALESCE(SUM(p.amount), 0)) AS balance_due,
  CASE
    WHEN r.next_due_date < CURDATE() AND r.status = 'active' THEN 'overdue'
    ELSE r.status
  END AS computed_status,
  DATEDIFF(CURDATE(), r.next_due_date) AS days_overdue
FROM emi_records r
LEFT JOIN customers c ON r.customer_id = c.id
LEFT JOIN emi_payments p ON r.id = p.emi_id AND p.is_reversal = 0
WHERE r.is_deleted = 0
GROUP BY r.id, r.tenant_id;

DROP VIEW IF EXISTS `v_emi_overdue`;
CREATE VIEW `v_emi_overdue` AS
SELECT * FROM v_emi_ledger
WHERE computed_status = 'overdue' OR (status = 'active' AND next_due_date < CURDATE());

DROP VIEW IF EXISTS `v_salesman_performance`;
CREATE VIEW `v_salesman_performance` AS
SELECT
  s.id AS salesman_id,
  s.tenant_id,
  s.name AS salesman_name,
  s.commission_percent,
  s.target_amount,
  s.base_salary,
  COUNT(DISTINCT ss.id) AS total_sales,
  COALESCE(SUM(ss.grand_total), 0) AS total_sale_amount,
  COALESCE(SUM(ss.commission_amount), 0) AS total_commission_earned,
  COALESCE(SUM(ss.paid_amount), 0) AS total_collected,
  COALESCE(SUM(ss.due_amount), 0) AS total_due,
  COUNT(DISTINCT ss.customer_id) AS unique_customers,
  COALESCE(SUM(CASE WHEN ss.status = 'Completed' THEN ss.grand_total ELSE 0 END), 0) AS completed_amount,
  COALESCE(SUM(CASE WHEN ss.status = 'Pending' THEN ss.grand_total ELSE 0 END), 0) AS pending_amount,
  CASE
    WHEN s.target_amount > 0 THEN ROUND((COALESCE(SUM(ss.grand_total), 0) / s.target_amount) * 100, 2)
    ELSE 0
  END AS target_achievement_percent
FROM salesmen s
LEFT JOIN salesman_sales ss ON s.id = ss.salesman_id AND ss.is_deleted = 0
WHERE s.is_deleted = 0
GROUP BY s.id, s.tenant_id;

DROP VIEW IF EXISTS `v_distributor_summary`;
CREATE VIEW `v_distributor_summary` AS
SELECT
  d.id AS distributor_id,
  d.tenant_id,
  d.name AS distributor_name,
  d.company_name,
  d.current_balance,
  d.credit_limit,
  COUNT(DISTINCT do.id) AS total_orders,
  COALESCE(SUM(do.grand_total), 0) AS total_order_value,
  COALESCE(SUM(do.paid_amount), 0) AS total_paid,
  COALESCE(SUM(do.due_amount), 0) AS total_due,
  COUNT(DISTINCT CASE WHEN do.status = 'pending' THEN do.id END) AS pending_orders,
  COUNT(DISTINCT CASE WHEN do.status = 'delivered' THEN do.id END) AS delivered_orders,
  COALESCE(SUM(dp.amount), 0) AS total_payments_received
FROM distributors d
LEFT JOIN distributor_orders do ON d.id = do.distributor_id AND do.is_deleted = 0
LEFT JOIN distributor_payments dp ON d.id = dp.distributor_id
WHERE d.is_deleted = 0
GROUP BY d.id, d.tenant_id;

SET FOREIGN_KEY_CHECKS = 1;
