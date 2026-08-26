// ============================================================
//  db-sales.js — Sales, Sale Returns & Sale Items Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbTransaction } from './core/idb-core.js';
import { generateId } from './core/utils.js';

export function attachSalesMethods(StorageClass) {

  // ==================== SALE ITEMS ====================
  StorageClass.prototype.getSaleItems = async function(saleId) {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost FROM sale_items si LEFT JOIN product_variants pv ON pv.id = si.product_variant_id LEFT JOIN products p ON p.id = COALESCE(si.product_id, pv.product_id) WHERE si.sale_id = ? ORDER BY si.id`, [saleId]);
    }
    const [items, variants, prods] = await Promise.all([idbGetAll('sale_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.filter(x => String(x.sale_id) === String(saleId)).map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      const p = prods.find(x => x.id === i.product_id);
      return { ...i, product_name: p?.name || '', sku: v?.sku || '', variant_name: v?.variant_name || '', unit_cost: v?.purchase_price || 0 };
    });
  };

  StorageClass.prototype.getAllSaleItems = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost FROM sale_items si JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id JOIN sales s ON si.sale_id = s.id WHERE s.is_deleted = 0 ORDER BY si.id DESC`);
    }
    const [items, variants, prods, sales] = await Promise.all([idbGetAll('sale_items'), idbGetAll('product_variants'), idbGetAll('products'), idbGetAll('sales')]);
    const validSaleIds = new Set(sales.filter(s => !s.is_deleted).map(s => String(s.id)));
    return items.filter(i => validSaleIds.has(String(i.sale_id))).map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      const p = prods.find(x => x.id === i.product_id);
      return { ...i, product_name: p?.name || '', sku: v?.sku || '', variant_name: v?.variant_name || '', unit_cost: v?.purchase_price || 0 };
    });
  };

  // ==================== GET SALES HISTORY ====================
  StorageClass.prototype.getSalesHistory = async function() {  
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT s.*, c.name as customer_name, c.phone as customer_phone FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.is_deleted = 0 ORDER BY s.id DESC");
    }
    const [sales, customers] = await Promise.all([
      idbGetAll('sales'),
      idbGetAll('customers')
    ]);
    return sales.filter(s => !s.is_deleted).map(s => ({
      ...s,
      customer_name: customers.find(c => c.id === s.customer_id)?.name || '',
      customer_phone: customers.find(c => c.id === s.customer_id)?.phone || ''
    }));
  };

  // ==================== ATOMIC SALE CREATE (COMPLETE FIXED) ====================
  StorageClass.prototype.createSale = async function(data) {
    const { sale, items } = data;
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    // ==================== ELECTRON MODE ====================
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        // Validate stock first
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;
          if (!variantId || qty <= 0) {
            throw new Error(`Invalid item: variant=${variantId}, qty=${qty}`);
          }

          const variant = await this.electronQuery(
            "SELECT current_stock FROM product_variants WHERE id = ? AND is_deleted = 0",
            [variantId]
          );
          if (!variant[0] || Number(variant[0].current_stock) < qty) {
            throw new Error(`Insufficient stock for variant ${variantId}`);
          }
        }

        // Insert Sale
        const parentSql = `INSERT INTO sales (
          invoice_no, customer_id, customer_name, customer_ntn, 
          subtotal, item_discount, discount, tax, grand_total, 
          paid_amount, due_amount, change_amount, 
          payment_mode, payment_status, sale_type, date,
          fbr_enabled, fbr_mode, fbr_tax_rate, fbr_tax_amount, 
          fbr_business_type, dummy_fbr_reference, fbr_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const parentParams = [
          sale.invoice_no, 
          sale.customer_id, 
          sale.customer_name, 
          sale.customer_ntn || '',
          sale.subtotal || 0, 
          sale.item_discount || 0, 
          sale.discount || 0, 
          sale.tax || 0, 
          sale.grand_total || 0, 
          sale.paid_amount || 0, 
          sale.due_amount || 0, 
          sale.change_amount || 0, 
          sale.payment_mode || 'cash', 
          sale.payment_status || 'paid', 
          sale.sale_type || 'retail', 
          sale.date || new Date().toISOString(),
          sale.fbr_enabled ? 1 : 0,
          sale.fbr_mode ? 1 : 0,
          sale.fbr_tax_rate || 0,
          sale.fbr_tax_amount || 0,
          sale.fbr_business_type || 'retail',
          sale.dummy_fbr_reference || null,
          'PENDING'
        ];
        const parentResult = await this.electronQuery(parentSql, parentParams);
        const saleId = parentResult.lastInsertRowid;

        // Insert Sale Items
        const childSql = `INSERT INTO sale_items (sale_id, product_variant_id, product_id, quantity, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          await this.electronQuery(childSql, [
            saleId, 
            item.product_variant_id, 
            item.product_id || null, 
            qty, 
            item.price || 0, 
            item.discount || 0, 
            item.total || (qty * (item.price || 0))
          ]);

          // Deduct Stock
          const stockUpdate = await this.electronQuery(
            "UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?",
            [qty, item.product_variant_id, qty]
          );
          if (stockUpdate.changes === 0) {
            throw new Error(`Stock update failed for variant ${item.product_variant_id}`);
          }
        }

        // Update Customer Balance and Ledger (ALWAYS create entry for history)
        if (sale.customer_id) {
          const dueAmount = Number(sale.due_amount) || 0;

          // Get previous balance BEFORE updating
          const prevBalanceResult = await this.electronQuery(
            "SELECT current_balance FROM customers WHERE id = ?",
            [sale.customer_id]
          );
          const previousBalance = Number(prevBalanceResult[0]?.current_balance) || 0;

          // Only update balance if there's due amount (credit sale)
          if (dueAmount > 0) {
            await this.electronQuery(
              "UPDATE customers SET current_balance = current_balance + ? WHERE id = ?",
              [dueAmount, sale.customer_id]
            );
          }

          const balanceAfterResult = await this.electronQuery(
            "SELECT current_balance FROM customers WHERE id = ?",
            [sale.customer_id]
          );
          const balanceAfter = Number(balanceAfterResult[0]?.current_balance) || 0;

          // Build items JSON for ledger
          const itemsForLedger = items.map(item => ({
            product_variant_id: item.product_variant_id || item.variantId,
            product_id: item.product_id || item.productId,
            name: item.name || item.product_name || '',
            quantity: Number(item.quantity || item.qty) || 0,
            price: Number(item.price) || 0,
            discount: Number(item.discount) || 0,
            total: Math.round(((Number(item.price) || 0) * (Number(item.quantity || item.qty) || 0) - (Number(item.discount) || 0)) * 100) / 100
          }));

          await this.electronQuery(
            `INSERT INTO customer_ledger (
              customer_id, type, amount, previous_balance, balance_after, 
              description, payment_mode, reference_no, sale_id, date, items_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sale.customer_id,
              dueAmount > 0 ? 'credit_sale' : 'cash_sale',
              dueAmount,
              previousBalance,
              balanceAfter,
              `Sale ${sale.invoice_no} - ${items.length} items`,
              sale.payment_mode || (dueAmount > 0 ? 'credit' : 'cash'),
              sale.invoice_no,
              saleId,
              sale.date || new Date().toISOString(),
              JSON.stringify(itemsForLedger)
            ]
          );
        }

        // General Ledger
        try {
          const revenueAmount = (sale.grand_total || 0) - (sale.tax || 0);
          await this.logToGeneralLedger('revenue', saleId, 0, revenueAmount, `Sale ${sale.invoice_no}`);
          if (Number(sale.paid_amount) > 0) {
            const acct = (sale.payment_mode === 'cash' || sale.payment_mode === 'cod') ? 'cash' : 'bank';
            await this.logToGeneralLedger(acct, saleId, sale.paid_amount, 0, `Payment for ${sale.invoice_no}`);
          }
          if (Number(sale.due_amount) > 0) {
            await this.logToGeneralLedger('receivable', saleId, sale.due_amount, 0, `Due for ${sale.invoice_no}`);
          }
        } catch (e) {
          console.error('[createSale] Ledger error (non-critical):', e);
        }

        // FBR Invoice
        const existingFbr = await this.electronQuery(
          "SELECT id FROM fbr_invoices WHERE sale_id = ?",
          [saleId]
        );
        if (!existingFbr || existingFbr.length === 0) {
          await this.electronQuery(
            `INSERT INTO fbr_invoices (sale_id, invoice_no, fbr_status, retry_count, max_retries, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [saleId, sale.invoice_no, 'PENDING', 0, 10]
          );
          console.log(`[FBR] Invoice ${sale.invoice_no} queued for sync`);
        }

        if (SYNC_ENABLED) {
          await syncToCloud('sales', { ...sale, id: saleId });
        }

        return { id: saleId, success: true };
      });
    }

    // ==================== BROWSER MODE (COMPLETE FIXED) ====================
    const saleId = generateId();

    // Include 'customers' and 'customer_ledger' in transaction
    return idbTransaction(
      ['sales', 'sale_items', 'product_variants', 'fbr_invoices', 'customers', 'customer_ledger'], 
      async (tx) => {
        const saleStore = tx.objectStore('sales');
        const itemStore = tx.objectStore('sale_items');
        const variantStore = tx.objectStore('product_variants');
        const fbrStore = tx.objectStore('fbr_invoices');
        const customerStore = tx.objectStore('customers');
        const ledgerStore = tx.objectStore('customer_ledger');

        // ============================================================
        // 1. VALIDATE STOCK
        // ============================================================
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;
          if (!variantId || qty <= 0) {
            throw new Error(`Invalid item: variant=${variantId}, qty=${qty}`);
          }

          const variantRequest = variantStore.get(variantId);
          await new Promise((resolve, reject) => {
            variantRequest.onsuccess = () => resolve(variantRequest.result);
            variantRequest.onerror = () => reject(variantRequest.error);
          });

          const variant = variantRequest.result;
          if (!variant || variant.is_deleted || Number(variant.current_stock) < qty) {
            throw new Error(`Insufficient stock for variant ${variantId}`);
          }
        }

        // ============================================================
        // 2. SAVE SALE
        // ============================================================
        const saleData = {
          id: saleId,
          invoice_no: sale.invoice_no || `INV-${Date.now()}`,
          customer_id: sale.customer_id || null,
          customer_name: sale.customer_name || 'Walk-in Customer',
          customer_ntn: sale.customer_ntn || '',
          subtotal: Number(sale.subtotal) || 0,
          item_discount: Number(sale.item_discount) || 0,
          discount: Number(sale.discount) || 0,
          tax: Number(sale.tax) || 0,
          grand_total: Number(sale.grand_total) || 0,
          paid_amount: Number(sale.paid_amount) || 0,
          due_amount: Number(sale.due_amount) || 0,
          change_amount: Number(sale.change_amount) || 0,
          payment_mode: sale.payment_mode || 'cash',
          payment_status: sale.payment_status || 'paid',
          sale_type: sale.sale_type || 'retail',
          date: sale.date || new Date().toISOString(),
          is_deleted: 0,
          fbr_status: 'PENDING',
          fbr_enabled: sale.fbr_enabled ? 1 : 0,
          fbr_mode: sale.fbr_mode ? 1 : 0,
          fbr_tax_rate: Number(sale.fbr_tax_rate) || 0,
          fbr_tax_amount: Number(sale.fbr_tax_amount) || 0,
          fbr_business_type: sale.fbr_business_type || 'retail',
          dummy_fbr_reference: sale.dummy_fbr_reference || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await new Promise((resolve, reject) => {
          try {
            const r = saleStore.add(saleData);
            r.onsuccess = () => resolve(r);
            r.onerror = () => reject(r.error);
          } catch (err) {
            reject(err);
          }
        });

        // ============================================================
        // 3. SAVE SALE ITEMS & DEDUCT STOCK
        // ============================================================
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;
          const price = Number(item.price) || 0;
          const discount = Number(item.discount) || 0;
          const total = Number(item.total) || (qty * price);

          const itemId = generateId();

          const itemData = {
            id: itemId,
            sale_id: saleId,
            product_variant_id: variantId,
            product_id: item.product_id || null,
            quantity: qty,
            price: price,
            discount: discount,
            total: (qty * price) - discount,
            created_at: new Date().toISOString()
          };

          await new Promise((resolve, reject) => {
            try {
              const r = itemStore.add(itemData);
              r.onsuccess = () => resolve(r);
              r.onerror = () => reject(r.error);
            } catch (err) {
              reject(err);
            }
          });

          // Deduct Stock
          const variantRequest = variantStore.get(variantId);
          await new Promise((resolve, reject) => {
            variantRequest.onsuccess = () => resolve(variantRequest.result);
            variantRequest.onerror = () => reject(variantRequest.error);
          });

          const variant = variantRequest.result;
          if (variant) {
            const newStock = Math.max(0, Number(variant.current_stock) - qty);
            variant.current_stock = newStock;
            variant.updated_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
              try {
                const r = variantStore.put(variant);
                r.onsuccess = () => resolve(r);
                r.onerror = () => reject(r.error);
              } catch (err) {
                reject(err);
              }
            });
          }
        }

        // ============================================================
        // 4. UPDATE CUSTOMER BALANCE & LEDGER (ALWAYS for history)
        // ============================================================
        if (sale.customer_id) {
          const dueAmount = Number(sale.due_amount) || 0;

          const customerRequest = customerStore.get(sale.customer_id);
          await new Promise((resolve, reject) => {
            customerRequest.onsuccess = () => resolve(customerRequest.result);
            customerRequest.onerror = () => reject(customerRequest.error);
          });

          const customer = customerRequest.result;
          if (customer) {
            const previousBalance = Number(customer.current_balance) || 0;

            // Only update balance if credit sale
            if (dueAmount > 0) {
              const creditLimit = Number(customer.credit_limit) || 0;
              const projectedBalance = previousBalance + dueAmount;
              if (creditLimit > 0 && projectedBalance > creditLimit) {
                throw new Error(`Credit limit exceeded. Limit: ${creditLimit.toFixed(2)}, Projected balance: ${projectedBalance.toFixed(2)}`);
              }

              customer.current_balance = previousBalance + dueAmount;
              customer.updated_at = new Date().toISOString();

              await new Promise((resolve, reject) => {
                try {
                  const r = customerStore.put(customer);
                  r.onsuccess = () => resolve(r);
                  r.onerror = () => reject(r.error);
                } catch (err) {
                  reject(err);
                }
              });
            }

            const balanceAfter = Number(customer.current_balance) || 0;

            // Build items JSON for ledger
            const itemsForLedger = items.map(item => ({
              product_variant_id: item.product_variant_id || item.variantId,
              product_id: item.product_id || item.productId,
              name: item.name || item.product_name || '',
              quantity: Number(item.quantity || item.qty) || 0,
              price: Number(item.price) || 0,
              discount: Number(item.discount) || 0,
              total: Math.round(((Number(item.price) || 0) * (Number(item.quantity || item.qty) || 0) - (Number(item.discount) || 0)) * 100) / 100
            }));

            // ============================================================
            // 5. ADD CUSTOMER LEDGER ENTRY
            // ============================================================
            try {
              const ledgerData = {
                id: generateId(),
                customer_id: sale.customer_id,
                type: dueAmount > 0 ? 'credit_sale' : 'cash_sale',
                amount: dueAmount,
                previous_balance: previousBalance,
                balance_after: balanceAfter,
                description: `Sale ${sale.invoice_no} - ${items.length} items`,
                payment_mode: sale.payment_mode || (dueAmount > 0 ? 'credit' : 'cash'),
                reference_no: sale.invoice_no,
                sale_id: saleId,
                date: sale.date || new Date().toISOString(),
                items_json: JSON.stringify(itemsForLedger)
              };

              await new Promise((resolve, reject) => {
                try {
                  const r = ledgerStore.add(ledgerData);
                  r.onsuccess = () => resolve(r);
                  r.onerror = () => reject(r.error);
                } catch (err) {
                  reject(err);
                }
              });
            } catch (ledgerErr) {
              console.warn('[createSale] Ledger entry failed (non-critical):', ledgerErr.message);
            }
          }
        }

        // ============================================================
        // 6. FBR INVOICE
        // ============================================================
        const existingFbrRequest = fbrStore.index('sale_id').get(saleId);
        await new Promise((resolve, reject) => {
          existingFbrRequest.onsuccess = () => resolve(existingFbrRequest.result);
          existingFbrRequest.onerror = () => reject(existingFbrRequest.error);
        });

        if (!existingFbrRequest.result) {
          try {
            const fbrId = generateId();
            const fbrData = {
              id: fbrId,
              sale_id: saleId,
              invoice_no: sale.invoice_no,
              fbr_status: 'PENDING',
              retry_count: 0,
              max_retries: 10,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            await new Promise((resolve, reject) => {
              try {
                const r = fbrStore.add(fbrData);
                r.onsuccess = () => resolve(r);
                r.onerror = () => reject(r.error);
              } catch (err) {
                reject(err);
              }
            });
            console.log(`[FBR] Invoice ${sale.invoice_no} queued for sync`);
          } catch (fbrErr) {
            console.error('[FBR] Queue error (non-critical):', fbrErr.message);
          }
        }

        // ============================================================
        // 7. CLOUD SYNC
        // ============================================================
        if (SYNC_ENABLED) {
          try {
            await syncToCloud('sales', saleData);
            for (const item of items) {
              await syncToCloud('sale_items', { ...item, sale_id: saleId });
            }
          } catch (syncErr) {
            console.error('[Sync] Cloud sync failed:', syncErr.message);
          }
        }

        return { id: saleId, success: true };
      }
    );
  };

  // ==================== DELETE SALE ====================
  StorageClass.prototype.deleteSale = async function(id) {
    if (!id || typeof id !== 'string' && typeof id !== 'number') {
      throw new Error('[deleteSale] Invalid sale ID provided');
    }

    try {
      await this.cancelFBRInvoice(id);
    } catch (fbrErr) {
      console.error('[FBR] Cancellation error:', fbrErr.message);
    }

    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        // 1. Fetch sale data FIRST (before marking deleted)
        const saleRows = await this.electronQuery(
          "SELECT customer_id, due_amount, invoice_no FROM sales WHERE id = ? AND is_deleted = 0",
          [id]
        );
        const saleData = saleRows[0];

        const items = await this.getSaleItems(id);

        // Helper: Reverse customer balance if credit sale
        const reverseCustomerBalance = async () => {
          if (saleData && saleData.customer_id && Number(saleData.due_amount) > 0) {
            const dueAmount = Number(saleData.due_amount);
            const prevBalanceResult = await this.electronQuery(
              "SELECT current_balance FROM customers WHERE id = ?",
              [saleData.customer_id]
            );
            const previousBalance = Number(prevBalanceResult[0]?.current_balance) || 0;
            const newBalance = Math.max(0, previousBalance - dueAmount);

            await this.electronQuery(
              "UPDATE customers SET current_balance = ? WHERE id = ?",
              [newBalance, saleData.customer_id]
            );

            await this.electronQuery(
              `INSERT INTO customer_ledger (
                customer_id, type, amount, previous_balance, balance_after,
                description, payment_mode, reference_no, sale_id, date, items_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                saleData.customer_id,
                'sale_cancelled',
                -dueAmount,
                previousBalance,
                newBalance,
                `Sale cancelled: ${saleData.invoice_no}`,
                'adjustment',
                saleData.invoice_no,
                id,
                new Date().toISOString(),
                '[]'
              ]
            );
          }
        };

        if (!items || items.length === 0) {
          await reverseCustomerBalance();

          const _res = await this.electronQuery(
            "UPDATE sales SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0",
            [id]
          );
          if (_res.changes === 0) {
            console.warn(`[deleteSale] Sale ${id} not found or already deleted`);
            return { changes: 0, message: 'Sale not found or already deleted' };
          }
          if (SYNC_ENABLED) {
            try {
              await syncToCloud('sales', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
            } catch (syncErr) {
              console.error(`[deleteSale] Cloud sync failed:`, syncErr.message);
            }
          }
          return { changes: 1, message: 'Sale deleted (no items to restore)' };
        }

        const restoredItems = [];

        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;

          if (!variantId || qty <= 0) {
            console.warn(`[deleteSale] Invalid item in sale ${id}: variantId=${variantId}, qty=${qty}`);
            continue;
          }

          const stockUpdate = await this.electronQuery(
            "UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ? AND is_deleted = 0",
            [qty, variantId]
          );

          if (stockUpdate.changes === 0) {
            const check = await this.electronQuery(
              "SELECT id FROM product_variants WHERE id = ? AND is_deleted = 0",
              [variantId]
            );
            if (!check || check.length === 0) {
              throw new Error(`Variant ${variantId} not found or already deleted`);
            }
          }

          const updated = await this.electronQuery(
            "SELECT current_stock FROM product_variants WHERE id = ?",
            [variantId]
          );
          restoredItems.push({
            variantId,
            qty,
            newStock: updated[0]?.current_stock || 0
          });
        }

        // Reverse customer balance after stock restore
        await reverseCustomerBalance();

        const deleteResult = await this.electronQuery(
          "UPDATE sales SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0",
          [id]
        );

        if (deleteResult.changes === 0) {
          throw new Error(`Sale ${id} not found during deletion.`);
        }

        if (SYNC_ENABLED) {
          try {
            await syncToCloud('sales', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
            for (const restored of restoredItems) {
              await syncToCloud('product_variants', { id: restored.variantId, current_stock: restored.newStock });
            }
          } catch (syncErr) {
            console.error(`[deleteSale] Cloud sync failed:`, syncErr.message);
          }
        }

        return { changes: 1, message: 'Sale deleted successfully', restoredItems, restoredCount: restoredItems.length };
      });
    }

    // ==================== BROWSER MODE ====================
    return idbTransaction(['sales', 'sale_items', 'product_variants', 'customers', 'customer_ledger'], async (tx) => {
      const saleStore = tx.objectStore('sales');
      const itemStore = tx.objectStore('sale_items');
      const variantStore = tx.objectStore('product_variants');
      const customerStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');

      const saleRequest = saleStore.get(id);
      await new Promise((resolve, reject) => {
        saleRequest.onsuccess = () => resolve(saleRequest.result);
        saleRequest.onerror = () => reject(saleRequest.error);
      });

      const sale = saleRequest.result;
      if (!sale) return { changes: 0, message: 'Sale not found' };
      if (sale.is_deleted) return { changes: 0, message: 'Sale already deleted' };

      const itemsRequest = itemStore.getAll();
      await new Promise((resolve, reject) => {
        itemsRequest.onsuccess = () => resolve(itemsRequest.result);
        itemsRequest.onerror = () => reject(itemsRequest.error);
      });

      const items = itemsRequest.result.filter(x => x.sale_id === id);

      // Helper: Reverse customer balance
      const reverseCustomerBalance = async () => {
        if (sale.customer_id && Number(sale.due_amount) > 0) {
          const dueAmount = Number(sale.due_amount);
          const customerRequest = customerStore.get(sale.customer_id);
          await new Promise((resolve, reject) => {
            customerRequest.onsuccess = () => resolve(customerRequest.result);
            customerRequest.onerror = () => reject(customerRequest.error);
          });

          const customer = customerRequest.result;
          if (customer) {
            const previousBalance = Number(customer.current_balance) || 0;
            const newBalance = Math.max(0, previousBalance - dueAmount);
            customer.current_balance = newBalance;
            customer.updated_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const r = customerStore.put(customer);
              r.onsuccess = resolve;
              r.onerror = () => reject(r.error);
            });

            const reverseLedgerData = {
              id: generateId(),
              customer_id: sale.customer_id,
              type: 'sale_cancelled',
              amount: -dueAmount,
              previous_balance: previousBalance,
              balance_after: newBalance,
              description: `Sale cancelled: ${sale.invoice_no}`,
              payment_mode: 'adjustment',
              reference_no: sale.invoice_no,
              sale_id: id,
              date: new Date().toISOString(),
              items_json: '[]'
            };

            await new Promise((resolve, reject) => {
              const r = ledgerStore.add(reverseLedgerData);
              r.onsuccess = resolve;
              r.onerror = () => reject(r.error);
            });
          }
        }
      };

      if (items.length === 0) {
        await reverseCustomerBalance();

        sale.is_deleted = 1;
        sale.deleted_at = new Date().toISOString();
        await new Promise((resolve, reject) => {
          const r = saleStore.put(sale);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
        return { changes: 1, message: 'Sale deleted (no items to restore)' };
      }

      const restoredItems = [];

      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        const variantId = item.product_variant_id;

        if (!variantId || qty <= 0) continue;

        const variantRequest = variantStore.get(variantId);
        await new Promise((resolve, reject) => {
          variantRequest.onsuccess = () => resolve(variantRequest.result);
          variantRequest.onerror = () => reject(variantRequest.error);
        });

        const variant = variantRequest.result;
        if (!variant || variant.is_deleted) {
          throw new Error(`Variant ${variantId} not found or already deleted`);
        }

        const previousStock = variant.current_stock;
        variant.current_stock = this.safeAdd(variant.current_stock, qty);

        await new Promise((resolve, reject) => {
          const r = variantStore.put(variant);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });

        restoredItems.push({ variantId, qty, previousStock, newStock: variant.current_stock });
      }

      // Reverse customer balance after stock restore
      await reverseCustomerBalance();

      sale.is_deleted = 1;
      sale.deleted_at = new Date().toISOString();
      await new Promise((resolve, reject) => {
        const r = saleStore.put(sale);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });

      if (SYNC_ENABLED) {
        try {
          await syncToCloud('sales', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
          for (const restored of restoredItems) {
            await syncToCloud('product_variants', { id: restored.variantId, current_stock: restored.newStock });
          }
        } catch (syncErr) {
          console.error(`[deleteSale] Cloud sync failed:`, syncErr.message);
        }
      }

      return { changes: 1, message: 'Sale deleted successfully', restoredItems, restoredCount: restoredItems.length };
    });
  };

  // ==================== SALE RETURNS ====================
  StorageClass.prototype.getSaleReturns = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT sr.*, c.name as customer_name, s.invoice_no as original_invoice FROM sale_returns sr LEFT JOIN customers c ON sr.customer_id = c.id LEFT JOIN sales s ON sr.sale_id = s.id WHERE sr.is_deleted = 0 ORDER BY sr.id DESC`);
    }
    const [returns, customers, sales] = await Promise.all([
      idbGetAll('sale_returns'),
      idbGetAll('customers'),
      idbGetAll('sales')
    ]);
    return returns.filter(r => !r.is_deleted).map(r => ({
      ...r,
      customer_name: customers.find(c => c.id === r.customer_id)?.name || '',
      original_invoice: sales.find(s => s.id === r.sale_id)?.invoice_no || ''
    }));
  };

  StorageClass.prototype.getSaleReturnById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT sr.*, c.name as customer_name FROM sale_returns sr LEFT JOIN customers c ON sr.customer_id = c.id WHERE sr.id = ? AND sr.is_deleted = 0", [id]);
      return r[0] || null;
    }
    const r = await idbGetById('sale_returns', id);
    if (!r || r.is_deleted) return null;
    const customers = await idbGetAll('customers');
    return { ...r, customer_name: customers.find(c => c.id === r.customer_id)?.name || '' };
  };

  StorageClass.prototype.getSaleReturnItems = async function(saleReturnId) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT sri.*, pv.sku, p.name as product_name FROM sale_return_items sri JOIN product_variants pv ON sri.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id WHERE sri.sale_return_id = ?`, [saleReturnId]);
    }
    const [items, variants, prods, returns] = await Promise.all([
      idbGetAll('sale_return_items'),
      idbGetAll('product_variants'),
      idbGetAll('products'),
      idbGetAll('sale_returns')
    ]);
    const validReturnIds = new Set(returns.filter(r => !r.is_deleted).map(r => String(r.id)));
    return items
      .filter(x => x.sale_return_id === Number(saleReturnId) && validReturnIds.has(String(x.sale_return_id)))
      .map(i => {
        const v = variants.find(x => x.id === i.product_variant_id);
        return { ...i, sku: v?.sku || '', product_name: prods.find(x => x.id === v?.product_id)?.name || '' };
      });
  };

  // ==================== SALE RETURNS CREATE ====================
  StorageClass.prototype.createSaleReturn = async function(data) {
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const _res = await this.electronQuery(
          `INSERT INTO sale_returns (sale_id, invoice_no, return_no, customer_id, return_date, total_amount, discount_amount, tax_amount, refund_amount, payment_mode, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [data.sale_id, data.invoice_no, data.return_no, data.customer_id, data.return_date, data.total_amount, data.discount_amount, data.tax_amount, data.refund_amount, data.payment_mode, data.notes]
        );
        const returnId = _res.lastInsertRowid;

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          for (const item of data.items) {
            const qty = Number(item.quantity) || 0;
            const variantId = item.product_variant_id;

            if (!variantId || qty <= 0) continue;

            await this.electronQuery(
              `INSERT INTO sale_return_items (sale_return_id, product_variant_id, quantity, price, sub_total, reason) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [returnId, variantId, qty, item.price || 0, item.sub_total || 0, item.reason || '']
            );

            await this.electronQuery(
              "UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?",
              [qty, variantId]
            );
          }
        }

        if (SYNC_ENABLED) {
          await syncToCloud('sale_returns', { ...data, id: returnId });
        }
        return _res;
      });
    }

    return idbTransaction(['sale_returns', 'sale_return_items', 'product_variants'], async (tx) => {
      const returnStore = tx.objectStore('sale_returns');
      const itemStore = tx.objectStore('sale_return_items');
      const variantStore = tx.objectStore('product_variants');

      const returnId = generateId();
      const returnData = { ...data, id: returnId, is_deleted: 0 };

      await new Promise((resolve, reject) => {
        const r = returnStore.add(returnData);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;

          if (!variantId || qty <= 0) continue;

          const itemData = {
            sale_return_id: returnId,
            product_variant_id: variantId,
            quantity: qty,
            price: item.price || 0,
            sub_total: item.sub_total || 0,
            reason: item.reason || ''
          };

          await new Promise((resolve, reject) => {
            const r = itemStore.add(itemData);
            r.onsuccess = resolve;
            r.onerror = () => reject(r.error);
          });

          const variantRequest = variantStore.get(variantId);
          await new Promise((resolve, reject) => {
            variantRequest.onsuccess = () => resolve(variantRequest.result);
            variantRequest.onerror = () => reject(variantRequest.error);
          });

          const variant = variantRequest.result;
          if (variant) {
            variant.current_stock = this.safeAdd(variant.current_stock, qty);
            await new Promise((resolve, reject) => {
              const r = variantStore.put(variant);
              r.onsuccess = resolve;
              r.onerror = () => reject(r.error);
            });
          }
        }
      }

      if (SYNC_ENABLED) {
        await syncToCloud('sale_returns', { ...data, id: returnId });
      }

      return { lastInsertRowid: returnId, changes: 1 };
    });
  };

  StorageClass.prototype.createSaleReturnItem = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO sale_return_items (sale_return_id, product_variant_id, quantity, price, sub_total, reason) VALUES (?, ?, ?, ?, ?, ?)`, [data.sale_return_id, data.product_variant_id, data.quantity, data.price, data.sub_total, data.reason]);
      if (SYNC_ENABLED) {
        await syncToCloud('sale_return_items', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('sale_return_items', data);
  };

  StorageClass.prototype.updateSaleReturn = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE sale_returns SET sale_id = ?, invoice_no = ?, return_no = ?, customer_id = ?, return_date = ?, total_amount = ?, discount_amount = ?, tax_amount = ?, refund_amount = ?, payment_mode = ?, notes = ? WHERE id = ?`, [data.sale_id, data.invoice_no, data.return_no, data.customer_id, data.return_date, data.total_amount, data.discount_amount, data.tax_amount, data.refund_amount, data.payment_mode, data.notes, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('sale_returns', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('sale_returns', id);
    if (!e) return { changes: 0 };
    return idbPut('sale_returns', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteSaleReturn = async function(id) { 
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const ret = await this.electronQuery("SELECT customer_id, refund_amount FROM sale_returns WHERE id = ? AND is_deleted = 0", [id]);
        const items = await this.electronQuery("SELECT product_variant_id, quantity FROM sale_return_items WHERE sale_return_id = ?", [id]);

        for (const item of items) {
          await this.electronQuery("UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?", [item.quantity, item.product_variant_id]);
        }

        if (ret && ret.length > 0 && ret[0].customer_id && ret[0].refund_amount > 0) {
          const prev = await this.electronQuery("SELECT current_balance FROM customers WHERE id = ?", [ret[0].customer_id]);
          const prevBal = Number(prev[0]?.current_balance) || 0;
          const newBal = prevBal + Number(ret[0].refund_amount);
          await this.electronQuery("UPDATE customers SET current_balance = ? WHERE id = ?", [newBal, ret[0].customer_id]);
          await this.electronQuery(
            `INSERT INTO customer_ledger (customer_id, type, amount, previous_balance, balance_after, description, payment_mode, reference_no, date, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
            [ret[0].customer_id, 'return_reversal', ret[0].refund_amount, prevBal, newBal, `Sale Return Deleted - Reversal`, 'adjustment', `REV-${id}`, '[]']
          );
        }

        const _res = await this.electronQuery("UPDATE sale_returns SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
        if (SYNC_ENABLED) {
          await syncToCloud('sale_returns', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
        }
        return _res;
      });
    }

    return idbTransaction(['sale_returns', 'sale_return_items', 'product_variants', 'customers', 'customer_ledger'], async (tx) => {
      const returnStore = tx.objectStore('sale_returns');
      const itemStore = tx.objectStore('sale_return_items');
      const variantStore = tx.objectStore('product_variants');
      const customerStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');

      const retReq = returnStore.get(id);
      await new Promise((res, rej) => { retReq.onsuccess = () => res(retReq.result); retReq.onerror = () => rej(retReq.error); });
      const ret = retReq.result;
      if (!ret || ret.is_deleted) return { changes: 0 };

      const itemsReq = itemStore.getAll();
      await new Promise((res, rej) => { itemsReq.onsuccess = () => res(itemsReq.result); itemsReq.onerror = () => rej(itemsReq.error); });
      const items = itemsReq.result.filter(x => String(x.sale_return_id) === String(id));

      for (const item of items) {
        const vReq = variantStore.get(item.product_variant_id);
        await new Promise((res, rej) => { vReq.onsuccess = () => res(vReq.result); vReq.onerror = () => rej(vReq.error); });
        const v = vReq.result;
        if (v) {
          v.current_stock = (Number(v.current_stock) || 0) - Number(item.quantity);
          await new Promise((res, rej) => { const r = variantStore.put(v); r.onsuccess = res; r.onerror = () => rej(r.error); });
        }
      }

      if (ret.customer_id && ret.refund_amount > 0) {
        const cReq = customerStore.get(ret.customer_id);
        await new Promise((res, rej) => { cReq.onsuccess = () => res(cReq.result); cReq.onerror = () => rej(cReq.error); });
        const c = cReq.result;
        if (c) {
          const prevBal = Number(c.current_balance) || 0;
          c.current_balance = prevBal + Number(ret.refund_amount);
          await new Promise((res, rej) => { const r = customerStore.put(c); r.onsuccess = res; r.onerror = () => rej(r.error); });

          const ledgerData = {
            id: generateId(),
            customer_id: ret.customer_id,
            type: 'return_reversal',
            amount: Number(ret.refund_amount),
            previous_balance: prevBal,
            balance_after: c.current_balance,
            description: `Sale Return Deleted - Reversal`,
            payment_mode: 'adjustment',
            reference_no: `REV-${id}`,
            date: new Date().toISOString(),
            items_json: '[]'
          };
          await new Promise((res, rej) => { const r = ledgerStore.add(ledgerData); r.onsuccess = res; r.onerror = () => rej(r.error); });
        }
      }

      ret.is_deleted = 1;
      ret.deleted_at = new Date().toISOString();
      await new Promise((res, rej) => { const r = returnStore.put(ret); r.onsuccess = res; r.onerror = () => rej(r.error); });

      if (SYNC_ENABLED) {
        await syncToCloud('sale_returns', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return { changes: 1 };
    });
  };

}