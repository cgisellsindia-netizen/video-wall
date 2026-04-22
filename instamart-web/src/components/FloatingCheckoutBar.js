import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

function FloatingCheckoutBar({ cartCount, cartTotal, cartItems = [], onCartClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!cartCount || location.pathname === '/checkout') return null;
  const firstItem = cartItems[0];

  return (
    <section className="floating-checkout-bar" onClick={() => navigate('/checkout')}>
      <button className="floating-checkout-offer" onClick={(event) => { event.stopPropagation(); onCartClick(); }}>
        Rs {Math.round(cartTotal)} cart total
      </button>
      <button className="floating-checkout-cart">
        <span>
          <strong>CART</strong>
          <small>{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</small>
        </span>
        <span className="floating-checkout-thumb">
          {firstItem?.image ? <img src={firstItem.image} alt="" /> : 'C'}
        </span>
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

export default FloatingCheckoutBar;
