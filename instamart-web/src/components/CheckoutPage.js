import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Smartphone, Wallet } from 'lucide-react';
import { API_URL } from '../api';
import { captureCustomerLocation, getSavedCustomerLocation } from '../locationLock';

function CheckoutPage({ user, onLogin, onOrderPlaced }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem('cart_backup') || '[]');
      return Array.isArray(savedCart) ? savedCart : [];
    } catch (e) {
      localStorage.removeItem('cart_backup');
      return [];
    }
  });
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [coords, setCoords] = useState(() => {
    const saved = getSavedCustomerLocation();
    return saved?.lat && saved?.lng ? saved : null;
  });
  const [loading, setLoading] = useState(false);
  const [lockingLocation, setLockingLocation] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) onLogin();
  }, [user, onLogin]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_URL}/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setCartItems(data);
          localStorage.setItem('cart_backup', JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) return;
    if (coords?.locked) return;
    setLockingLocation(true);
    captureCustomerLocation({ lock: true, source: 'checkout-open', timeout: 12000, maximumAge: 0 })
      .then(location => { if (active && location) setCoords(location); })
      .finally(() => { if (active) setLockingLocation(false); });
    return () => { active = false; };
  }, []);

  const savedAddresses = useMemo(() => {
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem('camigo_saved_addresses') || '[]');
    } catch (e) {
      localStorage.removeItem('camigo_saved_addresses');
    }
    return [user?.address, ...recent]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .slice(0, 4);
  }, [user?.address]);

  if (!user) return null;

  const subtotal = cartItems.reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const addressText = String(address || '').toLowerCase();
  const localAddress = addressText.includes('bhubaneswar') || addressText.includes('bbsr') || addressText.includes('cuttack');
  const deliveryEstimate = localAddress ? 'Today / same-day' : '2-4 days';
  const deliveryFee = subtotal > 2000 ? 0 : localAddress ? 40 : 120;
  const gst = Math.round(subtotal * 0.18);
  const payable = subtotal + gst + deliveryFee;

  const validatePayment = () => {
    if (paymentMethod === 'upi' && !upiId.includes('@')) return 'Enter a valid UPI ID, for example name@upi.';
    if (paymentMethod === 'card' && cardNumber.replace(/\s/g, '').length < 12) return 'Enter a valid card number for demo payment.';
    return '';
  };

  const handlePlaceOrder = async () => {
    setError('');
    if (!address || !phone) { setError('Delivery address and phone are required.'); return; }
    if (!cartItems.length) { setError('Cart is empty.'); return; }
    const paymentError = validatePayment();
    if (paymentError) { setError(paymentError); return; }

    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      let customerCoords = coords;
      if (!customerCoords?.locked) {
        setLockingLocation(true);
        customerCoords = await captureCustomerLocation({ lock: true, source: 'checkout-place-order', timeout: 12000, maximumAge: 0 });
        if (customerCoords) setCoords(customerCoords);
        setLockingLocation(false);
      }
      if (!customerCoords) { setError('Please allow location permission to lock your delivery point before checkout.'); setLoading(false); return; }
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cartItems.map(i => ({ product_id: i.product_id || i.id, quantity: i.quantity })),
          address,
          payment_method: paymentMethod,
          customer_lat: customerCoords?.lat,
          customer_lng: customerCoords?.lng,
          customer_accuracy: customerCoords?.accuracy,
          customer_location_locked_at: customerCoords?.savedAt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      localStorage.removeItem('cart_backup');
      const nextAddresses = [address, ...savedAddresses].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 4);
      localStorage.setItem('camigo_saved_addresses', JSON.stringify(nextAddresses));
      onOrderPlaced?.({ ...data, address });
      navigate(`/tracking/${data.order_id}`);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <main className="checkout-page">
      <div className="checkout-main">
        <span className="eyebrow">Secure checkout</span>
        <h1>Confirm delivery and payment</h1>
        <p className="checkout-subtitle">Camigo demo gateway simulates UPI, card, and COD payments before placing your order.</p>

        {error && <div className="admin-message">{error}</div>}

        <section className="checkout-card">
          <h3><MapPin size={18} /> Delivery details</h3>
          {savedAddresses.length > 0 && (
            <div className="saved-address-list">
              <span>Choose saved address</span>
              {savedAddresses.map(saved => (
                <button key={saved} type="button" className={address === saved ? 'active' : ''} onClick={() => setAddress(saved)}>
                  {saved}
                </button>
              ))}
            </div>
          )}
          <div className="form-group"><label>Full Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} rows="3" /></div>
          <div className="form-group"><label>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div className={`location-lock-card ${coords?.locked ? 'locked' : ''}`}>
            <strong>{coords?.locked ? 'Delivery GPS point locked' : lockingLocation ? 'Locking delivery GPS point...' : 'Delivery GPS point not locked'}</strong>
            <span>
              {coords?.lat && coords?.lng
                ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}${coords.accuracy ? ` • accuracy ${Math.round(coords.accuracy)}m` : ''}`
                : 'Allow location permission so the delivery partner gets the exact point.'}
            </span>
            <button type="button" onClick={async () => {
              setLockingLocation(true);
              const location = await captureCustomerLocation({ lock: true, source: 'checkout-manual-lock', timeout: 12000, maximumAge: 0 });
              if (location) setCoords(location);
              else setError('Could not lock GPS point. Please allow location permission and try again.');
              setLockingLocation(false);
            }} disabled={lockingLocation}>{coords?.locked ? 'Re-lock GPS' : 'Lock GPS now'}</button>
          </div>
        </section>

        <section className="checkout-card">
          <h3><Wallet size={18} /> Payment gateway</h3>
          <div className="payment-options">
            <button className={paymentMethod === 'upi' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('upi')}><Smartphone size={18} /> UPI</button>
            <button className={paymentMethod === 'card' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('card')}><CreditCard size={18} /> Card</button>
            <button className={paymentMethod === 'cod' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('cod')}><Wallet size={18} /> COD</button>
          </div>
          {paymentMethod === 'upi' && <div className="form-group"><label>UPI ID</label><input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" /></div>}
          {paymentMethod === 'card' && <div className="form-group"><label>Demo Card Number</label><input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="4111 1111 1111 1111" /></div>}
          {paymentMethod === 'cod' && <p className="checkout-note">Cash will be collected at delivery or installation handoff.</p>}
        </section>
      </div>

      <aside className="checkout-summary">
        <h3>Order Summary</h3>
        <div className="checkout-items">
          {cartItems.map((item, i) => (
            <div key={i} className="checkout-item">
              <span>{item.name} x{item.quantity}</span>
              <strong>Rs {item.price * item.quantity}</strong>
            </div>
          ))}
        </div>
        <div className="summary-row"><span>Subtotal</span><strong>Rs {subtotal}</strong></div>
        <div className="summary-row"><span>GST 18%</span><strong>Rs {gst}</strong></div>
        <div className="summary-row"><span>Delivery</span><strong>{deliveryFee === 0 ? 'FREE' : `Rs ${deliveryFee}`}</strong></div>
        <div className="summary-row"><span>Estimate</span><strong>{deliveryEstimate}</strong></div>
        <div className="summary-row"><span>GPS accuracy</span><strong>{coords?.accuracy ? `${Math.round(coords.accuracy)}m` : 'Not locked'}</strong></div>
        <div className="summary-total"><span>Payable</span><strong>Rs {payable}</strong></div>
        <button className="checkout-pay-btn" onClick={handlePlaceOrder} disabled={loading || cartItems.length === 0}>
          {loading ? 'Processing payment...' : `Pay Rs ${payable}`}
        </button>
      </aside>
    </main>
  );
}

export default CheckoutPage;
