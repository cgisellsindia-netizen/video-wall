import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';

function ProductSection({ title, products, onAdd, onRemove, user, cartItems = [] }) {
  const navigate = useNavigate();
  if (!products || products.length === 0) return null;
  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  return (
    <div className="product-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="see-all">See all</span>
      </div>
      <div className="product-scroll">
        {products.map(product => {
          const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const discount = Number(product.discount_percent) > 0
            ? Math.round(Number(product.discount_percent))
            : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          const rolePrice = user?.role === 'dealer' && Number(product.dealer_price) > 0
            ? Math.round(Number(product.dealer_price))
            : user?.role === 'distributor' && Number(product.distributor_price) > 0
              ? Math.round(Number(product.distributor_price))
              : user?.role === 'dealer' ? Math.round(product.price * 0.90) : user?.role === 'distributor' ? Math.round(product.price * 0.85) : product.price;

          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? (
                  <img src={product.image} alt={product.name} loading="lazy" />
                ) : (
                  <div className="emoji">CCTV</div>
                )}
                {discount > 0 && <span className="discount-badge">{discount}% OFF</span>}
                <span className="delivery-badge">8 min</span>
                <div className="product-image-action-wrap" onClick={stopCardTap}>
                  {selectedQty > 0 ? (
                    <div className="card-qty-stepper image-stepper">
                      <button type="button" onPointerDown={handlePointerAction(() => onRemove(product, cartItem))} onClick={stopCardTap}><Minus size={15} /></button>
                      <strong>{selectedQty}</strong>
                      <button type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button className="add-btn image-add-btn" type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}>
                      ADD
                    </button>
                  )}
                </div>
              </div>
              <div className="product-name">{product.name}</div>
              <div className="product-weight">{product.unit}</div>
              <div className="product-price-row">
                <span>
                  <span className="price-current">Rs {rolePrice}</span>
                  <span className="price-original">Rs {product.mrp}</span>
                </span>
              </div>
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductSection;
