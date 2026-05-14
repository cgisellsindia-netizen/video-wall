import React, { Suspense, lazy, useMemo, useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import Header from './components/Header';
import ProductSection from './components/ProductSection';
import CartDrawer from './components/CartDrawer';
import LoginModal from './components/LoginModal';
import FloatingTracker from './components/FloatingTracker';
import FloatingCheckoutBar from './components/FloatingCheckoutBar';
import BottomNav from './components/BottomNav';
import FaqSection from './components/FaqSection';
import SeoSignalBlock from './components/SeoSignalBlock';
import { HomepageBlocks } from './components/PageBuilderRenderer';
import { API_URL } from './api';
import { localSeoPages } from './localSeoPages';
import { captureCustomerLocation, getSavedCustomerAreaName, getSavedCustomerLocation, resolveCustomerAreaName, saveCustomerAreaName, saveCustomerLocation } from './locationLock';
import { isTrackableOrder } from './orderTracking';
import { getDeliveryEstimate } from './deliveryZone';
import { DEFAULT_PAGE_CONTENT, normalizePageContent } from './pageBuilder';
import usePageSeo from './usePageSeo';
import './App.css';

const ProductDetail = lazy(() => import('./components/ProductDetail'));
const OrdersPage = lazy(() => import('./components/OrdersPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ShippingPolicyPage = lazy(() => import('./components/ShippingPolicyPage'));
const PrivacyPolicyPage = lazy(() => import('./components/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./components/TermsOfServicePage'));
const ReturnsPolicyPage = lazy(() => import('./components/ReturnsPolicyPage'));
const InstallationPolicyPage = lazy(() => import('./components/InstallationPolicyPage'));
const DealerDashboard = lazy(() => import('./components/DealerDashboard'));
const InstallationPage = lazy(() => import('./components/InstallationPage'));
const ShopPage = lazy(() => import('./components/ShopPage'));
const CheckoutPage = lazy(() => import('./components/CheckoutPage'));
const CategoryPage = lazy(() => import('./components/CategoryPage'));
const TrackingPage = lazy(() => import('./components/TrackingPage'));
const DeliveryPartnerPage = lazy(() => import('./components/DeliveryPartnerPage'));
const InstallerPage = lazy(() => import('./components/InstallerPage'));
const SavedItemsPage = lazy(() => import('./components/SavedItemsPage'));
const LocalSeoLandingPage = lazy(() => import('./components/LocalSeoLandingPage'));

const getRuntimeAppMode = () => {
  const buildMode = process.env.REACT_APP_APP_MODE;
  if (buildMode) return buildMode;

  if (typeof window === 'undefined') return 'web';
  const mode = new URLSearchParams(window.location.search).get('app');
  if (mode === 'customer' || mode === 'delivery' || mode === 'installer') return mode;
  return 'web';
};

const APP_MODE = getRuntimeAppMode();

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return null;
    const parsedUser = JSON.parse(rawUser);
    return parsedUser && typeof parsedUser === 'object' ? parsedUser : null;
  } catch (error) {
    return null;
  }
};

function DeliveryOnlyRoute({ user, children }) {
  if (user?.role === 'delivery_partner') {
    return <Navigate to="/delivery-partner" replace />;
  }
  if (user?.role === 'installer') {
    return <Navigate to="/installer" replace />;
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
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    Object.keys(localStorage)
      .filter(key => key.startsWith('camigo') || key === 'cart_backup')
      .forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    if (savedToken) localStorage.setItem('token', savedToken);
    if (savedUser) localStorage.setItem('user', savedUser);
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {});
    }
    const params = new URLSearchParams(window.location.search);
    params.set('reset', String(Date.now()));
    window.location.replace(`${window.location.pathname}?${params.toString()}`);
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

const isSetupProduct = (product = {}) => {
  const unit = String(product.unit || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const description = String(product.description || '').toLowerCase();
  return unit.includes('setup')
    || name.includes('setup')
    || description.includes('setup package');
};

const normalizeSearchText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const levenshteinDistance = (left = '', right = '') => {
  const a = String(left);
  const b = String(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      );
    }
  }
  return matrix[a.length][b.length];
};

const getSearchTokens = (value = '') => normalizeSearchText(value).split(' ').filter(Boolean);

const getTokenSimilarity = (queryToken, candidateToken) => {
  if (!queryToken || !candidateToken) return 0;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return 0.96;
  const distance = levenshteinDistance(queryToken, candidateToken);
  const maxLength = Math.max(queryToken.length, candidateToken.length);
  if (!maxLength) return 0;
  return Math.max(0, 1 - (distance / maxLength));
};

const getSearchScore = (query, candidate) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 200;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 160;
  if (normalizedCandidate.includes(normalizedQuery)) return 140;

  const queryTokens = getSearchTokens(normalizedQuery);
  const candidateTokens = getSearchTokens(normalizedCandidate);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  let score = 0;
  for (const queryToken of queryTokens) {
    let bestTokenScore = 0;
    for (const candidateToken of candidateTokens) {
      bestTokenScore = Math.max(bestTokenScore, getTokenSimilarity(queryToken, candidateToken));
    }
    score += bestTokenScore;
  }

  const averageScore = score / queryTokens.length;
  const tightLengthBonus = Math.max(0, 0.18 - (Math.abs(normalizedCandidate.length - normalizedQuery.length) * 0.01));
  return averageScore + tightLengthBonus;
};

const getProductSearchText = (product = {}) => [
  product.name,
  product.description,
  product.unit,
  product.category_name
].filter(Boolean).join(' ');

function MainPage({
  user,
  cartCount,
  onCartClick,
  onLoginClick,
  onLogout,
  cartItems,
  addToCart,
  removeFromCart,
  products,
  categories,
  searchQuery,
  setSearchQuery,
  recentProducts = [],
  recommendedProducts = [],
  bestsellingProducts = [],
  savedProducts = [],
  savedProductIds = [],
  onToggleSaved,
  deliveryEtaLabel = '16 mins',
  pageContent = DEFAULT_PAGE_CONTENT,
  seoAutomationSnapshot = null
}) {
  const setupProducts = useMemo(
    () => products.filter((product) => isSetupProduct(product)),
    [products]
  );
  const regularProducts = useMemo(
    () => products.filter((product) => !isSetupProduct(product)),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return regularProducts;

    return regularProducts
      .map((product) => ({
        product,
        score: getSearchScore(normalizedQuery, getProductSearchText(product))
      }))
      .filter(({ score }) => score >= 0.54 || Number(score) >= 140)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        const ratingDelta = Number(right.product.rating_average || 0) - Number(left.product.rating_average || 0);
        if (ratingDelta !== 0) return ratingDelta;
        return Number(right.product.rating_count || 0) - Number(left.product.rating_count || 0);
      })
      .map(({ product }) => product);
  }, [regularProducts, searchQuery]);

  const productsByCategory = categories.map(cat => ({
    ...cat,
    products: filteredProducts.filter(p => p.category_id === cat.id)
  })).filter(c => c.products.length > 0);
  const homepageHasCategoryFeeds = Boolean(
    pageContent?.homepage?.blocks?.some((block) => block?.visible !== false && block?.type === 'category_feeds')
  );
  const featuredHomepageProducts = useMemo(() => {
    const ordered = [
      ...recommendedProducts,
      ...bestsellingProducts,
      ...recentProducts,
      ...regularProducts
    ];
    const seen = new Set();
    return ordered.filter((product) => {
      const id = Number(product?.id || 0);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 10);
  }, [recommendedProducts, bestsellingProducts, recentProducts, regularProducts]);
  const featuredHomepageCategories = useMemo(
    () => categories
      .filter((category) => regularProducts.some((product) => Number(product.category_id) === Number(category.id)))
      .slice(0, 8),
    [categories, regularProducts]
  );
  const homepageFaqs = useMemo(() => ([
    {
      question: 'What can I buy on Camigo?',
      answer: 'Camigo offers CCTV cameras, DVRs, NVRs, PoE switches, accessories, SMPS units, and complete setup packages for homes, shops, offices, and installers.'
    },
    {
      question: 'Does Camigo support installation?',
      answer: 'Yes. Camigo supports CCTV installation workflows and setup coordination for eligible service areas, depending on location and order type.'
    },
    {
      question: 'How is delivery time decided?',
      answer: 'Delivery timing depends on the customer location, product availability, and whether the order qualifies for local fast dispatch or courier fulfillment.'
    },
    {
      question: 'Can dealers or distributors order from Camigo?',
      answer: 'Yes. Camigo supports dealer and distributor-style buying flows with trade-friendly product sourcing and support.'
    }
  ]), []);
  const localSeoTopics = useMemo(() => localSeoPages.map((page) => ({
    label: page.label,
    to: `/${page.slug}`
  })), []);

  usePageSeo({
    title: 'CCTV Camera in Bhubaneswar | CCTV Installation in Odisha | Camigo',
    description: 'Buy CCTV cameras in Bhubaneswar and Odisha with Camigo. Shop IP cameras, dome cameras, bullet cameras, PTZ cameras, DVRs, NVRs, PoE switches, and get CCTV installation support in Bhubaneswar.',
    canonicalUrl: 'https://getcamigo.in/',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': 'https://getcamigo.in/#website',
          url: 'https://getcamigo.in/',
          name: 'Camigo',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://getcamigo.in/shop?search={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'CollectionPage',
          '@id': 'https://getcamigo.in/#homepage',
          url: 'https://getcamigo.in/',
          name: 'Camigo CCTV Cameras Bhubaneswar Odisha',
          description: 'CCTV camera dealer and installation support page for Bhubaneswar and Odisha with IP cameras, PTZ cameras, DVRs, NVRs, switches, and accessories.',
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: featuredHomepageProducts.map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `https://getcamigo.in/product/${product.id}`,
              name: product.name
            }))
          }
        },
        {
          '@type': 'FAQPage',
          mainEntity: homepageFaqs.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer
            }
          }))
        },
        {
          '@type': 'LocalBusiness',
          name: 'Camigo',
          url: 'https://getcamigo.in/',
          image: 'https://getcamigo.in/camigo-logo.svg',
          description: 'CCTV camera shop, CCTV dealer, and CCTV installation support service for Bhubaneswar and Odisha.',
          areaServed: ['Bhubaneswar', 'Odisha', 'Cuttack', 'Khordha'],
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Swarnapuri Rd, Bajrang Vihar, Patia',
            addressLocality: 'Bhubaneswar',
            addressRegion: 'Odisha',
            postalCode: '751024',
            addressCountry: 'IN'
          }
        }
      ]
    }
  });

  return (
    <>
      <main className="main-content">
        {!searchQuery && (
          <HomepageBlocks
            pageContent={pageContent}
            categories={categories}
            setupProducts={setupProducts}
            recentProducts={recentProducts}
            savedProducts={savedProducts}
            recommendedProducts={recommendedProducts}
            bestsellingProducts={bestsellingProducts}
            regularProducts={regularProducts}
            cartItems={cartItems}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            user={user}
            savedProductIds={savedProductIds}
            onToggleSaved={onToggleSaved}
            deliveryEtaLabel={deliveryEtaLabel}
          />
        )}
        {searchQuery ? (
          filteredProducts.length ? (
            <ProductSection title={`Search: "${searchQuery}"`} products={filteredProducts} onAdd={addToCart} onRemove={removeFromCart} user={user} cartItems={cartItems} savedProductIds={savedProductIds} onToggleSaved={onToggleSaved} sectionTone="soft" deliveryEtaLabel={deliveryEtaLabel} />
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
          homepageHasCategoryFeeds ? null : productsByCategory.map(cat => (
            <ProductSection key={cat.id} title={cat.name} categoryId={cat.id} products={cat.products} onAdd={addToCart} onRemove={removeFromCart} user={user} cartItems={cartItems} savedProductIds={savedProductIds} onToggleSaved={onToggleSaved} sectionTone="neutral" deliveryEtaLabel={deliveryEtaLabel} />
          ))
        )}
        {!searchQuery && (
          <section className="category-section">
            <div className="seo-link-hub">
              <div className="section-header">
                <h2 className="section-title">Explore Camigo Categories and Products</h2>
              </div>
              <p className="seo-link-hub-copy">
                Browse priority CCTV categories and product pages directly from the homepage for faster discovery by customers and search engines.
              </p>
              <div className="seo-link-hub-grid">
                <div className="seo-link-group">
                  <h3>Popular Categories</h3>
                  <div className="seo-link-list">
                    {featuredHomepageCategories.map((category) => (
                      <Link key={category.id} to={`/category/${category.id}`} className="seo-link-chip">
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="seo-link-group">
                  <h3>Featured Product Pages</h3>
                  <div className="seo-link-list">
                    {featuredHomepageProducts.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`} className="seo-link-chip subtle">
                        {product.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        {!searchQuery && (
          <section className="category-section">
            <div className="seo-link-hub local-seo-hub">
              <div className="section-header">
                <h2 className="section-title">CCTV Cameras and Installation in Bhubaneswar and Odisha</h2>
              </div>
              <p className="seo-link-hub-copy">
                Camigo serves customers searching for CCTV cameras in Bhubaneswar, CCTV installation in Bhubaneswar,
                security camera installation in Odisha, IP camera dealers, PTZ camera suppliers, DVR and NVR dealers,
                and complete CCTV setup packages for homes, offices, shops, apartments, and warehouses.
              </p>
              <div className="local-seo-topic-list">
                {localSeoTopics.map((topic) => (
                  <Link key={topic.label} to={topic.to} className="seo-link-chip subtle">{topic.label}</Link>
                ))}
              </div>
            </div>
          </section>
        )}
        {!searchQuery && <SeoSignalBlock snapshot={seoAutomationSnapshot} />}
        {!searchQuery && (
          <section className="category-section">
            <FaqSection
              title="Camigo CCTV Buying FAQs"
              eyebrow="Help before you buy"
              items={homepageFaqs}
            />
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="route-loading-shell" aria-live="polite">
      <div className="route-loading-card">
        <span className="route-loading-eyebrow">Camigo</span>
        <strong>Loading page...</strong>
      </div>
    </div>
  );
}

function AppContent() {
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [user, setUser] = useState(() => getStoredUser());
  const [locationLabel, setLocationLabel] = useState(() => getSavedCustomerAreaName() || 'Bhubaneswar, Odisha');
  const [deliveryEtaLabel, setDeliveryEtaLabel] = useState('16 mins');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [appNotice, setAppNotice] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [pageContent, setPageContent] = useState(DEFAULT_PAGE_CONTENT);
  const [seoAutomationSnapshot, setSeoAutomationSnapshot] = useState(null);
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

  const handleLocationChange = async ({ lat, lng, areaName, source = 'manual' } = {}) => {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    const savedLocation = saveCustomerLocation({
      lat: Number(lat),
      lng: Number(lng),
      accuracy: 0,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      source,
      savedAt: Date.now()
    });
    const resolvedArea = areaName || await resolveCustomerAreaName(savedLocation);
    if (resolvedArea) {
      saveCustomerAreaName(resolvedArea);
      setLocationLabel(resolvedArea);
    }
    setDeliveryEtaLabel(getDeliveryEstimate(savedLocation).label);
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
    if (!token) return null;
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return null;
      }
      const data = await res.json();
      const nextUser = data?.user?.id ? data.user : (res.ok && data?.id ? data : null);
      if (nextUser) {
        updateUserState(nextUser);
        return nextUser;
      }
    } catch (e) {}
    return referenceUser || null;
  };

  const fetchCustomerOrders = async (referenceUser = user) => {
    if (!referenceUser || ['delivery_partner', 'installer', 'admin'].includes(String(referenceUser.role || ''))) {
      setCustomerOrders([]);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) return;
      const data = await res.json().catch(() => []);
      setCustomerOrders(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const fetchSavedItems = async (referenceUser = user) => {
    if (!referenceUser || ['delivery_partner', 'installer', 'admin'].includes(String(referenceUser.role || ''))) {
      setSavedItems([]);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/account/saved-items`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) return;
      const data = await res.json().catch(() => []);
      setSavedItems(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const fetchPageContent = async () => {
    try {
      const res = await fetch(`${API_URL}/page-content`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPageContent(normalizePageContent(data));
    } catch (e) {}
  };

  const fetchSeoAutomationSnapshot = async () => {
    try {
      const res = await fetch(`${API_URL}/seo-automation`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSeoAutomationSnapshot(data);
    } catch (e) {}
  };

  const setCartBusy = (productId, busy) => {
    const value = Number(productId);
    if (!Number.isFinite(value)) return;
    if (busy) cartBusyRef.current.add(value);
    else cartBusyRef.current.delete(value);
  };

  useEffect(() => {
    let stopped = false;

    const bootstrapApp = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      let parsedUser = null;

      if (savedUser) {
        try {
          const candidate = JSON.parse(savedUser);
          if (candidate && typeof candidate === 'object') parsedUser = candidate;
          else localStorage.removeItem('user');
        } catch (e) {
          localStorage.removeItem('user');
        }
      }

        if (parsedUser && !stopped) {
          setUser(parsedUser);
        }

      if (token) {
        const restoredUser = await refreshCurrentUser(parsedUser);
        if (!stopped && restoredUser?.role === 'delivery_partner' && location.pathname !== '/delivery-partner') {
          navigate('/delivery-partner', { replace: true });
        } else if (!stopped && restoredUser?.role === 'installer' && location.pathname !== '/installer') {
          navigate('/installer', { replace: true });
        }
      }

      try {
        JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
      } catch (e) {
        localStorage.removeItem('camigo_active_order');
      }

      fetchCategories();
      fetchProducts();
      fetchPageContent();
      fetchSeoAutomationSnapshot();
      if (!stopped) setAuthReady(true);
    };

    bootstrapApp();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    fetchSeoAutomationSnapshot();
  }, []);

  useEffect(() => {
    const pollMs = 60 * 1000;
    const intervalId = window.setInterval(() => {
      fetchSeoAutomationSnapshot();
    }, pollMs);

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchSeoAutomationSnapshot();
      }
    };

    window.addEventListener('focus', fetchSeoAutomationSnapshot);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchSeoAutomationSnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
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
            if (notice.product_id) window.location.assign(`/product/${notice.product_id}`);
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
    if (!user || APP_MODE === 'delivery' || APP_MODE === 'installer' || user.role === 'delivery_partner' || user.role === 'installer') return undefined;
    if (getSavedCustomerLocation()) return undefined;
    let active = true;
    captureCustomerLocation({ source: 'first-login', timeout: 8000, maximumAge: 300000 })
      .then(async (savedLocation) => {
        if (!active || !savedLocation?.lat || !savedLocation?.lng) return;
        const resolvedArea = await resolveCustomerAreaName(savedLocation);
        if (active && resolvedArea) setLocationLabel(resolvedArea);
        if (active) setDeliveryEtaLabel(getDeliveryEstimate(savedLocation).label);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (APP_MODE === 'delivery' || APP_MODE === 'installer') return undefined;
    let active = true;
    const syncLocationLabel = async () => {
      const savedArea = getSavedCustomerAreaName();
      if (savedArea && active) setLocationLabel(savedArea);
      const savedLocation = getSavedCustomerLocation();
      if (!savedLocation?.lat || !savedLocation?.lng) {
        if (active) setDeliveryEtaLabel('16 mins');
        const detectedLocation = await captureCustomerLocation({ source: 'header-auto', timeout: 8000, maximumAge: 300000 });
        if (!active || !detectedLocation?.lat || !detectedLocation?.lng) return;
        const detectedArea = await resolveCustomerAreaName(detectedLocation);
        if (active && detectedArea) setLocationLabel(detectedArea);
        if (active) setDeliveryEtaLabel(getDeliveryEstimate(detectedLocation).label);
        return;
      }
      if (active) setDeliveryEtaLabel(getDeliveryEstimate(savedLocation).label);
      const resolvedArea = await resolveCustomerAreaName(savedLocation);
      if (active && resolvedArea) setLocationLabel(resolvedArea);
    };
    syncLocationLabel();
    const onStorage = () => { syncLocationLabel(); };
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
    };
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
      fetchCustomerOrders(user);
      fetchSavedItems(user);
    } else {
      setCustomerOrders([]);
      setSavedItems([]);
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
    setSavedItems([]);
  };

  const toggleSavedItem = async (product) => {
    if (APP_MODE === 'delivery' || APP_MODE === 'installer' || user?.role === 'delivery_partner' || user?.role === 'installer') return;
    const token = localStorage.getItem('token');
    if (!token || !user) {
      setLoginOpen(true);
      return;
    }
    const productId = Number(product?.id);
    if (!Number.isInteger(productId) || productId <= 0) return;
    const isSaved = savedItems.some((entry) => Number(entry.product_id) === productId);
    try {
      const res = await fetch(
        isSaved ? `${API_URL}/account/saved-items/${productId}` : `${API_URL}/account/saved-items`,
        {
          method: isSaved ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: isSaved ? undefined : JSON.stringify({ product_id: productId })
        }
      );
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure('Your login timed out. Please login again to manage saved items.');
        return;
      }
      if (!res.ok) throw new Error('Saved items update failed');
      if (isSaved) {
        setSavedItems((current) => current.filter((entry) => Number(entry.product_id) !== productId));
      } else {
        const data = await res.json().catch(() => ({}));
        setSavedItems((current) => {
          if (current.some((entry) => Number(entry.product_id) === productId)) return current;
          return [data.saved_item || { product_id: productId, created_at: new Date().toISOString() }, ...current];
        });
      }
    } catch (e) {}
  };

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity), 0);
  const recentProductIds = useMemo(() => {
    const ids = [];
    customerOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const productId = Number(item.product_id || item.id);
        if (Number.isInteger(productId) && !ids.includes(productId)) ids.push(productId);
      });
    });
    return ids;
  }, [customerOrders]);
  const recentProducts = useMemo(
    () => recentProductIds.map((productId) => products.find((product) => Number(product.id) === productId)).filter(Boolean).slice(0, 10),
    [recentProductIds, products]
  );
  const recommendedProducts = useMemo(() => {
    if (!products.length) return [];
    const recentCategoryIds = Array.from(new Set(
      recentProducts
        .map((product) => Number(product.category_id || 0))
        .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0)
    ));
    const source = recentCategoryIds.length
      ? products.filter((product) => recentCategoryIds.includes(Number(product.category_id || 0)))
      : products;
    return source
      .filter((product) => !recentProductIds.includes(Number(product.id)))
      .sort((a, b) => {
        const ratingDelta = Number(b.rating_average || 0) - Number(a.rating_average || 0);
        if (ratingDelta !== 0) return ratingDelta;
        return Number(b.rating_count || 0) - Number(a.rating_count || 0);
      })
      .slice(0, 10);
  }, [products, recentProducts, recentProductIds]);
  const bestsellingProducts = useMemo(
    () => [...products]
      .sort((a, b) => {
        const countDelta = Number(b.rating_count || 0) - Number(a.rating_count || 0);
        if (countDelta !== 0) return countDelta;
        return Number(b.rating_average || 0) - Number(a.rating_average || 0);
      })
      .slice(0, 10),
    [products]
  );
  const trendingSearches = ['AHD camera', 'IP camera', 'DVR', 'NVR', 'POE switch', 'SMPS'];
  const savedProductIds = useMemo(
    () => savedItems.map((entry) => Number(entry.product_id)).filter((value) => Number.isInteger(value)),
    [savedItems]
  );
  const savedProducts = useMemo(
    () => savedProductIds
      .map((productId) => products.find((product) => Number(product.id) === productId))
      .filter(Boolean)
      .slice(0, 10),
    [products, savedProductIds]
  );
  const searchSuggestions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return [];

    return [
      ...products.map((product) => product.name).filter(Boolean),
      ...categories.map((category) => category.name).filter(Boolean)
    ]
      .map((name) => ({
        name,
        score: getSearchScore(normalizedQuery, name)
      }))
      .filter(({ score }) => score >= 0.58 || Number(score) >= 140)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.name).localeCompare(String(right.name));
      })
      .map(({ name }) => String(name).trim())
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .slice(0, 8);
  }, [categories, products, searchQuery]);
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
          locationLabel={locationLabel}
          deliveryEtaLabel={deliveryEtaLabel}
          onLocationChange={handleLocationChange}
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
          locationLabel={locationLabel}
          deliveryEtaLabel={deliveryEtaLabel}
          onLocationChange={handleLocationChange}
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
        locationLabel={locationLabel}
        deliveryEtaLabel={deliveryEtaLabel}
        onLocationChange={handleLocationChange}
        searchSuggestions={searchSuggestions}
        trendingSearches={trendingSearches}
      />

      <Suspense fallback={<RouteLoadingFallback />}>
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
                recentProducts={recentProducts}
                recommendedProducts={recommendedProducts}
                bestsellingProducts={bestsellingProducts}
                savedProducts={savedProducts}
                savedProductIds={savedProductIds}
                onToggleSaved={toggleSavedItem}
                deliveryEtaLabel={deliveryEtaLabel}
                pageContent={pageContent}
                seoAutomationSnapshot={seoAutomationSnapshot}
              />
            </DeliveryOnlyRoute>
          } />
          <Route path="/product/:id" element={<DeliveryOnlyRoute user={user}><ProductDetail products={products} onAdd={addToCart} onRemove={removeFromCart} cartItems={cartItems} user={user} onLogin={() => setLoginOpen(true)} priceForRole={priceForRole} savedProductIds={savedProductIds} onToggleSaved={toggleSavedItem} pageContent={pageContent} /></DeliveryOnlyRoute>} />
          <Route path="/category/:id" element={<DeliveryOnlyRoute user={user}><CategoryPage categories={categories} products={products} onAdd={addToCart} onRemove={removeFromCart} user={user} priceForRole={priceForRole} cartItems={cartItems} savedProductIds={savedProductIds} onToggleSaved={toggleSavedItem} deliveryEtaLabel={deliveryEtaLabel} seoAutomationSnapshot={seoAutomationSnapshot} /></DeliveryOnlyRoute>} />
          <Route path="/orders" element={<DeliveryOnlyRoute user={user}><OrdersPage user={user} onLogin={() => setLoginOpen(true)} onUserUpdate={updateUserState} /></DeliveryOnlyRoute>} />
          <Route path="/saved" element={<DeliveryOnlyRoute user={user}><SavedItemsPage user={user} onLogin={() => setLoginOpen(true)} products={products} savedProductIds={savedProductIds} onToggleSaved={toggleSavedItem} onAdd={addToCart} onRemove={removeFromCart} cartItems={cartItems} priceForRole={priceForRole} deliveryEtaLabel={deliveryEtaLabel} /></DeliveryOnlyRoute>} />
          <Route path="/install" element={<DeliveryOnlyRoute user={user}><InstallationPage user={user} onLogin={() => setLoginOpen(true)} /></DeliveryOnlyRoute>} />
          <Route path="/dealer" element={<DealerDashboard user={user} />} />
          <Route path="/distributor" element={<DealerDashboard user={user} />} />
          <Route path="/contact" element={<ContactPage user={user} />} />
          <Route path="/about-camigo" element={<AboutPage />} />
          {localSeoPages.map((page) => (
            <Route key={page.slug} path={`/${page.slug}`} element={<LocalSeoLandingPage page={page} />} />
          ))}
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/returns-policy" element={<ReturnsPolicyPage />} />
          <Route path="/installation-policy" element={<InstallationPolicyPage />} />
          <Route path="/admin" element={<AdminPage user={user} authReady={authReady} pageContent={pageContent} onPageContentSaved={setPageContent} />} />
          <Route path="/shop" element={<DeliveryOnlyRoute user={user}><ShopPage products={products} categories={categories} onAdd={addToCart} onRemove={removeFromCart} user={user} priceForRole={priceForRole} cartItems={cartItems} savedProductIds={savedProductIds} onToggleSaved={toggleSavedItem} deliveryEtaLabel={deliveryEtaLabel} seoAutomationSnapshot={seoAutomationSnapshot} /></DeliveryOnlyRoute>} />
          <Route path="/checkout" element={<DeliveryOnlyRoute user={user}><CheckoutPage user={user} liveCartItems={cartItems} onLogin={() => setLoginOpen(true)} onOrderPlaced={handleOrderPlaced} onUserUpdate={updateUserState} /></DeliveryOnlyRoute>} />
          <Route path="/tracking/:id" element={<TrackingPage />} />
          <Route path="/delivery-partner" element={<DeliveryPartnerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
          <Route path="/installer" element={<InstallerPage user={user} authReady={authReady} onLogin={() => setLoginOpen(true)} />} />
        </Routes>
      </Suspense>

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
