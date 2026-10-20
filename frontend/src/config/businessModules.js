// ============================================================
//  businessModules.js — Business-type driven module visibility
//  Single source of truth: kaunsi business type ko kaunse
//  modules default ON milenge. Sirf yehi 10 business types
//  supported hain (Signup ke BUSINESS_TYPES se match).
// ============================================================

export const BUSINESS_TYPES = [
  { value: 'mobile', label: 'Mobile Shop', icon: '📱' },
  { value: 'electronics', label: 'Electronics', icon: '🔌' },
  { value: 'clothing', label: 'Cloth Shop', icon: '👕' },
  { value: 'garments', label: 'Garments', icon: '👔' },
  { value: 'shoes', label: 'Shoes Shop', icon: '👞' },
  { value: 'grocery', label: 'Grocery / Kirana', icon: '🛒' },
  { value: 'pharmacy', label: 'Pharmacy / Medical', icon: '💊' },
  { value: 'bakery', label: 'Bakery', icon: '🍰' },
  { value: 'stationery', label: 'Stationery Shop', icon: '📚' },
  { value: 'motorbike', label: 'Motorbike Spare Parts', icon: '🏍️' },
  { value: 'wholesale', label: 'Wholesale', icon: '📦' },
  { value: 'retail', label: 'Retail Store', icon: '🏪' },
  { value: 'other', label: 'Other', icon: '🏬' },
];

// Ye 3 modules business type ke hisaab se default ON/OFF hote hain.
// Baaki sab (Billing, Products, Customers, Suppliers, Expenses,
// Accounts, Reports, History...) core hain — har shop ke liye ON.
export const TOGGLEABLE_MODULES = [
  { id: 'emi', label: 'EMI System', hint: 'Installments / udhaar plans' },
  { id: 'workorders', label: 'Work Orders', hint: 'Repair & service job orders' },
  { id: 'distribution', label: 'Distribution', hint: 'Distributor / bulk orders' },
];

export const BUSINESS_MODULE_DEFAULTS = {
  retail:      { emi: false, workorders: false, distribution: false },
  wholesale:   { emi: false, workorders: false, distribution: true },
  electronics: { emi: true,  workorders: true,  distribution: false },
  clothing:    { emi: false, workorders: false, distribution: false },
  garments:    { emi: false, workorders: false, distribution: false },
  shoes:       { emi: false, workorders: false, distribution: false },
  mobile:      { emi: true,  workorders: true,  distribution: false },
  grocery:     { emi: false, workorders: false, distribution: false },
  pharmacy:    { emi: false, workorders: false, distribution: false },
  bakery:      { emi: false, workorders: false, distribution: false },
  stationery:  { emi: false, workorders: false, distribution: false },
  motorbike:   { emi: false, workorders: true,  distribution: false },
  other:       { emi: false, workorders: false, distribution: false },
};

// Add-product form mein default product type (user dropdown se change kar sakta hai)
export const DEFAULT_PRODUCT_TYPE_BY_BUSINESS = {
  mobile: 'imei',
  wholesale: 'wholesale',
  grocery: 'grocery',
  pharmacy: 'medical',
  shoes: 'shoes',
  clothing: 'fabric',
  garments: 'fabric',
  bakery: 'bakery',
  stationery: 'stationery',
  motorbike: 'standard',
  electronics: 'standard',
  retail: 'standard',
  other: 'standard',
};

// Business type ke hisaab se kaunse product types dikhenge (Add Product dropdown)
// Har shop ko sirf apne related product types milenge
export const PRODUCT_TYPES_BY_BUSINESS = {
  mobile: ['imei', 'standard'],
  electronics: ['standard'],
  clothing: ['fabric', 'standard'],
  garments: ['fabric', 'uniform', 'standard'],
  shoes: ['shoes', 'standard'],
  grocery: ['grocery', 'standard'],
  pharmacy: ['medical', 'standard'],
  bakery: ['bakery', 'standard'],
  stationery: ['stationery', 'books', 'uniform', 'standard'],
  motorbike: ['standard'],
  wholesale: ['wholesale', 'standard'],
  retail: ['standard'],
  other: ['standard', 'imei', 'fabric', 'grocery', 'medical', 'shoes', 'bakery', 'wholesale', 'stationery', 'uniform', 'books'],
};

export function getProductTypesForBusiness(businessType) {
  const allowed = PRODUCT_TYPES_BY_BUSINESS[businessType];
  return allowed || PRODUCT_TYPES_BY_BUSINESS['other'];
}

export function getBusinessTypeLabel(value) {
  const found = BUSINESS_TYPES.find(t => t.value === value);
  return found ? found.label : value;
}

// Login user ki shop ka business_type (backend users table se aata hai)
export function getShopBusinessType() {
  try {
    const u = JSON.parse(localStorage.getItem('current_user') || '{}');
    return String(u.business_type || 'retail').toLowerCase();
  } catch {
    return 'retail';
  }
}

// Ek business type ke liye full visibility map (core sab true)
export function getModuleDefaults(businessType) {
  const t = BUSINESS_MODULE_DEFAULTS[businessType] || BUSINESS_MODULE_DEFAULTS.other;
  return {
    dashboard: true,
    pos: true,
    sales: true,
    inventory: true,
    products: true,
    customers: true,
    suppliers: true,
    purchases: true,
    expenses: true,
    reports: true,
    settings: true,
    users: true,
    backup: true,
    emi: !!t.emi,
    workorders: !!t.workorders,
    distribution: !!t.distribution,
    services: true, // legacy key — purani installs ke liye harmless
  };
}

// Business-type defaults apply karo (localStorage; Sidebar isi ko parhta hai).
// Pehle se save ki hui baaki pages ki setting preserve rehti hai;
// sirf 3 toggleable modules template ke mutabiq set hote hain.
// QA-063: force=true par hi user ki maujooda choice overwrite ho — warna
// sirf un modules par default lagao jin par user ne kabhi haath nahi lagaya.
export function applyBusinessTypeDefaults(businessType, force = false) {
  try {
    const saved = JSON.parse(localStorage.getItem('page_visibility') || '{}');
    const tpl = BUSINESS_MODULE_DEFAULTS[businessType] || BUSINESS_MODULE_DEFAULTS.other;
    const next = { ...getModuleDefaults(businessType), ...saved };
    TOGGLEABLE_MODULES.forEach(m => {
      if (force || saved[m.id] === undefined) next[m.id] = !!tpl[m.id];
    });
    localStorage.setItem('page_visibility', JSON.stringify(next));
    localStorage.setItem('page_visibility_source', (force ? 'reset:' : 'auto:') + businessType);
    return next;
  } catch {
    return null;
  }
}

// QA-063: login par pehle server (system_settings) se saved page_visibility
// restore karo — user ki "Visible" choice har fresh session me barqarar rahe.
// Server par kuch save nahi to business-type defaults lagao.
// apiGet: (path) => Promise — taa ke ye module apiClient par depend na kare.
// v85: page_visibility SHOP (tenant) ki property hai, browser ki nahi — ek shop ke
// bache hue settings doosri shop par apply nahi honge (owner = tenant_id stamp).
export async function restoreOrApplyModuleVisibility(businessType, apiGet, tenantId) {
  try {
    const hasPv = !!localStorage.getItem('page_visibility');
    const owner = localStorage.getItem('page_visibility_owner');
    if (hasPv && tenantId && owner === tenantId) return; // isi shop ke settings — chhedo mat
    if (hasPv && !tenantId) return; // tenant maloom nahi — purana behavior
    let restored = null;
    try {
      const res = await apiGet('/settings');
      const pv = res && res.data ? res.data.page_visibility : null;
      if (pv && typeof pv === 'object' && Object.keys(pv).length) restored = pv;
    } catch { /* offline/error — defaults par jao */ }
    if (restored) {
      localStorage.setItem('page_visibility', JSON.stringify(restored));
      localStorage.setItem('page_visibility_source', 'server');
    } else {
      // purani (doosri shop ki) pv hata kar is type ke fresh defaults lagao
      localStorage.removeItem('page_visibility');
      applyBusinessTypeDefaults(businessType, true);
    }
    if (tenantId) localStorage.setItem('page_visibility_owner', tenantId);
  } catch { /* non-blocking */ }
}

// Kya ye module is waqt enabled hai? (default: visible)
export function isModuleEnabled(moduleId) {
  try {
    const saved = JSON.parse(localStorage.getItem('page_visibility') || '{}');
    return saved[moduleId] !== false;
  } catch {
    return true;
  }
}

export function getDefaultProductType() {
  return DEFAULT_PRODUCT_TYPE_BY_BUSINESS[getShopBusinessType()] || 'standard';
}
