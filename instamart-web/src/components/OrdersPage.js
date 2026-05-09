import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Headphones, MapPin, Package, ShieldCheck, Truck } from 'lucide-react';
import { API_URL } from '../api';
import PhoneVerificationCard from './PhoneVerificationCard';
import ProductImage from './ProductImage';
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
  const [reorderBusyId, setReorderBusyId] = useState(null);
  const [warrantyRegistrations, setWarrantyRegistrations] = useState([]);
  const [serviceTickets, setServiceTickets] = useState([]);
  const [warrantyDrafts, setWarrantyDrafts] = useState({});
  const [ticketDrafts, setTicketDrafts] = useState({});
  const [warrantyBusy, setWarrantyBusy] = useState({});
  const [ticketBusy, setTicketBusy] = useState({});
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    address: '',
    pincode: ''
  });
  const [addressBusy, setAddressBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      onLogin();
      return;
    }
    fetchOrders();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileAddress(user?.address || '');
  }, [user?.name, user?.address]);

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    try {
      const [ordersRes, warrantyRes, ticketsRes, addressesRes] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/account/warranty-registrations`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/account/service-tickets`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/account/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [ordersData, warrantyData, ticketsData, addressesData] = await Promise.all([
        ordersRes.json().catch(() => []),
        warrantyRes.json().catch(() => []),
        ticketsRes.json().catch(() => []),
        addressesRes.json().catch(() => [])
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setWarrantyRegistrations(Array.isArray(warrantyData) ? warrantyData : []);
      setServiceTickets(Array.isArray(ticketsData) ? ticketsData : []);
      setSavedAddresses(Array.isArray(addressesData) ? addressesData : []);
    } catch (e) {}
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
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

  const getRegistrationForItem = (itemId) => warrantyRegistrations.find((entry) => Number(entry.order_item_id) === Number(itemId));
  const getTicketsForItem = (itemId) => serviceTickets.filter((entry) => Number(entry.order_item_id) === Number(itemId));

  const updateWarrantyDraft = (itemId, field, value) => {
    setWarrantyDrafts((current) => ({
      ...current,
      [itemId]: {
        serial_number: '',
        installer_name: '',
        purchase_use_case: '',
        notes: '',
        ...(current[itemId] || {}),
        [field]: value
      }
    }));
  };

  const updateTicketDraft = (itemId, field, value) => {
    setTicketDrafts((current) => ({
      ...current,
      [itemId]: {
        ticket_type: 'support',
        title: '',
        description: '',
        contact_phone: user?.phone || '',
        preferred_slot: '',
        priority: 'normal',
        ...(current[itemId] || {}),
        [field]: value
      }
    }));
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
      setOrders((current) => current.map((order) => (
        order.id === orderId
          ? { ...order, status: 'cancelled', payment_status: data.payment_status }
          : order
      )));
    } catch (error) {
      alert(error.message);
    }
    setBusyOrderId(null);
  };

  const reorderItems = async (order) => {
    const token = localStorage.getItem('token');
    if (!token || !Array.isArray(order.items) || !order.items.length) return;
    setReorderBusyId(order.id);
    try {
      for (const item of order.items) {
        await fetch(`${API_URL}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            product_id: item.product_id,
            quantity: Math.max(1, Number(item.quantity || 1))
          })
        });
      }
      navigate('/checkout');
    } catch (error) {
      alert('Could not reorder these items right now.');
    }
    setReorderBusyId(null);
  };

  const printInvoice = (order) => {
    const invoiceWindow = window.open('', '_blank', 'width=900,height=700');
    if (!invoiceWindow) return;
    const itemRows = (order.items || []).map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>Rs ${item.price}</td>
        <td>Rs ${Number(item.price || 0) * Number(item.quantity || 1)}</td>
      </tr>
    `).join('');
    const html = `<!doctype html>
      <html>
        <head>
          <title>Camigo Invoice #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #13223a; }
            h1,h2,h3,p { margin: 0 0 10px; }
            .meta { display:grid; gap:8px; margin-bottom:20px; }
            table { width:100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #dbe3ef; padding: 10px; text-align: left; }
            th { background: #f8fafc; }
            .totals { margin-top: 18px; display:grid; gap:8px; justify-content:end; }
          </style>
        </head>
        <body>
          <h1>Camigo Tax Invoice</h1>
          <div class="meta">
            <p><strong>Order:</strong> #${order.id}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Customer:</strong> ${user?.name || '-'}</p>
            <p><strong>Address:</strong> ${order.address || '-'}</p>
            <p><strong>Payment:</strong> ${String(order.payment_method || '').toUpperCase()}</p>
          </div>
          <table>
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div class="totals">
            <p><strong>Final amount:</strong> Rs ${order.final_amount}</p>
            <p><strong>Status:</strong> ${formatOrderStatusLabel(order)}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>`;
    invoiceWindow.document.open();
    invoiceWindow.document.write(html);
    invoiceWindow.document.close();
  };

  const submitWarranty = async (order, item) => {
    const token = localStorage.getItem('token');
    const draft = warrantyDrafts[item.id] || {};
    if (!String(draft.serial_number || '').trim()) {
      alert('Please enter the product serial number.');
      return;
    }
    setWarrantyBusy((current) => ({ ...current, [item.id]: true }));
    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/warranty-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_item_id: item.id,
          serial_number: draft.serial_number,
          installer_name: draft.installer_name,
          purchase_use_case: draft.purchase_use_case,
          notes: draft.notes
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Warranty registration failed.');
      setWarrantyRegistrations((current) => [data.registration, ...current]);
      setWarrantyDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], open: false } }));
    } catch (error) {
      alert(error.message);
    }
    setWarrantyBusy((current) => ({ ...current, [item.id]: false }));
  };

  const submitTicket = async (order, item) => {
    const token = localStorage.getItem('token');
    const draft = ticketDrafts[item.id] || {};
    if (!String(draft.title || '').trim() || !String(draft.description || '').trim()) {
      alert('Please enter a short title and issue description.');
      return;
    }
    setTicketBusy((current) => ({ ...current, [item.id]: true }));
    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/service-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_item_id: item.id,
          ticket_type: draft.ticket_type,
          title: draft.title,
          description: draft.description,
          contact_phone: draft.contact_phone,
          preferred_slot: draft.preferred_slot,
          priority: draft.priority
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Support ticket failed.');
      setServiceTickets((current) => [data.ticket, ...current]);
      setTicketDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], open: false } }));
    } catch (error) {
      alert(error.message);
    }
    setTicketBusy((current) => ({ ...current, [item.id]: false }));
  };

  const saveProfile = async () => {
    const token = localStorage.getItem('token');
    setProfileSaving(true);
    setProfileMessage('');
    try {
      const res = await fetch(`${API_URL}/account/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: profileName,
          address: profileAddress
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Profile could not be updated.');
      onUserUpdate?.(data.user);
      setProfileMessage('Profile updated.');
    } catch (error) {
      setProfileMessage(error.message);
    }
    setProfileSaving(false);
  };

  const addSavedAddress = async () => {
    const token = localStorage.getItem('token');
    if (!addressForm.address.trim()) {
      setProfileMessage('Enter an address before saving it.');
      return;
    }
    setAddressBusy(true);
    setProfileMessage('');
    try {
      const res = await fetch(`${API_URL}/account/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: addressForm.label,
          address: addressForm.address,
          pincode: addressForm.pincode,
          is_default: savedAddresses.length === 0
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Address could not be saved.');
      const created = data.address;
      setSavedAddresses((current) => created ? [created, ...current.filter((entry) => Number(entry.id) !== Number(created.id))] : current);
      if (created?.is_default) {
        setProfileAddress(created.address || '');
        onUserUpdate?.({ ...user, address: created.address || '' });
      }
      setAddressForm({ label: 'Home', address: '', pincode: '' });
      setProfileMessage('Address saved.');
    } catch (error) {
      setProfileMessage(error.message);
    }
    setAddressBusy(false);
  };

  const setDefaultAddress = async (entry) => {
    const token = localStorage.getItem('token');
    setAddressBusy(true);
    setProfileMessage('');
    try {
      const res = await fetch(`${API_URL}/account/addresses/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: entry.label,
          address: entry.address,
          pincode: entry.pincode,
          lat: entry.lat,
          lng: entry.lng,
          is_default: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Default address could not be updated.');
      setSavedAddresses((current) => current.map((item) => ({
        ...item,
        is_default: Number(item.id) === Number(entry.id) ? 1 : 0
      })));
      setProfileAddress(entry.address || '');
      onUserUpdate?.({ ...user, address: entry.address || '' });
      setProfileMessage('Default delivery address updated.');
    } catch (error) {
      setProfileMessage(error.message);
    }
    setAddressBusy(false);
  };

  const deleteAddress = async (entry) => {
    const token = localStorage.getItem('token');
    setAddressBusy(true);
    setProfileMessage('');
    try {
      const res = await fetch(`${API_URL}/account/addresses/${entry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Address could not be removed.');
      const nextAddresses = savedAddresses.filter((item) => Number(item.id) !== Number(entry.id));
      setSavedAddresses(nextAddresses);
      const nextDefault = nextAddresses.find((item) => Number(item.is_default) === 1) || nextAddresses[0];
      if (entry.is_default) {
        const nextAddressValue = nextDefault?.address || '';
        setProfileAddress(nextAddressValue);
        onUserUpdate?.({ ...user, address: nextAddressValue });
      }
      setProfileMessage('Address removed.');
    } catch (error) {
      setProfileMessage(error.message);
    }
    setAddressBusy(false);
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="container orders-page">
      <h2 className="section-title" style={{ marginBottom: '24px' }}>My Orders</h2>
      {user && !['admin', 'delivery_partner', 'installer'].includes(String(user?.role || '')) && (
        <PhoneVerificationCard user={user} onUserUpdate={onUserUpdate} />
      )}
      {user && !['admin', 'delivery_partner', 'installer'].includes(String(user?.role || '')) && (
        <section className="card account-hub-card">
          <div className="account-hub-head">
            <div>
              <span className="eyebrow">Account hub</span>
              <h3>Profile and saved delivery addresses</h3>
            </div>
            {profileMessage && <span className="account-hub-message">{profileMessage}</span>}
          </div>
          <div className="account-hub-grid">
            <div className="account-hub-panel">
              <h4>Profile details</h4>
              <div className="aftercare-form-grid account-form-grid">
                <input
                  placeholder="Your full name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
                <textarea
                  placeholder="Default delivery address"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
            <div className="account-hub-panel">
              <h4>Address book</h4>
              <div className="aftercare-form-grid account-form-grid">
                <select value={addressForm.label} onChange={(e) => setAddressForm((current) => ({ ...current, label: e.target.value }))}>
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Site">Site</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  placeholder="Pincode"
                  value={addressForm.pincode}
                  onChange={(e) => setAddressForm((current) => ({ ...current, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                />
                <textarea
                  placeholder="Save a delivery address for quick checkout"
                  value={addressForm.address}
                  onChange={(e) => setAddressForm((current) => ({ ...current, address: e.target.value }))}
                />
              </div>
              <button type="button" className="btn btn-outline" onClick={addSavedAddress} disabled={addressBusy}>
                {addressBusy ? 'Saving...' : 'Add address'}
              </button>
              <div className="account-address-list">
                {savedAddresses.length === 0 ? (
                  <div className="account-address-empty">No saved addresses yet. Add one here and it will show up in checkout.</div>
                ) : savedAddresses.map((entry) => (
                  <div key={entry.id} className={`account-address-item ${entry.is_default ? 'default' : ''}`}>
                    <div>
                      <strong>{entry.label || 'Saved address'} {entry.is_default ? '• Default' : ''}</strong>
                      <span>{entry.address}</span>
                      {entry.pincode && <small>Pincode {entry.pincode}</small>}
                    </div>
                    <div className="account-address-actions">
                      {!entry.is_default && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setDefaultAddress(entry)} disabled={addressBusy}>
                          Make default
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteAddress(entry)} disabled={addressBusy}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
          {orders.map((order) => (
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
                      <span className="order-status" style={{ background: `${getStatusColor(String(order.status || '').toLowerCase())}20`, color: getStatusColor(String(order.status || '').toLowerCase()) }}>
                        {displayStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="order-card-bottom">
                      <span>{String(order.payment_method || 'payment').toUpperCase()}</span>
                      <strong>Rs {order.final_amount}</strong>
                      <div className="order-card-actions">
                        {canOpenTracking ? (
                          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/tracking/${order.id}`)}>
                            <MapPin size={15} /> Track
                          </button>
                        ) : (
                          <span className="order-track-pill">{paymentPending ? 'Payment incomplete' : 'Tracking unavailable'}</span>
                        )}
                        {!isPaymentPendingOrder(order) && <button className="btn btn-sm btn-outline" onClick={() => printInvoice(order)}>Invoice</button>}
                        <button className="btn btn-sm btn-outline" onClick={() => reorderItems(order)} disabled={reorderBusyId === order.id}>
                          {reorderBusyId === order.id ? 'Reordering...' : 'Reorder'}
                        </button>
                      </div>
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
                        <div className="order-warranty-title">Product warranty and support</div>
                        {order.items.map((item) => {
                          const registration = getRegistrationForItem(item.id);
                          const tickets = getTicketsForItem(item.id);
                          const warrantyDraft = warrantyDrafts[item.id] || {};
                          const ticketDraft = ticketDrafts[item.id] || {
                            ticket_type: 'support',
                            priority: 'normal',
                            contact_phone: user?.phone || ''
                          };
                          return (
                            <div key={item.id} className="order-warranty-item order-aftercare-item">
                              <div className="order-warranty-product">
                                <ProductImage src={item.image} alt={item.name} fallbackContent="" />
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
                              <div className="aftercare-panel">
                                <div className="aftercare-status-row">
                                  <span className={`aftercare-chip ${registration ? 'ok' : ''}`}>
                                    <ShieldCheck size={14} />
                                    {registration ? `Warranty ${String(registration.status || 'registered').replaceAll('_', ' ')}` : 'Warranty not registered'}
                                  </span>
                                  <span className={`aftercare-chip ${tickets.length ? 'info' : ''}`}>
                                <Headphones size={14} />
                                    {tickets.length ? `${tickets.length} support ticket${tickets.length > 1 ? 's' : ''}` : 'No support ticket'}
                                  </span>
                                </div>

                                <div className="aftercare-action-row">
                                  {!registration && (
                                    <button type="button" className="btn btn-sm btn-outline" onClick={() => updateWarrantyDraft(item.id, 'open', !warrantyDraft.open)}>
                                      <BadgeCheck size={14} /> {warrantyDraft.open ? 'Close warranty form' : 'Register warranty'}
                                    </button>
                                  )}
                                  <button type="button" className="btn btn-sm btn-outline" onClick={() => updateTicketDraft(item.id, 'open', !ticketDraft.open)}>
                                <Headphones size={14} /> {ticketDraft.open ? 'Close support form' : 'Raise support ticket'}
                                  </button>
                                </div>

                                {!registration && warrantyDraft.open && (
                                  <div className="aftercare-form">
                                    <div className="aftercare-form-grid">
                                      <input placeholder="Product serial number" value={warrantyDraft.serial_number || ''} onChange={(e) => updateWarrantyDraft(item.id, 'serial_number', e.target.value)} />
                                      <input placeholder="Installer / dealer name" value={warrantyDraft.installer_name || ''} onChange={(e) => updateWarrantyDraft(item.id, 'installer_name', e.target.value)} />
                                      <input placeholder="Home / shop / office use" value={warrantyDraft.purchase_use_case || ''} onChange={(e) => updateWarrantyDraft(item.id, 'purchase_use_case', e.target.value)} />
                                      <input placeholder="Notes" value={warrantyDraft.notes || ''} onChange={(e) => updateWarrantyDraft(item.id, 'notes', e.target.value)} />
                                    </div>
                                    <button type="button" className="btn btn-sm btn-primary" onClick={() => submitWarranty(order, item)} disabled={warrantyBusy[item.id]}>
                                      {warrantyBusy[item.id] ? 'Registering...' : 'Save warranty'}
                                    </button>
                                  </div>
                                )}

                                {ticketDraft.open && (
                                  <div className="aftercare-form">
                                    <div className="aftercare-form-grid">
                                      <select value={ticketDraft.ticket_type || 'support'} onChange={(e) => updateTicketDraft(item.id, 'ticket_type', e.target.value)}>
                                        <option value="support">General support</option>
                                        <option value="refund">Refund / replace</option>
                                        <option value="installation">Installation issue</option>
                                        <option value="warranty">Warranty claim</option>
                                      </select>
                                      <select value={ticketDraft.priority || 'normal'} onChange={(e) => updateTicketDraft(item.id, 'priority', e.target.value)}>
                                        <option value="low">Low priority</option>
                                        <option value="normal">Normal priority</option>
                                        <option value="high">High priority</option>
                                      </select>
                                      <input placeholder="Short issue title" value={ticketDraft.title || ''} onChange={(e) => updateTicketDraft(item.id, 'title', e.target.value)} />
                                      <input placeholder="Contact phone" value={ticketDraft.contact_phone || ''} onChange={(e) => updateTicketDraft(item.id, 'contact_phone', e.target.value)} />
                                      <input placeholder="Preferred callback / visit slot" value={ticketDraft.preferred_slot || ''} onChange={(e) => updateTicketDraft(item.id, 'preferred_slot', e.target.value)} />
                                      <textarea placeholder="Describe the issue" value={ticketDraft.description || ''} onChange={(e) => updateTicketDraft(item.id, 'description', e.target.value)} />
                                    </div>
                                    <button type="button" className="btn btn-sm btn-primary" onClick={() => submitTicket(order, item)} disabled={ticketBusy[item.id]}>
                                      {ticketBusy[item.id] ? 'Submitting...' : 'Submit ticket'}
                                    </button>
                                  </div>
                                )}

                                {tickets.length > 0 && (
                                  <div className="aftercare-history">
                                    {tickets.slice(0, 2).map((ticket) => (
                                      <div key={ticket.id} className="aftercare-history-item">
                                        <strong>{ticket.title}</strong>
                                        <span>{String(ticket.ticket_type || 'support').replaceAll('_', ' ')} • {String(ticket.status || 'open').replaceAll('_', ' ')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
