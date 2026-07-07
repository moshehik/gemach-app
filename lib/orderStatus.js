export function calculateOrderStatus(order) {
  if (!order) return '';

  const validItems = order.items ? order.items.filter(item => !item.isDeleted) : [];

  if (validItems.length > 0) {
    const allReturned = validItems.every(item => item.isReturned);
    const someReturned = validItems.some(item => item.isReturned);
    const allTaken = validItems.every(item => item.isTaken);
    const someTaken = validItems.some(item => item.isTaken);

    if (allReturned) {
      return 'הוחזר';
    } else if (allTaken && !someReturned) {
      return 'מושכר';
    } else if (someTaken || someReturned) {
      return 'חלקית';
    }
  }

  // Date-based logic if not rented/returned
  if (order.eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(order.eventDate);
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 4) {
      return 'בקרוב';
    } else if (diffDays < -10) {
      // Only archive if there are no items, or all items are returned
      const validItems = order.items ? order.items.filter(item => !item.isDeleted) : [];
      const allReturned = validItems.length > 0 && validItems.every(item => item.isReturned);
      
      if (validItems.length === 0 || allReturned) {
        return 'ארכיון';
      } else {
        return 'עבר'; // Past event but items not returned
      }
    } else if (diffDays < 0) {
      return 'עבר';
    }
  }

  return 'פתוח'; // Default
}

export function getStatusColor(status) {
  switch (status) {
    case 'הוחזר':
      return { bg: '#e8f5e9', text: '#2e7d32' }; // Green
    case 'מושכר':
      return { bg: '#e3f2fd', text: '#1565c0' }; // Blue
    case 'חלקית':
      return { bg: '#fff8e1', text: '#f57f17' }; // Yellow
    case 'בקרוב':
      return { bg: '#fff3e0', text: '#ef6c00' }; // Orange
    case 'עבר':
      return { bg: '#ffebee', text: '#c62828' }; // Red
    case 'ארכיון':
      return { bg: '#f5f5f5', text: '#757575' }; // Grey
    default:
      return { bg: '#f5f5f5', text: '#333333' }; // Default Grey
  }
}
