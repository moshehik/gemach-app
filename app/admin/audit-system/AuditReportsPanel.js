'use client';

import { useEffect, useState } from 'react';

// צבעי טוקני "אריג" (design-system.css) — עוקבים אחרי הפלטה החיה ומצב כהה
const STATUS_META = {
  ok: { color: 'var(--success)', bg: 'var(--success-tint)', label: 'תקין', icon: '✅' },
  warn: { color: 'var(--warning)', bg: 'var(--warning-tint)', label: 'ממצאים', icon: '⚠️' },
  error: { color: 'var(--danger)', bg: 'var(--danger-tint)', label: 'שגיאה', icon: '❌' }
};

const SEVERITY_META = {
  high: { color: 'var(--danger)', bg: 'var(--danger-tint)', label: 'גבוה' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-tint)', label: 'בינוני' },
  low: { color: 'var(--text-3)', bg: 'var(--surface-sunken)', label: 'נמוך' }
};

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

function StatCounts({ agents }) {
  const counts = { ok: 0, warn: 0, error: 0 };
  agents.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
      {['ok', 'warn', 'error'].filter(s => counts[s] > 0).map(s => (
        <span key={s} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          fontSize: '0.85rem', fontWeight: 700, color: STATUS_META[s].color,
          background: STATUS_META[s].bg, borderRadius: '999px', padding: '0.2rem 0.7rem'
        }}>
          {STATUS_META[s].icon} {counts[s]}
        </span>
      ))}
    </div>
  );
}

function AgentMiniCard({ agent }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[agent.status] || STATUS_META.ok;
  const findings = agent.findings || [];

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRight: `4px solid ${meta.color}`,
      borderRadius: '10px',
      background: 'var(--surface)',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => findings.length > 0 && setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 0.9rem', background: 'none', border: 'none',
          cursor: findings.length > 0 ? 'pointer' : 'default', textAlign: 'right'
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem' }}>{agent.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: meta.color, fontWeight: 700 }}>
            {findings.length > 0 ? `${findings.length} ממצאים` : meta.label}
          </span>
          {findings.length > 0 && (
            <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-2)' }}>▼</span>
          )}
        </span>
      </button>
      {open && findings.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0.9rem 0.9rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {findings.map((f, i) => {
            const sMeta = SEVERITY_META[f.severity] || SEVERITY_META.low;
            return (
              <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                <span style={{
                  display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, color: sMeta.color,
                  background: sMeta.bg, borderRadius: '6px', padding: '0.1rem 0.5rem', marginLeft: '0.4rem'
                }}>
                  {sMeta.label}
                </span>
                <span style={{ color: 'var(--text)' }}>{f.description}</span>
                {f.location && <span style={{ color: 'var(--text-2)' }}> — {f.location}</span>}
                {f.recommendation && <div style={{ color: 'var(--text-2)', marginTop: '0.2rem' }}>המלצה: {f.recommendation}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false);
  let agents = [];
  try {
    agents = JSON.parse(report.resultsJson)?.agents || [];
  } catch (e) {
    agents = [];
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      background: 'var(--surface)',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.25rem', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'right'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: 'var(--text)' }}>{formatDateTime(report.runAt)}</span>
          <StatCounts agents={agents} />
          <span style={{
            fontSize: '0.85rem', fontWeight: 700,
            color: report.highCount > 0 ? 'var(--danger)' : 'var(--text-2)'
          }}>
            {report.totalFindings} ממצאים{report.highCount > 0 ? ` (${report.highCount} בחומרה גבוהה)` : ''}
          </span>
        </div>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-2)' }}>▼</span>
      </button>
      {open && (
        <div style={{
          padding: '0 1.25rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '0.75rem'
        }}>
          {agents.map(a => <AgentMiniCard key={a.slug} agent={a} />)}
        </div>
      )}
    </div>
  );
}

export default function AuditReportsPanel() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    setReports(null);
    fetch('/api/admin/audit-reports')
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת הדוחות');
        return res.json();
      })
      .then(setReports)
      .catch(err => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.9rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem'
      }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
          דוחות אחרונים
        </h2>
        <button
          onClick={load}
          style={{
            fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.35rem 0.8rem', cursor: 'pointer'
          }}
        >
          רענון
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', background: 'var(--danger-tint)', borderRadius: '8px', padding: '0.9rem 1.1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {!error && reports === null && (
        <div style={{ color: 'var(--text-2)', fontSize: '0.9rem', padding: '1rem 0' }}>טוען דוחות…</div>
      )}

      {!error && reports !== null && reports.length === 0 && (
        <div style={{
          color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.7,
          border: '1px dashed var(--border-strong)', borderRadius: '10px', padding: '1.25rem'
        }}>
          עדיין לא נשמר אף דוח ביקורת. הרצה של הפקודה <code style={{ direction: 'ltr', display: 'inline-block' }}>/audit-system</code> מ-Claude Code
          תיצור כאן את הדוח הראשון.
        </div>
      )}

      {!error && reports !== null && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </section>
  );
}
