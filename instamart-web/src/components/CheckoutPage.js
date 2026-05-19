import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BadgePercent, CheckCircle2, CreditCard, MapPin, Minus, Package, Plus, Receipt, Search, ShieldCheck, Smartphone, Wrench, X, XCircle } from 'lucide-react';
import { API_URL } from '../api';
import { captureCustomerLocation, getSavedCustomerLocation } from '../locationLock';
import { checkServiceability, extractPincode } from '../deliveryZone';
import PhoneVerificationCard from './PhoneVerificationCard';
import ProductImage from './ProductImage';

function CheckoutPage({ user, onLogin, onOrderPlaced, onUserUpdate, liveCartItems = [] }) {
  const location = useLocation();
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
  const [pincode, setPincode] = useState(() => extractPincode(user?.address || ''));
  const [phone, setPhone] = useState(user?.phone_verified ? user?.phone || '' : '');
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
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [addressBook, setAddressBook] = useState([]);
  const [addressLabel, setAddressLabel] = useState('Home');
  const [addressSaving, setAddressSaving] = useState(false);
  const [codEnabled, setCodEnabled] = useState(false);
  const [checkoutSuggestions, setCheckoutSuggestions] = useState([]);
  const navigate = useNavigate();
  const directBuyItem = location.state?.directBuyItem || null;

  useEffect(() => {
    setPhone(user?.phone_verified ? user?.phone || '' : '');
    if (user?.phone_verified) setPhoneVerifyOpen(false);
  }, [user?.phone, user?.phone_verified]);

  useEffect(() => {
    if (user?.address && !address.trim()) {
      setAddress(user.address);
      setPincode(extractPincode(user.address));
    }
  }, [user?.address]);

  useEffect(() => {
    if (!user) onLogin();
  }, [user, onLogin]);

  useEffect(() => {
    if (directBuyItem) return;
    setCartItems(Array.isArray(liveCartItems) ? liveCartItems : []);
    if (Array.isArray(liveCartItems) && liveCartItems.length) {
      localStorage.setItem('cart_backup', JSON.stringify(liveCartItems));
    }
  }, [liveCartItems, directBuyItem]);

  useEffect(() => {
    fetch(`${API_URL}/store-settings`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (typeof data?.cod_enabled === 'boolean') setCodEnabled(data.cod_enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (directBuyItem) {
      setCartItems([{ ...directBuyItem, quantity: Math.max(1, Number(directBuyItem.quantity || 1)) }]);
      return;
    }
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/cart`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : []),
      fetch(`${API_URL}/account/addresses`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : [])
    ])
      .then(([cartData, addressData]) => {
        if (Array.isArray(cartData) && cartData.length) {
          setCartItems(cartData);
          localStorage.setItem('cart_backup', JSON.stringify(cartData));
        }
        setAddressBook(Array.isArray(addressData) ? addressData : []);
      })
      .catch(() => {});
  }, [user, directBuyItem]);

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

  const savedAddressChoices = useMemo(() => {
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem('camigo_saved_addresses') || '[]');
    } catch (e) {
      localStorage.removeItem('camigo_saved_addresses');
    }
    const combined = [];
    const seen = new Set();
    addressBook.forEach((entry) => {
      const value = String(entry?.address || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      combined.push({
        key: `book-${entry.id}`,
        address: value,
        label: entry.label || 'Saved',
        meta: entry.is_default ? 'Default address' : (entry.pincode || ''),
        isDefault: Boolean(entry.is_default)
      });
    });
    [user?.address, ...recent].forEach((value, index) => {
      const safeValue = String(value || '').trim();
      if (!safeValue || seen.has(safeValue)) return;
      seen.add(safeValue);
      combined.push({
        key: `recent-${index}`,
        address: safeValue,
        label: index === 0 && user?.address ? 'Account address' : 'Recent',
        meta: extractPincode(safeValue) || '',
        isDefault: false
      });
    });
    return combined.slice(0, 6);
  }, [addressBook, user?.address]);

  const savedAddresses = useMemo(
    () => savedAddressChoices.map((entry) => entry.address),
    [savedAddressChoices]
  );

  const isCameraItem = (item) => {
    const categoryId = Number(item.category_id);
    if ([1, 2, 3].includes(categoryId)) return true;
    const text = `${item.name || ''} ${item.description || ''} ${item.category_name || ''}`.toLowerCase();
    if (/(accessor|smps|switch|dvr|nvr|cable|adapter|hard disk|hdd)/.test(text)) return false;
    return /(camera|bullet|dome|ptz|ip camera|ahd)/.test(text);
  };

  const subtotal = cartItems.reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const cartItemCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const promoDiscount = Number(promoResult?.discount_amount || 0);
  const discountedSubtotal = Math.max(0, subtotal - promoDiscount);
  const cameraCount = cartItems.reduce((sum, item) => (isCameraItem(item) ? sum + Number(item.quantity || 1) : sum), 0);
  const installationFee = installationRequested ? cameraCount * 500 : 0;
  const serviceability = checkServiceability({ address, pincode, lat: coords?.lat, lng: coords?.lng });
  const deliveryAvailable = Boolean(deliveryQuote?.serviceable || serviceability.serviceable);
  const isLocalDelivery = deliveryQuote?.mode === 'local' || (!deliveryQuote && serviceability.mode === 'local');
  const isCourierDelivery = deliveryQuote?.mode === 'courier' || (!deliveryQuote && serviceability.mode === 'courier');
  const deliveryFee = Number(deliveryQuote?.charge || 0);
  const cartAllowsCod = cartItems.every((item) => Number(item.cod_enabled ?? 1) !== 0);
  const codAvailableForCheckout = codEnabled && cartAllowsCod;
  const deliveryEstimate = deliveryQuote?.estimateLabel
    || (serviceability.mode === 'courier' ? 'Courier estimate pending' : serviceability.mode === 'local' ? 'Same-day quote pending' : 'Enter valid pincode');
  const deliveryZoneLabel = deliveryQuote?.zoneLabel
    || (serviceability.mode === 'courier' ? 'Courier via Delhivery' : serviceability.mode === 'local' ? 'Same-day local zone' : 'Blocked');
  const deliveryProvider = deliveryQuote?.provider || (isCourierDelivery ? 'Delhivery' : isLocalDelivery ? 'Uber Parcel + Rapido average' : 'Unavailable');
  const gst = Math.round(discountedSubtotal * 0.18);
  const payable = discountedSubtotal + gst + deliveryFee + installationFee;
  const paymentGatewayReady = paymentMethod === 'cod' ? true : razorpayReady;
  const payDisabled = Boolean(loading || !cartItems.length || !deliveryAvailable || !deliveryQuote || quoteLoading || !address.trim() || !paymentGatewayReady);
  const cartProductIds = useMemo(
    () => new Set(cartItems.map((item) => Number(item.product_id || item.id)).filter(Boolean)),
    [cartItems]
  );
  const cartCategoryIds = useMemo(
    () => Array.from(new Set(cartItems.map((item) => Number(item.category_id)).filter(Boolean))),
    [cartItems]
  );

  useEffect(() => {
    if (paymentMethod === 'cod' && !codAvailableForCheckout) setPaymentMethod('upi');
  }, [codAvailableForCheckout, paymentMethod]);

  useEffect(() => {
    let active = true;
    if (!cartItems.length) {
      setCheckoutSuggestions([]);
      return undefined;
    }
    const loadSuggestions = async () => {
      try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json().catch(() => []);
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const fromSameCategory = list.filter((product) => (
          !cartProductIds.has(Number(product.id))
          && cartCategoryIds.includes(Number(product.category_id))
          && Number(product.is_hidden || 0) !== 1
        ));
        const accessoryFallback = list.filter((product) => (
          !cartProductIds.has(Number(product.id))
          && [4, 5, 6, 7, 8].includes(Number(product.category_id))
          && Number(product.is_hidden || 0) !== 1
        ));
        const merged = [...fromSameCategory, ...accessoryFallback].filter((product, index, array) => (
          array.findIndex((entry) => Number(entry.id) === Number(product.id)) === index
        ));
        setCheckoutSuggestions(merged.slice(0, 12));
      } catch (loadError) {
        if (active) setCheckoutSuggestions([]);
      }
    };
    loadSuggestions();
    return () => {
      active = false;
    };
  }, [cartItems.length, cartCategoryIds, cartProductIds]);

  useEffect(() => {
    const detectedPincode = pincode.trim() || extractPincode(address);
    if (!cartItems.length) {
      setDeliveryQuote(null);
      return undefined;
    }
    if (!address.trim() && !detectedPincode && !coords?.lat) {
      setDeliveryQuote(null);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const res = await fetch(`${API_URL}/delivery-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            address,
            pincode: detectedPincode,
            customer_lat: coords?.lat,
            customer_lng: coords?.lng,
            items: cartItems.map(item => ({
              product_id: item.product_id || item.id,
              quantity: item.quantity
            }))
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not calculate delivery quote');
        setDeliveryQuote(data);
      } catch (quoteError) {
        if (quoteError.name !== 'AbortError') {
          setDeliveryQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, pincode, coords?.lat, coords?.lng, cartItems]);

  const buildRazorpayDisplayConfig = () => ({
    display: {
      blocks: {
        preferred: {
          name: paymentMethod === 'upi' ? 'Pay with UPI app' : 'Pay by card',
          instruments: [{ method: paymentMethod }]
        }
      },
      sequence: ['block.preferred'],
      preferences: {
        show_default_blocks: false
      }
    }
  });

  const handleCheckPincode = () => {
    const pin = pincode.trim() || extractPincode(address);
    if (pin && pin !== pincode) setPincode(pin);
    const check = checkServiceability({ address, pincode: pin, lat: coords?.lat, lng: coords?.lng });
    setError(check.serviceable ? '' : 'Enter a valid 6-digit pincode. Same-day is for Bhubaneswar/Cuttack/Khordha/Jatni, and outside-zone orders go by Delhivery courier.');
  };

  const applyPromoCode = async () => {
    const token = localStorage.getItem('token');
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoResult(null);
      setError('Enter a promo code first.');
      return;
    }
    setPromoBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/promo/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, order_amount: subtotal })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Promo code could not be applied.');
      setPromoResult(data);
      setPromoCode(data.code || code);
    } catch (promoError) {
      setPromoResult(null);
      setError(promoError.message);
    } finally {
      setPromoBusy(false);
    }
  };

  const saveCurrentAddress = async () => {
    const token = localStorage.getItem('token');
    const safeAddress = address.trim();
    if (!token || !safeAddress) {
      setError('Enter the delivery address before saving it.');
      return;
    }
    setAddressSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/account/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: addressLabel,
          address: safeAddress,
          pincode: pincode.trim() || extractPincode(safeAddress),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          is_default: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Address could not be saved.');
      const createdAddress = data.address;
      setAddressBook((current) => {
        const withoutDupes = current.filter((entry) => Number(entry.id) !== Number(createdAddress?.id) && entry.address !== createdAddress?.address);
        return createdAddress ? [createdAddress, ...withoutDupes] : withoutDupes;
      });
      onUserUpdate?.({ ...user, address: safeAddress });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSummaryQuantityChange = async (item, nextQuantity) => {
    const safeQuantity = Math.max(0, Number(nextQuantity || 0));
    const token = localStorage.getItem('token');
    const nextCartItems = safeQuantity === 0
      ? cartItems.filter((entry) => String(entry.id ?? entry.product_id ?? entry.name) !== String(item.id ?? item.product_id ?? item.name))
      : cartItems.map((entry) => (
          String(entry.id ?? entry.product_id ?? entry.name) === String(item.id ?? item.product_id ?? item.name)
            ? { ...entry, quantity: safeQuantity }
            : entry
        ));

    setCartItems(nextCartItems);
    localStorage.setItem('cart_backup', JSON.stringify(nextCartItems));

    if (!token || !item?.id) return;

    try {
      if (safeQuantity === 0) {
        await fetch(`${API_URL}/cart/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await fetch(`${API_URL}/cart/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity: safeQuantity })
        });
      }
    } catch (cartError) {
      // Keep checkout responsive even if cart sync is delayed.
    }
  };

  const handleSuggestionAdd = async (product) => {
    const token = localStorage.getItem('token');
    if (!token) {
      onLogin?.();
      return;
    }
    const productId = Number(product.id);
    const existing = cartItems.find((item) => Number(item.product_id || item.id) === productId);
    const nextCartItems = existing
      ? cartItems.map((item) => (
          Number(item.product_id || item.id) === productId
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        ))
      : [...cartItems, { ...product, product_id: product.id, quantity: 1 }];
    setCartItems(nextCartItems);
    localStorage.setItem('cart_backup', JSON.stringify(nextCartItems));
    try {
      if (existing?.id) {
        await fetch(`${API_URL}/cart/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity: Number(existing.quantity || 0) + 1 })
        });
      } else {
        await fetch(`${API_URL}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ product_id: product.id, quantity: 1 })
        });
      }
    } catch (cartError) {
      // Keep checkout responsive even if cart sync takes a moment.
    }
  };

  const handlePlaceOrder = async () => {
    setError('');
    if (!user?.phone_verified) { setPhoneVerifyOpen(true); return; }
    if (!address || !phone) { setError('Delivery address and phone are required.'); return; }
    if (!cartItems.length) { setError('Cart is empty.'); return; }
    if (!deliveryQuote || quoteLoading) { setError('Wait a moment while Camigo finishes the delivery charge calculation.'); return; }
    if (paymentMethod !== 'cod' && (!razorpayReady || !window.Razorpay)) { setError('Payment gateway is still loading. Please wait a moment and try again.'); return; }

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
      const deliveryCheck = checkServiceability({ address, pincode, lat: customerCoords?.lat, lng: customerCoords?.lng });
      if (!deliveryCheck.serviceable) {
        setError('Enter a valid 6-digit delivery pincode before payment. Same-day is local, and outside-zone orders go by Delhivery courier.');
        setLoading(false);
        return;
      }
      if (paymentMethod === 'cod') {
        const codRes = await fetch(`${API_URL}/orders/cod`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            items: cartItems.map(i => ({ product_id: i.product_id || i.id, quantity: i.quantity })),
            address,
            pincode: deliveryQuote?.detectedPincode || deliveryCheck.detectedPincode,
            phone,
            payment_method: 'cod',
            promo_code: promoResult?.code || promoCode.trim().toUpperCase() || undefined,
            installation_requested: installationRequested,
            customer_lat: customerCoords?.lat,
            customer_lng: customerCoords?.lng,
            customer_accuracy: customerCoords?.accuracy,
            customer_location_locked_at: customerCoords?.savedAt
          })
        });
        const codData = await codRes.json().catch(() => ({}));
        if (!codRes.ok) throw new Error(codData.error || 'Could not place COD order');
        localStorage.removeItem('cart_backup');
        const nextAddresses = [address, ...savedAddresses].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 4);
        localStorage.setItem('camigo_saved_addresses', JSON.stringify(nextAddresses));
        onOrderPlaced?.({ ...codData, address });
        navigate(`/tracking/${codData.order_id}`);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cartItems.map(i => ({ product_id: i.product_id || i.id, quantity: i.quantity })),
          address,
          pincode: deliveryQuote?.detectedPincode || deliveryCheck.detectedPincode,
          phone,
          payment_method: paymentMethod,
          promo_code: promoResult?.code || promoCode.trim().toUpperCase() || undefined,
          installation_requested: installationRequested,
          customer_lat: customerCoords?.lat,
          customer_lng: customerCoords?.lng,
          customer_accuracy: customerCoords?.accuracy,
          customer_location_locked_at: customerCoords?.savedAt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment');

      const abortPendingOnlineOrder = async () => {
        try {
          await fetch(`${API_URL}/payments/razorpay/abort`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ razorpay_order_id: data.razorpay_order_id })
          });
        } catch (abortError) {
          // Ignore cleanup errors; the main error is more important to show.
        }
      };

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
            payment_method: paymentMethod,
            upi_app_redirect_ready: paymentMethod === 'upi' ? '1' : '0'
          },
          theme: {
            color: '#123c88'
          },
          config: buildRazorpayDisplayConfig(),
          modal: {
            ondismiss: async () => {
              await abortPendingOnlineOrder();
              reject(new Error('Payment cancelled'));
            }
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
          abortPendingOnlineOrder().finally(() => {
            reject(new Error(response.error?.description || 'Payment failed'));
          });
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

  if (!user) return null;

  return (
    <main className="checkout-page">
      <div className="checkout-main">
        <span className="eyebrow">Secure checkout</span>
        <h1>Confirm delivery and payment</h1>
        <p className="checkout-subtitle">
          {codEnabled
            ? 'Choose UPI, card, or cash on delivery before placing your Camigo order.'
            : 'Camigo checkout now accepts online payments only with UPI or card before placing your order.'}
        </p>

        {error && <div className="admin-message">{error}</div>}

        <section className="checkout-card">
          <h3><MapPin size={18} /> Delivery details</h3>
          {savedAddressChoices.length > 0 && (
            <div className="saved-address-list">
              <span>Choose saved address</span>
              {savedAddressChoices.map((saved) => (
                <button key={saved.key} type="button" className={address === saved.address ? 'active' : ''} onClick={() => {
                  setAddress(saved.address);
                  setPincode(extractPincode(saved.address));
                }}>
                  <strong>{saved.label}</strong>
                  <span>{saved.address}</span>
                  {saved.meta && <small>{saved.meta}</small>}
                </button>
              ))}
            </div>
          )}
          <div className="checkout-address-save-row">
            <select value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)}>
              <option value="Home">Home</option>
              <option value="Office">Office</option>
              <option value="Site">Site</option>
              <option value="Other">Other</option>
            </select>
            <button type="button" onClick={saveCurrentAddress} disabled={addressSaving || !address.trim()}>
              {addressSaving ? 'Saving...' : 'Save to address book'}
            </button>
          </div>
          <div className="form-group"><label>Full Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} rows="3" /></div>
          <div className="form-group"><label>Phone Number</label><input type="tel" value={phone} readOnly placeholder="Verify mobile at checkout" /></div>
          {!user?.phone_verified && (
            <div className="serviceability-status blocked">
              <strong>Mobile verification required</strong>
              <span>Verify your mobile here before payment. You can use the Firebase test OTP while real SMS setup is pending.</span>
              <button type="button" onClick={() => setPhoneVerifyOpen(true)}>Verify mobile</button>
            </div>
          )}
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
          <div className="form-group">
            <label>Pincode / service area</label>
            <div className="pincode-search-row">
              <input
                type="text"
                inputMode="numeric"
                maxLength="6"
                placeholder="751024 / 753001"
                value={pincode}
                onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="button" onClick={handleCheckPincode}><Search size={16} /> Check</button>
            </div>
          </div>
          <div className="form-group">
            <label>Coupons / offers</label>
            <div className="pincode-search-row">
              <input
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
              />
              <button type="button" onClick={applyPromoCode} disabled={promoBusy}>
                {promoBusy ? 'Applying...' : 'Apply'}
              </button>
            </div>
            {promoResult && (
              <div className="promo-success-row">
                <strong>{promoResult.code}</strong>
                <span>Saved Rs {Math.round(Number(promoResult.discount_amount || 0))} on products.</span>
              </div>
            )}
          </div>
          <div className={deliveryAvailable ? 'serviceability-status ok' : 'serviceability-status blocked'}>
            <strong>
              {deliveryAvailable
                ? (isLocalDelivery ? 'Same-day local delivery available' : 'Courier delivery available')
                : 'Delivery area not ready'}
            </strong>
            <span>
              {deliveryAvailable
                ? (deliveryQuote?.message || `Accepting orders for ${serviceability.detectedPincode || 'your locked GPS area'}.`)
                : 'Enter a valid 6-digit delivery pincode. Bhubaneswar/Cuttack/Khordha/Jatni use same-day local delivery, while outside-zone orders go by Delhivery courier.'}
            </span>
            {quoteLoading && <span>Calculating averaged delivery charge...</span>}
          </div>
        </section>

        <section className="checkout-card">
            <h3><CreditCard size={18} /> Payment gateway</h3>
          <div className={`payment-options ${codEnabled ? '' : 'payment-options-two'}`}>
            <button type="button" className={paymentMethod === 'upi' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('upi')}><Smartphone size={18} /> UPI</button>
            <button type="button" className={paymentMethod === 'card' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('card')}><CreditCard size={18} /> Card</button>
            {codAvailableForCheckout && <button type="button" className={paymentMethod === 'cod' ? 'payment-option active' : 'payment-option'} onClick={() => setPaymentMethod('cod')}><CreditCard size={18} /> COD</button>}
          </div>
          <p className="checkout-note">
            {codAvailableForCheckout
              ? 'COD is currently active from admin. UPI and card still open Razorpay checkout, while COD places the order directly.'
              : codEnabled && !cartAllowsCod
                ? 'Some products in this cart are marked as COD disabled in admin, so only UPI and card are available.'
                : 'Cash on delivery is disabled. Camigo will now open real Razorpay checkout for the selected payment mode.'}
          </p>
          {paymentMethod === 'upi' && (
              <p className="checkout-note upi-app-note">
                On mobile, Razorpay will show available UPI apps for app-to-app payment when supported by the device.
              </p>
            )}
        </section>
      </div>

        <aside className="checkout-summary">
          <div className="checkout-summary-card checkout-cart-card">
            <div className="checkout-summary-head">
              <div>
                <span className="checkout-section-tag">Your cart</span>
                <h3><Package size={18} /> Order summary</h3>
              </div>
              <div className="checkout-summary-meta">
                <strong>{deliveryAvailable ? deliveryEstimate : 'Pending'}</strong>
                <small>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</small>
              </div>
            </div>
            <div className="checkout-items">
              {cartItems.map((item, i) => (
                <div key={i} className="checkout-item">
                  <div className="checkout-item-media">
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      proxyWidth={160}
                      proxyQuality={66}
                      proxyFormat="webp"
                    />
                  </div>
                  <div className="checkout-item-copy">
                    <span>{item.name}</span>
                    <small>{item.unit || '1 Unit'}</small>
                    <div className="checkout-item-bottom">
                      <div className="checkout-item-qty">
                        <button type="button" onClick={() => handleSummaryQuantityChange(item, Number(item.quantity || 1) - 1)} aria-label={`Decrease quantity for ${item.name}`}>
                          <Minus size={14} />
                        </button>
                        <strong>{item.quantity}</strong>
                        <button type="button" onClick={() => handleSummaryQuantityChange(item, Number(item.quantity || 1) + 1)} aria-label={`Increase quantity for ${item.name}`}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="checkout-item-price">
                        <strong>Rs {item.price * item.quantity}</strong>
                        {Number(item.mrp || 0) > Number(item.price || 0) && (
                          <small>Rs {Number(item.mrp || 0) * Number(item.quantity || 1)}</small>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="checkout-link-button" onClick={() => navigate('/shop')}>
              Add more items
            </button>
          </div>

          <div className="checkout-summary-card checkout-savings-card">
            <div className="checkout-summary-head compact">
              <div>
                <span className="checkout-section-tag">Savings corner</span>
                <h3><BadgePercent size={18} /> Offers and unlocks</h3>
              </div>
            </div>
            {promoDiscount > 0 ? (
              <div className="checkout-saving-highlight success">
                <strong>{promoResult?.code || 'Offer applied'}</strong>
                <span>You are already saving Rs {promoDiscount} on this order.</span>
              </div>
            ) : (
              <div className="checkout-saving-highlight">
                <strong>Apply a promo code</strong>
                <span>Use the offer field on the left to unlock extra savings before payment.</span>
              </div>
            )}
            <div className="checkout-mini-status-row">
              <div className="checkout-mini-status">
                <span>Delivery partner</span>
                <strong>{deliveryProvider}</strong>
              </div>
              <div className="checkout-mini-status">
                <span>Delivery zone</span>
                <strong>{deliveryZoneLabel}</strong>
              </div>
            </div>
          </div>

          {checkoutSuggestions.length > 0 && (
            <div className="checkout-summary-card checkout-suggestion-card">
              <div className="checkout-summary-head compact">
                <div>
                  <span className="checkout-section-tag">Did you forget?</span>
                  <h3><Package size={18} /> Quick add-ons</h3>
                </div>
              </div>
              <div className="checkout-suggestion-rail">
                {checkoutSuggestions.map((product) => (
                  <div key={product.id} className="checkout-suggestion-item">
                    <button type="button" className="checkout-suggestion-visual" onClick={() => navigate(`/product/${product.id}`)}>
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        proxyWidth={180}
                        proxyQuality={64}
                        proxyFormat="webp"
                      />
                    </button>
                    <small>{deliveryAvailable ? deliveryEstimate : 'Fast add-on'}</small>
                    <strong>{product.name}</strong>
                    <div className="checkout-suggestion-foot">
                      <span>Rs {Math.round(Number(product.price || 0))}</span>
                      <button type="button" onClick={() => handleSuggestionAdd(product)} aria-label={`Add ${product.name} to cart`}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="checkout-summary-card checkout-bill-card">
            <div className="checkout-summary-head compact">
              <div>
                <span className="checkout-section-tag">Bill details</span>
                <h3><Receipt size={18} /> Pay breakdown</h3>
              </div>
            </div>
            <div className="summary-row"><span>Subtotal</span><strong>Rs {subtotal}</strong></div>
            {promoDiscount > 0 && <div className="summary-row savings"><span>Discount</span><strong>- Rs {promoDiscount}</strong></div>}
            <div className="summary-row"><span>GST 18%</span><strong>Rs {gst}</strong></div>
            <div className="summary-row"><span>Delivery</span><strong>{deliveryAvailable ? `Rs ${deliveryFee}` : 'Pending'}</strong></div>
            <div className="summary-row"><span>Installation</span><strong>{cameraCount > 0 ? (installationRequested ? `Rs ${installationFee}` : 'Not added') : 'No cameras'}</strong></div>
            <div className="summary-row"><span>Estimate</span><strong>{deliveryEstimate}</strong></div>
            {deliveryQuote?.distanceKm != null && <div className="summary-row"><span>Road distance</span><strong>{deliveryQuote.distanceKm} km</strong></div>}
            {deliveryQuote?.chargeableWeightKg != null && <div className="summary-row"><span>Courier slab</span><strong>{deliveryQuote.chargeableWeightKg} kg</strong></div>}
            <div className="summary-row"><span>GPS accuracy</span><strong>{coords?.accuracy ? `${Math.round(coords.accuracy)}m` : 'Not locked'}</strong></div>
            <div className="summary-total"><span>To pay</span><strong>Rs {payable}</strong></div>
          </div>

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
          <div className="checkout-summary-card checkout-assurance-card">
            <div className="checkout-assurance-row">
              <ShieldCheck size={18} />
              <div>
                <strong>Secure checkout</strong>
                <span>Camigo confirms delivery area, GPS lock, and payment route before placing the order.</span>
              </div>
            </div>
          </div>
          <button className="checkout-pay-btn" onClick={handlePlaceOrder} disabled={payDisabled}>
            {loading
              ? 'Opening Razorpay...'
              : !deliveryAvailable
                ? 'Enter valid delivery pincode'
                : quoteLoading
                  ? 'Calculating delivery charge...'
                  : !user?.phone_verified
                      ? 'Verify mobile to pay'
                      : paymentMethod === 'cod'
                        ? `Place COD order Rs ${payable}`
                        : razorpayReady
                          ? `Pay Rs ${payable}`
                          : 'Loading payment gateway...'}
          </button>
      </aside>
      <div className="checkout-mobile-bar">
        <div className="checkout-mobile-bar-copy">
          <strong>To pay: Rs {payable}</strong>
          <span>{deliveryAvailable ? deliveryEstimate : 'Enter serviceable pincode'}</span>
        </div>
        <button type="button" className="checkout-mobile-pay" onClick={handlePlaceOrder} disabled={payDisabled}>
          {loading ? 'Processing...' : 'Pay now'}
        </button>
      </div>
      {phoneVerifyOpen && (
        <div className="checkout-verify-overlay" role="dialog" aria-modal="true" aria-label="Verify mobile number">
          <div className="checkout-verify-modal">
            <button className="checkout-verify-close" type="button" onClick={() => setPhoneVerifyOpen(false)} aria-label="Close verification">
              <X size={20} />
            </button>
            <PhoneVerificationCard
              user={user}
              onUserUpdate={(nextUser) => {
                onUserUpdate?.(nextUser);
                if (nextUser?.phone_verified) {
                  setPhone(nextUser.phone || '');
                  setPhoneVerifyOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default CheckoutPage;
