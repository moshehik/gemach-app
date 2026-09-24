# תיקון מוצע ל-POST /api/notifications (activity_note) - לא הוחל

מטרה: שמירת הערת התראה עצמית בלי מייל, בלי הגדרת קטגוריה, עם dedupe. ענף חדש בלבד - כל הקיים ללא שינוי (ממתין לאישור Q-N1).
ב-`app/api/notifications/route.js`, בפונקציית POST, מיד אחרי בדיקת `if (!content)` ולפני `parsedCategory`:

```js
if (category === 'activity_note') {
  // הלקוח לא שולח receiverId - תמיד לעצמי. בלי מייל ובלי בדיקת הגדרה.
  const t = title || 'הודעה חדשה';
  const dup = await prisma.notification.findFirst({
    where: { senderId: employeeId, receiverId: employeeId, category, title: t, content, createdAt: { gt: new Date(Date.now() - 60000) } },
  });
  if (dup) return NextResponse.json({ success: true, notification: dup, deduped: true });
  const notification = await prisma.notification.create({
    data: { senderId: employeeId, receiverId: employeeId, title: t, content, category, isRead: true }, // isRead:true = שקטה (Q-N2)
  });
  return NextResponse.json({ success: true, notification });
}
```
- ללא שינוי סכמה (category הוא String?). AuditLog נכתב אוטומטית ע"י תוסף Prisma - לא לכתוב ידנית.
- הלקוח (store.js persistNote) שולח `{category:'activity_note', title, content}`; sendBeacon שולח Blob מסוג application/json והעוגייה מצורפת אוטומטית.
- צד קריאה: `messages/page.js:72-73` לסנן `n.category !== 'activity_note'`; הפעמון - אייקון ייעודי ומאזין ל-`v3:bell-refresh`.
