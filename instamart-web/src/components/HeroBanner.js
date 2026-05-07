import React from 'react';
import { Shield, Truck, Headphones, Sparkles, ArrowRight, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

function HeroBanner() {
  const navigate = useNavigate();

  return (
    <section className="hero-banner">
      <div className="hero-inner hero-storefront">
        <div className="hero-content hero-copy-block">
          <span className="hero-kicker">
            <Sparkles size={15} />
            Camigo Fast CCTV Delivery
          </span>
          <h1>Fast CCTV delivery for homes, shops, offices, and installers.</h1>
          <p>
            Order cameras, recorders, PoE switches, SMPS units, and full setup packages with quick local dispatch from Bhubaneswar.
          </p>
          <div className="hero-actions">
            <button type="button" className="hero-cta hero-cta-primary" onClick={() => navigate('/shop')}>
              Shop products
              <ArrowRight size={16} />
            </button>
            <button type="button" className="hero-cta hero-cta-secondary" onClick={() => navigate('/install')}>
              <Wrench size={16} />
              Book installation
            </button>
          </div>
          <div className="hero-stats hero-highlights">
            {heroHighlights.map(({ icon: Icon, label }) => (
              <div className="hero-stat hero-highlight-pill" key={label}>
                <div className="hero-stat-icon"><Icon size={16} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="hero-signal-row">
            <span className="hero-signal-pill">AHD + IP + PTZ</span>
            <span className="hero-signal-pill">5-year warranty</span>
            <span className="hero-signal-pill">Same-day local support</span>
          </div>
          <div className="hero-proof-grid">
            {heroProofs.map((item) => (
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
            <div className="hero-panel-badge">Quick local dispatch</div>
            <div className="hero-delivery-visual">
              <div className="hero-delivery-card">
                <span className="hero-delivery-pill">Local delivery</span>
                <strong>Quick dispatch from Bhubaneswar</strong>
                <small>Product, installation, and support in one streamlined flow.</small>
              </div>
              <img src="/images/camigo-delivery-hero.png" alt="Camigo delivery partner with CCTV order" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
