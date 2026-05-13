import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, Heart, Minus, Plus, Search, SlidersHorizontal, Star } from 'lucide-react';
import ProductImage from './ProductImage';
import { buildProductImageSources, getProductFallbackImage } from '../imageFallbacks';
import usePageSeo from '../usePageSeo';

function ShopPage({ products, categories, onAdd, onRemove, user, priceForRole, cartItems = [], savedProductIds = [], onToggleSaved = null, deliveryEtaLabel = '16 mins' }) {
  const [selectedCat, setSelectedCat] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [priceBand, setPriceBand] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [minRating, setMinRating] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();
  const spotlightCategories = categories.slice(0, 8);
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
  const topRatedProducts = useMemo(
    () => [...filtered]
      .sort((a, b) => {
        const ratingDelta = Number(b.rating_average || 0) - Number(a.rating_average || 0);
        if (ratingDelta !== 0) return ratingDelta;
        return Number(b.rating_count || 0) - Number(a.rating_count || 0);
      })
      .slice(0, 4),
    [filtered]
  );
  const bestDiscountProducts = useMemo(
    () => [...filtered]
      .sort((a, b) => Number(b.discount_percent || 0) - Number(a.discount_percent || 0))
      .slice(0, 4),
    [filtered]
  );
  const activeFilterCount = [
    selectedCat !== 'all',
    sortBy !== 'default',
    priceBand !== 'all',
    availability !== 'all',
    minRating !== 'all'
  ].filter(Boolean).length;
  const activeCategory = selectedCat === 'all'
    ? null
    : categories.find((category) => String(category.id) === String(selectedCat));
  const seoTitle = activeCategory
    ? `${activeCategory.name} | Camigo Shop`
    : 'Shop CCTV Cameras, DVRs, NVRs and Accessories | Camigo';
  const seoDescription = activeCategory
    ? `Explore ${filtered.length} products in ${activeCategory.name} on Camigo with CCTV dispatch, installation support, and local delivery from Bhubaneswar.`
    : `Browse ${filtered.length} CCTV products, setup packages, recorders, switches, and accessories on Camigo with fast local dispatch and installation support.`;
  const canonicalUrl = activeCategory
    ? `https://getcamigo.in/shop?category=${activeCategory.id}`
    : 'https://getcamigo.in/shop';
  const seoProducts = filtered.slice(0, 10);
  const seoImage = seoProducts[0]?.image || 'https://getcamigo.in/camigo-logo.svg';

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalUrl,
    image: seoImage,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: seoTitle,
          description: seoDescription,
          url: canonicalUrl,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: seoProducts.map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `https://getcamigo.in/product/${product.id}`,
              name: product.name
            }))
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://getcamigo.in/'
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Shop',
              item: 'https://getcamigo.in/shop'
            },
            ...(activeCategory ? [{
              '@type': 'ListItem',
              position: 3,
              name: activeCategory.name,
              item: canonicalUrl
            }] : [])
          ]
        }
      ]
    }
  });

  const stopCardTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerAction = (handler) => (event) => {
    stopCardTap(event);
    handler();
  };

  return (
    <div className="container shop-page-shell">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Shop</Link>
        {activeCategory && (
          <>
            <span>/</span>
            <span>{activeCategory.name}</span>
          </>
        )}
      </nav>
      <div className="category-page-hero shop-hero-compact">
        <div>
          <span className="eyebrow">Fast category browsing</span>
          <h1>Shop All Products</h1>
          <p>Quick scanning, fast add-to-cart, and clear category jumps across the full Camigo catalog.</p>
        </div>
      </div>

      <div className="category-chip-row shop-chip-row">
        <button
          type="button"
          className={selectedCat === 'all' ? 'category-chip active' : 'category-chip'}
          onClick={() => setSelectedCat('all')}
        >
          All products
        </button>
        {spotlightCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={selectedCat === String(category.id) ? 'category-chip active' : 'category-chip'}
            onClick={() => setSelectedCat(String(category.id))}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="shop-filter-shell">
        <div className="shop-search-inline">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search inside all products"
          />
        </div>
        <div className="shop-filter-toolbar">
          <button
            type="button"
            className={filterOpen ? 'shop-filter-toggle active' : 'shop-filter-toggle'}
            onClick={() => setFilterOpen((current) => !current)}
          >
            <Filter size={18} />
            <span>Filters</span>
            {activeFilterCount > 0 && <strong className="shop-filter-badge">{activeFilterCount}</strong>}
          </button>
          <div className="shop-result-count">{filtered.length} products</div>
        </div>
        {filterOpen && (
          <div className="shop-filter-grid shop-filter-panel">
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
          </div>
        )}
      </div>

      {(topRatedProducts.length > 0 || bestDiscountProducts.length > 0) && (
        <div className="catalog-strip-grid">
          {topRatedProducts.length > 0 && (
            <button type="button" className="catalog-strip-card" onClick={() => setSortBy('rating')}>
              <span>Top rated picks</span>
              <strong>{topRatedProducts[0].name}</strong>
              <small>Sorted by customer rating for fast shortlisting.</small>
            </button>
          )}
          {bestDiscountProducts.length > 0 && (
            <button type="button" className="catalog-strip-card warm" onClick={() => setSortBy('discount')}>
              <span>Best offers</span>
              <strong>{bestDiscountProducts[0].name}</strong>
              <small>Jump straight to the highest-discount products.</small>
            </button>
          )}
        </div>
      )}

      <div className="shop-product-grid">
        {filtered.map((product) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const isOutOfStock = Number(product.stock || 0) <= 0;
          const isSaved = savedProductIds.includes(Number(product.id));
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : Math.round((1 - product.price / product.mrp) * 100);
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                <ProductImage
                  src={product.image}
                  sources={buildProductImageSources(product)}
                  fallbackSrc={getProductFallbackImage(product)}
                  alt={product.name}
                  loading="lazy"
                  fallbackContent="PROD"
                />
                {discount > 0 && (
                  <span className="product-corner-offer" aria-label={`${discount}% off`}>
                    <strong>{discount}%</strong>
                    <small>OFF</small>
                  </span>
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
                <span className="delivery-badge">{deliveryEtaLabel}</span>
              </div>
              <div className="product-name">{product.name}</div>
              <div className="product-weight">{product.unit}</div>
              <div className="product-rating-row">
                <Star size={13} fill="currentColor" />
                <strong>{Number(product.rating_average || 4.6).toFixed(1)}</strong>
                <span>({Number(product.rating_count || 200)})</span>
              </div>
              <div className="product-price-row blinkit-price-row" onClick={stopCardTap}>
                <span className="product-price-stack"><span className="price-current">Rs {priceForRole ? priceForRole(product, user) : product.price}</span><span className="price-original">Rs {product.mrp}</span></span>
                {isOutOfStock ? (
                  <button className="inline-sold-out-btn" type="button" disabled aria-disabled="true" onClick={stopCardTap}>Sold out</button>
                ) : selectedQty > 0 ? (
                  <div className="card-qty-stepper inline-stepper">
                    <button type="button" onPointerDown={handlePointerAction(() => onRemove(product, cartItem))} onClick={stopCardTap}><Minus size={15} /></button>
                    <strong>{selectedQty}</strong>
                    <button type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}><Plus size={15} /></button>
                  </div>
                ) : (
                  <button className="add-btn inline-add-btn" type="button" onPointerDown={handlePointerAction(() => onAdd(product))} onClick={stopCardTap}>ADD</button>
                )}
              </div>
              <div className="shop-card-meta-row">
                <span className={`stock-dot ${isOutOfStock ? 'low' : 'ok'}`}>{isOutOfStock ? 'Out of stock' : 'In stock'}</span>
              </div>
              {(user?.role === 'dealer' || user?.role === 'distributor') && <div className="trade-price-note">{user.role} price</div>}
            </div>
          );
        })}
      </div>

      <section className="category-explainer-block">
        <div className="category-explainer-card">
          <span className="eyebrow">Browse faster</span>
          <h3>Made for scan speed, not slow catalog hunting</h3>
          <p>
            This Camigo shop view is tuned for quick CCTV buying: use category chips to jump between product families,
            filters to narrow price or stock, and the card actions to save or add without opening every product.
          </p>
        </div>
      </section>
    </div>
  );
}

export default ShopPage;
