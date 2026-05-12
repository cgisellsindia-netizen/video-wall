import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Minus, Plus, Search, ShoppingCart, Star } from 'lucide-react';
import ProductImage from './ProductImage';
import { buildProductImageSources, getProductFallbackImage } from '../imageFallbacks';

function SavedItemsPage({
  user,
  onLogin,
  products = [],
  savedProductIds = [],
  onToggleSaved,
  onAdd,
  onRemove,
  cartItems = [],
  priceForRole,
  deliveryEtaLabel = '16 mins'
}) {
  const navigate = useNavigate();
  const savedProducts = useMemo(
    () => savedProductIds
      .map((productId) => products.find((product) => Number(product.id) === Number(productId)))
      .filter(Boolean),
    [products, savedProductIds]
  );

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  if (!user) {
    return (
      <div className="container shop-page-shell">
        <div className="card search-empty-state">
          <h3>Login to see your saved items</h3>
          <p>Save products you want to come back to quickly, then add them to cart whenever you are ready.</p>
          <button className="btn btn-primary" onClick={onLogin}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container shop-page-shell">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} /> Back
      </button>

      <div className="category-page-hero">
        <div>
          <span className="eyebrow">Saved for later</span>
          <h1>Saved Items</h1>
          <p>{savedProducts.length} product{savedProducts.length !== 1 ? 's' : ''} kept handy for your next fast Camigo order.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>
          <Search size={16} /> Continue shopping
        </button>
      </div>

      {savedProducts.length === 0 ? (
        <div className="card search-empty-state">
          <h3>No saved items yet</h3>
          <p>Tap the heart on any camera, DVR, NVR or accessory to keep it here for later.</p>
          <div className="search-empty-actions">
            <button className="btn btn-primary" onClick={() => navigate('/shop')}>
              <ShoppingCart size={16} /> Browse products
            </button>
          </div>
        </div>
      ) : (
        <div className="shop-product-grid">
          {savedProducts.map((product) => {
            const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
            const selectedQty = cartItem?.quantity || 0;
            const isOutOfStock = Number(product.stock || 0) <= 0;
            const discount = Number(product.discount_percent) > 0
              ? Math.round(Number(product.discount_percent))
              : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
            return (
              <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                <ProductImage
                  src={product.image}
                  sources={buildProductImageSources(product)}
                  fallbackSrc={getProductFallbackImage(product)}
                  alt={product.name}
                  loading="lazy"
                  fallbackContent="CCTV"
                />
                {discount > 0 && (
                  <span className="product-corner-offer" aria-label={`${discount}% off`}>
                    <strong>{discount}%</strong>
                    <small>OFF</small>
                  </span>
                )}
                <button
                  type="button"
                  className="save-item-btn active"
                  onPointerDown={handlePointerAction(() => onToggleSaved(product))}
                    onClick={stopCardTap}
                    aria-label="Remove from saved items"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
                <span className="delivery-badge">{deliveryEtaLabel}</span>
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
                    <span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span>
                    <span className="price-original">Rs {product.mrp}</span>
                  </span>
                  {isOutOfStock ? (
                    <button className="inline-sold-out-btn" type="button" disabled aria-disabled="true" onClick={stopCardTap}>Sold out</button>
                  ) : selectedQty > 0 ? (
                    <div className="card-qty-stepper inline-stepper">
                      <button type="button" onPointerDown={handlePointerAction(() => onRemove(product, cartItem))} onClick={stopCardTap}><Minus size={15} /></button>
                      <strong>{selectedQty}</strong>
                      <button type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button className="add-btn inline-add-btn" type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}>ADD</button>
                  )}
                </div>
                <div className="shop-card-meta-row">
                  <span className={`stock-dot ${isOutOfStock ? 'low' : 'ok'}`}>{isOutOfStock ? 'Out of stock' : 'In stock'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SavedItemsPage;
