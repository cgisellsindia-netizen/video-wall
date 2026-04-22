import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function OrdersPage({ user, onLogin }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { onLogin(); return; }
    fetchOrders();
  }, [user]);

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
      case 'pending': return '#fc8019';
      case 'cancelled': return '#e74c3c';
      default: return '#93959f';
    }
  };

  const getProgress = (status) => {
    switch (status) {
      case 'delivered': return 100;
      case 'out_for_delivery': return 72;
      case 'picked_up': return 62;
      case 'arrived_at_store': return 38;
      case 'accepted': return 32;
      case 'packed': return 45;
      case 'pending': return 18;
      default: return 12;
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="container orders-page">
      <h2 className="section-title" style={{ marginBottom: '24px' }}>My Orders</h2>

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
              <div className="order-card-top">
                <div>
                  <span className="order-id">Order #{order.id}</span>
                  <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <span className="order-status" style={{ background: getStatusColor(order.status) + '20', color: getStatusColor(order.status) }}>
                  {String(order.status || 'pending').toUpperCase()}
                </span>
              </div>
              <div className="order-card-bottom">
                <span>{String(order.payment_method || 'payment').toUpperCase()}</span>
                <strong>Rs {order.final_amount}</strong>
                <button className="btn btn-sm btn-primary" onClick={() => navigate(`/tracking/${order.id}`)}>
                  <MapPin size={15} /> Track
                </button>
              </div>
              <div className="order-progress">
                <div className="order-progress-head">
                  <span><Truck size={15} /> Live delivery status</span>
                  <span>{String(order.status || 'pending').replaceAll('_', ' ')}</span>
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
              <p className="order-address-line"><MapPin size={14} /> {order.address}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
