# בקשות — משפחת orderitems (נכתב על ידי בעל הסגנון; מיועד לבעלי app/v3 ולסוקרים)

## REQ-1 · app/v3/ui/Dialog.js · יציבות · חוסם (לשימוש כשהחלונית נטענת פתוחה)
מה: `<Dialog open>` שמורכב כשהוא כבר `open={true}` בטעינה הראשונה קורס: `TypeError: Cannot read properties of null (reading 'querySelector')`.
איפה: Dialog.js — ה-effect של open (שורות ~30-50) רץ לפני שה-state `mounted` הפך ל-true; בשלב הזה `return null` ולכן `ref.current` הוא null, ו-`root.querySelector` נופל.
איך לתקן (הצעה): בתחילת ה-effect `if (!open || !mounted) return undefined;` והוספת `mounted` למערך התלויות (או `const root = ref.current; if (!root) return undefined;`).
עקיפה זמנית בצד שלנו: ItemCapacityModal פותח את ה-Dialog רק אחרי שהורכב (`dialogReady`). אחרי התיקון אפשר להסיר.
סטטוס: פתוח

## REQ-2 · app/v3/components.css · קוסמטי · בינוני
מה: חסרות מחלקות לשני דפוסים שחוזרים (הגדרנו להם מקבילים מקומיים ב-components/orders/orderItemsV3.css עם prefix oi-):
1. ריבועי בחירת מידה עם שורת זמינות מתחת (`.oi-size`, מקביל ל-`.v3-sizes` שבנוי לריבוע 48px בלי טקסט משני).
2. כפתור-מתג (chip לחיץ עם `aria-pressed`) — `.oi-toggle[aria-pressed="true"]`.
איך לתקן: להעביר ל-components.css כ-`.v3-size` / `.v3-chip--toggle`, ואז נמחק את המקבילים שלנו.
סטטוס: פתוח

## REQ-3 · app/v3/ui/Tabs.js (Seg) · קוסמטי
מה: `Seg` לא מקבל `disabled` ולא מעביר `data-*` לכפתורי המקטעים. השתמשנו ב-`<fieldset disabled>` עוטף כעקיפה (מצב הפריט בהחזרה בזמן שמירה).
איך לתקן: prop `disabled` + `optionProps` לכל אופציה.
סטטוס: פתוח

## REQ-4 · app/components/PopupProvider.js · חיבור התראות · לידיעה
מה: כל קריאות `alert()` ב-ModernItemsManager / OrderModelSelector נשארו כפי שהן (ר' build-orderitems.md). הן כבר עוברות ל-toast דרך `window.alert = showAlert`; כשיחברו את `v3Toast` ל-PopupProvider הן יעברו אוטומטית.
סטטוס: לידיעה
