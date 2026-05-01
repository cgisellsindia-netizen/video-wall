export const normalizeOrderStatus = (status) => String(status || '').toLowerCase();

export const normalizePaymentStatus = (paymentStatus) => String(paymentStatus || '').toLowerCase();

export const isPaymentPendingOrder = (order) => {
  const status = normalizeOrderStatus(order?.status);
  const paymentStatus = normalizePaymentStatus(order?.payment_status);
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

  if (status === 'payment_pending' || (!!normalizedPaymentStatus && normalizedPaymentStatus !== 'paid')) {
    return 'payment pending';
  }

  return String(status || 'pending').replaceAll('_', ' ');
};
