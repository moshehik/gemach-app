'use client';

// צורת "טופס רציף בעמוד אחד נגלל" של אשף הזמנה חדשה (A5) - ההגדרה new_order_layout='continuous'. במקום שלב אחד על המסך, כל השלבים כגושים
// בזה אחר זה: לקוח, תאריכים, משלוח (רק כשהשער הקיים של שלב המשלוח דולק), פריטים (עם הסל בצד), סיכום, תשלום + סיום.
// אותו controller, אותו state, אותם רכיבי שלב (STEP_VIEW), אותם חלונות / ולידציה / שמירה - כאן רק עטיפה ויזואלית:
//  - נעילה: גוש מאוחר גלוי אבל מעומעם ו-inert (ובו הרמז) עד ש-ctl.gate(key) (NL.stepGate = stepOpenInfo + כלל שדות המשלוח, אותם תנאי go()) נפתח;
//  - "המשך" בתחתית כל גוש = אותה פעולה כמו שורת הניווט של האשף (stepNextAction -> ctl.go), וה-go() גולל חלק לגוש הבא (כבוד ל-prefers-reduced-motion);
//  - פס התקדמות דק ונדבק (.pbars.mini): אותו מראה כמו פסי האשף, לחיצה על פריט = ctl.go(מפתח) (גלילה לגוש, או הודעת הנעילה).
// הכותרת, הבאנר, החלונות, הטוסט, מתג הישן/חדש ומגני הטיוטה (window.__gmDirty / popstate) נשארים ב-NewOrderA5 ללא שינוי.
import { Ic } from './NoUi';
import { STEP_KEYS, STEP_META } from './newOrderLogic';
import { STEP_VIEW } from './stepViews';
import { sectionDomId, sectionDoneFlags, sectionProgress, stepNextAction, visibleSectionKeys } from './layoutLogic';

function MiniProgress({ ctl, progress }) {
  return (
    <div className="pbars mini" id="noMiniBars" aria-label="התקדמות ההזמנה" style={{ '--n': progress.length }}>
      {progress.map(({ key, state }) => {
        const meta = STEP_META[key];
        const g = ctl.gate(key);
        const go = () => ctl.go(STEP_KEYS.indexOf(key));
        return (
          <div key={key} className={`pb ${state}${g.open ? '' : ' lock'}`}>
            <div className="pb-bar" role="progressbar" aria-label={meta.l} aria-valuemin={0} aria-valuemax={1} aria-valuenow={state === 'done' ? 1 : 0}><i /></div>
            <div className="pb-d" role="button" tabIndex={0} aria-disabled={!g.open || undefined} data-tip={g.open ? `מעבר אל ${meta.l}` : g.reason}
              onClick={go} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
              <Ic n={meta.i} c="sm" /><span className="pb-t"><b>{meta.l}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionFooter({ ctl, k, skipDelivery }) {
  if (ctl.saved) return null;
  const busy = ctl.saving || ctl.isProcessingCredit;
  const next = stepNextAction(ctl, k, { skipDelivery });
  if (!next) {
    // גוש התשלום: סיום ההזמנה (אותו לחצן כמו בשלב האחרון של האשף)
    return (
      <div className="row spread wrap no-sec-nav">
        <button type="button" className="btn ghost" disabled={busy} onClick={ctl.handleExit}><Ic n="x" c="sm" />ביטול</button>
        <button type="button" className="btn primary" disabled={busy} aria-busy={ctl.saving} onClick={ctl.saveOrder}><Ic n="check" />{ctl.saving ? 'שומר...' : 'סיום ויצירת ההזמנה'}</button>
      </div>
    );
  }
  return (
    <div className="row spread wrap no-sec-nav">
      <button type="button" className="btn primary" disabled={next[1]} onClick={next[2]}><Ic n="arrl" />{next[0]}</button>
    </div>
  );
}

function Section({ ctl, k, n, skipDelivery }) {
  const View = STEP_VIEW[k];
  const g = ctl.gate(k);
  const locked = !g.open;
  const id = sectionDomId(k);
  // שלבי שתי העמודות (פריטים + סל; תשלום + "תשלומים שנרשמו") רחבים יותר משאר הגושים - כמו #app.wide באשף
  const wide = k === 'items' || (k === 'payment' && ctl.paymentsList.length > 0);
  return (
    <section className={`no-sec${locked ? ' locked' : ''}${wide ? ' wide' : ''}`} id={id} data-sec-key={k} aria-labelledby={`${id}-t`}>
      <header className="no-sec-h">
        <span className="no-sec-n" aria-hidden="true">{n}</span>
        <h2 className="no-sec-t" id={`${id}-t`}>{STEP_META[k].q}</h2>
        {locked ? <span className="no-sec-lock" role="note"><Ic n="lock" c="sm" />{g.reason || 'יש להשלים את השלב הקודם'}</span> : null}
      </header>
      <div className="no-sec-body" inert={locked}>
        <div className="sec" data-sec={k}><View ctl={ctl} /></div>
        {locked ? null : <SectionFooter ctl={ctl} k={k} skipDelivery={skipDelivery} />}
      </div>
    </section>
  );
}

export default function LayoutContinuous({ ctl }) {
  const keys = visibleSectionKeys(ctl.settings);
  const progress = sectionProgress(keys, sectionDoneFlags(ctl, ctl.gate), !!ctl.saved);
  const skipDelivery = !keys.includes('delivery');
  return (
    <>
      <MiniProgress ctl={ctl} progress={progress} />
      {/* אחרי שמירה (חלון "ההזמנה נשמרה") הטופס נשאר גלוי לעיון אך לא ניתן לעריכה - כמו באשף, שם אי אפשר לחזור לשלבים אחרי השמירה */}
      <div className="no-flow" id="noFlow" inert={!!ctl.saved}>
        {keys.map((k, i) => <Section key={k} ctl={ctl} k={k} n={i + 1} skipDelivery={skipDelivery} />)}
      </div>
    </>
  );
}
