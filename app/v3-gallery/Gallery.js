'use client';
import { useEffect, useRef, useState } from 'react';
import {
  V3Page, Card, Btn, IconBtn, Chip, Tag, Badge, Field, Row, Rows, Tabs, Seg, Switch, Tip, Dialog, CodeInput,
  Stepper, StepNav, Timeline, Table, useSort, Empty, Banner, Icon,
} from '../v3/ui/components';
import { LayersProvider, useLayers, Popover, InfoTip } from '../v3/overlays';
import { AnimatedNumber } from '../v3/motion';
import { OrgConfigProvider, useOrgConfig } from '../v3/config';
import { useStrings } from '../v3/strings';

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

function LayerManagerDemo() {
  const layers = useLayers();
  const [popOpen, setPopOpen] = useState(false);
  const [amount, setAmount] = useState(1250);
  const anchorRef = useRef(null);
  const [log, setLog] = useState([]);
  const pushLog = (line) => setLog((l) => [line, ...l].slice(0, 6));

  return (
    <div className="v3-stack">
      <p className="v3-muted">
        מערכת שכבות חדשה (LayerManager, CONSTITUTION §ד) - מחסנית אחת, portal ל-body, נעילת גלילה +
        inert אוטומטיים, focus-trap, Esc רק לעליונה. <b>לא מורכבת ב-app/layout.js בסבב הזה</b> (ראו
        docs/redesign-v3/AGENT-QUESTIONS.md Q-1) - כאן, בגלריה, היא רק מוכיחה את עצמה.
      </p>
      <div className="v3-cluster">
        <Btn onClick={async () => { const ok = await layers.confirm({ title: 'לבטל את ההזמנה?', sub: 'הפעולה תחזיר את הפריטים למלאי.', danger: true, confirmLabel: 'כן, לבטל', cancelLabel: 'חזרה' }); pushLog(`confirm -> ${ok}`); }}>Confirm (בהיר/כהה לפי ערכת נושא)</Btn>
        <Btn onClick={async () => { const res = await layers.code({ title: 'נדרש אישור מנהל', sub: 'הקלידי קוד אישור', purpose: 'מחיקת פריט', approvers: [{ id: '1', name: 'דנה כהן' }, { id: '2', name: 'משה שיינועטר' }] }); pushLog(`code -> ${JSON.stringify(res)}`); }}>Code / PIN</Btn>
        <Btn onClick={async () => { const v = await layers.prompt({ title: 'מייל מהיר', label: 'נמען', defaultValue: 'name@example.com' }); pushLog(`prompt -> ${v}`); }}>Form (בהיר בלבד, גם בכהה)</Btn>
        <Btn onClick={async () => { await layers.open({ type: 'sheet', size: 'L', title: 'פרטי תשלום', body: <Rows><Row label="סכום"><bdi>₪1,250</bdi></Row><Row label="אמצעי">אשראי</Row></Rows>, dismiss: { esc: true, scrim: true } }); pushLog('sheet closed'); }}>Sheet</Btn>
        <Btn onClick={async () => {
          await layers.open({ type: 'busy', body: 'שומר…', autoCloseAfter: 1500 });
          pushLog('busy done');
        }}>Busy (חוסם)</Btn>
      </div>
      <div className="v3-cluster">
        <Btn variant="quiet" onClick={() => layers.toast({ title: 'נשמר', text: 'ההזמנה נשמרה בהצלחה', icon: 'check-circle' })}>Toast רגיל</Btn>
        <Btn variant="quiet" onClick={() => layers.toast({ kind: 'info', title: 'מידע', text: 'הפעולה בוצעה', duration: 2600, icon: 'info' })}>Toast מידע (2.6s)</Btn>
        <Btn variant="quiet" onClick={() => layers.notice({ text: 'ההזמנה נשמרה', icon: 'check-circle', action: { label: 'פתיחה', onClick: () => {} } })}>NoticeBar (15s, פס זהב יורד)</Btn>
        <span ref={anchorRef} style={{ display: 'inline-flex' }}><Btn variant="quiet" onClick={() => setPopOpen((o) => !o)}>Popover</Btn></span>
        <Popover anchorRef={anchorRef} open={popOpen} onClose={() => setPopOpen(false)} label="תפריט לדוגמה">
          <div className="v3-stack" style={{ padding: 'var(--v3-sp-2)' }}>
            <button type="button" className="v3-link" onClick={() => setPopOpen(false)}>פעולה ראשונה</button>
            <button type="button" className="v3-link" onClick={() => setPopOpen(false)}>פעולה שנייה</button>
          </div>
        </Popover>
        <span>סכום מונפש: <b><AnimatedNumber value={amount} format={(n) => `₪${n.toLocaleString('he-IL')}`} /></b> <Btn size="sm" variant="quiet" onClick={() => setAmount((a) => (a === 1250 ? 3400 : 1250))}>שינוי</Btn></span>
        <span>הסבר: <InfoTip content="ה-InfoTip הוא כפתור ⓘ 44×44 עם aria-label חובה, מציג את אותו Tip שמעל." /></span>
      </div>
      {log.length > 0 && (
        <Card title="יומן פעולות אחרונות" icon="history">
          <ul style={{ margin: 0, paddingInlineStart: 'var(--v3-sp-5)', fontSize: 'var(--v3-fs-sm)' }}>
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function OrgConfigReadout() {
  const cfg = useOrgConfig();
  const { t } = useStrings();
  return (
    <Card title={t('customer.card.title')} icon="user" tip="הכותרת ('כרטיס לקוחה') וכל שאר הטקסט כאן מגיעים מ-app/v3/strings/he.js דרך t(), לא כתובים בעמוד.">
      <Rows>
        <Row label="enable_deliveries (flag)"><Chip variant={cfg.flag('enable_deliveries') ? 'done' : undefined}>{String(cfg.flag('enable_deliveries'))}</Chip></Row>
        <Row label="delivery_price (num)"><bdi>₪{cfg.num('delivery_price')}</bdi></Row>
        <Row label="max_items_per_order (num)"><bdi>{cfg.num('max_items_per_order')}</bdi></Row>
        <Row label="require_customer_id_number (flag)">{cfg.flag('require_customer_id_number') ? `${t('customer.field.idNumber')} — חובה` : 'לא חובה'}</Row>
      </Rows>
      {cfg.flag('enable_deliveries') && (
        <p className="v3-muted" style={{ marginTop: 'var(--v3-sp-3)' }}>
          טאב המשלוח היה מופיע כאן בכרטיס הזמנה אמיתי — הפרופיל הנוכחי מדליק אותו.
        </p>
      )}
    </Card>
  );
}

/** מדגים useOrgConfig() בפועל: אותו רכיב (OrgConfigReadout) מוצג תחת ארבעה פרופילים
 * שונים בבת אחת (org1/org2/minimal/extreme) - בדיוק הבדיקה ש-CONSTITUTION §ט.4 דורש
 * לכל עמוד. strings/ מודגם באותו רכיב דרך t(). */
function StringsConfigDemo() {
  return (
    <div className="v3-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {['org1', 'org2', 'minimal', 'extreme'].map((p) => (
        <div key={p} className="v3-stack">
          <b className="v3-label">{p}</b>
          <OrgConfigProvider profile={p}><OrgConfigReadout /></OrgConfigProvider>
        </div>
      ))}
    </div>
  );
}

function GalleryInner() {
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

      <Sec id="s-dlg" title="חלוניות (ui/Dialog.js הישן — עדיין בשימוש באתר החי)">
        <div className="v3-cluster">
          <Btn onClick={() => setDlg('confirm-light')}>אישור — בהיר</Btn>
          <Btn onClick={() => setDlg('confirm-dark')}>אישור — כהה</Btn>
          <Btn onClick={() => setDlg('code-light')}>קוד — בהיר</Btn>
          <Btn onClick={() => setDlg('code-dark')}>קוד — כהה</Btn>
          <Btn onClick={() => setDlg('form')}>טופס (בהיר בלבד)</Btn>
          <Btn onClick={() => setDlg('sheet')}>גיליון קריאה</Btn>
        </div>
      </Sec>

      <Sec id="s-layers" title="LayerManager (app/v3/overlays/** — חדש, ראו CONSTITUTION §ד)">
        <LayerManagerDemo />
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

      <Sec id="s-strconf" title="strings/ + config/ — שימוש אמיתי (Scope E)">
        <StringsConfigDemo />
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

// LayersProvider עוטף רק את הגלריה עצמה (client component עצמאי) - **לא** ב-app/layout.js
// המשותף (ראו docs/redesign-v3/AGENT-QUESTIONS.md Q-1 להסבר המלא).
export default function Gallery() {
  return (
    <LayersProvider>
      <GalleryInner />
    </LayersProvider>
  );
}
