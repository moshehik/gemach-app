# settings-sim — הערות בנייה (סטטוס / איך ממשיכים)

ענף `feature/settings-sim-2026-10-04`, worktree `C:\Users\moshe\Desktop\wt-settings` (sparse; node_modules = junction ל-wt-login-new).
לא נדחף, לא נפרס, בלי DDL ובלי כתיבה ל-DB.

## מה בנוי
* `lib/uiVariant.js` — מסך `settings` (`ui_variant_settings`), ברירת מחדל לפי תפקיד: מתכנת (roleId 2) → חדש, כל השאר → ישן (`ROLE_DEFAULT_A5`).
* `app/lib/uiVariantServer.js` — `getRequestUiVariant` (העתק מילולי מהענף `feature/page-variant-switch-2026-10-04`).
* נתיבים דקים: `app/admin/settings/page.js`, `app/admin/site-settings/page.js`, `app/admin/labels/page.js` → `Legacy*` (הישן, בלי שינוי) או `SettingsSimSwitch view=sys|site|names`.
* `app/components/settings-sim/` — `SettingsSimPage.js` (הדף), `SettingRow.js` (שורה + פקדים), `SettingsDialogs.js` (חלונות + טוסט + Ic), `settings-sim.css` (נוצר ע"י `scratch/settings-build/tools/build_css.py` — **לא לערוך ידנית את החלק המיובא**; תוספות ב-`tools/local.css` / `tools/head.css` ואז `python build_css.py`).
* `lib/settingsSimLayout.js` — כל המיפוי (לשוניות, סעיפים, תוויות, פקדים) והלוגיקה הטהורה.
* בדיקות: `scripts/test_settings_sim.mjs`. בדיקה חזותית: `scripts/settings-sim-audit/` (`ESBUILD_DIR=/c/Users/moshe/node_modules/esbuild node scripts/settings-sim-audit/build.mjs` ואז `node scripts/settings-sim-audit/shots.mjs [view]`). צילומי העיצוב: `scratch/settings-build/demo-shots/` (`tools/demo-shots.mjs`).

## למיזוג (חשוב)
* הרישום המרכזי `lib/uiVariantScreens.js` חי רק בענף `feature/page-variant-switch-2026-10-04`. במיזוג: להוסיף רשומה `{ id:'settings', label:'הגדרות מערכת / אתר / שינוי שמות', routes:['/admin/settings','/admin/site-settings','/admin/labels'], legacyExists:true, newExists:true, selfSwitch:true, switchTargets:null }`, למחוק את `ROLE_DEFAULT_A5`/`roleDefaultVariant` מ-`lib/uiVariant.js` (הענף מגדיר אותם ב-uiVariantScreens), ולעטוף את שלושת הנתיבים ב-`VariantFrame screen="settings"` כמו /profile.
* `app/lib/uiVariantServer.js` זהה לענף — אמור להתמזג נקי.
* `scripts/test_ui_variant.mjs` עודכן (5 מסכים) — במיזוג עם הענף, להעדיף את גרסת הענף + בדיקות settings מכאן.

## סטטוס (4.10.2026, סוף הסבב)
* **בנוי במלואו:** שלושת המסכים (הגדרות מערכת 13 לשוניות + "הגדרות נוספות" לפי הצורך, הגדרות אתר 3 לשוניות, שינוי שמות 6 לשוניות), כל הפקדים (מתג, מספר+סטפר, בוחר שעה, select כגלולות/כרטיסים/בורר, שדות חובה, קבוצות, מחלקות, אמצעי תשלום, סוד, חותמת זמן, טקסט/טקסט ארוך), חיפוש עם ספירה, פאנל שינויים (ביטול בודד / ביטול הכל / שמירה), חלון "שינויים שלא נשמרו" לכל קישור פנימי + אזהרת דפדפן, חלון אישור הנהלה בלי סשן, קישור עמוק ?tab=&highlight=, לוגו, קישור הרשאות, מצב מסד (db-mode), צריכת Neon, באנרים, טוסט, נייד (לשוניות עליונות + פס שמירה תחתון).
* **בדיקות שעוברות:** `node scripts/test_settings_sim.mjs` (35), `node scripts/test_home_css_guard.mjs` (67, כולל סעיף settings-sim), `node scripts/test_ui_variant.mjs` (48), `node scripts/test_menu_logic.mjs` (87), `node scripts/settings-sim-audit/interact.mjs` (15 בדיקות דפדפן: מטען שמירה, זוגות, מתגים הפוכים, ולידציה, 401→אישור, חיפוש, קישור עמוק, יציאה עם שינויים, db-mode, כיתובים, שגיאת טעינה, 390px). eslint נקי על הקבצים החדשים.
* **השוואה לעיצוב:** `node scripts/settings-sim-audit/cmp.mjs <רוחב> <view> <tab> [dirty]` — ההבדלים שנשארו הם תוכן (שורות דוגמה שלא נבנו / ערכים אמיתיים), לא סגנון.
* **לא נבדק:** `next build` (לפי ההוראה), ריצה מול שרת פיתוח אמיתי / DB, ובתוך מעטפת A5 האמיתית (הבאנרים הדביקים יושבים מתחת לסרגל העליון לפי --gm-snav-h).
* **נשאר / לשים לב:** ההחלטות הפתוחות ב-ASSUMPTIONS.md; רשומת registry במיזוג (למעלה); `draft_orders_show_as_deleted` ועוד כמה מפתחות בוליאניים שלא ב-SETTINGS_BOOLEAN_KEYS מוצגים כמתג רק כשהערך ב-DB הוא 'true'/'false' — בדיוק כמו בישן.


## סבב תיקוני ביקורת (4.10.2026, ערב) — כל 10 הפריטים בוצעו ונקומטו
בדיקות: `node scripts/test_settings_sim.mjs` (43), `test_home_css_guard` (67), `test_ui_variant` (48), `test_ui_variant_self_switch` (34), `test_menu_logic` (87), eslint נקי, וכן בדיקת דפדפן אמיתית (31): `ESBUILD_DIR=/c/Users/moshe/node_modules/esbuild node scripts/settings-sim-audit/build.mjs` ואז `AUDIT_PORT=5202 node scripts/settings-sim-audit/interact.mjs` (`ONLY="#6"` מריץ רק בדיקות שהשם שלהן מכיל את המחרוזת). הבדיקות החדשות מסומנות #1..#10 בשם.
1. סוד: אין ניקוי בפוקוס (select-all), ריק = "ללא שינוי" (pruneUnchanged/buildPayload + `secretWriteAction` בשרת), מחיקה רק דרך "נקה ערך" + חלון אישור → `SECRET_CLEAR_MARKER`. (שים לב: גם הממשק הישן כבר לא יכול למחוק סוד בשליחת ריק — השרת מתעלם.)
2. `.gm-ds.gm-st .st-row[hidden]{display:none!important}` (ב-tools/local.css, נבנה ע"י build_css.py); בדיקת display מחושב.
3. `web_backup_mode` ב-HIDDEN_KEYS.
4. db-mode POST → `checkAuth('מתכנת')`; GET נשאר ציבורי (מחזיר רק prod/test, הבאנר צריך). הדף: חסימת החלפה כשיש שינויים, וטעינה מחדש אחרי החלפה.
5. חלונות הרסניים (`destructive`) ממקדים "ביטול".
6. `afterSaveRef` מנוקה בכל יציאה מוקדמת; שמירת יציאה: <a>, beforeunload, popstate (רשומת היסטוריה "שומרת" + `history.go(-2)` ביציאה), ו-router.push/replace (עטיפה של אובייקט useRouter ושל `window.next.router`); `window.__gmDirty`. **לא נבדק מול Next אמיתי** — רק מול נתב מדומה (scripts/settings-sim-audit/stubs.js); אם `useRouter()` ב-Next 16 מחזיר אובייקט שונה מ-`window.next.router` ולא ניתן לשינוי, ה-push מרכיבים אחרים לא ייחסם (שאר הדרכים כן).
7. `stepNumber` שומר ריק על "−" בשדות allowEmpty. 8. `methodsToggle` לא מכבה את האחרון (+ הסבר). 9. `gmach_subtitle` עבר ללשונית מיתוג (סעיף "זהות המערכת"); שאר מפתחות "לא בשימוש" נבדקו מול origin/main (git grep) — רק הערות/תיעוד/ולידציה. 10. a11y: חצים/Home/End בלשוניות, aria-controls רק על הפעילה (בחירת לשונית בבדיקות: `data-tab`), PIN `autoComplete=off` + ניקוי, resize listener.

## מיזוג עם ענף הווריאנט (`feature/page-variant-switch-2026-10-04`) — מהביקורת
1. `lib/uiVariantScreens.js`: רשומה `{ id:'settings', routes:['/admin/settings','/admin/site-settings','/admin/labels'], legacyExists:true, newExists:true, selfSwitch:true }` (+ label כמו למעלה).
2. למחוק `ROLE_DEFAULT_A5` / `roleDefaultVariant` מ-`lib/uiVariant.js`.
3. לקחת מהענף האחר את `app/layout.js` (מעביר roleId) ואת `scripts/test_ui_variant.mjs`, ואז להוסיף מחדש את בדיקות settings.
4. לעטוף את 3 העמודים ה-Legacy ב-`<VariantFrame screen="settings">`.
5. להוסיף `<PageVariantToggle screen="settings" placement="header" systemTip/>` + רשומה ב-`TOGGLE_LABELS`.
6. להוסיף `'settings'` ל-`SELF_SWITCH_SCREENS`.
7. אחרי המיזוג להריץ: test_settings_sim, test_home_css_guard, test_ui_variant*, test_menu_logic, eslint. מתג הווריאנט מכבד `window.__gmDirty` (נקבע ע"י SettingsSimPage).

## RESUME POINT
כל 10 הפריטים הושלמו ונקומטו (לא נדחף). לא נעשה: מיזוג עם ענף הווריאנט (רק מתועד), בדיקה מול Next/DB אמיתיים. מקום פנוי בדיסק C: ירד ל-~1.9GB בסוף הסבב (לא בהכרח בגללי) — לנקות `%TEMP%\puppeteer_dev_chrome_profile-*` אם נשארו.
