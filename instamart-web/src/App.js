import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import DealerDashboard from './components/DealerDashboard';
import InstallationPage from './components/InstallationPage';
import ShopPage from './components/ShopPage';
import CheckoutPage from './components/CheckoutPage';
import CategoryPage from './components/CategoryPage';
import TrackingPage from './components/TrackingPage';
import DeliveryPartnerPage from './components/DeliveryPartnerPage';
import LocationDeliveryStrip from './components/LocationDeliveryStrip';
import FloatingTracker from './components/FloatingTracker';
import FloatingCheckoutBar from './components/FloatingCheckoutBar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import { API_URL } from './api';
import { captureCustomerLocation, getSavedCustomerLocation } from './locationLock';
import './App.css';

const getRuntimeAppMode = () => {
  const buildMode = process.env.REACT_APP_APP_MODE;
  if (buildMode) return buildMode;

  if (typeof window === 'undefined') return 'web';
  const mode = new URLSearchParams(window.location.search).get('app');
  if (mode === 'customer' || mode === 'delivery') return mode;
  return 'web';
};

const APP_MODE = getRuntimeAppMode();

function DeliveryOnlyRoute({ user, children }) {
  useEffect(() => {
    if (user?.role === 'delivery_partner') {
      window.location.hash = '#/delivery-partner';
    }
  }, [user]);

  if (user?.role === 'delivery_partner') {
    return <DeliveryPartnerPage user={user} authReady={true} onLogin={() => {}} />;
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart_backup');
    window.location.href = '/';
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

function MainPage({ user, cartCount, onCartClick, onLoginClick, onLogout, cartItems, addToCart, products, categories, searchQuery, setSearchQuery }) {
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
          <ProductSection title={`Search: "${searchQuery}"`} products={filteredProducts} onAdd={addToCart} user={user} cartItems={cartItems} />
        ) : (
          productsByCategory.map(cat => (
            <ProductSection key={cat.id} title={cat.name} products={cat.products} onAdd={addToCart} user={user} cartItems={cartItems} />
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser);
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
      const savedOrder = JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
      if (savedOrder?.id) setActiveOrder(savedOrder);
    } catch (e) {
      localStorage.removeItem('camigo_active_order');
    }
    fetchCategories();
    fetchProducts();
    setAuthReady(true);
  }, []);

  useEffect(() => {
    const target = APP_MODE === 'delivery' ? 'delivery' : 'customer';
    fetch(`${API_URL}/notifications?target=${target}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!Array.isArray(data) || !data.length) return;
        const latest = data[0];
        if (localStorage.getItem(`camigo_notice_${latest.id}`)) return;
        setAppNotice(latest);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || APP_MODE === 'delivery' || user.role === 'delivery_partner') return;
    if (getSavedCustomerLocation()) return;
    captureCustomerLocation({ source: 'first-login', timeout: 8000, maximumAge: 300000 });
  }, [user]);

  const handleOrderPlaced = (order) => {
    const active = { id: order.order_id, address: order.address, createdAt: Date.now() };
    localStorage.setItem('camigo_active_order', JSON.stringify(active));
    setActiveOrder(active);
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
    if (!currentUser || currentUser.role === 'delivery_partner') return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const saved = JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
      if (saved?.id) {
        const trackingRes = await fetch(`${API_URL}/tracking/${saved.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const tracking = await trackingRes.json().catch(() => null);
        if (trackingRes.ok && tracking?.order?.status !== 'delivered') {
          setActiveOrder({ ...saved, status: tracking.order.status, address: tracking.order.address });
          return;
        }
      }

      const res = await fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const orders = await res.json();
      const liveOrder = Array.isArray(orders)
        ? orders.find(order => !['delivered', 'cancelled', 'rejected'].includes(order.status))
        : null;
      if (liveOrder) {
        const active = { id: liveOrder.id, address: liveOrder.address, status: liveOrder.status, createdAt: new Date(liveOrder.created_at).getTime() || Date.now() };
        localStorage.setItem('camigo_active_order', JSON.stringify(active));
        setActiveOrder(active);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user?.role === 'delivery_partner' && location.pathname !== '/delivery-partner') {
      navigate('/delivery-partner', { replace: true });
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
    const token = localStorage.getItem('token');
    if (!token) { setLoginOpen(true); return; }
    try {
      await fetch(`${API_URL}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ product_id: product.id, quantity: 1 })
      });
      fetchCart();
    } catch (e) {}
  };

  const fetchCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setCartItems(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setLoginOpen(false);
    if (APP_MODE === 'delivery' || data.user?.role === 'delivery_partner') {
      navigate('/delivery-partner', { replace: true });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity), 0);

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
        {appNotice && <div className="app-notice"><strong>{appNotice.title}</strong><span>{appNotice.message}</span><button onClick={() => { localStorage.setItem(`camigo_notice_${appNotice.id}`, '1'); setAppNotice(null); }}>Close</button></div>}
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
      />

      <Routes>
        <Route path="/" element={
          <DeliveryOnlyRoute user={user}>
            <MainPage
              user={user} cartCount={cartCount} onCartClick={() => setCartOpen(true)}
              onLoginClick={() => setLoginOpen(true)} onLogout={handleLogout}
              cartItems={cartItems} addToCart={addToCart}
              products={products} categories={categories}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            />
          </DeliveryOnlyRoute>
        } />
        <Route path="/product/:id" element={<DeliveryOnlyRoute user={user}><ProductDetail products={products} onAdd={addToCart} user={user} onLogin={() => setLoginOpen(true)} priceForRole={priceForRole} /></DeliveryOnlyRoute>} />
        <Route path="/category/:id" element={<DeliveryOnlyRoute user={user}><CategoryPage categories={categories} products={products} onAdd={addToCart} user={user} priceForRole={priceForRole} cartItems={cartItems} /></DeliveryOnlyRoute>} />
        <Route path="/orders" element={<DeliveryOnlyRoute user={user}><OrdersPage user={user} onLogin={() => setLoginOpen(true)} /></DeliveryOnlyRoute>} />
        <Route path="/install" element={<DeliveryOnlyRoute user={user}><InstallationPage user={user} onLogin={() => setLoginOpen(true)} /></DeliveryOnlyRoute>} />
        <Route path="/dealer" element={<DealerDashboard user={user} />} />
        <Route path="/distributor" element={<DealerDashboard user={user} />} />
        <Route path="/contact" element={<ContactPage user={user} />} />
        <Route path="/admin" element={<AdminPage user={user} />} />
        <Route path="/shop" element={<DeliveryOnlyRoute user={user}><ShopPage products={products} categories={categories} onAdd={addToCart} user={user} priceForRole={priceForRole} cartItems={cartItems} /></DeliveryOnlyRoute>} />
        <Route path="/checkout" element={<DeliveryOnlyRoute user={user}><CheckoutPage user={user} onLogin={() => setLoginOpen(true)} onOrderPlaced={handleOrderPlaced} /></DeliveryOnlyRoute>} />
        <Route path="/tracking/:id" element={<TrackingPage />} />
        <Route path="/delivery-partner" element={<DeliveryPartnerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
      </Routes>

      <CartDrawer
        open={APP_MODE !== 'delivery' && user?.role !== 'delivery_partner' && cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        total={cartTotal}
        onUpdate={fetchCart}
        user={user}
      />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      {appNotice && <div className="app-notice"><strong>{appNotice.title}</strong><span>{appNotice.message}</span><button onClick={() => { localStorage.setItem(`camigo_notice_${appNotice.id}`, '1'); setAppNotice(null); }}>Close</button></div>}
      <FloatingTracker
        activeOrder={activeOrder}
        onDismiss={dismissActiveOrder}
        onRate={dismissActiveOrder}
      />
      {APP_MODE !== 'delivery' && user?.role !== 'delivery_partner' && !activeOrder?.id && (
        <FloatingCheckoutBar cartCount={cartCount} cartTotal={cartTotal} onCartClick={() => setCartOpen(true)} />
      )}
      {APP_MODE !== 'delivery' && user?.role !== 'delivery_partner' && <BottomNav cartCount={cartCount} onCartClick={() => setCartOpen(true)} user={user} />}
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
