export const normalizeOrderStatus = (status) => String(status || '').toLowerCase();

export const normalizePaymentStatus = (paymentStatus) => String(paymentStatus || '').toLowerCase();
export const isCodOrder = (order) => String(order?.payment_method || '').toLowerCase() === 'cod';

export const isPaymentPendingOrder = (order) => {
  const status = normalizeOrderStatus(order?.status);
  const paymentStatus = normalizePaymentStatus(order?.payment_status);
  if (isCodOrder(order)) return status === 'payment_pending';
  return status === 'payment_pending' || (!!paymentStatus && paymentStatus !== 'paid');
};

export const isTrackableOrder = (order) => {
  const status = normalizeOrderStatus(order?.status);
  if (!order?.id) return false;
  if (isPaymentPendingOrder(order)) return false;
  return !['delivered', 'cancelled', 'rejected'].includes(status);
};

export const formatOrderStatusLabel = (orderOrStatus, paymentStatus) => {
  const status = typeof orderOrStatus === 'object'
    ? normalizeOrderStatus(orderOrStatus?.status)
    : normalizeOrderStatus(orderOrStatus);
  const normalizedPaymentStatus = typeof orderOrStatus === 'object'
    ? normalizePaymentStatus(orderOrStatus?.payment_status)
    : normalizePaymentStatus(paymentStatus);
  const codOrder = typeof orderOrStatus === 'object' ? isCodOrder(orderOrStatus) : false;

  if (status === 'payment_pending' || (!codOrder && !!normalizedPaymentStatus && normalizedPaymentStatus !== 'paid')) {
    return 'payment pending';
  }

  return String(status || 'pending').replaceAll('_', ' ');
};
