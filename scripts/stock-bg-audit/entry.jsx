// הדף האמיתי של בדיקת מלאי (StockCheckPage + home.css + stock-check.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import StockCheckPage from '../../app/components/stock/StockCheckPage.js';

const MODELS = [{ v: 'שמלת ערב "ורד"', c: 4512 }, { v: 'שמלת כלה "אלמוג"', c: 3087 }, { v: 'שמלת סאטן קלאסית', c: 1893 }, { v: 'שמלת תחרה', c: 2210 }, { v: 'שמלת שיפון', c: 3307 }];
const SIZES = ['02', '04', '06', '08', '10', '12', '14', '16', '34', '36', '38', '40', 'כללי'].map((v) => ({ v }));
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const result = (u) => {
  const sp = new URL(u, location.origin).searchParams;
  const model = sp.get('model') || '';
  const sizes = (sp.get('sizes') || '').split(',').filter(Boolean);
  const flex = (sp.get('flex') || '').split(',').filter(Boolean);
  const base = { date: sp.get('date'), dateHebrew: 'x', query: {}, branchesEnabled: model === 'branches', warnings: [], truncated: false };
  if (model === 'none') return { ...base, results: [], warnings: ['הדגם "none" לא נמצא'] };
  const rows = MODELS.filter((m) => !model || model === 'branches' || m.v.includes(model) || String(m.c) === model).map((m, i) => {
    const sz = (sizes.length ? sizes : ['10', '12', '14']).map((s, k) => {
      const n = parseInt(s, 10); const fl = flex.includes(s);
      const c = (fl && !isNaN(n) ? [n - 2, n, n + 2].map((x) => String(x).padStart(2, '0')) : [s]).map((cs, q) => ({ size: cs, free: ((i + k + q) % 2) + 1 })); // סכומים 1-4: גם שבב st-mid וגם st-good
      return { size: s, free: c.reduce((a, x) => a + x.free, 0), flexible: fl, candidates: c };
    });
    const free = sizes.length ? Math.min(...sz.map((x) => x.free)) : sz.reduce((a, x) => a + x.free, 0);
    return { modelId: 'm' + i, modelCode: m.c, modelName: m.v, link: '/dashboard/dresses/m' + i, free, sizes: sz, branches: [] };
  }).sort((a, b) => b.free - a.free);
  return { ...base, results: rows };
};
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, window.__delay || 30));
  if (u.includes('/api/stock-check/options')) { const key = new URL(u, location.origin).searchParams.get('key'); const typed = new URL(u, location.origin).searchParams.get('typed') || ''; return j({ options: key === 'model' ? MODELS.filter((m) => !typed || m.v.includes(typed) || String(m.c).startsWith(typed)) : SIZES }); }
  if (u.includes('/api/stock-check')) return u.includes('model=err403') ? j({ error: 'Forbidden' }, 403) : j(result(u));
  if (u.includes('/api/')) return j({});
  return realFetch(url, opts);
};
createRoot(document.getElementById('root')).render(<StockCheckPage />);
