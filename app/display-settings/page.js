'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CUSTOM_COLORS,
  applyCustomPaletteStyle,
  buildCustomPaletteVars,
} from '../lib/customPalette';
import {
  DESIGN_PREFS_EVENT,
  applyAttr,
  applyMode,
  pushPrefsToServer,
  readLocalPrefs,
  writeDesignPrefsCookie,
  writeLocalPrefs,
  writeThemeCookie,
} from '../lib/designPrefs';

// עמוד "עיצוב ותצוגה" — גרסה קומפקטית ומאורגנת (סעיפים ברורים, רוחב מוגבל):
//   1. מצב תצוגה (בהיר/כהה/ניגודיות/אוטומטי)
//   2. פלטות מובנות (14 פריסטים)
//   3. הפלטות שלי — פלטות מותאמות שמורות בשם + עורך חי (ראשי/משני/נייטרלי)
//   4. אפשרויות נוספות — גופן, צפיפות, גודל טקסט
//
// התמדה בשלוש שכבות (ר' app/lib/designPrefs.js): localStorage (מיידי,
// והיחיד לאורחים) → קוקיז פר-עובד (SSR לפני-צבע) → DB (מקור אמת פר-עובד,
// PUT מושהה ל-/api/me/design-prefs). הפלטה המותאמת נגזרת במלואה —
// כולל נייטרלים, tints סמנטיים וצל — ב-app/lib/customPalette.js ומוזרקת
// כתג <style id="custom-palette-style"> שמתרכב עם data-theme.

const PALETTES = [
  { key: 'wine', label: 'יין (ברירת מחדל)', primary: '#7C2E4D', accent: '#96661F' },
  { key: 'forest', label: 'יער', primary: '#2E5C40', accent: '#9C5423' },
  { key: 'ocean', label: 'אוקיינוס', primary: '#1F5C66', accent: '#8A661F' },
  { key: 'plum', label: 'שזיף', primary: '#5B3A73', accent: '#3F6E6E' },
  { key: 'amber', label: 'ענבר', primary: '#A85A1E', accent: '#2E6B6B' },
  { key: 'slate', label: 'צפחה', primary: '#3E5266', accent: '#A8622E' },
  { key: 'rose', label: 'ורד', primary: '#A03A54', accent: '#6E7A3A' },
  { key: 'indigo', label: 'אינדיגו', primary: '#3E4E8C', accent: '#B8862E' },
  { key: 'turquoise', label: 'טורקיז', primary: '#1E7A7A', accent: '#B85A42' },
  { key: 'mustard', label: 'חרדל', primary: '#8C7A1E', accent: '#6E3A5C' },
  { key: 'fuchsia', label: 'פוקסיה', primary: '#A02E8C', accent: '#2E7A5C' },
  { key: 'coffee', label: 'קפה', primary: '#6B4A2E', accent: '#2E6B7A' },
  { key: 'mint', label: 'מנטה', primary: '#2E7A5C', accent: '#B8622E' },
  { key: 'burgundy', label: 'בורדו', primary: '#5C1E28', accent: '#8C6E1E' },
];

const QUICK_FONTS = [
  { key: 'default', label: 'ברירת מחדל' },
  { key: 'modern', label: 'מודרני' },
  { key: 'classic', label: 'קלאסי' },
  { key: 'rounded', label: 'מעוגל' },
  { key: 'contemporary', label: 'עכשווי' },
  { key: 'condensed', label: 'מצומצם' },
  { key: 'editorial', label: 'עיתונאי' },
];
const QUICK_FONT_KEYS = QUICK_FONTS.map((f) => f.key);

const MORE_FONT_GROUPS = [
  {
    label: 'סאנס-סריף',
    options: [
      ['arial', 'Arial'],
      ['arial-black', 'Arial Black'],
      ['tahoma', 'Tahoma'],
      ['verdana', 'Verdana'],
      ['calibri-light', 'Calibri Light'],
      ['candara', 'Candara'],
      ['corbel', 'Corbel'],
      ['franklin-gothic', 'Franklin Gothic Medium'],
      ['gadugi', 'Gadugi'],
      ['century-gothic', 'Century Gothic'],
      ['lucida-sans', 'Lucida Sans Unicode'],
      ['ms-sans-serif', 'Microsoft Sans Serif'],
      ['segoe-black', 'Segoe UI Black'],
    ],
  },
  {
    label: 'עברי',
    options: [
      ['miriam', 'מרים'],
      ['rod', 'רוד'],
      ['aharoni', 'אהרוני'],
      ['frank-ruehl', 'פרנק-רואל'],
      ['narkisim', 'נרקיסים'],
      ['levenim', 'לבנים'],
      ['gisha', 'גישה'],
    ],
  },
  {
    label: 'סריף',
    options: [
      ['georgia', 'Georgia'],
      ['cambria', 'Cambria'],
      ['palatino', 'Palatino Linotype'],
      ['sitka', 'Sitka'],
      ['sylfaen', 'Sylfaen'],
      ['times', 'Times New Roman'],
    ],
  },
  {
    label: 'מונוספייס',
    options: [
      ['consolas', 'Consolas'],
      ['lucida-console', 'Lucida Console'],
      ['ms-gothic', 'MS Gothic'],
    ],
  },
  {
    label: 'דקורטיבי',
    options: [
      ['segoe-print', 'Segoe Print'],
      ['segoe-script', 'Segoe Script'],
      ['ink-free', 'Ink Free'],
      ['impact', 'Impact'],
    ],
  },
];

const MODES = [
  { key: 'light', label: 'בהיר' },
  { key: 'dark', label: 'כהה' },
  { key: 'contrast', label: 'ניגודיות גבוהה' },
  { key: 'auto', label: 'אוטומטי' },
];

const DENSITIES = [
  { key: 'comfortable', label: 'נוח' },
  { key: 'compact', label: 'קומפקטי' },
];

const TEXT_SCALES = [
  { key: 'small', label: 'קטן' },
  { key: 'normal', label: 'רגיל' },
  { key: 'large', label: 'גדול' },
  { key: 'xlarge', label: 'גדול מאוד' },
];

const DEFAULT_PREFS = {
  palette: 'wine',
  font: 'default',
  mode: 'auto',
  density: 'comfortable',
  textScale: 'normal',
};

// מזהה ייחודי לפלטה שמורה — מחוץ לקומפוננטה (נקרא רק מתוך event handler)
function makePaletteId() {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

function normalizeCustomColors(cc) {
  return {
    primary: (cc && cc.primary) || DEFAULT_CUSTOM_COLORS.primary,
    accent: (cc && cc.accent) || DEFAULT_CUSTOM_COLORS.accent,
    neutral: (cc && cc.neutral) || '',
  };
}

// שורת תצוגה-מקדימה של פלטה מותאמת — גוונים חיים שנגזרים מהצבעים שנבחרו
function PreviewStrip({ colors }) {
  const vars = buildCustomPaletteVars(colors.primary, colors.accent, colors.neutral);
  const cells = (side) => ([
    ['רקע', side.bg],
    ['משטח', side.surfaceAlt],
    ['גבול', side.border],
    ['ראשי', side.primarySolid],
    ['גוון ראשי', side.primaryTint],
    ['משני', side.accentSolid],
    ['טקסט', side.text],
  ]);
  return (
    <div className="preview-rows">
      {[['בהיר', vars.light], ['כהה', vars.dark]].map(([label, side]) => (
        <div key={label} className="preview-row">
          <span className="preview-row-label">{label}</span>
          <div className="preview-strip">
            {cells(side).map(([name, color]) => (
              <span key={name} className="preview-cell" style={{ background: color }} title={`${name} · ${color}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DisplaySettingsPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [customColors, setCustomColors] = useState(normalizeCustomColors(null));
  const [savedPalettes, setSavedPalettes] = useState([]);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const employeeIdRef = useRef(null);
  const pushTimerRef = useRef(null);

  function hydrateFrom(saved) {
    setPrefs({
      palette: saved.palette || DEFAULT_PREFS.palette,
      font: saved.font || DEFAULT_PREFS.font,
      mode: saved.mode || DEFAULT_PREFS.mode,
      density: saved.density || DEFAULT_PREFS.density,
      textScale: saved.textScale || DEFAULT_PREFS.textScale,
    });
    const cc = normalizeCustomColors(saved.customColors);
    setCustomColors(cc);
    setSavedPalettes(Array.isArray(saved.savedPalettes) ? saved.savedPalettes : []);
    // Defensive re-apply: מבטיח שתג ה-style של הפלטה המותאמת תואם את
    // הצבעים השמורים גם אם הגענו לכאן בניווט-לקוח בלי שהתג נוצר.
    if (saved.palette === 'custom') {
      applyCustomPaletteStyle(cc);
    }
  }

  // --- טעינה: קודם מקומי (מיידי), אחר-כך DB (מקור אמת פר-עובד) ---
  useEffect(() => {
    hydrateFrom(readLocalPrefs());
    fetch('/api/me/design-prefs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.success || !data.employeeId) return;
        employeeIdRef.current = data.employeeId;
        setEmployeeId(data.employeeId);
        if (data.prefs) {
          const merged = { ...readLocalPrefs(), ...data.prefs };
          writeLocalPrefs(merged);
          hydrateFrom(merged);
        }
      })
      .catch(() => {});
  }, []);

  // --- התמדה משותפת: localStorage + קוקי פר-עובד + PUT מושהה ל-DB ---
  function commit(nextRaw) {
    writeLocalPrefs(nextRaw);
    writeDesignPrefsCookie(employeeIdRef.current, nextRaw);
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushPrefsToServer({
        palette: nextRaw.palette,
        font: nextRaw.font,
        mode: nextRaw.mode,
        density: nextRaw.density,
        textScale: nextRaw.textScale,
        customColors: nextRaw.customColors,
        savedPalettes: nextRaw.savedPalettes,
      });
    }, 500);
  }

  function updatePref(key, value) {
    // תופעות-לוואי (התמדה + DOM) רצות סינכרונית כאן, לא בתוך updater של
    // setState — React לא מבטיח מתי/כמה פעמים ה-updater רץ.
    const nextRaw = { ...readLocalPrefs(), [key]: value };
    commit(nextRaw);

    switch (key) {
      case 'palette':
        applyAttr('data-palette', value, ['wine']);
        break;
      case 'font':
        applyAttr('data-font', value, ['default']);
        break;
      case 'density':
        applyAttr('data-density', value, ['comfortable']);
        break;
      case 'textScale':
        applyAttr('data-text-scale', value, ['normal']);
        break;
      case 'mode':
        applyMode(value);
        // מצב הוא פר-עובד: מתעדכן גם בקוקי-התמה (SSR) וגם בכפתור שבסרגל
        writeThemeCookie(employeeIdRef.current, value);
        try {
          window.dispatchEvent(new CustomEvent(DESIGN_PREFS_EVENT, { detail: { mode: value } }));
        } catch (e) {}
        break;
      default:
        break;
    }

    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  // בחירת פלטה מותאמת (מהעורך או מפלטה שמורה) — מחילה מיידית + מתמידה
  function activateCustom(colors, extraRaw) {
    const cc = normalizeCustomColors(colors);
    const nextRaw = { ...readLocalPrefs(), ...extraRaw, palette: 'custom', customColors: cc };
    commit(nextRaw);
    applyAttr('data-palette', 'custom', ['wine']);
    applyCustomPaletteStyle(cc);
    setCustomColors(cc);
    setPrefs((prev) => ({ ...prev, palette: 'custom' }));
  }

  function selectCustomPalette() {
    const raw = readLocalPrefs();
    const colors = (raw.customColors && raw.customColors.primary && raw.customColors.accent)
      ? raw.customColors
      : customColors;
    activateCustom(colors);
  }

  function updateCustomColor(channel, hexValue) {
    activateCustom({ ...customColors, [channel]: hexValue });
  }

  function toggleManualNeutral(enabled) {
    if (enabled) {
      // ערך התחלתי הגיוני: הנייטרל האוטומטי הנגזר כרגע מהצבע הראשי
      const derivedBg = buildCustomPaletteVars(customColors.primary, customColors.accent, '').light.bg;
      activateCustom({ ...customColors, neutral: derivedBg });
    } else {
      activateCustom({ ...customColors, neutral: '' });
    }
  }

  function saveCurrentAsPalette() {
    const name = newPaletteName.trim() || `הפלטה שלי ${savedPalettes.length + 1}`;
    const entry = {
      id: makePaletteId(),
      name: name.slice(0, 40),
      primary: customColors.primary,
      accent: customColors.accent,
      neutral: customColors.neutral || '',
    };
    const nextList = [...savedPalettes, entry];
    setSavedPalettes(nextList);
    setNewPaletteName('');
    activateCustom(customColors, { savedPalettes: nextList });
  }

  function applySavedPalette(entry) {
    activateCustom({ primary: entry.primary, accent: entry.accent, neutral: entry.neutral || '' });
  }

  function deleteSavedPalette(id) {
    const nextList = savedPalettes.filter((p) => p.id !== id);
    setSavedPalettes(nextList);
    const nextRaw = { ...readLocalPrefs(), savedPalettes: nextList };
    commit(nextRaw);
  }

  const selectFontValue = QUICK_FONT_KEYS.includes(prefs.font) ? '' : (prefs.font || '');
  const activePreset = PALETTES.find((p) => p.key === prefs.palette);
  const isSavedActive = (entry) => prefs.palette === 'custom'
    && entry.primary === customColors.primary
    && entry.accent === customColors.accent
    && (entry.neutral || '') === (customColors.neutral || '');
  const manualNeutral = Boolean(customColors.neutral);

  return (
    <div className="settings-wrap">
      <div className="page-head">
        <div>
          <h1>עיצוב ותצוגה</h1>
          <div className="page-desc">
            העדפות תצוגה אישיות — נשמרות לחשבון שלך וחלות בכל מחשב שבו תתחבר/י.
          </div>
        </div>
      </div>

      {/* 1 — מצב תצוגה */}
      <div className="card card-pad settings-card">
        <div className="section-title">מצב תצוגה</div>
        <div className="mode-row mode-row-4">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              data-theme-mode={m.key}
              className={`mode-btn${prefs.mode === m.key ? ' active' : ''}`}
              onClick={() => updatePref('mode', m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2 — פלטות מובנות */}
      <div className="card card-pad settings-card">
        <div className="section-title">פלטות מובנות</div>
        <div className="swatch-row">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`swatch-btn${prefs.palette === p.key ? ' active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
              title={p.label}
              aria-label={p.label}
              onClick={() => updatePref('palette', p.key)}
            />
          ))}
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          {activePreset ? `פעילה: ${activePreset.label}` : 'פעילה: פלטה מותאמת אישית'}
        </div>
      </div>

      {/* 3 — הפלטות שלי + עורך */}
      <div className="card card-pad settings-card">
        <div className="section-title">הפלטות שלי</div>

        {savedPalettes.length > 0 && (
          <div className="saved-palette-list">
            {savedPalettes.map((entry) => (
              <div key={entry.id} className={`saved-palette-row${isSavedActive(entry) ? ' active' : ''}`}>
                <span
                  className="saved-palette-dot"
                  style={{ background: `linear-gradient(135deg, ${entry.primary}, ${entry.accent})` }}
                />
                <span className="saved-palette-name">{entry.name}</span>
                <span className="saved-palette-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => applySavedPalette(entry)}
                    disabled={isSavedActive(entry)}
                  >
                    {isSavedActive(entry) ? 'פעילה' : 'החלה'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm saved-palette-delete"
                    title="מחיקת הפלטה"
                    aria-label={`מחיקת הפלטה ${entry.name}`}
                    onClick={() => deleteSavedPalette(entry.id)}
                  >
                    <svg className="icon"><use href="#i-trash" /></svg>
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="custom-palette-editor">
          <div className="settings-inline-head">
            <strong>עורך פלטה מותאמת</strong>
            {prefs.palette !== 'custom' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectCustomPalette}>
                הפעלת הפלטה המותאמת
              </button>
            )}
          </div>
          <div className="color-fields-grid">
            <div className="field">
              <label htmlFor="custom-palette-primary">צבע ראשי</label>
              <div className="color-field-row">
                <input
                  id="custom-palette-primary"
                  type="color"
                  className="color-swatch-input"
                  value={customColors.primary}
                  onChange={(e) => updateCustomColor('primary', e.target.value)}
                />
                <span className="color-field-hex">{customColors.primary.toUpperCase()}</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="custom-palette-accent">צבע משני</label>
              <div className="color-field-row">
                <input
                  id="custom-palette-accent"
                  type="color"
                  className="color-swatch-input"
                  value={customColors.accent}
                  onChange={(e) => updateCustomColor('accent', e.target.value)}
                />
                <span className="color-field-hex">{customColors.accent.toUpperCase()}</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="custom-palette-neutral">גוון רקע (נייטרלי)</label>
              <div className="color-field-row">
                <label className="neutral-auto-toggle">
                  <input
                    type="checkbox"
                    checked={manualNeutral}
                    onChange={(e) => toggleManualNeutral(e.target.checked)}
                  />
                  ידני
                </label>
                {manualNeutral ? (
                  <>
                    <input
                      id="custom-palette-neutral"
                      type="color"
                      className="color-swatch-input"
                      value={customColors.neutral}
                      onChange={(e) => updateCustomColor('neutral', e.target.value)}
                    />
                    <span className="color-field-hex">{customColors.neutral.toUpperCase()}</span>
                  </>
                ) : (
                  <span className="hint">אוטומטי — נגזר מהצבע הראשי</span>
                )}
              </div>
            </div>
          </div>

          <PreviewStrip colors={customColors} />
          <div className="hint">
            כל הגוונים — רקעים, גבולות, טקסט, צללים ומצב כהה — נגזרים אוטומטית מהצבעים שנבחרו.
          </div>

          <div className="settings-inline-actions">
            <input
              type="text"
              className="input"
              style={{ maxWidth: 220 }}
              placeholder="שם לפלטה (למשל: ורוד שלי)"
              value={newPaletteName}
              maxLength={40}
              onChange={(e) => setNewPaletteName(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={saveCurrentAsPalette}>
              שמירה כפלטה חדשה
            </button>
          </div>
        </div>
      </div>

      {/* 4 — אפשרויות נוספות */}
      <div className="card card-pad settings-card">
        <div className="section-title">אפשרויות נוספות</div>

        <div className="field">
          <label>גופן</label>
          <div className="font-grid">
            {QUICK_FONTS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`font-opt${prefs.font === f.key ? ' active' : ''}`}
                onClick={() => updatePref('font', f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="display-settings-more-fonts">עוד גופנים</label>
          <select
            id="display-settings-more-fonts"
            className="select"
            style={{ maxWidth: 280 }}
            value={selectFontValue}
            onChange={(e) => {
              if (!e.target.value) return;
              updatePref('font', e.target.value);
            }}
          >
            <option value="">בחר/י גופן נוסף…</option>
            {MORE_FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="settings-two-col">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>צפיפות</label>
            <div className="density-row">
              {DENSITIES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  data-density-mode={d.key}
                  className={`density-btn${prefs.density === d.key ? ' active' : ''}`}
                  onClick={() => updatePref('density', d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>גודל טקסט</label>
            <div className="density-row">
              {TEXT_SCALES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-text-scale-mode={t.key}
                  className={`density-btn${prefs.textScale === t.key ? ' active' : ''}`}
                  onClick={() => updatePref('textScale', t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!employeeId && (
          <div className="hint" style={{ marginTop: 10 }}>
            לא מחובר/ת — ההעדפות נשמרות על הדפדפן הזה בלבד. התחברות תשמור אותן לחשבון.
          </div>
        )}
      </div>
    </div>
  );
}
