# SHELL-BLOCK — the one shared component block of every v3 prototype

> **Why this exists (owner feedback 2026-09-24):** "everything in the customer-card prototype is different from the order card — top bar, menus, rail tiles, tabs, history, animations". Root cause: each earlier agent re-drew the sketch's components from the constitution's prose. **From now on no prototype draws a shared component itself.** Every shared component — markup pattern, CSS values *and motion* — comes from `sketch/order-card-sketch-B.html` (the order card), extracted **verbatim** by a script, and the identical block is pasted into all 7 prototypes (each file stays self-contained). Rule: CONSTITUTION **C-1.15**.

- **Version:** `v1` · **hash:** printed by the build and written into every injected block (`<!-- V3-SHELL:CSS v1 sha:… -->`) and into `shell/BUILD-INFO.txt`. Two prototypes with the same `sha:` carry byte-identical shells.
- **Build / re-inject:** `node docs/redesign-v3/prototypes/tools/build-shell.cjs` (all files) · `--only=archetype-list` (one file) · `--check` (CI style: fails if any file's block is stale).
- **Never edit the block inside a prototype by hand.** Change the sketch (or `shell/*.src.js` / `shell/amendments.css`) and rebuild.

## 1. What is in the block (and where each part comes from)

| Part | Marker | Source (sketch lines) |
|---|---|---|
| **All sketch CSS** — tokens, base, page background (html **and** body, L1236), page container `.app`, title row `.topbar/.back/.ttl/.tools/.menu`, timeline `.stepper/.tlx/.tx`, layout `.layout/.main/.rail`, **tabs** `.tabs/.tab/.tab.on/.tabmk`, panels `.panel` (+`tabin`), **cards** `.card/.card-h/.ico`, label/value rows `.kv .f`, `.tip` + `#tt` tooltip + `#rt` rich card, **buttons** (all variants: `.btn`, `.primary`, `.ghost`, `.sm`, `.lg`, `.block`, `:disabled`, `.ibtn`, `.back`) — final values = the last cascade layer L784-806 + L821-827, **fields** `.field/label.lbl/.inp/textarea.inp/.seg/.sw/.trow/.coll/.cb`, item rows `.itm/.top/.thumb/.info/.model/.det-wrap/.det-in`, list rows `.list/.li`, balance `.bal/.pbar`, **rail/binder** `.rcard.cart/.sec-h/.glance/.gl/.cart-h/.cart-t/.cart-body/.cl/.cl-i/.cl-t/.cl-u/.cart-tot/.status/.cart-actions/.redo`, **history** `.hist/.hf-bar/.hf-s/.hf-sel/.hf-p/.hf-o/.hfeed/.hgrp/.hday/.hfe/.hv-r/.hamt/.av`, **toast** `#toast/.tb/.tbtn/.tclose` (+drain bar), **dialogs** `.scrim/#dlg/#dlg2/.dbtns/.chg/.net/.methods/.opt/.amtin/.success/.apprwin/.acodes/.mailwin/.mfld` (dark/light tokens, `body.dlg-dark`), **notice bar** `.nb-*`, **top bar** `.snav/.sn-*` + bell panel `.nf-*`, card shine, timeline frame shine, **icon animation library** (`ia-*`, `icn*`, `[data-ico]` bindings), `.demo` strip | L10-1755, L3042-3224, L3263-3511, L3564-3597 — concatenated in document order |
| Amendments (§3) | same `<style>` (end) | `shell/amendments.css` |
| Icon sprite (`#i-*`, 62 symbols) | `V3-SHELL:TOP` | L1759-1824 |
| **Site top bar** — brand, 6 nav groups with dropdowns, search panel, bell + notification panel, shift clock, user menu, burger + mobile drawer. *Only* the controls the sketch has. | `V3-SHELL:TOP` | L1826-1865 (+ nav/drawer built by JS §2 S9) |
| Notice-bar area `#nbArea` | `V3-SHELL:TOP` | L1867 |
| Overlays: `#toast`, `#tt`, `#scrim/#dlg`, `#scrim2/#dlg2` | `V3-SHELL:END` | L1918-1921 |
| Runtime JS (§2) | `V3-SHELL:END` | `shell/runtime.src.js` + `shell/runtime-tail.src.js` |

## 2. Runtime JS (verbatim sketch ranges + marked glue)

| Id | What | Sketch lines | Page API it gives you |
|---|---|---|---|
| G0 | globals (glue) | — | `var UI, logs, HCATS, THUMBS, WHO, SK_NAV_CUR; netDelta(), dirty(), richHTML(spec)` — pages **assign/redeclare with `var` or `function`, never `let/const`** |
| S1 | helpers | L1925-1930, L1956 | `$(sel)`, `ic(name,cls)`, `money(n)`, `smoney(n)`, `tip(text)`, `clone(o)`, `plural(n,one,many,zero)` |
| S2 | Hebrew day titles | L2569, L2287-2291 | `wdl(iso)`, `dayTitle(iso)`, `greg(iso)` |
| S3 | **history feed** (search + multi-select filter + day groups + expandable rows) | L2292-2387 | `pHistory()` → full history card HTML; `hfSync()`. Data: `logs=[{id,ts:'YYYY-MM-DDTHH:MM',cat,icon,text,sub?,who,amt?,kind?:'pay',det:[[k,v],…],isNew?}]`, `HCATS=[['all','הכל','list'],[cat,label,icon],…]` |
| S4 | toast | L2447-2456, L2820-2829 | `toast(kind:'info'|'charge'|'credit', big, small, btnLabel?)`, `closeToast()` |
| S5 | dialog layer | L2466-2467 | `openDlg(html)`, `closeDlg()` (second layer: `#scrim2/#dlg2`, see sketch `askManagerApproval`) |
| S6 | tooltip + rich hover cards | L2565-2568, L2614-2650 | any element with `data-tip="…"`; `data-rich="spec"` + your `function richHTML(spec){…}` |
| S7 | every button: auto tooltip + `data-ico` (icon-meaning animation hook) | L2764-2779 | automatic (MutationObserver) |
| S8 | timeline frame shine pause | L2943-2946 | automatic for `#stepper` |
| S9 | **site top bar** (nav groups, dropdowns, search, drawer, shift clock) | L2948-3040 | `var SK_NAV_CUR='לקוחות'` *before* the block marks the current page |
| S10 | ICON-ANIM (entrance + per-icon hover/focus animation by icon meaning) | L3226-3261 | automatic for every `svg.ic` |
| S11 | DLG-MODERN (dark/light dialog tokens, hero badge, idle loops) | L3513-3562 | `body.dlg-dark` = confirm/code dialogs dark; `.dlg.mailwin` = data-entry, always light |
| S12 | ICON-ANIM-2 (replay on open, burst, error shake) | L3599-3631 | automatic |
| S13 | notice bar | L3634-3702 | `nbAdd(kind:'info'|'warning'|'success'|'alert', {title,detail,rows:[[icon,text]],go?})`, `nbDismissAll()` |
| S14 | bell notifications | L3704-3813 (order-card wiring removed) | `nfPush({icon,title,sub})` |

## 3. Normalisations and amendments (the only differences from the sketch)

Applied by `build-shell.cjs` and counted in `shell/BUILD-INFO.txt`:
- **N1 reduced motion.** The sketch disables `prefers-reduced-motion` for demo purposes (`and (min-width:99999px)`). The block re-enables it (CSS ×18, JS ×2) → static end state, per CONSTITUTION ה.3.
- **N2 breakpoints.** `max-width:1020px→1023px` (×8), `420px→479px` (×2) — the allowed set (ב.6). **Kept verbatim (deviation, see PARITY-REPORT §6):** the top bar's own compaction thresholds 1180/1040/900 — mapping them would visibly change the top bar at 1041-1439px, which the owner explicitly forbade.
- **N3 physical → logical.** 21 declarations (`left→inset-inline-end` etc.). Exact in an RTL-only document.
- **N4 fill-mode.** `both/backwards` removed from 42 undelayed entrance animations (visually a no-op; satisfies ה.4 "no hidden resting state"); kept on 9 staggered ones (listed in BUILD-INFO) because removing it would flash rows before their stagger.
- **Amendments (`shell/amendments.css`):** A1 `.hamt` history amounts = plain AA text (C-1.14: a value is not a status); A2 `.tcount` bracketed tab count replaces the `.cnt` pill; A3 `.fcol` = one-field-per-line form column (C-1.16); A4 `.tbl` = the one shared table (the sketch has no table — built from `.li`/`.kv` values); A5 `.stx` = status as text+icon without a chip. Glue in JS: history heading count as text `(12)`, not a chip; cart count as text (pages write `<b>שינויים (3)</b>`, no `.badge`).

## 4. How a prototype uses the block (contract for every page)

```html
<head> … fonts link (Rubik, as the sketch) …
<!-- V3-SHELL:CSS … --> … <!-- /V3-SHELL:CSS -->
<style>/* PAGE-SPECIFIC ONLY: layout of content unique to this page. Must not restyle any shared selector (§1). No @media outside 480/640/768/1024/1440/1920 (±1). Logical properties only. */</style>
</head><body>
<script>var SK_NAV_CUR='לקוחות';</script>            <!-- optional: current nav item -->
<!-- V3-SHELL:TOP … --> … <!-- /V3-SHELL:TOP -->
<div class="demo" role="region" aria-label="בקרת הדגמה"><b>הדגמה:</b> …buttons/selects…</div>   <!-- the sketch's demo strip -->
<div class="app" id="app">
  <div class="topbar"><button class="back" …>${ic('back')}</button><div class="ttl"><h1><small>לקוח</small><bdi>…</bdi></h1></div><div class="tools">….ibtn…</div></div>
  <div class="layout"><main class="main"><nav class="tabs" role="tablist">…</nav><section class="panel on" …>…</section>…</main><aside class="rail" id="rail">…</aside></div>
</div>
<!-- V3-SHELL:END … --> … <!-- /V3-SHELL:END -->
<script>/* page script: uses $, ic, money, tip, toast, openDlg, pHistory, nbAdd… — never redeclares them */</script>
```
Rules: content and structure differ per page; **style and motion never do**. A page may add page-only classes for page-only content, but a thing that *is* a shared component (tab, card, button, field, history row, rail tile, dialog, toast, notice, table) must use the shared class names and markup pattern exactly as in the sketch (see the sketch's render functions: `renderTabs` L2092, `pDetails` L2107, `itemCard` L2163, `pPayments` L2249, `pHistory` L2343, `_renderRail` L2390, `summaryDlg/payDlg/creditDlg/successDlg` L2468-2539, `askManagerApproval` L2905).
