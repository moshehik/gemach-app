'use client';

// useNewOrderController — כל ההתנהגות של אשף "הזמנה חדשה" (A5). העתקה נאמנה של LegacyNewOrderPage.js (אותם endpoints, אותם גופי
// בקשות דרך newOrderLogic.js, אותם שערים והבדלי ארגונים), כשההודעות עוברות מ-alert/confirm/customAuthPrompt של הדפדפן לחלונות
// ולטוסט של הפלטה. מה ששונה בכוונה (תשובות הבעלים, answers-neworder.json) מסומן בהערה עם מזהה השורה (R01, R13, Q8 ...).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateDynamicAvailability } from '@/lib/clientInventory';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { isDeliveryAddressRequired, isDeliveryCityRequired, validateDeliveryFields } from '@/lib/deliveryValidation';
import { parseFieldGroups, unsatisfiedFieldGroupErrors, unsatisfiedFieldGroupShortLabels } from '@/lib/customerValidation';
import { resolveOrderRedirectHref, ORDER_REDIRECT_SCREENS } from '@/lib/orderRedirectScreens';
import * as NL from './newOrderLogic';

const TOAST_MS = 2600;
const TOAST_LONG_MS = 6500;

export default function useNewOrderController({ router }) {
  // ---------- שלבים ----------
  const [step, setStep] = useState(0); // אינדקס ב-NL.STEP_KEYS
  const stepKey = NL.STEP_KEYS[step];

  // ---------- state (אותם שמות כמו בישן) ----------
  const [searchMode, setSearchMode] = useState('phone'); // 'phone' | 'name' | 'new'
  const [phoneSearchInput, setPhoneSearchInput] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [foundCustomersFromPhone, setFoundCustomersFromPhone] = useState([]);
  const [pickedFound, setPickedFound] = useState(null); // הלקוח שסומן ברשימת התוצאות (כמה תוצאות לאותו טלפון)
  const [listQuery, setListQuery] = useState('');
  const [listResults, setListResults] = useState(null);
  const [listLoading, setListLoading] = useState(false);

  const [order, setOrder] = useState(() => ({ ...NL.EMPTY_ORDER, items: [] }));
  const [newItem, setNewItem] = useState(() => ({ ...NL.EMPTY_NEW_ITEM, selectedSizes: [] }));
  const [modelQuery, setModelQuery] = useState('');
  const [modelList, setModelList] = useState(null);
  const [pickedModel, setPickedModel] = useState(null);
  // קוד הדגם (barcodePrefix) לכל dressModelId שנבחר - לתצוגה בלבד (R23). לא נכנס לפריטי ההזמנה כדי שגוף השמירה יישאר זהה לישן
  const [modelCodes, setModelCodes] = useState({});
  const [availableSizes, setAvailableSizes] = useState([]);
  const [customerLocations, setCustomerLocations] = useState({ cities: [], streets: [] });
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  const [loadingPreload, setLoadingPreload] = useState(false);
  const [calculatedData, setCalculatedData] = useState({ totalAmount: 0, items: [], deliveryAmount: 0 });
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState(() => ({ ...NL.EMPTY_NEW_CUSTOMER }));
  const [newCustomerError, setNewCustomerError] = useState(null); // R05: הודעת השרת בשמירת לקוח חדש {field, text}
  const [paymentsList, setPaymentsList] = useState([]);
  const [payment, setPayment] = useState({ amount: '', method: 'אשראי', notes: '' });
  const [settings, setSettings] = useState({});
  const [creditCardData, setCreditCardData] = useState({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: '' });
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [reservedOrderId, setReservedOrderId] = useState(null);
  const [draftOrderId, setDraftOrderId] = useState(null);
  const draftOrderIdRef = useRef(null);
  const draftQueueRef = useRef(Promise.resolve());
  const draftSealedRef = useRef(false);
  const pendingSavePaymentsRef = useRef(null);
  const [saveError, setSaveError] = useState(null); // R29: {title, lines?, spacingNote?, detail?}
  const [saved, setSaved] = useState(null); // {orderId, customerId, warning}
  const [addPreview, setAddPreview] = useState(null); // S06: { total, alt: {neck, sleeve, len} }
  const [addError, setAddError] = useState('');
  const [rangePending, setRangePending] = useState(null);
  const [capacityItem, setCapacityItem] = useState(null);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);
  const todayKey = useMemo(() => getIsraelTodayKey(), []);

  // ---------- טוסט ----------
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const say = useCallback((kind, big, small) => {
    setToast({ kind, big, small, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'ok' ? TOAST_MS : TOAST_LONG_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ---------- חלונות (שתי שכבות: #dlg, #dlg2) ----------
  const [dlg, setDlg] = useState({ 1: null, 2: null });
  // מנהל החלונות (NL.createDialogManager): תשובה מתוייגת-id של חלון שנסגר לא משפיעה על החלון הבא (ממצא סקירה 6)
  const [dlgMgr] = useState(() => NL.createDialogManager((L, value) => setDlg(prev => ({ ...prev, [L]: value }))));
  const ask = useCallback((type, props = {}, layer) => dlgMgr.ask(type, props, layer), [dlgMgr]);
  const answer = useCallback((L, result, id) => { dlgMgr.answer(L, result, id); }, [dlgMgr]);
  const showBusy = useCallback((on, kind) => {
    dlgMgr.setBusy(on);
    setDlg(prev => ({ ...prev, 2: on ? { type: 'busy', props: { kind } } : (prev[2] && prev[2].type === 'busy' ? null : prev[2]) }));
  }, [dlgMgr]);
  // אישור הרשאה (במקום verifyPin / customAuthPrompt): הבדיקה מול /api/auth/verify-pin נעשית בתוך החלון
  const verifyPin = useCallback((message, level) => ask('approval', { message, level }), [ask]);

  // ---------- הגדרות + נתוני עזר ----------
  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          const settingsObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(settingsObj);
          const opts = NL.computePaymentMethodOptions(settingsObj);
          if (opts.length > 0) setPayment(prev => ({ ...prev, method: opts[0] }));
        } else {
          setSettings(data || {});
        }
      })
      .catch(err => console.error(err));
  }, []);

  // 1cbaf995 / fdce699f: נווה יעקב לא מזמינים חו"ל / תפוסה ארוכה (allow_abroad_long_stay_orders). כשההגדרה כבויה האשף תמיד במצב אירוע רגיל
  // (תאריך בודד) - גם אם ה-state כבר הוגדר כ-isAbroad. ברירת מחדל (חסר / כל ערך שאינו 'false') = מוצג כמו תמיד.
  const allowAbroad = NL.abroadAllowedOf(settings);
  useEffect(() => {
    if (allowAbroad) return;
    setRangePending(null);
    setOrder(prev => ((prev.isAbroad || prev.fromDate || prev.toDate) ? { ...prev, isAbroad: false, fromDate: '', toDate: '' } : prev));
  }, [allowAbroad, order.isAbroad, order.fromDate, order.toDate]);

  // R15 (אושר): סניף ביצוע נזכר מההזמנה הקודמת במחשב הזה
  useEffect(() => {
    if (settings.track_branch_on_order !== 'true') return;
    let remembered = '';
    try { remembered = localStorage.getItem('gemach_last_order_branch') || ''; } catch { /* אין גישה ל-localStorage */ }
    if (!remembered) return;
    setOrder(prev => (prev.branch || prev.isPhoneOrder) ? prev : { ...prev, branch: remembered });
  }, [settings.track_branch_on_order]);

  useEffect(() => {
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then(data => setCustomerLocations({ cities: (data && data.cities) || [], streets: (data && data.streets) || [] }))
      .catch(err => console.error(err));
  }, []);

  const paymentMethodOptions = NL.computePaymentMethodOptions(settings);
  const fieldGroups = useMemo(() => parseFieldGroups(settings.mandatory_field_groups), [settings.mandatory_field_groups]);
  const deliveryPriceCities = useMemo(() => NL.deliveryPriceCitiesOf(settings), [settings]);
  const deliveryCityOptions = useMemo(() => NL.deliveryCityOptionsOf(settings, customerLocations.cities), [settings, customerLocations.cities]);
  const missingOf = useCallback((c) => NL.getMissingMandatoryCustomerFields(settings, c), [settings]);

  // ---------- לקוח ----------
  const handleCheckPhone = async () => {
    if (!phoneSearchInput || phoneSearchInput.trim().length < 9) { say('info', 'נא להזין מספר טלפון תקין'); return; }
    setIsCheckingPhone(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(phoneSearchInput.trim())}&limit=20`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setFoundCustomersFromPhone(data.data);
        setPickedFound(data.data.length === 1 ? data.data[0] : null);
      } else {
        setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
        setFoundCustomersFromPhone([]);
        setSearchMode('new');
      }
    } catch (e) {
      console.error(e);
      say('info', 'שגיאה בחיפוש הלקוח');
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // "מהרשימה" (Q4 = התנהגות האתר: בחירה ברשימה רק קובעת לקוח; נבדקת רק החסימה, בלחיצה על "המשך")
  useEffect(() => {
    if (searchMode !== 'name' || order.selectedCustomer) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(listQuery)}&limit=50`, { signal: ctl.signal });
        const data = await res.json();
        if (!ctl.signal.aborted) setListResults(data.data || []);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Failed to fetch customers', err);
      } finally {
        if (!ctl.signal.aborted) setListLoading(false);
      }
    }, 300);
    return () => { ctl.abort(); clearTimeout(t); };
  }, [searchMode, listQuery, order.selectedCustomer]);

  const pickFromList = (c) => {
    if (!c) { setOrder(prev => ({ ...prev, customerId: '', selectedCustomer: null })); return; }
    setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }));
  };

  const confirmBlockedCustomerOverride = async (customer) => {
    if (!customer || !customer.isBlocked) return true;
    const authResult = await verifyPin(
      `לקוח זה חסום מהזמנות חדשות${customer.blockedReason ? ` (${customer.blockedReason})` : ''}.\nלעקוף את החסימה ולהמשיך בכל זאת? נדרש אישור הנהלה ראשית.`,
      'הנהלה ראשית'
    );
    return !!authResult;
  };

  const goStep = (key) => { setStep(NL.STEP_KEYS.indexOf(key)); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleUseExistingCustomer = async (existingCustomer) => {
    if (!await confirmBlockedCustomerOverride(existingCustomer)) return;
    const missingFields = missingOf(existingCustomer);
    const missingGroupLabels = unsatisfiedFieldGroupShortLabels(existingCustomer, fieldGroups);
    const missingContactMethod = missingGroupLabels.length > 0;
    if (missingFields.length > 0 || missingContactMethod) {
      const missingParts = [...missingFields.map(k => NL.CUSTOMER_FIELD_LABELS[k]), ...missingGroupLabels];
      if (settings.strict_mandatory_fields === 'true') {
        say('info', `לא ניתן להמשיך - ללקוח חסרים פרטי חובה: ${missingParts.join(', ')}.`, 'אפשר ללחוץ על "עריכת פרטי לקוח" להשלמת הפרטים ואז לחזור ולנסות שוב, או לבטל ולבחור לקוח אחר.');
        return;
      }
      if (missingContactMethod) {
        const auth = await verifyPin(
          `ללקוח זה חסרים פרטי חובה: ${missingParts.join(', ')}.\nנדרש אישור מנהל כדי לעקוף ולהמשיך בכל זאת בלי אמצעי תקשורת נוסף.\nאפשר גם ללחוץ "ביטול" ואז על הכפתור "עריכת פרטי לקוח" כדי להשלים את הפרטים במקום.`,
          'feature:missing_contact_approval'
        );
        if (!auth) return;
      } else {
        const confirmed = await ask('confirm', { message: `ללקוח זה חסרים פרטי חובה: ${missingParts.join(', ')}.\nהאם לאשר חריגה ולהמשיך בכל זאת בלי להשלים את הפרטים?` });
        if (!confirmed) return;
      }
    }
    setOrder(prev => ({ ...prev, customerId: existingCustomer.id, selectedCustomer: existingCustomer }));
    closeDupCustomer();
    goStep('dates');
  };
  const closeDupCustomer = () => { if (dlg[1] && dlg[1].type === 'dupCustomer') answer(1, undefined); };

  const proceedToStep2 = async () => {
    if (!order.customerId) { say('info', 'יש לבחור לקוח'); return; }
    if (!await confirmBlockedCustomerOverride(order.selectedCustomer)) return;
    goStep('dates');
  };

  const handleSaveNewCustomerAndProceed = async (skipDuplicateCheck = false) => {
    setNewCustomerError(null);
    const missingFields = missingOf(newCustomer);
    if (missingFields.length > 0) { say('info', `יש למלא: ${missingFields.map(k => NL.CUSTOMER_FIELD_LABELS[k]).join(', ')}`); return; }
    // Q7: ת"ז חובה רק בגמ"ח שבו require_customer_id_number דולק (נווה יעקב)
    if (settings.require_customer_id_number === 'true' && !String(newCustomer.zeout || '').trim()) { say('info', 'יש למלא: תעודת זהות'); return; }
    const newCustomerGroupErrors = unsatisfiedFieldGroupErrors(newCustomer, fieldGroups);
    if (newCustomerGroupErrors.length > 0) {
      const auth = await verifyPin(`${newCustomerGroupErrors.join('. ')} - חסר ללקוח זה. נדרש אישור מנהל כדי לעקוף ולהמשיך בכל זאת.`, 'feature:missing_contact_approval');
      if (!auth) return;
    }
    if (skipDuplicateCheck !== true) {
      try {
        const res = await fetch(`/api/customers?phone=${encodeURIComponent(newCustomer.phone1)}&limit=20`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          ask('dupCustomer', { customers: data.data }, 1);
          return;
        }
      } catch { /* ממשיכים כמו בישן */ }
    }
    try {
      const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCustomer) });
      const data = await res.json();
      if (res.ok) {
        closeDupCustomer();
        setOrder(prev => ({ ...prev, customerId: data.id, selectedCustomer: data }));
        say('ok', 'כרטיס לקוח נוצר', NL.getCustomerFullName(data));
        goStep('dates');
      } else {
        // R05 (אושר): הודעות התקינות של השרת - שורה מתחת לשדה הרלוונטי + טוסט
        const errorMsg = data.error || 'שגיאה בשמירת לקוח';
        setNewCustomerError({ field: fieldOfServerError(errorMsg), text: errorMsg });
        say('info', 'שגיאה בשמירת לקוח', errorMsg);
      }
    } catch (e) {
      setNewCustomerError({ field: null, text: e.message });
      say('info', 'שגיאה בשמירת לקוח', e.message);
    }
  };

  // ---------- תאריכים + מלאי ----------
  const preloadDeps = [order.eventDate, order.fromDate, order.toDate, order.isAbroad];
  useEffect(() => {
    if (NL.hasDatesForInventory(order)) {
      setLoadingPreload(true);
      fetch(`/api/inventory/preload?${NL.buildPreloadParams(order, draftOrderIdRef.current)}`)
        .then(res => { if (!res.ok) throw new Error('Failed to load cache'); return res.json(); })
        .then(data => { setInventoryCache(data); setLoadingPreload(false); })
        .catch(err => { console.error(err); setLoadingPreload(false); });
    } else {
      setInventoryCache(null);
    }
     
  }, preloadDeps);

  const refreshInventory = () => {
    if (!NL.hasDatesForInventory(order)) return;
    setLoadingPreload(true);
    fetch(`/api/inventory/preload?${NL.buildPreloadParams(order, draftOrderIdRef.current, new Date().getTime())}`)
      .then(res => { if (!res.ok) throw new Error('Failed to load cache'); return res.json(); })
      .then(data => { setInventoryCache(data); setLoadingPreload(false); say('ok', 'זמינות המלאי רועננה'); })
      .catch(err => { console.error(err); setLoadingPreload(false); });
  };

  useEffect(() => {
    if (NL.hasDatesForInventory(order) && newItem.dressModelId && inventoryCache) {
      setLoadingSizes(true);
      try {
        const localAvailability = calculateDynamicAvailability(
          newItem.dressModelId,
          order.isAbroad ? order.fromDate : order.eventDate,
          order.isAbroad ? order.toDate : null,
          inventoryCache,
          order.items,
          order.customSpacing
        );
        setAvailableSizes(localAvailability);
        setNewItem(prev => {
          if (prev.preserveSize) { const { preserveSize: _p, ...rest } = prev; return rest; }
          return { ...prev, selectedSizes: [] };
        });
      } catch (err) {
        console.error('Error calculating local availability:', err);
      } finally {
        setLoadingSizes(false);
      }
    } else {
      setAvailableSizes([]);
    }
  }, [order.eventDate, order.fromDate, order.toDate, order.isAbroad, order.customSpacing, newItem.dressModelId, inventoryCache, order.items]);

  // handleDateChangeWithValidation: R13 + Q5 - חוסר מלאי חוסם את השינוי ומוצג בחלון עם פירוט (לא alert)
  const handleDateChangeWithValidation = async (fieldOrUpdates, valueIfField) => {
    const attempted = typeof fieldOrUpdates === 'object' ? fieldOrUpdates : { [fieldOrUpdates]: valueIfField };
    if (NL.abroadDateChangeBlocked(allowAbroad, attempted)) return false; // 1cbaf995 / fdce699f
    const prop = NL.proposeDateChange(order, fieldOrUpdates, valueIfField);
    if (prop.error) { say('info', prop.error); return false; }
    const { proposedOrder } = prop;
    const activeItems = order.items.filter(i => !i.isDeleted);
    if (activeItems.length > 0) {
      try {
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(NL.buildValidateBody(activeItems, proposedOrder, draftOrderIdRef.current))
        });
        const validateData = await validateRes.json();
        if (validateData.error) { say('info', 'שגיאה בבדיקת מלאי', validateData.error); return false; }
        if (!validateData.valid) {
          const rows = NL.stockShortageLines(validateData.errors);
          await ask('stock', {
            title: 'לא ניתן לשנות את התאריך', intro: 'עקב חוסר במלאי לפריטים הקיימים בהזמנה:', rows,
            spacingNote: rows.some(r => r.spacing) ? NL.SPACING_NOTE : '',
          });
          return false;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        say('info', 'שגיאה בבדיקת המלאי מול השרת.');
        return false;
      }
    }
    setOrder(proposedOrder);
    return true;
  };

  const handleSpacingChange = async (val) => {
    if (NL.spacingNeedsApproval(order.customSpacing, val)) {
      const choice = await ask('spacing', {});
      if (choice === 'search') { setShowCapacitySearch(true); return; }
      if (choice !== 'yes') return;
      const auth = await verifyPin('שינוי ציפוף ימים מיוחד להזמנה דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:special_spacing_approval');
      if (!auth) return;
    }
    handleDateChangeWithValidation('customSpacing', val);
  };

  // ---------- פריטים ----------
  useEffect(() => {
    if (stepKey !== 'items' || pickedModel) return undefined;
    let off = false;
    const t = setTimeout(() => {
      fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(modelQuery.trim())}&hasActiveItems=true`, { ttl: TTL.REFERENCE })
        .then(d => { if (!off) setModelList((d && d.models) || []); })
        .catch(() => { if (!off) setModelList([]); });
    }, 300);
    return () => { off = true; clearTimeout(t); };
  }, [stepKey, modelQuery, pickedModel]);

  const pickModel = (model) => {
    setAddError('');
    if (!model || !model.id) {
      setPickedModel(null);
      setNewItem(prev => ({ ...prev, dressModelId: '', dressName: '', selectedSizes: [] }));
      return;
    }
    setPickedModel(model);
    if (model.barcodePrefix) setModelCodes(prev => ({ ...prev, [model.id]: String(model.barcodePrefix) }));
    setModelQuery('');
    setNewItem(prev => ({ ...prev, dressModelId: model.id, dressName: model.name, selectedSizes: [] }));
  };
  // Enter בשדה החיפוש: התאמה מדויקת לשם/קוד בוחרת; אחרת הודעה (כמו resolveTypedValue של OrderModelSelector)
  const resolveTypedModel = async () => {
    const typed = modelQuery.trim();
    if (!typed) return;
    const findExact = (list) => (list || []).find(m => (m.name && m.name.trim().toLowerCase() === typed.toLowerCase()) || (m.barcodePrefix && String(m.barcodePrefix).trim().toLowerCase() === typed.toLowerCase()));
    let match = findExact(modelList);
    if (!match) {
      try { const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(typed)}&hasActiveItems=true`, { ttl: TTL.REFERENCE }); match = findExact(data.models); } catch (err) { console.error(err); }
    }
    if (match) pickModel(match);
    else say('info', `לא נמצא דגם עם השם/קוד "${typed}".`, 'יש לבחור דגם מהרשימה.');
  };

  const toggleSizeSelection = (sizeText) => setNewItem(prev => ({
    ...prev,
    selectedSizes: prev.selectedSizes.includes(sizeText) ? prev.selectedSizes.filter(s => s !== sizeText) : [...prev.selectedSizes, sizeText]
  }));
  const setNewItemField = (name, value) => { setAddError(''); setNewItem(prev => ({ ...prev, [name]: value })); };

  // S06 (להכניס): מחיר ליד כל תיקון ו"להוספה: ₪N" - תצוגה מקדימה מאותו /api/orders/calculate (קריאה בלבד)
  useEffect(() => {
    if (!newItem.dressModelId || newItem.selectedSizes.length === 0) { setAddPreview(null); return undefined; }
    let off = false;
    const t = setTimeout(async () => {
      try {
        const post = (body) => fetch('/api/orders/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
        const bodies = NL.buildAddPreviewBodies(order, newItem);
        const [sum, base, probe] = await Promise.all([
          post(bodies.withCart),
          bodies.base ? post(bodies.base) : Promise.resolve(null),
          settings.enable_alterations !== 'false' ? post(NL.buildAltProbeBody(order, newItem, newItem.selectedSizes[0])) : Promise.resolve(null),
        ]);
        if (off) return;
        const ci = (probe && probe.calculatedItems) || [];
        setAddPreview({ total: NL.addPreviewTotal(sum && sum.totalAmount, base && base.totalAmount), alt: { neck: ci[0] ? ci[0].repairsCost || 0 : 0, sleeve: ci[1] ? ci[1].repairsCost || 0 : 0, len: ci[2] ? ci[2].repairsCost || 0 : 0 } });
      } catch { if (!off) setAddPreview(null); }
    }, 300);
    return () => { off = true; clearTimeout(t); };
     
  }, [newItem.dressModelId, newItem.selectedSizes, newItem.neckAlteration, newItem.sleeveAlteration, newItem.lengthAlteration, order.eventDate, order.isAbroad, order.items, order.isDelivery, order.deliveryCity, order.deliveryDirection, settings.enable_alterations]);

  const addItemToOrder = async () => {
    setAddError('');
    if (newItem.selectedSizes.length === 0) { say('info', 'יש לבחור דגם ומידה אחת לפחות לפני ההוספה'); return; }
    const prep = NL.prepareItemForAdd(settings, newItem);
    if (prep.error) { setAddError(prep.error); return; } // Q8: "פירוט לתופרת" חובה
    const { unavailable, validSizes } = NL.splitSizesByAvailability(newItem.selectedSizes, availableSizes);
    if (validSizes.length === 0) { say('info', 'כל המידות שנבחרו אזלו מהמלאי לתאריך זה.'); return; }
    const maxErr = NL.maxItemsError(settings, order.items.length, validSizes.length);
    if (maxErr) { say('info', maxErr); return; }
    const prices = await Promise.all(validSizes.map(({ sizeText }) =>
      fetch(NL.buildPricingUrl(newItem.dressModelId, sizeText, order.eventDate)).then(res => res.json()).catch(() => ({ basePrice: 0 }))));
    // Q8 - סטייה מכוונת מהישן: הישן בונה את הפריטים מ-newItem, ולכן הפירוט האוטומטי מהתיקונים שסומנו (describeAlterations,
    // alteration_details_optional='true') לא נכנס לגוף ו-repairs נשלח ריק. כאן נבנה מ-prep.itemToAdd כדי שההערה האוטומטית כן תישלח.
    const itemsToAdd = NL.buildItemsToAdd(prep.itemToAdd, validSizes, prices);
    setOrder(prev => ({ ...prev, items: [...prev.items, ...itemsToAdd] }));
    setNewItem(prev => ({ ...prev, selectedSizes: [], repairs: '', neckAlteration: false, sleeveAlteration: false, lengthAlteration: '' }));
    if (unavailable.length > 0) say('info', `שימו לב: המידות הבאות אזלו מהמלאי ולא נוספו: ${unavailable.join(', ')}`);
    else say('ok', validSizes.length > 1 ? `${validSizes.length} פריטים נוספו לסל` : 'הפריט נוסף לסל', `${NL.displayModelName(pickedModel || { name: newItem.dressName })} · ${validSizes.map(v => v.sizeText).join(', ')}`);
  };

  const removeItem = (index) => {
    setOrder(prev => {
      const updated = [...prev.items];
      const removedItem = updated[index];
      if (removedItem && removedItem.dressModelId === newItem.dressModelId) {
        setAvailableSizes(sizes => sizes.map(s => (s.sizeText === removedItem.sizeText ? { ...s, availableQuantity: s.availableQuantity + 1 } : s)));
      }
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };
  const confirmRemoveItem = async (index) => {
    if (await ask('confirm', { title: 'הסרת פריט', message: 'האם אתה בטוח שברצונך להסיר את הפריט מהסל?', ok: 'הסר' })) removeItem(index);
  };
  const editItem = (index) => {
    const itemToEdit = order.items[index];
    setPickedModel({ id: itemToEdit.dressModelId, name: itemToEdit.dressName, barcodePrefix: modelCodes[itemToEdit.dressModelId] });
    setNewItem({
      dressModelId: itemToEdit.dressModelId || '', selectedSizes: itemToEdit.sizeText ? [itemToEdit.sizeText] : [], quantity: itemToEdit.quantity || 1,
      repairs: itemToEdit.repairs || '', dressName: itemToEdit.dressName || '', neckAlteration: itemToEdit.neckAlteration || false,
      sleeveAlteration: itemToEdit.sleeveAlteration || false, lengthAlteration: itemToEdit.lengthAlteration || '', preserveSize: true
    });
    removeItem(index);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------- חישוב מחיר ----------
  useEffect(() => {
    if (order.items.length === 0) { setCalculatedData({ totalAmount: 0, items: [], deliveryAmount: 0 }); return; }
    setCalculating(true);
    fetch('/api/orders/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NL.buildCalculateBody(order)) })
      .then(res => res.json())
      .then(data => { setCalculatedData({ totalAmount: NL.roundMoney(data.totalAmount), items: data.calculatedItems || [], deliveryAmount: data.deliveryAmount || 0 }); setCalculating(false); })
      .catch(() => setCalculating(false));
     
  }, [order.items, order.eventDate, order.isAbroad, order.isDelivery, order.deliveryCity, order.deliveryDirection]);
  const totalAmount = calculatedData.totalAmount;

  useEffect(() => {
    const remainder = Math.max(0, NL.roundMoney(totalAmount - NL.sumPaid(paymentsList)));
    setPayment(prev => ({ ...prev, amount: remainder }));
  }, [totalAmount, paymentsList]);

  // ---------- טיוטה אוטומטית ----------
  useEffect(() => {
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    if (draftSealedRef.current || !order.customerId || !NL.datesFilledOf(order) || activeItems.length === 0) return undefined;
    const timer = setTimeout(() => {
      draftQueueRef.current = draftQueueRef.current.then(async () => {
        if (draftSealedRef.current) return;
        try {
          const res = await fetch('/api/orders/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NL.buildDraftBody(order, draftOrderIdRef.current, totalAmount, activeItems)) });
          const draft = await res.json();
          if (res.ok && draft && draft.orderId && !draftSealedRef.current) {
            draftOrderIdRef.current = draft.orderId;
            setDraftOrderId(draft.orderId);
          }
        } catch (err) {
          console.error('Draft autosave failed', err);
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
     
  }, [order.customerId, order.eventDate, order.eventDateHebrew, order.returnDate, order.isAbroad, order.fromDate, order.toDate, order.notes, order.customSpacing, order.items, totalAmount]);

  // R01 (להסיר): אין קישור "טיוטה #N" בשורה העליונה; החיווי השקט נשאר כטוסט (כמו ה-flash בישן)
  const lastFlashedDraftRef = useRef(null);
  useEffect(() => {
    if (draftOrderId && lastFlashedDraftRef.current !== draftOrderId) {
      lastFlashedDraftRef.current = draftOrderId;
      say('ok', `נשמרה טיוטה #${draftOrderId}`, `הפריטים מוחזקים במלאי ל-${parseInt(settings.inventory_hold_minutes, 10) || 15} דקות`);
    }
  }, [draftOrderId, say, settings.inventory_hold_minutes]);

  // ---------- R02 (אושר): מגן "אחורה" בדפדפן - חלון של הדף במקום window.confirm ----------
  const backGuardArmedRef = useRef(false);
  const hasStartedOrderRef = useRef(false);
  useEffect(() => {
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    const hasNewCustomerInput = Object.values(newCustomer).some(v => (typeof v === 'string' ? v.trim() : !!v));
    hasStartedOrderRef.current = !!(order.customerId || activeItems.length > 0 || hasNewCustomerInput || (phoneSearchInput && phoneSearchInput.trim())) && !saved;
    if (hasStartedOrderRef.current && !backGuardArmedRef.current) {
      backGuardArmedRef.current = true;
      window.history.pushState({ gemachOrderGuard: true }, '', window.location.href);
    }
  }, [order.customerId, order.items, newCustomer, phoneSearchInput, saved]);
  // ממצא סקירה 7: בזמן חיוב אשראי / שמירה לא מציעים לצאת - יציאה אז משאירה כרטיס שחויב בלי הזמנה שנשמרה
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = saving || isProcessingCredit; }, [saving, isProcessingCredit]);
  useEffect(() => {
    const handlePopState = async () => {
      if (!backGuardArmedRef.current || !hasStartedOrderRef.current) return;
      window.history.pushState({ gemachOrderGuard: true }, '', window.location.href);
      if (busyRef.current) { say('info', 'לא ניתן לצאת כרגע', 'מתבצע חיוב / שמירה של ההזמנה. יש להמתין לסיומם.'); return; }
      const leave = await ask('backGuard', {});
      if (!leave) return;
      backGuardArmedRef.current = false;
      window.history.go(-2);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [ask, say]);

  // ---------- תשלום ----------
  // ממצאי סקירה 1: "יציאה באישור מנהל" אינה תשלום ₪ (נרשמת רק בסיום ההזמנה, בסכום 0); תשלום מפוצל (גם מזומן) עובר דרך
  // אישור PAYMENT_APPROVAL_LEVEL כמו הרישום הסופי. ההכרעה: NL.paymentAddDecision.
  const handleAddPaymentClick = async () => {
    const decision = NL.paymentAddDecision(settings, payment.method, payment.amount);
    if (decision.action === 'reject') {
      if (decision.reason === 'manager-exit') say('info', '"יציאה באישור מנהל" אינה תשלום', 'כדי לסיים בלי תשלום מלא בחר בה וסיים בלחיצה על "סיום ויצירת ההזמנה" (תתבקש לאשר). לרישום תשלום בחר אמצעי אחר.');
      else say('info', 'יש להזין סכום גדול מ-0');
      return;
    }
    if (decision.action === 'credit') { openCredit(payment.notes); return; }
    const method = payment.method;
    const notes = payment.notes;
    setPaymentsList(prev => [...prev, { amount: decision.amount, method, notes }]);
    setPayment(prev => ({ ...prev, notes: '' }));
    say('ok', 'התשלום נרשם', `${NL.moneyTxt(decision.amount)} · ${method}`);
  };
  const removePayment = (index) => {
    const target = paymentsList[index];
    if (!target || NL.isChargedPayment(target)) return;
    setPaymentsList(prev => prev.filter((_, i) => i !== index));
  };
  const openCredit = (notes) => {
    setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: notes || '', amount: payment.amount });
    setCreditError('');
    ask('credit', {}, 1);
  };

  const handleProcessCreditCard = async () => {
    if (!creditCardData.cardNumber || !creditCardData.tokef || !creditCardData.amount) {
      setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).');
      return;
    }
    const paymentAmount = parseFloat(creditCardData.amount);
    setIsProcessingCredit(true);
    setCreditError('');
    showBusy(true, 'credit');
    try {
      const cust = order.selectedCustomer || newCustomer;
      // R31 (אושר): שריון מספר הזמנה לפני החיוב
      let orderNumberForCharge = draftOrderIdRef.current || reservedOrderId;
      if (!orderNumberForCharge) {
        try {
          const reserveRes = await fetch('/api/orders/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: order.customerId || null }) });
          const reserveData = await reserveRes.json();
          if (reserveRes.ok && reserveData.orderId) {
            orderNumberForCharge = reserveData.orderId;
            setReservedOrderId(reserveData.orderId);
            draftOrderIdRef.current = reserveData.orderId;
            setDraftOrderId(reserveData.orderId);
          }
        } catch (reserveErr) {
          console.error('Failed to reserve order number for Nedarim charge', reserveErr);
        }
      }
      const response = await fetch('/api/nedarim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NL.buildNedarimBody(cust, creditCardData, paymentAmount, orderNumberForCharge)) });
      const data = await response.json();
      if (data.success) {
        const conf = data.confirmation || 'בוצע';
        answer(1, undefined); // סוגר את חלון האשראי
        const newPayment = { amount: paymentAmount, method: NL.creditMethodForCharge(payment.method, paymentMethodOptions), notes: conf ? `אישור נדרים: ${conf} | ${creditCardData.notes}` : creditCardData.notes };
        const updatedList = [...paymentsList, newPayment];
        setPaymentsList(updatedList);
        setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: '' }); // D7: מספר הכרטיס המלא לא נשאר ב-state אחרי חיוב שהצליח
        const newTotalPaid = updatedList.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
        setIsProcessingCredit(false);
        showBusy(false);
        if (NL.paidInFull(totalAmount, newTotalPaid)) executeSaveOrderForList(updatedList);
        else say('info', 'תשלום חלקי עבר בהצלחה.', 'יש להשלים את יתרת התשלום (או לצאת באישור מנהל) כדי לסיים את ההזמנה.');
        return;
      }
      setCreditError(data.error || 'שגיאה בחיוב הכרטיס'); // R28: בתוך חלון האשראי
    } catch {
      setCreditError('שגיאת תקשורת בחיוב הכרטיס');
    }
    setIsProcessingCredit(false);
    showBusy(false);
  };

  const saveOrder = async () => {
    setSaveError(null);
    if (!order.customerId) { say('info', 'יש לבחור לקוח'); return; }
    if (!String((order.selectedCustomer && order.selectedCustomer.phone1) || '').trim() && !String((order.selectedCustomer && order.selectedCustomer.phone2) || '').trim()) {
      say('info', 'לא ניתן לסגור הזמנה ללקוח ללא מספר טלפון.', 'יש להשלים מספר טלפון בכרטיס הלקוח.'); return;
    }
    if (!NL.datesFilledOf(order)) { say('info', NL.usesRange(order) ? 'יש לבחור תאריכים עבור אירוע חו"ל/מיוחד' : 'יש לבחור תאריך אירוע'); return; }
    if (order.items.length === 0) { say('info', 'יש לבחור לפחות פריט אחד'); return; }
    const deliveryError = validateDeliveryFields(order, order.selectedCustomer && order.selectedCustomer.city, deliveryPriceCities);
    if (deliveryError) { say('info', deliveryError); return; }
    const relevantDate = NL.usesRange(order) ? order.fromDate : order.eventDate;
    if (NL.isPastDateKey(relevantDate, todayKey)) {
      const auth = await verifyPin('התאריך שנבחר להזמנה זו הוא תאריך שעבר. שמירת הזמנה לתאריך שעבר דורשת אישור מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:past_date_order_approval');
      if (!auth) return;
    }
    const pAmount = parseFloat(payment.amount) || 0;
    const totalWithCurrent = NL.sumPaid(paymentsList) + pAmount;
    const isManagerExitPayment = payment.method === NL.MANAGER_EXIT_METHOD;
    const isCreditCardPayment = NL.isCreditMethod(payment.method);
    if (!isManagerExitPayment && !NL.paidInFull(totalAmount, totalWithCurrent)) {
      say('info', 'לא ניתן לסיים הזמנה לפני תשלום מלא.', 'אנא הוסף את התשלום החסר, או בחר "יציאה באישור מנהל". כדי לפצל בין כמה אמצעי תשלום, השתמש בכפתור "אישור תשלום / פיצול" כמה פעמים.');
      return;
    }
    if (pAmount > 0 && isCreditCardPayment) { openCredit(''); return; }
    // Q3b (החלטת בעלים): "יציאה באישור מנהל" תמיד דורשת אישור (feature:payment_exit_approval), בלי תלות ב-PAYMENT_APPROVAL_LEVEL; תשלום רגיל - לפי הרמה כמו בישן
    if (NL.paymentApprovalRequired(settings, payment.method, pAmount)) {
      const authResult = await verifyPin('יציאה מהזמנה בלי תשלום מלא דורשת אישור של מי שהורשה לכך. אנא בחר משתמש והזן סיסמה:', 'feature:payment_exit_approval');
      if (!authResult) { say('info', 'אישור תשלום בוטל.'); return; }
    }
    executeSaveOrderForList(NL.buildFinalPayments(paymentsList, payment));
  };

  const executeSaveOrderForList = async (finalPaymentsList, force = false) => {
    pendingSavePaymentsRef.current = finalPaymentsList;
    setSaveError(null);
    setSaving(true);
    showBusy(true, 'save');
    draftSealedRef.current = true;
    await draftQueueRef.current;
    const abandonSave = () => { draftSealedRef.current = false; setSaving(false); showBusy(false); };
    try {
      const itemsToSave = NL.buildItemsToSave(order, calculatedData.items);
      const hokDetailsPayload = NL.buildHokDetailsPayload(settings, order, newCustomer);
      const payload = NL.buildSavePayload({ order, totalAmount, itemsToSave, hokDetailsPayload, finalPaymentsList, reservedOrderId, draftOrderId: draftOrderIdRef.current, force });
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.status === 409 && data.duplicateOrder) {
        abandonSave();
        const again = await ask('dupOrder', { existingOrderId: data.existingOrderId }, 1);
        if (again) executeSaveOrderForList(pendingSavePaymentsRef.current, true);
        return;
      }
      if (res.status === 409 && data.validationErrors) {
        abandonSave();
        // R29: מתחת לכפתור השמירה, עם פירוט נפתח (לא חלון קופץ)
        const rows = NL.stockShortageLines(data.validationErrors);
        setSaveError({ title: 'לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים', lines: rows.map(r => r.text), spacingNote: rows.some(r => r.spacing) ? NL.SPACING_NOTE : '' });
        return;
      }
      if (!res.ok) {
        const errorMessage = data.error || 'Failed to save order';
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(errorMessage + details);
      }
      setSaving(false);
      showBusy(false);
      // ההזמנה נשמרה עם רשימת התשלומים הזו - המסך (שנשאר פתוח מאחורי חלון "ההזמנה נשמרה", S08) מציג אותה
      setPaymentsList(finalPaymentsList.filter(x => (parseFloat(x.amount) || 0) > 0 || x.method === NL.MANAGER_EXIT_METHOD));
      if (settings.auto_print_on_order_create === 'true' && data.orderId) window.open(`/print/order?orderId=${data.orderId}&type=order`, '_blank');
      backGuardArmedRef.current = false;
      setSaved({ orderId: data.orderId, customerId: data.customerId, warning: data.warning || '' });
      ask('success', {}, 1);
    } catch (error) {
      console.error(error);
      setSaveError({ title: 'שגיאה בשמירת הזמנה', detail: error.message });
      abandonSave();
    }
  };

  // אחרי השמירה (S08): כפתורי חלון "ההזמנה נשמרה". הכפתור השלישי מוביל למסך שבהגדרה order_new_redirect_screen (ברירת מחדל: כרטיס ההזמנה)
  const redirectScreen = settings.order_new_redirect_screen || 'order';
  const targetScreen = redirectScreen === 'new_order' ? 'order' : redirectScreen;
  const targetLabel = targetScreen === 'order' ? 'לכרטיס ההזמנה' : `ל${(ORDER_REDIRECT_SCREENS.find(s => s.value === targetScreen) || { label: 'כרטיס ההזמנה' }).label}`;
  const goTarget = () => {
    if (!saved) return;
    const href = resolveOrderRedirectHref(targetScreen, { orderId: saved.orderId, customerId: saved.customerId });
    // כמו בישן (main 46a054b1): יעד שהוא הנתיב הנוכחי (/orders/new) - router.push לא מאפס את הטופס, לכן טעינה מלאה
    if (typeof window !== 'undefined' && NL.redirectNeedsFullReload(href, window.location.pathname)) window.location.assign(href);
    else router.push(href);
  };
  const printSaved = () => saved && window.open(`/print/order?orderId=${saved.orderId}&type=order`, '_blank');
  const newOrder = () => { if (typeof window !== 'undefined') window.location.assign('/orders/new'); };

  const handleExit = async () => {
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    if (!saved && (activeItems.length > 0 || order.customerId)) {
      const leave = await ask('exit', { draftOrderId, itemsCount: activeItems.length });
      if (!leave) return;
    }
    backGuardArmedRef.current = false;
    router.push('/orders');
  };

  // Escape סוגר את החלון העליון (לא בזמן חיוב/שמירה - כמו בישן)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || isProcessingCredit || saving) return;
      if (dlg[2] && dlg[2].type !== 'busy') answer(2, null);
      else if (dlg[1]) answer(1, null);
      else if (capacityItem) setCapacityItem(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dlg, answer, isProcessingCredit, saving, capacityItem]);

  // ---------- ניווט שלבים ----------
  const activeItems = (order.items || []).filter(i => !i.isDeleted);
  const datesFilled = NL.datesFilledOf(order);
  const deliveryAddressRequired = isDeliveryAddressRequired(order, order.selectedCustomer && order.selectedCustomer.city);
  const deliveryCityRequired = isDeliveryCityRequired(order, order.selectedCustomer && order.selectedCustomer.city, deliveryPriceCities);
  const deliveryError = validateDeliveryFields(order, order.selectedCustomer && order.selectedCustomer.city, deliveryPriceCities);
  const totalPaid = NL.sumPaid(paymentsList);
  const remaining = Math.max(0, NL.roundMoney(totalAmount - totalPaid));
  const openInfo = NL.stepOpenInfo(order);

  const go = (idx) => {
    const key = NL.STEP_KEYS[idx];
    if (!key) return;
    if (!openInfo[key].open) { say('info', openInfo[key].reason); return; }
    // הישן נעל את "המשך לבחירת פריטים" כל עוד שדות המשלוח לא תקינים
    if (idx > NL.STEP_KEYS.indexOf('delivery') && deliveryError) { say('info', deliveryError); return; }
    setStep(idx);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    // מצב
    step, stepKey, setStep, go, goStep, openInfo, settings, todayKey, allowAbroad,
    searchMode, setSearchMode, phoneSearchInput, setPhoneSearchInput, isCheckingPhone, foundCustomersFromPhone, setFoundCustomersFromPhone, pickedFound, setPickedFound,
    listQuery, setListQuery, listResults, listLoading, pickFromList,
    order, setOrder, newCustomer, setNewCustomer, newCustomerError, setNewCustomerError, customerLocations, fieldGroups, missingOf,
    newItem, setNewItemField, toggleSizeSelection, modelQuery, setModelQuery, modelList, pickedModel, pickModel, resolveTypedModel, modelCodes,
    availableSizes, loadingSizes, loadingPreload, refreshInventory, addPreview, addError, addItemToOrder, confirmRemoveItem, editItem,
    calculatedData, calculating, totalAmount, activeItems, datesFilled, rangePending, setRangePending,
    deliveryCityOptions, deliveryAddressRequired, deliveryCityRequired, deliveryError,
    paymentMethodOptions, payment, setPayment, paymentsList, removePayment, totalPaid, remaining, handleAddPaymentClick, openCredit,
    creditCardData, setCreditCardData, creditError, isProcessingCredit, handleProcessCreditCard,
    saving, saveError, setSaveError, saveOrder, saved, draftOrderId,
    capacityItem, setCapacityItem, showCapacitySearch, setShowCapacitySearch,
    // פעולות
    handleCheckPhone, handleUseExistingCustomer, proceedToStep2, handleSaveNewCustomerAndProceed,
    handleDateChangeWithValidation, handleSpacingChange, handleExit, goTarget, printSaved, newOrder, targetLabel,
    // ממשק
    toast, setToast, say, dlg, ask, answer,
  };
}

// R05: לאיזה שדה שייכת הודעת השרת (lib/customerValidation.validateCustomerFieldFormats / app/api/customers)
function fieldOfServerError(msg) {
  const m = String(msg || '');
  if (m.includes('הטלפון הראשי')) return 'phone1';
  if (m.includes('טלפון נוסף') || m.includes('הטלפון הנוסף')) return 'phone2';
  if (m.includes('דוא') || m.includes('מייל')) return 'email';
  if (m.includes('זהות')) return 'zeout';
  return null;
}
