'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { GoLink } from './StageRow';
import { UPDATED_META, updatedItems } from './scheduleMeta';

// מקטע "הזמנות שעודכנו" - אחרון בדף (אחרי כל השלבים) ואחרון בציר. הגדרה (הבעלים 7.10.2026): הזמנה קיימת שביום הזה נוסף או
// נערך בה פריט, או נוסף לה תשלום, ובתנאי שאינה מופיעה ב"הזמנות חדשות" של אותו יום (lib/schedule/updatedOrders.js).
//
// טעינה עצלה: הנתונים לא חלק מ-GET /api/schedule. הם נמשכים מ-GET /api/schedule/updated רק כשהמקטע מתקרב למסך (גלילה
// לסוף הדף, IntersectionObserver עם שוליים) או כשבוחרים אותו בציר - ופעם אחת לכל (יום, סניף). כך טעינת הדף הרגילה לא
// משלמת על המקטע. onCount מעדכן את המונה בציר (null עד שנטען).
export default function UpdatedSection({ date, branch, onCount, hidden = false }) {
  const rootRef = useRef(null);
  const [state, setState] = useState({ status: 'idle', data: null }); // idle | loading | ok | error
  const [attempt, setAttempt] = useState(0);
  const started = useRef('');

  useEffect(() => { if (onCount) onCount(null); }, [date, branch, onCount]);

  const load = useCallback((ctrl) => {
    setState({ status: 'loading', data: null });
    const qs = new URLSearchParams({ date });
    if (branch) qs.set('branch', branch);
    fetch('/api/schedule/updated?' + qs.toString(), { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        if (!res.ok) throw new Error((body && body.error) || 'שגיאה');
        setState({ status: 'ok', data: body });
        if (onCount) onCount(body.total);
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        setState({ status: 'error', data: null });
        started.current = '';
      });
  }, [date, branch, onCount]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !date) return undefined;
    const ctrl = new AbortController();
    const key = date + '|' + branch + '|' + attempt;
    const start = () => { if (started.current === key) return; started.current = key; load(ctrl); };
    let io = null;
    if (typeof IntersectionObserver === 'undefined') start();
    else {
      io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { start(); io.disconnect(); } }, { rootMargin: '400px 0px' });
      io.observe(el);
    }
    return () => { if (io) io.disconnect(); ctrl.abort(); if (started.current === key) started.current = ''; };
  }, [date, branch, attempt, load]);

  const { status, data } = state;
  const rows = (data && data.orders) || [];
  return (
    <section className="lz-sec" id="st-updated" data-k="updated" style={{ '--pc': 'var(' + UPDATED_META.color + ')', ...(hidden ? { display: 'none' } : null) }} ref={rootRef}>
      <div className="lz-hrow">
        <h2 className="adm-h">
          <span className="adm-hi"><ScheduleIcon name={UPDATED_META.icon} /></span>
          {UPDATED_META.label}
        </h2>
        <div className="lz-chips" />
      </div>
      <div className="card lz-st">
        {status === 'ok' && rows.length ? (
          <div className="hres">
            <div className="hgrp">
              {rows.map((row) => (
                <article key={row.orderId} className="hrow irow lz-r">
                  <div className="li lrow">
                    <div className="ic-b"><ScheduleIcon name={UPDATED_META.icon} /></div>
                    <div className="t">
                      <b>{row.customer.name} <bdi>#{row.orderId}</bdi></b>
                      <span className="ln">
                        {updatedItems(row).map((part, i) => (
                          <span key={i} className="lz-p" data-tip={part.tip}>
                            {i > 0 ? ' · ' : ''}
                            <span className="lz-pn">
                              {part.icon ? <ScheduleIcon name={part.icon} className="sm" /> : null}
                              <bdi>{part.text}</bdi>
                            </span>
                          </span>
                        ))}
                      </span>
                    </div>
                    <GoLink orderId={row.orderId} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty" role="status">
            {status === 'error' ? (
              <>
                <div className="lz-empty-t">לא ניתן לטעון את ההזמנות שעודכנו כרגע.</div>
                <button type="button" className="btn lz-retry" onClick={() => setAttempt((n) => n + 1)}>
                  <ScheduleIcon name="refresh" className="sm" />נסו שוב
                </button>
              </>
            ) : status === 'ok' ? (
              <div className="lz-empty-t">אין הזמנות שעודכנו ביום הזה</div>
            ) : (
              <div className="lz-empty-t">טוען…</div>
            )}
          </div>
        )}
        {status === 'ok' && data && data.truncated ? <div className="lz-note">נטענו רק חלק מהעדכונים של היום (יום עמוס במיוחד).</div> : null}
      </div>
    </section>
  );
}
