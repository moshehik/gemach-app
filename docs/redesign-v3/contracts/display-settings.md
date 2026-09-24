# חוזה עמוד: עיצוב ותצוגה (`/display-settings`)

קובץ: `app/display-settings/page.js` (611 שורות, `'use client'`, `DisplaySettingsPage` + `PreviewStrip`). תלויות: `app/lib/customPalette.js` (`DEFAULT_CUSTOM_COLORS`, `applyCustomPaletteStyle`, `buildCustomPaletteVars`), `app/lib/designPrefs.js` (`DESIGN_PREFS_EVENT, applyAttr, applyMode, pushPrefsToServer, readLocalPrefs, writeDesignPrefsCookie, writeLocalPrefs, writeThemeCookie`). קונסומרים חיצוניים של אותם נתונים: `app/layout.js` (SSR + bootstrap no-FOUC), `app/components/DesignPrefsSync.js`, `lib/designPrefsSchema.js`, `UserMenu.js` (קיצור מהתפריט).

## א. מטרה והרשאות
- העדפות תצוגה אישיות (מצב, פלטה, גופן, צפיפות, גודל טקסט) - חלות מיידית ונשמרות לחשבון העובד.
- אין בדיקת הרשאה בעמוד. פתוח גם לאורחים (שמירה מקומית בלבד). ה-API `/api/me/design-prefs` דורש עובד מחובר ופעיל (401/403 אחרת - נבלע).
- אין נגזרות הגדרת-מערכת; אין הבדל בין גמ"חים.

## ב. אזורים לפי סדר
1. כותרת עמוד: `<h1>עיצוב ותצוגה</h1>` + `page-desc` (`page.js:355-362`).
2. כרטיס "מצב תצוגה" (365-380).
3. כרטיס "פלטות מובנות" (383-401).
4. כרטיס "הפלטות שלי" (404-525): רשימת שמורות (מותנה) + עורך פלטה מותאמת.
5. כרטיס "אפשרויות נוספות" (528-608): גופן, עוד גופנים, צפיפות, גודל טקסט, הודעת אורח.

## ג. שדות ובקרים (state: `prefs{palette,font,mode,density,textScale}`, `customColors{primary,accent,neutral}`, `savedPalettes[]`, `newPaletteName`, `employeeId`; refs `employeeIdRef`, `pushTimerRef`)
| תווית | פרטים |
|---|---|
| מצב תצוגה: 4 כפתורי `mode-btn` (`data-theme-mode`) 366-379 | `light` בהיר / `dark` כהה / `contrast` ניגודיות גבוהה / `auto` אוטומטי; ברירת מחדל `auto`; `.active` לפי `prefs.mode` |
| פלטות מובנות (`swatch-btn`, 14, ללא טקסט; `title` + `aria-label`) | `wine` יין (ברירת מחדל `wine`), `forest`, `ocean`, `plum`, `amber`, `slate`, `rose`, `indigo`, `turquoise`, `mustard`, `fuchsia`, `coffee`, `mint`, `burgundy` (`PALETTES` 32-47, כל אחת עם `primary`+`accent` לגרדיאנט 135deg). טקסט `פעילה: <label>` או `פעילה: פלטה מותאמת אישית` (398-400) |
| צבע ראשי `#custom-palette-primary` (type=color) | `customColors.primary`, ברירת מחדל `DEFAULT_CUSTOM_COLORS.primary` `#7C2E4D`; מציג hex באותיות גדולות |
| צבע משני `#custom-palette-accent` | `customColors.accent`, ברירת מחדל `#96661F` |
| גוון רקע (נייטרלי): checkbox `ידני` + `#custom-palette-neutral` | `customColors.neutral` (`''` = אוטומטי). סימון: ערך התחלתי = `buildCustomPaletteVars(primary,accent,'').light.bg`; ביטול: `''`. כשאוטומטי: הטקסט `אוטומטי — נגזר מהצבע הראשי`. ה-input של הנייטרל קיים רק כשידני (ה-`label htmlFor` מצביע על id שלא תמיד קיים) |
| `PreviewStrip` (162-187) | קריאה-בלבד: שתי שורות `בהיר`/`כהה` x 7 תאים (`רקע, משטח, גבול, ראשי, גוון ראשי, משני, טקסט`) מ-`buildCustomPaletteVars`; `title="<name> · <color>"` |
| שם לפלטה (input, maxLength 40, `newPaletteName`) | placeholder `שם לפלטה (למשל: ורוד שלי)`; ריק -> `הפלטה שלי ${savedPalettes.length+1}`; `.slice(0,40)` |
| גופן: 7 כפתורי `font-opt` | `default` ברירת מחדל, `modern` מודרני, `classic` קלאסי, `rounded` מעוגל, `contemporary` עכשווי, `condensed` מצומצם, `editorial` עיתונאי |
| `#display-settings-more-fonts` (select) | placeholder `בחר/י גופן נוסף…` (value `''` - נבחר: מתעלם); ערך נוכחי `''` אם הגופן הוא אחד מ-7 המהירים. קבוצות (`MORE_FONT_GROUPS` 60-119): סאנס-סריף (arial, arial-black, tahoma, verdana, calibri-light, candara, corbel, franklin-gothic, gadugi, century-gothic, lucida-sans, ms-sans-serif, segoe-black), עברי (miriam, rod, aharoni, frank-ruehl, narkisim, levenim, gisha), סריף (georgia, cambria, palatino, sitka, sylfaen, times), מונוספייס (consolas, lucida-console, ms-gothic), דקורטיבי (segoe-print, segoe-script, ink-free, impact) |
| צפיפות: `density-btn` (`data-density-mode`) | `comfortable` נוח (ברירת מחדל) / `compact` קומפקטי |
| גודל טקסט: `density-btn` (`data-text-scale-mode`) | `small` קטן / `normal` רגיל (ברירת מחדל) / `large` גדול / `xlarge` גדול מאוד |
- אין ולידציה/חובה. צבעים = ערכי `input[type=color]` (hex).

## ד. כפתורים / פעולות
| תווית | handler | פעולה |
|---|---|---|
| כל כפתור מצב/פלטה/גופן/צפיפות/גודל + select גופנים | `updatePref(key,value)` (252-284) | ראו ה (סדר פעולות) |
| הפעלת הפלטה המותאמת (מוצג רק כש-`prefs.palette!=='custom'`) | `selectCustomPalette` (297-303) | לוקח `raw.customColors` (אם יש primary+accent) אחרת state; `activateCustom` |
| שינוי צבע (onChange, חי - בכל תזוזה) | `updateCustomColor(channel,hex)` | `activateCustom({...customColors,[channel]:hex})` |
| ידני (checkbox) | `toggleManualNeutral(checked)` | ר' לעיל |
| שמירה כפלטה חדשה | `saveCurrentAsPalette` (319-332) | entry `{id:makePaletteId() (p+base36 time+rand), name, primary, accent, neutral}` מוסף לסוף; מנקה שם; `activateCustom(customColors,{savedPalettes:nextList})` (מפעיל אותה) |
| החלה / `פעילה` (disabled כשפעילה) | `applySavedPalette(entry)` | `activateCustom({primary,accent,neutral})` |
| מחיקה (אייקון `i-trash`, `title=מחיקת הפלטה`, `aria-label=מחיקת הפלטה <name>`) | `deleteSavedPalette(id)` | מסנן מהרשימה + `commit` בלבד (אינו משנה את הפלטה הפעילה; ללא confirm) |
- שורה שמורה `.active` כש-`isSavedActive(entry)`: `prefs.palette==='custom'` וגם שלושת הצבעים זהים (`neutral||''`).

## ה. התמדה וקריאות רשת
- **טעינה** (`useEffect` 217-232, פעם אחת): `hydrateFrom(readLocalPrefs())` מיידית; אחר כך `GET /api/me/design-prefs` (`fetch` ישיר; ללא pageCache/apiCache/prefetch). אם `data.success && data.employeeId`: `employeeIdRef/employeeId` נקבעים; אם `data.prefs`: `merged={...readLocalPrefs(),...data.prefs}` -> `writeLocalPrefs(merged)` -> `hydrateFrom(merged)`. כל כשל נבלע. אורח (401) -> `employeeId` נשאר null.
- `hydrateFrom` (198-214): ברירות מחדל `wine/default/auto/comfortable/normal`; `savedPalettes` רק אם מערך; אם `palette==='custom'` -> `applyCustomPaletteStyle(cc)` (מוזרק `<style id="custom-palette-style">`).
- **`commit(nextRaw)`** (235-250): `writeLocalPrefs`; `writeDesignPrefsCookie(employeeIdRef.current, nextRaw)` (קוקי `designPrefs_<id>`: palette,font,density,textScale,customColors; max-age שנה; רק עם employeeId); debounce 500ms (`clearTimeout` קודם) -> `pushPrefsToServer` = `PUT /api/me/design-prefs` (`Content-Type: application/json`) גוף `{palette,font,mode,density,textScale,customColors,savedPalettes}`; כשל נבלע. אין טוסט הצלחה/שגיאה.
- **`updatePref`**: `nextRaw={...readLocalPrefs(),[key]:value}` -> `commit` -> DOM סינכרוני: `palette` -> `applyAttr('data-palette',v,['wine'])`; `font` -> `data-font` (off `default`); `density` -> `data-density` (off `comfortable`); `textScale` -> `data-text-scale` (off `normal`); `mode` -> `applyMode(v)` + `writeThemeCookie(id,v)` (`theme_<id>`) + `window.dispatchEvent(new CustomEvent(DESIGN_PREFS_EVENT,{detail:{mode}}))` (מסנכרן כפתור מצב בסרגל העליון) -> `setPrefs`.
- **`activateCustom(colors, extraRaw)`**: `nextRaw={...local,...extraRaw,palette:'custom',customColors:cc}` -> `commit`; `applyAttr('data-palette','custom',['wine'])`; `applyCustomPaletteStyle(cc)`; `setCustomColors`; `setPrefs palette:'custom'`.
- התמדה בשלוש שכבות: localStorage `gemachDesignPrefs` (`STORAGE_KEY`) -> קוקיז -> DB (`Employee.themeColor` כ-JSON, שרת ממזג רדוד, 413 אם גדול).
- מבנה מלא: `{v:1,palette,font,mode,density,textScale,customColors:{primary,accent,neutral},savedPalettes:[{id,name,primary,accent,neutral}]}`.

## ו. חלוניות / טוסטים
אין חלוניות, confirm או טוסטים בעמוד. המשוב היחיד הוא ויזואלי מיידי (שינוי העיצוב חי) + `.active`.

## ז. מצבים מיוחדים
- טעינה: אין ספינר; מוצג מיד מ-localStorage ואז מתעדכן מהשרת (קפיצה אפשרית).
- אורח/לא מחובר (`!employeeId`, 603-607): הודעה `לא מחובר/ת — ההעדפות נשמרות על הדפדפן הזה בלבד. התחברות תשמור אותן לחשבון.`
- ריק: רשימת שמורות לא מוצגת כשאין; כפתור "הפעלת הפלטה המותאמת" מוסתר כשהפלטה כבר custom.
- שגיאות רשת: נבלעות בשקט.
- אין offline מפורש (localStorage ממשיך לעבוד).

## ח. URL / אחסון
- אין query params.
- `localStorage.gemachDesignPrefs`; קוקיז `designPrefs_<employeeId>`, `theme_<employeeId>`; אטריבוטים על `<html>`: `data-palette`, `data-font`, `data-density`, `data-text-scale`, `data-theme`; תג `<style id="custom-palette-style">`; אירוע `gemach-design-prefs-applied`.

## ט. הדפסה / ייצוא / AI
אין.

## י. מלל משתמש (מלאי, לשכתוב)
`עיצוב ותצוגה`; `העדפות תצוגה אישיות — נשמרות לחשבון שלך וחלות בכל מחשב שבו תתחבר/י.`; `מצב תצוגה` (`בהיר, כהה, ניגודיות גבוהה, אוטומטי`); `פלטות מובנות` + שמות 14 הפלטות (`יין (ברירת מחדל), יער, אוקיינוס, שזיף, ענבר, צפחה, ורד, אינדיגו, טורקיז, חרדל, פוקסיה, קפה, מנטה, בורדו`); `פעילה: …`; `פעילה: פלטה מותאמת אישית`; `הפלטות שלי`; `החלה`/`פעילה`; `מחיקת הפלטה`; `עורך פלטה מותאמת`; `הפעלת הפלטה המותאמת`; `צבע ראשי`, `צבע משני`, `גוון רקע (נייטרלי)`, `ידני`, `אוטומטי — נגזר מהצבע הראשי`; `כל הגוונים — רקעים, גבולות, טקסט, צללים ומצב כהה — נגזרים אוטומטית מהצבעים שנבחרו.`; תוויות PreviewStrip; `שם לפלטה (למשל: ורוד שלי)`; `שמירה כפלטה חדשה`; ברירת שם `הפלטה שלי N`; `אפשרויות נוספות`; `גופן` (7 שמות), `עוד גופנים`, `בחר/י גופן נוסף…`, שמות קבוצות (`סאנס-סריף, עברי, סריף, מונוספייס, דקורטיבי`) ושמות גופנים עבריים (`מרים, רוד, אהרוני, פרנק-רואל, נרקיסים, לבנים, גישה`); `צפיפות` (`נוח, קומפקטי`); `גודל טקסט` (`קטן, רגיל, גדול, גדול מאוד`); הודעת אורח.

## יא. Risk notes
- כל הקליקים מבצעים תופעות-לוואי **סינכרוניות מחוץ ל-`setState`** (`commit` + DOM) - במכוון (הערה 253-255). אין להעביר אותן ל-updater או ל-`useEffect`.
- `readLocalPrefs()` הוא מקור ה-merge (לא ה-state) ב-`updatePref/activateCustom/deleteSavedPalette`: שמירה על כך מונעת דריסת שדות שלא בעמוד (`v`, ושדות עתידיים).
- ערכי "off" (`wine`, `default`, `comfortable`, `normal`) **מסירים** את האטריבוט ולא מציבים - אל תשנו ל-`setAttribute` תמיד.
- `mode` דורש שלושה דברים: `applyMode`, `theme_<id>` cookie, ואירוע `DESIGN_PREFS_EVENT` - חסרון אחד שובר סנכרון עם הסרגל / SSR.
- `data-theme-mode`, `data-density-mode`, `data-text-scale-mode`, `#custom-palette-*` ו-`#display-settings-more-fonts` משמשים כנראה בדיקות/CSS - לשמר שמות.
- החלת פלטה שמורה = `palette:'custom'`; `isSavedActive` תלוי בהשוואת שלושת הצבעים - לא להסתמך על id.
- `input[type=color]` מפעיל `onChange` ברציפות בגרירה -> `commit` חוזר; ה-debounce (500ms) הוא היחיד שמגן על ה-PUT.
- כפתורי swatch ללא טקסט - נגישות תלויה ב-`aria-label`/`title`; בהחלפה לרכיב אחר יש לשמר.
- סגנון: מחלקות `settings-wrap, page-head, page-desc, settings-card, mode-row(-4), mode-btn, swatch-row, swatch-btn, saved-palette-*, custom-palette-editor, settings-inline-head/actions, color-fields-grid, color-field-row, color-swatch-input, color-field-hex, neutral-auto-toggle, preview-rows/row/strip/cell, font-grid, font-opt, density-row, density-btn, settings-two-col` (מוגדרות ב-CSS גלובלי; לאתר לפני מחיקה).
- הצבעים בעמוד (hex של הפלטות ב-`PALETTES`, גרדיאנטים ב-`style` inline, תאי PreviewStrip) הם **נתונים**, לא סגנון - חריג לכלל R2 ואסור להחליף אותם ב-tokens.
