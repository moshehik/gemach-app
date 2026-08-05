'use client';

import { useState, useEffect } from 'react';
import { Database, RefreshCw, Loader2, AlertCircle, HardDrive, Cpu, ArrowDownUp, Coins } from 'lucide-react';

// Shows the Neon project's current billing-period consumption and an
// estimated monthly cost (Launch-plan pricing). Data comes from
// /api/admin/neon-usage which proxies the Neon control-plane API.
export default function NeonUsageCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/neon-usage');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsage(); }, []);

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('he-IL') : '-';

  const tile = (icon, title, value, sub) => (
    <div style={{ flex: '1 1 160px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
        {icon}
        {title}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2.5rem 0', color: '#64748b' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        טוען נתוני צריכה מ-Neon...
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 100% { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <AlertCircle size={20} />
        <span style={{ flex: 1 }}>{error}</span>
        <button type="button" onClick={fetchUsage} style={{ border: '1px solid #fca5a5', background: 'white', color: '#991b1b', borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer' }}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { usage, cost, period, endpoints, pricing, project } = data;
  const transferLimit = pricing.includedTransferGb;
  const transferPct = Math.min((usage.transferGb / transferLimit) * 100, 100);
  const freePct = Math.min((usage.transferGb / pricing.freeTransferGb) * 100, 100);

  return (
    <div style={{ padding: '1.25rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="#64748b" />
            צריכת מסד הנתונים (Neon)
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            פרויקט {project.name} | תקופת חיוב: {fmtDate(period.start)} - {fmtDate(period.end)} (עברו {period.elapsedDays} מתוך {period.totalDays} ימים)
          </p>
        </div>
        <button type="button" onClick={fetchUsage} title="רענון נתונים"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', border: '2px solid #e2e8f0', color: '#3b82f6', borderRadius: '10px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600' }}>
          <RefreshCw size={16} />
          רענן
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        {tile(<Cpu size={15} />, 'מחשוב (CU-שעות)', usage.computeCuHours,
          `${usage.activeHours} שעות פעילות בפועל`)}
        {tile(<HardDrive size={15} />, 'אחסון', `${usage.storageGb} GB`,
          `$${pricing.storageGbMonth} לג'יגה-חודש`)}
        {tile(<ArrowDownUp size={15} />, 'תעבורת רשת', `${usage.transferGb} GB`,
          `${usage.writtenGb} GB נכתבו`)}
        {tile(<Coins size={15} />, 'אומדן עלות עד כה', `$${cost.costSoFar}`,
          `תחזית לחודש מלא: ~$${cost.projectedMonthly}`)}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.3rem' }}>
          <span>תעבורה מול המכסה החינמית ({pricing.freeTransferGb} GB בתוכנית Free)</span>
          <span>{Math.round(freePct)}%</span>
        </div>
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${freePct}%`, height: '100%', background: freePct > 85 ? '#ef4444' : freePct > 60 ? '#f59e0b' : '#22c55e', transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', margin: '0.7rem 0 0.3rem' }}>
          <span>תעבורה מול תוכנית Launch ({transferLimit} GB כלולים)</span>
          <span>{transferPct < 1 ? '<1' : Math.round(transferPct)}%</span>
        </div>
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(transferPct, 0.5)}%`, height: '100%', background: '#3b82f6', transition: 'width 0.4s' }} />
        </div>
      </div>

      <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
        <strong>פירוט האומדן (מחירי תוכנית Launch):</strong>{' '}
        מחשוב ${cost.computeCost} ({usage.computeCuHours} CU-שעות × ${pricing.cuHour}) + אחסון ${cost.storageCost} לחודש.
        התעבורה כלולה עד {transferLimit} GB. האומדן אינו חשבונית — הסכום בפועל נקבע ע"י Neon.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ color: '#64748b', textAlign: 'right' }}>
            <th style={{ padding: '0.4rem', borderBottom: '2px solid #e2e8f0' }}>סביבה (ענף)</th>
            <th style={{ padding: '0.4rem', borderBottom: '2px solid #e2e8f0' }}>מצב</th>
            <th style={{ padding: '0.4rem', borderBottom: '2px solid #e2e8f0' }}>Autoscaling (CU)</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map(e => (
            <tr key={e.id}>
              <td style={{ padding: '0.4rem', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{e.branch}</td>
              <td style={{ padding: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: e.state === 'idle' ? '#64748b' : '#16a34a' }}>
                  {e.state === 'idle' ? 'רדום (לא מחויב)' : e.state === 'active' ? 'פעיל' : e.state}
                </span>
              </td>
              <td style={{ padding: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                {e.minCu} - {e.maxCu}
                {e.maxCu > 2 && <span style={{ color: '#b45309', marginRight: '0.5rem' }}>(מומלץ להגביל ל-1)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
