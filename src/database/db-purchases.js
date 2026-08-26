// ============================================================
//  db-purchases.js — Purchases & Purchase Returns Module (Mixin)
//  FIXED: Account deductions, supplier balance accuracy, payment tracking
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbTransaction } from './core/idb-core.js';
import { generateId } from './core/utils.js';

export function attachPurchaseMethods(StorageClass) {

  // ==================== PURCHASES ====================
  StorageClass.prototype.getPurchases = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT p.*, s.name as supplier_name, s.company_name as supplier_company FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
    }
    const [purchases, suppliers] = await Promise.all([
      idbGetAll('purchases'),
      idbGetAll('suppliers')
    ]);
    return purchases.filter(x => !x.is_deleted).map(p => ({
      ...p,
      supplier_name: suppliers.find(s => s.id === p.supplier_id)?.name || '',
      supplier_company: suppliers.find(s => s.id === p.supplier_id)?.company_name || ''
    }));
  };

  StorageClass.prototype.getPurchaseById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ? AND p.is_deleted = 0", [id]);
      return r[0] || null;
    }
    const p = await idbGetById('purchases', id);
    if (!p || p.is_deleted) return null;
    const suppliers = await idbGetAll('suppliers');
    return { ...p, supplier_name: suppliers.find(s => s.id === p.supplier_id)?.name || '' };
  };

  StorageClass.prototype.getPurchaseItems = async function(purchaseId) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT pi.*, pv.sku, pv.variant_name, p.name as product_name 
         FROM purchase_items pi 
         JOIN product_variants pv ON pi.product_variant_id = pv.id 
         JOIN products p ON pv.product_id = p.id 
         WHERE pi.purchase_id = ?`,
        [purchaseId]
      );
    }

    try {
      const allItems = await idbGetAll('purchase_items');
      const filtered = allItems.filter(x => String(x.purchase_id) === String(purchaseId));

      if (filtered.length === 0) {
        return [];
      }

      const variants = await idbGetAll('product_variants');
      const products = await idbGetAll('products');

      return filtered.map(item => {
        const variant = variants.find(v => String(v.id) === String(item.product_variant_id));
        const product = variant ? products.find(p => String(p.id) === String(variant.product_id)) : null;

        return {
          ...item,
          sku: variant?.sku || '',
          variant_name: variant?.variant_name || '',
          product_name: product?.name || ''
        };
      });
    } catch (error) {
      console.error('[getPurchaseItems] Error:', error);
      return [];
    }
  };

  // ==================== ATOMIC PURCHASE CREATE ====================
  StorageClass.prototype.createPurchase = async function(data) {
    const hasItems = data.items && Array.isArray(data.items) && data.items.length > 0;

    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        if (hasItems) {
          for (const item of data.items) {
            const qty = Number(item.quantity) || 0;
            const variantId = item.product_variant_id;
            if (!variantId || variantId === '' || variantId == 0 || qty <= 0) {
              throw new Error(`Invalid item: variant=${variantId}, qty=${qty}`);
            }

            const variant = await this.electronQuery(
              "SELECT id FROM product_variants WHERE id = ? AND is_deleted = 0",
              [variantId]
            );
            if (!variant[0]) {
              throw new Error(`Variant ${variantId} not found`);
            }
          }
        }

        const _res = await this.electronQuery(
          `INSERT INTO purchases (supplier_id, purchase_no, supplier_invoice_no, purchase_date, due_date, status, total_amount, discount_amount, tax_amount, shipping_charges, grand_total, paid_amount, payment_status, notes, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode]
        );
        const purchaseId = _res.lastInsertRowid;

        if (hasItems) {
          for (const item of data.items) {
            const qty = Number(item.quantity) || 0;
            const variantId = item.product_variant_id;
            await this.electronQuery(
              `INSERT INTO purchase_items (purchase_id, product_variant_id, quantity, purchase_price, tax_percentage, sub_total, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [purchaseId, variantId, qty, item.purchase_price, item.tax_percentage, item.sub_total, item.expiry_date]
            );
            const stockResult = await this.electronQuery(
              "UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?",
              [qty, variantId]
            );
            if (stockResult.changes === 0) {
              throw new Error(`Failed to update stock for variant ${variantId}`);
            }
          }
        }

        // Update supplier balance (full liability)
        if (data.grand_total && data.supplier_id) {
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?",
            [data.grand_total, data.supplier_id]
          );
        }

        // FIXED: Handle initial payment if paid_amount > 0
        if (data.paid_amount && Number(data.paid_amount) > 0 && data.supplier_id) {
          const paidAmt = Number(data.paid_amount);
          const payMode = data.payment_mode || 'cash';

          // Deduct from account (bank/jazzcash/etc)
          if (this.deductFromAccount) {
            try {
              await this.deductFromAccount(
                payMode,
                paidAmt,
                `Purchase initial payment: ${data.purchase_no || purchaseId}`,
                'purchase_payment',
                purchaseId
              );
            } catch (accErr) {
              console.error('[createPurchase] Account deduction failed:', accErr);
              throw new Error(`Payment failed: ${accErr.message}`);
            }
          }

          // Reduce supplier balance by paid amount (net liability = grand_total - paid)
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?",
            [paidAmt, data.supplier_id]
          );

          // Record payment history via addPayment if available
          if (this.addPayment) {
            try {
              await this.addPayment({
                supplier_id: data.supplier_id,
                purchase_id: purchaseId,
                amount: paidAmt,
                type: 'payment',
                payment_mode: payMode,
                note: `Initial payment for purchase ${data.purchase_no || purchaseId}`,
                date: data.purchase_date || new Date().toISOString()
              });
            } catch (payErr) {
              console.warn('[createPurchase] Payment record failed:', payErr);
            }
          }
        }

        if (SYNC_ENABLED) {
          await syncToCloud('purchases', { ...data, id: purchaseId });
        }

        return _res;
      });
    }

    return idbTransaction(['purchases', 'purchase_items', 'product_variants', 'suppliers'], async (tx) => {
      const purchaseStore = tx.objectStore('purchases');
      const itemStore = tx.objectStore('purchase_items');
      const variantStore = tx.objectStore('product_variants');
      const supplierStore = tx.objectStore('suppliers');

      if (hasItems) {
        for (const item of data.items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;
          if (!variantId || variantId === '' || variantId == 0 || qty <= 0) {
            throw new Error(`Invalid item: variant=${variantId}, qty=${qty}`);
          }

          const variantRequest = variantStore.get(variantId);
          const variant = await new Promise((resolve, reject) => {
            variantRequest.onsuccess = () => resolve(variantRequest.result);
            variantRequest.onerror = () => reject(variantRequest.error);
          });

          if (!variant || variant.is_deleted) {
            throw new Error(`Variant ${variantId} not found`);
          }
        }
      }

      let purchaseId;
      try {
        purchaseId = generateId();
      } catch (e) {
        purchaseId = `purch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      if (!purchaseId) {
        purchaseId = `purch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      const purchaseData = {
        id: purchaseId,
        supplier_id: Number(data.supplier_id),
        purchase_no: data.purchase_no || `PUR-${Date.now()}`,
        supplier_invoice_no: data.supplier_invoice_no || '',
        purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date || null,
        status: data.status || 'received',
        total_amount: Number(data.total_amount) || 0,
        discount_amount: Number(data.discount_amount) || 0,
        tax_amount: Number(data.tax_amount) || 0,
        shipping_charges: Number(data.shipping_charges) || 0,
        grand_total: Number(data.grand_total) || 0,
        paid_amount: Number(data.paid_amount) || 0,
        payment_status: data.payment_status || 'due',
        notes: data.notes || '',
        payment_mode: data.payment_mode || 'cash',
        is_deleted: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await new Promise((resolve, reject) => {
        const request = purchaseStore.put(purchaseData);
        request.onsuccess = () => resolve(request);
        request.onerror = (event) => reject(event.target.error);
      });

      if (hasItems) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;

          let itemId;
          try {
            itemId = generateId();
          } catch (e) {
            itemId = `item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
          }
          if (!itemId) {
            itemId = `item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
          }

          const itemData = {
            id: itemId,
            purchase_id: purchaseId,
            product_variant_id: variantId,
            quantity: qty,
            purchase_price: Number(item.purchase_price) || 0,
            tax_percentage: Number(item.tax_percentage) || 0,
            sub_total: Number(item.sub_total) || (qty * (Number(item.purchase_price) || 0)),
            expiry_date: item.expiry_date || null,
            created_at: new Date().toISOString()
          };

          await new Promise((resolve, reject) => {
            const request = itemStore.put(itemData);
            request.onsuccess = () => resolve(request);
            request.onerror = (event) => reject(event.target.error);
          });

          const variantRequest = variantStore.get(variantId);
          const variant = await new Promise((resolve, reject) => {
            variantRequest.onsuccess = () => resolve(variantRequest.result);
            variantRequest.onerror = () => reject(variantRequest.error);
          });

          if (variant) {
            const newStock = this.safeAdd(variant.current_stock, qty);
            variant.current_stock = newStock;
            variant.updated_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const request = variantStore.put(variant);
              request.onsuccess = resolve;
              request.onerror = () => reject(request.error);
            });
          }
        }
      }

      // Update supplier balance (full liability)
      if (data.grand_total && data.supplier_id) {
        const supplierRequest = supplierStore.get(Number(data.supplier_id));
        const supplier = await new Promise((resolve, reject) => {
          supplierRequest.onsuccess = () => resolve(supplierRequest.result);
          supplierRequest.onerror = () => reject(supplierRequest.error);
        });

        if (supplier) {
          supplier.current_balance = this.safeAdd(supplier.current_balance, Number(data.grand_total));
          supplier.updated_at = new Date().toISOString();

          await new Promise((resolve, reject) => {
            const request = supplierStore.put(supplier);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }
      }

      // FIXED: Handle initial payment if paid_amount > 0
      if (data.paid_amount && Number(data.paid_amount) > 0 && data.supplier_id) {
        const paidAmt = Number(data.paid_amount);
        const payMode = data.payment_mode || 'cash';

        // Deduct from account
        if (this.deductFromAccount) {
          try {
            await this.deductFromAccount(
              payMode,
              paidAmt,
              `Purchase initial payment: ${data.purchase_no || purchaseId}`,
              'purchase_payment',
              purchaseId
            );
          } catch (accErr) {
            console.error('[createPurchase] Account deduction failed:', accErr);
            throw new Error(`Payment failed: ${accErr.message}`);
          }
        }

        // Reduce supplier balance by paid amount
        const supplierRequest = supplierStore.get(Number(data.supplier_id));
        const supplier = await new Promise((resolve, reject) => {
          supplierRequest.onsuccess = () => resolve(supplierRequest.result);
          supplierRequest.onerror = () => reject(supplierRequest.error);
        });

        if (supplier) {
          supplier.current_balance = this.safeSub(supplier.current_balance, paidAmt);
          supplier.updated_at = new Date().toISOString();
          await new Promise((resolve, reject) => {
            const request = supplierStore.put(supplier);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        // Record payment via addPayment if available
        if (this.addPayment) {
          try {
            await this.addPayment({
              supplier_id: Number(data.supplier_id),
              purchase_id: purchaseId,
              amount: paidAmt,
              type: 'payment',
              payment_mode: payMode,
              note: `Initial payment for purchase ${data.purchase_no || purchaseId}`,
              date: data.purchase_date || new Date().toISOString()
            });
          } catch (payErr) {
            console.warn('[createPurchase] Payment record failed:', payErr);
          }
        }
      }

      if (SYNC_ENABLED) {
        try {
          await syncToCloud('purchases', { ...data, id: purchaseId });
        } catch (syncErr) {
          console.warn('Cloud sync failed (non-critical):', syncErr.message);
        }
      }

      return { lastInsertRowid: purchaseId, changes: 1 };
    });
  };

  // ==================== FIXED: UPDATE PURCHASE WITH FINANCIAL DELTA HANDLING ====================
  StorageClass.prototype.updatePurchase = async function(id, data) { 
    if (this.mode === 'electron') {
      const oldPurchase = await this.electronQuery(
        "SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", [id]
      );
      if (!oldPurchase || oldPurchase.length === 0) {
        return { changes: 0, message: 'Purchase not found' };
      }
      const old = oldPurchase[0];

      return this.electronTransaction(async () => {
        const _res = await this.electronQuery(
          `UPDATE purchases SET supplier_id = ?, purchase_no = ?, supplier_invoice_no = ?, purchase_date = ?, due_date = ?, status = ?, total_amount = ?, discount_amount = ?, tax_amount = ?, shipping_charges = ?, grand_total = ?, paid_amount = ?, payment_status = ?, notes = ?, payment_mode = ? WHERE id = ?`,
          [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode, id]
        );

        // Calculate financial deltas
        const oldGrandTotal = Number(old.grand_total || 0);
        const newGrandTotal = Number(data.grand_total !== undefined ? data.grand_total : old.grand_total);
        const oldPaid = Number(old.paid_amount || 0);
        const newPaid = Number(data.paid_amount !== undefined ? data.paid_amount : old.paid_amount);
        const oldSupplierId = old.supplier_id;
        const newSupplierId = data.supplier_id !== undefined ? data.supplier_id : oldSupplierId;

        const oldNet = oldGrandTotal - oldPaid;
        const newNet = newGrandTotal - newPaid;
        const supplierDelta = newNet - oldNet;
        const paymentDelta = newPaid - oldPaid;

        // Adjust new supplier balance
        if (supplierDelta !== 0 && newSupplierId) {
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?",
            [supplierDelta, newSupplierId]
          );
        }

        // If supplier changed, reverse old supplier liability
        if (oldSupplierId && newSupplierId && oldSupplierId !== newSupplierId && oldNet !== 0) {
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?",
            [oldNet, oldSupplierId]
          );
        }

        // Handle payment account changes
        if (paymentDelta !== 0) {
          const payMode = data.payment_mode || old.payment_mode || 'cash';
          if (paymentDelta > 0) {
            if (this.deductFromAccount) {
              await this.deductFromAccount(
                payMode,
                paymentDelta,
                `Purchase additional payment: ${data.purchase_no || id}`,
                'purchase_payment',
                id
              );
            }
          } else {
            if (this.creditToAccount) {
              await this.creditToAccount(
                payMode,
                Math.abs(paymentDelta),
                `Purchase payment adjustment: ${data.purchase_no || id}`,
                'purchase_payment_adjustment',
                id
              );
            }
          }
        }

        if (SYNC_ENABLED) {
          await syncToCloud('purchases', { ...data, id });
        }
        return _res;
      });
    }

    // IDB mode
    const e = await idbGetById('purchases', id);
    if (!e) return { changes: 0 };

    const oldGrandTotal = Number(e.grand_total || 0);
    const oldPaid = Number(e.paid_amount || 0);
    const oldNet = oldGrandTotal - oldPaid;
    const oldSupplierId = e.supplier_id;

    const newGrandTotal = Number(data.grand_total !== undefined ? data.grand_total : e.grand_total);
    const newPaid = Number(data.paid_amount !== undefined ? data.paid_amount : e.paid_amount);
    const newNet = newGrandTotal - newPaid;
    const newSupplierId = data.supplier_id !== undefined ? data.supplier_id : oldSupplierId;

    const supplierDelta = newNet - oldNet;
    const paymentDelta = newPaid - oldPaid;

    const updateRes = await idbPut('purchases', { ...e, ...data, id: e.id });

    if (supplierDelta !== 0 && newSupplierId) {
      try {
        const supplier = await idbGetById('suppliers', Number(newSupplierId));
        if (supplier) {
          supplier.current_balance = this.safeAdd(supplier.current_balance, supplierDelta);
          await idbPut('suppliers', supplier);
        }
      } catch (err) {
        console.error('[updatePurchase] Supplier balance update failed:', err);
      }
    }

    if (oldSupplierId && newSupplierId && oldSupplierId !== newSupplierId && oldNet !== 0) {
      try {
        const oldSupplier = await idbGetById('suppliers', Number(oldSupplierId));
        if (oldSupplier) {
          oldSupplier.current_balance = this.safeSub(oldSupplier.current_balance, oldNet);
          await idbPut('suppliers', oldSupplier);
        }
      } catch (err) {
        console.error('[updatePurchase] Old supplier balance reversal failed:', err);
      }
    }

    if (paymentDelta !== 0) {
      const payMode = data.payment_mode || e.payment_mode || 'cash';
      if (paymentDelta > 0) {
        if (this.deductFromAccount) {
          try {
            await this.deductFromAccount(
              payMode,
              paymentDelta,
              `Purchase additional payment: ${data.purchase_no || id}`,
              'purchase_payment',
              id
            );
          } catch (accErr) {
            console.error('[updatePurchase] Account deduction failed:', accErr);
          }
        }
      } else {
        if (this.creditToAccount) {
          try {
            await this.creditToAccount(
              payMode,
              Math.abs(paymentDelta),
              `Purchase payment adjustment: ${data.purchase_no || id}`,
              'purchase_payment_adjustment',
              id
            );
          } catch (accErr) {
            console.error('[updatePurchase] Account credit failed:', accErr);
          }
        }
      }
    }

    return updateRes;
  };

  // ==================== FIXED: DELETE PURCHASE WITH ATOMIC STOCK RESTORE ====================
  StorageClass.prototype.deletePurchase = async function(id) {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new Error('[deletePurchase] Invalid purchase ID provided');
    }

    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const items = await this.electronQuery(
          "SELECT * FROM purchase_items WHERE purchase_id = ?",
          [id]
        );
        const purchase = await this.electronQuery(
          "SELECT * FROM purchases WHERE id = ? AND is_deleted = 0",
          [id]
        );

        if (!purchase || purchase.length === 0) {
          return { changes: 0, message: 'Purchase not found' };
        }
        if (purchase[0].is_deleted) {
          return { changes: 0, message: 'Purchase already deleted' };
        }

        const restoredItems = [];
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const variantId = item.product_variant_id;

          if (!variantId || qty <= 0) continue;

          const stockUpdate = await this.electronQuery(
            "UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ? AND is_deleted = 0",
            [qty, variantId, qty]
          );

          if (stockUpdate.changes > 0) {
            const updated = await this.electronQuery(
              "SELECT current_stock FROM product_variants WHERE id = ?",
              [variantId]
            );
            restoredItems.push({ 
              variantId, 
              qty, 
              newStock: updated[0]?.current_stock || 0 
            });
          } else {
            const check = await this.electronQuery(
              "SELECT id, current_stock FROM product_variants WHERE id = ? AND is_deleted = 0",
              [variantId]
            );
            if (check && check.length > 0) {
              console.warn(`[deletePurchase] Could not restore stock for variant ${variantId}. Current stock: ${check[0].current_stock}, Trying to remove: ${qty}`);
            }
          }
        }

        // FIXED: Reverse supplier balance correctly (net effect = grand_total - paid_amount)
        const grandTotal = Number(purchase[0].grand_total || 0);
        const paidAmount = Number(purchase[0].paid_amount || 0);
        const netSupplierEffect = grandTotal - paidAmount;

        if (purchase[0].supplier_id && netSupplierEffect !== 0) {
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?",
            [netSupplierEffect, purchase[0].supplier_id]
          );
        }

        // FIXED: Reverse account deduction if purchase had payment
        if (paidAmount > 0) {
          const payMode = purchase[0].payment_mode || 'cash';
          if (this.creditToAccount) {
            try {
              await this.creditToAccount(
                payMode,
                paidAmount,
                `Purchase deleted - refund: ${purchase[0].purchase_no || id}`,
                'purchase_delete_refund',
                id
              );
            } catch (accErr) {
              console.warn('[deletePurchase] Account credit failed:', accErr);
            }
          }
        }

        const _res = await this.electronQuery(
          "UPDATE purchases SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
          [id]
        );

        if (SYNC_ENABLED) {
          await syncToCloud('purchases', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
          for (const restored of restoredItems) {
            await syncToCloud('product_variants', { id: restored.variantId, current_stock: restored.newStock });
          }
        }

        return { changes: 1, message: 'Purchase deleted successfully', restoredItems, restoredCount: restoredItems.length };
      });
    }

    return idbTransaction(['purchases', 'purchase_items', 'product_variants', 'suppliers'], async (tx) => {
      const purchaseStore = tx.objectStore('purchases');
      const itemStore = tx.objectStore('purchase_items');
      const variantStore = tx.objectStore('product_variants');
      const supplierStore = tx.objectStore('suppliers');

      const purchaseRequest = purchaseStore.get(id);
      await new Promise((resolve, reject) => {
        purchaseRequest.onsuccess = () => resolve(purchaseRequest.result);
        purchaseRequest.onerror = () => reject(purchaseRequest.error);
      });

      const purchase = purchaseRequest.result;
      if (!purchase) return { changes: 0, message: 'Purchase not found' };
      if (purchase.is_deleted) return { changes: 0, message: 'Purchase already deleted' };

      const itemsRequest = itemStore.getAll();
      await new Promise((resolve, reject) => {
        itemsRequest.onsuccess = () => resolve(itemsRequest.result);
        itemsRequest.onerror = () => reject(itemsRequest.error);
      });

      const items = itemsRequest.result.filter(x => x.purchase_id === id);

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
        if (variant && !variant.is_deleted) {
          const previousStock = variant.current_stock;
          variant.current_stock = this.safeSub(variant.current_stock, qty);
          await new Promise((resolve, reject) => {
            const r = variantStore.put(variant);
            r.onsuccess = resolve;
            r.onerror = () => reject(r.error);
          });
          restoredItems.push({ variantId, qty, previousStock, newStock: variant.current_stock });
        }
      }

      // FIXED: Reverse supplier balance correctly
      const grandTotal = Number(purchase.grand_total || 0);
      const paidAmount = Number(purchase.paid_amount || 0);
      const netSupplierEffect = grandTotal - paidAmount;

      if (purchase.supplier_id && netSupplierEffect !== 0) {
        const supplierRequest = supplierStore.get(purchase.supplier_id);
        await new Promise((resolve, reject) => {
          supplierRequest.onsuccess = () => resolve(supplierRequest.result);
          supplierRequest.onerror = () => reject(supplierRequest.error);
        });

        const supplier = supplierRequest.result;
        if (supplier) {
          supplier.current_balance = this.safeSub(supplier.current_balance, netSupplierEffect);
          await new Promise((resolve, reject) => {
            const r = supplierStore.put(supplier);
            r.onsuccess = resolve;
            r.onerror = () => reject(r.error);
          });
        }
      }

      // FIXED: Reverse account deduction if purchase had payment
      if (paidAmount > 0) {
        const payMode = purchase.payment_mode || 'cash';
        if (this.creditToAccount) {
          try {
            await this.creditToAccount(
              payMode,
              paidAmount,
              `Purchase deleted - refund: ${purchase.purchase_no || id}`,
              'purchase_delete_refund',
              id
            );
          } catch (accErr) {
            console.warn('[deletePurchase] Account credit failed:', accErr);
          }
        }
      }

      purchase.is_deleted = 1;
      purchase.deleted_at = new Date().toISOString();
      await new Promise((resolve, reject) => {
        const r = purchaseStore.put(purchase);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });

      if (SYNC_ENABLED) {
        await syncToCloud('purchases', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
        for (const restored of restoredItems) {
          await syncToCloud('product_variants', { id: restored.variantId, current_stock: restored.newStock });
        }
      }

      return { changes: 1, message: 'Purchase deleted successfully', restoredItems, restoredCount: restoredItems.length };
    });
  };

  StorageClass.prototype.createPurchaseItem = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO purchase_items (purchase_id, product_variant_id, quantity, purchase_price, tax_percentage, sub_total, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [data.purchase_id, data.product_variant_id, data.quantity, data.purchase_price, data.tax_percentage, data.sub_total, data.expiry_date]);
      if (SYNC_ENABLED) {
        await syncToCloud('purchase_items', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('purchase_items', data);
  };

  StorageClass.prototype.getPriceHistory = async function(variantId, limit = 3) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT pi.purchase_price, p.purchase_date, s.name as supplier_name 
        FROM purchase_items pi 
        JOIN purchases p ON pi.purchase_id = p.id 
        LEFT JOIN suppliers s ON p.supplier_id = s.id 
        WHERE pi.product_variant_id = ? AND p.is_deleted = 0 
        ORDER BY p.purchase_date DESC, p.id DESC LIMIT ?`, [variantId, limit]);
    }
    const [allItems, purchases, suppliers] = await Promise.all([
      idbGetAll('purchase_items'),
      idbGetAll('purchases'),
      idbGetAll('suppliers')
    ]);

    const validPurchaseIds = new Set(purchases.filter(p => !p.is_deleted).map(p => String(p.id)));

    const relevant = allItems
      .filter(x => String(x.product_variant_id) === String(variantId))
      .filter(x => validPurchaseIds.has(String(x.purchase_id)))
      .sort((a, b) => {
        const pa = purchases.find(p => p.id === a.purchase_id);
        const pb = purchases.find(p => p.id === b.purchase_id);
        const dateA = pa?.purchase_date || '';
        const dateB = pb?.purchase_date || '';
        if (dateA !== dateB) {
          return new Date(dateB) - new Date(dateA);
        }
        return b.id - a.id;
      })
      .slice(0, limit);

    return relevant.map(item => {
      const purchase = purchases.find(p => p.id === item.purchase_id);
      const supplier = suppliers.find(s => s.id === purchase?.supplier_id);
      return {
        purchase_price: item.purchase_price || 0,
        purchase_date: purchase?.purchase_date || '',
        supplier_name: supplier?.name || 'N/A'
      };
    });
  };

  // ============================================================
  // ==================== PURCHASE RETURNS ====================
  // ============================================================

  StorageClass.prototype.getPurchaseReturns = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `
        SELECT pr.*, p.purchase_no, s.name as supplier_name
        FROM purchase_returns pr
        LEFT JOIN purchases p ON pr.purchase_id = p.id
        LEFT JOIN suppliers s ON pr.supplier_id = s.id
        WHERE pr.is_deleted = 0
      `;
      const params = [];

      if (filters.supplierId) {
        sql += " AND pr.supplier_id = ?";
        params.push(filters.supplierId);
      }
      if (filters.fromDate) {
        sql += " AND DATE(pr.return_date) >= DATE(?)";
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        sql += " AND DATE(pr.return_date) <= DATE(?)";
        params.push(filters.toDate);
      }
      if (filters.status) {
        sql += " AND pr.status = ?";
        params.push(filters.status);
      }

      sql += " ORDER BY pr.id DESC";
      const rows = await this.electronQuery(sql, params);

      const returnsWithCount = await Promise.all(rows.map(async (row) => {
        const countResult = await this.electronQuery(
          "SELECT COUNT(*) as count FROM purchase_return_items WHERE purchase_return_id = ?",
          [row.id]
        );
        return {
          ...row,
          items_count: countResult[0]?.count || 0
        };
      }));

      return returnsWithCount;
    }

    const returns = await idbGetAll('purchase_returns');
    const purchases = await idbGetAll('purchases');
    const suppliers = await idbGetAll('suppliers');
    const items = await idbGetAll('purchase_return_items');

    let result = returns.filter(x => !x.is_deleted);

    if (filters.supplierId) {
      result = result.filter(x => String(x.supplier_id) === String(filters.supplierId));
    }
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      result = result.filter(x => new Date(x.return_date) >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      result = result.filter(x => new Date(x.return_date) <= to);
    }
    if (filters.status) {
      result = result.filter(x => x.status === filters.status);
    }

    return result.map(r => ({
      ...r,
      purchase_no: purchases.find(p => String(p.id) === String(r.purchase_id))?.purchase_no || '',
      supplier_name: suppliers.find(s => String(s.id) === String(r.supplier_id))?.name || '',
      items_count: items.filter(i => String(i.purchase_return_id) === String(r.id)).length
    }));
  };

  StorageClass.prototype.getPurchaseReturnById = async function(id) {
    if (this.mode === 'electron') {
      const row = await this.electronQuery(`
        SELECT pr.*, p.purchase_no, s.name as supplier_name 
        FROM purchase_returns pr
        LEFT JOIN purchases p ON pr.purchase_id = p.id
        LEFT JOIN suppliers s ON pr.supplier_id = s.id
        WHERE pr.id = ? AND pr.is_deleted = 0
      `, [id]);

      if (!row || row.length === 0) {
        return { success: false, error: 'Return not found' };
      }

      const items = await this.electronQuery(`
        SELECT 
          pri.*, 
          pv.sku, 
          p.name as product_name, 
          pv.variant_name,
          pv.id as variant_id
        FROM purchase_return_items pri
        LEFT JOIN product_variants pv ON pri.product_variant_id = pv.id
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE pri.purchase_return_id = ?
      `, [id]);

      return { 
        success: true, 
        data: { 
          ...row[0], 
          items: items || [] 
        } 
      };
    }

    try {
      const result = await idbGetById('purchase_returns', id);
      if (!result || result.is_deleted) {
        return { success: false, error: 'Return not found' };
      }

      const allItems = await idbGetAll('purchase_return_items');
      const items = allItems.filter(x => String(x.purchase_return_id) === String(id));

      const variants = await idbGetAll('product_variants');
      const products = await idbGetAll('products');

      const itemsWithDetails = items.map(item => {
        const variant = variants.find(v => String(v.id) === String(item.product_variant_id));
        const product = variant ? products.find(p => String(p.id) === String(variant.product_id)) : null;

        return {
          ...item,
          sku: variant?.sku || '',
          product_name: product?.name || '',
          variant_name: variant?.variant_name || 'Default',
          variant_id: variant?.id || item.product_variant_id
        };
      });

      const purchases = await idbGetAll('purchases');
      const suppliers = await idbGetAll('suppliers');

      const purchase = purchases.find(p => String(p.id) === String(result.purchase_id));
      const supplier = suppliers.find(s => String(s.id) === String(result.supplier_id));

      return {
        success: true,
        data: {
          ...result,
          purchase_no: purchase?.purchase_no || '',
          supplier_name: supplier?.name || '',
          items: itemsWithDetails
        }
      };
    } catch (error) {
      console.error('Error in getPurchaseReturnById:', error);
      return { success: false, error: error.message };
    }
  };

  StorageClass.prototype.getPurchaseReturnItems = async function(returnId) {
    if (this.mode === 'electron') {
      return this.electronQuery(`
        SELECT pri.*, pv.sku, p.name as product_name, pv.variant_name
        FROM purchase_return_items pri
        LEFT JOIN product_variants pv ON pri.product_variant_id = pv.id
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE pri.purchase_return_id = ?
      `, [returnId]);
    }

    const allItems = await idbGetAll('purchase_return_items');
    const variants = await idbGetAll('product_variants');
    const products = await idbGetAll('products');

    return allItems
      .filter(x => String(x.purchase_return_id) === String(returnId))
      .map(i => {
        const v = variants.find(x => String(x.id) === String(i.product_variant_id));
        const p = products.find(x => String(x.id) === String(v?.product_id));
        return {
          ...i,
          sku: v?.sku || '',
          product_name: p?.name || '',
          variant_name: v?.variant_name || ''
        };
      });
  };

  StorageClass.prototype.createPurchaseReturn = async function(returnData) {
    if (!returnData) {
      throw new Error('Return data is undefined');
    }

    if (!returnData.purchase_id) {
      console.error('Missing purchase_id in returnData:', returnData);
      throw new Error('Missing purchase_id in return data');
    }

    const { items, ...returnDataWithoutItems } = returnData;

    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        if (items && Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const variant = await this.electronQuery(
              "SELECT current_stock FROM product_variants WHERE id = ? AND is_deleted = 0",
              [item.product_variant_id]
            );
            if (!variant || variant.length === 0) {
              throw new Error(`Variant ${item.product_variant_id} not found`);
            }
            if (Number(variant[0].current_stock) < Number(item.quantity)) {
              throw new Error(`Insufficient stock for variant ${item.product_variant_id}`);
            }
          }
        }

        const result = await this.electronQuery(`
          INSERT INTO purchase_returns (
            purchase_id, return_no, return_date, supplier_id, 
            total_amount, discount_amount, tax_amount, grand_total, 
            notes, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          returnData.purchase_id,
          returnData.return_no,
          returnData.return_date || new Date().toISOString().split('T')[0],
          returnData.supplier_id,
          returnData.total_amount || 0,
          returnData.discount_amount || 0,
          returnData.tax_amount || 0,
          returnData.grand_total || 0,
          returnData.notes || '',
          returnData.status || 'processed',
          returnData.created_by || 1
        ]);

        const returnId = result.lastInsertRowid;

        if (items && Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            if (!item.purchase_item_id) {
              console.error('Missing purchase_item_id for item:', item);
              throw new Error('Missing purchase_item_id for return item');
            }
            if (!item.product_variant_id) {
              console.error('Missing product_variant_id for item:', item);
              throw new Error('Missing product_variant_id for return item');
            }
            if (!item.quantity || item.quantity <= 0) {
              console.error('Invalid quantity for item:', item);
              throw new Error('Invalid quantity for return item');
            }

            await this.electronQuery(
              `INSERT INTO purchase_return_items (
                purchase_return_id, purchase_item_id, product_variant_id, 
                quantity, return_price, tax_percentage, sub_total, reason
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                returnId,
                item.purchase_item_id,
                item.product_variant_id,
                item.quantity,
                item.return_price || 0,
                item.tax_percentage || 0,
                item.sub_total || (item.quantity * (item.return_price || 0)),
                item.reason || ''
              ]
            );

            await this.electronQuery(
              "UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?",
              [item.quantity, item.product_variant_id, item.quantity]
            );
          }
        }

        if (returnData.grand_total) {
          const purchase = await this.electronQuery(
            "SELECT grand_total, paid_amount FROM purchases WHERE id = ?",
            [returnData.purchase_id]
          );

          if (purchase && purchase.length > 0) {
            const newGrandTotal = Math.max(0, purchase[0].grand_total - returnData.grand_total);
            const newPaid = Math.min(purchase[0].paid_amount || 0, newGrandTotal);
            const paymentStatus = newPaid >= newGrandTotal ? 'paid' : newPaid > 0 ? 'partial' : 'due';

            await this.electronQuery(
              `UPDATE purchases SET 
                grand_total = ?,
                paid_amount = ?,
                payment_status = ?
              WHERE id = ?`,
              [newGrandTotal, newPaid, paymentStatus, returnData.purchase_id]
            );
          }
        }

        if (returnData.supplier_id && returnData.grand_total) {
          await this.electronQuery(
            "UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?",
            [returnData.grand_total, returnData.supplier_id]
          );
        }

        try {
          await this.electronQuery(
            `INSERT INTO ledger (supplier_id, type, amount, description, date)
             VALUES (?, ?, ?, ?, ?)`,
            [
              returnData.supplier_id,
              'purchase_return',
              -returnData.grand_total,
              `Purchase Return ${returnData.return_no}`,
              returnData.return_date || new Date().toISOString().split('T')[0]
            ]
          );
        } catch (e) {
          console.warn('Ledger entry failed (non-critical):', e.message);
        }

        if (SYNC_ENABLED) {
          await syncToCloud('purchase_returns', { ...returnData, id: returnId });
        }

        return { success: true, lastInsertRowid: returnId, changes: 1 };
      });
    }

    try {
      return idbTransaction(['purchase_returns', 'purchase_return_items', 'product_variants', 'purchases', 'suppliers', 'purchase_items', 'ledger'], async (tx) => {
        const returnStore = tx.objectStore('purchase_returns');
        const itemStore = tx.objectStore('purchase_return_items');
        const variantStore = tx.objectStore('product_variants');
        const purchaseStore = tx.objectStore('purchases');
        const supplierStore = tx.objectStore('suppliers');
        const ledgerStore = tx.objectStore('ledger');

        let returnId;
        try {
          returnId = generateId();
        } catch (e) {
          console.warn('generateId failed, using timestamp fallback:', e);
          returnId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        if (!returnId) {
          returnId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        const returnDataWithId = {
          id: returnId,
          purchase_id: Number(returnData.purchase_id),
          return_no: returnData.return_no || `RET-${Date.now()}`,
          return_date: returnData.return_date || new Date().toISOString().split('T')[0],
          supplier_id: Number(returnData.supplier_id),
          total_amount: Number(returnData.total_amount) || 0,
          discount_amount: Number(returnData.discount_amount) || 0,
          tax_amount: Number(returnData.tax_amount) || 0,
          grand_total: Number(returnData.grand_total) || 0,
          notes: returnData.notes || '',
          status: returnData.status || 'processed',
          created_by: Number(returnData.created_by) || 1,
          is_deleted: 0,
          created_at: new Date().toISOString()
        };

        await new Promise((resolve, reject) => {
          const r = returnStore.add(returnDataWithId);
          r.onsuccess = () => resolve(r);
          r.onerror = (event) => reject(event.target.error);
        });

        if (items && Array.isArray(items) && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.purchase_item_id) {
              throw new Error('Missing purchase_item_id for return item');
            }
            if (!item.product_variant_id) {
              throw new Error('Missing product_variant_id for return item');
            }
            if (!item.quantity || item.quantity <= 0) {
              throw new Error('Invalid quantity for return item');
            }

            const itemId = `ret_item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

            const itemData = {
              id: itemId,
              purchase_return_id: returnId,
              purchase_item_id: Number(item.purchase_item_id),
              product_variant_id: item.product_variant_id,
              quantity: Number(item.quantity),
              return_price: Number(item.return_price) || 0,
              tax_percentage: Number(item.tax_percentage) || 0,
              sub_total: Number(item.sub_total) || (Number(item.quantity) * (Number(item.return_price) || 0)),
              reason: item.reason || ''
            };

            await new Promise((resolve, reject) => {
              const r = itemStore.add(itemData);
              r.onsuccess = resolve;
              r.onerror = (event) => reject(event.target.error);
            });

            const variant = await new Promise((resolve, reject) => {
              const r = variantStore.get(item.product_variant_id);
              r.onsuccess = () => resolve(r.result);
              r.onerror = () => reject(r.error);
            });

            if (variant) {
              const newStock = Math.max(0, (Number(variant.current_stock) || 0) - Number(item.quantity));
              variant.current_stock = newStock;
              variant.updated_at = new Date().toISOString();
              await new Promise((resolve, reject) => {
                const r = variantStore.put(variant);
                r.onsuccess = resolve;
                r.onerror = () => reject(r.error);
              });
            }
          }
        }

        if (returnData.grand_total && returnData.grand_total > 0) {
          const purchase = await new Promise((resolve, reject) => {
            const r = purchaseStore.get(returnData.purchase_id);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });

          if (purchase) {
            const newGrandTotal = Math.max(0, (Number(purchase.grand_total) || 0) - Number(returnData.grand_total));
            purchase.grand_total = newGrandTotal;
            purchase.paid_amount = Math.min(Number(purchase.paid_amount) || 0, newGrandTotal);
            purchase.payment_status = purchase.paid_amount >= newGrandTotal ? 'paid' : purchase.paid_amount > 0 ? 'partial' : 'due';
            purchase.updated_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const r = purchaseStore.put(purchase);
              r.onsuccess = resolve;
              r.onerror = () => reject(r.error);
            });
          }
        }

        if (returnData.supplier_id && returnData.grand_total && returnData.grand_total > 0) {
          const supplier = await new Promise((resolve, reject) => {
            const r = supplierStore.get(returnData.supplier_id);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });

          if (supplier) {
            supplier.current_balance = Math.max(0, (Number(supplier.current_balance) || 0) - Number(returnData.grand_total));
            supplier.updated_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const r = supplierStore.put(supplier);
              r.onsuccess = resolve;
              r.onerror = () => reject(r.error);
            });
          }
        }

        try {
          const ledgerId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const ledgerData = {
            id: ledgerId,
            supplier_id: Number(returnData.supplier_id),
            type: 'purchase_return',
            amount: -Number(returnData.grand_total),
            description: `Purchase Return ${returnData.return_no}`,
            date: returnData.return_date || new Date().toISOString().split('T')[0]
          };
          await new Promise((resolve) => {
            const r = ledgerStore.add(ledgerData);
            r.onsuccess = resolve;
            r.onerror = () => {
              console.warn('Ledger entry failed (non-critical):', r.error);
              resolve();
            };
          });
        } catch (e) {
          console.warn('Ledger entry failed (non-critical):', e.message);
        }

        if (SYNC_ENABLED) {
          try {
            await syncToCloud('purchase_returns', { ...returnData, id: returnId });
          } catch (syncErr) {
            console.warn('Cloud sync failed (non-critical):', syncErr.message);
          }
        }

        return { success: true, lastInsertRowid: returnId, changes: 1 };
      });
    } catch (error) {
      console.error('[createPurchaseReturn] Fatal error:', error);
      throw error;
    }
  };

  StorageClass.prototype.deletePurchaseReturn = async function(id) {
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const returnData = await this.electronQuery(
          "SELECT purchase_id, supplier_id, grand_total FROM purchase_returns WHERE id = ? AND is_deleted = 0",
          [id]
        );

        if (!returnData || returnData.length === 0) {
          throw new Error('Purchase return not found');
        }

        const items = await this.electronQuery(
          "SELECT product_variant_id, quantity FROM purchase_return_items WHERE purchase_return_id = ?",
          [id]
        );

        for (const item of items) {
          await this.electronQuery(
            "UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?",
            [item.quantity, item.product_variant_id]
          );
        }

        await this.electronQuery(
          "UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?",
          [returnData[0].grand_total, returnData[0].supplier_id]
        );

        await this.electronQuery(
          "UPDATE purchase_returns SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
          [id]
        );

        const purchase = await this.electronQuery(
          "SELECT grand_total, paid_amount FROM purchases WHERE id = ?",
          [returnData[0].purchase_id]
        );

        if (purchase && purchase.length > 0) {
          const newGrandTotal = purchase[0].grand_total + returnData[0].grand_total;
          const paymentStatus = purchase[0].paid_amount >= newGrandTotal ? 'paid' : purchase[0].paid_amount > 0 ? 'partial' : 'due';

          await this.electronQuery(
            `UPDATE purchases SET 
              grand_total = ?,
              payment_status = ?
            WHERE id = ?`,
            [newGrandTotal, paymentStatus, returnData[0].purchase_id]
          );
        }

        if (SYNC_ENABLED) {
          await syncToCloud('purchase_returns', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
        }

        return { changes: 1 };
      });
    }

    return idbTransaction(['purchase_returns', 'purchase_return_items', 'product_variants', 'purchases', 'suppliers'], async (tx) => {
      const returnStore = tx.objectStore('purchase_returns');
      const itemStore = tx.objectStore('purchase_return_items');
      const variantStore = tx.objectStore('product_variants');
      const purchaseStore = tx.objectStore('purchases');
      const supplierStore = tx.objectStore('suppliers');

      const returnRequest = returnStore.get(id);
      await new Promise((resolve, reject) => {
        returnRequest.onsuccess = () => resolve(returnRequest.result);
        returnRequest.onerror = () => reject(returnRequest.error);
      });

      const returnData = returnRequest.result;
      if (!returnData || returnData.is_deleted) {
        throw new Error('Purchase return not found');
      }

      const itemsRequest = itemStore.getAll();
      await new Promise((resolve, reject) => {
        itemsRequest.onsuccess = () => resolve(itemsRequest.result);
        itemsRequest.onerror = () => reject(itemsRequest.error);
      });

      const items = itemsRequest.result.filter(x => String(x.purchase_return_id) === String(id));

      for (const item of items) {
        const variantRequest = variantStore.get(item.product_variant_id);
        await new Promise((resolve, reject) => {
          variantRequest.onsuccess = () => resolve(variantRequest.result);
          variantRequest.onerror = () => reject(variantRequest.error);
        });

        const variant = variantRequest.result;
        if (variant) {
          variant.current_stock = this.safeAdd(variant.current_stock, item.quantity);
          await new Promise((resolve, reject) => {
            const r = variantStore.put(variant);
            r.onsuccess = resolve;
            r.onerror = () => reject(r.error);
          });
        }
      }

      const supplierRequest = supplierStore.get(returnData.supplier_id);
      await new Promise((resolve, reject) => {
        supplierRequest.onsuccess = () => resolve(supplierRequest.result);
        supplierRequest.onerror = () => reject(supplierRequest.error);
      });

      const supplier = supplierRequest.result;
      if (supplier) {
        supplier.current_balance = this.safeAdd(supplier.current_balance, returnData.grand_total);
        await new Promise((resolve, reject) => {
          const r = supplierStore.put(supplier);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
      }

      const purchaseRequest = purchaseStore.get(returnData.purchase_id);
      await new Promise((resolve, reject) => {
        purchaseRequest.onsuccess = () => resolve(purchaseRequest.result);
        purchaseRequest.onerror = () => reject(purchaseRequest.error);
      });

      const purchase = purchaseRequest.result;
      if (purchase) {
        purchase.grand_total = this.safeAdd(purchase.grand_total, returnData.grand_total);
        purchase.payment_status = purchase.paid_amount >= purchase.grand_total ? 'paid' : purchase.paid_amount > 0 ? 'partial' : 'due';

        await new Promise((resolve, reject) => {
          const r = purchaseStore.put(purchase);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
      }

      returnData.is_deleted = 1;
      returnData.deleted_at = new Date().toISOString();
      await new Promise((resolve, reject) => {
        const r = returnStore.put(returnData);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });

      if (SYNC_ENABLED) {
        await syncToCloud('purchase_returns', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }

      return { changes: 1 };
    });
  };

  StorageClass.prototype.getPurchaseReturnStats = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `
        SELECT 
          COUNT(*) as total_returns,
          SUM(grand_total) as total_amount,
          AVG(grand_total) as average_amount,
          COUNT(DISTINCT supplier_id) as total_suppliers
        FROM purchase_returns
        WHERE is_deleted = 0
      `;
      const params = [];

      if (filters.fromDate) {
        sql += " AND DATE(return_date) >= DATE(?)";
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        sql += " AND DATE(return_date) <= DATE(?)";
        params.push(filters.toDate);
      }

      const stats = await this.electronQuery(sql, params);
      return stats[0] || { total_returns: 0, total_amount: 0, average_amount: 0, total_suppliers: 0 };
    }

    const allReturns = await idbGetAll('purchase_returns');
    let filtered = allReturns.filter(x => !x.is_deleted);

    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      filtered = filtered.filter(x => new Date(x.return_date) >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      filtered = filtered.filter(x => new Date(x.return_date) <= to);
    }

    const suppliers = new Set(filtered.map(x => x.supplier_id));

    return {
      total_returns: filtered.length,
      total_amount: filtered.reduce((sum, x) => sum + Number(x.grand_total || 0), 0),
      average_amount: filtered.length > 0 ? filtered.reduce((sum, x) => sum + Number(x.grand_total || 0), 0) / filtered.length : 0,
      total_suppliers: suppliers.size
    };
  };

  StorageClass.prototype.getPurchaseItemsForReturn = async function(purchaseId) {
    if (this.mode === 'electron') {
      return this.electronQuery(`
        SELECT pi.*, pv.sku, p.name as product_name, pv.variant_name,
               (SELECT COALESCE(SUM(quantity), 0) FROM purchase_return_items WHERE purchase_item_id = pi.id) as returned_quantity
        FROM purchase_items pi
        LEFT JOIN product_variants pv ON pi.product_variant_id = pv.id
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE pi.purchase_id = ?
      `, [purchaseId]);
    }

    const [items, variants, products, returnItems] = await Promise.all([
      idbGetAll('purchase_items'),
      idbGetAll('product_variants'),
      idbGetAll('products'),
      idbGetAll('purchase_return_items')
    ]);

    return items
      .filter(x => String(x.purchase_id) === String(purchaseId))
      .map(i => {
        const v = variants.find(x => String(x.id) === String(i.product_variant_id));
        const p = products.find(x => String(x.id) === String(v?.product_id));
        const returnedQty = returnItems
          .filter(ri => String(ri.purchase_item_id) === String(i.id))
          .reduce((sum, ri) => sum + Number(ri.quantity || 0), 0);

        return {
          ...i,
          sku: v?.sku || '',
          product_name: p?.name || '',
          variant_name: v?.variant_name || '',
          returned_quantity: returnedQty
        };
      });
  };

}