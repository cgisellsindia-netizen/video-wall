import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Minus, Plus, Star } from 'lucide-react';
import { API_URL } from '../api';

function SetupPackagesSection({
  products = [],
  onAdd,
  onRemove,
  user,
  cartItems = [],
  savedProductIds = [],
  onToggleSaved = null
}) {
  const [packages, setPackages] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  const navigate = useNavigate();
  const sectionRef = useRef(null);

  const productMap = useMemo(
    () => new Map(products.map((product) => [Number(product.id), product])),
    [products]
  );

  const fallbackSetupProducts = useMemo(() => (
    products
      .filter((product) => {
        const unit = String(product.unit || '').toLowerCase();
        const name = String(product.name || '').toLowerCase();
        const description = String(product.description || '').toLowerCase();
        return unit.includes('setup')
          || name.includes('setup')
          || description.includes('setup package');
      })
      .slice(0, 12)
  ), [products]);

  useEffect(() => {
    let cancelled = false;
    const loadPackages = async () => {
      try {
        const res = await fetch(`${API_URL}/setup-packages`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setPackages(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) setPackages([]);
      }
    };
    loadPackages();
    return () => { cancelled = true; };
  }, []);

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

  const sectionProducts = useMemo(
    () => {
      const resolved = packages
        .map((entry) => productMap.get(Number(entry.product_id || 0)))
        .filter(Boolean);
      return resolved.length ? resolved : fallbackSetupProducts;
    },
    [packages, productMap, fallbackSetupProducts]
  );

  if (!sectionProducts.length) return null;

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  const pulseProduct = (productId) => {
    setActiveProductId(Number(productId));
    window.clearTimeout(pulseProduct.timeoutId);
    pulseProduct.timeoutId = window.setTimeout(() => setActiveProductId(null), 320);
  };

  return (
    <div ref={sectionRef} className={`product-section setup-packages-section motion-section ${isVisible ? 'section-in-view' : ''}`}>
      <div className="section-header">
        <h2 className="section-title">Full Setup Packages</h2>
        <button
          type="button"
          className="see-all see-all-btn"
          onClick={() => navigate('/shop')}
        >
          See all
        </button>
      </div>
      <div className="product-scroll">
        {sectionProducts.map((product, index) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
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
                {selectedQty > 0 ? (
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
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SetupPackagesSection;
