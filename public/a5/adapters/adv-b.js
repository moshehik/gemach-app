/* A5 adv-b: חיפוש מתקדם - משלוחים, תיקונים, כספים, תפוסה, דגמים, עובדים.
   הכל דרך GET /api/a5/adv-b (קריאה בלבד; ההרשאות נאכפות בשרת כמו בעמודים החיים).
   תחום "הגדרות" הוא חיפוש AI בלבד - אין לו מתאם כאן (ר' adv-b.NOTES.md). */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.adv = A5.adv || { focus: {} };
  A5.adv.focus = A5.adv.focus || {};

  const KEYS = ['from', 'to', 'oid', 'item', 'model', 'name', 'phone', 'city', 'first', 'last', 'email', 'q', 'size', 'addr', 'days', 'emp', 'cinfo', 'rdate', 'sfrom', 'sto', 'adate', 'cdate', 'amount', 'cemp', 'ordst', 'branch'];

  function qs(focus, ADV) {
    const p = new URLSearchParams();
    p.set('focus', focus);
    KEYS.forEach((k) => { const v = ADV[k]; if (v != null && String(v).trim() !== '') p.set(k, String(v).trim()); });
    if (ADV.flags && ADV.flags.length) p.set('flags', ADV.flags.join(','));
    if (ADV.ost && ADV.ost.length) p.set('ost', ADV.ost.join(','));
    return p.toString();
  }

  async function run(focus, ADV) {
    const r = await A5.api('/api/a5/adv-b?' + qs(focus, ADV || {}));
    const out = { cols: r.cols, rows: r.rows, links: r.links, al: r.al || [], truncated: !!r.truncated };
    if (r.capstats) out.capstats = r.capstats;
    if (r.gaps && r.gaps.length) out.gaps = r.gaps; // סינונים שלא הוחלו (ר' NOTES)
    return out;
  }

  ['deliveries', 'alterations', 'finance', 'capacity', 'models', 'employees'].forEach((k) => {
    A5.adv.focus[k] = (ADV) => run(k, ADV);
  });
})();
