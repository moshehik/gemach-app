# תוצאות בדיקת מציאות - scratch/ai-site-guide/after3.json

נשאלו 70 שאלות. נכון: 67 (95.7%), שגוי: 3, הוזיה: 0, מפנה לישן: 0.

| נושא | שאלות | נכון |
|---|---|---|
| orders | 8 | 8 (100%) |
| returns | 7 | 6 (86%) |
| customers | 2 | 2 (100%) |
| inventory | 5 | 5 (100%) |
| schedule | 3 | 3 (100%) |
| settings | 5 | 5 (100%) |
| admin | 3 | 3 (100%) |
| deliveries | 2 | 2 (100%) |
| print | 3 | 3 (100%) |
| email | 3 | 3 (100%) |
| capacity | 2 | 2 (100%) |
| search | 3 | 3 (100%) |
| nav | 4 | 4 (100%) |
| perm | 5 | 4 (80%) |
| trap | 15 | 14 (93%) |

| # | נושא | שאלה | קטגוריה | הערה | הצבעה |
|---|---|---|---|---|---|
| q01 | orders | איך פותחים הזמנה חדשה? | נכון | כל קבוצות expect | menu.order-new no.cust-modes no.date-calendar no.finish |
| q02 | orders | אני בהזמנה חדשה, איפה מכניסים את הלקוחה? ומה אם היא לא במערכת | נכון | כל קבוצות expect | menu.order-new no.cust-mode-phone no.cust-mode-new |
| q03 | orders | שכחתי להוסיף שמלה להזמנה שכבר נשמרה, איך מוסיפים? | נכון | כל קבוצות expect |  |
| q04 | orders | הלקוחה רוצה להזיז את תאריך האירוע בהזמנה קיימת, איפה משנים | נכון | כל קבוצות expect |  |
| q05 | orders | איך רושמים תשלום שהלקוחה שילמה על הזמנה? | נכון | ידני: כרטיס הזמנה ← לשונית תשלומים ← הוספת תשלום (הניסוח שונה מ-expect) | menu.tab-home menu.tab-order |
| q06 | orders | איך מוחקים הזמנה ששלחו בטעות | נכון | כל קבוצות expect | menu.tab-home srch.input menu.order-new |
| q07 | orders | עשיתי שינויים בכרטיס הזמנה, איפה לחצים לשמור? ואם התחרטתי? | נכון | כל קבוצות expect |  |
| q08 | orders | איפה רואים מי שינה משהו בהזמנה ומתי | נכון | כל קבוצות expect |  |
| q09 | returns | איך מסמנים שהשמלה נלקחה / הושכרה | נכון | כל קבוצות expect |  |
| q10 | returns | הלקוחה החזירה את השמלה, איך רושמים החזרה בהזמנה? | נכון | כל קבוצות expect |  |
| q11 | returns | יש דרך מהירה להחזיר שמלה בלי לפתוח את ההזמנה? סורקים ברקוד | נכון | כל קבוצות expect | rail.search srch.menu-input |
| q12 | returns | סימנתי בטעות שהשמלה הוחזרה. איך מבטלים? | נכון | כל קבוצות expect |  |
| q13 | returns | שמלה חזרה קרועה, איך מסמנים שההחזרה לא תקינה | נכון | כל קבוצות expect |  |
| q14 | returns | איך אני רואה מי עדיין לא החזירה שמלות והאיחור כבר עבר | שגוי | ידני: מפנה ללוז/לוח חודשי ולחלונית תזכורת; הדרך הנכונה: חיפוש מתקדם ← החזרות (איחור) - טענות על 'התראות איחור בלוז' לא מאומתות | set.key-enable-unreturned-orders-popup |
| q15 | returns | איפה העמוד של "השכרות והחזרות" עם הטבלה של כל ההשכרות? | נכון | ידני: מסביר שאין לשונית כזו בחדש ומפנה לכתובות /rentals; לא מנחה לפי הישן |  |
| q16 | customers | איך מוצאים כרטיס לקוחה לפי שם או טלפון? | נכון | כל קבוצות expect | menu.recent-customers menu.home-search cust.list-search |
| q17 | customers | איך מוסיפים לקוחה חדשה בלי לפתוח הזמנה | נכון | ידני: קישור 'לקוחות' בניווט המהיר בתחתית הבית ← לקוח חדש (קיים בקוד) | cust.list-new |
| q18 | inventory | איך בודקים אם דגם מסוים פנוי בתאריך האירוע של לקוחה? | נכון | כל קבוצות expect | menu.order-stock stock.date stock.field-model stock.go |
| q19 | inventory | אפשר לבדוק זמינות מידה 4 בדגם 511 לכ' חשוון ישר מהחיפוש? | נכון | כל קבוצות expect | srch.input srch.date-chips |
| q20 | inventory | איך מוסיפים דגם חדש למערכת? | נכון | כל קבוצות expect | menu.ad-models mod.new mn.code mn.cat |
| q21 | inventory | קיבלנו עוד שמלה במידה חדשה מדגם שקיים, איך מוסיפים אותה למלאי | נכון | כל קבוצות expect | menu.ad-models |
| q22 | inventory | איך מוציאים דגם מהמאגר שלא יופיע יותר בהזמנות? | נכון | כל קבוצות expect | menu.ad-models |
| q23 | schedule | איך רואים מה מתוכנן להיום - הכנות, משלוחים, החזרות? | נכון | כל קבוצות expect | menu.tab-sched menu.sched-today sched.rail sched.stages |
| q24 | schedule | איך מסמנים בלוז שההכנה של הזמנה בוצעה | נכון | כל קבוצות expect | menu.tab-sched sched.sec-prep sched.mark-done sched.mark-all |
| q25 | schedule | איך רואים את כל החודש ואיך עוברים לפרטי יום מסוים? | נכון | כל קבוצות expect | menu.tab-month |
| q26 | settings | איפה מגדירים אילו אמצעי תשלום מוצגים בהזמנה? | נכון | כל קבוצות expect | set.key-allowed-payment-methods |
| q27 | settings | כמה ימי רווח צריך בין השכרות של אותה שמלה? איפה משנים | נכון | כל קבוצות expect | menu.ad-settings set.cat-inv set.key-inventory-buffer-days |
| q28 | settings | איפה מפעילים מייל אוטומטי ללקוחה כשנפתחת הזמנה ותזכורת לפני איסוף | נכון | כל קבוצות expect | set.key-auto-email-on-order-create set.key-pickup-reminder-enabled |
| q29 | settings | איפה קובעים שמייל וכתובת מלאה הם שדות חובה בפרטי לקוחה | נכון | כל קבוצות expect | menu.ad-settings set.cat-ord set.save set.key-require-customer-email |
| q30 | settings | איך מחליפים את הלוגו והשם של הגמח שמופיעים באתר? | נכון | כל קבוצות expect | menu.ad-settings set.cat-brand set.logo-upload |
| q31 | admin | איפה רואים סטטיסטיקות ודוחות כלליים? | נכון | כל קבוצות expect | menu.ad-stats stat.date-from stat.apply stat.tabs |
| q32 | admin | אני רוצה לראות מי שינה נתונים במערכת ומתי - איפה | נכון | ידני: ניהול ← כל כלי הניהול ← מידע / היסטוריה | menu.ad-all menu.ad-info dhs.search dhs.filter |
| q33 | admin | איפה משנים מחיר השכרה לקטגוריה? | נכון | כל קבוצות expect | menu.ad-pricelist price.row-edit price.er-price price.er-save |
| q34 | deliveries | איך מוסיפים משלוח להזמנה? | נכון | ידני: המשלוחים מופעלים כרגע ב-TEST (enable_deliveries=true) והתשובה תואמת את כרטיס ההזמנה |  |
| q35 | deliveries | איפה מגדירים כמה עולה משלוח לכל עיר | נכון | כל קבוצות expect | menu.ad-settings set.key-delivery-price-by-city |
| q36 | print | איך מדפיסים את ההזמנה בשביל הלקוחה? | נכון | ידני: אייקון המדפסת בכותרת כרטיס ההזמנה ← סיכום הזמנה |  |
| q37 | print | איך מדפיסים מדבקות ברקוד לשמלות של דגם? | נכון | כל קבוצות expect | menu.ad-models menu.ad-all |
| q38 | print | איך מדפיסים את דפי העבודה של היום, דף הכנה ורשימה לשליח? | נכון | ידני: לוז ← הדפסה (אשף) + משלוחים ← הדפסת משלוחים | menu.tab-sched sched.tool-print menu.ad-deliveries del.print |
| q39 | email | איך שולחים ללקוחה את פרטי ההזמנה במייל? | נכון | כל קבוצות expect |  |
| q40 | email | אני רוצה לשלוח מייל לכל הלקוחות שיש להם אירוע בשבוע הבא | נכון | כל קבוצות expect | menu.ad-all |
| q41 | email | איפה רואים אילו מיילים נשלחו להזמנה הזאת? | נכון | כל קבוצות expect | hub.email-logs |
| q42 | capacity | איך בודקים אם שמלה שהוספתי להזמנה פנויה בתאריך האירוע | נכון | כל קבוצות expect |  |
| q43 | capacity | איך מסמנים שהגמח סגור ביום מסוים, מעבר לשישי ושבת? | נכון | כל קבוצות expect | menu.ad-nwd nwd.calendar nwd.mark nwd.save |
| q44 | search | איך מחפשים הזמנה לפי מספר הזמנה או שם לקוחה | נכון | כל קבוצות expect | menu.tab-home srch.input srch.submit |
| q45 | search | איפה החיפוש המתקדם | נכון | כל קבוצות expect | menu.home-adv srch.mode-adv |
| q46 | search | איך חוזרים להזמנה שפתחתי לפני כמה דקות? יש קיצורים בחיפוש? | נכון | כל קבוצות expect | menu.tab-home srch.prefix-list menu.recent-all |
| q47 | nav | איפה רואים התראות והודעות חדשות? | נכון | כל קבוצות expect | rail.bell set.key-hide-internal-messaging |
| q48 | nav | איך עוברים לאתר הישן? | נכון | כל קבוצות expect | disp.variant-toggle rail.old-site home.footer-display disp.design-switch |
| q49 | nav | יש תקלה באתר, איך מדווחים? | נכון | כל קבוצות expect | rail.error-report home.footer-report |
| q50 | nav | איך מצמידים קיצורים קבועים לסרגל העליון? | נכון | מציין שקיים רק בישן | rail.search menu.tab-home |
| q51 | perm | למה אין לי כפתור הגדרות מערכת בתפריט ניהול? | נכון | כל קבוצות expect |  |
| q52 | perm | למנהלת יש בלוז כפתור ייצוא לאקסל ולי אין, למה | נכון | כל קבוצות expect |  |
| q53 | perm | אין לי בתפריט את הלשונית לוח חודשי | נכון | כל קבוצות expect |  |
| q54 | perm | איך נותנים לעובדת מסוימת גישה לעמוד שהיא לא רואה? | נכון | כל קבוצות expect | menu.ad-staff |
| q55 | perm | ההזמנה נעולה ואני לא מצליחה להוסיף או למחוק שמלה, למה? | שגוי | ידני: לא מסביר שהזמנה נעולה כשתאריך האירוע עבר, ענה על עריכה מהלוז | sched.row-card |
| q56 | trap | איך מדפיסים את הלוח החודשי? | נכון | הכחיש/לא מצא | menu.tab-month menu.tab-sched |
| q57 | trap | יש לי לקוחה כפולה בשני כרטיסים, איך מאחדים אותם לכרטיס אחד? | נכון | הכחיש/לא מצא |  |
| q58 | trap | איפה שולחים ללקוחה הודעת וואטסאפ או SMS מהאתר? | נכון | הכחיש/לא מצא |  |
| q59 | trap | איך מחברים את האתר לחשבשבת או לחשבונית ירוקה כדי להפיק חשבוניות? | נכון | הכחיש/לא מצא |  |
| q60 | trap | איך מוסיפים לקוחה לרשימת המתנה לשמלה שתפוסה בתאריך שלה? | נכון | הכחיש/לא מצא |  |
| q61 | trap | איפה רואים את המשלוחים על מפה? | נכון | הכחיש/לא מצא |  |
| q62 | trap | איפה מגדירים תבנית מייל עם לוגו שונה לכל סוג מייל בנפרד? | נכון | הכחיש/לא מצא | menu.ad-settings set.cat-brand |
| q63 | trap | איך משכפלים הזמנה קיימת להזמנה חדשה עם אותם פריטים? | נכון | הכחיש/לא מצא | menu.order-new |
| q64 | trap | איפה המדריך למשתמש באתר? | שגוי | ידני: לא אומר שאין מדריך למשתמש (הקישור כבוי 'בקרוב'); מציע מצגת הסבר וקיצורים | menu.tab-home home.tour-line home.footer-landing srch.guide-btn |
| q65 | trap | איך נותנים ללקוחה קבועה הנחה אוטומטית / מועדון לקוחות? | נכון | הכחיש/לא מצא | rail.search |
| q66 | trap | יש אפליקציה להתקנה בטלפון? אני רוצה שההתראות יקפצו לי בנייד | נכון | הכחיש/לא מצא | rail.bell rail.burger |
| q67 | trap | איך מחליפים את שפת האתר לאנגלית? | נכון | הכחיש/לא מצא |  |
| q68 | trap | אפשר לסנכרן את הלוז ליומן של גוגל? | נכון | הכחיש/לא מצא | rail.search |
| q69 | trap | איך מקבלים תשלום בפייפאל או בביט מהלקוחה? יש חיבור לזה? | נכון | הכחיש/לא מצא |  |
| q70 | trap | איך מוסיפים שדה חדש משלי לכרטיס לקוחה, למשל "מידת נעליים"? | נכון | הכחיש/לא מצא |  |