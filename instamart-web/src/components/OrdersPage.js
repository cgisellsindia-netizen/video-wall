import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react';
import { API_URL } from '../api';
import PhoneVerificationCard from './PhoneVerificationCard';
import { formatOrderStatusLabel, isPaymentPendingOrder } from '../orderTracking';

const formatWarrantyDate = (value) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const getWarrantyRemaining = (endAt) => {
  if (!endAt) return 'Warranty date not available';
  const now = new Date();
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return 'Warranty date not available';
  if (end <= now) return 'Warranty expired';

  let cursor = new Date(now);
  let years = end.getFullYear() - cursor.getFullYear();
  cursor.setFullYear(cursor.getFullYear() + years);
  if (cursor > end) {
    years -= 1;
    cursor = new Date(now);
    cursor.setFullYear(cursor.getFullYear() + years);
  }

  let months = (end.getFullYear() - cursor.getFullYear()) * 12 + (end.getMonth() - cursor.getMonth());
  cursor.setMonth(cursor.getMonth() + months);
  if (cursor > end) {
    months -= 1;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const days = Math.max(0, Math.floor((end - cursor) / (1000 * 60 * 60 * 24)));
  const parts = [];
  if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  return parts.join(' ');
};

const getCancelRemainingMs = (createdAt, status, nowMs) => {
  if (String(status || '').toLowerCase() === 'cancelled') return 0;
  const startedAt = new Date(createdAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, 60 * 1000 - (nowMs - startedAt));
};

function OrdersPage({ user, onLogin, onUserUpdate }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [busyOrderId, setBusyOrderId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { onLogin(); return; }
    fetchOrders();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'delivered': return '#1ba672';
      case 'payment_pending': return '#e74c3c';
      case 'pending': return '#fc8019';
      case 'cancelled': return '#e74c3c';
      default: return '#93959f';
    }
  };

  const getProgress = (status) => {
    switch (status) {
      case 'delivered': return 100;
      case 'payment_pending': return 0;
      case 'out_for_delivery': return 72;
      case 'picked_up': return 62;
      case 'arrived_at_store': return 38;
      case 'accepted': return 32;
      case 'packed': return 45;
      case 'pending': return 18;
      default: return 12;
    }
  };

  const cancelOrder = async (orderId) => {
    const token = localStorage.getItem('token');
    setBusyOrderId(orderId);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel order');
      try {
        const activeOrder = JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
        if (String(activeOrder?.id) === String(orderId)) localStorage.removeItem('camigo_active_order');
      } catch (e) {}
      setOrders(current => current.map(order => (
        order.id === orderId
          ? { ...order, status: 'cancelled', payment_status: data.payment_status }
          : order
      )));
    } catch (error) {
      alert(error.message);
    }
    setBusyOrderId(null);
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="container orders-page">
      <h2 className="section-title" style={{ marginBottom: '24px' }}>My Orders</h2>
      {user && !['admin', 'delivery_partner', 'installer'].includes(String(user?.role || '')) && (
        <PhoneVerificationCard user={user} onUserUpdate={onUserUpdate} />
      )}

      {orders.length === 0 ? (
        <div className="card empty-orders">
          <Package size={64} style={{ color: '#d4d5d9', marginBottom: '16px' }} />
          <h3>No orders yet</h3>
          <p>Place your first order to see tracking here.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Browse Products</button>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="card order-card">
              {(() => {
                const displayStatus = formatOrderStatusLabel(order);
                const paymentPending = isPaymentPendingOrder(order);
                const canOpenTracking = !paymentPending && !['cancelled', 'rejected'].includes(String(order.status || '').toLowerCase());
                const cancelRemainingMs = getCancelRemainingMs(order.created_at, order.status, clock);
                const canCancel = cancelRemainingMs > 0 && ['pending', 'payment_pending'].includes(String(order.status || '').toLowerCase());
                const secondsLeft = Math.ceil(cancelRemainingMs / 1000);
                return (
                  <>
              <div className="order-card-top">
                <div>
                  <span className="order-id">Order #{order.id}</span>
                  <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <span className="order-status" style={{ background: getStatusColor(String(order.status || '').toLowerCase()) + '20', color: getStatusColor(String(order.status || '').toLowerCase()) }}>
                  {displayStatus.toUpperCase()}
                </span>
              </div>
              <div className="order-card-bottom">
                <span>{String(order.payment_method || 'payment').toUpperCase()}</span>
                <strong>Rs {order.final_amount}</strong>
                {canOpenTracking ? (
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/tracking/${order.id}`)}>
                    <MapPin size={15} /> Track
                  </button>
                ) : (
                  <span className="order-track-pill">{paymentPending ? 'Payment incomplete' : 'Tracking unavailable'}</span>
                )}
              </div>
              {canCancel && (
                <div className="order-cancel-strip">
                  <span>Cancel available for {secondsLeft}s</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => cancelOrder(order.id)} disabled={busyOrderId === order.id}>
                    {busyOrderId === order.id ? 'Cancelling...' : 'Cancel order'}
                  </button>
                </div>
              )}
              <div className="order-progress">
                <div className="order-progress-head">
                  <span><Truck size={15} /> {paymentPending ? 'Payment status' : 'Live delivery status'}</span>
                  <span>{displayStatus}</span>
                </div>
                <div className="order-progress-track">
                  <span style={{ width: `${getProgress(order.status)}%` }} />
                </div>
                <div className="order-progress-foot">
                  <span><CheckCircle2 size={14} /> Confirmed</span>
                  <span>Packed</span>
                  <span>On road</span>
                  <span>Delivered</span>
                </div>
              </div>
              {paymentPending && (
                <div className="order-cancel-strip">
                  <span>Online payment was not completed, so delivery tracking has not started for this order.</span>
                </div>
              )}
              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="order-warranty-list">
                  <div className="order-warranty-title">Product warranty</div>
                  {order.items.map(item => (
                    <div key={item.id} className="order-warranty-item">
                      <div className="order-warranty-product">
                        {item.image && <img src={item.image} alt={item.name} />}
                        <div>
                          <strong>{item.name}</strong>
                          <span>Qty {item.quantity} • {item.warranty_years || 5} year warranty</span>
                        </div>
                      </div>
                      <div className="order-warranty-time">
                        <strong>{getWarrantyRemaining(item.warranty_end_at)} left</strong>
                        <span>Start: {formatWarrantyDate(item.warranty_start_at)}</span>
                        <span>Expires: {formatWarrantyDate(item.warranty_end_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="order-address-line"><MapPin size={14} /> {order.address}</p>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
