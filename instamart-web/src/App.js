import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import CategoryGrid from './components/CategoryGrid';
import ProductSection from './components/ProductSection';
import ProductDetail from './components/ProductDetail';
import CartDrawer from './components/CartDrawer';
import LoginModal from './components/LoginModal';
import OrdersPage from './components/OrdersPage';
import AdminPage from './components/AdminPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import DealerDashboard from './components/DealerDashboard';
import InstallationPage from './components/InstallationPage';
import ShopPage from './components/ShopPage';
import CheckoutPage from './components/CheckoutPage';
import CategoryPage from './components/CategoryPage';
import TrackingPage from './components/TrackingPage';
import DeliveryPartnerPage from './components/DeliveryPartnerPage';
import InstallerPage from './components/InstallerPage';
import LocationDeliveryStrip from './components/LocationDeliveryStrip';
import FloatingTracker from './components/FloatingTracker';
import FloatingCheckoutBar from './components/FloatingCheckoutBar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import { API_URL } from './api';
import { captureCustomerLocation, getSavedCustomerLocation } from './locationLock';
import { isTrackableOrder } from './orderTracking';
import './App.css';

const getRuntimeAppMode = () => {
  const buildMode = process.env.REACT_APP_APP_MODE;
  if (buildMode) return buildMode;

  if (typeof window === 'undefined') return 'web';
  const mode = new URLSearchParams(window.location.search).get('app');
  if (mode === 'customer' || mode === 'delivery' || mode === 'installer') return mode;
  return 'web';
};

const APP_MODE = getRuntimeAppMode();

function DeliveryOnlyRoute({ user, children }) {
  useEffect(() => {
    if (user?.role === 'delivery_partner') {
      window.location.hash = '#/delivery-partner';
    } else if (user?.role === 'installer') {
      window.location.hash = '#/installer';
    }
  }, [user]);

  if (user?.role === 'delivery_partner') {
    return <DeliveryPartnerPage user={user} authReady={true} onLogin={() => {}} />;
  }
  if (user?.role === 'installer') {
    return <InstallerPage user={user} authReady={true} onLogin={() => {}} />;
  }

  return children;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error) {
    console.error('Camigo render error:', error);
  }

  resetApp = () => {
    Object.keys(localStorage)
      .filter(key => key === 'token' || key === 'user' || key.startsWith('camigo') || key === 'cart_backup')
      .forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {});
    }
    window.location.href = `/?reset=${Date.now()}`;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error">
          <h1>Camigo is ready, but the browser had old saved data.</h1>
          <p>{this.state.message}</p>
          <button onClick={this.resetApp}>Reset and reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const priceForRole = (product, user) => {
  if (user?.role === 'distributor' && Number(product.distributor_price) > 0) return Math.round(Number(product.distributor_price));
  if (user?.role === 'dealer' && Number(product.dealer_price) > 0) return Math.round(Number(product.dealer_price));
  const discount = user?.role === 'distributor' ? 0.85 : user?.role === 'dealer' ? 0.90 : 1;
  return Math.round(Number(product.price || 0) * discount);
};

function MainPage({ user, cartCount, onCartClick, onLoginClick, onLogout, cartItems, addToCart, removeFromCart, products, categories, searchQuery, setSearchQuery }) {
  const filteredProducts = searchQuery
    ? products.filter(p => String(p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const productsByCategory = categories.map(cat => ({
    ...cat,
    products: filteredProducts.filter(p => p.category_id === cat.id)
  })).filter(c => c.products.length > 0);

  return (
    <>
      <main className="main-content">
        {!searchQuery && <HeroBanner />}
        {!searchQuery && <LocationDeliveryStrip />}
        {!searchQuery && <CategoryGrid categories={categories} />}
        {searchQuery ? (
          filteredProducts.length ? (
            <ProductSection title={`Search: "${searchQuery}"`} products={filteredProducts} onAdd={addToCart} onRemove={removeFromCart} user={user} cartItems={cartItems} />
          ) : (
            <section className="category-section">
              <div className="card search-empty-state">
                <h3>No products found for "{searchQuery}"</h3>
                <p>Try a broader search like camera, DVR, NVR, switch, SMPS, or accessories.</p>
                <div className="search-empty-actions">
                  {['AHD camera', 'IP camera', 'DVR', 'NVR', 'POE switch', 'SMPS'].map((suggestion) => (
                    <button key={suggestion} className="btn btn-outline btn-sm" onClick={() => setSearchQuery(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )
        ) : (
          productsByCategory.map(cat => (
            <ProductSection key={cat.id} title={cat.name} categoryId={cat.id} products={cat.products} onAdd={addToCart} onRemove={removeFromCart} user={user} cartItems={cartItems} />
          ))
        )}
      </main>
      <Footer />
    </>
  );
}

function AppContent() {
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [appNotice, setAppNotice] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ));
  const cartBusyRef = useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  const updateUserState = (nextUser) => {
    if (!nextUser) return;
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const clearSessionState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('camigo_active_order');
    setUser(null);
    setCartItems([]);
    setActiveOrder(null);
  };

  const handleAuthFailure = (message = 'Your session expired. Please login again to continue.') => {
    clearSessionState();
    setAppNotice({
      id: 'session-expired',
      title: 'Session expired',
      message,
      personalize: 0
    });
    setLoginOpen(true);
  };

  const refreshCurrentUser = async (referenceUser) => {
    const token = localStorage.getItem('token');
    if (!token || !referenceUser?.id) return;
    try {
      const res = await fetch(`${API_URL}/users/${referenceUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return;
      }
      const data = await res.json();
      if (res.ok && data?.id) updateUserState(data);
    } catch (e) {}
  };

  const setCartBusy = (productId, busy) => {
    const value = Number(productId);
    if (!Number.isFinite(value)) return;
    if (busy) cartBusyRef.current.add(value);
    else cartBusyRef.current.delete(value);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser);
          refreshCurrentUser(parsedUser);
          if (parsedUser.role === 'delivery_partner' && location.pathname !== '/delivery-partner') {
            navigate('/delivery-partner', { replace: true });
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    try {
      JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
    } catch (e) {
      localStorage.removeItem('camigo_active_order');
    }
    fetchCategories();
    fetchProducts();
    setAuthReady(true);
  }, []);

  useEffect(() => {
    const target = APP_MODE === 'delivery'
      ? 'delivery'
      : APP_MODE === 'installer'
        ? 'installer'
        : user?.role === 'delivery_partner'
          ? 'delivery'
          : user?.role === 'installer'
            ? 'installer'
            : 'customer';
    let stopped = false;

    const notifyPhone = async (notice) => {
      if (!notice?.id || typeof window === 'undefined') return;
      if (localStorage.getItem(`camigo_phone_notice_${notice.id}`)) return;

      let savedUser = null;
      try {
        savedUser = JSON.parse(localStorage.getItem('user') || 'null');
      } catch (e) {}
      const savedFirstName = String(savedUser?.name || '').trim().split(/\s+/)[0] || '';
      const title = notice.personalize && savedFirstName ? `${savedFirstName}, ${notice.title}` : notice.title;
      const body = notice.personalize && savedFirstName ? `${savedFirstName}, ${notice.message}` : notice.message;
      const showNativeNotification = async () => {
        try {
          if (!Capacitor.isNativePlatform()) return false;
          let permission = await LocalNotifications.checkPermissions();
          if (permission.display !== 'granted') {
            permission = await LocalNotifications.requestPermissions();
          }
          if (permission.display !== 'granted') return false;
          await LocalNotifications.createChannel({
            id: 'camigo-admin',
            name: 'Camigo Updates',
            description: 'Product offers and order updates from Camigo',
            importance: 5,
            visibility: 1,
            sound: 'default'
          }).catch(() => {});
          if (notice.product_id) {
            localStorage.setItem(`camigo_native_notice_${notice.id}`, String(notice.product_id));
          }
          await LocalNotifications.schedule({
            notifications: [{
              id: Number(notice.id),
              title,
              body,
              channelId: 'camigo-admin',
              smallIcon: 'ic_launcher',
              extra: { product_id: notice.product_id || null }
            }]
          });
          localStorage.setItem(`camigo_phone_notice_${notice.id}`, '1');
          return true;
        } catch (e) {
          return false;
        }
      };

      const showNotification = async () => {
        if (await showNativeNotification()) return;
        try {
          const phoneNotice = new Notification(title, {
            body,
            icon: '/logo192.png',
            badge: '/favicon.ico',
            tag: `camigo-${notice.id}`
          });
          phoneNotice.onclick = () => {
            window.focus();
            if (notice.product_id) window.location.hash = `#/product/${notice.product_id}`;
            phoneNotice.close();
          };
          localStorage.setItem(`camigo_phone_notice_${notice.id}`, '1');
        } catch (e) {}
      };

      if (Capacitor.isNativePlatform()) {
        showNotification();
      } else if ('Notification' in window && Notification.permission === 'granted') {
        showNotification();
      } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') showNotification();
        }).catch(() => {});
      }
    };

    const loadNotifications = () => {
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/notifications?target=${target}&ts=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (stopped || !Array.isArray(data) || !data.length) return;
          const latest = data[0];
          if (!localStorage.getItem(`camigo_notice_${latest.id}`)) {
            setAppNotice(latest);
          }
          notifyPhone(latest);
        })
        .catch(() => {});
    };

    loadNotifications();
    const poller = setInterval(loadNotifications, 10000);
    return () => {
      stopped = true;
      clearInterval(poller);
    };
  }, [user]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let listener;
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const productId = event.notification?.extra?.product_id
        || localStorage.getItem(`camigo_native_notice_${event.notification?.id}`);
      if (productId) navigate(`/product/${productId}`);
    }).then(handle => { listener = handle; }).catch(() => {});
    return () => { listener?.remove?.(); };
  }, [navigate]);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return undefined;
    if (APP_MODE === 'installer' || user.role === 'installer') return undefined;
    let registrationListener;
    let actionListener;
    let receiveListener;
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const setupPush = async () => {
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive !== 'granted') {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== 'granted') return;

        registrationListener = await PushNotifications.addListener('registration', async (deviceToken) => {
          localStorage.setItem('camigo_fcm_token', deviceToken.value);
          await fetch(`${API_URL}/push/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              token: deviceToken.value,
              platform: 'android',
              app_target: APP_MODE === 'delivery' || user.role === 'delivery_partner'
                ? 'delivery'
                : APP_MODE === 'installer' || user.role === 'installer'
                  ? 'installer'
                  : 'customer'
            })
          }).catch(() => {});
        });
        actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const productId = event.notification?.data?.product_id;
          if (productId) navigate(`/product/${productId}`);
        });
        receiveListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          if (notification?.data?.product_id) {
            localStorage.setItem(`camigo_push_product_${notification.id || Date.now()}`, notification.data.product_id);
          }
        });
        await PushNotifications.register();
      } catch (e) {}
    };

    setupPush();
    return () => {
      registrationListener?.remove?.();
      actionListener?.remove?.();
      receiveListener?.remove?.();
    };
  }, [user, navigate]);

  useEffect(() => {
    if (!user || APP_MODE === 'delivery' || APP_MODE === 'installer' || user.role === 'delivery_partner' || user.role === 'installer') return;
    if (getSavedCustomerLocation()) return;
    captureCustomerLocation({ source: 'first-login', timeout: 8000, maximumAge: 300000 });
  }, [user]);

  const handleOrderPlaced = (order) => {
    if (isTrackableOrder({ id: order.order_id, status: order.status, payment_status: order.payment_status })) {
      const active = { id: order.order_id, address: order.address, createdAt: Date.now(), status: order.status, payment_status: order.payment_status };
      localStorage.setItem('camigo_active_order', JSON.stringify(active));
      setActiveOrder(active);
    } else {
      localStorage.removeItem('camigo_active_order');
      setActiveOrder(null);
    }
    setCartItems([]);
    localStorage.removeItem('cart_backup');
  };

  const dismissActiveOrder = () => {
    localStorage.removeItem('camigo_active_order');
    setActiveOrder(null);
  };

  useEffect(() => {
    if (user) {
      fetchCart();
      restoreActiveOrder(user);
    }
  }, [user]);

  const restoreActiveOrder = async (currentUser) => {
    if (!currentUser || ['delivery_partner', 'installer'].includes(currentUser.role)) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const saved = JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
      if (saved?.id) {
        const trackingRes = await fetch(`${API_URL}/tracking/${saved.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (trackingRes.status === 401 || trackingRes.status === 403) {
          handleAuthFailure();
          return;
        }
        const tracking = await trackingRes.json().catch(() => null);
        if (trackingRes.ok && isTrackableOrder(tracking?.order)) {
          setActiveOrder({
            ...saved,
            status: tracking.order.status,
            payment_status: tracking.order.payment_status,
            address: tracking.order.address
          });
          return;
        }
        localStorage.removeItem('camigo_active_order');
        setActiveOrder(null);
      }

      const res = await fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return;
      }
      const orders = await res.json();
      const liveOrder = Array.isArray(orders)
        ? orders.find(order => isTrackableOrder(order))
        : null;
      if (liveOrder) {
        const active = {
          id: liveOrder.id,
          address: liveOrder.address,
          status: liveOrder.status,
          payment_status: liveOrder.payment_status,
          createdAt: new Date(liveOrder.created_at).getTime() || Date.now()
        };
        localStorage.setItem('camigo_active_order', JSON.stringify(active));
        setActiveOrder(active);
      } else {
        localStorage.removeItem('camigo_active_order');
        setActiveOrder(null);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user?.role === 'delivery_partner' && location.pathname !== '/delivery-partner') {
      navigate('/delivery-partner', { replace: true });
    }
    if (user?.role === 'installer' && location.pathname !== '/installer') {
      navigate('/installer', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/categories`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const addToCart = async (product) => {
    if (APP_MODE === 'delivery' || user?.role === 'delivery_partner') {
      navigate('/delivery-partner');
      return;
    }
    if (APP_MODE === 'installer' || user?.role === 'installer') {
      navigate('/installer');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) { setLoginOpen(true); return; }
    if (cartBusyRef.current.has(Number(product.id))) return;
    setCartBusy(product.id, true);
    setCartItems(current => {
      const existing = current.find(entry => Number(entry.product_id || entry.id) === Number(product.id));
      if (existing) {
        return current.map(entry => Number(entry.product_id || entry.id) === Number(product.id)
          ? { ...entry, quantity: Number(entry.quantity || 0) + 1 }
          : entry);
      }
      return [...current, { ...product, product_id: product.id, quantity: 1 }];
    });
    try {
      const res = await fetch(`${API_URL}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ product_id: product.id, quantity: 1 })
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure('Your login timed out, so the product could not be added. Please login again.');
        return;
      }
      if (!res.ok) throw new Error('Cart add failed');
      await new Promise(resolve => setTimeout(resolve, 180));
      await fetchCart({ preserveBusy: false });
    } catch (e) {
      await fetchCart({ preserveBusy: false });
    } finally {
      setCartBusy(product.id, false);
    }
  };

  const removeFromCart = async (product, cartItem) => {
    if (APP_MODE === 'delivery' || APP_MODE === 'installer' || user?.role === 'delivery_partner' || user?.role === 'installer') return;
    const token = localStorage.getItem('token');
    if (!token) { setLoginOpen(true); return; }
    const item = cartItem || cartItems.find(entry => Number(entry.product_id || entry.id) === Number(product.id));
    if (cartBusyRef.current.has(Number(product.id))) return;
    if (!item?.id) return;
    setCartBusy(product.id, true);
    const nextQty = Number(item.quantity || 0) - 1;
    setCartItems(current => current
      .map(entry => Number(entry.product_id || entry.id) === Number(product.id)
        ? { ...entry, quantity: nextQty }
        : entry)
      .filter(entry => Number(entry.quantity || 0) > 0));
    try {
      if (nextQty <= 0) {
        const res = await fetch(`${API_URL}/cart/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          handleAuthFailure('Your login timed out, so the cart could not be updated. Please login again.');
          return;
        }
        if (!res.ok) throw new Error('Cart remove failed');
      } else {
        const res = await fetch(`${API_URL}/cart/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity: nextQty })
        });
        if (res.status === 401 || res.status === 403) {
          handleAuthFailure('Your login timed out, so the cart could not be updated. Please login again.');
          return;
        }
        if (!res.ok) throw new Error('Cart update failed');
      }
      await new Promise(resolve => setTimeout(resolve, 180));
      await fetchCart({ preserveBusy: false });
    } catch (e) {
      await fetchCart({ preserveBusy: false });
    } finally {
      setCartBusy(product.id, false);
    }
  };

  const fetchCart = async ({ preserveBusy = true } = {}) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure('Your login timed out. Please login again to restore your cart.');
        return;
      }
      const data = await res.json();
      const safeData = Array.isArray(data) ? data : [];
      setCartItems(current => {
        if (!preserveBusy || !cartBusyRef.current.size) return safeData;
        const serverMap = new Map(safeData.map(item => [Number(item.product_id || item.id), item]));
        const busyIds = cartBusyRef.current;
        const merged = [];

        current.forEach(item => {
          const productId = Number(item.product_id || item.id);
          if (busyIds.has(productId)) merged.push(item);
          else if (serverMap.has(productId)) merged.push(serverMap.get(productId));
        });

        safeData.forEach(item => {
          const productId = Number(item.product_id || item.id);
          if (!busyIds.has(productId) && !merged.find(entry => Number(entry.product_id || entry.id) === productId)) {
            merged.push(item);
          }
        });

        return merged;
      });
    } catch (e) {}
  };

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    updateUserState(data.user);
    setLoginOpen(false);
    if (APP_MODE === 'delivery' || data.user?.role === 'delivery_partner') {
      navigate('/delivery-partner', { replace: true });
    } else if (APP_MODE === 'installer' || data.user?.role === 'installer') {
      navigate('/installer', { replace: true });
    }
  };

  const handleLogout = () => {
    clearSessionState();
  };

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity), 0);
  const trendingSearches = ['AHD camera', 'IP camera', 'DVR', 'NVR', 'POE switch', 'SMPS'];
  const searchSuggestions = searchQuery.trim()
    ? Array.from(new Set([
        ...products
          .map(product => product.name)
          .filter(Boolean)
          .filter(name => String(name).toLowerCase().includes(searchQuery.toLowerCase())),
        ...categories
          .map(category => category.name)
          .filter(Boolean)
          .filter(name => String(name).toLowerCase().includes(searchQuery.toLowerCase()))
      ])).slice(0, 8)
    : [];
  const firstName = String(user?.name || '').trim().split(/\s+/)[0] || '';
  const noticeTitle = appNotice?.personalize && firstName ? `${firstName}, ${appNotice.title}` : appNotice?.title;
  const noticeMessage = appNotice?.personalize && firstName ? `${firstName}, ${appNotice.message}` : appNotice?.message;
  const handleNoticeOpen = () => {
    if (appNotice?.product_id) {
      navigate(`/product/${appNotice.product_id}`);
    }
  };
  const requestPhoneAlerts = (event) => {
    event?.stopPropagation?.();
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    Notification.requestPermission()
      .then(permission => setNotificationPermission(permission))
      .catch(() => {});
  };
  const dismissNotice = (event) => {
    event?.stopPropagation?.();
    if (appNotice?.id && /^\d+$/.test(String(appNotice.id))) localStorage.setItem(`camigo_notice_${appNotice.id}`, '1');
    setAppNotice(null);
  };
  const showEnablePhoneAlerts = notificationPermission === 'default';
  const renderAppNotice = () => appNotice && (
    <div className={appNotice.product_id ? 'app-notice clickable' : 'app-notice'} onClick={handleNoticeOpen}>
      <div className="app-notice-icon">{(noticeTitle || 'C').charAt(0)}</div>
      <div className="app-notice-body">
        <strong>{noticeTitle}</strong>
        <span>{noticeMessage}</span>
        {appNotice.image_url && <img className="app-notice-image" src={appNotice.image_url} alt={noticeTitle || 'Notification'} />}
        {appNotice.product_id && <small>Tap to view product</small>}
      </div>
      <div className="app-notice-actions">
        {showEnablePhoneAlerts && <button className="notice-enable" onClick={requestPhoneAlerts}>Enable alerts</button>}
        <button onClick={dismissNotice}>Close</button>
      </div>
    </div>
  );

  if (APP_MODE === 'delivery') {
    return (
      <div className="app delivery-app-shell">
        <Header
          user={user}
          cartCount={0}
          onCartClick={() => {}}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
          searchQuery=""
          onSearch={() => {}}
          appMode={APP_MODE}
        />
        <Routes>
          <Route path="*" element={<DeliveryPartnerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
        </Routes>
        {renderAppNotice()}
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      </div>
    );
  }

  if (APP_MODE === 'installer') {
    return (
      <div className="app delivery-app-shell installer-app-shell">
        <Header
          user={user}
          cartCount={0}
          onCartClick={() => {}}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
          searchQuery=""
          onSearch={() => {}}
          appMode={APP_MODE}
        />
        <Routes>
          <Route path="*" element={<InstallerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
        </Routes>
        {renderAppNotice()}
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className={`app ${APP_MODE === 'customer' ? 'customer-app-shell' : ''}`}>
      <Header
        user={user}
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        appMode={APP_MODE}
        searchSuggestions={searchSuggestions}
        trendingSearches={trendingSearches}
      />

      <Routes>
        <Route path="/" element={
          <DeliveryOnlyRoute user={user}>
            <MainPage
              user={user} cartCount={cartCount} onCartClick={() => setCartOpen(true)}
              onLoginClick={() => setLoginOpen(true)} onLogout={handleLogout}
              cartItems={cartItems} addToCart={addToCart}
              removeFromCart={removeFromCart}
              products={products} categories={categories}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            />
          </DeliveryOnlyRoute>
        } />
        <Route path="/product/:id" element={<DeliveryOnlyRoute user={user}><ProductDetail products={products} onAdd={addToCart} onRemove={removeFromCart} cartItems={cartItems} user={user} onLogin={() => setLoginOpen(true)} priceForRole={priceForRole} /></DeliveryOnlyRoute>} />
        <Route path="/category/:id" element={<DeliveryOnlyRoute user={user}><CategoryPage categories={categories} products={products} onAdd={addToCart} onRemove={removeFromCart} user={user} priceForRole={priceForRole} cartItems={cartItems} /></DeliveryOnlyRoute>} />
        <Route path="/orders" element={<DeliveryOnlyRoute user={user}><OrdersPage user={user} onLogin={() => setLoginOpen(true)} onUserUpdate={updateUserState} /></DeliveryOnlyRoute>} />
        <Route path="/install" element={<DeliveryOnlyRoute user={user}><InstallationPage user={user} onLogin={() => setLoginOpen(true)} /></DeliveryOnlyRoute>} />
        <Route path="/dealer" element={<DealerDashboard user={user} />} />
        <Route path="/distributor" element={<DealerDashboard user={user} />} />
        <Route path="/contact" element={<ContactPage user={user} />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/admin" element={<AdminPage user={user} />} />
        <Route path="/shop" element={<DeliveryOnlyRoute user={user}><ShopPage products={products} categories={categories} onAdd={addToCart} onRemove={removeFromCart} user={user} priceForRole={priceForRole} cartItems={cartItems} /></DeliveryOnlyRoute>} />
        <Route path="/checkout" element={<DeliveryOnlyRoute user={user}><CheckoutPage user={user} liveCartItems={cartItems} onLogin={() => setLoginOpen(true)} onOrderPlaced={handleOrderPlaced} onUserUpdate={updateUserState} /></DeliveryOnlyRoute>} />
        <Route path="/tracking/:id" element={<TrackingPage />} />
        <Route path="/delivery-partner" element={<DeliveryPartnerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
        <Route path="/installer" element={<InstallerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
      </Routes>

      <CartDrawer
        open={APP_MODE !== 'delivery' && APP_MODE !== 'installer' && user?.role !== 'delivery_partner' && user?.role !== 'installer' && cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        total={cartTotal}
        onUpdate={fetchCart}
        onAdd={addToCart}
        onRemove={removeFromCart}
        user={user}
      />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      {renderAppNotice()}
      {activeOrder?.id && (
        <FloatingTracker
          activeOrder={activeOrder}
          onDismiss={dismissActiveOrder}
          onRate={dismissActiveOrder}
        />
      )}
      {APP_MODE !== 'delivery' && APP_MODE !== 'installer' && user?.role !== 'delivery_partner' && user?.role !== 'installer' && !activeOrder?.id && (
        <FloatingCheckoutBar cartCount={cartCount} cartTotal={cartTotal} cartItems={cartItems} onCartClick={() => setCartOpen(true)} />
      )}
      {APP_MODE !== 'delivery' && APP_MODE !== 'installer' && user?.role !== 'delivery_partner' && user?.role !== 'installer' && <BottomNav cartCount={cartCount} onCartClick={() => setCartOpen(true)} user={user} />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

export default App;
