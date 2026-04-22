import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

function FloatingCheckoutBar({ cartCount, cartTotal, onCartClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!cartCount || location.pathname === '/checkout') return null;

  return (
    <section className="floating-checkout-bar">
      <button className="floating-checkout-summary" onClick={onCartClick}>
        <span className="floating-checkout-icon"><ShoppingBag size={18} /></span>
        <span>
          <strong>{cartCount} item{cartCount > 1 ? 's' : ''} selected</strong>
          <small>Rs {Math.round(cartTotal)} cart total</small>
        </span>
      </button>
      <button className="floating-checkout-action" onClick={() => navigate('/checkout')}>
        Checkout
      </button>
    </section>
  );
}

export default FloatingCheckoutBar;
