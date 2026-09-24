'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ModernSendEmailModal from '../../../components/customers/modern/ModernSendEmailModal';
import { verifyPin } from '../../../components/orders/modern/mocAuth';
import ModernCustomerCard from '../../../components/customers/modern/ModernCustomerCard';
import ModernCustomerDetailsTab from '../../../components/customers/modern/ModernCustomerDetailsTab';
import ModernCustomerOrdersTab from '../../../components/customers/modern/ModernCustomerOrdersTab';
import ModernCustomerPaymentsTab from '../../../components/customers/modern/ModernCustomerPaymentsTab';
import ModernCustomerRefundsTab from '../../../components/customers/modern/ModernCustomerRefundsTab';
import ModernCustomerHistoryTab from '../../../components/customers/modern/ModernCustomerHistoryTab';
import { useAlertDialog, useConfirmDialog } from '../../../components/customers/modern/customerDialogs';
import { addHistory } from '@/lib/historyManager';
import { normalizeEmail } from '@/lib/emailUtils';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { validateCustomerFieldFormats, parseFieldGroups, unsatisfiedFieldGroupErrors, isFieldRequiredByGroup } from '@/lib/customerValidation';
import { V3Page, Card, Btn, IconBtn, Field, Switch, Icon } from '@/app/v3/ui/components';
import { enqueueNotice } from '@/app/v3/notify';

export default function CustomerPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [showAlert, alertNode] = useAlertDialog();
  const [askConfirm, confirmNode] = useConfirmDialog();
  const [customer, setCustomer] = useState(null);
  const [originalCustomer, setOriginalCustomer] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAuthResult, setEmailAuthResult] = useState(null);
  // מועבר ל-ModernCustomerDetailsTab כדי לסגור את מצב "עריכת פרטים אישיים" המקומי שלו
  // כשלוחצים על "ביטול שינויים" בכותרת - אחרת השדות מתאפסים אבל הטופס נשאר פתוח
  const [cancelTick, setCancelTick] = useState(0);
  // ביטול חסימת לקוח (Customer.isBlocked) מוגבל להנהלה ראשית - נאכף גם בשרת
  // (PATCH /api/customers/[id]), הדגל הזה רק שולט אם הכפתור מוצג בכלל.
  const [isHeadManagement, setIsHeadManagement] = useState(false);
  // 3/6/7 - חובת מייל/כתובת מלאה נשלטת ע"י ההגדרות require_customer_email/require_full_address
  // (אותו דגם שכבר קיים ב-app/orders/new/page.js עבור הוספת לקוח מהירה בתוך הזמנה).
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then(data => {
        if (data && data.success && data.employee) {
          setIsHeadManagement(data.employee.roleId === 0 || data.employee.roleId === 2);
        }
      })
      .catch(() => {});

    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          setSettings(data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
        }
      })
      .catch(() => {});
  }, []);

  const handleUnblockCustomer = async () => {
    if (!customer?.id) return;
    if (!await askConfirm('הלקוח יוכל שוב לבצע הזמנות חדשות.', 'לבטל את החסימה?')) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: false, blockedReason: null })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showAlert((data && data.error) || 'שגיאה בביטול החסימה');
        return;
      }
      setCustomer(prev => ({ ...prev, isBlocked: false, blockedReason: null }));
      setOriginalCustomer(prev => prev ? { ...prev, isBlocked: false, blockedReason: null } : prev);
    } catch (err) {
      console.error(err);
      showAlert('שגיאת רשת בביטול החסימה');
    }
  };

  const handleSendEmailClick = async () => {
    if (!customer?.email) {
      showAlert("ללקוח הזה אין כתובת מייל. הוסיפו אותה בלשונית 'פרטים אישיים', שמרו, ונסו שוב.");
      return;
    }
    const auth = await verifyPin('שליחת מייל דורשת אישור מנהל. אנא הזן סיסמה:', 'feature:customer_email_approval');
    if (!auth) return;
    setEmailAuthResult(auth);
    setEmailModalOpen(true);
  };

  const allPayments = customer?.orders
    ? [
        ...customer.orders.flatMap(order => (order.payments || []).map(p => ({ ...p, orderId: order.orderId, entryType: 'payment' }))),
        ...refunds.map(r => ({ ...r, entryType: 'refund', paymentDate: r.createdAt, paymentMethod: 'זיכוי' }))
      ].sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))
    : [];

  useEffect(() => {
    if (id === 'new') {
      setCustomer({ firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', notes: '' });
      setLoading(false);
      return;
    }

    // Fetch customer and refunds in parallel
    Promise.all([
      fetch(`/api/customers/${id}`).then(res => res.json()),
      fetch(`/api/refunds?customerId=${id}`).then(res => res.json())
    ])
      .then(([customerData, refundsData]) => {
        if (customerData.error) {
          router.push('/customers');
        } else {
          setCustomer(customerData);
          setOriginalCustomer(customerData);
          addHistory({
            type: 'customer',
            id: customerData.id,
            name: `לקוח: ${[customerData.firstName, customerData.lastName].filter(n => n && String(n).toLowerCase() !== 'null').join(' ')}`,
            subtext: customerData.phone1 || ''
          });
        }
        if (Array.isArray(refundsData)) setRefunds(refundsData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCustomer(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEmailBlur = () => {
    if (customer?.email) {
      const normalized = normalizeEmail(customer.email, customer.emailSuffix);
      if (normalized !== customer.email) {
        setCustomer(prev => ({ ...prev, email: normalized }));
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const fieldGroups = parseFieldGroups(settings.mandatory_field_groups);
    if (id === 'new') {
      const groupErrors = unsatisfiedFieldGroupErrors(customer, fieldGroups);
      if (groupErrors.length > 0) {
        showAlert(groupErrors.join('\n'));
        return;
      }
    }

    // 3/6 - אכיפה קדמית של שדות חובה לפי הגדרות (השרת אוכף גם הוא כגיבוי - ר' API).
    // כמו require_customer_id_number למטה - רק ביצירת לקוח חדש, לא באכיפה רטרואקטיבית
    // על עריכת לקוחות קיימים (דיווח תקלה 48ff7055, 2026-09-22: לא לחייב מילוי מייל/כתובת
    // כדי לערוך פרטים אחרים של לקוח שכבר קיים).
    const missing = [];
    if (id === 'new' && settings.require_customer_email === 'true' && !String(customer.email || '').trim()) {
      missing.push('דוא"ל');
    }
    if (id === 'new' && settings.require_full_address === 'true') {
      if (!String(customer.city || '').trim()) missing.push('עיר');
      if (!String(customer.street || '').trim()) missing.push('רחוב');
      if (!String(customer.houseNum || '').trim()) missing.push('מספר בית');
    }
    // require_customer_id_number - רק ביצירת לקוח חדש (לא באכיפה רטרואקטיבית על
    // עריכת לקוחות קיימים, חלקם ללא ת"ז מהיבוא מ-Access). הגדרה ייעודית לגמח נווה
    // יעקב בלבד - ר' ההערה המקבילה ב-app/api/customers/route.js.
    if (id === 'new' && settings.require_customer_id_number === 'true' && !String(customer.zeout || '').trim()) {
      missing.push('תעודת זהות');
    }
    if (missing.length > 0) {
      showAlert(`שדות חובה חסרים: ${missing.join(', ')}`);
      return;
    }

    // 7 - ולידציית תבנית (טלפון/מייל/ת"ז/כפילות טלפונים)
    const formatErrors = validateCustomerFieldFormats(customer);
    if (formatErrors.length > 0) {
      showAlert(formatErrors.join('\n'));
      return;
    }

    setSaving(true);

    const url = id === 'new' ? '/api/customers' : `/api/customers/${id}`;
    const method = id === 'new' ? 'POST' : 'PUT';

    const normalizedCustomer = {
      ...customer,
      email: normalizeEmail(customer.email, customer.emailSuffix)
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedCustomer)
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.message) {
          showAlert(data.message);
          return;
        }
        // שדות חובה/ולידציית תבנית (400) מגיעים תחת data.error, לא data.message -
        // בלעדי זה המשתמש רואה "שגיאה בשמירת נתונים" גנרי במקום הסיבה האמיתית.
        throw new Error(data.error || data.message || 'שגיאה בשמירת נתונים');
      }

      const savedName = [customer.firstName, customer.lastName].filter(n => n && String(n).toLowerCase() !== 'null').join(' ');
      if (id === 'new' && data.id) {
        // R20 - התראת יצירה (אחרי הצלחת ה-POST, לפני המעבר לכרטיס). כשל בהתראה לא משפיע על השמירה.
        try {
          enqueueNotice({ kind: 'success', title: 'הלקוח נוצר', text: savedName, href: `/customers/${data.id}`, persistToBell: true, entity: { type: 'Customer', id: data.id } });
        } catch (notifyErr) { console.error(notifyErr); }
        router.push(`/customers/${data.id}`);
      } else {
        setOriginalCustomer(data);
        // R20 - התראת שמירה (במקום alert). נשארים בעמוד, לכן בלי href.
        try {
          enqueueNotice({ kind: 'success', title: 'הפרטים נשמרו', text: savedName, persistToBell: true, entity: { type: 'Customer', id } });
        } catch (notifyErr) { console.error(notifyErr); }
      }
      // ModernCustomerDetailsTab (כפתור ה-V + טופס העריכה) סוגר את מצב העריכה רק אם
      // זה מחזיר true - ר' ההערה שם. שאר הבליטות (בדיקת שדות חובה, פורמט, 409, קטע
      // ה-catch) כבר "return;"/מסתיימות בלי return מפורש, כלומר מחזירות undefined
      // (falsy) כברירת מחדל.
      return true;
    } catch (e) {
      showAlert(e.message || 'שגיאה בשמירת נתונים');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    if (originalCustomer) setCustomer(originalCustomer);
    setCancelTick(t => t + 1);
  };

  const hasUnsavedChanges = originalCustomer && JSON.stringify(customer) !== JSON.stringify(originalCustomer);

  if (loading) {
    return (
      <V3Page>
        <div className="v3-empty" role="status">
          <Icon name="loader" size="xl" loop />
          <span>טוענים את פרטי הלקוח...</span>
        </div>
      </V3Page>
    );
  }
  if (!customer) return null;

  // לקוח חדש — טופס יצירה פשוט, בלי כרטיס לשוניות (מקביל ליחס בין /orders/new לבין /orders/[id])
  if (id === 'new') {
    const groups = parseFieldGroups(settings.mandatory_field_groups);
    const emailRequired = settings.require_customer_email === 'true';
    const addressRequired = settings.require_full_address === 'true';
    const idRequired = settings.require_customer_id_number === 'true';
    const star = <span className="v3-req" aria-hidden="true">*</span>;

    return (
      <V3Page>
        <header className="v3-pagehead">
          <div className="v3-pagehead__title">
            <IconBtn icon="back" label="חזרה" title="חזרה" variant="quiet" onClick={() => router.back()} />
            <h1 className="v3-h1">לקוח חדש</h1>
          </div>
        </header>

        <form onSubmit={handleSave} autoComplete="off">
          <Card icon="user" title="פרטי הלקוח" tip="לכל הזמנה נדרשים שני אמצעי קשר: מלאו טלפון נוסף או דוא&quot;ל, לפחות אחד.">
            <div className="v3-stack">
              <Field label="שם פרטי" required type="text" name="firstName" autoComplete="off" value={customer.firstName || ''} onChange={handleChange} />
              <Field label="שם משפחה" required type="text" name="lastName" autoComplete="off" value={customer.lastName || ''} onChange={handleChange} />
              <Field label="טלפון" required type="text" name="phone1" autoComplete="off" value={customer.phone1 || ''} onChange={handleChange} />
              <Field
                label={<>טלפון נוסף{!emailRequired && isFieldRequiredByGroup('phone2', customer, groups) && star}</>}
                type="text"
                name="phone2"
                autoComplete="off"
                value={customer.phone2 || ''}
                onChange={handleChange}
              />
              <Field
                label={<>דוא&quot;ל{!emailRequired && isFieldRequiredByGroup('email', customer, groups) && star}</>}
                required={emailRequired}
                type="email"
                name="email"
                autoComplete="off"
                value={customer.email || ''}
                onChange={handleChange}
                onBlur={handleEmailBlur}
              />
              <Field label="עיר" required={addressRequired} type="text" name="city" autoComplete="off" value={customer.city || ''} onChange={handleChange} />
              <Field label="רחוב" required={addressRequired} type="text" name="street" autoComplete="off" value={customer.street || ''} onChange={handleChange} />
              <Field label="מספר בית" required={addressRequired} type="number" name="houseNum" autoComplete="off" value={customer.houseNum || ''} onChange={handleChange} />
              <Field
                label="תעודת זהות"
                tip="משמשת לאימות כשעורכים או מבטלים הזמנה."
                required={idRequired}
                type="text"
                style={{ direction: 'ltr' }}
                name="zeout"
                autoComplete="off"
                value={customer.zeout || ''}
                onChange={handleChange}
                placeholder="ת״ז"
              />
              {settings.hide_marketing_consent_field !== 'true' && (
                <Switch
                  id="newMarketingConsent"
                  name="marketingConsent"
                  checked={!!customer.marketingConsent}
                  onChange={(v) => handleChange({ target: { name: 'marketingConsent', type: 'checkbox', checked: v } })}
                  label="מאשר/ת קבלת דיוורים"
                />
              )}
              <Field label="הערות" as="textarea" name="notes" value={customer.notes || ''} onChange={handleChange} rows={4} />

              <div className="v3-cluster">
                <Btn type="submit" variant="primary" size="lg" icon="check" loading={saving}>
                  {saving ? 'שומר...' : 'שמירת הלקוח'}
                </Btn>
              </div>
            </div>
          </Card>
        </form>
        {alertNode}
        {confirmNode}
      </V3Page>
    );
  }

  return (
    <>
      <ModernCustomerCard
        customer={customer}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExit={() => router.back()}
        saving={saving}
        onSave={handleSave}
        hasUnsavedChanges={hasUnsavedChanges}
        onCancelChanges={handleCancelChanges}
        onSendEmail={handleSendEmailClick}
        tabContents={{
          details: (
            <ModernCustomerDetailsTab
              customer={customer}
              onChange={handleChange}
              onEmailBlur={handleEmailBlur}
              onSubmit={handleSave}
              saving={saving}
              onCopyEmail={() => navigator.clipboard.writeText(customer.email)}
              onOpenEmailModal={handleSendEmailClick}
              cancelSignal={cancelTick}
              isHeadManagement={isHeadManagement}
              onUnblock={handleUnblockCustomer}
              settings={settings}
            />
          ),
          orders: (
            <ModernCustomerOrdersTab orders={customer.orders || []} />
          ),
          payments: (
            <ModernCustomerPaymentsTab payments={allPayments} customer={customer} />
          ),
          refunds: (
            <ModernCustomerRefundsTab
              customer={customer}
              onChange={handleChange}
              onSubmit={handleSave}
              saving={saving}
              refunds={refunds}
            />
          ),
          history: (
            <ModernCustomerHistoryTab customerId={id} />
          )
        }}
      />

      <ModernSendEmailModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailAuthResult(null);
        }}
        customer={customer}
        authResult={emailAuthResult}
      />
      {alertNode}
      {confirmNode}
    </>
  );
}
