'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const LEVEL_LABELS = { strict: 'מחמיר', standard: 'רגיל', open: 'פתוח' };
const LEVEL_CLASS = { strict: 'badge-danger', standard: 'badge-info', open: 'badge-success' };

function HardGuardRow({ guard }) {
  return (
    <div className="list-card" style={{ padding: '8px 10px', gap: '10px', opacity: 0.85 }}>
      <svg className="icon" style={{ width: '15px', height: '15px', flex: '0 0 auto', color: 'var(--text-3)' }}>
        <use href="#i-lock" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{guard.label}</div>
        <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{guard.description}</div>
      </div>
      <span className="badge badge-neutral" style={{ flex: '0 0 auto' }}>קבוע — לא ניתן לכיבוי</span>
    </div>
  );
}

function RestrictionRow({ restriction, enabled, onToggle }) {
  return (
    <div
      className="checkbox-row"
      onClick={() => onToggle(restriction.id)}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: enabled ? 'var(--primary-tint)' : 'var(--surface-alt)',
        border: enabled ? '1px solid var(--primary-tint-2)' : '1px solid var(--border)',
        alignItems: 'flex-start', gap: '10px',
      }}
    >
      <input type="checkbox" checked={enabled} readOnly style={{ marginTop: '3px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: enabled ? 'var(--primary-solid)' : 'var(--text)' }}>
            {restriction.label}
          </span>
          {restriction.level && (
            <span className={`badge ${LEVEL_CLASS[restriction.level] || 'badge-neutral'}`} style={{ fontSize: '10.5px' }}>
              {LEVEL_LABELS[restriction.level] || restriction.level}
            </span>
          )}
          {restriction.roleConditional && (
            <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>תלוי תפקיד (לא חל על מנהל/מתכנת)</span>
          )}
          {!restriction.wired && (
            <span className="badge badge-info" style={{ fontSize: '10.5px' }}>מוכן — טרם מחובר להרצה</span>
          )}
        </div>
        <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11.5px', marginTop: '3px', lineHeight: 1.4 }}>
          {restriction.description}
        </div>
        {restriction.note && (
          <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '3px', fontStyle: 'italic' }}>
            {restriction.note}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTextList({ items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ marginTop: '10px' }}>
      <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11.5px', marginBottom: '6px' }}>
        חוקים נוספים בשפה חופשית (מתווספים כהנחיה ל-AI, בנוסף למגבלות למעלה):
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          {items.map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 10px' }}>
              <span style={{ flex: 1, fontSize: '12.5px' }}>{text}</span>
              <button type="button" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}>
                <svg className="icon" style={{ width: '14px', height: '14px' }}><use href="#i-trash" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='למשל: "אל תזכיר מספרי טלפון בתשובה"'
          className="input"
          style={{ flex: 1, fontSize: '12.5px' }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft(''); } }}
        >
          <svg className="icon" style={{ width: '14px', height: '14px' }}><use href="#i-plus" /></svg>
          הוסף
        </button>
      </div>
    </div>
  );
}

function WhitelistSection({ feature, config, onChange }) {
  const catalog = feature.whitelist;
  if (!catalog || !catalog.candidateFields || catalog.candidateFields.length === 0) return null;

  const selected = new Set(config.whitelist || []);
  const toggleField = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...config, whitelist: Array.from(next) });
  };

  return (
    <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '12.5px' }}>מצב רשימה לבנה (AI הפכי — לשימוש עתידי)</span>
        <button
          type="button"
          className={config.whitelistMode ? 'switch on' : 'switch'}
          onClick={() => onChange({ ...config, whitelistMode: !config.whitelistMode })}
        />
      </div>
      <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px' }}>
        במקום לחסום נושאים ספציפיים, מצב זה מגדיר אילו נתונים בלבד מותר ל-AI לענות מהם — כל מה שלא ברשימה נדחה. שמור כאן כהכנה; טרם מחובר להרצה בפועל בתכונה זו.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {catalog.candidateFields.map((f) => (
          <div
            key={f.id}
            className="checkbox-row"
            onClick={() => toggleField(f.id)}
            style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: selected.has(f.id) ? 'var(--primary-tint)' : 'var(--surface-alt)', border: '1px solid var(--border)' }}
          >
            <input type="checkbox" checked={selected.has(f.id)} readOnly />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>{f.label}</span>
              {f.riskNote && <div className="hint" style={{ color: 'var(--text-3)', fontSize: '10.5px' }}>{f.riskNote}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature, config, onChange, onSave, saving, savedFlag }) {
  const [open, setOpen] = useState(false);

  const toggleRestriction = (id) => {
    const enabled = new Set(config.enabledIds || []);
    enabled.has(id) ? enabled.delete(id) : enabled.add(id);
    onChange({ ...config, enabledIds: Array.from(enabled) });
  };

  const applyPreset = (level) => {
    const ids = feature.presets?.[level] || [];
    onChange({ ...config, enabledIds: ids });
  };

  return (
    <div className="list-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
      >
        <svg className="icon" style={{ width: '18px', height: '18px', color: 'var(--primary-solid)', flex: '0 0 auto' }}>
          <use href="#i-star" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px' }}>{feature.label}</div>
          <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{feature.description}</div>
          <div className="hint" style={{ color: 'var(--text-4, var(--text-3))', fontSize: '10.5px', marginTop: '2px' }}>
            {feature.route} · {feature.uiEntryPoint}
          </div>
        </div>
        <span className="badge badge-neutral">{feature.restrictions.length} מגבלות</span>
        {savedFlag && <span className="badge badge-success">נשמר</span>}
        <svg className="icon" style={{ width: '16px', height: '16px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <use href="#i-chevron-down" />
        </svg>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {feature.hardGuards.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div className="hint" style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '6px' }}>
                הגנות קבועות (קוד — לא ניתן לשינוי כאן)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {feature.hardGuards.map((g) => <HardGuardRow key={g.id} guard={g} />)}
              </div>
            </div>
          )}

          {feature.restrictions.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="hint" style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-3)' }}>
                  מגבלות ניתנות לעריכה
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['strict', 'standard', 'open'].map((lvl) => (
                    <button key={lvl} type="button" className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => applyPreset(lvl)}>
                      {LEVEL_LABELS[lvl]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {feature.restrictions.map((r) => (
                  <RestrictionRow
                    key={r.id}
                    restriction={r}
                    enabled={(config.enabledIds || []).includes(r.id)}
                    onToggle={toggleRestriction}
                  />
                ))}
              </div>
            </div>
          )}

          {feature.supportsCustomText && (
            <CustomTextList
              items={config.custom || []}
              onAdd={(text) => onChange({ ...config, custom: [...(config.custom || []), text] })}
              onRemove={(i) => onChange({ ...config, custom: (config.custom || []).filter((_, idx) => idx !== i) })}
            />
          )}

          <WhitelistSection feature={feature} config={config} onChange={onChange} />

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => onSave(feature.key)} disabled={saving}>
              {saving ? 'שומר...' : 'שמור שינויים לתכונה זו'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiRestrictionsPage() {
  const [data, setData] = useState(null);
  const [configs, setConfigs] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState(null);
  const [showBasePrompt, setShowBasePrompt] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-restrictions');
      if (!res.ok) throw new Error('שגיאה בטעינת נתוני מגבלות AI');
      const json = await res.json();
      setData(json);
      const initial = {};
      json.features.forEach((f) => { initial[f.key] = f.config; });
      setConfigs(initial);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveFeature = async (featureKey) => {
    setSavingKey(featureKey);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai-restrictions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, config: configs[featureKey] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'שמירה נכשלה');
      setConfigs((prev) => ({ ...prev, [featureKey]: json.config }));
      setSavedKey(featureKey);
      setTimeout(() => setSavedKey((k) => (k === featureKey ? null : k)), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  if (error && !data) {
    return (
      <div className="page-head">
        <h1><svg className="icon"><use href="#i-star" /></svg> מגבלות AI</h1>
        <p className="page-desc" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-head">
        <h1><svg className="icon"><use href="#i-star" /></svg> מגבלות AI</h1>
        <p className="page-desc">טוען...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-star" /></svg> ניהול מגבלות בינה מלאכותית</h1>
          <p className="page-desc">
            לכל תכונת AI במערכת: אילו הגנות קבועות תמיד פעילות (לא ניתנות לכיבוי), ואילו הנחיות
            אפשר להוסיף/להסיר עבור מה שה-AI מותר לענות עליו. שינוי כאן משפיע רק על הנחיית הפרומפט —
            לא על הרשאות התחברות, SQL לקריאה בלבד, או היקף מסד הנתונים.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-ghost">חזרה לניהול</Link>
        </div>
      </div>

      {error && <div className="hint" style={{ color: 'var(--danger)', marginBottom: '10px' }}>{error}</div>}

      <div className="list-card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px', cursor: 'pointer' }} onClick={() => setShowBasePrompt((s) => !s)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
          <svg className="icon" style={{ width: '16px', height: '16px', color: 'var(--text-3)' }}><use href="#i-info" /></svg>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>מה נשלח לכל שיחת AI בכל מקרה (בלי קשר למגבלות)</span>
          <svg className="icon" style={{ width: '14px', height: '14px', transform: showBasePrompt ? 'rotate(180deg)' : 'none' }}><use href="#i-chevron-down" /></svg>
        </div>
        {showBasePrompt && (
          <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
            {data.basePrompt.map((b) => (
              <div key={b.id} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{b.label}</div>
                <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11.5px', marginTop: '2px', lineHeight: 1.5 }}>{b.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.features.map((feature) => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            config={configs[feature.key] || { enabledIds: [], custom: [], whitelistMode: false, whitelist: [] }}
            onChange={(next) => setConfigs((prev) => ({ ...prev, [feature.key]: next }))}
            onSave={saveFeature}
            saving={savingKey === feature.key}
            savedFlag={savedKey === feature.key}
          />
        ))}
      </div>
    </div>
  );
}
