'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLabels } from '@/app/components/LabelsContext';
import { X, Info, Printer, Undo2, AlertTriangle, CheckCircle2, RotateCcw, Box, Search, PackageCheck, PackageX } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function RentalReturnModal({ orderId, onClose, onUpdate }) {
  const { getLabel } = useLabels();
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rental'); // 'rental' or 'return'
  
  const [modalBarcode, setModalBarcode] = useState('');
  const modalBarcodeRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const [duplicates, setDuplicates] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);

  // Fetch the order when orderId changes
  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    }
  }, [orderId]);

  const loadOrder = async (id) => {
    setLoading(true);
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/orders/${id}?_t=${timestamp}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      } else {
        alert('שגיאה בטעינת פרטי הזמנה');
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrder = async () => {
    if (!orderId) return;
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/orders/${orderId}?_t=${timestamp}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        if (onUpdate) onUpdate(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // We intentionally removed the body overflow hidden logic to prevent layout jumping
    
    return () => {
      // Cleanup
    };
  }, []);

  useEffect(() => {
    if (selectedOrder && modalBarcodeRef.current) {
      modalBarcodeRef.current.focus({ preventScroll: true });
    }
  }, [selectedOrder, activeTab, duplicates]);

  const handleModalScan = async (e) => {
    e.preventDefault();
    if (!modalBarcode || isProcessing) return;
    
    setIsProcessing(true);
    const cleanBarcode = modalBarcode.replace(/\s+/g, '');
    
    try {
      if (activeTab === 'rental') {
        await handleRentalScan(cleanBarcode);
      } else {
        await handleReturnScan(cleanBarcode);
      }
      setModalBarcode('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRentalScan = async (barcodeToScan, itemIdToForce = null) => {
    try {
      const res = await fetch('/api/rentals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: selectedOrder.orderId, 
          barcode: barcodeToScan,
          ...(itemIdToForce && { itemIdToForce })
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.duplicateAlterations) {
          setDuplicates(data.options);
        } else {
          await refreshOrder();
        }
      } else {
        if (data.unreturned) {
          if (await window.customConfirm(data.warning + '\nהאם ברצונך לסמן את הפריט כהוחזר עכשיו?')) {
            const putRes = await fetch('/api/rentals/scan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ unreturnedItemId: data.unreturnedItemId })
            });
            if (putRes.ok) {
              handleRentalScan(barcodeToScan); // Retry scan
            }
          }
        } else {
          alert(data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert('שגיאת רשת');
    }
  };

  const selectDuplicate = async (itemId) => {
    await handleRentalScan(modalBarcode, itemId);
    setDuplicates(null);
  };

  const handleReturnScan = async (barcode) => {
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId, barcode })
      });
      const data = await res.json();
      
      if (res.ok) {
        await refreshOrder();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmRental = async () => {
    try {
      const unscannedCount = selectedOrder.items.filter(i => !i.barcode && !i.isDeleted).length;
      if (unscannedCount > 0) {
        if (!await window.customConfirm(`לתשומת לב! לא נסרקו כל הפריטים (${unscannedCount} חסרים). להמשיך בכל זאת?`)) {
          return;
        }
      }

      setIsConfirming(true);
      const res = await fetch('/api/rentals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId })
      });
      if (res.ok) {
        alert('השכרה אושרה בהצלחה!');
        onClose();
        if (onUpdate) onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה באישור ההשכרה');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  };

  const undoReturn = async (itemId) => {
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const undoRental = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך לבטל את הלקיחה? (הפריט יחזור לממתינים)')) return;
    try {
      const res = await fetch('/api/rentals/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה בביטול לקיחה');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showItemDetails = async (item) => {
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let history = [];
      if (res.ok) {
        history = await res.json();
      }
      setItemDetails({ item, history });
    } catch (err) {
      console.error(err);
      setItemDetails({ item, history: [] });
    }
  };

  const reportIssue = async (itemId, issueType) => {
    if (!await window.customConfirm('האם אתה בטוח? תוסף הערה אוטומטית בכרטיס הלקוח.')) return;
    try {
      const res = await fetch('/api/returns/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId, issueType })
      });
      if (res.ok) {
        alert('הערה נוספה בהצלחה.');
        await refreshOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Rendering
  if (loading) {
    const content = (
      <div className="modal-overlay" style={{ direction: 'rtl', zIndex: 1200 }}>
        <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>טוען נתוני השכרה...</h2>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
  }

  if (!selectedOrder) return null;

  const modalContent = (
    <div className="modal-overlay" style={{ direction: 'rtl', zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '1000px', width: '100%', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 m-0 flex items-center gap-2">
              <Box className="text-blue-600" />
              הזמנה #{selectedOrder.orderId}
            </h2>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
              <span>{selectedOrder.customer ? `${selectedOrder.customer.firstName || ''} ${selectedOrder.customer.lastName || ''}` : 'לא צוין לקוח'}</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => window.open(`/print/order?orderId=${selectedOrder.orderId}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
              title="הדפס פרטי השכרה"
            >
              <Printer size={18} />
              הדפס
            </button>
            <button 
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notes */}
        {(selectedOrder.orderNotes || selectedOrder.notes) && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-amber-900 text-sm">
              <strong className="font-bold">הערות להזמנה: </strong>
              {selectedOrder.orderNotes || selectedOrder.notes}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-2 bg-white">
          <button 
            className={`flex-1 py-3 text-lg font-bold rounded-t-xl transition-all border-b-4 ${activeTab === 'rental' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'}`}
            onClick={() => setActiveTab('rental')}
          >
            השכרה (ניפוק)
          </button>
          <button 
            className={`flex-1 py-3 text-lg font-bold rounded-t-xl transition-all border-b-4 ${activeTab === 'return' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'}`}
            onClick={() => setActiveTab('return')}
          >
            החזרה
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          
          {/* Scan Bar */}
          <div className="max-w-2xl mx-auto mb-8 relative">
            <form onSubmit={handleModalScan} className="relative shadow-sm rounded-xl overflow-hidden group border border-blue-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all bg-white">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-blue-500 group-focus-within:text-blue-600">
                <Search size={22} />
              </div>
              <input 
                ref={modalBarcodeRef}
                type="text" 
                className="w-full pl-4 pr-12 py-4 text-xl bg-transparent border-none focus:outline-none placeholder-slate-400 text-slate-800"
                placeholder={`סרוק ברקוד ל${activeTab === 'rental' ? 'השכרה' : 'החזרה'} כאן...`}
                value={modalBarcode}
                onChange={(e) => setModalBarcode(e.target.value.replace(/\s+/g, ''))}
                disabled={isProcessing}
              />
              <button type="submit" className="hidden">סרוק</button>
              {isProcessing && (
                <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              )}
            </form>
          </div>

          {/* Tables */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {activeTab === 'rental' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase tracking-wide">
                        <th className="p-4 font-bold border-b border-slate-200">{getLabel('item_modelName', 'דגם')}</th>
                        <th className="p-4 font-bold border-b border-slate-200 w-24 text-center">{getLabel('item_size', 'מידה')}</th>
                        <th className="p-4 font-bold border-b border-slate-200">תיקונים</th>
                        <th className="p-4 font-bold border-b border-slate-200">{getLabel('item_barcode', 'ברקוד')}</th>
                        <th className="p-4 font-bold border-b border-slate-200 text-center">סטטוס</th>
                        <th className="p-4 font-bold border-b border-slate-200 text-center w-32">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.filter(i => !i.isDeleted).map(item => (
                        <tr key={item.id} className={`transition-colors hover:bg-slate-50 ${item.isTaken ? 'bg-green-50/30' : (item.barcode ? 'bg-amber-50/30' : '')}`}>
                          <td className="p-4 font-medium text-slate-800">{item.description}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-md font-semibold text-slate-700 border border-slate-200">{item.sizeText}</span>
                          </td>
                          <td className="p-4 text-slate-600 text-sm max-w-[200px] truncate" title={item.repairs || '-'}>{item.repairs || '-'}</td>
                          <td className="p-4">
                            {item.barcode ? (
                               <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{item.barcode}</span>
                            ) : (
                               <span className="text-slate-400 italic">לא נסרק</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {item.isTaken ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold text-xs">
                                <CheckCircle2 size={14} /> נלקח
                              </span>
                            ) : (item.barcode ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-bold text-xs">
                                ממתין
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full font-bold text-xs">
                                טרם
                              </span>
                            ))}
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => showItemDetails(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="פרטים נוספים"><Info size={18} /></button>
                              {item.isTaken && (
                                <button onClick={() => undoRental(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="בטל לקיחה"><Undo2 size={18} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedOrder.items.filter(i => !i.isDeleted).length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500">אין פריטים להשכרה בהזמנה זו</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                  <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-700 font-semibold border border-slate-300 hover:bg-slate-100 transition-colors">
                    סגור
                  </button>
                  <button onClick={confirmRental} disabled={isConfirming} className={`px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${isConfirming ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {isConfirming ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                    {isConfirming ? 'מאשר...' : 'אישור השכרה'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'return' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase tracking-wide">
                        <th className="p-4 font-bold border-b border-slate-200">{getLabel('item_modelName', 'דגם')}</th>
                        <th className="p-4 font-bold border-b border-slate-200 w-24 text-center">{getLabel('item_size', 'מידה')}</th>
                        <th className="p-4 font-bold border-b border-slate-200">{getLabel('item_barcode', 'ברקוד')}</th>
                        <th className="p-4 font-bold border-b border-slate-200 text-center">סטטוס</th>
                        <th className="p-4 font-bold border-b border-slate-200 text-center">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.filter(i => i.isTaken && !i.isDeleted).map(item => (
                        <tr key={item.id} className={`transition-colors hover:bg-slate-50 ${item.isReturned ? 'bg-green-50/30' : ''}`}>
                          <td className="p-4 font-medium text-slate-800">{item.description}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-md font-semibold text-slate-700 border border-slate-200">{item.sizeText}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{item.barcode}</span>
                          </td>
                          <td className="p-4 text-center">
                            {item.isReturned ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold text-xs">
                                <CheckCircle2 size={14} /> הוחזר
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-bold text-xs">
                                אצל לקוח
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button onClick={() => showItemDetails(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="פרטים נוספים"><Info size={18} /></button>
                              {item.isReturned ? (
                                <>
                                  <button onClick={() => undoReturn(item.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200" title="בטל החזרה"><Undo2 size={18} /></button>
                                  <button onClick={() => reportIssue(item.id, 'returned-bad')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="חזר לא תקין"><PackageX size={18} /></button>
                                </>
                              ) : (
                                <button onClick={() => reportIssue(item.id, 'not-returned')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center gap-1 text-xs px-2" title="דווח כחסר">
                                  דווח כחסר
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedOrder.items.filter(i => i.isTaken && !i.isDeleted).length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-10 text-center text-slate-500 text-lg flex flex-col items-center gap-3">
                            <PackageCheck size={48} className="text-slate-300 mx-auto" />
                            אין פריטים אצל הלקוח שניתן להחזיר
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Item Details Modal */}
      {itemDetails && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">פרטי פריט: {itemDetails.item.barcode || itemDetails.item.description}</h3>
              <button onClick={() => setItemDetails(null)} className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך אירוע</div>
                  <div className="font-semibold text-slate-700">{selectedOrder?.eventDate ? `${new Date(selectedOrder.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(selectedOrder.eventDate)})` : '-'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך לקיחה</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.takenDate ? new Date(itemDetails.item.takenDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך החזרה</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.returnDate ? new Date(itemDetails.item.returnDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">חזר תקין?</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</div>
                </div>
                <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">מחרוזת תיקונים</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.repairs || '-'}</div>
                </div>
              </div>

              <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">היסטוריית פעולות</h4>
              <div className="space-y-3">
                {itemDetails.history.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">אין היסטוריה לפריט זה</p>
                ) : (
                  itemDetails.history.map(log => (
                    <div key={log.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-xs">{log.action}</span>
                        <span className="text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString('he-IL')}</span>
                      </div>
                      <div className="text-slate-600 break-words font-mono text-xs bg-white p-2 rounded border border-slate-100" dir="ltr" style={{ textAlign: 'left' }}>
                        {log.changesJson}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {duplicates && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '100%', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5 border-b border-amber-200 text-center relative">
              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <AlertTriangle size={32} className="text-amber-500 opacity-20" />
              </div>
              <h2 className="text-xl font-bold text-amber-800 m-0 flex items-center justify-center gap-2">
                <AlertTriangle size={24} className="text-amber-500" />
                נמצאו מספר פריטים זהים
              </h2>
              <p className="text-amber-700 mt-2 text-sm">בחר לאיזה מהם לשייך את הברקוד שנסרק</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-slate-50">
              <div className="grid gap-4">
                {duplicates.map((opt, idx) => (
                  <button 
                    key={opt.id} 
                    onClick={() => selectDuplicate(opt.id)}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-slate-200 hover:border-blue-500 hover:shadow-md rounded-xl transition-all group text-right"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">אורך:</strong> {opt.lengthAlteration || 'ללא'}</div>
                      <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">צוואר:</strong> {opt.neckAlteration || 'ללא'}</div>
                      <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">שרוול:</strong> {opt.sleeveAlteration || 'ללא'}</div>
                      <div className="col-span-3 bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">פירוט:</strong> {opt.alterationDetails || 'אין פירוט נוסף'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-slate-100 p-4 flex justify-end border-t border-slate-200">
               <button onClick={() => setDuplicates(null)} className="px-6 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}} />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
