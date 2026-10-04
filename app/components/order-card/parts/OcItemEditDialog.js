'use client';

// OcItemEditDialog — חלון "עריכת פריט" (R24; העיצוב: WIN.edititem). אותם כללים כמו העריכה בשורה של הישן (MIM :884-1016):
//  - בתוך חלון 15 הדקות (או אחרי "פתיחת עריכה מלאה" באישור מנהל, feature:item_edit_reopen): דגם + מידה + תיקונים;
//  - אחרי שהחלון נסגר: החלפת מידה באותה קטגוריית מחיר בלבד כש-size_edit_until_days_before_event פעיל (אחרת המידה נעולה), ופירוט
//    התיקון תמיד; צוואר/שרוול/אורך רק בעריכה מלאה;
//  - "שמור" = PUT /api/orders/{id}/items/{itemId} עם הטיוטה (+ forceFullEdit כשנפתח מחדש) → applyServerOrder (MIM.handleConfirmItem).
// הטיוטה חיה בחלון (לא ב-state של הכרטיס) — ביטול = סגירה בלי שינוי (בישן: cancelEditItem החזיר את originalState).
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { editDraftOf, itemName } from '../hooks/useItemActions';
import { AltFields, ModelInput, SizeButtons, useSizeRows } from './OcAddItemPanel';

export default function OcItemEditDialog({ item, oc, ui, actions, rules, altEnabled, close }) {
  const [draft, setDraft] = useState(() => editDraftOf(item));
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fully = forced || rules.canFullyEdit(item);
  const canEditModelSize = fully && !!draft.dressModelId;
  const swapGeneral = !fully ? rules.sizeSwap(item) : { ok: false, reason: null };
  const canEditSizeOnly = !canEditModelSize && !!draft.dressModelId && swapGeneral.ok;
  const others = (oc.items || []).filter(x => x !== item && !(x.id && x.id === item.id));
  const { rows, loading } = useSizeRows(canEditModelSize || canEditSizeOnly ? draft.dressModelId : null, oc.order, oc.inventoryCache, others);
  const patch = (p) => setDraft(d => ({ ...d, ...p }));

  const reopen = async () => {
    const ok = await actions.reopenFullEdit(item);
    if (ok) setForced(true);
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // forceFullEdit נקבע בתוך confirmItem לפי הפריטים שנפתחו מחדש באישור מנהל (reopenFullEdit)
      const r = await actions.confirmItem(draft);
      if (r && r.ok) close(true);
    } finally {
      setBusy(false);
    }
  };
  const closedText = canEditSizeOnly
    ? 'חלון העריכה המלא (15 דק׳) נסגר — אפשר להחליף מידה באותה קטגוריית מחיר'
    : `חלון העריכה המלא (15 דק׳) נסגר — ${altEnabled ? 'ניתן לערוך כעת רק את פירוט התיקון' : 'להחלפת דגם/מידה יש לפתוח עריכה מלאה'}${swapGeneral.reason ? ` (${swapGeneral.reason})` : ''}`;

  return (
    <>
      <DlgHead id="oc-dlg-t" title="עריכת פריט" sub={`דגם ${itemName(item)} · מידה ${item.sizeText || '—'}`} />
      {!fully && !item.isNew ? <div className="faint oc-edit-note">{closedText}</div> : null}
      {canEditModelSize ? (
        <div className="grid2 oc-edit-grid">
          <div className="mfld">
            <label className="lbl" htmlFor="oc-edit-model"><OcIcon name="dress" size="sm" />דגם</label>
            <ModelInput id="oc-edit-model" ui={ui} value={draft.dressModelId ? { id: draft.dressModelId, name: draft.description, barcodePrefix: draft.barcodePrefix } : null}
              onChange={(m) => patch(m && m.id ? { dressModelId: m.id, barcodePrefix: m.barcodePrefix, description: m.name, sizeText: '' } : { dressModelId: '', barcodePrefix: '', description: '', sizeText: '' })} />
          </div>
          <div className="mfld">
            <span className="lbl" id="oc-edit-sizel"><OcIcon name="tag" size="sm" />מידה</span>
            {draft.dressModelId ? <SizeButtons rows={rows} order={oc.order} value={draft.sizeText} loading={loading} labelledBy="oc-edit-sizel" onChange={(s) => patch({ sizeText: s })} /> : <div className="faint oc-sizes-msg">יש לבחור דגם</div>}
          </div>
        </div>
      ) : canEditSizeOnly ? (
        <div className="mfld">
          <span className="lbl" id="oc-edit-sizel"><OcIcon name="tag" size="sm" />מידה חלופית פנויה</span>
          <SizeButtons rows={rows} order={oc.order} value={draft.sizeText} loading={loading} labelledBy="oc-edit-sizel"
            allow={(sz) => rules.sizeSwap(item, sz).ok}
            onChange={(s) => {
              const v = rules.sizeSwap(item, s);
              if (!v.ok) { setNotice(v.reason || ''); return; }
              setNotice('');
              patch({ sizeText: s });
            }} />
          <div className={`faint oc-edit-hint${notice ? ' err' : ''}`} aria-live="polite">{notice || 'אפשר להחליף רק למידה באותה קטגוריית מחיר.'}</div>
        </div>
      ) : null}
      {altEnabled ? <AltFields value={draft} idPrefix="oc-edit" label="תיקונים" lockedParts={!fully} onChange={patch} /> : null}
      {!fully && !item.isNew ? (
        <div className="oc-edit-reopen">
          <button type="button" className="btn block" data-act="full-edit" onClick={reopen}><OcIcon name="lock" size="sm" />פתיחת עריכה מלאה (אישור מנהל)</button>
        </div>
      ) : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" disabled={busy} onClick={save}>{busy ? 'שומר...' : 'שמור'}</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(false)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
