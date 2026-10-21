// ============================================================
//  PharmacyModeForm — Pharmacy: Add New Medicine (Hafeez design)
//  - Master data: Generic, Company (select-or-type + Add Company
//    dialog), Category (select-or-type + Add Category dialog),
//    Dosage Strength, Packaging Form, Base Stock Unit
//    (select-or-type + Add Unit dialog)
//  - Box & Unit Calculator: units/box x boxes = total loose units,
//    cost/sale per box <-> per unit auto-calc, batch + expiry
//  - Stock hamesha smallest unit (loose units) me save hota hai
//    aur pehli batch isi form se banti hai (FEFO backend ready)
//  onChange contract: purana superset — ProductsPage save flow
//  (meta + batch create) bina change ke chalta rahe.
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/apiClient';

const PACKAGING_FORMS = [
  'Tablet / Strip', 'Capsule / Strip', 'Syrup (Bottle)', 'Injection', 'Sachet',
  'Cream / Ointment', 'Drops', 'Powder', 'Equipment', 'Other',
];

const inputCls = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white';
const labelCls = 'block text-[11px] font-bold tracking-wide text-slate-600 uppercase mb-1.5';

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className={labelCls}>{label} {required && <span className="text-rose-500">*</span>}</label>
      {children}
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

// Chhota modal — master data dialogs (Category / Unit / Company)
function MiniDialog({ open, onClose, icon, title, children, onSave, saving }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="text-indigo-600">{icon}</span> {title}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-200/70 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function PharmacyModeForm({ onChange }) {
  // master fields
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [packagingForm, setPackagingForm] = useState('Tablet / Strip');
  // company (brand)
  const [companies, setCompanies] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState(null);
  const [companyDialog, setCompanyDialog] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', contact_person: '', phone: '', email: '' });
  // category
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  // base unit
  const [units, setUnits] = useState([]);
  const [baseUnit, setBaseUnit] = useState('');
  const [unitDialog, setUnitDialog] = useState(false);
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '' });
  const [savingMaster, setSavingMaster] = useState(false);
  // calculator
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [numBoxes, setNumBoxes] = useState('');
  const [totalLoose, setTotalLoose] = useState('');
  const totalManual = useRef(false);
  const [costPerBox, setCostPerBox] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [salePerBox, setSalePerBox] = useState('');
  const [salePerUnit, setSalePerUnit] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [minStock, setMinStock] = useState('10');
  const [syncOldPrice, setSyncOldPrice] = useState(false);

  const num = (v) => Math.max(0, Number(v) || 0);
  const upb = Math.floor(num(unitsPerBox));

  // Master data load
  const loadMaster = async () => {
    try {
      const [b, c, u] = await Promise.all([
        api.get('/brands').catch(() => null),
        api.get('/categories').catch(() => null),
        api.get('/units').catch(() => null),
      ]);
      if (b?.data) setCompanies(b.data);
      if (c?.data) setCategories(c.data);
      if (u?.data) setUnits(u.data);
    } catch { /* form phir bhi chalega — type karke bhi chal sakta hai */ }
  };
  useEffect(() => { loadMaster(); }, []);

  // Total loose units: boxes x units/box (user override bhi mumkin)
  useEffect(() => {
    if (!totalManual.current) {
      const t = Math.floor(num(numBoxes)) * upb;
      setTotalLoose(t > 0 ? String(t) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numBoxes, unitsPerBox]);

  const onCostBox = (v) => {
    setCostPerBox(v);
    if (upb > 0 && v !== '') setCostPerUnit(String(+(num(v) / upb).toFixed(2)));
    if (v === '') setCostPerUnit('');
  };
  const onCostUnit = (v) => {
    setCostPerUnit(v);
    if (upb > 0 && v !== '') setCostPerBox(String(+(num(v) * upb).toFixed(2)));
    if (v === '') setCostPerBox('');
  };
  const onSaleBox = (v) => {
    setSalePerBox(v);
    if (upb > 0 && v !== '') setSalePerUnit(String(+(num(v) / upb).toFixed(2)));
    if (v === '') setSalePerUnit('');
  };
  const onSaleUnit = (v) => {
    setSalePerUnit(v);
    if (upb > 0 && v !== '') setSalePerBox(String(+(num(v) * upb).toFixed(2)));
    if (v === '') setSalePerBox('');
  };

  const pickCompany = (name) => {
    setCompanyName(name);
    const hit = companies.find((x) => x.name.toLowerCase() === String(name).trim().toLowerCase());
    setCompanyId(hit ? hit.id : null);
  };
  const pickCategory = (name) => {
    setCategoryName(name);
    const hit = categories.find((x) => x.name.toLowerCase() === String(name).trim().toLowerCase());
    setCategoryId(hit ? hit.id : null);
  };

  const saveCompany = async () => {
    if (!companyForm.name.trim()) return;
    setSavingMaster(true);
    try {
      const res = await api.post('/brands', companyForm);
      if (res?.data) {
        setCompanies((p) => [...p, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setCompanyName(res.data.name);
        setCompanyId(res.data.id);
      }
      setCompanyDialog(false);
      setCompanyForm({ name: '', contact_person: '', phone: '', email: '' });
    } catch { /* ignore — naam phir bhi type karke chalega */ }
    setSavingMaster(false);
  };
  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    setSavingMaster(true);
    try {
      const res = await api.post('/categories', categoryForm);
      if (res?.data) {
        setCategories((p) => [...p, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setCategoryName(res.data.name);
        setCategoryId(res.data.id);
      }
      setCategoryDialog(false);
      setCategoryForm({ name: '', description: '' });
    } catch { /* ignore */ }
    setSavingMaster(false);
  };
  const saveUnit = async () => {
    if (!unitForm.name.trim()) return;
    setSavingMaster(true);
    try {
      const res = await api.post('/units', unitForm);
      if (res?.data) {
        setUnits((p) => [...p, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setBaseUnit(res.data.name);
      }
      setUnitDialog(false);
      setUnitForm({ name: '', symbol: '' });
    } catch { /* ignore */ }
    setSavingMaster(false);
  };

  const totalUnits = Math.floor(num(totalLoose));
  const costUnitFinal = upb > 0 ? +(num(costPerBox) / upb).toFixed(2) : num(costPerUnit);
  const saleUnitFinal = upb > 0 ? +(num(salePerBox) / upb).toFixed(2) : num(salePerUnit);

  // ProductsPage save contract (superset)
  useEffect(() => {
    onChange && onChange({
      mode: 'TWO_LEVEL',
      genericName, dosageForm: packagingForm, strength,
      manufacturer: companyName, brandId: companyId, categoryId,
      baseUnit: baseUnit || '',
      rack: '', coldChain: false, rxRequired: false, barcode: '',
      boxesPerCarton: 0, stripsPerBox: 0, unitsPerStrip: upb, unitsPerBox: upb,
      totalUnits,
      batchNo, expiry: expiry || null,
      costPerBox: num(costPerBox), salePerBox: num(salePerBox),
      costPerUnit: costUnitFinal, salePerUnit: saleUnitFinal,
      costPerStrip: 0, salePerStrip: 0,
      syncOldPrice,
      minStock: num(minStock) || 10,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genericName, packagingForm, strength, companyName, companyId, categoryId, baseUnit,
      upb, totalUnits, batchNo, expiry, costPerBox, salePerBox, costUnitFinal, saleUnitFinal,
      syncOldPrice, minStock]);

  const plusBtn = 'shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-lg font-bold text-indigo-600 hover:bg-indigo-100';

  return (
    <div className="mt-4 space-y-4">
      {/* ===== Medicine master fields ===== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 font-bold text-slate-800">
          <span className="text-indigo-600">💊</span> Add New Medicine
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Generic Name / Formula">
            <input className={inputCls} value={genericName} onChange={(e) => setGenericName(e.target.value)}
              placeholder="e.g. Amoxicillin + Clavulanate" />
          </Field>
          <Field label="Company / Manufacturer">
            <div className="flex gap-2">
              <input className={inputCls} list="ph-companies" value={companyName} onChange={(e) => pickCompany(e.target.value)}
                placeholder="Select or type company (e.g. GSK, Getz)..." />
              <datalist id="ph-companies">{companies.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              <button type="button" className={plusBtn} title="Add New Company" onClick={() => setCompanyDialog(true)}>+</button>
            </div>
          </Field>
          <Field label="Category">
            <div className="flex gap-2">
              <input className={inputCls} list="ph-categories" value={categoryName} onChange={(e) => pickCategory(e.target.value)}
                placeholder="Select or type category..." />
              <datalist id="ph-categories">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              <button type="button" className={plusBtn} title="Add New Category" onClick={() => setCategoryDialog(true)}>+</button>
            </div>
          </Field>
          <Field label="Dosage Strength">
            <input className={inputCls} value={strength} onChange={(e) => setStrength(e.target.value)}
              placeholder="e.g. 500mg, 625mg, 10mg/ml" />
          </Field>
          <Field label="Packaging Form">
            <select className={inputCls} value={packagingForm} onChange={(e) => setPackagingForm(e.target.value)}>
              {PACKAGING_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Base Stock Unit">
            <div className="flex gap-2">
              <input className={inputCls} list="ph-units" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
                placeholder="Select or type unit (e.g. Tablet, Capsule, ml)..." />
              <datalist id="ph-units">{units.map((u) => <option key={u.id} value={u.name}>{u.symbol || ''}</option>)}</datalist>
              <button type="button" className={plusBtn} title="Add New Unit" onClick={() => setUnitDialog(true)}>+</button>
            </div>
          </Field>
        </div>
      </div>

      {/* ===== Box & Unit Calculator ===== */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="mb-1 flex items-center gap-2 font-bold text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">🧮</span>
          <span>BOX & UNIT CALCULATOR (STOCK & PRICING)
            <span className="block text-[11px] font-medium normal-case text-indigo-500">Enter box or unit price, auto-calculates totals and rates</span>
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tablets / Units Per Box" hint="Units per box (leave blank if sold as individual units)">
            <input className={inputCls} type="number" min="0" value={unitsPerBox}
              onChange={(e) => { totalManual.current = false; setUnitsPerBox(e.target.value); }} placeholder="e.g. 100 or 6" />
          </Field>
          <Field label="Number of Boxes (Stock)" hint="e.g. 5 or 6 boxes">
            <input className={inputCls} type="number" min="0" value={numBoxes}
              onChange={(e) => { totalManual.current = false; setNumBoxes(e.target.value); }} placeholder="e.g. 5 or 6" />
          </Field>
          <Field label="Total Loose Units">
            <input className={inputCls} type="number" min="0" value={totalLoose}
              onChange={(e) => { totalManual.current = true; setTotalLoose(e.target.value); }} placeholder="e.g. 500 or 36" />
            <div className="mt-1 text-[11px] font-semibold text-emerald-600">Auto-calculated</div>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
          <Field label={<>Cost / Purchase Price (Per Box) <span className="float-right font-semibold normal-case text-indigo-500">e.g. 600 PKR</span></>}>
            <input className={inputCls} type="number" min="0" step="0.01" value={costPerBox} onChange={(e) => onCostBox(e.target.value)} placeholder="0.00" />
            <div className="mt-1 text-[11px] text-slate-400">Purchase cost per box</div>
          </Field>
          <Field label={<>Cost Price (Per Tablet / Unit) <span className="float-right font-semibold normal-case text-emerald-600">AUTO-CALCULATED</span></>}>
            <input className={inputCls} type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => onCostUnit(e.target.value)} placeholder="0.00" />
            <div className="mt-1 text-[11px] text-slate-400">Purchase cost per unit</div>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
          <Field label={<>Sale Price (Per Box) <span className="float-right font-semibold normal-case text-indigo-500">e.g. 720 PKR</span></>}>
            <input className={inputCls} type="number" min="0" step="0.01" value={salePerBox} onChange={(e) => onSaleBox(e.target.value)} placeholder="0.00" />
            <div className="mt-1 text-[11px] text-slate-400">Retail selling price per box</div>
          </Field>
          <Field label={<>Sale Price (Per Tablet / Unit) <span className="float-right font-semibold normal-case text-emerald-600">AUTO-CALCULATED</span></>}>
            <input className={inputCls} type="number" min="0" step="0.01" value={salePerUnit} onChange={(e) => onSaleUnit(e.target.value)} placeholder="0.00" />
            <div className="mt-1 text-[11px] text-slate-400">Retail selling price per unit</div>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Batch / Lot Number (Optional)">
            <input className={inputCls} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="e.g. BATCH-01" />
          </Field>
          <Field label="Expiry Date (Optional)">
            <input className={inputCls} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={syncOldPrice} onChange={(e) => setSyncOldPrice(e.target.checked)} />
          Purani batches ka sale price bhi is naye rate par update kar do (cost purana hi rahega)
        </label>
      </div>

      {/* ===== Low stock ===== */}
      <Field label="Low Stock Alert Level (Units)">
        <input className={inputCls} type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </Field>

      {/* ===== Dialogs ===== */}
      <MiniDialog open={categoryDialog} onClose={() => setCategoryDialog(false)} icon="🏷️" title="Add New Category"
        onSave={saveCategory} saving={savingMaster}>
        <Field label="Category Name" required>
          <input className={inputCls} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="e.g. Antibiotics, Painkillers" />
        </Field>
        <Field label="Description (Optional)">
          <textarea className={inputCls} rows={3} value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            placeholder="Brief notes about medicines in this category..." />
        </Field>
      </MiniDialog>

      <MiniDialog open={unitDialog} onClose={() => setUnitDialog(false)} icon="⚖️" title="Add New Unit"
        onSave={saveUnit} saving={savingMaster}>
        <Field label="Unit Name" required>
          <input className={inputCls} value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
            placeholder="e.g. Tablet, Capsule, Syrup (ml)" />
        </Field>
        <Field label="Short Symbol / Abbreviation (Optional)">
          <input className={inputCls} value={unitForm.symbol} onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
            placeholder="e.g. tab, cap, ml, inj, sachet" />
        </Field>
      </MiniDialog>

      <MiniDialog open={companyDialog} onClose={() => setCompanyDialog(false)} icon="🏢" title="Add New Company / Manufacturer"
        onSave={saveCompany} saving={savingMaster}>
        <Field label="Company / Manufacturer Name" required>
          <input className={inputCls} value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            placeholder="e.g. GSK, Getz Pharma, Abbott" />
        </Field>
        <Field label="Contact Person / Representative (Optional)">
          <input className={inputCls} value={companyForm.contact_person} onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })}
            placeholder="e.g. Mr. Tariq Khan" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone Number">
            <input className={inputCls} value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              placeholder="0303-3333333 or 042-1..." />
          </Field>
          <Field label="Email Address">
            <input className={inputCls} value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
              placeholder="e.g. sales@gsk.com" />
          </Field>
        </div>
      </MiniDialog>
    </div>
  );
}
