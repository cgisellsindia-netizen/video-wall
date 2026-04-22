import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Truck, Shield, Clock } from 'lucide-react';
import { API_URL } from '../api';

function ProductDetail({ products, onAdd, onRemove, cartItems = [], user, onLogin, priceForRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const listProduct = products.find(p => p.id === parseInt(id));
  const [remoteProduct, setRemoteProduct] = useState(null);
  const [loading, setLoading] = useState(!listProduct);

  useEffect(() => {
    if (listProduct) {
      setRemoteProduct(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetch(`${API_URL}/products/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (active) setRemoteProduct(data); })
      .catch(() => { if (active) setRemoteProduct(null); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, listProduct]);

  const product = listProduct || remoteProduct;

  if (loading) {
    return <div className="container" style={{ padding: '48px 16px' }}><h2 className="section-title">Loading product...</h2></div>;
  }

  if (!product) {
    return (
      <div className="container" style={{ padding: '48px 16px', textAlign: 'center' }}>
        <h2>Product not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/shop')} style={{ marginTop: '16px' }}>
          Back to Shop
        </button>
      </div>
    );
  }

  const discount = Number(product.discount_percent) > 0
    ? Math.round(Number(product.discount_percent))
    : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
  const sellingPrice = priceForRole ? priceForRole(product, user) : product.price;
  const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
  const selectedQty = cartItem?.quantity || 0;
  const relatedProducts = products
    .filter(item => item.id !== product.id && item.category_id === product.category_id)
    .slice(0, 4);

  const handleAdd = () => {
    if (!user) { onLogin(); return; }
    onAdd(product);
  };

  return (
    <div className="container" style={{ maxWidth: '980px', padding: '24px 16px 90px' }}>
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} /> Back
      </button>

      <div className="product-detail-card">
        <div className="product-detail-img">
          {product.image ? <img src={product.image} alt={product.name} /> : <div className="emoji" style={{ fontSize: '120px' }}>CCTV</div>}
          {discount > 0 && <span className="discount-badge-large">{discount}% OFF</span>}
        </div>

        <div className="product-detail-info">
          <h1 className="product-detail-name">{product.name}</h1>
          <p className="product-detail-desc">{product.description}</p>
          <p className="product-detail-weight">{product.unit}</p>

          <div className="product-detail-price">
            <span className="price-current" style={{ fontSize: '28px' }}>Rs {sellingPrice}</span>
            <span className="price-original" style={{ fontSize: '18px' }}>Rs {product.mrp}</span>
            <span className="price-discount">{discount}% off</span>
          </div>
          {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-detail-note">Special {user.role} price applied at checkout.</div>}

          <div className="product-detail-badges">
            <div className="detail-badge"><Truck size={16} /> Free delivery</div>
            <div className="detail-badge"><Clock size={16} /> 8 min delivery</div>
            <div className="detail-badge"><Shield size={16} /> Best price guaranteed</div>
          </div>

          {selectedQty > 0 ? (
            <div className="detail-qty-stepper">
              <button onClick={() => onRemove(product, cartItem)}><Minus size={18} /></button>
              <strong>{selectedQty}</strong>
              <button onClick={handleAdd}><Plus size={18} /></button>
            </div>
          ) : (
            <button className="add-btn-large" onClick={handleAdd}>
              <Plus size={20} /> Add to Cart
            </button>
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="related-products">
          <span className="eyebrow">Suggested for this setup</span>
          <h2>Related products</h2>
          <div className="related-product-grid">
            {relatedProducts.map(item => (
              <button key={item.id} className="related-product-card" onClick={() => navigate(`/product/${item.id}`)}>
                <img src={item.image} alt={item.name} />
                <strong>{item.name}</strong>
                <span>Rs {priceForRole ? priceForRole(item, user) : item.price}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetail;
