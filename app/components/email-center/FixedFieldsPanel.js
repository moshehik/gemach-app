'use client';

// טאב "נתונים קבועים": הערכים שחוזרים בכל מייל (שם הגמ"ח, כתובת, טלפון, מייל ליצירת קשר, לוגו, בס"ד, שורת סיום, חתימה, שם שולח).
// כל שדה: ערך נוכחי, ברירת המחדל (הגדרת האתר של הגמ"ח הזה / ברירת המחדל של המערכת), וחזרה לברירת מחדל. "איפוס" מוחק את העקיפה בלבד -
// הגדרות האתר (gmach_name וכו') לא משתנות, ולכן שני הגמ"חים לא מתערבבים. תצוגה מקדימה חיה לצד השדות.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../settings-sim/SettingsDialogs';
import { api } from './emailCenterApi';

export default function FixedFieldsPanel({ fixed, onReload, askResetAll, toast, setError }) {
  const initial = useMemo(() => Object.fromEntries(fixed.map((f) => [f.key, f.value])), [fixed]);
  const [vals, setVals] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState({ html: '', error: '' });
  const reqId = useRef(0);

  const isToggle = (f) => f.key === 'showLogo';
  const dirtyKeys = fixed.filter((f) => vals[f.key] !== f.value).map((f) => f.key);

  useEffect(() => {
    try { window.__gmDirty = dirtyKeys.length > 0; } catch { /* */ }
    return () => { try { window.__gmDirty = false; } catch { /* */ } };
  }, [dirtyKeys.length]);

  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const draftFixed = {};
      for (const f of fixed) if (vals[f.key] !== f.defaultValue) draftFixed[f.key] = vals[f.key];
      const r = await api('/api/admin/email-center/preview', { method: 'POST', body: { id: 'orderCreatedAuto', draft: { fixed: draftFixed }, withDelivery: false } });
      if (id !== reqId.current) return;
      setPrev(r.ok ? { html: r.data.html, error: '' } : { html: '', error: r.error });
    }, 350);
    return () => clearTimeout(t);
  }, [vals, fixed]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const values = {};
    for (const k of dirtyKeys) {
      const f = fixed.find((x) => x.key === k);
      // ערך שווה לברירת המחדל = איפוס השדה (null), כדי ששינוי עתידי בהגדרת האתר יתפוס
      values[k] = vals[k] === f.defaultValue && !(f.key === 'blessing' || f.key === 'footerNote') ? null : vals[k];
    }
    const r = await api('/api/admin/email-center/fixed', { method: 'PUT', body: { values } });
    setSaving(false);
    if (!r.ok) { setError({ title: 'השמירה נכשלה', text: r.error }); return; }
    toast('הנתונים הקבועים נשמרו', 'יופיעו בכל המיילים הבאים');
    await onReload();
  };

  const resetOne = async (f) => {
    setSaving(true);
    const r = await api('/api/admin/email-center/fixed', { method: 'PUT', body: { values: { [f.key]: null } } });
    setSaving(false);
    if (!r.ok) { setError({ title: 'האיפוס נכשל', text: r.error }); return; }
    toast('השדה חזר לברירת המחדל', f.label);
    await onReload();
  };

  return (
    <div className="ec-grid">
      <div>
        <section className="st-sec st-card" data-guide-id="emc.fixed">
          <h2 className="adm-h"><span className="adm-hi"><Ic id="note" /></span>נתונים קבועים בכל מייל</h2>
          <div className="card adm-rows"><div className="list" style={{ padding: '4px 12px' }}>
            {fixed.map((f) => (
              <div className="ec-line" key={f.key}>
                <div className="ec-line-h">
                  <b>{f.label}</b>
                  {f.overridden ? <span className="chip gold st-chg">נערך כאן</span> : <span className="chip">ברירת מחדל</span>}
                  {f.overridden ? (
                    <button type="button" className="ibtn" aria-label={`איפוס ${f.label} לברירת מחדל`} title="איפוס לברירת מחדל" disabled={saving} onClick={() => resetOne(f)}><Ic id="undo" plain /></button>
                  ) : null}
                </div>
                {isToggle(f) ? (
                  <label className="sw">
                    <input type="checkbox" aria-label={f.label} checked={vals[f.key] === '1'} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.checked ? '1' : '0' }))} />
                    <i />
                  </label>
                ) : (
                  <input
                    className="inp"
                    type="text"
                    dir={f.ltr ? 'ltr' : 'rtl'}
                    maxLength={f.maxLength}
                    value={vals[f.key] ?? ''}
                    aria-label={f.label}
                    autoComplete="off"
                    onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                    data-element-name={`שדה_email_fixed_${f.key}`}
                  />
                )}
                <small className="ec-hint">{f.hint}</small>
                {!isToggle(f) ? (
                  <small className="ec-hint">
                    ברירת מחדל: <bdi>{f.defaultValue ? f.defaultValue : '(ריק)'}</bdi>
                    {f.defaultSource === 'setting' ? ' - מהגדרות האתר של הגמ"ח הזה' : ''}
                  </small>
                ) : null}
              </div>
            ))}
          </div></div>
        </section>
        <div className="ec-sticky-save">
          <button type="button" className="btn primary" data-guide-id="emc.fixed-save" disabled={!dirtyKeys.length || saving} onClick={save} data-element-name="כפתור_email_fixed_save"><Ic id="check" />{saving ? 'שומר…' : 'שמירה'}</button>
          <button type="button" className="btn ghost" disabled={!dirtyKeys.length || saving} onClick={() => setVals(initial)}><Ic id="undo" />ביטול השינויים</button>
          <button type="button" className="btn ghost" data-guide-id="emc.fixed-reset" disabled={saving || !fixed.some((f) => f.overridden)} onClick={askResetAll} style={{ marginInlineStart: 'auto' }}><Ic id="refresh" />איפוס כל הנתונים לברירת מחדל</button>
          {dirtyKeys.length ? <span className="chip gold">יש שינויים שלא נשמרו</span> : null}
        </div>
      </div>
      <aside className="ec-prev" aria-label="תצוגה מקדימה">
        <div className="ec-prev-subj"><b>תצוגה מקדימה:</b>מייל אישור הזמנה לדוגמה</div>
        {prev.error ? <div className="ec-prev-err" role="alert">{prev.error}</div> : null}
        <iframe className="ec-frame" title="תצוגה מקדימה" sandbox="" srcDoc={prev.html || '<p style="font-family:sans-serif;padding:16px">טוען תצוגה…</p>'} />
        <small className="ec-hint">הלוגו מוצג רק כשהאתר נגיש לאינטרנט (כתובת ציבורית) - בסביבת פיתוח מקומית הוא לא ייטען בתיבת הדואר.</small>
      </aside>
    </div>
  );
}
