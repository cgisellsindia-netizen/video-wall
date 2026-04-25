import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Truck, ShieldCheck, Clock3, BadgeCheck, Sparkles, Package2 } from 'lucide-react';
import { API_URL } from '../api';

function ProductDetail({ products, onAdd, onRemove, cartItems = [], user, onLogin, priceForRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const listProduct = products.find(p => p.id === parseInt(id, 10));
  const [remoteProduct, setRemoteProduct] = useState(null);
  const [loading, setLoading] = useState(!listProduct);
  const [activeImage, setActiveImage] = useState('');
  const stopActionTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (listProduct) {
      setRemoteProduct(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetch(`${API_URL}/products/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (active) setRemoteProduct(data); })
      .catch(() => { if (active) setRemoteProduct(null); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, listProduct]);

  const product = listProduct || remoteProduct;
  const gallery = Array.isArray(product?.images) && product.images.length
    ? product.images
    : (product?.image ? [product.image] : []);

  useEffect(() => {
    setActiveImage(gallery[0] || '');
  }, [product?.id, gallery[0]]);

  const featureList = useMemo(() => (
    String(product?.description || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 6)
  ), [product?.description]);

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
  const savings = Math.max(0, Number(product.mrp || 0) - Number(sellingPrice || 0));
  const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
  const selectedQty = cartItem?.quantity || 0;
  const relatedProducts = products
    .filter(item => item.id !== product.id && item.category_id === product.category_id)
    .slice(0, 4);
  const warrantyYears = Math.max(1, Number(product.warranty_years || 5));

  const handleAdd = () => {
    if (!user) { onLogin(); return; }
    onAdd(product);
  };

  return (
    <div className="product-detail-page container">
      <button className="back-btn product-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} /> Back
      </button>

      <section className="product-hero-shell">
        <div className="product-detail-card">
          <div className="product-detail-img modern-product-stage">
            <div className="product-stage-noise" />
            {discount > 0 && <span className="discount-badge-large">{discount}% OFF</span>}
            <span className="product-stage-chip chip-blue">{product.category_name || 'CCTV Product'}</span>
            <span className="product-stage-chip chip-gold">{warrantyYears} year warranty</span>
            {activeImage ? <img src={activeImage} alt={product.name} /> : <div className="emoji" style={{ fontSize: '120px' }}>CCTV</div>}
            <div className="product-stage-footer">
              <div>
                <strong>Ready for fast dispatch</strong>
                <span>Installation-focused packaging and verified camera stock.</span>
              </div>
              <Sparkles size={18} />
            </div>
            {gallery.length > 1 && (
              <div className="product-gallery-thumbs">
                {gallery.map(image => (
                  <button
                    key={image}
                    type="button"
                    className={image === activeImage ? 'product-thumb active' : 'product-thumb'}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-info product-buy-panel">
            <div className="product-top-meta">
              <span className="product-meta-pill">{product.category_name || 'Security device'}</span>
              <span className="product-meta-pill soft">{product.unit || '1 Unit'}</span>
            </div>

            <h1 className="product-detail-name">{product.name}</h1>
            <p className="product-detail-desc">{product.description}</p>

            <div className="product-feature-chips">
              {featureList.slice(0, 4).map(feature => <span key={feature}>{feature}</span>)}
            </div>

            <div className="product-price-panel">
              <div className="product-detail-price modern-price-row">
                <span className="price-current product-price-main">Rs {sellingPrice}</span>
                <span className="price-original product-price-cut">Rs {product.mrp}</span>
                {discount > 0 && <span className="price-discount">{discount}% off</span>}
              </div>
              {savings > 0 && <div className="product-savings-note">You save Rs {savings} on this product</div>}
              {(user?.role === 'dealer' || user?.role === 'distributor') && (
                <div className="trade-detail-note">Special {user.role} price applied for this account.</div>
              )}
            </div>

            <div className="product-detail-badges modern-badges-grid">
              <div className="detail-badge"><Truck size={16} /> Same-day dispatch zone</div>
              <div className="detail-badge"><Clock3 size={16} /> Fast order processing</div>
              <div className="detail-badge"><ShieldCheck size={16} /> Verified Camigo support</div>
            </div>

            <div className="product-action-block">
              {selectedQty > 0 ? (
                <div className="detail-qty-stepper">
                  <button type="button" onTouchStart={stopActionTap} onMouseDown={stopActionTap} onClick={(e) => { stopActionTap(e); onRemove(product, cartItem); }}><Minus size={18} /></button>
                  <strong>{selectedQty}</strong>
                  <button type="button" onTouchStart={stopActionTap} onMouseDown={stopActionTap} onClick={(e) => { stopActionTap(e); handleAdd(); }}><Plus size={18} /></button>
                </div>
              ) : (
                <button className="add-btn-large" type="button" onTouchStart={stopActionTap} onMouseDown={stopActionTap} onClick={(e) => { stopActionTap(e); handleAdd(); }}>
                  <Plus size={20} /> Add to Cart
                </button>
              )}
              <button className="product-secondary-action" onClick={() => navigate('/checkout')}>
                Buy now
              </button>
            </div>

            <div className="product-trust-strip">
              <div><BadgeCheck size={16} /><span>Trusted CGI lineup</span></div>
              <div><Package2 size={16} /><span>Careful packed delivery</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="product-detail-lower">
        <div className="product-info-card">
          <div className="product-info-card-head">
            <span className="eyebrow">Highlights</span>
            <h2>What you are getting</h2>
          </div>
          <div className="product-spec-grid">
            {featureList.map((feature, index) => (
              <div key={`${feature}-${index}`} className="product-spec-card">
                <span>0{index + 1}</span>
                <strong>{feature}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="product-service-card">
          <span className="eyebrow">After purchase</span>
          <h3>Delivery, warranty and support</h3>
          <div className="service-line">
            <strong>Warranty coverage</strong>
            <span>{warrantyYears} years from the purchase date</span>
          </div>
          <div className="service-line">
            <strong>Delivery zone</strong>
            <span>Bhubaneswar and Cuttack same-day where available</span>
          </div>
          <div className="service-line">
            <strong>Installation support</strong>
            <span>Add technician help during checkout when needed</span>
          </div>
          <div className="service-line">
            <strong>Best fit for</strong>
            <span>{product.category_name || 'Homes, shops, and commercial use'}</span>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="related-products modern-related-products">
          <div className="related-header-row">
            <div>
              <span className="eyebrow">Suggested for this setup</span>
              <h2>Related products</h2>
            </div>
            <button className="see-all-related" onClick={() => navigate(`/category/${product.category_id}`)}>See more</button>
          </div>
          <div className="related-product-grid">
            {relatedProducts.map(item => (
              <button key={item.id} className="related-product-card" onClick={() => navigate(`/product/${item.id}`)}>
                <img src={item.image} alt={item.name} />
                <div className="related-product-body">
                  <small>{item.unit}</small>
                  <strong>{item.name}</strong>
                  <span>Rs {priceForRole ? priceForRole(item, user) : item.price}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetail;
