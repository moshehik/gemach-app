import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleAiSearch
old_handle = '''  const handleAiSearch = async (query) => {
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
  };'''

new_handle = '''  const handleAiSearch = async (query) => {
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
  };'''

content = content.replace(old_handle, new_handle)
if old_handle not in content and new_handle not in content:
    print('Failed to replace handleAiSearch - maybe encoding issues?')
    # Try regex fallback
    content = re.sub(r'  const handleAiSearch = async \(query\) => \{.*?  \};\n', new_handle + '\n', content, flags=re.DOTALL)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)
