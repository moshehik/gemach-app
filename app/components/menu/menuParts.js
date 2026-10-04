'use client';

// חלקים קטנים משותפים למעטפת החדשה (MenuA5Shell). אין כאן לוגיקה עסקית.

import { createElement } from 'react';
import Link from 'next/link';
import { SPRITE_ID_PREFIX, SPRITE_SYMBOLS } from './spriteSymbols';

/**
 * ספריית האייקונים של הפלטה (design-system/sprite.svg), מוטמעת פעם אחת בתוך הדף תחת המזהים gmi-<שם>.
 * מוצגת ב-MenuA5Shell; Ic מפנה אליה בהפניה פנימית (#gmi-x).
 *
 * למה מוטמע ולא <use href="/design-system/sprite.svg#i-x"> כמו שהיה: מסנני תוכן של אינטרנט מסונן
 * (Netspark/רימון/נטפרי וכד') מיירטים HTTPS ומחליפים קובצי "תמונה" שלא אושרו בריבוע לבן 2x2 - וכך גם
 * את קובץ ה-sprite (image/svg+xml, 10KB). התוצאה: המעטפת עלתה בלי אייקונים בכלל אצל מי שגולש דרך מסנן.
 * ה-HTML עצמו עובר במסנן ללא שינוי, בדיוק כמו ה-IconSprite של האתר הישן. הקידומת gmi- מונעת התנגשות עם
 * 30 המזהים i-* שקיימים גם ב-app/components/IconSprite.js (ר' design-system/README.md, "אייקונים").
 * spriteSymbols.js נוצר אוטומטית: node scripts/build_menu_sprite.mjs (נבדק ב-scripts/test_menu_logic.mjs).
 */
export function MenuSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true" focusable="false" data-gm-sprite="">
      <defs>
        {SPRITE_SYMBOLS.map(([id, viewBox, shapes]) => (
          <symbol key={id} id={`${SPRITE_ID_PREFIX}${id}`} viewBox={viewBox}>
            {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/** אייקון מספריית הפלטה: הפניה פנימית ל-MenuSprite (#gmi-<שם>), בלי בקשת רשת. */
export function Ic({ n, cls = '' }) {
  return (
    <svg className={`ic ia-${n} ia-h${cls ? ` ${cls}` : ''}`} aria-hidden="true" focusable="false">
      <use href={`#${SPRITE_ID_PREFIX}${n}`} />
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

/** התווית של פריט שעדיין לא נבנה (kind:'soon'): שורה כבויה, לא קישור ולא ניתנת למיקוד. */
export const SOON_LABEL = 'בקרוב';
export function tipOf(item) {
  if (!item || !item.tip) return undefined;
  // "מהכלים שנפתחו לאחרונה" (שורת אחרונים בפאנל "ניהול") הוא טקסט למשתמשת — לא מוסתר גם בשורות שהערת התכנון שלהן מוסתרת.
  if (item.recent) return String(item.tip);
  if (HIDE_TIP_IDS.has(item.id)) return undefined;
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
      {/* סימון "נפתח לאחרונה" גלוי גם בלי ריחוף (מקלדת / מגע) + טקסט לקורא מסך */}
      {item.recent && !k ? (
        <span className="sn-k sn-recent">
          <Ic n="sn-history" />
          <span className="sr-only">נפתח לאחרונה</span>
        </span>
      ) : null}
    </>
  );
  const cls = `sn-link${item.danger ? ' danger' : ''}`;
  if (item.kind === 'soon') {
    // "בקרוב": אלמנט כבוי (span) - לא <a>, לא <button>, בלי tabindex; מתעלם מלחיצות.
    return (
      <span className="sn-link is-miss" role={menu ? 'menuitem' : undefined} aria-disabled="true" data-tip={tip} data-menu-id={item.id}>
        <SnLi n={item.icon} />
        {item.label}
        <span className="sn-k">{SOON_LABEL}</span>
      </span>
    );
  }
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
