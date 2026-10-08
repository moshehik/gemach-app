'use client';

// שלב 2 "מתי האירוע?" - R.dates בעיצוב: בורר אירוע רגיל / חו"ל, הלוח העברי (G1), ומתחת "הערות וריווח ימים" (details.coll).
// R10 (להסיר): אין "בחירה מהירה" לטווח. R11 (להסיר): אין "החודש" ואין בחירת חודש ושנה. S03: חגים וצומות בלוח.
// R13 + Q5: שינוי תאריך / ציפוף בלי מלאי נחסם ומוצג בחלון עם פירוט (ב-controller). ההערות כאן בלבד (R21 הסיר אותן משלב הפריטים).
import { Blk, Ic, OneCard, SegPill, SubH, Tip } from './NoUi';
import NoHebrewCalendar from './NoHebrewCalendar';
import { SPACING_OPTIONS, spacingHint } from './newOrderLogic';
import { hebrewLong } from '../schedule/hebrewCalendar';

const EVT = [
  { v: false, label: 'אירוע רגיל', icon: 'gift' },
  { v: true, label: 'חו"ל / תפוסה ארוכה', icon: 'flag' },
];

function dayCount(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5) + 1;
}

export default function StepDates({ ctl }) {
  const o = ctl.order;
  const s = ctl.settings;
  const hideSpacing = s.hide_custom_spacing === 'true';
  let big;
  if (o.isAbroad) {
    if (ctl.rangePending) big = <>{hebrewLong(ctl.rangePending)} ← בחרו תאריך סיום...</>;
    else if (!o.fromDate) big = 'בחרו תאריך התחלה בלוח';
    else if (!o.toDate) big = <>{hebrewLong(o.fromDate)} ← בחרו תאריך סיום...</>;
    else big = <>{hebrewLong(o.fromDate)} ← {hebrewLong(o.toDate)} ({dayCount(o.fromDate, o.toDate)} ימים)</>;
  } else {
    big = o.eventDate ? hebrewLong(o.eventDate) : 'תאריך...';
  }
  const spacingOpts = SPACING_OPTIONS.map(x => ({ v: x.val, label: x.label, tip: spacingHint(x.val) }));
  return (
    <OneCard>
      <Blk>
        <SubH icon="cal" tone="gold" title="אירוע" />
        {/* 1cbaf995 / fdce699f: allow_abroad_long_stay_orders='false' - בלי בורר סוג האירוע; תמיד אירוע רגיל (תאריך בודד) */}
        {ctl.allowAbroad ? <SegPill id="evSeg" label="סוג האירוע" options={EVT} value={!!o.isAbroad} onChange={(v) => { ctl.setRangePending(null); ctl.handleDateChangeWithValidation('isAbroad', v); }} /> : null}
        <div className="lbl" style={{ marginTop: ctl.allowAbroad ? 18 : 0 }}>{o.isAbroad ? 'טווח תאריכים (מתאריך עד תאריך)' : 'תאריך אירוע'}</div>
        <div className="big" id="dateBig" style={{ margin: '4px 0 12px' }}>{big}</div>
        <div id="hcWrap">
          {o.isAbroad ? (
            <NoHebrewCalendar key="range" mode="range" from={o.fromDate} to={o.toDate} today={ctl.todayKey} onPending={ctl.setRangePending}
              onRange={(a, b) => ctl.handleDateChangeWithValidation({ fromDate: a, toDate: b })} />
          ) : (
            <NoHebrewCalendar key="single" value={o.eventDate} today={ctl.todayKey} onPick={(d) => ctl.handleDateChangeWithValidation('eventDate', d)} />
          )}
        </div>
      </Blk>
      <Blk as="details" className="coll">
        <summary><Ic n="note" />{hideSpacing ? 'הערות' : 'הערות וריווח ימים'}<Ic n="chev" c="chev" /></summary>
        <div className="in">
          <div className="field">
            <label className="lbl with-ic" htmlFor="noEvNotes"><Ic n="note" c="sm" />הערות כלליות להזמנה</label>
            <textarea className="inp" id="noEvNotes" rows={2} placeholder="בקשות מיוחדות, סיכומים עם הלקוח..." value={o.notes} onChange={(e) => ctl.setOrder(prev => ({ ...prev, notes: e.target.value }))} />
          </div>
          {!hideSpacing ? (
            <div className="field">
              <div className="lbl with-ic"><Ic n="sliders" c="sm" />ריווח ימים בין השכרות <Tip t="ברירת המחדל: 3 ימים" /></div>
              <SegPill id="spSeg" label="ריווח ימים בין השכרות" options={spacingOpts} value={o.customSpacing === undefined ? null : o.customSpacing} onChange={(v) => ctl.handleSpacingChange(v)} />
            </div>
          ) : null}
        </div>
      </Blk>
    </OneCard>
  );
}
