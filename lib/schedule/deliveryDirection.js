// The delivery-direction rule of the schedule, pure (no imports) so print page modules can share it without
// pulling lib/schedule/loaders.js (prisma) in. Order.deliveryDirection: 'הלוך' | 'חזור' | 'הלוך-חזור' | null;
// null on a delivery order = 'הלוך-חזור' (the legacy default) - so it is both an outbound and a return delivery.
// lib/schedule/loaders.js re-exports these; PP-15 (and the other print pages' inline checks) follow the same rule.
export const isDeliveryOut = (order) => !!(order && order.isDelivery) && (order.deliveryDirection || 'הלוך-חזור') !== 'חזור';
export const isDeliveryReturn = (order) => !!(order && order.isDelivery) && (order.deliveryDirection || 'הלוך-חזור') !== 'הלוך';
