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
