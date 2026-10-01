'use client';

// לשונית אחת בסרגל + פאנל הריחוף שלה (פלטה: ניווט 17/22/26/51/64/65 .sn-tab, 66/67 .sn-panel, 21/63 .sn-item).
// לשונית = קישור אמיתי (לחיצה פותחת את הדף) + חץ קטן (.sn-cv) שפותח את התפריט בריחוף / מגע / מקלדת.
// לשונית בלי href (opensMenuOnly, למשל "ניהול" למנהלת סניף): הלחיצה פותחת את התפריט ולא מנווטת.
// ההתנהגות (ריחוף, הצמדה, חצים) מנוהלת במעטפת ומועברת ב-props; כאן רק ה-DOM.

import Link from 'next/link';
import { Ic, MenuRows } from './menuParts';

export default function MenuTabItem({ tab, active, activeItemId, open, handlers, onNavigate, onAction }) {
  const hasMenu = Array.isArray(tab.items) && tab.items.some((x) => x.kind === 'link' || x.kind === 'action');
  const menuOnly = !tab.href;
  const cls = `sn-tab${hasMenu && !menuOnly ? ' hasm' : ''}${menuOnly ? ' hasm' : ''}${active ? ' active' : ''}`;
  return (
    <div
      className={`sn-item${open ? ' open' : ''}`}
      data-sn={tab.id}
      onPointerEnter={hasMenu ? (e) => handlers.enter(e, tab.id) : undefined}
      onPointerLeave={hasMenu ? (e) => handlers.leave(e, tab.id) : undefined}
      onKeyDown={hasMenu ? (e) => handlers.key(e, tab.id) : undefined}
    >
      {menuOnly ? (
        <button
          type="button"
          className={cls}
          data-sn-trigger
          aria-haspopup="true"
          aria-expanded={open ? 'true' : 'false'}
          onClick={() => handlers.toggle(tab.id)}
        >
          <Ic n={tab.icon} />
          {tab.label}
          <Ic n="chev" cls="sn-chev" />
        </button>
      ) : (
        <Link
          href={tab.href}
          className={cls}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => onNavigate(e, tab.href)}
        >
          <Ic n={tab.icon} />
          {tab.label}
        </Link>
      )}
      {hasMenu && !menuOnly && (
        <button
          type="button"
          className="sn-cv"
          data-sn-trigger
          aria-haspopup="true"
          aria-expanded={open ? 'true' : 'false'}
          aria-label={`תפריט ${tab.label}`}
          onClick={() => handlers.toggle(tab.id)}
        >
          <Ic n="chev" />
        </button>
      )}
      {hasMenu && (
        <div className="sn-panel" role="menu" aria-label={tab.label}>
          <div className="hf-l" role="group" aria-label={tab.label}>
            <MenuRows items={tab.items} menu activeItemId={activeItemId} onNavigate={onNavigate} onAction={onAction} />
          </div>
        </div>
      )}
    </div>
  );
}
