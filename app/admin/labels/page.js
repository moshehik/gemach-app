'use client';

import React, { useState, useEffect } from 'react';
import { useLabels } from '@/app/components/LabelsContext';
import { Save, Check, RefreshCw } from 'lucide-react';

const CATEGORIES = [
  { id: 'customers', label: 'לקוחות', keys: ['customer_firstName', 'customer_lastName', 'customer_phone1', 'customer_phone2', 'customer_city', 'customer_street', 'customer_houseNum', 'customer_email', 'customer_notes'] },
  { id: 'orders', label: 'הזמנות', keys: ['order_id', 'order_customerName', 'order_date', 'order_eventDate', 'order_returnDate', 'order_totalAmount', 'order_paid', 'order_status'] },
  { id: 'dresses', label: 'דגמים ופריטים', keys: ['dress_name', 'dress_barcodePrefix', 'dress_category', 'dress_price', 'dress_notes', 'dress_itemsCount', 'item_size', 'item_barcode', 'item_location', 'item_status'] },
  { id: 'rentals', label: 'השכרות', keys: ['rental_customer', 'rental_barcode', 'rental_taken', 'rental_returned', 'rental_returnedOk', 'rental_notes'] },
  { id: 'customer_availability', label: 'זמינות לקוח', keys: ['ca_title', 'ca_sizes_title', 'ca_total_models', 'ca_total_sizes', 'ca_items'] },
  { id: 'tabs', label: 'כותרות טאבים', keys: ['tab_customers', 'tab_orders', 'tab_rentals', 'tab_dresses', 'tab_customer_availability'] },
];

const DEFAULT_LABELS = {
  // Customers
  customer_firstName: 'שם פרטי',
  customer_lastName: 'שם משפחה',
  customer_phone1: 'טלפון 1',
  customer_phone2: 'טלפון 2',
  customer_city: 'עיר',
  customer_street: 'רחוב',
  customer_houseNum: 'בית',
  customer_email: 'דוא"ל',
  customer_notes: 'הערות',

  // Orders
  order_id: 'מספר הזמנה',
  order_customerName: 'שם לקוח',
  order_date: 'תאריך הזמנה',
  order_eventDate: 'תאריך אירוע',
  order_returnDate: 'תאריך החזרה',
  order_totalAmount: 'סה"כ',
  order_paid: 'שולם',
  order_status: 'סטטוס',

  // Dresses
  dress_name: 'שם דגם',
  dress_barcodePrefix: 'קידומת ברקוד',
  dress_category: 'קטגורית מחיר',
  dress_price: 'מחיר',
  dress_notes: 'הערות דגם',
  dress_itemsCount: 'מלאי',
  item_size: 'מידה',
  item_barcode: 'ברקוד',
  item_location: 'מיקום',
  item_status: 'סטטוס פריט',

  // Rentals
  rental_customer: 'לקוח',
  rental_barcode: 'ברקוד פריט',
  rental_taken: 'נלקח',
  rental_returned: 'הוחזר',
  rental_returnedOk: 'חזר תקין',
  rental_notes: 'הערות מיוחדות',

  // Customer Availability
  ca_title: 'ניהול מלאי',
  ca_sizes_title: 'זמינות מידות',
  ca_total_models: 'סה״כ דגמים',
  ca_total_sizes: 'סה״כ מידות',
  ca_items: 'פריטים',

  // Tabs
  tab_customers: 'לקוחות',
  tab_orders: 'הזמנות',
  tab_rentals: 'השכרות והחזרות',
  tab_dresses: 'ניהול קטלוג',
  tab_customer_availability: 'זמינות לקוח',
};

export default function LabelsAdminPage() {
  const { labels: contextLabels, updateLabels } = useLabels();
  const [localLabels, setLocalLabels] = useState({});
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Merge context labels with default labels so all fields are populated
    setLocalLabels({ ...DEFAULT_LABELS, ...contextLabels });
  }, [contextLabels]);

  const handleLabelChange = (key, value) => {
    setLocalLabels(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localLabels)
      });
      if (res.ok) {
        updateLabels(localLabels);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('שגיאה בשמירת הנתונים');
      }
    } catch (error) {
      console.error('Error saving labels', error);
      alert('שגיאה בשמירת הנתונים');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('האם אתה בטוח שברצונך לאפס את כל הכיתובים לערכי ברירת המחדל המקוריים? פעולה זו תדרוש שמירה.')) {
      setLocalLabels({ ...DEFAULT_LABELS });
    }
  };

  const currentCategory = CATEGORIES.find(c => c.id === activeTab);

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 1rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--primary-color)', margin: '0 0 0.5rem 0' }}>שינוי שמות וכיתובים</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            ניהול כל כותרות הטבלאות, הטאבים והטקסטים ברחבי המערכת.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleResetToDefaults}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={18} />
            שחזר ברירת מחדל
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: saveSuccess ? '#10b981' : 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSaving ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 'bold',
              transition: 'background-color 0.3s'
            }}
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 
             saveSuccess ? <Check size={18} /> : 
             <Save size={18} />}
            {isSaving ? 'שומר...' : saveSuccess ? 'נשמר בהצלחה!' : 'שמור שינויים'}
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          overflowX: 'auto'
        }}>
          {CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveTab(category.id)}
              style={{
                padding: '1rem 2rem',
                backgroundColor: activeTab === category.id ? 'var(--card-bg)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === category.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                color: activeTab === category.id ? 'var(--primary-color)' : 'var(--text-color)',
                fontWeight: activeTab === category.id ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            עריכת כיתובים - {currentCategory?.label}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {currentCategory?.keys.map(key => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ 
                  fontWeight: '600', 
                  color: 'var(--text-color)',
                  fontSize: '0.9rem' 
                }}>
                  {DEFAULT_LABELS[key] || key} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'normal' }}>({key})</span>
                </label>
                <input
                  type="text"
                  value={localLabels[key] || ''}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--element-border)',
                    backgroundColor: 'var(--input-bg, transparent)',
                    color: 'var(--text-color)',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--element-border)'}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
