const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_PAGE_CONTENT = {
  homepage: {
    blocks: [
      { id: createId('home-hero'), type: 'hero', visible: true, kicker: 'Camigo Fast CCTV Delivery', title: 'Fast CCTV delivery for homes, shops, offices, and installers.', description: 'Order cameras, recorders, PoE switches, SMPS units, and full setup packages with quick local dispatch from Bhubaneswar.', highlights: ['Fast local dispatch', 'Trusted CCTV setups', 'Installation support'], proofs: [{ value: '5-year', label: 'warranty support' }, { value: 'Local', label: 'dispatch from Bhubaneswar' }, { value: 'Dealer', label: 'pricing for bulk buyers' }], visualBadge: 'Quick local dispatch', deliveryPill: 'Local delivery', deliveryTitle: 'Quick dispatch from Bhubaneswar', deliveryDescription: 'Product, installation, and support in one streamlined flow.' },
      { id: createId('home-categories'), type: 'category_grid', visible: true, title: 'Shop by Category' },
      { id: createId('home-setup'), type: 'setup_packages', visible: true, title: 'Full Setup Packages' },
      { id: createId('home-recent'), type: 'product_feed', visible: true, source: 'recent', title: 'Buy Again', tone: 'warm' },
      { id: createId('home-saved'), type: 'product_feed', visible: true, source: 'saved', title: 'Saved for Later', tone: 'soft' },
      { id: createId('home-recommended'), type: 'product_feed', visible: true, source: 'recommended', title: 'Recommended for You', tone: 'sky' },
      { id: createId('home-bestselling'), type: 'product_feed', visible: true, source: 'bestselling', title: 'Most Loved CCTV Picks', tone: 'contrast' },
      { id: createId('home-category-feeds'), type: 'category_feeds', visible: true, smart_deals_enabled: true, smart_deals_label: 'Automatic deal sections' }
    ]
  },
  productPage: {
    blocks: [
      { id: createId('product-hero'), type: 'product_hero', visible: true, whyTitle: 'Why buyers choose this', whyBody: 'Built for homes, shops and office setups where buyers want quick dispatch, clear specs, stable night vision and a simple buying flow.', dispatchBadge: 'Same-day dispatch zone', processBadge: 'Fast order processing', supportBadge: 'Verified Camigo support' },
      { id: createId('product-highlights'), type: 'highlights', visible: true, title: 'What you are getting' },
      { id: createId('product-service'), type: 'service', visible: true, title: 'Delivery, warranty and support' },
      { id: createId('product-reviews'), type: 'reviews', visible: true, title: 'Customer reviews' },
      { id: createId('product-related'), type: 'related', visible: true, title: 'Related products' }
    ]
  }
};

const normalizeBlock = (block = {}, pageKey = 'homepage') => {
  const type = String(block.type || '').trim();
  const base = { ...block, id: block.id || createId(pageKey), type, visible: block.visible !== false };
  if (pageKey === 'homepage') {
    if (type === 'product_feed') return { tone: 'neutral', source: 'recommended', title: 'Products', product_ids: [], ...base };
    if (type === 'custom_banner') return { image_url: '', title: '', subtitle: '', button_label: '', button_link: '', height: 220, ...base };
    if (type === 'custom_text') return { kicker: '', title: 'Text block', body: '', button_label: '', button_link: '', ...base };
    if (type === 'spacer') return { height: 24, ...base };
    if (type === 'category_grid') return { title: 'Shop by Category', ...base };
    if (type === 'setup_packages') return { title: 'Full Setup Packages', ...base };
    if (type === 'category_feeds') return { smart_deals_enabled: true, smart_deals_label: 'Automatic deal sections', ...base };
    if (type === 'hero') {
      const fallback = DEFAULT_PAGE_CONTENT.homepage.blocks.find((entry) => entry.type === 'hero');
      return { ...fallback, ...base };
    }
  }
  if (pageKey === 'productPage') {
    if (type === 'custom_banner') return { image_url: '', title: '', subtitle: '', button_label: '', button_link: '', height: 220, ...base };
    if (type === 'custom_text') return { kicker: '', title: 'Text block', body: '', button_label: '', button_link: '', ...base };
    if (type === 'spacer') return { height: 24, ...base };
    if (['highlights', 'service', 'reviews', 'related'].includes(type)) {
      const fallback = DEFAULT_PAGE_CONTENT.productPage.blocks.find((entry) => entry.type === type);
      return { ...fallback, ...base };
    }
    if (type === 'product_hero') {
      const fallback = DEFAULT_PAGE_CONTENT.productPage.blocks.find((entry) => entry.type === 'product_hero');
      return { ...fallback, ...base };
    }
  }
  return base;
};

export const normalizePageContent = (raw) => ({
  homepage: {
    blocks: (Array.isArray(raw?.homepage?.blocks) ? raw.homepage.blocks : DEFAULT_PAGE_CONTENT.homepage.blocks)
      .map((block) => normalizeBlock(block, 'homepage'))
  },
  productPage: {
    blocks: (Array.isArray(raw?.productPage?.blocks) ? raw.productPage.blocks : DEFAULT_PAGE_CONTENT.productPage.blocks)
      .map((block) => normalizeBlock(block, 'productPage'))
  }
});

export const createPageBlock = (pageKey, type) => normalizeBlock({ type }, pageKey);
