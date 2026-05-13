import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CalendarClock, CheckCircle2, Headphones, MapPin, MessageCircle, Navigation, PackageCheck, Phone, RefreshCcw, Siren, Star, Truck, Wallet, XCircle } from 'lucide-react';
import RoadRouteMap from './RoadRouteMap';
import { API_URL } from '../api';
const HUB = { lat: 20.2961, lng: 85.8245 };

function DeliveryPartnerPage({ user, authReady = true, onLogin }) {
  const [orders, setOrders] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(false);
  const [live, setLive] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [otpByOrder, setOtpByOrder] = useState({});
  const [shiftBooked, setShiftBooked] = useState(false);
  const demoTimer = useRef(null);
  const watchId = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      onLogin();
      return;
    }
    if (!['delivery_partner', 'admin'].includes(user.role)) {
      navigate('/');
      return;
    }
    fetchOrders();
    fetchEarnings();
    if (localStorage.getItem('camigo_partner_online') === 'true') {
      setTimeout(() => startLive(true), 300);
    }
    const refresher = setInterval(() => {
      fetchOrders();
      fetchEarnings();
    }, 5000);

    return () => {
      clearInterval(refresher);
      if (watchId.current && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
      if (demoTimer.current) clearInterval(demoTimer.current);
    };
  }, [user, authReady]);

  if (!authReady) {
    return <div className="delivery-auth-lock">Checking delivery login...</div>;
  }

  if (!user) {
    return (
      <main className="delivery-auth-lock">
        <Truck size={42} />
        <h1>Delivery partner login required</h1>
        <p>Please login with the partner ID and password given by admin.</p>
        <button className="btn btn-primary" onClick={onLogin}>Login as delivery partner</button>
      </main>
    );
  }

  if (!['delivery_partner', 'admin'].includes(user.role)) {
    return (
      <main className="delivery-auth-lock">
        <Truck size={42} />
        <h1>Delivery access only</h1>
        <p>This panel is only for delivery partners. Please logout and use a delivery partner login.</p>
      </main>
    );
  }

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/delivery/orders`, { headers: authHeaders() });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage('Could not load delivery orders.');
    }
  };

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`${API_URL}/delivery/earnings`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setEarnings(data);
    } catch (e) {}
  };

  const postLocation = async (lat, lng, status = 'on_delivery') => {
    setLastLocation({ lat, lng, updatedAt: new Date().toLocaleTimeString() });
    try {
      await fetch(`${API_URL}/delivery/location`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ lat, lng, status })
      });
    } catch (e) {
      setMessage('Location saved locally, but backend update failed.');
    }
  };

  const startDemoTracking = () => {
    if (demoTimer.current) clearInterval(demoTimer.current);
    let step = 0;
    setMessage('Using demo movement because browser GPS is blocked or unavailable.');
    postLocation(HUB.lat, HUB.lng, 'on_delivery');
    demoTimer.current = setInterval(() => {
      step += 1;
      const lat = HUB.lat + Math.sin(step / 5) * 0.012 + step * 0.00025;
      const lng = HUB.lng + Math.cos(step / 6) * 0.012 + step * 0.00018;
      postLocation(lat, lng, 'on_delivery');
    }, 1000);
  };

  const startLive = (restored = false) => {
    if (live) return;
    setOnline(true);
    setLive(true);
    localStorage.setItem('camigo_partner_online', 'true');
    setMessage(restored ? 'You are back online. Live location sharing resumed.' : 'Live location sharing started. The customer map updates when this device GPS changes.');

    if (!navigator.geolocation) {
      startDemoTracking();
      return;
    }

    if (watchId.current && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      position => {
        postLocation(position.coords.latitude, position.coords.longitude, 'on_delivery');
        setMessage(`Live GPS sent at ${new Date().toLocaleTimeString()}. Accuracy ${Math.round(position.coords.accuracy || 0)}m.`);
      },
      () => startDemoTracking(),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );
  };

  const goOffline = () => {
    setOnline(false);
    setLive(false);
    localStorage.removeItem('camigo_partner_online');
    if (watchId.current && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    if (demoTimer.current) clearInterval(demoTimer.current);
    postLocation(lastLocation?.lat || HUB.lat, lastLocation?.lng || HUB.lng, 'offline');
    setMessage('You are offline. New route movement is paused.');
  };

  const updateStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${API_URL}/delivery/orders/${orderId}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Order #${orderId} marked ${status.replaceAll('_', ' ')}.` : (data.error || 'Status update failed.'));
      if (res.ok) {
        fetchOrders();
        fetchEarnings();
      }
    } catch (e) {
      setMessage('Could not update order status.');
    }
  };

  const verifyOtp = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/delivery/orders/${orderId}/verify-otp`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ otp: otpByOrder[orderId] || '' })
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? data.message : (data.error || 'OTP verification failed.'));
      if (res.ok) {
        setOtpByOrder({ ...otpByOrder, [orderId]: '' });
        fetchOrders();
        fetchEarnings();
      }
    } catch (e) {
      setMessage('Could not verify delivery OTP.');
    }
  };

  const openNavigation = (address) => {
    const query = encodeURIComponent(address || 'Bhubaneswar Odisha');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank', 'noopener,noreferrer');
  };

  const callCustomer = (phone) => {
    if (phone) window.location.href = `tel:${phone}`;
  };

  const statusRank = (status) => {
    const order = ['pending', 'accepted', 'arrived_at_store', 'picked_up', 'out_for_delivery', 'delivered'];
    return Math.max(0, order.indexOf(status || 'pending'));
  };

  const canClickStatus = (orderStatus, targetStatus) => {
    if (targetStatus === 'rejected') return statusRank(orderStatus) === 0;
    return statusRank(targetStatus) === statusRank(orderStatus) + 1;
  };

  const isStatusDone = (orderStatus, targetStatus) => statusRank(orderStatus) >= statusRank(targetStatus);

  const statusButtonClass = (orderStatus, targetStatus) => (
    isStatusDone(orderStatus, targetStatus) ? 'done' : ''
  );

  const routeDestinationFor = (status) => (
    ['pending', 'accepted', 'arrived_at_store', 'packed'].includes(status) ? 'hub' : 'customer'
  );

  const customerLocationFor = (order) => (
    order.customer_lat && order.customer_lng
      ? { lat: Number(order.customer_lat), lng: Number(order.customer_lng) }
      : null
  );

  return (
    <main className="delivery-partner-page">
      <section className="delivery-hero">
        <div>
          <span className="eyebrow">Instamart-style partner app</span>
          <h1>Accept, pickup, navigate, verify OTP</h1>
          <p>Go online, share live location, and move orders through pickup to delivery.</p>
        </div>
        <div className="partner-live-actions">
          <button className={online ? 'online-pill active' : 'online-pill'} onClick={startLive}>
            <Navigation size={18} /> {online ? 'Online' : 'Go online'}
          </button>
          <button className="online-pill" onClick={goOffline}>Offline</button>
        </div>
      </section>

      {message && <div className="admin-message">{message}</div>}

      <section className="partner-status-grid">
        <div className="partner-status-card">
          <Bike size={24} />
          <strong>{live ? 'Live GPS running' : 'Location paused'}</strong>
          <span>{lastLocation ? `${lastLocation.lat.toFixed(5)}, ${lastLocation.lng.toFixed(5)}` : 'Start sharing location before dispatch'}</span>
        </div>
        <div className="partner-status-card">
          <Wallet size={24} />
          <strong>Rs {earnings?.today_earnings || 0} today</strong>
          <span>{earnings?.today_orders || 0} orders today · Wallet Rs {earnings?.wallet_balance || 0}</span>
        </div>
        <div className="partner-status-card">
          <Star size={24} />
          <strong>{earnings?.rating || 4.8} rating</strong>
          <span>{earnings?.online_hours || 0} online hours · Incentive Rs {earnings?.incentive || 0}</span>
        </div>
      </section>

      <section className="partner-tools-grid">
        <div className="heatmap-card">
          <div>
            <span className="eyebrow">Busy area heatmap</span>
            <h3>Bhubaneswar demand zones</h3>
          </div>
          <div className="heatmap-visual">
            <span className="hotspot hot-one">Patia</span>
            <span className="hotspot hot-two">Saheed Nagar</span>
            <span className="hotspot hot-three">Khandagiri</span>
          </div>
        </div>
        <button className={shiftBooked ? 'shift-card booked' : 'shift-card'} onClick={() => setShiftBooked(true)}>
          <CalendarClock size={24} />
          <strong>{shiftBooked ? 'Today shift booked' : 'Book evening shift'}</strong>
          <span>6 PM - 10 PM · high demand slot</span>
        </button>
      </section>

      <section className="delivery-orders">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Order notifications</span>
            <h2>Pickup and delivery queue</h2>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { fetchOrders(); fetchEarnings(); }}><RefreshCcw size={15} /> Refresh</button>
        </div>

        {orders.length === 0 ? (
          <div className="card empty-orders">
            <Truck size={54} />
            <h3>No active deliveries</h3>
            <p>New customer orders will appear here with pickup, drop, earnings and distance.</p>
          </div>
        ) : (
          <div className="delivery-order-grid">
            {orders.map(order => (
              <article className="delivery-order-card" key={order.id}>
                <div className="order-card-top">
                  <div>
                    <span className="order-id">Order #{order.id}</span>
                    <span className="order-date">Earn Rs 45 · ~4.2 km</span>
                  </div>
                  <span className="order-status">{String(order.status || 'pending').replaceAll('_', ' ')}</span>
                </div>

                <div className="route-mini">
                  <div><PackageCheck size={17} /><span>Pickup</span><strong>Camigo CCTV Hub</strong></div>
                  <div><MapPin size={17} /><span>Drop</span><strong>{order.user_name} · {order.user_phone}</strong></div>
                </div>

                <div className="delivery-address">
                  <MapPin size={18} />
                  <div>
                    <strong>Customer address</strong>
                    <p>{order.address}</p>
                  </div>
                </div>

                <div className="delivery-order-foot">
                  <strong>Order value Rs {order.final_amount}</strong>
                  <button className="btn btn-sm btn-outline" onClick={() => openNavigation(order.address)}>Directions</button>
                </div>

                <div className="partner-card-map">
                  <RoadRouteMap
                    compact
                    partnerLocation={lastLocation}
                    customerLocation={customerLocationFor(order)}
                    destination={routeDestinationFor(order.status)}
                  />
                  <span>{routeDestinationFor(order.status) === 'hub' ? 'Route to Camigo hub' : 'Route to customer address'}</span>
                </div>

                <div className="delivery-status-actions notification-actions">
                  <button className={statusButtonClass(order.status, 'accepted')} disabled={!canClickStatus(order.status, 'accepted')} onClick={() => updateStatus(order.id, 'accepted')}><CheckCircle2 size={15} /> Accept</button>
                  <button disabled={!canClickStatus(order.status, 'rejected')} onClick={() => updateStatus(order.id, 'rejected')}><XCircle size={15} /> Reject</button>
                  <button onClick={() => navigate(`/tracking/${order.id}`)}><Navigation size={15} /> Map</button>
                </div>

                <div className="delivery-status-actions">
                  <button className={statusButtonClass(order.status, 'arrived_at_store')} disabled={!canClickStatus(order.status, 'arrived_at_store')} onClick={() => updateStatus(order.id, 'arrived_at_store')}><MapPin size={15} /> Arrived store</button>
                  <button className={statusButtonClass(order.status, 'picked_up')} disabled={!canClickStatus(order.status, 'picked_up')} onClick={() => updateStatus(order.id, 'picked_up')}><PackageCheck size={15} /> Pickup done</button>
                  <button className={statusButtonClass(order.status, 'out_for_delivery')} disabled={!canClickStatus(order.status, 'out_for_delivery')} onClick={() => updateStatus(order.id, 'out_for_delivery')}><Truck size={15} /> Out</button>
                </div>

                <div className="delivery-contact-actions">
                  <button onClick={() => callCustomer(order.user_phone)}><Phone size={15} /> Call</button>
                  <button onClick={() => setMessage(`Chat opened with ${order.user_name}. Demo chat is ready for real integration.`)}><MessageCircle size={15} /> Chat</button>
                  <button onClick={() => setMessage(`Issue reported for order #${order.id}. Admin support can review it.`)}><Siren size={15} /> Report issue</button>
                </div>

                <div className="otp-row">
                  <input
                    placeholder="Enter customer OTP"
                    value={otpByOrder[order.id] || ''}
                    onChange={e => setOtpByOrder({ ...otpByOrder, [order.id]: e.target.value })}
                  />
                  <button onClick={() => verifyOtp(order.id)}>Verify & deliver</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <a className="partner-support" href="/contact">
        <Headphones size={18} /> Support
      </a>
    </main>
  );
}

export default DeliveryPartnerPage;
