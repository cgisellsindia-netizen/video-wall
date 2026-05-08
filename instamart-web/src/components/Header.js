import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ChevronDown, Search, User, LogOut, Shield, X, LocateFixed } from 'lucide-react';
import { captureCustomerLocation, resolveCustomerAreaName, searchCustomerLocations } from '../locationLock';

function Header({
  user,
  onLoginClick,
  onLogout,
  searchQuery,
  onSearch,
  appMode = 'web',
  locationLabel = 'Bhubaneswar, Odisha',
  deliveryEtaLabel = '16 mins',
  onLocationChange,
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
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchBusy, setLocationSearchBusy] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
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

  useEffect(() => {
    if (!locationSheetOpen) return undefined;
    let active = true;
    const loadResults = async () => {
      if (locationQuery.trim().length < 2) {
        if (active) setLocationResults([]);
        return;
      }
      setLocationSearchBusy(true);
      const results = await searchCustomerLocations(locationQuery);
      if (active) {
        setLocationResults(results);
        setLocationSearchBusy(false);
      }
    };
    const timeoutId = window.setTimeout(loadResults, 220);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [locationQuery, locationSheetOpen]);

  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    const detectedLocation = await captureCustomerLocation({ source: 'location-sheet', timeout: 10000, maximumAge: 120000 });
    if (detectedLocation?.lat && detectedLocation?.lng) {
      const resolvedArea = await resolveCustomerAreaName(detectedLocation);
      await onLocationChange?.({
        lat: detectedLocation.lat,
        lng: detectedLocation.lng,
        areaName: resolvedArea,
        source: 'location-sheet'
      });
      setLocationSheetOpen(false);
      setLocationQuery('');
      setLocationResults([]);
    }
    setDetectingLocation(false);
  };

  const handlePickLocation = async (result) => {
    if (!result?.lat || !result?.lng) return;
    setLocationSearchBusy(true);
    await onLocationChange?.({
      lat: result.lat,
      lng: result.lng,
      areaName: result.label,
      source: 'location-search'
    });
    setLocationSearchBusy(false);
    setLocationSheetOpen(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  return (
    <>
      <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
        <div className="header-top">
          <div className="header-row">
            {!isOpsMode && <button className="location-bar header-location-bar" type="button" onClick={() => setLocationSheetOpen(true)}>
              <MapPin size={16} className="loc-icon" />
              <span className="loc-copy">
                <small>Delivery in {deliveryEtaLabel}</small>
                <span className="loc-text">{locationLabel}</span>
              </span>
              <ChevronDown size={14} className="loc-chevron" />
            </button>}
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
      {!isOpsMode && (
        <div className={`location-sheet-overlay ${locationSheetOpen ? 'open' : ''}`} onClick={() => setLocationSheetOpen(false)}>
          <div className="location-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="location-sheet-close" type="button" onClick={() => setLocationSheetOpen(false)} aria-label="Close location selector">
              <X size={20} />
            </button>
            <h3>Select your location</h3>
            <div className="location-sheet-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="search delivery location"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </div>
            <button className="location-sheet-current" type="button" onClick={handleUseCurrentLocation} disabled={detectingLocation}>
              <LocateFixed size={19} />
              <span>{detectingLocation ? 'Detecting location...' : 'Use current location'}</span>
            </button>
            {locationResults.length > 0 && (
              <div className="location-sheet-results">
                {locationResults.map((result) => (
                  <button key={`${result.lat}-${result.lng}-${result.label}`} type="button" onClick={() => handlePickLocation(result)}>
                    <MapPin size={16} />
                    <span>{result.label}</span>
                  </button>
                ))}
              </div>
            )}
            {locationQuery.trim().length >= 2 && locationResults.length === 0 && (
              <div className="location-sheet-results">
                <div className="location-sheet-results-state">
                  {locationSearchBusy ? 'Searching places...' : 'No places found. Check Places API and Maps JavaScript API.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
export default Header;
