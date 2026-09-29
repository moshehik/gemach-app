# קטלוג הרכיבים הממוספר — פלטת רכיבים גמ״ח שמלות · גרסה 2026-09-29

נוצר אוטומטית ע"י `build/install.py` מדף הפלטה (https://claude.ai/artifact/H6toH2q9ZvL8rrFwZx3SBj) ומקובצי הרישום `build/numbers.json` / `build/serial_map.json` / `build/anims.json`. **המספרים הם המספרים של הפלטה ולעולם לא משתנים** (ראו README, "כלל יציבות המספור").

איך קוראים שורה: `לחצן 12` · הבורר האמיתי (tag.classes) · באיזה דף נתפס (דף הבית / כרטיס הזמנה / שניהם) וכמה פעמים · טקסט לדוגמה · שלד ה-HTML (מקוצר) · טולטיפים והנפשות שהרכיב משתמש בהם.
העור: רכיב שנתפס בדף הבית בלבד מעוצב תחת `gm-ds gm-home`; רכיב של כרטיס ההזמנה (או של שניהם) מעוצב תחת `gm-ds` (ראו README).

## תוכן

- [אייקונים](#icon) — אייקון · 71
- [כפתורים וקישורים](#button) — לחצן · 48
- [לשוניות, מתגים ובוחרים](#choice) — בורר · 26
- [צ'יפים, תגיות וסימונים](#chip) — תגית · 48
- [שדות וטפסים](#form) — שדה · 35
- [באנרים והתראות](#banner) — באנר · 60
- [טוסט](#toast) — טוסט · 6
- [טולטיפים ורמזים](#tip) — טולטיפ · 27
- [חלונות קופצים](#dialog) — חלון · 13
- [כרטיסים ופריטים](#card) — כרטיס · 15
- [רשימות, טבלאות ושורות](#list) — שורה · 13
- [היסטוריה ותוצאות](#history) — היסטוריה · 22
- [ציר זמן, תהליך ועגלה](#timeline) — שלב · 64
- [ניווט ופריסה](#nav) — ניווט · 63
- [רכיבי דף הבית](#home) — בית · 33
- [שונות](#other) — פריט · 32
- [הנפשות](#anim) — הנפשה · 129
- [צבעים וטוקנים](#color) — צבע · 71

<a id="icon"></a>
## אייקונים (אייקון N)

הספרייה המלאה של ה-sprite (`sprite.svg`, `public/design-system/sprite.svg`). בתוך האפליקציה: `<svg class="ic"><use href="/design-system/sprite.svg#i-mail"/></svg>`; בדף סטטי עם ה-sprite המוטמע: `<use href="#i-mail"/>`. הנפשת הריחוף: המחלקות `ia-<id> ia-h` על ה-svg.

| מס׳ | id | שם | בשימוש | הנפשת ריחוף |
|---|---|---|---|---|
| אייקון 1 | `i-alert` | אזהרה | לא בשימוש | הנפשה 82 `ia-ring` |
| אייקון 2 | `i-arrl` | חץ שמאלה | לא בשימוש | הנפשה 77 `ia-nL` |
| אייקון 3 | `i-arrlr` | שני כיוונים | לא בשימוש | הנפשה 92 `ia-squash` |
| אייקון 4 | `i-arrr` | חץ ימינה | לא בשימוש | הנפשה 78 `ia-nR` |
| אייקון 5 | `i-back` | חזרה | הזמנה | הנפשה 77 `ia-nL` |
| אייקון 6 | `i-bag` | תיק | לא בשימוש | הנפשה 75 `ia-lift` |
| אייקון 7 | `i-bank` | העברה בנקאית | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 8 | `i-bell` | התראות | בית · הזמנה | הנפשה 82 `ia-ring` |
| אייקון 9 | `i-bk` | חזרה לאחור | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 10 | `i-box` | הזמנה וחבילה | לא בשימוש | הנפשה 75 `ia-lift` |
| אייקון 11 | `i-cal` | יומן ותאריך | לא בשימוש | הנפשה 69 `ia-flip` |
| אייקון 12 | `i-card` | כרטיס אשראי | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 13 | `i-cart` | עגלת שינויים | לא בשימוש | הנפשה 64 `ia-cart` |
| אייקון 14 | `i-cash` | מזומן | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 15 | `i-check` | אישור | הזמנה | הנפשה 66 `ia-draw` |
| אייקון 16 | `i-cheque` | שיק | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 17 | `i-chev` | חץ למטה | בית · הזמנה | הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD` |
| אייקון 18 | `i-clip` | קובץ מצורף | לא בשימוש | הנפשה 65 `ia-clipw`, הנפשה 99 `ia-wave` |
| אייקון 19 | `i-clock` | שעה | לא בשימוש | הנפשה 95 `ia-tick` |
| אייקון 20 | `i-copy` | העתקה | לא בשימוש | — |
| אייקון 21 | `i-dress` | שמלה | בית · הזמנה | הנפשה 94 `ia-sway` |
| אייקון 22 | `i-eraser` | ניקוי | לא בשימוש | — |
| אייקון 23 | `i-ext` | פתיחה בחלון חדש | לא בשימוש | הנפשה 79 `ia-nUR` |
| אייקון 24 | `i-eye` | תצוגה | בית · הזמנה | הנפשה 60 `ia-blink` |
| אייקון 25 | `i-file` | קובץ | הזמנה | הנפשה 75 `ia-lift` |
| אייקון 26 | `i-flag` | דגל | לא בשימוש | הנפשה 99 `ia-wave` |
| אייקון 27 | `i-gear` | הגדרות | לא בשימוש | הנפשה 87 `ia-spin` |
| אייקון 28 | `i-gift` | זיכוי ומתנה | לא בשימוש | הנפשה 75 `ia-lift` |
| אייקון 29 | `i-home` | בית | לא בשימוש | הנפשה 72 `ia-hop` |
| אייקון 30 | `i-info` | מידע | לא בשימוש | הנפשה 81 `ia-pulse` |
| אייקון 31 | `i-list` | רשימה | לא בשימוש | הנפשה 78 `ia-nR`, הנפשה 101 `ia-write` |
| אייקון 32 | `i-lock` | נעילה | הזמנה | הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 99 `ia-wave` |
| אייקון 33 | `i-logout` | יציאה | בית · הזמנה | הנפשה 78 `ia-nR` |
| אייקון 34 | `i-mail` | מייל | הזמנה | הנפשה 75 `ia-lift` |
| אייקון 35 | `i-menu` | תפריט | בית · הזמנה | הנפשה 92 `ia-squash` |
| אייקון 36 | `i-minus` | הסרה | לא בשימוש | הנפשה 92 `ia-squash` |
| אייקון 37 | `i-msg` | הודעה | בית · הזמנה | הנפשה 81 `ia-pulse` |
| אייקון 38 | `i-note` | הערה | לא בשימוש | הנפשה 75 `ia-lift` |
| אייקון 39 | `i-pencil` | עריכה | לא בשימוש | הנפשה 101 `ia-write` |
| אייקון 40 | `i-phone` | טלפון | לא בשימוש | הנפשה 82 `ia-ring` |
| אייקון 41 | `i-pin` | מיקום | לא בשימוש | הנפשה 68 `ia-drop` |
| אייקון 42 | `i-plus` | הוספה | לא בשימוש | הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp` |
| אייקון 43 | `i-print` | הדפסה | הזמנה | הנפשה 85 `ia-slide` |
| אייקון 44 | `i-redo` | שחזור | לא בשימוש | הנפשה 88 `ia-spin360` |
| אייקון 45 | `i-refresh` | רענון | לא בשימוש | הנפשה 88 `ia-spin360` |
| אייקון 46 | `i-rows` | שורות | לא בשימוש | — |
| אייקון 47 | `i-scan` | סריקת ברקוד | הזמנה | הנפשה 85 `ia-slide` |
| אייקון 48 | `i-scissors` | תיקון | לא בשימוש | הנפשה 86 `ia-snip` |
| אייקון 49 | `i-search` | חיפוש | בית · הזמנה | הנפשה 100 `ia-wig` |
| אייקון 50 | `i-searchspark` | חיפוש חכם | לא בשימוש | — |
| אייקון 51 | `i-send` | שליחה | לא בשימוש | הנפשה 79 `ia-nUR`, הנפשה 83 `ia-send` |
| אייקון 52 | `i-shield` | אישור והגנה | לא בשימוש | הנפשה 81 `ia-pulse`, הנפשה 84 `ia-shk` |
| אייקון 53 | `i-sig` | חתימה | לא בשימוש | הנפשה 101 `ia-write` |
| אייקון 54 | `i-sliders` | סינון והגדרות | לא בשימוש | הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig` |
| אייקון 55 | `i-sparkle` | רעיון | לא בשימוש | — |
| אייקון 56 | `i-sun` | תצוגה ומצב | בית · הזמנה | הנפשה 89 `ia-spin90` |
| אייקון 57 | `i-swap` | החלפה | לא בשימוש | הנפשה 93 `ia-swap` |
| אייקון 58 | `i-table` | טבלה | לא בשימוש | — |
| אייקון 59 | `i-tag` | תג מחיר | לא בשימוש | הנפשה 99 `ia-wave` |
| אייקון 60 | `i-trash` | מחיקה | לא בשימוש | הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 99 `ia-wave` |
| אייקון 61 | `i-truck` | משלוח | הזמנה | הנפשה 67 `ia-drive` |
| אייקון 62 | `i-undo` | ביטול פעולה | לא בשימוש | הנפשה 98 `ia-undo` |
| אייקון 63 | `i-user` | לקוחה | בית · הזמנה | הנפשה 80 `ia-nod` |
| אייקון 64 | `i-userck` | לקוחה מאושרת | לא בשימוש | הנפשה 80 `ia-nod` |
| אייקון 65 | `i-users` | לקוחות | לא בשימוש | הנפשה 61 `ia-bob` |
| אייקון 66 | `i-wallet` | ארנק ויתרה | לא בשימוש | הנפשה 96 `ia-tilt` |
| אייקון 67 | `i-x` | סגירה | בית · הזמנה | הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx` |
| אייקון 68 | `i-sn-bug` | דיווח תקלה (תפריט) | בית · הזמנה | — |
| אייקון 69 | `i-sn-chart` | סטטיסטיקה (תפריט) | לא בשימוש | — |
| אייקון 70 | `i-sn-history` | היסטוריה (תפריט) | לא בשימוש | — |
| אייקון 71 | `i-sn-inv` | מלאי (תפריט) | לא בשימוש | — |

<a id="button"></a>
## כפתורים וקישורים (לחצן N)

### לחצן 4 · `a`
- **איפה:** דף הבית (בית ×854) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנות
- **וריאנטים (אותו בורר):** לחצן 100
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <footer class="site-foot"><nav class="sf-col"><a data-label="הזמנות" data-link="orders" href="#"><svg class="ic sm ia-file ia-h"><use href="#i-file"></use></svg>הזמנות</a></nav></footer>
  ```

### לחצן 5 · `button.back`
- **איפה:** דף הבית (בית ×13) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 17
- **טולטיפים:** "חזרה לעמוד הבית" (לא ממוספר)
- **שלד HTML:**
  ```html
  <button aria-label="חזרה לעמוד הבית" class="back" data-tip="חזרה לעמוד הבית" type="button"><svg class="ic"><use href="#i-back"></use></svg></button>
  ```

### לחצן 8 · `button.xlbtn.xlg`
- **איפה:** דף הבית (בית ×7) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 62
- **טולטיפים:** "ייצוא לקובץ Excel" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="aixl"><button aria-label="ייצוא ל-Excel" class="xlbtn xlg" data-tip="ייצוא לקובץ Excel" type="button"><svg aria-hidden="true" class="xlic" viewbox="0 0 16 16"><rect fill="#107C41" height="14" rx="3" width="14" x="1" y="1"></rect><path d="M5 4.5l6 7M11 4.5l-6 7" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.7"></path></svg></button></div>
  ```

### לחצן 9 · `button.xlbtn.xlp`
- **איפה:** דף הבית (בית ×7) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 20
- **טולטיפים:** "הדפסת התוצאות" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="card-h"><div class="aixl"><button aria-label="הדפסה" class="xlbtn xlp" data-tip="הדפסת התוצאות" type="button"><svg aria-hidden="true" class="prtic" fill="none" stroke="#1e63c4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewbox="0 0 16 16"><path class="prt-top" d="M4.5 5.5V2h7v3.5"></path> … (המשך ב-index.html, "העתק HTML")
  ```

### לחצן 11 · `button.cpm.ibtn`
- **איפה:** דף הבית (בית ×20) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 59
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub me"><span class="who"><button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="0" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span></div></div></div>
  ```

### לחצן 12 · `a.lnk`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה 48133
- **שלד HTML:**
  ```html
  <a class="lnk" data-open="הזמנה" href="#">הזמנה <bdi>48133</bdi></a>
  ```

### לחצן 13 · `button.cpy`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** support@example.org
- **טולטיפים:** "לחיצה מעתיקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><button aria-label="העתקת support@example.org" class="cpy" data-copy="support@example.org" data-tip="לחיצה מעתיקה" type="button">support@example.org<svg class="ic"><use href="#i-file"></use></svg></button></div></div></div>
  ```

### לחצן 15 · `button.tclose`
- **איפה:** בית · הזמנה (בית ×7 · הזמנה ×132) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 106
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div class="info on pulse" id="toast"><button aria-label="סגירה" class="tclose" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div>
  ```

### לחצן 16 · `button.block.btn.green.lg`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אישור תשלום
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="btn green lg block"><svg class="ic"><use href="#i-check"></use></svg>אישור תשלום</button></div></div>
  ```

### לחצן 17 · `button.back`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 5
- **טולטיפים:** טולטיפ 7 "חזרה לרשימה"
- **הנפשות:** הנפשה 77 `ia-nL`
- **שלד HTML:**
  ```html
  <button aria-label="חזרה לרשימה" class="back" data-ico="back" data-tip="חזרה לרשימה"><svg class="ic ia-back ia-h ia-ov"><use href="#i-back"></use></svg></button>
  ```

### לחצן 20 · `button.xlbtn.xlp`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 9
- **טולטיפים:** טולטיפ 10 "הדפסה / מייל"
- **הנפשות:** הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="tools"><button aria-label="הדפסה ומייל" class="xlbtn xlp" data-tip="הדפסה / מייל" type="button"><svg aria-hidden="true" class="prtic" fill="none" stroke="#1e63c4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewbox="0 0 16 16"><path class="prt-top" d="M4.5 5.5V2h7v3.5"></path><rect height="6" rx="1.6" width="13" x="1.5" y="5.5"></rect><g class="prt-sheet"> … (המשך ב-index.html, "העתק HTML")
  ```

### לחצן 30 · `button.block.btn.ghost.sec`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בטל שינויים
- **הנפשות:** הנפשה 120 `rowin`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-actions enter"><button class="btn ghost block sec"><svg class="ic sm"><use href="#i-undo"></use></svg>בטל שינויים</button></div></div>
  ```

### לחצן 31 · `button.tbtn`
- **איפה:** כרטיס הזמנה (הזמנה ×29) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לשמירה
- **וריאנטים (אותו בורר):** לחצן 133
- **הנפשות:** הנפשה 103 `icnpop`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div class="charge on pulse" id="toast"><button class="tbtn"><svg class="ic sm"><use href="#i-check"></use></svg>לשמירה</button></div>
  ```

### לחצן 34 · `button.ibtn.mx`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 124
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><button aria-label="סגירה" class="ibtn mx" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div>
  ```

### לחצן 36 · `button.inpx`
- **איפה:** דף הבית (בית ×47) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 98
- **טולטיפים:** "ניקוי" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="sn-sbox"><button aria-label="ניקוי השדה" class="inpx" data-ico="x" data-tip="ניקוי" type="button"><svg class="ic sm ia-x ia-h ia-ov"><use href="#i-x"></use></svg></button></div>
  ```

### לחצן 38 · `button`
- **איפה:** בית · הזמנה (בית ×248 · הזמנה ×1521) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חלונות: כהה
- **וריאנטים (אותו בורר):** לחצן 61
- **שלד HTML:**
  ```html
  <div class="demo"><button aria-pressed="true" type="button">חלונות: כהה</button></div>
  ```

### לחצן 41 · `button.btn.primary`
- **איפה:** דף הבית (בית ×55) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 44
- **טולטיפים:** טולטיפ 4 "חיפוש"
- **שלד HTML:**
  ```html
  <div class="hero-in"><form class="srch"><div class="scan"><button aria-label="חיפוש" class="btn primary" data-tip="חיפוש" type="submit"><svg class="ic"><use href="#i-search"></use></svg></button></div></form></div>
  ```

### לחצן 44 · `button.btn.primary`
- **איפה:** דף הבית (בית ×55) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לעמוד הבית
- **וריאנטים (אותו בורר):** לחצן 41
- **שלד HTML:**
  ```html
  <button class="btn primary" type="button"><svg class="ic"><use href="#i-home"></use></svg>לעמוד הבית</button>
  ```

### לחצן 54 · `button.ibtn`
- **איפה:** דף הבית (בית ×29) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 72
- **טולטיפים:** "סגירה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="card-h"><button aria-label="סגירת השיחה" class="ibtn" data-tip="סגירה" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div></div></div>
  ```

### לחצן 59 · `button.cpm.ibtn`
- **איפה:** דף הבית (בית ×20) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** לחצן 11
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><span class="who"><button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="3" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span></div></div></div>
  ```

### לחצן 61 · `button`
- **איפה:** כרטיס הזמנה (הזמנה ×1521) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** איפוס
- **וריאנטים (אותו בורר):** לחצן 38
- **שלד HTML:**
  ```html
  <div class="demo"><button>איפוס</button></div>
  ```

### לחצן 62 · `button.xlbtn.xlg`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 8
- **טולטיפים:** "ייצוא ההיסטוריה לקובץ Excel" (לא ממוספר)
- **שלד HTML:**
  ```html
  <span class="hres-x"><button aria-label="ייצוא ל-Excel" class="xlbtn xlg" data-hx="excel" data-tip="ייצוא ההיסטוריה לקובץ Excel" type="button"><svg aria-hidden="true" class="xlic" viewbox="0 0 16 16"><rect fill="#107C41" height="14" rx="3" width="14" x="1" y="1"></rect><path d="M5 4.5l6 7M11 4.5l-6 7" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.7"></path></svg></button></span>
  ```

### לחצן 63 · `button.xlbtn.xld`
- **איפה:** כרטיס הזמנה (הזמנה ×43) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 64
- **טולטיפים:** טולטיפ 11 "מחיקת הזמנה"
- **הנפשות:** הנפשה 127 `trWig`
- **שלד HTML:**
  ```html
  <div class="tools"><button aria-label="מחיקת הזמנה" class="xlbtn xld" data-tip="מחיקת הזמנה" type="button"><svg aria-hidden="true" class="dlic" fill="none" stroke="#a83d6c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" viewbox="0 0 16 16"><path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.6 8.7h6.8l.6-8.7M6.6 7v4M9.4 7v4"></path></svg></button></div>
  ```

### לחצן 64 · `button.xlbtn.xld`
- **איפה:** כרטיס הזמנה (הזמנה ×43) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 63
- **טולטיפים:** "הורדת ההיסטוריה כקובץ" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`
- **שלד HTML:**
  ```html
  <span class="hres-x"><button aria-label="הורדה" class="xlbtn xld" data-hx="download" data-tip="הורדת ההיסטוריה כקובץ" type="button"><svg aria-hidden="true" class="dlic" fill="none" stroke="#a83d6c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" viewbox="0 0 16 16"><g class="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3"></path></g> … (המשך ב-index.html, "העתק HTML")
  ```

### לחצן 66 · `button.pinm.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 67
- **רמזים עשירים:** רמז עשיר 2 `tl|now`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="today"><button aria-describedby="rt" aria-label="היום" class="tip pinm" data-rich="tl|now" type="button"><svg class="ic"><use href="#i-pin"></use></svg></button></div></div>
  ```

### לחצן 67 · `button.pinm.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 66
- **רמזים עשירים:** רמז עשיר 2 `tl|now`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="today"><button aria-describedby="rt" aria-label="היום" class="tip pinm" data-ico="pin" data-rich="tl|now" type="button"><svg class="ic"><use href="#i-pin"></use></svg></button></div></div>
  ```

### לחצן 72 · `button.ibtn`
- **איפה:** כרטיס הזמנה (הזמנה ×423) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 54
- **טולטיפים:** "הסרת פריט" (לא ממוספר)
- **הנפשות:** הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 99 `ia-wave`, הנפשה 104 `icnshake`
- **שלד HTML:**
  ```html
  <article class="hrow irow"><div class="hdet"><div class="hv-btns"><button aria-label="הסרת פריט" class="ibtn" data-ico="trash" data-id="1" data-tip="הסרת פריט"><svg class="ic sm ia-trash ia-h ia-ov"><use href="#i-trash"></use></svg></button></div></div></article>
  ```

### לחצן 79 · `button.btn`
- **איפה:** כרטיס הזמנה (הזמנה ×146) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** רישום תשלום ידני
- **וריאנטים (אותו בורר):** לחצן 81
- **הנפשות:** הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><button class="btn" data-msg="רישום תשלום נוסף (באישור מנהל)" disabled="" title="אין יתרה לתשלום"><svg class="ic sm"><use href="#i-cash"></use></svg>רישום תשלום ידני</button></details>
  ```

### לחצן 81 · `button.btn`
- **איפה:** כרטיס הזמנה (הזמנה ×146) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חישוב מחדש
- **וריאנטים (אותו בורר):** לחצן 79
- **הנפשות:** הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><button class="btn" data-msg="החיובים חושבו מחדש"><svg class="ic sm"><use href="#i-refresh"></use></svg>חישוב מחדש</button></details>
  ```

### לחצן 87 · `button.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 88
- **טולטיפים:** "ברירת מחדל: יומיים לפני" (לא ממוספר)
- **הנפשות:** הנפשה 81 `ia-pulse`
- **שלד HTML:**
  ```html
  <button aria-label="עזרה" class="tip" data-ico="info" data-tip="ברירת מחדל: יומיים לפני" type="button"><svg class="ic sm ia-info ia-h"><use href="#i-info"></use></svg></button>
  ```

### לחצן 88 · `button.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 87
- **טולטיפים:** "מתעדכן אוטומטית" (לא ממוספר)
- **הנפשות:** הנפשה 81 `ia-pulse`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><button aria-label="עזרה" class="tip" data-ico="info" data-tip="מתעדכן אוטומטית" type="button"><svg class="ic sm ia-info ia-h"><use href="#i-info"></use></svg></button></div></div>
  ```

### לחצן 90 · `summary`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים מתקדמים מנהל
- **וריאנטים (אותו בורר):** לחצן 91
- **הנפשות:** הנפשה 27 `chevBob`, הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><summary><svg class="ic"><use href="#i-sliders"></use></svg>פרטים מתקדמים<span class="chip gray" style="margin-inline-start:4px">מנהל</span><svg class="ic chev"><use href="#i-chev"></use></svg></summary></details>
  ```

### לחצן 91 · `summary`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אפשרויות מנהל
- **וריאנטים (אותו בורר):** לחצן 90
- **הנפשות:** הנפשה 27 `chevBob`, הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><summary><svg class="ic"><use href="#i-lock"></use></svg>אפשרויות מנהל<svg class="ic chev"><use href="#i-chev"></use></svg></summary></details>
  ```

### לחצן 92 · `button.btn.navy`
- **איפה:** כרטיס הזמנה (הזמנה ×84) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוסף להזמנה
- **וריאנטים (אותו בורר):** לחצן 93
- **שלד HTML:**
  ```html
  <div class="addpanel"><button class="btn navy"><svg class="ic"><use href="#i-plus"></use></svg>הוסף להזמנה</button></div>
  ```

### לחצן 93 · `button.btn.navy`
- **איפה:** כרטיס הזמנה (הזמנה ×84) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוסף להזמנה
- **וריאנטים (אותו בורר):** לחצן 92
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`
- **שלד HTML:**
  ```html
  <div class="addpanel"><button class="btn navy" data-ico="plus"><svg class="ic ia-plus ia-h"><use href="#i-plus"></use></svg>הוסף להזמנה</button></div>
  ```

### לחצן 98 · `button.inpx`
- **איפה:** כרטיס הזמנה (הזמנה ×120) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 36
- **שלד HTML:**
  ```html
  <div class="inpw"><button aria-label="ניקוי" class="inpx" data-inpx="delAddr" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div>
  ```

### לחצן 100 · `a`
- **איפה:** כרטיס הזמנה (הזמנה ×18) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שמלות
- **וריאנטים (אותו בורר):** לחצן 4
- **הנפשות:** הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <footer class="site-foot"><nav class="sf-col"><a data-link="dresses" href="#"><svg class="ic sm ia-dress ia-h"><use href="#i-dress"></use></svg>שמלות</a></nav></footer>
  ```

### לחצן 106 · `button.tclose`
- **איפה:** כרטיס הזמנה (הזמנה ×132) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 15
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <button aria-label="סגירה" class="tclose" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h" style="--ia-dl: 0ms;"><use href="#i-x"></use></svg></button>
  ```

### לחצן 107 · `button.block.btn.lg.primary`
- **איפה:** כרטיס הזמנה (הזמנה ×147) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחק הזמנה
- **וריאנטים (אותו בורר):** לחצן 113
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="btn primary lg block"><svg class="ic"><use href="#i-trash"></use></svg>מחק הזמנה</button></div></div>
  ```

### לחצן 113 · `button.block.btn.lg.primary`
- **איפה:** כרטיס הזמנה (הזמנה ×147) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחק הזמנה
- **וריאנטים (אותו בורר):** לחצן 107
- **הנפשות:** הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 99 `ia-wave`, הנפשה 104 `icnshake`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="dbtns"><button class="btn primary lg block" data-ico="trash"><svg class="ic ia-trash ia-h" style="--ia-dl: 0ms;"><use href="#i-trash"></use></svg>מחק הזמנה</button></div></div>
  ```

### לחצן 114 · `button.block.btn.ghost`
- **איפה:** כרטיס הזמנה (הזמנה ×141) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ביטול
- **וריאנטים (אותו בורר):** לחצן 115
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="btn ghost block"><svg class="ic sm"><use href="#i-x"></use></svg>ביטול</button></div></div>
  ```

### לחצן 115 · `button.block.btn.ghost`
- **איפה:** כרטיס הזמנה (הזמנה ×141) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ביטול
- **וריאנטים (אותו בורר):** לחצן 114
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="dbtns"><button class="btn ghost block" data-ico="x"><svg class="ic sm ia-x ia-h ia-ov" style="--ia-dl: 40ms;"><use href="#i-x"></use></svg>ביטול</button></div></div>
  ```

### לחצן 124 · `button.ibtn.mx`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 34
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><button aria-label="סגירה" class="ibtn mx" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h" style="--ia-dl: 40ms;"><use href="#i-x"></use></svg></button></div>
  ```

### לחצן 126 · `button.mfe`
- **איפה:** כרטיס הזמנה (הזמנה ×355) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 127
- **טולטיפים:** "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfile"><button aria-label="תצוגה מקדימה" class="mfe" data-id="pay" data-tip="תצוגה" type="button"><svg class="ic sm"><use href="#i-eye"></use></svg></button></div></div>
  ```

### לחצן 127 · `button.mfe`
- **איפה:** כרטיס הזמנה (הזמנה ×355) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** לחצן 126
- **טולטיפים:** "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfile"><button aria-label="תצוגה מקדימה" class="mfe" data-id="del" data-tip="תצוגה" type="button"><svg class="ic sm"><use href="#i-eye"></use></svg></button></div></div>
  ```

### לחצן 133 · `button.tbtn`
- **איפה:** כרטיס הזמנה (הזמנה ×29) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לשמירה
- **וריאנטים (אותו בורר):** לחצן 31
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <button class="tbtn" data-ico="check"><svg class="ic sm ia-check ia-h ia-ov" style="--ia-dl: 40ms;"><use href="#i-check"></use></svg>לשמירה</button>
  ```

### לחצן 134 · `button.block.btn`
- **איפה:** כרטיס הזמנה (הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** צא בלי לשמור
- **וריאנטים (אותו בורר):** לחצן 136
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="dbtns"><button class="btn block" data-ico="x"><svg class="ic sm ia-x ia-h ia-ov"><use href="#i-x"></use></svg>צא בלי לשמור</button></div></div>
  ```

### לחצן 136 · `button.block.btn`
- **איפה:** כרטיס הזמנה (הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הדפסה
- **וריאנטים (אותו בורר):** לחצן 134
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="btn block"><svg class="ic sm"><use href="#i-print"></use></svg>הדפסה</button></div></div>
  ```

<a id="choice"></a>
## לשוניות, מתגים ובוחרים (בורר N)

### בורר 1 · `div.vsw`
- **איפה:** דף הבית (בית ×7) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** בורר 44
- **טולטיפים:** "מצב טבלה" (לא ממוספר), "מצב שורות" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="מצב שורות" aria-pressed="true" class="vopt on" data-tip="מצב שורות" data-view="rows" type="button"><svg class="ic sm"><use href="#i-rows"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 2 · `button.on.vopt`
- **איפה:** דף הבית (בית ×7) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** בורר 47
- **טולטיפים:** "מצב שורות" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="vsw"><button aria-label="מצב שורות" aria-pressed="true" class="vopt on" data-tip="מצב שורות" data-view="rows" type="button"><svg class="ic sm"><use href="#i-rows"></use></svg></button></div></div></div>
  ```

### בורר 3 · `button.vopt`
- **איפה:** דף הבית (בית ×7) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** בורר 49
- **טולטיפים:** "מצב טבלה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="vsw"><button aria-label="מצב טבלה" aria-pressed="undefined" class="vopt" data-tip="מצב טבלה" data-view="table" type="button"><svg class="ic sm"><use href="#i-table"></use></svg></button></div></div></div>
  ```

### בורר 4 · `details.coll`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים מתקדמים מנהל ציפוף ימים מיוח
- **וריאנטים (אותו בורר):** בורר 21, בורר 38
- **טולטיפים:** "להזמנה זו בלבד · דורש מנהל" (לא ממוספר), "תוספת 50% מסך ההזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 27 `chevBob`, הנפשה 28 `collShine`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><summary><svg class="ic ia-sliders ia-h"><use href="#i-sliders"></use></svg>פרטים מתקדמים<span class="chip gray" style="margin-inline-start:4px">מנהל</span><svg class="ic chev ia-chev ia-h"><use href="#i-chev"></use></svg></summary><div class="in"><div><label class="lbl"><svg class="ic sm ia-cal ia-h"><use href="#i-cal"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 6 · `div.methods`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מזומן אשראי העברה צ׳ק
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="methods"><button class="on" data-method="מזומן"><svg class="ic lg"><use href="#i-cash"></use></svg>מזומן</button><button class="" data-method="אשראי"><svg class="ic lg"><use href="#i-card"></use></svg>אשראי</button><button class="" data-method="העברה"><svg class="ic lg"><use href="#i-bank"></use></svg>העברה</button><button class="" data-method="צ׳ק"><svg class="ic lg"> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 7 · `button.btn.on.tgl`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתם על התקנון
- **וריאנטים (אותו בורר):** בורר 51
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f"><button aria-pressed="true" class="btn tgl on" data-terms="" id="termsBtn" style="margin-top:6px" type="button"><svg class="ic sm evck"><use href="#i-check"></use></svg>חתם על התקנון</button></div></div></div>
  ```

### בורר 8 · `button.on.opt`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** זיכוי לניצול על פריט חלופי תקף 15
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="opt on" data-copt="credit"><svg class="ic lg"><use href="#i-undo"></use></svg><div><b>זיכוי לניצול על פריט חלופי</b><small>תקף 15 דקות. אחר כך מוחזר.</small></div></button></div></div>
  ```

### בורר 9 · `button.opt`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** החזר כספי נדרשים פרטי בנק.
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="opt" data-copt="bank"><svg class="ic lg"><use href="#i-bank"></use></svg><div><b>החזר כספי</b><small>נדרשים פרטי בנק.</small></div></button></div></div>
  ```

### בורר 12 · `button.tab.tdel`
- **איפה:** כרטיס הזמנה (הזמנה ×47) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח
- **וריאנטים (אותו בורר):** בורר 33
- **טולטיפים:** טולטיפ 13 "משלוח הוזמן"
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <button class="tab tdel" data-ico="truck" data-tab="delivery" role="tab"><span class="tico"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg><span aria-label="משלוח הוזמן" class="tabmk ok" data-tip="משלוח הוזמן" role="img"><svg class="ic sm ia-check ia-h"><use href="#i-check"></use></svg></span></span>משלוח</button>
  ```

### בורר 13 · `button.btn.tgl`
- **איפה:** כרטיס הזמנה (הזמנה ×111) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתם על התקנון
- **וריאנטים (אותו בורר):** בורר 36
- **שלד HTML:**
  ```html
  <button aria-pressed="false" class="btn tgl" data-terms="" id="termsBtn" style="margin-top:6px" type="button">חתם על התקנון</button>
  ```

### בורר 19 · `label.sw`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **שלד HTML:**
  ```html
  <label class="sw"><input aria-label="הזמנה עם משלוח" checked="" type="checkbox"/><i></i></label>
  ```

### בורר 20 · `nav.tabs`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים 3 פריטים משלוח תשלומים היסטו
- **טולטיפים:** טולטיפ 12 "חסר: מייל, כתובת", טולטיפ 13 "משלוח הוזמן"
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 80 `ia-nod`, הנפשה 82 `ia-ring`, הנפשה 94 `ia-sway`, הנפשה 95 `ia-tick`, הנפשה 96 `ia-tilt`, הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <nav class="tabs" role="tablist"><button class="tab" data-ico="user" data-tab="details" role="tab"><span class="tico"><svg class="ic ia-user ia-h"><use href="#i-user"></use></svg><span aria-label="חסר: מייל, כתובת" class="tabmk debt" data-tip="חסר: מייל, כתובת" role="img"><svg class="ic sm ia-alert ia-h"><use href="#i-alert"></use></svg></span></span>פרטים</button> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 21 · `details.coll`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אפשרויות מנהל רישום תשלום ידני בקש
- **וריאנטים (אותו בורר):** בורר 4, בורר 38
- **הנפשות:** הנפשה 27 `chevBob`, הנפשה 28 `collShine`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 88 `ia-spin360`, הנפשה 96 `ia-tilt`, הנפשה 98 `ia-undo`, הנפשה 99 `ia-wave`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><summary><svg class="ic ia-lock ia-h"><use href="#i-lock"></use></svg>אפשרויות מנהל<svg class="ic chev ia-chev ia-h"><use href="#i-chev"></use></svg></summary><div class="in"><div class="row wrap" style="gap:10px"><button class="btn" data-ico="cash" data-msg="רישום תשלום נוסף (באישור מנהל)" disabled=""><svg class="ic sm ia-cash ia-h"><use href="#i-cash"></use></svg>רישום תשלום ידני</button> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 22 · `button.on.tab`
- **איפה:** כרטיס הזמנה (הזמנה ×47) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים
- **וריאנטים (אותו בורר):** בורר 23
- **טולטיפים:** "חסר: ת״ז" (לא ממוספר)
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <button class="tab on" data-tab="details" role="tab"><span class="tico"><svg class="ic"><use href="#i-user"></use></svg><span aria-label="חסר: ת״ז" class="tabmk debt" data-tip="חסר: ת״ז" role="img"><svg class="ic sm"><use href="#i-alert"></use></svg></span></span>פרטים</button>
  ```

### בורר 23 · `button.on.tab`
- **איפה:** כרטיס הזמנה (הזמנה ×47) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 4 פריטים
- **וריאנטים (אותו בורר):** בורר 22
- **שלד HTML:**
  ```html
  <button class="tab on" data-tab="items" role="tab"><span class="tico"><svg class="ic"><use href="#i-dress"></use></svg><span class="cnt">4</span></span>פריטים</button>
  ```

### בורר 27 · `button.tab`
- **איפה:** כרטיס הזמנה (הזמנה ×141) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** היסטוריה
- **וריאנטים (אותו בורר):** בורר 29
- **הנפשות:** הנפשה 95 `ia-tick`
- **שלד HTML:**
  ```html
  <button class="tab" data-ico="clock" data-tab="history" role="tab"><span class="tico"><svg class="ic ia-clock ia-h"><use href="#i-clock"></use></svg></span>היסטוריה</button>
  ```

### בורר 29 · `button.tab`
- **איפה:** כרטיס הזמנה (הזמנה ×141) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תשלומים
- **וריאנטים (אותו בורר):** בורר 27
- **שלד HTML:**
  ```html
  <button class="tab" data-tab="payments" role="tab"><span class="tico"><svg class="ic"><use href="#i-card"></use></svg></span>תשלומים</button>
  ```

### בורר 33 · `button.tab.tdel`
- **איפה:** כרטיס הזמנה (הזמנה ×47) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח
- **וריאנטים (אותו בורר):** בורר 12
- **טולטיפים:** טולטיפ 13 "משלוח הוזמן"
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <button class="tab tdel" data-tab="delivery" role="tab"><span class="tico"><svg class="ic"><use href="#i-truck"></use></svg><span aria-label="משלוח הוזמן" class="tabmk ok" data-tip="משלוח הוזמן" role="img"><svg class="ic sm"><use href="#i-check"></use></svg></span></span>משלוח</button>
  ```

### בורר 36 · `button.btn.tgl`
- **איפה:** כרטיס הזמנה (הזמנה ×111) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחוקים
- **וריאנטים (אותו בורר):** בורר 13
- **הנפשות:** הנפשה 44 `dtWig`
- **שלד HTML:**
  ```html
  <button aria-pressed="false" class="btn tgl" data-sub="del" id="delToggle" type="button"><span class="dtico"><svg class="ic sm"><use href="#i-trash"></use></svg></span>מחוקים</button>
  ```

### בורר 38 · `details.coll`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אפשרויות מנהל רישום תשלום ידני בקש
- **וריאנטים (אותו בורר):** בורר 4, בורר 21
- **הנפשות:** הנפשה 27 `chevBob`, הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><summary><svg class="ic"><use href="#i-lock"></use></svg>אפשרויות מנהל<svg class="ic chev"><use href="#i-chev"></use></svg></summary><div class="in"><div class="row wrap" style="gap:10px"><button class="btn" data-msg="רישום תשלום נוסף (באישור מנהל)" disabled="" title="אין יתרה לתשלום"><svg class="ic sm"><use href="#i-cash"></use></svg>רישום תשלום ידני</button> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 40 · `div.pill.seg`
- **איפה:** כרטיס הזמנה (הזמנה ×113) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלוך חזור הלוך-חזור
- **וריאנטים (אותו בורר):** בורר 41
- **הנפשות:** הנפשה 77 `ia-nL`, הנפשה 78 `ia-nR`, הנפשה 92 `ia-squash`
- **שלד HTML:**
  ```html
  <div class="seg pill" id="dirSeg" role="radiogroup" style="--n:3;--i:2"><span aria-hidden="true" class="pth"></span><button aria-checked="false" class="" data-dir="there" data-ico="arrr" role="radio" type="button"><svg class="ic sm ia-arrr ia-h"><use href="#i-arrr"></use></svg>הלוך</button><button aria-checked="false" class="" data-dir="back" data-ico="arrl" role="radio" type="button"><svg class="ic sm ia-arrl ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 41 · `div.pill.seg`
- **איפה:** כרטיס הזמנה (הזמנה ×113) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלוך חזור הלוך-חזור
- **וריאנטים (אותו בורר):** בורר 40
- **שלד HTML:**
  ```html
  <div class="seg pill" id="dirSeg" role="radiogroup" style="--n:3;--i:2"><span aria-hidden="true" class="pth"></span><button aria-checked="false" class="" data-dir="there" role="radio" type="button"><svg class="ic sm"><use href="#i-arrr"></use></svg>הלוך</button><button aria-checked="false" class="" data-dir="back" role="radio" type="button"><svg class="ic sm"><use href="#i-arrl"></use></svg>חזור</button> … (המשך ב-index.html, "העתק HTML")
  ```

### בורר 44 · `div.vsw`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** בורר 1
- **טולטיפים:** "טבלה" (לא ממוספר), "רשימה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="תצוגת רשימה" class="vopt on" data-hview="list" data-tip="רשימה" type="button"><svg class="ic"><use href="#i-rows"></use></svg></button><button aria-label="תצוגת טבלה" class="vopt" data-hview="table" data-tip="טבלה" type="button"><svg class="ic"><use href="#i-table"></use></svg></button></div>
  ```

### בורר 47 · `button.on.vopt`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** בורר 2
- **טולטיפים:** "רשימה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="vsw"><button aria-label="תצוגת רשימה" class="vopt on" data-hview="list" data-tip="רשימה" type="button"><svg class="ic"><use href="#i-rows"></use></svg></button></div>
  ```

### בורר 49 · `button.vopt`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** בורר 3
- **טולטיפים:** "טבלה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="vsw"><button aria-label="תצוגת טבלה" class="vopt" data-iview="table" data-tip="טבלה" type="button"><svg class="ic"><use href="#i-table"></use></svg></button></div>
  ```

### בורר 51 · `button.btn.on.tgl`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתם על התקנון
- **וריאנטים (אותו בורר):** בורר 7
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="card cust shine-on"><div class="kv"><div class="f"><button aria-pressed="true" class="btn tgl on" data-ico="check" data-terms="" id="termsBtn" style="margin-top:6px" type="button"><svg class="ic sm evck ia-check ia-h ia-ov"><use href="#i-check"></use></svg>חתם על התקנון</button></div></div></div>
  ```

<a id="chip"></a>
## צ'יפים, תגיות וסימונים (תגית N)

### תגית 1 · `div.gray.ico`
- **איפה:** דף הבית (בית ×26) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** תגית 3
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico gray"><svg class="ic lg"><use href="#i-info"></use></svg></div></div></div>
  ```

### תגית 2 · `span.stx`
- **איפה:** דף הבית (בית ×15) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** המספרים מחושבים מחדש בכל כניסה לעמ
- **וריאנטים (אותו בורר):** תגית 33
- **שלד HTML:**
  ```html
  <span class="stx"><svg class="ic"><use href="#i-refresh"></use></svg>המספרים מחושבים מחדש בכל כניסה לעמוד</span>
  ```

### תגית 3 · `div.gray.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×5) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 1
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="chg"><div class="c"><div class="ico gray" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none"><svg class="ic sm"><use href="#i-sig"></use></svg></div></div></div></div>
  ```

### תגית 4 · `div.ico.plum`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 62
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico plum"><svg class="ic lg ia-note ia-h"><use href="#i-note"></use></svg></div></div></div>
  ```

### תגית 5 · `div.blue.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 82
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico blue"><svg class="ic lg ia-card ia-h"><use href="#i-card"></use></svg></div></div></div>
  ```

### תגית 7 · `span.ck`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 39
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="dot"><span class="ck"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span></div></div>
  ```

### תגית 10 · `span.ok.tabmk`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 24
- **טולטיפים:** טולטיפ 13 "משלוח הוזמן"
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="tab tdel"><span class="tico"><span aria-label="משלוח הוזמן" class="tabmk ok" data-tip="משלוח הוזמן" role="img"><svg class="ic sm ia-check ia-h"><use href="#i-check"></use></svg></span></span></div>
  ```

### תגית 13 · `div.gold.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×80) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 60
- **הנפשות:** הנפשה 69 `ia-flip`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico gold"><svg class="ic lg ia-cal ia-h"><use href="#i-cal"></use></svg></div></div></div>
  ```

### תגית 14 · `span.chip.gray`
- **איפה:** כרטיס הזמנה (הזמנה ×37) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מנהל
- **הנפשות:** הנפשה 28 `collShine`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <details class="coll"><span class="chip gray" style="margin-inline-start:4px">מנהל</span></details>
  ```

### תגית 16 · `span.dtico`
- **איפה:** כרטיס הזמנה (הזמנה ×42) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 70
- **הנפשות:** הנפשה 44 `dtWig`, הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="btn tgl" id="delToggle"><span class="dtico"><svg class="ic sm ia-trash ia-h"><use href="#i-trash"></use></svg></span></div>
  ```

### תגית 18 · `div.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 78
- **הנפשות:** הנפשה 67 `ia-drive`
- **שלד HTML:**
  ```html
  <div class="dhero"><div class="ico"><svg class="ic lg ia-truck ia-h"><use href="#i-truck"></use></svg></div></div>
  ```

### תגית 20 · `span.av`
- **איפה:** כרטיס הזמנה (הזמנה ×479) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ד
- **שלד HTML:**
  ```html
  <div class="hv-r"><span class="av">ד</span></div>
  ```

### תגית 21 · `span.gv`
- **איפה:** כרטיס הזמנה (הזמנה ×140) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לא חתום
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="gl sig no"><span class="gv">לא חתום</span></div></div>
  ```

### תגית 22 · `span.badge`
- **איפה:** כרטיס הזמנה (הזמנה ×45) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 0
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><div class="cart-t"><span class="badge">0</span></div></div></div>
  ```

### תגית 23 · `span.debt.tabmk`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 83
- **טולטיפים:** "חסר: ת״ז" (לא ממוספר)
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="tab on"><span class="tico"><span aria-label="חסר: ת״ז" class="tabmk debt" data-tip="חסר: ת״ז" role="img"><svg class="ic sm"><use href="#i-alert"></use></svg></span></span></div>
  ```

### תגית 24 · `span.ok.tabmk`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 10
- **טולטיפים:** טולטיפ 13 "משלוח הוזמן"
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="tab tdel"><span class="tico"><span aria-label="משלוח הוזמן" class="tabmk ok" data-tip="משלוח הוזמן" role="img"><svg class="ic sm"><use href="#i-check"></use></svg></span></span></div>
  ```

### תגית 26 · `span.mbadge`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 0
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><span class="mbadge">0</span></div>
  ```

### תגית 27 · `span.mft`
- **איפה:** כרטיס הזמנה (הזמנה ×330) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 85
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfile"><span class="mft"><svg class="ic"><use href="#i-file"></use></svg></span></div></div>
  ```

### תגית 28 · `span.mfx`
- **איפה:** כרטיס הזמנה (הזמנה ×396) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטי ההזמנה PDF · 184 KB
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><span class="mfx"><b>פרטי ההזמנה</b><small>PDF · 184 KB</small></span></div>
  ```

### תגית 29 · `span.mfk`
- **איפה:** כרטיס הזמנה (הזמנה ×396) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 86
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfile"><span class="mfk"><svg class="ic sm"><use href="#i-check"></use></svg></span></div></div>
  ```

### תגית 30 · `span.mft.zip`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 87
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfile"><span class="mft zip"><svg class="ic"><use href="#i-file"></use></svg></span></div></div>
  ```

### תגית 31 · `span.amck`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 88
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim2"><span class="amck"><svg class="ic sm"><use href="#i-check"></use></svg></span></div>
  ```

### תגית 33 · `span.stx`
- **איפה:** דף הבית (בית ×15) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** פעיל
- **וריאנטים (אותו בורר):** תגית 2
- **שלד HTML:**
  ```html
  <div class="card res-one"><div class="list"><div class="li rlink lrow"><span class="stx"><svg class="ic"><use href="#i-clock"></use></svg>פעיל</span></div></div></div>
  ```

### תגית 34 · `div.dot`
- **איפה:** כרטיס הזמנה (הזמנה ×244) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 38
- **הנפשות:** הנפשה 67 `ia-drive`
- **שלד HTML:**
  ```html
  <div class="tx fut"><div class="dot"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg></div></div>
  ```

### תגית 38 · `div.dot`
- **איפה:** כרטיס הזמנה (הזמנה ×244) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 34
- **שלד HTML:**
  ```html
  <div class="tx fut"><div class="dot"><svg class="ic"><use href="#i-gift"></use></svg></div></div>
  ```

### תגית 39 · `span.ck`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 7
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="dot"><span class="ck"><svg class="ic"><use href="#i-check"></use></svg></span></div></div>
  ```

### תגית 42 · `span.tico`
- **איפה:** כרטיס הזמנה (הזמנה ×235) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 44
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="tab"><span class="tico"><svg class="ic ia-card ia-h"><use href="#i-card"></use></svg></span></div>
  ```

### תגית 44 · `span.tico`
- **איפה:** כרטיס הזמנה (הזמנה ×235) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 42
- **טולטיפים:** "חסר: ת״ז" (לא ממוספר)
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="tab on"><span class="tico"><svg class="ic"><use href="#i-user"></use></svg><span aria-label="חסר: ת״ז" class="tabmk debt" data-tip="חסר: ת״ז" role="img"><svg class="ic sm"><use href="#i-alert"></use></svg></span></span></div>
  ```

### תגית 47 · `div.ico.rose`
- **איפה:** כרטיס הזמנה (הזמנה ×94) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 49
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico rose"><svg class="ic lg ia-file ia-h"><use href="#i-file"></use></svg></div></div></div>
  ```

### תגית 49 · `div.ico.rose`
- **איפה:** כרטיס הזמנה (הזמנה ×94) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 47
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico rose"><svg class="ic lg"><use href="#i-file"></use></svg></div></div></div>
  ```

### תגית 53 · `button.btn.sm`
- **איפה:** כרטיס הזמנה (הזמנה ×209) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סמן כנמסרה
- **וריאנטים (אותו בורר):** תגית 56
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <article class="hrow irow"><div class="hdet"><div class="hv-btns"><button class="btn sm" data-ico="bag" data-id="2"><svg class="ic sm ia-bag ia-h ia-ov"><use href="#i-bag"></use></svg>סמן כנמסרה</button></div></div></article>
  ```

### תגית 56 · `button.btn.sm`
- **איפה:** כרטיס הזמנה (הזמנה ×209) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר
- **וריאנטים (אותו בורר):** תגית 53
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f"><button class="btn sm"><svg class="ic sm"><use href="#i-mail"></use></svg>מייל מהיר</button></div></div></div>
  ```

### תגית 60 · `div.gold.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×80) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 13
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico gold"><svg class="ic lg"><use href="#i-cal"></use></svg></div></div></div>
  ```

### תגית 62 · `div.ico.plum`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 4
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico plum"><svg class="ic lg"><use href="#i-note"></use></svg></div></div></div>
  ```

### תגית 64 · `div.ico.teal`
- **איפה:** כרטיס הזמנה (הזמנה ×159) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 68
- **הנפשות:** הנפשה 68 `ia-drop`
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="card-h"><div class="ico teal"><svg class="ic lg ia-pin ia-h"><use href="#i-pin"></use></svg></div></div></div>
  ```

### תגית 68 · `div.ico.teal`
- **איפה:** כרטיס הזמנה (הזמנה ×159) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 64
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="card-h"><div class="ico teal"><svg class="ic lg"><use href="#i-pin"></use></svg></div></div></div>
  ```

### תגית 70 · `span.dtico`
- **איפה:** כרטיס הזמנה (הזמנה ×42) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 16
- **הנפשות:** הנפשה 44 `dtWig`
- **שלד HTML:**
  ```html
  <div class="btn tgl" id="delToggle"><span class="dtico"><svg class="ic sm"><use href="#i-trash"></use></svg></span></div>
  ```

### תגית 74 · `b.hv-btns`
- **איפה:** כרטיס הזמנה (הזמנה ×129) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סמן כנמסרה סמן תיקון בוצע
- **וריאנטים (אותו בורר):** תגית 75
- **שלד HTML:**
  ```html
  <article class="hrow irow"><div class="hdet"><b class="hv-btns"><button class="btn sm" data-id="2"><svg class="ic sm"><use href="#i-bag"></use></svg>סמן כנמסרה</button><button class="btn sm" data-id="2"><svg class="ic sm"><use href="#i-check"></use></svg>סמן תיקון בוצע</button><button aria-label="עריכת מידה" class="ibtn" data-id="2" title="עריכת מידה"><svg class="ic sm"><use href="#i-pencil"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### תגית 75 · `b.hv-btns`
- **איפה:** כרטיס הזמנה (הזמנה ×129) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סמן כנמסרה
- **וריאנטים (אותו בורר):** תגית 74
- **שלד HTML:**
  ```html
  <article class="hrow irow"><div class="hdet"><b class="hv-btns"><button class="btn sm" data-id="3"><svg class="ic sm"><use href="#i-bag"></use></svg>סמן כנמסרה</button><button aria-label="עריכת מידה" class="ibtn" data-id="3" title="עריכת מידה"><svg class="ic sm"><use href="#i-pencil"></use></svg></button><button aria-label="הסרת פריט" class="ibtn" data-id="3" title="הסרת פריט"><svg class="ic sm"><use href="#i-trash"> … (המשך ב-index.html, "העתק HTML")
  ```

### תגית 78 · `div.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 18
- **שלד HTML:**
  ```html
  <div class="dhero"><div class="ico"><svg class="ic lg"><use href="#i-truck"></use></svg></div></div>
  ```

### תגית 79 · `div.green.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×50) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 80
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico green"><svg class="ic lg"><use href="#i-wallet"></use></svg></div></div></div>
  ```

### תגית 80 · `div.green.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×50) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 79
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="chg"><div class="c"><div class="ico green" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none"><svg class="ic sm"><use href="#i-minus"></use></svg></div></div></div></div>
  ```

### תגית 82 · `div.blue.ico`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 5
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico blue"><svg class="ic lg"><use href="#i-card"></use></svg></div></div></div>
  ```

### תגית 83 · `span.debt.tabmk`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 23
- **טולטיפים:** טולטיפ 12 "חסר: מייל, כתובת"
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="tab"><span class="tico"><span aria-label="חסר: מייל, כתובת" class="tabmk debt" data-tip="חסר: מייל, כתובת" role="img"><svg class="ic sm"><use href="#i-alert"></use></svg></span></span></div>
  ```

### תגית 85 · `span.mft`
- **איפה:** כרטיס הזמנה (הזמנה ×330) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 27
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mfile"><span class="mft"><svg class="ic ia-file ia-h" style="--ia-dl: 120ms;"><use href="#i-file"></use></svg></span></div></div>
  ```

### תגית 86 · `span.mfk`
- **איפה:** כרטיס הזמנה (הזמנה ×396) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 29
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mfile"><span class="mfk"><svg class="ic sm ia-check ia-h" style="--ia-dl: 200ms;"><use href="#i-check"></use></svg></span></div></div>
  ```

### תגית 87 · `span.mft.zip`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 30
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mfile"><span class="mft zip"><svg class="ic ia-file ia-h" style="--ia-dl: 680ms;"><use href="#i-file"></use></svg></span></div></div>
  ```

### תגית 88 · `span.amck`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** תגית 31
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim2"><span class="amck"><svg class="ic sm ia-check ia-h" style="--ia-dl: 40ms;"><use href="#i-check"></use></svg></span></div>
  ```

<a id="form"></a>
## שדות וטפסים (שדה N)

### שדה 2 · `div.mfile.off`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תקנון חתום טרם נחתם
- **וריאנטים (אותו בורר):** שדה 68
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-checked="false" aria-disabled="true" class="mfile off" data-id="reg" role="checkbox" tabindex="-1"><span class="mft"><svg class="ic"><use href="#i-file"></use></svg></span><span class="mfx"><b>תקנון חתום</b><small>טרם נחתם</small></span><span class="mfk"><svg class="ic sm"><use href="#i-check"></use></svg></span></div></div>
  ```

### שדה 3 · `div.amtin`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ₪
- **שלד HTML:**
  ```html
  <div class="amtin"><span>₪</span><input aria-label="סכום" inputmode="numeric" type="number" value="120"/></div>
  ```

### שדה 4 · `div.inpw`
- **איפה:** כרטיס הזמנה (הזמנה ×122) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 32
- **הנפשות:** הנפשה 85 `ia-slide`
- **שלד HTML:**
  ```html
  <div class="sbar"><div class="inpw"><svg class="ic ia-scan ia-h"><use href="#i-scan"></use></svg><input aria-label="הקלדת ברקוד" autocomplete="off" class="inp" inputmode="numeric" placeholder="ברקוד: סרקו או הקלידו מספר דגם..."/><span class="chip green" id="scanMsg" style="display:none"></span></div></div>
  ```

### שדה 6 · `textarea.inp`
- **איפה:** כרטיס הזמנה (הזמנה ×107) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלקוח מבקש ניילון הגנה לשמלות. לבד
- **וריאנטים (אותו בורר):** שדה 39
- **שלד HTML:**
  ```html
  <textarea class="inp" placeholder="כתבו כאן הערה…">הלקוח מבקש ניילון הגנה לשמלות. לבדוק מידה 38 לפני המשלוח.</textarea>
  ```

### שדה 8 · `div.field`
- **איפה:** כרטיס הזמנה (הזמנה ×162) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מספר דגם
- **וריאנטים (אותו בורר):** שדה 51
- **טולטיפים:** "ניקוי" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <div class="addpanel"><div class="field"><label class="lbl" for="addModel">מספר דגם</label><div class="inpw"><svg class="ic sm ia-dress ia-h"><use href="#i-dress"></use></svg><input autocomplete="off" class="inp" data-sug="model" inputmode="numeric" placeholder="מספר דגם..." value="4519"/><button aria-label="ניקוי" class="inpx" data-ico="x" data-inpx="addModel" data-tip="ניקוי" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 9 · `div.trow`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה עם משלוח
- **וריאנטים (אותו בורר):** שדה 53
- **טולטיפים:** "משלוח אחד בלבד להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 81 `ia-pulse`
- **שלד HTML:**
  ```html
  <div class="trow"><label class="sw"><input aria-label="הזמנה עם משלוח" checked="" type="checkbox"/><i></i></label><b class="big">הזמנה עם משלוח</b><button aria-label="עזרה" class="tip" data-ico="info" data-tip="משלוח אחד בלבד להזמנה" type="button"><svg class="ic sm ia-info ia-h"><use href="#i-info"></use></svg></button></div>
  ```

### שדה 10 · `div.mh`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר
- **וריאנטים (אותו בורר):** שדה 54
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mh"><span class="mico" style="--rph: 0ms;"><svg class="ic lg" style="animation-delay: 0ms;"><use href="#i-mail"></use></svg></span><h2>מייל מהיר</h2><button aria-label="סגירה" class="ibtn mx" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div></div>
  ```

### שדה 11 · `div.mto`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נמען מרים אברמוביץ חסר מייל
- **וריאנטים (אותו בורר):** שדה 57
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mto"><small>נמען</small><div class="mto-r"><b>מרים אברמוביץ</b><span class="missv"><svg class="ic sm"><use href="#i-alert"></use></svg>חסר מייל</span></div></div></div>
  ```

### שדה 13 · `div.mfh`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קבצים מצורפים 0
- **וריאנטים (אותו בורר):** שדה 59
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfld"><div class="mfh"><span class="lbl"><svg class="ic sm"><use href="#i-clip"></use></svg>קבצים מצורפים</span><span class="mbadge">0</span></div></div></div>
  ```

### שדה 14 · `span.lbl`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קבצים מצורפים
- **וריאנטים (אותו בורר):** שדה 60
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mfld"><span class="lbl"><svg class="ic sm"><use href="#i-clip"></use></svg>קבצים מצורפים</span></div></div>
  ```

### שדה 16 · `div.dbtns.mact`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שלח מייל ביטול
- **וריאנטים (אותו בורר):** שדה 69
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dlg mailwin" id="dlg"><div class="dbtns mact"><button class="btn primary lg block" disabled="" id="m-send" type="button"><svg class="ic" style="animation-delay: 0ms;"><use href="#i-send"></use></svg>שלח מייל</button><button class="btn ghost block" type="button"><svg class="ic sm"><use href="#i-x"></use></svg>ביטול</button></div></div></div>
  ```

### שדה 17 · `div.ashield`
- **איפה:** כרטיס הזמנה (הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 71
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim2"><div class="ashield" style="--rph: -0.20000000298023224ms;"><svg class="ic lg" style="animation-delay: -0.2ms;"><use href="#i-shield"></use></svg></div></div>
  ```

### שדה 19 · `div.amgr`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ש שרה לוי · מנהלת
- **וריאנטים (אותו בורר):** שדה 75
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim2"><div class="amgr"><span class="av">ש</span><b>שרה לוי · מנהלת</b><span class="amck"><svg class="ic sm"><use href="#i-check"></use></svg></span></div></div>
  ```

### שדה 23 · `div.scan`
- **איפה:** דף הבית (בית ×37) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** שדה 26
- **טולטיפים:** "חיפוש חכם" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="hero-in"><form class="srch"><div class="scan"><input aria-label="שאלה לחיפוש החכם" autocomplete="off" id="sq" value=""/><button aria-label="חיפוש חכם" class="btn primary" data-tip="חיפוש חכם" type="submit"><svg class="ic"><use href="#i-send"></use></svg></button></div></form></div>
  ```

### שדה 26 · `div.scan`
- **איפה:** דף הבית (בית ×37) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** שדה 23
- **טולטיפים:** "חיפוש חכם" (לא ממוספר), "ניקוי הכול" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="hero-in"><form class="srch"><div class="scan" style="transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);"><input aria-label="שאלה לחיפוש החכם" autocomplete="off" id="sq" value="כהן"/><button aria-label="ניקוי החיפוש" class="ibtn" data-tip="ניקוי הכול" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 32 · `div.inpw`
- **איפה:** כרטיס הזמנה (הזמנה ×122) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 4
- **שלד HTML:**
  ```html
  <div class="addpanel"><div class="field"><div class="inpw"><svg class="ic sm"><use href="#i-dress"></use></svg><input autocomplete="off" class="inp" data-sug="model" inputmode="numeric" placeholder="מספר דגם..." value="4519"/><button aria-label="ניקוי" class="inpx" data-inpx="addModel" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div></div></div>
  ```

### שדה 37 · `input.inp`
- **איפה:** כרטיס הזמנה (הזמנה ×188) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 38
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="field"><div class="inpw"><input autocomplete="off" class="inp" data-sug="street" placeholder="רחוב ומספר..." value=""/></div></div></div>
  ```

### שדה 38 · `input.inp`
- **איפה:** כרטיס הזמנה (הזמנה ×188) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 37
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><input class="inp" value="הזמנה #53375"/></div>
  ```

### שדה 39 · `textarea.inp`
- **איפה:** כרטיס הזמנה (הזמנה ×107) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 6
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><textarea class="inp" id="m-body" rows="6" style="height: 187px;"></textarea></div>
  ```

### שדה 42 · `label.lbl`
- **איפה:** כרטיס הזמנה (הזמנה ×368) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מידה
- **וריאנטים (אותו בורר):** שדה 43
- **שלד HTML:**
  ```html
  <div class="addpanel"><label class="lbl">מידה</label></div>
  ```

### שדה 43 · `label.lbl`
- **איפה:** כרטיס הזמנה (הזמנה ×368) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עיר משלוח
- **וריאנטים (אותו בורר):** שדה 42
- **שלד HTML:**
  ```html
  <label class="lbl" for="delCityIn">עיר משלוח</label>
  ```

### שדה 51 · `div.field`
- **איפה:** כרטיס הזמנה (הזמנה ×162) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עיר משלוח
- **וריאנטים (אותו בורר):** שדה 8
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="field"><label class="lbl" for="delCityIn">עיר משלוח</label><div class="inpw"><svg class="ic sm"><use href="#i-pin"></use></svg><input autocomplete="off" class="inp" data-sug="city" placeholder="עיר..." value="ירושלים"/><button aria-label="ניקוי" class="inpx" data-inpx="delCityIn" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div></div></div>
  ```

### שדה 53 · `div.trow`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה עם משלוח
- **וריאנטים (אותו בורר):** שדה 9
- **טולטיפים:** "משלוח אחד בלבד להזמנה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="trow"><label class="sw"><input aria-label="הזמנה עם משלוח" checked="" type="checkbox"/><i></i></label><b class="big">הזמנה עם משלוח</b><button aria-label="עזרה" class="tip" data-tip="משלוח אחד בלבד להזמנה" type="button"><svg class="ic sm"><use href="#i-info"></use></svg></button></div>
  ```

### שדה 54 · `div.mh`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר
- **וריאנטים (אותו בורר):** שדה 10
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 75 `ia-lift`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mh"><span class="mico ia-bg" style="--rph: 0ms;"><svg class="ic lg ia-mail ia-h" style="animation-delay: 0ms; --ia-dl: 0ms;"><use href="#i-mail"></use></svg></span><h2>מייל מהיר</h2><button aria-label="סגירה" class="ibtn mx" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h" style="--ia-dl: 40ms;"><use href="#i-x"></use></svg></button></div></div>
  ```

### שדה 57 · `div.mto`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נמען מרים אברמוביץ חסר מייל
- **וריאנטים (אותו בורר):** שדה 11
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mto"><small>נמען</small><div class="mto-r"><b>מרים אברמוביץ</b><span class="missv"><svg class="ic sm ia-alert ia-h" style="--ia-dl: 80ms;"><use href="#i-alert"></use></svg>חסר מייל</span></div></div></div>
  ```

### שדה 59 · `div.mfh`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קבצים מצורפים 0
- **וריאנטים (אותו בורר):** שדה 13
- **הנפשות:** הנפשה 65 `ia-clipw`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mfld"><div class="mfh"><span class="lbl"><svg class="ic sm ia-clip ia-h" style="--ia-dl: 80ms;"><use href="#i-clip"></use></svg>קבצים מצורפים</span><span class="mbadge">0</span></div></div></div>
  ```

### שדה 60 · `span.lbl`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קבצים מצורפים
- **וריאנטים (אותו בורר):** שדה 14
- **הנפשות:** הנפשה 65 `ia-clipw`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mfld"><span class="lbl"><svg class="ic sm ia-clip ia-h" style="--ia-dl: 80ms;"><use href="#i-clip"></use></svg>קבצים מצורפים</span></div></div>
  ```

### שדה 62 · `div.mfile`
- **איפה:** כרטיס הזמנה (הזמנה ×355) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** דף משלוח PDF · 58 KB
- **וריאנטים (אותו בורר):** שדה 64
- **טולטיפים:** "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-checked="false" aria-disabled="false" class="mfile" data-id="del" role="checkbox" tabindex="0"><span class="mft"><svg class="ic"><use href="#i-file"></use></svg></span><span class="mfx"><b>דף משלוח</b><small>PDF · 58 KB</small></span><button aria-label="תצוגה מקדימה" class="mfe" data-id="del" data-tip="תצוגה" type="button"><svg class="ic sm"><use href="#i-eye"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 64 · `div.mfile`
- **איפה:** כרטיס הזמנה (הזמנה ×355) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תמונות דגמים ZIP · 2.4 MB
- **וריאנטים (אותו בורר):** שדה 62
- **טולטיפים:** "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-checked="false" aria-disabled="false" class="mfile" data-id="img" role="checkbox" tabindex="0"><span class="mft zip"><svg class="ic"><use href="#i-file"></use></svg></span><span class="mfx"><b>תמונות דגמים</b><small>ZIP · 2.4 MB</small></span><button aria-label="תצוגה מקדימה" class="mfe" data-id="img" data-tip="תצוגה" type="button"><svg class="ic sm"><use href="#i-eye"> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 68 · `div.mfile.off`
- **איפה:** כרטיס הזמנה (הזמנה ×41) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תקנון חתום טרם נחתם
- **וריאנטים (אותו בורר):** שדה 2
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div aria-checked="false" aria-disabled="true" class="mfile off" data-id="reg" role="checkbox" tabindex="-1"><span class="mft"><svg class="ic ia-file ia-h" style="--ia-dl: 240ms;"><use href="#i-file"></use></svg></span><span class="mfx"><b>תקנון חתום</b><small>טרם נחתם</small></span><span class="mfk"><svg class="ic sm ia-check ia-h" style="--ia-dl: 280ms;"><use href="#i-check"></use> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 69 · `div.dbtns.mact`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שלח מייל ביטול
- **וריאנטים (אותו בורר):** שדה 16
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 83 `ia-send`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="dbtns mact"><button class="btn primary lg block" data-ico="send" disabled="" id="m-send" type="button"><svg class="ic ia-send ia-h" style="animation-delay: 0ms; --ia-dl: 800ms;"><use href="#i-send"></use></svg>שלח מייל</button><button class="btn ghost block" data-ico="x" type="button"><svg class="ic sm ia-x ia-h" style="--ia-dl: 840ms;"><use href="#i-x"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### שדה 71 · `div.ashield`
- **איפה:** כרטיס הזמנה (הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 17
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 84 `ia-shk`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim2"><div class="ashield" style="--rph: -0.20000000298023224ms;"><svg class="ic lg ia-shield ia-h" style="animation-delay: -0.2ms; --ia-dl: 0ms;"><use href="#i-shield"></use></svg></div></div>
  ```

### שדה 73 · `input.ac`
- **איפה:** כרטיס הזמנה (הזמנה ×44) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 74
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim2"><input aria-label="ספרה 3" autocomplete="off" class="ac" data-i="2" inputmode="numeric" maxlength="1" pattern="[0-9]*" type="password"/></div>
  ```

### שדה 74 · `input.ac`
- **איפה:** כרטיס הזמנה (הזמנה ×44) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שדה 73
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim2"><input aria-label="ספרה 4" autocomplete="off" class="ac" data-i="3" inputmode="numeric" maxlength="1" pattern="[0-9]*" type="password"/></div>
  ```

### שדה 75 · `div.amgr`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ש שרה לוי · מנהלת
- **וריאנטים (אותו בורר):** שדה 19
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim2"><div class="amgr"><span class="av">ש</span><b>שרה לוי · מנהלת</b><span class="amck"><svg class="ic sm ia-check ia-h" style="--ia-dl: 40ms;"><use href="#i-check"></use></svg></span></div></div>
  ```

<a id="banner"></a>
## באנרים והתראות (באנר N)

### באנר 1 · `div.nb-w`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ההזמנה נשמרה חזרתם לעמוד הבית אחרי
- **וריאנטים (אותו בורר):** באנר 35
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 95 `ia-tick`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-w"><section aria-labelledby="nb1t" aria-live="polite" class="nb nb-success" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>חזרתם לעמוד הבית אחרי שמירה</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 2 · `div.nb-w.out`
- **איפה:** דף הבית (בית ×1) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ההזמנה נשמרה חזרתם לעמוד הבית אחרי
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 95 `ia-tick`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-w"><section aria-labelledby="nb1t" aria-live="polite" class="nb nb-success" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>חזרתם לעמוד הבית אחרי שמירה</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 3 · `section.nb.nb-success.open`
- **איפה:** דף הבית (בית ×1) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ההזמנה נשמרה חזרתם לעמוד הבית אחרי
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 95 `ia-tick`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <section aria-labelledby="nb1t" aria-live="polite" class="nb nb-success open" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>חזרתם לעמוד הבית אחרי שמירה</span></div><button aria-label="סגור" class="nb-x" data-ico="x" data-tip="סגור" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 4 · `div.in.nb-w`
- **איפה:** דף הבית (בית ×1) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ההזמנה נשמרה חזרתם לעמוד הבית אחרי
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-w in"><section aria-labelledby="nb1t" aria-live="polite" class="nb nb-success" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>חזרתם לעמוד הבית אחרי שמירה</span></div><button aria-label="סגור" class="nb-x" data-tip="סגור" type="button"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 8 · `span.nf-cnt`
- **איפה:** בית · הזמנה (בית ×89 · הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 חדשות
- **שלד HTML:**
  ```html
  <div class="nf-w"><div class="sn-ph"><span class="nf-cnt">3 חדשות</span></div></div>
  ```

### באנר 17 · `span.m.nf-ic`
- **איפה:** בית · הזמנה (בית ×45 · הזמנה ×18) · **עור:** `gm-ds` (עור הבסיס)
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row unread"><span class="nf-ic m"><svg class="ic ia-wallet ia-h"><use href="#i-wallet"></use></svg></span></div></div>
  ```

### באנר 18 · `div.nf-empty`
- **איפה:** בית · הזמנה (בית ×89 · הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אין התראות חדשות
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="nf-empty"><svg class="ic ia-bell ia-h"><use href="#i-bell"></use></svg><span>אין התראות חדשות</span></div>
  ```

### באנר 19 · `button.nf-more`
- **איפה:** בית · הזמנה (בית ×89 · הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הצג עוד 0
- **שלד HTML:**
  ```html
  <button class="nf-more" data-nf-more="" type="button">הצג עוד 0</button>
  ```

### באנר 20 · `span.nf-chip`
- **איפה:** בית · הזמנה (בית ×18 · הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 0
- **שלד HTML:**
  ```html
  <div class="sn-acc"><span class="nf-chip">0</span></div>
  ```

### באנר 22 · `div.nb-head`
- **איפה:** בית · הזמנה (בית ×5 · הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ההזמנה נשמרה כל השינויים נקלטו במע
- **וריאנטים (אותו בורר):** באנר 85
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><section class="nb nb-success"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>כל השינויים נקלטו במערכת</span></div><button aria-label="סגור" class="nb-x" data-tip="סגור" type="button"><svg class="ic"><use href="#i-x"></use></svg></button></div></section></div>
  ```

### באנר 25 · `button.nb-x`
- **איפה:** בית · הזמנה (בית ×5 · הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 177
- **טולטיפים:** "סגור" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="nb-area"><section class="nb nb-info"><button aria-label="סגור" class="nb-x" data-tip="סגור" type="button"><svg class="ic"><use href="#i-x"></use></svg></button></section></div>
  ```

### באנר 29 · `div.nb-bw`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה 48131 נשמרה נשמר עכשיו עבור
- **וריאנטים (אותו בורר):** באנר 200
- **שלד HTML:**
  ```html
  <div class="nb-area"><section class="nb nb-success"><div class="nb-bw"><div class="nb-body"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>הזמנה 48131 נשמרה</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר עכשיו</span></div><button class="nb-go" type="button">עבור להזמנה</button></div></div></div></section></div>
  ```

### באנר 30 · `div.nb-body`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה 48131 נשמרה נשמר עכשיו עבור
- **וריאנטים (אותו בורר):** באנר 205
- **שלד HTML:**
  ```html
  <div class="nb-area"><section class="nb nb-success"><div class="nb-body"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>הזמנה 48131 נשמרה</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר עכשיו</span></div><button class="nb-go" type="button">עבור להזמנה</button></div></div></section></div>
  ```

### באנר 31 · `div.nb-bi`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה 48131 נשמרה נשמר עכשיו עבור
- **וריאנטים (אותו בורר):** באנר 210
- **שלד HTML:**
  ```html
  <div class="nb-area"><section class="nb nb-success"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>הזמנה 48131 נשמרה</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר עכשיו</span></div><button class="nb-go" type="button">עבור להזמנה</button></div></section></div>
  ```

### באנר 32 · `div.nb-r`
- **איפה:** בית · הזמנה (בית ×10 · הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 פריטים עודכנו
- **וריאנטים (אותו בורר):** באנר 99
- **שלד HTML:**
  ```html
  <section class="nb nb-success"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>3 פריטים עודכנו</span></div></section>
  ```

### באנר 33 · `button.nb-go`
- **איפה:** בית · הזמנה (בית ×5 · הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עבור להזמנה
- **שלד HTML:**
  ```html
  <section class="nb nb-warning"><button class="nb-go" type="button">עבור להזמנה</button></section>
  ```

### באנר 34 · `div.multi.nb-area`
- **איפה:** כרטיס הזמנה (הזמנה ×1) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עודכן מלאי דגם 4512 חזר מהניקיון ו
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`, הנפשה 95 `ia-tick`, הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div aria-label="התראות" class="nb-area multi"><div class="nb-w in"><section aria-labelledby="nb1t" aria-live="polite" class="nb nb-info" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-info ia-h"><use href="#i-info"></use></svg></span><div class="nb-msg"><b>עודכן מלאי</b><span>דגם 4512 חזר מהניקיון וזמין להשכרה</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 35 · `div.nb-w`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חסר ת״ז ללקוח נדרש להשלמת ההזמנה ל
- **וריאנטים (אותו בורר):** באנר 1
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 80 `ia-nod`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-w"><section aria-labelledby="nb2t" aria-live="polite" class="nb nb-warning" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-alert ia-h"><use href="#i-alert"></use></svg></span><div class="nb-msg"><b>חסר ת״ז ללקוח</b><span>נדרש להשלמת ההזמנה לפני איסוף השמלות</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 38 · `div.nb-menu.on`
- **איפה:** כרטיס הזמנה (הזמנה ×1) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הודעת מידע אזהרה: חסר ת״ז הצלחה הת
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 91 `ia-spinx`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div aria-label="הדגמות התראה" class="nb-menu on" role="menu" style="top: 160px; left: 76px;"><button class="nb-mi" data-ico="info" data-nb="info" role="menuitem" type="button"><svg class="ic ia-info ia-h"><use href="#i-info"></use></svg><span>הודעת מידע</span></button><button class="nb-mi" data-ico="alert" data-nb="warning" role="menuitem" type="button"><svg class="ic ia-alert ia-h"><use href="#i-alert"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 42 · `button.nf-ring.sn-ib`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 4
- **טולטיפים:** טולטיפ 2 "התראות"
- **הנפשות:** הנפשה 82 `ia-ring`, הנפשה 110 `nf-ring`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" aria-label="התראות · 4 חדשות" class="sn-ib nf-ring" data-ico="bell" data-tip="התראות" type="button"><svg class="ic ia-bell ia-h" style="--ia-dl: 0ms;"><use href="#i-bell"></use></svg><span class="sn-badge nf-pop">4</span></button></div>
  ```

### באנר 46 · `button.nb-mi`
- **איפה:** כרטיס הזמנה (הזמנה ×40) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הודעת מידע
- **וריאנטים (אותו בורר):** באנר 158
- **הנפשות:** הנפשה 81 `ia-pulse`
- **שלד HTML:**
  ```html
  <div class="nb-menu"><button class="nb-mi" data-ico="info" data-nb="info" role="menuitem" type="button"><svg class="ic ia-info ia-h" style="--ia-dl: 0ms;"><use href="#i-info"></use></svg><span>הודעת מידע</span></button></div>
  ```

### באנר 49 · `div.nb-main`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עודכן מלאי דגם 4512 חזר מהניקיון ו
- **וריאנטים (אותו בורר):** באנר 167
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w in"><section class="nb nb-info"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic"><use href="#i-info"></use></svg></span><div class="nb-msg"><b>עודכן מלאי</b><span>דגם 4512 חזר מהניקיון וזמין להשכרה</span></div><button aria-label="סגור" class="nb-x" data-tip="סגור" type="button"><svg class="ic"><use href="#i-x"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 51 · `span.nb-ic`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 175
- **הנפשות:** הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area"><section class="nb nb-info"><span aria-hidden="true" class="nb-ic"><svg class="ic"><use href="#i-info"></use></svg></span></section></div>
  ```

### באנר 56 · `div.nf-w`
- **איפה:** דף הבית (בית ×89) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** התראות סמן הכל כנקרא ניקוי השכרה ש
- **וריאנטים (אותו בורר):** באנר 58, באנר 114
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 12:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt"></span></div><div class="nf-tools"><button data-nf-all="" disabled="" type="button">סמן הכל כנקרא</button><button data-nf-clear="" type="button">ניקוי</button></div><div aria-label="רשימת התראות" class="nf-list" role="group"><div class="nf-row" data-nf="3" role="menuitem" style="height: 86px;" tabindex="-1"><span class="nf-ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 58 · `div.nf-w`
- **איפה:** בית · הזמנה (בית ×89 · הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** התראות סמן הכל כנקרא ניקוי אין התר
- **וריאנטים (אותו בורר):** באנר 56, באנר 114
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt"></span></div><div class="nf-tools"><button data-nf-all="" disabled="" type="button">סמן הכל כנקרא</button><button data-nf-clear="" type="button">ניקוי</button></div><div aria-label="רשימת התראות" class="nf-list" role="group"></div><div class="nf-empty"><svg class="ic ia-bell ia-h" style="--ia-dl: 400ms;"><use href="#i-bell"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 66 · `span.nf-ic`
- **איפה:** בית · הזמנה (בית ×92 · הזמנה ×54) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 123
- **הנפשות:** הנפשה 86 `ia-snip`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row unread"><span class="nf-ic"><svg class="ic ia-scissors ia-h"><use href="#i-scissors"></use></svg></span></div></div>
  ```

### באנר 85 · `div.nb-head`
- **איפה:** בית · הזמנה (בית ×5 · הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ההזמנה נשמרה כל השינויים נקלטו במע
- **וריאנטים (אותו בורר):** באנר 22
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w in out"><section class="nb nb-success"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>כל השינויים נקלטו במערכת</span></div><button aria-label="סגור" class="nb-x" data-ico="x" data-tip="סגור" type="button"><svg class="ic ia-x ia-h ia-ov"><use href="#i-x"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 90 · `div.nb-acts`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** פחות פרטים +-1
- **וריאנטים (אותו בורר):** באנר 178
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w out"><section class="nb nb-success open"><div class="nb-acts"><button aria-controls="nb1b" aria-expanded="true" class="nb-more" data-ico="chev" type="button"><span>פחות פרטים</span><svg class="ic ia-chev ia-h ia-ov" style="--ia-dl: 0ms;"><use href="#i-chev"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 99 · `div.nb-r`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה 48131 נשמרה
- **וריאנטים (אותו בורר):** באנר 32
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <section class="nb nb-success"><div class="nb-r"><i><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></i><span>הזמנה 48131 נשמרה</span></div></section>
  ```

### באנר 105 · `div.nf-row`
- **איפה:** דף הבית (בית ×6) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** תיקון הושלם - שמלה 214 לפני 3 שעות
- **וריאנטים (אותו בורר):** באנר 116, באנר 221
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 12:15" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row" data-nf="1" role="menuitem" tabindex="-1"><span class="nf-ic"><svg class="ic ia-scissors ia-h" style="--ia-dl: 280ms;"><use href="#i-scissors"></use></svg></span><div class="nf-b"><b>תיקון הושלם - שמלה 214</b><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 12:15" data-ts="1790586958869">לפני 3 שעות</time> · שרה כהן</small></div><div class="nf-a"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 106 · `div.nf-row.out`
- **איפה:** דף הבית (בית ×20) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** השכרה של שרה לוי חוזרת מחר לפני 13
- **וריאנטים (אותו בורר):** באנר 227
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row" data-nf="3" role="menuitem" style="height: 0px;" tabindex="-1"><span class="nf-ic"><svg class="ic ia-truck ia-h" style="--ia-dl: 40ms;"><use href="#i-truck"></use></svg></span><div class="nf-b"><b>השכרה של שרה לוי חוזרת מחר</b><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 15:06" data-ts="1790597202063">לפני 13 דקות</time> · שרה כהן</small></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 113 · `div.nb-area`
- **איפה:** כרטיס הזמנה (הזמנה ×3) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עודכן מלאי דגם 4512 חזר מהניקיון ו
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`, הנפשה 95 `ia-tick`, הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div aria-label="התראות" class="nb-area"><div class="nb-w"><section aria-labelledby="nb1t" aria-live="polite" class="nb nb-info" role="status"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-info ia-h"><use href="#i-info"></use></svg></span><div class="nb-msg"><b>עודכן מלאי</b><span>דגם 4512 חזר מהניקיון וזמין להשכרה</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 114 · `div.nf-w`
- **איפה:** כרטיס הזמנה (הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** התראות סמן הכל כנקרא ניקוי חסרה כת
- **וריאנטים (אותו בורר):** באנר 56, באנר 58
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 12:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:18" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt"></span></div><div class="nf-tools"><button data-nf-all="" disabled="" type="button">סמן הכל כנקרא</button><button data-nf-clear="" type="button">ניקוי</button></div><div aria-label="רשימת התראות" class="nf-list" role="group"><div class="nf-row" data-nf="4" role="menuitem" style="height: 86px;" tabindex="-1"><span class="nf-ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 115 · `div.nb-menu`
- **איפה:** כרטיס הזמנה (הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הודעת מידע אזהרה: חסר ת״ז הצלחה הת
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 91 `ia-spinx`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div aria-label="הדגמות התראה" class="nb-menu" role="menu" style="top: 160px; left: 76px;"><button class="nb-mi" data-ico="info" data-nb="info" role="menuitem" type="button"><svg class="ic ia-info ia-h" style="--ia-dl: 0ms;"><use href="#i-info"></use></svg><span>הודעת מידע</span></button><button class="nb-mi" data-ico="alert" data-nb="warning" role="menuitem" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 116 · `div.nf-row`
- **איפה:** כרטיס הזמנה (הזמנה ×8) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חסרה כתובת מייל ללקוחה הזמנה #5337
- **וריאנטים (אותו בורר):** באנר 105, באנר 221
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:13" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="sn-drawer open"><div class="nf-list"><div class="nf-row" data-nf="4" role="menuitem" tabindex="-1"><span class="nf-ic"><svg class="ic ia-alert ia-h" style="--ia-dl: 120ms;"><use href="#i-alert"></use></svg></span><div class="nf-b"><b>חסרה כתובת מייל ללקוחה</b><small>הזמנה #53375 · נדרש להשלמה לפני איסוף</small><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 15:13" data-ts="1790597593259"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 122 · `div.nf-row.unread`
- **איפה:** כרטיס הזמנה (הזמנה ×34) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תיקון הושלם - שמלה 214 לפני 3 שעות
- **וריאנטים (אותו בורר):** באנר 164
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 12:15" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row unread" data-nf="1" role="menuitem" tabindex="-1"><span class="nf-ic"><svg class="ic ia-scissors ia-h"><use href="#i-scissors"></use></svg></span><div class="nf-b"><b>תיקון הושלם - שמלה 214</b><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 12:15" data-ts="1790586953269">לפני 3 שעות</time> · שרה כהן</small></div><div class="nf-a"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 123 · `span.nf-ic`
- **איפה:** כרטיס הזמנה (הזמנה ×54) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 66
- **הנפשות:** הנפשה 109 `nf-in`
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row nf-new unread"><span class="nf-ic"><svg class="ic"><use href="#i-alert"></use></svg></span></div></div>
  ```

### באנר 147 · `div.nf-a`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 148
- **טולטיפים:** "הסרה" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="nf-a"><button aria-label="כניסה להזמנה" class="nf-go" data-ico="ext" data-nf-go="" data-tip="כניסה להזמנה" type="button"><svg class="ic ia-ext ia-h"><use href="#i-ext"></use></svg></button><button aria-label="הסרת ההתראה" class="nf-x" data-ico="x" data-nf-x="" data-tip="הסרה" type="button"><svg class="ic ia-x ia-h"><use href="#i-x"></use></svg></button></div>
  ```

### באנר 148 · `div.nf-a`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 147
- **טולטיפים:** "הסרה" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="nf-a"><button aria-label="כניסה להזמנה" class="nf-go" data-nf-go="" data-tip="כניסה להזמנה" type="button"><svg class="ic"><use href="#i-ext"></use></svg></button><button aria-label="הסרת ההתראה" class="nf-x" data-nf-x="" data-tip="הסרה" type="button"><svg class="ic"><use href="#i-x"></use></svg></button></div>
  ```

### באנר 149 · `button.nf-go`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 150
- **טולטיפים:** "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`
- **שלד HTML:**
  ```html
  <button aria-label="כניסה להזמנה" class="nf-go" data-ico="ext" data-nf-go="" data-tip="כניסה להזמנה" type="button"><svg class="ic ia-ext ia-h"><use href="#i-ext"></use></svg></button>
  ```

### באנר 150 · `button.nf-go`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 149
- **טולטיפים:** "כניסה להזמנה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <button aria-label="כניסה להזמנה" class="nf-go" data-nf-go="" data-tip="כניסה להזמנה" type="button"><svg class="ic"><use href="#i-ext"></use></svg></button>
  ```

### באנר 151 · `button.nf-x`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 152
- **טולטיפים:** "הסרה" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <button aria-label="הסרת ההתראה" class="nf-x" data-ico="x" data-nf-x="" data-tip="הסרה" type="button"><svg class="ic ia-x ia-h"><use href="#i-x"></use></svg></button>
  ```

### באנר 152 · `button.nf-x`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 151
- **טולטיפים:** "הסרה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <button aria-label="הסרת ההתראה" class="nf-x" data-nf-x="" data-tip="הסרה" type="button"><svg class="ic"><use href="#i-x"></use></svg></button>
  ```

### באנר 158 · `button.nb-mi`
- **איפה:** כרטיס הזמנה (הזמנה ×40) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סגור הכל
- **וריאנטים (אותו בורר):** באנר 46
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="nb-menu"><button class="nb-mi" data-ico="x" data-nb="clear" role="menuitem" type="button"><svg class="ic ia-x ia-h"><use href="#i-x"></use></svg><span>סגור הכל</span></button></div>
  ```

### באנר 160 · `button.nb-mi.sep`
- **איפה:** כרטיס הזמנה (הזמנה ×8) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוסף התראה נוספת
- **וריאנטים (אותו בורר):** באנר 161
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`
- **שלד HTML:**
  ```html
  <div class="nb-menu"><button class="nb-mi sep" data-ico="plus" data-nb="add" role="menuitem" type="button"><svg class="ic ia-plus ia-h" style="--ia-dl: 160ms;"><use href="#i-plus"></use></svg><span>הוסף התראה נוספת</span></button></div>
  ```

### באנר 161 · `button.nb-mi.sep`
- **איפה:** כרטיס הזמנה (הזמנה ×8) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוסף התראה נוספת (מקסימום 3)
- **וריאנטים (אותו בורר):** באנר 160
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`
- **שלד HTML:**
  ```html
  <div class="nb-menu"><button class="nb-mi sep" data-ico="plus" data-nb="add" disabled="" role="menuitem" type="button"><svg class="ic ia-plus ia-h" style="--ia-dl: 160ms;"><use href="#i-plus"></use></svg><span>הוסף התראה נוספת (מקסימום 3)</span></button></div>
  ```

### באנר 164 · `div.nf-row.unread`
- **איפה:** כרטיס הזמנה (הזמנה ×4) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חסרה כתובת מייל ללקוחה הזמנה #5337
- **וריאנטים (אותו בורר):** באנר 122
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:13" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="nf-list"><div class="nf-row unread" data-nf="4" role="menuitem" tabindex="-1"><span class="nf-ic"><svg class="ic"><use href="#i-alert"></use></svg></span><div class="nf-b"><b>חסרה כתובת מייל ללקוחה</b><small>הזמנה #53375 · נדרש להשלמה לפני איסוף</small><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 15:13" data-ts="1790597593259">הרגע</time> · דנה אברהם</small></div><div class="nf-a"> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 167 · `div.nb-main`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ההזמנה נשמרה כל השינויים נקלטו במע
- **וריאנטים (אותו בורר):** באנר 49
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 107 `nb-in`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><div class="nb-w in"><section class="nb nb-success"><div class="nb-main"><div class="nb-head"><span aria-hidden="true" class="nb-ic"><svg class="ic"><use href="#i-check"></use></svg></span><div class="nb-msg"><b>ההזמנה נשמרה</b><span>כל השינויים נקלטו במערכת</span></div><button aria-label="סגור" class="nb-x" data-tip="סגור" type="button"><svg class="ic"><use href="#i-x"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 175 · `span.nb-ic`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 51
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 108 `nb-wig`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w out"><section class="nb nb-info"><span aria-hidden="true" class="nb-ic"><svg class="ic ia-info ia-h"><use href="#i-info"></use></svg></span></section></div></div>
  ```

### באנר 177 · `button.nb-x`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** באנר 25
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 107 `nb-in`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w in out"><section class="nb nb-success"><button aria-label="סגור" class="nb-x" data-ico="x" data-tip="סגור" type="button"><svg class="ic ia-x ia-h"><use href="#i-x"></use></svg></button></section></div></div>
  ```

### באנר 178 · `div.nb-acts`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים נוספים +1
- **וריאנטים (אותו בורר):** באנר 90
- **הנפשות:** הנפשה 107 `nb-in`
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><div class="nb-w in"><section class="nb nb-warning"><div class="nb-acts"><button aria-controls="nb2b" aria-expanded="false" class="nb-more" type="button"><span>פרטים נוספים</span><svg class="ic"><use href="#i-chev"></use></svg></button><button aria-expanded="true" aria-label="התראה נוספת" class="nb-chip" type="button"><span>+1</span><svg class="ic"><use href="#i-chev"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 186 · `button.nb-more`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים נוספים
- **וריאנטים (אותו בורר):** באנר 191
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><section class="nb nb-warning"><button aria-controls="nb2b" aria-expanded="false" class="nb-more" type="button"><span>פרטים נוספים</span><svg class="ic"><use href="#i-chev"></use></svg></button></section></div>
  ```

### באנר 191 · `button.nb-more`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פרטים נוספים
- **וריאנטים (אותו בורר):** באנר 186
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="nb-area"><div class="nb-w out"><section class="nb nb-success"><button aria-controls="nb3b" aria-expanded="false" class="nb-more" data-ico="chev" type="button"><span>פרטים נוספים</span><svg class="ic ia-chev ia-h" style="--ia-dl: 0ms;"><use href="#i-chev"></use></svg></button></section></div></div>
  ```

### באנר 192 · `button.nb-chip`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** +1
- **וריאנטים (אותו בורר):** באנר 193
- **הנפשות:** הנפשה 107 `nb-in`
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><div class="nb-w in"><section class="nb nb-warning"><button aria-expanded="true" aria-label="התראה נוספת" class="nb-chip" type="button"><span>+1</span><svg class="ic"><use href="#i-chev"></use></svg></button></section></div></div>
  ```

### באנר 193 · `button.nb-chip`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** +1
- **וריאנטים (אותו בורר):** באנר 192
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 107 `nb-in`
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><div class="nb-w in"><section class="nb nb-info"><button aria-expanded="true" aria-label="התראה נוספת" class="nb-chip" data-ico="chev" type="button"><span>+1</span><svg class="ic ia-chev ia-h ia-ov" style="--ia-dl: 40ms;"><use href="#i-chev"></use></svg></button></section></div></div>
  ```

### באנר 200 · `div.nb-bw`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 פריטים עודכנו נשמר היום בשעה 10:
- **וריאנטים (אותו בורר):** באנר 29
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><section class="nb nb-success"><div class="nb-bw"><div class="nb-body"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>3 פריטים עודכנו</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר היום בשעה 10:35</span></div></div></div></div></section></div>
  ```

### באנר 205 · `div.nb-body`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 פריטים עודכנו נשמר היום בשעה 10:
- **וריאנטים (אותו בורר):** באנר 30
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><section class="nb nb-success"><div class="nb-body"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>3 פריטים עודכנו</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר היום בשעה 10:35</span></div></div></div></section></div>
  ```

### באנר 210 · `div.nb-bi`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 פריטים עודכנו נשמר היום בשעה 10:
- **וריאנטים (אותו בורר):** באנר 31
- **שלד HTML:**
  ```html
  <div class="nb-area multi"><section class="nb nb-success"><div class="nb-bi"><div class="nb-r"><i><svg class="ic"><use href="#i-check"></use></svg></i><span>3 פריטים עודכנו</span></div><div class="nb-r"><i><svg class="ic"><use href="#i-clock"></use></svg></i><span>נשמר היום בשעה 10:35</span></div></div></section></div>
  ```

### באנר 221 · `div.nf-row`
- **איפה:** כרטיס הזמנה (הזמנה ×8) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** השכרה של שרה לוי חוזרת מחר לפני 14
- **וריאנטים (אותו בורר):** באנר 105, באנר 116
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:00" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="sn-drawer open"><div class="nf-list"><div class="nf-row" data-nf="3" role="menuitem" tabindex="-1"><span class="nf-ic"><svg class="ic ia-truck ia-h" style="--ia-dl: 240ms;"><use href="#i-truck"></use></svg></span><div class="nf-b"><b>השכרה של שרה לוי חוזרת מחר</b><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 15:00" data-ts="1790596858160">לפני 14 דקות</time> · שרה כהן</small></div> … (המשך ב-index.html, "העתק HTML")
  ```

### באנר 227 · `div.nf-row.out`
- **איפה:** כרטיס הזמנה (הזמנה ×26) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** השכרה של שרה לוי חוזרת מחר לפני 14
- **וריאנטים (אותו בורר):** באנר 106
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:00" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="sn-drawer open"><div class="nf-list"><div class="nf-row" data-nf="3" role="menuitem" style="height: 86px;" tabindex="-1"><span class="nf-ic"><svg class="ic ia-truck ia-h" style="--ia-dl: 240ms;"><use href="#i-truck"></use></svg></span><div class="nf-b"><b>השכרה של שרה לוי חוזרת מחר</b><small class="nf-t"><time data-tip="יום שני י״ז תשרי תשפ״ז · 15:00" data-ts="1790596858160">לפני 14 דקות</time> … (המשך ב-index.html, "העתק HTML")
  ```

<a id="toast"></a>
## טוסט (טוסט N)

### טוסט 1 · `div.info`
- **איפה:** דף הבית (בית ×1) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** נכנסת להזמנה #53375
- **וריאנטים (אותו בורר):** טוסט 6
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 118 `pulse`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="info pulse" data-kind="info" id="toast" role="status" style="--tdur: 2600ms;"><button aria-label="סגירה" class="tclose" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h ia-ov"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg ia-info ia-h"><use href="#i-info"></use></svg></div><div><b>נכנסת להזמנה #53375</b><small></small></div></div>
  ```

### טוסט 2 · `div.info.on`
- **איפה:** בית · הזמנה (בית ×4 · הזמנה ×56) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קובץ Excel של ההזמנה יורד (הדגמה)
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 42 `draw`, הנפשה 118 `pulse`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="info on pulse" data-kind="info" id="toast" role="status" style="--tdur: 2600ms;"><button aria-label="סגירה" class="tclose" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg"><use href="#i-info"></use></svg></div><div><b>קובץ Excel של ההזמנה יורד</b><small>(הדגמה)</small></div></div>
  ```

### טוסט 3 · `div.charge`
- **איפה:** כרטיס הזמנה (הזמנה ×8) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חיוב ממתין ₪120 לשמירה
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 91 `ia-spinx`, הנפשה 103 `icnpop`, הנפשה 118 `pulse`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="charge pulse" data-kind="charge" id="toast" role="status" style="--tdur: 6500ms;"><button aria-label="סגירה" class="tclose" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h ia-ov" style="--ia-dl: 0ms;"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg ia-plus ia-h"><use href="#i-plus"></use></svg></div><div><b>חיוב ממתין <bdi dir="ltr"> … (המשך ב-index.html, "העתק HTML")
  ```

### טוסט 4 · `div.charge.on`
- **איפה:** כרטיס הזמנה (הזמנה ×10) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חיוב ממתין ₪120 לשמירה
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 42 `draw`, הנפשה 103 `icnpop`, הנפשה 118 `pulse`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="charge on pulse" data-kind="charge" id="toast" role="status" style="--tdur: 6500ms;"><button aria-label="סגירה" class="tclose" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg"><use href="#i-plus"></use></svg></div><div><b>חיוב ממתין <bdi dir="ltr">₪120</bdi></b><small></small></div><button class="tbtn"> … (המשך ב-index.html, "העתק HTML")
  ```

### טוסט 5 · `div.credit.on`
- **איפה:** כרטיס הזמנה (הזמנה ×4) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** זיכוי ממתין ₪80 לשמירה
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 42 `draw`, הנפשה 103 `icnpop`, הנפשה 118 `pulse`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="credit on pulse" data-kind="credit" id="toast" role="status" style="--tdur: 6500ms;"><button aria-label="סגירה" class="tclose" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg"><use href="#i-undo"></use></svg></div><div><b>זיכוי ממתין <bdi dir="ltr">₪80</bdi></b><small></small></div><button class="tbtn"> … (המשך ב-index.html, "העתק HTML")
  ```

### טוסט 6 · `div.info`
- **איפה:** כרטיס הזמנה (הזמנה ×19) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** האישור בוטל
- **וריאנטים (אותו בורר):** טוסט 1
- **טולטיפים:** "סגור" (לא ממוספר)
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 118 `pulse`
- **שלד HTML:**
  ```html
  <div aria-live="polite" class="info pulse" data-kind="info" id="toast" role="status" style="--tdur: 2600ms;"><button aria-label="סגירה" class="tclose" data-ico="x" data-tip="סגור" type="button"><svg class="ic sm ia-x ia-h" style="--ia-dl: 0ms;"><use href="#i-x"></use></svg></button><div class="tb"><svg class="ic lg ia-info ia-h"><use href="#i-info"></use></svg></div><div><b>האישור בוטל</b><small></small></div></div>
  ```

<a id="tip"></a>
## טולטיפים ורמזים (טולטיפ N)

### טולטיפים (data-tip) — הטקסט האמיתי ועל איזה אלמנט

| מס׳ | טקסט | אלמנט |
|---|---|---|
| טולטיפ 1 | חיפוש עמוד, הזמנה או לקוח | `button.sn-ib` |
| טולטיפ 2 | התראות | `button.sn-ib` |
| טולטיפ 3 | לא מחוברת · אורחת | `button.sn-user` |
| טולטיפ 4 | חיפוש | `button.btn.primary` |
| טולטיפ 5 | משמרת נוכחית · שעות מתחילת הכניסה | `span.sn-clock` |
| טולטיפ 6 | שרה כהן · עובדת | `button.sn-user` |
| טולטיפ 7 | חזרה לרשימה | `button.back` |
| טולטיפ 8 | ייצוא ההזמנה לקובץ Excel | `button.xlbtn.xlg` |
| טולטיפ 9 | הורדת סיכום ההזמנה כקובץ | `button.xlbtn.xld` |
| טולטיפ 10 | הדפסה / מייל | `button.xlbtn.xlp` |
| טולטיפ 11 | מחיקת הזמנה | `button.xlbtn.xld` |
| טולטיפ 12 | חסר: מייל, כתובת | `span.tabmk.debt` |
| טולטיפ 13 | משלוח הוזמן | `span.tabmk.ok` |
| טולטיפ 14 | החלפת לקוח | `button.ibtn` |
| טולטיפ 15 | פתיחת כרטיס לקוח | `button.ibtn` |
| טולטיפ 16 | עריכת תאריך | `button.ibtn` |
| טולטיפ 17 | טווח תאריכים חופשי | `button.tip` |
| טולטיפ 18 | מוצג ברשימה ומודפס פעם אחת | `button.tip` |

### רמזים עשירים (data-rich) — כרטיסי ציר הזמן והעגלה

| מס׳ | data-rich | אלמנט |
|---|---|---|
| רמז עשיר 1 | `data-rich="tl|order"` | `div.tx.done.hasnow` |
| רמז עשיר 2 | `data-rich="tl|now"` | `button.tip.pinm` |
| רמז עשיר 3 | `data-rich="tl|dout"` | `div.tx.fut` |
| רמז עשיר 4 | `data-rich="tl|event"` | `div.tx.fut` |
| רמז עשיר 6 | `data-rich="del"` | `span.gl.del` |
| רמז עשיר 7 | `data-rich="items"` | `span.gl.itm-c` |
| רמז עשיר 8 | `data-rich="pay"` | `span.gl.pay.ok` |
| רמז עשיר 10 | `data-rich="sig"` | `button.gl.sig.no` |

<a id="dialog"></a>
## חלונות קופצים (חלון N)

### חלון 2 · `div.dlg.mailwin`
- **איפה:** כרטיס הזמנה (הזמנה ×24) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר נמען מרים אברמוביץ חסר מ
- **טולטיפים:** "סגור" (לא ממוספר), "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div aria-labelledby="mail-t" aria-modal="true" class="dlg mailwin" id="dlg" role="dialog"><div class="mh"><span class="mico" style="--rph: -0.09999999403953552ms;"><svg class="ic lg" style="animation-delay: -0.1ms;"><use href="#i-mail"></use></svg></span><h2>מייל מהיר</h2><button aria-label="סגירה" class="ibtn mx" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button></div> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 5 · `div.success`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ההזמנה נשמרה הזמנה #53375 · מרים א
- **וריאנטים (אותו בורר):** חלון 14
- **הנפשות:** הנפשה 29 `dk-breathe`, הנפשה 38 `dlgPop`, הנפשה 42 `draw`, הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dlg" id="dlg"><div class="success"><div class="big-ck" style="--rph: 0ms;"><svg class="ic" viewbox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"></path></svg></div><h2>ההזמנה נשמרה</h2><div class="sub" style="margin-bottom:0">הזמנה <bdi>#53375</bdi> · מרים אברמוביץ</div><div style="height:24px"></div><div class="dbtns"><button class="btn primary lg block"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 7 · `div.big-ck`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס)
- **הנפשות:** הנפשה 29 `dk-breathe`, הנפשה 38 `dlgPop`, הנפשה 42 `draw`, הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="success"><div class="big-ck" style="--rph: 0ms;"><svg class="ic" viewbox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"></path></svg></div></div></div>
  ```

### חלון 9 · `div.scrim`
- **איפה:** כרטיס הזמנה (הזמנה ×56) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר נמען מרים אברמוביץ חסר מ
- **וריאנטים (אותו בורר):** חלון 12
- **טולטיפים:** "סגור" (לא ממוספר), "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 60 `ia-blink`, הנפשה 65 `ia-clipw`, הנפשה 66 `ia-draw`, הנפשה 75 `ia-lift`, הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 83 `ia-send`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 99 `ia-wave`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div aria-labelledby="mail-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div class="mh"><span class="mico ia-bg" style="--rph: -0.10000000894069672ms;"><svg class="ic lg ia-mail ia-h" style="animation-delay: -0.1ms; --ia-dl: 0ms;"><use href="#i-mail"></use></svg></span><h2>מייל מהיר</h2><button aria-label="סגירה" class="ibtn mx" data-ico="x" data-tip="סגור" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 10 · `div.on.scrim`
- **איפה:** כרטיס הזמנה (הזמנה ×24) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מייל מהיר נמען מרים אברמוביץ חסר מ
- **וריאנטים (אותו בורר):** חלון 15, חלון 27
- **טולטיפים:** "סגור" (לא ממוספר), "תצוגה" (לא ממוספר)
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-labelledby="mail-t" aria-modal="true" class="dlg mailwin" id="dlg" role="dialog"><div class="mh"><span class="mico" style="--rph: -0.10000000894069672ms;"><svg class="ic lg" style="animation-delay: -0.1ms;"><use href="#i-mail"></use></svg></span><h2>מייל מהיר</h2><button aria-label="סגירה" class="ibtn mx" data-tip="סגור" type="button"><svg class="ic sm"><use href="#i-x"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 12 · `div.scrim`
- **איפה:** כרטיס הזמנה (הזמנה ×56) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינויים שלא נשמרו הוסרה דגם 3087 ד
- **וריאנטים (אותו בורר):** חלון 9
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 66 `ia-draw`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 92 `ia-squash`, הנפשה 98 `ia-undo`, הנפשה 101 `ia-write`, הנפשה 103 `icnpop`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div aria-labelledby="mail-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div aria-hidden="true" class="dbadge" data-k="write" style="--rph: -2.0999999940395355ms;"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></div><h2>שינויים שלא נשמרו</h2><div class="chg"><div class="c"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 14 · `div.success`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ההזמנה נשמרה הזמנה #53375 · מרים א
- **וריאנטים (אותו בורר):** חלון 5
- **הנפשות:** הנפשה 29 `dk-breathe`, הנפשה 38 `dlgPop`, הנפשה 42 `draw`, הנפשה 75 `ia-lift`, הנפשה 77 `ia-nL`, הנפשה 85 `ia-slide`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 114 `pop`
- **שלד HTML:**
  ```html
  <div class="success"><div class="big-ck" style="--rph: -89.80000001192093ms;"><svg class="ic" viewbox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"></path></svg></div><h2>ההזמנה נשמרה</h2><div class="sub" style="margin-bottom:0">הזמנה <bdi>#53375</bdi> · מרים אברמוביץ</div><div style="height:24px"></div><div class="dbtns"><button class="btn primary lg block" data-ico="plus"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 15 · `div.on.scrim`
- **איפה:** כרטיס הזמנה (הזמנה ×24) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** זיכוי ₪80 איך לזכות? זיכוי לניצול
- **וריאנטים (אותו בורר):** חלון 10, חלון 27
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-labelledby="mail-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div aria-hidden="true" class="dbadge" data-k="coin" style="--rph: -0.10000000894069672ms;"><svg class="ic"><use href="#i-undo"></use></svg></div><h2>זיכוי <bdi dir="ltr">₪80</bdi></h2><div class="sub">איך לזכות?</div><div class="dbtns" style="margin-bottom:20px"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 18 · `div.dlg`
- **איפה:** כרטיס הזמנה (הזמנה ×82) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחיקת הזמנה אפשר לשחזר מפריטים מחו
- **וריאנטים (אותו בורר):** חלון 20
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-labelledby="dlg-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div aria-hidden="true" class="dbadge" data-k="lid" style="--rph: -1.1000000089406967ms;"><svg class="ic"><use href="#i-trash"></use></svg></div><h2>מחיקת הזמנה</h2><div class="sub">אפשר לשחזר מפריטים מחוקים.</div><div class="dbtns"><button class="btn primary lg block"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 20 · `div.dlg`
- **איפה:** כרטיס הזמנה (הזמנה ×82) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחיקת הזמנה אפשר לשחזר מפריטים מחו
- **וריאנטים (אותו בורר):** חלון 18
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 99 `ia-wave`, הנפשה 104 `icnshake`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div aria-labelledby="dlg-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div aria-hidden="true" class="dbadge" data-k="lid" style="--rph: -10.199999988079071ms;"><svg class="ic ia-trash ia-h"><use href="#i-trash"></use></svg></div><h2>מחיקת הזמנה</h2><div class="sub">אפשר לשחזר מפריטים מחוקים.</div><div class="dbtns"><button class="btn primary lg block" data-ico="trash"> … (המשך ב-index.html, "העתק HTML")
  ```

### חלון 24 · `div.dbadge`
- **איפה:** כרטיס הזמנה (הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** חלון 26
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-hidden="true" class="dbadge" data-k="write" style="--rph: -0.29999999701976776ms;"><svg class="ic"><use href="#i-card"></use></svg></div></div>
  ```

### חלון 26 · `div.dbadge`
- **איפה:** כרטיס הזמנה (הזמנה ×52) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** חלון 24
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-hidden="true" class="dbadge" data-k="tilt" style="--rph: -8.299999997019768ms;"><svg class="ic"><use href="#i-card"></use></svg></div></div>
  ```

### חלון 27 · `div.on.scrim`
- **איפה:** כרטיס הזמנה (הזמנה ×24) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחיקת הזמנה אפשר לשחזר מפריטים מחו
- **וריאנטים (אותו בורר):** חלון 10, חלון 15
- **הנפשות:** הנפשה 30 `dk-float`, הנפשה 36 `dlgDraw`, הנפשה 47 `fade`, הנפשה 48 `fadein`, הנפשה 114 `pop`, הנפשה 128 `ubPulse`, הנפשה 129 `ubShine`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div aria-labelledby="dlg-t" aria-modal="true" class="dlg" id="dlg" role="dialog"><div aria-hidden="true" class="dbadge" data-k="lid" style="--rph: -1.1000000089406967ms;"><svg class="ic"><use href="#i-trash"></use></svg></div><h2>מחיקת הזמנה</h2><div class="sub">אפשר לשחזר מפריטים מחוקים.</div><div class="dbtns"><button class="btn primary lg block"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

<a id="card"></a>
## כרטיסים ופריטים (כרטיס N)

### כרטיס 9 · `div.dhero`
- **איפה:** כרטיס הזמנה (הזמנה ×37) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה עם משלוח
- **וריאנטים (אותו בורר):** כרטיס 40
- **טולטיפים:** "משלוח אחד בלבד להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 81 `ia-pulse`
- **שלד HTML:**
  ```html
  <div class="dhero"><div class="ico"><svg class="ic lg ia-truck ia-h"><use href="#i-truck"></use></svg></div><div style="flex:1;min-width:0"><div class="trow"><label class="sw"><input aria-label="הזמנה עם משלוח" checked="" type="checkbox"/><i></i></label><b class="big">הזמנה עם משלוח</b><button aria-label="עזרה" class="tip" data-ico="info" data-tip="משלוח אחד בלבד להזמנה" type="button"><svg class="ic sm ia-info ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 11 · `div.f.miss`
- **איפה:** כרטיס הזמנה (הזמנה ×77) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ת״ז חסר
- **וריאנטים (אותו בורר):** כרטיס 30
- **הנפשות:** הנפשה 75 `ia-lift`, הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f miss"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg><div><small>ת״ז</small><span class="missv"><svg class="ic sm ia-alert ia-h"><use href="#i-alert"></use></svg>חסר</span></div></div></div></div>
  ```

### כרטיס 14 · `div.card.dfields`
- **איפה:** כרטיס הזמנה (הזמנה ×4) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** כיוון הלוך חזור הלוך-חזור
- **וריאנטים (אותו בורר):** כרטיס 24, כרטיס 41
- **הנפשות:** הנפשה 77 `ia-nL`, הנפשה 78 `ia-nR`, הנפשה 92 `ia-squash`
- **שלד HTML:**
  ```html
  <div class="card dfields shine-on"><div class="card-h"><div class="ico teal"><svg class="ic lg ia-arrlr ia-h"><use href="#i-arrlr"></use></svg></div><h2>כיוון</h2></div><div class="seg pill" id="dirSeg" role="radiogroup" style="--n:3;--i:2"><span aria-hidden="true" class="pth"></span><button aria-checked="false" class="" data-dir="there" data-ico="arrr" role="radio" type="button"><svg class="ic sm ia-arrr ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 18 · `div.card`
- **איפה:** דף הבית (בית ×45) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** צריך להתחבר כדי להמשיך כאן מופיע מ
- **וריאנטים (אותו בורר):** כרטיס 26, כרטיס 27
- **שלד HTML:**
  ```html
  <div class="card"><div class="empty" role="status"><svg class="ic lg"><use href="#i-lock"></use></svg><div class="big" style="font-size:19px;margin-top:8px;color:var(--ink)">צריך להתחבר כדי להמשיך</div><div class="muted">כאן מופיע מסך הכניסה של המערכת (מחוץ לתחום אב-הטיפוס). הארגון דורש כניסה, ולכן מי שלא מחובר לא רואה את העמוד.</div></div></div>
  ```

### כרטיס 19 · `div.empty`
- **איפה:** דף הבית (בית ×22) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הסיכום הכספי פתוח להנהלה ראשית בלב
- **וריאנטים (אותו בורר):** כרטיס 21
- **שלד HTML:**
  ```html
  <div class="empty" role="status"><svg class="ic lg"><use href="#i-lock"></use></svg><div class="big" style="font-size:19px;margin-top:8px;color:var(--ink)">הסיכום הכספי פתוח להנהלה ראשית בלבד</div><div class="muted">אם צריך גישה, פונים להנהלה.</div><div style="margin-top:16px"><button class="btn primary" type="button"><svg class="ic"><use href="#i-home"></use></svg>לעמוד הבית</button></div></div>
  ```

### כרטיס 21 · `div.empty`
- **איפה:** דף הבית (בית ×22) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** אין תוצאות לחיפוש הזה
- **וריאנטים (אותו בורר):** כרטיס 19
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="empty"><svg class="ic lg"><use href="#i-search"></use></svg><div>אין תוצאות לחיפוש הזה</div></div></div></div>
  ```

### כרטיס 22 · `div.card.items-card`
- **איפה:** כרטיס הזמנה (הזמנה ×40) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריטים הוסף פריט הוספת שמלה מספר ד
- **טולטיפים:** "טבלה" (לא ממוספר), "רשימה" (לא ממוספר)
- **הנפשות:** הנפשה 43 `dtPop`, הנפשה 44 `dtWig`
- **שלד HTML:**
  ```html
  <div class="card items-card"><div class="card-h"><div class="ico teal"><svg class="ic lg"><use href="#i-dress"></use></svg></div><h2>פריטים</h2><button class="btn navy"><svg class="ic"><use href="#i-plus"></use></svg>הוסף פריט</button></div><div class="addpanel"><div class="row spread"><b class="big" style="font-size:19px">הוספת שמלה</b><button class="ibtn" style="width:38px;height:38px"><svg class="ic sm"> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 23 · `div.card.cust`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לקוח מרים אברמוביץ טלפון 050-712-3
- **טולטיפים:** טולטיפ 14 "החלפת לקוח", טולטיפ 15 "פתיחת כרטיס לקוח"
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 68 `ia-drop`, הנפשה 75 `ia-lift`, הנפשה 79 `ia-nUR`, הנפשה 80 `ia-nod`, הנפשה 82 `ia-ring`, הנפשה 93 `ia-swap`, הנפשה 103 `icnpop`, הנפשה 105 `icoTilt`
- **שלד HTML:**
  ```html
  <div class="card cust shine-on"><div class="card-h"><div class="ico rose"><svg class="ic lg ia-user ia-h"><use href="#i-user"></use></svg></div><h2>לקוח</h2><button aria-label="החלפת לקוח" class="ibtn" data-ico="swap" data-msg="החלפת לקוח (הדגמה)" data-tip="החלפת לקוח"><svg class="ic ia-swap ia-h ia-ov"><use href="#i-swap"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 24 · `div.card.dfields`
- **איפה:** כרטיס הזמנה (הזמנה ×74) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** יעד עיר משלוח כתובת שונה ממגורים י
- **וריאנטים (אותו בורר):** כרטיס 14, כרטיס 41
- **טולטיפים:** "ברירת מחדל: יומיים לפני" (לא ממוספר), "ניקוי" (לא ממוספר), "רק אם שונה מכתובת הלקוח" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 68 `ia-drop`, הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 102 `icndrive`
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="card-h"><div class="ico teal"><svg class="ic lg ia-pin ia-h"><use href="#i-pin"></use></svg></div><h2>יעד</h2></div><div class="grid2"><div class="field"><label class="lbl" for="delCityIn">עיר משלוח</label><div class="inpw"><svg class="ic sm ia-pin ia-h"><use href="#i-pin"></use></svg><input autocomplete="off" class="inp" data-sug="city" placeholder="עיר..." value="ירושלים"/> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 25 · `div.addpanel.open`
- **איפה:** כרטיס הזמנה (הזמנה ×17) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוספת שמלה מספר דגם מידה 34 36 38
- **טולטיפים:** "ניקוי" (לא ממוספר), "סגירה" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <div class="addpanel open"><div class="row spread"><b class="big" style="font-size:19px">הוספת שמלה</b><button aria-label="סגירה" class="ibtn" data-ico="x" data-tip="סגירה" style="width:38px;height:38px"><svg class="ic sm ia-x ia-h ia-ov"><use href="#i-x"></use></svg></button></div><div class="grid2"><div class="field"><label class="lbl" for="addModel">מספר דגם</label><div class="inpw"> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 26 · `div.card`
- **איפה:** כרטיס הזמנה (הזמנה ×189) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חיובים השכרת שמלה דגם 4512 מידה 38
- **וריאנטים (אותו בורר):** כרטיס 18, כרטיס 27
- **טולטיפים:** "מתעדכן אוטומטית" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 75 `ia-lift`, הנפשה 81 `ia-pulse`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico rose"><svg class="ic lg ia-file ia-h"><use href="#i-file"></use></svg></div><h2>חיובים <button aria-label="עזרה" class="tip" data-ico="info" data-tip="מתעדכן אוטומטית" type="button"><svg class="ic sm ia-info ia-h"><use href="#i-info"></use></svg></button></h2></div><div class="list"><div class="li"><div class="ic-b"><svg class="ic ia-dress ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 27 · `div.card`
- **איפה:** כרטיס הזמנה (הזמנה ×189) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תשלומים שהתקבלו מזומן י״ב תשרי · ר
- **וריאנטים (אותו בורר):** כרטיס 18, כרטיס 26
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico blue"><svg class="ic lg ia-card ia-h"><use href="#i-card"></use></svg></div><h2>תשלומים שהתקבלו</h2></div><div class="list"><div class="li"><div class="ic-b"><svg class="ic ia-cash ia-h"><use href="#i-cash"></use></svg></div><div class="t"><b>מזומן</b><small>י״ב תשרי · רחל כהן · בעת ההזמנה</small><div class="a"><bdi dir="ltr">₪300</bdi></div></div></div> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 30 · `div.f.miss`
- **איפה:** כרטיס הזמנה (הזמנה ×77) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ת״ז חסר
- **וריאנטים (אותו בורר):** כרטיס 11
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f miss"><svg class="ic"><use href="#i-file"></use></svg><div><small>ת״ז</small><span class="missv"><svg class="ic sm"><use href="#i-alert"></use></svg>חסר</span></div></div></div></div>
  ```

### כרטיס 40 · `div.dhero`
- **איפה:** כרטיס הזמנה (הזמנה ×37) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה עם משלוח
- **וריאנטים (אותו בורר):** כרטיס 9
- **טולטיפים:** "משלוח אחד בלבד להזמנה" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="dhero"><div class="ico"><svg class="ic lg"><use href="#i-truck"></use></svg></div><div style="flex:1;min-width:0"><div class="trow"><label class="sw"><input aria-label="הזמנה עם משלוח" checked="" type="checkbox"/><i></i></label><b class="big">הזמנה עם משלוח</b><button aria-label="עזרה" class="tip" data-tip="משלוח אחד בלבד להזמנה" type="button"><svg class="ic sm"><use href="#i-info"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### כרטיס 41 · `div.card.dfields`
- **איפה:** כרטיס הזמנה (הזמנה ×74) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** כיוון הלוך חזור הלוך-חזור
- **וריאנטים (אותו בורר):** כרטיס 14, כרטיס 24
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="card-h"><div class="ico teal"><svg class="ic lg"><use href="#i-arrlr"></use></svg></div><h2>כיוון</h2></div><div class="seg pill" id="dirSeg" role="radiogroup" style="--n:3;--i:2"><span aria-hidden="true" class="pth"></span><button aria-checked="false" class="" data-dir="there" role="radio" type="button"><svg class="ic sm"><use href="#i-arrr"></use></svg>הלוך</button> … (המשך ב-index.html, "העתק HTML")
  ```

<a id="list"></a>
## רשימות, טבלאות ושורות (שורה N)

### שורה 1 · `div.list`
- **איפה:** דף הבית (בית ×28) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** חובות פתוחים מקור אפשרי: נתיב חובו
- **וריאנטים (אותו בורר):** שורה 19, שורה 28
- **שלד HTML:**
  ```html
  <div class="list"><div class="li pend"><div class="ic-b"><svg class="ic"><use href="#i-wallet"></use></svg></div><div class="t"><b>חובות פתוחים</b><small>מקור אפשרי: נתיב חובות קיים שאין לו היום שימוש.</small></div></div><div class="li pend"><div class="ic-b"><svg class="ic"><use href="#i-clock"></use></svg></div><div class="t"><b>לא הוחזרו בזמן</b><small>מקור אפשרי: כללי האיחור של הלוח.</small></div></div></div>
  ```

### שורה 4 · `button.block.lrow`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** עוד 7
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><button aria-expanded="false" class="lrow block" data-more="a" style="margin-top:8px" type="button"><svg class="ic sm"><use href="#i-plus"></use></svg>עוד 7</button></div></div>
  ```

### שורה 5 · `button.lrow`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** פתיחת עמוד ההגדרות
- **הנפשות:** הנפשה 46 `extNudge`, הנפשה 50 `frameSpin`, הנפשה 51 `gearSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><div class="bub-acts"><button class="lrow" data-open="עמוד" type="button"><svg class="ic sm"><use href="#i-ext"></use></svg>פתיחת עמוד ההגדרות</button></div></div></div></div>
  ```

### שורה 12 · `div.li.pend`
- **איפה:** דף הבית (בית ×52) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לא הוחזרו בזמן מקור אפשרי: כללי הא
- **וריאנטים (אותו בורר):** שורה 13
- **שלד HTML:**
  ```html
  <div class="list"><div class="li pend"><div class="ic-b"><svg class="ic"><use href="#i-clock"></use></svg></div><div class="t"><b>לא הוחזרו בזמן</b><small>מקור אפשרי: כללי האיחור של הלוח.</small></div></div></div>
  ```

### שורה 13 · `div.li.pend`
- **איפה:** דף הבית (בית ×52) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** חובות פתוחים מקור אפשרי: נתיב חובו
- **וריאנטים (אותו בורר):** שורה 12
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="list"><div class="li pend"><div class="ic-b"><svg class="ic ia-wallet ia-h"><use href="#i-wallet"></use></svg></div><div class="t"><b>חובות פתוחים</b><small>מקור אפשרי: נתיב חובות קיים שאין לו היום שימוש.</small></div></div></div>
  ```

### שורה 15 · `a.li.lrow.rlink`
- **איפה:** דף הבית (בית ×31) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לקוח שרה כהנוב אין טלפון · בית שמש
- **וריאנטים (אותו בורר):** שורה 18
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="list"><a class="li rlink lrow" data-open="לקוח" href="#"><div class="ic-b"><svg class="ic"><use href="#i-user"></use></svg><span class="rlbl">לקוח</span></div><div class="t"><b>שרה כהנוב</b><span class="ln">אין טלפון · בית שמש</span></div><svg class="ic sm go"><use href="#i-chev"></use></svg></a></div></div></div>
  ```

### שורה 18 · `a.li.lrow.rlink`
- **איפה:** דף הבית (בית ×31) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הזמנה תמר וייס הזמנה #48152 · י״ח
- **וריאנטים (אותו בורר):** שורה 15
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><div class="list mt"><a class="li rlink lrow" data-open="הזמנה" href="#"><div class="ic-b"><svg class="ic"><use href="#i-file"></use></svg><span class="rlbl">הזמנה</span></div><div class="t"><b>תמר וייס</b><span class="ln">הזמנה <bdi>#48152</bdi> · י״ח תשרי · חוב <bdi>₪300</bdi> · אין טלפון</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שורה 19 · `div.list`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** השכרת שמלה דגם 4512 מידה 38 ₪150 ה
- **וריאנטים (אותו בורר):** שורה 1, שורה 28
- **שלד HTML:**
  ```html
  <div class="list"><div class="li"><div class="ic-b"><svg class="ic"><use href="#i-dress"></use></svg></div><div class="t"><b>השכרת שמלה דגם 4512</b><small>מידה 38</small><div class="a"><bdi dir="ltr">₪150</bdi></div></div></div><div class="li"><div class="ic-b"><svg class="ic"><use href="#i-dress"></use></svg></div><div class="t"><b>השכרת שמלה דגם 3087</b><small>מידה 36</small><div class="a"><bdi dir="ltr">₪120</bdi> … (המשך ב-index.html, "העתק HTML")
  ```

### שורה 24 · `div.li.lrow.rlink`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מסמך הודפס סיכום הזמנה י״ב תשרי ·
- **וריאנטים (אותו בורר):** שורה 25
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 85 `ia-slide`
- **שלד HTML:**
  ```html
  <article class="hrow"><div class="li rlink lrow" data-ico="print" role="button" tabindex="0"><div class="ic-b"><svg class="ic ia-print ia-h"><use href="#i-print"></use></svg><span class="rlbl">מסמך</span></div><div class="t"><b>הודפס סיכום הזמנה</b><span class="ln">י״ב תשרי · <bdi>10:35</bdi> · רחל כהן</span></div><span aria-hidden="true" class="go"><svg class="ic sm ia-chev ia-h"><use href="#i-chev"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### שורה 25 · `div.li.lrow.rlink`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריט הוסר פריט: דגם 1893, מידה 38
- **וריאנטים (אותו בורר):** שורה 24
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <article class="hrow"><div class="li rlink lrow" data-ico="dress" role="button" tabindex="0"><div class="ic-b"><svg class="ic ia-dress ia-h"><use href="#i-dress"></use></svg><span class="rlbl">פריט</span></div><div class="t"><b>הוסר פריט: דגם 1893, מידה 38</b><span class="ln">י״ב תשרי · <bdi>10:31</bdi> · רחל כהן · דמי ביטול ₪40 · <bdi dir="ltr">+₪40</bdi></span></div><span aria-hidden="true" class="go"> … (המשך ב-index.html, "העתק HTML")
  ```

### שורה 28 · `div.list`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מזומן י״ב תשרי · רחל כהן · בעת ההז
- **וריאנטים (אותו בורר):** שורה 1, שורה 19
- **שלד HTML:**
  ```html
  <div class="list"><div class="li"><div class="ic-b"><svg class="ic"><use href="#i-cash"></use></svg></div><div class="t"><b>מזומן</b><small>י״ב תשרי · רחל כהן · בעת ההזמנה</small><div class="a"><bdi dir="ltr">₪300</bdi></div></div></div><div class="li"><div class="ic-b"><svg class="ic"><use href="#i-card"></use></svg></div><div class="t"><b>אשראי</b><small>י״ב תשרי · רחל כהן · ספרות 4432</small><div class="a"> … (המשך ב-index.html, "העתק HTML")
  ```

### שורה 30 · `div.li`
- **איפה:** כרטיס הזמנה (הזמנה ×273) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** דמי ביטול · דגם 1893 הוסרה מההזמנה
- **וריאנטים (אותו בורר):** שורה 34
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="list"><div class="li"><div class="ic-b"><svg class="ic ia-x ia-h"><use href="#i-x"></use></svg></div><div class="t"><b>דמי ביטול · דגם 1893</b><small>הוסרה מההזמנה</small><div class="a"><bdi dir="ltr">₪40</bdi></div></div></div></div>
  ```

### שורה 34 · `div.li`
- **איפה:** כרטיס הזמנה (הזמנה ×273) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח הלוך-חזור · ירושלים ₪80
- **וריאנטים (אותו בורר):** שורה 30
- **שלד HTML:**
  ```html
  <div class="list"><div class="li"><div class="ic-b"><svg class="ic"><use href="#i-truck"></use></svg></div><div class="t"><b>משלוח</b><small>הלוך-חזור · ירושלים</small><div class="a"><bdi dir="ltr">₪80</bdi></div></div></div></div>
  ```

<a id="history"></a>
## היסטוריה ותוצאות (היסטוריה N)

### היסטוריה 2 · `div.hf-bar`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סינון סמן הכל פריטים 6 תשלומים 2 מ
- **טולטיפים:** "ניקוי חיפוש" (לא ממוספר)
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 85 `ia-slide`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`, הנפשה 96 `ia-tilt`, הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hf-bar"><div class="hf-s"><svg class="ic ia-search ia-h"><use href="#i-search"></use></svg><input aria-label="חיפוש בהיסטוריה" autocomplete="off" placeholder="חיפוש בהיסטוריה" type="search" value=""/><button aria-label="ניקוי חיפוש" class="hf-cl" data-hf-clear="" data-ico="x" data-tip="ניקוי חיפוש" type="button"><svg class="ic ia-x ia-h ia-ov"><use href="#i-x"></use></svg></button><div class="hf-sel"> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 5 · `div.hres-bar`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריטים 3 מחוקים
- **וריאנטים (אותו בורר):** היסטוריה 19, היסטוריה 21
- **טולטיפים:** "טבלה" (לא ממוספר), "רשימה" (לא ממוספר)
- **הנפשות:** הנפשה 43 `dtPop`, הנפשה 44 `dtWig`, הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 99 `ia-wave`, הנפשה 104 `icnshake`
- **שלד HTML:**
  ```html
  <div class="hres-bar"><span class="hres-n">פריטים <b>3</b></span><div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="תצוגת רשימה" class="vopt on" data-ico="rows" data-iview="list" data-tip="רשימה" type="button"><svg class="ic ia-rows ia-h"><use href="#i-rows"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 8 · `button.hf-cl`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 38
- **טולטיפים:** "ניקוי חיפוש" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`
- **שלד HTML:**
  ```html
  <div class="hf-s"><button aria-label="ניקוי חיפוש" class="hf-cl" data-hf-clear="" data-ico="x" data-tip="ניקוי חיפוש" type="button"><svg class="ic ia-x ia-h ia-ov"><use href="#i-x"></use></svg></button></div>
  ```

### היסטוריה 9 · `button.hf-t`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סינון
- **וריאנטים (אותו בורר):** היסטוריה 39
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><button aria-controls="hfList" aria-expanded="false" aria-haspopup="listbox" class="hf-t" data-hf-trg="" data-ico="sliders" type="button"><svg class="ic ia-sliders ia-h"><use href="#i-sliders"></use></svg><span class="hf-lbl">סינון</span><span class="hf-bdg"></span><svg class="ic hf-chv ia-chev ia-h"><use href="#i-chev"></use></svg></button></div></div>
  ```

### היסטוריה 12 · `button.hf-allb`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סמן הכל
- **שלד HTML:**
  ```html
  <button class="hf-allb" data-hf-all="" type="button">סמן הכל</button>
  ```

### היסטוריה 14 · `span.hf-ck`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 47
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div class="hf-o"><span class="hf-ck"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span></div></div></div></div>
  ```

### היסטוריה 18 · `div.hres`
- **איפה:** כרטיס הזמנה (הזמנה ×42) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריט דגם 4512 · מידה 38 טרם נמסרה
- **שלד HTML:**
  ```html
  <div class="hres"><div class="hgrp"><article class="hrow irow"><div aria-controls="det-1" aria-expanded="false" class="li rlink lrow" data-id="1" role="button" tabindex="0"><div class="ic-b"><svg class="ic"><use href="#i-dress"></use></svg><span class="rlbl">פריט</span></div><div class="t"><b>דגם <bdi>4512</bdi> · מידה 38</b><span class="ln">טרם נמסרה · <bdi dir="ltr">₪150</bdi></span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 19 · `div.hres-bar`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תוצאות 12
- **וריאנטים (אותו בורר):** היסטוריה 5, היסטוריה 21
- **טולטיפים:** "הדפסת ההיסטוריה" (לא ממוספר), "הורדת ההיסטוריה כקובץ" (לא ממוספר), "טבלה" (לא ממוספר), "ייצוא ההיסטוריה לקובץ Excel" (לא ממוספר), "רשימה" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hres-bar"><span class="hres-n">תוצאות <b>12</b></span><div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="תצוגת רשימה" class="vopt on" data-hview="list" data-ico="rows" data-tip="רשימה" type="button"><svg class="ic ia-rows ia-h"><use href="#i-rows"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 20 · `article.hrow`
- **איפה:** כרטיס הזמנה (הזמנה ×468) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריט הוסר פריט: דגם 1893, מידה 38
- **וריאנטים (אותו בורר):** היסטוריה 55, היסטוריה 56
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <article aria-expanded="false" class="hrow" data-hv="9" style="--i:3"><div class="li rlink lrow" data-ico="dress" role="button" tabindex="0"><div class="ic-b"><svg class="ic ia-dress ia-h"><use href="#i-dress"></use></svg><span class="rlbl">פריט</span></div><div class="t"><b>הוסר פריט: דגם 1893, מידה 38</b><span class="ln">י״ב תשרי · <bdi>10:31</bdi> · רחל כהן · דמי ביטול ₪40 · <bdi dir="ltr">+₪40</bdi></span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 21 · `div.hres-bar`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פריטים 3 מחוקים
- **וריאנטים (אותו בורר):** היסטוריה 5, היסטוריה 19
- **טולטיפים:** "טבלה" (לא ממוספר), "רשימה" (לא ממוספר)
- **הנפשות:** הנפשה 43 `dtPop`, הנפשה 44 `dtWig`
- **שלד HTML:**
  ```html
  <div class="hres-bar"><span class="hres-n">פריטים <b>3</b></span><div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="תצוגת רשימה" class="vopt on" data-iview="list" data-tip="רשימה" type="button"><svg class="ic"><use href="#i-rows"></use></svg></button><button aria-label="תצוגת טבלה" class="vopt" data-iview="table" data-tip="טבלה" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 26 · `div.hdet`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** דגם 4512 מידה 38 סטטוס טרם נמסרה מ
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="hdet"><div class="hdet-in"><div class="hv-r"><small>דגם</small><b><bdi>4512</bdi></b></div><div class="hv-r"><small>מידה</small><b>38</b></div><div class="hv-r"><small>סטטוס</small><b>טרם נמסרה</b></div><div class="hv-r"><small>מחיר</small><b><bdi dir="ltr">₪150</bdi></b></div><div class="hv-r"><small>פרטי הוספה</small><b>אתמול · רחל כהן</b></div> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 33 · `div.hv-act.hv-r`
- **איפה:** כרטיס הזמנה (הזמנה ×129) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פעולות סמן כנמסרה
- **וריאנטים (אותו בורר):** היסטוריה 34
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="hdet"><div class="hv-r hv-act"><small>פעולות</small><b class="hv-btns"><button class="btn sm" data-id="1"><svg class="ic sm"><use href="#i-bag"></use></svg>סמן כנמסרה</button><button aria-label="עריכת מידה" class="ibtn" data-id="1" title="עריכת מידה"><svg class="ic sm"><use href="#i-pencil"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 34 · `div.hv-act.hv-r`
- **איפה:** כרטיס הזמנה (הזמנה ×129) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** פעולות סמן כנמסרה סמן תיקון בוצע
- **וריאנטים (אותו בורר):** היסטוריה 33
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="hdet"><div class="hv-r hv-act"><small>פעולות</small><b class="hv-btns"><button class="btn sm" data-id="2"><svg class="ic sm"><use href="#i-bag"></use></svg>סמן כנמסרה</button><button class="btn sm" data-id="2"><svg class="ic sm"><use href="#i-check"></use></svg>סמן תיקון בוצע</button><button aria-label="עריכת מידה" class="ibtn" data-id="2" title="עריכת מידה"> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 38 · `button.hf-cl`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 8
- **שלד HTML:**
  ```html
  <div class="hf-s"><button aria-label="ניקוי חיפוש" class="hf-cl" data-hf-clear="" type="button"><svg class="ic"><use href="#i-x"></use></svg></button></div>
  ```

### היסטוריה 39 · `button.hf-t`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סינון
- **וריאנטים (אותו בורר):** היסטוריה 9
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><button aria-controls="hfList" aria-expanded="false" aria-haspopup="listbox" class="hf-t" data-hf-trg="" type="button"><svg class="ic"><use href="#i-sliders"></use></svg><span class="hf-lbl">סינון</span><span class="hf-bdg"></span><svg class="ic hf-chv"><use href="#i-chev"></use></svg></button></div></div>
  ```

### היסטוריה 40 · `div.hf-o`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תשלומים 2
- **וריאנטים (אותו בורר):** היסטוריה 42
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div aria-selected="false" class="hf-o" data-hf-o="pay" role="option" style="--k:1" tabindex="-1"><span class="hf-ck"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><span class="hf-oi"><svg class="ic ia-card ia-h"><use href="#i-card"></use></svg></span><span class="hf-ol">תשלומים</span><span class="hf-oc">2</span></div></div></div></div>
  ```

### היסטוריה 42 · `div.hf-o`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תאריכים 1
- **וריאנטים (אותו בורר):** היסטוריה 40
- **הנפשות:** הנפשה 66 `ia-draw`, הנפשה 69 `ia-flip`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div aria-selected="false" class="hf-o" data-hf-o="dates" role="option" style="--k:3" tabindex="-1"><span class="hf-ck"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span><span class="hf-oi"><svg class="ic ia-cal ia-h"><use href="#i-cal"></use></svg></span><span class="hf-ol">תאריכים</span><span class="hf-oc">1</span></div></div></div></div>
  ```

### היסטוריה 47 · `span.hf-ck`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 14
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div class="hf-o"><span class="hf-ck"><svg class="ic"><use href="#i-check"></use></svg></span></div></div></div></div>
  ```

### היסטוריה 49 · `span.hf-oi`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 50
- **הנפשות:** הנפשה 67 `ia-drive`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div class="hf-o"><span class="hf-oi"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg></span></div></div></div></div>
  ```

### היסטוריה 50 · `span.hf-oi`
- **איפה:** כרטיס הזמנה (הזמנה ×312) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** היסטוריה 49
- **הנפשות:** הנפשה 69 `ia-flip`
- **שלד HTML:**
  ```html
  <div class="hf-s"><div class="hf-sel"><div class="hf-p"><div class="hf-o"><span class="hf-oi"><svg class="ic ia-cal ia-h"><use href="#i-cal"></use></svg></span></div></div></div></div>
  ```

### היסטוריה 55 · `article.hrow`
- **איפה:** כרטיס הזמנה (הזמנה ×468) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מסמך נשלח מייל אישור ללקוחה י״ג תש
- **וריאנטים (אותו בורר):** היסטוריה 20, היסטוריה 56
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <article aria-expanded="false" class="hrow" data-hv="11" style="--i:1"><div class="li rlink lrow" data-ico="mail" role="button" tabindex="0"><div class="ic-b"><svg class="ic ia-mail ia-h"><use href="#i-mail"></use></svg><span class="rlbl">מסמך</span></div><div class="t"><b>נשלח מייל אישור ללקוחה</b><span class="ln">י״ג תשרי · <bdi>09:05</bdi> · דוד לוי · miriam.abr@example.com</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### היסטוריה 56 · `article.hrow`
- **איפה:** כרטיס הזמנה (הזמנה ×468) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מסמך הודפס סיכום הזמנה י״ב תשרי ·
- **וריאנטים (אותו בורר):** היסטוריה 20, היסטוריה 55
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 85 `ia-slide`
- **שלד HTML:**
  ```html
  <article aria-expanded="false" class="hrow" data-hv="10" style="--i:2"><div class="li rlink lrow" data-ico="print" role="button" tabindex="0"><div class="ic-b"><svg class="ic ia-print ia-h"><use href="#i-print"></use></svg><span class="rlbl">מסמך</span></div><div class="t"><b>הודפס סיכום הזמנה</b><span class="ln">י״ב תשרי · <bdi>10:35</bdi> · רחל כהן</span></div><span aria-hidden="true" class="go"> … (המשך ב-index.html, "העתק HTML")
  ```

<a id="timeline"></a>
## ציר זמן, תהליך ועגלה (שלב N)

### שלב 1 · `div.card.proc`
- **איפה:** כרטיס הזמנה (הזמנה ×37) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** יומן הזמנה משלוח חזור יום ראשון ל׳
- **רמזים עשירים:** `shift|order`, `shift|pay`
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 75 `ia-lift`, הנפשה 78 `ia-nR`, הנפשה 101 `ia-write`
- **שלד HTML:**
  ```html
  <div class="card proc"><div class="card-h"><div class="ico teal"><svg class="ic lg ia-list ia-h"><use href="#i-list"></use></svg></div><h2>יומן הזמנה</h2></div><div class="prc-l"><div class="prc fut"><div class="prc-rail"><span class="prc-i"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>משלוח חזור</b><small>יום ראשון ל׳ תשרי</small></div></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 2 · `div.cart.rcard`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סיכום לא חתום הלוך-חזור 3 פריטים ש
- **וריאנטים (אותו בורר):** שלב 43, שלב 44
- **רמזים עשירים:** רמז עשיר 6 `del`, רמז עשיר 7 `items`, רמז עשיר 8 `pay`, רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 21 `barDraw`, הנפשה 22 `barShine`, הנפשה 23 `barShine2`, הנפשה 24 `cartbounce`, הנפשה 64 `ia-cart`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 78 `ia-nR`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 94 `ia-sway`, הנפשה 96 `ia-tilt`, הנפשה 101 `ia-write`, הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="sec-h"><svg class="ic sm ia-list ia-h"><use href="#i-list"></use></svg><span>סיכום</span></div><div class="glance"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-ico="x" data-rich="sig" type="button"><svg class="ic ia-x"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 3 · `div.stepper`
- **איפה:** כרטיס הזמנה (הזמנה ×13) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה יום ד׳ · י״ב תשרי משלוח הלוך
- **רמזים עשירים:** `tl|dback`, רמז עשיר 3 `tl|dout`, רמז עשיר 4 `tl|event`, רמז עשיר 2 `tl|now`, רמז עשיר 1 `tl|order`
- **הנפשות:** הנפשה 50 `frameSpin`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 68 `ia-drop`, הנפשה 75 `ia-lift`, הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div class="stepper"><div class="tlx" style="--n:4"><div aria-describedby="rt" class="tx done hasnow" data-rich="tl|order" style="--fill:0.200" tabindex="0"><div class="dot"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg><span class="ck"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span></div><div class="tt"><b>הזמנה</b><span>יום ד׳ · י״ב תשרי</span></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 6 · `div.cart-actions`
- **איפה:** כרטיס הזמנה (הזמנה ×5) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שמור ושלם ₪120 בטל שינויים
- **וריאנטים (אותו בורר):** שלב 143
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-actions"><button class="btn primary lg block"><svg class="ic"><use href="#i-card"></use></svg>שמור ושלם <bdi dir="ltr">₪120</bdi></button><button class="btn ghost block sec"><svg class="ic sm"><use href="#i-undo"></use></svg>בטל שינויים</button></div></div>
  ```

### שלב 7 · `button.gl.sig.yes`
- **איפה:** כרטיס הזמנה (הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתום
- **רמזים עשירים:** רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><button aria-label="חתום - חתימה על תקנון" class="gl sig yes" data-rich="sig" type="button"><svg class="ic"><use href="#i-check"></use></svg><span class="gv">חתום</span></button></div>
  ```

### שלב 8 · `div.charge.net`
- **איפה:** כרטיס הזמנה (הזמנה ×14) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סה״כ לתשלום ₪120
- **וריאנטים (אותו בורר):** שלב 148
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="net charge"><div><div class="sm">סה״כ לתשלום</div><div class="v"><bdi dir="ltr">₪120</bdi></div></div><svg class="ic lg"><use href="#i-card"></use></svg></div></div>
  ```

### שלב 9 · `button.redo`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס)
- **טולטיפים:** "החזר ביטול" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><button aria-label="החזר ביטול" class="redo" data-tip="החזר ביטול" type="button"><svg class="ic sm"><use href="#i-redo"></use></svg></button></div></div>
  ```

### שלב 10 · `div.net.zero`
- **איפה:** כרטיס הזמנה (הזמנה ×5) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינוי בסכום ₪0
- **וריאנטים (אותו בורר):** שלב 48
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="net zero"><div><div class="sm">שינוי בסכום</div><div class="v">₪0</div></div><svg class="ic lg"><use href="#i-check"></use></svg></div></div>
  ```

### שלב 19 · `div.cur.fut.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח הלוך יום שלישי כ״ה תשרי השלב
- **וריאנטים (אותו בורר):** שלב 74
- **הנפשות:** הנפשה 67 `ia-drive`
- **שלד HTML:**
  ```html
  <div aria-current="step" class="prc fut cur"><div class="prc-rail"><span class="prc-i"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>משלוח הלוך</b><small>יום שלישי כ״ה תשרי</small></div><span class="chip gray prc-cur">השלב הנוכחי</span></div></div>
  ```

### שלב 20 · `span.chip.gray.prc-cur`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** השלב הנוכחי
- **שלד HTML:**
  ```html
  <span class="chip gray prc-cur">השלב הנוכחי</span>
  ```

### שלב 22 · `button.prc-sh.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 79
- **רמזים עשירים:** `shift|pay`
- **הנפשות:** הנפשה 61 `ia-bob`
- **שלד HTML:**
  ```html
  <div class="prc done"><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-ico="users" data-rich="shift|pay" type="button"><svg class="ic ia-users ia-h"><use href="#i-users"></use></svg></button></div>
  ```

### שלב 23 · `div.sec-h`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סיכום
- **וריאנטים (אותו בורר):** שלב 81
- **הנפשות:** הנפשה 78 `ia-nR`, הנפשה 101 `ia-write`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="sec-h"><svg class="ic sm ia-list ia-h"><use href="#i-list"></use></svg><span>סיכום</span></div></div>
  ```

### שלב 25 · `button.gl.no.sig`
- **איפה:** כרטיס הזמנה (הזמנה ×28) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לא חתום
- **וריאנטים (אותו בורר):** שלב 86
- **רמזים עשירים:** רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-ico="x" data-rich="sig" type="button"><svg class="ic ia-x"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button></div>
  ```

### שלב 26 · `span.del.gl`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלוך-חזור
- **וריאנטים (אותו בורר):** שלב 87
- **רמזים עשירים:** רמז עשיר 6 `del`
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 102 `icndrive`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic ia-truck"><use href="#i-truck"></use></svg><span class="gv">הלוך-חזור</span></span></div>
  ```

### שלב 28 · `span.gl.ok.pay`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שולם
- **וריאנטים (אותו בורר):** שלב 91
- **רמזים עשירים:** רמז עשיר 8 `pay`
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="מצב תשלום" class="gl pay ok" data-rich="pay" tabindex="0"><svg class="ic ia-card"><use href="#i-card"></use></svg><span class="gv">שולם</span></span></div>
  ```

### שלב 33 · `div.cart-empty`
- **איפה:** כרטיס הזמנה (הזמנה ×20) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אין שינויים
- **וריאנטים (אותו בורר):** שלב 113
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cart-empty"><svg class="ic lg ia-check ia-h"><use href="#i-check"></use></svg><span>אין שינויים</span></div></div></div>
  ```

### שלב 34 · `div.done.hasnow.tx`
- **איפה:** כרטיס הזמנה (הזמנה ×60) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה יום ד׳ · י״ב תשרי
- **וריאנטים (אותו בורר):** שלב 114
- **רמזים עשירים:** רמז עשיר 2 `tl|now`, רמז עשיר 1 `tl|order`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div aria-describedby="rt" class="tx done hasnow" data-rich="tl|order" style="--fill:0.200" tabindex="0"><div class="dot"><svg class="ic"><use href="#i-file"></use></svg><span class="ck"><svg class="ic"><use href="#i-check"></use></svg></span></div><div class="tt"><b>הזמנה</b><span>יום ד׳ · י״ב תשרי</span></div><div class="today" style="--f:0.20"> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 36 · `div.cl-i`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 127
- **הנפשות:** הנפשה 115 `popin`, הנפשה 120 `rowin`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl enter"><div class="cl-i"><svg class="ic"><use href="#i-plus"></use></svg></div></div></div></div>
  ```

### שלב 41 · `div.chg`
- **איפה:** כרטיס הזמנה (הזמנה ×30) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הוסרה דגם 3087 דמי ביטול ₪40
- **וריאנטים (אותו בורר):** שלב 47
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="chg"><div class="c"><div class="ico green" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none"><svg class="ic sm"><use href="#i-minus"></use></svg></div><div class="t">הוסרה <b>דגם 3087</b><div class="faint sm">דמי ביטול ₪40</div></div></div></div></div>
  ```

### שלב 42 · `div.credit.net`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** זיכוי ללקוח ₪80
- **וריאנטים (אותו בורר):** שלב 147
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="net credit"><div><div class="sm">זיכוי ללקוח</div><div class="v"><bdi dir="ltr">₪80</bdi></div></div><svg class="ic lg"><use href="#i-undo"></use></svg></div></div>
  ```

### שלב 43 · `div.cart.rcard`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סיכום לא חתום הלוך-חזור 4 פריטים ש
- **וריאנטים (אותו בורר):** שלב 2, שלב 44
- **רמזים עשירים:** `chg|add:1790597940747`, רמז עשיר 6 `del`, רמז עשיר 7 `items`, רמז עשיר 8 `pay`, רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 21 `barDraw`, הנפשה 22 `barShine`, הנפשה 23 `barShine2`, הנפשה 24 `cartbounce`, הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="sec-h"><svg class="ic sm"><use href="#i-list"></use></svg><span>סיכום</span></div><div class="glance"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-rich="sig" type="button"><svg class="ic"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 44 · `div.cart.rcard`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סיכום לא חתום הלוך-חזור 2 פריטים ש
- **וריאנטים (אותו בורר):** שלב 2, שלב 43
- **רמזים עשירים:** `chg|rm:2`, רמז עשיר 6 `del`, רמז עשיר 7 `items`, רמז עשיר 8 `pay`, רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 21 `barDraw`, הנפשה 22 `barShine`, הנפשה 23 `barShine2`, הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="sec-h"><svg class="ic sm"><use href="#i-list"></use></svg><span>סיכום</span></div><div class="glance"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-rich="sig" type="button"><svg class="ic"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 47 · `div.chg`
- **איפה:** כרטיס הזמנה (הזמנה ×30) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתימה על תקנון עודכנה
- **וריאנטים (אותו בורר):** שלב 41
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="chg"><div class="c"><div class="ico gray" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none"><svg class="ic sm"><use href="#i-sig"></use></svg></div><div class="t"><b>חתימה על תקנון</b> עודכנה</div></div></div></div>
  ```

### שלב 48 · `div.net.zero`
- **איפה:** כרטיס הזמנה (הזמנה ×5) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינוי בסכום ₪0
- **וריאנטים (אותו בורר):** שלב 10
- **הנפשות:** הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="net zero"><div><div class="sm">שינוי בסכום</div><div class="v">₪0</div></div><svg class="ic lg ia-check ia-h" style="--ia-dl: 40ms;"><use href="#i-check"></use></svg></div></div>
  ```

### שלב 51 · `div.fut.tx`
- **איפה:** כרטיס הזמנה (הזמנה ×183) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח הלוך יום ג׳ · כ״ה תשרי ירושל
- **וריאנטים (אותו בורר):** שלב 52
- **רמזים עשירים:** רמז עשיר 3 `tl|dout`
- **שלד HTML:**
  ```html
  <div aria-describedby="rt" class="tx fut" data-rich="tl|dout" style="--fill:0.000" tabindex="0"><div class="dot"><svg class="ic"><use href="#i-truck"></use></svg></div><div class="tt"><b>משלוח הלוך</b><span>יום ג׳ · כ״ה תשרי</span><span>ירושלים</span></div></div>
  ```

### שלב 52 · `div.fut.tx`
- **איפה:** כרטיס הזמנה (הזמנה ×183) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אירוע יום ה׳ · כ״ז תשרי
- **וריאנטים (אותו בורר):** שלב 51
- **רמזים עשירים:** רמז עשיר 4 `tl|event`
- **שלד HTML:**
  ```html
  <div aria-describedby="rt" class="tx fut" data-rich="tl|event" style="--fill:0.000" tabindex="0"><div class="dot"><svg class="ic"><use href="#i-gift"></use></svg></div><div class="tt"><b>אירוע</b><span>יום ה׳ · כ״ז תשרי</span></div></div>
  ```

### שלב 54 · `div.fut.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אירוע יום חמישי כ״ז תשרי
- **וריאנטים (אותו בורר):** שלב 56
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="prc fut"><div class="prc-rail"><span class="prc-i"><svg class="ic ia-gift ia-h"><use href="#i-gift"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>אירוע</b><small>יום חמישי כ״ז תשרי</small></div></div></div>
  ```

### שלב 56 · `div.fut.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אירוע יום חמישי כ״ז תשרי
- **וריאנטים (אותו בורר):** שלב 54
- **שלד HTML:**
  ```html
  <div class="prc fut"><div class="prc-rail"><span class="prc-i"><svg class="ic"><use href="#i-gift"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>אירוע</b><small>יום חמישי כ״ז תשרי</small></div></div></div>
  ```

### שלב 57 · `div.prc-rail`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 60
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="prc fut"><div class="prc-rail"><span class="prc-i"><svg class="ic ia-gift ia-h"><use href="#i-gift"></use></svg></span></div></div>
  ```

### שלב 60 · `div.prc-rail`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 57
- **שלד HTML:**
  ```html
  <div class="prc fut"><div class="prc-rail"><span class="prc-i"><svg class="ic"><use href="#i-gift"></use></svg></span></div></div>
  ```

### שלב 62 · `span.prc-i`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 65
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="prc fut"><span class="prc-i"><svg class="ic ia-gift ia-h"><use href="#i-gift"></use></svg></span></div>
  ```

### שלב 65 · `span.prc-i`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 62
- **שלד HTML:**
  ```html
  <div class="prc fut"><span class="prc-i"><svg class="ic"><use href="#i-gift"></use></svg></span></div>
  ```

### שלב 70 · `div.prc-body`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תשלום אתמול · 10:20 · רחל כהן · שו
- **וריאנטים (אותו בורר):** שלב 71
- **רמזים עשירים:** `shift|pay`
- **שלד HTML:**
  ```html
  <div class="prc done"><div class="prc-body"><div class="prc-t"><b>תשלום</b><small>אתמול · <bdi>10:20</bdi> · רחל כהן · שולם <bdi dir="ltr">₪530</bdi></small></div><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-rich="shift|pay" type="button"><svg class="ic"><use href="#i-users"></use></svg></button></div></div>
  ```

### שלב 71 · `div.prc-body`
- **איפה:** כרטיס הזמנה (הזמנה ×195) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה אתמול · 10:12 · רחל כהן
- **וריאנטים (אותו בורר):** שלב 70
- **רמזים עשירים:** `shift|order`
- **שלד HTML:**
  ```html
  <div class="prc done"><div class="prc-body"><div class="prc-t"><b>הזמנה</b><small>אתמול · <bdi>10:12</bdi> · רחל כהן</small></div><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-rich="shift|order" type="button"><svg class="ic"><use href="#i-users"></use></svg></button></div></div>
  ```

### שלב 74 · `div.cur.fut.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×39) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוח הלוך יום שלישי כ״ה תשרי השלב
- **וריאנטים (אותו בורר):** שלב 19
- **שלד HTML:**
  ```html
  <div aria-current="step" class="prc fut cur"><div class="prc-rail"><span class="prc-i"><svg class="ic"><use href="#i-truck"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>משלוח הלוך</b><small>יום שלישי כ״ה תשרי</small></div><span class="chip gray prc-cur">השלב הנוכחי</span></div></div>
  ```

### שלב 75 · `div.done.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה אתמול · 10:12 · רחל כהן
- **וריאנטים (אותו בורר):** שלב 77
- **רמזים עשירים:** `shift|order`
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 66 `ia-draw`
- **שלד HTML:**
  ```html
  <div class="prc done"><div class="prc-rail"><span class="prc-i"><svg class="ic ia-check ia-h"><use href="#i-check"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>הזמנה</b><small>אתמול · <bdi>10:12</bdi> · רחל כהן</small></div><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-ico="users" data-rich="shift|order" type="button"><svg class="ic ia-users ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 77 · `div.done.prc`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה אתמול · 10:12 · רחל כהן
- **וריאנטים (אותו בורר):** שלב 75
- **רמזים עשירים:** `shift|order`
- **שלד HTML:**
  ```html
  <div class="prc done"><div class="prc-rail"><span class="prc-i"><svg class="ic"><use href="#i-check"></use></svg></span></div><div class="prc-body"><div class="prc-t"><b>הזמנה</b><small>אתמול · <bdi>10:12</bdi> · רחל כהן</small></div><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-rich="shift|order" type="button"><svg class="ic"><use href="#i-users"></use></svg></button></div></div>
  ```

### שלב 79 · `button.prc-sh.tip`
- **איפה:** כרטיס הזמנה (הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 22
- **רמזים עשירים:** `shift|pay`
- **שלד HTML:**
  ```html
  <div class="prc done"><button aria-describedby="rt" aria-label="עובדים במשמרת" class="tip prc-sh" data-rich="shift|pay" type="button"><svg class="ic"><use href="#i-users"></use></svg></button></div>
  ```

### שלב 81 · `div.sec-h`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סיכום
- **וריאנטים (אותו בורר):** שלב 23
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="sec-h"><svg class="ic sm"><use href="#i-list"></use></svg><span>סיכום</span></div></div>
  ```

### שלב 82 · `div.glance`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתום הלוך-חזור 3 פריטים שולם
- **וריאנטים (אותו בורר):** שלב 83
- **רמזים עשירים:** רמז עשיר 6 `del`, רמז עשיר 7 `items`, רמז עשיר 8 `pay`, רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="glance"><button aria-label="חתום - חתימה על תקנון" class="gl sig yes" data-rich="sig" type="button"><svg class="ic"><use href="#i-check"></use></svg><span class="gv">חתום</span></button><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic"><use href="#i-truck"></use></svg><span class="gv">הלוך-חזור</span></span> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 83 · `div.glance`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לא חתום הלוך-חזור 4 פריטים שולם
- **וריאנטים (אותו בורר):** שלב 82
- **רמזים עשירים:** רמז עשיר 6 `del`, רמז עשיר 7 `items`, רמז עשיר 8 `pay`, רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 102 `icndrive`, הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="glance"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-rich="sig" type="button"><svg class="ic"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic"><use href="#i-truck"></use></svg><span class="gv">הלוך-חזור</span></span> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 86 · `button.gl.no.sig`
- **איפה:** כרטיס הזמנה (הזמנה ×28) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לא חתום
- **וריאנטים (אותו בורר):** שלב 25
- **רמזים עשירים:** רמז עשיר 10 `sig`
- **הנפשות:** הנפשה 103 `icnpop`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><button aria-label="לא חתום - חתימה על תקנון" class="gl sig no" data-rich="sig" type="button"><svg class="ic"><use href="#i-x"></use></svg><span class="gv">לא חתום</span></button></div>
  ```

### שלב 87 · `span.del.gl`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלוך-חזור
- **וריאנטים (אותו בורר):** שלב 26
- **רמזים עשירים:** רמז עשיר 6 `del`
- **הנפשות:** הנפשה 102 `icndrive`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="משלוח הלוך-חזור" class="gl del" data-rich="del" tabindex="0"><svg class="ic"><use href="#i-truck"></use></svg><span class="gv">הלוך-חזור</span></span></div>
  ```

### שלב 88 · `span.gl.itm-c`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 פריטים
- **וריאנטים (אותו בורר):** שלב 90
- **רמזים עשירים:** רמז עשיר 7 `items`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="3 פריטים" class="gl itm-c" data-rich="items" tabindex="0"><svg class="ic"><use href="#i-dress"></use></svg><span class="gv">3 פריטים</span></span></div>
  ```

### שלב 90 · `span.gl.itm-c`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 2 פריטים
- **וריאנטים (אותו בורר):** שלב 88
- **רמזים עשירים:** רמז עשיר 7 `items`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="2 פריטים" class="gl itm-c" data-rich="items" tabindex="0"><svg class="ic"><use href="#i-dress"></use></svg><span class="gv">2 פריטים</span></span></div>
  ```

### שלב 91 · `span.gl.ok.pay`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שולם
- **וריאנטים (אותו בורר):** שלב 28
- **רמזים עשירים:** רמז עשיר 8 `pay`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><span aria-label="מצב תשלום" class="gl pay ok" data-rich="pay" tabindex="0"><svg class="ic"><use href="#i-card"></use></svg><span class="gv">שולם</span></span></div>
  ```

### שלב 94 · `div.cart-h`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינויים בהזמנה 0
- **וריאנטים (אותו בורר):** שלב 95
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><button aria-expanded="false" class="cart-t" type="button"><svg class="ic sm"><use href="#i-cart"></use></svg><b>שינויים בהזמנה</b><span class="badge">0</span><span class="cart-sum"></span><svg class="ic sm"><use href="#i-chev"></use></svg></button></div></div>
  ```

### שלב 95 · `div.cart-h`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינויים בהזמנה 1 +₪120
- **וריאנטים (אותו בורר):** שלב 94
- **הנפשות:** הנפשה 24 `cartbounce`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><button aria-expanded="false" class="cart-t bump" type="button"><svg class="ic sm"><use href="#i-cart"></use></svg><b>שינויים בהזמנה</b><span class="badge">1</span><span class="cart-sum"><bdi dir="ltr">+₪120</bdi></span><svg class="ic sm"><use href="#i-chev"></use></svg></button></div></div>
  ```

### שלב 96 · `button.cart-t`
- **איפה:** כרטיס הזמנה (הזמנה ×25) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינויים בהזמנה 1 +₪120
- **וריאנטים (אותו בורר):** שלב 97
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><button aria-expanded="false" class="cart-t" type="button"><svg class="ic sm"><use href="#i-cart"></use></svg><b>שינויים בהזמנה</b><span class="badge">1</span><span class="cart-sum"><bdi dir="ltr">+₪120</bdi></span><svg class="ic sm"><use href="#i-chev"></use></svg></button></div></div>
  ```

### שלב 97 · `button.cart-t`
- **איפה:** כרטיס הזמנה (הזמנה ×25) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שינויים בהזמנה 0
- **וריאנטים (אותו בורר):** שלב 96
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-h"><button aria-expanded="false" class="cart-t" type="button"><svg class="ic sm"><use href="#i-cart"></use></svg><b>שינויים בהזמנה</b><span class="badge">0</span><span class="cart-sum"></span><svg class="ic sm"><use href="#i-chev"></use></svg></button></div></div>
  ```

### שלב 102 · `div.cart-body`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אין שינויים
- **וריאנטים (אותו בורר):** שלב 105
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-body"><div class="cart-list"><div class="cart-empty"><svg class="ic lg"><use href="#i-check"></use></svg><span>אין שינויים</span></div></div></div></div>
  ```

### שלב 105 · `div.cart-body`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נוספה דגם 4519 מידה 38 +₪120 חיוב
- **וריאנטים (אותו בורר):** שלב 102
- **רמזים עשירים:** `chg|add:1790597600925`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-body"><div class="cart-list"><div class="cl" data-key="add:1790597600925" data-rich="chg|add:1790597600925" tabindex="0"><div class="cl-i"><svg class="ic"><use href="#i-plus"></use></svg></div><div class="cl-t"><span>נוספה <b>דגם 4519</b></span><small>מידה 38</small><em class="p"><bdi dir="ltr">+₪120</bdi></em></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 107 · `div.cart-list`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נוספה דגם 4519 מידה 38 +₪120
- **וריאנטים (אותו בורר):** שלב 109
- **רמזים עשירים:** `chg|add:1790597933466`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl" data-key="add:1790597933466" data-rich="chg|add:1790597933466" tabindex="0"><div class="cl-i"><svg class="ic"><use href="#i-plus"></use></svg></div><div class="cl-t"><span>נוספה <b>דגם 4519</b></span><small>מידה 38</small><em class="p"><bdi dir="ltr">+₪120</bdi></em></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 109 · `div.cart-list`
- **איפה:** כרטיס הזמנה (הזמנה ×35) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אין שינויים
- **וריאנטים (אותו בורר):** שלב 107
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cart-empty"><svg class="ic lg"><use href="#i-check"></use></svg><span>אין שינויים</span></div></div></div>
  ```

### שלב 113 · `div.cart-empty`
- **איפה:** כרטיס הזמנה (הזמנה ×20) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אין שינויים
- **וריאנטים (אותו בורר):** שלב 33
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cart-empty"><svg class="ic lg"><use href="#i-check"></use></svg><span>אין שינויים</span></div></div></div>
  ```

### שלב 114 · `div.done.hasnow.tx`
- **איפה:** כרטיס הזמנה (הזמנה ×60) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה יום ד׳ · י״ב תשרי
- **וריאנטים (אותו בורר):** שלב 34
- **רמזים עשירים:** רמז עשיר 2 `tl|now`, רמז עשיר 1 `tl|order`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div aria-describedby="rt" class="tx done hasnow" data-rich="tl|order" style="--fill:0.200" tabindex="0"><div class="dot"><svg class="ic"><use href="#i-file"></use></svg><span class="ck"><svg class="ic"><use href="#i-check"></use></svg></span></div><div class="tt"><b>הזמנה</b><span>יום ד׳ · י״ב תשרי</span></div><div class="today" style="--f:0.20"> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 116 · `div.cl`
- **איפה:** כרטיס הזמנה (הזמנה ×14) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חתימה על תקנון עודכנה
- **וריאנטים (אותו בורר):** שלב 117
- **רמזים עשירים:** `chg|sig`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl" data-key="sig" data-rich="chg|sig" tabindex="0"><div class="cl-i"><svg class="ic"><use href="#i-sig"></use></svg></div><div class="cl-t"><span><b>חתימה על תקנון</b> עודכנה</span></div><button aria-label="ביטול השינוי" class="cl-u" data-k="sig" title="ביטול" type="button"><svg class="ic sm"><use href="#i-bk"></use></svg></button></div></div></div>
  ```

### שלב 117 · `div.cl`
- **איפה:** כרטיס הזמנה (הזמנה ×14) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נוספה דגם 4519 מידה 38 +₪120
- **וריאנטים (אותו בורר):** שלב 116
- **רמזים עשירים:** `chg|add:1790597933466`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl" data-key="add:1790597933466" data-rich="chg|add:1790597933466" tabindex="0"><div class="cl-i"><svg class="ic"><use href="#i-plus"></use></svg></div><div class="cl-t"><span>נוספה <b>דגם 4519</b></span><small>מידה 38</small><em class="p"><bdi dir="ltr">+₪120</bdi></em></div> … (המשך ב-index.html, "העתק HTML")
  ```

### שלב 127 · `div.cl-i`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 36
- **הנפשות:** הנפשה 115 `popin`, הנפשה 120 `rowin`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl enter"><div class="cl-i"><svg class="ic"><use href="#i-sig"></use></svg></div></div></div></div>
  ```

### שלב 131 · `button.cl-u`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 140
- **הנפשות:** הנפשה 120 `rowin`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl enter"><button aria-label="ביטול השינוי" class="cl-u" data-k="sig" title="ביטול" type="button"><svg class="ic sm"><use href="#i-bk"></use></svg></button></div></div></div>
  ```

### שלב 140 · `button.cl-u`
- **איפה:** כרטיס הזמנה (הזמנה ×15) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** שלב 131
- **הנפשות:** הנפשה 120 `rowin`
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-list"><div class="cl enter"><button aria-label="ביטול השינוי" class="cl-u" data-k="add:1790597601562" title="ביטול" type="button"><svg class="ic sm"><use href="#i-bk"></use></svg></button></div></div></div>
  ```

### שלב 143 · `div.cart-actions`
- **איפה:** כרטיס הזמנה (הזמנה ×10) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** שמור בטל שינויים
- **וריאנטים (אותו בורר):** שלב 6
- **שלד HTML:**
  ```html
  <div class="rcard cart"><div class="cart-actions"><button class="btn primary lg block"><svg class="ic"><use href="#i-check"></use></svg>שמור</button><button class="btn ghost block sec"><svg class="ic sm"><use href="#i-undo"></use></svg>בטל שינויים</button></div></div>
  ```

### שלב 147 · `div.credit.net`
- **איפה:** כרטיס הזמנה (הזמנה ×11) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** זיכוי ללקוח ₪80
- **וריאנטים (אותו בורר):** שלב 42
- **הנפשות:** הנפשה 98 `ia-undo`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="net credit"><div><div class="sm">זיכוי ללקוח</div><div class="v"><bdi dir="ltr">₪80</bdi></div></div><svg class="ic lg ia-undo ia-h" style="--ia-dl: 40ms;"><use href="#i-undo"></use></svg></div></div>
  ```

### שלב 148 · `div.charge.net`
- **איפה:** כרטיס הזמנה (הזמנה ×14) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** סה״כ לתשלום ₪120
- **וריאנטים (אותו בורר):** שלב 8
- **הנפשות:** הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="net charge"><div><div class="sm">סה״כ לתשלום</div><div class="v"><bdi dir="ltr">₪120</bdi></div></div><svg class="ic lg ia-card ia-h" style="--ia-dl: 40ms;"><use href="#i-card"></use></svg></div></div>
  ```

<a id="nav"></a>
## ניווט ופריסה (ניווט N)

### ניווט 2 · `nav.sn-nav`
- **איפה:** דף הבית (בית ×14) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** בית וחיפוש הזמנות הזמנה חדשה רשימת
- **וריאנטים (אותו בורר):** ניווט 42, ניווט 60
- **הנפשות:** הנפשה 60 `ia-blink`, הנפשה 61 `ia-bob`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 72 `ia-hop`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 86 `ia-snip`, הנפשה 87 `ia-spin`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 92 `ia-squash`, הנפשה 95 `ia-tick`, הנפשה 96 `ia-tilt`, הנפשה 97 `ia-tiltf`, הנפשה 99 `ia-wave`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <nav aria-label="ניווט ראשי" class="sn-nav"><div class="sn-item"><a class="sn-tab" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div><div class="sn-item" data-sn="orders"><button aria-expanded="false" aria-haspopup="true" class="sn-tab" data-ico="file" type="button"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 4 · `div.demo`
- **איפה:** דף הבית (בית ×14) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הדגמה: עמוד הבית ( / ) סיכום כספי
- **וריאנטים (אותו בורר):** ניווט 47, ניווט 117
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div aria-label="בקרת הדגמה" class="demo" role="region"><b>הדגמה:</b><select aria-label="עמוד"><option value="home">עמוד הבית ( / )</option><option value="dash">סיכום כספי ( /dashboard )</option></select><select aria-label="תפקיד העובדת המחוברת"><option value="0">הנהלה ראשית</option><option value="1">מנהלת סניף</option><option value="3">עובדת</option><option value="anon">לא מחוברת</option></select> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 5 · `footer.site-foot`
- **איפה:** דף הבית (בית ×55) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ניווט מהיר הזמנות לקוחות שמלות סיכ
- **וריאנטים (אותו בורר):** ניווט 46
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 75 `ia-lift`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 89 `ia-spin90`, הנפשה 94 `ia-sway`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <footer class="site-foot" role="contentinfo"><div class="sf-in"><nav aria-label="ניווט מהיר" class="sf-col"><h3>ניווט מהיר</h3><a data-label="הזמנות" data-link="orders" href="#"><svg class="ic sm ia-file ia-h"><use href="#i-file"></use></svg>הזמנות</a><a data-label="לקוחות" data-link="customers" href="#"><svg class="ic sm ia-users ia-h"><use href="#i-users"></use></svg>לקוחות</a> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 7 · `button.sn-burger`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3
- **טולטיפים:** "תפריט" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 92 `ia-squash`
- **שלד HTML:**
  ```html
  <button aria-controls="snDrawer" aria-expanded="false" aria-label="פתיחת התפריט" class="sn-burger" data-ico="menu" data-tip="תפריט" type="button"><svg class="ic m ia-menu ia-h"><use href="#i-menu"></use></svg><svg class="ic x ia-x ia-h"><use href="#i-x"></use></svg><span class="sn-badge">3</span></button>
  ```

### ניווט 9 · `div.topbar`
- **איפה:** דף הבית (בית ×16) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** הנהלה סיכום כספי
- **וריאנטים (אותו בורר):** ניווט 44
- **טולטיפים:** "חזרה לעמוד הבית" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="topbar"><button aria-label="חזרה לעמוד הבית" class="back" data-tip="חזרה לעמוד הבית" type="button"><svg class="ic"><use href="#i-back"></use></svg></button><div class="ttl"><h1 class="pg-ttl"><small>הנהלה</small><bdi>סיכום כספי</bdi></h1></div></div>
  ```

### ניווט 10 · `a.sn-brand`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** גמ״ח שמלות נווה יעקב
- **הנפשות:** הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <a aria-label="גמ״ח שמלות נווה יעקב - לדף הבית" class="sn-brand" data-sn-link="" href="#"><span class="sn-mark"><svg class="ic ia-dress ia-h"><use href="#i-dress"></use></svg></span><span class="sn-name">גמ״ח שמלות</span><span class="sn-tag">נווה יעקב</span></a>
  ```

### ניווט 12 · `div.sn-dsearch.sn-sbox`
- **איפה:** בית · הזמנה (בית ×18 · הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס)
- **הנפשות:** הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="sn-drawer open"><div class="sn-sbox sn-dsearch"><svg class="ic sm ia-search ia-h"><use href="#i-search"></use></svg><input aria-label="חיפוש עמוד" autocomplete="off" placeholder="חיפוש עמוד…" type="search"/></div></div>
  ```

### ניווט 13 · `div.demo-tog-row`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הצגת בקרות הדגמה
- **וריאנטים (אותו בורר):** ניווט 50
- **הנפשות:** הנפשה 60 `ia-blink`
- **שלד HTML:**
  ```html
  <div class="demo-tog-row"><button aria-controls="demoBar" aria-pressed="true" class="demo-tog" data-ico="eye" type="button"><svg class="ic ia-eye ia-h"><use href="#i-eye"></use></svg><span>הצגת בקרות הדגמה</span></button></div>
  ```

### ניווט 14 · `a.active.sn-acc`
- **איפה:** בית · הזמנה (בית ×1 · הזמנה ×1) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש
- **הנפשות:** הנפשה 72 `ia-hop`
- **שלד HTML:**
  ```html
  <a class="sn-acc active" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-home ia-h" style="--ia-dl: 640ms;"><use href="#i-home"></use></svg></span>בית וחיפוש</a>
  ```

### ניווט 15 · `a.sn-acc`
- **איפה:** בית · הזמנה (בית ×19 · הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש
- **הנפשות:** הנפשה 72 `ia-hop`
- **שלד HTML:**
  ```html
  <div class="sn-drawer open"><a class="sn-acc" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg></span>בית וחיפוש</a></div>
  ```

### ניווט 16 · `div.sn-dfoot`
- **איפה:** בית · הזמנה (בית ×18 · הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ש שרה כהן במשמרת 3:42
- **שלד HTML:**
  ```html
  <div class="sn-dfoot"><span class="sn-av">ש</span><div><b>שרה כהן</b><small>במשמרת <bdi class="snShiftM">3:42</bdi></small></div></div>
  ```

### ניווט 17 · `a.active.sn-tab`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש
- **הנפשות:** הנפשה 72 `ia-hop`
- **שלד HTML:**
  ```html
  <div class="sn-item"><a class="sn-tab active" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div>
  ```

### ניווט 18 · `span.sn-mark`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס)
- **הנפשות:** הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <div class="sn-brand"><span class="sn-mark"><svg class="ic ia-dress ia-h"><use href="#i-dress"></use></svg></span></div>
  ```

### ניווט 21 · `div.sn-item`
- **איפה:** בית · הזמנה (בית ×417 · הזמנה ×290) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש
- **וריאנטים (אותו בורר):** ניווט 63
- **הנפשות:** הנפשה 72 `ia-hop`
- **שלד HTML:**
  ```html
  <div class="sn-item"><a class="sn-tab" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div>
  ```

### ניווט 22 · `a.sn-tab`
- **איפה:** בית · הזמנה (בית ×2 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש
- **הנפשות:** הנפשה 72 `ia-hop`
- **שלד HTML:**
  ```html
  <div class="sn-item"><a class="sn-tab" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div>
  ```

### ניווט 24 · `a.sn-link`
- **איפה:** בית · הזמנה (בית ×1845 · הזמנה ×1252) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה חדשה
- **וריאנטים (אותו בורר):** ניווט 73
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`
- **שלד HTML:**
  ```html
  <a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-plus ia-h"><use href="#i-plus"></use></svg></span>הזמנה חדשה</a>
  ```

### ניווט 26 · `button.active.sn-tab`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ניהול
- **וריאנטים (אותו בורר):** ניווט 51
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 81 `ia-pulse`, הנפשה 84 `ia-shk`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" class="sn-tab active" data-ico="shield" type="button"><svg class="ic ia-shield ia-h"><use href="#i-shield"></use></svg>ניהול<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 28 · `div.sn-sbox`
- **איפה:** דף הבית (בית ×47) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** ניווט 53
- **טולטיפים:** "ניקוי" (לא ממוספר)
- **הנפשות:** הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="sn-sbox"><svg class="ic sm ia-search ia-h"><use href="#i-search"></use></svg><input aria-label="חיפוש" autocomplete="off" placeholder="חיפוש עמוד, הזמנה או לקוח…" type="search"/><button aria-label="ניקוי השדה" class="inpx" data-ico="x" data-tip="ניקוי" type="button"><svg class="ic sm ia-x ia-h"><use href="#i-x"></use></svg></button></div>
  ```

### ניווט 30 · `span.sn-badge`
- **איפה:** בית · הזמנה (בית ×85 · הזמנה ×7) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3
- **וריאנטים (אותו בורר):** ניווט 58
- **שלד HTML:**
  ```html
  <div class="sn-burger"><span class="sn-badge">3</span></div>
  ```

### ניווט 32 · `span.sn-clock`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** במשמרת 3:42
- **טולטיפים:** טולטיפ 5 "משמרת נוכחית · שעות מתחילת הכניסה"
- **הנפשות:** הנפשה 122 `snpulse`
- **שלד HTML:**
  ```html
  <span class="sn-clock" data-tip="משמרת נוכחית · שעות מתחילת הכניסה"><i></i>במשמרת <bdi>3:42</bdi></span>
  ```

### ניווט 34 · `span.sn-av`
- **איפה:** בית · הזמנה (בית ×130 · הזמנה ×94) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ש
- **שלד HTML:**
  ```html
  <span class="sn-av">ש</span>
  ```

### ניווט 37 · `a.danger.sn-link`
- **איפה:** בית · הזמנה (בית ×56 · הזמנה ×44) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** התנתקות
- **הנפשות:** הנפשה 78 `ia-nR`
- **שלד HTML:**
  ```html
  <a class="sn-link danger" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-logout ia-h"><use href="#i-logout"></use></svg></span>התנתקות</a>
  ```

### ניווט 38 · `button.demo-tog`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הצגת בקרות הדגמה
- **וריאנטים (אותו בורר):** ניווט 55
- **הנפשות:** הנפשה 60 `ia-blink`
- **שלד HTML:**
  ```html
  <button aria-controls="demoBar" aria-pressed="true" class="demo-tog" data-ico="eye" type="button"><svg class="ic ia-eye ia-h"><use href="#i-eye"></use></svg><span>הצגת בקרות הדגמה</span></button>
  ```

### ניווט 40 · `div.sf-meta`
- **איפה:** בית · הזמנה (בית ×96 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** גמ״ח שמלות נווה יעקב גרסה 3.0 י״ד
- **וריאנטים (אותו בורר):** ניווט 111
- **הנפשות:** הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <footer class="site-foot"><div class="sf-meta"><b><svg class="ic sm ia-dress ia-h"><use href="#i-dress"></use></svg>גמ״ח שמלות נווה יעקב</b><span>גרסה 3.0</span><span>י״ד תשרי תשפ״ז</span></div></footer>
  ```

### ניווט 42 · `nav.sn-nav`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש הזמנות הזמנה חדשה רשימת
- **וריאנטים (אותו בורר):** ניווט 2, ניווט 60
- **הנפשות:** הנפשה 60 `ia-blink`, הנפשה 61 `ia-bob`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 72 `ia-hop`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 86 `ia-snip`, הנפשה 87 `ia-spin`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 92 `ia-squash`, הנפשה 95 `ia-tick`, הנפשה 96 `ia-tilt`, הנפשה 97 `ia-tiltf`, הנפשה 99 `ia-wave`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <nav aria-label="ניווט ראשי" class="sn-nav"><div class="sn-item"><a class="sn-tab" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div><div class="sn-item" data-sn="orders"><button aria-expanded="false" aria-haspopup="true" class="sn-tab active" data-ico="file" type="button"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 44 · `div.topbar`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנה #53375 הדפסת סיכום ללקוח דף
- **וריאנטים (אותו בורר):** ניווט 9
- **טולטיפים:** טולטיפ 10 "הדפסה / מייל", טולטיפ 9 "הורדת סיכום ההזמנה כקובץ", טולטיפ 7 "חזרה לרשימה", טולטיפ 8 "ייצוא ההזמנה לקובץ Excel", טולטיפ 11 "מחיקת הזמנה"
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 37 `dlgIn`, הנפשה 67 `ia-drive`, הנפשה 75 `ia-lift`, הנפשה 77 `ia-nL`, הנפשה 85 `ia-slide`, הנפשה 102 `icndrive`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`, הנפשה 127 `trWig`
- **שלד HTML:**
  ```html
  <div class="topbar"><button aria-label="חזרה לרשימה" class="back" data-ico="back" data-tip="חזרה לרשימה"><svg class="ic ia-back ia-h ia-ov"><use href="#i-back"></use></svg></button><div class="ttl"><h1><small>הזמנה</small><bdi>#53375</bdi></h1><span class="row wrap" id="hdrChips"></span></div><div class="tools"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 46 · `footer.site-foot`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ניווט מהיר רשימת הזמנות לקוחות שמל
- **וריאנטים (אותו בורר):** ניווט 5
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 75 `ia-lift`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 94 `ia-sway`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <footer class="site-foot" role="contentinfo"><div class="sf-in"><nav aria-label="ניווט מהיר" class="sf-col"><h3>ניווט מהיר</h3><a data-link="orders" href="#"><svg class="ic sm ia-file ia-h"><use href="#i-file"></use></svg>רשימת הזמנות</a><a data-link="customers" href="#"><svg class="ic sm ia-users ia-h"><use href="#i-users"></use></svg>לקוחות</a><a data-link="dresses" href="#"><svg class="ic sm ia-dress ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 47 · `div.demo`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הדגמה: סימולציית עריכה: הוספת פריט
- **וריאנטים (אותו בורר):** ניווט 4, ניווט 117
- **הנפשות:** הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div aria-label="בקרת הדגמה" class="demo" role="region"><b>הדגמה:</b><button>סימולציית עריכה: הוספת פריט</button><button>סימולציית עריכה: הסרת פריט</button><button>יציאה מהכרטיס</button><button>פרטי לקוח חסרים</button><button>איפוס</button><button aria-pressed="false" type="button">חלונות: בהיר</button><button aria-controls="nbMenu" aria-expanded="false" aria-haspopup="menu" data-ico="bell" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 48 · `div.sbar`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס)
- **הנפשות:** הנפשה 85 `ia-slide`
- **שלד HTML:**
  ```html
  <div class="sbar" style="position: fixed !important; top: 74px !important; inset-inline: 0px !important;"><div class="inpw"><svg class="ic ia-scan ia-h"><use href="#i-scan"></use></svg><input aria-label="הקלדת ברקוד" autocomplete="off" class="inp" inputmode="numeric" placeholder="ברקוד: סרקו או הקלידו מספר דגם..."/><span class="chip green" id="scanMsg" style="display:none"></span></div></div>
  ```

### ניווט 49 · `button.active.sn-acc`
- **איפה:** כרטיס הזמנה (הזמנה ×42) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנות
- **וריאנטים (אותו בורר):** ניווט 103
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <button aria-expanded="false" class="sn-acc active" data-ico="file" type="button"><span class="sn-li"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg></span>הזמנות<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button>
  ```

### ניווט 50 · `div.demo-tog-row`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הסתרת בקרות הדגמה
- **וריאנטים (אותו בורר):** ניווט 13
- **הנפשות:** הנפשה 60 `ia-blink`
- **שלד HTML:**
  ```html
  <div class="demo-tog-row"><button aria-controls="demoBar" aria-pressed="false" class="demo-tog" data-ico="eye" type="button"><svg class="ic ia-eye ia-h"><use href="#i-eye"></use></svg><span>הסתרת בקרות הדגמה</span></button></div>
  ```

### ניווט 51 · `button.active.sn-tab`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הזמנות
- **וריאנטים (אותו בורר):** ניווט 26
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" class="sn-tab active" data-ico="file" type="button"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg>הזמנות<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 53 · `div.sn-sbox`
- **איפה:** כרטיס הזמנה (הזמנה ×32) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** ניווט 28
- **הנפשות:** הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="sn-sbox"><svg class="ic sm ia-search ia-h"><use href="#i-search"></use></svg><input aria-label="חיפוש" autocomplete="off" placeholder="חיפוש עמוד, הזמנה או לקוח…" type="search"/></div>
  ```

### ניווט 55 · `button.demo-tog`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הסתרת בקרות הדגמה
- **וריאנטים (אותו בורר):** ניווט 38
- **הנפשות:** הנפשה 60 `ia-blink`
- **שלד HTML:**
  ```html
  <button aria-controls="demoBar" aria-pressed="false" class="demo-tog" data-ico="eye" type="button"><svg class="ic ia-eye ia-h"><use href="#i-eye"></use></svg><span>הסתרת בקרות הדגמה</span></button>
  ```

### ניווט 58 · `span.sn-badge`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 0
- **וריאנטים (אותו בורר):** ניווט 30
- **שלד HTML:**
  ```html
  <span class="sn-badge nf-pop">0</span>
  ```

### ניווט 59 · `div.sn-act`
- **איפה:** דף הבית (בית ×14) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** נפתחו לאחרונה הזמנה #53375 · שרה ל
- **וריאנטים (אותו בורר):** ניווט 114
- **טולטיפים:** "הסרה" (לא ממוספר), טולטיפ 2 "התראות", טולטיפ 1 "חיפוש עמוד, הזמנה או לקוח", "יום שני י״ז תשרי תשפ״ז · 12:12" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:12" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:00" (לא ממוספר), "כניסה להזמנה" (לא ממוספר), טולטיפ 5 "משמרת נוכחית · שעות מתחילת הכניסה", "ניקוי" (לא ממוספר), "שולמית · הנהלה ראשית" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 78 `ia-nR`, הנפשה 79 `ia-nUR`, הנפשה 80 `ia-nod`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`, הנפשה 100 `ia-wig`, הנפשה 122 `snpulse`
- **שלד HTML:**
  ```html
  <div class="sn-act"><div class="sn-item" data-sn="search"><button aria-expanded="false" aria-haspopup="true" aria-label="חיפוש" class="sn-ib" data-ico="search" data-tip="חיפוש עמוד, הזמנה או לקוח" type="button"><svg class="ic ia-search ia-h" style="--ia-dl: 0ms;"><use href="#i-search"></use></svg></button><div aria-label="חיפוש" class="sn-panel sn-search" role="dialog"><div class="sn-sbox"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 60 · `nav.sn-nav`
- **איפה:** בית · הזמנה (בית ×14 · הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** בית וחיפוש הזמנות הזמנה חדשה רשימת
- **וריאנטים (אותו בורר):** ניווט 2, ניווט 42
- **הנפשות:** הנפשה 60 `ia-blink`, הנפשה 61 `ia-bob`, הנפשה 66 `ia-draw`, הנפשה 67 `ia-drive`, הנפשה 69 `ia-flip`, הנפשה 70 `ia-flipy`, הנפשה 72 `ia-hop`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 80 `ia-nod`, הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 86 `ia-snip`, הנפשה 87 `ia-spin`, הנפשה 89 `ia-spin90`, הנפשה 90 `ia-spinp`, הנפשה 92 `ia-squash`, הנפשה 95 `ia-tick`, הנפשה 96 `ia-tilt`, הנפשה 97 `ia-tiltf`, הנפשה 99 `ia-wave`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <nav aria-label="ניווט ראשי" class="sn-nav"><div class="sn-item"><a class="sn-tab active" data-sn-link="" href="#"><svg class="ic ia-home ia-h"><use href="#i-home"></use></svg>בית וחיפוש</a></div><div class="sn-item" data-sn="orders"><button aria-expanded="false" aria-haspopup="true" class="sn-tab" data-ico="file" type="button"><svg class="ic ia-file ia-h" style="--ia-dl: 0ms;"><use href="#i-file"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 63 · `div.sn-item`
- **איפה:** בית · הזמנה (בית ×417 · הזמנה ×290) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מלאי קטלוג דגמים מחירון
- **וריאנטים (אותו בורר):** ניווט 21
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="sn-item" data-sn="inv"><button aria-expanded="false" aria-haspopup="true" class="sn-tab" data-ico="bag" type="button"><svg class="ic ia-bag ia-h ia-ov"><use href="#i-bag"></use></svg>מלאי<svg class="ic sn-chev ia-chev ia-h ia-ov"><use href="#i-chev"></use></svg></button><div aria-label="מלאי" class="sn-panel" role="menu"><a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 64 · `button.sn-tab`
- **איפה:** בית · הזמנה (בית ×272 · הזמנה ×211) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אנשים
- **וריאנטים (אותו בורר):** ניווט 65
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" class="sn-tab" data-ico="users" type="button"><svg class="ic ia-users ia-h"><use href="#i-users"></use></svg>אנשים<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 65 · `button.sn-tab`
- **איפה:** בית · הזמנה (בית ×272 · הזמנה ×211) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עוד
- **וריאנטים (אותו בורר):** ניווט 64
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 92 `ia-squash`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" class="sn-tab" data-ico="menu" type="button"><svg class="ic ia-menu ia-h"><use href="#i-menu"></use></svg>עוד<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 66 · `div.sn-panel`
- **איפה:** בית · הזמנה (בית ×329 · הזמנה ×256) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קטלוג דגמים מחירון
- **וריאנטים (אותו בורר):** ניווט 67
- **הנפשות:** הנפשה 75 `ia-lift`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="sn-item"><div aria-label="מלאי" class="sn-panel" role="menu"><a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-bag ia-h"><use href="#i-bag"></use></svg></span>קטלוג דגמים</a><a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-tag ia-h"><use href="#i-tag"></use></svg></span>מחירון</a></div></div>
  ```

### ניווט 67 · `div.sn-panel`
- **איפה:** בית · הזמנה (בית ×329 · הזמנה ×256) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לקוחות עובדים ונוכחות לוח חודשי עמ
- **וריאנטים (אותו בורר):** ניווט 66
- **הנפשות:** הנפשה 60 `ia-blink`, הנפשה 61 `ia-bob`, הנפשה 69 `ia-flip`, הנפשה 80 `ia-nod`
- **שלד HTML:**
  ```html
  <div class="sn-item"><div aria-label="אנשים" class="sn-panel" role="menu"><a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-users ia-h"><use href="#i-users"></use></svg></span>לקוחות</a><a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-userck ia-h"><use href="#i-userck"></use></svg></span>עובדים ונוכחות</a> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 73 · `a.sn-link`
- **איפה:** בית · הזמנה (בית ×1845 · הזמנה ×1252) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** משלוחים
- **וריאנטים (אותו בורר):** ניווט 24
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <a class="sn-link" data-sn-link="" href="#" role="menuitem"><span class="sn-li"><svg class="ic ia-box ia-h"><use href="#i-box"></use></svg></span>משלוחים</a>
  ```

### ניווט 78 · `span.sn-li`
- **איפה:** בית · הזמנה (בית ×2073 · הזמנה ×1384) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** ניווט 80
- **הנפשות:** הנפשה 67 `ia-drive`
- **שלד HTML:**
  ```html
  <div class="sn-link"><span class="sn-li"><svg class="ic ia-truck ia-h"><use href="#i-truck"></use></svg></span></div>
  ```

### ניווט 80 · `span.sn-li`
- **איפה:** בית · הזמנה (בית ×2073 · הזמנה ×1384) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** ניווט 78
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="sn-link"><span class="sn-li"><svg class="ic ia-box ia-h"><use href="#i-box"></use></svg></span></div>
  ```

### ניווט 84 · `button.sn-ib`
- **איפה:** בית · הזמנה (בית ×118 · הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3
- **וריאנטים (אותו בורר):** ניווט 85
- **טולטיפים:** טולטיפ 2 "התראות"
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="sn-item"><button aria-expanded="false" aria-haspopup="true" aria-label="התראות · 3 חדשות" class="sn-ib" data-ico="bell" data-tip="התראות" type="button"><svg class="ic ia-bell ia-h"><use href="#i-bell"></use></svg><span class="sn-badge">3</span></button></div>
  ```

### ניווט 85 · `button.sn-ib`
- **איפה:** בית · הזמנה (בית ×118 · הזמנה ×78) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** ניווט 84
- **טולטיפים:** טולטיפ 1 "חיפוש עמוד, הזמנה או לקוח"
- **הנפשות:** הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="sn-item open"><button aria-expanded="true" aria-haspopup="true" aria-label="חיפוש" class="sn-ib" data-ico="search" data-tip="חיפוש עמוד, הזמנה או לקוח" type="button"><svg class="ic ia-search ia-h"><use href="#i-search"></use></svg></button></div>
  ```

### ניווט 89 · `div.sn-bell.sn-panel`
- **איפה:** בית · הזמנה (בית ×71 · הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** התראות סמן הכל כנקרא ניקוי אין התר
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="sn-act"><div class="sn-item"><div aria-label="התראות" class="sn-panel sn-bell" role="menu"><div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt"></span></div><div class="nf-tools"><button data-nf-all="" disabled="" type="button">סמן הכל כנקרא</button><button data-nf-clear="" type="button">ניקוי</button></div><div aria-label="רשימת התראות" class="nf-list" role="group"></div> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 90 · `button.sn-user`
- **איפה:** דף הבית (בית ×56) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ש שולמית
- **וריאנטים (אותו בורר):** ניווט 122
- **טולטיפים:** "שולמית · הנהלה ראשית" (לא ממוספר)
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="sn-item open"><button aria-expanded="true" aria-haspopup="true" aria-label="תפריט משתמש - שולמית" class="sn-user" data-ico="chev" data-tip="שולמית · הנהלה ראשית" type="button"><span class="sn-av">ש</span><span class="sn-uname">שולמית</span><svg class="ic sn-chev ia-chev ia-h ia-ov"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 94 · `button.sn-acc`
- **איפה:** בית · הזמנה (בית ×110 · הזמנה ×38) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אנשים
- **וריאנטים (אותו בורר):** ניווט 95
- **הנפשות:** הנפשה 61 `ia-bob`, הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <button aria-expanded="false" class="sn-acc" data-ico="users" type="button"><span class="sn-li"><svg class="ic ia-users ia-h"><use href="#i-users"></use></svg></span>אנשים<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button>
  ```

### ניווט 95 · `button.sn-acc`
- **איפה:** בית · הזמנה (בית ×110 · הזמנה ×38) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עוד
- **וריאנטים (אותו בורר):** ניווט 94
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`, הנפשה 92 `ia-squash`
- **שלד HTML:**
  ```html
  <button aria-expanded="false" class="sn-acc" data-ico="menu" type="button"><span class="sn-li"><svg class="ic ia-menu ia-h"><use href="#i-menu"></use></svg></span>עוד<svg class="ic sn-chev ia-chev ia-h"><use href="#i-chev"></use></svg></button>
  ```

### ניווט 97 · `div.sn-ab`
- **איפה:** בית · הזמנה (בית ×108 · הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** קטלוג דגמים מחירון
- **וריאנטים (אותו בורר):** ניווט 101, ניווט 115
- **הנפשות:** הנפשה 75 `ia-lift`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="sn-ab"><div><a class="sn-link" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-bag ia-h"><use href="#i-bag"></use></svg></span>קטלוג דגמים</a><a class="sn-link" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-tag ia-h"><use href="#i-tag"></use></svg></span>מחירון</a></div></div>
  ```

### ניווט 101 · `div.sn-ab`
- **איפה:** בית · הזמנה (בית ×108 · הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** לוח ניהול הגדרות מערכת ניהול אתר ה
- **וריאנטים (אותו בורר):** ניווט 97, ניווט 115
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 87 `ia-spin`, הנפשה 97 `ia-tiltf`, הנפשה 99 `ia-wave`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="sn-ab"><div><a class="sn-link" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-shield ia-h"><use href="#i-shield"></use></svg></span>לוח ניהול</a><div class="sn-sep"></div><a class="sn-link" data-sn-link="" href="#"><span class="sn-li"><svg class="ic ia-gear ia-h"><use href="#i-gear"></use></svg></span>הגדרות מערכת</a><a class="sn-link" data-sn-link="" href="#"><span class="sn-li"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 103 · `button.active.sn-acc`
- **איפה:** בית · הזמנה (בית ×42 · הזמנה ×42) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מלאי
- **וריאנטים (אותו בורר):** ניווט 49
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <button aria-expanded="true" class="sn-acc active" data-ico="bag" type="button"><span class="sn-li"><svg class="ic ia-bag ia-h" style="--ia-dl: 400ms;"><use href="#i-bag"></use></svg></span>מלאי<svg class="ic sn-chev ia-chev ia-h ia-ov" style="--ia-dl: 440ms;"><use href="#i-chev"></use></svg></button>
  ```

### ניווט 110 · `nav.sf-col`
- **איפה:** דף הבית (בית ×288) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ניווט מהיר הזמנות לקוחות שמלות
- **וריאנטים (אותו בורר):** ניווט 123
- **שלד HTML:**
  ```html
  <footer class="site-foot"><nav aria-label="ניווט מהיר" class="sf-col"><h3>ניווט מהיר</h3><a data-label="הזמנות" data-link="orders" href="#"><svg class="ic sm"><use href="#i-file"></use></svg>הזמנות</a><a data-label="לקוחות" data-link="customers" href="#"><svg class="ic sm"><use href="#i-users"></use></svg>לקוחות</a><a data-label="שמלות" data-link="dresses" href="#"><svg class="ic sm"><use href="#i-dress"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 111 · `div.sf-meta`
- **איפה:** דף הבית (בית ×96) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** סניף מרכז גרסה 3.0 י״ד תשרי תשפ״ז
- **וריאנטים (אותו בורר):** ניווט 40
- **שלד HTML:**
  ```html
  <footer class="site-foot"><div class="sf-meta"><b><svg class="ic sm"><use href="#i-dress"></use></svg>סניף מרכז</b><span>גרסה 3.0</span><span>י״ד תשרי תשפ״ז</span></div></footer>
  ```

### ניווט 112 · `div.open.sn-item`
- **איפה:** בית · הזמנה (בית ×44 · הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מלאי קטלוג דגמים מחירון
- **וריאנטים (אותו בורר):** ניווט 116
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div class="sn-item open" data-pin="1" data-sn="inv"><button aria-expanded="true" aria-haspopup="true" class="sn-tab" data-ico="bag" type="button"><svg class="ic ia-bag ia-h ia-ov"><use href="#i-bag"></use></svg>מלאי<svg class="ic sn-chev ia-chev ia-h ia-ov"><use href="#i-chev"></use></svg></button><div aria-label="מלאי" class="sn-panel" role="menu"><a class="sn-link" data-sn-link="" href="#" role="menuitem"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 114 · `div.sn-act`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** נפתחו לאחרונה הזמנה #53375 · שרה ל
- **וריאנטים (אותו בורר):** ניווט 59
- **טולטיפים:** "הסרה" (לא ממוספר), טולטיפ 2 "התראות", טולטיפ 1 "חיפוש עמוד, הזמנה או לקוח", "יום שני י״ז תשרי תשפ״ז · 12:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:18" (לא ממוספר), "כניסה להזמנה" (לא ממוספר), טולטיפ 5 "משמרת נוכחית · שעות מתחילת הכניסה", טולטיפ 6 "שרה כהן · עובדת"
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 70 `ia-flipy`, הנפשה 75 `ia-lift`, הנפשה 76 `ia-nD`, הנפשה 78 `ia-nR`, הנפשה 79 `ia-nUR`, הנפשה 80 `ia-nod`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`, הנפשה 100 `ia-wig`, הנפשה 110 `nf-ring`, הנפשה 122 `snpulse`
- **שלד HTML:**
  ```html
  <div class="sn-act"><div class="sn-item" data-sn="search"><button aria-expanded="false" aria-haspopup="true" aria-label="חיפוש" class="sn-ib" data-ico="search" data-tip="חיפוש עמוד, הזמנה או לקוח" type="button"><svg class="ic ia-search ia-h" style="--ia-dl: 0ms;"><use href="#i-search"></use></svg></button><div aria-label="חיפוש" class="sn-panel sn-search" role="dialog"><div class="sn-sbox"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 115 · `div.sn-ab`
- **איפה:** כרטיס הזמנה (הזמנה ×36) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** התראות 4 חדשות סמן הכל כנקרא ניקוי
- **וריאנטים (אותו בורר):** ניווט 97, ניווט 101
- **טולטיפים:** "הסרה" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 12:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:18" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="sn-ab"><div><div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt">4 חדשות</span></div><div class="nf-tools"><button data-nf-all="" type="button">סמן הכל כנקרא</button><button data-nf-clear="" type="button">ניקוי</button></div><div aria-label="רשימת התראות" class="nf-list" role="group"><div class="nf-row unread" data-nf="4" role="menuitem" tabindex="-1"><span class="nf-ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 116 · `div.open.sn-item`
- **איפה:** כרטיס הזמנה (הזמנה ×46) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3 התראות 3 חדשות סמן הכל כנקרא ניק
- **וריאנטים (אותו בורר):** ניווט 112
- **טולטיפים:** "הסרה" (לא ממוספר), טולטיפ 2 "התראות", "יום שני י״ז תשרי תשפ״ז · 12:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 14:18" (לא ממוספר), "יום שני י״ז תשרי תשפ״ז · 15:06" (לא ממוספר), "כניסה להזמנה" (לא ממוספר)
- **הנפשות:** הנפשה 67 `ia-drive`, הנפשה 79 `ia-nUR`, הנפשה 82 `ia-ring`, הנפשה 86 `ia-snip`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 96 `ia-tilt`
- **שלד HTML:**
  ```html
  <div class="sn-item open" data-pin="1" data-sn="bell"><button aria-expanded="true" aria-haspopup="true" aria-label="התראות · 3 חדשות" class="sn-ib" data-ico="bell" data-tip="התראות" type="button"><svg class="ic ia-bell ia-h"><use href="#i-bell"></use></svg><span class="sn-badge">3</span></button><div aria-label="התראות" class="sn-panel sn-bell" role="menu"><div class="nf-w"><div class="sn-ph"><strong>התראות</strong> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 117 · `div.demo`
- **איפה:** כרטיס הזמנה (הזמנה ×2) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הדגמה: סימולציית עריכה: הוספת פריט
- **וריאנטים (אותו בורר):** ניווט 4, ניווט 47
- **הנפשות:** הנפשה 82 `ia-ring`, הנפשה 84 `ia-shk`, הנפשה 99 `ia-wave`
- **שלד HTML:**
  ```html
  <div aria-label="בקרת הדגמה" class="demo" role="region"><b>הדגמה:</b><button>סימולציית עריכה: הוספת פריט</button><button>סימולציית עריכה: הסרת פריט</button><button>יציאה מהכרטיס</button><button>פרטי לקוח חסרים</button><button>איפוס</button><button aria-pressed="true" type="button">חלונות: כהה</button><button aria-controls="nbMenu" aria-expanded="false" aria-haspopup="menu" data-ico="bell" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### ניווט 122 · `button.sn-user`
- **איפה:** כרטיס הזמנה (הזמנה ×44) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** ש שרה כהן
- **וריאנטים (אותו בורר):** ניווט 90
- **טולטיפים:** טולטיפ 6 "שרה כהן · עובדת"
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="sn-item open"><button aria-expanded="true" aria-haspopup="true" aria-label="תפריט משתמש - שרה כהן" class="sn-user" data-ico="chev" data-tip="שרה כהן · עובדת" type="button"><span class="sn-av">ש</span><span class="sn-uname">שרה כהן</span><svg class="ic sn-chev ia-chev ia-h ia-ov"><use href="#i-chev"></use></svg></button></div>
  ```

### ניווט 123 · `nav.sf-col`
- **איפה:** כרטיס הזמנה (הזמנה ×6) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** עזרה מדריך למשתמש דיווח על תקלה
- **וריאנטים (אותו בורר):** ניווט 110
- **הנפשות:** הנפשה 81 `ia-pulse`, הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <footer class="site-foot"><nav aria-label="עזרה" class="sf-col"><h3>עזרה</h3><a data-link="guide" href="#"><svg class="ic sm ia-info ia-h"><use href="#i-info"></use></svg>מדריך למשתמש</a><a data-link="report" href="#"><svg class="ic sm ia-alert ia-h"><use href="#i-alert"></use></svg>דיווח על תקלה</a></nav></footer>
  ```

<a id="home"></a>
## רכיבי דף הבית (בית N)

### בית 1 · `div.advonly.aishell.hero-in.jshell`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** חיפוש חכם אני אילו הזמנות לא שולמו
- **וריאנטים (אותו בורר):** בית 22
- **טולטיפים:** "הדפס הכל" (לא ממוספר), "הדפסת התוצאות" (לא ממוספר), "הורד הכל" (לא ממוספר), "הורדת התוצאות כקובץ" (לא ממוספר), "העתקה" (לא ממוספר), "ייצוא לקובץ Excel" (לא ממוספר), "לחיצה מעתיקה" (לא ממוספר), "מצב טבלה" (לא ממוספר), "מצב שורות" (לא ממוספר), "ניקוי הטקסט" (לא ממוספר), "סגירה" (לא ממוספר), "שליחה" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 46 `extNudge`, הנפשה 50 `frameSpin`, הנפשה 51 `gearSpin`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="card-h"><button aria-label="סגירת השיחה" class="ibtn" data-tip="סגירה" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><h2>חיפוש חכם</h2><button aria-label="הורד הכל" class="ibtn hdx hdd" data-tip="הורד הכל" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 2 · `div.hero-in.jshell`
- **איפה:** דף הבית (בית ×3) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם תוצאות (15
- **וריאנטים (אותו בורר):** בית 23
- **טולטיפים:** "הדפסת התוצאות" (לא ממוספר), "הורדת התוצאות כקובץ" (לא ממוספר), "הסטטוס של הזמנה נלקח מהשדה שנשמר בהזמנה, ובדרך כלל הוא ריק ולכן מוצג " (לא ממוספר), טולטיפ 4 "חיפוש", "ייצוא לקובץ Excel" (לא ממוספר), "מצב טבלה" (לא ממוספר), "מצב שורות" (לא ממוספר), "ניקוי הכול" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 50 `frameSpin`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><form class="srch" role="search"><div class="scan" style="transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);"><input aria-label="חיפוש לקוח, הזמנה או פריט" autocomplete="off" id="sq" value="כהן"/><button aria-label="ניקוי החיפוש" class="ibtn" data-tip="ניקוי הכול" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><div class="cmode"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 3 · `div.advonly.hero-in.jshell`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** סינון מתקדם במה נתמקד? לקוחות הזמנ
- **טולטיפים:** "חזרה" (לא ממוספר), "סגירה" (לא ממוספר), "עוד תחומים" (לא ממוספר)
- **הנפשות:** הנפשה 13 `advPlusHint`, הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly" style="max-width: 809px;"><div class="card res-one advp"><div class="card-h"><button aria-label="סגירת החיפוש המתקדם" class="ibtn" data-link="advanced" data-tip="סגירה" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><button aria-label="חזרה לחיפוש הראשי" class="ibtn" data-link="advanced" data-tip="חזרה" type="button"><svg class="ic sm"><use href="#i-back"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 4 · `div.advp.aiw`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** חיפוש חכם
- **טולטיפים:** "הדפס הכל" (לא ממוספר), "הורד הכל" (לא ממוספר), "סגירה" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="advp aiw"><div class="card-h aibar" style="width: 632px; left: 334px; top: 72px;"><button aria-label="סגירת השיחה" class="ibtn" data-tip="סגירה" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><h2>חיפוש חכם</h2><button aria-label="הורד הכל" class="ibtn hdx hdd" data-tip="הורד הכל" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 5 · `div.hero-in`
- **איפה:** דף הבית (בית ×29) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** שלום שולמית, מה תרצי לחפש? לחיפוש
- **וריאנטים (אותו בורר):** בית 24
- **טולטיפים:** טולטיפ 4 "חיפוש"
- **הנפשות:** הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hero-in"><h1 class="hero-t"><bdi><span class="t-hi">שלום שולמית,</span><span class="t-q">מה תרצי לחפש?</span></bdi></h1><form class="srch" role="search"><div class="scan"><input aria-label="חיפוש לקוח, הזמנה או פריט" autocomplete="off" id="sq" value=""/><button aria-label="חיפוש" class="btn primary" data-ico="search" data-tip="חיפוש" type="submit"><svg class="ic ia-search ia-h"><use href="#i-search"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 7 · `div.pg-sub`
- **איפה:** דף הבית (בית ×13) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** המספרים מחושבים מחדש בכל כניסה לעמ
- **שלד HTML:**
  ```html
  <div class="pg-sub"><span class="stx"><svg class="ic"><use href="#i-refresh"></use></svg>המספרים מחושבים מחדש בכל כניסה לעמוד</span></div>
  ```

### בית 9 · `div.hero-row`
- **איפה:** דף הבית (בית ×29) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 31
- **הנפשות:** הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hero-in"><div class="hero-row"><div class="cmode"><button class="cmode-b" data-ico="sparkle" data-mode="ai" type="button"><svg class="ic ia-sparkle ia-h"><use href="#i-sparkle"></use></svg>לחיפוש חכם</button><button aria-expanded="false" aria-pressed="false" class="cmode-b" data-ico="sliders" data-label="החיפוש המתקדם" data-link="advanced" type="button"><svg class="ic ia-sliders ia-h"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 10 · `div.cmode`
- **איפה:** דף הבית (בית ×32) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 34
- **הנפשות:** הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hero-in"><div class="cmode"><button class="cmode-b" data-ico="sparkle" data-mode="ai" type="button"><svg class="ic ia-sparkle ia-h"><use href="#i-sparkle"></use></svg>לחיפוש חכם</button><button aria-expanded="false" aria-pressed="false" class="cmode-b" data-ico="sliders" data-label="החיפוש המתקדם" data-link="advanced" type="button"><svg class="ic ia-sliders ia-h"><use href="#i-sliders"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 13 · `div.vbar`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **טולטיפים:** "מצב טבלה" (לא ממוספר), "מצב שורות" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="vbar"><div aria-label="מצב תצוגה" class="vsw" role="group"><span aria-hidden="true" class="vknob"></span><button aria-label="מצב שורות" aria-pressed="true" class="vopt on" data-tip="מצב שורות" data-view="rows" type="button"><svg class="ic sm"><use href="#i-rows"></use></svg></button> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 14 · `button.hdd.hdx.ibtn`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **טולטיפים:** "הורד הכל" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="card-h"><button aria-label="הורד הכל" class="ibtn hdx hdd" data-tip="הורד הכל" type="button"><svg aria-hidden="true" class="dlic" fill="none" stroke="#a83d6c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" viewbox="0 0 16 16"><g class="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3"></path></g> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 15 · `button.hdp.hdx.ibtn`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **טולטיפים:** "הדפס הכל" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="card-h"><button aria-label="הדפס הכל" class="ibtn hdx hdp" data-tip="הדפס הכל" type="button"><svg aria-hidden="true" class="prtic" fill="none" stroke="#1e63c4" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewbox="0 0 16 16"><path class="prt-top" d="M4.5 5.5V2h7v3.5"></path> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 16 · `div.bub.me`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** אני אילו הזמנות לא שולמו בשבוע הבא
- **וריאנטים (אותו בורר):** בית 44
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub me"><span class="who"><svg class="ic sm"><use href="#i-user"></use></svg>אני<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="0" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span><p>אילו הזמנות לא שולמו בשבוע הבא?</p></div></div></div>
  ```

### בית 17 · `div.bub-acts`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** פתיחת עמוד ההגדרות
- **הנפשות:** הנפשה 46 `extNudge`, הנפשה 50 `frameSpin`, הנפשה 51 `gearSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><div class="bub-acts"><button class="lrow" data-open="עמוד" type="button"><svg class="ic sm"><use href="#i-ext"></use></svg>פתיחת עמוד ההגדרות</button></div></div></div></div>
  ```

### בית 18 · `form.fu.fu-in`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** שאלת המשך
- **טולטיפים:** "ניקוי הטקסט" (לא ממוספר), "שליחה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><form aria-label="שאלת המשך" class="fu fu-in"><div class="scan" style="transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);"><button aria-label="ניקוי הטקסט" class="ibtn" data-tip="ניקוי הטקסט" type="button"><svg class="ic"><use href="#i-x"></use></svg></button><label class="sr-only" for="fuQ">שאלת המשך</label> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 19 · `button.advfb`
- **איפה:** דף הבית (בית ×16) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לקוחות
- **וריאנטים (אותו בורר):** בית 47
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly"><div class="card res-one advp"><button class="advfb" data-adv-focus="customers" type="button"><svg class="ic sm"><use href="#i-user"></use></svg>לקוחות</button></div></div>
  ```

### בית 20 · `button.advplus`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **טולטיפים:** "עוד תחומים" (לא ממוספר)
- **הנפשות:** הנפשה 13 `advPlusHint`, הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly"><div class="card res-one advp"><button aria-controls="advExtra" aria-expanded="false" aria-label="תחומים נוספים: כספים" class="advplus" data-tip="עוד תחומים" type="button"><svg class="ic ic-p"><use href="#i-plus"></use></svg><svg class="ic ic-m"><use href="#i-minus"></use></svg></button></div></div>
  ```

### בית 21 · `div.advextra`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** כספים
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly"><div class="card res-one advp"><div class="advextra" inert=""><button class="advfb" data-adv-focus="finance" style="--i:0" type="button"><svg class="ic sm"><use href="#i-wallet"></use></svg>כספים</button></div></div></div>
  ```

### בית 22 · `div.advonly.aishell.hero-in.jshell`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** חיפוש חכם אני כמה שמלות מידה 38 תש
- **וריאנטים (אותו בורר):** בית 1
- **טולטיפים:** "הדפס הכל" (לא ממוספר), "הורד הכל" (לא ממוספר), "העתקה" (לא ממוספר), "ניקוי הטקסט" (לא ממוספר), "סגירה" (לא ממוספר), "שליחה" (לא ממוספר)
- **הנפשות:** הנפשה 35 `dlBob`, הנפשה 50 `frameSpin`, הנפשה 116 `prtFeed`, הנפשה 117 `prtTop`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="card-h"><button aria-label="סגירת השיחה" class="ibtn" data-tip="סגירה" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><h2>חיפוש חכם</h2><button aria-label="הורד הכל" class="ibtn hdx hdd" data-tip="הורד הכל" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 23 · `div.hero-in.jshell`
- **איפה:** דף הבית (בית ×3) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם תוצאות (0)
- **וריאנטים (אותו בורר):** בית 2
- **טולטיפים:** "הסטטוס של הזמנה נלקח מהשדה שנשמר בהזמנה, ובדרך כלל הוא ריק ולכן מוצג " (לא ממוספר), טולטיפ 4 "חיפוש", "ניקוי הכול" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><form class="srch" role="search"><div class="scan"><input aria-label="חיפוש לקוח, הזמנה או פריט" autocomplete="off" id="sq" value="כהן"/><button aria-label="ניקוי החיפוש" class="ibtn" data-tip="ניקוי הכול" type="button"><svg class="ic sm"><use href="#i-x"></use></svg></button><div class="cmode"><button class="cmode-b" data-mode="ai" type="button"><svg class="ic"><use href="#i-sparkle"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 24 · `div.hero-in`
- **איפה:** דף הבית (בית ×29) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** ברוכים הבאים למערכת הניהול של גמ״ח
- **וריאנטים (אותו בורר):** בית 5
- **טולטיפים:** "חיפוש חכם" (לא ממוספר), "ניקוי הכול" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="hero-in"><h1 class="hero-t"><bdi><span class="t-q">ברוכים הבאים למערכת הניהול של גמ״ח השמלות — סניף מרכז הארץ והשפלה</span></bdi></h1><form class="srch" role="search"><div class="scan" style="transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);"><input aria-label="שאלה לחיפוש החכם" autocomplete="off" id="sq" value="כהן"/> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 25 · `form.srch`
- **איפה:** דף הבית (בית ×32) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 29, בית 30
- **טולטיפים:** טולטיפ 4 "חיפוש"
- **הנפשות:** הנפשה 106 `mspin`
- **שלד HTML:**
  ```html
  <form class="srch" role="search"><div class="scan"><input aria-label="חיפוש לקוח, הזמנה או פריט" autocomplete="off" disabled="" id="sq" value="כמה שמלות מידה 38"/><button aria-label="מחפשים" class="btn primary" data-tip="חיפוש" disabled="" type="submit"><span aria-hidden="true" class="mspin"></span></button></div><div class="hero-row"><div class="cmode"><button class="cmode-b" data-mode="ai" type="button"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 29 · `form.srch`
- **איפה:** דף הבית (בית ×32) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש רגיל לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 25, בית 30
- **טולטיפים:** "חיפוש חכם" (לא ממוספר)
- **שלד HTML:**
  ```html
  <div class="hero-in"><form class="srch" role="search"><div class="scan"><input aria-label="שאלה לחיפוש החכם" autocomplete="off" id="sq" value=""/><button aria-label="חיפוש חכם" class="btn primary" data-tip="חיפוש חכם" type="submit"><svg class="ic"><use href="#i-send"></use></svg></button></div><div class="hero-row"><div class="cmode"><button class="cmode-b" data-mode="plain" type="button"><svg class="ic"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 30 · `form.srch`
- **איפה:** דף הבית (בית ×32) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש רגיל לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 25, בית 29
- **טולטיפים:** "חיפוש חכם" (לא ממוספר)
- **הנפשות:** הנפשה 79 `ia-nUR`, הנפשה 83 `ia-send`, הנפשה 97 `ia-tiltf`, הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hero-in"><form class="srch" role="search"><div class="scan"><input aria-label="שאלה לחיפוש החכם" autocomplete="off" id="sq" value=""/><button aria-label="חיפוש חכם" class="btn primary" data-ico="send" data-tip="חיפוש חכם" type="submit"><svg class="ic ia-send ia-h"><use href="#i-send"></use></svg></button></div><div class="hero-row"><div class="cmode"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 31 · `div.hero-row`
- **איפה:** דף הבית (בית ×29) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 9
- **שלד HTML:**
  ```html
  <div class="hero-in"><div class="hero-row"><div class="cmode"><button class="cmode-b" data-mode="ai" type="button"><svg class="ic"><use href="#i-sparkle"></use></svg>לחיפוש חכם</button><button aria-expanded="false" aria-pressed="false" class="cmode-b" data-label="החיפוש המתקדם" data-link="advanced" type="button"><svg class="ic"><use href="#i-sliders"></use></svg>לחיפוש מתקדם</button></div></div></div>
  ```

### בית 34 · `div.cmode`
- **איפה:** דף הבית (בית ×32) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם לחיפוש מתקדם
- **וריאנטים (אותו בורר):** בית 10
- **שלד HTML:**
  ```html
  <div class="hero-in"><div class="cmode"><button class="cmode-b" data-mode="ai" type="button"><svg class="ic"><use href="#i-sparkle"></use></svg>לחיפוש חכם</button><button aria-expanded="false" aria-pressed="false" class="cmode-b" data-label="החיפוש המתקדם" data-link="advanced" type="button"><svg class="ic"><use href="#i-sliders"></use></svg>לחיפוש מתקדם</button></div></div>
  ```

### בית 38 · `button.cmode-b`
- **איפה:** דף הבית (בית ×64) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש חכם
- **וריאנטים (אותו בורר):** בית 41
- **שלד HTML:**
  ```html
  <div class="hero-in"><button class="cmode-b" data-mode="ai" type="button"><svg class="ic"><use href="#i-sparkle"></use></svg>לחיפוש חכם</button></div>
  ```

### בית 41 · `button.cmode-b`
- **איפה:** דף הבית (בית ×64) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** לחיפוש רגיל
- **וריאנטים (אותו בורר):** בית 38
- **הנפשות:** הנפשה 100 `ia-wig`
- **שלד HTML:**
  ```html
  <div class="hero-in"><button class="cmode-b" data-ico="search" data-mode="plain" type="button"><svg class="ic ia-search ia-h"><use href="#i-search"></use></svg>לחיפוש רגיל</button></div>
  ```

### בית 42 · `div.card.res-one`
- **איפה:** דף הבית (בית ×3) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** תוצאות (0) אין תוצאות לחיפוש הזה
- **טולטיפים:** "הסטטוס של הזמנה נלקח מהשדה שנשמר בהזמנה, ובדרך כלל הוא ריק ולכן מוצג " (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell"><div class="card res-one"><div class="card-h"><h2>תוצאות <span class="faint">(0)</span><button aria-label="עזרה" class="tip" data-tip="הסטטוס של הזמנה נלקח מהשדה שנשמר בהזמנה, ובדרך כלל הוא ריק ולכן מוצג " type="button" ההזמנה."="" הוא="" הישן="" הסכום="" השדה="" פעיל".="" של=""><svg class="ic sm"><use href="#i-info"></use></svg></button></h2></div><div class="empty"><svg class="ic lg"> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 43 · `div.chat`
- **איפה:** דף הבית (בית ×5) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** אני כמה שמלות מידה 38 תשובה החיפוש
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div aria-live="polite" class="chat"><div class="bub me"><span class="who"><svg class="ic sm"><use href="#i-user"></use></svg>אני<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="0" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span><p>כמה שמלות מידה 38</p></div> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 44 · `div.bub.me`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** אני איך משנים את שעת הודעת הבוקר?
- **וריאנטים (אותו בורר):** בית 16
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub me"><span class="who"><svg class="ic sm"><use href="#i-user"></use></svg>אני<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="2" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span><p>איך משנים את שעת הודעת הבוקר?</p></div></div></div>
  ```

### בית 45 · `div.bot.bub`
- **איפה:** דף הבית (בית ×10) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** תשובה משנים אותה בעמוד ההגדרות, בל
- **טולטיפים:** "העתקה" (לא ממוספר), "לחיצה מעתיקה" (לא ממוספר)
- **הנפשות:** הנפשה 46 `extNudge`, הנפשה 50 `frameSpin`, הנפשה 51 `gearSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot"><span class="who"><svg class="ic sm"><use href="#i-sparkle"></use></svg>תשובה<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="3" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span><p> … (המשך ב-index.html, "העתק HTML")
  ```

### בית 47 · `button.advfb`
- **איפה:** דף הבית (בית ×16) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** השכרות
- **וריאנטים (אותו בורר):** בית 19
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly"><div class="card res-one advp"><button class="advfb" data-adv-focus="rentals" type="button"><svg class="ic sm"><use href="#i-bag"></use></svg>השכרות</button></div></div>
  ```

### בית 53 · `div.bot.bub.err`
- **איפה:** דף הבית (בית ×2) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** תשובה החיפוש החכם לא הצליח. אפשר ל
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot err"><span class="who"><svg class="ic sm"><use href="#i-alert"></use></svg>תשובה<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="1" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span><p>החיפוש החכם לא הצליח. אפשר לנסות שוב.</p></div></div></div>
  ```

<a id="other"></a>
## שונות (פריט N)

### פריט 5 · `select`
- **איפה:** דף הבית (בית ×70) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** עמוד הבית ( / ) סיכום כספי ( /dash
- **וריאנטים (אותו בורר):** פריט 40
- **שלד HTML:**
  ```html
  <div class="demo"><select aria-label="עמוד"><option value="home">עמוד הבית ( / )</option><option value="dash">סיכום כספי ( /dashboard )</option></select></div>
  ```

### פריט 12 · `div.tb`
- **איפה:** בית · הזמנה (בית ×7 · הזמנה ×132) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 24
- **הנפשות:** הנפשה 42 `draw`, הנפשה 118 `pulse`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div class="info on pulse" id="toast"><div class="tb"><svg class="ic lg"><use href="#i-info"></use></svg></div></div>
  ```

### פריט 14 · `div.menu.open`
- **איפה:** כרטיס הזמנה (הזמנה ×1) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הדפסת סיכום ללקוח דף הכנה למחסן דף
- **הנפשות:** הנפשה 37 `dlgIn`, הנפשה 67 `ia-drive`, הנפשה 75 `ia-lift`, הנפשה 85 `ia-slide`, הנפשה 102 `icndrive`
- **שלד HTML:**
  ```html
  <div class="tools"><div class="menu open"><button data-ico="print" data-msg="סיכום הזמנה נשלח להדפסה"><svg class="ic ia-print ia-h ia-ov"><use href="#i-print"></use></svg>הדפסת סיכום ללקוח</button><button data-ico="file" data-msg="דף הכנה נשלח להדפסה"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg>דף הכנה למחסן</button><button data-ico="truck" data-msg="דף משלוח נשלח להדפסה"> … (המשך ב-index.html, "העתק HTML")
  ```

### פריט 15 · `div.menu`
- **איפה:** כרטיס הזמנה (הזמנה ×212) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הדפסת סיכום ללקוח דף הכנה למחסן דף
- **הנפשות:** הנפשה 37 `dlgIn`, הנפשה 67 `ia-drive`, הנפשה 75 `ia-lift`, הנפשה 85 `ia-slide`, הנפשה 102 `icndrive`
- **שלד HTML:**
  ```html
  <div class="tools"><div class="menu"><button data-ico="print" data-msg="סיכום הזמנה נשלח להדפסה"><svg class="ic ia-print ia-h ia-ov"><use href="#i-print"></use></svg>הדפסת סיכום ללקוח</button><button data-ico="file" data-msg="דף הכנה נשלח להדפסה"><svg class="ic ia-file ia-h"><use href="#i-file"></use></svg>דף הכנה למחסן</button><button data-ico="truck" data-msg="דף משלוח נשלח להדפסה"> … (המשך ב-index.html, "העתק HTML")
  ```

### פריט 18 · `span.cnt`
- **איפה:** כרטיס הזמנה (הזמנה ×47) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** 3
- **שלד HTML:**
  ```html
  <div class="tab"><span class="tico"><span class="cnt">3</span></span></div>
  ```

### פריט 20 · `span.missv`
- **איפה:** כרטיס הזמנה (הזמנה ×138) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חסר
- **וריאנטים (אותו בורר):** פריט 67
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f miss"><span class="missv"><svg class="ic sm ia-alert ia-h"><use href="#i-alert"></use></svg>חסר</span></div></div></div>
  ```

### פריט 21 · `span.hres-n`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** תוצאות 12
- **שלד HTML:**
  ```html
  <span class="hres-n">תוצאות <b>12</b></span>
  ```

### פריט 23 · `span.go`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 76
- **הנפשות:** הנפשה 70 `ia-flipy`, הנפשה 76 `ia-nD`
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="li rlink lrow"><span aria-hidden="true" class="go"><svg class="ic sm ia-chev ia-h"><use href="#i-chev"></use></svg></span></div></article></div>
  ```

### פריט 24 · `div.tb`
- **איפה:** כרטיס הזמנה (הזמנה ×132) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 12
- **הנפשות:** הנפשה 42 `draw`, הנפשה 118 `pulse`, הנפשה 125 `tdrain`
- **שלד HTML:**
  ```html
  <div class="charge on pulse" id="toast"><div class="tb"><svg class="ic lg"><use href="#i-plus"></use></svg></div></div>
  ```

### פריט 26 · `span.mico`
- **איפה:** כרטיס הזמנה (הזמנה ×48) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 94
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><span class="mico" style="--rph: 0ms;"><svg class="ic lg" style="animation-delay: 0ms;"><use href="#i-mail"></use></svg></span></div>
  ```

### פריט 27 · `div.mto-r`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מרים אברמוביץ חסר מייל
- **וריאנטים (אותו בורר):** פריט 96
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="mto"><div class="mto-r"><b>מרים אברמוביץ</b><span class="missv"><svg class="ic sm"><use href="#i-alert"></use></svg>חסר מייל</span></div></div></div>
  ```

### פריט 31 · `input`
- **איפה:** דף הבית (בית ×102) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** פריט 34
- **שלד HTML:**
  ```html
  <input aria-label="חיפוש לקוח, הזמנה או פריט" autocomplete="off" id="sq" value=""/>
  ```

### פריט 34 · `input`
- **איפה:** דף הבית (בית ×102) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** פריט 31
- **שלד HTML:**
  ```html
  <input autocomplete="off" placeholder="שאלת המשך…"/>
  ```

### פריט 40 · `select`
- **איפה:** דף הבית (בית ×70) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** סיכום: רגיל סיכום: אין תשלומים סיכ
- **וריאנטים (אותו בורר):** פריט 5
- **שלד HTML:**
  ```html
  <div class="demo"><select aria-label="מצב הסיכום"><option value="normal">סיכום: רגיל</option><option value="empty">סיכום: אין תשלומים</option><option value="loading">סיכום: טעינה הדרגתית</option><option value="error">סיכום: שגיאת שרת</option></select></div>
  ```

### פריט 44 · `div.ic-b`
- **איפה:** דף הבית (בית ×83) · **עור:** `gm-ds gm-home` (עור דף הבית)
- **וריאנטים (אותו בורר):** פריט 69
- **שלד HTML:**
  ```html
  <div class="list"><div class="li pend"><div class="ic-b"><svg class="ic"><use href="#i-clock"></use></svg></div></div></div>
  ```

### פריט 50 · `span.who`
- **איפה:** דף הבית (בית ×20) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** אני
- **וריאנטים (אותו בורר):** פריט 52
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub me"><span class="who"><svg class="ic sm"><use href="#i-user"></use></svg>אני<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="2" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span></div></div></div>
  ```

### פריט 52 · `span.who`
- **איפה:** דף הבית (בית ×20) · **עור:** `gm-ds gm-home` (עור דף הבית) · **טקסט לדוגמה:** תשובה
- **וריאנטים (אותו בורר):** פריט 50
- **טולטיפים:** "העתקה" (לא ממוספר)
- **הנפשות:** הנפשה 50 `frameSpin`
- **שלד HTML:**
  ```html
  <div class="hero-in jshell advonly aishell"><div class="card res-one advp aiw"><div class="bub bot err"><span class="who"><svg class="ic sm"><use href="#i-alert"></use></svg>תשובה<button aria-label="העתקת ההודעה" class="ibtn cpm" data-copymsg="1" data-tip="העתקה" type="button"><svg class="ic sm"><use href="#i-copy"></use></svg></button></span></div></div></div>
  ```

### פריט 58 · `div.today`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 59
- **רמזים עשירים:** רמז עשיר 2 `tl|now`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="today" style="--f:0.20"><button aria-describedby="rt" aria-label="היום" class="tip pinm" data-rich="tl|now" type="button"><svg class="ic"><use href="#i-pin"></use></svg></button></div></div>
  ```

### פריט 59 · `div.today`
- **איפה:** כרטיס הזמנה (הזמנה ×61) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 58
- **רמזים עשירים:** רמז עשיר 2 `tl|now`
- **הנפשות:** הנפשה 111 `nowpulse`, הנפשה 112 `nowpulseG`, הנפשה 113 `nowpulseN`, הנפשה 115 `popin`
- **שלד HTML:**
  ```html
  <div class="tx done hasnow"><div class="today" style="--f:0.20"><button aria-describedby="rt" aria-label="היום" class="tip pinm" data-ico="pin" data-rich="tl|now" type="button"><svg class="ic"><use href="#i-pin"></use></svg></button></div></div>
  ```

### פריט 60 · `div.card-h`
- **איפה:** כרטיס הזמנה (הזמנה ×438) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** אירוע
- **וריאנטים (אותו בורר):** פריט 64
- **טולטיפים:** טולטיפ 16 "עריכת תאריך"
- **הנפשות:** הנפשה 69 `ia-flip`, הנפשה 101 `ia-write`
- **שלד HTML:**
  ```html
  <div class="card"><div class="card-h"><div class="ico gold"><svg class="ic lg ia-cal ia-h"><use href="#i-cal"></use></svg></div><h2>אירוע</h2><button aria-label="עריכת תאריך" class="ibtn" data-ico="pencil" data-tip="עריכת תאריך"><svg class="ic ia-pencil ia-h ia-ov"><use href="#i-pencil"></use></svg></button></div></div>
  ```

### פריט 64 · `div.card-h`
- **איפה:** כרטיס הזמנה (הזמנה ×438) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** יעד
- **וריאנטים (אותו בורר):** פריט 60
- **הנפשות:** הנפשה 68 `ia-drop`
- **שלד HTML:**
  ```html
  <div class="card dfields"><div class="card-h"><div class="ico teal"><svg class="ic lg ia-pin ia-h"><use href="#i-pin"></use></svg></div><h2>יעד</h2></div></div>
  ```

### פריט 67 · `span.missv`
- **איפה:** כרטיס הזמנה (הזמנה ×138) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** חסר
- **וריאנטים (אותו בורר):** פריט 20
- **שלד HTML:**
  ```html
  <div class="card cust"><div class="kv"><div class="f miss"><span class="missv"><svg class="ic sm"><use href="#i-alert"></use></svg>חסר</span></div></div></div>
  ```

### פריט 68 · `div.grid2`
- **איפה:** כרטיס הזמנה (הזמנה ×81) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מספר דגם מידה 34 36 38 40 42 44
- **שלד HTML:**
  ```html
  <div class="addpanel"><div class="grid2"><div class="field"><label class="lbl" for="addModel">מספר דגם</label><div class="inpw"><svg class="ic sm"><use href="#i-dress"></use></svg><input autocomplete="off" class="inp" data-sug="model" inputmode="numeric" placeholder="מספר דגם..." value="4519"/><button aria-label="ניקוי" class="inpx" data-inpx="addModel" type="button"><svg class="ic sm"><use href="#i-x"></use></svg> … (המשך ב-index.html, "העתק HTML")
  ```

### פריט 69 · `div.ic-b`
- **איפה:** כרטיס הזמנה (הזמנה ×878) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 44
- **הנפשות:** הנפשה 94 `ia-sway`
- **שלד HTML:**
  ```html
  <div class="list"><div class="li"><div class="ic-b"><svg class="ic ia-dress ia-h"><use href="#i-dress"></use></svg></div></div></div>
  ```

### פריט 76 · `span.go`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 23
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="li rlink lrow"><span aria-hidden="true" class="go"><svg class="ic sm"><use href="#i-chev"></use></svg></span></div></article></div>
  ```

### פריט 81 · `div.hdet-in`
- **איפה:** כרטיס הזמנה (הזמנה ×597) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** דגם 4512 מידה 38 סטטוס טרם נמסרה מ
- **שלד HTML:**
  ```html
  <div class="hres"><article class="hrow irow"><div class="hdet"><div class="hdet-in"><div class="hv-r"><small>דגם</small><b><bdi>4512</bdi></b></div><div class="hv-r"><small>מידה</small><b>38</b></div><div class="hv-r"><small>סטטוס</small><b>טרם נמסרה</b></div><div class="hv-r"><small>מחיר</small><b><bdi dir="ltr">₪150</bdi></b></div><div class="hv-r"><small>פרטי הוספה</small><b>אתמול · רחל כהן</b></div> … (המשך ב-index.html, "העתק HTML")
  ```

### פריט 84 · `div.dbtns`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחק הזמנה ביטול
- **וריאנטים (אותו בורר):** פריט 91
- **הנפשות:** הנפשה 47 `fade`, הנפשה 48 `fadein`
- **שלד HTML:**
  ```html
  <div class="scrim on" id="scrim"><div class="dbtns"><button class="btn primary lg block"><svg class="ic"><use href="#i-trash"></use></svg>מחק הזמנה</button><button class="btn ghost block"><svg class="ic sm"><use href="#i-x"></use></svg>ביטול</button></div></div>
  ```

### פריט 91 · `div.dbtns`
- **איפה:** כרטיס הזמנה (הזמנה ×72) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מחק הזמנה ביטול
- **וריאנטים (אותו בורר):** פריט 84
- **הנפשות:** הנפשה 74 `ia-lid`, הנפשה 82 `ia-ring`, הנפשה 89 `ia-spin90`, הנפשה 91 `ia-spinx`, הנפשה 99 `ia-wave`, הנפשה 104 `icnshake`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="dbtns"><button class="btn primary lg block" data-ico="trash"><svg class="ic ia-trash ia-h" style="--ia-dl: 0ms;"><use href="#i-trash"></use></svg>מחק הזמנה</button><button class="btn ghost block" data-ico="x"><svg class="ic sm ia-x ia-h" style="--ia-dl: 40ms;"><use href="#i-x"></use></svg>ביטול</button></div></div>
  ```

### פריט 94 · `span.mico`
- **איפה:** כרטיס הזמנה (הזמנה ×48) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 26
- **הנפשות:** הנפשה 75 `ia-lift`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><span class="mico" style="--rph: 0ms;"><svg class="ic lg ia-mail ia-h" style="animation-delay: 0ms; --ia-dl: 0ms;"><use href="#i-mail"></use></svg></span></div>
  ```

### פריט 96 · `div.mto-r`
- **איפה:** כרטיס הזמנה (הזמנה ×66) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** מרים אברמוביץ חסר מייל
- **וריאנטים (אותו בורר):** פריט 27
- **הנפשות:** הנפשה 82 `ia-ring`
- **שלד HTML:**
  ```html
  <div class="scrim" id="scrim"><div class="mto"><div class="mto-r"><b>מרים אברמוביץ</b><span class="missv"><svg class="ic sm ia-alert ia-h" style="--ia-dl: 80ms;"><use href="#i-alert"></use></svg>חסר מייל</span></div></div></div>
  ```

### פריט 99 · `div.rr1`
- **איפה:** כרטיס הזמנה (הזמנה ×233) · **עור:** `gm-ds` (עור הבסיס) · **טקסט לדוגמה:** הלוך-חזור · ירושלים
- **וריאנטים (אותו בורר):** פריט 100
- **שלד HTML:**
  ```html
  <div class="gold on"><div class="rr1"><svg class="ic sm"><use href="#i-truck"></use></svg><span>הלוך-חזור · ירושלים</span></div></div>
  ```

### פריט 100 · `div.rr1`
- **איפה:** כרטיס הזמנה (הזמנה ×233) · **עור:** `gm-ds` (עור הבסיס)
- **וריאנטים (אותו בורר):** פריט 99
- **שלד HTML:**
  ```html
  <div class="gold on"><div class="rr1"><svg class="ic sm"><use href="#i-pin"></use></svg><span></span></div></div>
  ```

<a id="anim"></a>
## הנפשות (הנפשה N)

שם ה-keyframes ב-`components.css` הוא השם המקורי עם הקידומת `gm-` (הנפשה 47 `fade` → `@keyframes gm-fade`). המשך/עקומה/חזרות כפי שנצפו; "רחיפה על אייקון" = מופעל דרך `--ia-a` על `svg.ic.ia-<icon>.ia-h`.

| מס׳ | שם | דפים | משך · עקומה · חזרות | הפעלה | בוררים (עד 3) | אייקונים |
|---|---|---|---|---|---|---|
| הנפשה 1 | `advDot` | בית | 1.0s · ease-in-out · infinite | לולאה | `.advp .advdots b` | — |
| הנפשה 2 | `advErase` | בית | 0.6s · ease-in-out · 1 | רחיפה / מיקוד | `.advp .advact .lrow:hover .ic,.advp .advact .lrow:focus-visible .ic` | — |
| הנפשה 3 | `advFlBounce` | בית | 0.6s · cubic-bezier(.3,1.5,.5,1) · 1 | רחיפה / מיקוד | `.advp .advfl:hover[data-adv-flag="debts"] .advfl-i` | — |
| הנפשה 4 | `advFlFlip` | בית | 0.6s · ease-in-out · 1 | רחיפה / מיקוד | `.advp .advfl:hover[data-adv-flag="credits"] .advfl-i` | — |
| הנפשה 5 | `advFlIn` | בית | 0.5s · cubic-bezier(.2,1.4,.3,1) · 1 | טעינה / הופעה | `.advp.adv-in .advfl` | — |
| הנפשה 6 | `advFlPop` | בית | 0.5s · cubic-bezier(.2,1.6,.3,1) · 1 | כניסה / שינוי מצב | `.advp .advfl.on .advfl-i` | — |
| הנפשה 7 | `advFlRing` | בית | 0.55s · ease-out · 1 | כניסה / שינוי מצב | `.advp .advfl.on` | — |
| הנפשה 8 | `advFlSpin` | בית | 0.7s · cubic-bezier(.4,0,.2,1) · 1 | רחיפה / מיקוד | `.advp .advfl:hover[data-adv-flag="badreturn"] .advfl-i` | — |
| הנפשה 9 | `advFlWave` | בית | 0.7s · ease-in-out · 1 | רחיפה / מיקוד | `.advp .advfl:hover[data-adv-flag="nodetails"] .advfl-i` | — |
| הנפשה 10 | `advIn` | בית | 0.5s · cubic-bezier(.22,1,.36,1) · 1 | טעינה / הופעה | `.advp.adv-in>*` | — |
| הנפשה 11 | `advListIn` | בית + הזמנה | 0.18s · cubic-bezier(.22,1,.36,1) · 1 | טעינה / הופעה | `.advp .advlist`<br>`.advp .advdp`<br>`.advlist` | — |
| הנפשה 12 | `advOrbit` | בית | 1.2s · ease-in-out · infinite | לולאה | `.advp .advmag` | — |
| הנפשה 13 | `advPlusHint` | בית | 2.6s · ease-in-out · 2 | טעינה / הופעה | `.advp .advplus` | — |
| הנפשה 14 | `advSwing` | בית | 0.7s · ease-in-out · 1 | רחיפה / מיקוד | `.advp .advact .btn.primary:hover .ic,.advp .advact .btn.primary:focus-visible .i` | — |
| הנפשה 15 | `advTwinkle` | בית | 0.8s · ease-in-out · 1 | רחיפה / מיקוד | `.advp .advact .btn.smart:hover .ic,.advp .advact .btn.smart:focus-visible .ic` | — |
| הנפשה 16 | `advWarn` | בית | 3.0s · ease-in-out · infinite | לולאה | `.advp .advs[aria-label="דרוש טיפול"] .advs-i .ic` | — |
| הנפשה 17 | `advWarnRing` | בית | 3.0s · ease-out · infinite | לולאה | `.advp .advs[aria-label="דרוש טיפול"] .advs-i::after` | — |
| הנפשה 18 | `advpOpen` | בית | 0.4s · cubic-bezier(.22,1,.36,1) · 1 | טעינה / הופעה | `.advp.advp-open` | — |
| הנפשה 19 | `aiDot` | בית | 1.1s · cubic-bezier(.45,0,.35,1) · infinite | לולאה | `.typing span` | — |
| הנפשה 20 | `ashake` | בית + הזמנה | 0.45s · ease · 1 | טעינה / הופעה | `.acodes.shake` | — |
| הנפשה 21 | `barDraw` | הזמנה | 0.6s · ease · 1 | טעינה / הופעה | `.sec-h::after,.cart-h::after` | — |
| הנפשה 22 | `barShine` | הזמנה | 2.4s · ease-in-out · 2 | טעינה / הופעה | `.sec-h::before,.cart-h::before` | — |
| הנפשה 23 | `barShine2` | הזמנה | 2.4s · ease-in-out · 1 | רחיפה / מיקוד | `.sec-h:hover::before,.cart-h:hover::before` | — |
| הנפשה 24 | `cartbounce` | בית + הזמנה | 0.5s · ease · 1 | רחיפה / מיקוד · כניסה / שינוי מצב · טעינה / הופעה | `[data-ico=cart]:is(:hover,:focus-visible)>.ic:first-child`<br>`.cart-t.bump>.ic:first-child`<br>`.cb-pin.bounce` | — |
| הנפשה 25 | `cbin` | הזמנה | 0.18s · ease · 1 | טעינה / הופעה | `.cb-p` | — |
| הנפשה 26 | `cbsheet` | הזמנה | 0.25s · ease · 1 | טעינה / הופעה | `.cb-p` | — |
| הנפשה 27 | `chevBob` | הזמנה | 0.7s · ease-in-out · infinite | לולאה | `body .app .coll>summary:is(:hover,:focus-visible) .chev` | — |
| הנפשה 28 | `collShine` | הזמנה | 0.8s · ease-out · 1 | רחיפה / מיקוד | `body .app .coll>summary:is(:hover,:focus-visible)::after` | — |
| הנפשה 29 | `dk-breathe` | בית + הזמנה | 3.0s · ease-in-out · infinite | לולאה | `.success .big-ck svg` | — |
| הנפשה 30 | `dk-float` | בית + הזמנה | 2.8s · ease-in-out · infinite | לולאה | `.dbadge svg` | — |
| הנפשה 31 | `dk-lid` | בית + הזמנה | -s · ease · 1 | לפי הקשר |  | — |
| הנפשה 32 | `dk-ring` | בית + הזמנה | 2.4s · ease-out · infinite | לולאה | `:is(.dbadge,.big-ck,.ashield,.mico)::after` | — |
| הנפשה 33 | `dk-tilt` | בית + הזמנה | -s · ease · 1 | לפי הקשר |  | — |
| הנפשה 34 | `dk-write` | בית + הזמנה | -s · ease · 1 | לפי הקשר |  | — |
| הנפשה 35 | `dlBob` | בית + הזמנה | 0.8s · ease-in-out · infinite | לולאה | `.xlbtn:is(:hover,:focus-visible) .dl-arrow`<br>`.advp .card-h .ibtn.hdd:is(:hover,:focus-visible) .dl-arrow` | — |
| הנפשה 36 | `dlgDraw` | בית + הזמנה | 0.7s · ease · 1 | טעינה / הופעה | `.dbadge svg` | — |
| הנפשה 37 | `dlgIn` | בית + הזמנה | 0.2s · ease · 1 | כניסה / שינוי מצב · טעינה / הופעה | `.scrim.on :is(#dlg,#dlg2)`<br>`.menu` | — |
| הנפשה 38 | `dlgPop` | בית + הזמנה | 0.5s · ease · 1 | טעינה / הופעה | `:is(#dlg,#dlg2):not(.mailwin)>.dbadge`<br>`.success .big-ck`<br>`:is(#dlg,#dlg2)>.dbadge` | — |
| הנפשה 39 | `dlgRow` | בית + הזמנה | 0.34s · ease · 1 | טעינה / הופעה | `:is(#dlg,#dlg2):not(.mailwin)>*`<br>`:is(#dlg,#dlg2) .chg .c`<br>`:is(#dlg,#dlg2)>*` | — |
| הנפשה 40 | `dlgSheet` | בית + הזמנה | 0.3s · ease · 1 | כניסה / שינוי מצב | `.scrim.on :is(#dlg,#dlg2):not(.mailwin)`<br>`.scrim.on :is(#dlg,#dlg2)` | — |
| הנפשה 41 | `dlgShine` | בית + הזמנה | 0.8s · ease · 1 | רחיפה / מיקוד | `:is(#dlg,#dlg2) :is(.btn.primary,.btn.green):hover::before` | — |
| הנפשה 42 | `draw` | בית + הזמנה | 0.5s · ease · 1 | כניסה / שינוי מצב · טעינה / הופעה | `.success .big-ck svg`<br>`.tx.fresh .ck svg`<br>`#toast.on .tb svg` | — |
| הנפשה 43 | `dtPop` | הזמנה | 0.5s · cubic-bezier(.2,1.4,.3,1) · 1 | כניסה / שינוי מצב | `#delToggle.on .dtico` | — |
| הנפשה 44 | `dtWig` | הזמנה | 0.6s · ease-in-out · 1 | רחיפה / מיקוד | `#delToggle:is(:hover,:focus-visible) .dtico` | — |
| הנפשה 45 | `evDraw` | הזמנה | 0.35s · ease-out · 1 | טעינה / הופעה | `body .app #evType .evck,body .app #delOneBtn .evck,body .app #termsBtn .evck,bod`<br>`body .app .btn[data-act="mail-open"] .evck,body .app #evType .evck,body .app #te` | — |
| הנפשה 46 | `extNudge` | בית | 0.9s · ease-in-out · infinite | לולאה | `.advp.aiw .bub-acts .lrow[data-open]:is(:hover,:focus-visible) .ic` | — |
| הנפשה 47 | `fade` | בית + הזמנה | 0.25s · ease · 1 | טעינה / הופעה · כניסה / שינוי מצב | `.panel`<br>`.scrim.on` | — |
| הנפשה 48 | `fadein` | בית + הזמנה | 0.2s · ease · 1 | כניסה / שינוי מצב · טעינה / הופעה | `.tx .now`<br>`.cb.open::after`<br>`.scrim.on` | — |
| הנפשה 49 | `frameIn` | בית | 0.45s · ease · 1 | טעינה / הופעה | `.hero-trans .jshell` | — |
| הנפשה 50 | `frameSpin` | בית + הזמנה | 3.2s · linear · infinite | לולאה | `.stepper::after`<br>`:is(.card,.itm,.dhero,.creditile):is(:hover,:focus-within)::after,.shine-on::aft`<br>`.jshell:is(:hover,:focus-within)::after` | — |
| הנפשה 51 | `gearSpin` | בית | 1.6s · linear · infinite | לולאה | `.advp.aiw .bub-acts .lrow[data-act="setting"]:is(:hover,:focus-visible) .ic` | — |
| הנפשה 52 | `heroIn` | בית | 0.9s · cubic-bezier(.22,1,.36,1) · 1 | טעינה / הופעה | `.hero-enter .t-hi`<br>`.hero-enter .t-q`<br>`.hero-enter .srch` | — |
| הנפשה 53 | `hf-mk` | בית + הזמנה | 0.6s · ease · 1 | טעינה / הופעה | `.hf-mk` | — |
| הנפשה 54 | `hf-out` | בית + הזמנה | 0.18s · ease · 1 | כניסה / שינוי מצב | `.hf-pill.out` | — |
| הנפשה 55 | `hf-row` | בית + הזמנה | 0.28s · ease · 1 | כניסה / שינוי מצב | `.hf-sel.on .hf-o` | — |
| הנפשה 56 | `hfPiPop` | הזמנה | 0.5s · cubic-bezier(.2,1.4,.3,1) · 1 | טעינה / הופעה | `.hf-pill .hf-pi` | — |
| הנפשה 57 | `hfPiSpin` | הזמנה | 0.4s · ease-out · 1 | רחיפה / מיקוד | `.hf-pill:is(:hover,:focus-visible) svg.ic:last-child` | — |
| הנפשה 58 | `hfPiWig` | הזמנה | 0.6s · ease-in-out · 1 | רחיפה / מיקוד | `.hf-pill:is(:hover,:focus-visible) .hf-pi` | — |
| הנפשה 59 | `ia-badge` | בית + הזמנה | 0.7s · ease · 1 | רחיפה / מיקוד | `:is(#dlg,#dlg2) :is(.ashield,.mico).ia-bg:not(#_)` | — |
| הנפשה 60 | `ia-blink` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-eye` | eye |
| הנפשה 61 | `ia-bob` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-users` | users |
| הנפשה 62 | `ia-breathe` | בית + הזמנה | 3.4s · ease-in-out · infinite | לולאה | `.scrim.on .ashield svg.ic:not(.ia-in):not(:hover):not(.ia-err):not(#_)` | — |
| הנפשה 63 | `ia-burst` | בית + הזמנה | 0.7s · ease · 1 | רחיפה / מיקוד | `.ia-burst` | — |
| הנפשה 64 | `ia-cart` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-cart` | cart |
| הנפשה 65 | `ia-clipw` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-clip` | clip |
| הנפשה 66 | `ia-draw` | בית + הזמנה | 0.36s · ease · 1 | טעינה / הופעה · רחיפה על אייקון · רחיפה / מיקוד | `.hf-o[aria-selected=true] .hf-ck svg.ic`<br>`.ia-check`<br>`svg.ic.ia-in.ia-dr` | check |
| הנפשה 67 | `ia-drive` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-truck` | truck |
| הנפשה 68 | `ia-drop` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-pin` | pin |
| הנפשה 69 | `ia-flip` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-cal` | cal |
| הנפשה 70 | `ia-flipy` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-chev` | chev |
| הנפשה 71 | `ia-float` | בית + הזמנה | 2.8s · ease-in-out · infinite | לולאה | `.scrim.on .mico svg.ic:not(.ia-in):not(:hover):not(#_)`<br>`.scrim.on #m-send:not(:disabled):not(:hover):not(:focus-visible) svg.ic:not(.ia-` | — |
| הנפשה 72 | `ia-hop` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-home` | home |
| הנפשה 73 | `ia-in` | בית + הזמנה | 0.32s · ease · 1 | רחיפה / מיקוד | `svg.ic.ia-in` | — |
| הנפשה 74 | `ia-lid` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-trash` | trash |
| הנפשה 75 | `ia-lift` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-box`<br>`.ia-bag`<br>`.ia-gift` | bag, box, file, gift, mail, note |
| הנפשה 76 | `ia-nD` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-chev` | chev |
| הנפשה 77 | `ia-nL` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-arrl`<br>`.ia-back` | arrl, back |
| הנפשה 78 | `ia-nR` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-arrr`<br>`.ia-logout`<br>`.ia-list` | arrr, list, logout |
| הנפשה 79 | `ia-nUR` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-ext`<br>`.ia-send` | ext, send |
| הנפשה 80 | `ia-nod` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-user`<br>`.ia-userck` | user, userck |
| הנפשה 81 | `ia-pulse` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-info`<br>`.ia-shield`<br>`.ia-msg` | info, msg, shield, star |
| הנפשה 82 | `ia-ring` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-bell`<br>`.ia-phone`<br>`.ia-alert` | alert, bell, lock, phone, trash |
| הנפשה 83 | `ia-send` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-send` | send |
| הנפשה 84 | `ia-shk` | בית + הזמנה | 0.55s · ease · 1 | רחיפה על אייקון · כניסה / שינוי מצב | `.ia-shield`<br>`.ia-lock`<br>`.scrim.on .ashield svg.ic.ia-err:not(#_)` | lock, shield |
| הנפשה 85 | `ia-slide` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-print`<br>`.ia-scan` | print, scan |
| הנפשה 86 | `ia-snip` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-scissors` | scissors |
| הנפשה 87 | `ia-spin` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-gear` | gear |
| הנפשה 88 | `ia-spin360` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-refresh`<br>`.ia-redo` | redo, refresh |
| הנפשה 89 | `ia-spin90` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-plus`<br>`.ia-x`<br>`.ia-sun` | plus, sun, x |
| הנפשה 90 | `ia-spinp` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-plus` | plus |
| הנפשה 91 | `ia-spinx` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-x` | x |
| הנפשה 92 | `ia-squash` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-arrlr`<br>`.ia-minus`<br>`.ia-menu` | arrlr, menu, minus |
| הנפשה 93 | `ia-swap` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-swap` | swap |
| הנפשה 94 | `ia-sway` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-dress` | dress |
| הנפשה 95 | `ia-tick` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-clock` | clock |
| הנפשה 96 | `ia-tilt` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-card`<br>`.ia-cheque`<br>`.ia-cash` | bank, bk, card, cash, cheque, wallet |
| הנפשה 97 | `ia-tiltf` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-sliders` | sliders |
| הנפשה 98 | `ia-undo` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-undo` | undo |
| הנפשה 99 | `ia-wave` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-flag`<br>`.ia-tag`<br>`.ia-lock` | clip, flag, lock, tag, trash |
| הנפשה 100 | `ia-wig` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-search`<br>`.ia-sliders` | search, sliders |
| הנפשה 101 | `ia-write` | בית + הזמנה | -s · ease · 1 | רחיפה על אייקון | `.ia-pencil`<br>`.ia-sig`<br>`.ia-list` | list, pencil, sig |
| הנפשה 102 | `icndrive` | בית + הזמנה | 0.4s · ease · 1 | רחיפה / מיקוד | `[data-ico=truck]:is(:hover,:focus-visible)>.ic`<br>`.gl.del:is(:hover,:focus-visible) .ic` | — |
| הנפשה 103 | `icnpop` | בית + הזמנה | 0.35s · ease · 1 | רחיפה / מיקוד | `[data-ico=check]:is(:hover,:focus-visible)>.ic`<br>`.gl.sig:is(:hover,:focus-visible) .ic`<br>`#toast .tbtn:is(:hover,:focus-visible) .ic` | — |
| הנפשה 104 | `icnshake` | בית + הזמנה | 0.4s · ease · 1 | רחיפה / מיקוד | `[data-ico=trash]:is(:hover,:focus-visible)>.ic` | — |
| הנפשה 105 | `icoTilt` | הזמנה | 0.6s · ease-in-out · 1 | רחיפה / מיקוד | `body .app .coll>summary:is(:hover,:focus-visible)>.ic:first-child`<br>`body .app .btn:is(:hover,:focus-visible) .ic:not(.evck),body .app .ibtn:is(:hove` | — |
| הנפשה 106 | `mspin` | בית + הזמנה | 0.7s · linear · infinite | לולאה | `.mspin` | — |
| הנפשה 107 | `nb-in` | בית + הזמנה | 0.32s · ease · 1 | כניסה / שינוי מצב | `.nb-w.in` | — |
| הנפשה 108 | `nb-wig` | בית + הזמנה | 4.0s · ease-in-out · infinite | לולאה | `.nb-ic`<br>`.nb-alert .nb-ic` | — |
| הנפשה 109 | `nf-in` | בית + הזמנה | 0.4s · ease · 1 | טעינה / הופעה | `.nf-row.nf-new` | — |
| הנפשה 110 | `nf-ring` | בית + הזמנה | 0.9s · ease · 1 | טעינה / הופעה | `.sn-ib.nf-ring>svg` | — |
| הנפשה 111 | `nowpulse` | בית + הזמנה | 1.8s · ease-in-out · infinite | לולאה | `.tx.cur .dot`<br>`.tx .today .pinm` | — |
| הנפשה 112 | `nowpulseG` | בית + הזמנה | 1.8s · ease-in-out · infinite | לולאה | `.tx.cur .dot`<br>`.tx .today .pinm` | — |
| הנפשה 113 | `nowpulseN` | בית + הזמנה | 1.8s · ease-in-out · infinite | לולאה | `.tx.cur .dot`<br>`.tx .today .pinm` | — |
| הנפשה 114 | `pop` | בית + הזמנה | 0.35s · ease · 1 | טעינה / הופעה · כניסה / שינוי מצב | `.dlg`<br>`.success .big-ck`<br>`.scrim.on .dlg` | — |
| הנפשה 115 | `popin` | בית + הזמנה | 0.45s · ease · 1 | טעינה / הופעה · כניסה / שינוי מצב | `.tx.fresh .ck`<br>`.tx .today b`<br>`.stat.fresh .chip` | — |
| הנפשה 116 | `prtFeed` | בית + הזמנה | 0.9s · ease-in-out · infinite | לולאה | `.xlbtn:is(:hover,:focus-visible) .prt-sheet`<br>`.advp .card-h .ibtn.hdp:is(:hover,:focus-visible) .prt-sheet` | — |
| הנפשה 117 | `prtTop` | בית + הזמנה | 0.9s · ease-in-out · infinite | לולאה | `.xlbtn:is(:hover,:focus-visible) .prt-top`<br>`.advp .card-h .ibtn.hdp:is(:hover,:focus-visible) .prt-top` | — |
| הנפשה 118 | `pulse` | בית + הזמנה | 0.6s · ease · 1 | כניסה / שינוי מצב · לולאה | `#toast.pulse .tb`<br>`.typing span` | — |
| הנפשה 119 | `resIn` | בית | 0.55s · cubic-bezier(.22,1,.36,1) · 1 | טעינה / הופעה | `.hero-trans .jshell .res-one` | — |
| הנפשה 120 | `rowin` | בית + הזמנה | 0.32s · ease · 1 | טעינה / הופעה · כניסה / שינוי מצב | `.itm.enter`<br>`.cl.enter`<br>`.cart-actions.enter` | — |
| הנפשה 121 | `rowout` | הזמנה | 0.22s · ease · 1 | כניסה / שינוי מצב | `.itm.leaving`<br>`.cl.leaving` | — |
| הנפשה 122 | `snpulse` | בית + הזמנה | 2.0s · ease · infinite | לולאה | `.sn-clock i` | — |
| הנפשה 123 | `tabin` | בית + הזמנה | 0.18s · ease · 1 | טעינה / הופעה | `.panel` | — |
| הנפשה 124 | `tcollapse` | בית + הזמנה | 0.26s · ease-in · 1 | כניסה / שינוי מצב | `#toast.out::after` | — |
| הנפשה 125 | `tdrain` | בית + הזמנה | 6.5s · linear · 1 | כניסה / שינוי מצב | `#toast.on::after` | — |
| הנפשה 126 | `tilepop` | בית + הזמנה | 0.45s · ease · 1 | כניסה / שינוי מצב | `.status.pop`<br>`.gl.pop,.gl.pay.pop`<br>`.cart-info.pop` | — |
| הנפשה 127 | `trWig` | הזמנה | 0.6s · ease-in-out · infinite | לולאה | `.tools .xlbtn.xld:is(:hover,:focus-visible) .dlic`<br>`.tools .xlbtn.xlg:is(:hover,:focus-visible) .xlic` | — |
| הנפשה 128 | `ubPulse` | בית + הזמנה | 0.25s · ease · 1 | רחיפה / מיקוד | `#dlg .dbtns .btn.ghost:active::after`<br>`:is(#dlg,#dlg2) :is(.btn,.ibtn,.methods button,.opt):active::after,#toast .tbtn:` | — |
| הנפשה 129 | `ubShine` | בית + הזמנה | 0.7s · ease-out · 1 | רחיפה / מיקוד | `#dlg .dbtns .btn.ghost:is(:hover,:focus-visible)::after`<br>`:is(#dlg,#dlg2) :is(.btn,.ibtn,.methods button,.opt):is(:hover,:focus-visible)::` | — |

<a id="color"></a>
## צבעים וטוקנים (צבע N)

הטוקנים האמיתיים של שני הדפים (משתני `:root`). ב-`tokens.css` כל שם מקבל את הקידומת `--gm-` וזמין בכל דף של האתר; בתוך שורש `gm-ds` השם המקורי עובד גם כן (גשר תאימות).

| מס׳ | שם מקורי | שם באתר | ערך |
|---|---|---|---|
| צבע 1 | `--navy-900` | `--gm-navy-900` | `#0a2242` |
| צבע 2 | `--navy` | `--gm-navy` | `#0f2c52` |
| צבע 3 | `--navy-700` | `--gm-navy-700` | `#173c6b` |
| צבע 4 | `--navy-500` | `--gm-navy-500` | `#2b5a94` |
| צבע 5 | `--sky-50` | `--gm-sky-50` | `#eef0f2` |
| צבע 6 | `--sky-100` | `--gm-sky-100` | `#d3d7dc` |
| צבע 7 | `--sky-200` | `--gm-sky-200` | `#d3d7dc` |
| צבע 8 | `--sky-300` | `--gm-sky-300` | `#bcc2c8` |
| צבע 9 | `--sky-400` | `--gm-sky-400` | `#7fb8e6` |
| צבע 10 | `--gold-50` | `--gm-gold-50` | `#fff6f2` |
| צבע 11 | `--gold-100` | `--gm-gold-100` | `#ffece5` |
| צבע 12 | `--gold-300` | `--gm-gold-300` | `#e0c56e` |
| צבע 13 | `--gold` | `--gm-gold` | `#c9a227` |
| צבע 14 | `--gold-b` | `--gm-gold-b` | `#b8912f` |
| צבע 15 | `--gold-d` | `--gm-gold-d` | `#9a7a1f` |
| צבע 16 | `--gold-700` | `--gm-gold-700` | `#a83d6c` |
| צבע 17 | `--rose-50` | `--gm-rose-50` | `#fff6f2` |
| צבע 18 | `--rose-100` | `--gm-rose-100` | `#ffece5` |
| צבע 19 | `--rose-200` | `--gm-rose-200` | `#fdd9cc` |
| צבע 20 | `--rose-300` | `--gm-rose-300` | `#fbbfa9` |
| צבע 21 | `--rose-500` | `--gm-rose-500` | `#e8785a` |
| צבע 22 | `--rose-700` | `--gm-rose-700` | `#a8442a` |
| צבע 23 | `--pink-300` | `--gm-pink-300` | `#fbbfa9` |
| צבע 24 | `--pink-500` | `--gm-pink-500` | `#fa9e84` |
| צבע 25 | `--pink-d` | `--gm-pink-d` | `#f38a6b` |
| צבע 26 | `--pbtn` | `--gm-pbtn` | `#fa9e84` |
| צבע 27 | `--gbtn` | `--gm-gbtn` | `linear-gradient(135deg,#d9b84a 0%,#b8912f 100%)` |
| צבע 28 | `--gbtn-d` | `--gm-gbtn-d` | `#9a7a1f` |
| צבע 29 | `--bg` | `--gm-bg` | `var(--sky-200)` |
| צבע 30 | `--surface` | `--gm-surface` | `#fff` |
| צבע 31 | `--surface2` | `--gm-surface2` | `var(--sky-50)` |
| צבע 32 | `--line` | `--gm-line` | `var(--sky-300)` |
| צבע 33 | `--line2` | `--gm-line2` | `var(--sky-100)` |
| צבע 34 | `--ink` | `--gm-ink` | `var(--navy-900)` |
| צבע 35 | `--ink2` | `--gm-ink2` | `#2f4a6b` |
| צבע 36 | `--ink3` | `--gm-ink3` | `#4d6787` |
| צבע 37 | `--brand` | `--gm-brand` | `var(--navy)` |
| צבע 38 | `--brand-d` | `--gm-brand-d` | `var(--navy-900)` |
| צבע 39 | `--brand-t` | `--gm-brand-t` | `var(--sky-100)` |
| צבע 40 | `--gold-t` | `--gm-gold-t` | `var(--gold-100)` |
| צבע 41 | `--green` | `--gm-green` | `var(--navy)` |
| צבע 42 | `--green-t` | `--gm-green-t` | `var(--sky-200)` |
| צבע 43 | `--blue` | `--gm-blue` | `var(--navy-500)` |
| צבע 44 | `--blue-t` | `--gm-blue-t` | `var(--sky-100)` |
| צבע 45 | `--amber` | `--gm-amber` | `var(--rose-700)` |
| צבע 46 | `--amber-t` | `--gm-amber-t` | `var(--rose-100)` |
| צבע 47 | `--red` | `--gm-red` | `var(--gold-700)` |
| צבע 48 | `--red-t` | `--gm-red-t` | `var(--gold-100)` |
| צבע 49 | `--teal` | `--gm-teal` | `var(--navy-500)` |
| צבע 50 | `--teal-t` | `--gm-teal-t` | `var(--sky-200)` |
| צבע 51 | `--plum` | `--gm-plum` | `var(--rose-700)` |
| צבע 52 | `--plum-t` | `--gm-plum-t` | `var(--rose-100)` |
| צבע 53 | `--navy2` | `--gm-navy2` | `var(--navy-700)` |
| צבע 54 | `--r` | `--gm-r` | `16px` |
| צבע 55 | `--r-sm` | `--gm-r-sm` | `12px` |
| צבע 56 | `--sh` | `--gm-sh` | `0 1px 2px rgba(15,44,82,.06),0 8px 24px -10px rgba(15,44,82,.22)` |
| צבע 57 | `--sh-lg` | `--gm-sh-lg` | `0 20px 60px -15px rgba(10,34,66,.5)` |
| צבע 58 | `--s1` | `--gm-s1` | `8px` |
| צבע 59 | `--s2` | `--gm-s2` | `16px` |
| צבע 60 | `--s3` | `--gm-s3` | `24px` |
| צבע 61 | `--s4` | `--gm-s4` | `32px` |
| צבע 62 | `--ease` | `--gm-ease` | `cubic-bezier(.22,1,.36,1)` |
| צבע 63 | `--spring` | `--gm-spring` | `cubic-bezier(.2,1.3,.3,1)` |
| צבע 64 | `--snav-h` | `--gm-snav-h` | `64px` |
| צבע 65 | `--gold-rich-c` | `--gm-gold-rich-c` | `#d4b04a` |
| צבע 66 | `--gold-rich-h` | `--gm-gold-rich-h` | `#ecd074` |
| צבע 67 | `--gold-rich` | `--gm-gold-rich` | `linear-gradient(145deg,rgba(255,244,196,.55) 0%,rgba(255,244,196,0) 46%,rgba(120,84,0,.2) 100%)` |
| צבע 68 | `--gold-light` | `--gm-gold-light` | `#f4e8c1` |
| צבע 69 | `--card-bw` | `--gm-card-bw` | `2px` |
| צבע 70 | `--card-line` | `--gm-card-line` | `var(--navy)` |
| צבע 71 | `--bg-dur` | `--gm-bg-dur` | `180ms` |

## סיכום המספור

- כללי CSS ב-components.css: 2207 בעור הבסיס + 1959 בעור דף הבית · keyframes: 129 · אייקונים: 71 · טוקנים: 71
- הפריטים הממוספרים בקטלוג הזה זהים אחד לאחד לפריטי דף הפלטה (`public/design-system/index.html`).
