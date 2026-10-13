'use client';

// עורך "דברי דואר" (mail-merge): טקסט חופשי שבתוכו שדות מוחלפים מופיעים כצ'יפים ({{customerName}} וכד') שאפשר
// להזיז (גרירה), למחוק (× או Backspace) ולהוסיף (לחיצה על צ'יפ בפלטה, או גרירה אליו). הערך שנשמר הוא מחרוזת רגילה עם {{שם}}.
// contenteditable לא מבוקר: ה-DOM נבנה מחדש רק כשהערך מבחוץ שונה ממה שנשלח מהעורך עצמו (איפוס/ביטול), כדי שהסמן לא יקפוץ.
// בטיחות: אין innerHTML - רק createElement/createTextNode; הדבקה היא טקסט פשוט בלבד.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const VAR_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
const ZW = '​';
const DRAG_TYPE = 'text/x-ec-var';

export const shortLabel = (v) => String((v && v.label) || '').replace(/\s*\(.*$/, '').trim() || (v && v.key) || '';

function makeChip(key, vars) {
  const v = vars.find((x) => x.key === key);
  const chip = document.createElement('span');
  chip.className = `ec-chip${v ? '' : ' ec-chip-bad'}`;
  chip.setAttribute('contenteditable', 'false');
  chip.setAttribute('draggable', 'true');
  chip.dataset.var = key;
  chip.title = v ? `${v.label}${v.example ? ` - לדוגמה: ${v.example}` : ''}` : 'משתנה לא מוכר - יידחה בשמירה';
  chip.textContent = v ? shortLabel(v) : key;
  const x = document.createElement('span');
  x.className = 'ec-chip-x';
  x.setAttribute('data-x', '1');
  x.setAttribute('aria-label', 'הסרת השדה');
  x.textContent = '×';
  chip.appendChild(x);
  return chip;
}

function renderInto(root, value, vars) {
  root.textContent = '';
  const lines = String(value ?? '').split('\n');
  lines.forEach((line, i) => {
    if (i > 0) root.appendChild(document.createElement('br'));
    let idx = 0;
    line.replace(VAR_RE, (m, key, off) => {
      if (off > idx) root.appendChild(document.createTextNode(line.slice(idx, off)));
      root.appendChild(makeChip(key, vars));
      root.appendChild(document.createTextNode(ZW)); // עוגן לסמן אחרי צ'יפ
      idx = off + m.length;
      return m;
    });
    if (idx < line.length) root.appendChild(document.createTextNode(line.slice(idx)));
  });
}

export function serialize(root) {
  let out = '';
  const walk = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1) {
        if (n.dataset && n.dataset.var) out += `{{${n.dataset.var}}}`;
        else if (n.tagName === 'BR') out += '\n';
        else if (n.tagName === 'DIV' || n.tagName === 'P') { if (out && !out.endsWith('\n')) out += '\n'; walk(n); } else walk(n);
      }
    });
  };
  walk(root);
  return out.replace(/​/g, '');
}

function caretFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange();
    r.setStart(p.offsetNode, p.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

const MergeEditor = forwardRef(function MergeEditor({ value, onChange, vars = [], multiline = false, placeholder = '', ariaLabel = '', disabled = false, onFocusEditor }, ref) {
  const rootRef = useRef(null);
  const lastEmitted = useRef(null);
  const savedRange = useRef(null);
  const dragged = useRef(null);
  const varsRef = useRef(vars);
  useEffect(() => { varsRef.current = vars; }, [vars]);

  const emit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const v = serialize(root);
    lastEmitted.current = v;
    if (onChange) onChange(v);
  }, [onChange]);

  // בנייה מחדש רק כשהערך מבחוץ שונה ממה שהעורך עצמו פלט (איפוס / ביטול שינויים / החלפת מייל)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (lastEmitted.current === value && root.childNodes.length) return;
    renderInto(root, value, varsRef.current);
    lastEmitted.current = value;
  }, [value, vars]);

  // שומר את מיקום הסמן האחרון בתוך העורך (לחיצה על צ'יפ בפלטה מוציאה את הפוקוס)
  useEffect(() => {
    const onSel = () => {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (root && sel && sel.rangeCount && root.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const placeCaretAfter = (node) => {
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
  };

  const insertChipAt = useCallback((range, key) => {
    const chip = makeChip(key, varsRef.current);
    const zw = document.createTextNode(ZW);
    range.deleteContents();
    range.insertNode(zw);
    range.insertNode(chip);
    placeCaretAfter(zw);
    emit();
  }, [emit]);

  useImperativeHandle(ref, () => ({
    insertVar(key) {
      const root = rootRef.current;
      if (!root || disabled) return;
      root.focus();
      let range = savedRange.current;
      if (!range || !root.contains(range.startContainer)) {
        range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
      }
      insertChipAt(range, key);
    },
  }), [insertChipAt, disabled]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!multiline) return;
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const br = document.createElement('br');
      const zw = document.createTextNode(ZW);
      r.insertNode(zw);
      r.insertNode(br);
      placeCaretAfter(zw);
      emit();
    }
  };

  const onClick = (e) => {
    const x = e.target.closest && e.target.closest('[data-x]');
    if (!x || disabled) return;
    const chip = x.closest('.ec-chip');
    if (!chip) return;
    const next = chip.nextSibling;
    if (next && next.nodeType === 3 && next.nodeValue === ZW) next.remove();
    chip.remove();
    emit();
  };

  const onPaste = (e) => {
    e.preventDefault();
    let text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    text = multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/\s*\n\s*/g, ' ');
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    // כל {{שדה}} בטקסט שהודבק הופך לצ'יפ
    const frag = document.createDocumentFragment();
    text.split('\n').forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement('br'));
      let idx = 0;
      line.replace(VAR_RE, (m, key, off) => {
        if (off > idx) frag.appendChild(document.createTextNode(line.slice(idx, off)));
        frag.appendChild(makeChip(key, varsRef.current));
        frag.appendChild(document.createTextNode(ZW));
        idx = off + m.length;
        return m;
      });
      if (idx < line.length) frag.appendChild(document.createTextNode(line.slice(idx)));
    });
    const last = frag.lastChild;
    r.insertNode(frag);
    if (last) placeCaretAfter(last);
    emit();
  };

  const onDragStart = (e) => {
    const chip = e.target.closest && e.target.closest('.ec-chip');
    if (!chip) return;
    dragged.current = chip;
    e.dataTransfer.setData(DRAG_TYPE, chip.dataset.var);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e) => {
    if (disabled) return;
    if (Array.from(e.dataTransfer.types || []).includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('ec-drop');
    }
  };

  const onDrop = (e) => {
    e.currentTarget.classList.remove('ec-drop');
    const key = e.dataTransfer.getData(DRAG_TYPE);
    if (!key || disabled) return;
    e.preventDefault();
    const root = rootRef.current;
    const range = caretFromPoint(e.clientX, e.clientY);
    const target = range && root.contains(range.startContainer) ? range : (() => { const r = document.createRange(); r.selectNodeContents(root); r.collapse(false); return r; })();
    const moving = dragged.current && root.contains(dragged.current) ? dragged.current : null;
    // גרירה בתוך אותו עורך = העברה: מסירים את המקור (ואת העוגן שאחריו) לפני ההוספה
    if (moving) {
      if (moving.contains(target.startContainer)) { dragged.current = null; return; }
      const nx = moving.nextSibling;
      if (nx && nx.nodeType === 3 && nx.nodeValue === ZW && nx !== target.startContainer) nx.remove();
      moving.remove();
    }
    dragged.current = null;
    insertChipAt(target, key);
  };

  return (
    <div
      ref={rootRef}
      className={`ec-merge${multiline ? ' ec-multi' : ''}`}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-placeholder={placeholder}
      dir="rtl"
      spellCheck
      onInput={emit}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onPaste={onPaste}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={(e) => e.currentTarget.classList.remove('ec-drop')}
      onDrop={onDrop}
      onDragEnd={() => { dragged.current = null; }}
      onFocus={() => { if (onFocusEditor) onFocusEditor(ref && typeof ref === 'object' ? ref.current : null); }}
    />
  );
});

export default MergeEditor;

/** פלטת צ'יפים: לחיצה מוסיפה לעורך האחרון שהיה בפוקוס; אפשר גם לגרור לכל עורך. */
export function VarPalette({ vars, onInsert, title = 'שדות מוחלפים' }) {
  if (!vars || !vars.length) return null;
  return (
    <div className="ec-palette" role="group" aria-label={title}>
      <b>{title}:</b>
      {vars.map((v) => (
        <span
          key={v.key}
          className="ec-chip"
          role="button"
          tabIndex={0}
          draggable
          title={`${v.label}${v.example ? ` - לדוגמה: ${v.example}` : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(v.key)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert(v.key); } }}
          onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, v.key); e.dataTransfer.effectAllowed = 'copyMove'; }}
        >
          {shortLabel(v)}
        </span>
      ))}
      <small className="faint">לחיצה = הוספה במקום הסמן · גרירה = הצבה בכל מקום · × = הסרה</small>
    </div>
  );
}
