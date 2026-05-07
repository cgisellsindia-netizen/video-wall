import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, ChevronDown, Search, ShoppingCart, User, LogOut, Shield } from 'lucide-react';

function Header({
  user,
  cartCount,
  onCartClick,
  onLoginClick,
  onLogout,
  searchQuery,
  onSearch,
  appMode = 'web',
  searchSuggestions = [],
  trendingSearches = []
}) {
  const displayName = user?.name || user?.email || 'Account';
  const isDeliveryPartner = appMode === 'delivery' || user?.role === 'delivery_partner';
  const isInstaller = appMode === 'installer' || user?.role === 'installer';
  const isOpsMode = isDeliveryPartner || isInstaller;
  const homeLink = isDeliveryPartner ? '/#/delivery-partner' : isInstaller ? '/#/installer' : '/#/';
  const [searchFocused, setSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const visibleSuggestions = useMemo(() => {
    if (searchQuery?.trim()) return searchSuggestions.slice(0, 6);
    return trendingSearches.slice(0, 6);
  }, [searchQuery, searchSuggestions, trendingSearches]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!cartCount) return undefined;
    setCartPulse(true);
    const timeoutId = window.setTimeout(() => setCartPulse(false), 420);
    return () => window.clearTimeout(timeoutId);
  }, [cartCount]);

  useEffect(() => {
    if (searchQuery?.trim()) setMobileSearchOpen(true);
  }, [searchQuery]);

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-top">
        <div className="logo-area">
          <a href={homeLink} className="logo">
            <img className="logo-icon logo-img" src="/camigo-logo.svg" alt="Camigo" />
            <div className="logo-text" style={{color:"#fff",fontWeight:900,letterSpacing:"-1px",fontSize:"28px"}}>Cam<span style={{color:"#f6c400"}}>igo</span></div>
          </a>
          {!isOpsMode && <a className="location-bar" href="/#/shop">
            <MapPin size={16} className="loc-icon" />
            <span className="loc-text">Bhubaneswar, Odisha - Powered by CGI CCTV</span>
            <ChevronDown size={14} className="loc-chevron" />
          </a>}
        </div>
        <nav className="desktop-nav">
          {!isOpsMode && <a href="/#/shop">Shop</a>}
          {!isOpsMode && <a href="/#/orders">Orders</a>}
          {!isOpsMode && <a href="/#/saved">Saved</a>}
          {(user?.role === 'dealer' || user?.role === 'distributor') && <a href="/#/dealer">Trade Panel</a>}
          {isDeliveryPartner && <a href="/#/delivery-partner">Delivery Panel</a>}
          {isInstaller && <a href="/#/installer">Installer Panel</a>}
          {user?.role === 'admin' && <a href="/#/admin">Admin</a>}
        </nav>
        {!isOpsMode && <div className={`search-bar ${mobileSearchOpen ? 'mobile-open' : ''}`}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search CCTV cameras, DVRs, NVRs..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              setMobileSearchOpen(true);
            }}
            onBlur={() => setTimeout(() => {
              setSearchFocused(false);
              if (!searchQuery?.trim()) setMobileSearchOpen(false);
            }, 120)}
          />
          {searchFocused && visibleSuggestions.length > 0 && (
            <div className="search-suggestions-panel">
              <span>{searchQuery?.trim() ? 'Suggestions' : 'Trending searches'}</span>
              {visibleSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSearch(suggestion)}
                >
                  <Search size={14} />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>}
        <div className="header-actions">
          {!isOpsMode && (
            <button
              className={`header-btn mobile-search-toggle ${mobileSearchOpen ? 'active' : ''}`}
              type="button"
              onClick={() => setMobileSearchOpen((current) => !current)}
              aria-label="Search products"
            >
              <Search size={18} />
            </button>
          )}
          {user ? (
            <>
              <a href="/#/orders" className="header-btn profile-btn"><User size={18} /><span>{displayName.split(' ')[0]}</span></a>
              {user.role === 'admin' && <a className="header-btn admin-shortcut" href="/#/admin"><Shield size={18} /><span>Admin</span></a>}
              <button className="header-btn" onClick={onLogout}><LogOut size={18} /><span>Logout</span></button>
            </>
          ) : (
            <button className="header-btn primary" onClick={onLoginClick}><User size={18} /><span>Login</span></button>
          )}
          {!isOpsMode && <button className="header-btn cart-btn" onClick={onCartClick}>
            <ShoppingCart size={18} /><span>Cart</span>
            {cartCount > 0 && <span className={`cart-badge ${cartPulse ? 'cart-badge-pulse' : ''}`}>{cartCount}</span>}
          </button>}
        </div>
      </div>
    </header>
  );
}
export default Header;
