import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Search, ShoppingCart, User } from 'lucide-react';  
  
function BottomNav({ cartCount, onCartClick, user }) {  
  const location = useLocation();
  const accountLink = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'delivery_partner'
      ? '/delivery-partner'
      : '/#/orders';
  const accountPath = accountLink.replace('/#', '');
  const itemClass = (path) => location.pathname === path ? 'bottom-nav-item active' : 'bottom-nav-item';

  return (  
    <nav className="bottom-nav">  
      <div className="bottom-nav-inner">  
        <Link to="/" className={itemClass('/')}><Home size={22} /><span>Home</span></Link>
        <Link to="/shop" className={itemClass('/shop')}><LayoutGrid size={22} /><span>Categories</span></Link>
        <Link to="/shop" className={itemClass('/shop')}><Search size={22} /><span>Search</span></Link>
        <button className="bottom-nav-item" onClick={onCartClick} style={{ background: 'none', border: 'none' }}>
          <ShoppingCart size={22} /><span>Cart</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </button>  
        <Link to={accountPath} className={itemClass(accountPath)}><User size={22} /><span>Account</span></Link>
      </div>  
    </nav>  
  );  
}  
  
export default BottomNav;  
