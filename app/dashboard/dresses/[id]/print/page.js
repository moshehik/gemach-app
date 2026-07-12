'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getHebrewDateString } from '../../../../../lib/hebrewDate';

export default function PrintDressCard() {
  const params = useParams();
  const id = params.id;
  const [dress, setDress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dressRes, settingsRes] = await Promise.all([
          fetch(`/api/dresses/${id}`),
          fetch('/api/settings')
        ]);
        
        if (dressRes.ok) {
          const dressData = await dressRes.json();
          setDress(dressData);
        }
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }
      } catch (e) {
        console.error('Failed to load data for printing', e);
      } finally {
        setLoading(false);
        // Add a slight delay to allow rendering before print dialog
        setTimeout(() => {
          window.print();
        }, 500);
      }
    };
    
    fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים להדפסה...</div>;
  }

  if (!dress) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>שגיאה: לא ניתן לטעון את נתוני השמלה</div>;
  }

  const formatHebrewDate = (isoString) => {
    if (!isoString) return '-';
    try {
      return getHebrewDateString(isoString);
    } catch (e) {
      return new Date(isoString).toLocaleDateString('he-IL');
    }
  };

  const getImageSource = (d) => {
    if (d.imageUrl) return d.imageUrl;
    if (settings.useFileNamesForImages === 'true' && d.barcodePrefix) {
      return `/images/dresses/${d.barcodePrefix}.jpg`;
    }
    return null;
  };

  const useModelNames = settings.useModelNames !== 'false';
  const activeItems = (dress.items || []).filter(i => !i.isDeleted);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
        table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
        th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: right; }
        th { background-color: #f5f5f5; font-weight: bold; }
      `}} />

      <div className="no-print" style={{ marginBottom: '1rem', textAlign: 'left' }}>
        <button onClick={() => window.print()} style={{ padding: '0.5rem 1rem', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          הדפס כרטיס
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0' }}>כרטיס דגם שמלה</h1>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>
            {useModelNames ? dress.name : `דגם ${dress.barcodePrefix}`}
          </h2>
          <div style={{ fontSize: '1.1rem' }}>
            <strong>קוד:</strong> {dress.barcodePrefix || '-'}
          </div>
        </div>
        
        {getImageSource(dress) && (
          <div>
            <img 
              src={getImageSource(dress)} 
              alt={dress.name} 
              style={{ width: '120px', height: '120px', objectFit: 'contain', border: '1px solid var(--element-border)', borderRadius: '4px' }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <strong>קטגוריית מחיר:</strong> {dress.priceCategory || '-'}
        </div>
        <div>
          <strong>תאריך כניסה:</strong> {formatHebrewDate(dress.entryDateToRepo)}
        </div>
        <div>
          <strong>מצב דגם:</strong> {dress.exitDateFromRepo ? `לא פעיל (הוצא ב-${formatHebrewDate(dress.exitDateFromRepo)})` : 'פעיל'}
        </div>
        <div>
          <strong>סטטוס בדיקה:</strong> {dress.inInspection ? 'בבדיקה' : '-'}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <strong>הערות לדגם:</strong>
          <p style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap' }}>{dress.notes || 'אין הערות'}</p>
        </div>
      </div>

      <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        פירוט פריטים במלאי ({activeItems.length})
      </h3>
      
      {activeItems.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>מידה</th>
              <th>מס' סידורי</th>
              <th>ברקוד פריט</th>
              <th>מיקום</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item) => (
              <tr key={item.id} style={{ background: item.notInUse ? '#f9f9f9' : 'transparent', color: item.notInUse ? 'var(--text-muted)' : 'inherit' }}>
                <td>{item.sizeText}</td>
                <td>{item.serialNumber}</td>
                <td>{item.dressBarcode}</td>
                <td>{item.location || '-'}</td>
                <td>
                  {item.notInUse ? 'לא בשימוש' : item.inRepair ? 'בתיקון' : 'זמין'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>אין פריטים במלאי עבור דגם זה.</p>
      )}

      <div style={{ marginTop: '3rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        הודפס מתערכת ניהול הגמ"ח בתאריך: {new Date().toLocaleDateString('he-IL')} בשעה {new Date().toLocaleTimeString('he-IL')}
      </div>
    </div>
  );
}
