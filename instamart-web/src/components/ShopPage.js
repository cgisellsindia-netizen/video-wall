import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Heart, Minus, Plus, Search, SlidersHorizontal, Star } from 'lucide-react';

function ShopPage({ products, categories, onAdd, onRemove, user, priceForRole, cartItems = [], savedProductIds = [], onToggleSaved = null }) {
  const [selectedCat, setSelectedCat] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [priceBand, setPriceBand] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [minRating, setMinRating] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  const filtered = useMemo(() => {
    let result = [...products];
    if (selectedCat !== 'all') result = result.filter((product) => product.category_id === parseInt(selectedCat, 10));
    if (availability === 'in-stock') result = result.filter((product) => Number(product.stock || 0) > 0);
    if (minRating !== 'all') result = result.filter((product) => Number(product.rating_average || 0) >= Number(minRating));
    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      result = result.filter((product) => {
        const haystack = [product.name, product.description, product.unit].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    if (priceBand === 'under-2000') result = result.filter((product) => Number(product.price || 0) < 2000);
    if (priceBand === '2000-5000') result = result.filter((product) => Number(product.price || 0) >= 2000 && Number(product.price || 0) <= 5000);
    if (priceBand === 'above-5000') result = result.filter((product) => Number(product.price || 0) > 5000);

    if (sortBy === 'price-low') result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-high') result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === 'name') result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (sortBy === 'rating') result.sort((a, b) => Number(b.rating_average || 0) - Number(a.rating_average || 0));
    if (sortBy === 'discount') result.sort((a, b) => Number(b.discount_percent || 0) - Number(a.discount_percent || 0));
    return result;
  }, [products, selectedCat, sortBy, priceBand, availability, minRating, searchTerm]);

  return (
    <div className="container shop-page-shell">
      <h2 className="section-title" style={{ marginBottom: '20px' }}>Shop All Products</h2>

      <div className="shop-filter-shell">
        <div className="shop-search-inline">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search inside all products"
          />
        </div>
        <div className="shop-filter-grid">
          <div className="shop-filter-field">
            <Filter size={18} />
            <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="shop-filter-field">
            <SlidersHorizontal size={18} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Default</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="discount">Best Discount</option>
              <option value="name">Name: A-Z</option>
            </select>
          </div>
          <div className="shop-filter-field">
            <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)}>
              <option value="all">All Prices</option>
              <option value="under-2000">Under Rs 2000</option>
              <option value="2000-5000">Rs 2000 - 5000</option>
              <option value="above-5000">Above Rs 5000</option>
            </select>
          </div>
          <div className="shop-filter-field">
            <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="all">All Stock States</option>
              <option value="in-stock">In Stock Only</option>
            </select>
          </div>
          <div className="shop-filter-field">
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="all">All Ratings</option>
              <option value="4">4.0+ rating</option>
              <option value="4.5">4.5+ rating</option>
              <option value="4.8">4.8+ rating</option>
            </select>
          </div>
          <div className="shop-result-count">{filtered.length} products</div>
        </div>
      </div>

      <div className="shop-product-grid">
        {filtered.map((product) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const isSaved = savedProductIds.includes(Number(product.id));
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : Math.round((1 - product.price / product.mrp) * 100);
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? (
                  <img src={product.image} alt={product.name} loading="lazy" />
                ) : (
                  <div className="emoji">PROD</div>
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
                <div className="product-image-action-wrap" onClick={stopCardTap}>
                  {selectedQty > 0 ? (
                    <div className="card-qty-stepper image-stepper">
                      <button type="button" onPointerDown={handlePointerAction(() => onRemove(product, cartItem))} onClick={stopCardTap}><Minus size={15} /></button>
                      <strong>{selectedQty}</strong>
                      <button type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button className="add-btn image-add-btn" type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}>ADD</button>
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
                <span><span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span><span className="price-original">Rs {product.mrp}</span></span>
              </div>
              <div className="shop-card-meta-row">
                <span className={`stock-dot ${Number(product.stock || 0) > 0 ? 'ok' : 'low'}`}>{Number(product.stock || 0) > 0 ? 'In stock' : 'Out of stock'}</span>
              </div>
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShopPage;
