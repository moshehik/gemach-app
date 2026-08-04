'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import SendEmailModal from '@/components/SendEmailModal';
import ModernSendEmailModal from '../../../components/customers/modern/ModernSendEmailModal';
import { verifyPin } from '../../../components/orders/modern/mocAuth';
import ModernCustomerCard from '../../../components/customers/modern/ModernCustomerCard';
import ModernCustomerDetailsTab from '../../../components/customers/modern/ModernCustomerDetailsTab';
import ModernCustomerOrdersTab from '../../../components/customers/modern/ModernCustomerOrdersTab';
import ModernCustomerPaymentsTab from '../../../components/customers/modern/ModernCustomerPaymentsTab';
import ModernCustomerRefundsTab from '../../../components/customers/modern/ModernCustomerRefundsTab';
import ModernCustomerHistoryTab from '../../../components/customers/modern/ModernCustomerHistoryTab';
import modernOrderCss from '../../../components/orders/modern/modernOrderStyles';
import { addHistory } from '@/lib/historyManager';
import { normalizeEmail } from '@/lib/emailUtils';

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
    const { name, value } = e.target;
    setCustomer(prev => ({ ...prev, [name]: value }));
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
        throw new Error(data.message || 'שגיאה בשמירת נתונים');
      }

      if (id === 'new' && data.id) {
        router.push(`/customers/${data.id}`);
      } else {
        setOriginalCustomer(normalizedCustomer);
        alert('הפרטים נשמרו בהצלחה!');
      }
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת נתונים');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    if (originalCustomer) setCustomer(originalCustomer);
  };

  const hasUnsavedChanges = originalCustomer && JSON.stringify(customer) !== JSON.stringify(originalCustomer);

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>;
  if (!customer) return null;

  // לקוח חדש — טופס יצירה פשוט, בלי כרטיס טאבים (מקביל ליחס בין /orders/new לבין /orders/[id])
  if (id === 'new') {
    return (
      <main data-agy-id="customer_profile_main_container" className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1000px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button type="button" onClick={() => router.back()} className="btn btn-outline" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            →
          </button>
          <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>לקוח חדש</h1>
        </div>

        <form onSubmit={handleSave} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם פרטי *</label>
              <input type="text" name="firstName" value={customer.firstName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם משפחה *</label>
              <input type="text" name="lastName" value={customer.lastName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נייד *</label>
              <input type="text" name="phone1" value={customer.phone1 || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נוסף</label>
              <input type="text" name="phone2" value={customer.phone2 || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>דוא"ל</label>
              <input type="email" name="email" value={customer.email || ''} onChange={handleChange} onBlur={handleEmailBlur} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>עיר</label>
              <input type="text" name="city" value={customer.city || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>רחוב</label>
              <input type="text" name="street" value={customer.street || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>מספר בית</label>
              <input type="number" name="houseNum" value={customer.houseNum || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>הערות</label>
            <textarea name="notes" value={customer.notes || ''} onChange={handleChange} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', resize: 'vertical' }} />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1.1rem' }}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main data-agy-id="customer_profile_main_container" style={{ direction: 'rtl', fontFamily: 'var(--font-primary, system-ui)' }}>
      {/* אותו עיצוב "כרטיס מודרני" (moc) שבו מעוצב כרטיס ההזמנה */}
      <style>{modernOrderCss}</style>

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
    </main>
  );
}
