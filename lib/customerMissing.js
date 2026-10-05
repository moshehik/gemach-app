// "פרטי לקוח חסרים": הכלל של החיפוש המתקדם (app/api/a5/adv, התחום "לקוחות" > "חסר פרטי לקוח" והסטטוס "התראה" בהזמנות)
// ושל מיקוד "התראות" (app/api/a5/adv-alerts). השדות שהאתר תמיד דורש (שם פרטי / משפחה / טלפון ראשי)
// + mandatory_fields + mandatory_field_groups מההגדרות. הועבר מ-app/api/a5/adv/route.js כמו שהוא, כדי ששני הנתיבים לא ידרדרו זה מזה.
import { parseFieldGroups, getUnsatisfiedFieldGroups } from './customerValidation';

const ALIASES = {
  firstName: ['firstname', 'שם פרטי', 'שם_פרטי'],
  lastName: ['lastname', 'שם משפחה', 'שם_משפחה'],
  phone1: ['phone1', 'טלפון ראשי (נייד)', 'טלפון_1'],
  email: ['email', 'אימייל'],
  city: ['city', 'עיר'],
  street: ['street', 'רחוב'],
  houseNum: ['housenum', 'מספר בית', 'מספר_בית'],
};
const emptyStr = (v) => v === null || v === undefined || String(v).trim() === '';

export function missingRule(cfg) {
  const picked = (cfg.mandatory_fields || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const keys = ['firstName', 'lastName', 'phone1'];
  for (const k of Object.keys(ALIASES)) {
    if (!keys.includes(k) && ALIASES[k].some((a) => picked.includes(a.toLowerCase()))) keys.push(k);
  }
  return { keys, groups: parseFieldGroups(cfg.mandatory_field_groups) };
}

export function customerMissing(c, rule) {
  if (!c) return true;
  if (rule.keys.some((k) => emptyStr(c[k]))) return true;
  return getUnsatisfiedFieldGroups(c, rule.groups).length > 0;
}

const emptyCond = (k) => (k === 'houseNum' ? { [k]: null } : { OR: [{ [k]: null }, { [k]: '' }] });
export function customerMissingWhere(rule) {
  const or = rule.keys.map(emptyCond);
  for (const g of rule.groups) or.push({ AND: g.map(emptyCond) });
  return { OR: or };
}
