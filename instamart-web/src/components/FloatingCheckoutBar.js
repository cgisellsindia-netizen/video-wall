import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const FREE_DELIVERY_AT = 200;

function FloatingCheckoutBar({ cartCount, cartTotal, cartItems = [], onCartClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!cartCount || location.pathname === '/checkout') return null;
  const remaining = Math.max(0, FREE_DELIVERY_AT - Math.round(cartTotal));
  const firstItem = cartItems[0];

  return (
    <section className="floating-checkout-bar" onClick={() => navigate('/checkout')}>
      <button className="floating-checkout-offer" onClick={(event) => { event.stopPropagation(); onCartClick(); }}>
        {remaining > 0 ? `Add Rs ${remaining} to unlock FREE DELIVERY` : 'FREE DELIVERY unlocked'}
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
