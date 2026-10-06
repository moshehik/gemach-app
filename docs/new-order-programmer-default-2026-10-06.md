# הזמנה חדשה: האשף החדש (A5) כברירת מחדל למתכנת (6.10.2026)

שאלת הבעלים: "למה העיצוב החדש לא עולה בהזמנה חדשה?". התשובה: המסך `new_order` נרשם ב-`lib/uiVariantScreens.js` עם
`newExists:false` / `selfSwitch:false`, כלומר אין לו ברירת מחדל לפי תפקיד ואין אייקון מעבר, וההדלקה הייתה אפשרית רק בסקריפט.
מ-6.10.2026 הוא מתנהג בדיוק כמו `order_card` / `customer_card`.

## מה השתנה

| קובץ | שינוי |
|---|---|
| `lib/uiVariantScreens.js` | `new_order`: `newExists:true`, `selfSwitch:true`. `routes:['/orders/new']`. `/orders/new` נשאר ב-`excludeRoutes` של `order_card`, ולכן `/orders/:id` לא תופס אותו ולהפך |
| `app/components/new-order/NewOrderSwitch.js` | שני הענפים עטופים ב-`VariantFrame` (בישן: אייקון בפינה, דרך portal, בלי לגעת בקובץ הישן) |
| `app/components/new-order/NewOrderA5.js` | `PageVariantToggle screen="new_order" placement="header" systemTip` בתוך `.tools` של הכותרת |
| `lib/pageVariantToggle.js` | כיתובי האייקון: "מעבר לאשף ההזמנה החדש" / "חזרה לאשף ההזמנה הישן" |
| `scripts/set-ui-variant.js` | `SCREENS` כבר כלל `new_order`; עודכנה רק הערת השימוש |
| `docs/page-variant-switch-2026-10-04.md` | שורת `new_order` בטבלת הרשומה |
| בדיקות | `test_page_variant_switch` (+2 בדיקות חדשות), `test_ui_variant`, `test_ui_variant_self_switch`, `new-order-tests/static` |

`app/orders/new/LegacyNewOrderPage.js` לא נגע (ה-blob הנעול ב-`PINNED_BLOBS` ללא שינוי: `60e2b3d9...`).

ענף `fix/neve-a5-neworder-2026-10-05` (ארבעת ה-ports של נווה יעקב) כבר **ממוזג ב-origin/main** (הוא אב קדמון שלו, `git merge-base --is-ancestor`),
ולכן לא היה מה לעשות cherry-pick.

## מה המתכנת רואה

* מתכנת (roleId 2), בשני הגמ"חים, שנכנס ל-`/orders/new`: האשף החדש (B2 מודרך עם פסים). בכותרת, בצד שמאל, אייקון "החלפה" זהוב עגול.
* הנהלה ראשית (roleId 0): ברירת המחדל נשארת **ישן**, אבל בדף הישן יש בפינה התחתונה אייקון "מעבר לאשף ההזמנה החדש" (ובדף החדש - בכותרת).
* מנהל סניף, עובדים, אורחים: הישן, בלי אייקון, בלי שום שינוי.
* בקיוסק / שעון נוכחות / הדפסה: אין אייקון (`isForcedLegacyPath`).
* סדר ההכרעה (`lib/uiVariant.js`): עקיפה אישית > הגדרת ארגון `ui_variant_new_order` > ברירת מחדל לפי תפקיד.
* כפתור "הזמנה חדשה" אחרי שמירה (וההגדרה `order_new_redirect_screen=new_order`) עושה טעינה מלאה של `/orders/new` ולכן חוזר לאותה גרסה שהמשתמש רואה.

## איך חוזרים לישן

* **לעצמי:** לחיצה על האייקון. זו עקיפה אישית ב-`Employee.themeColor.uiVariants.new_order` (POST `/api/me/ui-variant/new_order`), אחריה טעינה מחדש.
  אם יש בטופס קלט שלא נשמר תוצג חלונית אישור. (הערה: אחרי שמירה מוצלחת של הזמנה האייקון עדיין יבקש אישור, כי הזיהוי הוא "המשתמש הקליד משהו" ואין `window.__gmDirty` באשף.)
* **לכל הארגון, כולל המתכנת:** `node scripts/set-ui-variant.js --screen new_order --value legacy --scope org --confirm-host <host> --i-know-this-is-prod --apply`
  (שורת ארגון גוברת על ברירת המחדל לפי תפקיד). להדלקה לארגון שלם (למשל נווה יעקב): `--value a5`.
* **ביטול בקוד:** להחזיר ב-`lib/uiVariantScreens.js` את `new_order` ל-`newExists:false, selfSwitch:false` (או revert של ה-commit). אין שינוי DB, אין מיגרציה.

## בדיקות כסף מול main הנוכחי (491f71bb)

* `lib/newOrderPayments.js` לא השתנה מאז `ea579b00`: `redirectNeedsFullReload` קיים, ואין בדיקת אישור מנהל בפיצול מזומן (`validateSplitPayment` לא קורא לשום אישור; האישור רק ב-`saveOrder` ליציאה באישור מנהל).
* עיגול: `calculatedData.totalAmount = roundMoney(server total)`, והשוואת "שולם במלואו" באגורות (`paidInFull` = `toAgorot(paid) >= toAgorot(total)`), גם בחיוב אשראי וגם בסיום.
* **סכום מעוגל מול סכום גולמי ב-`POST /api/orders`:** השרת לא מחשב ולא מאמת את `totalAmount` מול החישוב; אין דחייה (400/409) על אי-התאמה.
  הוא משתמש בערך הלקוח רק ל-`deriveConfirmedOrderStatus` (שולם / חלקי) ולכתיבה ראשונית של `Order.totalAmount`, ואז `recalculateOrderObligations` מחשב מחדש
  וכותב `Order.totalAmount` = סכום החיובים הגולמי כשההפרש עולה על 0.001. לכן:
  * רעש נקודה צפה (385.00000000000006) - מתחת ל-0.001, לא משנה כלום.
  * סיכון תיאורטי בלבד: סכום גולמי עם יותר משתי ספרות עשרוניות שמתעגל **כלפי מטה** (למשל 350.004 -> 350.00). הלקוח משלם 350.00, מנוע החיובים כותב 350.004,
    ו-`calculateOrderStatus` (`totalPaid >= totalRequired`, בלי סובלנות) יכול להחזיר "שולם חלקי" בחישוב הבא. במחירון של היום (מחירים שלמים, תוספת חו"ל באחוזים שלמים,
    משלוח / תיקונים שלמים) הגולמי הוא עד שתי ספרות ועוד רעש, לכן לא צפוי. אם יופיע מחירון עם אחוז עשרוני - לבדוק.
* חיוב משלוח לפי עיר לקוח: האשף שולח `customerCity` ל-`/api/orders/calculate`, והשרת מחליט לפי `delivery_charge_customer_city_fallback` (TRUE בנווה יעקב) - אותה פונקציה
  (`resolveEffectiveDeliveryCity`) כמו `applyDeliveryCharge` בשמירה. כל הסכומים שמוצגים (שלב פריטים, סיכום, תשלום) הם `deliveryAmount` מאותה תשובה, אז אין סטייה בין התצוגה לחיוב.
  הקריאה לחישוב מתעדכנת גם בשינוי עיר הלקוח / עיר המשלוח / כיוון.
* `hide_order_payment_note='true'` מסתיר את "הערה לתשלום"; `allow_abroad_long_stay_orders='false'` מסתיר את לשוניות חו"ל / תפוסה ארוכה; שלב המשלוח וכפתור "הוסף / עריכת משלוח"
  מותנים ב-`enable_deliveries==='true'` (ובכרטיס `delivery_show_in_order !== 'false'`) - כמו הישן.
* שדות חובה בלקוח חדש: `phone2` / `email` / עיר / רחוב / מספר בית / ת"ז - לפי `mandatory_field_groups`, `require_customer_email`, `require_full_address`, `require_customer_id_number` - אותו קוד כמו בישן
  (`lib/customerValidation`), ובשמירה בדיקת טלפון חובה.
* משמרות: אין בכלל קוד משמרות באשף החדש (ולא בישן של ההזמנה), ולכן "shifts undefined" לא רלוונטי כאן.

## בדיקות שרצו (ללא דפדפן וללא DB)

`scripts/new-order-tests/run.mjs` (UTC, Asia/Jerusalem, America/New_York: הכל ירוק), `test_new_order_money` (18), `test_page_variant_switch` (33),
`test_ui_variant` (48), `test_ui_variant_self_switch` (34), `test_menu_logic` (108), `test_home_css_guard` (134), eslint על `app/components/new-order` ו-`lib`.

## Smoke test בשימוש ראשון (בדפדפן, כמתכנת, אחרי פריסה)

1. נכנסים כמתכנת ל-`/orders/new`: מופיע האשף החדש, בכותרת אייקון ההחלפה; ריחוף מציג "חזרה לאשף ההזמנה הישן". כמנהל / עובד רגיל - הישן ובלי אייקון.
2. **מזומן מלא:** לקוח קיים, תאריך, פריט אחד, תשלום מזומן בסכום המלא, "סיום ויצירת ההזמנה". לבדוק בכרטיס ההזמנה: סכום ההזמנה = הסכום שהוצג, סטטוס "שולם", יתרה 0.
3. **פיצול:** שני תשלומים (מזומן + אחר) דרך "אישור תשלום / פיצול" בלי חלונית אישור מנהל; אחרי שהסכום מלא - "סיום". הסכומים נרשמו נכון ללא יתרה.
4. **אשראי (נדרים פלוס):** חיוב בכרטיס בסכום מלא (עדיף סכום קטן בסביבת בדיקה / סכום מינימלי שניתן לבטל); ההזמנה נשמרת אוטומטית; אחרי חיוב חלקי מופיעה הודעה ויש להשלים את היתרה. נתוני הכרטיס לא נשארים בטופס.
5. **משלוח (נווה יעקב):** הזמנת משלוח בלי עיר משלוח מפורשת ולקוח שעירו בטבלת `delivery_price_by_city`: שורת "מתוכם משלוח" מציגה את העיר והסכום, ובכרטיס ההזמנה אחרי השמירה חיוב המשלוח זהה ולא כפול. ובדיקה עם עיר משלוח מפורשת, ועם "הלוך" בלבד.
6. **חו"ל (בגמח שמאפשר):** לשונית חו"ל, תאריכים מ-עד, סכום עם תוספת חו"ל, שמירה. בנווה יעקב (`allow_abroad_long_stay_orders=false`) הלשוניות לא מופיעות.
7. **יציאה באישור מנהל:** מבקש אישור; ההזמנה נשמרת עם חוב.
8. אחרי שמירה: "הזמנה חדשה" טוען את הדף מחדש (בלי "שומר..." תקוע); המעבר באייקון לישן ובחזרה עובד, ובישן האייקון בפינה לא מסתיר כפתור.
9. לבדוק ב-DB / בכרטיס שאין הפרש אגורות בין `Order.totalAmount` לסכום החיובים.

## מה לא נבדק בלי דפדפן

הרינדור בפועל של האייקון בכותרת האשף (מיקום ב-RTL, חפיפה עם הכותרת במובייל) ובפינת הדף הישן; הלחיצה ושמירת העקיפה האישית מול ה-API האמיתי; ריצה מלאה של שמירת הזמנה (מזומן / אשראי / פיצול / משלוח / חו"ל) מול שרת ו-DB;
שלמות הטעינה הדינמית של `NewOrderA5` ב-`next build`; חלונית "שינויים לא נשמרו" בתוך האשף. הבדיקות שרצו הן טהורות / סטטיות.
