'use client';

import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, CheckCircle, Clock, Info, Package, RefreshCcw, CreditCard, History } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function OrderModernWorkspace({ 
  order, 
  sections, 
  activeTab, 
  onTabClick, 
  mode, // 'sidebar' or 'dashboard'
  totalRequired,
  totalPaid,
  actionButtons // new prop for top-left actions
}) {
  
  // Theme Variables (Gold/Cream based on sample 8)
  const theme = {
    primary: '#d4af37',
    primaryHover: '#b5952f',
    bgMain: '#fcfbf9',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
    textMain: '#2c2c2c',
    textMuted: '#737373',
    elementBg: '#f5f5f5',
    warningBg: '#fffbeb',
    warningText: '#f59e0b',
    successBg: '#f0fdf4',
    successText: '#22c55e',
    dangerBg: '#fef2f2',
    dangerText: '#ef4444'
  };

  // Determine overall status
  const debt = totalRequired - totalPaid;
  const isDebt = debt > 0;
  
  // Sidebar Tabs based on sections array
  const tabs = sections.map(s => {
    let label = '';
    let icon = null;
    switch(s.id) {
      case 'details': label = 'פרטים כלליים'; icon = <Info size={18}/>; break;
      case 'items': label = 'פריטים בהזמנה'; icon = <Package size={18}/>; break;
      case 'rentals': label = 'השכרות והחזרות'; icon = <RefreshCcw size={18}/>; break;
      case 'payments': label = 'תשלומים'; icon = <CreditCard size={18}/>; break;
      case 'history': label = 'היסטוריית שינויים'; icon = <History size={18}/>; break;
      default: label = s.id;
    }
    return { id: s.id, label, icon: s.node?.props?.icon || icon };
  });

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      background: 'transparent',
      minHeight: 'calc(100vh - 150px)',
      direction: 'rtl',
      fontFamily: "'Heebo', 'Assistant', sans-serif"
    }}>
      
      {/* ---------------- SIDEBAR ---------------- */}
      <div style={{
        width: '320px',
        flexShrink: 0,
        background: theme.primary,
        borderRadius: '16px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        height: 'fit-content',
        position: 'sticky',
        top: '20px',
        border: `1px solid ${theme.borderColor}`
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '30px 20px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ 
              background: order?.status?.includes('הוחזר') ? theme.successBg : theme.warningBg, 
              color: order?.status?.includes('הוחזר') ? theme.successText : theme.warningText, 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.85rem', 
              fontWeight: '600',
              border: `1px solid ${order?.status?.includes('הוחזר') ? '#bbf7d0' : '#fde68a'}`
            }}>
              {order?.status || 'ממתין'}
            </span>
            <span style={{ opacity: 0.85, fontSize: '0.9rem', fontWeight: '500' }}>הזמנה #{order?.orderId}</span>
          </div>
          
          <h2 style={{ margin: '0 0 5px 0', fontSize: '1.6rem', color: '#fff', fontFamily: "'Playfair Display', serif" }}>
            {order?.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח לא נבחר'}
          </h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
            {order?.customer?.phone1 || 'ללא טלפון'}
          </p>

          {/* Fast Scan Field */}
          <div style={{
            marginTop: '25px',
            background: 'rgba(255,255,255,0.15)',
            padding: '15px',
            borderRadius: '12px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'rgba(255,255,255,0.95)' }}>
              סריקה מהירה (השכרה/החזרה):
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="סרוק ברקוד..."
                id="global-barcode-sidebar"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  borderRadius: '20px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  direction: 'ltr',
                  textAlign: 'right',
                  background: '#fff',
                  color: theme.textMain,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              />
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div style={{ flex: 1, padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabClick(tab.id)}
                style={{
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  borderRight: `4px solid ${isActive ? '#fff' : 'transparent'}`,
                  color: '#fff',
                  padding: '16px 20px',
                  textAlign: 'right',
                  fontSize: '1.05rem',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Sidebar Footer Info */}
        <div style={{ padding: '20px', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ marginBottom: '10px' }}>
            <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.85, marginBottom: '4px' }}>תאריך אירוע:</span>
            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
              {order?.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.eventDate)})` : 'לא נבחר'}
            </div>
          </div>
          {isDebt && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
               <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.85, marginBottom: '4px' }}>יתרת חוב:</span>
               <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#fca5a5' }}>₪{debt.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Top Action Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          padding: '10px 0' 
        }}>
          {actionButtons}
        </div>

        {/* If Mode === 'sidebar' (Model 3), show ONLY the active tab */}
        {mode === 'sidebar' && (
          <div style={{
            background: theme.cardBg,
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
            border: `1px solid ${theme.borderColor}`,
            padding: '30px',
            animation: 'fadeIn 0.3s ease-out',
            minHeight: '100%'
          }}>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
              .gold-themed-section > div { box-shadow: none !important; border: none !important; padding: 0 !important; background: transparent !important; }
              .gold-themed-section h2, .gold-themed-section h3 { color: ${theme.primary} !important; font-family: 'Playfair Display', serif !important; }
            `}} />
            <div className="gold-themed-section">
              {sections.find(s => s.id === activeTab)?.node}
            </div>
          </div>
        )}

        {/* If Mode === 'dashboard' (Model 2), show a Grid of all sections */}
        {mode === 'dashboard' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '24px',
            alignItems: 'start'
          }}>
            <style dangerouslySetInnerHTML={{__html: `
              .gold-grid-card {
                background: ${theme.cardBg};
                border-radius: 16px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                border: 1px solid ${theme.borderColor};
                overflow: hidden;
              }
              .gold-themed-section > div { box-shadow: none !important; border: none !important; padding: 25px !important; background: transparent !important; }
              .gold-themed-section h2, .gold-themed-section h3 { color: ${theme.primary} !important; font-family: 'Playfair Display', serif !important; margin-top: 0 !important; }
            `}} />
            
            {sections.map(section => (
              <div 
                key={section.id} 
                id={section.id}
                className="gold-grid-card gold-themed-section"
                style={{ 
                  gridColumn: `span ${section.span}`,
                  order: section.order
                }}
              >
                {section.node}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
