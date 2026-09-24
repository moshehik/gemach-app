'use client';

import React, { useState } from 'react';
import { calculateOrderStatus } from '../../../lib/orderStatus';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import OrderPrintMenu from '../OrderPrintMenu';
import {
  Btn, IconBtn, Card, Chip, Badge, Tabs, Tip, Icon, Row, Stepper, Dialog, Banner
} from '../../../app/v3/ui/components';
import { TipWrap } from './orderCardDialogs';
import './orderCardV3.css';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus ב-lib/orderStatus.js, משותף לכמה עמודים) אל
// וריאנט ה-Chip של v3: סטטוס = ניטרלי/navy, "דורש תשומת לב" = אפרסק (ר' DESIGN-LANGUAGE 1.2).
// ערכי הסטטוס עצמם מושווים בקוד - לא משנים אותם.
const getStatusChipVariant = (status) => {
  switch (status) {
    case 'הוחזר':
      return 'done';
    case 'הוחזר חלקי':
      return 'attn';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'info';
    case 'בקרוב':
      return 'attn';
    case 'עבר':
    case 'מחוק':
    case 'טיוטה':
    default:
      return undefined;
  }
};

const TABS = [
  { id: 'details', label: 'פרטים', icon: 'user' },
  { id: 'items', label: 'פריטים', icon: 'bag', withCount: true },
  { id: 'payments', label: 'תשלומים', icon: 'card' },
  { id: 'history', label: 'היסטוריה', icon: 'history' }
];

const iconNameFromHref = (href) => String(href || '').replace(/^#?i-/, '') || 'info';

/**
 * המעטפת של כרטיס ההזמנה בעיצוב v3: כותרת עם כלים, ציר זמן, כרטיס סיכום (לקוח + סריקה מהירה),
 * לשוניות ותוכן, ורייל צד (במבט אחד + שינויים ממתינים + חשבון + שמירה).
 * כל ארבעת הלשוניות נשארים mounted (מוסתרים בסגנון בלבד) כדי לשמור על סטייט פנימי ו-refs של
 * מנהלי הפריטים/התשלומים - אסור להמיר לרינדור מותנה.
 */
export default function ModernOrderCard({
  order,
  items,
  activeTab,
  onTabChange,
  totalRequired,
  totalPaid,
  openedDebt,
  saving,
  saveMessage,
  hasUnsavedChanges,
  isLocked,
  isPastEvent,
  onUnlock,
  onLock,
  onSave,
  onCancelChanges,
  onDelete,
  onExit,
  onToggleSignature,
  onOrderUpdate,
  onQuickScan,
  onWalletClick,
  tabContents,
  // פונקציה שמחזירה שורות "מה השתנה" (אייקון + טקסט) - buildChangeRows בעמוד. להצגה ברייל בלבד.
  getChangeRows,
  // draft_orders_show_as_deleted (SystemSetting) - see lib/orderStatus.js calculateOrderStatus;
  // when on, an autosaved-but-never-finished order shows this badge as "מחוק" instead of "טיוטה".
  draftsAsDeleted = false
}) {
  const [scanValue, setScanValue] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  // גיליון הסיכום במובייל/טאבלט (עיצוב בלבד): מקופל כברירת מחדל, נפתח בלחיצה על הכותרת שלו.
  const [railOpen, setRailOpen] = useState(false);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const changeRows = (hasUnsavedChanges && getChangeRows) ? getChangeRows() : [];
  const debt = totalRequired - totalPaid;
  // שמירה לא תבקש אישור מנהל אם החוב זהה לזה שהיה כשהכרטיס נטען (ר' handleSave בעמוד) - התג
  // מציג את אותה הבחנה כדי לא להבהיל על אישור שלא באמת ידרש בלחיצה על שמירה.
  const debtUnchangedSinceOpen = openedDebt !== undefined && openedDebt !== null
    && Math.round(debt * 100) === Math.round(openedDebt * 100);
  const saveNeedsApproval = debt > 0 && !debtUnchangedSinceOpen;

  const orderStatus = calculateOrderStatus(order, { draftsAsDeleted });

  const customer = order.customer;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
  const initials = customer ? (`${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?') : '?';

  const eventDateLabel = (order.isAbroad || order.isWeekdayEvent)
    ? (order.fromDate ? `${getHebrewDateString(order.fromDate)} — ${getHebrewDateString(order.toDate || order.returnDate)}` : 'אירוע חו"ל')
    : (order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'ללא תאריך אירוע'));

  const updatedValue = order.updatedAt
    ? `${getHebrewDateString(order.updatedAt)} · ${new Date(order.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const isErrorMsg = saveMessage && (saveMessage.includes('שגיאה') || saveMessage.includes('בוטלה'));

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanValue('');
    onQuickScan(code);
  };

  const handleLockClick = async () => {
    if (isLocked) {
      setShowUnlockModal(true);
    } else if (onLock) {
      const msg = 'לנעול מחדש את ההזמנה?';
      const confirmed = window.customConfirm ? await window.customConfirm(msg) : window.confirm(msg);
      if (confirmed) onLock();
    }
  };

  const handleWallet = () => (onWalletClick ? onWalletClick() : onTabChange('payments'));

  // ---- ציר זמן: מחושב מנתונים קיימים בלבד (פריטים נלקחו/הוחזרו + תאריכי ההזמנה) ----
  const isAbroad = !!(order.isAbroad || order.isWeekdayEvent);
  const takenCount = activeItems.filter(i => i.isTaken).length;
  const returnedCount = activeItems.filter(i => i.isReturned).length;
  const createdAt = order.orderDate || order.createdAt;
  let currentStep = 1;
  if (activeItems.length > 0 && returnedCount === activeItems.length) currentStep = 3;
  else if (takenCount > 0) currentStep = 2;
  const steps = [
    { key: 'ordered', label: 'הזמנה', icon: 'file', value: createdAt ? getHebrewDateString(createdAt) : undefined },
    {
      key: 'pickup', label: 'לקיחה', icon: 'bag',
      value: isAbroad && order.fromDate ? getHebrewDateString(order.fromDate) : (takenCount > 0 ? `${takenCount}/${activeItems.length}` : undefined)
    },
    { key: 'event', label: 'אירוע', icon: 'calendar', value: isAbroad ? undefined : eventDateLabel },
    {
      key: 'return', label: 'החזרה', icon: 'refresh',
      value: isAbroad && (order.toDate || order.returnDate) ? getHebrewDateString(order.toDate || order.returnDate) : (returnedCount > 0 ? `${returnedCount}/${activeItems.length}` : undefined)
    }
  ];

  // ---- לשוניות (הפאנלים עצמם תמיד mounted) ----
  const customerIncomplete = !!customer && (!customer.phone1 || !customer.email);
  const tabItems = TABS.map(tab => {
    let label = tab.label;
    if (tab.id === 'details' && customerIncomplete) {
      label = (<>{tab.label}<span className="v3-tabmark"><Icon name="alert-circle" /></span><span className="v3-sr">חסרים פרטי לקוח</span></>);
    }
    if (tab.id === 'payments' && debt !== 0) {
      label = (<>{tab.label}<span className={`v3-tabmark${debt > 0 ? ' v3-tabmark--debt' : ''}`}><Icon name={debt > 0 ? 'alert-circle' : 'wallet'} /></span><span className="v3-sr">{debt > 0 ? 'יש חוב' : 'יש זכות'}</span></>);
    }
    return { key: tab.id, label, icon: tab.icon, count: tab.withCount ? activeItems.length : undefined };
  });

  const money = (n) => <bdi dir="ltr">₪{Math.abs(n).toLocaleString('he-IL')}</bdi>;

  return (
    <div className="oc-page">
      {/* כותרת: חזרה + מספר הזמנה + חתימה + כלים */}
      <header className="v3-pagehead">
        <TipWrap content="חזרה לרשימה. אם יש שינויים שלא נשמרו, נשאל אם לשמור אותם קודם.">
          <IconBtn round icon="back" label="חזרה לרשימת ההזמנות" onClick={() => onExit()} />
        </TipWrap>
        <div className="v3-pagehead__title">
          <h1 className="v3-h1"><small>הזמנה</small><bdi>#{order.orderId}</bdi></h1>
          <Chip
            variant={order.hasSignedRegulations ? 'done' : 'attn'}
            icon={order.hasSignedRegulations ? 'check-circle' : 'x-circle'}
            onClick={onToggleSignature}
            aria-label={order.hasSignedRegulations ? 'הלקוח חתם על התקנון - לחיצה לשינוי' : 'הלקוח לא חתם על התקנון - לחיצה לשינוי'}
          >
            {order.hasSignedRegulations ? 'חתם על התקנון' : 'לא חתם על התקנון'}
          </Chip>
        </div>
        <div className="v3-pagehead__tools">
          {debt !== 0 ? (
            <TipWrap content={debt > 0 ? 'יש חוב פתוח. לחיצה פותחת את התשלומים.' : 'ללקוח מגיע זיכוי. לחיצה פותחת את התשלומים.'}>
              <Btn icon="wallet" onClick={handleWallet} aria-label={debt > 0 ? 'חוב פתוח - מעבר לתשלומים' : 'יתרת זכות - מעבר לתשלומים'}>
                {money(debt)}
              </Btn>
            </TipWrap>
          ) : (
            <TipWrap content="ההזמנה שולמה במלואה.">
              <IconBtn icon="wallet" label="שולם במלואו - מעבר לתשלומים" onClick={handleWallet} />
            </TipWrap>
          )}

          {isPastEvent && (
            <TipWrap content={isLocked
              ? 'תאריך האירוע עבר, אז ההזמנה נעולה: אפשר להחזיר בלבד. שחרור לעריכה דורש אישור מנהל.'
              : 'ההזמנה פתוחה לעריכה. לחיצה נועלת אותה מחדש.'}
            >
              <IconBtn
                icon={isLocked ? 'lock' : 'unlock'}
                variant={isLocked ? 'primary' : 'secondary'}
                label={isLocked ? 'ההזמנה נעולה - שחרור באישור מנהל' : 'נעילה מחדש של ההזמנה'}
                onClick={handleLockClick}
              />
            </TipWrap>
          )}

          <OrderPrintMenu
            order={order}
            onOrderUpdate={onOrderUpdate}
            triggerClassName="v3-btn v3-btn--icon"
            triggerTitle="הדפסה ושליחה במייל"
          />

          <TipWrap content="מחיקת ההזמנה">
            <IconBtn variant="danger" icon="trash" label="מחיקת הזמנה" onClick={onDelete} />
          </TipWrap>
        </div>
      </header>

      {saveMessage && (
        <Banner kind={isErrorMsg ? 'alert' : 'success'} title={saveMessage} />
      )}

      {/* ציר זמן ההזמנה */}
      <Stepper steps={steps} current={currentStep} showAnchor={false} label="שלבי ההזמנה" />

      <div className="v3-layout">
        <main className="v3-main">
          {/* כרטיס סיכום: לקוח, סטטוס, אירוע, סריקה מהירה */}
          <Card
            variant="cust"
            title={(
              <span className="oc-cust-title">
                <span className="v3-avatar oc-avatar" aria-hidden="true">{initials}</span>
                {customerName}
              </span>
            )}
            actions={(
              <Chip variant={getStatusChipVariant(orderStatus)} icon="clock">{orderStatus}</Chip>
            )}
          >
            <div className="oc-facts">
              {customer && (
                <Row icon="phone" label="טלפון" missing={!customer.phone1}>
                  <bdi dir="ltr">{customer.phone1}</bdi>
                </Row>
              )}
              {customer && (
                // כתובת מייל בכרטיס סיכום ההזמנה - כדי שיהיה ברור מיד אם יש ללקוח
                // מייל מעודכן, בלי לפתוח את טאב "פרטי לקוח" (דיווח 26362585).
                <Row icon="mail" label="מייל" missing={!customer.email}>
                  <bdi dir="ltr">{customer.email}</bdi>
                </Row>
              )}
              <Row icon="calendar" label="מועד האירוע">{eventDateLabel}</Row>
              {updatedValue && <Row icon="history" label="עודכן לאחרונה">{updatedValue}</Row>}
            </div>

            <div className="v3-field" style={{ marginTop: 'var(--v3-sp-5)' }}>
              <label className="v3-label" htmlFor="oc-quick-scan">
                <span className="oc-scan-label">
                  סריקה מהירה
                  <Tip>סורקים ברקוד אחרי ברקוד ברצף: כל שמלה מושכרת או מוחזרת אוטומטית, בלי לפתוח אותה בנפרד בלשונית הפריטים.</Tip>
                </span>
              </label>
              {/* השדה מתאפס ונשאר בפוקוס אחרי כל סריקה (handleScanSubmit) - אפשר
                  לסרוק ברקוד אחרי ברקוד ברצף בלי ללחוץ בכל פריט בנפרד על "השכרה". */}
              <form className="v3-scan" onSubmit={handleScanSubmit}>
                <Icon name="tag" />
                <input
                  id="oc-quick-scan"
                  type="text"
                  value={scanValue}
                  onChange={e => setScanValue(e.target.value)}
                  placeholder="ברקוד להשכרה או להחזרה"
                />
              </form>
            </div>
          </Card>

          <div style={{ marginTop: 'var(--v3-gap-panel)' }}>
            <Tabs items={tabItems} value={activeTab} onChange={onTabChange} label="חלקי ההזמנה" />
          </div>

          {TABS.map(tab => (
            <div
              key={tab.id}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              hidden={activeTab !== tab.id}
              className="v3-panel"
              style={activeTab === tab.id ? undefined : { display: 'none' }}
            >
              {tabContents[tab.id]}
            </div>
          ))}
        </main>

        {/* רייל צד: במבט אחד, שינויים ממתינים, חשבון ופעולות שמירה */}
        <aside className="v3-rail" aria-label="סיכום ופעולות">
          <div className={`v3-rail-card oc-rail-card${railOpen ? ' is-open' : ''}`}>
            <button type="button" className="oc-rail-toggle" aria-expanded={railOpen} onClick={() => setRailOpen(o => !o)}>
              <Icon name="list" />
              <span>סיכום ושינויים</span>
              {hasUnsavedChanges && <Badge variant="gold">{Math.max(changeRows.length, 1)}</Badge>}
              <Icon name="chevron-down" />
            </button>
            <div className="oc-rail-more">
            <div className="v3-rail__h"><Icon name="list" /><span>במבט אחד</span></div>
            <div className="v3-glance">
              <TipWrap className="oc-tipfill" content={order.hasSignedRegulations ? 'הלקוח חתם על התקנון. לחיצה משנה את הסימון.' : 'הלקוח עוד לא חתם על התקנון. לחיצה משנה את הסימון.'}>
                <button type="button" className={`v3-tile${order.hasSignedRegulations ? '' : ' v3-tile--missing'}`} onClick={onToggleSignature}>
                  <Icon name={order.hasSignedRegulations ? 'check-circle' : 'x-circle'} />
                  <span className="v3-tile__v">{order.hasSignedRegulations ? 'חתם' : 'לא חתם'}</span>
                </button>
              </TipWrap>
              {order.isDelivery && (
                <Tip content={`משלוח ${order.deliveryDirection || 'הלוך-חזור'}${order.deliveryCity ? ` · ${order.deliveryCity}` : ''}`}>
                  <span className="v3-tile">
                    <Icon name="truck" />
                    <span className="v3-tile__v">{order.deliveryDirection || 'הלוך-חזור'}</span>
                  </span>
                </Tip>
              )}
              <Tip content="מספר הפריטים הפעילים בהזמנה (בלי פריטים שהוסרו).">
                <span className="v3-tile">
                  <Icon name="bag" />
                  <span className="v3-tile__v">{activeItems.length === 1 ? 'פריט אחד' : `${activeItems.length} פריטים`}</span>
                </span>
              </Tip>
              <TipWrap className="oc-tipfill" content="מצב התשלום. לחיצה פותחת את לשונית התשלומים.">
                <button type="button" className={`v3-tile${debt > 0 ? ' v3-tile--debt' : debt < 0 ? ' v3-tile--credit' : ''}`} onClick={handleWallet}>
                  <Icon name="card" />
                  <span className="v3-tile__v">
                    {debt > 0 ? <>חוב {money(debt)}</> : debt < 0 ? <>זכות {money(debt)}</> : 'שולם'}
                  </span>
                </button>
              </TipWrap>
            </div>

            <div className="v3-rail__h">
              <Icon name="list" /><span>שינויים בהזמנה</span>
              <span className="oc-rail-tip oc-rail-count">
                <Tip>כאן מופיע כל מה שהשתנה מאז השמירה האחרונה. הסכום הסופי מתעדכן אחרי השמירה.</Tip>
              </span>
            </div>
            <div className="v3-rail__body">
              {hasUnsavedChanges ? (
                changeRows.length > 0 ? (
                  changeRows.map((r, i) => (
                    <div className="v3-cl" key={i}>
                      <div className="v3-cl__i"><Icon name={iconNameFromHref(r.icon)} /></div>
                      <div className="v3-cl__t"><span>{r.text}</span></div>
                    </div>
                  ))
                ) : (
                  <div className="v3-cl">
                    <div className="v3-cl__i"><Icon name="edit" /></div>
                    <div className="v3-cl__t"><span>יש שינויים שלא נשמרו</span></div>
                  </div>
                )
              ) : (
                <div className="v3-cart-empty"><Icon name="check" size="lg" /><span>אין שינויים ממתינים</span></div>
              )}

              <div className="oc-status-block">
                <div className={`v3-status${debt > 0 ? ' v3-status--debt' : debt < 0 ? ' v3-status--credit' : ''}`}>
                  <Icon name={debt > 0 ? 'alert-circle' : debt < 0 ? 'wallet' : 'check'} size="lg" />
                  <div>
                    <small>{debt > 0 ? 'יתרת חוב' : debt < 0 ? 'יתרת זכות' : 'מצב חשבון'}</small>
                    <div className="v3-status__n">{debt !== 0 ? money(debt) : 'שולם במלואו'}</div>
                  </div>
                </div>
              </div>
            </div>

            </div>

            <div className="v3-rail__actions">
              <div className="oc-save-row">
                <Btn variant="primary" size="lg" icon="check" loading={saving} onClick={() => onSave()}>
                  שמור שינויים
                  {!saving && saveNeedsApproval && (
                    <> <Chip variant="attn" icon="shield">{money(debt)}</Chip></>
                  )}
                </Btn>
                {saveNeedsApproval && (
                  <span className="oc-rail-tip">
                    <Tip label="למה נדרש אישור?">שמירה עם חוב פתוח תדרוש אישור מנהל.</Tip>
                  </span>
                )}
              </div>
              <Btn variant="on-dark" icon="refresh" onClick={onCancelChanges} disabled={!hasUnsavedChanges || saving}>
                בטל שינויים
              </Btn>
              <Btn variant="on-dark" icon="back" onClick={() => onExit()}>
                שמירה וחזרה לרשימה
              </Btn>
            </div>
          </div>
        </aside>
      </div>

      {/* אישור שחרור נעילה (הזמנה שתאריך האירוע שלה עבר) - חלונית אישור, כהה/בהיר */}
      <Dialog
        open={showUnlockModal}
        variant="confirm"
        mode="light"
        icon="lock"
        title="ההזמנה נעולה"
        sub="תאריך האירוע עבר, ולכן השכרה, עריכה ומחיקה של פריטים חסומות. החזרות, תשלומים וזיכויים ממשיכים לעבוד כרגיל. שחרור מלא לעריכה דורש אישור מנהל."
        closeOnScrim={!unlocking}
        onClose={() => { if (!unlocking) setShowUnlockModal(false); }}
        actions={(
          <>
            <Btn
              variant="primary"
              icon="unlock"
              loading={unlocking}
              onClick={async () => {
                setUnlocking(true);
                try {
                  await onUnlock();
                } finally {
                  setUnlocking(false);
                  setShowUnlockModal(false);
                }
              }}
            >
              {unlocking ? 'מאמת...' : 'שחרר באישור מנהל'}
            </Btn>
            <Btn variant="quiet" disabled={unlocking} onClick={() => setShowUnlockModal(false)}>ביטול</Btn>
          </>
        )}
      />
    </div>
  );
}
