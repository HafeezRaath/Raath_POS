const fs = require('fs');
const path = require('path');
const { log, LOG_LEVELS } = require('./logger');
const { CONFIG } = require('../constants/config');

function calculateCommission(amount, rate) {
  return Math.round(((amount || 0) * (rate || 0)) / 100 * 100) / 100;
}

function calculateEMI(principal, annualRate, months) {
  if (!principal || principal <= 0) {
    return { emi: 0, total: 0, interest: 0 };
  }
  if (!months || months <= 0) {
    return { emi: 0, total: 0, interest: 0 };
  }
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0 || monthlyRate === null || isNaN(monthlyRate)) {
    const emi = principal / months;
    return { emi: Math.round(emi * 100) / 100, total: principal, interest: 0 };
  }
  if (Math.abs(monthlyRate) < 0.000001) {
    const emi = principal / months;
    return { emi: Math.round(emi * 100) / 100, total: principal, interest: 0 };
  }
  try {
    const powFactor = Math.pow(1 + monthlyRate, months);
    if (!isFinite(powFactor)) {
      log(LOG_LEVELS.WARN, 'EMI calculation overflow, using simple division');
      const emi = principal / months;
      return { emi: Math.round(emi * 100) / 100, total: principal, interest: 0 };
    }
    const emi = principal * monthlyRate * powFactor / (powFactor - 1);
    const total = emi * months;
    return {
      emi: Math.round(emi * 100) / 100,
      total: Math.round(total * 100) / 100,
      interest: Math.round((total - principal) * 100) / 100
    };
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'EMI calculation error:', error);
    const emi = principal / months;
    return { emi: Math.round(emi * 100) / 100, total: principal, interest: 0 };
  }
}

function calculateTax(subtotal, taxRate, taxType) {
  if (!taxRate) return 0;
  if (taxType === 'inclusive') {
    return Math.round((subtotal - (subtotal / (1 + taxRate / 100))) * 100) / 100;
  } else {
    return Math.round((subtotal * (taxRate / 100)) * 100) / 100;
  }
}

function getCustomerBalance(db, customerId) {
  const result = db.prepare("SELECT current_balance FROM customers WHERE id = ?").get(customerId);
  return result ? result.current_balance : 0;
}

function getSupplierBalance(db, supplierId) {
  const result = db.prepare("SELECT current_balance FROM suppliers WHERE id = ?").get(supplierId);
  return result ? result.current_balance : 0;
}

function calculateSaleTotals(items, discount = 0, taxRate = 0, taxType = 'inclusive') {
  let subtotal = 0;
  let itemDiscount = 0;
  for (const item of items) {
    const price = parseFloat(item.price) || 0;
    const qty = parseFloat(item.quantity) || 0;
    const disc = parseFloat(item.discount) || 0;
    const total = (price * qty) - disc;
    subtotal += total;
    itemDiscount += disc;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  itemDiscount = Math.round(itemDiscount * 100) / 100;
  const disc = parseFloat(discount) || 0;
  const afterDiscount = subtotal - disc;
  const tax = calculateTax(afterDiscount, taxRate, taxType);
  const grandTotal = afterDiscount + tax;
  return {
    subtotal,
    itemDiscount,
    discount: disc,
    tax: Math.round(tax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

function calculateEMISchedule(principal, annualRate, months, startDateStr, dueDay = 1) {
  if (!principal || principal <= 0) {
    throw new Error('Principal amount must be positive');
  }
  if (!months || months <= 0) {
    throw new Error('Months must be positive');
  }
  const result = calculateEMI(principal, annualRate, months);
  const schedule = [];
  let startDate;
  if (startDateStr) {
    startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      startDate = new Date();
      log(LOG_LEVELS.WARN, 'Invalid start date provided, using current date');
    }
  } else {
    startDate = new Date();
  }
  const validDueDay = Math.min(28, Math.max(1, dueDay));
  for (let i = 1; i <= months; i++) {
    try {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDate.setDate(validDueDay);
      if (dueDate.getDate() !== validDueDay) {
        dueDate.setDate(0);
      }
      schedule.push({
        month_number: i,
        emi_amount: result.emi,
        due_date: dueDate.toISOString().split('T')[0],
        principal_component: Math.round((principal / months) * 100) / 100,
        interest_component: Math.round((result.interest / months) * 100) / 100,
        status: 'pending'
      });
    } catch (calcErr) {
      log(LOG_LEVELS.ERROR, 'Error calculating EMI schedule for month', i, calcErr);
      schedule.push({
        month_number: i,
        emi_amount: result.emi,
        due_date: new Date().toISOString().split('T')[0],
        principal_component: Math.round((principal / months) * 100) / 100,
        interest_component: Math.round((result.interest / months) * 100) / 100,
        status: 'pending',
        error: true
      });
    }
  }
  return { ...result, schedule };
}

function generateApplicationNo() {
  const prefix = 'EMI';
  const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${random}`;
}

module.exports = {
  calculateCommission, calculateEMI, calculateTax,
  getCustomerBalance, getSupplierBalance,
  calculateSaleTotals, calculateEMISchedule, generateApplicationNo
};
