import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { API_URL } from '../api';

const formatPrice = (value) => `Rs ${new Intl.NumberFormat('en-IN').format(Math.max(0, Number(value || 0)))}`;

function SetupPackagesSection({ products = [], onAdd, onRemove, cartItems = [] }) {
  const [packages, setPackages] = useState([]);
  const navigate = useNavigate();

  const productMap = useMemo(
    () => new Map(products.map((product) => [Number(product.id), product])),
    [products]
  );

  useEffect(() => {
    let cancelled = false;
    const loadPackages = async () => {
      try {
        const res = await fetch(`${API_URL}/setup-packages`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setPackages(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) setPackages([]);
      }
    };
    loadPackages();
    return () => { cancelled = true; };
  }, []);

  if (!packages.length) return null;

  return (
    <section className="category-section setup-packages-section">
      <div className="section-header">
        <div>
          <span className="phone-verify-eyebrow">Ready CCTV combos</span>
          <h2 className="section-title">Full Setup Packages</h2>
        </div>
        <span className="see-all">Quick quote</span>
      </div>
      <div className="setup-package-grid">
        {packages.map((entry) => {
          const linkedProduct = productMap.get(Number(entry.linked_product_id || 0)) || null;
          const cartItem = linkedProduct
            ? cartItems.find((item) => Number(item.product_id || item.id) === Number(linkedProduct.id))
            : null;
          const selectedQty = Number(cartItem?.quantity || 0);

          return (
          <article
            key={entry.id}
            className={linkedProduct ? 'setup-package-card clickable' : 'setup-package-card'}
            onClick={() => linkedProduct && navigate(`/product/${linkedProduct.id}`)}
          >
            <div className="setup-package-visual">
              <img src={entry.image} alt={entry.title} loading="lazy" />
              {entry.badge ? <span className="setup-package-badge">{entry.badge}</span> : null}
            </div>
            <div className="setup-package-body">
              <div className="setup-package-price-row">
                <strong>{entry.title}</strong>
                <span>{formatPrice(entry.price)}</span>
              </div>
              <p>{entry.subtitle || 'Camigo full setup package with delivery support.'}</p>
              {linkedProduct ? (
                <div className="setup-package-action-row" onClick={(event) => event.stopPropagation()}>
                  {selectedQty > 0 ? (
                    <div className="card-qty-stepper">
                      <button type="button" onClick={() => onRemove?.(linkedProduct, cartItem)}><Minus size={15} /></button>
                      <strong>{selectedQty}</strong>
                      <button type="button" onClick={() => onAdd?.(linkedProduct)}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button className="add-btn" type="button" onClick={() => onAdd?.(linkedProduct)}>
                      ADD
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/product/${linkedProduct.id}`)}>
                    View
                  </button>
                </div>
              ) : (
                <div className="setup-package-unlinked-note">Link a product from Admin to enable buying this setup.</div>
              )}
            </div>
          </article>
        );
        })}
      </div>
    </section>
  );
}

export default SetupPackagesSection;
