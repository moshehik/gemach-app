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
