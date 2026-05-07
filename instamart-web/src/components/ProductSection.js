import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Minus, Plus, Star } from 'lucide-react';
import CategoryBannerCarousel from './CategoryBannerCarousel';

function ProductSection({ title, products, onAdd, onRemove, user, cartItems = [], categoryId = null, savedProductIds = [], onToggleSaved = null }) {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  if (!products || products.length === 0) return null;

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.14 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pulseProduct = (productId) => {
    setActiveProductId(Number(productId));
    window.clearTimeout(pulseProduct.timeoutId);
    pulseProduct.timeoutId = window.setTimeout(() => setActiveProductId(null), 320);
  };

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  return (
    <div ref={sectionRef} className={`product-section motion-section ${isVisible ? 'section-in-view' : ''}`}>
      {categoryId !== null && categoryId !== undefined && <CategoryBannerCarousel placementId={categoryId} />}
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <button
          type="button"
          className="see-all see-all-btn"
          onClick={() => navigate(categoryId !== null && categoryId !== undefined ? `/category/${categoryId}` : '/shop')}
        >
          See all
        </button>
      </div>
      <div className="product-scroll">
        {products.map((product, index) => {
          const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const isOutOfStock = Number(product.stock || 0) <= 0;
          const isSaved = savedProductIds.includes(Number(product.id));
          const isAnimating = activeProductId === Number(product.id);
          const discount = Number(product.discount_percent) > 0
            ? Math.round(Number(product.discount_percent))
            : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          const rolePrice = user?.role === 'dealer' && Number(product.dealer_price) > 0
            ? Math.round(Number(product.dealer_price))
            : user?.role === 'distributor' && Number(product.distributor_price) > 0
              ? Math.round(Number(product.distributor_price))
              : user?.role === 'dealer' ? Math.round(product.price * 0.90) : user?.role === 'distributor' ? Math.round(product.price * 0.85) : product.price;

          return (
            <div
              key={product.id}
              className={`product-card motion-card ${isAnimating ? 'cart-bump' : ''}`}
              style={{ '--card-stagger': index }}
              onClick={() => navigate(`/product/${product.id}`)}
            >
              <div className="product-img-wrap">
                {product.image ? (
                  <img src={product.image} alt={product.name} loading="lazy" />
                ) : (
                  <div className="emoji">CCTV</div>
                )}
                {discount > 0 && (
                  <span className="product-corner-offer" aria-label={`${discount}% off`}>
                    <strong>{discount}%</strong>
                    <small>OFF</small>
                  </span>
                )}
                {onToggleSaved && (
                  <button
                    type="button"
                    className={isSaved ? 'save-item-btn active' : 'save-item-btn'}
                    onPointerDown={handlePointerAction(() => onToggleSaved(product))}
                    onClick={stopCardTap}
                    aria-label={isSaved ? 'Remove from saved items' : 'Save for later'}
                  >
                    <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                  </button>
                )}
                <span className="delivery-badge">8 min</span>
              </div>
              <div className="product-name">{product.name}</div>
              <div className="product-weight">{product.unit}</div>
              <div className="product-rating-row">
                <Star size={13} fill="currentColor" />
                <strong>{Number(product.rating_average || 4.6).toFixed(1)}</strong>
                <span>({Number(product.rating_count || 200)})</span>
              </div>
              <div className="product-price-row blinkit-price-row" onClick={stopCardTap}>
                <span className="product-price-stack">
                  <span className="price-current">Rs {rolePrice}</span>
                  <span className="price-original">Rs {product.mrp}</span>
                </span>
                {isOutOfStock ? (
                  <button className="inline-sold-out-btn" type="button" disabled aria-disabled="true" onClick={stopCardTap}>
                    Sold out
                  </button>
                ) : selectedQty > 0 ? (
                  <div className={`card-qty-stepper inline-stepper ${isAnimating ? 'stepper-bump' : ''}`}>
                    <button type="button" onPointerDown={handlePointerAction(() => { pulseProduct(product.id); onRemove(product, cartItem); })} onClick={stopCardTap}><Minus size={15} /></button>
                    <strong>{selectedQty}</strong>
                    <button type="button" onPointerDown={handlePointerAction(() => { pulseProduct(product.id); onAdd(product); })} onClick={stopCardTap}><Plus size={15} /></button>
                  </div>
                ) : (
                  <button className={`add-btn inline-add-btn ${isAnimating ? 'add-pressed' : ''}`} type="button" onPointerDown={handlePointerAction(() => { pulseProduct(product.id); onAdd(product); })} onClick={stopCardTap}>
                    ADD
                  </button>
                )}
              </div>
              <div className="shop-card-meta-row">
                <span className={`stock-dot ${isOutOfStock ? 'low' : 'ok'}`}>{isOutOfStock ? 'Out of stock' : 'In stock'}</span>
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
