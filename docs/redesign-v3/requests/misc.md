# בקשות — משפחת misc (home / messages / my-hours / punch-clock / profile / display-settings)

## REQ-1 · SettingQuickPanel · חלונית · בינוני
נפתחת מדף הבית (כפתור "פתיחת ההגדרה" בתשובת AI). רכיב משותף (גם admin/settings, AIFloatingWidget) — לא נגעתי. נדרש מעבר ל-Dialog של v3 (variant form, בהיר בלבד — יש בו קלט) ועיצוב מחדש; כרגע נשאר בסגנון הישן.

## REQ-2 · CopyableText (CopyChip / renderCopyable) · קוסמטי
משותף עם admin/ai ו-AIFloatingWidget, לכן נשאר בסגנון הישן (מחלקת `chip` ישנה + inline). נדרש `CopyChip` בסגנון v3 (Chip + Icon copy/check, `dir=ltr`, tooltip "הועתק").

## REQ-3 · הצגת `error` ב-/messages כ-toast · קוסמטי
ה-state היחיד `error` מוצג רק בטאב "הודעה חדשה" (התנהגות קיימת, נשמרה). להצגה גם בטאבים האחרים דרושה קריאה ל-`v3Toast` — ה-bridge עוד לא מחובר ל-layout, ולכן לא הוספתי.

## REQ-4 · Tabs: וריאנט צבע לספירה · קוסמטי
ב-/messages תגי הספירה בטאבים היו אדום (לא נקרא) / כתום (ממתין להנהלה) / ניטרלי. `Tabs.count` מציג תמיד `Badge neutral`. מבוקש `countVariant` לפריט (`gold`/`navy`) כדי להבליט לא-נקרא.

## REQ-5 · מחלקות למעטפת דף הבית · קוסמטי
במעטפת של `/` נשארו inline: `paddingTop`/`paddingBottom` דינמיים לפי `isInitialState`, `position:fixed` לשורת שאלת ההמשך, ורוחב מרבי (`calc(var(--v3-container) * .65)`). מבוקשות מחלקות `v3-home`, `v3-home--initial`, `v3-dock` (שורת קלט צפה) ו-`v3-narrow` ב-components.css.

## REQ-6 · עיצוב v3 לא מגיב לפלטות המשתמש · בינוני (ארכיטקטורה)
/display-settings כותב `data-palette`/`data-font`/`data-density`/`data-text-scale`/`data-theme` ו-`<style id="custom-palette-style">` שמעדכנים את המשתנים הישנים (`--primary...`). tokens.css של v3 מבוסס `--v3-*` ולכן בחירת פלטה/גופן/צפיפות לא תשנה עמודי v3 עד שיוגדר מיפוי (למשל `--v3-brand` נגזר מ-`--primary-solid`, גודל בסיס נגזר מ-`data-text-scale`). העמוד עצמו משתמש רק ב-tokens; ההשפעה על שאר האתר דורשת החלטה. (Q למשתמש.)

## REQ-7 · Btn: תמיכה ב-`aria-pressed` / בחירה · קוסמטי
כפתורי בחירה (מצב תצוגה, גופן, פלטה וכו') נכתבו כ-`<button class="v3-option" aria-pressed>` ישירות, כי `Seg` לא מעביר `data-*` לכפתורים (נדרשים `data-theme-mode`, `data-density-mode`, `data-text-scale-mode`). מבוקש ש-`Seg`/`options` יעבירו `data-*` או רכיב `Option`.

## REQ-8 · שדה עם כפתור צמוד (סיסמה + עין) · קוסמטי
ב-/punch-clock ו-/profile נבנה `input` + `IconBtn` בתוך `v3-cluster` עם `flex:1` inline. מבוקש `Field` עם `endAdornment`/`v3-input-group`.
