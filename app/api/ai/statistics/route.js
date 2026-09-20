import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateContent } from '../../../../lib/ai/gemini';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';
import { processHebrewDateMacro } from '../../../../lib/hebrewDate';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '../../../../lib/orderReservation';
import { assertReadOnlySelect } from '../../../../lib/sqlGuard';
import { getAllCachedSettings } from '../../../../lib/settingsCache';
import { buildSettingsGuide } from '../../../../lib/settingsMetadata';
import { buildHowToGuide } from '../../../../lib/howToGuide';
import {
  buildDateContext,
  buildSharedSqlRules,
  getFullSchemaContext,
  loadEmployeeAccess,
  normalizeAiSql,
  extractSqlQueries,
  finalizeAiText,
  validateSettingTags,
  validateLinkTags,
  buildGuideFollowupPrompt,
  buildUserDateHints,
  rowCountFacts,
  resultsHaveData,
  answerSaysNone,
  trimEnumeration,
  humanizeResultDates,
  finalizeTagsAndText,
} from '../../../../lib/ai/aiCommon';

// עוזר הסטטיסטיקה (StatisticsModal). עד 2026-09-20 קיבל סכימה חלקית (SCHEMA_MAP) בלי שדות כמו
// isDelivery / zeout / takenDate, דרש שהתשובה תתחיל ב-"SQL:" (אחרת הציג את השאילתה הגולמית
// למשתמשת ולא הריץ אותה), לא החזיר טבלה ("איפה הרשימה?") ולא ידע לענות על שאלות "איפה/איך".
// עכשיו: סכימה מלאה, חילוץ SQL מכל מקום בתשובה, החזרת השורות לממשק, ושני כלי ההדרכה של הצ'אט.

const MAX_ROWS_FOR_MODEL = 200;
const MAX_ROWS_FOR_UI = 500;

const SYSTEM_PROMPT = `You are a helpful and smart AI statistics/data assistant for a dress rental management system (Gemach).
You have access to the FULL PostgreSQL database schema provided below.
When the user asks for data, statistics, a list, or details about a record, you must FIRST output ONLY valid PostgreSQL SQL queries, each on its own line starting with the exact prefix "SQL: " (no text before them). If you need several separate results output several "SQL: " lines.

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks around the SQL query. The query must be valid PostgreSQL syntax.
2. Use double quotes for table names (e.g. "Order", "Customer") and camelCase column names (e.g. "firstName"). Booleans use true/false.
3. ALWAYS use 'AS' with double quotes to alias output columns into Hebrew, e.g. SELECT COUNT(*) AS "סה""כ לקוחות" (avoid a double quote inside an alias - write סהכ or use a hyphen).
4. If it's a general question that needs neither the database nor a guide, answer it naturally in Hebrew without the "SQL: " prefix.
5. CRITICAL RULE FOR DELETED/INACTIVE DATA: whenever you query any table add '"isDeleted" = false'. For "DressItem" also add '"notInUse" = false' and '"inRepair" = false' unless the user asks about them.
6. CRITICAL RULE FOR TEXT FIELDS: never use '=' for names/descriptions - use ILIKE with wildcards (multi-word: AND between words, not OR).
7. SIZES/MODELS: a rental's size is "OrderItem"."sizeText" (only single digits carry a leading zero: '08'; '68' stays '68'). The model number is "barcodePrefix" - filter with "OrderItem"."barcodePrefix" = 811 directly, never by joining "DressModel" by name. A barcode is "OrderItem"."barcode" (text); its rental history is in "OrderItem" joined to "Order" (use "takenDate" for when it left).
8. ORDER SORTING: when you query "Order"/"OrderItem" sort by "eventDate" DESC NULLS LAST unless asked otherwise.
9. IMPORTANT UI FEATURE: for rows the user may want to open, include two hidden columns "_actionUrl" and "_actionLabel". Orders: use the short orderId: '/orders/' || "orderId" AS "_actionUrl", 'פרטי הזמנה' AS "_actionLabel". Customers: '/customers/' || "id" AS "_actionUrl", 'תיק לקוח' AS "_actionLabel". Never display long UUIDs to the user - show "orderId" for orders, "legacyId" for customers, "barcodePrefix" for models.
10. CRITICAL RULE FOR DRAFT/PLACEHOLDER ORDERS: "Order"."status" can hold two internal placeholders that are NOT real orders: '${DRAFT_ORDER_STATUS}' (unfinished draft) and '${RESERVED_ORDER_STATUS}' (temporary number reservation). Never count/list them unless asked. Whenever you query or join through "Order" add COALESCE("status", '') NOT IN ('${DRAFT_ORDER_STATUS}', '${RESERVED_ORDER_STATUS}') (see rule S1 below - never a bare NOT IN).
11. You cannot compute dress availability for a date via SQL. For statistics about past/future bookings use "OrderItem"/"Order" data only.
12. QUESTIONS ABOUT WHERE/HOW (not data): if the user asks where a system setting is or how to change it (e.g. "איפה מגדירים...", "איך משנים...") output exactly one line: ACTION: SETTINGS_GUIDE() . If the user asks how to perform an operational action in the system (e.g. "איך מוסיפים...", "איך עורכים עובדים") output exactly one line: ACTION: HOWTO_GUIDE() . The system then gives you the catalog to answer from. Never guess menu names yourself.`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const { prompt, history = [], contextQuery = '' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const { isManager, employeeId } = await loadEmployeeAccess(prisma, cookieStore);

    const schemaText = getFullSchemaContext();
    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    const dateContext = buildDateContext();
    // גם ההודעות הקודמות של המשתמשת: "לא הגיוני" מתייחס לחודש שהוזכר בשאלה הקודמת
    const userDateHints = buildUserDateHints([...history.filter(m => m.role === 'user').slice(-3).map(m => m.content), prompt].join('\n'));
    const sharedRules = buildSharedSqlRules({ draftStatus: DRAFT_ORDER_STATUS, reservedStatus: RESERVED_ORDER_STATUS });

    const initialPrompt = `${SYSTEM_PROMPT}\n${sharedRules}\n\n${schemaText}\n${dateContext}${userDateHints}\n\nCurrent Context Query (the user is currently viewing this data, keep this in mind if relevant): ${contextQuery}\n\nChat History (the user's latest message may dispute or refine the previous answer - re-check the data instead of apologizing or asking permission):\n${historyText}\n\nCurrent User Question: ${prompt}`;
    let aiResponse = await generateContent(initialPrompt);
    let tableRows = null;

    // --- הדרכות: "איפה ההגדרה" / "איך עושים" (בשימוש אמיתי נשאלו כאן שאלות כאלה והתשובה הייתה ניחוש)
    const wantsSettings = isManager && /ACTION:\s*SETTINGS_GUIDE\(\)/i.test(aiResponse);
    const wantsHowTo = /ACTION:\s*HOWTO_GUIDE\(\)/i.test(aiResponse) || (!isManager && /ACTION:\s*SETTINGS_GUIDE\(\)/i.test(aiResponse));
    if (wantsSettings || wantsHowTo) {
      try {
        if (wantsSettings) {
          const catalog = buildSettingsGuide(await getAllCachedSettings());
          const text = await generateContent(buildGuideFollowupPrompt({ kind: 'settings', prompt, catalog, dateContext }));
          aiResponse = validateSettingTags(text, catalog);
        } else {
          const catalog = buildHowToGuide();
          const text = await generateContent(buildGuideFollowupPrompt({ kind: 'howto', prompt, catalog, dateContext }));
          aiResponse = validateLinkTags(text, catalog);
        }
      } catch (guideErr) {
        console.error('Statistics guide error:', guideErr);
        aiResponse = 'מצטער, נתקלתי בשגיאה בעת שליפת ההדרכה. אנא נסה לנסח את השאלה מחדש.';
      }
    } else {
      // --- שאילתות: מחפשים "SQL:" בכל מקום בתשובה (לא רק בתחילתה)
      let queries = extractSqlQueries(aiResponse).map(q => normalizeAiSql(processHebrewDateMacro(q)));

      if (queries.length > 0) {
        const runAll = async (qs) => {
          const results = [];
          for (const q of qs) {
            try {
              assertReadOnlySelect(q);
            } catch (guardErr) {
              console.error('SQL Guard rejected AI-generated statistics query:', guardErr.message, '\nRejected SQL:', q);
              throw guardErr;
            }
            results.push(await prisma.$queryRawUnsafe(q));
          }
          return results;
        };

        let combinedResults = null;
        let dbErrorStr = null;
        try {
          combinedResults = await runAll(queries);
        } catch (dbError) {
          dbErrorStr = dbError.message;
          // תיקון עצמי: מחזירים למודל את השגיאה
          const retryPrompt = `${SYSTEM_PROMPT}\n${sharedRules}\n\n${schemaText}\n${dateContext}${userDateHints}\n\nUser Question: ${prompt}\n\nYou generated these SQL queries:\n${queries.join('\n')}\nBut it failed with this PostgreSQL error: ${dbErrorStr}\n\nPlease output ONLY corrected PostgreSQL SQL queries, each line starting with "SQL: ". Avoid double quotes inside Hebrew aliases.`;
          const retryResponse = await generateContent(retryPrompt);
          const retryQueries = extractSqlQueries(retryResponse).map(q => normalizeAiSql(processHebrewDateMacro(q)));
          if (retryQueries.length > 0) {
            try {
              combinedResults = await runAll(retryQueries);
              queries = retryQueries;
              dbErrorStr = null;
            } catch (retryErr) {
              dbErrorStr = retryErr.message;
            }
          }
        }

        if (dbErrorStr || !combinedResults) {
          aiResponse = 'מצטער, נתקלתי בשגיאה בעת חישוב הסטטיסטיקה. אנא נסה לנסח את השאלה אחרת.';
        } else {
          const toJson = (v) => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString() : x));
          const safeResults = combinedResults.map(toJson);
          const forModel = safeResults.map(r => humanizeResultDates(Array.isArray(r) ? r.slice(0, MAX_ROWS_FOR_MODEL) : r));
          const truncatedNote = safeResults.some(r => Array.isArray(r) && r.length > MAX_ROWS_FOR_MODEL)
            ? `\nNOTE: some result sets were truncated to the first ${MAX_ROWS_FOR_MODEL} rows for you; the real row counts are: ${JSON.stringify(safeResults.map(r => Array.isArray(r) ? r.length : 1))}. State the real counts.`
            : '';

          // הטבלה שמוצגת למשתמשת: תוצאת השאילתה האחרונה שהיא רשימה (לא ספירה בודדת)
          const lastList = [...safeResults].reverse().find(r => Array.isArray(r) && r.length > 0 && Object.keys(r[0]).length > 0);
          if (lastList && !(lastList.length === 1 && Object.keys(lastList[0]).filter(k => !k.startsWith('_')).length === 1)) {
            tableRows = lastList.slice(0, MAX_ROWS_FOR_UI);
          }

          const followupPrompt = `The user asked: "${prompt}".
${history.length ? `Earlier in this chat (the user may be disputing or refining the previous answer):\n${historyText}\n` : ''}You executed these SQL queries:
${queries.join('\n')}
The database returned these JSON results (in order):
${JSON.stringify(forModel)}${truncatedNote}
ROW COUNTS (facts computed by the server): ${rowCountFacts(safeResults)}. The SQL already applied the user's filters, so every returned row matches the request.

Answer the user directly in Hebrew, based ONLY on these results.
CRITICAL RULES FOR YOUR RESPONSE:
1. NO markdown at all (no asterisks, no "*" bullets). Plain sentences, or lines starting with "-".
2. Dates: dates inside the results are already formatted by the server as "Hebrew date (dd/mm/yyyy)" - copy them exactly as they appear; for any other date copy both forms from the date context below. NEVER convert or compute a date yourself, and never state the start/end dates of a period (a month, a range) unless those exact dates appear in the results or in the resolved-dates block - otherwise just name the period (e.g. "חודש אלול תשפ\"ו"). Today's date is in the date context.
3. Do not list long runs of consecutive dates - group them into a range.
4. NEVER show SQL, table/column names or long UUIDs. NEVER write links or file names, and never promise an Excel/PDF/CSV file - you cannot create files.
5. If the user asked for a list/details and rows were returned, say how many records were found and that the full list is shown in the table below your answer. Do not repeat every row in the text.
6. If the results are empty, say plainly that no matching records were found and state exactly what was searched (names/dates/model). Do not invent reasons and do not ask the user for permission to search again.
7. Output ONLY the final answer to the user - no meta text, no "here is a summary".${dateContext}${userDateHints}`;

          aiResponse = await generateContent(followupPrompt);

          // בבדיקה המודל כתב "לא נמצאו הזמנות" כשהשאילתה החזירה 25 שורות. אם התשובה סותרת את הנתונים
          // - מנסים פעם אחת עם אזהרה מפורשת, ואם שוב - תשובה דטרמיניסטית מהנתונים עצמם.
          if (resultsHaveData(safeResults) && answerSaysNone(aiResponse)) {
            aiResponse = await generateContent(`${followupPrompt}\n\nWARNING: your previous answer claimed nothing was found, but the database DID return data (${rowCountFacts(safeResults)}). Answer again strictly from the results above.`);
            if (answerSaysNone(aiResponse)) {
              const n = tableRows ? tableRows.length : null;
              aiResponse = n ? `נמצאו ${n} רשומות התואמות לחיפוש. הרשימה המלאה מוצגת בטבלה מתחת.` : `התוצאה: ${JSON.stringify(forModel[forModel.length - 1]).slice(0, 200)}`;
            }
          }
          if (tableRows) aiResponse = trimEnumeration(aiResponse);
        }
      }
    }

    aiResponse = await finalizeTagsAndText(aiResponse, {
      isManager,
      loadSettingsCatalog: async () => buildSettingsGuide(await getAllCachedSettings()),
      loadHowToCatalog: async () => buildHowToGuide(),
    });

    try {
      if (employeeId) {
        await prisma.aIChatSession.create({
          data: {
            employeeId,
            context: 'סטטיסטיקה',
            messagesJson: JSON.stringify([
              { role: 'user', content: prompt },
              { role: 'model', content: aiResponse }
            ])
          }
        });
      }
    } catch (e) { console.error('Failed to save AI session', e); }

    return NextResponse.json({ response: aiResponse, data: tableRows });
  } catch (error) {
    console.error('API Statistics Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate statistics' }, { status: 500 });
  }
}
