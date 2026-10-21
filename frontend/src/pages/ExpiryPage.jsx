// ============================================================
//  ExpiryPage — Pharmacy: batch-wise expiry tracking
//  Har medicine ka TOTAL stock, aur us me se kis batch ka kitna
//  hissa expired hai / near-expiry hai — ek hi screen par.
//  Data: GET /products/batches/expiry-alerts?days=N (FEFO batches)
//  Action: Vendor Return (batch wapas — stock auto adjust)
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/apiClient';

const fmtDate = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const dt = new Date(`${s}T00:00:00`);
  return isNaN(dt) ? s : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtNum = (v) => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
const fmtPKR = (v) => `PKR ${(Number(v) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ icon, iconBg, label, labelColor, children, sub, border }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${border} bg-white px-4 py-3.5 shadow-sm`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-white ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-[11px] font-bold tracking-wide ${labelColor}`}>{label}</div>
        <div className="truncate text-lg font-extrabold text-slate-800">{children}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function ExpiryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all'); // all | expired | near
  const [lookahead, setLookahead] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/products/batches/expiry-alerts?days=${lookahead}`);
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError('Expiry data load nahi ho saka. Dobara try karein.');
    }
    setLoading(false);
  }, [lookahead]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const expired = rows.filter((r) => Number(r.days_left) < 0);
    const critical = rows.filter((r) => Number(r.days_left) >= 0 && Number(r.days_left) < 30);
    const near = rows.filter((r) => Number(r.days_left) >= 0);
    return {
      expiredBatches: expired.length,
      expiredUnits: expired.reduce((s, r) => s + (Number(r.qty_remaining) || 0), 0),
      criticalBatches: critical.length,
      expiredLoss: expired.reduce((s, r) => s + (Number(r.qty_remaining) || 0) * (Number(r.cost_price) || 0), 0),
      atRiskValue: near.reduce((s, r) => s + (Number(r.qty_remaining) || 0) * (Number(r.cost_price) || 0), 0),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'expired' && !(Number(r.days_left) < 0)) return false;
      if (tab === 'near' && !(Number(r.days_left) >= 0)) return false;
      if (!q) return true;
      return [r.product_name, r.company_name, r.batch_no]
        .some((x) => String(x || '').toLowerCase().includes(q));
    });
  }, [rows, tab, search]);

  // Medicine-wise grouping: header = total / expired / near-expiry hisaab
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of visible) {
      const key = r.product_id;
      if (!map.has(key)) {
        map.set(key, {
          product_id: key,
          product_name: r.product_name,
          company_name: r.company_name || '',
          total_stock: Number(r.product_stock) || 0,
          batches: [],
          expiredQty: 0,
          nearQty: 0,
        });
      }
      const g = map.get(key);
      g.batches.push(r);
      const q = Number(r.qty_remaining) || 0;
      if (Number(r.days_left) < 0) g.expiredQty += q;
      else g.nearQty += q;
    }
    return [...map.values()].sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [visible]);

  const vendorReturn = async (b) => {
    const qty = fmtNum(b.qty_remaining);
    if (!window.confirm(`Batch ${b.batch_no || ''} (${b.product_name}) ki bachi hui ${qty} units vendor ko wapas kar dein? Stock utna hi kam ho jayega.`)) return;
    try {
      await api.post(`/products/batches/${b.id}/vendor-return`, {});
      setNotice(`Batch ${b.batch_no || ''} vendor return ho gaya — stock adjust kar diya hai.`);
      load();
    } catch {
      setError('Vendor return nahi ho saka. Dobara try karein.');
    }
  };

  const daysBadge = (d) => {
    const n = Number(d);
    if (n < 0) return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Expired {Math.abs(n)}d ago</span>;
    if (n < 30) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">{n} days left</span>;
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{n} days left</span>;
  };

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setTab(key)}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === key ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-800">Expiry Tracking <span className="text-sm font-semibold text-slate-400">— batch-wise (Pharmacy)</span></h1>
        <button onClick={load} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">↻ Refresh</button>
      </div>

      {/* ===== Stat cards ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="🛡️" iconBg="bg-rose-600" label="ALREADY EXPIRED" labelColor="text-rose-600" border="border-rose-100"
          sub={`${fmtNum(stats.expiredUnits)} units khatam shuda stock`}>
          {stats.expiredBatches} <span className="text-sm font-bold text-rose-500">batches</span>
        </StatCard>
        <StatCard icon="🕐" iconBg="bg-amber-500" label="CRITICAL (< 30 DAYS)" labelColor="text-amber-600" border="border-amber-100"
          sub="30 din se pehle expire honay walay">
          {stats.criticalBatches} <span className="text-sm font-bold text-amber-500">batches</span>
        </StatCard>
        <StatCard icon="$" iconBg="bg-rose-500" label="EXPIRED LOSS (COST)" labelColor="text-rose-600" border="border-rose-100"
          sub="Expired stock ki khareed qeemat">
          {fmtPKR(stats.expiredLoss)}
        </StatCard>
        <StatCard icon="⚠️" iconBg="bg-indigo-600" label="AT RISK VALUE" labelColor="text-indigo-600" border="border-indigo-100"
          sub={`Aglay ${lookahead} din me expire honay wala stock (cost)`}>
          {fmtPKR(stats.atRiskValue)}
        </StatCard>
      </div>

      {/* ===== Toolbar ===== */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by medicine, company, batch..."
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {tabBtn('all', 'All Expiring')}
          {tabBtn('expired', 'Expired Only')}
          {tabBtn('near', 'Near Expiry')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wide text-slate-500">LOOKAHEAD:</span>
          <select value={lookahead} onChange={(e) => setLookahead(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none">
            <option value={30}>Next 30 Days</option>
            <option value={60}>Next 60 Days</option>
            <option value={90}>Next 90 Days</option>
            <option value={180}>Next 180 Days</option>
            <option value={365}>Next 365 Days</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      {/* ===== Groups per medicine ===== */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm font-semibold text-slate-400">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✅</div>
          <div className="font-bold text-slate-700">No expiring or expired batches found</div>
          <div className="mt-1 text-sm text-slate-400">All medicine inventory is within safe expiry periods.</div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.product_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="font-extrabold text-slate-800">{g.product_name}</span>
              {g.company_name && <span className="text-xs font-semibold text-slate-400">{g.company_name}</span>}
              <span className="ml-auto flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-700">Total Stock: {fmtNum(g.total_stock)} units</span>
                {g.expiredQty > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">Expired: {fmtNum(g.expiredQty)} units</span>}
                {g.nearQty > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">Near Expiry: {fmtNum(g.nearQty)} units</span>}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold tracking-wide text-slate-400">
                    <th className="px-4 py-2.5">MEDICINE</th>
                    <th className="px-4 py-2.5">COMPANY / MFR</th>
                    <th className="px-4 py-2.5">BATCH NO</th>
                    <th className="px-4 py-2.5">EXPIRY DATE</th>
                    <th className="px-4 py-2.5">DAYS LEFT</th>
                    <th className="px-4 py-2.5">IN STOCK</th>
                    <th className="px-4 py-2.5">PURCHASE PRICE</th>
                    <th className="px-4 py-2.5">TOTAL VALUE</th>
                    <th className="px-4 py-2.5">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {g.batches.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-700">{b.product_name}</td>
                      <td className="px-4 py-3 text-slate-500">{b.company_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{b.batch_no || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(b.expiry_date)}</td>
                      <td className="px-4 py-3">{daysBadge(b.days_left)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{fmtNum(b.qty_remaining)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtPKR(b.cost_price)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{fmtPKR((Number(b.qty_remaining) || 0) * (Number(b.cost_price) || 0))}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => vendorReturn(b)}
                          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100">
                          Vendor Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
