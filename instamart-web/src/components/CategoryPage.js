import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function CategoryPage({ categories, products, onAdd, user, priceForRole, cartItems = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const categoryId = parseInt(id);
  const category = categories.find(c => c.id === categoryId);
  const categoryProducts = products.filter(p => p.category_id === categoryId);

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
      <div className="category-page-hero">
        <div>
          <span className="eyebrow">Fast local delivery</span>
          <h1>{category?.name || 'Loading category...'}</h1>
          <p>{categoryProducts.length} products ready for quick CCTV dispatch and installation support.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>View all products</button>
      </div>

      <div className="shop-product-grid">
        {categoryProducts.map(product => {
          const selectedQty = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id))?.quantity || 0;
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="emoji">CCTV</div>}
                {discount > 0 && <span className="discount-badge">{discount}% OFF</span>}
                <span className="delivery-badge">8 min</span>
              </div>
              <div className="product-name">{product.name}</div>
              <div className="product-weight">{product.unit}</div>
              <div className="product-price-row">
                <span><span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span><span className="price-original">Rs {product.mrp}</span></span>
              </div>
              {selectedQty > 0 && <div className="selected-qty-pill">{selectedQty} selected in cart</div>}
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
              <button className={selectedQty > 0 ? 'add-btn added' : 'add-btn'} onClick={(e) => { e.stopPropagation(); onAdd(product); }}>+ {selectedQty > 0 ? 'ADD MORE' : 'ADD'}</button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default CategoryPage;
