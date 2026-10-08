# A5 order card - make item size/alteration edits a pending change (plan, NOT built)

Owner request 2026-10-07 (testing the A5 card as programmer): in the design demo every change - including changing an item's size - appeared in the left rail with שמור / ביטול. In the real card a size edit is saved immediately and never shows in the rail. Signing the regulations was fixed (see CHANGELOG 2026-10-07); this item was deliberately left for a dedicated task.

## Today
`OcItemEditDialog` "שמור" -> `useItemActions.confirmItem` -> `confirmItemNow`:
1. `env.ensureSaved` ("save pending changes first?") - because step 3 overwrites unsaved local state;
2. validation (model+size present, repair details);
3. `PUT /api/orders/<orderId>/items/<itemId>` (server: 15-minute full-edit window, size-swap rules `size_edit_until_days_before_event` / `gap_size_price_rule`, inventory, price recalculation) -> `env.applyServerOrder`.

The general order save (`PUT /api/orders/<id>`, `app/api/orders/[id]/route.js` ~L775-815) DOES write `item.sizeText` / neck / sleeve / length / alterationDetails for existing items, but WITHOUT those rules. So "edit locally and let the normal save send it" would bypass the edit window, the swap-price rule and the inventory check.

## Proposed design
- Dialog "שמור" on an existing item only applies the draft to the local item (new `env.edit.updateLocalItem`), so `changesOf` shows `item:mod` / `item:alt` and the rail can undo it (`revertChange` already restores the item from the snapshot).
- Do NOT keep a separate "staged edits" state (drafts in localStorage, undo/redo and discard would all have to know about it). Derive at save time: existing items whose size/model/alteration fields differ from the snapshot.
- In `saveCore`: strip those fields from the main PUT body (send the snapshot values for them), run the main PUT, then for each derived edit call the existing item PUT (`confirmItemNow` without `ensureSaved`) and sync with `applyServerOrder`. A failed item PUT leaves that edit pending with an error toast; everything else is already saved.
- Debt/approval gates in `saveCore` (`currentDebt`, preview obligations, `debtApproved` coverage) must include the price effect of the pending item edit, otherwise the item PUT can create debt after the approval step. Check what `pricingInputsChanged` + the preview already cover for a local size change.
- Exit mode (`post:false`), `applySaved`, the summary-confirm dialog and `cancelledItemNow` / `pendingAddNow` approvals all run in this same function - each needs a test.
- Item edits made while locked / outside the window must keep failing with the server's message (now at save time, not in the dialog) - decide whether the dialog should pre-validate with `rules.canFullyEdit` / `rules.sizeSwap` (it already does for the size buttons).

## Needs before shipping
Browser verification against the TEST DB (swap within category, swap that changes price, swap with no inventory, edit after the 15-minute window with and without manager reopen, cancel from the rail, exit with a pending edit, draft restore) - the fake-harness tests in `scripts/order-card-tests` cannot prove the money paths.

## Other actions that stay immediate (by nature)
rent / return / cancel-rent / return-condition (`/api/rentals/toggle`), card charge + refund execution, adding a dress (POST item).
