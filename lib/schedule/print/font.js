// The Hebrew web font of the schedule print pages - plain data, no imports (client-safe).
// Loaded by a <style>@import</style> element of its own in app/schedule/print/[page]/page.js (same pattern as
// app/print/order/page.js), NOT by an @import inside print.css: in the production build Next merges print.css
// into one chunk after the pages/pp*.css rules, an @import that is not at the top of a stylesheet is ignored
// by browsers, and Vercel's Chromium (PDF) has no "Segoe UI" - the PDF silently fell back to Arial/sans.
// scripts/schedule-print-tests/print-font.test.mjs keeps print.css free of @import; render.mjs links this URL too.
export const PRINT_FONT_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700&display=swap';
export const PRINT_FONT_CSS = `@import url('${PRINT_FONT_URL}');`;
