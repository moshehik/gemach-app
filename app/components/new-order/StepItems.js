'use client';

// שלב 4 "אילו פריטים?" - window.R.items של B2 (נבנה מאפס בעיצוב): כרטיס "הוספת פריט" (.addstep): "דגם" (שדה עם הדגם שנבחר + X) + רשימת הצעות
// סטטית (.advlist.advstatic), "מידה" (רשת אריחים .sizes), "תיקונים" (.altopts/.opt.lenopt - G4), שורת הוספה (.addbar2), והסל (.list).
// R19 (להסיר): בלי "N פנויות" ובלי "אזל" בקו חוצה - מידה שאזלה היא אריח כבוי. R20 (אושר): "(בודק זמינות...)", "אין מידות זמינות
// לתאריך זה.", "מחשב מחירים...". S05 (לא להכניס): בלי קטגוריה ו"החל מ-₪". S06 (להכניס): מחיר ליד כל תיקון + "להוספה: ₪N".
// R23: דגם "ללא שם" מוצג בקוד; הקוד מוצג בנפרד רק כשהוא שונה מהשם (בנווה יעקב הם זהים). Q8: "פירוט לתופרת * (חובה)" נאכף.
// R21 (להסיר): אין "הערות כלליות להזמנה" בשלב הזה.
// פריסה (העיצוב העדכני B2, בלוק fix-2026-10-01): קלף אחד (.card.one) עם שתי עמודות - בחירת הפריט (.items-main) מימין והסל (.items-cart) משמאל
// (קצה ה-RTL), עם קו מפריד דק ביניהן (761px ומעלה); מתחת ל-761px הסל מתחת לבחירה, באותו קלף. הלוגיקה והחלטות הבעלים - ללא שינוי.
import { Blk, ClearX, Field, Ic, Note, OneCard, SubH, money } from './NoUi';
import { CalcErrorNote, DeliveryChargeLine } from './NoDeliveryBits';
import { alterationDetailsRequired, alterationsChosen, describeAlterations, displayModelName, modelCodeSuffix, moneyTxt } from './newOrderLogic';

function hl(s, q) {
  if (!q) return s;
  const i = s.indexOf(q);
  return i < 0 ? s : <>{s.slice(0, i)}<mark>{q}</mark>{s.slice(i + q.length)}</>;
}

// "דגם": שדה אחד. כשנבחר דגם הוא מציג "שם · קוד: N" (בעיצוב) ו-X מנקה; הקלדה מחליפה דגם. הרשימה הסטטית מוצגת כל עוד לא נבחר דגם
function ModelField({ ctl }) {
  const m = ctl.pickedModel;
  const q = ctl.modelQuery.trim();
  const list = ctl.modelList;
  const code = m ? modelCodeSuffix(m) : '';
  return (
    <div className="addstep">
      <div className="lbl with-ic"><Ic n="dress" c="sm" />דגם</div>
      <div className="inpw ico-in">
        <Ic n="search" c="sm" />
        <input className="inp" id="noModelQ" placeholder="חפש דגם לפי שם או קוד..." autoComplete="off" aria-label={m ? 'חיפוש דגם - אפשר לערוך כדי להחליף דגם' : 'חיפוש דגם'}
          value={m ? `${displayModelName(m)}${code ? ` · קוד: ${code}` : ''}` : ctl.modelQuery}
          onFocus={(e) => { if (m) e.target.select(); }}
          onChange={(e) => { if (m) ctl.pickModel(null); ctl.setModelQuery(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ctl.resolveTypedModel(); } }} />
        <ClearX show={!!(m || ctl.modelQuery)} tip={m ? 'ניקוי והחלפת דגם' : undefined} onClear={() => { ctl.pickModel(null); ctl.setModelQuery(''); }} />
      </div>
      {m ? null : (
        <ul className="advlist advstatic" id="modelList" role="listbox" aria-label="דגמים">
          {list === null ? <li className="advo none" role="presentation">טוען דגמים...</li>
            : list.length ? list.map((x, i) => (
              <li key={x.id} role="option" aria-selected="false" id={`mdl${i}`} className="advo" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); ctl.pickModel(x); }}
                onKeyDown={(e) => { if (e.key === 'Enter') ctl.pickModel(x); }}>
                <span className="advo-t">{hl(displayModelName(x), q)}</span>
                {modelCodeSuffix(x) ? <span className="muted sm" style={{ marginInlineStart: 'auto' }}><bdi>{hl(modelCodeSuffix(x), q)}</bdi></span> : null}
              </li>
            )) : <li className="advo none" role="presentation">לא נמצאו דגמים</li>}
        </ul>
      )}
    </div>
  );
}

function SizesAndAlt({ ctl }) {
  const s = ctl.settings;
  const it = ctl.newItem;
  const sizes = ctl.availableSizes;
  const checking = ctl.loadingSizes || ctl.loadingPreload;
  const alt = s.enable_alterations !== 'false' && it.selectedSizes.length > 0;
  const chosen = alterationsChosen(it);
  const pv = ctl.addPreview;
  const priceTag = (n) => (pv && pv.alt && pv.alt[n] ? <small><bdi dir="ltr">+{moneyTxt(pv.alt[n])}</bdi></small> : <small>&nbsp;</small>);
  const required = alterationDetailsRequired(s);
  const label = it.selectedSizes.length > 1 ? `הוסף ${it.selectedSizes.length} פריטים לסל` : 'הוסף לסל';
  return (
    <>
      <div className="addstep">
        <div className="lbl with-ic">
          <Ic n="tag" c="sm" />מידה
          <span className="muted sm" style={{ fontWeight: 400 }}>{checking ? '(בודק זמינות...)' : 'אפשר לסמן כמה'}</span>
          <button type="button" className="ibtn" data-tip="רענן זמינות מלאי" aria-label="רענן זמינות מלאי" onClick={ctl.refreshInventory} disabled={checking}><Ic n="refresh" c="sm" /></button>
        </div>
        {sizes.length === 0 ? (
          <div className="muted sm">{checking ? 'בודק זמינות...' : 'אין מידות זמינות לתאריך זה.'}</div>
        ) : (
          <div className="sizes" id="addSizes">
            {sizes.map(z => {
              const normal = (z.withNormalBuffer && z.withNormalBuffer.availableQuantity) ?? z.availableQuantity ?? 0;
              const avail = z.withCustomSpacing ? z.withCustomSpacing.availableQuantity : normal;
              const on = it.selectedSizes.includes(z.sizeText);
              return <button key={z.sizeText} type="button" className={on ? 'on' : ''} disabled={!(avail > 0)} aria-pressed={on} onClick={() => ctl.toggleSizeSelection(z.sizeText)}>{z.sizeText}</button>;
            })}
          </div>
        )}
      </div>
      {alt ? (
        <div className="addstep">
          <div className="lbl with-ic"><Ic n="scissors" c="sm" />תיקונים<span className="muted sm" style={{ fontWeight: 400 }}>לא חובה</span></div>
          <div className="altopts">
            <button type="button" className={`opt${it.neckAlteration ? ' on' : ''}`} aria-pressed={!!it.neckAlteration} onClick={() => ctl.setNewItemField('neckAlteration', !it.neckAlteration)}>
              {it.neckAlteration ? <Ic n="check" c="sm evck" /> : null}<Ic n="scissors" c="lg" /><div><b>צוואר</b>{priceTag('neck')}</div>
            </button>
            <button type="button" className={`opt${it.sleeveAlteration ? ' on' : ''}`} aria-pressed={!!it.sleeveAlteration} onClick={() => ctl.setNewItemField('sleeveAlteration', !it.sleeveAlteration)}>
              {it.sleeveAlteration ? <Ic n="check" c="sm evck" /> : null}<Ic n="scissors" c="lg" /><div><b>שרוול</b>{priceTag('sleeve')}</div>
            </button>
            <label className={`opt lenopt${it.lengthAlteration ? ' on' : ''}`} htmlFor="noAltLen">
              {it.lengthAlteration ? <Ic n="check" c="sm evck" /> : null}<Ic n="scissors" c="lg" />
              <div><b>אורך</b><small>ס״מ{it.lengthAlteration && pv && pv.alt && pv.alt.len ? <bdi dir="ltr"> · +{moneyTxt(pv.alt.len)}</bdi> : null}</small></div>
              <input className="lenin" id="noAltLen" inputMode="decimal" maxLength={4} placeholder="0" aria-label="קיצור אורך בסנטימטרים" autoComplete="off"
                value={it.lengthAlteration || ''} onChange={(e) => ctl.setNewItemField('lengthAlteration', e.target.value.replace(/[^0-9.]/g, ''))} />
            </label>
          </div>
          {chosen ? (
            <Field label={<>פירוט לתופרת{required ? <span className="no-req"> * (חובה)</span> : null}</>} icon="note" htmlFor="noAltNote" className="field">
              <input className="inp" id="noAltNote" placeholder="מה בדיוק לתקן..." autoComplete="off" value={it.repairs || ''} aria-required={required} onChange={(e) => ctl.setNewItemField('repairs', e.target.value)} />
            </Field>
          ) : null}
        </div>
      ) : null}
      {ctl.addError ? <Note style={{ marginTop: 16 }}>{ctl.addError}</Note> : null}
      {/* .addbar2 של העיצוב: "להוספה" + המחיר החי (S06) משמאל לכותרת, הלחצן בקצה */}
      <div className="addbar2 addbar">
        <div className="addsum"><small>{it.selectedSizes.length ? 'להוספה' : 'מחיר'}</small><b>{it.selectedSizes.length ? (pv ? money(pv.total) : '...') : '—'}</b></div>
        <button type="button" className="btn primary lg" disabled={!it.selectedSizes.length} onClick={ctl.addItemToOrder}><Ic n="plus" />{label}</button>
      </div>
    </>
  );
}

// כרטיס "הוספת פריט": כותרת + דגם, ואחרי בחירת דגם - מידה / תיקונים / שורת הוספה
function AddItem({ ctl }) {
  return (
    <Blk>
      <SubH icon="dress" title="הוספת פריט" />
      <ModelField ctl={ctl} />
      {ctl.pickedModel ? <SizesAndAlt ctl={ctl} /> : null}
    </Blk>
  );
}

function Cart({ ctl }) {
  const s = ctl.settings;
  const items = ctl.order.items;
  return (
    <Blk>
      <SubH icon="cart" tone="green" title={`בסל · ${ctl.activeItems.length}`}>
        {ctl.calculating ? <span className="muted sm">מחשב מחירים...</span> : null}
        {items.length ? <b className="cart-total">סה&quot;כ {moneyTxt(ctl.totalAmount)}</b> : null}
      </SubH>
      <div className="list">
        {items.length ? items.map((item, idx) => {
          const code = ctl.modelCodes[item.dressModelId];
          const model = { name: item.dressName, barcodePrefix: code };
          const calc = ctl.calculatedData.items[idx];
          const price = (calc ? calc.calculatedPrice : item.finalPrice) || 0;
          const alts = s.enable_alterations !== 'false' && alterationsChosen(item) ? describeAlterations(item) : '';
          return (
            <div className="li" key={idx}>
              <div className="ic-b"><Ic n="dress" /></div>
              <div className="t">
                <b>{displayModelName(model) || 'דגם לא ידוע'}</b>
                <small>{modelCodeSuffix(model) ? <>דגם <bdi>{modelCodeSuffix(model)}</bdi> · </> : null}מידה {item.sizeText}{alts ? ` · תיקונים: ${alts}` : ''}</small>
                <div className="a">{money(price)}</div>
              </div>
              <div className="row" style={{ gap: 6, flex: 'none' }}>
                <button type="button" className="ibtn" data-tip="בדוק תפוסה לתאריך האירוע" aria-label="בדוק תפוסה" onClick={() => ctl.setCapacityItem(item)}><Ic n="cal" c="sm" /></button>
                <button type="button" className="ibtn" data-tip="ערוך פריט" aria-label="ערוך פריט" onClick={() => ctl.editItem(idx)}><Ic n="pencil" c="sm" /></button>
                <button type="button" className="ibtn" data-tip="הסר פריט" aria-label="הסר פריט" onClick={() => ctl.confirmRemoveItem(idx)}><Ic n="trash" c="sm" /></button>
              </div>
            </div>
          );
        }) : <div className="empty">טרם הוספת פריטים להזמנה</div>}
      </div>
      <CalcErrorNote ctl={ctl} />
      <DeliveryChargeLine ctl={ctl} />
    </Blk>
  );
}

export default function StepItems({ ctl }) {
  // קלף אחד (.card.one) עם שתי העמודות בתוכו וקו מפריד דק ביניהן (בעיצוב: .card.one > .one-body > .items-split)
  return (
    <OneCard>
      <div className="items-split">
        <div className="items-main"><AddItem ctl={ctl} /></div>
        <div className="items-cart"><Cart ctl={ctl} /></div>
      </div>
    </OneCard>
  );
}
