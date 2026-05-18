import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Clock3, Heart, MessageCircle, Minus, Package2, Plus, Share2, ShoppingCart, ShieldCheck, Sparkles, Star, Truck, Zap } from 'lucide-react';
import HeroBanner from './HeroBanner';
import CategoryGrid from './CategoryGrid';
import SetupPackagesSection from './SetupPackagesSection';
import ProductSection from './ProductSection';
import ProductImage from './ProductImage';

function DeferredBlock({ children, minHeight = 320, rootMargin = '120px 0px' }) {
  const [isVisible, setIsVisible] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (isVisible) {
    return <>{children}</>;
  }

  return <div ref={anchorRef} className="deferred-home-block" style={{ minHeight }} aria-hidden="true" />;
}

function CustomBannerBlock({ block }) {
  if (!block?.image_url) return null;
  return (
    <section className="page-builder-banner" style={{ '--builder-banner-height': `${Math.max(120, Number(block.height || 220))}px` }}>
      <ProductImage src={block.image_url} alt={block.title || 'Banner'} />
      {(block.title || block.subtitle || block.button_label) && (
        <div className="page-builder-banner-overlay">
          {block.title && <strong>{block.title}</strong>}
          {block.subtitle && <span>{block.subtitle}</span>}
          {block.button_label && <button type="button">{block.button_label}</button>}
        </div>
      )}
    </section>
  );
}

function CustomTextBlock({ block }) {
  return (
    <section className="page-builder-text-block card">
      {block.kicker && <span className="phone-verify-eyebrow">{block.kicker}</span>}
      {block.title && <h3>{block.title}</h3>}
      {block.body && <p>{block.body}</p>}
      {block.button_label && <button type="button" className="btn btn-primary btn-sm">{block.button_label}</button>}
    </section>
  );
}

export function HomepageBlocks({
  pageContent,
  categories,
  setupProducts,
  recentProducts,
  savedProducts,
  recommendedProducts,
  bestsellingProducts,
  regularProducts,
  cartItems,
  addToCart,
  removeFromCart,
  user,
  savedProductIds,
  onToggleSaved,
  deliveryEtaLabel = '16 mins'
}) {
  const productsByCategory = categories.map((cat) => ({
    ...cat,
    products: regularProducts.filter((product) => product.category_id === cat.id)
  })).filter((cat) => cat.products.length > 0);

  const feedMap = {
    recent: recentProducts.filter((product) => !String(product.unit || '').toLowerCase().includes('setup')),
    saved: savedProducts.filter((product) => !String(product.unit || '').toLowerCase().includes('setup')),
    recommended: recommendedProducts.filter((product) => !String(product.unit || '').toLowerCase().includes('setup')),
    bestselling: bestsellingProducts.filter((product) => !String(product.unit || '').toLowerCase().includes('setup'))
  };
  const productsById = new Map(regularProducts.map((product) => [Number(product.id), product]));

  let feedRenderIndex = 0;

  return (pageContent?.homepage?.blocks || []).map((block) => {
    if (block.visible === false) return null;
    if (block.type === 'hero') return <HeroBanner key={block.id} config={block} />;
    if (block.type === 'custom_banner') return <CustomBannerBlock key={block.id} block={block} />;
    if (block.type === 'custom_text') return <CustomTextBlock key={block.id} block={block} />;
    if (block.type === 'spacer') return <div key={block.id} style={{ height: Math.max(0, Number(block.height || 24)) }} />;
    if (block.type === 'category_grid') return <CategoryGrid key={block.id} categories={categories} title={block.title || 'Shop by Category'} />;
    if (block.type === 'setup_packages') {
      return (
        <SetupPackagesSection
          key={block.id}
          products={setupProducts}
          onAdd={addToCart}
          onRemove={removeFromCart}
          cartItems={cartItems}
          user={user}
          savedProductIds={savedProductIds}
          onToggleSaved={onToggleSaved}
          deliveryEtaLabel={deliveryEtaLabel}
          title={block.title || 'Full Setup Packages'}
        />
      );
    }
    if (block.type === 'product_feed') {
      feedRenderIndex += 1;
      const prioritizeImages = feedRenderIndex === 1;
      const products = block.source === 'category'
        ? regularProducts.filter((product) => Number(product.category_id) === Number(block.category_id))
        : block.source === 'manual'
          ? (Array.isArray(block.product_ids) ? block.product_ids : [])
            .map((productId) => productsById.get(Number(productId)))
            .filter(Boolean)
          : (feedMap[block.source] || []);
      if (!products.length) return null;
      const section = (
        <ProductSection
          key={block.id}
          title={block.title || 'Products'}
          products={products}
          onAdd={addToCart}
          onRemove={removeFromCart}
          user={user}
          cartItems={cartItems}
          savedProductIds={savedProductIds}
          onToggleSaved={onToggleSaved}
          sectionTone={block.tone || 'neutral'}
          categoryId={block.source === 'category' ? Number(block.category_id) : null}
          deliveryEtaLabel={deliveryEtaLabel}
          prioritizeImages={prioritizeImages}
        />
      );
      if (prioritizeImages) return section;
      return (
        <DeferredBlock key={block.id} minHeight={360}>
          {section}
        </DeferredBlock>
      );
    }
    if (block.type === 'category_feeds') {
      const sections = productsByCategory.map((cat, categoryIndex) => {
        feedRenderIndex += 1;
        const prioritizeImages = feedRenderIndex === 1 && categoryIndex === 0;
        return (
          <ProductSection
            key={`${block.id}-${cat.id}`}
            title={cat.name}
            categoryId={cat.id}
            products={cat.products}
            onAdd={addToCart}
            onRemove={removeFromCart}
            user={user}
            cartItems={cartItems}
            savedProductIds={savedProductIds}
            onToggleSaved={onToggleSaved}
            sectionTone="neutral"
            deliveryEtaLabel={deliveryEtaLabel}
            prioritizeImages={prioritizeImages}
          />
        );
      });
      return (
        <DeferredBlock key={block.id} minHeight={520}>
          {sections}
        </DeferredBlock>
      );
    }
    return null;
  });
}

function ProductHeroBlock({
  block,
  product,
  gallery,
  activeImage,
  setActiveImage,
  user,
  priceForRole,
  savedProductIds,
  onToggleSaved,
  onAdd,
  onRemove,
  cartItem,
  onLogin,
  navigate,
  onShare,
  onWhatsAppShare,
  shareFeedback
}) {
  const featureList = String(product?.description || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const discount = Number(product.discount_percent) > 0
    ? Math.round(Number(product.discount_percent))
    : product.mrp ? Math.max(0, Math.round((1 - product.price / product.mrp) * 100)) : 0;
  const sellingPrice = priceForRole ? priceForRole(product, user) : product.price;
  const savings = Math.max(0, Number(product.mrp || 0) - Number(sellingPrice || 0));
  const selectedQty = cartItem?.quantity || 0;
  const isOutOfStock = Number(product.stock || 0) <= 0;
  const warrantyYears = Math.max(1, Number(product.warranty_years || 5));
  const ratingAverage = Number(product.rating_average || 4.6).toFixed(1);
  const ratingCount = Number(product.rating_count || 200);
  const isSaved = savedProductIds.includes(Number(product.id));

  const stopActionTap = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerAction = (handler) => (event) => {
    stopActionTap(event);
    handler();
  };
  const handleAdd = () => {
    if (!user) {
      onLogin();
      return;
    }
    if (!isOutOfStock) onAdd(product);
  };
  const handleBuyNow = () => {
    if (!user) {
      onLogin();
      return;
    }
    if (isOutOfStock) return;
    navigate('/checkout', {
      state: {
        directBuyItem: {
          ...product,
          quantity: 1
        }
      }
    });
  };

  return (
    <section className="product-hero-shell">
      <div className="product-detail-card">
        <div className="product-detail-img modern-product-stage marketplace-stage">
          <div className="product-stage-noise" />
          <div className="product-stage-topline">
            <span className="product-stage-chip chip-gold">{warrantyYears} year warranty</span>
            <span className="product-stage-chip chip-blue">{product.category_name || 'CCTV Product'}</span>
          </div>
          <div className={gallery.length > 1 ? 'product-stage-visuals has-gallery' : 'product-stage-visuals single-image'}>
            <div className="product-stage-main-shot marketplace-main-shot">
              <ProductImage
                src={activeImage}
                alt={product.name}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                fallbackContent="CCTV"
                proxyWidth={960}
                proxyQuality={82}
                proxyFormat="webp"
              />
            </div>
            {gallery.length > 1 && (
              <div className="product-gallery-thumbs product-gallery-thumbs-under">
                {gallery.map((image, index) => (
                  <button key={`${image}-${index}`} type="button" className={image === activeImage ? 'product-thumb active' : 'product-thumb'} onClick={() => setActiveImage(image)}>
                    <ProductImage
                      src={image}
                      alt=""
                      proxyWidth={140}
                      proxyQuality={58}
                      proxyFormat="webp"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="product-stage-footer marketplace-stage-footer">
            <div>
              <strong>Ready for fast dispatch</strong>
              <span>Installation-focused packaging and verified camera stock.</span>
            </div>
            <Sparkles size={18} />
          </div>
        </div>

        <div className="product-detail-info product-info-column">
          <div className="product-top-meta">
            <span className="product-meta-pill">{product.category_name || 'Security device'}</span>
            <span className="product-meta-pill soft">{product.unit || '1 Unit'}</span>
          </div>
          <h1 className="product-detail-name">{product.name}</h1>
          <div className="product-detail-rating-row">
            <span><Star size={15} fill="currentColor" /> {ratingAverage}</span>
            <strong>{ratingCount} customer ratings</strong>
          </div>
          <p className="product-detail-desc">{product.description}</p>
          <div className="product-feature-chips">
            {featureList.slice(0, 4).map((feature) => <span key={feature}>{feature}</span>)}
          </div>
          <div className="product-detail-copy-card">
            <span className="eyebrow">{block?.whyTitle || 'Why buyers choose this'}</span>
            <p>{block?.whyBody || 'Built for homes, shops and office setups where buyers want quick dispatch, clear specs, stable night vision and a simple buying flow.'}</p>
          </div>
        </div>

        <aside className="product-detail-info product-buy-panel product-purchase-box">
          <div className="product-price-panel">
            {discount > 0 && <div className="product-offer-line product-detail-offer-line">{discount}% OFF</div>}
            <div className="product-detail-price modern-price-row">
              <span className="price-current product-price-main">Rs {sellingPrice}</span>
              <span className="price-original product-price-cut">Rs {product.mrp}</span>
            </div>
            {savings > 0 && <div className="product-savings-note">You save Rs {savings} on this product</div>}
            {(user?.role === 'dealer' || user?.role === 'distributor') && (
              <div className="trade-detail-note">Special {user.role} price applied for this account.</div>
            )}
          </div>

          <div className="product-detail-badges modern-badges-grid">
            <div className="detail-badge"><Truck size={16} /> {block?.dispatchBadge || 'Same-day dispatch zone'}</div>
            <div className="detail-badge"><Clock3 size={16} /> {block?.processBadge || 'Fast order processing'}</div>
            <div className="detail-badge"><ShieldCheck size={16} /> {block?.supportBadge || 'Verified Camigo support'}</div>
          </div>

          <div className="product-action-block">
            {onToggleSaved && (
              <button className={isSaved ? 'product-secondary-action saved-action active' : 'product-secondary-action saved-action'} type="button" onClick={() => onToggleSaved(product)}>
                <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved for later' : 'Save for later'}
              </button>
            )}
            <div className="product-share-row">
              <button className="product-secondary-action share-action" type="button" onClick={onShare}>
                <Share2 size={18} /> Share
              </button>
              <button className="product-secondary-action whatsapp-share-action" type="button" onClick={onWhatsAppShare}>
                <MessageCircle size={18} /> WhatsApp
              </button>
            </div>
            {shareFeedback ? <div className="product-share-feedback">{shareFeedback}</div> : null}
            {isOutOfStock ? (
              <button className="add-btn-large sold-out-detail-btn" type="button" disabled aria-disabled="true">
                <ShoppingCart size={20} /> Sold out
              </button>
            ) : selectedQty > 0 ? (
              <div className="detail-qty-stepper">
                <button type="button" onPointerDown={handlePointerAction(() => onRemove(product, cartItem))} onClick={stopActionTap}><Minus size={18} /></button>
                <strong>{selectedQty}</strong>
                <button type="button" onPointerDown={handlePointerAction(handleAdd)} onClick={stopActionTap}><Plus size={18} /></button>
              </div>
            ) : (
              <button className="add-btn-large" type="button" onPointerDown={handlePointerAction(handleAdd)} onClick={stopActionTap}>
                <ShoppingCart size={20} /> Add to cart
              </button>
            )}
            <button className="product-secondary-action" onClick={handleBuyNow} disabled={isOutOfStock}>
              <Zap size={19} /> Buy now
            </button>
          </div>

          <div className="product-trust-strip">
            <div><BadgeCheck size={16} /><span>Trusted CGI lineup</span></div>
            <div><Package2 size={16} /><span>Careful packed delivery</span></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function ProductPageBlocks({
  pageContent,
  product,
  products,
  gallery,
  activeImage,
  setActiveImage,
  user,
  onLogin,
  onAdd,
  onRemove,
  cartItems,
  priceForRole,
  savedProductIds,
  onToggleSaved,
  onShare,
  onWhatsAppShare,
  shareFeedback
}) {
  const navigate = useNavigate();
  const cartItem = cartItems.find((item) => Number(item.product_id || item.id) === Number(product.id));
  const featureList = String(product?.description || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const reviews = Array.isArray(product.reviews) ? product.reviews.slice(0, 3) : [];
  const ratingAverage = Number(product.rating_average || 4.6).toFixed(1);
  const ratingCount = Number(product.rating_count || 200);
  const warrantyYears = Math.max(1, Number(product.warranty_years || 5));
  const relatedProducts = products.filter((item) => item.id !== product.id && item.category_id === product.category_id).slice(0, 4);

  return (
    <div className="product-detail-page container">
      <button className="back-btn product-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} /> Back
      </button>

      {(pageContent?.productPage?.blocks || []).map((block) => {
        if (block.visible === false) return null;
        if (block.type === 'product_hero') {
          return (
            <ProductHeroBlock
              key={block.id}
              block={block}
              product={product}
              gallery={gallery}
              activeImage={activeImage}
              setActiveImage={setActiveImage}
              user={user}
              priceForRole={priceForRole}
              savedProductIds={savedProductIds}
              onToggleSaved={onToggleSaved}
              onAdd={onAdd}
              onRemove={onRemove}
              cartItem={cartItem}
              onLogin={onLogin}
              navigate={navigate}
              onShare={onShare}
              onWhatsAppShare={onWhatsAppShare}
              shareFeedback={shareFeedback}
            />
          );
        }
        if (block.type === 'custom_banner') return <CustomBannerBlock key={block.id} block={block} />;
        if (block.type === 'custom_text') return <CustomTextBlock key={block.id} block={block} />;
        if (block.type === 'spacer') return <div key={block.id} style={{ height: Math.max(0, Number(block.height || 24)) }} />;
        if (block.type === 'highlights') {
          return (
            <section key={block.id} className="product-detail-lower">
              <div className="product-info-card">
                <div className="product-info-card-head">
                  <span className="eyebrow">Highlights</span>
                  <h2>{block.title || 'What you are getting'}</h2>
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
            </section>
          );
        }
        if (block.type === 'service') {
          return (
            <section key={block.id} className="product-detail-lower">
              <div className="product-service-card">
                <span className="eyebrow">After purchase</span>
                <h3>{block.title || 'Delivery, warranty and support'}</h3>
                <div className="service-line"><strong>Warranty coverage</strong><span>{warrantyYears} years from the purchase date</span></div>
                <div className="service-line"><strong>Delivery zone</strong><span>Bhubaneswar and Cuttack same-day where available</span></div>
                <div className="service-line"><strong>Installation support</strong><span>Add technician help during checkout when needed</span></div>
                <div className="service-line"><strong>Best fit for</strong><span>{product.category_name || 'Homes, shops, and commercial use'}</span></div>
              </div>
            </section>
          );
        }
        if (block.type === 'reviews' && reviews.length > 0) {
          return (
            <section key={block.id} className="product-review-section">
              <div className="related-header-row">
                <div>
                  <span className="eyebrow">{block.title || 'Customer reviews'}</span>
                  <h2>Rated {ratingAverage} by Camigo buyers</h2>
                </div>
                <span className="product-review-count">{ratingCount} ratings</span>
              </div>
              <div className="product-review-grid">
                {reviews.map((review) => (
                  <div key={`${review.name}-${review.text}`} className="product-review-card">
                    <div className="product-review-stars">
                      <Star size={14} fill="currentColor" />
                      <strong>{Number(review.rating || ratingAverage).toFixed(1)}</strong>
                    </div>
                    <p>{review.text}</p>
                    <span>{review.name}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        if (block.type === 'related' && relatedProducts.length > 0) {
          return (
            <section key={block.id} className="related-products modern-related-products">
              <div className="related-header-row">
                <div>
                  <span className="eyebrow">Suggested for this setup</span>
                  <h2>{block.title || 'Related products'}</h2>
                </div>
                <button className="see-all-related" onClick={() => navigate(`/category/${product.category_id}`)}>See more</button>
              </div>
              <div className="related-product-grid">
                {relatedProducts.map((item) => (
                  <button key={item.id} className="related-product-card" onClick={() => navigate(`/product/${item.id}`)}>
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      proxyWidth={260}
                      proxyQuality={68}
                      proxyFormat="webp"
                    />
                    <div className="related-product-body">
                      <small>{item.unit}</small>
                      <strong>{item.name}</strong>
                      <span>Rs {priceForRole ? priceForRole(item, user) : item.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
