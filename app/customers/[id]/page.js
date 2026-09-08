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
import { addHistory } from '@/lib/historyManager';
import { normalizeEmail } from '@/lib/emailUtils';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { validateCustomerFieldFormats } from '@/lib/customerValidation';

export default function CustomerPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
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
    if (!await window.customConfirm('לבטל את חסימת הלקוח מהזמנות חדשות?', 'ביטול חסימה')) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: false, blockedReason: null })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert((data && data.error) || 'שגיאה בביטול החסימה');
        return;
      }
      setCustomer(prev => ({ ...prev, isBlocked: false, blockedReason: null }));
      setOriginalCustomer(prev => prev ? { ...prev, isBlocked: false, blockedReason: null } : prev);
    } catch (err) {
      console.error(err);
      alert('שגיאת רשת בביטול החסימה');
    }
  };

  const handleSendEmailClick = async () => {
    if (!customer?.email) {
      alert("ללקוח זה לא מעודכנת כתובת מייל. אנא עדכן ב'פרטים אישיים' ושמור תחילה.");
      return;
    }
    const auth = await verifyPin('שליחת מייל דורשת אישור מנהל. אנא הזן סיסמה:', 'מנהל');
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

    if (id === 'new' && !String(customer.phone2 || '').trim() && !String(customer.email || '').trim()) {
      alert('כל הזמנה מחייבת 2 אמצעי תקשורת: יש למלא טלפון נוסף או כתובת מייל.');
      return;
    }

    // 3/6 - אכיפה קדמית של שדות חובה לפי הגדרות (השרת אוכף גם הוא כגיבוי - ר' API)
    const missing = [];
    if (settings.require_customer_email === 'true' && !String(customer.email || '').trim()) {
      missing.push('דוא"ל');
    }
    if (settings.require_full_address === 'true') {
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
      alert(`שדות חובה חסרים: ${missing.join(', ')}`);
      return;
    }

    // 7 - ולידציית תבנית (טלפון/מייל/ת"ז/כפילות טלפונים)
    const formatErrors = validateCustomerFieldFormats(customer);
    if (formatErrors.length > 0) {
      alert(formatErrors.join('\n'));
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
          alert(data.message);
          return;
        }
        // שדות חובה/ולידציית תבנית (400) מגיעים תחת data.error, לא data.message -
        // בלעדי זה המשתמש רואה "שגיאה בשמירת נתונים" גנרי במקום הסיבה האמיתית.
        throw new Error(data.error || data.message || 'שגיאה בשמירת נתונים');
      }

      if (id === 'new' && data.id) {
        router.push(`/customers/${data.id}`);
      } else {
        setOriginalCustomer(data);
        alert('הפרטים נשמרו בהצלחה!');
      }
      // ModernCustomerDetailsTab (כפתור ה-V + טופס העריכה) סוגר את מצב העריכה רק אם
      // זה מחזיר true - ר' ההערה שם. שאר הבליטות (בדיקת שדות חובה, פורמט, 409, קטע
      // ה-catch) כבר "return;"/מסתיימות בלי return מפורש, כלומר מחזירות undefined
      // (falsy) כברירת מחדל.
      return true;
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת נתונים');
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
      <div className="page-loading">
        <span className="spinner lg" />
        טוען נתונים...
      </div>
    );
  }
  if (!customer) return null;

  // לקוח חדש — טופס יצירה פשוט, בלי כרטיס טאבים (מקביל ליחס בין /orders/new לבין /orders/[id])
  if (id === 'new') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>לקוח חדש</h1>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-secondary btn-icon-only" title="חזרה" onClick={() => router.back()}>
              <svg className="icon"><use href="#i-arrow-end" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="card card-pad" autoComplete="off">
          <div className="form-grid">
            <div className="field">
              <label>שם פרטי *</label>
              <input type="text" className="input" name="firstName" autoComplete="off" value={customer.firstName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>שם משפחה *</label>
              <input type="text" className="input" name="lastName" autoComplete="off" value={customer.lastName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>טלפון *</label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-phone" /></svg>
                <input type="text" className="input" name="phone1" autoComplete="off" value={customer.phone1 || ''} onChange={handleChange} required />
              </div>
            </div>
            <div className="field">
              <label>טלפון נוסף <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-phone" /></svg>
                <input type="text" className="input" name="phone2" autoComplete="off" value={customer.phone2 || ''} onChange={handleChange} />
              </div>
            </div>
            <div className="field">
              <label>דוא&quot;ל <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-mail" /></svg>
                <input type="email" className="input" name="email" autoComplete="off" value={customer.email || ''} onChange={handleChange} onBlur={handleEmailBlur} required={settings.require_customer_email === 'true'} />
              </div>
            </div>
            <p className="hint" style={{ gridColumn: '1 / -1', margin: '-6px 0 0', color: 'var(--text-2)' }}>
              כל הזמנה מחייבת 2 אמצעי תקשורת — יש למלא לפחות אחד מבין טלפון נוסף / אימייל.
            </p>
            <div className="field">
              <label>עיר {settings.require_full_address === 'true' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
              <input type="text" className="input" name="city" autoComplete="off" value={customer.city || ''} onChange={handleChange} required={settings.require_full_address === 'true'} />
            </div>
            <div className="field">
              <label>רחוב {settings.require_full_address === 'true' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
              <input type="text" className="input" name="street" autoComplete="off" value={customer.street || ''} onChange={handleChange} required={settings.require_full_address === 'true'} />
            </div>
            <div className="field">
              <label>מספר בית {settings.require_full_address === 'true' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
              <input type="number" className="input" name="houseNum" autoComplete="off" value={customer.houseNum || ''} onChange={handleChange} required={settings.require_full_address === 'true'} />
            </div>
            <div className="field">
              <label>תעודת זהות (לעריכה/ביטול) {settings.require_customer_id_number === 'true' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
              <input type="text" className="input" style={{ direction: 'ltr' }} name="zeout" autoComplete="off" value={customer.zeout || ''} onChange={handleChange} placeholder="ת״ז" required={settings.require_customer_id_number === 'true'} />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
              <input type="checkbox" id="newMarketingConsent" name="marketingConsent" checked={!!customer.marketingConsent} onChange={handleChange} />
              <label htmlFor="newMarketingConsent" style={{ margin: 0, fontWeight: 600 }}>מאשר/ת קבלת דיוורים</label>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>הערות</label>
            <textarea className="textarea" name="notes" value={customer.notes || ''} onChange={handleChange} rows={4} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      </>
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
    </>
  );
}
