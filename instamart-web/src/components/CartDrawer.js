import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import ProductImage from './ProductImage';

function CartDrawer({ open, onClose, items = [], total = 0, onUpdate, onAdd, onRemove, user }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();

  const updateQty = async (item, delta) => {
    if (delta > 0) {
      await onAdd(item);
      return;
    }
    await onRemove(item, item);
    onUpdate();
  };

  const handleCheckout = async () => {
    if (!user) return;
    setCheckingOut(true);
    localStorage.setItem('cart_backup', JSON.stringify(items));
    onClose();
    navigate('/checkout');
    setCheckingOut(false);
  };

  const itemCount = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  return (
    <>
      <div className={`cart-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`cart-drawer ${open ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Your Cart ({itemCount} items)</h2>
          <button className="cart-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="cart-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-emoji"><ShoppingBag size={64} /></div>
              <h3>Your cart is empty</h3>
              <p>Add items to get started</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-img"><ProductImage src={item.image} alt={item.name} fallbackContent="CCTV" /></div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-weight">{item.unit}</div>
                  <div className="cart-item-price">Rs {item.price * item.quantity}</div>
                  <div className="cart-item-controls">
                    <button className="qty-btn" onClick={() => updateQty(item, -1)}><Minus size={14} /></button>
                    <span className="qty-value">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQty(item, 1)}><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-subtotal">
              <span>Items total</span>
              <span>Rs {total}</span>
            </div>
            <div className="cart-subtotal">
              <span>Delivery charge</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="cart-total-row">
              <span className="label">Payable starts from</span>
              <span className="value">Rs {total}</span>
            </div>
            <button className="checkout-btn" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? 'Opening Checkout...' : 'Checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default CartDrawer;
