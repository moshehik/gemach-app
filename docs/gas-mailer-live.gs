/**
 * Apps Script "מערכת מייל פתוח" - העתק של הסקריפט החי (scriptId 17NBtcK5BmFq21mqzp_nCFxEu4ujSYvCWVgLo8lGdrLGYvGDEkUEjjder)
 * כפי ששלף clasp ב-2026-09-22, + תיקון אחד מסומן "== תיקון 2026-09-22 ==":
 *
 *   הדגל data.noAttachment (נשלח מ-lib/mailer.js buildGasPayload כשאין קובץ אמיתי) מדלג על
 *   הצרופה. עד היום הסקריפט תמיד צירף קובץ (fileContent חובה - base64Decode על undefined
 *   זורק), ולכן כל מייל מהמערכת יצא עם צרופה מיותרת "הודעה.txt".
 *
 * תיקון (2) באותו יום: תמיכה בכמה צרופות למייל (data.attachments) - בלי זה רק הקובץ הראשון צורף.
 *
 * תאימות לאחור מלאה: בקשה בלי noAttachment (מערכות אחרות שמשתמשות באותו סקריפט) - בדיוק כמו קודם.
 *
 * תיקון (3) 2026-10-05: שם השולח דינמי - data.senderName (נשלח מ-lib/mailer.js postToMailer, לפי ההגדרה
 * gmach_name של האתר ששלח). בלי השדה (מערכות אחרות) - ברירת המחדל 'גמ"ח שמלות' כמו קודם.
 *
 * *** פרוס (גרסה 18, 2026-10-07) ל-deployment AKfycbyBDsY2mF7h9... (ה-fallback ב-lib/mailer.js). פריסה חוזרת = clasp push +
 * clasp version + clasp deploy -i <deploymentId> -V <n> (אותו URL). הסקריפט משרת גם מערכות אחרות - שינויים רק תואמי-אחור. ***
 *
 *
 * תיקון (4) 2026-10-07: אידמפוטנטיות (data.requestId) + doGet (status/quota) - ר' הבלוק בסוף הקובץ ו-postToMailer ב-lib/mailer.js.
 *
 * (docs/gas-mail-drive.gs הוא סקריפט אחר, מורחב עם דרייב, שלא פרוס - ר' CLAUDE.md "Cloud backup".)
 */

// שם השולח שמוצג ב-Gmail. נשלח עם הבקשה (senderName); אחרת ברירת המחדל הקבועה.
function senderName_(data) {
  var n = data && data.senderName ? String(data.senderName).replace(/[\r\n]+/g, " ").trim() : "";
  return n ? n.substring(0, 100) : 'גמ"ח שמלות';
}

function legacyPost_(e) {
  try {
    // פענוח הנתונים שנשלחו בבקשת ה-POST
    var data = JSON.parse(e.postData.contents);

    // --- תוספת עבור פונקציית המרת PDF לגמ"ח ---
    if (data.action === "sendGemachOrderEmail") {
      try {
        var htmlOutput = HtmlService.createHtmlOutput(data.htmlBody);
        var pdfBlob = htmlOutput.getAs('application/pdf').setName(data.fileName || "order.pdf");

        MailApp.sendEmail({
          to: data.to,
          subject: data.subject,
          htmlBody: data.bodyText || "מצורף כרטיס הזמנה/השכרה.",
          attachments: [pdfBlob],
          name: senderName_(data)
        });

        return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // --- סוף התוספת ---

    // ==========================================
    // קוד מקורי שרץ עבור שאר המערכות (Base64):
    // ==========================================
    var to = data.to;
    var cc = data.cc || "";
    var subject = data.subject || "קובץ חדש ממערכת היצירה";
    var body = data.body || "מצורף הקובץ שביקשת לשלוח.";
    var fileName = data.fileName || "attachment.txt";
    var fileB64 = data.fileContent; // תוכן הקובץ בקידוד Base64

    // == תיקון 2026-09-22 == noAttachment=true: אין קובץ אמיתי, fileName/fileContent הם ממלא מקום בלבד
    var attachments = [];
    if (!data.noAttachment) {
      // == תיקון 2026-09-22 (2) == מספר צרופות: אם נשלח data.attachments (מערך של
      // {fileName, fileContent(base64), mimeType, dest}) - מצרפים את כולן (חוץ מאלה שיעדן דרייב בלבד).
      // בלי המערך (מערכות אחרות) - כמו קודם: קובץ בודד מ-fileName/fileContent.
      var list = [];
      if (data.attachments && data.attachments.length) {
        for (var i = 0; i < data.attachments.length; i++) {
          var a = data.attachments[i];
          if (a && a.fileContent && a.dest !== "drive") list.push(a);
        }
      }
      if (list.length > 0) {
        for (var j = 0; j < list.length; j++) {
          attachments.push(Utilities.newBlob(Utilities.base64Decode(list[j].fileContent), list[j].mimeType || "application/octet-stream", list[j].fileName || ("attachment" + (j + 1))));
        }
      } else {
        // המרת ה-Base64 חזרה לקובץ
        var blob = Utilities.newBlob(Utilities.base64Decode(fileB64), "application/octet-stream", fileName);
        attachments = [blob];
      }
    }

    // בניית אפשרויות המייל
    var mailOptions = {
      to: to,
      cc: cc,
      subject: subject,
      body: body,          // נשאר תמיד - גרסת טקסט פשוט כגיבוי
      attachments: attachments,
      name: senderName_(data)
    };

    // === התיקון: אם המערכת שלחה גרסה מעוצבת (htmlBody) - להשתמש בה ===
    if (data.htmlBody) {
      mailOptions.htmlBody = data.htmlBody;
    }

    // שליחת המייל
    MailApp.sendEmail(mailOptions);

    // החזרת תשובת הצלחה
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // במקרה של שגיאה
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===========================================================================
// == תיקון 2026-10-07 (4) == אידמפוטנטיות + doGet (נבנה בעקבות 89 מיילי הזמנה שנרשמו ככישלון בנווה יעקב)
//
// הבעיה: לפעמים גוגל מחזירה ללקוח דף שגיאה HTML ("Script function not found: doGet"), דף 404 או ניתוק
// חיבור - גם כשהמייל כבר נשלח. הלקוח (האתר) לא יכול לדעת אם המייל יצא, ולכן אי אפשר לנסות שוב בלי סכנת כפילות.
//
// הפתרון (תאימות לאחור מלאה): בקשה שמכילה data.requestId נבדקת מול מטמון הסקריפט:
//   - requestId שכבר הסתיים בהצלחה  -> מוחזרת הצלחה בלי לשלוח שוב.
//   - requestId שנמצא כרגע בשליחה  -> מוחזר {status:"pending"} (הלקוח ישאל שוב).
//   - אחרת -> שולחים כרגיל, ובהצלחה שומרים את התוצאה (6 שעות).
// בקשה בלי requestId (מערכות אחרות שמשתמשות באותו סקריפט) - בדיוק כמו קודם.
// doGet?action=status&requestId=... מחזיר את מצב הבקשה (success / pending / unknown) כדי שהלקוח יוכל לברר
// אם מייל שנראה כנכשל כבר נשלח, ו-doGet?action=quota מחזיר את מכסת המיילים היומית שנותרה.
// ===========================================================================
var IDEMP_DONE_TTL_ = 21600;   // 6 שעות - המקסימום ש-CacheService מאפשר
var IDEMP_PENDING_TTL_ = 600;  // שליחה שנתקעה (קריסה) משוחררת אחרי 10 דקות

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "status" && p.requestId) {
    var v = CacheService.getScriptCache().get("req:" + String(p.requestId).slice(0, 80));
    if (!v) return json_({ status: "unknown", requestId: p.requestId });
    try { return json_(JSON.parse(v)); } catch (err) { return json_({ status: "unknown", requestId: p.requestId }); }
  }
  if (p.action === "quota") {
    return json_({ status: "ok", remainingDailyQuota: MailApp.getRemainingDailyQuota() });
  }
  return json_({ status: "ok", service: "gemach-mailer", idempotency: true, version: 18 });
}

function doPost(e) {
  var id = "";
  try {
    var data = JSON.parse(e.postData.contents);
    id = data && data.requestId ? String(data.requestId).slice(0, 80) : "";
  } catch (err) {
    id = "";
  }
  if (!id) return legacyPost_(e); // מערכות אחרות - ללא שינוי

  var cache = CacheService.getScriptCache();
  var key = "req:" + id;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    var existing = cache.get(key);
    if (existing) {
      var st = {};
      try { st = JSON.parse(existing); } catch (err2) {}
      if (st.status === "success") return json_({ status: "success", requestId: id, duplicate: true });
      if (st.status === "pending") return json_({ status: "pending", requestId: id });
    }
    cache.put(key, JSON.stringify({ status: "pending", requestId: id, t: Date.now() }), IDEMP_PENDING_TTL_);
  } catch (lockErr) {
    // לא הצלחנו לקבל נעילה - ממשיכים בלי הגנה מכפילות (עדיף לשלוח מאשר לא לשלוח)
  } finally {
    try { lock.releaseLock(); } catch (err3) {}
  }

  var out = legacyPost_(e);
  var ok = false;
  try { ok = JSON.parse(out.getContent()).status === "success"; } catch (err4) {}
  if (ok) cache.put(key, JSON.stringify({ status: "success", requestId: id, t: Date.now() }), IDEMP_DONE_TTL_);
  else cache.remove(key); // שגיאה ודאית - מותר לנסות שוב
  return out;
}
