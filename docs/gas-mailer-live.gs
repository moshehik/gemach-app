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
 * !!! הקובץ הזה עדיין לא נפרס. פריסה = clasp push + clasp deploy -i <deploymentId> (גרסה חדשה לאותו
 * URL של /exec). זה משנה סקריפט חי שמשרת גם מערכות אחרות - נדרש אישור מפורש של הבעלים. !!!
 *
 * (docs/gas-mail-drive.gs הוא סקריפט אחר, מורחב עם דרייב, שלא פרוס - ר' CLAUDE.md "Cloud backup".)
 */

function doPost(e) {
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
          name: 'גמ"ח שמלות'
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
      name: 'גמ"ח שמלות'
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