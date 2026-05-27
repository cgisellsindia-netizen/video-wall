import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Minus, Plus, Search, SlidersHorizontal, Star } from 'lucide-react';
import CategoryBannerCarousel from './CategoryBannerCarousel';
import ProductImage from './ProductImage';
import { buildProductImageSources, getProductFallbackImage } from '../imageFallbacks';
import usePageSeo from '../usePageSeo';

function CategoryPage({ categories, products, onAdd, onRemove, user, priceForRole, cartItems = [], savedProductIds = [], onToggleSaved = null, deliveryEtaLabel = '16 mins', seoAutomationSnapshot = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const categoryId = parseInt(id, 10);
  const category = categories.find((entry) => entry.id === categoryId);
  const [sortBy, setSortBy] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceBand, setPriceBand] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const siblingCategories = categories.filter((entry) => entry.id !== categoryId).slice(0, 7);

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

  const topRatedProducts = useMemo(
    () => [...categoryProducts]
      .sort((a, b) => {
        const ratingDelta = Number(b.rating_average || 0) - Number(a.rating_average || 0);
        if (ratingDelta !== 0) return ratingDelta;
        return Number(b.rating_count || 0) - Number(a.rating_count || 0);
      })
      .slice(0, 3),
    [categoryProducts]
  );
  const budgetProducts = useMemo(
    () => [...categoryProducts]
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 3),
    [categoryProducts]
  );
  const installerFavorites = useMemo(
    () => [...categoryProducts]
      .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
      .slice(0, 3),
    [categoryProducts]
  );

  const categoryGuide = useMemo(() => {
    const fallback = {
      title: `How to choose ${category?.name || 'the right CCTV gear'}`,
      body: 'Compare image quality, recording compatibility, installation effort, and the exact site use before you buy.'
    };
    const guideMap = {
      'Night Color AHD Cameras': {
        title: 'Best when you want simple analog upgrades',
        body: 'AHD cameras are strong for cost-sensitive upgrades where you want better night visibility without moving fully to IP networking.'
      },
      'IP Cameras': {
        title: 'Best when image quality and smart features matter',
        body: 'IP cameras suit sharper images, PoE setups, remote access and cleaner modern installations across homes, offices and shops.'
      },
      'PTZ Cameras': {
        title: 'Best when you need wide control and zoom',
        body: 'PTZ models are ideal for campuses, gates, warehouses and roads where tracking movement and zooming into incidents matter.'
      },
      'DVR Recorders': {
        title: 'Choose by channel count and future expansion',
        body: 'Pick a DVR based on how many analog cameras you need now and whether you want room to expand later without replacing the recorder.'
      },
      'NVR Recorders': {
        title: 'Choose by IP channel load and storage plan',
        body: 'NVRs work best when you match the recorder with your camera resolution, storage retention window and total site scale.'
      },
      'PoE Switches': {
        title: 'Choose by port count and power budget',
        body: 'For PoE switches, the important things are total cameras, uplink need, cable distance and whether you need gigabit backhaul.'
      },
      'SMPS Power Supplies': {
        title: 'Choose by camera count and clean power overhead',
        body: 'A stable SMPS should always leave some headroom instead of running at the exact maximum camera load.'
      },
      Accessories: {
        title: 'Choose by installation quality, not just price',
        body: 'The right cable, connectors and mounting accessories keep CCTV systems more stable and reduce failure later.'
      }
    };
    return guideMap[category?.name] || fallback;
  }, [category?.name]);
  const activeFilterCount = [
    sortBy !== 'default',
    priceBand !== 'all',
    availability !== 'all'
  ].filter(Boolean).length;
  const seoProducts = categoryProducts.slice(0, 10);
  const seoTitle = category?.name
    ? `${category.name} in Bhubaneswar and Odisha | Camigo CCTV Category`
    : 'Camigo CCTV Category';
  const seoDescription = category?.name
    ? `Browse ${categoryProducts.length} ${category.name} products on Camigo for CCTV camera buyers in Bhubaneswar and Odisha, with installation support and local delivery options.`
    : 'Browse CCTV products on Camigo for Bhubaneswar and Odisha with fast dispatch and installation support.';
  const canonicalUrl = `https://getcamigo.in/category/${categoryId}`;
  const seoImage = seoProducts[0]?.image || 'https://getcamigo.in/camigo-logo.svg';
  const categorySeoBlock = Array.isArray(seoAutomationSnapshot?.generated_copy?.category_blocks)
    ? seoAutomationSnapshot.generated_copy.category_blocks.find((entry) => Number(entry.category_id) === Number(categoryId))
    : null;
  const resolvedSeoTitle = categorySeoBlock?.supporting_terms?.[0]
    ? `${categorySeoBlock.supporting_terms[0]} | Camigo`
    : seoTitle;
  const resolvedSeoDescription = categorySeoBlock?.paragraph || seoDescription;

  usePageSeo({
    title: resolvedSeoTitle,
    description: resolvedSeoDescription,
    canonicalUrl,
    image: seoImage,
    schema: category ? {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: resolvedSeoTitle,
          description: resolvedSeoDescription,
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
            {
              '@type': 'ListItem',
              position: 3,
              name: category.name,
              item: canonicalUrl
            }
          ]
        }
      ]
    } : null
  });

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
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <span>{category?.name || 'Category'}</span>
      </nav>
      <button className="back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={20} /> Back
      </button>
      <CategoryBannerCarousel placementId={categoryId} />
      <div className="category-page-hero">
        <div>
          <span className="eyebrow">Fast local delivery</span>
          <h1>{categorySeoBlock?.heading || category?.name || 'Loading category...'}</h1>
          <p>{categorySeoBlock?.paragraph || `${categoryProducts.length} products ready for quick CCTV dispatch and installation support.`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>View all products</button>
      </div>

      {categorySeoBlock?.paragraph ? (
        <section className="seo-auto-copy-block">
          <strong>{categorySeoBlock.heading || `${category?.name || 'Category'} trend`}</strong>
          <p>{categorySeoBlock.paragraph}</p>
          {Array.isArray(categorySeoBlock.supporting_terms) && categorySeoBlock.supporting_terms.length ? (
            <div className="seo-auto-copy-links">
              {categorySeoBlock.supporting_terms.map((keyword) => (
                <Link key={keyword} to={`/shop?search=${encodeURIComponent(keyword)}`} className="seo-link-chip subtle">
                  {keyword}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="category-chip-row">
        <button type="button" className="category-chip active">
          {category?.name || 'Current category'}
        </button>
        {siblingCategories.map((entry) => (
          <button key={entry.id} type="button" className="category-chip" onClick={() => navigate(`/category/${entry.id}`)}>
            {entry.name}
          </button>
        ))}
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
        <div className="shop-filter-toolbar">
          <button
            type="button"
            className={filterOpen ? 'shop-filter-toggle active' : 'shop-filter-toggle'}
            onClick={() => setFilterOpen((current) => !current)}
          >
            <SlidersHorizontal size={18} />
            <span>Filters</span>
            {activeFilterCount > 0 && <strong className="shop-filter-badge">{activeFilterCount}</strong>}
          </button>
          <div className="shop-result-count">{categoryProducts.length} products</div>
        </div>
        {filterOpen && (
          <div className="shop-filter-grid shop-filter-panel">
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
          </div>
        )}
      </div>

      <div className="catalog-strip-grid">
        {topRatedProducts.length > 0 && (
          <button type="button" className="catalog-strip-card" onClick={() => setSortBy('rating')}>
            <span>Top rated in this category</span>
            <strong>{topRatedProducts[0].name}</strong>
            <small>Quick shortlist based on buyer ratings.</small>
          </button>
        )}
        {budgetProducts.length > 0 && (
          <button type="button" className="catalog-strip-card warm" onClick={() => setSortBy('price-low')}>
            <span>Budget picks</span>
            <strong>{budgetProducts[0].name}</strong>
            <small>Open the lower-price side of this category first.</small>
          </button>
        )}
        {installerFavorites.length > 0 && (
          <button type="button" className="catalog-strip-card cool" onClick={() => setAvailability('in-stock')}>
            <span>Ready stock picks</span>
            <strong>{installerFavorites[0].name}</strong>
            <small>Push in-stock products to the front for faster dispatch.</small>
          </button>
        )}
      </div>

      <div className="shop-product-grid">
        {categoryProducts.map((product, index) => {
          const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
          const selectedQty = cartItem?.quantity || 0;
          const isOutOfStock = Number(product.stock || 0) <= 0;
          const isSaved = savedProductIds.includes(Number(product.id));
          const discount = Number(product.discount_percent) > 0 ? Math.round(Number(product.discount_percent)) : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
          return (
            <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-img-wrap">
                <ProductImage
                  src={product.image}
                  sources={buildProductImageSources(product)}
                  fallbackSrc={getProductFallbackImage(product)}
                  alt={product.name}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  fetchPriority={index < 2 ? 'high' : 'auto'}
                  fallbackContent="CCTV"
                  proxyWidth={360}
                  proxyQuality={64}
                  proxyFormat="webp"
                  preferDirect={false}
                  sizes="(max-width: 768px) 44vw, 240px"
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
          <span className="eyebrow">Category guide</span>
          <h3>{categoryGuide.title}</h3>
          <p>{categoryGuide.body}</p>
        </div>
      </section>
    </main>
  );
}

export default CategoryPage;
