'use client';

// useCustomerCard — הבקר של כרטיס הלקוח החדש: טעינה, מצב "שמור" מול "נוכחי", רשימת השינויים (מסילה), ביטול/החזר ביטול,
// שמירה (סיכום → PUT), יציאה עם שומר, ביטול חסימה, מחיקה, תשלום, ייצוא/הדפסה/הורדה ורישום האירועים.
// ההתנהגות והחוזים מול השרת כמו בכרטיס הישן (LegacyCustomerPage.js) - הגופים נבנים ב-customerCardLogic.js.
//
// הבטחת ההערות (הבעלים notesedit: "השינוי נרשם רק אחרי שמירת שינויים בבאנר שמאל"): עריכה בתיבת ההערות משנה רק את cur.notes
// בזיכרון; שום קריאה לשרת לא יוצאת עד שלוחצים "שמור" במסילה (או "לשמירה" בטוסט, שהוא אותו פעולה) ומאשרים את חלון הסיכום.
// אין שמירה אוטומטית, אין שמירה ב-blur ואין שמירה בעזיבת השדה (נבדק ב-scripts/customer-card-tests/static.test.mjs).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addHistory } from '@/lib/historyManager';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { getHebrewDateString, getIsraelTodayKey, getIsraelDateKey } from '@/lib/hebrewDate';
import { requiredFieldsFromSettings } from '@/lib/customerRequiredFields';
import {
  accountSummary, deleteBlockers, paymentApprovalLevel, buildPaymentPayload, buildSavePayload, computeChanges, customerXlsxSheets, displayName, manualPaymentMethods,
  nameOk, openCharges, safeFileBase, tabMarkers, undoField, unblockPayload, validateForSave, CARD_FIELD_KEYS,
} from './customerCardLogic';
import { DeleteDialog, DiscardDialog, PaymentDialog, SuccessDialog, SummaryDialog } from './CcDialogs';
import CcApprovalDialog from './CcApproval';
import CcMailSheet from './CcMailSheet';
import { logCustomerEvent } from './ccEvents';

const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
const hebrew = (d) => getHebrewDateString(d);

export default function useCustomerCard(customerId, ui) {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [saved, setSaved] = useState(null);
  const [cur, setCur] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [settings, setSettings] = useState({});
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('details');
  const [editCust, setEditCust] = useState(false);
  const [redoStack, setRedoStack] = useState([]);
  const [saving, setSaving] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const toastShown = useRef(false);
  const toastDismissed = useRef(false);

  // ---------- טעינה ----------
  const load = useCallback(async () => {
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`),
        fetch(`/api/refunds?customerId=${customerId}`),
      ]);
      const c = await cRes.json().catch(() => ({}));
      const r = await rRes.json().catch(() => []);
      if (!cRes.ok || c.error) { setStatus('notfound'); return null; }
      setSaved(c);
      setCur(clone(c));
      if (Array.isArray(r)) setRefunds(r);
      setStatus('ready');
      return c;
    } catch (e) {
      setStatus('error');
      return null;
    }
  }, [customerId]);

  useEffect(() => {
    let off = false;
    load().then((c) => {
      if (off || !c) return;
      // "נפתחו לאחרונה" (NP3) - כמו בכרטיס הישן
      addHistory({ type: 'customer', id: c.id, name: `לקוח: ${[c.firstName, c.lastName].filter(nameOk).join(' ')}`, subtext: c.phone1 || '' });
    });
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((data) => { if (!off && Array.isArray(data)) setSettings(data.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})); })
      .catch(() => {});
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then((data) => { if (!off && data && data.success && data.employee) setMe(data.employee); })
      .catch(() => {});
    return () => { off = true; };
  }, [load]);

  // ---------- נגזרות ----------
  const requiredKeys = useMemo(() => requiredFieldsFromSettings(settings), [settings]);
  const changes = useMemo(() => computeChanges(saved, cur), [saved, cur]);
  const dirty = changes.length > 0;
  const account = useMemo(() => accountSummary(cur, refunds), [cur, refunds]);
  const charges = useMemo(() => openCharges(cur, refunds), [cur, refunds]);
  const markers = useMemo(() => tabMarkers({ customer: cur, requiredKeys, balance: account.balance }), [cur, requiredKeys, account.balance]);
  const isHeadManagement = !!me && (me.roleId === 0 || me.roleId === 2);
  // לקוחה שנמחקה (Customer.isDeleted) - הכרטיס לצפייה בלבד: בלי עריכה, בלי מחיקה, בלי תשלום (פס "נמחק" בראש הדף)
  const readOnly = !!saved?.isDeleted;
  const paymentsEnabled = settings.allow_additional_payment_on_order === 'true';
  const methods = useMemo(() => manualPaymentMethods(settings), [settings]);

  // אזהרת דפדפן בסגירת לשונית עם שינויים שלא נשמרו
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---------- טוסט "שינויים ממתינים לשמירה" (פעם אחת לכל סשן עריכה, C-A21) ----------
  const doSaveRef = useRef(null);
  useEffect(() => {
    if (!dirty) { toastShown.current = false; toastDismissed.current = false; return; }
    if (toastShown.current || toastDismissed.current) return;
    toastShown.current = true;
    ui.toast('info', 'שינויים ממתינים לשמירה', '', { text: 'לשמירה', icon: 'check', onClick: () => doSaveRef.current && doSaveRef.current() }, 6500);
  }, [dirty, ui]);

  // ---------- עריכה ----------
  const setField = useCallback((key, value) => {
    if (!CARD_FIELD_KEYS.includes(key) || readOnly) return;
    setRedoStack([]);
    setCur((c) => ({ ...c, [key]: value }));
  }, [readOnly]);
  const undo = useCallback((field) => {
    setRedoStack((r) => [...r, clone(cur)]);
    setCur((c) => undoField(c, saved, field));
  }, [cur, saved]);
  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setCur(next);
  }, [redoStack]);
  const resetToSaved = useCallback((keepRedo) => {
    if (keepRedo) setRedoStack([clone(cur)]); else setRedoStack([]);
    setCur(clone(saved));
    ui.hideToast();
  }, [cur, saved, ui]);

  const discardAll = useCallback(async () => {
    if (!dirty) return;
    const yes = await ui.openDialog(DiscardDialog, { count: changes.length });
    if (yes) resetToSaved(true);
  }, [dirty, changes.length, ui, resetToSaved]);

  // ---------- שמירה ----------
  const focusField = (field) => {
    setTimeout(() => {
      const el = document.querySelector(`.gm-cc [data-f="${field}"]`);
      if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
    }, 60);
  };

  const putCustomer = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildSavePayload(cur)) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.message) {
          await ui.alert({ title: 'הכרטיס עודכן במקום אחר', sub: data.message, okText: 'הבנתי', icon: 'alert' });
          return false;
        }
        ui.toast('error', data.error || data.message || 'שגיאה בשמירת נתונים', 'השינויים לא נשמרו');
        return false;
      }
      // התשובה של PUT היא שורת הלקוח בלי ההזמנות - שומרים את ההזמנות שכבר בזיכרון
      const merged = { ...cur, ...data, orders: cur.orders };
      setSaved(merged);
      setCur(clone(merged));
      setRedoStack([]);
      setEditCust(false);
      ui.hideToast();
      setHistoryTick((t) => t + 1);
      return true;
    } catch (e) {
      ui.toast('error', 'שגיאת רשת בשמירה', 'השינויים לא נשמרו');
      return false;
    } finally {
      setSaving(false);
    }
  }, [customerId, cur, ui]);

  const printDoc = useCallback((doc) => {
    window.open(`/print/customer?customerId=${encodeURIComponent(customerId)}&type=${doc}`, '_blank', 'noopener');
  }, [customerId]);

  // שמירה: ולידציה → חלון סיכום (כהה) → PUT → חלון "הכרטיס נשמר". מחזיר true כשנשמר.
  const save = useCallback(async ({ fromExit = false } = {}) => {
    if (!dirty || saving) return !dirty;
    const v = validateForSave(cur, { requiredKeys, isNew: false, settings });
    if (!v.ok) {
      setTab('details');
      setEditCust(true);
      ui.toast('error', v.errors[0], v.errors.slice(1).join(' · ') || 'נא לתקן לפני השמירה');
      if (v.field) focusField(v.field);
      return false;
    }
    if (!fromExit) {
      const r = await ui.openDialog(SummaryDialog, { intent: 'save', changes });
      if (r === 'discard') { resetToSaved(true); return false; }
      if (r !== 'save') return false;
    }
    const ok = await putCustomer();
    if (!ok) return false;
    if (!fromExit) {
      const next = await ui.openDialog(SuccessDialog, { head: 'הכרטיס נשמר', sub: `לקוחה · ${displayName(cur)}` });
      if (next === 'print') printDoc('card');
      if (next === 'list') router.push('/customers');
    }
    return true;
  }, [dirty, saving, cur, requiredKeys, settings, ui, changes, resetToSaved, putCustomer, printDoc, router]);
  useEffect(() => { doSaveRef.current = () => save(); }, [save]);

  // יציאה: בלי שינויים - חזרה; עם שינויים - "שינויים שלא נשמרו" (שמור / צא בלי לשמור / חזרה לעריכה)
  const goBack = useCallback((href) => {
    if (href) { router.push(href); return; }
    if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/customers');
  }, [router]);
  const exit = useCallback(async (href) => {
    if (!dirty) { goBack(href); return; }
    const r = await ui.openDialog(SummaryDialog, { intent: 'exit', changes });
    if (r === 'leave') { resetToSaved(false); setTimeout(() => goBack(href), 0); return; }
    if (r === 'save') { const ok = await save({ fromExit: true }); if (ok) goBack(href); }
  }, [dirty, ui, changes, resetToSaved, goBack, save]);

  // ---------- חסימה ----------
  const unblock = useCallback(async () => {
    if (!saved?.id) return;
    const yes = await ui.confirm({ title: 'ביטול חסימה', sub: 'לבטל את חסימת הלקוח מהזמנות חדשות?', okText: 'בטל חסימה', icon: 'shield', cancelText: 'חזרה' });
    if (!yes) return;
    try {
      const res = await fetch(`/api/customers/${saved.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(unblockPayload()) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        ui.toast('error', (data && data.error) || 'שגיאה בביטול החסימה');
        return;
      }
      setSaved((p) => ({ ...p, isBlocked: false, blockedReason: null }));
      setCur((p) => ({ ...p, isBlocked: false, blockedReason: null }));
      ui.toast('info', 'החסימה בוטלה', 'הלקוחה יכולה להזמין שוב');
      setHistoryTick((t) => t + 1);
    } catch {
      ui.toast('error', 'שגיאת רשת בביטול החסימה');
    }
  }, [saved, ui]);

  // ---------- מחיקה ----------
  const deleteCustomer = useCallback(async () => {
    if (readOnly) return;
    // אותו כלל בדיוק כמו השרת (lib/customerAccount.js deleteBlockers); השרת בודק שוב והוא הסמכות
    const { messages: blockers } = deleteBlockers({ orders: saved?.orders || [], refunds, todayKey: getIsraelTodayKey(), dateKey: getIsraelDateKey });
    const yes = await ui.openDialog(DeleteDialog, { blockers });
    if (!yes) return;
    const auth = await ui.openDialog(CcApprovalDialog, { level: 'feature:customer_delete_approval', reason: 'מחיקת כרטיס לקוחה', customerId }, { layer: 2, className: 'apprwin', labelledBy: 'cc-appr-t' });
    if (!auth) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approverId: auth.employeeId, approverPin: auth.pin }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast('error', data.error || 'המחיקה נכשלה'); return; }
      setSaved((s) => ({ ...s, isDeleted: true }));
      setCur((s) => ({ ...s, isDeleted: true }));
      ui.toast('info', 'כרטיס הלקוחה נמחק', `אושר ע״י ${auth.employeeName}`);
      setTimeout(() => router.push('/customers'), 900);
    } catch {
      ui.toast('error', 'שגיאת רשת במחיקה');
    }
  }, [saved, refunds, ui, customerId, router, readOnly]);

  // ---------- תשלום ----------
  // מאושר בהגדרה allow_additional_payment_on_order (כמו "תשלום נוסף" בכרטיס ההזמנה); אחרת "שלם" פותח את ההזמנה (לשונית התשלומים).
  // נעילה בזמן תשלום (מהפתיחה ועד שהרענון מהשרת חוזר) - בלי זה לחיצה כפולה פותחת שני חלונות / רושמת תשלום פעמיים
  const payingRef = useRef(false);
  const [paying, setPaying] = useState(false);
  const pay = useCallback(async (orderId) => {
    if (!charges.length || payingRef.current) return;
    if (readOnly) { ui.toast('error', 'כרטיס הלקוח נמחק', 'אי אפשר לרשום תשלום'); return; }
    if (!paymentsEnabled) {
      const target = orderId || charges[0].order.orderId;
      if (dirty) { await exit(`/orders/${target}`); return; }
      router.push(`/orders/${target}`);
      return;
    }
    payingRef.current = true;
    setPaying(true);
    try {
      // נווה יעקב (consolidate_manual_payment_credit_ui): תשלום ידני דורש מאשר feature:manual_payment_credit_add - כמו הכפתור המאוחד
      // בכרטיס ההזמנה הישן (app/orders/[id]/page.js handleOpenManualPaymentCredit), לפני חלון התשלום.
      const level = paymentApprovalLevel(settings);
      if (level) {
        const auth = await ui.openDialog(CcApprovalDialog, { level, reason: 'הוספת תשלום ידני מכרטיס הלקוח', customerId }, { layer: 2, className: 'apprwin', labelledBy: 'cc-appr-t' });
        if (!auth) return;
      }
      const r = await ui.openDialog(PaymentDialog, { charges, defaultOrderId: orderId, methods });
      if (!r) return;
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPaymentPayload(r)) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast('error', data.error || 'שגיאה בשמירת התשלום'); return; }
      // ההזמנות והתשלומים נטענים מחדש מהשרת; שינויים שלא נשמרו בפרטים נשארים
      const keep = cur;
      const res2 = await fetch(`/api/customers/${customerId}`);
      const fresh = res2.ok ? await res2.json().catch(() => null) : null;
      if (fresh && !fresh.error) {
        setSaved((s) => ({ ...s, orders: fresh.orders, updatedAt: fresh.updatedAt }));
        setCur(() => ({ ...keep, orders: fresh.orders, updatedAt: fresh.updatedAt }));
      }
      ui.toast('info', `נרשם תשלום ₪${Number(r.amount).toLocaleString('he-IL')} · ${r.paymentMethod}`, `הזמנה #${r.orderId}`);
      setHistoryTick((t) => t + 1);
    } catch {
      ui.toast('error', 'שגיאת רשת בשמירת התשלום');
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }, [charges, paymentsEnabled, dirty, exit, router, ui, methods, cur, customerId, settings, readOnly]);

  // ---------- מייל ----------
  const mailGuard = useRef(null);
  const openMail = useCallback(async () => {
    if (!saved?.email) {
      ui.toast('error', 'ללקוחה זו לא מעודכנת כתובת מייל', "יש לעדכן בלשונית 'פרטים' ולשמור תחילה");
      return;
    }
    await ui.openDialog(CcMailSheet, {
      customer: saved,
      ui,
      guard: mailGuard,
      onSent: ({ to, count, links }) => {
        ui.toast('info', `נשלח ל-${to} · ${count === 0 ? 'ללא קבצים' : count === 1 ? 'קובץ אחד' : `${count} קבצים`}`, links.length ? `${links.length} קבצים בדרייב עם הרשאת הורדה מלאה` : '');
        setHistoryTick((t) => t + 1);
      },
    }, { className: 'mailwin fx-sheet', labelledBy: 'mail-t', onEscape: () => mailGuard.current && mailGuard.current() });
  }, [saved, ui]);

  // ---------- ייצוא / הורדה / הדפסה ----------
  const exportXlsx = useCallback(async () => {
    if (!saved) return;
    try {
      const XLSX = await import('xlsx');
      const { buildRowsWorkbook } = await import('@/lib/xlsxExport');
      const sheets = customerXlsxSheets(saved, refunds, hebrew);
      const wb = buildRowsWorkbook(XLSX, sheets.details, { sheetName: 'פרטים' });
      for (const [name, rows] of [['הזמנות', sheets.orders], ['תשלומים', sheets.payments]]) {
        if (!rows.length) continue;
        const one = buildRowsWorkbook(XLSX, rows, { sheetName: name });
        XLSX.utils.book_append_sheet(wb, one.Sheets[one.SheetNames[0]], name);
      }
      const fileName = safeFileBase(`כרטיס לקוחה - ${displayName(saved)}`);
      XLSX.writeFile(wb, `${fileName}.xlsx`, { cellDates: true });
      logCustomerEvent(customerId, 'CUSTOMER_XLSX_EXPORTED', { fileName: `${fileName}.xlsx` });
      ui.toast('info', 'קובץ Excel של הלקוחה ירד');
      setHistoryTick((t) => t + 1);
    } catch (e) {
      ui.toast('error', 'הייצוא ל-Excel נכשל');
    }
  }, [saved, refunds, customerId, ui]);

  const downloadCard = useCallback(async () => {
    if (!saved) return;
    ui.toast('info', 'מכין את קובץ הכרטיס…', 'זה יכול לקחת כמה שניות');
    try {
      const { downloadPdf } = await import('@/app/lib/pdfClient');
      const fileName = safeFileBase(`כרטיס לקוחה - ${displayName(saved)}`);
      await downloadPdf({ path: `/print/customer?customerId=${encodeURIComponent(customerId)}&type=card&downloadPdf=true`, filename: fileName }, `${fileName}.pdf`);
      logCustomerEvent(customerId, 'CUSTOMER_PDF_DOWNLOADED', { doc: 'card', fileName: `${fileName}.pdf` });
      ui.toast('info', 'כרטיס הלקוחה ירד כקובץ');
      setHistoryTick((t) => t + 1);
    } catch (e) {
      ui.toast('error', (e && e.message) || 'יצירת הקובץ נכשלה');
    }
  }, [saved, customerId, ui]);

  const printOrder = useCallback((orderId) => {
    // /print/order רושם את ההדפסה בעצמו (חוזה W0 של כרטיס ההזמנה) - לא רושמים כאן כדי שלא תהיה שורה כפולה
    window.open(`/print/order?orderId=${orderId}&type=order`, '_blank', 'noopener');
  }, []);

  return {
    customerId, status, saved, cur, refunds, settings, me, tab, setTab, editCust, setEditCust,
    requiredKeys, changes, dirty, account, charges, markers, isHeadManagement, paymentsEnabled, methods, saving, readOnly, paying,
    redoCount: redoStack.length, historyTick,
    setField, undo, redo, discardAll, save, exit, unblock, deleteCustomer, pay, openMail,
    exportXlsx, downloadCard, printDoc, printOrder, reload: load,
  };
}
