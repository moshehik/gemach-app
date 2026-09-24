## REQ-1 · ModernDressItemsTab · R2/צבעים · קוסמטי
מה: אין מחלקה לשורת טבלה מסומנת (הדגשת פריט / פריט מחוק). כרגע inline `background: var(--v3-gold-a14)`.
איפה: components/dresses/modern/ModernDressItemsTab.js (rowMark)
איך לתקן: להוסיף `.v3-table tr.is-flag { background: var(--v3-gold-a14) }`.
סטטוס: פתוח

## REQ-2 · ModernDressItemsTab · רספונסיביות · קוסמטי
מה: `Seg` עם 6 אפשרויות סינון גולש במובייל; כרגע `style={{flexWrap:'wrap'}}` inline.
איפה: components/dresses/modern/ModernDressItemsTab.js
איך לתקן: `.v3-seg--wrap { flex-wrap: wrap }` או גלילה אופקית ב-.v3-seg.
סטטוס: פתוח
