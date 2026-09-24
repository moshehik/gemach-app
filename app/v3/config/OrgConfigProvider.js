'use client';
// app/v3/config/OrgConfigProvider.js — CONSTITUTION §ט.2, LIBRARY-MAP §5.
// טוען GET /api/settings (משותף ל-apiCache הקיים, כמו LabelsContext), מנרמל
// כל שורה לפי settingsRegistry.js (type), מחיל default לשורה חסרה/ריקה.
//
// profile prop: כשמוגדר (בגלריה בלבד - 'org1'|'org2'|'minimal'|'extreme'),
// טוען את קובץ ה-JSON הסטטי מ-config/profiles/ במקום לפנות ל-API - כך אפשר
// להדגים/לצלם כל עמוד תחת ארבעת הפרופילים בלי גישה ל-DB (CONSTITUTION §ט.4).
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSharedJson, subscribe, TTL } from '@/lib/apiCache';
import { SETTINGS_REGISTRY, getSettingDef } from './settingsRegistry';

const OrgConfigContext = createContext(null);

function normalize(rawByKey) {
  const out = {};
  for (const [key, def] of Object.entries(SETTINGS_REGISTRY)) {
    const raw = rawByKey[key];
    if (raw == null || raw === '') { out[key] = def.default; continue; }
    if (def.type === 'flag') out[key] = raw === 'true' || raw === true;
    else if (def.type === 'num') out[key] = Number(raw);
    else if (def.type === 'json' || def.type === 'list') {
      try { out[key] = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { out[key] = def.default; }
    } else out[key] = String(raw);
  }
  return out;
}

export function OrgConfigProvider({ children, profile }) {
  const [rawByKey, setRawByKey] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (profile) {
      import(`./profiles/${profile}.json`)
        .then((mod) => { if (alive) { setRawByKey(mod.default || mod); setReady(true); } })
        .catch(() => { if (alive) { setRawByKey({}); setReady(true); } });
      return () => { alive = false; };
    }
    const apply = (rows) => {
      if (!alive || !Array.isArray(rows)) return;
      const map = {};
      rows.forEach((r) => { map[r.key] = r.value; });
      setRawByKey(map);
      setReady(true);
    };
    const unsubscribe = subscribe('/api/settings', () => {
      fetchSharedJson('/api/settings', { ttl: TTL.STATIC }).then(apply).catch(() => {});
    });
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC }).then(apply).catch(() => setReady(true));
    return () => { alive = false; unsubscribe(); };
  }, [profile]);

  const normalized = useMemo(() => normalize(rawByKey), [rawByKey]);

  const value = useMemo(() => ({
    ready,
    profile: profile || 'live',
    flag: (key) => { getSettingDef(key); return Boolean(normalized[key]); },
    num: (key) => { getSettingDef(key); return Number(normalized[key]); },
    text: (key) => { getSettingDef(key); return String(normalized[key] ?? ''); },
    list: (key) => { getSettingDef(key); return Array.isArray(normalized[key]) ? normalized[key] : []; },
    json: (key) => { getSettingDef(key); return normalized[key]; },
    isKnown: (key) => key in SETTINGS_REGISTRY,
  }), [ready, profile, normalized]);

  return <OrgConfigContext.Provider value={value}>{children}</OrgConfigContext.Provider>;
}

export function useOrgConfig() {
  const ctx = useContext(OrgConfigContext);
  if (!ctx) {
    // fallback עדין (כמו useLabels) - כל מפתח מחזיר את ברירת המחדל שלו, לא קורס
    return {
      ready: false, profile: 'none',
      flag: (key) => Boolean(getSettingDef(key).default),
      num: (key) => Number(getSettingDef(key).default),
      text: (key) => String(getSettingDef(key).default ?? ''),
      list: (key) => (Array.isArray(getSettingDef(key).default) ? getSettingDef(key).default : []),
      json: (key) => getSettingDef(key).default,
      isKnown: (key) => key in SETTINGS_REGISTRY,
    };
  }
  return ctx;
}
