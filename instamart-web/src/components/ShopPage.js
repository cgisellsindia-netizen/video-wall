import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Minus, Plus, SlidersHorizontal } from 'lucide-react';

function ShopPage({ products, categories, onAdd, onRemove, user, priceForRole, cartItems = [] }) {
  const [filtered, setFiltered] = useState(products);
  const [selectedCat, setSelectedCat] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const navigate = useNavigate();
  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  useEffect(() => {
    let result = [...products];
    if (selectedCat !== 'all') result = result.filter(p => p.category_id === parseInt(selectedCat));
    if (sortBy === 'price-low') result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-high') result.sort((a, b) => b.price - a.price);
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    setFiltered(result);
  }, [products, selectedCat, sortBy]);

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '24px 16px 100px' }}>
      <h2 className="section-title" style={{ marginBottom: '20px' }}>Shop All Products</h2>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} />
          <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #dbe3ef', fontSize: '14px', fontWeight: 600 }}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={18} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #dbe3ef', fontSize: '14px', fontWeight: 600 }}>
            <option value="default">Default</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name: A-Z</option>
          </select>
        </div>
        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{filtered.length} products</div>
      </div>
      <div className="shop-product-grid">
        {filtered.map(product => {
          const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : Math.round((1 - product.price / product.mrp) * 100);
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? (
                  <img src={product.image} alt={product.name} loading="lazy" />
                ) : (
                  <div className="emoji">PROD</div>
                )}
                {discount > 0 && <span className="discount-badge">{discount}% OFF</span>}
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
              <div className="product-price-row">
                <span><span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span><span className="price-original">Rs {product.mrp}</span></span>
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
