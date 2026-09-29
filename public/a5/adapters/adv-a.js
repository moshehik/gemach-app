/* A5 adv-a: חיפוש מתקדם בתחומים לקוחות / הזמנות / השכרות / החזרות (נתוני אמת). קריאה בלבד.
   כל הסינון והמיפוי נעשים בשרת ב-/api/a5/adv (אותם כללים כמו העמודים החיים); כאן רק בניית הבקשה. */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.adv = A5.adv || { focus: {} };
  A5.adv.focus = A5.adv.focus || {};

  // מפתחות ADV שרלוונטיים לארבעת התחומים (ר' ADV_KEYS ב-index.html)
  const KEYS = ['from', 'to', 'oid', 'item', 'model', 'name', 'phone', 'city', 'first', 'last', 'email', 'size', 'addr', 'days', 'emp', 'cinfo', 'rdate'];
  const DRAFT_PREFIX = 'gemachOrderDraft:'; // אותו מפתח כמו app/lib/orderDrafts.js
  const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

  // "לא נשמר": טיוטות שינויים בכרטיס הזמנה חיות ב-localStorage של הדפדפן (אין מקור בשרת), כמו ברשימת ההזמנות
  function unsavedOrderIds() {
    const ids = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (!d || !d.savedAt || Date.now() - d.savedAt > DRAFT_MAX_AGE || !d.state) continue;
          const id = parseInt(k.slice(DRAFT_PREFIX.length), 10);
          if (!isNaN(id)) ids.push(id);
        } catch (e) { /* טיוטה פגומה */ }
      }
    } catch (e) { /* localStorage חסום */ }
    return ids.slice(0, 500);
  }

  function run(focus) {
    return async function (ADV) {
      ADV = ADV || {};
      const adv = {};
      KEYS.forEach((k) => { const v = ADV[k]; if (typeof v === 'string' && v.trim()) adv[k] = v.trim(); });
      if (Array.isArray(ADV.flags) && ADV.flags.length) adv.flags = ADV.flags.slice();
      if (Array.isArray(ADV.ost) && ADV.ost.length) adv.ost = ADV.ost.slice();
      const qs = new URLSearchParams({ focus, adv: JSON.stringify(adv) });
      if (focus !== 'customers') {
        const u = unsavedOrderIds();
        if (u.length) qs.set('unsaved', u.join(','));
      }
      const res = await A5.api('/api/a5/adv?' + qs.toString());
      return {
        cols: res.cols || [],
        rows: res.rows || [],
        links: res.links || [],
        al: res.al || [],
        namesRev: res.namesRev || [], // "שם משפחה שם פרטי" - לתצוגה טבלאית בלבד (C-1.8)
        truncated: !!res.truncated,
      };
    };
  }

  ['customers', 'orders', 'rentals', 'returns'].forEach((f) => { A5.adv.focus[f] = run(f); });
})();
