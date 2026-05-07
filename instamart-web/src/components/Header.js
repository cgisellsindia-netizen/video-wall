import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ChevronDown, Search, User, LogOut, Shield } from 'lucide-react';

function Header({
  user,
  onLoginClick,
  onLogout,
  searchQuery,
  onSearch,
  appMode = 'web',
  locationLabel = 'Bhubaneswar, Odisha',
  searchSuggestions = [],
  trendingSearches = []
}) {
  const displayName = user?.name || user?.email || 'Account';
  const isDeliveryPartner = appMode === 'delivery' || user?.role === 'delivery_partner';
  const isInstaller = appMode === 'installer' || user?.role === 'installer';
  const isOpsMode = isDeliveryPartner || isInstaller;
  const [searchFocused, setSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
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
    if (!profileOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [profileOpen]);

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-top">
        <div className="header-row">
          {!isOpsMode && <a className="location-bar header-location-bar" href="/#/shop">
            <MapPin size={16} className="loc-icon" />
            <span className="loc-copy">
              <small>Delivery to</small>
              <span className="loc-text">{locationLabel}</span>
            </span>
            <ChevronDown size={14} className="loc-chevron" />
          </a>}
          <div className="header-actions">
            {user ? (
              <>
                {user.role === 'admin' && <a className="header-btn admin-shortcut" href="/#/admin"><Shield size={18} /><span>Admin</span></a>}
                <div className={`profile-menu ${profileOpen ? 'open' : ''}`} ref={profileMenuRef}>
                  <button
                    className="header-btn profile-icon-btn"
                    type="button"
                    onClick={() => setProfileOpen((current) => !current)}
                    aria-label="Account"
                  >
                    <User size={18} />
                  </button>
                  <div className="profile-dropdown">
                    <span className="profile-dropdown-name">{displayName}</span>
                    <a href="/#/orders" onClick={() => setProfileOpen(false)}>Orders</a>
                    <a href="/#/saved" onClick={() => setProfileOpen(false)}>Saved</a>
                    <button type="button" onClick={onLogout}><LogOut size={16} /><span>Logout</span></button>
                  </div>
                </div>
              </>
            ) : (
              <button className="header-btn primary profile-login-btn" onClick={onLoginClick}><User size={18} /><span>Login</span></button>
            )}
          </div>
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
        {!isOpsMode && <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search CCTV cameras, DVRs, NVRs..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
            }}
            onBlur={() => setTimeout(() => {
              setSearchFocused(false);
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
      </div>
    </header>
  );
}
export default Header;
