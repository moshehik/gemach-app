# BEST-OF — rescuing the nicer pre-polish details · 2026-09-24

**Why this file exists.** The owner said: *"There are things in the customer-card prototype's design that may be prettier — so just keep them."* The polish pass (`redesign/v3-protos-polish`) rebuilt all 7 prototypes on the shared sketch shell (SHELL-BLOCK.md) and could not hear that request. This pass (`redesign/v3-protos-curated`, based on the polish branch) compares every prototype's **pre-polish** version (`origin/redesign/v3-protos-review`) with the **polished** one and puts back the details that were nicer — as long as they don't break a hard rule.

**Hard limits that were kept (never undone):** the shared components stay byte-identical to the sketch (the shell block was not touched: `node tools/build-shell.cjs --check` — see §Verify); chip restraint C-1.14; one field per line C-1.16; RTL + logical properties; WCAG AA; allowed breakpoints only; overlay rules. A restored detail is always rebuilt **on** the shared components/tokens, with page-only CSS marked `/* CURATION Rn */` in the prototype's own page `<style>`, never as a second copy of a shared component.

**How to read the tables.** *Decision* is one of: **restored** (put back, adapted to the shared components), **replaced by sketch component** (the polished version is the sketch's own component — kept), **rejected because &lt;rule&gt;**. Screenshots are under `screenshots/curation/` as `<prototype>-<state>-<width>-{original,polished,curated}.png` (full page, 1440 and 390).

---

## 1. Customer card — `archetype-detail-card.html` (the one the owner meant)

Screenshots: `archetype-detail-card-details-*`, `archetype-detail-card-orders-*`, `archetype-detail-card-empty-*` (×1440/390 × original/polished/curated).

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| R1 | **Order links** styled as ink-coloured bold text with a small "forward" arrow that nudges on hover | orders tab (every row title), notes (auto-note line), payments + refunds rows (meta line) | Original: `הזמנה 53120 ←` in ink, no underline, arrow nudge. Polished: plain `<a>` with **browser-default blue + underline** (the shell has no content-link style, so the link fell back to the UA style — a regression, not a decision) | **restored** — page-only `.olink` (ink, 700, underline only on hover, focus ring, arrow `i-arrl`, reduced-motion safe). Candidate for the shared library (§9) |
| R2 | **Blocked banner with its action inline** at the end of the banner | details tab, top | Original: compact one-line banner, "ביטול החסימה" as a normal button at the inline-end. Polished: `.creditile.stack` → a full-width salmon button under the text, the heaviest thing on the page for a secondary action | **restored** — `.creditile` without `.stack` + `btn sm`; at ≤480px it falls back to exactly the sketch's `.stack` values (button full width) so phones don't squeeze the text |
| R3 | **Copy action next to the value it copies** | details tab, e-mail row | Original: "העתקה" right under/next to the address. Polished: "העתקת המייל" detached at the bottom of the card, next to "שליחת מייל" | **restored** — `btn sm` "העתקה" inline after the e-mail value (same pattern as the sketch's inline mark after the e-mail `<b>`); "שליחת מייל" stays in the sketch's action row under the `.kv` |
| R4 | **Empty states with an icon in a gold-ringed circle** and a proper heading | orders (0 orders), payments (none), refunds (none), details (no contact info) | Original: 72px ringed icon, bold 18px heading, more air. Polished: bare small icon + `<br>`-separated text | **restored** — page-only `.empty .eic` (gold-300 ring, surface fill, navy icon) inside the shared `.empty` |
| — | Monogram avatar in the title row (`רפ` navy tile next to the name) | title row | Original: avatar left of the name + "כרטיס לקוח" eyebrow. Polished: sketch title row (`<small>לקוח</small>` + name), monogram moved into the details card | **replaced by sketch component** — the title row is a shared component (owner: identical to the order card) |
| — | Fact chips under the name (customer no., 4 orders, last updated) | title row | Original: 4 chips. Polished: one "חסום להזמנות" tag; the facts live in the card | **rejected because C-1.14** (a fact is not a status); nothing lost — all four facts are in the details card / rail |
| — | Labelled "מייל ללקוח" / "עריכה" buttons | title tools, card header | Original: text buttons. Polished: icon `ibtn` with aria-label + tooltip | **replaced by sketch component** — the sketch's title tools and card-header actions are `.ibtn` icons. Clarity is kept by the automatic tooltip (S7) |
| — | Rail "במבט אחד" as big-number tiles (label over value) | rail | Original: 2×2 tiles, big numbers, debt tile tinted. Polished: sketch `.glance/.gl` one-line tiles | **replaced by sketch component** (rail/binder is owner-listed shared) |
| — | Payment summary as a 4-stat grid (charges / paid / credits / owed) | payments tab | Original: 4 stat boxes, debt box tinted. Polished: sketch `.bal` hero number + `.pbar` progress + `.kv` rows | **replaced by sketch component** — the sketch's balance block says the same thing with one hero number; arguably clearer |
| — | Payments/refunds as a 3-column table with type chips | payments, refunds | Original: table + "תשלום/זיכוי" chips. Polished: sketch `.list/.li` rows | **replaced by sketch component** (sketch `pPayments` pattern); the chips would also fail C-1.14 |
| — | Bank form in a 2×2 grid | refunds tab | Original: 2 fields per line. Polished: `.fcol` | **rejected because C-1.16** (one field per line) |
| — | Order rows compact: status tag on the same line as the title (≈76px rows vs ≈130px) | orders tab | Original: grid row thumb / title+meta / status / chevron. Polished: sketch `.itm` (status on its own line under the meta) | **replaced by sketch component** (`itemCard`). Density difference listed as a promotion candidate (§9: compact `.itm` for link lists) |
| — | "who · time" visible on every collapsed history row | history tab | Original: sub-line "מרים גולד · 17:05". Polished: sketch history feed shows who/time only after expanding | **replaced by sketch component** (history is owner-listed shared). Promotion candidate (§9) |

---

## 2. Monthly board — `archetype-board.html`

Screenshots: `archetype-board-month-{1440,390}-*`, `archetype-board-list-1440-*`.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| B1 | **Hatched days outside the month** (diagonal sky-50/white stripes) | month grid, leading/trailing cells | Original: hatch makes the month's edge obvious. Polished: flat `--surface2`, the same tint as Shabbat cells, so "not this month" and "Shabbat" looked alike | **restored** — page-only `.day.void` repeating gradient from the shell's own tokens |
| B2 | **Gold "today" tab hanging from the top of today's cell** | month grid | Original: small gold tab + tick. Polished: the word "היום" inline next to the date number (easy to miss) | **restored** — `.today-pin` (gold / navy-900 border, `aria-hidden`; the cell's aria-label already says "היום"). ≤1023px it shrinks to a 20×6 bar as in the original. One per screen, a live marker → within C-1.14 |
| B3 | **"Today" divider label in the list view** | list view | Original: gold rule with a gold "היום" label + calendar icon. Polished: gold rule with plain text | **restored** — same visual language as B2 (one per screen) |
| — | Rental cards with a slim "(i)" column separated by a hairline | month/week/list cards | Original: quiet text-coloured info icon. Polished: the sketch's `.ibtn` (salmon 44px) | **replaced by sketch component** (buttons are owner-listed shared). Note for the owner: 30+ salmon info buttons on one month is loud — see §9 "quiet icon button" candidate |
| — | Month navigation as a centred pill "תשרי תשפ״ז · 12.9–11.10" between arrows, page title "הזמנות לפי תאריך אירוע" | title row | Polished: sketch title row (month as the h1, range under it, arrows as `.ibtn` tools) | **replaced by sketch component** (title row is shared) |
| — | Month / week / list as a compact segmented control | toolbar | Polished: the sketch `.tabs` bar | **replaced by sketch component** (tabs) |
| — | Order-count pills "3 הזמנות", holiday chips, legend chips | day headers, legend | Polished: "(3)", plain holiday text, legend as colour bars + text | **rejected because C-1.14** (counts and labels are not statuses); nothing lost |
| — | Search bar with the button and the star/statistics icons inside the same field | toolbar | Polished: field + separate buttons in a row | **replaced by sketch component** (fields/buttons base styles). Composition is acceptable; not restored |

---

## 3. New-order wizard — `archetype-wizard.html`

Screenshots: `archetype-wizard-step1-{1440,390}-*`.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| W1 | **"שלב N מתוך 5" orientation line** | above every step's content | Original: "שלב 1 מתוך 5" eyebrow over the step question. Polished: gone — the only position cue is the timeline, which on a phone is a tall vertical list | **restored** — page-only `.wz-stepof` ("שלב 3 מתוך 5 · פריטים"), plain ink3 text, no chip |
| W2 | **Lock reason shown once**, not under every locked step | timeline (step 1 and 2) | Original: locked steps showed only a lock + (i). Polished: "קודם בוחרים לקוח" repeated under all 4 locked steps | **restored** — the reason is written under the first locked step only; every locked step still explains itself in its rich hover card and aria-label |
| — | Big size tiles (number + "2 פנויות" inside a bordered tile, unavailable = dashed + struck) | step 3, size field | Polished: the sketch's `.sizes` buttons with the count under each | **replaced by sketch component** (the add-item panel is copied from the sketch). The original tile is clearer at a glance — promotion candidate (§9) |
| — | Step question as a large centred h2 ("למי ההזמנה?") above the card | every step | Polished: the question is the card-h heading | **replaced by sketch component** (card header) |
| — | Footer nav under the content (back / continue) | every step | Polished: navigation lives in the rail (sketch binder actions) | **replaced by sketch component** (rail/binder) |
| — | Exit as a labelled "יציאה" button in the title row | title row | Polished: "יציאה מההזמנה" in the rail | **replaced by sketch component** (title row + rail) |
| — | Cart rows with three always-visible icon actions (dates / edit / delete) | step 3, cart | Polished: sketch `.itm` with the actions inside the expander | **replaced by sketch component** (`itemCard`) |

---

## 4. Orders list — `archetype-list.html` (polish-base version)

Screenshots: `archetype-list-soon-{1440,390}-*`. Note: this list is also being rebuilt on `redesign/v3-proto-tables` (see §8) — this pass only fixes the version on the polish base.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| L1 | **Status switcher scrolls sideways with an edge fade on phones** | toolbar (בקרוב / ארכיון / מחוקות / לא שולם / לא נלקחו / הכול) at ≤767px | Original: labels keep their width, the row scrolls, a soft fade at the far (left) edge says "there's more". Polished: six labels squeezed into ≈59px each — "לא שולם" and "לא נלקחו" ran into each other and "הכול" was cut off | **restored** — page-only: `#statSeg>button{flex:0 0 auto;white-space:nowrap}` + mask fade at ≤767px (the shared `.seg` look is unchanged) |
| — | Labelled toolbar buttons (סינון מתקדם / תפוסה / הדפסה / ייצוא) | title row | Polished: `.ibtn` icons (tooltip + aria-label) | **replaced by sketch component** (title tools) |
| — | Count pill on the active status ("בקרוב 63") | status switcher | Polished: count only in "64 הזמנות מתאימות" above | **rejected because C-1.14** — the same number is already written once in text |
| — | Hold countdown as a gold pill ("שמור עוד 10:58") | row, order column | Polished: coloured text + hourglass | **rejected because C-1.14** (the row already carries its one status tag) |
| — | "⋯ more" row menu + "עוד פרטים" button in phone cards | rows / cards | Polished: one chevron `.ibtn` opening the details | **replaced by sketch component** (item-row expander) |

---

## 5. Home / dashboard — `archetype-dashboard.html`

Screenshots: `archetype-dashboard-home-{1440,390}-*`.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| D1 | **Shortcut tiles with a visible one-line description** (icon box · name · "הכנסות וגרפים" · forward arrow) | "קיצורי דרך" card | Original: quiet white tiles, the description readable at a glance, arrow nudges on hover. Polished: five filled salmon buttons in a row — the description only in a hover tooltip (invisible on touch), and a wall of primary-looking buttons for plain navigation | **restored** — page-only `.ql-t` tiles on shell tokens (`--line`, `--sky-100`, `--r-sm`, `--sh`), focus ring, reduced-motion safe. Promotion candidate (§9 "navigation tile") |
| — | Search card without its own header, big centred greeting | top | Polished: sketch title row + a card with a card-h "חיפוש" | **replaced by sketch component** (title row, card header) |
| — | Recent searches as small quiet pills | search card | Polished: `btn sm` (salmon) | **replaced by sketch component** (buttons). Heavier than before — see §9 "quiet button" candidate |
| — | Count "5" as a small grey number next to the heading | shortcuts header | Polished: "(5)" | **replaced by sketch component** (A2 count-as-text) |

---

## 6. Customer kiosk / touch — `archetype-touch.html`

Screenshots: `archetype-touch-date-{1440,390}-*`, `archetype-touch-catalogue-{1440,390}-*`.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| T1 | **Calmer month grid** — soft sky-50 day cells with no hairline, chosen day navy **with a gold underline** | date step, Hebrew calendar | Original: filled cells, no borders, gold underline on the chosen day. Polished: every day a white box with a sky-200 border (≈90 outlined boxes), chosen day plain navy | **restored** — page-only overrides on `.kday` (the kiosk calendar is page-specific content; the sketch has no month grid) |
| T2 | **Sizes as small data tiles** (size big, "3 פנויות" under it; unavailable = dashed + struck) | catalogue, each model card | Original: tiles next to the model, scannable by a customer. Polished: one text line "מידות: 38 (3) · 40 (2)" — the parentheses read as noise | **restored** — `sizeTiles()` + page-only `.szt` (bordered boxes, not chips: a size is data, not a status — C-1.14 unaffected; the table view keeps the text line) |
| — | Two-step kiosk progress pills in a navy header ("שלב 1 · בחירת תאריך → שלב 2") | header | Polished: site top bar + sketch `.tabs` (תאריך האירוע ✓ / שמלות פנויות (14)) | **replaced by sketch component** (top bar, tabs) |
| — | Three month grids side by side at 1440 | date step | Polished: two (the rail takes the third column) | **replaced by sketch component** (rail/binder layout) |
| — | Day / month / year selects on one line | date step | Polished: one per line | **rejected because C-1.16** |
| — | Large rounded "ask the assistant" pill with a sparkle icon | top of both steps | Polished: plain field + "שליחה" button | **replaced by sketch component** (fields/buttons base styles) |
| — | Compact one-line model rows (≈14 models per screen) | catalogue | Polished: sketch `.itm` cards (≈4 per screen) | **replaced by sketch component** (`itemCard`). Density listed in §9 |
| — | Toolbar with six labelled icon buttons (סינון / גודל / תאריך אחר / רענון / הדפסה / למערכת) + gold "נעילה ללקוח" | header | Polished: title tools `.ibtn` + rail actions + "סינון ותצוגה" collapsible | **replaced by sketch component** |

---

## 7. Profile form — `archetype-forms.html`

Screenshots: `archetype-forms-view-{1440,390}-*`.

| # | Detail | Where | Original vs polished | Decision |
|---|---|---|---|---|
| F1 | **"בעמוד הזה" section index** with a per-section "unsaved change" mark, plus **the two save models spelled out** ("פרטים נשמרים יחד בכפתור ״שמירת השינויים״ · סיסמה מתחלפת מיד, בחלון שלה") | top of the main column | Original: a sticky side index (6 anchors, dot on changed sections) + two explainer tiles. Polished: both gone; the save explanation only in an (i) tooltip in the title row, and a long single-column form with no way to jump | **restored, adapted** — one `.card` (shared) at the top of the main column holding plain text anchor links (icon + label, pencil mark when the section has an unsaved change) and the explainer line. No chips, no sticky side column (the rail owns that side). Verified: marks update while typing and focus stays in the field |
| — | Read-only "תאריך הצטרפות" in a tinted box | personal details | Polished: sketch `.kv` label/value row with a tooltip | **replaced by sketch component** (`.kv`) |
| — | Sticky bottom save bar ("הכול שמור" / ביטול / שמירה) | bottom of the viewport | Polished: the rail binder (summary + changes + save) | **replaced by sketch component** (rail/binder) |
| — | Top nav reduced to 4 items for a staff user | top bar | Polished: full sketch top bar | **replaced by sketch component** (top bar) |

---

## 8. Observations — prototypes built after the polish base (not merged into this branch)

Checked by extracting the files from their branches into a scratch copy of the folder and running the same `tools/parity-check.cjs` there (nothing from those branches was committed here).

### `redesign/v3-proto-tables` — `archetype-customers-list.html`, rebuilt `archetype-list.html`, `TABLES-PATTERN.md`
- **Shell:** both files carry the same shell block `v1 sha:d7c2b5b7b88b` as the 7 curated prototypes — consistent. The branch is based on `redesign/v3-protos-polish`.
- **Parity (run):** customers list — style 15/14/14 PASS, 0 FAIL at 1440/1024/390; motion 10 PASS / 0 FAIL; fields PASS; overflow ok at 360/768/1024/1440; page @media and physical properties clean; 0 of 223 sampled texts below AA. Rebuilt orders list — style 18/17/15 PASS, 0 FAIL; motion 9/0; fields PASS; overflow ok; 0 of 392 below AA.
- **Consistency notes for the owner:**
  1. Every table row ends in a filled salmon `.ibtn` chevron (≈50 per screen). It is the shared button, so it is "correct", but it is the loudest element on a data screen — same concern as the board's info buttons (see §9 "quiet icon button").
  2. The rebuilt list already fixes the phone status-switcher squeeze that L1 fixes here (it scrolls), but without an edge fade — "לא נלקחו" is simply cut at the edge. If the tables branch is adopted, carry over L1's fade.
  3. Count in the title as "(137)" / "(63)" — consistent with A2 (count as text).
  4. The customers table's status column is empty for almost every row (only "חסום" appears) — fine for C-1.14, but the column could be dropped or narrowed at ≤1023px.
  5. None of the curation restorations above (order-link style R1, empty-state ring R4) exist there yet; if the tables list replaces this list, R1's `.olink` would apply to its order links too.

### `redesign/v3-proto-login` — `archetype-login.html`
- **Shell: not used.** The file carries no `V3-SHELL` block (the branch is based on an older review commit, not on the polish base). By design there is no site top bar before login, but it also means none of the shared tokens/motion are guaranteed identical.
- **Parity (run, 390 only is comparable):** 2 style FAILs — page background: `html` has two radial gradients and `body` is transparent, where the sketch has `body` `#dcedfa` and no `html` image. Motion 5 PASS / 0 FAIL; fields PASS; overflow ok at 360/768/1024/1440; no page @media outside the allowed set; 0 physical properties. (Contrast sampler found 0 texts to sample in its selector set — not a pass, just not measured.)
- **Deviations worth a decision:**
  1. Brand mark is a gold tile with the letters "גה", while the shared top bar's brand mark is the dress icon — two different logos.
  2. The floating "בקרת הדגמה" pill (bottom-start) overlaps the footer link "רק לדווח משמרת" at 390px — the other prototypes use the sketch's demo strip at the top.
  3. The navy brand panel with the dress outline is a nice, distinctive first screen; if kept, it would be the only page with its own background — consider building it on the shell tokens (and the shell's page background) so the step from login to the app doesn't change colour.
  4. Nice details to keep if it is rebuilt on the shell: the "צעד 1 מתוך 2 · שם" progress line (same idea as W1), avatar initials in the name list, the gold inline-start bar on the highlighted name.

---

## 9. "Promote to shared library" candidates — for the owner to decide (NOT added to the shell block)

| Candidate | Seen in | Why | Where it lives today |
|---|---|---|---|
| **Content link** (`.olink`: ink, bold, arrow, underline on hover) | customer card R1; also every "הזמנה N" link in list/board/wizard | The shell has **no** style for an in-content `<a>`, so any link falls back to browser blue + underline. This will recur on every page | page-only in `archetype-detail-card.html` |
| **Empty state with ringed icon** (`.empty .eic`) | customer card R4 | The shared `.empty` is bare; every list/tab needs an empty state | page-only in `archetype-detail-card.html` |
| **Quiet icon button** (text-coloured, no fill, 44px hit area) | board info buttons, table row chevrons, recent searches | The only icon button is the filled salmon `.ibtn`; on data screens 30–50 of them become the loudest thing on the page | not built — needs a sketch-level decision |
| **Navigation tile** (`.ql-t`: icon box, name, one-line description, arrow) | dashboard D1 | A second "shortcut" surface will appear on admin/settings pages | page-only in `archetype-dashboard.html` |
| **Compact item row** (status on the title line, ≈76px) | customer card orders, touch catalogue | `.itm` is tuned for the order card's few dresses; lists of 10–50 links need density | not built |
| **"Who · time" on collapsed history rows** | customer card history | Scanning a log without expanding each row | shared history feed (S3) — would change the sketch |
| **Big size tile** (size + "N פנויות" inside a bordered tile) | wizard step 3, touch T2 | Same data in two flows; the kiosk version is now page-only | page-only `.szt` in `archetype-touch.html` |
| **"Today" marker** (gold tab / gold divider label) | board B2/B3, touch calendar | Any calendar/timeline needs one | page-only in `archetype-board.html` |
| **Phone scroll fade for segmented controls** | list L1 (and the tables branch) | `.seg` with 5+ options on phones | page-only in `archetype-list.html` |

---

## 10. Verification (all run on this branch, 2026-09-24)

| Check | Command / method | Result |
|---|---|---|
| Shell block unchanged and identical in all 7 | `node tools/build-shell.cjs --check` | **pass** (exit 0, `sha:d7c2b5b7b88b`) |
| Style parity vs sketch @1440/1024/390 | `tools/parity-check.cjs` (full run, results in `tools/parity-results.json`) | **pass** — 0 FAIL in all 7 (detail-card 39/38/36, board 17/16/17, wizard 24/23/21, list 20/19/15, dashboard 18/17/15, touch 21/21/21, forms 24/23/21 PASS) |
| Motion parity | same run | **pass** — 0 FAIL in all 7 |
| One field per line (C-1.16) | same run | **pass** in all 7 (detail-card 33 state×width checks) |
| No horizontal overflow 360/768/1024/1440 | same run | **pass** in all 7 |
| Allowed breakpoints (page `<style>`) | same run | **pass** — no bad page @media (new rules use 480/767/1023 only). Shell's own 1180/1040/900 remain the documented deviation from PARITY-REPORT §6, untouched |
| No physical CSS properties | same run | **pass** — page 0, shell 0 in all 7 |
| WCAG AA contrast (sampled) | same run | **pass** — 0 below AA in all 7 (47/185/20/385/25/203/45 sampled) |
| Page errors | same run + every screenshot run | **none** |
| Chip counts (C-1.14), polished → curated, same selector as PARITY-REPORT §1 | `chips` probe at 1440 (12 states) | **unchanged** in every state: detail-card details 1→1, orders 2→2, payments 1→1; board month/list 0→0; wizard 0→0; list 50→50 (one per row, open point L-1); dashboard, touch, forms 0→0. Note: the board's restored "today" tab and list "today" label are one live marker per screen and do not use a chip class |
| Interaction spot-checks | Playwright | customer card: 0-orders state renders the ringed empty state; blocked banner falls back to full-width button at 390; forms: section marks appear while typing and focus stays in the field; list: switcher scrolls at 390 |
| Screens at 1440 and 390 | `screenshots/curation/*-{original,polished,curated}.png` | produced for every prototype |
| Not run | — | keyboard-only walkthrough of the new controls beyond focus rings; screen-reader pass; 768/1024 screenshots (overflow was checked at those widths, visuals were not reviewed) |
