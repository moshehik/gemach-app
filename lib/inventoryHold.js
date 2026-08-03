// An order item holds its physical unit in one of two ways:
//   'pending'   - a shopping cart hold, released back into the pool once
//                 `inventory_hold_minutes` (15 by default) elapse. See lib/inventory.js.
//   'confirmed' - a permanent hold, kept until the item is returned or removed.
//
// The order becomes permanent the moment money changed hands, or a manager signed the
// order off to leave with the payment collected later ("יציאה באישור מנהל") - the payment
// is tracked, but the dress is already committed to that customer.

export const MANAGER_APPROVAL_METHOD = 'יציאה באישור מנהל';

// Payments arrive as saved rows (`paymentMethod`) or as the client's draft objects
// (`method`), so both spellings are accepted.
export function isManagerApprovalPayment(payment) {
  return (payment?.paymentMethod || payment?.method) === MANAGER_APPROVAL_METHOD;
}

export function paymentsGrantPermanentHold(payments) {
  if (!Array.isArray(payments)) return false;
  return payments.some(p => {
    if (!p || p.isDeleted) return false;
    return (parseFloat(p.amount) || 0) > 0 || isManagerApprovalPayment(p);
  });
}

// Whether the dresses of an existing order are held for good. Pass the order with its
// `payments` and (optionally) its `items`.
export function orderHasPermanentHold(order) {
  if (!order) return false;
  // Orders carried over from the Access system were never carts.
  if (order.legacyId) return true;
  if (paymentsGrantPermanentHold(order.payments)) return true;
  // An order with nothing to pay is confirmed on creation, and other routes confirm on
  // payment; either way a dress added alongside items that are already held has to be held
  // the same way. A draft, whose items are all still pending, stays a cart.
  return Array.isArray(order.items)
    && order.items.some(i => i && !i.isDeleted && i.cartStatus === 'confirmed');
}
