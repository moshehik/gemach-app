// lib/aiGuide/settingsLocation.js - איפה הגדרה מוצגת במסך ההגדרות החדש (לשונית + סעיף), נגזר מ-lib/settingsSimLayout.js (אותו מיפוי שהמסך משתמש בו).
// מחליף את המיקום הישן "הגדרות מערכת ← <קטגוריית DB>" בקטלוג ההגדרות של עוזר ה-AI (SETTINGS_GUIDE): המסך החדש מארגן את ההגדרות
// בלשוניות וסעיפים משלו. שרת בלבד (טוען את קטלוג המטא-דאטה של ההגדרות).
import { buildSettingsGuide } from '../settingsMetadata';
import { placeRow, SYS_TABS, SITE_TABS, SECTIONS, EXTRA_SECTION_TITLE } from '../settingsSimLayout';

/** { view:'sys'|'site', tabId, tabLabel, sectionTitle, path, text } או null אם ההגדרה אינה מוצגת במסך. */
export function locateSetting(row) {
  const place = placeRow(row);
  if (!place) return null;
  const tabs = place.view === 'site' ? SITE_TABS : SYS_TABS;
  const tab = tabs.find((t) => t.id === place.tab);
  const sec = SECTIONS.find((s) => s.view === place.view && s.tab === place.tab && s.id === place.sectionId);
  const sectionTitle = sec ? sec.title : EXTRA_SECTION_TITLE;
  const path = place.view === 'site' ? '/admin/site-settings' : '/admin/settings';
  const screen = place.view === 'site' ? 'הגדרות אתר (מתכנת בלבד)' : 'הגדרות מערכת';
  const tabLabel = tab ? tab.label : '';
  return { view: place.view, tabId: place.tab, tabLabel, sectionTitle, path, text: `${screen} ← לשונית "${tabLabel}" ← סעיף "${sectionTitle}"` };
}

/** קטלוג ההגדרות של ה-AI עם מיקום ממסך ההגדרות החדש. הגדרה שאינה מוצגת במסך נשארת עם location=null (המודל נדרש לומר שהיא לא נגישה). */
export function buildSettingsGuideForNewUi(rows) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return buildSettingsGuide(rows).map((entry) => {
    const loc = locateSetting({ key: entry.key, category: entry.category || (byKey.get(entry.key) || {}).category });
    return {
      ...entry,
      location: loc ? loc.text : null,
      pagePath: loc ? loc.path : null,
      tab: loc ? loc.tabId : null,
    };
  });
}
