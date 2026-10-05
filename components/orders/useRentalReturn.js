'use client';

// הלוגיקה של חלון "השכרה והחזרה" (סריקה, השכרה, החזרה תקינה/לא תקינה, ביטולים, הקלדה ידנית כפולה, חסימת לקוח,
// היסטוריית פריט, שמירה/ביטול/יציאה) - הוצאה כמו שהיא מ-RentalReturnModal.js כדי ששני חלונות יחלקו אותה בלי
// כפילות: החלון הקיים (RentalReturnModal - דף ההזמנות, ההשכרות והחלונות הקופצים) והחלון בעיצוב החדש של הלוח החודשי
// (app/components/board/BoardRentalModal.js, החלטות הבעלים 4.10.2026: BRD-E16 "יש עיצוב חדש", BRD-UNV-6 "מלא").
// אותן קריאות API בדיוק (/api/orders/<id>, /api/rentals/scan|confirm|cancel|toggle, /api/returns/scan|report-issue,
// /api/audit/order-item/<id>, /api/customers/<id>) ואותם טקסטים. ההבדל היחיד: הודעה / "בטוח?" / שדה הערה עוברים
// דרך `ui` שהחלון מספק - החלון הקיים מעביר את מה שהיה בו (alert, window.customConfirm, window.customPrompt), החלון
// החדש את החלונות של הפלטה.
//   ui.alert(message)                                  -> void
//   ui.confirm(message, title?)                        -> Promise<boolean>
//   ui.prompt(message, defaultValue, type, opts)       -> Promise<string|null>  (null = ביטול)
//       opts.fallbackConfirm / opts.fallback - ההתנהגות של החלון הקיים כשאין window.customPrompt (החלון החדש מתעלם)
// אישור מנהל בקוד (verifyPin, ./modern/mocAuth) נשאר החלון המשותף של האתר בשני החלונות - זה זרם אישור אחד לכל האתר.

import { useState, useEffect, useRef } from 'react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { addHistory } from '../../lib/historyManager';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { verifyPin } from './modern/mocAuth';
import { describeMismatch } from '../../lib/rentalBarcodeMatch';
import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from '../../lib/lateReturn';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting, EMPTY_NON_WORKING_CONFIG } from '../../lib/businessDays';
import { postReturnScan } from './returnScanClient';

export function useRentalReturn({ orderId, onClose, onUpdate, ui }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enableAlterations, setEnableAlterations] = useState(true);
  const [lateReturnThresholdDays, setLateReturnThresholdDays] = useState(LATE_RETURN_THRESHOLD_DAYS);
  const [nonWorkingDays, setNonWorkingDays] = useState(EMPTY_NON_WORKING_CONFIG);

  const [modalBarcode, setModalBarcode] = useState('');
  const modalBarcodeRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [duplicates, setDuplicates] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);

  const [rentingItemId, setRentingItemId] = useState(null);
  const [inlineBarcode, setInlineBarcode] = useState({});

  // 31 - הקלדה ידנית כפולה כשהברקוד לא נסרק/לא קיים במאגר: מוצג לצד תיבת הסריקה
  // הפרטנית של פריט (יש itemIdToForce ידוע), כי /api/rentals/scan דורש itemIdToForce
  // כדי לשייך הקלדה ידנית לפריט - בסריקה הגלובלית (הזיהוי לפי קידומת+מידה מהברקוד
  // עצמו) אין דרך לדעת לאיזה פריט להצמיד הקלדה ידנית שנכשלה.
  const [manualEntryItemId, setManualEntryItemId] = useState(null);
  const [manualBarcode1, setManualBarcode1] = useState('');
  const [manualBarcode2, setManualBarcode2] = useState('');
  const [manualSigned, setManualSigned] = useState(false);

  // תופס מקרה שבו העובד/ת סוגר/ת את הכרטיס בזמן שממתינים לאישור PIN של מנהל
  // (window.customAuthPrompt) לעקיפת חסימת רזרבה - בלי השומר הזה, כשה-PIN
  // מאומת בסוף, handleRentalScan עדיין ממשיך וכותב לשרת/למצב React על קומפוננטה
  // שכבר לא קיימת, בלי שום אישור גלוי למי שהיה אמור לראות את זה.
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  async function loadOrder(id) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: 'default' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        addHistory({
          type: 'rental',
          id: data.orderId,
          name: `השכרה #${data.orderId}`,
          subtext: data.customer ? `${data.customer.firstName} ${data.customer.lastName}` : ''
        });
      } else {
        ui.alert('שגיאה בטעינת פרטי הזמנה');
        onClose();
      }
    } catch (err) {
      console.error(err);
      ui.alert('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  // Fetch the order when orderId changes
  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    }
  }, [orderId]);

  const refreshOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        if (onUpdate) onUpdate(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Patch a single item's fields locally instead of re-fetching the whole order
  // (which also recomputes obligations and pulls the full price list) after
  // every scan/return - keeps the card responsive during a scanning session.
  const patchItem = (itemId, patch) => {
    setSelectedOrder(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i) };
    });
  };

  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        const altSetting = Array.isArray(data) ? data.find(s => s.key === 'enable_alterations') : null;
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
        }
        const thresholdSetting = Array.isArray(data) ? data.find(s => s.key === 'late_return_threshold_days') : null;
        if (thresholdSetting?.value) setLateReturnThresholdDays(Number(thresholdSetting.value) || LATE_RETURN_THRESHOLD_DAYS);
        // ימים ללא פעילות שהבעלים סימן (ניהול היומן) - משלימים את שישי/שבת/חג/ערב חג במועד ההחזרה הצפוי
        const nonWorkingSetting = Array.isArray(data) ? data.find(s => s.key === NON_WORKING_DAYS_SETTING_KEY) : null;
        setNonWorkingDays(parseNonWorkingDaysSetting(nonWorkingSetting?.value ?? null));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedOrder && modalBarcodeRef.current) {
      modalBarcodeRef.current.focus({ preventScroll: true });
    }
  }, [selectedOrder, duplicates]);

  const activeItems = selectedOrder ? selectedOrder.items.filter(i => !i.isDeleted) : [];
  const pendingItems = activeItems.filter(i => i.barcode && !i.isTaken);
  const pendingCount = pendingItems.length;
  const hasUnsavedInput = Boolean(modalBarcode) || Object.values(inlineBarcode).some(v => v && v.trim());
  const hasUnsavedChanges = pendingCount > 0 || hasUnsavedInput;

  const overallStatus = selectedOrder ? calculateOrderStatus(selectedOrder) : '';
  const overallStatusColor = getStatusColor(overallStatus);

  const handleRentalScan = async (barcodeToScan, itemIdToForce = null, overrideAuth = null, manualParams = null) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.orderId,
          barcode: barcodeToScan,
          ...(itemIdToForce && { itemIdToForce }),
          ...(overrideAuth && { overridePin: overrideAuth.pin, overrideEmployeeId: overrideAuth.employeeId }),
          ...(manualParams || {})
        })
      });
      const data = await res.json();
      if (!isMountedRef.current) return;

      if (res.ok) {
        if (data.duplicateAlterations) {
          setDuplicates(data.options);
        } else {
          patchItem(data.id, { barcode: data.barcode, isTaken: data.isTaken, manualBarcodeEntry: data.manualBarcodeEntry });
          if (data.manualEntry) {
            setManualEntryItemId(null);
            setManualBarcode1('');
            setManualBarcode2('');
            setManualSigned(false);
          }
        }
      } else {
        if (data.unreturned) {
          if (await ui.confirm(data.warning + '\nהאם ברצונך לסמן את הפריט כהוחזר עכשיו?')) {
            const putRes = await fetch('/api/rentals/scan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ unreturnedItemId: data.unreturnedItemId })
            });
            if (putRes.ok && isMountedRef.current) {
              handleRentalScan(barcodeToScan); // Retry scan
            }
          }
        } else if (data.reservedLocation) {
          // חריגת רזרבה/מחסן (item 1 בדוח הבאגים) - לפעמים שמלה מסומנת רזרבה/מחסן
          // אך ניתן להוציא אותה בפועל; מנהל יכול לעקוף את החסימה באישור סיסמה.
          // האימות עצמו (verifyPin, אותו hook משותף שמשמש בכל שאר אתרי אישור-מנהל
          // באפליקציה) הוא רק כדי להציג הודעת שגיאה מוקדמת ללא-מנהל; השרת מוודא
          // שוב את הסיסמה בעצמו (רואים /api/rentals/scan) ולא סומך על דגל מהלקוח.
          //
          // 2026-09-22: מי שרשאי לאשר נקבע בקטלוג ההרשאות ולא בקוד קשיח - חסימת-רזרבה טהורה
          // ב-feature:reserve_rental_approval, חסימת מחסן (או מחסן+רזרבה יחד) ב-feature:warehouse_rental_approval -
          // הבורר והשרת מכריעים באותה הכרעה.
          const reserveApproval = data.reserveOnly;
          const requiredLevel = reserveApproval ? 'feature:reserve_rental_approval' : 'feature:warehouse_rental_approval';
          const authResult = await verifyPin(
            `${data.error}\nלעקוף את החסימה ולהשכיר בכל זאת? נדרש אישור ${reserveApproval ? 'של מי שהורשה לאשר השכרת רזרבה' : 'של מי שהורשה לאשר השכרת מחסן'}.`,
            requiredLevel
          );
          if (authResult && isMountedRef.current) {
            await handleRentalScan(barcodeToScan, itemIdToForce, authResult); // Retry with override
          }
        } else if (data.barcodeMismatch) {
          // enforce_rental_barcode_match: הברקוד לא תואם לדגם/מידה שהוזמנו. מנהל יכול לעקוף
          // באישור סיסמה (השרת מאמת שוב בעצמו) - ואז השליחה חוזרת עם אותם פרמטרים.
          const mismatchMsg = describeMismatch(data.expected, data.scanned);
          const authResult = await verifyPin(
            `${data.overrideRejected ? `${data.error}
` : `${mismatchMsg}.
`}להשכיר בכל זאת? נדרש אישור מנהל.`,
            'feature:barcode_mismatch_override'
          );
          if (authResult && isMountedRef.current) {
            await handleRentalScan(barcodeToScan, itemIdToForce, authResult, manualParams);
          } else if (!authResult) {
            ui.alert(`${mismatchMsg} - הברקוד לא שויך.`);
          }
        } else if (data.barcodeInvalid && itemIdToForce && !manualParams) {
          // 31 - הברקוד לא נמצא במאגר: פותחים אוטומטית את טופס ההקלדה הידנית הכפולה
          // לפריט הזה (יודעים לאיזה פריט לשייך כי הגענו מתיבת הסריקה הפרטנית).
          setManualEntryItemId(itemIdToForce);
          setManualBarcode1(barcodeToScan);
          setManualBarcode2('');
          setManualSigned(false);
          ui.alert(data.error);
        } else {
          ui.alert(data.error);
        }
      }
    } catch (err) {
      console.error(err);
      ui.alert('שגיאת רשת');
    } finally {
      if (isMountedRef.current) setIsBusy(false);
    }
  };

  // 31 - שולח את ההקלדה הידנית הכפולה של הברקוד ל-/api/rentals/scan עם
  // manualEntry/manualConfirm/manualSignature (השרת דורש itemIdToForce כדי לשייך
  // הקלדה ידנית לפריט ספציפי - האימות הכפול עצמו נעשה כאן, בצד הלקוח).
  const confirmManualEntry = async (item) => {
    if (isBusy) return;
    const b1 = manualBarcode1.replace(/\s+/g, '').trim();
    const b2 = manualBarcode2.replace(/\s+/g, '').trim();
    if (!b1 || !b2) {
      ui.alert('יש להקליד את מספר הברקוד פעמיים');
      return;
    }
    if (b1 !== b2) {
      ui.alert('הברקודים שהוקלדו אינם תואמים - יש להקליד שוב את שני השדות');
      return;
    }
    if (!manualSigned) {
      ui.alert('יש לאשר בסימון התיבה שהשמלה אכן ברשותך לפני השמירה');
      return;
    }
    await handleRentalScan(b1, item.id, null, { manualEntry: true, manualConfirm: true, manualSignature: true });
  };

  const cancelManualEntry = () => {
    setManualEntryItemId(null);
    setManualBarcode1('');
    setManualBarcode2('');
    setManualSigned(false);
  };

  const selectDuplicate = async (itemId) => {
    await handleRentalScan(modalBarcode, itemId);
    setDuplicates(null);
  };

  const handleReturnScan = async (barcode) => {
    setIsBusy(true);
    try {
      // postReturnScan מטפל גם בדחיית השרת "האירוע עדיין לא הגיע" (require_approval_for_early_return)
      const { res, data } = await postReturnScan({ orderId: selectedOrder.orderId, barcode });

      if (res.ok) {
        patchItem(data.item.id, { isReturned: data.item.isReturned, returnedOk: data.item.returnedOk, returnDate: data.item.returnDate });
      } else if (!data?.cancelled) {
        ui.alert(data?.error || 'שגיאה בהחזרת פריט');
        // The item may already be up to date on the server (e.g. a previous click
        // already went through) - refresh so the card stops showing a stale status.
        await refreshOrder();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  // איחור בהחזרה (item 3 בדוח הבאגים): שואלים לפני ההחזרה אם לסמן את הפריט כ"הוחזר
  // לא תקין" במקום החזרה רגילה (הלוגיקה שמזהה איחור משותפת עם app/rentals/page.js -
  // ר' lib/lateReturn.js), ואם כן מפנים לזרימת "לא תקין" הקיימת (handleMarkReturnBad)
  // שכבר אוספת הערה. מחזיר true אם הטיפול בפריט הושלם כאן (הקורא לא צריך להמשיך
  // בזרימת ההחזרה הרגילה).
  const checkLateReturnPrompt = async (item) => {
    if (!selectedOrder || !item) return false;
    const { isLate, daysLate } = getLateReturnInfo(selectedOrder, lateReturnThresholdDays, { nonWorkingDays });
    if (!isLate) return false;

    const wantsBad = await ui.confirm(
      `ההחזרה מאוחרת ב-${daysLate} ימים ממועד ההחזרה הצפוי. להחזיר באיחור ולסמן את "${item.description}" כהוחזר במצב לא תקין?`,
      'החזרה באיחור'
    );
    if (!wantsBad) return false;

    await handleMarkReturnBad(item);
    return true;
  };

  // Single smart scan bar: detects whether the barcode belongs to an item
  // currently with the customer (return) or a still-unassigned item (rental).
  const handleGlobalBarcodeScan = async (e) => {
    e.preventDefault();
    if (!modalBarcode || isProcessing) return;

    setIsProcessing(true);
    const cleanBarcode = modalBarcode.replace(/\s+/g, '');

    try {
      const awaitingReturnItem = activeItems.find(i => i.barcode === cleanBarcode && i.isTaken && !i.isReturned);
      if (awaitingReturnItem) {
        const handledAsLate = await checkLateReturnPrompt(awaitingReturnItem);
        if (!handledAsLate) {
          await handleReturnScan(cleanBarcode);
        }
      } else {
        await handleRentalScan(cleanBarcode);
      }
      setModalBarcode('');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmInlineRent = async (item) => {
    if (isBusy) return;
    const barcode = (inlineBarcode[item.id] || '').replace(/\s+/g, '').trim();
    if (!barcode) {
      ui.alert('חובה להזין ברקוד');
      return;
    }
    await handleRentalScan(barcode, item.id);
    setInlineBarcode(prev => ({ ...prev, [item.id]: '' }));
  };

  const confirmRental = async () => {
    try {
      const unscannedCount = selectedOrder.items.filter(i => !i.barcode && !i.isDeleted).length;
      if (unscannedCount > 0) {
        if (!await ui.confirm(`לתשומת לב! לא נסרקו כל הפריטים (${unscannedCount} חסרים). להמשיך בכל זאת?`)) {
          return;
        }
      }

      setIsConfirming(true);
      const res = await fetch('/api/rentals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId })
      });
      if (res.ok) {
        // לפני שסוגרים אוטומטית - לתת הזדמנות מפורשת להדפיס את פרטי ההשכרה (בקשת
        // הנהלה: לא לסגור ישר בלי הצעה להדפיס אחרי סריקת הברקוד האחרון).
        const wantsPrint = await ui.confirm('השכרה אושרה בהצלחה! להדפיס את פרטי ההשכרה?');
        if (wantsPrint) {
          window.open(`/print/order?orderId=${selectedOrder.orderId}`, '_blank');
        }
        onClose();
        if (onUpdate) onUpdate();
      } else {
        const data = await res.json();
        ui.alert(data.error || 'שגיאה באישור ההשכרה');
      }
    } catch (err) {
      console.error(err);
      ui.alert('שגיאה בעת אישור ההשכרה');
    } finally {
      setIsConfirming(false);
    }
  };

  const discardPendingRentals = async () => {
    try {
      await fetch(`/api/rentals/confirm?orderId=${selectedOrder.orderId}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
  };

  const undoReturn = async (itemId) => {
    if (!await ui.confirm('האם אתה בטוח שברצונך לבטל את ההחזרה? הפריט יחזור להיות "אצל הלקוח".')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const undoRental = async (itemId) => {
    if (!await ui.confirm('האם אתה בטוח שברצונך לבטל את הלקיחה? (הפריט יחזור לממתינים)')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      } else {
        const data = await res.json();
        ui.alert(data.error || 'שגיאה בביטול לקיחה');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const showItemDetails = async (item) => {
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let history = [];
      if (res.ok) {
        history = await res.json();
      }
      setItemDetails({ item, history });
    } catch (err) {
      console.error(err);
      setItemDetails({ item, history: [] });
    }
  };

  const doReportIssue = async (itemId, issueType, note = null) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId, issueType, note })
      });
      if (res.ok) {
        await refreshOrder();
        return true;
      } else {
        const data = await res.json();
        ui.alert(data.error || 'שגיאה');
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const reportIssue = async (itemId, issueType) => {
    const note = await ui.prompt('האם אתה בטוח? ניתן להוסיף הערה על הבעיה (אופציונלי) - תתווסף גם הערה אוטומטית בכרטיס הלקוח:', '', 'text', { fallbackConfirm: 'האם אתה בטוח? תוסף הערה אוטומטית בכרטיס הלקוח.' });
    if (note === null) return;
    const success = await doReportIssue(itemId, issueType, note);
    if (success) ui.alert('הערה נוספה בהצלחה.');
  };

  // הפוך של reportIssue(..., 'returned-bad') — מחזיר פריט שסומן "לא תקין" בחזרה למצב "תקין".
  const markReturnGoodAgain = async (itemId) => {
    if (!await ui.confirm('לסמן את הפריט בחזרה כ"הוחזר - תקין"?', 'עדכון מצב פריט')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'setReturnCondition', returnedOk: true })
      });
      if (res.ok) {
        await refreshOrder();
      } else {
        const data = await res.json();
        ui.alert(data.error || 'שגיאה');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMarkReturnGood = async (item) => {
    if (item.isReturned) return;
    if (await checkLateReturnPrompt(item)) return;
    if (!await ui.confirm(`לסמן את "${item.description}" כהוחזר תקין?`, 'אישור החזרה')) return;
    await handleReturnScan(item.barcode);
  };

  const handleMarkReturnBad = async (item) => {
    if (item.isReturned) return;
    // ההערה נאספת כאן, ברגע הסימון "לא תקין" עצמו - לא רק בשלב נפרד אחרי (כמו ב"דווח על
    // בעיה" למעלה) - כדי לתעד מיד מה בדיוק לא תקין, למשל דבר שלא ענו עליו קודם.
    const note = await ui.prompt(`לסמן את "${item.description}" כהוחזר לא תקין? ניתן להוסיף הערה על הבעיה (אופציונלי):`, '', 'text', { fallbackConfirm: `לסמן את "${item.description}" כהוחזר לא תקין?` });
    if (note === null) return;
    await handleReturnScan(item.barcode);
    await doReportIssue(item.id, 'returned-bad', note);
    await maybeBlockCustomerAfterBadReturn(note);
  };

  // אחרי סימון פריט כ"הוחזר לא תקין" - מציע לחסום את הלקוח מהזמנות חדשות (Customer.isBlocked).
  // משתמש בהערה שכבר נאספה למעלה כ-blockedReason אם קיימת, אחרת מבקש הערה נפרדת לחסימה.
  const maybeBlockCustomerAfterBadReturn = async (issueNote) => {
    const customerId = selectedOrder?.customer?.id;
    if (!customerId) return;
    if (!await ui.confirm('האם לחסום את הלקוח מהזמנות חדשות?', 'חסימת לקוח')) return;

    let blockedReason = issueNote;
    if (!blockedReason) {
      blockedReason = await ui.prompt('סיבת החסימה (אופציונלי):', '', 'text', { fallback: '' });
      if (blockedReason === null) blockedReason = '';
    }

    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: true, blockedReason: blockedReason || null })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        ui.alert((data && data.error) || 'שגיאה בחסימת הלקוח');
        return;
      }
      ui.alert('הלקוח נחסם מהזמנות חדשות.');
    } catch (err) {
      console.error(err);
      ui.alert('שגיאת רשת בחסימת הלקוח');
    }
  };

  const handleHeaderSave = async () => {
    if (pendingCount === 0) {
      onClose();
      return;
    }
    if (!await ui.confirm(`לאשר ${pendingCount} פריטים שנסרקו ולסגור את הכרטיס?`, 'שמירה וסגירה')) return;
    await confirmRental();
  };

  const handleHeaderCancel = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    const message = pendingCount > 0
      ? `לבטל ${pendingCount} סריקות שטרם אושרו ולסגור בלי לשמור?`
      : 'יש נתונים שהוזנו ולא נשמרו. לסגור בלי לשמור?';
    if (!await ui.confirm(message, 'ביטול שינויים')) return;
    if (pendingCount > 0) await discardPendingRentals();
    onClose();
  };

  const attemptCloseCard = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    if (pendingCount === 0) {
      if (!await ui.confirm('יש נתונים שהוזנו ולא נשמרו. לסגור בלי לשמור?', 'יציאה מהכרטיס')) return;
      onClose();
      return;
    }
    const wantsSave = await ui.confirm(`יש ${pendingCount} פריטים שנסרקו ולא אושרו. לשמור אותם לפני היציאה?`, 'יציאה מהכרטיס');
    if (wantsSave) {
      await confirmRental();
      return;
    }
    const wantsDiscard = await ui.confirm('למחוק את הסריקות הממתינות ולצאת בלי לשמור?', 'יציאה בלי לשמור');
    if (wantsDiscard) {
      await discardPendingRentals();
      onClose();
    }
  };

  const handlePrintPreConfirm = async () => {
    if (pendingCount === 0) return true;
    return ui.confirm(
      `יש ${pendingCount} פריטים שנסרקו וטרם אושרו - הם לא יופיעו במסמך. להמשיך בכל זאת?`,
      'פריטים לא מאושרים'
    );
  };

  const getItemStatus = (item) => {
    if (item.isReturned) {
      return item.returnedOk
        ? { text: 'הוחזר', tone: 'success' }
        : { text: 'הוחזר - לא תקין', tone: 'danger' };
    }
    if (item.isTaken) {
      return { text: 'מושכר', tone: 'warning' };
    }
    if (item.barcode) {
      return { text: 'נסרק - ממתין לאישור', tone: 'warning' };
    }
    return { text: 'ממתין', tone: 'neutral' };
  };


  return {
    selectedOrder,
    setSelectedOrder,
    loading,
    enableAlterations,
    lateReturnThresholdDays,
    nonWorkingDays,
    modalBarcode,
    setModalBarcode,
    modalBarcodeRef,
    isProcessing,
    isConfirming,
    isBusy,
    duplicates,
    setDuplicates,
    itemDetails,
    setItemDetails,
    rentingItemId,
    setRentingItemId,
    inlineBarcode,
    setInlineBarcode,
    manualEntryItemId,
    setManualEntryItemId,
    manualBarcode1,
    setManualBarcode1,
    manualBarcode2,
    setManualBarcode2,
    manualSigned,
    setManualSigned,
    activeItems,
    pendingItems,
    pendingCount,
    hasUnsavedInput,
    hasUnsavedChanges,
    overallStatus,
    overallStatusColor,
    refreshOrder,
    patchItem,
    handleRentalScan,
    confirmManualEntry,
    cancelManualEntry,
    selectDuplicate,
    handleReturnScan,
    checkLateReturnPrompt,
    handleGlobalBarcodeScan,
    confirmInlineRent,
    confirmRental,
    discardPendingRentals,
    undoReturn,
    undoRental,
    showItemDetails,
    doReportIssue,
    reportIssue,
    markReturnGoodAgain,
    handleMarkReturnGood,
    handleMarkReturnBad,
    maybeBlockCustomerAfterBadReturn,
    handleHeaderSave,
    handleHeaderCancel,
    attemptCloseCard,
    handlePrintPreConfirm,
    getItemStatus,
  };
}

// תצוגת ערך בהיסטוריית הפריט: תאריכים תמיד בלוח עברי בלבד (ללא תאריך לועזי),
// בוליאנים ככן/לא, ושאר הערכים כפי שהם.
export const formatHistoryValue = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'boolean') return val ? 'כן' : 'לא';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      return `${getHebrewDateString(d)} ${time}`;
    }
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};
