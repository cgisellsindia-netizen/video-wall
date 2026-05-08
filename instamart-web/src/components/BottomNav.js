import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Package, ShoppingCart, Wrench, User } from 'lucide-react';  
  
function BottomNav({ cartCount, onCartClick, user }) {  
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const accountLink = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'delivery_partner'
      ? '/delivery-partner'
      : user?.role === 'installer'
        ? '/installer'
      : '/#/orders';
  const accountPath = accountLink.replace('/#', '');
  const itemClass = (path) => location.pathname === path ? 'bottom-nav-item active' : 'bottom-nav-item';

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastY;
      const shouldHide = window.innerWidth <= 768 && scrollingDown && currentY > 90;
      setHidden(shouldHide);
      document.body.classList.toggle('bottom-nav-hidden', shouldHide);
      lastY = currentY;
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.body.classList.remove('bottom-nav-hidden');
    };
  }, []);

  return (  
    <nav className={`bottom-nav ${hidden ? 'hidden' : ''}`}>  
      <div className="bottom-nav-inner">  
        <Link to="/" className={itemClass('/')}><Home size={22} /><span>Home</span></Link>
        <Link to="/shop" className={itemClass('/shop')}><Package size={22} /><span>Products</span></Link>
        <button className="bottom-nav-item" onClick={onCartClick} style={{ background: 'none', border: 'none' }}>
          <ShoppingCart size={22} /><span>Cart</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </button>  
        <Link to="/install" className={itemClass('/install')}><Wrench size={22} /><span>Install</span></Link>
        <Link to={accountPath} className={itemClass(accountPath)}><User size={22} /><span>Account</span></Link>
      </div>  
    </nav>  
  );  
}  
  
export default BottomNav;  
