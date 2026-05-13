import React from 'react';
import { Shield, Truck, Headphones, Sparkles } from 'lucide-react';

const heroHighlights = [
  { icon: Truck, label: 'Fast local dispatch' },
  { icon: Shield, label: 'Trusted CCTV setups' },
  { icon: Headphones, label: 'Installation support' }
];

const heroProofs = [
  { value: '5-year', label: 'warranty support' },
  { value: 'Local', label: 'dispatch from Bhubaneswar' },
  { value: 'Dealer', label: 'pricing for bulk buyers' }
];

function HeroBanner({ config = null }) {
  const highlights = Array.isArray(config?.highlights) && config.highlights.length
    ? config.highlights.map((label, index) => ({ icon: heroHighlights[index % heroHighlights.length].icon, label }))
    : heroHighlights;
  const proofs = Array.isArray(config?.proofs) && config.proofs.length ? config.proofs : heroProofs;
  return (
    <section className="hero-banner">
      <div className="hero-inner hero-storefront">
        <div className="hero-content hero-copy-block">
          <span className="hero-kicker">
            <Sparkles size={15} />
            {config?.kicker || 'Camigo Fast CCTV Delivery'}
          </span>
          <h1>{config?.title || 'Fast CCTV delivery for homes, shops, offices, and installers.'}</h1>
          <p>
            {config?.description || 'Order cameras, recorders, PoE switches, SMPS units, and full setup packages with quick local dispatch from Bhubaneswar.'}
          </p>
          <div className="hero-stats hero-highlights">
            {highlights.map(({ icon: Icon, label }) => (
              <div className="hero-stat hero-highlight-pill" key={label}>
                <div className="hero-stat-icon"><Icon size={16} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="hero-proof-grid">
            {proofs.map((item) => (
              <div className="hero-proof-card" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual-board" aria-hidden="true">
          <div className="hero-visual-glow" />
          <div className="hero-visual-panel">
            <div className="hero-panel-badge">{config?.visualBadge || 'Quick local dispatch'}</div>
            <div className="hero-delivery-visual">
              <div className="hero-delivery-card">
                <span className="hero-delivery-pill">{config?.deliveryPill || 'Local delivery'}</span>
                <strong>{config?.deliveryTitle || 'Quick dispatch from Bhubaneswar'}</strong>
                <small>{config?.deliveryDescription || 'Product, installation, and support in one streamlined flow.'}</small>
              </div>
              <picture>
                <source srcSet="/images/camigo-delivery-hero.webp" type="image/webp" />
                <img
                  src="/images/camigo-delivery-hero.png"
                  alt="Camigo delivery partner with CCTV order"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  width="447"
                  height="558"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
