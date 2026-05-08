import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, LayoutTemplate, Plus, Save, Trash2 } from 'lucide-react';
import { API_URL } from '../api';
import { createPageBlock, DEFAULT_PAGE_CONTENT, normalizePageContent } from '../pageBuilder';
import { HomepageBlocks, ProductPageBlocks } from './PageBuilderRenderer';

const HOMEPAGE_TYPES = [
  ['hero', 'Hero'],
  ['custom_banner', 'Custom banner'],
  ['custom_text', 'Custom text'],
  ['category_grid', 'Category grid'],
  ['setup_packages', 'Setup packages'],
  ['product_feed', 'Product feed'],
  ['category_feeds', 'All category sections'],
  ['spacer', 'Spacer']
];

const PRODUCT_TYPES = [
  ['product_hero', 'Product hero'],
  ['custom_banner', 'Custom banner'],
  ['custom_text', 'Custom text'],
  ['highlights', 'Highlights'],
  ['service', 'Service info'],
  ['reviews', 'Reviews'],
  ['related', 'Related products'],
  ['spacer', 'Spacer']
];

function BlockEditorFields({ block, categories, onChange }) {
  const update = (field, value) => onChange({ ...block, [field]: value });

  return (
    <div className="page-builder-fields">
      <div className="form-group">
        <label>Visible</label>
        <select value={block.visible ? '1' : '0'} onChange={(e) => update('visible', e.target.value === '1')}>
          <option value="1">Show block</option>
          <option value="0">Hide block</option>
        </select>
      </div>

      {block.type === 'hero' && (
        <>
          <div className="form-group"><label>Kicker</label><input value={block.kicker || ''} onChange={(e) => update('kicker', e.target.value)} /></div>
          <div className="form-group"><label>Headline</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Description</label><textarea rows="3" value={block.description || ''} onChange={(e) => update('description', e.target.value)} /></div>
          <div className="form-group"><label>Visual badge</label><input value={block.visualBadge || ''} onChange={(e) => update('visualBadge', e.target.value)} /></div>
          <div className="form-group"><label>Delivery pill</label><input value={block.deliveryPill || ''} onChange={(e) => update('deliveryPill', e.target.value)} /></div>
          <div className="form-group"><label>Delivery title</label><input value={block.deliveryTitle || ''} onChange={(e) => update('deliveryTitle', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Delivery description</label><textarea rows="2" value={block.deliveryDescription || ''} onChange={(e) => update('deliveryDescription', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Highlights</label><input value={(block.highlights || []).join(' | ')} onChange={(e) => update('highlights', e.target.value.split('|').map((item) => item.trim()).filter(Boolean))} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Proof cards</label><input value={(block.proofs || []).map((item) => `${item.value}:${item.label}`).join(' | ')} onChange={(e) => update('proofs', e.target.value.split('|').map((item) => item.trim()).filter(Boolean).map((item) => { const [value, ...rest] = item.split(':'); return { value: value?.trim() || '', label: rest.join(':').trim() || '' }; }))} /></div>
        </>
      )}

      {['custom_banner'].includes(block.type) && (
        <>
          <div className="form-group"><label>Image URL</label><input value={block.image_url || ''} onChange={(e) => update('image_url', e.target.value)} /></div>
          <div className="form-group"><label>Height</label><input type="number" value={block.height || 220} onChange={(e) => update('height', Number(e.target.value || 0))} /></div>
          <div className="form-group"><label>Title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="form-group"><label>Subtitle</label><input value={block.subtitle || ''} onChange={(e) => update('subtitle', e.target.value)} /></div>
          <div className="form-group"><label>Button label</label><input value={block.button_label || ''} onChange={(e) => update('button_label', e.target.value)} /></div>
          <div className="form-group"><label>Button link</label><input value={block.button_link || ''} onChange={(e) => update('button_link', e.target.value)} /></div>
        </>
      )}

      {['custom_text'].includes(block.type) && (
        <>
          <div className="form-group"><label>Kicker</label><input value={block.kicker || ''} onChange={(e) => update('kicker', e.target.value)} /></div>
          <div className="form-group"><label>Title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Body</label><textarea rows="4" value={block.body || ''} onChange={(e) => update('body', e.target.value)} /></div>
          <div className="form-group"><label>Button label</label><input value={block.button_label || ''} onChange={(e) => update('button_label', e.target.value)} /></div>
          <div className="form-group"><label>Button link</label><input value={block.button_link || ''} onChange={(e) => update('button_link', e.target.value)} /></div>
        </>
      )}

      {block.type === 'category_grid' && <div className="form-group"><label>Section title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>}
      {block.type === 'setup_packages' && <div className="form-group"><label>Section title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>}

      {block.type === 'product_feed' && (
        <>
          <div className="form-group"><label>Section title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="form-group">
            <label>Source</label>
            <select value={block.source || 'recommended'} onChange={(e) => update('source', e.target.value)}>
              <option value="recent">Recent / Buy Again</option>
              <option value="saved">Saved</option>
              <option value="recommended">Recommended</option>
              <option value="bestselling">Bestselling</option>
              <option value="category">Single category</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tone</label>
            <select value={block.tone || 'neutral'} onChange={(e) => update('tone', e.target.value)}>
              <option value="neutral">Neutral</option>
              <option value="warm">Warm</option>
              <option value="soft">Soft</option>
              <option value="sky">Sky</option>
              <option value="contrast">Contrast</option>
            </select>
          </div>
          {block.source === 'category' && (
            <div className="form-group">
              <label>Category</label>
              <select value={String(block.category_id || '')} onChange={(e) => update('category_id', Number(e.target.value || 0))}>
                <option value="">Choose category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {['product_hero'].includes(block.type) && (
        <>
          <div className="form-group"><label>Why title</label><input value={block.whyTitle || ''} onChange={(e) => update('whyTitle', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Why body</label><textarea rows="3" value={block.whyBody || ''} onChange={(e) => update('whyBody', e.target.value)} /></div>
          <div className="form-group"><label>Dispatch badge</label><input value={block.dispatchBadge || ''} onChange={(e) => update('dispatchBadge', e.target.value)} /></div>
          <div className="form-group"><label>Process badge</label><input value={block.processBadge || ''} onChange={(e) => update('processBadge', e.target.value)} /></div>
          <div className="form-group"><label>Support badge</label><input value={block.supportBadge || ''} onChange={(e) => update('supportBadge', e.target.value)} /></div>
        </>
      )}

      {['highlights', 'service', 'reviews', 'related'].includes(block.type) && (
        <div className="form-group"><label>Section title</label><input value={block.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
      )}

      {block.type === 'spacer' && <div className="form-group"><label>Height</label><input type="number" value={block.height || 24} onChange={(e) => update('height', Number(e.target.value || 0))} /></div>}
    </div>
  );
}

function PageBuilderAdmin({ products = [], categories = [], pageContent, onPageContentSaved, setMessage }) {
  const [pageKey, setPageKey] = useState('homepage');
  const [draft, setDraft] = useState(() => normalizePageContent(pageContent || DEFAULT_PAGE_CONTENT));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(normalizePageContent(pageContent || DEFAULT_PAGE_CONTENT));
  }, [pageContent]);

  const sampleProduct = useMemo(() => products.find(Boolean) || {
    id: 9999,
    name: 'CGI Demo Camera',
    description: 'Night vision, weatherproof, motion alerts, app access, metal body, clear audio',
    price: 4990,
    mrp: 8999,
    image: '/images/cgi-new.jpg',
    images: ['/images/cgi-new.jpg'],
    unit: '1 Unit',
    category_id: categories[0]?.id || 1,
    category_name: categories[0]?.name || 'Demo Category',
    warranty_years: 5,
    stock: 20,
    rating_average: 4.9,
    rating_count: 214,
    reviews: [{ name: 'Camigo Buyer', text: 'Good product and quick delivery.', rating: 4.9 }]
  }, [products, categories]);

  const pageBlocks = draft?.[pageKey]?.blocks || [];
  const addBlock = (type) => setDraft((current) => ({ ...current, [pageKey]: { blocks: [...(current[pageKey]?.blocks || []), createPageBlock(pageKey, type)] } }));
  const updateBlock = (index, nextBlock) => setDraft((current) => ({ ...current, [pageKey]: { blocks: current[pageKey].blocks.map((block, blockIndex) => (blockIndex === index ? nextBlock : block)) } }));
  const deleteBlock = (index) => setDraft((current) => ({ ...current, [pageKey]: { blocks: current[pageKey].blocks.filter((_, blockIndex) => blockIndex !== index) } }));
  const moveBlock = (index, direction) => setDraft((current) => {
    const next = [...current[pageKey].blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, [pageKey]: { blocks: next } };
  });

  const saveLayout = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      const normalized = normalizePageContent(draft);
      const res = await fetch(`${API_URL}/admin/page-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(normalized)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save page builder');
      const next = normalizePageContent(data);
      setDraft(next);
      onPageContentSaved?.(next);
      setMessage?.(data.message || 'Page content saved.');
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-builder-admin">
      <div className="card page-builder-head">
        <div>
          <span className="phone-verify-eyebrow">Live page builder</span>
          <h3 style={{ margin: '4px 0 6px' }}>Edit homepage and product page like a live content builder</h3>
          <p className="checkout-note" style={{ margin: 0 }}>
            Add sections, change text, swap banners, move blocks up or down, then save. The same saved layout is used on the live customer pages.
          </p>
        </div>
        <div className="page-builder-head-actions">
          <button type="button" className={`btn btn-sm ${pageKey === 'homepage' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPageKey('homepage')}>
            <LayoutTemplate size={15} /> Homepage
          </button>
          <button type="button" className={`btn btn-sm ${pageKey === 'productPage' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPageKey('productPage')}>
            <Eye size={15} /> Product page
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveLayout} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save live changes'}
          </button>
        </div>
      </div>

      <div className="page-builder-shell">
        <div className="page-builder-left">
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Add block</h4>
            <div className="page-builder-add-grid">
              {(pageKey === 'homepage' ? HOMEPAGE_TYPES : PRODUCT_TYPES).map(([value, label]) => (
                <button key={value} type="button" className="btn btn-outline btn-sm" onClick={() => addBlock(value)}>
                  <Plus size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="page-builder-block-stack">
            {pageBlocks.map((block, index) => (
              <div key={block.id} className="card page-builder-block-card">
                <div className="page-builder-block-head">
                  <div>
                    <strong>{block.type.replace(/_/g, ' ')}</strong>
                    <span>Position {index + 1}</span>
                  </div>
                  <div className="page-builder-block-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => moveBlock(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => moveBlock(index, 1)} disabled={index === pageBlocks.length - 1}><ArrowDown size={14} /></button>
                    <button type="button" className="btn btn-sm banner-delete-btn" onClick={() => deleteBlock(index)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <BlockEditorFields block={block} categories={categories} onChange={(nextBlock) => updateBlock(index, nextBlock)} />
              </div>
            ))}
          </div>
        </div>

        <div className="page-builder-right">
          <div className="card page-builder-preview-card">
            <div className="page-builder-preview-head">
              <strong>Live preview</strong>
              <span>{pageKey === 'homepage' ? 'Homepage view' : 'Product page view'}</span>
            </div>
            <div className="page-builder-preview-shell">
              {pageKey === 'homepage' ? (
                <HomepageBlocks
                  pageContent={draft}
                  categories={categories}
                  setupProducts={products}
                  recentProducts={products.slice(0, 6)}
                  savedProducts={products.slice(0, 6)}
                  recommendedProducts={products.slice(0, 8)}
                  bestsellingProducts={products.slice(0, 8)}
                  regularProducts={products}
                  cartItems={[]}
                  addToCart={() => {}}
                  removeFromCart={() => {}}
                  user={null}
                  savedProductIds={[]}
                  onToggleSaved={() => {}}
                  deliveryEtaLabel="16 mins"
                />
              ) : (
                <ProductPageBlocks
                  pageContent={draft}
                  product={sampleProduct}
                  products={products.length ? products : [sampleProduct]}
                  gallery={Array.isArray(sampleProduct.images) && sampleProduct.images.length ? sampleProduct.images : [sampleProduct.image].filter(Boolean)}
                  activeImage={(Array.isArray(sampleProduct.images) && sampleProduct.images[0]) || sampleProduct.image}
                  setActiveImage={() => {}}
                  user={null}
                  onLogin={() => {}}
                  onAdd={() => {}}
                  onRemove={() => {}}
                  cartItems={[]}
                  priceForRole={(product) => product.price}
                  savedProductIds={[]}
                  onToggleSaved={() => {}}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageBuilderAdmin;
