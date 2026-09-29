/* A5 מתאם: חיפוש גלובלי + חיפוש חכם (AI). מקורות: app/page.js, app/api/global-search, app/api/ai */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.ai = A5.ai || {};

  // נתיב הספרייה של הקובץ הזה (לטעינת xlsx סטטי מאותו מקור, בלי CDN)
  const BASE = (function () {
    try {
      const s = document.currentScript && document.currentScript.src;
      if (s) return s.replace(/[^/]*$/, '');
    } catch (e) { /* ignore */ }
    return '/a5/adapters/';
  })();

  const str = (v) => (v === null || v === undefined ? '' : String(v));

  /* ---------- (1) חיפוש גלובלי ---------- */
  // אותם שדות וסדר כמו app/page.js: לקוח = שם פרטי+משפחה, טלפון1, עיר; הזמנה = שם לקוח, orderId,
  // eventDateHebrew, totalAmount, itemCount, status; השכרה = catalogName||description, barcode||catalogBarcode, sizeText.
  // השרת כבר מגביל ל-50 לכל סוג; לא חותכים כאן (החיתוך ל"עוד N" נעשה בממשק).
  A5.search = async function (q) {
    q = str(q).trim();
    if (!q) return { customers: [], orders: [], rentals: [] };
    const d = (await A5.api('/api/global-search?q=' + encodeURIComponent(q))) || {};
    const customers = (d.customers || []).map((c) => ({
      n: [c.firstName, c.lastName].filter(Boolean).join(' '),
      p: str(c.phone1),
      c: str(c.city),
      id: c.id,
      url: '/customers/' + c.id,
    }));
    const orders = (d.orders || []).map((o) => ({
      n: [o.firstName, o.lastName].filter(Boolean).join(' '),
      id: o.orderId,
      h: str(o.eventDateHebrew),
      t: Number(o.totalAmount) || 0,
      i: Number(o.itemCount) || 0,
      st: str(o.status),
      uuid: o.id,
      url: '/orders/' + o.orderId,
    }));
    const rentals = (d.rentals || []).map((r) => ({
      n: str(r.catalogName || r.description),
      b: str(r.barcode || r.catalogBarcode),
      s: str(r.sizeText),
      orderId: r.orderId,
      url: '/orders/' + r.orderId,
    }));
    return { customers, orders, rentals };
  };

  /* ---------- (2) חיפוש חכם ---------- */
  const CONTEXT = 'User is in the general system home dashboard.'; // זהה ל-app/page.js

  // מסיר [OPEN_SETTING:key] (כמו extractOpenSettingKeys) ו-[OPEN_LINK:route|label] (כמו AIFloatingWidget)
  // וגם [FILTER:term] (שה-AI מוסיף רק בתשובות מלאי; בעמוד הבית החי הוא נשאר גלוי, כאן מוסר).
  function parseTags(content) {
    const text0 = str(content);
    const settingKeys = [];
    const links = [];
    let filter = null;
    let m;
    const rs = /\[OPEN_SETTING:([a-zA-Z0-9_]+)\]/g;
    while ((m = rs.exec(text0)) !== null) settingKeys.push(m[1]);
    const rl = /\[OPEN_LINK:([^\]|]+)\|([^\]]+)\]/g;
    while ((m = rl.exec(text0)) !== null) links.push({ route: m[1].trim(), label: m[2].trim() });
    const rf = /\[FILTER:([^\]]*)\]/g;
    while ((m = rf.exec(text0)) !== null) filter = m[1].trim();
    const t = text0.replace(rs, '').replace(rl, '').replace(rf, '').trim();
    return { t, settingKeys, links, filter };
  }
  A5.ai.parseTags = parseTags;

  // היסטוריה מהצ'אט של האב-טיפוס ({me,t,raw?}) לפורמט השרת ({role:'user'|'model',content}).
  // משתמשים ב-raw (הטקסט המקורי עם התגיות) אם קיים, כמו שהעמוד החי שומר את result.response כמו שהוא.
  A5.ai.toHistory = function (chat) {
    return (chat || [])
      .filter((m) => !m.err)
      .map((m) => ({ role: m.me ? 'user' : 'model', content: m.me ? m.t : (m.raw !== undefined ? m.raw : m.t) }));
  };

  // history = ההודעות שקדמו לשאלה הנוכחית, ללא השאלה עצמה (כמו updatedMessages.slice(0,-1) בעמוד החי).
  A5.ai.ask = async function (prompt, history) {
    const hist = (history || []).map((m) => ({ role: m.role, content: m.content }));
    try {
      const r = await A5.api('/api/ai', { method: 'POST', body: { prompt: prompt, context: CONTEXT, history: hist } });
      const tags = parseTags(r.response);
      const rows = Array.isArray(r.data) && r.data.length > 0 ? r.data : null;
      return {
        t: tags.t,
        settingKeys: tags.settingKeys,
        links: tags.links,
        filter: tags.filter,
        rows: rows,
        raw: r.response,
        sqlQuery: r.sqlQuery || null,
      };
    } catch (e) {
      // כמו העמוד החי: כשל שרת = 'שגיאה בחיפוש חכם.', כשל רשת = 'שגיאת תקשורת.'
      return { t: e && e.status ? 'שגיאה בחיפוש חכם.' : 'שגיאת תקשורת.', settingKeys: [], links: [], filter: null, rows: null, raw: null, err: true, status: e && e.status };
    }
  };

  // עמודות להצגה (בלי _action*)
  const cols = (rows) => (rows && rows.length ? Object.keys(rows[0]).filter((k) => !k.startsWith('_action')) : []);
  A5.ai.cols = cols;
  const cell = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

  // העתקת הודעה: טקסט + טבלה מופרדת בטאב (זהה ל-copyText באב-טיפוס, על שורות אמיתיות)
  A5.ai.copyText = function (m) {
    let t = (m && m.t) || '';
    if (m && m.rows && m.rows.length) {
      const c = cols(m.rows);
      t += '\n\n' + [c.join('\t'), ...m.rows.map((r) => c.map((k) => cell(r[k])).join('\t'))].join('\n');
    }
    return t;
  };

  // עזר לתצוגת שורה ברשימה: כותרת, שורת פרטים וקישור. אין באתר החי תצוגת רשימה (רק טבלה),
  // לכן זה רק סידור מחדש של העמודות האמיתיות: עמודת שם אם קיימת, אחרת הראשונה.
  A5.ai.rowView = function (r) {
    const c = cols([r]);
    const titleKey = c.find((k) => /שם|לקוח/.test(k)) || c[0];
    return {
      title: cell(r[titleKey]),
      parts: c.filter((k) => k !== titleKey && cell(r[k]) !== '').map((k) => ({ k: k, v: cell(r[k]) })),
      url: r._actionUrl || '',
      label: r._actionLabel || '',
    };
  };

  /* ---------- שלושת הכפתורים ---------- */
  function clean(rows) {
    return (rows || []).map((r) => {
      const o = {};
      Object.keys(r).forEach((k) => { if (!k.startsWith('_action')) o[k] = r[k]; });
      return o;
    });
  }
  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const esc = (s) => cell(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const stripExt = (n) => str(n || 'AI_Export').replace(/\.(xlsx|xls|csv)$/i, '');

  let xlsxP = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxP) {
      xlsxP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = BASE + 'vendor/xlsx.mini.min.js'; // אותו מקור, בלי CDN
        s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error('xlsx')));
        s.onerror = () => rej(new Error('xlsx load'));
        document.head.appendChild(s);
      }).catch((e) => { xlsxP = null; throw e; });
    }
    return xlsxP;
  }

  // Excel אמיתי (.xlsx) כמו exportTableToExcel בעמוד החי: גיליון "נתונים", בלי עמודות _action.
  // אם טעינת הספרייה נכשלה: נופלים ל-.xls של טבלת HTML (נפתח באקסל).
  A5.ai.excel = async function (rows, filename) {
    const data = clean(rows);
    const name = stripExt(filename);
    try {
      const X = await loadXlsx();
      const ws = X.utils.json_to_sheet(data);
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ws, 'נתונים');
      X.writeFile(wb, name + '.xlsx');
      return 'xlsx';
    } catch (e) {
      const c = cols(data);
      const html = '<html dir="rtl" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>'
        + c.map((k) => '<th>' + esc(k) + '</th>').join('') + '</tr></thead><tbody>'
        + data.map((r) => '<tr>' + c.map((k) => '<td>' + esc(r[k]) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table></body></html>';
      saveBlob(new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), name + '.xls');
      return 'xls-fallback';
    }
  };

  // הדפסה: חלון עם טבלת RTL פשוטה (בלי משתני עיצוב של האתר, כמו הכלל בחלונות הדפסה)
  A5.ai.print = function (rows, title) {
    const data = clean(rows);
    const c = cols(data);
    const w = window.open('', '_blank');
    if (!w) return false; // חוסם חלונות קופצים
    const ttl = esc(title || 'תוצאות');
    w.document.write('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + ttl + '</title><style>'
      + 'body{font-family:Arial,"Segoe UI",sans-serif;margin:16px;color:#000}h1{font-size:18px;margin:0 0 12px}'
      + 'table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:4px 8px;text-align:right;font-size:12px}'
      + 'th{background:#eee}thead{display:table-header-group}tr{page-break-inside:avoid}'
      + '</style></head><body><h1>' + ttl + '</h1><table><thead><tr>'
      + c.map((k) => '<th>' + esc(k) + '</th>').join('') + '</tr></thead><tbody>'
      + data.map((r) => '<tr>' + c.map((k) => '<td>' + esc(r[k]) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 250);
    return true;
  };

  // הורדה: CSV עם BOM (נפתח נכון בעברית באקסל)
  A5.ai.download = function (rows, filename) {
    const data = clean(rows);
    const c = cols(data);
    const q = (v) => '"' + cell(v).replace(/"/g, '""') + '"';
    const csv = [c.map(q).join(','), ...data.map((r) => c.map((k) => q(r[k])).join(','))].join('\r\n');
    saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), stripExt(filename) + '.csv');
  };
})();
