import React from 'react';  
import { Home, LayoutGrid, Search, ShoppingCart, User } from 'lucide-react';  
  
function BottomNav({ cartCount, onCartClick, user }) {  
  const accountLink = user?.role === 'admin'
    ? '/#/admin'
    : user?.role === 'delivery_partner'
      ? '/#/delivery-partner'
      : '/#/orders';

  return (  
    <nav className="bottom-nav">  
      <div className="bottom-nav-inner">  
        <a href="/#/" className="bottom-nav-item active"><Home size={22} /><span>Home</span></a>  
        <a href="/#/shop" className="bottom-nav-item"><LayoutGrid size={22} /><span>Categories</span></a>  
        <a href="/#/shop" className="bottom-nav-item"><Search size={22} /><span>Search</span></a>  
        <button className="bottom-nav-item" onClick={onCartClick} style={{ background: 'none', border: 'none' }}>
          <ShoppingCart size={22} /><span>Cart</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </button>  
        <a href={accountLink} className="bottom-nav-item"><User size={22} /><span>Account</span></a>  
      </div>  
    </nav>  
  );  
}  
  
export default BottomNav;  
