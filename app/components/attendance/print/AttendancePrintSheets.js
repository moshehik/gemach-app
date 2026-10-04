// app/components/attendance/print/AttendancePrintSheets.js — הדף המודפס (A4) של "סיכום נוכחות".
// העיצוב: pagesFor() בתצוגה המאושרת תצוגות-עיצוב/סיכום-נוכחות.html (שלושה סוגים: דוח עובד, טבלת סיכום, לפי עובד), בתוך
// המעטפת המשותפת של דפי ההדפסה של הלו״ז (Sheet מ-PrintShell.js + print.css: בס״ד, שם הגמ״ח, כתובת וטלפון, התאריך העברי
// והלועזי, תג, כותרת, סיכום; "הופק מהמערכת · תאריך · שעה · הדפיס/ה" ו"עמוד X מתוך Y" מ-@page).
// ההבדל המכוון מהתצוגה: שם כל עמוד היה גיליון קבוע של 22 שורות עם "המשך בעמוד הבא"; כאן הגיליון זורם על כמה עמודים -
// הכותרת והתחתית וכותרת הטבלה חוזרות בכל עמוד (thead/tfoot), שורה לא נחתכת, והמספור רציף לכל המסמך.
// כל עובד = גיליון משלו (מעבר עמוד ביניהם): "כל העובדים ברצף" (AT-02). בלי שכר כש-meta.wages=false (עובד רגיל, AT-10).
import { Sheet } from '@/app/components/schedule/print/PrintShell';
import { hm, money } from '@/lib/attendance/summary';

const Num = ({ children }) => <span className="pp-num">{children}</span>;
const Flag = ({ children }) => <span className="pp-fl">{children}</span>;
const Sum = ({ sum }) => (sum ? <><b>{sum.b}</b><small>{sum.small}</small></> : null);
const pageOf = (sh) => ({ key: sh.key, def: { key: sh.key, chip: sh.chip, barcode: null }, data: {} });

function EmployeeBody({ sh, wages }) {
  const T = sh.totals;
  return (
    <>
      <table className="pp-t pp-at">
        <thead>
          <tr><th>תאריך</th><th className="c">כניסה</th><th className="c">יציאה</th><th className="c">סה״כ שעות</th>{wages ? <th className="c">סה״כ לתשלום</th> : null}</tr>
        </thead>
        <tbody>
          {sh.shifts.map((s) => (
            <tr key={s.id} className={s.incomplete ? 'warn' : undefined}>
              <td><b>{s.day}</b><small>{s.weekday}</small></td>
              <td className="c">{s.entry ? <Num>{s.entry}</Num> : '-'}</td>
              <td className="c">{s.exit ? <Num>{s.exit}</Num> : <Flag>חסר</Flag>}</td>
              <td className="c">{s.minutes ? <Num>{hm(s.minutes)}</Num> : '-'}</td>
              {wages ? <td className="c"><Num>{money(s.pay)}</Num></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pp-stats pp-at-stats">
        <div>סה״כ משמרות: <b>{T.shiftCount}</b></div>
        <div>סה״כ שעות: <b><Num>{hm(T.minutes)}</Num></b></div>
        {wages ? <div>סה״כ לתשלום: <b><Num>{money(T.pay)}</Num></b></div> : null}
        {T.issues ? <div>תקלות: <b>{T.issues}</b></div> : null}
      </div>
    </>
  );
}

function SummaryBody({ sh }) {
  const T = sh.totals;
  return (
    <table className="pp-t pp-at">
      <thead>
        <tr><th>שם</th><th className="c">סה״כ שעות</th><th className="c">כמות ימים</th><th className="c">תקלות</th><th className="c">סה״כ לתשלום</th><th className="c">נסיעות</th></tr>
      </thead>
      <tbody>
        {sh.rows.map((r) => (
          <tr key={r.id} className={r.issues ? 'warn' : undefined}>
            <td><b>{r.name}</b>{r.dept ? <small>{r.dept}</small> : null}</td>
            <td className="c nowrap"><Num>{hm(r.minutes)}</Num></td>
            <td className="c">{r.days}</td>
            <td className="c">{r.issues ? <Flag>{r.issues}</Flag> : '-'}</td>
            <td className="c"><Num>{money(r.pay)}</Num></td>
            <td className="c">{r.travels ? 'כן' : 'לא'}</td>
          </tr>
        ))}
        <tr className="tot">
          <td>סה״כ</td>
          <td className="c nowrap"><Num>{hm(T.minutes)}</Num></td>
          <td className="c">{T.days}</td>
          <td className="c">{T.issues || '-'}</td>
          <td className="c"><Num>{money(T.pay)}</Num></td>
          <td className="c" />
        </tr>
      </tbody>
    </table>
  );
}

function MonthsBody({ sh, wages }) {
  const T = sh.totals;
  return (
    <table className="pp-t pp-at">
      <thead>
        <tr><th>חודש</th><th className="c">סה״כ שעות</th><th className="c">כמות ימים</th><th className="c">תקלות</th>{wages ? <><th className="c">סה״כ לתשלום</th><th className="c">נסיעות</th></> : null}</tr>
      </thead>
      <tbody>
        {sh.months.map((mo) => (
          <tr key={mo.y + '-' + mo.m} className={mo.issues ? 'warn' : undefined}>
            <td><b>{mo.label}</b></td>
            <td className="c nowrap"><Num>{hm(mo.minutes)}</Num></td>
            <td className="c">{mo.days}</td>
            <td className="c">{mo.issues ? <Flag>{mo.issues}</Flag> : '-'}</td>
            {wages ? <><td className="c"><Num>{money(mo.pay)}</Num></td><td className="c">{mo.travels ? 'כן' : 'לא'}</td></> : null}
          </tr>
        ))}
        <tr className="tot">
          <td>סה״כ לכל התקופה</td>
          <td className="c nowrap"><Num>{hm(T.minutes)}</Num></td>
          <td className="c">{T.days}</td>
          <td className="c">{T.issues || '-'}</td>
          {wages ? <><td className="c"><Num>{money(T.pay)}</Num></td><td className="c" /></> : null}
        </tr>
      </tbody>
    </table>
  );
}

export function AttendanceSheet({ meta, sh }) {
  const wages = !!meta.wages;
  return (
    <Sheet meta={meta} page={pageOf(sh)} title={sh.title} sub={sh.sub} sum={<Sum sum={sh.sum} />} nobc>
      {sh.kind === 'summary' ? <SummaryBody sh={sh} /> : sh.kind === 'months' ? <MonthsBody sh={sh} wages={wages} /> : <EmployeeBody sh={sh} wages={wages} />}
    </Sheet>
  );
}

/** המסמך: .pp-root > .pp-paper > גיליון לכל עובד / טבלה (כמו PrintDocument של הלו״ז) */
export function AttendancePrintDocument({ payload, status = null, preview = false }) {
  return (
    <div className={'pp-root' + (preview ? ' pp-preview' : '')} dir="rtl" lang="he" data-tone="bw">
      <div className="pp-paper">
        {status ? <div className={'pp-status ' + (status.kind || 'info')} role={status.kind === 'err' ? 'alert' : 'status'}>{status.text}</div> : null}
        {payload ? payload.sheets.map((sh) => <AttendanceSheet key={sh.key} meta={payload.meta} sh={sh} />) : null}
      </div>
    </div>
  );
}
