'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import HebrewDateRangePicker from './HebrewDateRangePicker';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { CapacityCalendar } from './CapacityCalendar';

export default function CapacitySearchModal({ isOpen, onClose }) {
  const [barcodePrefix, setBarcodePrefix] = useState('');
  const [size, setSize] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

  const [sizes, setSizes] = useState([]);
  const [models, setModels] = useState([]);
  const [modelQuery, setModelQuery] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelSelectRef = useRef(null);

  useEffect(() => {
    const prev = JSON.parse(localStorage.getItem('capacity_search_history') || '[]');
    setSearchHistory(prev);
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/inventory/models?hasActiveItems=true');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
        }
      } catch (err) {
        console.error('Error fetching models', err);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (!barcodePrefix) {
      setSizes([]);
      setSize('');
      return;
    }

    const fetchSizes = async () => {
      try {
        const res = await fetch(`/api/inventory/sizes?barcodePrefix=${barcodePrefix}`);
        if (res.ok) {
          const data = await res.json();
          setSizes(data.sizes || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSizes();
  }, [barcodePrefix]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  // Keep the search box text in sync when barcodePrefix is set from elsewhere (e.g. history)
  useEffect(() => {
    if (!barcodePrefix) { setModelQuery(''); return; }
    const m = models.find(mm => mm.barcodePrefix === barcodePrefix);
    if (m) setModelQuery(`${m.name} (${m.barcodePrefix})`);
  }, [barcodePrefix, models]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = modelQuery.trim()
    ? models.filter(m => String(m.name || '').includes(modelQuery.trim()) || String(m.barcodePrefix || '').includes(modelQuery.trim()))
    : models;

  const performSearch = async (searchParams = null) => {
    const pPrefix = searchParams ? searchParams.barcodePrefix : barcodePrefix;
    const pSize = searchParams ? searchParams.size : size;
    let pFromDate = searchParams ? searchParams.fromDate : fromDate;
    let pToDate = searchParams ? searchParams.toDate : toDate;
    const pEmployeeCode = searchParams ? searchParams.employeeCode : employeeCode;
    const pCustomerName = searchParams ? searchParams.customerName : customerName;

    if (!pPrefix || !pSize) {
      setError('יש להזין דגם ומידה');
      return;
    }

    if (!pFromDate) {
      pFromDate = new Date().toISOString().split('T')[0];
      if (!searchParams) setFromDate(pFromDate);
    }
    if (!pToDate) {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      pToDate = d.toISOString().split('T')[0];
      if (!searchParams) setToDate(pToDate);
    }

    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        barcodePrefix: pPrefix,
        size: pSize,
        fromDate: pFromDate,
        toDate: pToDate
      });
      const res = await fetch(`/api/inventory/capacity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בחיפוש');
      setResults(data);

      const newSearch = {
        // eslint-disable-next-line react-hooks/purity -- runs inside performSearch, only ever invoked from a submit/click handler, never during render
        id: Date.now(),
        timestamp: new Date().toISOString(),
        employeeCode: pEmployeeCode,
        customerName: pCustomerName,
        barcodePrefix: pPrefix,
        size: pSize,
        fromDate: pFromDate,
        toDate: pToDate
      };
      const prev = JSON.parse(localStorage.getItem('capacity_search_history') || '[]');
      const updated = [newSearch, ...prev].slice(0, 50); // Keep last 50
      localStorage.setItem('capacity_search_history', JSON.stringify(updated));
      setSearchHistory(updated);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    await performSearch();
  };

  const handleClear = () => {
    setBarcodePrefix('');
    setSize('');
    setFromDate('');
    setToDate('');
    setEmployeeCode('');
    setCustomerName('');
    setResults(null);
    setError('');
  };

  if (!isOpen) return null;

  const content = (
    <div
      data-agy-id="capacity_search_modal_backdrop"
      className="modal-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '34px 16px' }}
    >
      <div
        data-agy-id="capacity_search_modal_container"
        className="modal animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}
      >
        {/* Header */}
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong>
              <svg className="icon"><use href="#i-calendar" /></svg>
              חיפוש תפוסה
            </strong>
            <button
              data-agy-id="capacity_search_history_toggle_btn"
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="btn btn-secondary btn-sm"
            >
              <svg className="icon"><use href="#i-history" /></svg>
              {showHistory ? 'הסתר חיפושים קודמים' : 'חיפושים קודמים'}
            </button>
          </div>
          <button data-agy-id="capacity_search_close_btn" type="button" onClick={onClose} className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          {/* History */}
          {showHistory && (
            <div className="card card-pad" style={{ marginBottom: '22px' }}>
              <div className="card-title-row" style={{ marginBottom: '10px' }}>
                <svg className="icon"><use href="#i-history" /></svg>
                <h3 style={{ margin: 0 }}>היסטוריית חיפושים</h3>
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {searchHistory
                  .map(h => {
                    const modelName = models.find(m => m.barcodePrefix?.toString() === h.barcodePrefix?.toString())?.name || h.barcodePrefix;
                    const fromHebrew = h.fromDate ? getHebrewDateString(new Date(h.fromDate)) : '';
                    const toHebrew = h.toDate ? getHebrewDateString(new Date(h.toDate)) : '';
                    const searchTime = new Date(h.timestamp);
                    const searchHebrewDate = getHebrewDateString(searchTime);
                    const searchTimeStr = searchTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <div key={h.id} className="list-card">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px', flex: 1 }}>
                          <span><strong>דגם:</strong> {modelName}</span>
                          <span><strong>מידה:</strong> {h.size}</span>
                          {(fromHebrew || toHebrew) && (
                            <span><strong>תאריכים:</strong> {fromHebrew} - {toHebrew}</span>
                          )}
                          {h.employeeCode && (
                            <span><strong>עובד:</strong> {h.employeeCode}</span>
                          )}
                          <span className="hint">{searchHebrewDate}, {searchTimeStr}</span>
                        </div>
                        <button
                          data-agy-id="capacity_search_history_select_btn"
                          type="button"
                          onClick={() => {
                            setEmployeeCode(h.employeeCode || '');
                            setCustomerName(h.customerName || '');
                            setBarcodePrefix(h.barcodePrefix || '');
                            setSize(h.size || '');
                            setFromDate(h.fromDate || '');
                            setToDate(h.toDate || '');
                            setShowHistory(false);

                            performSearch({
                              employeeCode: h.employeeCode || '',
                              customerName: h.customerName || '',
                              barcodePrefix: h.barcodePrefix || '',
                              size: h.size || '',
                              fromDate: h.fromDate || '',
                              toDate: h.toDate || ''
                            });
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          בחר
                        </button>
                      </div>
                    );
                  })}
                {searchHistory.length === 0 && (
                  <p className="hint" style={{ textAlign: 'center', padding: '14px' }}>לא נמצאו חיפושים</p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSearch}>
            <div className="form-grid" style={{ marginBottom: '4px' }}>
              <div className="field combobox" ref={modelSelectRef}>
                <label htmlFor="capacity-search-model">דגם</label>
                <div className="input-icon-wrap">
                  <svg className="icon"><use href="#i-search" /></svg>
                  <input
                    id="capacity-search-model"
                    data-agy-id="capacity_search_model_select"
                    type="text"
                    className="input"
                    value={modelQuery}
                    onChange={e => {
                      setModelQuery(e.target.value);
                      setShowModelDropdown(true);
                      if (barcodePrefix) { setBarcodePrefix(''); setSize(''); }
                    }}
                    onFocus={() => setShowModelDropdown(true)}
                    placeholder="הקלד לחיפוש דגם..."
                    autoComplete="off"
                  />
                </div>
                {showModelDropdown && filteredModels.length > 0 && (
                  <div className="combobox-results">
                    {filteredModels.map(m => (
                      <div
                        data-agy-id="capacity_search_model_option"
                        key={m.id || m.barcodePrefix}
                        className="combobox-option"
                        onClick={() => {
                          setBarcodePrefix(m.barcodePrefix);
                          setModelQuery(`${m.name} (${m.barcodePrefix})`);
                          setSize('');
                          setShowModelDropdown(false);
                        }}
                      >
                        <svg className="icon"><use href="#i-tag" /></svg>
                        <span>{m.name}</span>
                        <span className="meta">{m.barcodePrefix}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="capacity-search-size">מידה</label>
                <select
                  id="capacity-search-size"
                  data-agy-id="capacity_search_size_select"
                  className="select"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  required
                  disabled={!barcodePrefix || sizes.length === 0}
                >
                  <option value="">{(!barcodePrefix) ? 'בחר דגם תחילה' : (sizes.length === 0 ? 'אין מידות לדגם' : 'בחר מידה...')}</option>
                  {sizes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>טווח תאריכים</label>
              <HebrewDateRangePicker
                startDate={fromDate}
                endDate={toDate}
                onChange={(start, end) => {
                  setFromDate(start);
                  setToDate(end);
                }}
              />
            </div>

            {error && (
              <div className="callout callout-danger" style={{ marginBottom: '14px' }}>
                <svg className="icon"><use href="#i-alert-circle" /></svg>
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button data-agy-id="capacity_search_clear_btn" type="button" onClick={handleClear} className="btn btn-secondary">
                נקה הכל
              </button>
              <button data-agy-id="capacity_search_submit_btn" type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (<><span className="spinner" />מחפש...</>) : (<><svg className="icon"><use href="#i-search" /></svg>חפש</>)}
              </button>
            </div>
          </form>

          {/* Results */}
          {results && (
            <div className="animate-fade-in" style={{ marginTop: '24px' }}>
              {/* Summary Cards */}
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">במלאי</div>
                  <div className="kpi-value" style={{ color: 'var(--info)' }}>{results.inStock}</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">בתפוסה</div>
                  <div className="kpi-value" style={{ color: 'var(--danger)' }}>{results.occupiedCount}</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">רזרבה</div>
                  <div className="kpi-value" style={{ color: 'var(--primary-solid)' }}>{results.reserve}</div>
                </div>
              </div>

              {/* View Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
                <div className="toggle-btn-group">
                  <button
                    data-agy-id="capacity_search_view_list_btn"
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'on' : ''}
                  >
                    <svg className="icon"><use href="#i-list" /></svg> תצוגת רשימה
                  </button>
                  <button
                    data-agy-id="capacity_search_view_calendar_btn"
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className={viewMode === 'calendar' ? 'on' : ''}
                  >
                    <svg className="icon"><use href="#i-calendar" /></svg> תצוגת לוח
                  </button>
                </div>
              </div>

              {/* List View */}
              {viewMode === 'list' && (
                results.occupiedCount > 0 ? (
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>תאריך אירוע</th>
                          <th>שם לקוח</th>
                          <th>כמות בתפוסה</th>
                          <th>פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...results.occupiedOrders].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)).map(order => (
                          <tr key={order.id}>
                            <td>
                              {new Date(order.eventDate).toLocaleDateString('he-IL')} <span className="hint" style={{ color: 'var(--text-3)' }}>({order.eventDateHebrew || 'לא צוין'})</span>
                            </td>
                            <td>{order.customerName}</td>
                            <td><span className="badge badge-danger">{order.quantity}</span></td>
                            <td>
                              <a
                                href={`/orders/${order.orderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                פתח <svg className="icon"><use href="#i-link" /></svg>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-calendar" /></svg>
                    <h4>אין הזמנות תפוסות בטווח התאריכים הנבחר</h4>
                    <p>הפריט פנוי לחלוטין בתאריכים אלו.</p>
                  </div>
                )
              )}

              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <CapacityCalendar
                  fromDate={fromDate || new Date().toISOString().split('T')[0]}
                  toDate={toDate || new Date().toISOString().split('T')[0]}
                  occupiedOrders={results.occupiedOrders}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
