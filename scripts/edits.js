const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../app/customer-interface/page.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Add state variables: showZeroSizes, zoomLevel
code = code.replace(
  /const \[search, setSearch\] = useState\(''\);/,
  `const [search, setSearch] = useState('');
  const [showZeroSizes, setShowZeroSizes] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);`
);

// 2. Adjust grid css to use CSS variables for zoom
code = code.replace(
  /grid-template-columns: repeat\(auto-fill, minmax\(280px, 1fr\)\);/,
  `grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-width, 280px), 1fr));`
);

// 3. Remove standalone top bar actions and put them in header
code = code.replace(
  /\{\/\* Top Bar Actions \*\/\}[\s\S]*?<\/div>(\s*)\{\/\* Stage 1: Search & Date Selection \*\/\}/,
  `{/* Stage 1: Search & Date Selection */}`
);

// Add them to the Stage 2 Header Row.
const newHeaderRow = `
          {/* Header Row */}
          <div className="glass-panel" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                קטלוג שמלות זמינות
                <button className="header-btn" onClick={() => router.push('/')} title="חזור למערכת" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0, color: '#ef4444' }}><LogOut size={18} /></button>
                <button className="header-btn" onClick={() => setStage(1)} title="חיפוש חדש" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }}><Search size={18} /></button>
                <button className="header-btn" onClick={fetchInventory} title="רענון מלאי" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }}><RefreshCw size={18} /></button>
                <button className="header-btn" onClick={() => window.print()} title="הדפסה" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }}><Printer size={18} /></button>
                {isLocked ? (
                  <button className="header-btn" style={{ background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }} onClick={() => setShowUnlockModal(true)} title="שחרור מסך"><Lock size={18} /></button>
                ) : (
                  <button className="header-btn" onClick={() => {
                    setIsLocked(true);
                    if (document.documentElement.requestFullscreen) {
                      document.documentElement.requestFullscreen().catch(err => console.warn(err));
                    }
                  }} title="תפיסת מסך ללקוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }}><Maximize size={18} /></button>
                )}
              </h2>
              <div style={{ color: '#64748b', fontSize: '1.1rem' }}>
                לתאריך: <strong style={{ color: '#3b82f6' }}>{getHebrewDateString(new Date(selectedDate))}</strong> ({(new Date(selectedDate)).toLocaleDateString('he-IL')})
              </div>
            </div>
            
            {/* Embedded Calendar Mini */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '12px 24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => setStage(1)}>
              <Calendar size={24} color="#64748b" />
              <span style={{ fontWeight: '600', color: '#475569' }}>שנה תאריך</span>
            </div>
          </div>
`;

code = code.replace(
  /\{\/\* Header Row \*\/\}[\s\S]*?שנה תאריך<\/span>\s*<\/div>\s*<\/div>/,
  newHeaderRow
);

// Add AI search, Zoom slider, Zero sizes toggle, and size search
// Replace the block under Header Row
const filterBlockOld = `<div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="חיפוש מודל חופשי (למשל: תחרה, 42)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '14px 44px 14px 14px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>
          </div>`;

const newFilterBlock = `<div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap', background: 'white', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
              <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="חיפוש מודל חופשי (למשל: תחרה, 42)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '14px 44px 14px 14px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>

            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
              <form onSubmit={handleAiSubmit} style={{ margin: 0, width: '100%' }}>
                <Sparkles size={20} color="#a855f7" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="חיפוש חכם AI..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                  style={{ width: '100%', padding: '14px 44px 14px 14px', borderRadius: '14px', border: '2px solid transparent', background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s' }}
                  onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#a855f7'; }}
                  onBlur={e => { if(!aiInput) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = 'transparent'; } }}
                />
              </form>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#475569' }}>זום</span>
              <input 
                type="range" 
                min="0.5" max="1.5" step="0.1" 
                value={zoomLevel} 
                onChange={e => setZoomLevel(parseFloat(e.target.value))} 
                style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowZeroSizes(!showZeroSizes)}>
              <div style={{ width: '48px', height: '24px', background: showZeroSizes ? '#3b82f6' : '#cbd5e1', borderRadius: '999px', position: 'relative', transition: 'background 0.3s' }}>
                <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: showZeroSizes ? '26px' : '2px', transition: 'left 0.3s' }} />
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: showZeroSizes ? '#3b82f6' : '#64748b' }}>
                הצג חסרים במלאי (0)
              </span>
            </div>
          </div>
          
          {aiMessages.length > 1 && stage === 2 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginTop: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <span><Sparkles size={18} /> העוזר החכם</span>
                  <button onClick={() => setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>נקה צ'אט</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aiMessages.slice(1).map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? '#a855f7' : '#f8fafc',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      padding: '10px 14px', borderRadius: '12px', maxWidth: '85%'
                    }}>
                      <div>{msg.content.replace(/\\[DATE:\\d{4}-\\d{2}-\\d{2}\\]/g, '').trim()}</div>
                    </div>
                  ))}
                </div>
                {aiLoading && <div style={{ textAlign: 'center', marginTop: '1rem', color: '#8b5cf6', fontSize: '0.9rem' }}>מקליד...</div>}
            </div>
          )}`;

code = code.replace(filterBlockOld, newFilterBlock);

// Replace grid filter logic
const oldFilterRegex = /\{dresses\.filter\(d => \{\s*const term = search\.toLowerCase\(\);\s*return \(d\.name \|\| ''\)\.toLowerCase\(\)\.includes\(term\) \|\| \(d\.barcodePrefix && d\.barcodePrefix\.toString\(\)\.includes\(term\)\);\s*\}\)\.map\(model => \{/g;
const newFilter = `{dresses.filter(d => {
                const term = search.toLowerCase();
                if (!term) return true;
                const matchName = (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString().includes(term));
                if (matchName) return true;
                if (d.items) {
                  return d.items.some(item => (item.sizeText || 'כללי').toLowerCase().includes(term));
                }
                return false;
              }).map(model => {`;

code = code.replace(oldFilterRegex, newFilter);

// Replace mapping to show sizes
// We need to find the sizeMap code in the mapping
const oldSizesMapBlock = `const sizeMap = new Map();
                model.items?.forEach(item => {
                  if (item.notInUse || item.isDeleted) return;
                  const st = item.sizeText || 'כללי';
                  if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
                  const info = sizeMap.get(st);
                  info.total += 1;
                  if (item.quantity > 0) info.available += item.quantity;
                });
                
                const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));`;

const newSizesMapBlock = `const sizeMap = new Map();
                model.items?.forEach(item => {
                  if (item.notInUse || item.isDeleted) return;
                  const st = item.sizeText || 'כללי';
                  if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
                  const info = sizeMap.get(st);
                  info.total += 1;
                  if (item.quantity > 0) info.available += item.quantity;
                });
                
                let sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));
                if (!showZeroSizes) {
                  sizesArray = sizesArray.filter(([sName, sData]) => sData.available > 0);
                }
                if (sizesArray.length === 0 && !showZeroSizes) return null;
`;

code = code.replace(oldSizesMapBlock, newSizesMapBlock);

// Replace <div className="modern-grid"> with zoom styling
code = code.replace(
  /<div className="modern-grid">/,
  `<div className="modern-grid" style={{ '--grid-min-width': \`\${280 * zoomLevel}px\` }}>`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Edits applied successfully');
