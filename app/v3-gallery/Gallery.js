'use client';
import { useEffect, useRef, useState } from 'react';
import {
  V3Page, Card, Btn, IconBtn, Chip, Tag, Badge, Field, Row, Rows, Tabs, Seg, Switch, Tip, Dialog, CodeInput,
  Stepper, StepNav, Timeline, Table, useSort, Empty, Banner, Icon,
} from '../v3/ui/components';

const ROWS = [
  { id: 1, name: 'שרה כהן', dresses: 3, total: 1250, status: 'שולם' },
  { id: 2, name: 'רחל לוי', dresses: 1, total: 400, status: 'חוב' },
  { id: 3, name: 'מרים אבוטבול', dresses: 2, total: 900, status: 'שולם' },
  { id: 4, name: 'דבורה פרידמן', dresses: 5, total: 2100, status: 'ממתין' },
];
const COLS = [
  { key: 'name', header: 'לקוחה', sortable: true },
  { key: 'dresses', header: 'שמלות', sortable: true, num: true },
  { key: 'total', header: 'סה"כ', sortable: true, num: true, render: (r) => <bdi>₪{r.total}</bdi> },
  { key: 'status', header: 'מצב', render: (r) => <Chip variant={r.status === 'שולם' ? 'done' : r.status === 'חוב' ? 'attn' : 'info'}>{r.status}</Chip> },
];
const STEPS = [
  { key: 'c', label: 'לקוחה', value: 'שרה כהן', icon: 'user' },
  { key: 'd', label: 'תאריכים', value: '12.10' },
  { key: 'i', label: 'פריטים', value: '3 פריטים' },
  { key: 's', label: 'סיכום', locked: true, lockedReason: 'חסרים פריטים בהזמנה' },
  { key: 'p', label: 'תשלום', locked: true, lockedReason: 'קודם משלימים את הסיכום' },
];

function Sec({ id, title, children }) {
  return <section aria-labelledby={id} className="v3-stack" style={{ marginBlock: 'var(--v3-sp-6)' }}><h2 id={id} className="v3-h3">{title}</h2>{children}</section>;
}

function RtlCheck() {
  const box = useRef(null);
  const [res, setRes] = useState([]);
  const run = () => {
    const q = (s) => box.current.querySelector(s);
    const R = (el) => el.getBoundingClientRect();
    const out = [];
    const items = [...box.current.querySelectorAll('[data-rtl-item]')].map(R);
    out.push(['פריט ראשון בשורה נמצא מימין לאחרון', items[0].right > items[items.length - 1].right]);
    const lbl = R(q('[data-rtl-label]')), host = R(q('[data-rtl-host]'));
    out.push(['תווית מיושרת לקצה הימני של הקונטיינר', Math.abs(lbl.right - host.right) < 2]);
    const tl = [...document.querySelectorAll('.v3-tl-node')].map(R);
    out.push(['צומת סטפר ראשון מימין', tl[0].right > tl[tl.length - 1].right]);
    const sw = q('.v3-switch input'), knob = R(q('.v3-switch')), th = getComputedStyle(q('.v3-switch i'), '::after').insetInlineStart;
    out.push([`מתג כבוי: ידית בצד ימין (inset-inline-start=${th})`, sw && knob.width > 0 && parseFloat(th) < knob.width / 2]);
    const num = q('bdi');
    out.push(['מספרים ב-bdi (unicode-bidi: isolate)', getComputedStyle(num).unicodeBidi === 'isolate']);
    const dir = getComputedStyle(box.current).direction;
    out.push(['direction = rtl', dir === 'rtl']);
    setRes(out);
  };
  useEffect(run, []);
  return (
    <div ref={box} className="v3-stack">
      <div className="v3-cluster" data-rtl-host style={{ justifyContent: 'flex-start' }}>
        <Chip data-rtl-item>ראשון</Chip><Chip data-rtl-item>שני</Chip><Chip data-rtl-item>שלישי</Chip>
      </div>
      <span data-rtl-label className="v3-label" style={{ width: 'fit-content' }}>תווית לדוגמה <bdi>1,250</bdi></span>
      <Switch checked={false} onChange={() => {}} label="מתג לדוגמה" />
      <ul aria-label="תוצאות בדיקת RTL" style={{ margin: 0, paddingInlineStart: 'var(--v3-sp-5)' }}>
        {res.map(([t, ok]) => <li key={t} data-pass={ok}>{ok ? 'עבר' : 'נכשל'} — {t}</li>)}
      </ul>
      <Btn size="sm" onClick={run}>הרצה מחדש</Btn>
    </div>
  );
}

export default function Gallery() {
  const [tab, setTab] = useState('a');
  const [seg, setSeg] = useState('m');
  const [sw, setSw] = useState(true);
  const [step, setStep] = useState(2);
  const [dlg, setDlg] = useState(null); // confirm-light | confirm-dark | code-light | code-dark | form | sheet
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(true);
  const sorted = useSort(ROWS, COLS);
  const close = () => { setDlg(null); setCode(''); };
  const mode = (dlg || '').endsWith('dark') ? 'dark' : 'light';
  const kind = (dlg || '').split('-')[0];

  return (
    <V3Page>
      <h1 className="v3-h1">גלריית רכיבי v3</h1>
      <p className="v3-muted">לפיתוח בלבד. כל רכיב בכל מצב.</p>

      <Sec id="s-btn" title="כפתורים">
        <div className="v3-cluster">
          <Btn variant="primary" icon="check">ראשי</Btn>
          <Btn>משני</Btn>
          <Btn variant="quiet" iconEnd="next">שקט</Btn>
          <Btn variant="danger" icon="trash">מחיקה</Btn>
          <Btn variant="primary" disabled>מנוטרל</Btn>
          <Btn variant="primary" loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1800); }}>{loading ? 'שומר' : 'לחצי לטעינה'}</Btn>
          <Btn size="sm">קטן</Btn><Btn size="lg">גדול</Btn>
          <IconBtn icon="edit" label="עריכה" /><IconBtn icon="trash" label="מחיקה" variant="danger" />
        </div>
        <div className="v3-cluster" style={{ background: 'var(--v3-navy)', padding: 'var(--v3-sp-4)', borderRadius: 'var(--v3-r-lg)' }}>
          <Btn variant="on-dark" icon="plus">על כהה</Btn><Btn variant="on-dark" disabled>מנוטרל</Btn>
        </div>
      </Sec>

      <Sec id="s-chip" title="צ'יפים, תגיות, מספרים">
        <div className="v3-cluster"><Chip>ניטרלי</Chip><Chip variant="info" icon="info">מידע</Chip><Chip variant="done" icon="check">בוצע</Chip><Chip variant="gold">זהב</Chip><Chip variant="attn" icon="alert-circle">דורש טיפול</Chip><Chip variant="info" onClick={() => {}}>לחיץ</Chip></div>
        <div className="v3-cluster"><Tag>תגית</Tag><Tag variant="soft">רכה</Tag><Tag variant="done" icon="check">בוצע</Tag><Tag variant="attn">חוב</Tag><Badge>3</Badge><Badge variant="gold">12</Badge><Badge variant="neutral" large>7</Badge></div>
      </Sec>

      <Sec id="s-card" title="כרטיסים ושורות נתונים">
        <Card icon="user" title="פרטי לקוחה" tip="הפרטים כפי שנשמרו בהזמנה. שינוי כאן לא משנה את כרטיס הלקוחה." actions={<IconBtn icon="edit" label="עריכה" size="sm" />}>
          <Rows>
            <Row label="שם" icon="user">שרה כהן</Row>
            <Row label="טלפון" icon="phone" tip="מספר לשליחת הודעות ותזכורות."><bdi>050-1234567</bdi></Row>
            <Row label="כתובת" icon="pin" missing />
          </Rows>
        </Card>
        <div className="v3-grid">
          <Card variant="cust" icon="star" title="כרטיס לקוחה">מסגרת עבה</Card>
          <Card variant="info" title="כרטיס מידע">רקע תכלת</Card>
          <Card variant="quiet" title="כרטיס שקט">מסגרת בהירה</Card>
        </div>
      </Sec>

      <Sec id="s-field" title="שדות">
        <div className="v3-stack" style={{ maxWidth: 'var(--v3-dlg-w)' }}>
          <Field label="שם מלא" required hint="כמו שמופיע בתעודת זהות" placeholder="למשל: שרה כהן" tip="השם שיודפס על החשבונית." />
          <Field label="טלפון" error="מספר הטלפון לא תקין" defaultValue="05012" />
          <Field label="סניף" as="select" defaultValue="b"><option value="a">ירושלים</option><option value="b">בני ברק</option></Field>
          <Field label="הערות" as="textarea" hint="אופציונלי" />
          <Field label="מושבת" disabled defaultValue="לא ניתן לעריכה" />
          <Field label="קלט מותאם"><input type="date" /></Field>
        </div>
      </Sec>

      <Sec id="s-tabs" title="טאבים, מקטעים, מתג">
        <Tabs label="דוגמה" value={tab} onChange={setTab} items={[{ key: 'a', label: 'פרטים', icon: 'list' }, { key: 'b', label: 'תשלומים', count: 4 }, { key: 'c', label: 'היסטוריה', icon: 'history' }]} />
        <p role="tabpanel" aria-labelledby={`tab-${tab}`} className="v3-muted">תוכן הטאב: {tab}</p>
        <Seg label="גודל" value={seg} onChange={setSeg} options={[{ value: 's', label: 'קטן' }, { value: 'm', label: 'בינוני' }, { value: 'l', label: 'גדול' }]} />
        <Switch checked={sw} onChange={setSw} label={sw ? 'פעיל' : 'כבוי'} />
        <Switch checked={false} disabled label="מנוטרל" />
      </Sec>

      <Sec id="s-tip" title="Tip (ⓘ)">
        <div className="v3-cluster" style={{ justifyContent: 'space-between' }}>
          <span>ריחוף / מיקוד / מגע <Tip>הסבר קצר בריבוע צף. לא תופס מקום בעמוד.</Tip></span>
          <span>מותאם: <Tip content="עוגן מותאם"><Chip variant="info" data-testid="custom-tip">עוגן</Chip></Tip></span>
          <span id="tip-edge">קצה: <Tip>ריבוע ארוך שחייב להישאר בתוך החלון גם כשהכפתור בקצה. הוא ממוקם מחדש לפי גבולות החלון ולא חורג מהם לשום כיוון.</Tip></span>
        </div>
      </Sec>

      <Sec id="s-dlg" title="חלוניות">
        <div className="v3-cluster">
          <Btn onClick={() => setDlg('confirm-light')}>אישור — בהיר</Btn>
          <Btn onClick={() => setDlg('confirm-dark')}>אישור — כהה</Btn>
          <Btn onClick={() => setDlg('code-light')}>קוד — בהיר</Btn>
          <Btn onClick={() => setDlg('code-dark')}>קוד — כהה</Btn>
          <Btn onClick={() => setDlg('form')}>טופס (בהיר בלבד)</Btn>
          <Btn onClick={() => setDlg('sheet')}>גיליון קריאה</Btn>
        </div>
      </Sec>

      <Sec id="s-step" title="סטפר / ציר זמן">
        <Stepper steps={STEPS} current={step} onStep={setStep} />
        <StepNav onBack={step > 0 ? () => setStep(step - 1) : undefined} onNext={() => setStep(Math.min(STEPS.length - 1, step + 1))}
          backLabel="חזרה" nextLabel="להמשך" nextDisabled={step >= 2} nextTip="חסרים פריטים בהזמנה" />
        <Card title="יומן" icon="history"><Timeline events={[{ icon: 'check', title: 'ההזמנה נשמרה', sub: 'על ידי דנה', time: '12.10 · 09:14' }, { icon: 'card', title: 'שולם מקדמה', time: '12.10 · 09:20' }]} /></Card>
      </Sec>

      <Sec id="s-table" title="טבלה">
        <Table columns={COLS} rows={sorted.rows} sort={sorted.sort} onSort={sorted.onSort} caption="לקוחות" sticky
          renderExpanded={(r) => <Rows><Row label="פרטים נוספים">{r.name} — <bdi>{r.dresses}</bdi> שמלות</Row></Rows>} />
      </Sec>

      <Sec id="s-empty" title="מצב ריק ובאנרים">
        <Card><Empty icon="search" title="לא נמצאו הזמנות" text="נסי לשנות את הסינון או לחפש שם אחר." action={<Btn variant="primary" icon="plus">הזמנה חדשה</Btn>} /></Card>
        {banner && <Banner kind="info" title="עדכון מערכת" text="גרסה חדשה זמינה" action={{ label: 'פרטים', onClick: () => {} }} onClose={() => setBanner(false)} />}
        <Banner kind="warning" title="שים לב" text="הסכום לא תואם לתשלומים" />
        <Banner kind="success" title="נשמר" text="ההזמנה נשמרה בהצלחה" />
        <Banner kind="alert" title="חוב פתוח" text="ללקוחה יש חוב של 400 ₪" />
      </Sec>

      <Sec id="s-rtl" title="בדיקת RTL"><Card><RtlCheck /></Card></Sec>

      <Dialog open={kind === 'confirm'} mode={mode} onClose={close} icon="alert-tri" title="לבטל את ההזמנה?" sub="הפעולה תחזיר את הפריטים למלאי."
        actions={<><Btn variant="primary" onClick={close}>כן, לבטל</Btn><Btn variant="quiet" onClick={close}>חזרה</Btn></>} />
      <Dialog open={kind === 'code'} variant="code" mode={mode} onClose={close} icon="lock" title="נדרש אישור מנהל" sub="הקלידי את קוד האישור"
        actions={<><Btn variant="primary" disabled={code.length < 4} onClick={close}>אישור</Btn><Btn variant="quiet" onClick={close}>ביטול</Btn></>}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><CodeInput value={code} onChange={setCode} autoFocus /></div>
      </Dialog>
      <Dialog open={dlg === 'form'} variant="form" mode="dark" onClose={close} icon="mail" title="מייל מהיר" sub="נשלח ללקוחה מיד"
        actions={<><Btn variant="primary" icon="send" onClick={close}>שליחה</Btn><Btn variant="quiet" onClick={close}>ביטול</Btn></>}>
        <Field label="נמען" type="email" required placeholder="name@example.com" />
        <Field label="הודעה" as="textarea" />
      </Dialog>
      <Dialog open={dlg === 'sheet'} variant="sheet" onClose={close} title="פרטי תשלום" actions={<Btn onClick={close}>סגירה</Btn>}>
        <Rows><Row label="סכום"><bdi>₪1,250</bdi></Row><Row label="אמצעי">אשראי</Row><Row label="תאריך"><bdi>12.10.2026</bdi></Row></Rows>
      </Dialog>
    </V3Page>
  );
}
