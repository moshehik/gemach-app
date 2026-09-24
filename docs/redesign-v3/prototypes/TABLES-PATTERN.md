# TABLES-PATTERN — one pattern for every table screen (v3)

> **Status:** proposed 2026-09-24 for the owner's decision, before any list page is built. Two prototypes implement it byte-for-byte: `archetype-list.html` (orders) and `archetype-customers-list.html` (customers). Open points with the defaults already applied: `TABLES-QUESTIONS.md`. Verification: `TABLES-REPORT.md`.
> **Applies to:** orders and customers now; dress models, rentals, refunds, alterations, employees and the pricelist later (CONSTITUTION §ו A1).
> **Rules it implements:** C-1.4/C-1.5 (tables), C-1.10 (RTL, `<bdi>`), C-1.11 (arrows), C-1.12 (focus, AA), **C-1.14** (chip restraint), **C-1.15** (shared components come from the sketch, see `SHELL-BLOCK.md`), **C-1.16** (one field per line), ב.6 (breakpoints 480/640/768/1024/1440/1920 only), ג.2 (who scrolls), D-2 (data-entry windows are always light), D-14 (width).
> **Behaviour source:** the real pages on `main`: `archetype-list.contract.md` (LI-n, re-verified in §יא there) and `archetype-customers-list.contract.md` (CL-n). This pattern needs no new API field except where a line says "needs data".

## 0. How it is shared
- **Shell components are never redrawn.** From the verbatim sketch block (`SHELL-BLOCK.md`): top bar, page background, `.app`, `.topbar/.ttl/.tools`, `.btn/.ibtn`, `.card`, `.inp/.field/label.lbl/.fcol`, `.seg`, the history filter bar (`.hf-bar/.hf-s/.hf-cl/.hf-t/.hf-bdg/.hf-pills/.hf-pill`), `.tag`, `.stx`, `.menu`, tooltips, `#toast`, notice bar, dialogs `#dlg/#dlg2` (`.mailwin`, `.apprwin`), the expandable row `.itm.hfe` inside `.hfeed`, and the table `.tbl/.tbl-wrap` (amendment A4). Icon animation comes with them.
- **One table layer on top, identical in every list screen.** Sources: `tables/tables.css` + `tables/tables.js`. `tools/build-tables.cjs` injects them between `V3-TABLES:CSS` / `V3-TABLES:JS` markers in every list prototype. It also copies the shell block into list files that `build-shell.cjs` does not know. `--check` fails on any drift. The layer only adds `tp-*` classes and never restyles a shell selector.
- **A page supplies only data and a spec.** `TP.frame(label)` gives the one table card. `TP.mount(spec)` binds it once. `TP.render(state)` draws rows and states. `TP.bar()`, `TP.views()` and `TP.pills()` draw the controls.
  - Spec fields: `cols` (`key, label, sort, prio, num, cell`), `expand`, `xacts`, `menu`, `edge`, `card`, `sortOptions`.
  - Callbacks: `onSearch`, `onType`, `onBar`, `onView`, `onFilterRemove`, `onSort`, `onPage`, `onOpen`, `onAct`.
- **Motion is the sketch's.**
  - Row entrance is `rowin .32s var(--ease)`.
  - Expanding is `grid-template-rows 0fr→1fr .3s var(--ease)`, with the chevron turning in .25s (sketch L947-956). The phone card uses the sketch's own `.det-wrap`.
  - Row hover is the A4 150ms background. The filter pill enters with `popin`. The clear button springs in.
  - Under `prefers-reduced-motion` everything shows its static end state. No new keyframes apart from the skeleton shimmer and the loading line.

## 1. Page anatomy (top to bottom)
1. **Site top bar** (shell), with the current nav item marked (`SK_NAV_CUR`).
2. **Page header** = the sketch's `.topbar`.
   - There is no back button, because list pages are top level.
   - The `h1` is the screen name plus the count as plain text: `לקוחות (1,240)`. The count is the server's `total`, never the page length.
   - `.tools`, on the end side, holds icon buttons (`.ibtn` with a tooltip) for secondary tools in a fixed order: **capacity · print · export**, each only if the screen has it. Then comes **one** primary `.btn.primary` ("הזמנה חדשה", "לקוח חדש").
   - Below 768 the icon tools collapse into one "עוד" `.ibtn` that opens the sketch `.menu`. The primary button stays.
3. **One table card** (a shell `.card`, same composition as the sketch's history card: filter bar, then the list):
   1. **Search row** = the sketch's `.hf-bar`:
      - The `.hf-s` search field says exactly what it searches. It submits on Enter or the "חיפוש" button, never per keystroke, as in the real pages (LI-23, CL-22). The `.hf-cl` clear button springs in when there is text.
      - The **"סינון"** trigger is the sketch's `.hf-t`. Its `.hf-bdg` count is set only when advanced filters are active.
      - Smart search (star) and statistics are `.ibtn`s, shown only when AI is available (`hide_ai_features` off and `feature:ai`). This fixes CL-5; see T-Q11.
   2. **Views** (optional) = the sketch's `.seg`, one button per real server view, scrolling sideways on phones. The active view's count is shown as text `(n)` (`.tcount`). A screen with no server views (customers) has no views row.
   3. **Active filters** = the sketch's `.hf-pills`: one removable `.hf-pill` per advanced filter, plus "ניקוי הכול" when there are two or more. A default the server applies anyway (orders' 3-month window, LI-7) is shown as **text plus a ghost button** ("כל התאריכים"), not as a pill, so it is not mistaken for a user filter.
   4. **Notice line** (only when needed): error, smart-search results, or a view-specific caveat (orders' "לא שולם", LI-67).
   5. **Table** (≥640) or **cards** (<640), then the **footer**: range text, sort select (phones) and pager.

## 2. Filters
- **Always visible:** search, the "סינון" trigger, and the views if the screen has any.
- **Advanced filters** open one light data-entry dialog (`#dlg.mailwin`; D-2 says it is always light). Fields sit one per line in `.fcol` (C-1.16), grouped under small headings instead of inner tabs. Orders: event dates, item state, order and item, customer. Customers: name, contact details. The footer has "הצגת התוצאות" (primary) and "ניקוי השדות" (ghost); ✕ or Esc closes without changes.
- **Apply on "הצגת התוצאות" only, then go back to page 1.** *Behaviour change: today both pages apply on every keystroke and keep the page number (LI-53/55, CL-30/31). See T-Q3.*
- **Smart search on the filled fields** is a checkbox in the dialog, shown only when AI is available, as today.

## 3. Sorting
- A sortable header holds a `<button class="tp-sort">` that fills the A4 header cell exactly. The cell keeps its 12/16 padding and the button cancels it, so every screen has the same header geometry and a 48px target.
- The `<th>` carries `aria-sort`. The active column shows a navy label and a chevron (turned for ascending). Inactive columns show the chevron only on hover or focus.
- Clicking the active column flips the direction; clicking another column sorts ascending. Both real pages behave this way.
- **Defaults:** orders by event date ascending (LI-6); customers by customer code descending (CL-8).
- **Phones:** sorting moves to a `מיון` select in the footer. It also offers sort keys that have no column of their own (customers: last name, first name, e-mail).
- **A sort that does not work is not offered:**
  - Orders' "שולם" returns a 500 from the server (LI-46).
  - Orders' "לא שולם" view has a fixed sort (LI-48).
  - Smart-search results have no ORDER BY (CL-44, LI-68).
  - In these cases the headers are disabled and a tooltip explains why.

## 4. Columns
- **At most 5 data columns plus 1 actions column** (C-1.5). Each column has a priority: P1 is always shown, P2 is hidden below 1024, P3 is hidden below 1440. A hidden column's value appears in the expanded row, so nothing disappears.
- **Order, start → end (right → left in RTL):** identifier, name, the one date or place that decides the work, amount, status, actions.
  - Orders: `מספר · לקוח · אירוע · לחיוב (+ מצב התשלום כטקסט) · מצב`.
  - Customers: `קוד · שם · טלפון · עיר (P2) · מצב`.
- **Alignment:**
  - Text, dates and identifiers are start-aligned.
  - Money is end-aligned with tabular digits (`td.num`) and never wraps.
  - Every number, phone, amount, date and code is in `<bdi>`; phones, codes and amounts also get `dir="ltr"`.
- **Dates:** the Hebrew date on the first line and the Gregorian `dd.mm.yy` on a quieter second line. The Gregorian line obeys `hide_gregorian_calendar`.
- **Missing value:** a quiet `—` (or "בלי תאריך" for an order with no date).
- **Long text:** one line with an ellipsis and a tooltip (24ch; 10ch below 1024). The full value is in the expanded row.
- **Header labels** come from the organisation's labels (`getLabel(key, default)`). Headers wrap at 18ch, so long labels never push the page sideways.

## 5. Row status — at most ONE chip per row (C-1.14)
- There is one status column, and it holds at most one `.tag`. The tag appears only for a status the real code produces from one source:
  - Orders: `calculateOrderStatus`, 8 values.
  - Customers: `isBlocked` → "חסום".
- **A normal state gets no tag.** A customer who is not blocked shows nothing. Each of the 8 order states is a real state, so every order row has exactly one tag.
- **Everything else is text** (`.stx`, icon plus AA text), never a second tag:
  - Payment status sits under the amount (`שולם`, `שולם חלקי`, `לא שולם`, `ממתין לזיכוי`).
  - Under the status tag: the cart countdown "שמור עוד 10:59" and "השמירה פגה", "לא נשמר" (a local draft) and "ציפוף 2 ימים".
- **One edge marker per row**: a 3px bar on the start side for the most urgent flag, in the real page's priority order (LI-34):
  - gold for a draft, custom spacing or a live cart;
  - rose for debt.
  - The marker always has a text twin in the row.
- **Tag colours:**

  | Tag | Order states |
  |---|---|
  | `.tag.s` | `בקרוב`, `הושכר חלקי`, `הוחזר חלקי` |
  | `.tag.n` | `עבר`, `טיוטה` |
  | `.tag.dn` | `הושכר`, `הוחזר` |
  | `.tag.at` | `מחוק` (and customers' `חסום`) |

## 6. Row interaction and actions
- **Opening:**
  - The whole row opens the entity with a pointer or a touch.
  - For keyboard and screen readers, the identifier cell (a card's title on phones) is a real link to the same place.
  - `/orders/{orderId}` uses the short number. `/customers/{id}` must use the UUID (AGENTS.md).
- **Expanding:**
  - The `.chevb` icon button at the end of the row toggles an expanded row directly under it (`aria-expanded`, `aria-controls`).
  - The expanded row shows every datum not in the columns, one per cell, label over value, in an auto-fill grid.
  - It ends with the actions: "פתיחת …" (primary) plus the row-menu items.
  - Only one row is open at a time. Esc closes it and returns focus to its chevron.
- **Actions column:** the chevron plus the "עוד" `.ibtn`, whose items open in the sketch `.menu`.
  - The menu is rendered at body level so the scroll box never clips it. It supports ↑/↓/Home/End, and Esc returns focus to the button.
  - **Below 1024** the "עוד" button is dropped and its items appear only in the expanded row, as on phone cards. This keeps 5 columns at 768 with no scroll inside the table.
  - Orders menu: "השכרה או החזרה" and "מחיקת ההזמנה" (the latter hidden where LQ-4 applies).
  - Customers: there are no row actions today (CL-41), so the row has only the chevron plus "פתיחת כרטיס הלקוח" in the expanded row.
- **Destructive actions** go through the sketch's confirm dialog, which follows the dark/light theme. Business blocks (for example, an order already rented) show an explanation dialog. Success shows a toast.

## 7. Selection and bulk actions
Neither real page has selection or bulk actions (LI, CL), so they are **out of scope** for these prototypes; inventing them would add behaviour. The pattern reserves the design for when a screen needs it: a first checkbox column (P1), a tri-state header checkbox, and a sticky bar above the table ("נבחרו 3 · פעולה · ביטול"). See T-Q7.

## 8. Paging
- The server pages 50 rows, on both pages today.
- **Footer:** range text on the start side (`מוצגות 1–50 מתוך 1,240`), then the pager: "הקודם" (arrow right) · `עמוד [n] מתוך N` (number field) · "הבא" (arrow left).
  - The pager is hidden when there is one page and disabled while loading.
  - An out-of-range page number snaps back.
- **Phones:** the page field sits on its own row, with two equal buttons under it.
- No virtualization, because 50 rows render fast. No infinite scroll, because it would lose the "page N" that staff use when talking to each other.
- **Smart search:** customers page through the results (CL-26). Orders show "כל התוצאות בעמוד אחד", as today (LI-68).
- **Page resets:**
  - After a search or filter change → page 1.
  - If the current page no longer exists → the last page that does (LQ-3).
  - A stale response is ignored, because the latest request wins (LI-72).

## 9. States
| State | When | What the user sees |
|---|---|---|
| First load | no rows yet | 6 skeleton rows in the real column geometry (3 on phones). `aria-busy` is set on the card. Search and header stay usable. |
| Refresh | rows already shown (cache hit, page change) | Old rows stay. A 2px gold line runs along the top of the card. After 400ms the rows fade to 60%. |
| Empty — no data | no filter, no search, zero rows | icon + one sentence + the primary action ("עדיין אין לקוחות · לקוח חדש") |
| No results — search | search text, zero rows | `לא נמצא "…"` + what is searched + "ניקוי החיפוש" |
| No results — filter or view | filters or a view, zero rows | "אין … בסינון הזה" + "ניקוי הסינון". For orders it also explains the 3-month default and hidden orders without a date, with "כל התאריכים". |
| Error | request failed or 500 | An inline `role=alert` notice in the card ("לא הצלחנו לטעון את הרשימה") + "לנסות שוב" (same request). Rows from before stay visible under it. Never a silent empty table (LI-13, CL-14). |
| Smart search | AI results shown | Notice "תוצאות חיפוש חכם: '…'" + "חזרה לרשימה". Sorting is disabled. The export note says it uses the regular filter (LI-75). |
| AI unavailable | setting off or no permission | The star and statistics buttons are not shown (T-Q11), and there is no `alert('Forbidden')`. |

## 10. Counts
Counts are plain text only: the page title `(1,240)`, the active view's `(63)`, and the footer range. The filter trigger's `.hf-bdg` is the sketch's own filter count and is shown only when filters are active. There are never counts on inactive views, because the server does not return them (LI-27; needs data).

## 11. Export and print
- These are header `.ibtn`s (the "עוד" menu below 768).
- **Export** opens the light window. It offers:
  - a row count, with a note saying which filter it uses;
  - Excel, print/PDF, and a smart report when AI is available.
  - Above the row limit (`feature:export_max_rows`), a password window opens on the second layer (`#dlg2.apprwin`).
  - The result is shown in a toast.
  - Customers' export writes `legacyId` under "קוד לקוח", not the UUID (CL-20 / T-Q12, UI-only).
- **Print** (orders only) opens the report window: report type and date mode, plus "הורדה כ-PDF" for all reports except the prep report (LI-20). The prep report appears only with `enable_batch_print_prep`.

## 12. Keyboard and touch
- **Tab order:** header tools → search → filter → AI/statistics → views → pills → sort headers → per row (link, "עוד", chevron) → pager.
- **Keys:** Enter submits the search. Esc closes, in order: menu → dialog → expanded row; focus returns to whatever opened it.
- **Focus ring:** the sketch's gold ring. Every control is at least 44×44, and rows are at least 56px tall.
- **Touch:**
  - Tapping a row opens it.
  - The chevron and "עוד" are separate targets.
  - Nothing is hover-only. The orders hover card (LI-39) became the expanded row, and the explanations are in `data-tip` on focusable buttons.

## 13. Phone card mode (< 640)
- The table is replaced by the sketch's **compact expandable rows**: `.itm.hfe.noamt` inside `.hfeed`. This is exactly the component and motion of the order card's history entries (light border, 20px gap, `rowin` entrance, `.det-wrap`, chevron turn). The cards stay inside the table card, just as history entries sit inside `.card.hist` in the sketch.
- **Card layout:**
  - `.thumb` holds the entity icon on the sketch's `THUMBS[0]`.
  - `.info` has **one datum per line**. Line 1 is the name (a link, bold). Then come `label value` lines:
    - orders: order number · Hebrew date · Gregorian date · amount due · payment;
    - customers: code · phone · city.
  - Then the status tag on its own line, with its text lines under it, and then the chevron.
  - The expanded part has the rest, one per line, plus the actions.
- **Around the cards:**
  - The edge marker is a 3px bar inside the card.
  - Sorting is the footer select.
  - The search form takes a full row, and the filter, star and statistics buttons sit under it.
- **640–1023:** the table stays. P2 columns, long-cell tails and row menus move into the expanded row. At 768 there is no scroll inside the table for the designed data (measured). `.tbl-wrap` can still scroll as a last resort for extreme labels (ג.2); the page itself never scrolls sideways.

## 14. Wide screens
The container is the sketch's `.app`, max 1240, as D-14 decided ("like today"). ≥1440 changes nothing else, because the P3 slot is unused by both screens today. Giving list screens a 1440 container would need a shell amendment on `.app` (T-Q8).

## 15. Org variance
Everything that depends on a setting is declared in the page's config, with the value that applies when the row is missing (= today's behaviour). The demo strip's profile switch (org 1 / org 2 / minimal / extreme) changes these live.

**Orders**

| What changes | Setting |
|---|---|
| "טיוטות" view | `draft_orders_show_as_deleted` |
| "לא נלקחו" view, falling back to "בקרוב" when hidden (LI-29) | `show_not_taken_orders` |
| Spacing marker and text | `hide_custom_spacing` |
| Cart window | `inventory_hold_minutes` |
| Taken orders hidden from "בקרוב"/"הכול" | `hide_taken_orders_from_orders_list` |
| Delete blocking | `allow_edit_partially_rented` |
| ID number before delete | `require_id_for_edit_cancel` |
| Prep report | `enable_batch_print_prep` |
| Gregorian line | `hide_gregorian_calendar` |
| AI tools | `hide_ai_features` / `feature:ai` |
| Column labels | `order_*` labels |
| Export limit | `feature:export_max_rows` |

**Customers:** no setting changes a column, filter or sort today (searched; CL §ח). What varies is:
- the `customer_*` labels;
- AI availability;
- the export limit;
- `hide_marketing_consent_field` (a line in the expanded row).

## 16. Acceptance, per list screen (`tools/tables-check.cjs`, `tools/parity-check.cjs --only=<file>`)
1. Every list screen has the same `V3-SHELL` sha and the same `V3-TABLES` sha.
2. At most 5 data columns at ≥1024, and card mode below 640. No page-level horizontal scroll at 360/768/1024/1440 (including the extreme profile), and no scroll inside the table at 768/1024/1440.
3. Chips: at most 1 `.tag` per row and per card, one tag column, no tags outside rows, and no `.chip` in the page — in every view.
4. Header, cell, actions, footer, sort button and expanded-row geometry are computed identical across list screens.
5. Only the allowed breakpoints, only logical properties, and AA text contrast.
6. Filter and export windows put one field per line and are light.
7. Sort, expand, Esc, row menu, pager, error, empty, no-results and smart search all work, with no JS errors.
8. Every contract item (LI-n / CL-n) is visible in the prototype or listed as out of scope with a reason (`TABLES-REPORT.md` §4).
