import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, HardHat, MapPin, Phone, RefreshCcw, Wrench } from 'lucide-react';
import { API_URL } from '../api';

function InstallerPage({ user, authReady = true, onLogin }) {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/installer/orders`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage('Could not load installation jobs.');
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      onLogin();
      return;
    }
    if (!['installer', 'admin'].includes(user.role)) {
      navigate('/');
      return;
    }
    fetchOrders();
    const refresher = setInterval(fetchOrders, 7000);
    return () => clearInterval(refresher);
  }, [user, authReady, navigate]);

  if (!authReady) {
    return <div className="delivery-auth-lock">Checking installer login...</div>;
  }

  if (!user) {
    return (
      <main className="delivery-auth-lock">
        <HardHat size={42} />
        <h1>Installer login required</h1>
        <p>Please login with the installer ID and password provided by admin.</p>
        <button className="btn btn-primary" onClick={onLogin}>Login as installer</button>
      </main>
    );
  }

  if (!['installer', 'admin'].includes(user.role)) {
    return (
      <main className="delivery-auth-lock">
        <HardHat size={42} />
        <h1>Installer access only</h1>
        <p>This panel is only for installers. Please logout and use an installer login.</p>
      </main>
    );
  }

  const updateStatus = async (orderId, installationStatus) => {
    try {
      const res = await fetch(`${API_URL}/installer/orders/${orderId}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ installation_status: installationStatus })
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Installation job #${orderId} marked ${installationStatus.replaceAll('_', ' ')}.` : (data.error || 'Status update failed.'));
      if (res.ok) fetchOrders();
    } catch (e) {
      setMessage('Could not update installation status.');
    }
  };

  const statusRank = (status) => {
    const order = ['requested', 'assigned', 'in_progress', 'completed'];
    return Math.max(0, order.indexOf(status || 'requested'));
  };

  const canClickStatus = (currentStatus, targetStatus) => statusRank(targetStatus) === statusRank(currentStatus) + 1;
  const isStatusDone = (currentStatus, targetStatus) => statusRank(currentStatus) >= statusRank(targetStatus);

  return (
    <main className="delivery-partner-page">
      <section className="delivery-hero">
        <div>
          <span className="eyebrow">Camigo installer app</span>
          <h1>Manage CCTV setup jobs and completion updates</h1>
          <p>See requested installations, call the customer, and mark each installation stage from assignment to completion.</p>
        </div>
        <div className="partner-live-actions">
          <button className="online-pill active">
            <HardHat size={18} /> Installer mode
          </button>
          <button className="online-pill" onClick={fetchOrders}>Refresh jobs</button>
        </div>
      </section>

      {message && <div className="admin-message">{message}</div>}

      <section className="partner-status-grid">
        <div className="partner-status-card">
          <ClipboardList size={24} />
          <strong>{orders.length} active installation jobs</strong>
          <span>Only orders where installation was selected appear here.</span>
        </div>
        <div className="partner-status-card">
          <Wrench size={24} />
          <strong>Rs 500 per camera service</strong>
          <span>Installation fee is auto-calculated only for camera products.</span>
        </div>
        <div className="partner-status-card">
          <CheckCircle2 size={24} />
          <strong>Phone update on completion</strong>
          <span>Customer gets an automatic notification when installation is completed.</span>
        </div>
      </section>

      <section className="delivery-orders">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Installation queue</span>
            <h2>Assigned and requested setup orders</h2>
          </div>
          <button className="btn btn-outline btn-sm" onClick={fetchOrders}><RefreshCcw size={15} /> Refresh</button>
        </div>

        {orders.length === 0 ? (
          <div className="card empty-orders">
            <HardHat size={54} />
            <h3>No installation jobs right now</h3>
            <p>New orders with installation selected will appear here automatically.</p>
          </div>
        ) : (
          <div className="delivery-order-grid">
            {orders.map(order => (
              <article className="delivery-order-card" key={order.id}>
                <div className="order-card-top">
                  <div>
                    <span className="order-id">Order #{order.id}</span>
                    <span className="order-date">Installation fee Rs {order.installation_fee || 0} · {order.camera_count || 0} camera(s)</span>
                  </div>
                  <span className="order-status">{String(order.installation_status || 'requested').replaceAll('_', ' ')}</span>
                </div>

                <div className="route-mini">
                  <div><MapPin size={17} /><span>Service address</span><strong>{order.address}</strong></div>
                  <div><Phone size={17} /><span>Customer</span><strong>{order.user_name} · {order.user_phone || 'No number'}</strong></div>
                </div>

                <div className="delivery-address">
                  <Wrench size={18} />
                  <div>
                    <strong>Installation scope</strong>
                    <p>{order.camera_count || 0} camera(s) selected for paid installation.</p>
                  </div>
                </div>

                <div className="delivery-contact-actions">
                  <button className="btn btn-outline" onClick={() => order.user_phone && (window.location.href = `tel:${order.user_phone}`)}>
                    <Phone size={16} /> Call customer
                  </button>
                  <button className="btn btn-outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || 'Bhubaneswar Odisha')}`, '_blank', 'noopener,noreferrer')}>
                    <MapPin size={16} /> Open map
                  </button>
                </div>

                <div className="delivery-status-actions">
                  <button className={isStatusDone(order.installation_status, 'assigned') ? 'done' : ''} disabled={!canClickStatus(order.installation_status || 'requested', 'assigned')} onClick={() => updateStatus(order.id, 'assigned')}>Assigned</button>
                  <button className={isStatusDone(order.installation_status, 'in_progress') ? 'done' : ''} disabled={!canClickStatus(order.installation_status || 'requested', 'in_progress')} onClick={() => updateStatus(order.id, 'in_progress')}>In progress</button>
                  <button className={isStatusDone(order.installation_status, 'completed') ? 'done' : ''} disabled={!canClickStatus(order.installation_status || 'requested', 'completed')} onClick={() => updateStatus(order.id, 'completed')}>Completed</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default InstallerPage;
