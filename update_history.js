const fs = require('fs');

const inputFile = 'c:/Users/moshe/Desktop/גמח שמלות חדש/gemach-app/components/HistoryViewer.js';
let content = fs.readFileSync(inputFile, 'utf-8');

// The rewrite logic:
// We want to insert state variables and modify fetchLogs.
// We also want to add the AI Chat UI.

let newContent = content.replace(
  `  const [isExpanded, setIsExpanded] = useState(true);`,
  `  const [isExpanded, setIsExpanded] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // AI Chat Search
  const [chatQuery, setChatQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  
  const resetFilters = () => {
    setFilterAction('');
    setFilterStartDate('');
    setFilterEndDate('');
    setChatQuery('');
    setAiMessage(null);
    // Let the useEffect handle the refetch
  };
`
);

newContent = newContent.replace(
  `import { ChevronDown, ChevronUp } from 'lucide-react';`,
  `import { ChevronDown, ChevronUp, Search, Filter, MessageSquare, Loader2, X } from 'lucide-react';`
);

// Update fetchLogs
newContent = newContent.replace(
  /useEffect\(\(\) => \{\s+async function fetchLogs\(\) \{[\s\S]*?fetchLogs\(\);\s+\}, \[entityType, entityId\]\);/,
  `const fetchLogs = async (customFilters = null) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      
      const targetEntityType = customFilters?.entityType !== undefined ? customFilters.entityType : entityType;
      const targetAction = customFilters?.action !== undefined ? customFilters.action : filterAction;
      const targetStartDate = customFilters?.startDate !== undefined ? customFilters.startDate : filterStartDate;
      const targetEndDate = customFilters?.endDate !== undefined ? customFilters.endDate : filterEndDate;
      const targetSearch = customFilters?.search !== undefined ? customFilters.search : '';

      if (targetEntityType) query.append('entityType', targetEntityType);
      if (entityId) query.append('entityId', entityId);
      if (targetAction) query.append('action', targetAction);
      if (targetStartDate) query.append('startDate', targetStartDate);
      if (targetEndDate) query.append('endDate', targetEndDate);
      if (targetSearch) query.append('search', targetSearch);
      
      const res = await fetch(\`/api/audit?\${query.toString()}\`);
      if (!res.ok) throw new Error('Failed to fetch history');
      
      const data = await res.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityType, entityId, filterAction, filterStartDate, filterEndDate]);

  const handleSmartSearch = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/audit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatQuery })
      });
      
      if (!res.ok) throw new Error('שגיאה בחיפוש חכם');
      const filters = await res.json();
      
      setFilterAction(filters.action || '');
      setFilterStartDate(filters.startDate ? filters.startDate.split('T')[0] : '');
      setFilterEndDate(filters.endDate ? filters.endDate.split('T')[0] : '');
      
      if (filters.message) {
         setAiMessage(filters.message);
      }
      
      await fetchLogs(filters);

    } catch (err) {
      setAiMessage('מצטער, התרחשה שגיאה בהבנת הבקשה. אנא נסה שוב.');
    } finally {
      setIsAiLoading(false);
    }
  };
`
);

// Inject Chat UI and Filters UI right after the "היסטוריית שינויים" header
const headerDivRegex = /<div \s*onClick=\{\(\) => setIsExpanded\(!isExpanded\)\}[\s\S]*?<\/div>\s*<\/div>/;

const newHeaderAndFilters = `$&
      
      {isExpanded && (
        <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          
          {/* Smart AI Search */}
          <form onSubmit={handleSmartSearch} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--primary-color)' }}>
                <MessageSquare size={20} />
              </div>
              <input 
                type="text" 
                placeholder='חיפוש חכם ביומן... לדוגמה: "מי מחק הזמנות אתמול?"' 
                value={chatQuery}
                onChange={e => setChatQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
            <button 
              type="submit" 
              disabled={isAiLoading || !chatQuery.trim()}
              style={{ background: 'var(--primary-color)', color: '#fff', padding: '0 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: isAiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isAiLoading || !chatQuery.trim() ? 0.7 : 1 }}
            >
              {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              חפש
            </button>
          </form>

          {aiMessage && (
            <div style={{ padding: '12px 16px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', marginBottom: '16px', fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <MessageSquare size={18} style={{ marginTop: '2px' }} />
              <div>
                <strong>תשובת AI:</strong> {aiMessage}
              </div>
            </div>
          )}

          {/* Standard Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>פעולה</label>
              <select 
                value={filterAction} 
                onChange={e => setFilterAction(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
              >
                <option value="">הכל</option>
                <option value="CREATE">יצירה</option>
                <option value="UPDATE">עדכון</option>
                <option value="DELETE">מחיקה</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>מתאריך</label>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={e => setFilterStartDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>עד תאריך</label>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={e => setFilterEndDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            {(filterAction || filterStartDate || filterEndDate || chatQuery) && (
              <button 
                onClick={resetFilters}
                style={{ padding: '8px 16px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', marginLeft: 'auto' }}
              >
                <X size={16} />
                נקה סינון
              </button>
            )}
          </div>

        </div>
      )}
`;

newContent = newContent.replace(headerDivRegex, newHeaderAndFilters);

// Update outer container maxHeight
newContent = newContent.replace(
  /overflowY: isExpanded \? 'auto' : 'hidden', maxHeight: isExpanded \? '500px' : 'auto' /,
  `/* Remove fixed height so it's less squished, except when in modal it can naturally scroll if restricted externally */ `
);


fs.writeFileSync(inputFile, newContent, 'utf-8');
console.log("Updated HistoryViewer.js");
