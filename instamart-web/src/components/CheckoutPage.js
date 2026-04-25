import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, MapPin, Smartphone, Wrench, XCircle } from 'lucide-react';
import { API_URL } from '../api';
import { captureCustomerLocation, getSavedCustomerLocation } from '../locationLock';
import { isLocalAddressText, isLocalServiceZone } from '../deliveryZone';

function CheckoutPage({ user, onLogin, onOrderPlaced, liveCartItems = [] }) {
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
  const [installationRequested, setInstallationRequested] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(Boolean(window.Razorpay));
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
    setCartItems(Array.isArray(liveCartItems) ? liveCartItems : []);
    if (Array.isArray(liveCartItems) && liveCartItems.length) {
      localStorage.setItem('cart_backup', JSON.stringify(liveCartItems));
    }
  }, [liveCartItems]);

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

  useEffect(() => {
    if (window.Razorpay) {
      setRazorpayReady(true);
      return undefined;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    script.onerror = () => setError('Could not load Razorpay checkout. Refresh and try again.');
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
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

  const isCameraItem = (item) => {
    const categoryId = Number(item.category_id);
    if ([1, 2, 3].includes(categoryId)) return true;
    const text = `${item.name || ''} ${item.description || ''} ${item.category_name || ''}`.toLowerCase();
    if (/(accessor|smps|switch|dvr|nvr|cable|adapter|hard disk|hdd)/.test(text)) return false;
    return /(camera|bullet|dome|ptz|ip camera|ahd)/.test(text);
  };

  const subtotal = cartItems.reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const cameraCount = cartItems.reduce((sum, item) => (isCameraItem(item) ? sum + Number(item.quantity || 1) : sum), 0);
  const installationFee = installationRequested ? cameraCount * 500 : 0;
  const gpsIsLocked = Boolean(coords?.lat && coords?.lng);
  const gpsLocal = isLocalServiceZone(coords?.lat, coords?.lng);
  const localAddress = gpsIsLocked ? gpsLocal : isLocalAddressText(address);
  const deliveryEstimate = localAddress ? 'Today / same-day' : '2-4 days';
  const deliveryFee = subtotal > 2000 ? 0 : localAddress ? 40 : 120;
  const gst = Math.round(subtotal * 0.18);
  const payable = subtotal + gst + deliveryFee + installationFee;

  const handlePlaceOrder = async () => {
    setError('');
    if (!address || !phone) { setError('Delivery address and phone are required.'); return; }
    if (!cartItems.length) { setError('Cart is empty.'); return; }
    if (!razorpayReady || !window.Razorpay) { setError('Payment gateway is still loading. Please wait a moment and try again.'); return; }

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
      const res = await fetch(`${API_URL}/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cartItems.map(i => ({ product_id: i.product_id || i.id, quantity: i.quantity })),
          address,
          phone,
          payment_method: paymentMethod,
          installation_requested: installationRequested,
          customer_lat: customerCoords?.lat,
          customer_lng: customerCoords?.lng,
          customer_accuracy: customerCoords?.accuracy,
          customer_location_locked_at: customerCoords?.savedAt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment');

      const verified = await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: data.key,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Camigo',
          description: 'Fast CCTV order payment',
          order_id: data.razorpay_order_id,
          prefill: {
            name: user?.name || 'Camigo Customer',
            email: user?.email || '',
            contact: phone
          },
          notes: {
            local_order_id: String(data.local_order_id || ''),
            payment_method: paymentMethod
          },
          theme: {
            color: '#123c88'
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled'))
          },
          handler: async (response) => {
            try {
              const verifyRes = await fetch(`${API_URL}/payments/razorpay/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(response)
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');
              resolve(verifyData);
            } catch (verifyError) {
              reject(verifyError);
            }
          },
          method: {
            upi: paymentMethod === 'upi',
            card: paymentMethod === 'card',
            netbanking: false,
            wallet: false,
            emi: false,
            paylater: false
          }
        });
        razorpay.on('payment.failed', (response) => {
          reject(new Error(response.error?.description || 'Payment failed'));
        });
        razorpay.open();
      });

      localStorage.removeItem('cart_backup');
      const nextAddresses = [address, ...savedAddresses].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 4);
      localStorage.setItem('camigo_saved_addresses', JSON.stringify(nextAddresses));
      onOrderPlaced?.({ ...verified, address });
      navigate(`/tracking/${verified.order_id}`);
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
        <p className="checkout-subtitle">Camigo checkout now accepts online payments only with UPI or card before placing your order.</p>

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
          <h3><CreditCard size={18} /> Payment gateway</h3>
          <div className="payment-options payment-options-two">
            <button type="button" className={paymentMethod === 'upi' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('upi')}><Smartphone size={18} /> UPI</button>
            <button type="button" className={paymentMethod === 'card' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('card')}><CreditCard size={18} /> Card</button>
          </div>
          <p className="checkout-note">Cash on delivery is disabled. Camigo will now open real Razorpay checkout for the selected payment mode.</p>
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
        <div className="summary-row"><span>Installation</span><strong>{cameraCount > 0 ? (installationRequested ? `Rs ${installationFee}` : 'Not added') : 'No cameras'}</strong></div>
        <div className="summary-row"><span>Estimate</span><strong>{deliveryEstimate}</strong></div>
        <div className="summary-row"><span>Delivery zone</span><strong>{localAddress ? 'Local GPS zone' : 'Courier zone'}</strong></div>
        <div className="summary-row"><span>GPS accuracy</span><strong>{coords?.accuracy ? `${Math.round(coords.accuracy)}m` : 'Not locked'}</strong></div>
        <div className="summary-total"><span>Payable</span><strong>Rs {payable}</strong></div>
        <div className="installation-choice-card">
          <div className="installation-choice-head">
            <div>
              <span className="installation-choice-label">Service add-on</span>
              <h3><Wrench size={18} /> Installation support</h3>
            </div>
            {cameraCount > 0 && <span className="installation-choice-badge">{cameraCount} camera{cameraCount > 1 ? 's' : ''}</span>}
          </div>
          <div className="installation-choice-buttons">
            <button
              type="button"
              className={installationRequested ? 'installation-choice-button active' : 'installation-choice-button'}
              disabled={cameraCount <= 0}
              onClick={() => setInstallationRequested(true)}
            >
              <CheckCircle2 size={18} />
              <span>
                <strong>Add installation</strong>
                <small>Rs 500 per camera</small>
              </span>
            </button>
            <button
              type="button"
              className={!installationRequested ? 'installation-choice-button active muted' : 'installation-choice-button muted'}
              onClick={() => setInstallationRequested(false)}
            >
              <XCircle size={18} />
              <span>
                <strong>No installation</strong>
                <small>Products only</small>
              </span>
            </button>
          </div>
          <p className="checkout-note installation-choice-note">
            {cameraCount > 0
              ? `Installation charge is Rs 500 per camera. ${cameraCount} camera(s) detected in this order.`
              : 'Installation becomes available when camera products are in the cart.'}
          </p>
        </div>
        <button className="checkout-pay-btn" onClick={handlePlaceOrder} disabled={loading || cartItems.length === 0}>
          {loading ? 'Opening Razorpay...' : razorpayReady ? `Pay Rs ${payable}` : 'Loading payment gateway...'}
        </button>
      </aside>
    </main>
  );
}

export default CheckoutPage;
