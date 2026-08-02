'use client';
import React, { useState, useEffect } from 'react';
import { calculateDynamicAvailability } from '../../lib/clientInventory';

export default function OrderSizeSelector({ modelId, order, value, onChange, placeholder = '-', inventoryCache, currentCartItems }) {
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
    
    // If cache is provided, calculate locally in memory!
    if (inventoryCache) {
      try {
        const localAvailability = calculateDynamicAvailability(
          modelId,
          order.isAbroad ? order.fromDate : order.eventDate,
          order.isAbroad ? order.toDate : null,
          inventoryCache,
          currentCartItems || []
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
        setSizes(Array.isArray(data) ? data : (data.sizes || []));
      } catch (err) {
        console.error('Failed to fetch sizes', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSizes();
  }, [modelId, order, inventoryCache, currentCartItems]);

  return (
    <select
      data-agy-id="order_size_selector_select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={!modelId || loading}
      style={{
        width: '100%',
        height: '42px',
        padding: '0.5rem 0.8rem',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
        backgroundColor: (!modelId || loading) ? '#f1f5f9' : 'white',
        color: (!modelId || loading) ? '#94a3b8' : '#1e293b',
        cursor: (!modelId || loading) ? 'not-allowed' : 'pointer',
        appearance: 'none',
        boxSizing: 'border-box',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'border-color 0.2s'
      }}
    >
      <option value="">{loading ? 'טוען...' : placeholder}</option>
      {sizes.map((s) => {
        const sizeVal = s.sizeText || s.size;
        const isUnavailable = s.availableQuantity !== undefined && s.availableQuantity <= 0;
        
        let availableInfo = '';
        if (s.availableQuantity !== undefined) {
          if (order && order.customSpacing !== undefined && order.customSpacing !== null) {
            availableInfo = `פנוי ${s.availableQuantity} מתוך ${s.totalInStock} (רווח: ${order.customSpacing} ימים)`;
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
