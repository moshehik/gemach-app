'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { RefreshCw, Printer, Lock, Maximize, Shirt, Sparkles, Tag, Search, Calendar, Loader2, LogOut, Plus, Send, ExternalLink, LayoutGrid, List, SlidersHorizontal, Table2, CheckCircle2, AlertTriangle, Ruler, ZoomIn, Eraser } from 'lucide-react';
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
    <div data-agy-id="customer_inventory_main_container" className="layout-container kiosk-glass" style={{ minHeight: '100vh', position: 'relative', direction: 'rtl', width: '100%', maxWidth: '100%', margin: 0, boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-main); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* ===== Kiosk "soft glass" skin — scoped to this screen only =====
           Overrides the app's theme variables inside this container, so every
           existing var(--card-bg)/var(--primary-color)/... on this page adopts
           the glass palette without touching each inline style. */
        .kiosk-glass {
          --bg-color: transparent;
          --card-bg: rgba(255, 255, 255, 0.60);
          --element-bg: rgba(255, 255, 255, 0.45);
          --input-bg: rgba(255, 255, 255, 0.70);
          --border-main: rgba(255, 255, 255, 0.75);
          --border-color: rgba(124, 108, 240, 0.20);
          --element-border: rgba(255, 255, 255, 0.75);
          --primary-color: #7c6cf0;
          --primary-hover: #6455e0;
          --primary-light: rgba(124, 108, 240, 0.14);
          --accent-color: #a855f7;
          --gradient-primary: linear-gradient(135deg, #7c6cf0, #a855f7);
          --text-main: #1e293b;
          --text-secondary: #64748b;
          --text-muted: #64748b;
          --empty-bg: rgba(255, 255, 255, 0.50);
          --danger-bg: rgba(254, 226, 226, 0.85);
          --danger-text: #b91c1c;
          --success-bg: rgba(220, 252, 231, 0.85);
          --success-text: #15803d;
          --banner-rentals-border: rgba(254, 243, 199, 0.9);
          font-family: 'Assistant', system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(circle at 15% 10%, #c7d2fe 0%, transparent 45%),
            radial-gradient(circle at 85% 20%, #fbcfe8 0%, transparent 40%),
            radial-gradient(circle at 50% 90%, #a5f3fc 0%, transparent 45%),
            #eef2ff;
          background-attachment: fixed;
        }

        [data-theme="dark"] .kiosk-glass {
          --card-bg: rgba(30, 32, 46, 0.62);
          --element-bg: rgba(255, 255, 255, 0.07);
          --input-bg: rgba(255, 255, 255, 0.08);
          --border-main: rgba(255, 255, 255, 0.14);
          --element-border: rgba(255, 255, 255, 0.14);
          --primary-color: #a78bfa;
          --primary-hover: #8b6df0;
          --primary-light: rgba(167, 139, 250, 0.20);
          --text-main: #f1f5f9;
          --text-secondary: #a5b0c5;
          --text-muted: #a5b0c5;
          --empty-bg: rgba(255, 255, 255, 0.07);
          --danger-bg: rgba(127, 29, 29, 0.55);
          --danger-text: #fca5a5;
          --success-bg: rgba(20, 83, 45, 0.55);
          --success-text: #86efac;
          background:
            radial-gradient(circle at 20% 15%, #312e81 0%, transparent 45%),
            radial-gradient(circle at 85% 20%, #4a1d4f 0%, transparent 42%),
            radial-gradient(circle at 55% 90%, #0e4f5e 0%, transparent 45%),
            #0b1020;
        }

        /* Frost every surface that sits on the gradient */
        .kiosk-glass .dress-card,
        .kiosk-glass [data-agy-id="catalog_sidebar"],
        .kiosk-glass .glass-panel,
        .kiosk-glass table {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        /* Display serif for headings, per the chosen design */
        .kiosk-glass h1,
        .kiosk-glass h2,
        .kiosk-glass h3,
        .kiosk-glass .dress-title {
          font-family: 'Frank Ruhl Libre', 'Assistant', serif;
        }

        /* The catalog title ships a hardcoded near-black gradient that is
           invisible on the dark skin — retune it to the glass palette. */
        .kiosk-glass h2 {
          background: var(--gradient-primary) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
        }

        .kiosk-glass .dress-card { border-color: rgba(255, 255, 255, 0.75); }
        [data-theme="dark"] .kiosk-glass .dress-card { border-color: rgba(255, 255, 255, 0.14); }
        .kiosk-glass .dress-card:hover { box-shadow: 0 20px 40px rgba(99, 102, 241, 0.18); }

        /* Glassmorphism Classes */
        .glass-panel {
          background: var(--card-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
        }
        
        .header-btn {
          background: var(--card-bg);
          border: 1px solid rgba(200, 200, 200, 0.4);
          border-radius: 14px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .header-btn:hover {
          background: var(--card-bg);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          color: var(--primary-color);
        }
        .header-btn:active { transform: scale(0.95); }

        /* Stage 1: Hero Search */
        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          text-align: center;
          animation: float 6s ease-in-out infinite;
        }

        .ai-search-container {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .ai-search-input {
          width: 100%;
          padding: 24px 32px;
          font-size: 1.25rem;
          border-radius: 999px;
          border: 2px solid transparent;
          background: var(--card-bg);
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          outline: none;
          transition: all 0.3s;
          padding-right: 70px;
        }
        .ai-search-input:focus {
          border-color: #a855f7;
          box-shadow: 0 10px 40px rgba(168, 85, 247, 0.2);
        }
        
        .ai-search-btn {
          position: absolute;
          right: 12px;
          top: 12px;
          bottom: 12px;
          background: var(--gradient-primary);
          color: white;
          border: none;
          border-radius: 999px;
          width: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .ai-search-btn:hover {
          transform: scale(1.05);
        }

        /* Stage 2: Results Grid */
        .modern-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          padding: 24px 0;
        }

        .modern-rows {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px 0;
        }
        
        .dress-card {
          background: var(--card-bg);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
          border: 1px solid var(--border-main);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .modern-rows .dress-card {
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        .dress-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: var(--primary-light);
        }
        .modern-rows .dress-card:hover {
          transform: translateY(-4px);
        }
        
        .dress-image-placeholder {
          height: 160px;
          background: linear-gradient(45deg, var(--element-bg), var(--border-main));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }
        .modern-rows .dress-image-placeholder {
          width: 160px;
          height: auto;
          min-height: 120px;
          flex-shrink: 0;
        }
        
        .dress-content {
          padding: 20px;
        }
        .modern-rows .dress-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 16px 24px;
        }
        .dress-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dress-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 16px;
        }
        
        .sizes-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .size-pill {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          background: var(--element-bg);
          color: var(--text-secondary);
        }
        .size-pill.available {
          background: #dcfce7;
          color: #166534;
        }
        
        /* Layout */
        .layout-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin: 0;
          width: 100%;
          max-width: 100%;
          padding: 24px;
          box-sizing: border-box;
        }
        
        /* Calendar */
        .cal-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: center; }
        .cal-table th { color: var(--text-secondary); font-size: 13px; font-weight: 600; padding: 12px 0; }
        .cal-table td { height: 50px; cursor: pointer; border-radius: 12px; transition: all 0.2s; margin: 2px; }
        .cal-table td:hover:not(.past) { background: var(--element-bg); }
        .cal-table td.selected { background: var(--primary-color); color: white; font-weight: bold; box-shadow: 0 4px 12px var(--border-color); }
        .cal-table td.today { border: 2px solid var(--primary-color); }
        .cal-table td.past { cursor: not-allowed; opacity: 0.4; }
        .cal-table td.past:hover { background: transparent; }
        
        .model-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .model-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
        }
        
        .size-badge {
          transition: all 0.2s ease;
        }
        .size-badge:hover {
          transform: translateY(-2px);
          filter: brightness(0.95);
        }
      `}} />
      
      {/* Stage 1: Search & Date Selection */}
      {stage === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '0 24px', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 className="hero-title">מה תחפש היום?</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>הזן סגנון, מידה או פשוט בחר תאריך מהיומן</p>
          </div>

          {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && (
          <div className="ai-search-container ai-feature-element" style={{ marginBottom: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Chat History Above Input */}
            {aiMessages.length > 1 && (
              <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', color: 'var(--text-main)', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-main)', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--gradient-primary)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles data-element-name="רכיב_page_4" size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button data-element-name="כפתור_page_5" data-agy-id="new_ai_chat_btn" onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }] }))} title="שיחה חדשה" style={{ background: 'var(--element-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='var(--border-main)'; e.currentTarget.style.color='var(--primary-color)'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='var(--element-bg)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus data-element-name="רכיב_page_6" size={18} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                      <div key={idx} style={{ 
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        background: msg.role === 'user' ? 'var(--gradient-primary)' : 'var(--card-bg)',
                        color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                        padding: '14px 18px', 
                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                        maxWidth: '85%',
                        boxShadow: msg.role === 'user' ? '0 4px 15px rgba(168,85,247,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
                        border: msg.role === 'user' ? 'none' : '1px solid var(--border-main)',
                        lineHeight: '1.5'
                      }}>
                        <div>{displayContent}</div>
                        {msg.role === 'assistant' && isoDateMatch && !filterMatchStr && (
                          <button data-element-name="כפתור_page_7" 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                              setStage(2);
                            }}
                            style={{ marginTop: '12px', background: 'var(--element-bg)', color: '#ec4899', border: '1px solid #fce7f3', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(236,72,153,0.1)' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(236,72,153,0.2)'; }}
                            onMouseOut={e => { e.currentTarget.style.background='var(--element-bg)'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(236,72,153,0.1)'; }}
                          >
                            👉 הצג מלאי לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
                          </button>
                        )}
                        {msg.role === 'assistant' && filterMatchStr && (
                          <button data-element-name="כפתור_page_8" 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSearch(filterMatchStr);
                              if (isoDateMatch) {
                                setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                              }
                              setStage(2);
                            }} 
                            style={{ marginTop: '12px', background: 'var(--element-bg)', color: 'var(--primary-color)', border: '1px solid var(--border-main)', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'}
                            onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'}
                          >
                            <Search data-element-name="רכיב_page_9" size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                            סנן והצג: {filterMatchStr} {isoDateMatch ? `(לתאריך ${getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', alignSelf: 'flex-start', background: 'var(--card-bg)', padding: '16px 20px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid var(--border-main)' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                )}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: 'var(--element-bg)', padding: '8px', borderRadius: '999px', border: '1px solid var(--border-main)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input data-element-name="שדה_page_10" 
                    data-agy-id="ai_chat_input"
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לחפש?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: 'var(--text-main)' }}
                  />
                  <button data-element-name="כפתור_page_11" data-agy-id="ai_chat_submit_btn" type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send data-element-name="רכיב_page_12" size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}

            {aiMessages.length <= 1 && (
            <div style={{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <form onSubmit={handleAiSubmit} style={{ position: 'relative', flex: 1 }}>
                <input data-element-name="שדה_page_13" 
                  data-agy-id="hero_ai_search_input"
                  type="text" 
                  className="ai-search-input" 
                  placeholder="לדוגמה: שמלה שחורה מידה 12..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                  style={{ width: '100%', margin: 0 }}
                />
                <button data-element-name="כפתור_page_14" data-agy-id="hero_ai_search_btn" type="submit" className="ai-search-btn" disabled={aiLoading}>
                  {aiLoading ? <Loader2 data-element-name="רכיב_page_15" size={24} className="animate-spin" /> : <Sparkles data-element-name="רכיב_page_16" size={24} />}
                </button>
              </form>
            </div>
          )}
          </div>
          )}

          <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-main)', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              <Calendar data-element-name="רכיב_page_17" size={28} color="#a855f7" style={{ filter: 'drop-shadow(0 4px 6px rgba(168,85,247,0.2))' }} /> מתי האירוע שלכם?
            </h3>
            <div style={{ display: 'flex', gap: '16px', width: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '280px', maxWidth: '400px' }}>
                <HebrewDatePicker data-element-name="רכיב_page_18"
                  selectedDate={selectedDate}
                  onChange={(d) => { setSelectedDate(new Date(d)); setStage(2); }}
                />
              </div>
              <button data-element-name="כפתור_page_19" 
                data-agy-id="show_inventory_btn"
                onClick={() => setStage(2)}
                style={{ padding: '0 36px', height: '60px', background: 'var(--gradient-primary)', color: 'white', fontSize: '1.15rem', fontWeight: 'bold', borderRadius: '16px', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(168,85,247,0.3)', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(168,85,247,0.4)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(168,85,247,0.3)'; }}
              >
                הצג מלאי <Sparkles data-element-name="רכיב_page_20" size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: Inventory Grid */}
      {stage === 2 && (
        <div className="layout-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          
          
          {/* Header Row */}
          <div style={{ 
            background: 'var(--card-bg)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '24px', 
            padding: '24px 32px', 
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), inset 0 0 0 1px var(--border-main)', 
            marginBottom: '24px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', borderBottom: '1px solid rgba(226,232,240,0.8)', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '2.2rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    קטלוג שמלות זמינות
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', padding: '6px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    <button data-element-name="כפתור_page_21" data-agy-id="exit_to_system_btn" className="header-btn" onClick={() => { if (isLocked) { setUnlockIntent('unlock'); setShowUnlockModal(true); return; } router.push('/'); }} title="חזור למערכת" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><LogOut data-element-name="רכיב_page_22" size={18} /></button>
                    <button data-element-name="כפתור_page_23" data-agy-id="new_search_btn" className="header-btn" onClick={() => setStage(1)} title="חיפוש חדש" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: 'var(--primary-color)', background: 'var(--primary-light)', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Search data-element-name="רכיב_page_24" size={18} /></button>
                    <button data-element-name="כפתור_page_25" data-agy-id="refresh_inventory_btn" className="header-btn" onClick={fetchInventory} title="רענון מלאי" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: 'var(--success-text)', background: 'var(--success-bg)', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><RefreshCw data-element-name="רכיב_page_26" size={18} /></button>
                    <button data-element-name="כפתור_page_27" data-agy-id="print_catalog_btn" className="header-btn" onClick={() => { if (isLocked) { setUnlockIntent('print'); setShowUnlockModal(true); return; } handleCatalogPrint(); }} title={isLocked ? 'הדפסה (באישור עובד)' : 'הדפסה'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: 'var(--accent-color)', background: 'var(--empty-bg)', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Printer data-element-name="רכיב_page_28" size={18} /></button>
                    {isLocked ? (
                      <button data-element-name="כפתור_page_29" data-agy-id="unlock_screen_btn" className="header-btn" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }} onClick={() => { setUnlockIntent('unlock'); setShowUnlockModal(true); }} title="שחרור מסך"><Lock data-element-name="רכיב_page_30" size={18} /></button>
                    ) : (
                      <button data-element-name="כפתור_page_31" data-agy-id="lock_screen_btn" className="header-btn" onClick={() => {
                        // The orders modal links into staff order pages — never leave it up on a locked kiosk.
                        setShowOrdersModal(false);
                        setIsLocked(true);
                        if (document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch(err => console.warn(err));
                        }
                      }} title="תפיסת מסך ללקוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: 'var(--warning-color, #f59e0b)', background: 'var(--banner-rentals-border)', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Maximize data-element-name="רכיב_page_32" size={18} /></button>
                    )}
                  </div>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar data-element-name="רכיב_page_33" size={20} color="#94a3b8" />
                  לתאריך: <strong style={{ color: 'var(--primary-color)', background: 'var(--primary-light)', padding: '4px 12px', borderRadius: '999px', fontSize: '1rem' }}>{getHebrewDateString(new Date(selectedDate))}</strong> <span style={{opacity: 0.7}}>({(new Date(selectedDate)).toLocaleDateString('he-IL')})</span>
                </div>
              </div>
              
              
            </div>

            {/* Toolbar: sidebar toggle + result count + AI */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <button data-element-name="כפתור_sidebar_toggle" data-agy-id="toggle_sidebar_btn"
                onClick={() => setSidebarOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 22px', borderRadius: '16px', border: `1px solid ${(search || selectedCategories.length > 0) ? 'var(--primary-color)' : 'var(--border-main)'}`, background: sidebarOpen ? 'var(--primary-light)' : 'var(--card-bg)', color: sidebarOpen ? 'var(--primary-color)' : 'var(--text-main)', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
                <SlidersHorizontal data-element-name="רכיב_sidebar_toggle_icon" size={18} />
                סינון ותצוגה
                {(search || selectedCategories.length > 0) && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)', display: 'inline-block' }} />}
              </button>

              <span data-agy-id="catalog_results_count" style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                {displayDresses.length} דגמים · <span style={{ color: 'var(--success-text, #16a34a)' }}>{grandTotalItems} יחידות פנויות</span>
              </span>

              {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && (
                isAiChatVisible ? (
                  <div style={{ position: 'relative', flex: '1 1 280px', display: 'flex', alignItems: 'center' }} className="ai-feature-element">
                  <button data-element-name="כפתור_page_36" data-agy-id="catalog_close_ai_btn" onClick={() => setIsAiChatVisible(false)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-main)', background: 'var(--card-bg)', color: '#a855f7', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s' }}>
                    <Sparkles data-element-name="רכיב_page_37" size={20} />
                    העוזר החכם פעיל - לחץ לסגירה
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', flex: '1 1 280px' }} className="ai-feature-element">
                  <form onSubmit={handleAiSubmit} style={{ margin: 0, width: '100%' }}>
                    <Sparkles data-element-name="רכיב_page_38" size={20} color="#a855f7" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input data-element-name="שדה_page_39" 
                      data-agy-id="catalog_ai_input"
                      type="text" 
                      placeholder="שאל את ה-AI..."
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '2px solid transparent', background: 'var(--element-bg)', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s' }}
                      onFocus={e => { e.currentTarget.style.background='var(--card-bg)'; e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.1)'; }}
                      onBlur={e => { if(!aiInput) { e.currentTarget.style.background = 'var(--element-bg)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                    />
                  </form>
                </div>
              ))}

            </div>
          </div>
          
          {settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true' && isAiChatVisible && stage === 2 && (
            <div className="ai-feature-element" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', marginTop: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--gradient-primary)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles data-element-name="רכיב_page_46" size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button data-element-name="כפתור_page_47" data-agy-id="new_ai_chat_catalog_btn" onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }))} title="שיחה חדשה" style={{ background: 'var(--element-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='var(--border-main)'; e.currentTarget.style.color='var(--primary-color)'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='var(--element-bg)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus data-element-name="רכיב_page_48" size={18} /></button>
                    <button data-element-name="כפתור_page_49" data-agy-id="close_ai_chat_catalog_btn" onClick={() => setIsAiChatVisible(false)} title="סגור" style={{ background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', fontWeight: 'bold' }} onMouseOver={e => {e.currentTarget.style.background='var(--danger-text)'; e.currentTarget.style.transform='scale(1.1)';}} onMouseOut={e => {e.currentTarget.style.background='var(--danger-bg)'; e.currentTarget.style.transform='scale(1)';}}>X</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? 'var(--gradient-primary)' : 'var(--card-bg)',
                      color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                      padding: '14px 18px', 
                      borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                      maxWidth: '85%',
                      boxShadow: msg.role === 'user' ? '0 4px 15px rgba(168,85,247,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-main)',
                      lineHeight: '1.5'
                    }}>
                      <div>
                        {msg.content.replace(/\[FILTER:(.*?)\]/g, '').replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').trim()}
                      </div>
                      {(() => {
                        const match = msg.content.match(/\[FILTER:(.*?)\]/);
                        if (match && match[1]) {
                          return (
                            <button data-element-name="כפתור_page_50" 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(match[1].trim());
                                e.currentTarget.style.transform = 'scale(0.95)';
                                setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1)'; }, 150);
                              }} 
                              style={{ marginTop: '12px', background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--element-bg)', border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--border-main)', color: msg.role === 'user' ? 'white' : 'var(--primary-color)', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                              onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'}
                              onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'}
                            >
                              <Search data-element-name="רכיב_page_51" size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                              סנן דגמים: {match[1]}
                            </button>
                          )
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', alignSelf: 'flex-start', background: 'var(--card-bg)', padding: '16px 20px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid var(--border-main)' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                )}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: 'var(--element-bg)', padding: '8px', borderRadius: '999px', border: '1px solid var(--border-main)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input data-element-name="שדה_page_52" 
                    data-agy-id="catalog_ai_chat_input"
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לדעת?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: 'var(--text-main)' }}
                  />
                  <button data-element-name="כפתור_page_53" data-agy-id="catalog_ai_chat_submit_btn" type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send data-element-name="רכיב_page_54" size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>

            {/* Sidebar: filters & display settings */}
            {sidebarOpen && (
              <aside data-agy-id="catalog_sidebar" style={{ flex: '0 1 290px', minWidth: '250px', position: 'sticky', top: '16px', background: 'var(--card-bg)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid var(--border-main)', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '26px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '800', color: 'var(--text-main)' }}>
                    <Search size={16} style={{ color: 'var(--primary-color)' }} /> חיפוש
                  </div>
                  <input data-element-name="שדה_page_35"
                    data-agy-id="catalog_search_input"
                    type="text"
                    placeholder="שם דגם, מספר, או מידה..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', border: '1px solid var(--border-main)', background: 'var(--element-bg)', fontSize: '1rem', outline: 'none', color: 'var(--text-main)' }}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                    אפשר לחפש שם שמלה, מספר קטלוגי, או לכתוב "מידה 40"
                  </div>
                </div>

                {priceCategories.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '800', color: 'var(--text-main)' }}>
                      <Tag size={16} style={{ color: 'var(--primary-color)' }} /> קטגוריה
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {priceCategories.map(cat => {
                        const count = categoryCounts[cat] || 0;
                        const checked = selectedCategories.includes(cat);
                        return (
                          <label key={cat} data-agy-id={`category_filter_${cat}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '10px', cursor: 'pointer', opacity: count === 0 && !checked ? 0.5 : 1, background: checked ? 'var(--primary-light)' : 'transparent' }}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setSelectedCategories(prev => checked ? prev.filter(c => c !== cat) : [...prev, cat])}
                              style={{ width: '17px', height: '17px', accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{cat}</span>
                            <span style={{ marginInlineStart: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--element-bg)', padding: '2px 8px', borderRadius: '999px' }}>{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sizeChipOptions.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '800', color: 'var(--text-main)' }}>
                      <Ruler size={16} style={{ color: 'var(--primary-color)' }} /> סינון מהיר לפי מידה
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {sizeChipOptions.map(sz => {
                        const term = `מידה ${sz}`;
                        const active = search.trim() === term;
                        return (
                          <button key={sz} data-agy-id={`size_chip_${sz}`}
                            onClick={() => setSearch(active ? '' : term)}
                            style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--border-main)', background: active ? 'var(--primary-color)' : 'var(--element-bg)', color: active ? 'white' : 'var(--text-main)', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', minWidth: '44px' }}>
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div data-element-name="לחיץ_page_45" data-agy-id="toggle_zero_sizes_div" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowZeroSizes(!showZeroSizes)}>
                  <div style={{ width: '42px', height: '23px', flexShrink: 0, background: showZeroSizes ? 'var(--primary-color)' : 'var(--element-bg)', borderRadius: '999px', position: 'relative', transition: 'background 0.3s', border: '1px solid var(--border-main)' }}>
                    <div style={{ width: '17px', height: '17px', background: 'var(--card-bg)', borderRadius: '50%', position: 'absolute', top: '2px', left: showZeroSizes ? '21px' : '2px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: '600', color: showZeroSizes ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                    הצג גם מידות ללא מלאי פנוי
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '800', color: 'var(--text-main)' }}>
                    <LayoutGrid size={16} style={{ color: 'var(--primary-color)' }} /> צורת תצוגה
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {[
                      { key: 'grid', label: 'כרטיסים גדולים', Icon: LayoutGrid, agyId: 'view_grid_btn' },
                      { key: 'rows', label: 'רשימה מפורטת', Icon: List, agyId: 'view_rows_btn' },
                      { key: 'table', label: 'טבלה קומפקטית', Icon: Table2, agyId: 'view_table_btn' },
                    ].map(({ key, label, Icon, agyId }) => (
                      <button key={key} data-agy-id={agyId}
                        onClick={() => setViewMode(key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '14px', border: `1px solid ${viewMode === key ? 'var(--primary-color)' : 'var(--border-main)'}`, background: viewMode === key ? 'var(--primary-light)' : 'var(--element-bg)', color: viewMode === key ? 'var(--primary-color)' : 'var(--text-main)', fontSize: '0.92rem', fontWeight: viewMode === key ? '800' : '500', cursor: 'pointer', textAlign: 'right', transition: 'all 0.15s' }}>
                        <Icon size={18} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '800', color: 'var(--text-main)' }}>
                    <ZoomIn size={16} style={{ color: 'var(--primary-color)' }} /> גודל תצוגה
                  </div>
                  <input data-element-name="שדה_page_40"
                    data-agy-id="zoom_range_input"
                    type="range"
                    min="0.5" max="1.5" step="0.1"
                    value={zoomLevel}
                    onChange={e => setZoomLevel(parseFloat(e.target.value))}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary-color)', width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>קטן</span><span>גדול</span>
                  </div>
                </div>

                {(search || selectedCategories.length > 0) && (
                  <button data-agy-id="clear_all_filters_btn"
                    onClick={() => { setSearch(''); setSelectedCategories([]); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', border: 'none', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>
                    <Eraser size={16} /> נקה את כל הסינונים
                  </button>
                )}
              </aside>
            )}

            {/* Catalog content */}
            <div style={{ flex: '1 1 400px', minWidth: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
                  <Loader2 data-element-name="רכיב_page_55" size={48} className="animate-spin" style={{ color: 'var(--primary-color)', marginBottom: '16px' }} />
                  <span style={{ fontSize: '1.2rem' }}>טוען נתונים...</span>
                </div>
              ) : displayDresses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border-main)' }}>
                  <Shirt size={52} style={{ color: 'var(--text-secondary)', opacity: 0.4, marginBottom: '16px' }} />
                  <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>לא נמצאו דגמים מתאימים</h3>
                  <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)' }}>נסו לנקות את החיפוש או את סינון הקטגוריה</p>
                  <button data-agy-id="empty_state_clear_btn" onClick={() => { setSearch(''); setSelectedCategories([]); }}
                    style={{ padding: '12px 28px', borderRadius: '999px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                    נקה סינון ונסה שוב
                  </button>
                </div>
              ) : viewMode === 'table' ? (
                <div style={{ zoom: zoomLevel, background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-main)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                      <tr>
                        {settings.hide_dress_images !== 'true' && <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}></th>}
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}>שם דגם</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}>מק״ט</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}>קטגוריה</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}>סה״כ פנוי</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-main)', fontSize: '0.85rem' }}>פירוט לפי מידה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDresses.map(model => {
                        const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                        const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);
                        return (
                          <tr key={model.id} onClick={() => handleModelDoubleClick(model)} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                            {settings.hide_dress_images !== 'true' && (
                              <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-main)', width: '58px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', background: 'var(--element-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {model.imageUrl ? <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Shirt size={22} opacity={0.4} />}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-main)', fontWeight: '700', color: 'var(--text-main)' }}>{model.name}</td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}</td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-main)' }}>
                              {model.priceCategory ? <span style={{ fontSize: '0.78rem', background: 'var(--element-bg)', padding: '3px 10px', borderRadius: '999px', color: 'var(--text-secondary)' }}>{model.priceCategory}</span> : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-main)', fontWeight: '800', color: totalAvailable > 0 ? '#16a34a' : 'var(--danger-text)' }}>{totalAvailable}/{totalUnits}</td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-main)' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {visibleSizesArr.length === 0 ? (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי'}</span>
                                ) : visibleSizesArr.map(([sName, sData]) => (
                                  <span key={sName}
                                    onClick={(e) => { e.stopPropagation(); handleModelDoubleClick(model, sName); }}
                                    title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                    style={{ cursor: isLocked ? 'default' : 'pointer', fontSize: '0.8rem', padding: '3px 9px', borderRadius: '999px', background: sData.available > 0 ? '#dcfce7' : 'var(--element-bg)', color: sData.available > 0 ? '#166534' : 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap' }}>
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
              ) : (
                <div className={`modern-${viewMode}`} style={{ zoom: zoomLevel, padding: 0 }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div data-element-name="לחיץ_page_56" key={model.id} className="dress-card" style={{ cursor: isLocked ? 'default' : 'pointer' }} onClick={() => {
                        handleModelDoubleClick(model);
                      }}>
                        <div className="dress-image-placeholder">
                          {settings.hide_dress_images !== 'true' ? (
                            model.imageUrl ? (
                              <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Shirt data-element-name="רכיב_page_57" size={48} opacity={0.5} />
                            )
                          ) : (
                            <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>אין תמונה</div>
                          )}
                        </div>
                        <div className="dress-content">
                          <div className="dress-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--text-main)' }}>{model.name}</span>
                            {model.barcodePrefix && <span style={{ fontSize: '0.85rem', background: 'var(--element-bg)', padding: '4px 10px', borderRadius: '999px', color: 'var(--text-secondary)', fontWeight: '600' }}>#{model.barcodePrefix}</span>}
                            {model.priceCategory && model.priceCategory !== 'כללי' && <span style={{ fontSize: '0.75rem', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: '999px', color: 'var(--primary-color)', fontWeight: '700' }}>{model.priceCategory}</span>}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px', fontSize: '0.95rem', fontWeight: '800', color: totalAvailable > 0 ? '#16a34a' : 'var(--danger-text)' }}>
                            {totalAvailable > 0 ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                            {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות מתוך ${totalUnits}` : 'אין יחידות פנויות לתאריך זה'}
                          </div>

                          <div className="sizes-row">
                            {visibleSizesArr.length === 0 ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>
                            ) : (
                              visibleSizesArr.map(([sName, sData]) => (
                                <div
                                  key={sName}
                                  className={`size-pill ${sData.available > 0 ? 'available' : ''}`}
                                  title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModelDoubleClick(model, sName);
                                  }}
                                  style={{ cursor: isLocked ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 6px 6px 12px' }}
                                >
                                  <span style={{ fontSize: '1.25rem', fontWeight: '900', color: sData.available > 0 ? '#14532d' : 'var(--text-muted)', whiteSpace: 'nowrap', display: 'inline-block' }}>{sName}</span>
                                  <span style={{ whiteSpace: 'nowrap', fontWeight: '700', fontSize: '0.78rem', background: sData.available > 0 ? '#bbf7d0' : 'var(--border-main)', color: sData.available > 0 ? '#166534' : 'var(--text-muted)', padding: '3px 9px', borderRadius: '10px' }}>
                                    פנוי {sData.available} מתוך {sData.total}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleUnlock} autoComplete="off" style={{ background: 'var(--card-bg)', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', textAlign: 'center', color: 'var(--text-main)' }}>{unlockIntent === 'print' ? 'אישור עובד להדפסה' : 'שחרור מסך מנעילה'}</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>בחר עובד:</label>
              <select data-element-name="בחירה_page_58" data-agy-id="unlock_employee_select" value={unlockEmployee} onChange={e => setUnlockEmployee(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-main)', background: 'var(--element-bg)', color: 'var(--text-main)' }}>
                <option value="">-- בחר --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>קוד גישה:</label>
              <input data-element-name="שדה_page_59" data-agy-id="unlock_password_input" type="password" autoComplete="off" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-main)', background: 'var(--element-bg)', color: 'var(--text-main)' }} />
            </div>
            {unlockError && <div style={{ color: 'var(--danger-text)', marginBottom: '16px', textAlign: 'center' }}>{unlockError}</div>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button data-element-name="כפתור_page_60" data-agy-id="cancel_unlock_btn" type="button" onClick={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); }} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-main)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer' }}>ביטול</button>
              <button data-element-name="כפתור_page_61" data-agy-id="submit_unlock_btn" type="submit" disabled={unlockLoading} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                {unlockLoading ? 'בודק...' : (unlockIntent === 'print' ? 'אשר והדפס' : 'שחרר')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showOrdersModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px', width: '600px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--element-bg)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: 'bold' }}>
                  הזמנות - {ordersModalModel?.name} {ordersModalSize ? `(מידה ${ordersModalSize})` : ''}
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>טווח: שבוע לפני ואחרי תאריך האירוע</span>
              </div>
              <button data-element-name="כפתור_page_62" data-agy-id="close_orders_modal_btn" onClick={() => setShowOrdersModal(false)} style={{ background: 'var(--border-main)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>X</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
              {ordersModalLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>טוען נתונים...</div>
              ) : ordersModalOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ordersModalOrders.map(order => (
                    <div key={order.orderId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-main)', borderRadius: '16px', background: 'var(--card-bg)' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-main)' }}>
                          הזמנה #{order.orderId} - {order.customer?.firstName} {order.customer?.lastName}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          תאריך אירוע: {new Date(order.eventDate).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: order.status === 'סגור' ? 'var(--element-bg)' : 'var(--primary-light)', color: order.status === 'סגור' ? 'var(--text-muted)' : '#1e40af', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                          {order.status || 'פעיל'}
                        </div>
                        <a 
                          href={`/orders/${order.orderId}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="פתח הזמנה"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '12px', border: '1px solid var(--primary-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          <ExternalLink data-element-name="רכיב_page_63" size={18} />
                        </a>
                      </div>
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
