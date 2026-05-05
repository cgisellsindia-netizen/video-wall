import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Search, SlidersHorizontal, Star } from 'lucide-react';
import CategoryBannerCarousel from './CategoryBannerCarousel';

function CategoryPage({ categories, products, onAdd, onRemove, user, priceForRole, cartItems = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const categoryId = parseInt(id, 10);
  const category = categories.find((entry) => entry.id === categoryId);
  const [sortBy, setSortBy] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceBand, setPriceBand] = useState('all');
  const [availability, setAvailability] = useState('all');

  const categoryProducts = useMemo(() => {
    let result = products.filter((product) => product.category_id === categoryId);
    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      result = result.filter((product) => [product.name, product.description, product.unit].join(' ').toLowerCase().includes(query));
    }
    if (availability === 'in-stock') result = result.filter((product) => Number(product.stock || 0) > 0);
    if (priceBand === 'under-2000') result = result.filter((product) => Number(product.price || 0) < 2000);
    if (priceBand === '2000-5000') result = result.filter((product) => Number(product.price || 0) >= 2000 && Number(product.price || 0) <= 5000);
    if (priceBand === 'above-5000') result = result.filter((product) => Number(product.price || 0) > 5000);

    if (sortBy === 'price-low') result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-high') result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === 'rating') result.sort((a, b) => Number(b.rating_average || 0) - Number(a.rating_average || 0));
    if (sortBy === 'discount') result.sort((a, b) => Number(b.discount_percent || 0) - Number(a.discount_percent || 0));
    return result;
  }, [products, categoryId, searchTerm, availability, priceBand, sortBy]);

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  if (!category && categories.length > 0) {
    return (
      <div className="container category-page">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} /> Back
        </button>
        <h2 className="section-title">Category not found</h2>
      </div>
    );
  }

  return (
    <main className="container category-page">
      <button className="back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={20} /> Back
      </button>
      <CategoryBannerCarousel placementId={categoryId} />
      <div className="category-page-hero">
        <div>
          <span className="eyebrow">Fast local delivery</span>
          <h1>{category?.name || 'Loading category...'}</h1>
          <p>{categoryProducts.length} products ready for quick CCTV dispatch and installation support.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>View all products</button>
      </div>

      <div className="shop-filter-shell compact">
        <div className="shop-search-inline">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search in ${category?.name || 'category'}`}
          />
        </div>
        <div className="shop-filter-grid">
          <div className="shop-filter-field">
            <SlidersHorizontal size={18} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Default</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="discount">Best Discount</option>
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
          <div className="shop-result-count">{categoryProducts.length} products</div>
        </div>
      </div>

      <div className="shop-product-grid">
        {categoryProducts.map((product) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="emoji">CCTV</div>}
                <span className="delivery-badge">8 min</span>
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
    </main>
  );
}

export default CategoryPage;
