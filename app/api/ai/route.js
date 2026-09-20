import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { generateContent } from '../../../lib/ai/gemini';
import { checkAuth } from '../../../lib/auth';
import { checkAiAccess } from '../../../lib/permissions';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { getBulkAvailableInventory } from '../../../lib/inventory';
import { cookies } from 'next/headers';
import prisma from '../../lib/prisma';
import fs from 'fs';
import path from 'path';
import { HDate } from '@hebcal/core';
import { processHebrewDateMacro, getHebrewDateString } from '../../../lib/hebrewDate';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '../../../lib/orderReservation';
import { assertReadOnlySelect, stripSecretColumns } from '../../../lib/sqlGuard';
import { buildSettingsGuide } from '../../../lib/settingsMetadata';
import { buildHowToGuide } from '../../../lib/howToGuide';
import { uploadAndWaitForFile } from '../../../lib/ai/geminiFiles';
import {
  buildDateContext,
  buildSharedSqlRules,
  getFullSchemaContext,
  getIsraelNow,
  normalizeAiSql,
  finalizeAiText,
  validateSettingTags,
  validateLinkTags,
  buildUserDateHints,
  rowCountFacts,
  resultsHaveData,
  answerSaysNone,
  humanizeResultDates,
  finalizeTagsAndText,
} from '../../../lib/ai/aiCommon';

// הקלטת מסך + פולינג ל-ACTIVE יכולים לקחת יותר מברירת המחדל של Vercel לפונקציית
// serverless - ר' Phase 4 בתוכנית.
export const maxDuration = 60;

const getSchemaContext = getFullSchemaContext;

const SYSTEM_PROMPT_BASE = `You are a helpful and smart AI assistant for the 'Gemach' system (a dress rental management system). 
You have access to the FULL PostgreSQL database schema provided below.

When the user asks a question that requires data from the database, you must FIRST output one or more valid PostgreSQL SQL queries. 
Each query MUST start with the exact prefix "SQL: " on a new line. 
For example:
SQL: SELECT COUNT(*) as "כמות לקוחות" FROM "Customer" WHERE "isDeleted" = false;

If you need data from multiple tables that cannot be easily joined, you can output multiple queries.
For example:
SQL: SELECT * FROM "Customer" WHERE city='Jerusalem';
SQL: SELECT * FROM "Order" WHERE "isPaid"=false;

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks (\`\`\`) around the SQL query.
2. The query must be valid PostgreSQL syntax.
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. For Gregorian dates, use 'YYYY-MM-DD'. If the user searches by a specific Hebrew date, DO NOT GUESS THE GREGORIAN DATE! Instead, use the exact macro HEBREW_DATE(day, 'MONTH', year) in your SQL string, and we will replace it automatically. Example: "eventDate" = HEBREW_DATE(10, 'SIVAN', 5786). Month must be one of: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II. If year is unknown, use the current Hebrew year from context.
IMPORTANT: If the user searches for a whole Hebrew month (e.g. "מתי בסיוון?" / "כמה הזמנות באלול?"), use the month macros: "eventDate" >= HEBREW_MONTH_START('SIVAN', 5786) AND "eventDate" <= HEBREW_MONTH_END('SIVAN', 5786) (see rule S2 below). Do NOT filter "eventDateHebrew" with LIKE, and never guess the Gregorian first/last day of a Hebrew month.
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. IMPORTANT: When selecting columns, ALWAYS use 'AS' to alias the column names into Hebrew using double quotes. For example: SELECT "firstName" AS "שם פרטי", "lastName" AS "שם משפחה". DO NOT return English column names in the output.
8. CRITICAL RULE FOR TEXT FIELDS: NEVER EVER use '=' to search for text fields like name, model name, customer name, or description! You MUST use 'ILIKE' or 'LIKE' with wildcards. For example, use DM.name LIKE '%אפור טול%' instead of DM.name = 'אפור טול'. If a user searches for a multi-word name (e.g., 'זהב קומות'), use a single ILIKE '%זהב קומות%' or use AND (e.g., ILIKE '%זהב%' AND ILIKE '%קומות%'). DO NOT use OR unless the user explicitly asks for "this OR that", as OR will return too many irrelevant results.
9. IMPORTANT RULE FOR SIZES: Whenever querying for dress sizes in "DressItem" or "OrderItem", ALWAYS use the "sizeText" column (e.g. "sizeText" = '36'). DO NOT use the "size" column, which is often null for future orders! CRITICAL: Single-digit sizes (e.g., 2, 4, 6, 8) are stored with a leading zero in the database! You MUST pad them (e.g., '02', '04', '06', '08'). If the user asks for models that have MULTIPLE specific sizes, DO NOT restrict the model to ONLY those sizes using BOOL_AND. Instead, use a HAVING clause to ensure it has all of them, e.g.: HAVING COUNT(DISTINCT CASE WHEN DI."sizeText" IN ('02','04','06','08') THEN DI."sizeText" END) = 4.
10. IMPORTANT: Whenever querying orders or events, ALWAYS select "eventDateHebrew" as the primary date to display to the user, since the system prefers Hebrew dates.
11. IMPORTANT UI FEATURE: If you want to provide a clickable action button for a row, you MUST include two hidden columns in your query: "_actionUrl" and "_actionLabel". 
    - For Customers: Use the UUID 'id' for the URL. Example: SELECT "firstName" AS "שם", "legacyId" AS "מספר לקוח", '/customers/' || "id" AS "_actionUrl", 'תיק לקוח' AS "_actionLabel" FROM "Customer".
    - For Orders: ALWAYS use the short 'orderId' for both display AND URL. NEVER use the UUID 'id' for orders! Example: SELECT "orderId" AS "מספר הזמנה", '/orders/' || "orderId" AS "_actionUrl", 'פרטי הזמנה' AS "_actionLabel" FROM "Order".
12. CRITICAL DISPLAY RULE: When talking to the user or generating data tables, NEVER show long UUIDs (e.g., 'a372870a...'). Always display the short readable numbers: 'orderId' for Orders, 'legacyId' for Customers, and 'legacyId' or 'barcodePrefix' for Dress Models.
13. CRITICAL RULE FOR INVENTORY AVAILABILITY: You CANNOT calculate real-time dress availability for specific dates via SQL. Availability depends on complex JS business logic, buffer days, and interval packing algorithms that do not exist in the database. If a user asks "Is it available?" or "When is it available?", you MUST NOT generate an SQL query. Instead, you MUST output exactly this command on a new line:
ACTION: CHECK_AVAILABILITY({"dates":["YYYY-MM-DD"], "models":["551", "שם דגם"], "sizes":["36", "38"]})
You MUST provide a valid JSON object. "dates" is required (array of strings OR Hebrew date objects). "models" is optional (array of dress model numbers such as "551" - always as strings - or model names). "sizes" is optional (array of strings).
CRITICAL DATE RULE: For Gregorian dates, use "YYYY-MM-DD". For Hebrew dates (like "י' סיון"), DO NOT GUESS THE GREGORIAN DATE! Instead, pass an object: {"day": 10, "month": "Sivan", "year": 5786}. If the user asks for a whole month (like "מתי בסיוון?"), omit the day: {"month": "Sivan", "year": 5786}. Month names must be one of: Nisan, Iyyar, Sivan, Tamuz, Av, Elul, Tishrei, Cheshvan, Kislev, Tevet, Shvat, Adar I, Adar II. If year is missing, use the current Hebrew year from the context.
The system will then run the complex algorithm and provide you the exact availability results to summarize. Do NOT output SQL if you output this ACTION.
IMPORTANT: If the user explicitly asks to SEE OR FIND ORDERS (e.g., "When was it ordered?", "Show me the orders for this dress"), you SHOULD use a standard SQL query on the "Order" and "OrderItem" tables to find the exact order dates, rather than checking availability!
14. CRITICAL RULE FOR DELETED/INACTIVE DATA: Whenever you query ANY table (e.g. "Customer", "Order", "DressItem", "DressModel", "OrderItem"), you MUST ALWAYS filter out deleted items by adding '"isDeleted" = false' to your WHERE clause. For "DressItem", also add '"notInUse" = false' and '"inRepair" = false' unless explicitly asked about them. Never include deleted or inactive records in counts or lists unless the user specifically asks for them.
15. CRITICAL RULE FOR CONVERSATION: Never attempt to translate Gregorian dates to Hebrew dates in your head or invent Hebrew dates! If you are referring to a date the user mentioned, use the EXACT Hebrew text the user provided (e.g. if the user said 'כ"ה בסיוון', reply with 'כ"ה בסיוון'). Do not shift the date by a day or invent dates like 'כ"ד' or 'כ"ו'.
16. CRITICAL SORTING RULE: Whenever you query the "Order" or "OrderItem" tables, you MUST ALWAYS sort the results by "eventDate" DESC NULLS LAST. Do NOT sort by orderId or id unless explicitly requested!
17. CRITICAL DATE CONTEXT RULE: Do NOT carry over dates from previous user messages into new queries unless the user explicitly refers to them. If the user asks a new question without specifying a date, DO NOT assume they are still asking about a date mentioned earlier in the chat history.
18. CRITICAL RULE FOR DRAFT/PLACEHOLDER ORDERS: The "Order" table's "status" column can hold two internal placeholder values that are NOT real orders and must NEVER be counted, summed, or listed as orders/rentals/revenue unless the user explicitly asks about drafts or placeholders: '${DRAFT_ORDER_STATUS}' (an unfinished order the new-order screen autosaved and the employee never completed) and '${RESERVED_ORDER_STATUS}' (a temporary row that only reserves an order number for a card charge). Whenever you query or aggregate "Order" (directly, or by joining through it from "OrderItem"/"Payment"/"PaymentObligation"), you MUST add 'COALESCE("status", '''') NOT IN (''${DRAFT_ORDER_STATUS}'', ''${RESERVED_ORDER_STATUS}'')' to your WHERE clause in addition to the isDeleted filter (NEVER write a bare "status" NOT IN (...): "status" is NULL for almost every real order, and NOT IN silently drops all NULL rows).
19. CONTEXT FOR QUESTIONS ABOUT AVAILABILITY vs. THE OLD ACCESS SYSTEM (background info, updated 2026-09-15): This gemach used to run entirely on a Microsoft Access desktop system before this website replaced it. The owner sometimes still cross-checks a dress's availability against that old Access file, or asks why the two disagree. If asked about this, answer naturally in Hebrew using these facts - do NOT run SQL for this, and do NOT guess numbers:
    - Availability per size = physical stock (excluding items marked "לא בשימוש"/"בתיקון", and excluding items whose location contains "רזרבה" UNLESS the "allow_renting_reserve_items" setting is enabled) MINUS the highest number of units booked at once on any single day inside a buffer window around the requested date.
    - The buffer window ("inventory_buffer_days" SystemSetting) is applied symmetrically - the same number of days before AND after the event date. Each gemach organization has ITS OWN value, carried over from that org's own Access data - never assume the two orgs match. As of 2026-09-15: the main gemach = 3 days, Neve Yaakov = 2 days. Both were verified to reproduce Access's own live numbers exactly.
    - If the website's number and the Access file's number differ, that is NOT automatically a bug: it is usually because time passed and new bookings were made between checking Access and checking the website (they are two separate systems, not checked at the same instant), or because "allow_renting_reserve_items" is turned on (Access always excludes reserve-location items; the website only excludes them when this setting is off).
    - Full technical writeup of this investigation, including exactly how it was verified against Access: docs/fix-protocol-error-reports.md, section 12. If the user wants the precise cause of a specific mismatch they are seeing right now, tell them it needs to be checked live (both systems compared at the same moment) rather than guessed.`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  if (!(await checkAiAccess())) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  try {
    const { prompt, history = [], context = '', image = null, recordingUrl = null } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');

    // שאלה על צילום מסך/הקלטה היא "תסתכל על זה", לא שאילתת נתונים - מדלגים על כל
    // צינור ה-SQL/ACTIONS ופונים ישירות ל-Gemini עם הפרומפט + המדיה.
    if (image || recordingUrl) {
      try {
        const media = [];
        if (image?.mimeType && image?.data) {
          media.push({ mimeType: image.mimeType, data: image.data });
        }
        if (recordingUrl) {
          const recordingSetting = await getCachedSetting('ai_screen_recording_enabled');
          if (!recordingSetting || recordingSetting.value !== 'true') {
            return NextResponse.json({ response: 'ניתוח הקלטות מסך אינו מופעל במערכת כרגע.', data: null, sqlQuery: null });
          }
          const videoRes = await fetch(recordingUrl);
          if (!videoRes.ok) throw new Error(`Failed to fetch recording (${videoRes.status})`);
          const contentType = videoRes.headers.get('content-type') || 'video/webm';
          const buffer = Buffer.from(await videoRes.arrayBuffer());
          const fileUri = await uploadAndWaitForFile(buffer, contentType);
          media.push({ mimeType: contentType, fileUri });
        }

        const mediaPrompt = `אתה עוזר וירטואלי למערכת ניהול גמ"ח שמלות. המשתמש/ת צירף/ה ${recordingUrl ? 'הקלטת מסך' : 'צילום מסך'} מהמערכת ושאל/ה: "${prompt}".\n${context ? `הקשר נוסף: ${context}\n` : ''}ענה/י בעברית בצורה קצרה וברורה, בהתבסס על מה שרואים בפועל במדיה המצורפת. אל תשתמש בסימוני markdown כמו כוכביות.`;
        const mediaResponse = await generateContent(mediaPrompt, null, media);
        return NextResponse.json({ response: finalizeAiText(mediaResponse), data: null, sqlQuery: null });
      } catch (mediaErr) {
        console.error('AI media analysis error:', mediaErr);
        return NextResponse.json({ response: 'מצטער, נתקלתי בשגיאה בעת ניתוח הצילום/ההקלטה. אנא נסה שוב.', data: null, sqlQuery: null });
      }
    }

    // Employee Classification Protections
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    let employeeContext = '';
    let isManager = false;
    if (token && token.value) {
      const employee = await prisma.employee.findUnique({ where: { id: token.value } });
      if (employee) {
        if (employee.roleId !== 1 && employee.roleId !== 2) {
          employeeContext = `\nCRITICAL SECURITY RULE: The current user is a standard employee (Role: ${employee.roleId}). Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.`;
        } else {
          isManager = true;
          employeeContext = `\nUser Role: Manager/Admin. Full access to all data is permitted.`;
        }
      }
    }

    // ACTION: SETTINGS_GUIDE() - see the branch below that handles it - lets the AI
    // point a manager to a specific SystemSetting's location, explain what it does,
    // and (via the [OPEN_SETTING:key] tag) let the frontend open a quick-edit panel.
    // Only offered to managers/programmers (isManager) - a regular employee's prompt
    // never even mentions this action exists, matching the same access tier already
    // used above ("Full access to all data is permitted") and by /api/settings/guide.
    const settingsGuideInstructions = isManager ? `
20. CRITICAL RULE FOR SYSTEM SETTINGS: The system has a "SystemSetting" configuration table, managed by the admin at "הגדרות מערכת" (Settings). If the user's question is about a system setting - where to find it, what it does, its current value, or how to open/turn on/off/change it (e.g. "איפה מכבים את X", "איך משנים את Y", "מה עושה ההגדרה Z", "תפתח לי הגדרה של...", "איפה ההגדרה ש...") - you MUST NOT guess the answer, and you MUST NOT generate SQL for this (SystemSetting values are not meant to be queried via SQL here). Instead, output EXACTLY this on its own line and nothing else:
ACTION: SETTINGS_GUIDE()
The system will then give you the full, up-to-date catalog of every configurable system setting (exact key, Hebrew name, category/location in the admin menu, description, field type, and current value), and you must answer based on that catalog alone.` : '';

    // ACTION: HOWTO_GUIDE() - operational "how do I do X" questions (e.g. "איך
    // מוסיפים תיקון להזמנה", "איך מדפיסים תווית משלוח"), as opposed to
    // SETTINGS_GUIDE above which is about where a SystemSetting lives. Available to
    // EVERY employee (not gated by isManager) since these are day-to-day operation
    // questions, not admin/financial ones.
    const howToGuideInstructions = `
21. CRITICAL RULE FOR "HOW DO I..." QUESTIONS: If the user asks how to perform some operational action in the system (e.g. "איך מוסיפים...", "איך מבטלים...", "איך מדפיסים...", "איפה עושים...", "מאיפה אפשר ל...") and it is NOT a question about a SystemSetting (see rule above) and NOT a request for data from the database - you MUST NOT guess the answer, and you MUST NOT generate SQL. Instead, output EXACTLY this on its own line and nothing else:
ACTION: HOWTO_GUIDE()
The system will then give you a catalog of common operational actions (title, short instructions, and the page route to open), and you must answer based on that catalog alone. If nothing in the catalog genuinely matches, say honestly that you don't have instructions for that yet instead of guessing.`;

    const schemaText = getSchemaContext();
    // עוגן "עכשיו" בזמן ישראל (תאריך+שעה+יום בשבוע, עברי ולועזי) - מחושב בשרת ולא ע"י המודל
    const israelNow = getIsraelNow();
    const dateContext = buildDateContext();
    const sharedRules = buildSharedSqlRules({ draftStatus: DRAFT_ORDER_STATUS, reservedStatus: RESERVED_ORDER_STATUS });
    const userDateHints = buildUserDateHints([...history.filter(m => m.role === 'user').slice(-3).map(m => m.content), prompt].join('\n'));

    const warehouseSetting = await getCachedSetting('inventory_include_warehouse');
    const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
    const warehouseContext = includeWarehouse ? '' : `\nCRITICAL INVENTORY RULE: The system settings define that dresses in the warehouse MUST NOT be shown to customers! Whenever you query the "DressItem" table in SQL, you MUST add: AND "location" NOT ILIKE '%מחסן%' AND "location" NOT ILIKE '%warehouse%' AND "location" NOT ILIKE '%רזרבה%' AND "location" NOT ILIKE '%reserve%'.`;
    
    const initialPrompt = `${SYSTEM_PROMPT_BASE}\n${sharedRules}\n\n${schemaText}\n${employeeContext}${settingsGuideInstructions}${howToGuideInstructions}${dateContext}${userDateHints}${warehouseContext}\n\nSystem Context/Instructions:\n${context}\n\nChat History Context:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    
    let aiResponse = await generateContent(initialPrompt);
    
    try {
       fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '==== NEW REQUEST ====\nPROMPT:\n' + prompt + '\nAI RESPONSE:\n' + aiResponse + '\n\n');
    } catch(e) {}
    
    let tableData = null;
    let sqlQueryToReturn = null;

    // Check for the settings-guide action (see settingsGuideInstructions above) -
    // only ever requested when isManager is true, but re-checked here defensively
    // so a non-manager's prompt can never trigger it even if the literal text
    // somehow ended up in their message history.
    const settingsGuideMatch = isManager ? /ACTION:\s*SETTINGS_GUIDE\(\)/i.exec(aiResponse) : null;

    // Check for the how-to-guide action (see howToGuideInstructions above) -
    // available to every employee, unlike the settings guide.
    const howToGuideMatch = /ACTION:\s*HOWTO_GUIDE\(\)/i.exec(aiResponse);

    // Check for Custom Action with JSON payload
    const actionRegex = /ACTION:\s*CHECK_AVAILABILITY\(([\s\S]+?)\)/i;
    const actionMatch = actionRegex.exec(aiResponse);

    if (settingsGuideMatch) {
      try {
        const settingRows = await getAllCachedSettings();
        const catalog = buildSettingsGuide(settingRows);

        const followupPrompt = `The user asked: "${prompt}".
You determined this question is about a system setting and requested the full settings catalog.
Here is the complete, up-to-date catalog of every configurable system setting in the admin panel ("הגדרות מערכת") - key, Hebrew name, category/tab, location, description, field type, and current value:
${JSON.stringify(catalog)}

Answer the user in Hebrew:
1. Say clearly where the relevant setting is found, copying the EXACT "location" field of that setting from the catalog (e.g. "הגדרות מערכת ← יומן") - never guess or paraphrase the tab name.
2. Briefly explain in plain Hebrew what the setting does and its current value.
3. Do NOT invent a setting key that does not appear in the catalog above. If nothing in the catalog genuinely answers the question, say so honestly instead of guessing.
4. Keep the answer short and conversational. DO NOT use markdown formatting like asterisks (**) for bolding or bullet points.
CRITICAL: If you identified one or more specific setting keys that answer the question (at most 3), end your response with each one on its own new line in this EXACT format: [OPEN_SETTING:the_exact_key]. Use the exact "key" field from the catalog above, never the Hebrew name, and never a key that is not in the catalog. Omit this tag entirely if no specific setting genuinely matches the question.`;

        try {
          fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== SETTINGS GUIDE FOLLOWUP PROMPT ====\n' + followupPrompt + '\n');
        } catch (e) {}

        const finalResponse = await generateContent(followupPrompt);

        try {
          fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== SETTINGS GUIDE FINAL RESPONSE ====\n' + finalResponse + '\n\n');
        } catch (e) {}

        // אימות בקוד מול הקטלוג: תגית עם מפתח שלא קיים מוסרת, ומיקום ("הגדרות מערכת ← X") מתוקן לקטגוריה האמיתית
        return NextResponse.json({ response: finalizeAiText(validateSettingTags(finalResponse, catalog), new Date()), data: null, sqlQuery: null });
      } catch (err) {
        console.error('Settings guide action error:', err);
        aiResponse = 'מצטער, נתקלתי בשגיאה בעת שליפת קטלוג ההגדרות. אנא נסה לנסח את השאלה מחדש.';
      }
    } else if (howToGuideMatch) {
      try {
        const catalog = buildHowToGuide();

        const followupPrompt = `The user asked: "${prompt}".
You determined this is an operational "how do I..." question and requested the how-to catalog.
Here is the complete catalog of common operational actions in the system - key, title, short instructions, and the page route to open:
${JSON.stringify(catalog)}

Answer the user in Hebrew:
1. Explain briefly and clearly, in plain conversational Hebrew, the steps to perform the action, based on the "steps" field.
2. Do NOT invent an action/route that does not appear in the catalog above. If nothing in the catalog genuinely answers the question, say so honestly instead of guessing.
3. Keep the answer short. DO NOT use markdown formatting like asterisks (**) for bolding or bullet points.
CRITICAL: If you identified one or more specific catalog entries that answer the question (at most 2), end your response with each one on its own new line in this EXACT format: [OPEN_LINK:the_exact_route|the_exact_title]. Use the exact "route" and "title" fields from the catalog above, never invented ones. Omit this tag entirely if nothing in the catalog genuinely matches.`;

        try {
          fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== HOWTO GUIDE FOLLOWUP PROMPT ====\n' + followupPrompt + '\n');
        } catch (e) {}

        const finalResponse = await generateContent(followupPrompt);

        try {
          fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== HOWTO GUIDE FINAL RESPONSE ====\n' + finalResponse + '\n\n');
        } catch (e) {}

        return NextResponse.json({ response: finalizeAiText(validateLinkTags(finalResponse, catalog)), data: null, sqlQuery: null });
      } catch (err) {
        console.error('Howto guide action error:', err);
        aiResponse = 'מצטער, נתקלתי בשגיאה בעת שליפת ההדרכה. אנא נסה לנסח את השאלה מחדש.';
      }
    } else if (actionMatch) {
      try {
        let jsonStr = actionMatch[1].trim();
        // Remove markdown backticks if AI added them
        if (jsonStr.startsWith('\`\`\`json')) jsonStr = jsonStr.replace(/^\`\`\`json/, '');
        if (jsonStr.startsWith('\`\`\`')) jsonStr = jsonStr.replace(/^\`\`\`/, '');
        if (jsonStr.endsWith('\`\`\`')) jsonStr = jsonStr.replace(/\`\`\`$/, '');
        jsonStr = jsonStr.trim();
        
        const requestData = JSON.parse(jsonStr);
        let { dates = [], models: requestedModels = [], sizes: requestedSizes = [] } = requestData;
        
        // Ensure they are arrays, in case AI returned a single item instead of an array
        if (!Array.isArray(dates)) dates = [dates];
        if (!Array.isArray(requestedModels)) requestedModels = [requestedModels];
        if (!Array.isArray(requestedSizes)) requestedSizes = [requestedSizes];
        
        if (!dates || dates.length === 0) {
           throw new Error("No dates provided for CHECK_AVAILABILITY");
        }

        console.log('AI requested CHECK_AVAILABILITY for:', requestData);
        
        const allModels = await prisma.dressModel.findMany();
        const modelMap = {};
        allModels.forEach(m => modelMap[m.id] = m.name);

        // זיהוי דגמים בקוד: לפי מזהה פנימי, לפי מספר דגם (barcodePrefix) או לפי שם. בבדיקת האמינות
        // ה-AI העביר את הדגם כמספר (551) ואף דגם לא התאים (מפתחות הזמינות הם UUID), הטבלה חזרה ריקה
        // והתשובה הייתה "אינו פנוי" כשבפועל היו 9 שמלות פנויות.
        const resolvedModelIds = new Set();
        const unresolvedModels = [];
        for (const reqM of requestedModels) {
          const key = String(reqM).trim();
          const hits = allModels.filter(m =>
            m.id === key ||
            (m.barcodePrefix != null && String(m.barcodePrefix) === key) ||
            (m.name && m.name.toLowerCase().includes(key.toLowerCase()))
          );
          // אם יש התאמה מדויקת (מזהה/מספר/שם זהה) עדיפה על התאמת תת-מחרוזת
          const exact = hits.filter(m => m.id === key || String(m.barcodePrefix) === key || (m.name || '').toLowerCase() === key.toLowerCase());
          const chosen = exact.length > 0 ? exact : hits;
          if (chosen.length === 0) unresolvedModels.push(key);
          chosen.forEach(m => resolvedModelIds.add(m.id));
        }
        // מידות חד-ספרתיות נשמרות עם 0 מוביל ('08'); התאמה מדויקת ולא תת-מחרוזת (8 לא צריך להתאים ל-18/28)
        const normalizeSize = (s) => { const t = String(s).trim(); return /^\d$/.test(t) ? `0${t}` : t; };
        const wantedSizes = requestedSizes.map(normalizeSize);

        const formattedResults = [];
        const currentHebrewYear = israelNow.hdate.getFullYear();
        let sampleAvailability = null;
        
        let expandedDates = [];
        for (const dateItem of dates) {
           if (typeof dateItem === 'object' && dateItem.month) {
              try {
                const y = dateItem.year || currentHebrewYear;
                if (dateItem.day) {
                  const hd = new HDate(dateItem.day, dateItem.month, y);
                  const d = hd.greg();
                  d.setHours(12, 0, 0, 0); // avoid timezone issues
                  expandedDates.push(d.toISOString().split('T')[0]);
                } else {
                  // User requested a whole month
                  const startOfMonth = new HDate(1, dateItem.month, y);
                  const daysInMonth = startOfMonth.daysInMonth();
                  for (let day = 1; day <= daysInMonth; day++) {
                    const hd = new HDate(day, dateItem.month, y);
                    const d = hd.greg();
                    d.setHours(12, 0, 0, 0);
                    expandedDates.push(d.toISOString().split('T')[0]);
                  }
                }
              } catch (e) {
                console.error("Hebrew date parse error:", e);
                continue;
              }
           } else if (typeof dateItem === 'string') {
              expandedDates.push(dateItem);
           }
        }
        
        for (const dateStr of expandedDates) {
            const targetDate = new Date(dateStr);
            if (isNaN(targetDate)) continue;
           
           const availabilityData = await getBulkAvailableInventory(targetDate);
           
           if (!sampleAvailability) sampleAvailability = availabilityData;

           for (const modelId in availabilityData) {
              if (requestedModels.length > 0 && !resolvedModelIds.has(modelId)) continue;

              for (const size in availabilityData[modelId]) {
                 if (wantedSizes.length > 0 && !wantedSizes.includes(size)) continue;

                 const invData = availabilityData[modelId][size];
                 formattedResults.push({
                    "תאריך": dateStr,
                    "תאריך עברי": getHebrewDateString(targetDate),
                    "דגם": modelMap[modelId] || modelId,
                    "מידה": size,
                    "זמינות_פנויה": typeof invData === 'object' ? invData.available : invData,
                    "מלאי_כולל": typeof invData === 'object' ? invData.total : invData,
                    "כמות_מוזמנת": typeof invData === 'object' ? invData.booked : 0
                 });
              }
           }
        }
        
        tableData = formattedResults;
        sqlQueryToReturn = `ACTION: CHECK_AVAILABILITY(${JSON.stringify(requestData)})`;

        // עובדות שחושבו בקוד (לא ע"י המודל): התאריכים המפוענחים בשני הלוחות, ומה לא נמצא.
        // כשהטבלה ריקה המודל נהג להמציא תאריך לועזי ולהכריז "אינו פנוי".
        const resolvedDates = expandedDates.slice(0, 40).map(iso => {
          const [yy, mm, dd] = iso.split('-');
          return { gregorian: `${dd}/${mm}/${yy}`, hebrew: getHebrewDateString(new Date(iso)) };
        });
        const resolutionNotes = [];
        unresolvedModels.forEach(m => resolutionNotes.push(`There is NO dress model matching "${m}" in the system.`));
        if (sampleAvailability && wantedSizes.length > 0) {
          resolvedModelIds.forEach(id => {
            const existing = Object.keys(sampleAvailability[id] || {});
            const missing = wantedSizes.filter(sz => !existing.includes(sz));
            if (missing.length > 0) {
              resolutionNotes.push(`Model "${modelMap[id]}" has NO size ${missing.join(', ')}. Sizes that exist for this model: ${existing.join(', ') || 'none'}.`);
            }
          });
        }
        if (formattedResults.length === 0 && resolutionNotes.length === 0) {
          resolutionNotes.push('No availability data was found for the requested dates/models/sizes.');
        }

        const followupPrompt = `The user asked: "${prompt}".
You requested to check availability. The server resolved the requested dates to (use ONLY these Hebrew/Gregorian pairs when mentioning dates): ${JSON.stringify(resolvedDates)}.
The sophisticated inventory system returned these availability results (already accounting for all buffer rules and overlap logic):
${JSON.stringify(formattedResults)}
${resolutionNotes.length > 0 ? `\nFACTS FROM THE SERVER ABOUT WHAT WAS NOT FOUND (explain these to the user plainly; if the results list is empty NEVER say the dress is "not available" - say what does not exist or that no data was found, and offer the sizes that do exist): ${JSON.stringify(resolutionNotes)}\n` : ''}
Please provide a short, clear, and friendly natural language answer to the user in Hebrew based on these results.
CRITICAL RULES FOR YOUR RESPONSE:
1. DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
2. Whenever you mention a date, you MUST mention BOTH the Hebrew date and the Gregorian date together, with the Gregorian date in parentheses (e.g., "י' בסיוון תשפ\"ו (26/05/2026)"). You MUST extract these dates EXACTLY from the "תאריך עברי" and "תאריך" fields in the availability results JSON provided to you. Do NOT calculate or guess any dates yourself.
3. DO NOT output a long list of consecutive dates! If the results contain many consecutive days, group them into a simple range (e.g., "מ-א' בסיוון (17/05/2026) ועד כ' בסיוון (05/06/2026)"). Keep the response concise and natural.
4. STRICT PRIVACY RULE: You must NEVER expose, mention, or list ANY customer names, phone numbers, or personal details in your text response. Your response is intended to be shown or forwarded to clients, so you must keep all other clients' information completely confidential. Only summarize inventory and availability.
5. SMART FILTERING: If the user is asking about specific models, colors, or sizes, you MUST append a filter tag at the very end of your response: [FILTER:term] where term is the search term (e.g. [FILTER:זהב] or [FILTER:42]). The frontend will render this as a beautiful modern button to filter the display. Only provide ONE filter tag.
Summarize the information nicely.${context ? `\n\nSystem Instructions:\n${context}` : ''}`;

        try {
           fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== FOLLOWUP PROMPT ====\n' + followupPrompt + '\n');
        } catch(e) {}

        const finalResponse = await generateContent(followupPrompt);
        
        try {
           fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== FINAL AI RESPONSE ====\n' + finalResponse + '\n\n');
        } catch(e) {}

        return NextResponse.json({ response: finalizeAiText(finalResponse), data: tableData, sqlQuery: sqlQueryToReturn });
      } catch (err) {
         console.error('Action error:', err);
         aiResponse = "מצטער, נתקלתי בשגיאה בעת פיענוח הבקשה לבדיקת זמינות. אנא נסח את השאלה מחדש.";
      }
    } else {
      // Check if AI returned SQL queries
      const sqlRegex = /SQL:\s*(.+)/gi;
      let match;
      const queries = [];
      while ((match = sqlRegex.exec(aiResponse)) !== null) {
        let q = match[1].trim();
        if (q.startsWith('\`\`\`sql')) q = q.replace(/^\`\`\`sql/, '');
        if (q.startsWith('\`\`\`')) q = q.replace(/^\`\`\`/, '');
        if (q.endsWith('\`\`\`')) q = q.replace(/\`\`\`$/, '');
        queries.push(q.trim());
      }

      if (queries.length > 0) {
        let combinedResults = [];
        let dbErrorStr = null;

        try {
          for (let i = 0; i < queries.length; i++) {
            queries[i] = normalizeAiSql(processHebrewDateMacro(queries[i]));
            console.log(`AI generated SQL query ${i + 1}:`, queries[i]);
            try {
              assertReadOnlySelect(queries[i]);
            } catch (guardErr) {
              console.error('SQL Guard rejected AI-generated query:', guardErr.message, '\nRejected SQL:', queries[i]);
              throw guardErr;
            }
            const res = stripSecretColumns(await prisma.$queryRawUnsafe(queries[i]));
            combinedResults.push(res);
          }
        } catch (dbError) {
          console.error('AI DB Query Error attempt 1:', dbError.message);
          dbErrorStr = dbError.message;
          
          // SELF HEALING RETRY
          const retryPrompt = `${SYSTEM_PROMPT_BASE}\n${sharedRules}\n\n${schemaText}\n${dateContext}\n\nUser Question: ${prompt}\n\nYou generated these SQL queries:\n${queries.join('\n')}\nBut it failed with this PostgreSQL error: ${dbErrorStr}\n\nPlease output ONLY corrected PostgreSQL SQL queries starting with "SQL: " to fix this issue.`;
          let retryResponse = await generateContent(retryPrompt);
          
          const retryQueries = [];
          let rMatch;
          while ((rMatch = sqlRegex.exec(retryResponse)) !== null) {
            let rq = rMatch[1].trim();
            if (rq.startsWith('\`\`\`sql')) rq = rq.replace(/^\`\`\`sql/, '');
            if (rq.startsWith('\`\`\`')) rq = rq.replace(/^\`\`\`/, '');
            if (rq.endsWith('\`\`\`')) rq = rq.replace(/\`\`\`$/, '');
            retryQueries.push(rq.trim());
          }

          if (retryQueries.length > 0) {
            try {
              combinedResults = [];
              for (let i = 0; i < retryQueries.length; i++) {
                retryQueries[i] = normalizeAiSql(processHebrewDateMacro(retryQueries[i]));
                console.log(`AI generated Retry SQL query ${i + 1}:`, retryQueries[i]);
                try {
                  assertReadOnlySelect(retryQueries[i]);
                } catch (guardErr) {
                  console.error('SQL Guard rejected AI-generated retry query:', guardErr.message, '\nRejected SQL:', retryQueries[i]);
                  throw guardErr;
                }
                const res = stripSecretColumns(await prisma.$queryRawUnsafe(retryQueries[i]));
                combinedResults.push(res);
              }
              queries.splice(0, queries.length, ...retryQueries);
              dbErrorStr = null;
            } catch (retryErr) {
              console.error('AI DB Query Error attempt 2:', retryErr.message);
              dbErrorStr = retryErr.message;
            }
          }
        }

        if (dbErrorStr) {
           aiResponse = "מצטער, נתקלתי בשגיאה בעת שליפת הנתונים מהמסד (שגיאת תחביר שאילתה). אנא נסה לנסח את השאלה אחרת.";
        } else {
          // In the UI, we show the LAST successful query's results as the tableData
          tableData = combinedResults[combinedResults.length - 1];
          sqlQueryToReturn = queries.join('\\n');

          const followupPrompt = `The user asked: "${prompt}".
You executed the following SQL queries:
${queries.join('\n')}

The database returned these JSON results (in order):
${JSON.stringify(humanizeResultDates(JSON.parse(JSON.stringify(combinedResults, (key, value) => typeof value === 'bigint' ? value.toString() : value))))}

Please provide a short, clear, and friendly natural language answer to the user in Hebrew based on these database results. 
CRITICAL RULES FOR YOUR RESPONSE:
1. DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
2. Dates inside the results are already formatted by the server as "Hebrew date (dd/mm/yyyy)" - copy them exactly as they appear. Whenever you mention any other date, mention BOTH the Hebrew date and the Gregorian date together, with the Gregorian date in parentheses (e.g., "י' בסיוון תשפ\"ו (26/05/2026)"). Do NOT calculate or guess any dates yourself, ensure accuracy, and never state the start/end dates of a period (a month, a range) unless those exact dates appear in the results or in the resolved-dates block - otherwise just name the period.
3. DO NOT output a long list of consecutive dates! If the results contain many consecutive days, group them into a simple range (e.g., "מ-א' בסיוון (17/05/2026) ועד כ' בסיוון (05/06/2026)"). Keep the response concise and natural.
4. DO NOT tell the user you are showing a table, and DO NOT output raw JSON or Markdown tables.
5. STRICT PRIVACY RULE: You must NEVER expose, mention, or list ANY customer names, phone numbers, or personal details in your text response, even if you see them in the database results. Your response is intended to be shown or forwarded to clients, so you must keep all other clients' information completely confidential. Only summarize inventory and availability.
6. SMART FILTERING: If the user is asking about specific models, colors, or sizes, you MUST append a filter tag at the very end of your response: [FILTER:term] where term is the search term (e.g. [FILTER:זהב] or [FILTER:42]). The frontend will render this as a beautiful modern button to filter the display. Only provide ONE filter tag.
7. If the database returned NO rows, say plainly that no matching records were found and state exactly what was searched (names, dates, model). Do NOT invent reasons and do NOT guess; never claim something was "already settled/handled" just because nothing was found.
8. Today's date/time and the calendar are given below - use them if you need to mention today. Never invent a date pair.
9. ROW COUNTS (facts computed by the server): ${rowCountFacts(combinedResults)}. The SQL already applied the user's filters, so every returned row matches the request - if rows came back never say nothing was found.
Summarize the information nicely as a helpful customer service representative. For example, instead of listing all items, say "יש לנו 5 שמלות מדגם זה במידות 38-42".
${dateContext}${userDateHints}`;
          
          aiResponse = await generateContent(followupPrompt);
          // תשובה שסותרת את הנתונים ("לא נמצאו" כשחזרו שורות): ניסיון חוזר אחד עם אזהרה, ואז תשובה מהנתונים עצמם
          if (resultsHaveData(combinedResults) && answerSaysNone(aiResponse)) {
            aiResponse = await generateContent(`${followupPrompt}

WARNING: your previous answer claimed nothing was found, but the database DID return data (${rowCountFacts(combinedResults)}). Answer again strictly from the results above.`);
            if (answerSaysNone(aiResponse)) {
              const last = combinedResults[combinedResults.length - 1];
              aiResponse = Array.isArray(last) && last.length > 1 ? `נמצאו ${last.length} רשומות התואמות לחיפוש. הרשימה המלאה מוצגת בטבלה.` : 'נמצאו נתונים התואמים לחיפוש. הם מוצגים בטבלה.';
            }
          }
        }
      }
    }

    const safeData = tableData ? JSON.parse(JSON.stringify(tableData, (key, value) => typeof value === 'bigint' ? value.toString() : value)) : null;

    const finalText = await finalizeTagsAndText(aiResponse, {
      isManager,
      loadSettingsCatalog: async () => buildSettingsGuide(await getAllCachedSettings()),
      loadHowToCatalog: async () => buildHowToGuide(),
    });
    return NextResponse.json({ response: finalText, data: safeData, sqlQuery: sqlQueryToReturn });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}