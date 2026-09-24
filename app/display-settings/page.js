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
import { V3Page, Card, Btn, IconBtn, Field, Switch, Tip, Banner } from '@/app/v3/ui/components';

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
    <div className="v3-stack">
      {[['בהיר', vars.light], ['כהה', vars.dark]].map(([label, side]) => (
        <div key={label} className="v3-stack">
          <span className="v3-label">{label}</span>
          <div className="v3-cluster">
            {cells(side).map(([name, color]) => (
              <span
                key={name}
                title={`${name} · ${color}`}
                aria-label={`${name} · ${color}`}
                style={{ width: 'var(--v3-sp-6)', height: 'var(--v3-sp-6)', borderRadius: 'var(--v3-r-sm)', border: 'var(--v3-bw-hair) solid var(--v3-line)', background: color }}
              />
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
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">עיצוב ותצוגה</h1>
            <Tip>ההעדפות נשמרות בחשבון שלכם ותקפות בכל מחשב שבו תתחברו.</Tip>
          </div>
        </div>

        {!employeeId && (
          <Banner kind="info" text="לא מחוברים. ההעדפות יישמרו בדפדפן הזה בלבד, ואחרי התחברות יישמרו בחשבון." />
        )}

        {/* 1 — מצב תצוגה */}
        <Card icon="sun" title="מצב תצוגה">
          <div className="v3-options v3-options--grid">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                data-theme-mode={m.key}
                className="v3-option"
                aria-pressed={prefs.mode === m.key}
                onClick={() => updatePref('mode', m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Card>

        {/* 2 — פלטות מובנות */}
        <Card icon="sparkles" title="פלטות מובנות">
          <div className="v3-stack">
            <div className="v3-options v3-options--grid">
              {PALETTES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="v3-option"
                  aria-pressed={prefs.palette === p.key}
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => updatePref('palette', p.key)}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 'var(--v3-sp-5)', height: 'var(--v3-sp-5)', flex: 'none', borderRadius: 'var(--v3-r-round)', background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                  />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            <span className="v3-muted" role="status">
              {activePreset ? `נבחרה: ${activePreset.label}` : 'נבחרה: פלטה אישית'}
            </span>
          </div>
        </Card>

        {/* 3 — הפלטות שלי + עורך */}
        <Card icon="edit" title="הפלטות שלי" tip="כל הגוונים, כולל מצב כהה, נגזרים אוטומטית מהצבעים שתבחרו.">
          <div className="v3-stack">
            {savedPalettes.length > 0 && (
              <div className="v3-list">
                {savedPalettes.map((entry) => (
                  <div key={entry.id} className={isSavedActive(entry) ? 'v3-li v3-li--pending' : 'v3-li'}>
                    <span
                      aria-hidden="true"
                      style={{ width: 'var(--v3-sp-5)', height: 'var(--v3-sp-5)', flex: 'none', borderRadius: 'var(--v3-r-round)', background: `linear-gradient(135deg, ${entry.primary}, ${entry.accent})` }}
                    />
                    <span className="v3-li__body"><b>{entry.name}</b></span>
                    <div className="v3-cluster">
                      <Btn
                        size="sm"
                        icon={isSavedActive(entry) ? 'check' : undefined}
                        onClick={() => applySavedPalette(entry)}
                        disabled={isSavedActive(entry)}
                      >
                        {isSavedActive(entry) ? 'בשימוש' : 'להפעלה'}
                      </Btn>
                      <IconBtn
                        icon="trash"
                        variant="quiet"
                        size="sm"
                        title="מחיקת הפלטה"
                        label={`מחיקת הפלטה ${entry.name}`}
                        onClick={() => deleteSavedPalette(entry.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="v3-stack">
              <div className="v3-cluster">
                <b>יצירת פלטה אישית</b>
                {prefs.palette !== 'custom' && (
                  <Btn size="sm" onClick={selectCustomPalette}>להפעלת הפלטה האישית</Btn>
                )}
              </div>

              <div className="v3-field">
                <label className="v3-label" htmlFor="custom-palette-primary">צבע ראשי</label>
                <div className="v3-cluster">
                  <input
                    id="custom-palette-primary"
                    type="color"
                    value={customColors.primary}
                    onChange={(e) => updateCustomColor('primary', e.target.value)}
                  />
                  <bdi dir="ltr">{customColors.primary.toUpperCase()}</bdi>
                </div>
              </div>

              <div className="v3-field">
                <label className="v3-label" htmlFor="custom-palette-accent">צבע משני</label>
                <div className="v3-cluster">
                  <input
                    id="custom-palette-accent"
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => updateCustomColor('accent', e.target.value)}
                  />
                  <bdi dir="ltr">{customColors.accent.toUpperCase()}</bdi>
                </div>
              </div>

              <div className="v3-field">
                <label className="v3-label" htmlFor="custom-palette-neutral">גוון הרקע</label>
                <div className="v3-cluster">
                  <Switch checked={manualNeutral} onChange={toggleManualNeutral} label="בחירה ידנית" />
                  {manualNeutral ? (
                    <>
                      <input
                        id="custom-palette-neutral"
                        type="color"
                        value={customColors.neutral}
                        onChange={(e) => updateCustomColor('neutral', e.target.value)}
                      />
                      <bdi dir="ltr">{customColors.neutral.toUpperCase()}</bdi>
                    </>
                  ) : (
                    <span className="v3-muted">נגזר מהצבע הראשי</span>
                  )}
                </div>
              </div>

              <PreviewStrip colors={customColors} />

              <Field
                label="שם הפלטה"
                type="text"
                placeholder="למשל: הוורוד שלי"
                value={newPaletteName}
                maxLength={40}
                onChange={(e) => setNewPaletteName(e.target.value)}
              />
              <div className="v3-cluster">
                <Btn variant="primary" icon="check" onClick={saveCurrentAsPalette}>שמירת הפלטה</Btn>
              </div>
            </div>
          </div>
        </Card>

        {/* 4 — אפשרויות נוספות */}
        <Card icon="settings" title="גופן, צפיפות וגודל טקסט">
          <div className="v3-stack">
            <div className="v3-field">
              <span className="v3-label">גופן</span>
              <div className="v3-options v3-options--grid">
                {QUICK_FONTS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="v3-option"
                    aria-pressed={prefs.font === f.key}
                    onClick={() => updatePref('font', f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <Field
              as="select"
              id="display-settings-more-fonts"
              label="גופנים נוספים"
              value={selectFontValue}
              onChange={(e) => {
                if (!e.target.value) return;
                updatePref('font', e.target.value);
              }}
            >
              <option value="">בחירת גופן…</option>
              {MORE_FONT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
              ))}
            </Field>

            <div className="v3-field">
              <span className="v3-label">צפיפות</span>
              <div className="v3-options v3-options--grid">
                {DENSITIES.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    data-density-mode={d.key}
                    className="v3-option"
                    aria-pressed={prefs.density === d.key}
                    onClick={() => updatePref('density', d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="v3-field">
              <span className="v3-label">גודל טקסט</span>
              <div className="v3-options v3-options--grid">
                {TEXT_SCALES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    data-text-scale-mode={t.key}
                    className="v3-option"
                    aria-pressed={prefs.textScale === t.key}
                    onClick={() => updatePref('textScale', t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </V3Page>
  );
}
