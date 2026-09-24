// app/v3/icons/aliases.js — מקור אמת יחיד לאליאסים סמנטיים + אנימציית ברירת-מחדל
// של איקונים (LIBRARY-MAP §1, CONSTITUTION §ה.5). הועבר לכאן מתוך ui/Icon.js
// (שממשיך לייצא את אותם שמות לצורך תאימות - לא נשבר אף import קיים).
//
// C-1.11 (RTL): "הבא/קדימה/פתח = שמאלה; חזרה/הקודם = ימינה" - האליאסים האלה
// כבר מכוונים נכון גיאומטרית (תוקן בקומיט 00d0e84, ראו geometry ב-
// app/components/IconSprite.js: chevron-start מצויר שמאלה, chevron-end ימינה).
// **טבלת המיפוי היחידה**: כל קוד חדש קורא ל-Icon בשם סמנטי (next/prev/back/
// forward/expand/collapse/undo/redo) ולא לשם הגיאומטרי הגולמי (lint #5).

export const ICON_ALIASES = {
  close: 'x', add: 'plus', delete: 'trash', remove: 'trash', view: 'eye',
  success: 'check-circle', error: 'x-circle', warning: 'alert-tri', alert: 'alert-circle',
  order: 'bag', delivery: 'truck', print: 'printer', alteration: 'scissors',
  // RTL: "קדימה" = שמאלה (chevron-start, <), "אחורה" = ימינה (chevron-end, >)
  back: 'chevron-end', next: 'chevron-start', 'chevron-back': 'chevron-end', 'chevron-next': 'chevron-start',
  prev: 'chevron-end', forward: 'chevron-start',
  arrow: 'arrow-start', 'arrow-next': 'arrow-start', 'arrow-back': 'arrow-end', external: 'external-link', location: 'pin', 'pin-fixed': 'thumbtack',
  'user-verified': 'user-check', dress: 'shirt', ai: 'sparkles', stats: 'chart', offline: 'wifi-off',
  cart: 'cart', undo: 'undo', redo: 'redo',
};

// שמות תלויי-כיוון (CONSTITUTION §ה.5): מתהפכים ב-RTL דרך --v3-dir (icons.css).
// רשימה סגורה - טבלת המיפוי היחידה לבדיקת lint (#5) ולתיעוד בגלריה.
export const DIRECTIONAL_ICON_NAMES = [
  'next', 'prev', 'back', 'forward', 'expand', 'collapse',
  'chevron-start', 'chevron-end', 'arrow-start', 'arrow-end',
  'undo', 'redo', 'send', 'logout', 'list-forward',
];

// אנימציית ברירת מחדל לכל איקון (ICON-INVENTORY סעיף 2 + החדשים)
export const ICON_ANIM = {
  x: 'spin90', check: 'draw', 'alert-circle': 'shake', 'check-circle': 'draw', 'alert-tri': 'wiggle',
  refresh: 'spin', search: 'tilt', 'chevron-start': 'nudge', 'chevron-end': 'nudge-back', 'chevron-down': 'flip180',
  calendar: 'flip', plus: 'spin90', clock: 'spin', user: 'pop', link: 'wiggle', trash: 'shake', mail: 'fly',
  bag: 'bounce', tag: 'swing', info: 'pulse', history: 'rewind', list: 'pop', file: 'pop', box: 'bounce',
  'x-circle': 'shake', activity: 'pulse', 'arrow-end': 'nudge-back', 'arrow-start': 'nudge', edit: 'tilt', printer: 'rise', lock: 'pop',
  phone: 'ring', star: 'pop', card: 'nudge', coin: 'flip-y', pin: 'drop', scissors: 'snip', wallet: 'pop',
  download: 'drop', message: 'pop', shield: 'pulse', sort: 'rise', grid: 'pop', settings: 'spin90',
  upload: 'rise', home: 'bounce', truck: 'drive', users: 'pop', eye: 'blink', id: 'flip', expand: 'pulse',
  copy: 'pop', 'user-check': 'draw', logout: 'nudge', receipt: 'rise', camera: 'pop', folder: 'pop',
  more: 'bounce', mic: 'pulse', thumbtack: 'drop', menu: 'pop', archive: 'drop', bell: 'ring',
  database: 'pulse', 'external-link': 'nudge-diag', image: 'pop', category: 'pop', play: 'pop',
  unlock: 'wiggle', send: 'fly', sparkles: 'pulse', chart: 'rise', loader: 'spin', sun: 'spin90',
  moon: 'wiggle', 'wifi-off': 'shake', shirt: 'swing', ruler: 'tilt', server: 'pulse', flask: 'wiggle',
  undo: 'nudge-back', redo: 'nudge', cart: 'bounce',
};

export function resolveIconId(name = '') {
  const bare = String(name).replace(/^(i|ic)-/, '');
  return ICON_ALIASES[bare] || bare;
}
