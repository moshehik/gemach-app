'use client';

// אשף "הזמנה חדשה" החדש (A5) - העיצוב המאושר תצוגות-עיצוב/הזמנה-חדשה.html, גרסת "B2 מודרך עם פסים" (Q1 "הכי חדש"),
// עם תשובות הבעלים (scratch/neworder-build/answers-neworder.json; ההחלטות וברירות המחדל ב-scratch/neworder-build/NOTES.md).
// שורש הדף: .gm-ds.gm-no.home-bg.dlg-dark (בלי gm-home - העור של דף הבית דורס לחצנים/שדות; Q2 = חלונות כהים).
// מבנה כמו בעיצוב: .topbar, .pbars (G3 - 6 פסי התקדמות + הפרט שמולא מתחת לכל פס שהושלם), .hero-t (שאלת השלב), קוביית שלב אחת,
// שורת ניווט (.row.spread - "חזור" מימין, "המשך" משמאל). חלונות #dlg/#dlg2, טוסט #toast וטולטיפ .pl-tt ב-portal לשורש.
// R01 (להסיר): אין קישור "טיוטה #N" בשורה העליונה.
import '@/design-system/components.css';
import './css/new-order-font.css';
import './css/new-order.css';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import PageVariantToggle from '../variant/PageVariantToggle';
import { Ic, NoBanner, NoPortal, NoPortalRoot } from './NoUi';
import {
  ApprovalDialog, BackGuardDialog, BusyDialog, CompleteCustomerDialog, ConfirmDialog, CreditDialog, DialogFrame, DuplicateCustomerDialog, DuplicateOrderDialog,
  ExitDialog, MessageDialog, SpacingDialog, StockShortageDialog, SuccessDialog, SwipeDialog, successChips,
} from './NoDialogs';
import { CapacitySearchDialog, ItemCapacityDialog } from './NoCapacity';
import useNewOrderController from './useNewOrderController';
import { STEP_KEYS, STEP_META, getCustomerFullName, plural } from './newOrderLogic';
import { shortHeb, stepNextAction, stepSummaries } from './layoutLogic';
import { STEP_VIEW } from './stepViews';
import LayoutContinuous from './LayoutContinuous';

function ProgressBars({ ctl }) {
  const sums = stepSummaries(ctl);
  const doneOf = { customer: !!ctl.order.customerId, dates: ctl.datesFilled, delivery: true, items: ctl.activeItems.length > 0, summary: true, payment: !!ctl.saved };
  return (
    <div className="pbars" id="pbars" aria-label="התקדמות ההזמנה">
      {STEP_KEYS.map((k, i) => {
        const cur = i === ctl.step && !ctl.saved;
        const done = (!!ctl.saved || i < ctl.step) && doneOf[k];
        const meta = STEP_META[k];
        return (
          <div key={k} className={`pb ${done ? 'done' : cur ? 'cur' : 'fut'}`}>
            <div className="pb-bar" role="progressbar" aria-label={meta.l} aria-valuemin={0} aria-valuemax={1} aria-valuenow={done ? 1 : 0}><i /></div>
            {done ? (
              <div className="pb-d" role="button" tabIndex={0} data-tip={`חזרה לשלב ${meta.l}`} onClick={() => !ctl.saved && ctl.go(i)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !ctl.saved) { e.preventDefault(); ctl.go(i); } }}>
                <Ic n={meta.i} c="sm" /><span className="pb-t"><b>{sums[k] || 'הושלם'}</b></span>
              </div>
            ) : <span className="pb-d ph" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

// שורת הניווט מופיעה פעמיים (כמו בעיצוב העדכני B2): מעל השלב (top - .navtop) ומתחתיו - אותם לחצנים ואותה לוגיקה
function Nav({ ctl, top = false }) {
  const k = ctl.stepKey;
  const busy = ctl.saving || ctl.isProcessingCredit;
  const cls = `row spread wrap no-nav${top ? ' navtop' : ''}`;
  if (ctl.saved) {
    return (
      <div className={cls} data-sec="nav">
        <button type="button" className="btn" onClick={ctl.goTarget}><Ic n="file" c="sm" />{ctl.targetLabel}</button>
        <button type="button" className="btn primary" onClick={ctl.newOrder}><Ic n="plus" />הזמנה חדשה</button>
      </div>
    );
  }
  // "הוסף / עריכת משלוח" משלב הפריטים / הסיכום / התשלום: שלב המשלוח חוזר לשלב המקור (ביטול מחזיר את השדות)
  if (k === 'delivery' && ctl.deliveryEdit) {
    const back = STEP_META[ctl.deliveryEdit.to];
    return (
      <div className={cls} data-sec="nav">
        <button type="button" className="btn ghost" onClick={() => ctl.closeDeliveryEdit(false)}><Ic n="x" c="sm" />ביטול</button>
        <button type="button" className="btn primary" disabled={!!ctl.deliveryError} onClick={() => ctl.closeDeliveryEdit(true)}><Ic n="check" />שמור וחזור ל{back ? back.l : 'שלב הקודם'}</button>
      </div>
    );
  }
  const next = stepNextAction(ctl, k); // אותה פעולת "המשך" גם בגושי הטופס הרציף (layoutLogic)
  return (
    <>
      <div className={cls} data-sec="nav">
        {ctl.step > 0
          ? <button type="button" className="btn" disabled={busy} onClick={() => ctl.setStep(ctl.step - 1)}><Ic n="arrr" />חזור</button>
          : <button type="button" className="btn ghost" disabled={busy} onClick={ctl.handleExit}><Ic n="x" c="sm" />ביטול הזמנה</button>}
        {ctl.step > 0 ? <button type="button" className="btn ghost" disabled={busy} onClick={ctl.handleExit}><Ic n="x" c="sm" />ביטול הזמנה</button> : null}
        {next
          ? <button type="button" className="btn primary" disabled={next[1]} onClick={next[2]}><Ic n="arrl" />{next[0]}</button>
          : <button type="button" className="btn primary" disabled={busy} aria-busy={ctl.saving} onClick={ctl.saveOrder}><Ic n="check" />{ctl.saving ? 'שומר...' : 'סיום ויצירת ההזמנה'}</button>}
      </div>
    </>
  );
}

// R29b (הבעלים): תשובות השרת בשמירה - באנר כחול-כהה מתחת לשורת הכותרת עם "פירוט" נפתח (409 חוסר מלאי / שגיאה כללית), ואזהרה אחרי שמירה
// מוצלחת (warning). בלי חלון ובלי alert. בישן: חלון/הודעה מתחת לכפתור - ר' NOTES.md.
function bannerFor(err, warning) {
  if (err) {
    const lines = (err.lines || []).map(t => ({ t, i: 'dress' }));
    const rows = [...lines];
    if (err.spacingNote) rows.push({ t: err.spacingNote, i: 'info' });
    if (err.detail) rows.push({ t: err.detail, i: 'alert' });
    return {
      id: `e:${err.title}:${rows.length}`, title: err.title, rows,
      text: lines.length ? plural(lines.length, 'פריט אחד לא זמין', 'פריטים לא זמינים') : 'ההזמנה לא נשמרה - אפשר לנסות שוב',
    };
  }
  if (warning) return { id: `w:${warning}`, title: 'ההזמנה נשמרה, עם אזהרה', text: 'יש לעיין בפירוט', rows: [{ t: warning, i: 'info' }] };
  return null;
}

// צורת "אשף שלבים" (ברירת מחדל, new_order_layout חסר / 'wizard'): פסי התקדמות, שאלת השלב, שורת ניווט עליונה, השלב הנוכחי ושורת ניווט תחתונה.
// הצורה האחרת (LayoutContinuous.js, 'continuous') מציגה את אותם רכיבי שלב (stepViews.js) בעמוד אחד נגלל - אותו controller, אותן חלונות.
function LayoutWizard({ ctl }) {
  const View = STEP_VIEW[ctl.stepKey];
  const question = useMemo(() => STEP_META[ctl.stepKey].q, [ctl.stepKey]);
  return (
    <>
      <ProgressBars ctl={ctl} />
      <div className="hero-t" id="heroT"><h2 className="hero-q">{question}</h2></div>
      <Nav ctl={ctl} top />
      <div className="no-panels">
        <section className="panel on" id={`p${ctl.step + 1}`}>
          <div className="sec" data-sec={ctl.stepKey}><View ctl={ctl} /></div>
        </section>
      </div>
      <Nav ctl={ctl} />
    </>
  );
}

function Dialog({ ctl, layer }) {
  const d = ctl.dlg[layer];
  if (!d) return null;
  const close = (r) => ctl.answer(layer, r, d.id); // d.id: תשובה מאוחרת של חלון שנסגר לא משפיעה על החלון הבא
  const p = d.props || {};
  let body = null;
  let cls = '';
  let backdrop = () => close(null);
  switch (d.type) {
    case 'approval': body = <ApprovalDialog message={p.message} level={p.level} close={close} />; break;
    case 'confirm': body = <ConfirmDialog {...p} close={close} />; break;
    case 'message': body = <MessageDialog {...p} close={close} />; break;
    case 'stock': body = <StockShortageDialog {...p} close={close} />; break;
    case 'backGuard': body = <BackGuardDialog close={close} />; backdrop = () => close(false); break;
    case 'exit': body = <ExitDialog {...p} close={close} />; backdrop = () => close(false); break;
    case 'spacing': body = <SpacingDialog close={close} />; break;
    case 'dupCustomer': body = <DuplicateCustomerDialog customers={p.customers} settings={ctl.settings} onUse={ctl.handleUseExistingCustomer} onCreate={() => ctl.handleSaveNewCustomerAndProceed(true)}
      onEdit={ctl.inlineCustomerEdit ? (c) => ctl.editCustomerInline(c, 'use') : null} close={close} />; break;
    case 'completeCustomer': body = <CompleteCustomerDialog {...p} close={close} />; backdrop = null; break;
    case 'dupOrder': body = <DuplicateOrderDialog existingOrderId={p.existingOrderId} close={close} />; backdrop = null; break;
    case 'credit':
      body = <CreditDialog data={ctl.creditCardData} setData={ctl.setCreditCardData} error={ctl.creditError} processing={ctl.isProcessingCredit} onCharge={ctl.handleProcessCreditCard}
        onSwipe={() => ctl.ask('swipe', {}, 2)} close={close} autoAdvance={ctl.settings.auto_advance_fixed_fields === 'true'} />;
      backdrop = ctl.isProcessingCredit ? null : () => close(null);
      break;
    case 'swipe':
      body = <SwipeDialog onCard={(c) => { ctl.setCreditCardData(prev => ({ ...prev, ...c })); close(null); }} close={close} />;
      break;
    case 'busy':
      body = p.kind === 'credit'
        ? <BusyDialog title="מבצע חיוב מול נדרים פלוס" sub="אין לסגור את החלון עד לקבלת אישור מחברת האשראי." />
        : <BusyDialog title="יוצר את ההזמנה" sub="מאמת זמינות מלאי, רושם פריטים ומחשב חיובים. נא לא לסגור את החלון." />;
      backdrop = null;
      break;
    case 'success': {
      const s = ctl.saved || {};
      const o = ctl.order;
      body = (
        <>
          {/* R29b: האזהרה אחרי שמירה מוצגת בבאנר מתחת לשורת הכותרת (לא בחלון) */}
          <SuccessDialog orderId={s.orderId} customerName={getCustomerFullName(o.selectedCustomer)} dateLabel={shortHeb(o.isAbroad ? o.fromDate : o.eventDate)}
            chips={successChips({ itemsCount: ctl.activeItems.length, isDelivery: o.isDelivery, deliveryDirection: o.deliveryDirection, balance: ctl.remaining,
              specialSpacing: o.customSpacing !== null && o.customSpacing !== undefined && o.customSpacing < 3, settings: ctl.settings, customerEmail: o.selectedCustomer && o.selectedCustomer.email })}
            targetLabel={ctl.targetLabel} onNew={ctl.newOrder} onPrint={ctl.printSaved} onTarget={ctl.goTarget} close={close} />
        </>
      );
      break;
    }
    default: return null;
  }
  return <DialogFrame key={d.id} layer={layer} cls={cls} onBackdrop={backdrop}>{body}</DialogFrame>;
}

export default function NewOrderA5() {
  const router = useRouter();
  const ctl = useNewOrderController({ router });
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [rootEl, setRootEl] = useState(null);
  const [warnClosed, setWarnClosed] = useState(null); // אזהרת "נשמרה" שנסגרה (לפי מספר ההזמנה)
  const setRoot = useCallback((el) => { rootRef.current = el; setRootEl(el); }, []);
  usePageTooltip(rootRef, ttRef, false);
  const continuous = ctl.layout === 'continuous';
  const t = ctl.toast;
  const savedWarning = ctl.saved && ctl.saved.warning && warnClosed !== ctl.saved.orderId ? ctl.saved.warning : '';
  const banner = bannerFor(ctl.saveError, savedWarning);
  // #app.wide של העיצוב: שלב הפריטים (חיפוש + סל בשתי עמודות) ושלב התשלום כשכבר נרשם תשלום (עמודת "תשלומים שנרשמו") רחבים יותר
  // 8.10.2026 (נווה יעקב): כל השלבים ברוחב שלב הפריטים, כדי שהמסך לא יקפוץ בין שלב לשלב
  const wide = !continuous;

  return (
    <div className="gm-ds gm-no home-bg dlg-dark" dir="rtl" ref={setRoot}>
      <NoPortalRoot.Provider value={rootEl}>
        <HomeSprite />
        <div className={`app no-app${wide ? ' wide' : ''}${continuous ? ' no-flowapp' : ''}`} id="app">
          <div className="topbar">
            <button type="button" className="back" aria-label="יציאה מהמסך" data-tip="יציאה מהמסך" onClick={ctl.handleExit} disabled={ctl.saving || ctl.isProcessingCredit}><Ic n="back" /></button>
            <div className="ttl"><h1><bdi>הזמנה חדשה</bdi></h1></div>
            <div className="tools">
              {/* "חזרה לאשף הישן" (6.10.2026): רק להנהלה ראשית / מתכנת (הרשומה new_order ב-lib/uiVariantScreens.js); הטולטיפ - usePageTooltip של הדף (data-tip) */}
              <PageVariantToggle screen="new_order" placement="header" systemTip />
            </div>
          </div>
          {banner ? <NoBanner key={banner.id} id={banner.id} title={banner.title} text={banner.text} rows={banner.rows}
            onClose={() => (ctl.saveError ? ctl.setSaveError(null) : setWarnClosed(ctl.saved.orderId))} /> : null}
          {continuous ? <LayoutContinuous ctl={ctl} /> : <LayoutWizard ctl={ctl} />}
          {/* אחרי שמירה גם הטופס הרציף מציג את שורת "לכרטיס ההזמנה / הזמנה חדשה" (אותה Nav) */}
          {continuous && ctl.saved ? <Nav ctl={ctl} /> : null}
        </div>
        <NoPortal>
          {t ? (
            <div id="toast" className={`${t.kind === 'ok' ? 'info' : t.kind} on pulse`} data-kind={t.kind} role="status" aria-live="polite" key={t.n}>
              <button type="button" className="tclose" data-tip="סגור" aria-label="סגירה" onClick={() => ctl.setToast(null)}><Ic n="x" c="sm" /></button>
              <div className="tb"><Ic n={t.kind === 'ok' ? 'check' : 'info'} c="lg" /></div>
              <div><b>{t.big}</b>{t.small ? <small>{t.small}</small> : null}</div>
            </div>
          ) : null}
          <Dialog ctl={ctl} layer={1} />
          <Dialog ctl={ctl} layer={2} />
          {/* R22: "בדוק תפוסה" בפלטה (#dlg2 כהה) עם מתג רשימה / לוח - מצב של הבקר, לא חלון עם תשובה */}
          {ctl.capacityItem ? <ItemCapacityDialog key="capItem" item={ctl.capacityItem} order={ctl.order} currentOrderId={ctl.draftOrderId} onClose={() => ctl.setCapacityItem(null)} /> : null}
          {ctl.showCapacitySearch ? <CapacitySearchDialog key="capSearch" onClose={() => ctl.setShowCapacitySearch(false)} /> : null}
        </NoPortal>
        <div className="pl-tt" role="tooltip" ref={ttRef} />
      </NoPortalRoot.Provider>
    </div>
  );
}
