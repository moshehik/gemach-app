'use client';
import React, { useState, useEffect } from 'react';

export default function OrderSizeSelector({ modelId, order, value, onChange, placeholder = '-' }) {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [defaultSpacing, setDefaultSpacing] = useState(null);

  useEffect(() => {
    // Fetch default spacing to show "X out of Y" if custom spacing is used
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const bufferSetting = (Array.isArray(data) ? data : []).find(s => s.key === 'inventory_buffer_days');
        if (bufferSetting) {
          setDefaultSpacing(parseInt(bufferSetting.value, 10));
        } else {
          setDefaultSpacing(3); // system fallback
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!modelId) {
      setSizes([]);
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
        setSizes(Array.isArray(data) ? data : (data.sizes || []));
      } catch (err) {
        console.error('Failed to fetch sizes', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSizes();
  }, [modelId, order]);

  return (
    <select
      data-agy-id="order_size_selector_select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={!modelId || loading}
      style={{
        width: '100%',
        padding: '0.4rem',
        borderRadius: '4px',
        border: '1px solid var(--element-border)',
        textAlign: 'center',
        backgroundColor: !modelId || loading ? '#f5f5f5' : 'var(--card-bg)'
      }}
    >
      <option value="">{loading ? 'טוען...' : placeholder}</option>
      {sizes.map((s) => {
        const sizeVal = s.sizeText || s.size;
        const isUnavailable = s.availableQuantity !== undefined && s.availableQuantity <= 0;
        
        let availableInfo = '';
        if (s.availableQuantity !== undefined) {
          if (order && order.customSpacing !== undefined && order.customSpacing !== null) {
            availableInfo = `זמין ${s.availableQuantity}, ציפוף: ${order.customSpacing} מתוך ${defaultSpacing || 3}`;
          } else {
            availableInfo = `פנוי ${s.availableQuantity} מתוך ${s.totalInStock}`;
          }
        } else {
          availableInfo = `במלאי: ${s.totalQuantity}`;
        }
          
        return (
          <option 
            data-agy-id="order_size_selector_option"
            key={sizeVal} 
            value={sizeVal} 
            title={availableInfo}
            disabled={isUnavailable}
          >
            {sizeVal} ({availableInfo})
          </option>
        );
      })}
    </select>
  );
}
