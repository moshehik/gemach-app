export const getHistory = () => {
  try {
    const h = localStorage.getItem('agy_history');
    return h ? JSON.parse(h) : [];
  } catch(e) {
    return [];
  }
};

export const addHistory = (item) => {
  if (typeof window === 'undefined') return;
  
  try {
    let h = getHistory();
    // Remove duplicate by type and id
    h = h.filter(x => !(x.type === item.type && String(x.id) === String(item.id)));
    // Add to beginning
    h.unshift({ ...item, timestamp: Date.now() });
    // Keep max 7 items
    if (h.length > 7) {
      h = h.slice(0, 7);
    }
    localStorage.setItem('agy_history', JSON.stringify(h));
    window.dispatchEvent(new Event('agy_history_updated'));
  } catch(e) {
    console.error('Failed to update history', e);
  }
};
