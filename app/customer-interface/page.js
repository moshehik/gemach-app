'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '@/components/HebrewDatePicker';

export default function CustomerInventoryViewer() {
  const { getLabel } = useLabels();
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(1);
  const [search, setSearch] = useState('');
  const [showZeroSizes, setShowZeroSizes] = useState(false);
  const [viewMode, setViewMode] = useState('rows');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [unlockEmployee, setUnlockEmployee] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalModel, setOrdersModalModel] = useState(null);
  const [ordersModalSize, setOrdersModalSize] = useState(null);
  const [ordersModalLoading, setOrdersModalLoading] = useState(false);
  const [ordersModalOrders, setOrdersModalOrders] = useState([]);
  const [settings, setSettings] = useState({ hide_dress_images: 'false' });

  // Sidebar filters (stage 2)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [priceCategories, setPriceCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  // What a successful employee login in the unlock modal should do:
  // 'unlock' releases the kiosk lock; 'print' only authorizes a one-off print and keeps the lock.
  const [unlockIntent, setUnlockIntent] = useState('unlock');
  // True during an employee-authorized print from a locked kiosk, so the
  // fullscreen exit caused by the print popup doesn't re-open the unlock modal.
  const suppressRelockRef = useRef(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const settingsObj = { hide_dress_images: 'false' };
        if (Array.isArray(data)) {
          data.forEach(s => {
            if (s.key) settingsObj[s.key] = s.value;
          });
        }
        setSettings(settingsObj);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isLocked) {
      document.body.classList.add('hide-global-nav');
    } else {
      document.body.classList.remove('hide-global-nav');
    }
    return () => document.body.classList.remove('hide-global-nav');
  }, [isLocked]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Don't touch the modal if it's already open (would overwrite a pending 'print'
      // intent mid-typing), and don't re-open it for the fullscreen exit that an
      // employee-authorized print itself causes (suppressRelockRef window).
      if (isLocked && !document.fullscreenElement && !showUnlockModal && !suppressRelockRef.current) {
        setUnlockIntent('unlock');
        setShowUnlockModal(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isLocked, showUnlockModal]);

  // Right-click context menu ("Inspect", "View source", etc.) is a bigger escape hole
  // than anything the header buttons offered, so block it entirely while the kiosk is locked.
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (isLocked) e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [isLocked]);

  // AI Chat State
  const [aiInput, setAiInput] = useState('');
  const [aiChats, setAiChats] = useState({
    1: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }],
    2: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים, להציג תפוסה מלאה ולענות על שאלות. במה אפשר לעזור?' }]
  });
  const aiMessages = aiChats[stage] || [];
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);
  useEffect(() => { setIsAiChatVisible(false); }, [stage]); // Close chat on stage change

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (aiMessages.length > 0) {
      localStorage.setItem('ai_customer_chat', JSON.stringify(aiMessages));
    }
  }, [aiMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if(!aiInput.trim() || aiLoading) return;
    const userMsg = { role: 'user', content: aiInput.trim() };
    setAiInput('');

    const newMessages = [...(aiChats[stage] || []), userMsg];
    setAiChats(prev => ({ ...prev, [stage]: newMessages }));
    setIsAiChatVisible(true);
    setAiLoading(true);

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.\nטיפ חכם: אם אתה ממליץ על דגם מסוים או מידה מסוימת, באפשרותך להוסיף בסוף התשובה שלך את התגית [FILTER:term] כאשר term הוא מילת החיפוש (למשל [FILTER:תחרה] או [FILTER:42]). המערכת תהפוך את זה לכפתור סינון עבור הלקוח.`
        }),
      });
      const data = await res.json();

      const assistantMsg = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'שגיאה בחיבור למערכת ה-AI.' };

      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), assistantMsg] }));
    } catch (err) {
      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), { role: 'assistant', content: 'שגיאת תקשורת.' }] }));
    } finally {
      setAiLoading(false);
    }
  };

  const fetchInventory = () => {
    setLoading(true);
    const dateQuery = selectedDate ? `?eventDate=${selectedDate.toISOString()}&limit=10000` : '?limit=10000';
    fetch(`/api/dresses${dateQuery}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDresses(data);
        } else if (data && Array.isArray(data.data)) {
          setDresses(data.data);
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedDate]);

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEmployees(data);
      })
      .catch(err => console.error('Failed to load employees:', err));
  }, []);

  useEffect(() => {
    fetch('/api/pricelists/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPriceCategories(data);
      })
      .catch(err => console.error('Failed to load price categories:', err));
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockEmployee) {
      setUnlockError('נא לבחור עובד');
      return;
    }

    setUnlockError('');
    setUnlockLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: unlockEmployee, password: unlockPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockEmployee('');
        if (unlockIntent === 'print') {
          // Employee only authorized a print — the kiosk stays locked.
          setUnlockIntent('unlock');
          suppressRelockRef.current = true;
          handleCatalogPrint();
          setTimeout(() => {
            suppressRelockRef.current = false;
            // Best effort to restore fullscreen after the print popup closed;
            // if the browser rejects it (no user gesture), the next fullscreen
            // exit event will still re-open the unlock modal as usual.
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          }, 2500);
        } else {
          setIsLocked(false);
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.warn(err));
          }
        }
      } else {
        setUnlockError(data.message || 'שם עובד או סיסמא שגויים');
      }
    } catch (err) {
      setUnlockError('שגיאת תקשורת');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleModelDoubleClick = async (model, sizeName = null) => {
    if (isLocked) return;
    const fromDate = new Date(selectedDate);
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date(selectedDate);
    toDate.setDate(toDate.getDate() + 7);

    setOrdersModalModel(model);
    setOrdersModalSize(sizeName);
    setOrdersModalLoading(true);
    setOrdersModalOrders([]);
    setShowOrdersModal(true);

    try {
      const barcodePrefixParam = model.barcodePrefix ? `&modelBarcodePrefix=${encodeURIComponent(model.barcodePrefix)}` : '';
      const res = await fetch(`/api/orders?itemDetails=${encodeURIComponent(model.name)}${barcodePrefixParam}&eventDateFrom=${fromDate.toISOString()}&eventDateTo=${toDate.toISOString()}&filterStatus=all`);
      const data = await res.json();
      if (res.ok) {
         let filtered = data.data || [];
         if (sizeName) {
           filtered = filtered.filter(order => {
             return order.items.some(item => {
               const matchModel = item.dressId === model.id || (item.description && item.description.includes(model.name));
               const matchSize = item.description && (item.description.includes(`מידה: ${sizeName}`) || item.description.includes(sizeName));
               return matchModel && matchSize;
             });
           });
         }
         setOrdersModalOrders(filtered);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setOrdersModalLoading(false);
    }
  };

  const displayDresses = useMemo(() => {
    let list = dresses.filter(d => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(d.priceCategory)) return false;

      const term = search.trim().toLowerCase();
      if (!term) return true;

      // Handle explicit size search
      // Exact size match, excluding unusable items — so the sidebar size chips
      // ("מידה 40") never pull in "140" / "40-42" or deleted-item-only models.
      const sizeMatch = term.match(/^מידה\s*(.+)$/);
      if (sizeMatch) {
        const cleanTerm = sizeMatch[1].trim();
        if (d.items) {
          return d.items.some(item => {
            if (item.notInUse || item.isDeleted || item.isUnusable) return false;
            return (item.sizeText || 'כללי').trim().toLowerCase() === cleanTerm;
          });
        }
        return false;
      }

      const matchName = (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString() === term);
      if (matchName) return true;
      if (d.items) {
        return d.items.some(item => (item.sizeText || 'כללי').toLowerCase().includes(term));
      }
      return false;
    });

    list.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return list;
  }, [dresses, search, selectedCategories]);

  // Distinct sizes across the whole (unfiltered) inventory, for the sidebar quick-filter chips.
  const sizeChipOptions = useMemo(() => {
    const set = new Set();
    dresses.forEach(d => d.items?.forEach(item => {
      if (item.notInUse || item.isDeleted || item.isUnusable) return;
      const st = (item.sizeText || '').trim();
      if (st) set.add(st);
    }));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [dresses]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    dresses.forEach(d => {
      if (d.priceCategory) counts[d.priceCategory] = (counts[d.priceCategory] || 0) + 1;
    });
    return counts;
  }, [dresses]);

  // Per-model size/quantity breakdown, shared by all three views and the summary line.
  const getModelSizeInfo = (model) => {
    const sizeMap = new Map();
    model.items?.forEach(item => {
      if (item.notInUse || item.isDeleted || item.isUnusable) return;
      const st = item.sizeText || 'כללי';
      if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
      const info = sizeMap.get(st);
      info.total += 1;
      if (item.quantity > 0) info.available += 1;
    });
    const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    const totalAvailable = sizesArray.reduce((s, [, d]) => s + d.available, 0);
    const totalUnits = sizesArray.reduce((s, [, d]) => s + d.total, 0);
    return { sizesArray, totalAvailable, totalUnits };
  };

  // Counted with the same rules as the card summaries and the print view (getModelSizeInfo),
  // so the header number can never contradict what the cards show.
  const grandTotalItems = useMemo(() => {
    return displayDresses.reduce((sum, model) => sum + getModelSizeInfo(model).totalAvailable, 0);
  }, [displayDresses]);

  const handleCatalogPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס");
      return;
    }

    const dateStr = getHebrewDateString(selectedDate);
    const filterText = search ? ` - סינון: ${search}` : '';

    let tableRows = '';
    displayDresses.forEach(model => {
      const sizeMap = new Map();
      let totalItems = 0;
      let totalAvailable = 0;
      model.items?.forEach(item => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = item.sizeText || 'כללי';
        if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
        const info = sizeMap.get(st);
        info.total += 1;
        totalItems += 1;
        if (item.quantity > 0) {
          info.available += 1;
          totalAvailable += 1;
        }
      });

      const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));
      let sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return `<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid ${isAvail ? '#555' : '#ccc'}; color:${isAvail ? '#000' : '#999'}; ${isAvail ? 'font-weight:bold;' : ''}">${sName} (${sData.available}/${sData.total})</span>`;
      }).join('');

      tableRows += `
        <tr>
          <td style="font-weight:bold;">${model.name || ''}</td>
          <td>${model.barcodePrefix || model.id || ''}</td>
          <td style="font-weight:bold;">${totalAvailable} מתוך ${totalItems}</td>
          <td>${sizesHtml || 'אין מלאי'}</td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>דוח מלאי - ${dateStr}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #000; padding: 20px; margin: 0; background: #fff; }
          .bsd { text-align: right; font-weight: bold; font-size: 13px; margin-bottom: 6px; }
          .report-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; }
          .report-header h1 { margin: 0 0 10px 0; font-size: 26px; color: #000; }
          .report-header p { margin: 0; font-size: 16px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #bbb; padding: 12px 16px; text-align: right; }
          th { background: #f1f5f9; font-weight: bold; color: #000; font-size: 15px; border-bottom: 2px solid #999; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tbody tr:nth-child(even) { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .summary { font-size: 16px; font-weight: bold; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #999; break-inside: avoid; page-break-inside: avoid; }
          @media print {
            body { padding: 0; }
            table { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="bsd">בס"ד</div>
        <div class="report-header">
          <h1>דוח זמינות דגמים - גמ"ח שמלות</h1>
          <p>תאריך אירוע מבוקש: ${dateStr} | סינון: ${search ? `"${search}"` : 'ללא סינון'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">שם הדגם</th>
              <th style="width: 15%;">קידומת ברקוד</th>
              <th style="width: 15%;">זמינים / סה"כ</th>
              <th style="width: 45%;">פירוט מידות וזמינות</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="summary">
          סה"כ דגמים מוצגים: ${displayDresses.length}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div data-agy-id="customer_inventory_main_container" className="kiosk-shell" style={{ minHeight: '100vh', direction: 'rtl' }}>

      {/* Stage 1: Search & Date Selection */}
      {stage === 1 && (
        <div className="kiosk-hero">
          <h2>מה תחפש היום?</h2>
          <p className="kiosk-sub">הזן סגנון, מידה או פשוט בחר תאריך מהיומן</p>

          {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && (
            <div className="ai-feature-element" style={{ width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Chat History Above Input */}
              {aiMessages.length > 1 ? (
                <div className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div className="card-title-row" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                      <svg data-element-name="רכיב_page_4" className="icon"><use href="#i-star" /></svg>
                      העוזר החכם
                    </div>
                    <button data-element-name="כפתור_page_5" data-agy-id="new_ai_chat_btn" type="button" className="btn btn-ghost btn-icon-only" title="שיחה חדשה"
                      onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }] }))}>
                      <svg data-element-name="רכיב_page_6" className="icon"><use href="#i-plus" /></svg>
                    </button>
                  </div>

                  <div className="chat-thread" style={{ marginBottom: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                    {aiMessages.slice(1).map((msg, idx) => {
                      let displayContent = msg.content;
                      let isoDateMatch = null;
                      let filterMatchStr = null;
                      if (typeof displayContent === 'string') {
                        const dateRegex = /\[DATE:(\d{4}-\d{2}-\d{2})\]/;
                        const dateMatch = displayContent.match(dateRegex);
                        if (dateMatch) {
                          isoDateMatch = dateMatch[1];
                        }

                        const filterRegex = /\[FILTER:(.*?)\]/;
                        const filterMatch = displayContent.match(filterRegex);
                        if (filterMatch) {
                          filterMatchStr = filterMatch[1].trim();
                        }

                        displayContent = displayContent.replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').replace(/\[FILTER:(.*?)\]/g, '').trim();
                      }

                      return (
                        <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                          <div>{displayContent}</div>
                          {msg.role === 'assistant' && isoDateMatch && !filterMatchStr && (
                            <div className="quick-reply-row">
                              <button data-element-name="כפתור_page_7"
                                type="button"
                                className="quick-reply-chip"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                                  setStage(2);
                                }}
                              >
                                <svg className="icon"><use href="#i-calendar" /></svg>
                                הצג מלאי לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
                              </button>
                            </div>
                          )}
                          {msg.role === 'assistant' && filterMatchStr && (
                            <div className="quick-reply-row">
                              <button data-element-name="כפתור_page_8"
                                type="button"
                                className="quick-reply-chip"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSearch(filterMatchStr);
                                  if (isoDateMatch) {
                                    setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                                  }
                                  setStage(2);
                                }}
                              >
                                <svg data-element-name="רכיב_page_9" className="icon"><use href="#i-search" /></svg>
                                סנן והצג: {filterMatchStr} {isoDateMatch ? `(לתאריך ${getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {aiLoading && (
                      <div className="bubble assistant" style={{ padding: 0 }}>
                        <div className="typing-indicator"><span></span><span></span><span></span></div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '10px' }}>
                    <input data-element-name="שדה_page_10"
                      data-agy-id="ai_chat_input"
                      type="text"
                      className="input"
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      placeholder="מה תרצה לחפש?"
                      style={{ flex: 1 }}
                    />
                    <button data-element-name="כפתור_page_11" data-agy-id="ai_chat_submit_btn" type="submit" className="btn btn-primary btn-icon-only" disabled={aiLoading || !aiInput.trim()} title="שלח">
                      {aiLoading ? <span className="spinner" style={{ borderTopColor: 'var(--text-on-primary)' }} /> : <svg data-element-name="רכיב_page_12" className="icon"><use href="#i-arrow-end" /></svg>}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="kiosk-search">
                  <svg className="icon"><use href="#i-search" /></svg>
                  <form onSubmit={handleAiSubmit}>
                    <input data-element-name="שדה_page_13"
                      data-agy-id="hero_ai_search_input"
                      type="text"
                      className="input"
                      placeholder="לדוגמה: שמלה שחורה מידה 12..."
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      style={{ paddingInlineEnd: '54px' }}
                    />
                    <button data-element-name="כפתור_page_14" data-agy-id="hero_ai_search_btn" type="submit" className="btn btn-primary btn-icon-only" disabled={aiLoading}
                      style={{ position: 'absolute', insetInlineEnd: '6px', top: '50%', transform: 'translateY(-50%)', borderRadius: 'var(--radius-full)' }}>
                      {aiLoading ? <span className="spinner" style={{ borderTopColor: 'var(--text-on-primary)' }} /> : <svg data-element-name="רכיב_page_16" className="icon"><use href="#i-star" /></svg>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          <div className="card card-pad" style={{ width: '100%', maxWidth: '760px' }}>
            <div className="card-title-row" style={{ marginBottom: '18px', fontSize: '19px', fontWeight: 800, color: 'var(--primary)' }}>
              <svg data-element-name="רכיב_page_17" className="icon" style={{ width: '22px', height: '22px' }}><use href="#i-calendar" /></svg>
              מתי האירוע שלכם?
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <HebrewDatePicker data-element-name="רכיב_page_18"
                selectedDate={selectedDate}
                onChange={(d) => { setSelectedDate(new Date(d)); setStage(2); }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_19"
                data-agy-id="show_inventory_btn"
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setStage(2)}
              >
                הצג מלאי
                <svg data-element-name="רכיב_page_20" className="icon"><use href="#i-star" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: Inventory Grid */}
      {stage === 2 && (
        <div>
          <div className="card card-pad" style={{ marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <h2 style={{ margin: 0 }}>קטלוג שמלות זמינות</h2>
                <div className="kiosk-actions">
                  <button data-element-name="כפתור_page_21" data-agy-id="exit_to_system_btn" type="button" className="btn btn-secondary btn-icon-only"
                    onClick={() => { if (isLocked) { setUnlockIntent('unlock'); setShowUnlockModal(true); return; } router.push('/'); }} title="חזור למערכת">
                    <svg data-element-name="רכיב_page_22" className="icon"><use href="#i-logout" /></svg>
                  </button>
                  <button data-element-name="כפתור_page_23" data-agy-id="new_search_btn" type="button" className="btn btn-secondary btn-icon-only" onClick={() => setStage(1)} title="חיפוש חדש">
                    <svg data-element-name="רכיב_page_24" className="icon"><use href="#i-search" /></svg>
                  </button>
                  <button data-element-name="כפתור_page_25" data-agy-id="refresh_inventory_btn" type="button" className="btn btn-secondary btn-icon-only" onClick={fetchInventory} title="רענון מלאי">
                    <svg data-element-name="רכיב_page_26" className="icon"><use href="#i-refresh" /></svg>
                  </button>
                  <button data-element-name="כפתור_page_27" data-agy-id="print_catalog_btn" type="button" className="btn btn-secondary btn-icon-only"
                    onClick={() => { if (isLocked) { setUnlockIntent('print'); setShowUnlockModal(true); return; } handleCatalogPrint(); }}
                    title={isLocked ? 'הדפסה (באישור עובד)' : 'הדפסה'}>
                    <svg data-element-name="רכיב_page_28" className="icon"><use href="#i-printer" /></svg>
                  </button>
                  {isLocked ? (
                    <button data-element-name="כפתור_page_29" data-agy-id="unlock_screen_btn" type="button" className="btn btn-danger btn-icon-only"
                      onClick={() => { setUnlockIntent('unlock'); setShowUnlockModal(true); }} title="שחרור מסך">
                      <svg data-element-name="רכיב_page_30" className="icon"><use href="#i-lock" /></svg>
                    </button>
                  ) : (
                    <button data-element-name="כפתור_page_31" data-agy-id="lock_screen_btn" type="button" className="btn btn-danger btn-icon-only" onClick={() => {
                      // The orders modal links into staff order pages — never leave it up on a locked kiosk.
                      setShowOrdersModal(false);
                      setIsLocked(true);
                      if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(err => console.warn(err));
                      }
                    }} title="תפיסת מסך ללקוח">
                      <svg data-element-name="רכיב_page_32" className="icon"><use href="#i-lock" /></svg>
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-2)', fontSize: '16px' }}>
                <svg data-element-name="רכיב_page_33" className="icon"><use href="#i-calendar" /></svg>
                לתאריך: <span className="badge badge-primary">{getHebrewDateString(new Date(selectedDate))} ({(new Date(selectedDate)).toLocaleDateString('he-IL')})</span>
              </div>
            </div>
          </div>

          {/* Toolbar: sidebar toggle + result count + AI */}
          <div className="kiosk-results-head">
            <button data-element-name="כפתור_sidebar_toggle" data-agy-id="toggle_sidebar_btn" type="button"
              className={`btn ${sidebarOpen ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSidebarOpen(o => !o)}>
              <svg data-element-name="רכיב_sidebar_toggle_icon" className="icon"><use href="#i-category" /></svg>
              סינון ותצוגה
              {(search || selectedCategories.length > 0) && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
            </button>

            <span data-agy-id="catalog_results_count" style={{ fontWeight: 700, color: 'var(--text-2)' }}>
              {displayDresses.length} דגמים · <span style={{ color: 'var(--success)' }}>{grandTotalItems} יחידות פנויות</span>
            </span>

            {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && (
              isAiChatVisible ? (
                <button data-element-name="כפתור_page_36" data-agy-id="catalog_close_ai_btn" type="button" className="ai-feature-element btn btn-secondary"
                  onClick={() => setIsAiChatVisible(false)} style={{ flex: '1 1 280px' }}>
                  <svg data-element-name="רכיב_page_37" className="icon"><use href="#i-star" /></svg>
                  העוזר החכם פעיל - לחץ לסגירה
                </button>
              ) : (
                <form onSubmit={handleAiSubmit} className="ai-feature-element" style={{ position: 'relative', flex: '1 1 240px', minWidth: '240px' }}>
                  <svg data-element-name="רכיב_page_38" className="icon" style={{ position: 'absolute', insetInlineStart: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }}><use href="#i-star" /></svg>
                  <input data-element-name="שדה_page_39"
                    data-agy-id="catalog_ai_input"
                    type="text"
                    className="input"
                    placeholder="שאל את ה-AI..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    style={{ paddingInlineStart: '46px' }}
                  />
                </form>
              ))}
          </div>

          {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && isAiChatVisible && stage === 2 && (
            <div className="ai-feature-element card card-pad" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div className="card-title-row" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                  <svg data-element-name="רכיב_page_46" className="icon"><use href="#i-star" /></svg>
                  העוזר החכם
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button data-element-name="כפתור_page_47" data-agy-id="new_ai_chat_catalog_btn" type="button" className="btn btn-ghost btn-icon-only" title="שיחה חדשה"
                    onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }))}>
                    <svg data-element-name="רכיב_page_48" className="icon"><use href="#i-plus" /></svg>
                  </button>
                  <button data-element-name="כפתור_page_49" data-agy-id="close_ai_chat_catalog_btn" type="button" className="btn btn-ghost btn-icon-only" title="סגור" onClick={() => setIsAiChatVisible(false)}>
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                </div>
              </div>

              <div className="chat-thread" style={{ marginBottom: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                {aiMessages.slice(1).map((msg, idx) => (
                  <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                    <div>
                      {msg.content.replace(/\[FILTER:(.*?)\]/g, '').replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').trim()}
                    </div>
                    {(() => {
                      const match = msg.content.match(/\[FILTER:(.*?)\]/);
                      if (match && match[1]) {
                        return (
                          <div className="quick-reply-row">
                            <button data-element-name="כפתור_page_50"
                              type="button"
                              className="quick-reply-chip"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(match[1].trim());
                              }}
                            >
                              <svg data-element-name="רכיב_page_51" className="icon"><use href="#i-search" /></svg>
                              סנן דגמים: {match[1]}
                            </button>
                          </div>
                        )
                      }
                      return null;
                    })()}
                  </div>
                ))}
                {aiLoading && (
                  <div className="bubble assistant" style={{ padding: 0 }}>
                    <div className="typing-indicator"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '10px' }}>
                <input data-element-name="שדה_page_52"
                  data-agy-id="catalog_ai_chat_input"
                  type="text"
                  className="input"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                  placeholder="מה תרצה לדעת?"
                  style={{ flex: 1 }}
                />
                <button data-element-name="כפתור_page_53" data-agy-id="catalog_ai_chat_submit_btn" type="submit" className="btn btn-primary btn-icon-only" disabled={aiLoading || !aiInput.trim()} title="שלח">
                  {aiLoading ? <span className="spinner" style={{ borderTopColor: 'var(--text-on-primary)' }} /> : <svg data-element-name="רכיב_page_54" className="icon"><use href="#i-arrow-end" /></svg>}
                </button>
              </form>
            </div>
          )}

          <div className="kiosk-body">

            {/* Sidebar: filters & display settings */}
            {sidebarOpen && (
              <aside data-agy-id="catalog_sidebar" className="kiosk-filter-panel">

                <div className="kiosk-filter-group">
                  <h4><svg className="icon"><use href="#i-search" /></svg>חיפוש</h4>
                  <input data-element-name="שדה_page_35"
                    data-agy-id="catalog_search_input"
                    type="text"
                    className="input"
                    placeholder="שם דגם, מספר, או מידה..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <div className="hint" style={{ color: 'var(--text-3)', marginTop: '8px' }}>
                    אפשר לחפש שם שמלה, מספר קטלוגי, או לכתוב "מידה 40"
                  </div>
                </div>

                {priceCategories.length > 0 && (
                  <div className="kiosk-filter-group">
                    <h4><svg className="icon"><use href="#i-tag" /></svg>קטגוריה</h4>
                    {priceCategories.map(cat => {
                      const count = categoryCounts[cat] || 0;
                      const checked = selectedCategories.includes(cat);
                      return (
                        <label key={cat} data-agy-id={`category_filter_${cat}`} className="kiosk-filter-check" style={{ opacity: count === 0 && !checked ? 0.5 : 1 }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setSelectedCategories(prev => checked ? prev.filter(c => c !== cat) : [...prev, cat])} />
                          <span>{cat}</span>
                          <span className="count">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {sizeChipOptions.length > 0 && (
                  <div className="kiosk-filter-group">
                    <h4><svg className="icon"><use href="#i-box" /></svg>סינון מהיר לפי מידה</h4>
                    <div className="kiosk-size-filter-grid">
                      {sizeChipOptions.map(sz => {
                        const term = `מידה ${sz}`;
                        const active = search.trim() === term;
                        return (
                          <div key={sz} data-agy-id={`size_chip_${sz}`}
                            className={`kiosk-size-filter-chip${active ? ' active' : ''}`}
                            onClick={() => setSearch(active ? '' : term)}>
                            <strong>{sz}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div data-element-name="לחיץ_page_45" data-agy-id="toggle_zero_sizes_div" className="checkbox-row" onClick={() => setShowZeroSizes(!showZeroSizes)}>
                  <div className={`switch${showZeroSizes ? ' on' : ''}`} />
                  הצג גם מידות ללא מלאי פנוי
                </div>

                <div className="kiosk-filter-group">
                  <h4><svg className="icon"><use href="#i-grid" /></svg>צורת תצוגה</h4>
                  <div className="kiosk-view-toggle">
                    {[
                      { key: 'grid', label: 'כרטיסים גדולים', iconId: 'i-grid', agyId: 'view_grid_btn' },
                      { key: 'rows', label: 'רשימה מפורטת', iconId: 'i-list', agyId: 'view_rows_btn' },
                      { key: 'table', label: 'טבלה קומפקטית', iconId: 'i-category', agyId: 'view_table_btn' },
                    ].map(({ key, label, iconId, agyId }) => (
                      <button key={key} data-agy-id={agyId} type="button" title={label}
                        className={viewMode === key ? 'active' : ''}
                        onClick={() => setViewMode(key)}>
                        <svg className="icon"><use href={`#${iconId}`} /></svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="slider-field">
                  <div className="slider-head"><span>גודל תצוגה</span><span className="slider-value">{Math.round(zoomLevel * 100)}%</span></div>
                  <input data-element-name="שדה_page_40"
                    data-agy-id="zoom_range_input"
                    type="range"
                    className="slider"
                    min="0.5" max="1.5" step="0.1"
                    value={zoomLevel}
                    onChange={e => setZoomLevel(parseFloat(e.target.value))}
                  />
                  <div className="slider-ticks">
                    <span>קטן</span><span>גדול</span>
                  </div>
                </div>

                {(search || selectedCategories.length > 0) && (
                  <button data-agy-id="clear_all_filters_btn" type="button" className="btn btn-danger-ghost"
                    onClick={() => { setSearch(''); setSelectedCategories([]); }}>
                    <svg className="icon"><use href="#i-x-circle" /></svg>
                    נקה את כל הסינונים
                  </button>
                )}
              </aside>
            )}

            {/* Catalog content */}
            <div style={{ minWidth: 0 }}>
              {loading ? (
                <div className="loading-inline" style={{ padding: '100px 0', fontSize: '1.1rem' }}>
                  <span className="spinner lg" />
                  טוען נתונים...
                </div>
              ) : displayDresses.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-search" /></svg>
                    <h4>לא נמצאו דגמים מתאימים</h4>
                    <p>נסו לנקות את החיפוש או את סינון הקטגוריה</p>
                    <button data-agy-id="empty_state_clear_btn" type="button" className="btn btn-primary" style={{ marginTop: '12px' }}
                      onClick={() => { setSearch(''); setSelectedCategories([]); }}>
                      נקה סינון ונסה שוב
                    </button>
                  </div>
                </div>
              ) : viewMode === 'table' ? (
                <div className="table-wrap" style={{ zoom: zoomLevel }}>
                  <table className="data">
                    <thead>
                      <tr>
                        {settings.hide_dress_images !== 'true' && <th></th>}
                        <th>שם דגם</th>
                        <th>מק״ט</th>
                        <th>קטגוריה</th>
                        <th>סה״כ פנוי</th>
                        <th>פירוט לפי מידה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDresses.map(model => {
                        const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                        const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);
                        return (
                          <tr key={model.id} onClick={() => handleModelDoubleClick(model)} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                            {settings.hide_dress_images !== 'true' && (
                              <td style={{ width: '58px' }}>
                                <div className="kiosk-img" style={{ width: '44px', height: '44px', minHeight: 0, margin: 0 }}>
                                  {model.imageUrl ? <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <svg className="icon" style={{ width: '20px', height: '20px' }}><use href="#i-image" /></svg>}
                                </div>
                              </td>
                            )}
                            <td className="cell-primary">{model.name}</td>
                            <td className="cell-muted">{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}</td>
                            <td>
                              {model.priceCategory ? <span className="badge badge-neutral">{model.priceCategory}</span> : '—'}
                            </td>
                            <td style={{ fontWeight: 800, color: totalAvailable > 0 ? 'var(--success)' : 'var(--danger)' }}>{totalAvailable}/{totalUnits}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {visibleSizesArr.length === 0 ? (
                                  <span className="hint" style={{ color: 'var(--text-3)' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי'}</span>
                                ) : visibleSizesArr.map(([sName, sData]) => (
                                  <span key={sName}
                                    className={`kiosk-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                    onClick={(e) => { e.stopPropagation(); handleModelDoubleClick(model, sName); }}
                                    title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                    style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                                    {sName} · {sData.available}/{sData.total}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === 'rows' ? (
                <div style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div data-element-name="לחיץ_page_56" key={model.id} className="list-card" style={{ cursor: isLocked ? 'default' : 'pointer', alignItems: 'stretch' }}
                        onClick={() => handleModelDoubleClick(model)}>
                        <div className="kiosk-img" style={{ width: '96px', height: '96px', minHeight: 0, flexShrink: 0, margin: 0 }}>
                          {settings.hide_dress_images !== 'true' ? (
                            model.imageUrl ? (
                              <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                            ) : (
                              <svg data-element-name="רכיב_page_57" className="icon"><use href="#i-image" /></svg>
                            )
                          ) : (
                            <span className="hint" style={{ color: 'var(--text-3)', fontSize: '11px' }}>אין תמונה</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {model.name}
                            {model.barcodePrefix && <span className="badge badge-neutral">#{model.barcodePrefix}</span>}
                            {model.priceCategory && model.priceCategory !== 'כללי' && <span className="badge badge-primary">{model.priceCategory}</span>}
                          </h3>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontWeight: 700, color: totalAvailable > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            <svg className="icon"><use href={totalAvailable > 0 ? '#i-check-circle' : '#i-alert-tri'} /></svg>
                            {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות מתוך ${totalUnits}` : 'אין יחידות פנויות לתאריך זה'}
                          </div>

                          <div className="kiosk-size-row">
                            {visibleSizesArr.length === 0 ? (
                              <span className="hint" style={{ color: 'var(--text-3)' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>
                            ) : (
                              visibleSizesArr.map(([sName, sData]) => (
                                <span
                                  key={sName}
                                  className={`kiosk-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                  title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModelDoubleClick(model, sName);
                                  }}
                                  style={{ cursor: isLocked ? 'default' : 'pointer' }}
                                >
                                  {sName} · {sData.available}/{sData.total}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="kiosk-grid" style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div data-element-name="לחיץ_page_56b" key={model.id} className="kiosk-card" style={{ cursor: isLocked ? 'default' : 'pointer' }} onClick={() => {
                        handleModelDoubleClick(model);
                      }}>
                        <div className="kiosk-img">
                          {settings.hide_dress_images !== 'true' ? (
                            model.imageUrl ? (
                              <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                            ) : (
                              <svg data-element-name="רכיב_page_57b" className="icon"><use href="#i-image" /></svg>
                            )
                          ) : (
                            <span className="hint" style={{ color: 'var(--text-3)' }}>אין תמונה</span>
                          )}
                        </div>

                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {model.name}
                          {model.priceCategory && model.priceCategory !== 'כללי' && <span className="badge badge-primary">{model.priceCategory}</span>}
                        </h3>
                        <div className="kiosk-code">{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}{model.priceCategory ? ` · ${model.priceCategory}` : ''}</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: totalAvailable > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginBottom: '12px' }}>
                          <svg className="icon"><use href={totalAvailable > 0 ? '#i-check-circle' : '#i-alert-tri'} /></svg>
                          {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות מתוך ${totalUnits}` : 'אין יחידות פנויות לתאריך זה'}
                        </div>

                        <div className="kiosk-size-row">
                          {visibleSizesArr.length === 0 ? (
                            <span className="hint" style={{ color: 'var(--text-3)' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>
                          ) : (
                            visibleSizesArr.map(([sName, sData]) => (
                              <span
                                key={sName}
                                className={`kiosk-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelDoubleClick(model, sName);
                                }}
                                style={{ cursor: isLocked ? 'default' : 'pointer' }}
                              >
                                {sName} · {sData.available}/{sData.total}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals from old interface */}
      {showUnlockModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleUnlock} autoComplete="off" className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-lock" /></svg>
                {unlockIntent === 'print' ? 'אישור עובד להדפסה' : 'שחרור מסך מנעילה'}
              </strong>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>בחר עובד:</label>
                <select data-element-name="בחירה_page_58" data-agy-id="unlock_employee_select" className="select" value={unlockEmployee} onChange={e => setUnlockEmployee(e.target.value)}>
                  <option value="">-- בחר --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>קוד גישה:</label>
                <div className="password-field">
                  <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                  <input data-element-name="שדה_page_59" data-agy-id="unlock_password_input" type="password" autoComplete="off" className="input"
                    value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                </div>
              </div>
              {unlockError && <div className="error-text" style={{ color: 'var(--danger)', textAlign: 'center' }}>{unlockError}</div>}
            </div>
            <div className="modal-foot">
              <button data-element-name="כפתור_page_60" data-agy-id="cancel_unlock_btn" type="button" className="btn btn-secondary"
                onClick={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); }}>ביטול</button>
              <button data-element-name="כפתור_page_61" data-agy-id="submit_unlock_btn" type="submit" className="btn btn-primary" disabled={unlockLoading}>
                {unlockLoading ? 'בודק...' : (unlockIntent === 'print' ? 'אשר והדפס' : 'שחרר')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showOrdersModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="modal" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-bag" /></svg>
                הזמנות - {ordersModalModel?.name} {ordersModalSize ? `(מידה ${ordersModalSize})` : ''}
              </strong>
              <button data-element-name="כפתור_page_62" data-agy-id="close_orders_modal_btn" type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setShowOrdersModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flexGrow: 1 }}>
              <div className="hint" style={{ color: 'var(--text-3)', marginBottom: '14px' }}>טווח: שבוע לפני ואחרי תאריך האירוע</div>
              {ordersModalLoading ? (
                <div className="loading-inline"><span className="spinner" />טוען נתונים...</div>
              ) : ordersModalOrders.length === 0 ? (
                <div className="hint" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '30px 0' }}>לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.</div>
              ) : (
                <div>
                  {ordersModalOrders.map(order => (
                    <div key={order.orderId} className="list-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>
                          הזמנה #{order.orderId} - {order.customer?.firstName} {order.customer?.lastName}
                        </div>
                        <div className="hint" style={{ color: 'var(--text-3)' }}>
                          תאריך אירוע: {new Date(order.eventDate).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      <span className={`badge ${order.status === 'סגור' ? 'badge-neutral' : 'badge-primary'}`}>
                        {order.status || 'פעיל'}
                      </span>
                      <a
                        href={`/orders/${order.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="פתח הזמנה"
                        className="btn btn-secondary btn-icon-only"
                      >
                        <svg data-element-name="רכיב_page_63" className="icon"><use href="#i-link" /></svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
