'use client';
import { useState, useEffect } from 'react';

export default function HistoryViewer({ entityType, entityId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const query = new URLSearchParams();
        if (entityType) query.append('entityType', entityType);
        if (entityId) query.append('entityId', entityId);
        
        const res = await fetch(`/api/audit?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchLogs();
  }, [entityType, entityId]);

  if (loading) return <div className="text-gray-500 text-sm">טוען היסטוריה...</div>;
  if (error) return <div className="text-red-500 text-sm">שגיאה בטעינת היסטוריה: {error}</div>;
  if (logs.length === 0) return <div className="text-gray-500 text-sm">אין היסטוריה זמינה.</div>;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100 mt-4 max-h-96 overflow-y-auto" dir="rtl">
      <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2">היסטוריית שינויים</h3>
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="text-sm border-r-2 border-indigo-400 pr-3 bg-gray-50/50 p-2 rounded-l-lg">
            <div className="flex justify-between items-center text-gray-500 text-xs mb-1">
              <span>{new Date(log.createdAt).toLocaleString('he-IL')}</span>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                {log.action}
              </span>
            </div>
            <div className="text-gray-700">
              <span className="font-medium">
                {log.employeeId ? `משתמש (קוד ${log.employeeId})` : 'מערכת'}
              </span>
              {' ביצע עדכון.'}
            </div>
            <div className="mt-1 text-xs text-gray-500 bg-white p-2 rounded border font-mono whitespace-pre-wrap overflow-x-auto" dir="ltr">
              {log.changesJson}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
