'use client';

// OcDefaultParts — מימושי ברירת המחדל של ה-slots (slots.js) עד שהזרמים האחרים מחליפים אותם בשורה אחת:
//   Rail/DraftBanner/MoneyToast + חלונות הזרימה (Conflict/Stock/Summary/Exit/Discard) → W5
//   ScanBar → W3 ; PrintMenu/Exports → W7 ; TopBanners (באנר מיקום שמלה) → W2b
// הם מינימליים אבל עובדים מקצה לקצה מול הבקר (כדי שהכרטיס ירוץ עם נתוני אמת כבר עכשיו), על רכיבי הפלטה בלבד, ומסומנים
// "בבנייה" במקום שאין להם מימוש. אין כאן לוגיקה עסקית - רק קריאות ל-oc.* / ui.*.

import OcIcon, { XlGlyph } from './OcIcon';
import { DlgBtn, DlgButtons, DlgHead, useOcUi } from './OcUi';
import { fmtMoney, fmtSignedMoney, obligationIdentityKey, hebDateOf } from './orderCardLogic';

export function NoPart() { return null; }

export const UNDER_CONSTRUCTION = 'בבנייה';

const Money = ({ n, signed }) => <bdi dir="ltr">{signed ? fmtSignedMoney(n) : fmtMoney(n)}</bdi>;

// ---------- רייל "סיכום" (W5 מחליף: parts/OcRail.js) ----------
export function DefaultRail({ oc }) {
  const ui = useOcUi();
  const { totals, changes, dirty, order, items } = oc;
  const net = totals.pendingNet, due = totals.balance, bal = totals.savedBalance;
  const nAct = items.filter(i => !i.isDeleted).length;
  const onSave = async (intent) => {
    const r = await oc.save({ intent });
    if (r.ok && !r.noop) {
      if (r.debtCreated) { oc.goPayments(); return; }
      ui.toast('info', 'ההזמנה נשמרה', '');
    }
  };
  let primary;
  if (dirty && due > 0.005) primary = <button type="button" className="btn primary lg block" data-act="save" onClick={() => onSave('pay')}><OcIcon name="card" />תשלום</button>;
  else if (dirty && net < -0.005) primary = <button type="button" className="btn primary lg block" data-act="save" onClick={() => onSave('credit')}><OcIcon name="undo" />זיכוי</button>;
  else if (dirty) primary = <button type="button" className="btn primary lg block" data-act="save" onClick={() => onSave('save')}><OcIcon name="check" />שמור</button>;
  else if (bal < -0.005) primary = <button type="button" className="btn primary lg block" data-act="credit-now" onClick={oc.goPayments}><OcIcon name="undo" />זכה <Money n={bal} /></button>;
  else if (bal > 0.005) primary = <button type="button" className="btn primary lg block" data-act="pay-now" onClick={oc.goPayments}><OcIcon name="card" />שלם <Money n={bal} /></button>;
  else primary = <button type="button" className="btn primary lg block" disabled><OcIcon name="check" />שמור</button>;
  const pc = due > 0.005 ? 'debt' : due < -0.005 ? 'cred' : 'ok';
  return (
    <div className="rcard cart" data-oc-default="rail">
      <div className="sec-h"><OcIcon name="list" size="sm" /><span>סיכום</span></div>
      <div className="glance">
        <button type="button" className={`gl sig ${order?.hasSignedRegulations ? 'yes' : 'no'}`} data-act="sig" onClick={() => oc.toggleSignature()} aria-label={`${order?.hasSignedRegulations ? 'חתום' : 'לא חתום'} - חתימה על תקנון`}>
          <OcIcon name={order?.hasSignedRegulations ? 'check' : 'x'} /><span className="gv">{order?.hasSignedRegulations ? 'חתום' : 'לא חתום'}</span>
        </button>
        <span className="gl itm-c" tabIndex={0}><OcIcon name="dress" /><span className="gv">{nAct === 1 ? 'פריט אחד' : `${nAct} פריטים`}</span></span>
        <button type="button" className={`gl pay ${pc}`} onClick={oc.goPayments} aria-label="מצב תשלום"><OcIcon name="card" /><span className="gv">{pc === 'debt' ? <>חוב <Money n={due} /></> : pc === 'cred' ? <>זיכוי <Money n={due} /></> : 'שולם'}</span></button>
      </div>
      <div className="cart-h">
        <span className="cart-t"><OcIcon name="cart" size="sm" /><b>שינויים בהזמנה</b><span className="badge">{changes.length}</span>{net ? <span className="cart-sum"><Money n={net} signed /></span> : null}</span>
        {oc.redoCount ? <button type="button" className="redo" data-tip="החזר ביטול" aria-label="החזר ביטול" onClick={oc.redo}><OcIcon name="redo" size="sm" />{oc.redoCount > 1 ? <i>{oc.redoCount}</i> : null}</button> : null}
      </div>
      <div className="cart-body">
        <div className="cart-list">
          {changes.length ? changes.map(c => (
            <div className="cl" key={c.key} data-key={c.key} tabIndex={0}>
              <div className="cl-i"><OcIcon name={c.icon} /></div>
              <div className="cl-t"><span>{c.text}</span>{c.note ? <small>{c.note}</small> : null}{c.amt ? <em className={c.amt > 0 ? 'p' : 'm'}><Money n={c.amt} signed /></em> : null}</div>
              <button type="button" className="cl-u" aria-label="ביטול השינוי" data-tip="ביטול השינוי" onClick={() => oc.undoChange(c.key)}><OcIcon name="bk" size="sm" /></button>
            </div>
          )) : <div className="cart-empty"><OcIcon name="check" size="lg" /><span>אין שינויים</span></div>}
        </div>
        {(net || due) ? (
          <div className="cart-tot">
            {net ? <div className="tr"><small>{net > 0 ? 'חיוב ממתין' : 'זיכוי ממתין'}</small><b><Money n={net} signed /></b></div> : null}
            {due ? <div className="tr due"><small>{due > 0 ? (net ? 'לתשלום אחרי שמירה' : 'יתרת חוב') : (net ? 'זיכוי אחרי שמירה' : 'יתרת זכות')}</small><b className="cart-due"><Money n={due} /></b></div> : null}
          </div>
        ) : null}
      </div>
      <div className="cart-actions">
        {primary}
        {dirty ? <button type="button" className="btn ghost block sec" data-act="discard" onClick={() => oc.discardAll()}><OcIcon name="undo" size="sm" />בטל שינויים</button> : null}
      </div>
    </div>
  );
}

// ---------- באנר טיוטה (R11; W5 מחליף: parts/OcDraftBanner.js) ----------
export function DefaultDraftBanner({ oc }) {
  const d = oc.drafts.pending;
  if (!d) return null;
  const stale = d.baseUpdatedAt && oc.order?.updatedAt && d.baseUpdatedAt !== oc.order.updatedAt;
  return (
    <div className="nb-area oc-banner" data-oc-default="draft">
      <section className="nb nb-warning" role="status">
        <div className="nb-head">
          <span className="nb-ic" aria-hidden="true"><OcIcon name="alert" /></span>
          <div className="nb-msg">
            <b>נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס</b>
            <span>{d.savedAt ? hebDateOf(d.savedAt) : ''}{(d.summary || []).length ? ` · ${(d.summary || []).join(', ')}` : ''}{stale ? ' · ההזמנה עודכנה בשרת מאז - שחזור ושמירה ידרשו אישור דריסה' : ''}</span>
          </div>
        </div>
        <div className="oc-banner-acts">
          <button type="button" className="nb-go" onClick={oc.drafts.restore}>שחזר את השינויים</button>
          <button type="button" className="nb-go" onClick={oc.drafts.discard}>מחק אותם</button>
        </div>
      </section>
    </div>
  );
}

// ---------- כלי הכותרת של W7 (מקום שמור) ----------
function PlaceholderBtn({ cls, glyph, label }) {
  const ui = useOcUi();
  return (
    <button type="button" className={`xlbtn ${cls}`} aria-label={label} data-tip={`${label} · ${UNDER_CONSTRUCTION}`} onClick={() => ui.toast('info', label, UNDER_CONSTRUCTION)}>
      <XlGlyph kind={glyph} />
    </button>
  );
}
export function PlaceholderExports() {
  return (
    <>
      <PlaceholderBtn cls="xlg" glyph="excel" label="ייצוא ההזמנה לקובץ Excel" />
      <PlaceholderBtn cls="xld" glyph="download" label="הורדת סיכום ההזמנה כקובץ" />
    </>
  );
}
export function PlaceholderPrintMenu() {
  return <PlaceholderBtn cls="xlp" glyph="print" label="הדפסה / מייל" />;
}

// ---------- חלונות הזרימה (W5 מחליף כל אחד בשורה ב-slots.js) ----------
const Row = ({ icon, children, amt }) => (
  <div className="c">
    {icon ? <div className="ico gray oc-cico"><OcIcon name={icon} size="sm" /></div> : null}
    <div className="t">{children}</div>
    {amt ? <div className="amt z">{amt}</div> : null}
  </div>
);

// R12: 409 התנגשות - "שמור בכל זאת ולדרוס" / "לטעון מחדש מהשרת" / "חזרה לעריכה" → 'overwrite' | 'reload' | null
export function DefaultConflictDialog({ message, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="ההזמנה עודכנה בשרת" sub={message} />
      <div className="chg">
        <Row icon="check">“שמור בכל זאת” דורס את הגרסה שבשרת</Row>
        <Row icon="refresh">“טען מחדש” מחזיר את נתוני השרת. השינויים שלא נשמרו יאבדו</Row>
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close('overwrite')}>שמור בכל זאת ולדרוס</DlgBtn>
        <DlgBtn icon="refresh" onClick={() => close('reload')}>לטעון מחדש מהשרת</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// R48: חוסר במלאי + רמז ציפוף
export function DefaultStockDialog({ message, lines = [], spacingHint, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="חוסר במלאי" sub={message} />
      <div className="chg">{lines.map((l, i) => <Row key={i} icon="dress">{l.text}</Row>)}</div>
      {spacingHint ? <div className="faint oc-hint">רמז: ציפוף הימים בין הזמנות יכול לתפוס יחידה. נסו לבחור ציפוף קטן יותר.</div> : null}
      <DlgButtons><DlgBtn kind="primary" icon="pencil" onClick={() => close(true)}>חזרה לעריכה</DlgBtn></DlgButtons>
    </>
  );
}

// D1 (נווה, enable_order_edit_summary_confirm): החיובים, סה״כ, שולם, יתרה → true | false
export function DefaultSummaryDialog({ obligations = [], totalRequired = 0, totalPaid = 0, savedObligationKeys, close }) {
  const balance = Math.round((totalRequired - totalPaid) * 100) / 100;
  const keys = savedObligationKeys || new Set();
  const rows = obligations.filter(o => !o.isDeleted);
  return (
    <>
      <DlgHead id="oc-dlg-t" title="סיכום ההזמנה לפני שמירה" />
      <div className="chg">
        {rows.length ? rows.map((o, i) => (
          <Row key={o.id || `${o.description}-${i}`} amt={<Money n={parseFloat(o.amount) || 0} />}>
            {(o.description || 'חיוב').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '')}
            {!keys.has(obligationIdentityKey(o)) ? <span className="chip green sm oc-new">נוסף עכשיו</span> : null}
          </Row>
        )) : <Row>אין חיובים בהזמנה זו.</Row>}
        <Row amt={<Money n={totalRequired} />}>סה״כ לתשלום</Row>
        <Row amt={<Money n={totalPaid} />}>שולם עד כה</Row>
      </div>
      <div className={`net ${balance > 0 ? 'charge' : balance < 0 ? 'credit' : 'zero'}`}>
        <div><div className="sm">{balance > 0 ? 'יתרה לתשלום' : 'יתרת זכות/מאוזן'}</div><div className="v"><Money n={balance} /></div></div>
        <OcIcon name={balance > 0 ? 'card' : balance < 0 ? 'undo' : 'check'} size="lg" />
      </div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close(true)}>אישור ושמירה</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// D2 (AMB-01): יציאה עם שינויים שלא נשמרו → 'save' | 'discard' | null
export function DefaultExitDialog({ changes = [], close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="שינויים שלא נשמרו" sub="ישנם שינויים שלא נשמרו בהזמנה. לשמור אותם לפני היציאה?" />
      <div className="chg">{changes.slice(0, 8).map(c => <Row key={c.key} icon={c.icon}>{c.text}</Row>)}</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close('save')}>שמור וצא</DlgBtn>
        <DlgBtn icon="x" act="discard" onClick={() => close('discard')}>צא בלי לשמור</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// D7: "בטל שינויים" → true | false
export function DefaultDiscardDialog({ changes = [], close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="ביטול כל השינויים" sub="ההזמנה תחזור למצב האחרון שנשמר:" />
      <div className="chg">{changes.map(c => <Row key={c.key} icon={c.icon}>{c.text}</Row>)}</div>
      <DlgButtons>
        <DlgBtn kind="danger" icon="undo" act="discard-close" onClick={() => close(true)}>בטל שינויים</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
