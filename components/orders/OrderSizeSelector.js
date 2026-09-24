'use client';
import React, { useState, useEffect } from 'react';
import { calculateDynamicAvailability } from '../../lib/clientInventory';
import { sortSizeRows } from '../../lib/sizeSort';
import { V3Page, Icon } from '@/app/v3/ui/components';
import './orderItemsV3.css';

// כמה פנוי מכל מידה — לוגיקה אחת לשני הבוחרים (הרגיל וזה של "אותה קטגוריית מחיר" ב-ModernItemsManager).
export function describeSizeRow(s, order) {
  const sizeVal = s.sizeText || s.size;
  // תמיכה בשתי המבנים — המבנה החדש (עם withNormalBuffer) והישן (עם availableQuantity ישירה)
  const normalAvail = s.withNormalBuffer?.availableQuantity ?? s.availableQuantity;
  const customAvail = s.withCustomSpacing?.availableQuantity;
  const selectedAvail = order && order.customSpacing !== undefined && order.customSpacing !== null ? customAvail : normalAvail;
  const isUnavailable = selectedAvail !== undefined && selectedAvail <= 0;
  let short = '';
  let full = '';
  if (normalAvail !== undefined) {
    if (s.withCustomSpacing) {
      const gain = s.withCustomSpacing.gain || 0;
      short = `רגיל ${normalAvail} · ציפוף ${customAvail}${gain > 0 ? ` (+${gain})` : ''}`;
      full = `רגיל: ${normalAvail} | ציפוף: ${customAvail}${gain > 0 ? ` (+${gain})` : ''} מתוך ${s.totalInStock}`;
    } else {
      short = `פנוי ${normalAvail} מתוך ${s.totalInStock}`;
      full = short;
    }
  } else {
    short = `במלאי: ${s.totalQuantity || s.totalInStock}`;
    full = short;
  }
  return { sizeVal, isUnavailable, short, full };
}

// ריבועי מידה (במקום select): מוצגים כשכבר יש רשימת מידות. onChange(מחרוזת) — אותה חתימה כמו ב-select.
export function SizeChips({ rows, value, onChange, order, disabled = false, loading = false, hasModel = true }) {
  if (!hasModel) return <div className="oi-sizes__msg"><Icon name="info" size="sm" />בחרו דגם כדי לראות מידות</div>;
  if (loading) return <div className="oi-sizes__msg" aria-busy="true"><Icon name="loader" size="sm" loop />טוען מידות...</div>;
  if (!rows.length) return <div className="oi-sizes__msg"><Icon name="info" size="sm" />אין מידות להצגה</div>;
  return (
    <div className="oi-sizes" role="group" aria-label="מידה" data-agy-id="order_size_selector_select">
      {rows.map((s) => {
        const { sizeVal, isUnavailable, short, full } = describeSizeRow(s, order);
        const on = sizeVal === value;
        return (
          <button
            type="button"
            key={sizeVal}
            data-agy-id="order_size_selector_option"
            className="oi-size"
            aria-pressed={on}
            aria-label={`${sizeVal} — ${full}`}
            title={full}
            disabled={disabled || isUnavailable}
            onClick={() => onChange(on ? '' : sizeVal)}
          >
            <b><bdi>{sizeVal}</bdi></b>
            <small>{short}</small>
          </button>
        );
      })}
    </div>
  );
}

export default function OrderSizeSelector({ modelId, order, value, onChange, placeholder = '-', inventoryCache, currentCartItems }) {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modelId) {
      setSizes([]);
      return;
    }
    
    // If cache is provided, calculate locally in memory!
    if (inventoryCache) {
      try {
        const localAvailability = calculateDynamicAvailability(
          modelId,
          order.isAbroad ? order.fromDate : order.eventDate,
          order.isAbroad ? order.toDate : null,
          inventoryCache,
          currentCartItems || [],
          order.customSpacing
        );
        setSizes(localAvailability);
      } catch (err) {
        console.error('Failed to calculate sizes from cache', err);
      }
      return;
    }
    
    const fetchSizes = async () => {
      setLoading(true);
      try {
        let url = `/api/inventory/sizes?modelId=${modelId}`;
        
        // If order context is provided, fetch true availability!
        if (order) {
          const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
          if (hasDates) {
            const queryParams = new URLSearchParams({
              dressModelId: modelId,
              isAbroad: order.isAbroad || false
            });
            
            if (order.eventDate) queryParams.append('eventDate', order.eventDate);
            if (order.isAbroad) {
              if (order.fromDate) queryParams.append('fromDate', order.fromDate);
              if (order.toDate) queryParams.append('toDate', order.toDate);
            }
            if (order.customSpacing !== undefined && order.customSpacing !== null) {
              queryParams.append('customSpacing', order.customSpacing);
            }
            url = `/api/orders/availability?${queryParams.toString()}`;
          }
        }
        
        const res = await fetch(url);
        const data = await res.json();
        // availability endpoint returns array directly, sizes endpoint returns {sizes: []}
        const rows = Array.isArray(data) ? data : (data.sizes || []);
        // sizes endpoint מחזיר מחרוזות — עוטפים לאובייקט כדי שהמיון והרינדור יעבדו אחיד
        setSizes(sortSizeRows(rows.map(r => (typeof r === 'string' ? { sizeText: r } : r))));
      } catch (err) {
        console.error('Failed to fetch sizes', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSizes();
  }, [modelId, order, inventoryCache, currentCartItems]);

  return (
    <V3Page page={false} sprite={false} className="oi-root oi-root--inline">
      <SizeChips rows={sizes} value={value} onChange={onChange} order={order} loading={loading} hasModel={!!modelId} placeholder={placeholder} />
    </V3Page>
  );
}
