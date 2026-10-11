# Models list (`/dashboard/dresses`) - decisions, data sources, gotchas

Files: `app/components/models-list/{ModelsListA5,ModelsListSwitch,modelsLogic}.js`, `app/dashboard/dresses/LegacyDressesListPage.js` (frozen = `page.js` of main 51eae39f, byte-identical, test-pinned),
new thin `app/dashboard/dresses/page.js`, `app/api/dresses/route.js` (backward-compatible `counts=1`), shared kit `app/components/a5-list/`.

## Variant
`models_list` screen (`/dashboard/dresses`): programmer = new, everyone else old until `ui_variant_models_list='a5'` (no settings touched). `model_card` (`/dashboard/dresses/:id`, excludes `/new`) and `model_new` are registered with `newExists:false`;
the model-card agent flips `model_card` when the card is connected (the tests derive the expected lists from the registry, so nothing else needs editing).

## Data and the paging decision (deviation from the brief, deliberate)
* Brief: "server paging 50/page via the existing API". Reality: the mock's grouped filter shows a COUNT per option over the whole set and hides zero-count options, and sorts by derived columns (לא בשימוש / רזרבה / בתיקון / השכרות) - none of this exists in `/api/dresses` (it can filter one status and order by name / prefix / entry date / item count only). The catalog is small (~120 models; `limit` cap of the summary mode is 500).
  So the page loads the whole catalog (`filterStatus=all`, `limit=500`, extra pages if ever needed, `fetchSharedJson` so `apiCache` invalidates it after any dress mutation) and the kit pages it 50-per-page client-side. Free-text search stays on the SERVER (`search=` -> `lib/listSearch.js`: model-prefix numbers, exact sizes, English-keyboard rescue + `notices`), debounced 400ms like the old page; the client then filters/sorts/counts that result.
  The kit still supports server paging (`total/page/onPage/onStateChange`) for lists that need it.
* `GET /api/dresses?fields=summary&counts=1` (new, additive; without `counts=1` the response is byte-for-byte what it was): per model `notInUseCount, repairCount, reserveCount (location contains רזרבה/reserve), deletedItemsCount, rentalsCount (sum of per-item orderItems `_count`, same definition as the full shape), sizeCounts [[size,count]], updatedAt`. The extra `_count` subquery is only paid when `counts=1` is asked (the CPU-phase-1B optimisation for the plain summary is untouched). Measured: 123 models, ~95KB.
* Status semantics are exactly the server's `filterStatus`: deleted = `isDeleted`; inactive = not deleted and (`exitDateFromRepo` set or no item that is neither not-in-use nor deleted = `activeItemsCount === 0`); otherwise active.
* "קטגוריה" = `priceCategory` (free text: "כללי", "תיקונים", "תחתיות", ...); options come from the data.

## Behaviour kept from the old page
Free-text search, status filter (default פעילים, now one filter group with לא פעילים / מחוקים), sort, "דגם חדש" (head management / programmer), card link, delete + restore (head management / programmer - `/api/me` roleId 0 or 2, same as before; the API enforces it again), "החזר לפעילות" for everyone (`PUT exitDateFromRepo:null`). Confirmations are the dark site dialogs; messages are toasts (the old page used `window.customConfirm` + `alert`).

## Gotchas
* AI search (new for this list): `/api/ai/smart-search` with context `dresses` returns DressItem rows; the list keeps only the models those items belong to (`dressModelId`), up to 10 result pages.
* `EXPORT_HOOK` in `ModelsListA5.js` = stage-2 hook for the designed "קטלוג דגמים" print / PDF sheets (`printList` in the mock). Until then `runListExport` (xlsx / PDF / print window) with the mock's 12 columns.
* Images: the old table had a thumbnail column (`hide_dress_images` setting); the approved design shows an icon box instead. The setting is no longer read by this page (still used elsewhere).
* Old page's `advancedFilters` panel (name / size / serial / minimum rentals / not-in-use / in-repair / item-deleted) is replaced by the grouped filter (מלאי / השכרות) and the server search (size / serial / prefix); "שם דגם / קידומת" and "מידה" are covered by the search box, "השכרות מינימום" by the three thresholds (10 / 30 / 60) - the threshold list is the design's.
