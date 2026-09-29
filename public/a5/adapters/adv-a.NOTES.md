# adv-a — חיפוש מתקדם: לקוחות / הזמנות / השכרות / החזרות

קבצים: `public/a5/adapters/adv-a.js` (מתאם, רושם `A5.adv.focus.customers|orders|rentals|returns`) + route חדש לקריאה בלבד `app/api/a5/adv/route.js` (GET, `checkAuth`, בלי כתיבה).
למה route חדש: הסינונים "חובות/זיכויים/לא נשמר/התראה/איחור/כמות פריטים/סטטוס-לפי-פריטים/עובד/תאריך השכרה" לא ניתנים לביטוי ב-`/api/orders` ו-`/api/customers` הקיימים. ה-route משתמש באותם עזרים ובאותם כללים של העמודים החיים (`calculateOrderStatus`, `getLateReturnInfo`, `buildMultiWord*NameCondition`, `getIsraelDayRange`).
בקשה: `GET /api/a5/adv?focus=<תחום>&adv=<JSON של המפתחות שמולאו>&unsaved=<מספרי הזמנות מ-localStorage>`. תשובה: `{cols, rows, links, al, truncated, total}` (`total` לבדיקות בלבד; עד 200 שורות).

## (א) מיפוי מסנן -> שדה/כלל אמיתי

### לקוחות (`/customers/<id>`, מיון legacyId יורד כמו `/api/customers`)
| מסנן | מקור |
|---|---|
| first, last, city, email | `Customer.firstName/lastName/city/email` contains (זהה ל-`/api/customers`) |
| phone | `phone1` או `phone2` contains (מקפים ורווחים מוסרים) |
| flags.debts | ללקוח הזמנה לא-מחוקה עם `totalPaid < totalAmount && totalAmount > 0` (כמו טאב "לא שולם" ב-/orders, בלי חלון 3 חודשים) |
| flags.credits | הזמנה שבה `calculatePaymentStatus` = "ממתין לזיכוי": שולם > נדרש, או שולם > 0 כשנדרש 0 |
| flags.badreturn | ללקוח פריט שהוחזר ו-`returnedOk=false` (כפתור "לא תקין" בכרטיס ההשכרה) |
| flags.nodetails | חסר שם פרטי/משפחה/טלפון ראשי (שדות ש"האתר תמיד דורש") או שדה מ-`mandatory_fields`, או קבוצת `mandatory_field_groups` לא מסופקת (ברירת מחדל: טלפון נוסף/מייל) |
| עמודות | שם, טלפון (`phone1`\|\|`phone2`, מעוצב `052-1234567`), כתובת (`רחוב מספר, עיר`), מייל (`normalizeEmail`). `al` = שורות עם פרטים חסרים |

### הזמנות (`/orders/<orderId>`, מיון eventDate יורד)
| מסנן | מקור |
|---|---|
| oid | `orderId` מדויק (כמו `advOrderId`) |
| name, phone, city | כמו `customerName/customerPhone/customerCity` ב-`/api/orders` (כולל שם מלא "פרטי משפחה") |
| cinfo | מייל / עיר / רחוב / טלפון של הלקוח contains |
| emp | עובד ההזמנה (`Order.employee`) — שם פרטי/משפחה/מלא |
| from, to | `eventDate` בטווח ימים ישראליים (`getIsraelDayRange`) |
| model, size, item | כמו `advModelName/advSize/itemDetails`: פריט לא-מחוק אחד שמתאים לכולם; דגם מספרי מתאים גם ל-`barcodePrefix` |
| ost.soon | eventDate ריק או >= היום (`filterStatus=soon`); כשההגדרה `hide_taken_orders_from_orders_list` פעילה — רק הזמנות עם פריט שלא נלקח (כמו בטאב) |
| ost.archive | eventDate < היום (`filterStatus=archive`) |
| ost.rented | פריט שנלקח ולא הוחזר (`activeOnly`) |
| ost.returned | פריט שהוחזר (`returnedOnly`) |
| ost.deleted | `isDeleted` (וגם טיוטות כשההגדרה `draft_orders_show_as_deleted` פעילה) |
| ost.alert | חישוב לכל שורה: פרטי לקוח חסרים / איחור בהחזרה (`late_return_threshold_days`, פריט בחוץ) / ציפוף (`customSpacing`, רק אם `packing_enabled` ו-`hide_custom_spacing` כבוי) / חוב / שינויים שלא נשמרו |
| flags.debts / credits | כמו בלקוחות, ברמת ההזמנה |
| flags.unsaved | מספרי הזמנות שיש להן טיוטה ב-`localStorage['gemachOrderDraft:<id>']` (המתאם קורא ושולח; אותו מפתח ותוקף 30 יום כמו `app/lib/orderDrafts.js`) |
| flags.nobranch | `Order.branch` ריק — רק כשההגדרה `branches_enabled` פעילה |
| flags.holiday | `Order.isWeekdayEvent` |
| flags.packing (+ days) | `customSpacing` שאינו ריק (או שווה ל-`days`); כבוי כשהגדרת `hide_custom_spacing` פעילה |
| flags.delivery | `Order.isDelivery` |
| flags.repairs / itRepairs | פריט עם תיקון (neck>0 / sleeve>0 / length לא ריק) — אותו תנאי כמו `/api/alterations` |
| עמודות | שם, תאריך אירוע עברי (`ט״ו תשרי`, בלי שנה), סטטוס (צ'יפ לפי `calculateOrderStatus`; "בקרוב" עם אירוע היום/מחר מוצג "היום"/"מחר"), טלפון |

לוגיקת שילוב: בחירות ב-`ost` = "או"; ללא בחירה = כל ההזמנות שלא נמחקו (בלי חלון 3 החודשים של הטאב "הכל"). `flags` — "או" בתוך כל חלק (דרוש בדיקה / פרטי אירוע), ו"וגם" בין החלקים ובין שאר השדות.

### השכרות (`rs_*`) והחזרות (`rt_*`) (`/orders/<orderId>`)
בסיס השכרות: הזמנה לא מחוקה, לא טיוטה, עם פריט פעיל. בסיס החזרות: כנ"ל עם פריט שנלקח או הוחזר.
| מסנן | מקור |
|---|---|
| oid, from/to, name, cinfo, emp, item (ברקוד), model, size | כמו בהזמנות (item = `barcode` contains) |
| rdate | פריט בהזמנה שהושכר (`takenDate`) / הוחזר (`returnDate`) ביום הישראלי הנבחר |
| rs_today / rs_tomorrow | אירוע היום / מחר ועדיין יש פריט שלא נלקח |
| rs_partial | `partiallyRentedOnly`: יש נלקח ויש שלא, ואין מוחזר |
| rs_all | הכל נלקח ואין מוחזר (סטטוס "הושכר") |
| rs_late / rt_late | פריט בחוץ ו-`getLateReturnInfo(order, late_return_threshold_days).isLate` (זהה ל-`/api/orders/overdue`: 8=8 בבדיקה) |
| rt_today / rt_tomorrow | פריט בחוץ ומועד ההחזרה (`toDate`\|\|`returnDate`\|\|אירוע+יום עם דילוג שישי-שבת) היום / מחר |
| rt_partial | `partiallyReturnedOnly`: יש מוחזר ויש שלא (1077=1077) |
| rt_all | כל הפריטים הוחזרו (סטטוס "הוחזר") |
| rc_debt | הזמנה עם חוב |
| rc_branch | `pickupBranch` שונה מ-`branch` (שניהם מלאים) |
| עמודות | כמו הזמנות; הצ'יפ: `הושכר חלקי · 5 נלקחו מתוך 6`, `הושכר הכל · 4 מתוך 4`, `איחור · 2 נלקחו מתוך 5`, `היום/מחר · 0 נלקחו מתוך 3`, `לא נלקח`; בהחזרות `הוחזר חלקי · 4 הוחזרו מתוך 6`, `הוחזר הכל`, `לא הוחזר`, `מושכר` (מועד ההחזרה עוד לא הגיע) |

אימות מול העמודים החיים (נתוני נווה יעקב, `/api/orders` עם `forRentals=true` כדי לעקוף חלון 3 חודשים): לקוחות עיר/שם/מייל/טלפון; הזמנות soon=466, archive=19125, deleted=1659, rented=70, שם=955, טלפון, עיר=1856, טווח תאריכים=394, מידה=2368, פריט/דגם=8/683; rs_partial=7, rt_partial=1077, איחור=8, חובות מאז 3 חודשים=21 (=`unpaid_all`). חובות (24 הזמנות) = 24 לקוחות.

## (ב) פערים (GAPS)
1. **rc_other "החזרה מאירוע אחר"** ו-**rc_stock "חסר במלאי"** — אין שדה או חישוב באתר (החזרה גלובלית לפי ברקוד לא נרשמת כ"מאירוע אחר"). המתאם לא ממציא: אם נבחרו רק הם — 0 תוצאות; אם נבחרו יחד עם דגל אחר — הם לא תורמים.
2. **עובד מבצע** בהשכרות/החזרות: אין בפריט מי ביצע לקיחה/החזרה; משתמשים ב-`Order.employee` (עובד ההזמנה).
3. **סניף** (`nobranch`, `rc_branch`): הגדרת `branches_enabled` כבויה בנווה יעקב (נתונים: 19,577 הזמנות בלי סניף, 0 עם סניף איסוף שונה) — `nobranch` מחזיר 0 כשההגדרה כבויה.
4. **התראה**: ההגדרה "מה נחשב התראה" (במסך ההגדרות של A5) עדיין לא קיימת; מיושמים 5 הסוגים שכתובים בטולטיפ באב-טיפוס. "פרטים חסרים" מוגדר צר בכוונה (ראו 5) ולכן `ost.alert` מחזיר כ-5,161 הזמנות בנתונים האמיתיים.
5. **פרטי לקוח חסרים**: כלל "יצירת הזמנה" של האתר (חובה מייל + כתובת מלאה) היה מסמן כמעט את כל 16,333 הלקוחות הוותיקים (16,265 בלי מייל), לכן לא הוחל על לקוחות קיימים.
6. **לא נשמר**: הטיוטות רק בדפדפן הנוכחי (localStorage) — מוצגות רק הזמנות שיש להן טיוטה בעמדה זו. חייב לרוץ מאותו origin של האתר (`/a5/` — כן).
7. **תיקונים/חול/ציפוף**: קיימים ומחוברים, אך בנתונים של נווה יעקב אין רשומות תואמות (0 תיקונים, 0 אירוע חול, `hide_custom_spacing` פעיל) — מוחזר ריק.
8. **rs_today/rs_tomorrow** לפי תאריך האירוע (כמו המיון החכם ב-/rentals), לא לפי מועד איסוף ייעודי.
9. **מיון ומגבלה**: eventDate יורד; עד 200 שורות + `truncated`. שדות ADV שאינם רלוונטיים לארבעת התחומים (`st`, `astatus`, `dir`, ...) מתעלמים מהם.
10. **חודש בלוח**: התאריך העברי נוצר מ-`getHebrewDateString` (למשל "חשוון", "אדר א'"); הלוח באב-טיפוס (`HMONTHS`) מצפה ל-"חשון" וחודש בן מילה אחת (`hDayNum` תופס `\S+`) — צריך התאמה בצד המשלב.

## (ג) הוראות שילוב (ל-`index.html`)
1. הוסף `<script src="adapters/adv-a.js">` אחרי `core.js`.
2. ב-`advApply` (שורות ~4353-4382) במקום לקרוא ל-`doSearch(q)` על נתוני הדמה, כשהתחום הוא אחד מהארבעה (`ADV.focus` ב-customers/orders/rentals/returns): `const V = await A5.adv.focus[ADV.focus](ADV);` והצב `ADV_VIEW[ADV.focus] = V` (הקבוע `ADV_VIEW`, שורות ~3959-3980; `ADV_PEOPLE`/`ADV_ORD` הם הדמה שיוחלפו). מבנה `V` זהה: `{cols, rows, links, al}` (+ `truncated`).
3. `data-open` בשורות/טבלה (`avList`, `avTable`, `calView`, שורות ~3985-3990 ו-4010): כרגע `href="#"` — להשתמש ב-`V.links[i]` (כתובת `/customers/<id>` או `/orders/<id>`).
4. `calOK()` (שורה ~3991) — עמודת "תאריך אירוע" קיימת בהזמנות/השכרות/החזרות ולכן הלוח פועל; ראו פער 10 על שמות החודשים ו-`HMONTHS`.
5. אם `V.truncated` — להציג "מוצגות 200 הראשונות" (אין באב-טיפוס טקסט כזה; להוסיף בהחלטתך).
