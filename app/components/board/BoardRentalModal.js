'use client';

import { useEffect, useRef } from 'react';
import { useLabels } from '@/app/components/LabelsContext';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { getStatusColor } from '@/lib/orderStatus';
import OrderPrintMenu from '@/components/orders/OrderPrintMenu';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '@/components/HistoryViewer';
import { useRentalReturn, formatHistoryValue } from '@/components/orders/useRentalReturn';
import { LzPortal } from '../schedule/LzPortal';
import { Ic } from './BoardParts';

// חלון "השכרה והחזרה" של הלוח בעיצוב החדש (BRD-E16 "כן ויש עיצוב חדש"; BRD-UNV-6 "לא תקציר - מלא").
// כל הפונקציונליות של RentalReturnModal - אותו hook בדיוק (components/orders/useRentalReturn.js: אותן קריאות API, אותם
// טקסטים, אותם שלבי אישור): סריקה מהירה (השכרה/החזרה לפי הברקוד), השכרה לפריט עם ברקוד, הקלדה ידנית כפולה + אישור,
// בחירה בין פריטים זהים, אישור/ביטול סריקות ממתינות, החזרה תקינה / לא תקינה (+ הערה, הצעה לחסום לקוח, שאלת איחור),
// ביטול השכרה / החזרה, דיווח על בעיה, סימון חזרה כתקין, פרטי פריט + היסטוריה, הדפסה ומייל, פתיחת ההזמנה בטאב חדש,
// שמירה וסגירה / ביטול / יציאה עם שינויים שלא נשמרו (גם בלחיצה כפולה על הרקע, כמו קודם).
// העיצוב: רכיבי הפלטה ושורות הלו״ז (scrim/dlg, inpw/inp, lz-banner, card lz-st + hres/hrow, chip, btn, ibtn).
// הודעות: טוסט של הפלטה (במקום alert); "בטוח?" והערה: החלון הכהה של הפלטה (BoardDialogs.js, במקום customConfirm/Prompt).

const TONE_CHIP = { success: 'green', danger: 'red', warning: 'gold', neutral: 'gray' };

function statusChip(status) {
  const c = getStatusColor(status).text || '';
  if (/success/.test(c)) return 'green';
  if (/danger/.test(c)) return 'red';
  if (/info/.test(c)) return 'blue';
  if (/accent/.test(c)) return 'rose';
  if (/warning/.test(c)) return 'gold';
  return 'gray';
}

const fmtTime = (d) => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

export default function BoardRentalModal({ orderId, onClose, onUpdate, ui }) {
  const { getLabel } = useLabels();
  const r = useRentalReturn({ orderId, onClose, onUpdate, ui });
  const {
    selectedOrder, setSelectedOrder, loading, enableAlterations, modalBarcode, setModalBarcode, modalBarcodeRef,
    isProcessing, isConfirming, isBusy, duplicates, setDuplicates, itemDetails, setItemDetails, rentingItemId, setRentingItemId,
    inlineBarcode, setInlineBarcode, manualEntryItemId, setManualEntryItemId, manualBarcode1, setManualBarcode1, manualBarcode2,
    setManualBarcode2, manualSigned, setManualSigned, activeItems, pendingCount, overallStatus, confirmManualEntry, cancelManualEntry,
    selectDuplicate, handleGlobalBarcodeScan, confirmInlineRent, confirmRental, undoReturn, undoRental, showItemDetails, reportIssue,
    markReturnGoodAgain, handleMarkReturnGood, handleMarkReturnBad, handleHeaderSave, handleHeaderCancel, attemptCloseCard,
    handlePrintPreConfirm, getItemStatus,
  } = r;

  // Esc = כמו לחצן הסגירה (יציאה עם בדיקת שינויים שלא נשמרו). חלונות שמעליו (פרטי פריט / פריטים זהים / "בטוח?") קודמים.
  const attemptRef = useRef(attemptCloseCard);
  attemptRef.current = attemptCloseCard;
  const subOpen = !!(itemDetails || duplicates);
  const subRef = useRef(subOpen);
  subRef.current = subOpen;
  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      if (subRef.current) { setItemDetails(null); setDuplicates(null); return; }
      attemptRef.current();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [setItemDetails, setDuplicates]);

  const o = selectedOrder;
  const busy = isProcessing || isConfirming || isBusy;
  const custName = o && o.customer ? `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() : 'לא צוין לקוח';
  const eventText = o && o.eventDate
    ? ((o.isAbroad || o.isWeekdayEvent)
      ? (o.fromDate ? `${getHebrewDateString(o.fromDate)} — ${getHebrewDateString(o.toDate || o.returnDate)}` : 'אירוע חו"ל')
      : (o.eventDateHebrew || getHebrewDateString(o.eventDate)))
    : '';

  return (
    <LzPortal>
      <div className="scrim on bd-scrim bd-rent-scrim" role="presentation" onDoubleClick={(e) => { if (e.target === e.currentTarget) attemptCloseCard(); }}>
        <div className="dlg bd-rent" role="dialog" aria-modal="true" aria-labelledby="bdRentT" aria-busy={busy || loading} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {loading || !o ? (
            <div className="empty bd-rload" role="status"><span className="mspin" /><div>טוען נתוני השכרה...</div></div>
          ) : (
            <>
              <div className="bd-dh">
                <div className="bd-dht">
                  <span className="adm-hi"><Ic name="box" /></span>
                  <div>
                    <h2 id="bdRentT">השכרה והחזרה — הזמנה #{o.orderId}</h2>
                    <div className="faint bd-rsub">
                      <span><Ic name="user" className="sm" />{custName}</span>
                      {o.customer?.phone1 ? <span><Ic name="phone" className="sm" /><bdi dir="ltr">{o.customer.phone1}</bdi></span> : null}
                      {eventText ? <span><Ic name="cal" className="sm" />{eventText}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="bd-dx">
                  <span className={'chip ' + statusChip(overallStatus)}><Ic name="clock" />{overallStatus}</span>
                  {busy ? <span className="mspin" role="status" aria-label="מעבד..." /> : null}
                  <a className="ibtn bd-rb" href={`/orders/${o.orderId}`} target="_blank" rel="noopener noreferrer" aria-label="פתח כרטיס הזמנה בטאב חדש" data-tip="פתח כרטיס הזמנה בטאב חדש"><Ic name="ext" /></a>
                  <span className="bd-pm">
                    <OrderPrintMenu
                      order={o}
                      onOrderUpdate={(patch) => setSelectedOrder((prev) => (prev ? { ...prev, ...patch } : prev))}
                      triggerClassName="ibtn bd-rb"
                      triggerTitle="הדפסה ומייל"
                      preConfirm={handlePrintPreConfirm}
                      skipRegulationsCheck
                    />
                  </span>
                  <button type="button" className="ibtn bd-rb" onClick={attemptCloseCard} aria-label="סגור חלון" data-tip="סגור חלון"><Ic name="x" /></button>
                </div>
              </div>

              <form className="bd-scan" onSubmit={handleGlobalBarcodeScan}>
                <div className="inpw">
                  <Ic name="scan" />
                  <input
                    ref={modalBarcodeRef}
                    className="inp"
                    type="text"
                    value={modalBarcode}
                    onChange={(e) => setModalBarcode(e.target.value.replace(/\s+/g, ''))}
                    placeholder="סריקה מהירה — השכרה / החזרה"
                    aria-label="סריקה מהירה — השכרה / החזרה"
                    disabled={isProcessing}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore=""
                    data-form-type="other"
                  />
                </div>
                <button type="submit" hidden>סרוק</button>
              </form>

              {(o.orderNotes || o.notes) ? (
                <div className="lz-banner bd-note" role="note"><Ic name="note" /><span><b>הערות להזמנה: </b>{o.orderNotes || o.notes}</span></div>
              ) : null}

              {pendingCount > 0 ? (
                <div className="lz-banner bd-pend" role="status">
                  <Ic name="alert" />
                  <span>{pendingCount} פריטים נסרקו וממתינים לאישור השכרה</span>
                  <button type="button" className="btn primary sm" onClick={confirmRental} disabled={isConfirming || isBusy}>
                    {isConfirming ? 'מאשר...' : `אשר את הפריטים שנסרקו (${pendingCount})`}
                  </button>
                </div>
              ) : null}

              {activeItems.length === 0 ? (
                <div className="empty" role="status"><Ic name="box" className="lg" /><div>אין פריטים בהזמנה זו</div></div>
              ) : (
                <div className="card lz-st bd-rst">
                  <div className="hres"><div className="hgrp">
                    {activeItems.map((item) => {
                      const status = getItemStatus(item);
                      const isRenting = rentingItemId === item.id;
                      const sub = [
                        `${getLabel('item_size', 'מידה')}: ${item.sizeText || '-'}`,
                        item.barcode ? `${getLabel('item_barcode', 'ברקוד')}: ${item.barcode}${item.manualBarcodeEntry ? ' (הוזן ידנית)' : ''}` : '',
                        item.isTaken ? `לקיחה: ${item.takenDate ? getHebrewDateString(item.takenDate) : 'לא ידוע'}` : '',
                        item.isReturned ? `הוחזר: ${item.returnDate ? getHebrewDateString(item.returnDate) : 'לא ידוע'}` : '',
                      ].filter(Boolean);
                      return (
                        <article key={item.id} className={'hrow irow lz-r bd-ri' + (item.isReturned ? ' lz-done' : '')}>
                          <div className="li lrow">
                            <div className="ic-b"><Ic name="dress" /></div>
                            <div className="t">
                              <b>{item.description}</b>
                              <span className="ln">{sub.map((p, i) => <span key={i} className="lz-p">{i ? ' · ' : ''}<span className="lz-pn">{p}</span></span>)}</span>
                            </div>
                            <div className="lz-act">
                              {enableAlterations ? ((item.alterationDetails || item.repairs) ? (
                                <button type="button" className="chip rose bd-chipbtn" data-tip="יש תיקונים - לחצו לצפייה בפרטים" onClick={() => showItemDetails(item)}><Ic name="scissors" />תיקונים</button>
                              ) : <span className="chip gray bd-dim">ללא תיקונים</span>) : null}
                              <span className={'chip ' + (TONE_CHIP[status.tone] || 'gray')}>{status.text}</span>

                              {!item.barcode && !item.isTaken && !isRenting ? (
                                <button type="button" className="btn primary sm" onClick={() => setRentingItemId(item.id)}><Ic name="box" />השכרה</button>
                              ) : null}
                              {item.barcode && !item.isTaken ? <span className="chip gold bd-wait">ממתין לאישור השכרה</span> : null}
                              {item.isTaken ? (
                                <>
                                  <span className="bd-tg" role="group" aria-label="מצב הפריט בהחזרה">
                                    <button type="button" className={'btn sm bd-tgb' + (item.isReturned && item.returnedOk ? ' on' : '')} onClick={() => handleMarkReturnGood(item)} disabled={item.isReturned || isBusy} aria-pressed={!!(item.isReturned && item.returnedOk)} data-tip="החזרה תקינה"><Ic name="check" />תקין</button>
                                    <button type="button" className={'btn sm bd-tgb bd-tgbad' + (item.isReturned && !item.returnedOk ? ' on' : '')} onClick={() => handleMarkReturnBad(item)} disabled={item.isReturned || isBusy} aria-pressed={!!(item.isReturned && !item.returnedOk)} data-tip="לא תקין"><Ic name="alert" />לא תקין</button>
                                  </span>
                                  {!item.isReturned ? (
                                    <button type="button" className="btn ghost sm bd-danger" disabled={isBusy} onClick={() => undoRental(item.id)}><Ic name="undo" />ביטול השכרה</button>
                                  ) : (
                                    <>
                                      <button type="button" className="btn ghost sm bd-danger" disabled={isBusy} onClick={() => undoReturn(item.id)}><Ic name="undo" />ביטול החזרה</button>
                                      {item.returnedOk ? (
                                        <button type="button" className="btn ghost sm bd-danger" disabled={isBusy} onClick={() => reportIssue(item.id, 'returned-bad')}><Ic name="alert" />דווח על בעיה</button>
                                      ) : (
                                        <button type="button" className="btn ghost sm" disabled={isBusy} onClick={() => markReturnGoodAgain(item.id)}><Ic name="check" />סמן כתקין</button>
                                      )}
                                    </>
                                  )}
                                </>
                              ) : null}
                              <button type="button" className="ibtn bd-info" aria-label="פרטים נוספים והיסטוריה" data-tip="פרטים נוספים והיסטוריה" onClick={() => showItemDetails(item)}><Ic name="info" /></button>
                            </div>
                          </div>

                          {!item.barcode && !item.isTaken && isRenting ? (
                            <div className="bd-rin">
                              <div className="bd-rinr">
                                <div className="inpw bd-rinb">
                                  <Ic name="scan" />
                                  <input
                                    className="inp"
                                    type="text"
                                    autoFocus
                                    dir="ltr"
                                    placeholder="סרוק ברקוד"
                                    aria-label={'ברקוד להשכרת ' + item.description}
                                    value={inlineBarcode[item.id] || ''}
                                    onChange={(e) => setInlineBarcode((prev) => ({ ...prev, [item.id]: e.target.value.replace(/\s+/g, '') }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmInlineRent(item); } }}
                                  />
                                </div>
                                <button type="button" className="btn primary sm" disabled={isBusy} onClick={() => confirmInlineRent(item)}><Ic name="check" />אשר</button>
                                <button type="button" className="ibtn bd-rb" aria-label="ביטול" data-tip="ביטול" disabled={isBusy} onClick={() => { setRentingItemId(null); if (manualEntryItemId === item.id) cancelManualEntry(); }}><Ic name="x" /></button>
                              </div>
                              {manualEntryItemId === item.id ? (
                                <div className="lz-banner bd-man">
                                  <b>הברקוד לא נקרא - הקלדה ידנית</b>
                                  <input className="inp" type="text" dir="ltr" placeholder="הקלד את מספר הברקוד" aria-label="הקלד את מספר הברקוד" value={manualBarcode1} onChange={(e) => setManualBarcode1(e.target.value.replace(/\s+/g, ''))} disabled={isBusy} autoComplete="off" />
                                  <input className="inp" type="text" dir="ltr" placeholder="הקלד שוב לאימות" aria-label="הקלד שוב לאימות" value={manualBarcode2} onChange={(e) => setManualBarcode2(e.target.value.replace(/\s+/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmManualEntry(item); } }} disabled={isBusy} autoComplete="off" />
                                  <div className="trow bd-mantr">
                                    <label className="sw"><input type="checkbox" id={'bdSign' + item.id} checked={manualSigned} onChange={(e) => setManualSigned(e.target.checked)} disabled={isBusy} /><i /></label>
                                    <label htmlFor={'bdSign' + item.id}>אני מאשרת שהשמלה אכן בידי עכשיו</label>
                                  </div>
                                  <div className="bd-manb">
                                    <button type="button" className="btn primary sm" disabled={isBusy} onClick={() => confirmManualEntry(item)}>אשר הקלדה ידנית</button>
                                    <button type="button" className="btn ghost sm" disabled={isBusy} onClick={cancelManualEntry}>ביטול</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" className="bd-link" disabled={isBusy} onClick={() => { setManualEntryItemId(item.id); setManualBarcode1(''); setManualBarcode2(''); setManualSigned(false); }}>
                                  הברקוד לא עובד? הקלדה ידנית
                                </button>
                              )}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div></div>
                </div>
              )}

              <div className="bd-rfoot">
                <button type="button" className="btn ghost bd-danger" onClick={handleHeaderCancel}>בטל שינויים וסגור</button>
                <button type="button" className="btn primary" onClick={handleHeaderSave} disabled={isConfirming}><Ic name="check" />שמור וסגור</button>
              </div>
            </>
          )}
        </div>
      </div>

      {itemDetails ? (
        <div className="scrim on bd-scrim bd-sub-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setItemDetails(null); }}>
          <div className="dlg bd-item" role="dialog" aria-modal="true" aria-labelledby="bdItemT">
            <div className="bd-dh">
              <div className="bd-dht"><span className="adm-hi"><Ic name="tag" /></span><h2 id="bdItemT">פרטי פריט: {itemDetails.item.barcode || itemDetails.item.description}</h2></div>
              <div className="bd-dx"><button type="button" className="ibtn bd-rb" aria-label="סגירה" data-tip="סגירה" onClick={() => setItemDetails(null)}><Ic name="x" /></button></div>
            </div>
            <div className="bd-kv">
              <div className="hv-r"><small>תאריך אירוע</small><b>{o?.eventDate ? getHebrewDateString(o.eventDate) : '-'}</b></div>
              <div className="hv-r"><small>תאריך לקיחה</small><b>{itemDetails.item.takenDate ? `${getHebrewDateString(itemDetails.item.takenDate)} ${fmtTime(itemDetails.item.takenDate)}` : (itemDetails.item.isTaken ? 'לא ידוע' : '-')}</b></div>
              <div className="hv-r"><small>תאריך החזרה</small><b>{itemDetails.item.returnDate ? `${getHebrewDateString(itemDetails.item.returnDate)} ${fmtTime(itemDetails.item.returnDate)}` : (itemDetails.item.isReturned ? 'לא ידוע' : '-')}</b></div>
              <div className="hv-r"><small>חזר תקין?</small><b>{itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</b></div>
              {enableAlterations ? <div className="hv-r"><small>מחרוזת תיקונים</small><b>{itemDetails.item.alterationDetails || itemDetails.item.repairs || '-'}</b></div> : null}
            </div>
            <h3 className="bd-h3">היסטוריית פעולות</h3>
            <div className="bd-hist">
              {itemDetails.history && itemDetails.history.length === 0 ? (
                <div className="empty">אין היסטוריה לפריט זה</div>
              ) : (itemDetails.history || []).map((log) => (
                <div key={log.id} className="bd-hl">
                  <div className="bd-hlh">
                    <span className="chip blue">{ACTION_TRANSLATIONS[log.action] || log.action}</span>
                    <small>{getHebrewDateString(log.createdAt)} {fmtTime(log.createdAt)}</small>
                  </div>
                  <HistoryChanges changesJson={log.changesJson} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {duplicates ? (
        <div className="scrim on bd-scrim bd-sub-scrim" role="presentation">
          <div className="dlg bd-dup" role="dialog" aria-modal="true" aria-labelledby="bdDupT">
            <div className="bd-dh"><div className="bd-dht"><span className="adm-hi"><Ic name="alert" /></span><div><h2 id="bdDupT">נמצאו מספר פריטים זהים</h2><div className="faint">בחר לאיזה מהם לשייך את הברקוד שנסרק</div></div></div></div>
            <div className="hres"><div className="hgrp">
              {duplicates.map((opt, idx) => (
                <button key={opt.id} type="button" className="li lrow bd-dupo" onClick={() => selectDuplicate(opt.id)}>
                  <span className="ic-b bd-num">{idx + 1}</span>
                  <span className="t">
                    {enableAlterations ? (
                      <>
                        <b>אורך: {opt.lengthAlteration || 'ללא'} · צוואר: {opt.neckAlteration || 'ללא'} · שרוול: {opt.sleeveAlteration || 'ללא'}</b>
                        <span className="ln">פירוט: {opt.alterationDetails || 'אין פירוט נוסף'}</span>
                      </>
                    ) : <b>פריט מס&apos; {idx + 1} במערכת</b>}
                  </span>
                </button>
              ))}
            </div></div>
            <div className="bd-rfoot"><button type="button" className="btn ghost" onClick={() => setDuplicates(null)}>ביטול</button></div>
          </div>
        </div>
      ) : null}
    </LzPortal>
  );
}

// השינויים בשורת היסטוריה: שם השדה המתורגם + ערך ישן (מחוק) -> ערך חדש (כמו renderHistoryChanges בחלון הקיים)
function HistoryChanges({ changesJson }) {
  let changes;
  try {
    changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
  } catch {
    return <div className="bd-raw" dir="ltr">{String(changesJson)}</div>;
  }
  if (!changes || typeof changes !== 'object') return null;
  const keys = Object.keys(changes).filter((key) => {
    const c = changes[key];
    if (c && typeof c === 'object' && ('from' in c || 'to' in c)) return String(c.from) !== String(c.to);
    return c !== null && c !== undefined && c !== '';
  });
  if (keys.length === 0) return <div className="bd-none">אין שינויים מהותיים</div>;
  return (
    <div className="bd-chg">
      {keys.map((key) => {
        const c = changes[key];
        const isDiff = c && typeof c === 'object' && ('from' in c || 'to' in c);
        const hasFrom = isDiff && c.from !== null && c.from !== undefined && c.from !== '';
        return (
          <span key={key} className="chip gray">
            <b>{FIELD_TRANSLATIONS[key] || key}:</b>
            {isDiff ? (
              <>
                {hasFrom ? <s className="bd-from">{formatHistoryValue(c.from)}</s> : null}
                <b className="bd-to">{formatHistoryValue(c.to)}</b>
              </>
            ) : <b>{formatHistoryValue(c)}</b>}
          </span>
        );
      })}
    </div>
  );
}
