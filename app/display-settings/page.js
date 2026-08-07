'use client';

import { useEffect, useState } from 'react';

// Real "עיצוב ותצוגה" settings page — ports the live palette/font/theme-mode/
// density/text-scale switcher that used to exist only as a standalone mockup
// (scratch/design-v2/assets/app.js, section 6 "Display-preferences panel").
// Everything here reads/writes the same localStorage blob (`gemachDesignPrefs`,
// shape { palette, font, mode, density, textScale }) and applies the matching
// data-* attribute on <html> immediately, exactly like the mockup's vanilla JS
// did — so the no-FOUC bootstrap script added in app/layout.js picks up
// whatever is chosen here on the next full page load.

const STORAGE_KEY = 'gemachDesignPrefs';

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
  { key: 'auto', label: 'אוטומטי (לפי המערכת)' },
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

function applyAttr(attr, val, offVals) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!val || offVals.indexOf(val) !== -1) root.removeAttribute(attr);
  else root.setAttribute(attr, val);
}

function applyMode(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark' || mode === 'light' || mode === 'contrast') {
    root.setAttribute('data-theme', mode);
  } else {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

export default function DisplaySettingsPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // Sync UI state from whatever is actually saved (the no-FOUC script in
  // layout.js has already applied it to <html> before this component mounts;
  // this just reflects it in the controls' active state).
  useEffect(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      saved = {};
    }
    setPrefs({
      palette: saved.palette || DEFAULT_PREFS.palette,
      font: saved.font || DEFAULT_PREFS.font,
      mode: saved.mode || DEFAULT_PREFS.mode,
      density: saved.density || DEFAULT_PREFS.density,
      textScale: saved.textScale || DEFAULT_PREFS.textScale,
    });
  }, []);

  function updatePref(key, value) {
    // Side effects (localStorage + live DOM attribute) run synchronously here,
    // directly in the click handler — NOT inside the setPrefs updater below.
    // React does not guarantee when/how many times a setState updater callback
    // runs, so persistence and the DOM mutation must not depend on it; setPrefs
    // is used purely to re-render the controls' "active" highlighting.
    let raw = {};
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      raw = {};
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw, [key]: value }));
    } catch (e) {}

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
        break;
      default:
        break;
    }

    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  const selectFontValue = QUICK_FONT_KEYS.includes(prefs.font) ? '' : (prefs.font || '');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>עיצוב ותצוגה</h1>
          <div className="page-desc">
            העדפות תצוגה אישיות — פלטת צבעים, גופן, מצב תצוגה, צפיפות וגודל טקסט. השינויים נשמרים על המכשיר הזה בלבד.
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title">פלטת צבעים</div>
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
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title">גופן</div>
        <div className="font-btn-row" style={{ marginBottom: 12 }}>
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
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="display-settings-more-fonts">עוד גופנים</label>
          <select
            id="display-settings-more-fonts"
            className="select"
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
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title">מצב תצוגה</div>
        <div className="mode-row">
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

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title">צפיפות</div>
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

      <div className="card card-pad">
        <div className="section-title">גודל טקסט</div>
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
  );
}
