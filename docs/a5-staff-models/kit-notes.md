# ערכת הרשימות החדשה - `app/components/a5-list/` (גרסה ראשונה, לשילוב ע"י כרטיס הדגם)

פורט React של מנוע הרשימות בעיצוב המאושר (`scratch/emp-models-build/list-core.js` + החלק של הרשימות ב-`page.css` + `shared.js` + `dlg-modern.js`).
משמשת את רשימת העובדים, רשימת הדגמים, ואמורה לשמש את הפריטים / השכרות / היסטוריה בכרטיס הדגם.

```js
import {
  A5List, A5SearchSlot, ViewSwitch, ExportTrio, Pager, HlText,        // רשימה + חלקים
  A5Page, useA5, ConfirmDlg, Dlg, DlgBadge,                           // שורש דף + טוסט + חלונות כהים
  Ic, hDateFull, hDateShort, dayTitle, relDay, timeHM,                 // אייקון + תאריכים עבריים
  runListExport, listExportHtml,                                      // ייצוא ברירת מחדל (xlsx / pdf / הדפסה)
} from '@/app/components/a5-list';
```

## היקף ה-CSS (חשוב לשילוב)
`a5-list.css` מיובא מתוך `A5List.js`. כל כלל מוגבל ל-`.gm-ds :where(.a5l)` - כלומר רק בתוך רכיב עם המחלקה `a5l` (`A5List` שם אותה על שורש הרשימה,
`A5SearchSlot` על עטיפת משבצת החיפוש). אפס ספציפיות מעבר ל-`.gm-ds`, כך שהיחס מול `design-system/components.css` זהה לעיצוב. הרשימה עובדת בכל שורש
של דף A5 (`.gm-ds ...`), לא רק בשורש `A5Page`. הדף חייב לייבא בעצמו `@/design-system/components.css` (כמו שאר מסכי A5) - A5List לא מייבא אותו.
האייקונים `ban online building hash sortv store key` שאינם ב-sprite של הפלטה מוטמעים אוטומטית (`useA5Sprite`, פעם אחת במסמך).

## `<A5List>` - props
| prop | סוג | הערה |
|---|---|---|
| `items` | `T[]` | מצב לקוח: כל הרשימה. מצב שרת: העמוד הנוכחי בלבד |
| `getId(it)` | fn | מזהה יציב (מחרוזת/מספר) |
| `texts` | `{placeholder, aiPlaceholder, countLabel, emptyText}` | "עובדים", "דגמים", "פריטים"... |
| `hay(it)` | fn -> string | טקסט החיפוש (מצב לקוח). `localSearch={false}` = ההורה כבר סינן (חיפוש בשרת) - רק הדגשה |
| `filters` | `[{key,label,icon,def:[],options:[{k,l,i,test(it),count?}]}]` | קבוצות בחלון "סינון" האחד. OR בתוך קבוצה, AND בין קבוצות. אפשרות עם ספירה 0 מוסתרת אלא אם נבחרה. מצב שרת: `count` מהשרת במקום `test` |
| `sorts` | `[{k,l,i,get(it)}]` | חלון המיון. לחיצה על אפשרות נבחרת הופכת כיוון |
| `defaultSort` | `{k,dir}` | |
| `defaultView` | `'list'\|'table'` | |
| `rowMain(it,ctx)` | ReactNode | תוכן ה-`.li` לפני החץ: `<div className="ic-b sq">..</div><div className="t"><b>{ctx.hl(name)}</b><span className="ln mi">...</span></div>` + אופציונלי `<span className="mk">`. החץ (`.go`) מתווסף ע"י הרכיב |
| `rowClass(it)` | string | `off`, `gone`... |
| `detail(it,ctx)` | ReactNode | תוכן `.hdet-in`: שורות `hv-r` + שורת `hv-r hv-act` עם `hv-btns`. כפתורים בתוכו לא פותחים את השורה |
| `columns` | `[{k?,t,cell(it,ctx),tdClass?(it)}]` | הטבלה. `k` = מפתח מיון (חייב להיות גם ב-`sorts`). בלי columns אין מתג שורות/טבלה |
| `onOpen(it)` | fn | לחיצה על השורה / Enter. בלעדיו - השורה נפתחת/נסגרת |
| `searchSlot` | id של משבצת (`<A5SearchSlot id=..>`) או אלמנט | שדה החיפוש מצויר שם (פורטל); בלי - בראש הרשימה |
| `ai` | `{onSubmit(text), onReset?, loading?}` | מציג לחצן חיפוש חכם; Enter במצב AI קורא onSubmit; במצב AI אין סינון מקומי |
| `onStats(e)` | fn | מציג לחצן "שאלות סטטיסטיקה" |
| `exportSpec` | `{what:'רשימת העובדים', onExcel?, onDownload?, onPrint?, onExport?, kinds?}` | שלישיית xlg/xld/xlp. **Hooks לתצוגה המקדימה של הדפסה / PDF**: `onExcel(rows, state, info)` / `onDownload(rows, state, info)` / `onPrint(rows, state, info)`; בלי hook ייעודי נקרא `onExport(kind, rows, state, info)`. `rows` = כל הרשימה אחרי חיפוש + סינון + מיון (מצב שרת: העמוד הנוכחי); `state` = `{q, ai, sel, sort, view, page, total}`; `info` = `{kind, filterText /* "מחלקה: מכירות · סטטוס: פעילים · חיפוש: שרה" */, query, total, sort:{key,label,dir}, view}` |
| `total`, `page`, `onPage`, `pageSize=50` | | **מצב שרת**: כשמעבירים `total` הרכיב לא מסנן/ממיין/מעמד - רק מצייר `items` ואת הקפסולה. `onPage(p)` מבקש עמוד |
| `onStateChange(state)` | fn | `{q, ai, sel, sort, view, page, total}` בכל שינוי (לטעינה מחדש בשרת) |
| `onQueryChange(q)` | fn | בכל שינוי טקסט החיפוש (להורה שמדבאונס חיפוש שרת) |
| `loading`, `error`, `onRetry` | | מצבי טעינה/שגיאה בגוף הרשימה |
| `barExtra`, `emptyExtra` | ReactNode | תוספת בסרגל התוצאות (אחרי המיון) / במצב ריק |
| `notices` | `[{kind,text}]` | הודעות חיפוש מהשרת (מקלדת אנגלית וכו') - מעל סרגל התוצאות, כמו בדף הבית |
| `ref` | `{getState(), reset(), setPage(p), clearQuery()}` | |

`ctx` (לשורות ולתאים): `{ hl(text) /* מדגיש מילות חיפוש */, words, open }`.

### מצב שרת - איך משתמשים
```jsx
<A5List items={rows} total={data.total} page={page} onPage={setPage} loading={busy}
  filters={...options עם count} sorts={...} onStateChange={(s) => load(s)} localSearch={false} .../>
```
ההורה מחליט מה לשלוח לשרת מתוך `state.sel / state.sort / state.q`. כשהסינון/מיון/חיפוש משתנים הרכיב מבקש `onPage(1)`.

## חלקים עצמאיים
`ViewSwitch({value,onChange})`, `ExportTrio({what,onPick,kinds})`, `Pager({n,page,pages,pageSize,onPage})`, `A5SearchSlot({id})`, `HlText({text,words})`.

## A5Page / useA5 (שורש הדף, אם אין לכם שורש משלכם)
`<A5Page name="gm-emp">` = `.gm-ds.gm-a5.gm-emp.home-bg.dlg-dark` + sprite + טולטיפ + טוסט + אישור כהה. `const a5 = useA5(); a5.say(title, kind='info'|'ok'|'warn'|'error', text)`,
`await a5.confirm({title, sub, okLabel, icon:'trash'|'undo'|'check', cancelLabel='חזרה'})` -> boolean. `Dlg` / `ConfirmDlg` / `DlgBadge` = חלון כהה
(`.scrim.on > .dlg#dlg` עם עיגול עליון, מלכודת פוקוס, Escape). אין `window.confirm/alert/prompt` בשום מקום.

## ייצוא
`runListExport({kind, say, title, subtitle, head, rows, base})` - Excel (xlsx אמיתי) / PDF (שרת ה-PDF) / הדפסה (חלון עצמאי). ברירת מחדל זמנית;
דפי ההדפסה המעוצבים (`print-kit.js`) יחליפו אותה בשלב הבא דרך `exportSpec.onExport` - אין צורך לגעת ברכיב.

## לוגיקה טהורה (נבדקת ב-`scripts/test_a5_list_logic.mjs`)
`listLogic.js`: `wordsOf, matchesWords, initialSelection, passesGroup, computeVisible, optionCount, sortItems, pageCount, pageSlice, pageRange, pageList, splitHighlight, filterSummary, plural`.

## Decisions / gotchas of the kit
* **View switch**: the mock's markup is used (`aria-label` "תצוגת שורות"/"תצוגת טבלה", tooltips "שורות"/"טבלה"); `CcViewSwitch`/`OcViewSwitch` use "רשימה" - same classes (`vsw/vknob/vopt`), different words, so the mock's words win (design is the source of truth).
* **Scoping**: every kit selector is `.gm-ds :where(.a5l) X` (zero extra specificity over the palette's `.gm-ds X`), so the glue-vs-palette cascade is exactly the mock's. Page-level leak neutralisation (global `globals.css` / `design-overrides.css` fixes) is `a5-page.css` under `.gm-ds.gm-a5` (imported by `A5Page`); a page that has its own root must add the equivalent rules it needs (search input background, `.rtbl` header, `.hf-ib/.hf-cl` padding).
* **Palette icons missing from the sprite** (`ban online building hash sortv store key`) are injected once per document by `useA5Sprite()` (called by `A5List` and `A5Page`).
* **Search slot**: `<A5SearchSlot id>` renders `.a5l.a5l-slotwrap (display:contents) > .hf-bar.adm-bar > span.fslot#id`; `A5List searchSlot="id"` portals the field there. Without a slot the field sits at the top of the list.
* **Animations**: filter/sort/page/view changes remount the feed (key = sequence) and add `.animate`, which re-plays the palette `gm-rowin`; typing does not.
* **Sticky bar**: `.hres-bar` is `position:sticky; top: var(--snav-h)+10px`; the `stuck` class comes from a scroll listener (window + capture) with the mock's threshold (`top <= snav+11 && scrollY > 40`). In the dev browser pane the listener only fires when the pane is composited - verify with a dispatched `scroll` event if the pane is hidden.
* **Same-DPR verification recipe** (used for both lists): copy the built mock to `public/_mock/`, open it in a same-origin iframe next to the real page, inject `*{transition:none!important;animation:none!important}` into both, diff `getComputedStyle` + rects per state. Do NOT compare across tabs - the pane flips between DPR 1 and 1.25 and borders snap (1px vs 0.8px).
* Not in the kit (left to pages): AI result handling (`ai.onSubmit` only reports; the page decides what the results mean), print/PDF sheets (`exportSpec.onExport` / `EXPORT_HOOK`), server paging data loading.

## Export hooks for the print / PDF preview (stage 2)
`exportSpec.onPrint / onDownload / onExcel (rows, state, info)` receive exactly what is on screen (filtered + sorted rows, active filter text, sort, count). The pages already route through
`EXPORT_HOOK` (employees / models) -> `runListExport`; stage 2 replaces the hook body with the preview component, no kit change needed.

## What a new list screen (orders, customers, ...) needs
1. Page shell: `<A5Page name="gm-xxx">` (or your own `.gm-ds` root + `useA5Sprite()` + tooltip + toast + dark dialog), import `@/design-system/components.css`; `a5-list.css` comes with `A5List`, `a5-page.css` with `A5Page`.
2. Markup like the mock: `.app > .topbar` (+ `PageVariantToggle`), `<A5SearchSlot id>`, `.layout.one > .main > .panel > .card.hist > .card-h + <A5List searchSlot=id/>`.
3. A row adapter (pure, unit-testable): API row -> `{id, ...}` plus `hay` text, `filters[]` (options with `test`), `sorts[]`, `rowMain`, `detail`, `columns`; for orders/customers (server-paged, thousands of rows) use server mode: `total/page/onPage/onStateChange/localSearch={false}` and put `count` on each option.
4. Registry entry + `Switch` + frozen `Legacy*` copy + test lines (see `docs/page-variant-switch-2026-10-04.md`).
5. Icons missing from the sprite: add to `EXTRA` in `A5Icon.js`. Row-level markers (like `.conn/.pwd`) go in a page css scoped `.gm-ds :where(.a5l)`.

## Addition for the orders / customers lists (11.10.2026)
* `ref.setGroup(key, keys)` (tiny, backward compatible): sets the selection of one filter group from the page - used to un-select the "טווח מותאם" option when its date dialog is cancelled.
* Server-mode usage example with a shared hook: `app/components/admin-lists/useAdminServerList.js` (list + counts requests, debounced search, page reset on filter / sort change) and `RangeDialog.js` (dark dialog with the Hebrew range calendar).
  Options of a server-mode list carry `count`; use `''` while counts are still loading (the option stays visible without a number).
* `onFilterOpen(open)` (tiny, backward compatible, 11.10.2026): called when the "סינון" popup opens / closes. The orders / customers lists load their option counts only while it is open (cost control, see `orders-list-notes.md` > "Cost model and safeguards").

## Uniform page header + small additions (11.10.2026, email log / departments)
* **`A5ListPage`** (`app/components/a5-list/A5ListPage.js`, exported from the kit): the ONE page shell of every list screen - `.app > .topbar` (back arrow, `h1` with `<small>`, optional `tools` such as `PageVariantToggle`) + `A5SearchSlot` + optional `tabs` row + `.layout.one > .main > .panel > .card.hist` with the card header (gold icon, `h2`, optional action button) and the list as `children`. Props: `small` (default "ניהול"), `title`, `backId`, `backLabel`, `onBack`, `tools`, `slotId`, `cardIcon`, `cardTitle`, `cardAction`, `tabs`. Markup / classes are exactly what `orders-list` had hand-written, so measured positions are identical (1440: topbar 88 / 44.8, back 1266.8 / 88.4 44x44, h1 28px/600, small 18px at 1216.3 / 103.2, search 714.8 / 146.8 596x60, card top 270.8). New list screens must use it; the older pages (employees, models, orders, customers) can be switched to it without a visual change.
* `a5-page.css`: `.gm-ds.gm-a5 .card.hist>.card-h{min-height:68px}` - the card header keeps its height (68px) when a page has no action button, so the results bar sits at the same place on every page.
* `onOpen(it)` returning exactly `false` = "this row has no target": the row expands instead (tiny, backward compatible; handlers that return nothing behave as before). Used by the email log (rows without an order / customer).

* `texts.countSuffix` (tiny, backward compatible, 11.10.2026): text after the number in the results bar - the history lists show "+" when the total is capped (`COUNT_CAP` = 100,000 in `lib/adminLogList.js`).
* `useAdminServerList({ initialSel })` (tiny, backward compatible): the initial filter selection used for the first request - needed when a group has a default (`def`), e.g. the visit log opens on "API queries" like the old page. The hook also returns `data.totalCapped` from the server's `totalCapped` flag.
* **All list pages now use `A5ListPage`** (employees, models, orders, customers, email log, departments; the history lists too): measured before / after with zero coordinate changes (tables in each `*-fidelity.md`). `tabs` are passed as `<A5Tabs items=[...] />` (rendered inside `.main` before the card, with `tabpanel` setting `role="tabpanel"` on the panel). Rule for the `<small>` label: always the default "ניהול" (not overridable by convention). Static gate `scripts/test_a5_list_header.mjs` fails if a list page hand-writes `.topbar` / `.card-h` / search slot / tabs or passes its own `small=`.
