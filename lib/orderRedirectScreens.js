// Screens a user can be sent to after finishing (saving) an order - see
// order_new_redirect_screen / order_edit_redirect_screen in SystemSetting
// (app/orders/new/page.js on create, app/orders/[id]/page.js's handleExit on edit).
// Single source of truth for both the admin settings dropdown (lib/settingsMetadata.js)
// and the actual redirect logic, so the two never drift apart.
export const ORDER_REDIRECT_SCREENS = [
  { value: 'order', label: 'כרטיס ההזמנה' },
  { value: 'new_order', label: 'הזמנה חדשה' },
  { value: 'orders_list', label: 'רשימת הזמנות' },
  { value: 'customer', label: 'כרטיס הלקוח' },
  { value: 'rentals', label: 'השכרות' },
  { value: 'dashboard', label: 'דף הבית' },
];

// ctx: { orderId, customerId } - only what's known at the moment of redirect.
export function resolveOrderRedirectHref(screenValue, ctx = {}) {
  const { orderId, customerId } = ctx;
  switch (screenValue) {
    case 'new_order': return '/orders/new';
    case 'orders_list': return '/orders';
    case 'customer': return customerId ? `/customers/${customerId}` : '/orders';
    case 'rentals': return '/rentals';
    case 'dashboard': return '/';
    case 'order':
    default:
      return orderId ? `/orders/${orderId}` : '/orders';
  }
}
