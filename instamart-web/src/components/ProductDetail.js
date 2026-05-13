import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { ProductPageBlocks } from './PageBuilderRenderer';

function ProductDetail({ products, onAdd, onRemove, cartItems = [], user, onLogin, priceForRole, savedProductIds = [], onToggleSaved = null, pageContent = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const productId = parseInt(id, 10);
  const listProduct = products.find(p => p.id === productId);
  const [remoteProduct, setRemoteProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    let active = true;
    setRemoteProduct(null);
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

  const matchedRemoteProduct = remoteProduct && Number(remoteProduct.id) === productId
    ? remoteProduct
    : null;
  const product = matchedRemoteProduct || listProduct;
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
  const categoryName = product?.category_name || listProduct?.category_name || 'Category';
  const categoryId = Number(product?.category_id || listProduct?.category_id || 0);

  useEffect(() => {
    if (!product) return undefined;
    const siteUrl = 'https://getcamigo.in';
    const currentUrl = `${siteUrl}/product/${productId}`;
    const title = `${product.name} | Camigo`;
    const description = String(product.description || 'Buy CCTV products from Camigo with fast dispatch and installation support.').slice(0, 160);
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    const previousCanonical = existingCanonical?.getAttribute('href') || '';
    const previousTitle = document.title;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const previousOgTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const previousOgDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const previousOgUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
    const previousOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

    const ensureMeta = (selector, attr, value) => {
      let node = document.head.querySelector(selector);
      if (!node) {
        node = document.createElement('meta');
        const match = selector.match(/\[(.*?)="(.*?)"\]/);
        if (match) node.setAttribute(match[1], match[2]);
        document.head.appendChild(node);
      }
      node.setAttribute(attr, value);
      return node;
    };

    document.title = title;
    if (existingCanonical) existingCanonical.setAttribute('href', currentUrl);
    ensureMeta('meta[name="description"]', 'content', description);
    ensureMeta('meta[property="og:title"]', 'content', title);
    ensureMeta('meta[property="og:description"]', 'content', description);
    ensureMeta('meta[property="og:url"]', 'content', currentUrl);
    ensureMeta('meta[property="og:image"]', 'content', gallery[0] || `${siteUrl}/camigo-logo.svg`);

    const schemaNode = document.createElement('script');
    schemaNode.type = 'application/ld+json';
    schemaNode.dataset.camigoSchema = 'product';
    schemaNode.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: product.name,
          description,
          image: gallery,
          sku: String(product.id),
          brand: {
            '@type': 'Brand',
            name: 'Camigo'
          },
          mpn: String(product.id),
          offers: {
            '@type': 'Offer',
            url: currentUrl,
            priceCurrency: 'INR',
            price: Number(product.price || 0).toFixed(2),
            availability: Number(product.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition'
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(product.rating_average || 4.6).toFixed(1),
            reviewCount: Number(product.rating_count || 1)
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${siteUrl}/`
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Shop',
              item: `${siteUrl}/shop`
            },
            ...(categoryId ? [{
              '@type': 'ListItem',
              position: 3,
              name: categoryName,
              item: `${siteUrl}/category/${categoryId}`
            }] : []),
            {
              '@type': 'ListItem',
              position: categoryId ? 4 : 3,
              name: product.name,
              item: currentUrl
            }
          ]
        }
      ]
    });
    document.head.appendChild(schemaNode);

    return () => {
      document.title = previousTitle;
      if (existingCanonical) existingCanonical.setAttribute('href', previousCanonical);
      ensureMeta('meta[name="description"]', 'content', previousDescription);
      ensureMeta('meta[property="og:title"]', 'content', previousOgTitle);
      ensureMeta('meta[property="og:description"]', 'content', previousOgDescription);
      ensureMeta('meta[property="og:url"]', 'content', previousOgUrl);
      ensureMeta('meta[property="og:image"]', 'content', previousOgImage);
      schemaNode.remove();
    };
  }, [gallery, product, productId]);

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
    <div className="container product-detail-shell">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Shop</Link>
        {categoryId ? (
          <>
            <span>/</span>
            <Link to={`/category/${categoryId}`}>{categoryName}</Link>
          </>
        ) : null}
        <span>/</span>
        <span>{product.name}</span>
      </nav>
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
    </div>
  );
}

export default ProductDetail;
