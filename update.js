const fs = require('fs');

let content = fs.readFileSync('app/page.js', 'utf8');

const oldHandle = \  const handleAiSearch = async (query) => {
    setAiLoading(true);
    setSearchResults(null);
    setAiMessages([]);
    sessionStorage.setItem('dashboardSearchInput', query.trim());
    sessionStorage.removeItem('dashboardSearchResults');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, context: 'User is searching from the general system home dashboard.' })
      });
      const result = await res.json();
      if (res.ok) {
        setAiResponse(result.response);
        sessionStorage.setItem('dashboardAiResponse', result.response);
      } else {
        setAiResponse('שגיאה בחיפוש חכם.');
      }
    } catch (e) {
      console.error(e);
      setAiResponse('שגיאת תקשורת.');
    } finally {
      setAiLoading(false);
    }
  };\;

const newHandle = \  const handleAiSearch = async (query) => {
    setAiLoading(true);
    setSearchResults(null);
    
    const newMessages = [...aiMessages, { role: 'user', content: query.trim() }];
    setAiMessages(newMessages);
    
    sessionStorage.setItem('dashboardSearchInput', query.trim());
    sessionStorage.removeItem('dashboardSearchResults');

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content, sqlQuery: m.sqlQuery }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: query, 
          history: historyContext, 
          context: 'User is searching from the general system home dashboard.' 
        })
      });
      const result = await res.json();
      if (res.ok) {
        const assistantMessage = {
          role: 'assistant',
          content: result.response,
          tableData: result.tableData,
          sqlQuery: result.sqlQuery
        };
        const updatedMessages = [...newMessages, assistantMessage];
        setAiMessages(updatedMessages);
        sessionStorage.setItem('dashboardAiMessages', JSON.stringify(updatedMessages));
      } else {
        const errorMessage = { role: 'assistant', content: 'שגיאה בחיפוש חכם.' };
        setAiMessages([...newMessages, errorMessage]);
      }
    } catch (e) {
      console.error(e);
      const errorMessage = { role: 'assistant', content: 'שגיאת תקשורת.' };
      setAiMessages([...newMessages, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };\;

const oldUI = \      {/* AI Response Area */}
      {aiResponse && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto 3rem auto', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)', border: '1px solid #fbcfe8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', marginBottom: '1rem', fontWeight: 'bold' }}>
            <Sparkles size={24} />
            <span style={{ fontSize: '1.2rem' }}>תשובת המערכת:</span>
          </div>
          <div style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#374151' }}>
            {aiResponse.split('\\n').map((line, i) => <p key={i} style={{ margin: '0.5rem 0' }}>{line}</p>)}
          </div>
        </div>
      )}\;

const newUI = \      {/* AI Response Area */}
      {aiMessages.length > 0 && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto 3rem auto', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)', border: '1px solid #fbcfe8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', marginBottom: '1rem', fontWeight: 'bold', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Sparkles size={24} />
               <span style={{ fontSize: '1.2rem' }}>שרשור חיפוש חכם (AI):</span>
            </div>
            <button onClick={() => { setAiMessages([]); sessionStorage.removeItem('dashboardAiMessages'); }} style={{ background: 'none', border: 'none', color: '#ec4899', cursor: 'pointer' }} title="נקה שרשור"><X size={20} /></button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                backgroundColor: msg.role === 'user' ? '#a855f7' : 'white',
                color: msg.role === 'user' ? 'white' : '#374151',
                padding: '1rem',
                borderRadius: '12px',
                maxWidth: '95%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px',
                fontSize: '1rem',
                lineHeight: '1.5',
                border: msg.role === 'assistant' ? '1px solid #fbcfe8' : 'none',
                width: msg.tableData && msg.tableData.length > 0 ? '100%' : 'auto'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.8 }}>
                  {msg.role === 'user' ? 'אתה' : 'מערכת AI'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                
                {msg.tableData && msg.tableData.length > 0 && (
                  <div style={{ marginTop: '1rem', overflowX: 'auto', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', maxHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f3f4f6' }}>
                        <tr>
                          {Object.keys(msg.tableData[0]).map(h => (
                            <th key={h} style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', color: '#374151' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.tableData.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                            {Object.keys(msg.tableData[0]).map(h => (
                              <td key={h} style={{ padding: '8px', color: '#1f2937' }}>{row[h] === null ? '' : row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div style={{ alignSelf: 'flex-end', color: '#ec4899', fontStyle: 'italic', padding: '1rem' }}>
                <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ה-AI חושב ומעבד נתונים...
              </div>
            )}
          </div>
        </div>
      )}\;

const oldGlobalSearchCheck = \{searchResults && !aiResponse && (\;
const newGlobalSearchCheck = \{searchResults && aiMessages.length === 0 && (\;

if (content.includes(oldHandle)) {
  content = content.replace(oldHandle, newHandle);
  console.log('Replaced handleAiSearch');
} else {
  console.log('Could not find old handleAiSearch');
}

if (content.includes(oldUI)) {
  content = content.replace(oldUI, newUI);
  console.log('Replaced AI UI');
} else {
  console.log('Could not find old AI UI');
}

if (content.includes(oldGlobalSearchCheck)) {
  content = content.replace(oldGlobalSearchCheck, newGlobalSearchCheck);
  console.log('Replaced search results check');
}

fs.writeFileSync('app/page.js', content, 'utf8');
