# adv-b — חיפוש מתקדם: משלוחים / תיקונים / כספים / תפוסה / דגמים / עובדים (+ הגדרות)

קבצים: `public/a5/adapters/adv-b.js` (רושם `A5.adv.focus.{deliveries,alterations,finance,capacity,models,employees}`) ו-route חדש לקריאה בלבד `app/api/a5/adv-b/route.js` (`GET /api/a5/adv-b?focus=...&<ADV keys>&flags=a,b&ost=x,y`).
כל התחומים עוברים ב-route אחד כדי שההרשאות והכללים יהיו זהים לעמודים החיים. הפלט כבר בפורמט `ADV_VIEW`: `{cols, rows, links, al, capstats?, truncated}` (+ `gaps` אופציונלי: מה לא הוחל). שגיאה = `Error` עם `.status` (403 = אין הרשאה, 400 = חסר שדה חובה, למשל דגם בתפוסה).
נבדק מול המסד האמיתי (נווה יעקב) בלבד ב-GET. משתמש בעוגייה של רחלי (roleId 0).

סימוני הסינון: מסומנים ב-`flags` = **כולם חייבים להתקיים (AND)**; מספר סטטוסים ב-`ost` = **או (OR)**. שדות טקסט = `contains` ללא רגישות לאותיות; שם לקוח = כל מילה מופיעה בשם הפרטי או במשפחה. `from` בלבד = תאריך אירוע באותו יום (יום ישראלי, `getIsraelDayRange`); `from`+`to` = טווח. מיון: אירועים קרובים קדימה, אחריהם עבר מהחדש לישן (כמו מיון ההשכרות החכם). מגבלה 200 + `truncated`.
תאריך אירוע בתוצאות = `eventDateHebrew` של ההזמנה בלי שנה (כפי שנשמר: `יז תשרי`, ללא גרשיים ביום).

## א. מה מחובר

| תחום | מקור אמיתי | מיפוי מסננים -> כלל | עמודות |
|---|---|---|---|
| משלוחים | `lib/deliveries.getDeliveriesForDate` (בדיוק מה ש-`GET /api/deliveries?date=` מחזיר, כולל הגדרות ימים לפני/אחרי, דילוג סופ"ש, `deliveries_select_by_event_date`) + `Order` עם `isDelivery` | `ds_today`/`ds_tomorrow` = ההזמנות שמופיעות בעמוד המשלוחים של היום/מחר (ישראל); `ds_other`+`sfrom/sto` = איחוד ימים בטווח (עד 45 יום); בלי סטטוס = כל הזמנות המשלוח (לא מחוקות). `city` = `deliveryCity` (או עיר הלקוח אם ריק); `dl_out`/`dl_back` = `deliveryDirection` (ברירת מחדל הלוך-חזור); `dl_note` = `Order.notes` לא ריק; `oid/from/name/cinfo/emp` כללי. `rc_debt` = חוב (כלל `unpaid_all`); `rc_branch` = `branch` שונה מ-`pickupBranch` | כתובת מלאה (`deliveryAddress`/רחוב לקוח + עיר), שם, תאריך אירוע, סטטוס (`היום`/`מחר` לפי חברות בחלון היום/מחר, אחרת מקף), טלפון, כיוון (`שניהם`/`הלוך`/`חזור`) |
| תיקונים | `OrderItem` עם אותם תנאי "יש תיקון" של `GET /api/alterations` (`neckAlteration>0` / `lengthAlteration` לא ריק/`null`/`0` / `sleeveAlteration>0`), ורק פריטים לא נלקחו ולא הוחזרו (כמו `hideTakenReturned` בעמוד) | `as_today`/`as_tomorrow`/`as_other` = תאריך **אירוע** ההזמנה (כמו `startDate/endDate` בעמוד); `al_len` אורך, `al_sleeve` שרוול, `al_fix` = צוואר או תיאור תיקון חופשי (`alterationDetails`), `al_done` = `alterationDone=true` (בלי הסימון מוצגים גם בוצעו וגם לא); כללי הלקוח/הזמנה | שם, תאריך אירוע, כמות לתיקון (סכום פריטים בהזמנה), סוג תיקון (`אורך: X · צוואר: הצרה N · שרוול: הארכה N · <תיאור>`). שורה אחת להזמנה |
| כספים | חובות: `Order` + `Payment` (כלל `unpaid_all`: `totalAmount>0` ושולם פחות). זיכויים: `Refund` (`isDeleted=false`, כמו `GET /api/refunds`) | `fn_debt`/`fn_credit` (ללא סימון = שניהם); `amount` ±30 ₪ על סכום החוב/הזיכוי; `adate` = `Order.orderDate` (חוב) / `Refund.createdAt` (זיכוי); `emp` = עובד ההזמנה; `fc_done` = `isExecuted`; `cemp` = `Refund.executedBy` (שם עובד); `cdate` = `executionDate`; `fc_nobank` = חסר בנק/סניף/חשבון ב-`Refund`; `ordst` = סטטוס ההזמנה לפי `calculateOrderStatus` (הוזמן=בקרוב, הושכר=הושכר/חלקי/הוחזר חלקי, הוחזר, לא נלקח=עבר). `fc_done`/`cemp`/`cdate`/`fc_nobank` מגבילים לזיכויים בלבד | שם, סכום (`חוב ₪X` amtd / `זיכוי ₪X` amtc), תאריך אירוע, טלפון. קישור: הזמנה, ובזיכוי בלי הזמנה - לקוח |
| תפוסה | מייבא ומריץ בדיוק את `GET /api/inventory/capacity` (במלאי / רזרבה / `occupiedOrders`) לכל זוג קידומת+מידה | `model` (שם או מספר קידומת; התאמה מדויקת עדיפה), `size` (בלי מידה = כל מידות הדגם, מסכם), `from`/`to` (בלי `to` = יום אחד; בלי תאריכים = היום). `capstats = {stock: inStock, busy: occupiedCount, res: reserve}` | שם, תאריך אירוע, כמות (סכום ליחידות מהדגם/מידה בהזמנה), טלפון (נוסף מ-`Customer.phone1`) |
| דגמים | `DressModel`+`DressItem` (אותם תנאים כמו `GET /api/dresses`) | `model` (שם/קידומת), `size` (`contains` על `sizeText`), `item` = `DressItem.dressBarcode`; `md_inactive` = לא פעיל (`exitDateFromRepo` או אין פריט פעיל); `md_repair` = פריט `inRepair`; `md_delmodel` = דגם מחוק (אחרת רק לא מחוקים); `md_delitem` = יש פריט מחוק | שם, קוד (`barcodePrefix`), כמות פריטים (סכום `quantity` של הפריטים התואמים). קישור `/dashboard/dresses/<id>` |
| עובדים | `Employee` | `first/last/phone(1|2)/city/email`; ברירת מחדל **פעילים** (כמו `/employees`), `em_inactive` בלבד = לא פעילים, שניהם = הכל | שם, טלפון, כתובת מלאה, מייל. קישור `/employees/<id>` |
| הגדרות | אין מתאם. תחום AI בלבד: `A5.ai` (אותו `POST /api/ai` של הצ'אט, מנהל בלבד; ה-AI מחזיר `ACTION: SETTINGS_GUIDE()` / תגית הגדרה שמפנה למיקום ההגדרה; המדריך: `lib/settingsMetadata.buildSettingsGuide`). לא נקרא מכאן (POST) | | |

## הרשאות (נאכף בשרת, 403 אחרת)
- משלוחים `page:deliveries`; תיקונים `page:alterations`; כספים `page:refunds`; תפוסה `page:orders` (אין דף ייעודי - הנתון מזהה לקוחות); דגמים `page:dresses_catalog` **וגם** תפקיד 0/1/2 (`advIsMgr`); עובדים `checkPageAccess([0,2])` = בדיוק `app/employees/layout.js`. שים לב: `advIsMgr` באב-טיפוס (roleId 0 או 1) מציג את "עובדים" גם למנהל סניף (1), אבל האתר מרשה רק 0/2 - מנהל סניף יקבל 403. הממשק צריך להציג `Error.status===403` כ"אין הרשאה" (או להסתיר את התחום ל-roleId 1).
- כל השאר: `checkAuth()`.

## ב. GAPS (אין מקור אמיתי או שהכלל שונה)
1. **`ds_sent` / `ds_picked` (נשלח/נאסף)**: באתר אין סטטוס משלוח שמור. סימון בלעדיו מחזיר ריק, ומופיע ב-`gaps`. עמודת "סטטוס" מציגה רק היום/מחר/מקף.
2. **`rc_other` (החזרה מאירוע אחר) ו-`rc_stock` (חסר במלאי)** במשלוחים/תיקונים: אין חישוב כזה מחוץ להחזרות; הסימון מחזיר ריק (+`gaps`). `rc_branch` ממומש כ-`branch != pickupBranch` (פירוש שלנו, לא מוגדר באתר) - לאשר.
3. **סוגי תיקון**: באב-טיפוס "קיצור אורך/תפרים/הרחבת מותן"; באתר רק אורך (טקסט חופשי), צוואר (הצרה), שרוול (הארכה) ותיאור חופשי. `al_fix` הוא קירוב (צוואר או תיאור). "כמות לתיקון" = מספר הפריטים בהזמנה (אין ספירת תיקונים נפרדת).
4. **`branch` בדגמים**: אין שדה סניף לדגם/פריט. השדה לא מסנן ומופיע ב-`gaps`.
5. **התראות (`al`)**: הוגדר להיות ריק; אין באתר כלל "התראה" לשורות של התחומים האלה (הכלל של הזמנות שייך ל-adv-a).
6. **כספים**: "עובד מבצע" (`emp`) = עובד ההזמנה (אין עובד מבצע לחוב/זיכוי); "תאריך הוספה" של חוב = תאריך ההזמנה (אין `createdAt` להזמנה). מיפוי `ordst` (בפרט "הוחזר חלקי" -> הושכר) צריך להיות זהה לזה של adv-a - לתאם.
7. **תפוסה**: `size` חייב להתאים בדיוק (כמו ה-endpoint החי); בלי דגם מוחזר 400 ("נדרש דגם לחיפוש תפוסה"); יותר מ-60 זוגות דגם+מידה - 400.
8. **סטטוס "אחר"** במשלוחים מוגבל ל-45 ימים (מריץ שאילתת משלוחים לכל יום).
9. חיפוש `cinfo` מחפש במייל/טלפון 1-2/עיר/רחוב של הלקוח (אין שדה כתובת אחד).

## ג. הוראות שילוב ב-`index.html` (שורות בענף הנוכחי)
1. לטעון `<script src="adapters/adv-b.js">` אחרי `core.js`.
2. `advApply` (שורה ~4353), הפונקציה הפנימית `run` (שורה ~4364): כש-`['deliveries','alterations','finance','capacity','models','employees'].includes(A.focus)` לא לקרוא `doSearch(q)` אלא:
   `A5.adv.focus[A.focus](ADV).then(v => { ADV_VIEW[A.focus] = v; S.advCap = v.capstats || null; S.home='results'; S.advRes = true; render(); }).catch(e => toast('error', e.status === 403 ? 'אין הרשאה' : 'החיפוש נכשל', e.message))`
   (עקוף את `doSearch`, ראה שורה ~4640-4642 איפה ש-`S.advRes = ADV_SRC` נקבע; יש להגדיר `S.advFocus = A.focus` ו-`S.advSum` כמו היום).
3. `ADV_VIEW` (שורה 3959): להפוך את המפתחות של 6 התחומים האלה לריקים בהתחלה (`{cols:[],rows:[]}`) - הנתונים הדמה (שורות 3976-3986) לא נדרשים; `links` מגיע בתוצאה ומחליף את `href="#" data-open` ב-`avList` (שורה ~3987) ו-`avTable` (שורה ~3989): `href` = `links[i]`.
4. סיכום התפוסה (שורה ~4040, בתוך `advHead`): להחליף `${none ? 0 : 2}` הראשון ב-`S.advCap.stock`, השני ב-`S.advCap.busy`, ו-`0` (רזרבה) ב-`S.advCap.res` (`none` = אין תוצאות; ה-capstats חוזר גם כשאין שורות).
5. הודעת "נבחרו מסננים שלא הוחלו": אם `v.gaps` לא ריק, להציג `toast('info','חלק מהסינונים לא נתמכים', v.gaps.join('; '))`.
6. תחום "הגדרות": להשאיר כמו היום (`useAi` תמיד) והעביר ל-`A5.ai`.
7. `truncated:true` -> להציג "מוצגות 200 הראשונות".
8. לוח החודשים (`calOK`, שורה 3991) מפרש `תאריך אירוע` בפורמט העברי-בלי-שנה שמוחזר; שים לב שהיום נשמר ללא גרשיים (`יז` ולא `י״ז`), ולכן ה-parser צריך לקבל גם אותיות ללא גרשיים.
