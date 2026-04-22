import React from 'react';
import { MapPin, ChevronDown, Search, ShoppingCart, User, LogOut, Shield } from 'lucide-react';

function Header({ user, cartCount, onCartClick, onLoginClick, onLogout, searchQuery, onSearch, appMode = 'web' }) {
  const displayName = user?.name || user?.email || 'Account';
  const isDeliveryPartner = appMode === 'delivery' || user?.role === 'delivery_partner';
  const homeLink = isDeliveryPartner ? '/#/delivery-partner' : '/#/';

  return (
    <header className="header">
      <div className="header-top">
        <div className="logo-area">
          <a href={homeLink} className="logo">
            <img className="logo-icon logo-img" src="/camigo-logo.svg" alt="Camigo" />
            <div className="logo-text" style={{color:"#fff",fontWeight:900,letterSpacing:"-1px",fontSize:"28px"}}>Cam<span style={{color:"#f6c400"}}>igo</span></div>
          </a>
          {!isDeliveryPartner && <a className="location-bar" href="/#/shop">
            <MapPin size={16} className="loc-icon" />
            <span className="loc-text">Bhubaneswar, Odisha - Powered by CGI CCTV</span>
            <ChevronDown size={14} className="loc-chevron" />
          </a>}
        </div>
        <nav className="desktop-nav">
          {!isDeliveryPartner && <a href="/#/shop">Shop</a>}
          {!isDeliveryPartner && <a href="/#/orders">Orders</a>}
          {(user?.role === 'dealer' || user?.role === 'distributor') && <a href="/#/dealer">Trade Panel</a>}
          {isDeliveryPartner && <a href="/#/delivery-partner">Delivery Panel</a>}
          {user?.role === 'admin' && <a href="/#/admin">Admin</a>}
        </nav>
        {!isDeliveryPartner && <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search CCTV cameras, DVRs, NVRs..." value={searchQuery} onChange={(e) => onSearch(e.target.value)} />
        </div>}
        <div className="header-actions">
          {user ? (
            <>
              <button className="header-btn profile-btn"><User size={18} /><span>{displayName.split(' ')[0]}</span></button>
              {user.role === 'admin' && <a className="header-btn admin-shortcut" href="/#/admin"><Shield size={18} /><span>Admin</span></a>}
              <button className="header-btn" onClick={onLogout}><LogOut size={18} /><span>Logout</span></button>
            </>
          ) : (
            <button className="header-btn primary" onClick={onLoginClick}><User size={18} /><span>Login</span></button>
          )}
          {!isDeliveryPartner && <button className="header-btn cart-btn" onClick={onCartClick}>
            <ShoppingCart size={18} /><span>Cart</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>}
        </div>
      </div>
    </header>
  );
}
export default Header;
