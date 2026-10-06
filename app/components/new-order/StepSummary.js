'use client';

// שלב 5 "הכול נכון?" - R.summary בעיצוב: "פרטי ההזמנה" (.kv) + "פריטים" (.list) + סה"כ (.status.ok).
// S07 (להכניס): שורות שלא היו בסיכום האתר - לקיחה / החזרה, סוג הזמנה (טלפונית), סניף ביצוע / איסוף, ושורת משלוח עם מחירה
// (deliveryAmount מאותה תשובת /api/orders/calculate שכבר נכנסה לסה"כ). מועדי הלקיחה/ההחזרה: pickupReturnKeys (newOrderLogic) -
// אותם כללים כמו השרת (lib/businessDays, lib/lateReturn, delivery_days_before, ימים שהבעלים סגר ב-non_working_days_extra).
import { Blk, Ic, OneCard, SubH, money } from './NoUi';
import { CalcErrorNote, DeliveryEditButton } from './NoDeliveryBits';
import { alterationsChosen, describeAlterations, displayModelName, modelCodeSuffix, pickupReturnKeys, spacingLabel } from './newOrderLogic';
import { hebrewLong, hebrewParts } from '../schedule/hebrewCalendar';

const short = (k) => { const h = hebrewParts(k); return `${h.dl} ${h.m}`; };

function F({ icon, l, children }) {
  return <div className="f"><Ic n={icon} /><div><small>{l}</small><b>{children}</b></div></div>;
}

export default function StepSummary({ ctl }) {
  const o = ctl.order;
  const s = ctl.settings;
  const c = o.selectedCustomer;
  if (!c || !ctl.datesFilled || !ctl.activeItems.length) return null;
  const pr = pickupReturnKeys(o, s);
  return (
    <OneCard>
      <Blk>
        <SubH icon="file" tone="gold" title="פרטי ההזמנה">
          <button type="button" className="btn sm" onClick={() => ctl.goStep('customer')}><Ic n="pencil" c="sm" />עריכה</button>
        </SubH>
        <div className="kv">
          <F icon="user" l="לקוח">{`${c.firstName || ''} ${c.lastName || ''}`.trim()} <bdi>{c.phone1 || ''}</bdi></F>
          <F icon="cal" l="תאריכים">{o.isAbroad ? `מ-${hebrewLong(o.fromDate)} עד ${hebrewLong(o.toDate)}` : hebrewLong(o.eventDate)}</F>
          {pr ? <F icon="bag" l="לקיחה / החזרה">{short(pr.pickup)} ← {short(pr.ret)}</F> : null}
          {s.hide_custom_spacing !== 'true' && o.customSpacing !== null && o.customSpacing !== undefined ? <F icon="sliders" l="ריווח ימים">{spacingLabel(o.customSpacing)}</F> : null}
          {o.notes ? <F icon="note" l="הערות">{o.notes}</F> : null}
          {o.isPhoneOrder ? <F icon="phone" l="סוג הזמנה">הזמנה טלפונית</F> : null}
          {o.branch ? <F icon="pin" l="סניף ביצוע">{o.branch}</F> : null}
          {o.pickupBranch ? <F icon="bag" l="סניף איסוף">{o.pickupBranch}</F> : null}
        </div>
      </Blk>
      <Blk>
        <SubH icon="dress" title={`פריטים (${o.items.length})`}>
          <button type="button" className="btn sm" onClick={() => ctl.goStep('items')}><Ic n="pencil" c="sm" />עריכה</button>
        </SubH>
        <div className="list">
          {o.items.map((item, idx) => {
            const calc = ctl.calculatedData.items[idx];
            const price = (calc ? calc.calculatedPrice : item.finalPrice) || 0;
            const repairs = calc && calc.repairsCost ? calc.repairsCost : 0;
            const model = { name: item.dressName, barcodePrefix: ctl.modelCodes[item.dressModelId] };
            const code = modelCodeSuffix(model);
            return (
              <div className="li" key={idx}>
                <div className="ic-b"><Ic n="dress" /></div>
                <div className="t">
                  <b>{displayModelName(model)}{code ? ` · דגם ${code}` : ''} · מידה {item.sizeText}</b>
                  {s.enable_alterations !== 'false' && alterationsChosen(item) ? <small>תיקונים: {describeAlterations(item)}{repairs > 0 ? <> (<bdi dir="ltr">+₪{repairs}</bdi>)</> : null}</small> : null}
                  <div className="a">{money(price)}</div>
                </div>
              </div>
            );
          })}
          {o.isDelivery ? (
            <div className="li">
              <div className="ic-b"><Ic n="truck" /></div>
              <div className="t"><b>משלוח {o.deliveryDirection}</b><small>{o.deliveryCity || c.city || ''}{o.deliveryAddress ? ` · ${o.deliveryAddress}` : ''}</small><div className="a">{money(ctl.calculatedData.deliveryAmount)}</div></div>
            </div>
          ) : null}
        </div>
        <DeliveryEditButton ctl={ctl} from="summary" />
        <CalcErrorNote ctl={ctl} />
        <div className="status ok" style={{ marginTop: 14 }}><Ic n="check" c="lg" /><div><small>סה&quot;כ לתשלום</small><div className="n">{money(ctl.totalAmount)}</div></div></div>
      </Blk>
    </OneCard>
  );
}
