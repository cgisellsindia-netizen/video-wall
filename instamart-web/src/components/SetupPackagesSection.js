import React, { useEffect, useMemo, useState } from 'react';
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
  const navigate = useNavigate();

  const productMap = useMemo(
    () => new Map(products.map((product) => [Number(product.id), product])),
    [products]
  );

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

  const sectionProducts = useMemo(
    () => packages
      .map((entry) => productMap.get(Number(entry.product_id || 0)))
      .filter(Boolean),
    [packages, productMap]
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

  return (
    <div className="product-section setup-packages-section">
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
        {sectionProducts.map((product) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const isSaved = savedProductIds.includes(Number(product.id));
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
              <div className="product-rating-row">
                <Star size={13} fill="currentColor" />
                <strong>{Number(product.rating_average || 4.6).toFixed(1)}</strong>
                <span>({Number(product.rating_count || 200)})</span>
              </div>
              {discount > 0 && <div className="product-offer-line">{discount}% OFF</div>}
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

export default SetupPackagesSection;
