'use client';

// useDcListAi - חיפוש חכם (AI) ושאלות סטטיסטיקה בשלוש הרשימות של כרטיס הדגם (פריטים / השכרות / היסטוריה), כמו רשימת הדגמים (models-list):
//   * ai: placeholder מתחלף (A5List), Enter שולח ל-/api/ai/smart-search עם קוד הדגם בראש הבקשה; התוצאות מצמצמות את הרשימה לשורות של הדגם הזה
//     (פריטים: לפי מזהה / ברקוד; השכרות: לפי הזמנה + ברקוד; יומן: לפי ברקוד הפריט). אין התאמה - הודעת "אין תוצאות" ברשימה.
//   * stats: StatisticsModal (חלון כהה משותף) עם הקשר הדגם. ההרשאות / ההגבלות נשארות כפי שהנקודות האלה אוכפות (403 -> הודעת שגיאה).
// which: 'items' | 'rentals' | 'history'. 'rentals' פונה להקשר OrderItem של ה-endpoint (שם חלה הגבלת העמודות הכספיות); השאר להקשר 'dresses'.
import { useCallback, useEffect, useMemo, useState } from 'react';
import StatisticsModal from '../StatisticsModal';

const MAX_PAGES = 10;

export default function useDcListAi({ dc, ui, which }) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null); // null = אין חיפוש AI פעיל; אחרת { ids:Set, bcs:Set, orders:Set }
  const [stats, setStats] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(document.body.classList.contains('hide-ai-features')); }, []);

  const model = dc.cur.model;
  const code = model.code;
  const context = which === 'rentals' ? 'rentals' : 'dresses';

  const onSubmit = useCallback(async (prompt) => {
    setBusy(true);
    try {
      const full = `בדגם מספר ${code} בלבד (barcodePrefix = ${code}): ${prompt}`;
      const call = (extra) => fetch('/api/ai/smart-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: full, pageContext: context, ...extra }) });
      const res = await call({});
      const first = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast('error', first.error || (res.status === 403 ? 'אין הרשאה לחיפוש חכם' : 'שגיאה בחיפוש החכם'), ''); return; }
      let all = first.data || [];
      for (let p = 2; p <= Math.min(first.totalPages || 1, MAX_PAGES); p++) {
        const r = await call({ page: p, whereClause: first.whereClause });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) break;
        all = all.concat(j.data || []);
      }
      const ids = new Set(); const bcs = new Set(); const orders = new Set();
      all.forEach((x) => {
        if (x.id != null) ids.add(String(x.id));
        const bc = x.dressBarcode || x.barcode; if (bc) bcs.add(String(bc));
        if (x.orderId != null) orders.add(`${x.orderId}|${bc || ''}`);
      });
      setFound({ ids, bcs, orders });
    } catch { ui.toast('error', 'שגיאת תקשורת', ''); } finally { setBusy(false); }
  }, [code, context, ui]);

  const ai = useMemo(() => (hidden ? null : { loading: busy, onSubmit, onReset: () => setFound(null) }), [hidden, busy, onSubmit]);

  /** מצמצם רשימה לתוצאות ה-AI (אם יש חיפוש פעיל). match(row, found) -> boolean */
  const narrow = useCallback((list, match) => (found ? list.filter((r) => match(r, found)) : list), [found]);

  const contextQuery = `המשתמש צופה בכרטיס הדגם ${code}${model.name ? ` (${model.name})` : ''} - barcodePrefix = ${code}. התייחס לדגם הזה בלבד אלא אם נשאל אחרת.`;
  const modal = stats ? <StatisticsModal isOpen onClose={() => setStats(false)} pageContext="dresses" contextQuery={contextQuery} position={null} /> : null;
  return {
    ai, onStats: hidden ? null : () => setStats(true), modal, narrow, active: !!found,
    emptyText: found ? 'ה-AI לא מצא בדגם זה תוצאות התואמות לבקשה' : null,
  };
}
