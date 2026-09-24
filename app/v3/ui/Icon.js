'use client';
// v3 <Icon> — עוטף <svg><use href="#i-name"> מהספרייט הקיים (IconSprite) + IconSpriteV3.
// אין path מקומי בעמוד (R2). אנימציה: ברירת מחדל לפי שם (ICON-INVENTORY), ניתנת לדריסה.
import '../icons.css';

// כינויים: שמות v3 מוצעים / וריאנטים קרובים -> id קיים בספרייט
export const ICON_ALIASES = {
  close: 'x', add: 'plus', delete: 'trash', remove: 'trash', view: 'eye',
  success: 'check-circle', error: 'x-circle', warning: 'alert-tri', alert: 'alert-circle',
  order: 'bag', delivery: 'truck', print: 'printer', alteration: 'scissors',
  back: 'chevron-start', next: 'chevron-end', 'chevron-back': 'chevron-start', 'chevron-next': 'chevron-end',
  arrow: 'arrow-end', external: 'external-link', location: 'pin', 'pin-fixed': 'thumbtack',
  'user-verified': 'user-check', dress: 'shirt', ai: 'sparkles', stats: 'chart', offline: 'wifi-off',
};

// אנימציית ברירת מחדל לכל איקון (ICON-INVENTORY סעיף 2 + החדשים)
export const ICON_ANIM = {
  x: 'spin90', check: 'draw', 'alert-circle': 'shake', 'check-circle': 'draw', 'alert-tri': 'wiggle',
  refresh: 'spin', search: 'tilt', 'chevron-start': 'nudge-back', 'chevron-end': 'nudge', 'chevron-down': 'flip180',
  calendar: 'flip', plus: 'spin90', clock: 'spin', user: 'pop', link: 'wiggle', trash: 'shake', mail: 'fly',
  bag: 'bounce', tag: 'swing', info: 'pulse', history: 'rewind', list: 'pop', file: 'pop', box: 'bounce',
  'x-circle': 'shake', activity: 'pulse', 'arrow-end': 'nudge', edit: 'tilt', printer: 'rise', lock: 'pop',
  phone: 'ring', star: 'pop', card: 'nudge', coin: 'flip-y', pin: 'drop', scissors: 'snip', wallet: 'pop',
  download: 'drop', message: 'pop', shield: 'pulse', sort: 'rise', grid: 'pop', settings: 'spin90',
  upload: 'rise', home: 'bounce', truck: 'drive', users: 'pop', eye: 'blink', id: 'flip', expand: 'pulse',
  copy: 'pop', 'user-check': 'draw', logout: 'nudge', receipt: 'rise', camera: 'pop', folder: 'pop',
  more: 'bounce', mic: 'pulse', thumbtack: 'drop', menu: 'pop', archive: 'drop', bell: 'ring',
  database: 'pulse', 'external-link': 'nudge-diag', image: 'pop', category: 'pop', play: 'pop',
  unlock: 'wiggle', send: 'fly', sparkles: 'pulse', chart: 'rise', loader: 'spin', sun: 'spin90',
  moon: 'wiggle', 'wifi-off': 'shake', shirt: 'swing', ruler: 'tilt', server: 'pulse', flask: 'wiggle',
};

const SIZE_CLASS = { xs: 'v3-ic--xs', sm: 'v3-ic--sm', md: '', lg: 'v3-ic--lg', xl: 'v3-ic--xl', '2xl': 'v3-ic--2xl' };

export function resolveIconId(name = '') {
  const bare = String(name).replace(/^(i|ic)-/, '');
  return ICON_ALIASES[bare] || bare;
}

/**
 * name  — id בספרייט או כינוי (עם/בלי i-/ic-)
 * size  — xs|sm|md|lg|xl|2xl (md = --v3-ic)
 * anim  — שם אנימציה | false לכיבוי | undefined = ברירת מחדל לפי שם
 * loop  — רציף (טעינה/המתנה); enter — קפיצת כניסה בטעינה
 * title — אם ניתן האיקון נגיש (role=img); אחרת aria-hidden
 */
export default function Icon({ name, size = 'md', anim, loop = false, enter = false, title, className = '', ...rest }) {
  const id = resolveIconId(name);
  const a = anim === false ? undefined : anim || ICON_ANIM[id];
  const cls = ['v3-ic', SIZE_CLASS[size] ?? '', enter ? 'v3-icon--enter' : '', className].filter(Boolean).join(' ');
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': 'true', focusable: 'false' };
  return (
    <svg className={cls} data-anim={a} data-loop={loop ? 'true' : undefined} {...a11y} {...rest}>
      <use href={`#i-${id}`} />
    </svg>
  );
}
