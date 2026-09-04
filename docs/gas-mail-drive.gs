/**
 * גמ"ח שמלות - שרת מייל + דרייב (Google Apps Script)
 * =====================================================
 * להדביק בקובץ Code.gs חדש ב-script.google.com -> Deploy -> New deployment -> Web app
 * Execute as: Me | Who has access: Anyone
 *
 * תומך בשני הפורמטים:
 *  1. ישן: {to, subject, body, htmlBody?, fileName, fileContent(base64)} - קובץ אחד.
 *  2. חדש: {attachments:[{fileName,fileContent(base64),mimeType,sizeBytes,dest}],
 *            sendMode:'email'|'drive'|'both', driveFolderId, driveShareEmail,
 *            driveAllowDownload, grantFullDownload, action:'sendGemachOrderEmail'?}
 *     dest לכל קובץ: 'email' = צרופה למייל | 'drive' = העלאה לדרייב+שיתוף | 'both' = גם וגם
 *
 * תמיד מחזיר JSON: {status:'success', driveLinks:[{fileName,url,id}], emailed:[...]}
 * או {status:'error', message:'...'}.
 *
 * הרשאות דרייב לנמען (הורדה מלאה):
 *  - addViewer(driveShareEmail) - שיתוף ישיר לכתובת הנמען
 *  - setSharing(ANYONE_WITH_LINK, VIEW) - קישור פתוח להורדה לכל מחזיק הקישור
 *  - VIEW ב-Drive מאפשר הורדה כברירת מחדל (לא נועל עם viewersCanCopyContent=false)
 */

function doPost(e) {
  try {
    var data = {};
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonOut({ status: 'error', message: 'Invalid JSON: ' + err });
    }
    if (data.action === 'sendGemachOrderEmail') {
      return handleOrderEmail(data);
    }
    return handleGenericEmail(data);
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err && err.stack || err) });
  }
}

function doGet() {
  return jsonOut({ status: 'ok', service: 'gemach-mail-drive', time: new Date().toString() });
}

// ---------- עזר ----------

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function decodeB64(b64) {
  return Utilities.base64Decode(String(b64 || ''));
}

function guessMime(fileName, fallback) {
  var n = String(fileName || '').toLowerCase();
  if (n.match(/\.pdf$/)) return 'application/pdf';
  if (n.match(/\.(png)$/)) return 'image/png';
  if (n.match(/\.(jpg|jpeg)$/)) return 'image/jpeg';
  if (n.match(/\.(txt)$/)) return 'text/plain';
  if (n.match(/\.(csv)$/)) return 'text/csv';
  if (n.match(/\.(xlsx?)$/)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.match(/\.(docx?)$/)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return fallback || 'application/octet-stream';
}

/** מאחד פורמט ישן (fileName/fileContent) עם attachments[] לרשימה אחת. */
function collectAttachments(data) {
  var list = [];
  if (data.attachments && data.attachments.length !== undefined) {
    try {
      var arr = data.attachments;
      if (typeof arr === 'string') arr = JSON.parse(arr);
      for (var i = 0; i < arr.length; i++) {
        var a = arr[i];
        if (a && a.fileContent && a.fileName) {
          list.push({
            fileName: String(a.fileName),
            fileContent: String(a.fileContent),
            mimeType: a.mimeType || guessMime(a.fileName),
            sizeBytes: a.sizeBytes || null,
            dest: a.dest || destFromMode(data.sendMode)
          });
        }
      }
    } catch (err) { /* מתעלם - נופל לקובץ הבודד */ }
  }
  if (list.length === 0 && data.fileContent) {
    list.push({
      fileName: data.fileName || 'הודעה.txt',
      fileContent: String(data.fileContent),
      mimeType: data.mimeType || guessMime(data.fileName || ''),
      sizeBytes: data.sizeBytes || null,
      dest: destFromMode(data.sendMode)
    });
  }
  return list;
}

function destFromMode(sendMode) {
  if (sendMode === 'drive') return 'drive';
  if (sendMode === 'both') return 'both';
  return 'email';
}

function getTargetFolder(driveFolderId) {
  if (driveFolderId && String(driveFolderId).trim() !== '') {
    try {
      return DriveApp.getFolderById(String(driveFolderId).trim());
    } catch (err) {
      // מזהה לא תקין - נופל לשורש
    }
  }
  return DriveApp.getRootFolder();
}

/**
 * מעלה קובץ לדרייב ונותן לנמען הרשאת הורדה מלאה.
 * מחזיר {id, url, fileName}.
 */
function uploadToDriveWithFullDownload(blob, fileName, folder, shareEmail, allowDownload) {
  var file = folder.createFile(blob);
  file.setName(fileName);
  var grantDownload = (allowDownload !== false);
  // 1. שיתוף ישיר לנמען - צפייה (=הורדה מותרת)
  if (shareEmail && String(shareEmail).indexOf('@') > -1) {
    try { file.addViewer(String(shareEmail).trim()); } catch (err) {}
  }
  // 2. קישור פתוח לכל מחזיק הקישור - צפייה (=הורדה מותרת, לא נעול)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}
  // הערה: אם בארגון שלך מופעל "viewersCanCopyContent=false" דרך Admin,
  // בטל את ההגבלה ברמת הקובץ דרך Drive API v3:
  // Drive.Files.update({viewersCanCopyContent:true, copyRequiresWriterPermission:false}, file.getId())
  // (דורש הפעלת Advanced Drive Service).
  try {
    if (grantDownload && typeof Drive !== 'undefined' && Drive.Files && Drive.Files.update) {
      Drive.Files.update({ viewersCanCopyContent: true, copyRequiresWriterPermission: false }, file.getId());
    }
  } catch (err) {}
  return { id: file.getId(), url: file.getUrl(), fileName: fileName };
}

function fmtSize(bytes) {
  var n = Number(bytes);
  if (!n || isNaN(n) || n <= 0) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

var DEST_HE = { email: 'מצורף למייל', drive: 'נשמר בדרייב', both: 'מייל + דרייב' };

/**
 * טבלת הוראות מסודרת - נבנית ב-GAS כגיבוי (האפליקציה כבר שולחת טבלה כזו ב-htmlBody,
 * אבל אם הגיע htmlBody בלי טבלה - מוסיפים כאן אוטומטית).
 */
function buildGuideTableHtml(files, driveUrlByName) {
  if (!files || files.length === 0) return '';
  var rows = '';
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var dest = DEST_HE[f.dest] ? f.dest : 'email';
    var how;
    if (dest === 'email') {
      how = 'פתחו את הצרופה בתחתית המייל ולחצו הורדה.';
    } else {
      var url = (driveUrlByName && driveUrlByName[f.fileName]) || '';
      if (url) {
        how = 'לחצו <a href="' + url + '" style="color:#1565c0;font-weight:bold;">קישור להורדה</a> - הקישור פתוח עם הרשאת הורדה מלאה, אין צורך בבקשת גישה.';
      } else {
        how = 'קישור ההורדה מהדרייב יישלח בנפרד - הקובץ שותף עם הרשאת הורדה מלאה לכתובת זו.';
      }
      if (dest === 'both') how = 'מצורף למייל + ' + how;
    }
    rows += '<tr>'
      + '<td style="text-align:center;color:#999;">' + (i + 1) + '</td>'
      + '<td style="font-weight:bold;color:#333;">' + escapeHtml_(f.fileName) + '</td>'
      + '<td style="white-space:nowrap;">' + fmtSize(f.sizeBytes || (f.fileContent ? Math.round(f.fileContent.length * 3 / 4) : 0)) + '</td>'
      + '<td style="white-space:nowrap;">' + DEST_HE[dest] + '</td>'
      + '<td style="font-size:12.5px;color:#555;">' + how + '</td>'
      + '</tr>';
  }
  return '<div style="font-size:15px;font-weight:bold;color:#333;margin:0 0 10px 0;">קבצים מצורפים - הוראות הורדה</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13.5px;border:1px solid #e5e5e5;margin-bottom:16px;">'
    + '<thead><tr style="background:#f4f4f4;">'
    + '<th style="width:34px;padding:10px 12px;text-align:center;">#</th>'
    + '<th style="padding:10px 12px;text-align:right;">שם הקובץ</th>'
    + '<th style="padding:10px 12px;text-align:right;">גודל</th>'
    + '<th style="padding:10px 12px;text-align:right;">יעד</th>'
    + '<th style="padding:10px 12px;text-align:right;">איך מורידים?</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div style="font-size:13px;color:#555;background:#f4f4f4;border:1px solid #e5e5e5;border-radius:6px;padding:12px 14px;">'
    + 'הקבצים בדרייב שותפו ישירות לכתובת המייל שלכם עם הרשאת צפייה והורדה מלאה, ובנוסף הקישור פתוח לכל מי שמחזיק בו.'
    + '</div>';
}

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ensureGuideInHtml(htmlBody, guideHtml) {
  if (!guideHtml) return htmlBody || '';
  if (!htmlBody) return '<div dir="rtl">' + guideHtml + '</div>';
  if (String(htmlBody).indexOf('קבצים מצורפים - הוראות הורדה') > -1) return htmlBody;
  return String(htmlBody).replace('</body>', guideHtml + '</body>');
}

// ---------- מסלול כללי ----------

function handleGenericEmail(data) {
  var to = data.to;
  if (!to) return jsonOut({ status: 'error', message: 'Missing "to"' });
  var files = collectAttachments(data);
  var shareEmail = data.driveShareEmail || to;
  var folder = getTargetFolder(data.driveFolderId);

  var emailBlobs = [];   // צרופות למייל
  var emailedNames = [];
  var driveLinks = [];
  var driveUrlByName = {};

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var mime = f.mimeType || guessMime(f.fileName);
    var blob = Utilities.newBlob(decodeB64(f.fileContent), mime, f.fileName);
    var needsDrive = (f.dest === 'drive' || f.dest === 'both');
    var needsEmail = (f.dest === 'email' || f.dest === 'both');
    // מצב drive בלבד בלי קבצים למייל = שולחים מייל עם קישורים בלבד (אין צרופה)
    if (needsDrive) {
      var up = uploadToDriveWithFullDownload(blob, f.fileName, folder, shareEmail, data.driveAllowDownload !== false && data.grantFullDownload !== false);
      driveLinks.push(up);
      driveUrlByName[f.fileName] = up.url;
    }
    if (needsEmail) {
      emailBlobs.push(blob);
      emailedNames.push(f.fileName);
    }
  }

  // אם sendMode הכללי הוא drive ואין צרופות - עדיין שולחים מייל עם טבלת הוראות + קישורים
  var guideHtml = buildGuideTableHtml(files, driveUrlByName);
  var htmlBody = ensureGuideInHtml(data.htmlBody || '', guideHtml);
  var textBody = String(data.body || '');
  if (files.length > 0 && textBody.indexOf('קבצים מצורפים - הוראות הורדה') === -1) {
    textBody += '\n\nקבצים מצורפים - הוראות הורדה:\n';
    for (var j = 0; j < files.length; j++) {
      var fj = files[j];
      var durl = driveUrlByName[fj.fileName] || '';
      textBody += (j + 1) + '. ' + fj.fileName + ' (' + (DEST_HE[fj.dest] || DEST_HE.email) + ')' + (durl ? ' - הורדה: ' + durl : '') + '\n';
    }
    textBody += 'קבצי דרייב שותפו עם הרשאת הורדה מלאה לכתובת זו.\n';
  }

  GmailApp.sendEmail(to, data.subject || 'הודעה חדשה', textBody, {
    cc: data.cc || '',
    htmlBody: htmlBody || undefined,
    attachments: emailBlobs
  });

  return jsonOut({ status: 'success', emailed: emailedNames, driveLinks: driveLinks });
}

// ---------- מסלול הזמנה / השכרה ----------

function handleOrderEmail(data) {
  var to = data.to;
  if (!to) return jsonOut({ status: 'error', message: 'Missing "to"' });
  var files = collectAttachments(data);
  var shareEmail = data.driveShareEmail || to;
  var folder = getTargetFolder(data.driveFolderId);

  var emailBlobs = [];
  var emailedNames = [];
  var driveLinks = [];
  var driveUrlByName = {};

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var mime = f.mimeType || guessMime(f.fileName);
    var blob = Utilities.newBlob(decodeB64(f.fileContent), mime, f.fileName);
    var needsDrive = (f.dest === 'drive' || f.dest === 'both');
    var needsEmail = (f.dest === 'email' || f.dest === 'both');
    if (needsDrive) {
      var up = uploadToDriveWithFullDownload(blob, f.fileName, folder, shareEmail, data.driveAllowDownload !== false && data.grantFullDownload !== false);
      driveLinks.push(up);
      driveUrlByName[f.fileName] = up.url;
    }
    if (needsEmail) {
      emailBlobs.push(blob);
      emailedNames.push(f.fileName);
    }
  }

  var guideHtml = buildGuideTableHtml(files, driveUrlByName);
  // bodyText מהאפליקציה כבר מכיל טבלה - מוסיפים רק אם חסר
  var bodyHtml = ensureGuideInHtml(data.bodyText || data.htmlBody || '', guideHtml);

  GmailApp.sendEmail(to, data.subject || 'הזמנה - גמ"ח שמלות', bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500), {
    cc: data.cc || '',
    htmlBody: bodyHtml,
    attachments: emailBlobs
  });

  return jsonOut({ status: 'success', emailed: emailedNames, driveLinks: driveLinks });
}
