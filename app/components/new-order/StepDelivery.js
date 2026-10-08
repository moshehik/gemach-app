'use client';

// שלב 3 "איך תרצו לקבל את ההזמנה?" (B2: משלוח כשלב נפרד) - R.delivery בעיצוב.
// אותם שערים כמו בישן: "אופן ההזמנה" לפי phone_order_marker_enabled / track_branch_on_order / branches_enabled; המשלוח לפי
// enable_deliveries (ובתנאי שכרטיס "משלוח / סניף / טלפוני" מוצג: דגלי טלפוני/סניף או delivery_show_in_order !== 'false'); כתובת שונה לפי delivery_allow_address_override או כשהיא חובה; "יום לפני" לפי delivery_one_day_before_option.
// S04 (לא להכניס): אין שורת "דמי משלוח" כאן. R15 (אושר): סניף הביצוע נזכר במחשב הזה (localStorage, ב-controller ובשינוי כאן).
import { useState } from 'react';
import { Blk, ClearX, Field, Ic, Note, NoCombo, OneCard, SegPill, SubH, Switch, Tip, NO_FILL } from './NoUi';
import NoSuggest from './NoSuggest';
import { DELIVERY_DIRECTIONS, branchListOf, deliveryStepVisibility } from './newOrderLogic';

const ORDER_TYPES = [
  { v: false, label: 'הזמנה רגילה', icon: 'user', tip: 'הזמנה טלפונית וסניף ביצוע מוציאים זה את זה' },
  { v: true, label: 'הזמנה טלפונית', icon: 'phone', tip: 'הזמנה טלפונית וסניף ביצוע מוציאים זה את זה' },
];

export default function StepDelivery({ ctl }) {
  const s = ctl.settings;
  const o = ctl.order;
  // כמו הישן: "הזמנת משלוח" גם תחת delivery_show_in_order (שער הכרטיס) - deliveryStepVisibility
  const { showMode, showDelivery } = deliveryStepVisibility(s);
  const branches = branchListOf(s);
  const set = (patch) => ctl.setOrder(prev => ({ ...prev, ...patch }));
  const cityOptions = [...new Set([...(o.deliveryCity ? [o.deliveryCity] : []), ...ctl.deliveryCityOptions])];
  // 87c7a432 (נווה יעקב): כמו הישן - delivery_different_address_button + delivery_charge_customer_city_fallback + עיר הלקוחה ברשימת ערי המשלוח:
  // בלי בחירת עיר שוב; כתובת הלקוחה וכפתור "כתובת שונה למשלוח" שפותח עיר + כתובת. כבוי = השדות כמו קודם.
  const [otherOpen, setOtherOpen] = useState(false);
  const custCity = String((o.selectedCustomer && o.selectedCustomer.city) || '').trim();
  const addressButtonOn = s.delivery_different_address_button === 'true' && s.delivery_charge_customer_city_fallback === 'true'
    && !!custCity && ctl.deliveryRateCities.includes(custCity);
  const differentOpen = addressButtonOn && (otherOpen || !!o.deliveryCity || !!o.deliveryAddress);
  const useSavedAddress = addressButtonOn && !differentOpen;

  if (!showMode && !showDelivery) {
    return (
      <OneCard>
        <Blk><SubH icon="truck" title="משלוח" /><div className="empty">משלוח, סניפים והזמנה טלפונית כבויים בהגדרות המערכת. אפשר להמשיך לפריטים.</div></Blk>
      </OneCard>
    );
  }
  return (
    <OneCard>
      {showMode ? (
        <Blk>
          <SubH icon="phone" title="אופן ההזמנה" />
          <div className="grid2">
            {s.phone_order_marker_enabled === 'true' ? (
              <div className="field">
                <div className="lbl with-ic"><Ic n="phone" c="sm" />סוג הזמנה</div>
                {/* בורר גלולה בן שתי אפשרויות (בעיצוב: #orderSeg) - אותו state ואותו handler כמו המתג שהיה (isPhoneOrder; טלפונית וסניף ביצוע מוציאים זה את זה) */}
                <SegPill id="orderSeg" label="סוג הזמנה" options={ORDER_TYPES} value={!!o.isPhoneOrder} onChange={(v) => set({ isPhoneOrder: v, branch: v ? '' : o.branch })} />
              </div>
            ) : null}
            {s.track_branch_on_order === 'true' ? (
              <Field label="סניף ביצוע" icon="pin" htmlFor="noBranchSel">
                <NoCombo id="noBranchSel" label="סניף ביצוע" placeholder={o.isPhoneOrder ? 'לא רלוונטי בהזמנה טלפונית' : 'בחר סניף...'} disabled={!!o.isPhoneOrder} value={o.branch || ''} options={[['', ''], ...branches.map(b => [b, b])]} onChange={(val) => {
                  set({ branch: val, isPhoneOrder: val ? false : o.isPhoneOrder });
                  try { if (val) localStorage.setItem('gemach_last_order_branch', val); } catch { /* אין גישה */ }
                }} />
              </Field>
            ) : null}
            {s.branches_enabled === 'true' ? (
              <Field label="סניף איסוף" icon="bag" htmlFor="noPickupSel">
                <NoCombo id="noPickupSel" label="סניף איסוף" placeholder="בחר סניף..." value={o.pickupBranch || ''} options={[['', ''], ...branches.map(b => [b, b])]} onChange={(val) => set({ pickupBranch: val })} />
              </Field>
            ) : null}
          </div>
        </Blk>
      ) : null}
      {showDelivery ? (
        <>
          <Blk className={`dhero${o.isDelivery ? '' : ' off'}`}>
            <div className="ico"><Ic n="truck" c="lg" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="trow"><Switch id="noDelOn" checked={o.isDelivery} label="הזמנת משלוח" onChange={(v) => set({ isDelivery: v })} /><b className="big">הזמנת משלוח</b></div>
            </div>
          </Blk>
          {/* בקשת הבעלים 9.10.2026: כרטיסי הכיוון והיעד מוצגים רק כשהמשלוח מסומן (בעיצוב המקורי הם הוצגו תמיד, מעומעמים) */}
          {o.isDelivery ? (<>
              <Blk className="card dfields">
                <SubH icon="arrlr" title="כיוון משלוח" />
                <SegPill id="dirSeg" label="כיוון משלוח" options={DELIVERY_DIRECTIONS.map(d => ({ v: d.v, label: d.v, icon: d.icon }))} value={o.deliveryDirection} onChange={(v) => set({ deliveryDirection: v })} />
              </Blk>
              <Blk className="card dfields">
                <SubH icon="pin" title="יעד" />
                <div className="grid2">
                  {useSavedAddress ? (
                    <Field label="כתובת משלוח" icon="pin">
                      <div className="hint">המשלוח יגיע לכתובת הלקוחה: {[[o.selectedCustomer.street, o.selectedCustomer.houseNum].filter(Boolean).join(' '), custCity].filter(Boolean).join(', ')}</div>
                      <button type="button" className="btn" id="delOtherAddrBtn" style={{ marginTop: 8 }} onClick={() => setOtherOpen(true)}><Ic n="pin" c="sm" />כתובת שונה למשלוח</button>
                    </Field>
                  ) : (<>
                  <Field label={<>עיר משלוח (לחישוב מחיר){ctl.deliveryCityRequired ? ' *' : ''}</>} icon="pin" htmlFor="noDelCity">
                    {/* כמו ה-select בישן: רק ערים מהרשימה (delivery_price_by_city, או ערי הלקוחות כשהיא ריקה) - ערך שהוקלד ואינו ברשימה מתנקה ביציאה מהשדה */}
                    <NoSuggest id="noDelCity" value={o.deliveryCity || ''} options={cityOptions} onChange={(v) => set({ deliveryCity: v })}
                      onBlurValue={(v) => { if (v && !cityOptions.includes(v)) set({ deliveryCity: '' }); }} inputProps={{ placeholder: 'עיר' }} />
                    <ClearX show={!!o.deliveryCity} onClear={() => set({ deliveryCity: '' })} />
                  </Field>
                  {(s.delivery_allow_address_override === 'true' || ctl.deliveryAddressRequired || differentOpen) ? (
                    <Field label={<>כתובת משלוח שונה{ctl.deliveryAddressRequired ? ' *' : ''}</>} icon="pin" htmlFor="noDelAddr">
                      <input className="inp" id="noDelAddr" placeholder="כתובת למשלוח (שונה ממגורים)" autoComplete="off" {...NO_FILL} value={o.deliveryAddress || ''} onChange={(e) => set({ deliveryAddress: e.target.value })} />
                      <ClearX show={!!o.deliveryAddress} onClear={() => set({ deliveryAddress: '' })} />
                    </Field>
                  ) : null}
                  {differentOpen ? (
                    <div className="row"><button type="button" className="btn ghost" id="delBackAddrBtn" onClick={() => { setOtherOpen(false); set({ deliveryCity: '', deliveryAddress: '' }); }}>חזרה לכתובת הלקוחה</button></div>
                  ) : null}
                  </>)}
                </div>
                <div id="delMsgs">
                  {ctl.deliveryCityRequired && !String(o.deliveryCity || '').trim() ? <Note style={{ marginTop: 12 }}>עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח.</Note> : null}
                  {ctl.deliveryAddressRequired && !String(o.deliveryAddress || '').trim() ? <Note style={{ marginTop: 12 }}>עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח.</Note> : null}
                </div>
                {s.delivery_one_day_before_option === 'true' ? (
                  <div className="row wrap" style={{ marginTop: 24, gap: 16 }}>
                    <button type="button" className={`btn tgl${o.deliveryOneDayBefore ? ' on' : ''}`} id="delOneBtn" aria-pressed={!!o.deliveryOneDayBefore} onClick={() => set({ deliveryOneDayBefore: !o.deliveryOneDayBefore })}>
                      {o.deliveryOneDayBefore ? <Ic n="check" c="sm evck" /> : null}<Ic n="truck" c="sm" />משלוח יוצא יום לפני האירוע (במקום יומיים)
                    </button>
                    <Tip t="ברירת מחדל: יומיים לפני" />
                  </div>
                ) : null}
              </Blk>
          </>) : null}
        </>
      ) : null}
    </OneCard>
  );
}
