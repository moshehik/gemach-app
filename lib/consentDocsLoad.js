// lib/consentDocsLoad.js - טעינת ההגדרות + המסמכים שבתוקף ל-routes ולעמודים הציבוריים (עוטף את lib/consentDocsServer.js).
// קריאה דרך מטמון ההגדרות (30 שנ'); אחרי העלאת קובץ תקנון / עדכון טקסט הפרטיות המטמון מתבטל (invalidateSettingsCache).
import { getAllCachedSettings } from '@/lib/settingsCache';
import { resolveConsentDocs, resolvePrivacyPolicy } from '@/lib/consentDocsServer';

export async function loadConsentContext() {
  const rows = await getAllCachedSettings();
  const map = new Map((rows || []).map((r) => [r.key, r.value]));
  return { rows, map, docs: resolveConsentDocs(map, rows), privacy: resolvePrivacyPolicy(map, rows) };
}
