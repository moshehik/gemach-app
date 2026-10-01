'use client';

// חלקים קטנים משותפים למעטפת החדשה (MenuA5Shell). אין כאן לוגיקה עסקית.

import Link from 'next/link';

/** אייקון מה-sprite של הפלטה (design-system/sprite.svg). הפניה חיצונית בכוונה - ר' design-system/README.md. */
export function Ic({ n, cls = '' }) {
  return (
    <svg className={`ic ia-${n} ia-h${cls ? ` ${cls}` : ''}`} aria-hidden="true" focusable="false">
      <use href={`/design-system/sprite.svg#i-${n}`} />
    </svg>
  );
}

/** העטיפה הריבועית של האייקון בתוך שורת תפריט (ניווט 78/80, span.sn-li). */
export function SnLi({ n }) {
  return (
    <span className="sn-li">
      <Ic n={n} />
    </span>
  );
}

// טולטיפים שהם הערות תכנון מתצוגת העיצוב ולא טקסט למשתמשת: לא מציגים אותם באתר.
const HIDE_TIP_IDS = new Set(['ad-models', 'ad-refunds', 'ad-deliveries', 'sched']);
export function tipOf(item) {
  if (!item || !item.tip || HIDE_TIP_IDS.has(item.id)) return undefined;
  // הסרת סוגריים טכניים כמו "(page:orders)" אם נשארו בטקסט.
  const t = String(item.tip).replace(/\s*\(page:[^)]*\)/g, '').trim();
  return t || undefined;
}

/**
 * שורה בפאנל / במגירה: קישור (a.sn-link, ניווט 24/73) או פעולה (button.sn-link).
 * @param {object} p
 * @param {object} p.item         שורת עץ ({ kind: 'link'|'action', id, label, icon, href?, action?, tip?, danger?, temporary? })
 * @param {boolean} [p.menu]      role=menuitem (בפאנל קופץ)
 * @param {boolean} [p.active]    aria-current=page
 * @param {(e, item) => void} p.onNavigate  נקרא בלחיצה על קישור (המעטפת סוגרת פאנלים ומטפלת ב-#hash)
 * @param {(item) => void} p.onAction       נקרא בלחיצה על פעולה
 * @param {string} [p.tail]       טקסט צדדי (sn-k)
 */
export function MenuRow({ item, menu = false, active = false, onNavigate, onAction, tail }) {
  const tip = tipOf(item);
  const k = tail || (item.temporary ? 'זמני' : '');
  const content = (
    <>
      <SnLi n={item.icon} />
      {item.label}
      {k ? <span className="sn-k">{k}</span> : null}
    </>
  );
  const cls = `sn-link${item.danger ? ' danger' : ''}`;
  if (item.kind === 'action' || !item.href) {
    return (
      <button
        type="button"
        className={cls}
        role={menu ? 'menuitem' : undefined}
        data-tip={tip}
        data-menu-id={item.id}
        onClick={() => onAction && onAction(item)}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      className={cls}
      role={menu ? 'menuitem' : undefined}
      aria-current={active ? 'page' : undefined}
      data-tip={tip}
      data-menu-id={item.id}
      onClick={(e) => onNavigate && onNavigate(e, item.href)}
    >
      {content}
    </Link>
  );
}

/** רשימת שורות מהעץ (קישור / פעולה / מפריד / כותרת). */
export function MenuRows({ items, menu = false, activeItemId, onNavigate, onAction }) {
  return (
    <>
      {(items || []).map((it, i) => {
        if (it.kind === 'separator') return <div key={`s${i}`} className="sn-sep" />;
        if (it.kind === 'heading') return <div key={`h${i}`} className="sn-st">{it.label}</div>;
        return (
          <MenuRow
            key={it.id || i}
            item={it}
            menu={menu}
            active={!!activeItemId && it.id === activeItemId}
            onNavigate={onNavigate}
            onAction={onAction}
          />
        );
      })}
    </>
  );
}

/** "לפני 5 דקות" / "אתמול" - כמו rel() בעיצוב. */
export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  const plural = (n, one, many) => (n === 1 ? `${one}` : `${n} ${many}`);
  if (s < 45) return 'הרגע';
  const m = Math.round(s / 60);
  if (m < 60) return `לפני ${m === 1 ? 'דקה' : `${m} דקות`}`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h === 1 ? 'שעה' : `${h} שעות`}`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${plural(d, 'יום', 'ימים')}`;
}
