import { DRAFT_ORDER_STATUS } from './orderReservation';

export function calculateOrderStatus(order) {
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
    return DRAFT_ORDER_STATUS;
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

export function getStatusColor(status) {
  switch (status) {
    case 'הוחזר':
      return { bg: '#e8f5e9', text: '#2e7d32' };
    case 'הוחזר חלקי':
      return { bg: '#dcfce7', text: '#166534' };
    case 'הושכר':
      return { bg: '#e3f2fd', text: '#1565c0' };
    case 'הושכר חלקי':
      return { bg: '#e0f2fe', text: '#0369a1' };
    case 'בקרוב':
      return { bg: '#fff3e0', text: '#ef6c00' };
    case 'עבר':
      return { bg: '#ffebee', text: '#c62828' };
    case 'מחוק':
      return { bg: '#fee2e2', text: '#991b1b' };
    case DRAFT_ORDER_STATUS:
      return { bg: '#ffedd5', text: '#c2410c' };
    default:
      return { bg: '#f5f5f5', text: '#333333' };
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
      return { bg: '#dcfce7', text: '#166534' };
    case 'שולם חלקי':
      return { bg: '#fef08a', text: '#854d0e' };
    case 'ממתין לזיכוי':
      return { bg: '#e0e7ff', text: '#3730a3' };
    case 'לא שולם':
    default:
      return { bg: '#fee2e2', text: '#991b1b' };
  }
}
