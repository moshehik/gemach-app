'use client';

// מרכז המיילים (/admin/email-center) - בעיצוב "הגדרות מערכת": סרגל לשוניות בצד ימין (rail), כותרת עם חזרה, באנרים, ושורות/סעיפים של הפלטה.
// לשוניות: מיילים (רשימה לפי קטגוריה + עורך "דברי דואר" לכל מייל, הפעלה/כיבוי ותזמון) · נתונים קבועים (שם גמ"ח, כתובת, טלפון, לוגו, חתימה...
// עם איפוס לברירת מחדל) · דיוורים (בחירת נמענים, נושא, תוכן, תמונה, צרופות, שליחה מיידית / מתוזמנת) · בדיקה ויומן.
// רכיבים מהפלטה בלבד (design-system/COMPONENTS.md) + email-center.css (בהיקף .gm-ds.gm-st .ec-*).

import '@/design-system/components.css';
import '../settings-sim/settings-sim.css';
import './email-center.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import { Ic, ConfirmDialog, Toast } from '../settings-sim/SettingsDialogs';
import EmailEditor from './EmailEditor';
import FixedFieldsPanel from './FixedFieldsPanel';
import CampaignPanel from './CampaignPanel';
import { api } from './emailCenterApi';

const TABS = [
  { id: 'emails', label: 'מיילים', icon: 'mail' },
  { id: 'fixed', label: 'נתונים קבועים', icon: 'note' },
  { id: 'campaigns', label: 'דיוורים', icon: 'send' },
  { id: 'tools', label: 'בדיקה ויומן', icon: 'eye' },
];

function Banner({ kind = 'info', icon, heading, text, onClose }) {
  return (
    <div className="nb-w in">
      <section className={`nb nb-${kind}`} role="status">
        <div className="nb-main">
          <div className="nb-head">
            <span aria-hidden="true" className="nb-ic"><Ic id={icon || (kind === 'success' ? 'check' : 'alert')} plain /></span>
            <div className="nb-msg"><b>{heading}</b>{text ? <span>{text}</span> : null}</div>
            {onClose ? <button type="button" className="nb-x" aria-label="סגור" onClick={onClose}><Ic id="x" plain /></button> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function scheduleSummary(e) {
  const modes = e.schedule.modes || [];
  const parts = [];
  if (modes.includes('days_before_event') && Array.isArray(e.schedule.days)) parts.push(e.schedule.days.map((d) => (d === 0 ? 'ביום האירוע' : d === 1 ? 'יום לפני האירוע' : `${d} ימים לפני האירוע`)).join(' + '));
  else if (modes.includes('days_after_return') && e.schedule.days) parts.push(`${e.schedule.days} ימים אחרי ההחזרה`);
  else if (modes.includes('order_after') && e.schedule.orderAfterDays) parts.push(`${e.schedule.orderAfterDays} ימים אחרי יצירת ההזמנה`);
  else if (modes.includes('daily')) parts.push('פעם ביום');
  else if (modes.includes('fixed')) parts.push('שעות קבועות');
  else parts.push('מיד');
  return parts.join(' · ');
}

export default function EmailCenterPage() {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => { setPortalRoot(rootRef.current); }, []);
  usePageTooltip(rootRef, ttRef, false);

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [ver, setVer] = useState(0);
  const [tab, setTab] = useState('emails');
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [askReset, setAskReset] = useState(null); // email
  const [askResetFixed, setAskResetFixed] = useState(false);
  const [leave, setLeave] = useState(null); // { go }
  const [busy, setBusy] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((title, sub) => setToast({ title, sub, icon: 'check' }), []);

  const load = useCallback(async () => {
    const r = await api('/api/admin/email-center/overview');
    if (!r.ok) { setLoadError(r.error); return; }
    setLoadError('');
    setData(r.data);
    setVer((v) => v + 1);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (TABS.some((t) => t.id === sp.get('tab'))) setTab(sp.get('tab'));
      if (sp.get('email')) setSelected(sp.get('email'));
    } catch { /* */ }
  }, []);

  useEffect(() => {
    const onBefore = (e) => { if (window.__gmDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, []);

  // ניווט עם שינויים שלא נשמרו (בעורך מייל / נתונים קבועים / דיוור): חלון אישור במקום יציאה שקטה
  const guarded = useCallback((go) => {
    let dirty = false;
    try { dirty = !!window.__gmDirty; } catch { /* */ }
    if (dirty) setLeave({ go }); else go();
  }, []);

  const selectedEmail = data && selected ? data.emails[selected] : null;
  const catalogById = useMemo(() => Object.fromEntries((data ? data.catalog : []).map((c) => [c.id, c])), [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const [cat, label] of Object.entries(data.categories)) {
      const items = data.catalog.filter((c) => c.category === cat);
      if (items.length) out.push({ cat, label, items });
    }
    return out;
  }, [data]);

  const toggleEnabled = async (e, next) => {
    const r = await api(`/api/admin/email-center/template/${e.id}`, { method: 'PUT', body: { enabled: next } });
    if (!r.ok) { setErrorBanner({ title: 'השינוי נכשל', text: r.error }); return; }
    showToast(next ? 'המייל הופעל' : 'המייל כובה', catalogById[e.id] ? catalogById[e.id].name : e.id);
    load();
  };

  const doReset = async () => {
    const e = askReset;
    setBusy(true);
    const r = await api(`/api/admin/email-center/template/${e.id}`, { method: 'DELETE' });
    setBusy(false);
    setAskReset(null);
    if (!r.ok) { setErrorBanner({ title: 'האיפוס נכשל', text: r.error }); return; }
    showToast('המייל אופס לברירת מחדל', catalogById[e.id] ? catalogById[e.id].name : e.id);
    try { window.__gmDirty = false; } catch { /* */ }
    load();
  };

  const doResetFixed = async () => {
    setBusy(true);
    const r = await api('/api/admin/email-center/fixed', { method: 'DELETE' });
    setBusy(false);
    setAskResetFixed(false);
    if (!r.ok) { setErrorBanner({ title: 'האיפוס נכשל', text: r.error }); return; }
    showToast('הנתונים הקבועים אופסו', 'כל השדות חזרו לברירת המחדל');
    try { window.__gmDirty = false; } catch { /* */ }
    load();
  };

  const openTab = (id) => guarded(() => { setTab(id); setSelected(null); });
  const loading = !data && !loadError;

  const renderEmailsTab = () => {
    if (selectedEmail) {
      return (
        <EmailEditor
          key={`${selectedEmail.id}:${ver}`}
          email={selectedEmail}
          catalog={catalogById[selectedEmail.id]}
          onBack={() => guarded(() => setSelected(null))}
          onReload={load}
          askReset={(e) => setAskReset(e)}
          toast={showToast}
          setError={setErrorBanner}
        />
      );
    }
    return (
      <>
        <p className="ec-note" style={{ marginTop: 0 }}>
          כל המיילים שהמערכת שולחת. לכל מייל: הפעלה/כיבוי, עריכת הנושא והשורות (עם שדות מוחלפים), ותזמון. מייל שלא נערך יוצא בדיוק כמו תמיד.
        </p>
        {groups.map((g) => (
          <section className="st-sec st-card" key={g.cat}>
            <h2 className="adm-h"><span className="adm-hi"><Ic id="mail" /></span>{g.label}</h2>
            <div className="card adm-rows"><div className="list">
              {g.items.map((c) => {
                const e = data.emails[c.id];
                if (!e) return null;
                return (
                  <div className="li st-row st-ctlrow" key={c.id} id={`email-row-${c.id}`}>
                    <div className="ic-b"><Ic id="mail" /></div>
                    <div className="t">
                      <b className="st-lb">{c.name}{e.edited ? <span className="chip gold st-chg">נערך</span> : null}{!e.editable ? <span className="chip">טכני - לעיון</span> : null}</b>
                      <small>{c.trigger}</small>
                      <small>נמענים: {c.recipients} · תזמון: {scheduleSummary(e)}</small>
                    </div>
                    <div className="st-ctl">
                      {e.enabledEditable ? (
                        <label className="sw">
                          <input type="checkbox" aria-label={`הפעלת המייל: ${c.name}`} checked={e.enabled} onChange={(ev) => toggleEnabled(e, ev.target.checked)} data-element-name={`מתג_email_${c.id}`} />
                          <i />
                        </label>
                      ) : <span className="chip">{e.enabledMode === 'locked' ? 'תמיד פעיל' : 'לפי פעולה'}</span>}
                      <button type="button" className="btn ghost sm" onClick={() => setSelected(c.id)} data-element-name={`כפתור_email_open_${c.id}`}><Ic id="pencil" />{e.editable ? 'עריכה' : 'תצוגה'}</button>
                    </div>
                  </div>
                );
              })}
            </div></div>
          </section>
        ))}
        {data.extra && data.extra.length ? (
          <section className="st-sec st-card">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="info" /></span>מיילים נוספים (קבועים)</h2>
            <div className="card adm-rows"><div className="list">
              {data.extra.map((x) => (
                <div className="li st-row" key={x.id}>
                  <div className="ic-b"><Ic id="mail" /></div>
                  <div className="t"><b className="st-lb">{x.name}</b><small>{x.trigger}</small><small>{x.note}</small></div>
                </div>
              ))}
            </div></div>
          </section>
        ) : null}
      </>
    );
  };

  const renderToolsTab = () => (
    <>
      <section className="st-sec st-card">
        <h2 className="adm-h"><span className="adm-hi"><Ic id="eye" /></span>בדיקה ויומן</h2>
        <div className="card adm-rows"><div className="list">
          <div className="li st-row st-ctlrow">
            <div className="ic-b"><Ic id="send" /></div>
            <div className="t"><b className="st-lb">שליחת מיילי דוגמה</b><small>שולח מייל לדוגמה מכל סוג לכתובת שתקלידו (לא ללקוחות אמיתיים).</small></div>
            <div className="st-ctl"><Link className="btn ghost sm" href="/admin/email-test"><Ic id="ext" />פתיחה</Link></div>
          </div>
          <div className="li st-row st-ctlrow">
            <div className="ic-b"><Ic id="list" /></div>
            <div className="t"><b className="st-lb">יומן המיילים שנשלחו</b><small>כל מייל שיצא (או נכשל) - למתכנת בלבד.</small></div>
            <div className="st-ctl"><Link className="btn ghost sm" href="/admin/site-settings/email-logs"><Ic id="ext" />פתיחה</Link></div>
          </div>
          <div className="li st-row st-ctlrow">
            <div className="ic-b"><Ic id="gear" /></div>
            <div className="t"><b className="st-lb">הגדרות המייל בהגדרות מערכת</b><small>מתגי ההפעלה של התזכורות, האישורים והדוחות נמצאים גם בהגדרות מערכת, לשונית &quot;הודעות&quot; (אותן הגדרות בדיוק - שינוי כאן או שם זהה).</small></div>
            <div className="st-ctl"><Link className="btn ghost sm" href="/admin/settings?tab=msg"><Ic id="ext" />פתיחה</Link></div>
          </div>
          <div className="li st-row">
            <div className="ic-b"><Ic id="clock" /></div>
            <div className="t"><b className="st-lb">מתי רצים המיילים המתוזמנים</b><small>{data ? data.cronSlotsNote : ''}</small></div>
          </div>
        </div></div>
      </section>
    </>
  );

  return (
    <div className="gm-ds gm-st home-bg dlg-dark" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app st-view" data-view="email">
        <div className="st-banners">
          {errorBanner ? <Banner kind="warning" icon="alert" heading={errorBanner.title} text={errorBanner.text} onClose={() => setErrorBanner(null)} /> : null}
          {data && data.dryRun ? <Banner kind="info" icon="info" heading="מצב בדיקה" text="השרת רץ עם EMAIL_DRY_RUN: אף מייל לא יוצא בפועל." /> : null}
        </div>

        <div className="topbar">
          <Link className="back" href="/admin" aria-label="חזרה למסך ניהול" data-tip="חזרה למסך ניהול"><Ic id="back" plain /></Link>
          <div className="ttl">
            <h1 className="pg-ttl"><small>הגדרות</small><bdi>מרכז המיילים</bdi></h1>
          </div>
        </div>

        {loading ? (
          <div className="empty st-state" role="status"><span className="st-spin lg" aria-hidden="true" /><div>טוען את מרכז המיילים…</div></div>
        ) : loadError ? (
          <div className="empty st-state" role="alert">
            <Ic id="alert" size="lg" />
            <div><b>לא הצלחנו לטעון</b><br /><small>{loadError}</small></div>
            <button type="button" className="btn ghost sm" onClick={load}><Ic id="refresh" />נסו שוב</button>
          </div>
        ) : (
          <div className="layout">
            <aside className="rail" aria-label="לשוניות">
              <div className="st-sidenav">
                <nav className="st-stabs" role="tablist" aria-label="מרכז המיילים" aria-orientation="vertical">
                  {TABS.map((t) => {
                    const on = t.id === tab;
                    return (
                      <button key={t.id} type="button" className={`st-stab${on ? ' on' : ''}`} role="tab" aria-selected={on} aria-current={on ? 'page' : undefined} onClick={() => openTab(t.id)} data-element-name={`כפתור_email_tab_${t.id}`}>
                        <span className="st-sic"><Ic id={t.icon} plain /></span>
                        <span className="st-slb">{t.label}</span>
                        <span className="st-sgo" aria-hidden="true"><Ic id="chev" plain /></span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <div className="st-main">
              <div className="st-toptabs">
                <nav className="tabs" role="tablist" aria-label="מרכז המיילים">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" className={`tab${t.id === tab ? ' on' : ''}`} role="tab" data-ico={t.icon} aria-selected={t.id === tab} onClick={() => openTab(t.id)}>
                      <span className="tico"><Ic id={t.icon} plain /></span>{t.label}
                    </button>
                  ))}
                </nav>
              </div>
              <section className="panel on" role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label}>
                {tab === 'emails' ? renderEmailsTab() : null}
                {tab === 'fixed' ? (
                  <FixedFieldsPanel key={ver} fixed={data.fixed} onReload={load} askResetAll={() => setAskResetFixed(true)} toast={showToast} setError={setErrorBanner} />
                ) : null}
                {tab === 'campaigns' ? (
                  <CampaignPanel campaignVars={data.campaignVars} dryRun={data.dryRun} cronNote={data.cronSlotsNote} root={portalRoot} toast={showToast} setError={setErrorBanner} />
                ) : null}
                {tab === 'tools' ? renderToolsTab() : null}
              </section>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!askReset}
        root={portalRoot}
        heading={askReset ? `לאפס את "${catalogById[askReset.id] ? catalogById[askReset.id].name : askReset.id}" לברירת מחדל?` : ''}
        sub="הנושא, השורות והתזמון שנערכו יימחקו והמייל יחזור לניסוח המקורי. הגדרות ההפעלה בהגדרות מערכת לא משתנות."
        okLabel="איפוס"
        okIcon="refresh"
        icon="undo"
        k="tilt"
        destructive
        busy={busy}
        onYes={doReset}
        onNo={() => setAskReset(null)}
      />
      <ConfirmDialog
        open={askResetFixed}
        root={portalRoot}
        heading="לאפס את כל הנתונים הקבועים?"
        sub="כל השדות יחזרו לערכי הגמ&quot;ח מהגדרות האתר (או לברירת המחדל של המערכת). הגדרות האתר עצמן לא ישתנו."
        okLabel="איפוס"
        okIcon="refresh"
        icon="undo"
        k="tilt"
        destructive
        busy={busy}
        onYes={doResetFixed}
        onNo={() => setAskResetFixed(false)}
      />
      <ConfirmDialog
        open={!!leave}
        root={portalRoot}
        heading="יש שינויים שלא נשמרו"
        sub="אם תצאו עכשיו, השינויים יאבדו."
        okLabel="צא בלי לשמור"
        okIcon="back"
        icon="alert"
        k="tilt"
        destructive
        onYes={() => { const l = leave; setLeave(null); try { window.__gmDirty = false; } catch { /* */ } if (l) l.go(); }}
        onNo={() => setLeave(null)}
      />
      <Toast toast={toast} onClose={closeToast} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
