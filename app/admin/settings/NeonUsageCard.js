'use client';

import { useState, useEffect } from 'react';

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

  if (loading) {
    return (
      <div className="loading-inline">
        <span className="spinner" />
        טוען נתוני צריכה מ-Neon...
      </div>
    );
  }

  if (error) {
    return (
      <div className="callout callout-danger" style={{ alignItems: 'center' }}>
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        <span style={{ flex: 1 }}>{error}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchUsage}>
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
  const freeBarColor = freePct > 85 ? 'var(--danger)' : freePct > 60 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ padding: '18px 0 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '15px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="icon" style={{ width: '16px', height: '16px', color: 'var(--text-3)' }}><use href="#i-database" /></svg>
            צריכת מסד הנתונים (Neon)
          </h3>
          <p className="hint" style={{ color: 'var(--text-3)', margin: 0, fontSize: '12.5px' }}>
            פרויקט {project.name} | תקופת חיוב: {fmtDate(period.start)} - {fmtDate(period.end)} (עברו {period.elapsedDays} מתוך {period.totalDays} ימים)
          </p>
        </div>
        <button type="button" onClick={fetchUsage} title="רענון נתונים" className="btn btn-secondary btn-sm">
          <svg className="icon"><use href="#i-refresh" /></svg>
          רענן
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
              <svg className="icon"><use href="#i-activity" /></svg>
            </div>
          </div>
          <div className="kpi-label">מחשוב (CU-שעות)</div>
          <div className="kpi-value">{usage.computeCuHours}</div>
          <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px', fontSize: '11.5px' }}>{usage.activeHours} שעות פעילות בפועל</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--info-tint)', color: 'var(--info)' }}>
              <svg className="icon"><use href="#i-folder" /></svg>
            </div>
          </div>
          <div className="kpi-label">אחסון</div>
          <div className="kpi-value">{usage.storageGb} GB</div>
          <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px', fontSize: '11.5px' }}>${pricing.storageGbMonth} לג'יגה-חודש</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
              <svg className="icon"><use href="#i-sort" /></svg>
            </div>
          </div>
          <div className="kpi-label">תעבורת רשת</div>
          <div className="kpi-value">{usage.transferGb} GB</div>
          <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px', fontSize: '11.5px' }}>{usage.writtenGb} GB נכתבו</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
              <svg className="icon"><use href="#i-coin" /></svg>
            </div>
          </div>
          <div className="kpi-label">אומדן עלות עד כה</div>
          <div className="kpi-value">${cost.costSoFar}</div>
          <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px', fontSize: '11.5px' }}>תחזית לחודש מלא: ~${cost.projectedMonthly}</div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '4px' }}>
          <span>תעבורה מול המכסה החינמית ({pricing.freeTransferGb} GB בתוכנית Free)</span>
          <span>{Math.round(freePct)}%</span>
        </div>
        <div style={{ height: '8px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ width: `${freePct}%`, height: '100%', background: freeBarColor, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-2)', margin: '10px 0 4px' }}>
          <span>תעבורה מול תוכנית Launch ({transferLimit} GB כלולים)</span>
          <span>{transferPct < 1 ? '<1' : Math.round(transferPct)}%</span>
        </div>
        <div style={{ height: '8px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(transferPct, 0.5)}%`, height: '100%', background: 'var(--primary-solid)', transition: 'width 0.4s' }} />
        </div>
      </div>

      <div className="callout callout-info" style={{ marginBottom: '16px' }}>
        <svg className="icon"><use href="#i-info" /></svg>
        <span>
          <strong>פירוט האומדן (מחירי תוכנית Launch):</strong>{' '}
          מחשוב ${cost.computeCost} ({usage.computeCuHours} CU-שעות × ${pricing.cuHour}) + אחסון ${cost.storageCost} לחודש.
          התעבורה כלולה עד {transferLimit} GB. האומדן אינו חשבונית — הסכום בפועל נקבע ע&quot;י Neon.
        </span>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>סביבה (ענף)</th>
                <th>מצב</th>
                <th>Autoscaling (CU)</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(e => (
                <tr key={e.id}>
                  <td className="cell-primary">{e.branch}</td>
                  <td>
                    {e.state === 'idle' ? (
                      <span className="cell-muted">רדום (לא מחויב)</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>{e.state === 'active' ? 'פעיל' : e.state}</span>
                    )}
                  </td>
                  <td>
                    {e.minCu} - {e.maxCu}
                    {e.maxCu > 2 && <span style={{ color: 'var(--warning)', marginInlineStart: '6px', fontSize: '12px' }}>(מומלץ להגביל ל-1)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
