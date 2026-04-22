import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Smartphone, Wallet } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function CheckoutPage({ user, onLogin, onOrderPlaced }) {
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [coords, setCoords] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('camigo_customer_location') || 'null');
      return saved?.lat && saved?.lng ? saved : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  let cartItems = [];
  try {
    const savedCart = JSON.parse(localStorage.getItem('cart_backup') || '[]');
    cartItems = Array.isArray(savedCart) ? savedCart : [];
  } catch (e) {
    localStorage.removeItem('cart_backup');
  }

  if (!user) { onLogin(); return null; }

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

  const subtotal = cartItems.reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const addressText = String(address || '').toLowerCase();
  const localAddress = addressText.includes('bhubaneswar') || addressText.includes('bbsr') || addressText.includes('cuttack');
  const deliveryEstimate = localAddress ? 'Today / same-day' : '2-4 days';
  const deliveryFee = subtotal > 2000 ? 0 : localAddress ? 40 : 120;
  const payable = subtotal + deliveryFee;

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
      if (!customerCoords && navigator.geolocation) {
        customerCoords = await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
          );
        });
        if (customerCoords) setCoords(customerCoords);
      }
      if (customerCoords) localStorage.setItem('camigo_customer_location', JSON.stringify({ ...customerCoords, savedAt: Date.now() }));
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cartItems.map(i => ({ product_id: i.product_id || i.id, quantity: i.quantity })),
          address,
          payment_method: paymentMethod,
          customer_lat: customerCoords?.lat,
          customer_lng: customerCoords?.lng
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
        <div className="summary-row"><span>Delivery</span><strong>{deliveryFee === 0 ? 'FREE' : `Rs ${deliveryFee}`}</strong></div>
        <div className="summary-row"><span>Estimate</span><strong>{deliveryEstimate}</strong></div>
        <div className="summary-total"><span>Payable</span><strong>Rs {payable}</strong></div>
        <button className="checkout-pay-btn" onClick={handlePlaceOrder} disabled={loading || cartItems.length === 0}>
          {loading ? 'Processing payment...' : `Pay Rs ${payable}`}
        </button>
      </aside>
    </main>
  );
}

export default CheckoutPage;
