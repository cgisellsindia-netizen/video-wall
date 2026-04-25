import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { API_URL } from '../api';

function CategoryPage({ categories, products, onAdd, onRemove, user, priceForRole, cartItems = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const categoryId = parseInt(id);
  const category = categories.find(c => c.id === categoryId);
  const categoryProducts = products.filter(p => p.category_id === categoryId);
  const [banners, setBanners] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/categories/${categoryId}/banners`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!alive) return;
        setBanners(Array.isArray(data) ? data : []);
        setBannerIndex(0);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => { alive = false; };
  }, [categoryId]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setBannerIndex(current => (current + 1) % banners.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [banners]);

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

      {banners.length > 0 && (
        <section className="category-banner-strip">
          <div
            className="category-banner-track"
            style={{ transform: `translateX(-${bannerIndex * 100}%)` }}
          >
            {banners.map(banner => (
              <div
                key={banner.id}
                className="category-banner-slide"
                style={{ aspectRatio: `${banner.width || 1200} / ${banner.height || 320}` }}
              >
                <img src={banner.image_url} alt={`${category?.name || 'Category'} banner`} />
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="category-banner-dots">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  className={index === bannerIndex ? 'active' : ''}
                  onClick={() => setBannerIndex(index)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="shop-product-grid">
        {categoryProducts.map(product => {
          const cartItem = cartItems.find(item => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="emoji">CCTV</div>}
                {discount > 0 && <span className="discount-badge">{discount}% OFF</span>}
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
              <div className="product-price-row">
                <span><span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span><span className="price-original">Rs {product.mrp}</span></span>
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
