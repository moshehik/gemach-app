'use client';

// פאנל המשתמש (ניווט 66/67 .sn-panel + 24/37/73 .sn-link) + כפתור המשתמש בסרגל (ניווט 90/122 button.sn-user).
// הפעולות (התנתקות, כניסה, היסטוריית הודעות מערכת) מבוצעות במעטפת; כאן רק התצוגה.

import { Ic, MenuRows } from './menuParts';

export function userDisplay(tree, me) {
  const u = tree.user || {};
  const first = me && me.firstName ? me.firstName : '';
  const last = me && me.lastName ? me.lastName : '';
  const name = me ? (`${first} ${last}`.trim() || u.name || '') : (u.name || '');
  const initials = me ? ((first.charAt(0) + last.charAt(0)) || u.initials || '') : (u.initials === 'U' ? '' : (u.initials || ''));
  const dept = me && me.department && me.department.name ? me.department.name : (u.department || '');
  return { name, initials, sub: `${u.roleLabel || ''}${dept && dept !== u.roleLabel ? ` · ${dept}` : ''}`, logged: !!u.logged };
}

/** הכפתור בסרגל (אווטאר + שם + חץ). */
export function UserButton({ info, open, onClick, tip }) {
  return (
    <button
      type="button"
      className="sn-user"
      aria-haspopup="true"
      aria-expanded={open ? 'true' : 'false'}
      aria-label={info.name ? `תפריט משתמש - ${info.name}` : 'תפריט משתמש'}
      data-tip={tip}
      onClick={onClick}
    >
      <span className="sn-av">{info.initials || <Ic n="user" cls="sm" />}</span>
      <span className="sn-uname">{info.name || (info.logged ? '' : 'אורח')}</span>
      <Ic n="chev" cls="sn-chev" />
    </button>
  );
}

/** תוכן הפאנל: כותרת + שורות. */
export function UserPanelBody({ tree, info, items, activeItemId, onNavigate, onAction }) {
  return (
    <>
      <div className="sn-uhead">
        <span className="sn-av">{info.initials || <Ic n="user" cls="sm" />}</span>
        <div>
          <strong>{info.logged ? info.name : 'אורח'}</strong>
          <span>{info.logged ? info.sub : (tree.user.roleLabel || 'התחברות לא פעילה')}</span>
        </div>
      </div>
      <div className="hf-l" role="group" aria-label="משתמש">
        <MenuRows items={items} menu activeItemId={activeItemId} onNavigate={onNavigate} onAction={onAction} />
      </div>
    </>
  );
}
