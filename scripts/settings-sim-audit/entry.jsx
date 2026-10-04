// מסכי ההגדרות האמיתיים (SettingsSimPage + settings-sim.css + ה-CSS הגלובלי של האתר) בלי שרת ובלי DB — fetch מדומה.
// ?view=sys|site|names (ברירת מחדל sys) · ?nosession=1 = POST /api/settings מחזיר 401 עד שנשלחים employeeId+pin (חלון האישור)
// ?empty=1 = אין שורות הגדרה · ?fail=1 = GET /api/settings נכשל · ?tab=<קטגוריה>&highlight=<key> = קישור עמוק (כמו הישן)
// כל POST נרשם ב-window.__posts (לבדיקת המטען). הנתונים: כל מפתח במטא-דאטה בקטגוריה שלו + ערכי דוגמה של העיצוב.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsSimPage from '../../app/components/settings-sim/SettingsSimPage.js';
import { LabelsProvider } from '../../app/components/LabelsContext.js';
import { SETTINGS_ORDER, SETTINGS_BOOLEAN_KEYS } from '../../lib/settingsMetadata.js';

const sp = new URLSearchParams(location.search);
const view = sp.get('view') || 'sys';

const SAMPLE = {
  gmach_name: 'גמ״ח השמלות', gmach_phone: '050-555-0142', main_email: 'office@example.org', gmach_address: 'רחוב הדוגמה 12, ירושלים',
  BUFFER_DAYS: '3', inventory_buffer_days: '3', enable_rental_extension: 'false', hide_gregorian_calendar: 'true', hide_custom_spacing: 'false',
  require_login: 'true', item_locations: 'מדף א, מדף ב, קומה 2, מחסן אחורי', branches_enabled: 'false', branch_list: 'סניף מרכז, סניף בית שמש', track_branch_on_order: 'false',
  home_welcome_title: 'ברוכים הבאים למערכת הניהול של גמ״ח השמלות — סניף מרכז הארץ והשפלה',
  ALLOWED_PAYMENT_METHODS: 'אשראי (דרך נדרים פלוס),מזומן,יציאה באישור מנהל', PAYMENT_APPROVAL_LEVEL: 'כולם',
  instant_undo_minutes: '', CANCELLATION_CREDIT_MINUTES: '15', REFUND_PERCENTAGE: '50', REFUND_DAYS_FROM_ORDER: '7', NO_REFUND_DAYS_BEFORE_EVENT: '14',
  premium_categories: 'כלה, ערב', swap_min_days_before_event: '2', swap_pairing_window_minutes: '', size_edit_until_days_before_event: '', gap_size_price_rule: 'none',
  nedarim_plus_terminal: '7001234', NEDARIM_MOSAD: '7001234', nedarim_plus_token: '••••••••', nedarim_rinat_lev_url: '', hok_auto_charge_hour: '19:00', hok_charge_amount: '',
  barcodePrefixLength: '3', pickup_reminder_hour: '10:00', late_return_email_text: 'שלום, טרם הוחזרה השמלה. נשמח להחזרה בהקדם.', late_return_threshold_days: '3',
  daily_manager_report_hour: '07:30', daily_manager_report_email: '', mailing_list_provider: '', agent_digest_email_hours: '17:00,00:00',
  yemot_api_url: 'https://www.call2all.co.il/ym/api/', yemot_api_token: '', mandatory_fields: 'שם_פרטי, שם_משפחה, טלפון_1', mandatory_field_groups: '[["phone2","email"]]',
  max_items_per_order: '6', order_new_redirect_screen: 'order', order_edit_redirect_screen: 'orders_list',
  delivery_price: '40', delivery_price_by_city: '{"ירושלים":60}', delivery_days_before: '1', delivery_days_after: '1', courier_name: '', courier_email: '',
  print_rental_box1: 'יש להחזיר את השמלה נקייה ומגוהצת.', print_rental_box2: '', print_rental_footer: 'אני מאשרת את תקנון הגמ״ח.', standard_return_hour: '20:00', rental_belt_notice: '',
  cancel_order_permission: 'הנהלה ראשית, מנהל סניף', reserve_permission: 'הנהלה ראשית', items_name_singular: 'שמלה', items_name_plural: 'שמלות', barcode_length: '8', REFUND_DAYS: '30', gmach_subtitle: '',
  email_link_a: 'https://script.google.com/macros/s/AAA/exec', email_link_b: 'https://script.google.com/macros/s/BBB/exec', email_routing_strategy: 'bugs_b_rest_a', email_drive_folder_id: '',
  agent_fix_loop_last_activity: '2026-10-03T21:15:00.000Z', non_working_days_extra: '{"version":1,"days":[]}', login_page_new: 'true',
};
const rows = [];
let id = 1;
if (!sp.get('empty')) {
  for (const [cat, keys] of Object.entries(SETTINGS_ORDER)) {
    for (const key of keys) {
      if (rows.some((r) => r.key === key)) continue;
      const value = SAMPLE[key] !== undefined ? SAMPLE[key] : (SETTINGS_BOOLEAN_KEYS.includes(key) ? (id % 3 ? 'true' : 'false') : '');
      rows.push({ id: id++, key, value, category: cat, name: key, type: SETTINGS_BOOLEAN_KEYS.includes(key) ? 'boolean' : null, notes: null });
    }
  }
  rows.push(
    { id: id++, key: 'NEDARIM_MOSAD', value: '7001234', category: 'תשלומים', name: 'NEDARIM_MOSAD' },
    { id: id++, key: 'email_drive_folder_id', value: '', category: 'מיילים', name: 'email_drive_folder_id' },
    { id: id++, key: 'neon_api_key', value: '••••••••', category: 'מסד נתונים', name: 'neon_api_key' },
    { id: id++, key: 'inventory_hold_minutes', value: '30', category: 'מלאי', name: 'inventory_hold_minutes' },
    { id: id++, key: 'standard_pickup_hours', value: '20:00-21:30', category: 'הדפסה', name: 'standard_pickup_hours' },
    { id: id++, key: 'backup_enabled', value: 'true', category: 'גיבויים', name: 'גיבוי אוטומטי לדרייב פעיל', type: 'boolean' },
    { id: id++, key: 'backup_interval_hours', value: '24', category: 'גיבויים', name: 'תדירות גיבוי אוטומטי (שעות)', type: 'number' },
  );
}

window.__posts = [];
let dbMode = 'prod';
const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const realFetch = window.fetch.bind(window);
window.fetch = (url, init = {}) => {
  const u = String(url);
  const method = (init.method || 'GET').toUpperCase();
  if (u.startsWith('/api/settings/labels')) {
    if (method === 'POST') { window.__posts.push({ url: u, body: JSON.parse(init.body) }); return json(200, { success: true }); }
    return json(200, { customer_firstName: 'שם פרטי', order_status: 'מצב ההזמנה' });
  }
  if (u.startsWith('/api/settings')) {
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      window.__posts.push({ url: u, body });
      if (sp.get('nosession') && !(body.employeeId && body.pin)) return json(401, { error: 'Unauthorized. Admin access required.' });
      if (sp.get('nosession') && body.pin !== '1234') return json(401, { error: 'Unauthorized. Admin access required.' });
      return json(200, { success: true, message: 'Settings saved successfully' });
    }
    if (sp.get('fail')) return json(500, { error: 'Failed to fetch settings' });
    return json(200, rows);
  }
  if (u.startsWith('/api/departments')) return json(200, [{ roleId: 0, name: 'הנהלה ראשית' }, { roleId: 1, name: 'מנהל סניף' }, { roleId: 3, name: 'אחראית משמרת' }, { roleId: 4, name: 'עובדת' }, { roleId: 5, name: 'כובסת' }]);
  if (u.startsWith('/api/employees')) return json(200, [{ id: 'e1', fullName: 'שולמית לוי', roleId: 0, isActive: true }, { id: 'e2', fullName: 'יוסף כהן', roleId: 2, isActive: true }, { id: 'e3', fullName: 'רחל', roleId: 4, isActive: true }]);
  if (u.startsWith('/api/admin/db-mode')) {
    if (method === 'POST') { dbMode = JSON.parse(init.body).mode; window.__posts.push({ url: u, body: JSON.parse(init.body) }); }
    return json(200, { mode: dbMode });
  }
  if (u.startsWith('/api/admin/neon-usage')) {
    return json(200, {
      project: { name: 'gemach' }, period: { start: '2026-10-01T00:00:00Z', end: '2026-10-31T23:59:59Z', elapsedDays: 4, totalDays: 31 },
      usage: { computeCuHours: 4.2, activeHours: 12, storageGb: 0.4, transferGb: 1.8, writtenGb: 0.2 },
      cost: { costSoFar: 3.1, projectedMonthly: 24, computeCost: 2.9, storageCost: 0.2 },
      pricing: { includedTransferGb: 100, freeTransferGb: 5, storageGbMonth: 0.35, cuHour: 0.14 }, endpoints: [],
    });
  }
  if (u.startsWith('/api/upload-logo')) return json(200, { timestamp: 123 });
  return realFetch(url, init);
};

createRoot(document.getElementById('root')).render(<LabelsProvider><SettingsSimPage view={view} /></LabelsProvider>);
