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
        setOriginalCustomer(data);
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

        <form onSubmit={handleSave} className="card card-pad">
          <div className="form-grid">
            <div className="field">
              <label>שם פרטי *</label>
              <input type="text" className="input" name="firstName" value={customer.firstName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>שם משפחה *</label>
              <input type="text" className="input" name="lastName" value={customer.lastName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>טלפון *</label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-phone" /></svg>
                <input type="text" className="input" name="phone1" value={customer.phone1 || ''} onChange={handleChange} required />
              </div>
            </div>
            <div className="field">
              <label>טלפון נוסף</label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-phone" /></svg>
                <input type="text" className="input" name="phone2" value={customer.phone2 || ''} onChange={handleChange} />
              </div>
            </div>
            <div className="field">
              <label>דוא&quot;ל</label>
              <div className="input-icon-wrap">
                <svg className="icon"><use href="#i-mail" /></svg>
                <input type="email" className="input" name="email" value={customer.email || ''} onChange={handleChange} onBlur={handleEmailBlur} />
              </div>
            </div>
            <div className="field">
              <label>עיר</label>
              <input type="text" className="input" name="city" value={customer.city || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>רחוב</label>
              <input type="text" className="input" name="street" value={customer.street || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>מספר בית</label>
              <input type="number" className="input" name="houseNum" value={customer.houseNum || ''} onChange={handleChange} />
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
