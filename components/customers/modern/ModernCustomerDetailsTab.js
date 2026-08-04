'use client';

import React from 'react';
import { Copy, Mail, Save } from 'lucide-react';

export default function ModernCustomerDetailsTab({ customer, onChange, onEmailBlur, onSubmit, saving, onCopyEmail, onOpenEmailModal }) {
  return (
    <form className="moc-card-panel" onSubmit={onSubmit}>
      <div className="moc-grid-2">
        <div>
          <span className="moc-field-label">שם פרטי *</span>
          <input type="text" name="firstName" value={customer.firstName || ''} onChange={onChange} required />
        </div>
        <div>
          <span className="moc-field-label">שם משפחה *</span>
          <input type="text" name="lastName" value={customer.lastName || ''} onChange={onChange} required />
        </div>
        <div>
          <span className="moc-field-label">טלפון נייד *</span>
          <input type="text" name="phone1" value={customer.phone1 || ''} onChange={onChange} required style={{ direction: 'ltr' }} />
        </div>
        <div>
          <span className="moc-field-label">טלפון נוסף</span>
          <input type="text" name="phone2" value={customer.phone2 || ''} onChange={onChange} style={{ direction: 'ltr' }} />
        </div>
        <div>
          <span className="moc-field-label">דוא"ל</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="email" name="email" value={customer.email || ''} onChange={onChange} onBlur={onEmailBlur} style={{ direction: 'ltr' }} />
            {customer.email && (
              <>
                <button type="button" className="moc-icon-btn-plain" title="העתק כתובת מייל" onClick={onCopyEmail}>
                  <Copy size={16} />
                </button>
                <button type="button" className="moc-icon-btn-plain" title="שלח מייל" onClick={onOpenEmailModal}>
                  <Mail size={16} />
                </button>
              </>
            )}
          </div>
          {(!customer.email || !customer.email.includes('@')) && (
            <button
              type="button"
              className="moc-btn moc-btn-outline"
              style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => onChange({ target: { name: 'email', value: `${customer.email || ''}@gmail.com` } })}
            >
              השלם ל- @gmail.com
            </button>
          )}
        </div>
        <div>
          <span className="moc-field-label">עיר</span>
          <input type="text" name="city" value={customer.city || ''} onChange={onChange} />
        </div>
        <div>
          <span className="moc-field-label">רחוב</span>
          <input type="text" name="street" value={customer.street || ''} onChange={onChange} />
        </div>
        <div>
          <span className="moc-field-label">מספר בית</span>
          <input type="number" name="houseNum" value={customer.houseNum || ''} onChange={onChange} />
        </div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <span className="moc-field-label">הערות</span>
        <textarea name="notes" value={customer.notes || ''} onChange={onChange} rows={4} style={{ resize: 'vertical' }} />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="moc-btn moc-btn-gold" disabled={saving}>
          {saving ? <span className="moc-spinner" /> : <Save size={15} />} {saving ? 'שומר...' : 'שמור פרטים'}
        </button>
      </div>
    </form>
  );
}
