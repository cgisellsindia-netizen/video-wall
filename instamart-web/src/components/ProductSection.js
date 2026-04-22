import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

function ProductSection({ title, products, onAdd, user }) {
  const navigate = useNavigate();
  if (!products || products.length === 0) return null;

  return (
    <div className="product-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="see-all">See all</span>
      </div>
      <div className="product-scroll">
        {products.map(product => {
          const discount = product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;

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
              </div>
              <div className="product-name">{product.name}</div>
              <div className="product-weight">{product.unit}</div>
              <div className="product-price-row">
                <span>
                  <span className="price-current">Rs {user?.role === 'dealer' ? Math.round(product.price * 0.90) : user?.role === 'distributor' ? Math.round(product.price * 0.85) : product.price}</span>
                  <span className="price-original">Rs {product.mrp}</span>
                </span>
              </div>
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
              <button className="add-btn" onClick={(e) => { e.stopPropagation(); onAdd(product); }}>
                <Plus size={16} /> ADD
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductSection;
