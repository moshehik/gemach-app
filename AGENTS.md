<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

### ID Display Rules
When generating links, references, or speaking to the user about entities (Orders, Customers, Dress Models, etc.), ALWAYS use the short human-readable ID (e.g., orderId, legacyId, barcodePrefix). NEVER expose or use the id (UUID) field for display purposes. For URLs, orderId works for /orders/, but /customers/ requires the UUID id.

### Read first
Read [CLAUDE.md](CLAUDE.md) (architecture, systems, standing rules), then [docs/README.md](docs/README.md) (index of every doc). Dated history is in [docs/journal-2026.md](docs/journal-2026.md).

### Top 5 standing rules for agents (details in CLAUDE.md)
1. **Two orgs, one codebase.** Code fixes ship to both gemachs; settings are per org. A new `SystemSetting` is created in BOTH databases, with the requested value only for the org that asked; any script that writes to one org's DB checks the target host first. Automated agents never change the inventory-calculation settings listed in CLAUDE.md.
2. **Database writes.** No hand-written `AuditLog` rows next to normal Prisma writes (the extension already logs them — use `auditAs()`); no heavy reads inside `prisma.$transaction`; schema changes need their DDL applied by hand to both PROD databases before the code deploys.
3. **Data traps.** Servers run in UTC — use the Israel-timezone helpers in `lib/hebrewDate.js` (`getIsraelDayRange`, `getIsraelTodayDate`, `toIsraelCalendarDate`). `Order.status` is NULL for almost every order — never filter it with a bare `NOT IN`/`<>`; AI-generated SQL goes through `normalizeAiSql`.
4. **Git and live sites.** Work in your own worktree from `origin/main`, on a branch, and never push to `main`; mind Vercel's 100-deploys-per-day account limit (`[force-deploy]` only when a build is really needed). Never type a password into a live site — use `/api/dev/agent-login`.
5. **Design.** The numbered component palette is the only design system (`design-system/`, after merge of `chore/v3-cleanup-2026-09-29`): reuse its components by serial number, don't invent new ones. The v3 redesign was cancelled on 2026-09-29 — never resurrect it.
