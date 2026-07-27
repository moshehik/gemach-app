const fs = require('fs');
const file = 'app/customer-interface/page.js';
let code = fs.readFileSync(file, 'utf8');

const oldHeader = /\{\/\* Header Row \*\/\}[\s\S]*?\{aiMessages\.length > 1 && stage === 2 && \(/;

const newHeader = `{/* Header Row */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '24px', 
            padding: '24px 32px', 
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)', 
            marginBottom: '24px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', borderBottom: '1px solid rgba(226,232,240,0.8)', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '2.2rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    קטלוג שמלות זמינות
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.6)', padding: '6px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    <button className="header-btn" onClick={() => router.push('/')} title="חזור למערכת" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#ef4444', background: '#fee2e2', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><LogOut size={18} /></button>
                    <button className="header-btn" onClick={() => setStage(1)} title="חיפוש חדש" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#3b82f6', background: '#dbeafe', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Search size={18} /></button>
                    <button className="header-btn" onClick={fetchInventory} title="רענון מלאי" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#10b981', background: '#d1fae5', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><RefreshCw size={18} /></button>
                    <button className="header-btn" onClick={() => window.print()} title="הדפסה" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#8b5cf6', background: '#ede9fe', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Printer size={18} /></button>
                    {isLocked ? (
                      <button className="header-btn" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }} onClick={() => setShowUnlockModal(true)} title="שחרור מסך"><Lock size={18} /></button>
                    ) : (
                      <button className="header-btn" onClick={() => {
                        setIsLocked(true);
                        if (document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch(err => console.warn(err));
                        }
                      }} title="תפיסת מסך ללקוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#f59e0b', background: '#fef3c7', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Maximize size={18} /></button>
                    )}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={20} color="#94a3b8" />
                  לתאריך: <strong style={{ color: '#3b82f6', background: '#eff6ff', padding: '4px 12px', borderRadius: '999px', fontSize: '1rem' }}>{getHebrewDateString(new Date(selectedDate))}</strong> <span style={{opacity: 0.7}}>({(new Date(selectedDate)).toLocaleDateString('he-IL')})</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Embedded Calendar Mini */}
                <div style={{ background: 'linear-gradient(135deg, #ffffff, #f8fafc)', borderRadius: '16px', padding: '14px 28px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.02), inset 0 2px 4px rgba(255,255,255,1)', transition: 'all 0.2s', transform: 'translateY(0)' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'} onClick={() => setStage(1)}>
                  <span style={{ fontWeight: '700', color: '#475569', fontSize: '1.05rem' }}>שינוי תאריך</span>
                  <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '12px' }}><Calendar size={18} color="#64748b" /></div>
                </div>
              </div>
            </div>

            {/* Filter Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 280px' }}>
                <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="חיפוש מודל (שם, תחרה, 42)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.8)', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.01)'; }}
                />
              </div>

              <div style={{ position: 'relative', flex: '1 1 280px' }}>
                <form onSubmit={handleAiSubmit} style={{ margin: 0, width: '100%' }}>
                  <Sparkles size={20} color="#a855f7" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="שאל את ה-AI..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '2px solid transparent', background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s' }}
                    onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.1)'; }}
                    onBlur={e => { if(!aiInput) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                  />
                </form>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'white', padding: '12px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#475569' }}>זום</span>
                <input 
                  type="range" 
                  min="0.5" max="1.5" step="0.1" 
                  value={zoomLevel} 
                  onChange={e => setZoomLevel(parseFloat(e.target.value))} 
                  style={{ cursor: 'pointer', accentColor: '#3b82f6', width: '100px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none', background: showZeroSizes ? '#eff6ff' : 'white', padding: '14px 24px', borderRadius: '16px', border: \`1px solid \${showZeroSizes ? '#bfdbfe' : '#e2e8f0'}\`, transition: 'all 0.3s' }} onClick={() => setShowZeroSizes(!showZeroSizes)}>
                <div style={{ width: '44px', height: '24px', background: showZeroSizes ? '#3b82f6' : '#cbd5e1', borderRadius: '999px', position: 'relative', transition: 'background 0.3s' }}>
                  <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: showZeroSizes ? '22px' : '2px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: showZeroSizes ? '#1d4ed8' : '#64748b' }}>
                  הצג תפוסה מלאה
                </span>
              </div>
            </div>
          </div>
          
          {aiMessages.length > 1 && stage === 2 && (`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync(file, code, 'utf8');
console.log('UI Patched!');
