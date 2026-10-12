'use client';

// ארבעת השלבים של אשף "דגם חדש" (A5) - markup כמו step1()..step4() / itemRow() / savedView() בעיצוב המאושר (model-new.js), על ה-state של הבקר.
import { Ic, MnCatCombo, SegPill, SubH, Tip } from './MnUi';
import { useNoFill } from '@/lib/autofillGuard';
import { hDateFull } from './useModelNewController';
import { buildBarcode, locIcon, pad2, plural } from './modelNewLogic';

const Bad = ({ children }) => <><Ic n="alert" c="sm" />{children}</>;

// ---------------------------------------------------------------- שלב 1: זיהוי הדגם
export function StepIdentity({ ctl }) {
  const nf = useNoFill();
  const { S, codeLen } = ctl;
  const d = S.d;
  const showCe = ctl.codeErr && (S.touched.code || ctl.code !== '');
  const showNe = ctl.useModelNames && ((S.touched.name && !ctl.nameOk) || !!S.nameErr);
  const autoNameErr = !ctl.useModelNames && !showCe ? S.nameErr : ''; // שם אוטומטי ("דגם <קוד>") שכבר קיים - ההודעה ליד הקוד שממנו הוא נגזר
  return (
    <div className="card blk">
      <SubH icon="tag" tone="gold" title="זיהוי הדגם" />
      <div className="mn-g2">
        <div className={`field${showCe || autoNameErr ? ' bad' : ''}`} id="mnCodeF">
          <label className="lbl with-ic" htmlFor="mnCode"><Ic n="hash" c="sm" />קוד דגם<span className="req">*</span>
            <Tip t={`קידומת הברקוד של הפריטים (${codeLen} ספרות). הקוד מרכיב את ברקודי הפריטים ולא ניתן לשינוי לאחר היצירה`} /></label>
          <div className="mn-line">
            <div className="inpw">
              <input className="inp" id="mnCode" {...nf('code')} inputMode="numeric" dir="ltr" style={{ direction: 'ltr', textAlign: 'right' }} value={d.code}
                placeholder={ctl.codeLoading ? 'טוען קוד פנוי...' : '0'.repeat(codeLen)}
                onChange={(e) => ctl.onCode(e.target.value)} onBlur={() => ctl.touch('code')} />
            </div>
            <button type="button" className="btn sm" data-act="auto-code" data-tip="הקוד הפנוי הבא במאגר" onClick={ctl.autoCode}><Ic n="refresh" c="sm" />קוד פנוי</button>
          </div>
          <div className="mn-e" id="mnCodeE">{showCe ? <Bad>{ctl.codeErr}</Bad> : autoNameErr ? <Bad>{autoNameErr}</Bad> : null}</div>
        </div>
        {ctl.useModelNames ? (
          <div className={`field${showNe ? ' bad' : ''}`} id="mnNameF">
            <label className="lbl with-ic" htmlFor="mnName"><Ic n="tag" c="sm" />שם דגם<span className="req">*</span></label>
            <div className="inpw">
              <input className="inp" id="mnName" {...nf('name')} value={d.name} placeholder="לדוגמה: רומנטיקה"
                onChange={(e) => ctl.setField({ name: e.target.value })} onBlur={() => ctl.touch('name')} />
              <button type="button" className="inpx" aria-label="ניקוי" data-tip="ניקוי" hidden={!d.name}
                onClick={() => { ctl.setField({ name: '' }); const i = document.getElementById('mnName'); if (i) i.focus(); }}><Ic n="x" c="sm" /></button>
            </div>
            <div className="mn-e" id="mnNameE" role={S.nameErr ? 'alert' : undefined}>{showNe ? <Bad>{S.nameErr || 'חובה להזין שם דגם'}</Bad> : null}</div>
          </div>
        ) : null}
        <MnCatCombo id="mnCatT" value={d.cat} options={ctl.catOptions} open={S.catOpen} bad={S.touched.cat && !ctl.catOk}
          disabled={ctl.categories !== null && ctl.categories.length === 0} emptyText="אין קטגוריות מחיר"
          onToggle={ctl.toggleCat} onClose={ctl.closeCat} onPick={ctl.pickCat} />
        <div className="field">
          <label className="lbl with-ic" htmlFor="mnEntry"><Ic n="cal" c="sm" />תאריך כניסה למאגר</label>
          <div className="mn-date">
            <div className="inpw"><input className="inp" id="mnEntry" readOnly value={hDateFull(d.entry)} aria-label="תאריך כניסה למאגר (לוח עברי)" /></div>
            <button type="button" className="btn sm" data-act="date-entry" onClick={ctl.pickDate}><Ic n="pencil" c="sm" />שינוי תאריך</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- שלב 2: תמונה, הערות, בדיקה
export function StepMedia({ ctl, onPickFile }) {
  const { S } = ctl;
  const d = S.d;
  const has = !!d.img;
  return (
    <>
      {ctl.showImages ? (
        <div className="card blk">
          <SubH icon="dress" tone="gold" title={<>תמונת הדגם <Tip t={`אפשר לדלג — כשאין תמונה מועלית, המערכת מחפשת אוטומטית קובץ בשם ${ctl.code}.jpg`} /></>} />
          <div className={`mn-frame${has ? ' has' : ''}`}>
            {has
              // eslint-disable-next-line @next/next/no-img-element
              ? <img alt="תמונת הדגם" src={d.img} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = PH_IMG; }} />
              : <Ic n={ctl.uploading ? 'refresh' : 'dress'} />}
            <b>{ctl.uploading ? 'מעלה תמונה...' : has ? 'תמונה מקושרת' : 'אין תמונה'}</b>
            {has && d.imgLabel ? <small><bdi dir="ltr">{d.imgLabel}</bdi></small> : null}
          </div>
          <div className="mn-acts">
            <button type="button" className="btn sm" data-act="img-up" data-tip="העלאת קובץ תמונה" disabled={ctl.uploading} onClick={onPickFile}><Ic n="plus" c="sm" />{has ? 'החלפה' : 'העלאה'}</button>
            <button type="button" className="btn sm" data-act="img-url" data-tip="הזנת כתובת תמונה" disabled={ctl.uploading} onClick={ctl.imgFromUrl}><Ic n="clip" c="sm" />כתובת</button>
            {has ? <button type="button" className="btn sm" data-act="img-rm" data-tip="הסרת התמונה" onClick={ctl.removeImage}><Ic n="trash" c="sm" />הסרה</button> : null}
          </div>
        </div>
      ) : null}
      <div className="card blk">
        <SubH icon="note" tone="gold" title={<>הערות לדגם <Tip t="מידע שיוצג לעובד בעת בחירת הדגם" /></>} />
        <div className="field">
          <textarea className="inp" id="mnNotes" rows={4} aria-label="הערות לדגם" placeholder="לדוגמה: רכיסה אחורית — לשים לב בהחזרה" value={d.notes} onChange={(e) => ctl.setField({ notes: e.target.value })} />
        </div>
      </div>
      <div className="card blk">
        <div className="mn-swrow">
          <b><Ic n="eye" c="sm" />הצג בבדיקה <Tip t="כשמופעל — הדגם יופיע בהתראות המלאי ובבחירת פריט תוצג אזהרה לעובד" /></b>
          <SegPill id="mnInsp" label="הצג בבדיקה" value={!!d.inspect} onChange={(v) => ctl.setField({ inspect: v })}
            options={[{ v: true, label: 'כן', icon: 'check' }, { v: false, label: 'לא', icon: 'x' }]} />
        </div>
      </div>
    </>
  );
}

const PH_IMG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7ecc4"/><stop offset="1" stop-color="#d6ebfa"/></linearGradient><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b4079"/><stop offset="1" stop-color="#0f2c52"/></linearGradient></defs><rect width="240" height="300" fill="url(#g)"/><path d="M104 54c0 14 6 24 16 24s16-10 16-24l14 4 10 40-18 12 30 140c-30 14-86 14-120 0l30-140-18-12 10-40z" fill="url(#d)" stroke="#c9a227" stroke-width="3" stroke-linejoin="round"/></svg>')}`;

// ---------------------------------------------------------------- שלב 3: מלאי ראשוני
export function ItemRow({ it, code, enter, ro, onRemove }) {
  return (
    <article className={`hrow irow${enter ? ' enter' : ''}`} data-id={it.key}>
      <div className="li">
        <div className="ic-b"><Ic n="dress" /><span className="rlbl">פריט</span></div>
        <div className="t">
          <b><span data-tip="מידה">{it.size}</span> · <span data-tip="מספר סידורי">{pad2(it.serial)}</span></b>
          <span className="ln mi">
            <span className="lni" data-tip="ברקוד"><Ic n="scan" /><bdi>{buildBarcode(code, it.size, it.serial)}</bdi></span>
            <span className="lni"><Ic n={locIcon(it.loc)} />{it.loc}</span>
          </span>
        </div>
        {ro ? null : <button type="button" className="ibtn danger" data-rm={it.key} aria-label="הסרת פריט" data-tip="הסרת פריט" onClick={() => onRemove(it.key)}><Ic n="trash" c="sm" /></button>}
      </div>
    </article>
  );
}

function ItemRows({ ctl, ro }) {
  const { S } = ctl;
  if (!S.items.length) return null;
  return (
    <div className="hres mn-rows"><div className="hgrp">
      {S.items.map((it) => <ItemRow key={it.key} it={it} code={ctl.code} enter={it.key === S.lastKey} ro={ro} onRemove={ctl.removeItem} />)}
    </div></div>
  );
}

export function StepStock({ ctl }) {
  const nf = useNoFill();
  const { S } = ctl;
  // אחרי הוספה: המיקוד והבחירה עוברים למספר הסידורי (כמו בעיצוב) - להוספת כמה פריטים ברצף לאותה מידה
  const add = () => { if (ctl.addItem()) setTimeout(() => { const el = document.getElementById('mnSer'); if (el) { el.focus(); el.select(); } }, 0); };
  const A = S.add;
  const serial = A.serial !== '' ? A.serial : '';
  const locs = ctl.locations;
  return (
    <>
      <div className="card blk">
        <SubH icon="plus" tone="gold" title={<>הוספת פריט <Tip t="כל שורה היא פריט אחד. הברקוד נבנה אוטומטית מקוד הדגם + מידה + מס׳ סידורי. אפשר גם לדלג — ולהוסיף מלאי בכרטיס הדגם" /></>} />
        <div className="mn-g2" style={{ gridTemplateColumns: 'repeat(2,minmax(0,210px))', gap: '16px 20px' }}>
          <div className="field">
            <label className="lbl with-ic" htmlFor="mnSize"><Ic n="dress" c="sm" />מידה<span className="req">*</span></label>
            <div className="inpw"><input className="inp" id="mnSize" {...nf('size')} type="number" min="0" max="99" inputMode="numeric" placeholder="38" value={A.size}
              onChange={(e) => ctl.onSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /></div>
          </div>
          <div className="field">
            <label className="lbl with-ic" htmlFor="mnSer"><Ic n="hash" c="sm" />מס׳ סידורי</label>
            <div className="inpw"><input className="inp" id="mnSer" {...nf('serial')} type="number" min="1" max="99" inputMode="numeric" placeholder="אוטו׳" value={serial}
              onChange={(e) => ctl.setAdd({ serial: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /></div>
          </div>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label className="lbl with-ic"><Ic n="pin" c="sm" />מיקום</label>
          <SegPill id="mnLoc" label="מיקום" value={A.loc} onChange={(v) => ctl.setAdd({ loc: v })}
            options={locs.map((l) => ({ v: l, label: l, icon: locIcon(l) }))} />
        </div>
        <div className="mn-addrow">
          <div className="mn-barc" data-tip="ברקוד פריט — נבנה אוטומטית"><Ic n="scan" /><bdi id="mnBc">{ctl.bcPrev}</bdi></div>
          <button type="button" className="btn navy" data-act="add-item" onClick={add}><Ic n="plus" />הוסף פריט</button>
        </div>
        <div className="mn-e" id="mnAddE">{S.addErr ? <Bad>{S.addErr}</Bad> : null}</div>
      </div>
      <div className="card blk">
        <SubH icon="box" tone="gold" title={`פריטים (${S.items.length})`} />
        {S.items.length ? <ItemRows ctl={ctl} ro={false} /> : <div className="mn-empty"><Ic n="box" /><b>אין פריטים עדיין</b></div>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- שלב 4: סיכום
const Vf = ({ icon, label, children }) => {
  const has = children !== null && children !== undefined && String(typeof children === 'string' ? children : 'x').trim() !== '';
  return <div className="f"><Ic n={icon} /><div><small>{label}</small>{has ? <b>{children}</b> : <span className="faint">—</span>}</div></div>;
};
const EditB = ({ ctl, n, t }) => <button type="button" className="btn sm" data-go-step={n} data-tip={t} onClick={() => ctl.go(n)}><Ic n="pencil" c="sm" />עריכה</button>;
const Stat = ({ icon, v, l }) => <div className="mn-st"><Ic n={icon} /><b>{v}</b><small>{l}</small></div>;

export function StepSummary({ ctl }) {
  const { S } = ctl;
  const d = S.d;
  const n = S.items.length;
  return (
    <>
      <div className="card blk">
        <div className="mn-stats"><Stat icon="hash" v={<bdi>{ctl.code}</bdi>} l="קוד דגם" /><Stat icon="dress" v={ctl.sizes.length} l="מידות" /><Stat icon="box" v={n} l="פריטים שייווצרו" /></div>
      </div>
      <div className="card blk">
        <SubH icon="tag" tone="gold" title="זיהוי הדגם"><EditB ctl={ctl} n={1} t="חזרה לזיהוי הדגם" /></SubH>
        <div className="kv">
          {ctl.useModelNames ? <Vf icon="tag" label="שם דגם">{d.name.trim()}</Vf> : null}
          <Vf icon="card" label="קטגוריית מחיר">{d.cat}</Vf>
          <Vf icon="cal" label="תאריך כניסה למאגר">{hDateFull(d.entry)}</Vf>
        </div>
      </div>
      <div className="card blk">
        <SubH icon="dress" tone="gold" title={ctl.steps[1].l}><EditB ctl={ctl} n={2} t={`חזרה ל${ctl.steps[1].l}`} /></SubH>
        <div className="kv">
          {ctl.showImages ? <Vf icon="dress" label="תמונה">{d.img ? 'הועלתה' : <>תיטען אוטומטית לפי הקוד (<bdi dir="ltr">{ctl.code}.jpg</bdi>)</>}</Vf> : null}
          <Vf icon="eye" label="הצג בבדיקה">{d.inspect ? 'מופעל' : 'כבוי'}</Vf>
          <Vf icon="note" label="הערות">{d.notes.trim()}</Vf>
        </div>
      </div>
      <div className="card blk">
        <SubH icon="box" tone="gold" title={`הפריטים שייווצרו (${n})`}><EditB ctl={ctl} n={3} t="חזרה למלאי הראשוני" /></SubH>
        {n ? <ItemRows ctl={ctl} ro /> : (
          <div className="status debt"><Ic n="alert" />
            <div className="t"><b>הדגם ייווצר ללא פריטים <Tip t="דגם ללא פריטים פעילים לא יופיע כזמין בהזמנה חדשה. אפשר להוסיף פריטים מיד לאחר היצירה" /></b></div>
            <button type="button" className="btn sm" data-go-step="3" onClick={() => ctl.go(3)}><Ic n="plus" c="sm" />הוסף מלאי</button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- אחרי היצירה
export function StepSaved({ ctl }) {
  const sv = ctl.S.saved;
  const stats = [['dress', sv.sizes, 'מידות'], ['box', sv.n, 'פריטים נוצרו']];
  return (
    <>
      <div className="card blk"><div className="status ok"><Ic n="check" c="lg" /><div><small>הדגם נוצר</small><div className="n"><bdi>#{sv.code}</bdi> · {sv.name}</div></div></div></div>
      <div className="card blk"><div className="mn-stats">{stats.map(([i, v, l]) => <Stat key={l} icon={i} v={v} l={l} />)}</div></div>
      {sv.failed && sv.failed.length ? (
        <div className="card blk">
          <div className="status debt"><Ic n="alert" />
            <div className="t"><b>{plural(sv.failed.length, 'פריט אחד לא נוצר', 'פריטים לא נוצרו')}</b>
              <ul className="mn-fail">{sv.failed.map((f) => <li key={f.barcode}><bdi dir="ltr">{f.barcode}</bdi> — {f.msg}</li>)}</ul></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
