import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { ProductPageBlocks } from './PageBuilderRenderer';

function ProductDetail({ products, onAdd, onRemove, cartItems = [], user, onLogin, priceForRole, savedProductIds = [], onToggleSaved = null, pageContent = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const listProduct = products.find(p => p.id === parseInt(id, 10));
  const [remoteProduct, setRemoteProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API_URL}/products/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active) setRemoteProduct(data);
      })
      .catch(() => {
        if (active) setRemoteProduct(null);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id]);

  const product = remoteProduct || listProduct;
  const gallery = useMemo(() => {
    const merged = [
      ...(Array.isArray(product?.images) ? product.images : []),
      product?.image
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return merged.filter((value, index) => merged.indexOf(value) === index);
  }, [product?.images, product?.image]);

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

  return (
    <ProductPageBlocks
      pageContent={pageContent}
      product={product}
      products={products}
      gallery={gallery}
      activeImage={activeImage}
      setActiveImage={setActiveImage}
      user={user}
      onLogin={onLogin}
      onAdd={onAdd}
      onRemove={onRemove}
      cartItems={cartItems}
      priceForRole={priceForRole}
      savedProductIds={savedProductIds}
      onToggleSaved={onToggleSaved}
    />
  );
}

export default ProductDetail;
