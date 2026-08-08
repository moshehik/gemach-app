'use client';

import React, { useState, useEffect } from 'react';
import { useLabels } from '@/app/components/LabelsContext';

const CATEGORIES = [
  { id: 'customers', label: 'לקוחות', icon: 'i-users', keys: ['customer_firstName', 'customer_lastName', 'customer_phone1', 'customer_phone2', 'customer_city', 'customer_street', 'customer_houseNum', 'customer_email', 'customer_notes'] },
  { id: 'orders', label: 'הזמנות', icon: 'i-bag', keys: ['order_id', 'order_customerName', 'order_date', 'order_eventDate', 'order_returnDate', 'order_totalAmount', 'order_paid', 'order_status'] },
  { id: 'dresses', label: 'דגמים ופריטים', icon: 'i-box', keys: ['dress_name', 'dress_barcodePrefix', 'dress_category', 'dress_price', 'dress_notes', 'dress_itemsCount', 'item_size', 'item_barcode', 'item_location', 'item_status'] },
  { id: 'rentals', label: 'השכרות', icon: 'i-truck', keys: ['rental_customer', 'rental_barcode', 'rental_taken', 'rental_returned', 'rental_returnedOk', 'rental_notes'] },
  { id: 'customer_availability', label: 'זמינות לקוח', icon: 'i-grid', keys: ['ca_title', 'ca_sizes_title', 'ca_total_models', 'ca_total_sizes', 'ca_items'] },
  { id: 'tabs', label: 'כותרות טאבים', icon: 'i-list', keys: ['tab_customers', 'tab_orders', 'tab_rentals', 'tab_dresses', 'tab_customer_availability'] },
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

  const handleResetToDefaults = async () => {
    if (await window.customConfirm('האם אתה בטוח שברצונך לאפס את כל הכיתובים לערכי ברירת המחדל המקוריים? פעולה זו תדרוש שמירה.')) {
      setLocalLabels({ ...DEFAULT_LABELS });
    }
  };

  const currentCategory = CATEGORIES.find(c => c.id === activeTab);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>שינוי שמות וכיתובים</h1>
          <div className="page-desc">ניהול כל כותרות הטבלאות, הטאבים והטקסטים ברחבי המערכת.</div>
        </div>
        <div className="page-actions">
          <button data-element-name="כפתור_page_1" type="button" className="btn btn-secondary" onClick={handleResetToDefaults}>
            <svg className="icon"><use href="#i-refresh" /></svg>
            שחזר ברירת מחדל
          </button>
          <button data-element-name="כפתור_page_3" type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <span className="spinner" data-element-name="רכיב_page_4" />
            ) : saveSuccess ? (
              <svg className="icon" data-element-name="רכיב_page_5"><use href="#i-check" /></svg>
            ) : (
              <svg className="icon" data-element-name="רכיב_page_6"><use href="#i-check" /></svg>
            )}
            {isSaving ? 'שומר...' : saveSuccess ? 'נשמר בהצלחה!' : 'שמור שינויים'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-pad">
          <div className="tabs">
            {CATEGORIES.map(category => (
              <button
                data-element-name="כפתור_page_7"
                key={category.id}
                type="button"
                className={activeTab === category.id ? 'tab active' : 'tab'}
                style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
                onClick={() => setActiveTab(category.id)}
              >
                <svg className="icon"><use href={`#${category.icon}`} /></svg>
                {category.label}
              </button>
            ))}
          </div>

          <h2>עריכת כיתובים - {currentCategory?.label}</h2>

          <div className="form-grid cols-3">
            {currentCategory?.keys.map(key => (
              <div key={key} className="field">
                <label htmlFor={`admin-labels-${key}`}>
                  {DEFAULT_LABELS[key] || key} <span className="hint">({key})</span>
                </label>
                <input
                  data-element-name="שדה_page_8"
                  className="input"
                  type="text"
                  id={`admin-labels-${key}`}
                  value={localLabels[key] || ''}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
