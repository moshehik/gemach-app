import { DRAFT_ORDER_STATUS } from './orderReservation';

export function calculateOrderStatus(order, { draftsAsDeleted = false } = {}) {
  if (!order) return '';

  const validItems = order.items ? order.items.filter(item => !item.isDeleted) : [];

  if (order.isDeleted || (order.items && order.items.length > 0 && validItems.length === 0)) {
    return 'מחוק';
  }

  if (validItems.length > 0) {
    const allReturned = validItems.every(item => item.isReturned);
    const someReturned = validItems.some(item => item.isReturned);
    const allTaken = validItems.every(item => item.isTaken);
    const someTaken = validItems.some(item => item.isTaken);

    if (allReturned) {
      return 'הוחזר';
    } else if (someReturned) {
      return 'הוחזר חלקי';
    } else if (allTaken) {
      return 'הושכר';
    } else if (someTaken) {
      return 'הושכר חלקי';
    }
  }

  // An order the new-order screen autosaved and never finished. Nothing about its items or
  // dates tells it apart from a real order, so the derivation above showed an abandoned cart
  // as 'בקרוב'; only the stored status knows. Checked after the item states, so a dress that
  // did physically leave on this row still reports where it actually is.
  if (order.status === DRAFT_ORDER_STATUS) {
    // Callers can opt into folding these into 'מחוק' for display purposes (the
    // `draft_orders_show_as_deleted` SystemSetting) so an abandoned autosaved cart doesn't
    // surface to staff as its own confusing "טיוטה" limbo status - it's still a real DRAFT_ORDER_STATUS
    // row underneath (see lib/orderReservation.js), only how it's *shown* changes.
    return draftsAsDeleted ? 'מחוק' : DRAFT_ORDER_STATUS;
  }

  if (order.eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(order.eventDate);
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'עבר';
    }
  }

  return 'בקרוב';
}

// הערכים הם ביטויי var() של טוקני "אריג" (app/design-system.css) — לא hex
// קשיח — כך שצ'יפ הסטטוס עוקב אחרי הפלטה החיה ומצב כהה. הצרכנים (למשל
// RentalReturnModal) שמים אותם ב-inline style, ו-var() תקין שם. אין להחזיר
// כאן hex קשיח; משטחי הדפסה/מיילים לא משתמשים בפונקציה הזו בכוונה.
export function getStatusColor(status) {
  switch (status) {
    case 'הוחזר':
      return { bg: 'var(--success-tint)', text: 'var(--success)' };
    case 'הוחזר חלקי':
      return { bg: 'var(--success-tint)', text: 'var(--success)' };
    case 'הושכר':
      return { bg: 'var(--info-tint)', text: 'var(--info)' };
    case 'הושכר חלקי':
      return { bg: 'var(--info-tint)', text: 'var(--info)' };
    case 'בקרוב':
      return { bg: 'var(--warning-tint)', text: 'var(--warning)' };
    case 'עבר':
      return { bg: 'var(--danger-tint)', text: 'var(--danger)' };
    case 'מחוק':
      return { bg: 'var(--danger-tint)', text: 'var(--danger)' };
    case DRAFT_ORDER_STATUS:
      return { bg: 'var(--warning-tint)', text: 'var(--warning)' };
    default:
      return { bg: 'var(--surface-sunken)', text: 'var(--text-2)' };
  }
}

export function calculatePaymentStatus(totalRequired, totalPaid) {
  if (totalPaid > totalRequired && totalRequired > 0) return 'ממתין לזיכוי';
  if (totalPaid > 0 && totalRequired === 0) return 'ממתין לזיכוי';
  if (totalRequired > 0 && totalPaid >= totalRequired) return 'שולם';
  if (totalPaid > 0 && totalPaid < totalRequired) return 'שולם חלקי';
  return 'לא שולם';
}

export function getPaymentStatusColor(status) {
  switch (status) {
    case 'שולם':
      return { bg: 'var(--success-tint)', text: 'var(--success)' };
    case 'שולם חלקי':
      return { bg: 'var(--warning-tint)', text: 'var(--warning)' };
    case 'ממתין לזיכוי':
      return { bg: 'var(--info-tint)', text: 'var(--info)' };
    case 'לא שולם':
    default:
      return { bg: 'var(--danger-tint)', text: 'var(--danger)' };
  }
}
